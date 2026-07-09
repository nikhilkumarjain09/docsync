import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, runWithUserContext } from '@docsync/db';
import { getDocumentRole, SnapshotCreateSchema } from '@docsync/shared';
import * as Y from 'yjs';

// GET: List all snapshots for a document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const snapshots = await runWithUserContext(userId, async (tx) => {
      return tx.documentSnapshot.findMany({
        where: { documentId },
        include: {
          creator: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    return NextResponse.json(snapshots);
  } catch (e: any) {
    console.error('[SnapshotsRoute] Failed to fetch snapshots:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new collapse checkpoint (snapshot) of the document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  const role = await getDocumentRole(userId, documentId);
  if (!role || (role !== 'OWNER' && role !== 'EDITOR')) {
    return NextResponse.json({ error: 'Unauthorized: Only Owners or Editors can save versions' }, { status: 403 });
  }

  // ─── Zod validation ────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (e) {
    rawBody = {};
  }

  const parseResult = SnapshotCreateSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { label } = parseResult.data;

  try {
    // 1. Fetch all updates to build the complete document state
    const updateLogs = await runWithUserContext(userId, async (tx) => {
      return tx.documentUpdateLog.findMany({
        where: { documentId },
        orderBy: { createdAt: 'asc' },
      });
    });

    // 2. Merge all updates using a temporary server-side Y.Doc
    //    Wrap each Y.applyUpdate in try/catch — a single corrupt log entry
    //    must not prevent the snapshot from being created from remaining valid entries.
    const tempDoc = new Y.Doc();
    let corruptCount = 0;
    for (const log of updateLogs) {
      try {
        Y.applyUpdate(tempDoc, new Uint8Array(log.update));
      } catch (yErr: any) {
        corruptCount++;
        console.warn(`[SnapshotsRoute] Skipped corrupt update log ${log.id}: ${yErr.message}`);
      }
    }
    if (corruptCount > 0) {
      console.warn(`[SnapshotsRoute] ${corruptCount}/${updateLogs.length} update logs were corrupt during snapshot creation for doc: ${documentId}`);
    }

    // 3. Compress current Y.Doc state as a single state update
    const compressedState = Y.encodeStateAsUpdate(tempDoc);
    tempDoc.destroy();

    // 4. Save snapshot row in database
    const snapshot = await runWithUserContext(userId, async (tx) => {
      return tx.documentSnapshot.create({
        data: {
          documentId,
          state: Buffer.from(compressedState),
          createdBy: userId,
          label: label || `Manual checkpoint (${new Date().toLocaleDateString()})`,
        },
        include: {
          creator: {
            select: { name: true, email: true },
          },
        },
      });
    });

    console.log(`[SnapshotsRoute] Created snapshot "${snapshot.label}" (ID: ${snapshot.id}) for doc: ${documentId}`);
    return NextResponse.json(snapshot);
  } catch (e: any) {
    console.error('[SnapshotsRoute] Failed to save snapshot:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
