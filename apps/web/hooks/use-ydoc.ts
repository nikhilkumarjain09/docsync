import { useEffect, useState } from 'react';
import { createDocManager, SecuredDocInstance } from '../lib/crdt/doc-manager';
import { SyncScheduler, SyncConnectionStatus } from '../lib/sync/sync-scheduler';
import { useSession } from 'next-auth/react';

export interface UseYDocResult {
  doc: any | null;
  provider: any | null;
  content: any | null;
  synced: boolean;
  connectionStatus: SyncConnectionStatus;
  awareness: any | null;
}

/**
 * React hook that manages the lifecycle of a local-first Yjs document instance
 * bound to IndexedDB. Configures database hydration tracking, manages live
 * WebSocket synchronization, and automates cleanup on unmount.
 * 
 * @param documentId Unique identifier of the document to load.
 */
export function useYDoc(documentId: string): UseYDocResult {
  const { data: session, status: sessionStatus } = useSession();
  const [synced, setSynced] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SyncConnectionStatus>('offline');
  const [instance, setInstance] = useState<SecuredDocInstance | null>(null);
  const [awareness, setAwareness] = useState<any | null>(null);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    // Wait until NextAuth session state resolves (authenticated or unauthenticated)
    if (sessionStatus === 'loading') {
      return;
    }

    setSynced(false);

    // 1. Initialize local Yjs document and IndexedDB provider
    const inst = createDocManager(documentId);
    setInstance(inst);

    // Extract authenticated user credentials
    const user = session?.user ? { id: session.user.id, name: session.user.name } : undefined;

    // 2. Initialize and start the background sync scheduler
    const scheduler = new SyncScheduler(documentId, inst.doc, user);
    setAwareness(scheduler.awareness);
    scheduler.start();

    // Subscribe to WebSocket status changes
    const unsubscribeStatus = scheduler.onStatusChange((nextStatus) => {
      setConnectionStatus(nextStatus);
    });

    // 3. Set up listener to track local hydration completion
    const handleSynced = () => {
      console.log(`[useYDoc] Hydration complete from IndexedDB for document: ${documentId}`);
      setSynced(true);
      scheduler.triggerSync();
    };

    inst.provider.on('synced', handleSynced);

    if (inst.provider.synced) {
      setSynced(true);
      scheduler.triggerSync();
    }

    // 4. Teardown logic
    return () => {
      console.log(`[useYDoc] Unmounting, cleaning up listeners and provider for document: ${documentId}`);
      unsubscribeStatus();
      scheduler.stop();
      inst.provider.off('synced', handleSynced);
      inst.destroy();
      setInstance(null);
      setSynced(false);
      setConnectionStatus('offline');
      setAwareness(null);
    };
  }, [documentId, sessionStatus, session]);

  return {
    doc: instance?.doc ?? null,
    provider: instance?.provider ?? null,
    content: instance?.content ?? null,
    synced,
    connectionStatus,
    awareness,
  };
}
export type { SecuredDocInstance, SyncConnectionStatus };
