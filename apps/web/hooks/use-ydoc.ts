import { useEffect, useState, useRef } from 'react';
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
  broadcastUpdate: (update: string, id: string) => void;
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
  
  // Keep stable reference to the sync scheduler for manual actions
  const schedulerRef = useRef<SyncScheduler | null>(null);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    // Wait until NextAuth session state resolves
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
    schedulerRef.current = scheduler;
    setAwareness(scheduler.awareness);
    scheduler.start();

    // Subscribe to WebSocket status changes
    const unsubscribeStatus = scheduler.onStatusChange((nextStatus) => {
      setConnectionStatus(nextStatus);
    });

    // 3. Set up listener to track local hydration completion
    inst.provider.whenSynced.then(() => {
      console.log(`[useYDoc] Hydration complete from IndexedDB for document: ${documentId}`);
      setSynced(true);
      scheduler.triggerSync();
    });

    // 4. Teardown logic
    return () => {
      console.log(`[useYDoc] Unmounting, cleaning up listeners and provider for document: ${documentId}`);
      schedulerRef.current = null;
      unsubscribeStatus();
      scheduler.stop();
      inst.destroy();
      setInstance(null);
      setSynced(false);
      setConnectionStatus('offline');
      setAwareness(null);
    };
  }, [documentId, sessionStatus, session?.user?.id]);

  // Wrapper function to trigger WebSocket broadcasts
  const broadcastUpdate = (update: string, id: string) => {
    if (schedulerRef.current) {
      schedulerRef.current.broadcastUpdate(update, id);
    }
  };

  return {
    doc: instance?.doc ?? null,
    provider: instance?.provider ?? null,
    content: instance?.content ?? null,
    synced,
    connectionStatus,
    awareness,
    broadcastUpdate,
  };
}
export type { SecuredDocInstance, SyncConnectionStatus };
