import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { runWithUserContext } from '@docsync/db';
import {
  getDocumentRole,
  SyncPayloadSchema,
  MAX_SYNC_PAYLOAD_BYTES,
  MAX_UPDATE_BYTES,
} from '@docsync/shared';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Pre-emptively reject oversized payloads before reading the request stream
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_SYNC_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: `Payload too large. Maximum size is ${MAX_SYNC_PAYLOAD_BYTES} bytes.` },
      { status: 413 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = SyncPayloadSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { updates, lastSeenLogId } = parseResult.data;

  if (updates.length > 0 && role === 'VIEWER') {
    return NextResponse.json({ error: 'Viewers cannot push updates' }, { status: 403 });
  }

  try {
    if (updates.length > 0) {
      await runWithUserContext(userId, async (tx) => {
        for (const updateBase64 of updates) {
          const updateBytes = Buffer.from(updateBase64, 'base64');

          if (updateBytes.length > MAX_UPDATE_BYTES) {
            console.warn(
              `[SyncRoute] Rejected oversized update (${updateBytes.length}B) from user ${userId}`,
            );
            continue;
          }

          await tx.documentUpdateLog.create({
            data: {
              documentId,
              update: updateBytes,
              createdBy: userId,
            },
          });
        }
      });
    }

    let cursorTime = new Date(0);
    if (lastSeenLogId) {
      const lastLog = await runWithUserContext(userId, async (tx) => {
        return tx.documentUpdateLog.findUnique({
          where: { id: lastSeenLogId },
        });
      });
      if (lastLog) {
        cursorTime = lastLog.createdAt;
      }
    }

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
  } catch (err: unknown) {
    console.error('[SyncRoute] Sync operation failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
