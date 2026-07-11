import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { runWithUserContext } from '@docsync/db';
import { getDocumentRole, SnapshotCreateSchema, extractDocumentText } from '@docsync/shared';
import { handleApiError } from '@/lib/api-error';
import * as Y from 'yjs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  const role = await getDocumentRole(userId, documentId);
  if (!role || (role !== 'OWNER' && role !== 'EDITOR')) {
    return NextResponse.json(
      { error: 'Unauthorized: Only Owners or Editors can save versions' },
      { status: 403 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }

  const parseResult = SnapshotCreateSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { label, state: clientStateBase64 } = parseResult.data;

  try {
    let compressedState: Uint8Array;

    if (clientStateBase64) {
      const clientStateBytes = new Uint8Array(Buffer.from(clientStateBase64, 'base64'));
      const tempDoc = new Y.Doc();
      try {
        Y.applyUpdate(tempDoc, clientStateBytes);
      } catch (yErr) {
        tempDoc.destroy();
        const msg = yErr instanceof Error ? yErr.message : String(yErr);
        console.error(`[SnapshotsRoute] Invalid client-provided state: ${msg}`);
        return NextResponse.json({ error: 'Invalid document state' }, { status: 400 });
      }
      compressedState = Y.encodeStateAsUpdate(tempDoc);
      tempDoc.destroy();
    } else {
      const updateLogs = await runWithUserContext(userId, async (tx) => {
        return tx.documentUpdateLog.findMany({
          where: { documentId },
          orderBy: { createdAt: 'asc' },
        });
      });

      const tempDoc = new Y.Doc();
      for (const log of updateLogs) {
        try {
          Y.applyUpdate(tempDoc, new Uint8Array(log.update));
        } catch {
          // Skip corrupt log entries
        }
      }

      compressedState = Y.encodeStateAsUpdate(tempDoc);
      tempDoc.destroy();
    }

    const searchDoc = new Y.Doc();
    let headings = '';
    let paragraphs = '';
    let lists = '';
    let tables = '';
    let content = '';
    try {
      Y.applyUpdate(searchDoc, compressedState);
      const textData = extractDocumentText(searchDoc);
      headings = textData.headings;
      paragraphs = textData.paragraphs;
      lists = textData.lists;
      tables = textData.tables;
      content = textData.content;
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.warn(`[SnapshotsRoute] Text extraction failed: ${msg}`);
    } finally {
      searchDoc.destroy();
    }

    const snapshot = await runWithUserContext(userId, async (tx) => {
      const snap = await tx.documentSnapshot.create({
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

      await tx.document.update({
        where: { id: documentId },
        data: {
          latestSnapshot: Buffer.from(compressedState),
          snapshotVersion: {
            increment: 1,
          },
          content: content || null,
          headings: headings || null,
          paragraphs: paragraphs || null,
          tables: tables || null,
          lists: lists || null,
        },
      });

      return snap;
    });

    return NextResponse.json(snapshot);
  } catch (err) {
    return handleApiError(err);
  }
}
