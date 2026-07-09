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
 * To solve this, DocManager enforces active lifecycle management. We only keep a Y.Doc
 * and its IndexedDB provider alive *while the document is actively open/mounted in the editor*.
 * The moment the user navigates away or closes the tab, the custom unmount cleanup is
 * triggered, calling `.destroy()` on both the Y.Doc and the IndexeddbPersistence provider,
 * freeing up browser-level resources and memory immediately.
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export interface SecuredDocInstance {
  doc: Y.Doc;
  provider: IndexeddbPersistence;
  content: Y.XmlFragment;
  destroy: () => void;
}

/**
 * Creates and initializes a local-first Yjs document instance bound to IndexedDB.
 * 
 * @param documentId Unique identifier of the document to manage.
 * @returns SecuredDocInstance structure including the Y.Doc, its persistence provider,
 *          the root XmlFragment, and a cleanup function to prevent memory leaks.
 */
export function createDocManager(documentId: string): SecuredDocInstance {
  console.log(`[DocManager] Initializing Y.Doc and IndexedDB provider for document: ${documentId}`);

  // 1. Create the Yjs Doc
  const doc = new Y.Doc();

  // 2. Bind to local IndexedDB for offline-first resilience
  const provider = new IndexeddbPersistence(documentId, doc);

  // 3. Expose Y.XmlFragment named "default" for ProseMirror/Tiptap rich text integration
  const content = doc.getXmlFragment('default');

  // Define clean teardown to prevent memory/connection leaks
  let destroyed = false;
  const destroy = () => {
    if (destroyed) {
      return;
    }
    destroyed = true;

    console.log(`[DocManager] Cleaning up and destroying Y.Doc and IndexedDB connection for: ${documentId}`);
    
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
  };

  return {
    doc,
    provider,
    content,
    destroy,
  };
}
