import { useEffect, useState } from 'react';
import { createDocManager, SecuredDocInstance } from '../lib/crdt/doc-manager';

export interface UseYDocResult {
  doc: any | null;
  provider: any | null;
  content: any | null;
  synced: boolean;
}

/**
 * React hook that manages the lifecycle of a local-first Yjs document instance
 * bound to IndexedDB. Handles mounting hydration state and automates cleanup
 * on unmount to prevent database connection leaks.
 * 
 * @param documentId Unique identifier of the document to load.
 */
export function useYDoc(documentId: string): UseYDocResult {
  const [synced, setSynced] = useState(false);
  const [instance, setInstance] = useState<SecuredDocInstance | null>(null);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    setSynced(false);

    // 1. Initialize Yjs document and IndexedDB provider
    const inst = createDocManager(documentId);
    setInstance(inst);

    // 2. Set up listener to track hydration completion
    const handleSynced = () => {
      console.log(`[useYDoc] Hydration complete from IndexedDB for document: ${documentId}`);
      setSynced(true);
    };

    inst.provider.on('synced', handleSynced);

    // Check if the provider is already synced upon instantiation
    if (inst.provider.synced) {
      setSynced(true);
    }

    // 3. Teardown logic
    return () => {
      console.log(`[useYDoc] Unmounting, cleaning up listeners and provider for document: ${documentId}`);
      inst.provider.off('synced', handleSynced);
      inst.destroy();
      setInstance(null);
      setSynced(false);
    };
  }, [documentId]);

  return {
    doc: instance?.doc ?? null,
    provider: instance?.provider ?? null,
    content: instance?.content ?? null,
    synced,
  };
}
export type { SecuredDocInstance };
