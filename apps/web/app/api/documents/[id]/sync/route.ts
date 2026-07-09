import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, runWithUserContext } from '@docsync/db';
import {
  getDocumentRole,
  SyncPayloadSchema,
  MAX_SYNC_PAYLOAD_BYTES,
  MAX_UPDATE_BYTES,
} from '@docsync/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ─── Auth check ────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  // ─── Authorization check ──────────────────────────────────────────
  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // ─── Layer 1: Payload size limit (transport-level) ────────────────
  // Check content-length BEFORE reading the body to reject oversized
  // payloads without allocating memory for them.
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_SYNC_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: `Payload too large. Maximum size is ${MAX_SYNC_PAYLOAD_BYTES} bytes.` },
      { status: 413 }
    );
  }

  // ─── Layer 2: JSON parse ──────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // ─── Layer 3: Zod schema validation ───────────────────────────────
  const parseResult = SyncPayloadSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { updates, lastSeenLogId } = parseResult.data;

  // ─── Viewer restrictions ──────────────────────────────────────────
  if (updates.length > 0 && role === 'VIEWER') {
    return NextResponse.json({ error: 'Viewers cannot push updates' }, { status: 403 });
  }

  try {
    // ─── Process pushed updates ───────────────────────────────────
    if (updates.length > 0) {
      await runWithUserContext(userId, async (tx) => {
        for (const updateBase64 of updates) {
          const updateBytes = Buffer.from(updateBase64, 'base64');

          // Layer 4: Individual update binary size check
          if (updateBytes.length > MAX_UPDATE_BYTES) {
            console.warn(`[SyncRoute] Rejected oversized update (${updateBytes.length}B) from ${userId}`);
            continue; // Skip this update, process remaining
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
      console.log(`[SyncRoute] Processed ${updates.length} updates pushed by ${userId} for document: ${documentId}`);
    }

    // ─── Retrieve new updates (Pull) ─────────────────────────────
    let cursorTime = new Date(0);
    if (lastSeenLogId) {
      // Use RLS-scoped transaction for cursor lookup too
      const lastLog = await runWithUserContext(userId, async (tx) => {
        return tx.documentUpdateLog.findUnique({
          where: { id: lastSeenLogId },
        });
      });
      if (lastLog) {
        cursorTime = lastLog.createdAt;
      }
    }

    // Fetch all logs newer than lastSeenLogId under RLS context
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
