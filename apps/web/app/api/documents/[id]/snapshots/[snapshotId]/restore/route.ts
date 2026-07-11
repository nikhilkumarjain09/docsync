import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { runWithUserContext } from '@docsync/db';
import { getDocumentRole } from '@docsync/shared';
import * as Y from 'yjs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId, snapshotId } = await params;
  const userId = session.user.id;

  const role = await getDocumentRole(userId, documentId);
  if (!role || (role !== 'OWNER' && role !== 'EDITOR')) {
    return NextResponse.json(
      { error: 'Unauthorized: Only Owners or Editors can restore versions' },
      { status: 403 },
    );
  }

  try {
    const snapshot = await runWithUserContext(userId, async (tx) => {
      return tx.documentSnapshot.findFirst({
        where: {
          id: snapshotId,
          documentId,
        },
      });
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    const targetDoc = new Y.Doc();
    try {
      Y.applyUpdate(targetDoc, new Uint8Array(snapshot.state));
    } catch (yErr) {
      targetDoc.destroy();
      const msg = yErr instanceof Error ? yErr.message : String(yErr);
      console.error(`[RestoreRoute] Corrupt snapshot state for ${snapshotId}: ${msg}`);
      return NextResponse.json(
        { error: 'Snapshot data is corrupt and cannot be restored' },
        { status: 500 },
      );
    }
    targetDoc.destroy();

    const snapshotStateBase64 = Buffer.from(snapshot.state).toString('base64');

    return NextResponse.json({
      snapshotId,
      snapshotState: snapshotStateBase64,
    });
  } catch (err: unknown) {
    console.error('[RestoreRoute] Snapshot restore operation failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
