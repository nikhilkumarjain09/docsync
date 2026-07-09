/**
 * @file sync-scheduler.ts
 * @description Real-time WebSocket synchronization client for local-first Yjs documents.
 * 
 * Manages instant pushes over WebSocket connection when online, local outbox buffering when
 * offline, dynamic reconnection backoff, and Yjs awareness presence sharing.
 */

import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { addToOutbox, getPendingUpdates, removeUpdates } from './outbox';

export type ConnectionStatus = 'offline' | 'connecting' | 'synced' | 'syncing';

// Base64 converters compatible with browser environments
function toBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binString = atob(str);
  return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}

// Simple color hash based on userId
function getStableHue(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export class SyncScheduler {
  private documentId: string;
  private doc: Y.Doc;
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'offline';
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private reconnectTimeoutId: any | null = null;
  private reconnectDelay = 2000;
  private lastSeenLogIdKey: string;
  private isProcessingOutbox = false;

  // Yjs Awareness instance for tracking cursor/selection presence
  public awareness: awarenessProtocol.Awareness;
  
  constructor(documentId: string, doc: Y.Doc, user?: { id: string; name?: string | null }) {
    this.documentId = documentId;
    this.doc = doc;
    this.lastSeenLogIdKey = `docsync-last-seen-id:${documentId}`;
    
    // 1. Initialize Yjs Awareness
    this.awareness = new awarenessProtocol.Awareness(doc);

    // 2. Set stable user details in local awareness state if authenticated
    if (user && user.id) {
      const hue = getStableHue(user.id);
      this.awareness.setLocalStateField('user', {
        name: user.name || 'Anonymous',
        color: `hsl(${hue}, 80%, 45%)`,
        userId: user.id,
      });
    }

    // 3. Bind document update event listener
    this.doc.on('update', this.handleLocalUpdate);

    // 4. Bind local awareness update listener to send updates over WS
    this.awareness.on('update', this.handleLocalAwarenessUpdate);
  }

  /**
   * Register a status listener.
   */
  public onStatusChange(listener: (status: ConnectionStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(nextStatus: ConnectionStatus) {
    if (this.status === nextStatus) return;
    this.status = nextStatus;
    console.log(`[SyncScheduler] Connection status: ${nextStatus}`);
    this.statusListeners.forEach(listener => listener(nextStatus));
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Local Yjs document change handler. Save to IndexedDB outbox and send instantly if online.
   */
  private handleLocalUpdate = async (update: Uint8Array, origin: any) => {
    // Skip updates that come from server sync loop
    if (origin === 'server-sync' || origin === this) {
      return;
    }

    try {
      await addToOutbox(this.documentId, update);
      
      // If WebSocket is open and authenticated, trigger outbox drain instantly
      if (this.status === 'synced' || this.status === 'syncing') {
        this.drainOutbox();
      }
    } catch (e) {
      console.error('[SyncScheduler] Failed to write local edit to outbox:', e);
    }
  };

  /**
   * Broadcast local awareness presence updates (cursors, selections) to the room.
   */
  private handleLocalAwarenessUpdate = () => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const localState = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
        this.ws.send(JSON.stringify({
          type: 'awareness',
          update: toBase64(localState),
        }));
      } catch (e) {
        console.error('[SyncScheduler] Failed to send awareness updates:', e);
      }
    }
  };

  /**
   * Fetch authenticated WebSocket JWE token and start connection.
   */
  public async start() {
    this.setStatus('connecting');
    this.connect();
  }

  /**
   * Trigger an immediate sync action (draining local outbox).
   */
  public triggerSync() {
    this.drainOutbox();
  }

  /**
   * Manually broadcast a pre-persisted update over WebSocket to all room peers.
   */
  public broadcastUpdate(base64Update: string, logId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`[SyncScheduler] Broadcasting pre-persisted sync update log: ${logId}`);
      this.ws.send(JSON.stringify({
        type: 'sync',
        update: base64Update,
        id: logId,
      }));
    }
  }

  /**
   * Clean up connections and listeners.
   */
  public stop() {
    this.setStatus('offline');
    this.disconnect();
    this.doc.off('update', this.handleLocalUpdate);
    this.awareness.off('update', this.handleLocalAwarenessUpdate);
    this.awareness.destroy();
  }

  private disconnect() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private async connect() {
    this.disconnect();

    try {
      // 1. Fetch encrypted JWT token from Next.js server
      const tokenRes = await fetch('/api/auth/ws-token');
      if (!tokenRes.ok) {
        throw new Error('Could not retrieve WebSocket session token');
      }
      const { token } = await tokenRes.json();

      // 2. Open WebSocket connection pointing to Relay port
      // Fallback url during local testing
      const wsUrl = `ws://localhost:4444/doc/${this.documentId}?token=${token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[SyncScheduler] WebSocket connection open.');
        this.reconnectDelay = 2000; // Reset backoff
      };

      this.ws.onmessage = async (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data.toString());
        } catch (e) {
          console.warn('[SyncScheduler] Invalid WS payload received.');
          return;
        }

        if (msg.type === 'init') {
          // Hydrate Y.Doc state
          const { update: initUpdateBase64, lastSeenLogId } = msg;
          if (initUpdateBase64) {
            const updateBytes = fromBase64(initUpdateBase64);
            Y.applyUpdate(this.doc, updateBytes, 'server-sync');
          }
          if (lastSeenLogId) {
            localStorage.setItem(this.lastSeenLogIdKey, lastSeenLogId);
          }
          
          this.setStatus('synced');
          console.log('[SyncScheduler] Y.Doc state initialized from server logs.');
          
          // Instantly drain any local offline edits to catch up
          this.drainOutbox();
        } else if (msg.type === 'sync') {
          const { update: updateBase64, id } = msg;
          if (updateBase64) {
            const updateBytes = fromBase64(updateBase64);
            Y.applyUpdate(this.doc, updateBytes, 'server-sync');
          }
          if (id) {
            localStorage.setItem(this.lastSeenLogIdKey, id);
          }
          this.setStatus('synced');
        } else if (msg.type === 'awareness') {
          const { update: awarenessUpdateBase64 } = msg;
          if (awarenessUpdateBase64) {
            const updateBytes = fromBase64(awarenessUpdateBase64);
            awarenessProtocol.applyAwarenessUpdate(this.awareness, updateBytes, 'server-sync');
          }
        }
      };

      this.ws.onclose = (event) => {
        console.log(`[SyncScheduler] WebSocket closed. Code: ${event.code}`);
        this.setStatus('offline');
        
        // Handle unauthorized closes cleanly (e.g. close code 4001, no role)
        if (event.code === 4001) {
          console.error('[SyncScheduler] Access Forbidden. Disabling reconnect loop.');
          return;
        }

        // Trigger retry backoff
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[SyncScheduler] WebSocket client error:', err);
        this.setStatus('offline');
      };

    } catch (err: any) {
      console.error('[SyncScheduler] Connection setup failed:', err.message);
      this.setStatus('offline');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeoutId) return;

    console.log(`[SyncScheduler] Retrying connection in ${this.reconnectDelay}ms...`);
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Drain and push all local pending updates in the IndexedDB outbox.
   */
  private async drainOutbox() {
    if (this.isProcessingOutbox || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.isProcessingOutbox = true;
    this.setStatus('syncing');

    try {
      while (true) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          break;
        }
        const pending = await getPendingUpdates(this.documentId);
        if (pending.length === 0) {
          break;
        }

        console.log(`[SyncScheduler] Draining outbox: pushing ${pending.length} pending updates.`);
        
        for (const item of pending) {
          const base64Update = toBase64(item.update);
          
          // Send update over socket
          this.ws.send(JSON.stringify({
            type: 'sync',
            update: base64Update,
          }));

          // Clear outbox item
          await removeUpdates([item.id]);
        }
      }
      console.log('[SyncScheduler] Outbox successfully drained.');
      this.setStatus('synced');
    } catch (e: any) {
      console.error('[SyncScheduler] Failed to drain outbox:', e.message);
      this.setStatus('offline');
    } finally {
      this.isProcessingOutbox = false;
    }
  }
}
export type { ConnectionStatus as SyncConnectionStatus };
