/**
 * @file doc-manager.ts
 * @description Local-first document manager using Yjs and IndexedDB persistence.
 * 
 * ─── Memory Management Strategy ──────────────────────────────────────────────
 * In a long-lived Single Page Application (SPA) session, a user might open and edit
 * dozens or hundreds of different documents. If we instantiated and kept Y.Doc and
 * IndexedDB provider connections open indefinitely for every document ever visited:
 * 
 * 1. Memory Leak: Yjs document buffers and structure histories accumulate in RAM.
 * 2. Connection Exhaustion: Each IndexedDB provider opens a persistent transaction/connection
 *    pool to the browser's IndexedDB engine, leading to browser warnings and crashes.
 * 
 * To solve this, DocManager enforces active lifecycle management with a reference-counting
 * global cache. This also prevents IndexedDB race conditions in React 19 Strict Mode where
 * hooks double-mount/unmount synchronously, causing DB connection locks.
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export interface SecuredDocInstance {
  doc: Y.Doc;
  provider: IndexeddbPersistence;
  content: Y.XmlFragment;
  destroy: () => void;
}

// Global cache of active document managers to prevent double-mount race locks
const activeManagers = new Map<string, { instance: SecuredDocInstance; refCount: number }>();

/**
 * Creates and initializes a local-first Yjs document instance bound to IndexedDB.
 * Uses reference counting to safely handle React Strict Mode mount/unmount loops.
 * 
 * @param documentId Unique identifier of the document to manage.
 * @returns SecuredDocInstance structure including the Y.Doc, its persistence provider,
 *          the root XmlFragment, and a cleanup function to prevent memory leaks.
 */
export function createDocManager(documentId: string): SecuredDocInstance {
  const cached = activeManagers.get(documentId);
  if (cached) {
    cached.refCount++;
    console.log(`[DocManager] Reusing cached instance for document: ${documentId} (Ref count: ${cached.refCount})`);
    return cached.instance;
  }

  console.log(`[DocManager] Initializing new Y.Doc and IndexedDB provider for document: ${documentId}`);

  // 1. Create the Yjs Doc
  const doc = new Y.Doc();

  // 2. Bind to local IndexedDB for offline-first resilience
  const provider = new IndexeddbPersistence(documentId, doc);

  // 3. Expose Y.XmlFragment named "default" for ProseMirror/Tiptap rich text integration
  const content = doc.getXmlFragment('default');

  const instance: SecuredDocInstance = {
    doc,
    provider,
    content,
    destroy: () => {
      const current = activeManagers.get(documentId);
      if (!current) {
        return;
      }

      current.refCount--;
      if (current.refCount <= 0) {
        console.log(`[DocManager] Final reference released. Destroying Y.Doc and IndexedDB connection for: ${documentId}`);
        
        // Destroy provider first to close IndexedDB database connections
        try {
          provider.destroy();
        } catch (e) {
          console.error('[DocManager] Error destroying IndexedDB provider:', e);
        }

        // Destroy Y.Doc to free memory
        try {
          doc.destroy();
        } catch (e) {
          console.error('[DocManager] Error destroying Y.Doc:', e);
        }

        activeManagers.delete(documentId);
      } else {
        console.log(`[DocManager] Reference released for document: ${documentId} (Remaining refs: ${current.refCount})`);
      }
    },
  };

  activeManagers.set(documentId, { instance, refCount: 1 });
  return instance;
}
