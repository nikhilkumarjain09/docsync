/**
 * @file sync-scheduler.ts
 * @description Background synchronization scheduler for local-first Yjs document reconciliation.
 * 
 * Manages pushing queued updates from the outbox and pulling new updates from the server.
 */

import * as Y from 'yjs';
import { addToOutbox, getPendingUpdates, removeUpdates } from './outbox';

const SYNC_INTERVAL_MS = 5000;
const RETRY_BACKOFF_FACTOR = 2;
const MAX_BACKOFF_MS = 30000;

// Base64 helper methods safe for large arrays in browser environments
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

export class SyncScheduler {
  private documentId: string;
  private doc: Y.Doc;
  private intervalId: any | null = null;
  private isSyncing = false;
  private backoffMs = SYNC_INTERVAL_MS;
  private lastSeenLogIdKey: string;
  
  constructor(documentId: string, doc: Y.Doc) {
    this.documentId = documentId;
    this.doc = doc;
    this.lastSeenLogIdKey = `docsync-last-seen-id:${documentId}`;
    
    // Bind document local update event listener
    this.doc.on('update', this.handleLocalUpdate);
  }

  /**
   * Capture Yjs document updates. If the update is local (not applied from sync),
   * push it into the persistent IndexedDB outbox.
   */
  private handleLocalUpdate = async (update: Uint8Array, origin: any) => {
    // Only queue updates created locally by user actions (origin is null or undefined).
    // We explicitly bypass updates applied from the sync pull loop (origin === 'server-sync').
    if (origin === 'server-sync') {
      return;
    }

    try {
      await addToOutbox(this.documentId, update);
      console.log(`[SyncScheduler] Queued local update to outbox for: ${this.documentId}`);
      // Trigger a sync immediately to reduce latency (debounced/deferred sync)
      this.triggerSync();
    } catch (e) {
      console.error('[SyncScheduler] Failed to queue local update:', e);
    }
  };

  /**
   * Start the background sync loop.
   */
  public start() {
    if (this.intervalId) return;

    console.log(`[SyncScheduler] Starting synchronization loop for: ${this.documentId}`);
    
    const runLoop = async () => {
      await this.sync();
      // Re-schedule with dynamic backoff
      this.intervalId = setTimeout(runLoop, this.backoffMs);
    };

    this.intervalId = setTimeout(runLoop, this.backoffMs);
  }

  /**
   * Stop the synchronization loop and clean up Yjs listener.
   */
  public stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.doc.off('update', this.handleLocalUpdate);
    console.log(`[SyncScheduler] Stopped synchronization loop for: ${this.documentId}`);
  }

  /**
   * Trigger an immediate sync action.
   */
  public triggerSync() {
    if (this.isSyncing) return;
    this.sync();
  }

  /**
   * Core Push/Pull sync loop.
   */
  private async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const pending = await getPendingUpdates(this.documentId);
    const lastSeenLogId = localStorage.getItem(this.lastSeenLogIdKey);

    const payload = {
      updates: pending.map(p => toBase64(p.update)),
      lastSeenLogId,
    };

    try {
      console.log(`[SyncScheduler] Syncing document ${this.documentId}... Pushing: ${pending.length} updates. Pulling from cursor: ${lastSeenLogId}`);

      const response = await fetch(`/api/documents/${this.documentId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Sync server responded with ${response.status}`);
      }

      const data = await response.json();
      const { updates: pulledUpdates, lastSeenLogId: nextLogId } = data;

      // 1. Process pulled updates and apply them to local Y.Doc
      if (pulledUpdates && pulledUpdates.length > 0) {
        console.log(`[SyncScheduler] Received ${pulledUpdates.length} updates from server.`);
        
        // Wrap edits in transaction with origin 'server-sync' to prevent looping
        this.doc.transact(() => {
          pulledUpdates.forEach((item: { update: string }) => {
            const updateBytes = fromBase64(item.update);
            Y.applyUpdate(this.doc, updateBytes, 'server-sync');
          });
        }, 'server-sync');
      }

      // 2. Update local cursor
      if (nextLogId) {
        localStorage.setItem(this.lastSeenLogIdKey, nextLogId);
      }

      // 3. Clear successfully sent updates from outbox
      if (pending.length > 0) {
        const pendingIds = pending.map(p => p.id);
        await removeUpdates(pendingIds);
        console.log(`[SyncScheduler] Successfully synchronized and cleared ${pending.length} updates.`);
      }

      // Reset backoff on success
      this.backoffMs = SYNC_INTERVAL_MS;
    } catch (e: any) {
      console.error('[SyncScheduler] Synchronization failed:', e.message);
      // Implement exponential backoff on connection/server failures
      this.backoffMs = Math.min(this.backoffMs * RETRY_BACKOFF_FACTOR, MAX_BACKOFF_MS);
    } finally {
      this.isSyncing = false;
    }
  }
}
