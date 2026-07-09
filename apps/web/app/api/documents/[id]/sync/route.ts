import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, runWithUserContext } from '@docsync/db';
import { getDocumentRole } from '@docsync/shared';

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

  // 1. Authorization check
  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { updates, lastSeenLogId } = body as {
    updates: string[];
    lastSeenLogId: string | null;
  };

  // 2. Viewer restrictions
  if (updates && updates.length > 0 && role === 'VIEWER') {
    return NextResponse.json({ error: 'Viewers cannot push updates' }, { status: 403 });
  }

  try {
    // 3. Process pushed updates under user context (enforcing RLS policies)
    if (updates && updates.length > 0) {
      await runWithUserContext(userId, async (tx) => {
        for (const updateBase64 of updates) {
          const updateBytes = Buffer.from(updateBase64, 'base64');
          await tx.documentUpdateLog.create({
            data: {
              documentId,
              update: updateBytes,
              createdBy: userId,
            },
          });
        }
      });
      console.log(`[SyncRoute] Processed ${updates.length} updates pushed by ${userId} for document: ${documentId}`);
    }

    // 4. Retrieve new updates to return to the client (Pull)
    let cursorTime = new Date(0);
    if (lastSeenLogId) {
      const lastLog = await db.documentUpdateLog.findUnique({
        where: { id: lastSeenLogId },
      });
      if (lastLog) {
        cursorTime = lastLog.createdAt;
      }
    }

    // Fetch all logs newer than lastSeenLogId
    // We enforce user context via RLS transaction for pulling updates too
    const newLogs = await runWithUserContext(userId, async (tx) => {
      return tx.documentUpdateLog.findMany({
        where: {
          documentId,
          createdAt: {
            gt: cursorTime,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });

    // Format updates to base64
    const formattedUpdates = newLogs.map((log) => ({
      id: log.id,
      update: Buffer.from(log.update).toString('base64'),
      createdBy: log.createdBy,
      createdAt: log.createdAt,
    }));

    const nextLogId = newLogs.length > 0 ? newLogs[newLogs.length - 1].id : lastSeenLogId;

    return NextResponse.json({
      updates: formattedUpdates,
      lastSeenLogId: nextLogId,
    });
  } catch (e: any) {
    console.error('[SyncRoute] Sync database operation failed:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
