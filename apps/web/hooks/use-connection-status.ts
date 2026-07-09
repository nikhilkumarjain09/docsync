import { useYDoc, SyncConnectionStatus } from './use-ydoc';

/**
 * A lightweight custom hook that reads the active real-time connection status
 * of a given document.
 * 
 * @param documentId Unique identifier of the document to inspect.
 * @returns SyncConnectionStatus indicating the state: 'offline' | 'connecting' | 'synced' | 'syncing'
 */
export function useConnectionStatus(documentId: string): SyncConnectionStatus {
  const { connectionStatus } = useYDoc(documentId);
  return connectionStatus;
}
