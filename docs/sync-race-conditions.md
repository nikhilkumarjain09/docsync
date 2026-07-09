# DocSync Synchronization & Reconciliation — Race Conditions Analysis

This document describes the specific race condition scenarios avoided by the offline-first outbox synchronization design implemented in Phase 04.

---

## 1. Concurrent Offline Edits & Divergent State Merge
### Scenario
Two clients (Client A and Client B) open the same document, disconnect from the network, edit the document locally for hours creating divergent editing histories, and then reconnect simultaneously.

### Resolution (Avoided Race Condition)
- **No LWW (Last-Write-Wins) Pitfalls**: Standard synchronization designs that overwrite the document buffer based on timestamp (last-write-wins) would wipe out either Client A's or Client B's changes entirely.
- **Idempotency with CRDTs (Yjs)**: Because the synchronization layer logs raw Yjs update bytes, when both clients reconnect, their background schedulers push their local updates as independent binary packets. When the server reflects these updates to both clients, they call `Y.applyUpdate(doc, updateBytes)`.
- **Mathematical Commutativity**: Yjs ensures that updates are commutative, associative, and idempotent. Regardless of the order of delivery or whether Client A's updates reach Client B before or after Client B's own local history, both clients merge the states to the *exact same character-by-character representation* automatically with no merge conflicts or manual UI dialogs.

---

## 2. Client Disconnects Mid-Push (Partial Outbox Drain)
### Scenario
A client initiates a synchronization operation pushing 5 queued updates from the outbox. The server successfully inserts 3 updates into the database log, but the network drops before the server can return the HTTP response. The client assumes the sync failed.

### Resolution (Avoided Race Condition)
- **Persistent Outbox Integrity**: The client does not remove items from its outbox queue until it receives a successful HTTP response (`response.ok`). Since the call failed, the 5 updates remain in the IndexedDB outbox.
- **Deduplication on Retry**: When the network is restored, the client's scheduler wakes up and retries by posting the same 5 updates.
- **Server and Client-Side Idempotency**:
  - On the server, standard unique constraints or transaction logs can handle duplicates. But even if the server appends the updates again, Yjs's `Y.applyUpdate` treats duplicate updates as a complete no-op on the client side. No duplicated characters or content duplication will occur.
  - Thus, partial outbox pushes resolve cleanly without duplicates or data loss.

---

## 3. Simultaneous Push/Pull Operations (The Interleaved Loop)
### Scenario
The synchronization loop executes a background POST request. While the HTTP request is in-flight, the user types additional characters, creating a new local update.

### Resolution (Avoided Race Condition)
- **Transaction Origin Tracking**: The `SyncScheduler` listens to the local `Y.Doc` update event. If the event's origin is `'server-sync'` (meaning the update was pulled from the server), the scheduler ignores it. If the origin is `null`/`undefined` (local typing), it appends it to the outbox.
- **Non-blocking Appends**: While a sync HTTP request is in-flight, any new typing events append new entries to the IndexedDB outbox without interrupting the current sync. They are simply picked up and pushed on the next tick of the scheduler (or when typing pauses).
- **Outbox State Separation**: The scheduler reads the current list of pending updates *before* starting the POST request. On success, it deletes only those specific entry IDs from the outbox, leaving any new updates generated during the in-flight request safely untouched.

---

## 4. Session Role Changes Mid-Sync
### Scenario
An editor's access is demoted to `VIEWER` by the owner. While the editor is typing offline, the demotion occurs. The client reconnects and tries to push.

### Resolution (Avoided Race Condition)
- **Server-Side Authorization Enforced**: The client-side scheduler can run locally, but the `/api/documents/[id]/sync` API route queries the database (`getDocumentRole`) using the active session user context for *every single sync request*.
- **Graceful Rejection**: The server rejects the push with `403 Forbidden` if the role has become `VIEWER`, preventing unauthorized edits from entering the database `DocumentUpdateLog`, while still returning new updates to sync the viewer's local state.
