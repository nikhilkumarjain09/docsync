/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, runWithUserContext } from '@docsync/db';
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

  // 1. Authorization check: Only OWNER or EDITOR can restore snapshots
  const role = await getDocumentRole(userId, documentId);
  if (!role || (role !== 'OWNER' && role !== 'EDITOR')) {
    return NextResponse.json(
      { error: 'Unauthorized: Only Owners or Editors can restore versions' },
      { status: 403 },
    );
  }

  try {
    // 2. Fetch the target snapshot — use RLS-scoped transaction (previously
    //    this was a bare db call that bypassed RLS; now fixed).
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

    // 3. Validate the snapshot state is not corrupt
    const targetDoc = new Y.Doc();
    try {
      Y.applyUpdate(targetDoc, new Uint8Array(snapshot.state));
    } catch (yErr: any) {
      targetDoc.destroy();
      console.error(`[RestoreRoute] Corrupt snapshot state for ${snapshotId}: ${yErr.message}`);
      return NextResponse.json(
        { error: 'Snapshot data is corrupt and cannot be restored' },
        { status: 500 },
      );
    }
    targetDoc.destroy();

    // 4. Return the snapshot state to the client so it can perform the
    //    restore transaction directly on its own live Y.Doc. This avoids
    //    the state-vector divergence issue where the server's liveDoc
    //    (built from DB logs) differs from the client's real-time state.
    const snapshotStateBase64 = Buffer.from(snapshot.state).toString('base64');

    console.log(
      `[RestoreRoute] Returning snapshot state for doc ${documentId}, snapshot ${snapshotId} to client for local restore.`,
    );

    return NextResponse.json({
      snapshotId,
      snapshotState: snapshotStateBase64,
    });
  } catch (e: any) {
    console.error('[RestoreRoute] Snapshot restore operation failed:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
