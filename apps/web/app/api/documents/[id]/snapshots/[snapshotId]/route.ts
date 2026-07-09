import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, runWithUserContext } from '@docsync/db';
import { getDocumentRole } from '@docsync/shared';

// GET: Retrieve a specific snapshot's state bytes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId, snapshotId } = await params;
  const userId = session.user.id;

  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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

    // Return snapshot details and base64-encoded state
    return NextResponse.json({
      id: snapshot.id,
      documentId: snapshot.documentId,
      label: snapshot.label,
      createdAt: snapshot.createdAt,
      state: Buffer.from(snapshot.state).toString('base64'),
    });
  } catch (e: any) {
    console.error('[SnapshotGetRoute] Failed to fetch snapshot details:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
