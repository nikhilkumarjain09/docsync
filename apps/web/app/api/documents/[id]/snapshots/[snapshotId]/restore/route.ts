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

    // Helper function to recursively clone Yjs XML nodes from one document to another
    function cloneNode(node: any): any {
      if (!node) return node;
      if (node instanceof Y.XmlText) {
        const text = new Y.XmlText();
        text.insert(0, node.toString());
        return text;
      } else if (node instanceof Y.XmlElement) {
        const el = new Y.XmlElement(node.nodeName);
        // Copy attributes
        const attrs = node.getAttributes();
        if (attrs) {
          for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v as string);
          }
        }
        // Copy children recursively using node.length and .get(i)
        const childrenList: any[] = [];
        for (let i = 0; i < node.length; i++) {
          childrenList.push(node.get(i));
        }
        el.insert(0, childrenList.map(cloneNode));
        return el;
      }
      return node;
    }

    // 3. Hydrate target document state from snapshot
    const targetDoc = new Y.Doc();
    try {
      Y.applyUpdate(targetDoc, new Uint8Array(snapshot.state));
    } catch (yErr: any) {
      targetDoc.destroy();
      console.error(`[RestoreRoute] Corrupt snapshot state for ${snapshotId}: ${yErr.message}`);
      return NextResponse.json({ error: 'Snapshot data is corrupt and cannot be restored' }, { status: 500 });
    }
    const targetFragment = targetDoc.getXmlFragment('default');

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

    // 5. Compute forward replacement update to match target fragment structure
    let restoreUpdateBytes: Uint8Array | null = null;
    liveDoc.on('update', (update) => {
      restoreUpdateBytes = update;
    });

    const liveFragment = liveDoc.getXmlFragment('default');
    liveDoc.transact(() => {
      // 1. Clear all children in the live fragment
      liveFragment.delete(0, liveFragment.length);
      // 2. Clone and insert all children from the target snapshot fragment using a loop
      const childrenList: any[] = [];
      for (let i = 0; i < targetFragment.length; i++) {
        childrenList.push(targetFragment.get(i));
      }
      const clonedChildren = childrenList.map(cloneNode);
      liveFragment.insert(0, clonedChildren);
    });

    targetDoc.destroy();
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
