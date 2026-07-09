import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as url from 'url';
import * as dotenv from 'dotenv';
import * as Y from 'yjs';
import { decode } from 'next-auth/jwt';
import { db, runWithUserContext } from '@docsync/db';
import { getDocumentRole } from '@docsync/shared';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '4444', 10);
const HOST = process.env.HOST || '0.0.0.0';
const AUTH_SECRET = process.env.AUTH_SECRET;

if (!AUTH_SECRET) {
  console.error('[ws-relay] Error: AUTH_SECRET is not configured.');
  process.exit(1);
}

// Map to track active client rooms
// Room ID (documentId) -> Set of active client connection contexts
interface ClientContext {
  ws: WebSocket;
  userId: string;
  role: string;
}
const rooms = new Map<string, Set<ClientContext>>();

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('DocSync WS-Relay Server is active.\n');
});

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

console.log(`[ws-relay] Initializing WebSocket relay server on port ${PORT}...`);

// Handle standard HTTP Upgrade to WebSocket handshake
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

    // Verify collaborator role on database
    const role = await getDocumentRole(userId, documentId);
    if (!role) {
      console.log(`[ws-relay] Upgrade rejected: User ${userId} is not a collaborator on: ${documentId}`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Proceed to upgrade connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, { documentId, userId, role });
    });
  } catch (err: any) {
    console.error('[ws-relay] Upgrade error during verification:', err.message);
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    socket.destroy();
  }
});

// Handle successful WebSocket connection
wss.on('connection', async (ws: WebSocket, request: any, context: { documentId: string; userId: string; role: string }) => {
  const { documentId, userId, role } = context;

  console.log(`[ws-relay] Client connected: user=${userId}, role=${role}, doc=${documentId}`);

  // Create room context if not existing
  if (!rooms.has(documentId)) {
    rooms.set(documentId, new Set());
  }

  const clientCtx: ClientContext = { ws, userId, role };
  rooms.get(documentId)!.add(clientCtx);

  // Initialize helper to send JSON messages
  const sendJson = (msg: any) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  try {
    // 1. Hydrate the document state from the Postgres log
    // We run this under user context transaction to enforce Postgres RLS
    const updateLogs = await runWithUserContext(userId, async (tx) => {
      return tx.documentUpdateLog.findMany({
        where: { documentId },
        orderBy: { createdAt: 'asc' },
      });
    });

    // Merge logs into a server-side document snapshot
    const serverDoc = new Y.Doc();
    updateLogs.forEach((log) => {
      Y.applyUpdate(serverDoc, new Uint8Array(log.update));
    });

    const docStateUpdate = Y.encodeStateAsUpdate(serverDoc);
    const lastSeenLogId = updateLogs.length > 0 ? updateLogs[updateLogs.length - 1].id : null;

    // Send the initialized state and cursor position to the client
    sendJson({
      type: 'init',
      update: Buffer.from(docStateUpdate).toString('base64'),
      lastSeenLogId,
    });

    console.log(`[ws-relay] Sent init state for document: ${documentId} (${updateLogs.length} updates compiled)`);
    serverDoc.destroy();
  } catch (e: any) {
    console.error('[ws-relay] Failed to hydrate document for new client:', e.message);
    ws.close(4002, 'Failed to initialize document state');
    return;
  }

  // Handle incoming WebSocket messages
  ws.on('message', async (data) => {
    let msg: any;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      console.warn('[ws-relay] Invalid message format received.');
      return;
    }

    if (msg.type === 'sync') {
      const { update: updateBase64 } = msg;
      
      // Enforce read-only constraint for VIEWER role
      if (role === 'VIEWER') {
        console.warn(`[ws-relay] Security alert: VIEWER user ${userId} attempted to push edit on ${documentId}. Action blocked.`);
        return; // Silently drop update
      }

      try {
        const updateBytes = Buffer.from(updateBase64, 'base64');

        // Persist update in database under sender context to respect RLS
        const savedLog = await runWithUserContext(userId, async (tx) => {
          return tx.documentUpdateLog.create({
            data: {
              documentId,
              update: updateBytes,
              createdBy: userId,
            },
          });
        });

        // Broadcast update to all other connected clients in the same room
        const roomClients = rooms.get(documentId);
        if (roomClients) {
          const broadcastMsg = JSON.stringify({
            type: 'sync',
            update: updateBase64,
            createdBy: userId,
            id: savedLog.id,
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
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[ws-relay] WebSocket client error for user ${userId}:`, err.message);
  });
});

// Boot server
server.listen(PORT, HOST, () => {
  console.log(`[ws-relay] Server successfully listening at http://${HOST}:${PORT}`);
});
