import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as url from 'url';
import * as dotenv from 'dotenv';
import * as Y from 'yjs';
import { decode } from 'next-auth/jwt';
import { db, runWithUserContext } from '@docsync/db';
import {
  getDocumentRole,
  MAX_UPDATE_BYTES,
  RATE_LIMIT,
  WsMessageSchema,
  extractDocumentText,
} from '@docsync/shared';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4444', 10);
const HOST = process.env.HOST || '0.0.0.0';
const AUTH_SECRET = process.env.AUTH_SECRET;

if (!AUTH_SECRET) {
  console.error('[ws-relay] Error: AUTH_SECRET is not configured.');
  process.exit(1);
}

// ─── Token Bucket Rate Limiter ───────────────────────────────────────────────
// Prevents a single connection from flooding the relay with rapid-fire messages.
// Each connection gets its own bucket with MAX_TOKENS capacity, refilled at
// REFILL_RATE tokens per second.

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to consume one token. Returns true if allowed, false if rate-limited.
   * Refills tokens based on elapsed time since last check.
   */
  consume(): boolean {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

interface ClientContext {
  ws: WebSocket;
  userId: string;
  role: string;
  rateLimiter: TokenBucket;
}
const rooms = new Map<string, Set<ClientContext>>();

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('DocSync WS-Relay Server is active.\n');
});

// Create WebSocket server with per-message size limit.
// The `maxPayload` option rejects messages exceeding the threshold at the
// transport layer, BEFORE the buffer is ever allocated — this is the primary
// defense against OOM attacks via oversized payloads.
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_UPDATE_BYTES + 4096, // 256KB + overhead for JSON wrapper
});

console.log(`[ws-relay] Initializing WebSocket relay server on port ${PORT}...`);
console.log(
  `[ws-relay] Security: maxPayload=${MAX_UPDATE_BYTES + 4096}B, rate=${RATE_LIMIT.MAX_TOKENS}tok/${RATE_LIMIT.REFILL_RATE}/s`,
);

server.on('upgrade', async (request, socket, head) => {
  const parsedUrl = url.parse(request.url || '', true);
  const pathname = parsedUrl.pathname || '';

  // Expecting path /doc/:documentId
  const match = pathname.match(/^\/doc\/([^/]+)$/);
  if (!match) {
    console.log(`[ws-relay] Upgrade rejected: Invalid path "${pathname}"`);
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  const documentId = match[1];
  const token = parsedUrl.query.token as string;

  if (!token) {
    console.log(`[ws-relay] Upgrade rejected: Missing auth token for document: ${documentId}`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  try {
    // Authenticate using NextAuth JWE decryption (testing both regular and secure salt options)
    let decoded: any = null;
    try {
      decoded = await decode({
        token,
        secret: AUTH_SECRET,
        salt: 'authjs.session-token',
      });
    } catch (err) {
      try {
        decoded = await decode({
          token,
          secret: AUTH_SECRET,
          salt: '__Secure-authjs.session-token',
        });
      } catch (err2) {
        // Handled below
      }
    }

    const userId = decoded?.sub || decoded?.id || decoded?.user?.id;
    if (!decoded || !userId) {
      console.log(`[ws-relay] Upgrade rejected: Invalid JWT token`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const role = await getDocumentRole(userId, documentId);
    if (!role) {
      console.log(
        `[ws-relay] Upgrade rejected: User ${userId} is not a collaborator on: ${documentId}`,
      );
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, { documentId, userId, role });
    });
  } catch (err: any) {
    console.error('[ws-relay] Upgrade error during verification:', err.message);
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    socket.destroy();
  }
});

wss.on(
  'connection',
  async (
    ws: WebSocket,
    request: any,
    context: { documentId: string; userId: string; role: string },
  ) => {
    const { documentId, userId, role } = context;

    console.log(`[ws-relay] Client connected: user=${userId}, role=${role}, doc=${documentId}`);

    if (!rooms.has(documentId)) {
      rooms.set(documentId, new Set());
    }

    const clientCtx: ClientContext = {
      ws,
      userId,
      role,
      rateLimiter: new TokenBucket(RATE_LIMIT.MAX_TOKENS, RATE_LIMIT.REFILL_RATE),
    };
    rooms.get(documentId)!.add(clientCtx);

    let rateLimitWarnings = 0;

    const sendJson = (msg: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    try {
      // Execute under user context transaction to enforce Postgres RLS
      const updateLogs = await runWithUserContext(userId, async (tx: any) => {
        return tx.documentUpdateLog.findMany({
          where: { documentId },
          orderBy: { createdAt: 'asc' },
        });
      });

      // Merge logs into a server-side document snapshot, with try/catch
      // around Y.applyUpdate to gracefully handle any corrupted entries
      const serverDoc = new Y.Doc();
      for (const log of updateLogs) {
        try {
          Y.applyUpdate(serverDoc, new Uint8Array(log.update));
        } catch (yErr: any) {
          // Log the corrupt entry but continue — don't let one bad row
          // prevent the entire document from loading.
          console.warn(`[ws-relay] Skipped corrupt update log ${log.id}: ${yErr.message}`);
        }
      }

      const docStateUpdate = Y.encodeStateAsUpdate(serverDoc);
      const lastSeenLogId = updateLogs.length > 0 ? updateLogs[updateLogs.length - 1].id : null;

      // Send the initialized state and cursor position to the client
      sendJson({
        type: 'init',
        update: Buffer.from(docStateUpdate).toString('base64'),
        lastSeenLogId,
      });

      console.log(
        `[ws-relay] Sent init state for document: ${documentId} (${updateLogs.length} updates compiled)`,
      );
      serverDoc.destroy();
    } catch (e: any) {
      console.error('[ws-relay] Failed to hydrate document for new client:', e.message);
      ws.close(4002, 'Failed to initialize document state');
      return;
    }

    ws.on('message', async (data) => {
      // 1. Rate limiting check (before parsing to prevent CPU exhaustion attacks)
      const disableRateLimit = process.env.DISABLE_RATE_LIMIT === 'true';
      if (!disableRateLimit && !clientCtx.rateLimiter.consume()) {
        rateLimitWarnings++;
        if (rateLimitWarnings % 50 === 1) {
          console.warn(
            `[ws-relay] Rate limiting user=${userId} doc=${documentId} (${rateLimitWarnings} messages throttled)`,
          );
        }
        return;
      }

      // 2. Explicit message size check
      const rawSize = typeof data === 'string' ? Buffer.byteLength(data) : (data as Buffer).length;
      if (rawSize > MAX_UPDATE_BYTES + 4096) {
        console.warn(`[ws-relay] Oversized message rejected: ${rawSize} bytes from user=${userId}`);
        return;
      }

      // 3. JSON parse
      let rawMsg: any;
      try {
        rawMsg = JSON.parse(data.toString());
      } catch (e) {
        console.warn('[ws-relay] Invalid message format received.');
        return;
      }

      // 4. Schema validation
      const parseResult = WsMessageSchema.safeParse(rawMsg);
      if (!parseResult.success) {
        console.warn(`[ws-relay] Message schema validation failed: ${parseResult.error.message}`);
        return;
      }
      const msg = parseResult.data;

      if (msg.type === 'sync') {
        const { update: updateBase64, id: existingLogId } = msg;

        // Enforce read-only constraint for VIEWER role
        if (role === 'VIEWER') {
          console.warn(
            `[ws-relay] Security alert: VIEWER user ${userId} attempted to push edit on ${documentId}. Action blocked.`,
          );
          return; // Silently drop update
        }

        try {
          let logId = existingLogId;

          // If the log was already saved (e.g. via Snapshot Restore REST API), skip database insertion
          if (!logId) {
            const updateBytes = Buffer.from(updateBase64, 'base64');

            // Validate Yjs updates using a temporary document before database write
            const validationDoc = new Y.Doc();
            try {
              Y.applyUpdate(validationDoc, updateBytes);
            } catch (yErr: any) {
              console.warn(
                `[ws-relay] Rejected malformed Yjs update from user=${userId}: ${yErr.message}`,
              );
              validationDoc.destroy();
              return;
            }
            validationDoc.destroy();

            // Persist under sender context to enforce database-level RLS
            const savedLog = await runWithUserContext(userId, async (tx: any) => {
              return tx.documentUpdateLog.create({
                data: {
                  documentId,
                  update: updateBytes,
                  createdBy: userId,
                },
              });
            });
            logId = savedLog.id;
          }

          const roomClients = rooms.get(documentId);
          if (roomClients) {
            const broadcastMsg = JSON.stringify({
              type: 'sync',
              update: updateBase64,
              createdBy: userId,
              id: logId,
            });

            roomClients.forEach((client) => {
              if (client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(broadcastMsg);
              }
            });
          }
        } catch (err: any) {
          console.error('[ws-relay] Database persist or broadcast failure:', err.message);
        }
      } else if (msg.type === 'awareness') {
        // Relay transient presence state to all other room clients
        const roomClients = rooms.get(documentId);
        if (roomClients) {
          const broadcastMsg = JSON.stringify({
            type: 'awareness',
            update: msg.update,
            userId,
          });

          roomClients.forEach((client) => {
            if (client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(broadcastMsg);
            }
          });
        }
      }
    });

    // Handle socket closure
    ws.on('close', () => {
      console.log(`[ws-relay] Client disconnected: user=${userId}, doc=${documentId}`);
      const roomClients = rooms.get(documentId);
      if (roomClients) {
        roomClients.delete(clientCtx);
        if (roomClients.size === 0) {
          rooms.delete(documentId);
          console.log(`[ws-relay] Cleaned up empty room for document: ${documentId}`);
          // Trigger background search index update for compiled state
          compileAndIndexDocument(documentId, userId);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[ws-relay] WebSocket client error for user ${userId}:`, err.message);
    });
  },
);

async function compileAndIndexDocument(documentId: string, userId: string) {
  try {
    const updateLogs = await runWithUserContext(userId, async (tx: any) => {
      return tx.documentUpdateLog.findMany({
        where: { documentId },
        orderBy: { createdAt: 'asc' },
      });
    });

    const doc = new Y.Doc();
    for (const log of updateLogs) {
      try {
        Y.applyUpdate(doc, new Uint8Array(log.update));
      } catch {
        // Skip corrupt log entries
      }
    }

    const docStateUpdate = Y.encodeStateAsUpdate(doc);
    const { headings, paragraphs, lists, tables, content } = extractDocumentText(doc);
    doc.destroy();

    await runWithUserContext(userId, async (tx: any) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          latestSnapshot: Buffer.from(docStateUpdate),
          content: content || null,
          headings: headings || null,
          paragraphs: paragraphs || null,
          tables: tables || null,
          lists: lists || null,
        },
      });
    });

    console.log(`[ws-relay] Successfully auto-indexed compiled document: ${documentId}`);
  } catch (err: any) {
    console.error(`[ws-relay] Background indexing failed for document ${documentId}:`, err.message);
  }
}

server.listen(PORT, HOST, () => {
  console.log(`[ws-relay] Server successfully listening at http://${HOST}:${PORT}`);
});
