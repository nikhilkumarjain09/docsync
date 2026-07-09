import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, runWithUserContext } from '@docsync/db';
import { getDocumentRole } from '@docsync/shared';
import * as Y from 'yjs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
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
    return NextResponse.json({ error: 'Unauthorized: Only Owners or Editors can restore versions' }, { status: 403 });
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

    // 3. Hydrate target document state from snapshot to read its text
    //    Wrapped in try/catch — a corrupt snapshot should return 500, not crash.
    const targetDoc = new Y.Doc();
    try {
      Y.applyUpdate(targetDoc, new Uint8Array(snapshot.state));
    } catch (yErr: any) {
      targetDoc.destroy();
      console.error(`[RestoreRoute] Corrupt snapshot state for ${snapshotId}: ${yErr.message}`);
      return NextResponse.json({ error: 'Snapshot data is corrupt and cannot be restored' }, { status: 500 });
    }
    const targetTextFragment = targetDoc.getXmlFragment('default').get(0) as Y.Text;
    const targetText = targetTextFragment ? targetTextFragment.toString() : '';
    targetDoc.destroy();

    // 4. Fetch all current database logs to rebuild the live document state
    const updateLogs = await runWithUserContext(userId, async (tx) => {
      return tx.documentUpdateLog.findMany({
        where: { documentId },
        orderBy: { createdAt: 'asc' },
      });
    });

    // Hydrate live state — skip any corrupt log entries gracefully
    const liveDoc = new Y.Doc();
    for (const log of updateLogs) {
      try {
        Y.applyUpdate(liveDoc, new Uint8Array(log.update));
      } catch (yErr: any) {
        console.warn(`[RestoreRoute] Skipped corrupt update log ${log.id}: ${yErr.message}`);
      }
    }

    // 5. Compute forward replacement update to match target text without breaking concurrent edits
    let restoreUpdateBytes: Uint8Array | null = null;
    liveDoc.on('update', (update) => {
      restoreUpdateBytes = update;
    });

    const liveTextFragment = liveDoc.getXmlFragment('default').get(0) as Y.Text;
    if (liveTextFragment) {
      liveDoc.transact(() => {
        liveTextFragment.delete(0, liveTextFragment.length);
        liveTextFragment.insert(0, targetText);
      });
    } else {
      liveDoc.transact(() => {
        const newText = new Y.Text(targetText);
        liveDoc.getXmlFragment('default').insert(0, [newText as any]);
      });
    }
    liveDoc.destroy();

    if (!restoreUpdateBytes) {
      return NextResponse.json({ error: 'No changes detected between current state and target snapshot' }, { status: 400 });
    }

    // 6. Save the calculated forward update to Postgres, logging the restore event
    const savedLog = await runWithUserContext(userId, async (tx) => {
      return tx.documentUpdateLog.create({
        data: {
          documentId,
          update: Buffer.from(restoreUpdateBytes!),
          createdBy: userId,
          restoredFromSnapshotId: snapshotId,
        },
      });
    });

    console.log(`[RestoreRoute] Successfully restored document ${documentId} to snapshot ${snapshotId}. Created update log: ${savedLog.id}`);

    // Return the generated update details to the client
    return NextResponse.json({
      id: savedLog.id,
      update: Buffer.from(restoreUpdateBytes!).toString('base64'),
    });
  } catch (e: any) {
    console.error('[RestoreRoute] Snapshot restore operation failed:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
