import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { SyncPayloadSchema, MAX_UPDATE_BASE64_LENGTH, MAX_UPDATES_PER_SYNC } from '@docsync/shared';
import { getDocumentRole } from '../../../../packages/shared/src/authorize';
import { db } from '@docsync/db';

// Mock the Prisma DB client before importing getDocumentRole which depends on it
vi.mock('@docsync/db', () => {
  const localMockDb = {
    documentCollaborator: {
      findUnique: vi.fn(),
    },
  };
  return {
    db: localMockDb,
    runWithUserContext: vi.fn(async (userId: string, fn: (tx: unknown) => Promise<unknown>) => {
      return fn(localMockDb);
    }),
  };
});

describe('DocSync Core Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CRDT Merge Determinism Test
  // ─────────────────────────────────────────────────────────────────────────────
  it('PROVES CRDT MERGE DETERMINISM: Applying collaborative Yjs updates in different orders yields byte-identical document states', () => {
    /*
      EXPLANATION:
      One of the fundamental claims of Conflict-free Replicated Data Types (CRDTs) is Strong Eventual Consistency (SEC).
      This test proves that if two independent clients make edits, and those updates are relayed and merged
      in different permutations (Client 1 receives A then B; Client 2 receives B then A), the final replicated 
      document states will converge to be completely byte-identical (serialized as binary Yjs state updates).
    */

    // Initialize two fresh, independent collaborative documents
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Setup an initial state on a reference document to capture updates
    const referenceDoc = new Y.Doc();
    const refText = referenceDoc.getText('content');

    const capturedUpdates: Uint8Array[] = [];
    const handleUpdate = (update: Uint8Array) => {
      capturedUpdates.push(update);
    };
    referenceDoc.on('update', handleUpdate);

    // Edit 1: Insert "Hello" at position 0
    refText.insert(0, 'Hello');

    // Edit 2: Insert " World" at position 5
    refText.insert(5, ' World');

    // Edit 3: Insert "!" at position 11
    refText.insert(11, '!');

    referenceDoc.off('update', handleUpdate);

    expect(capturedUpdates.length).toBe(3);
    const [update1, update2, update3] = capturedUpdates;

    // Client A applies updates in order: Edit 1 -> Edit 2 -> Edit 3
    Y.applyUpdate(docA, update1);
    Y.applyUpdate(docA, update2);
    Y.applyUpdate(docA, update3);

    // Client B applies updates in a completely different out-of-order sequence: Edit 3 -> Edit 2 -> Edit 1
    // (Note: Yjs handles dependency resolution automatically by caching pending updates until dependencies arrive)
    Y.applyUpdate(docB, update3!);
    Y.applyUpdate(docB, update2!);
    Y.applyUpdate(docB, update1!);

    // Assert 1: The document text contents are identical
    const textA = docA.getText('content').toString();
    const textB = docB.getText('content').toString();
    expect(textA).toBe('Hello World!');
    expect(textB).toBe('Hello World!');

    // Assert 2: The entire state vectors are completely byte-identical
    const stateVectorA = Y.encodeStateAsUpdate(docA);
    const stateVectorB = Y.encodeStateAsUpdate(docB);

    expect(Buffer.from(stateVectorA).equals(Buffer.from(stateVectorB))).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Idempotency Test
  // ─────────────────────────────────────────────────────────────────────────────
  it('PROVES IDEMPOTENCY: Re-applying the same update multiple times is a no-op', () => {
    const doc = new Y.Doc();
    const text = doc.getText('content');

    // Setup an initial update
    const sourceDoc = new Y.Doc();
    let initialUpdate: Uint8Array | null = null;
    sourceDoc.on('update', (update) => {
      initialUpdate = update;
    });
    sourceDoc.getText('content').insert(0, 'Important Data');

    // Apply the update for the first time
    Y.applyUpdate(doc, initialUpdate!);
    const firstState = Y.encodeStateAsUpdate(doc);
    expect(text.toString()).toBe('Important Data');

    // Apply the same update a second time (re-transmission / duplicate packet simulation)
    Y.applyUpdate(doc, initialUpdate!);
    const secondState = Y.encodeStateAsUpdate(doc);

    // Assert: The text and document state bytes are unchanged (Idempotent execution)
    expect(text.toString()).toBe('Important Data');
    expect(Buffer.from(firstState).equals(Buffer.from(secondState))).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Restore-as-Forward-Update Test
  // ─────────────────────────────────────────────────────────────────────────────
  it('PROVES RESTORE-AS-FORWARD-UPDATE: Restoring an old snapshot while concurrent edits exist does not discard concurrent changes', () => {
    // 1. Initial State: Create a document and insert "Version 1"
    const doc = new Y.Doc();
    const text = doc.getText('default');
    text.insert(0, 'Version 1');

    // Capture snapshot state representing "Version 1"
    const snapshotBytes = Y.encodeStateAsUpdate(doc);

    // 2. Subsequent edits: Document evolves to "Version 1 - Revised"
    text.insert(9, ' - Revised');
    expect(text.toString()).toBe('Version 1 - Revised');

    // 3. Simulate a concurrent edit from a collaborator working offline
    // The collaborator branched off "Version 1 - Revised" and inserted "[Concurrent]" at the end
    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, Y.encodeStateAsUpdate(doc));

    // Peer performs concurrent insert
    let peerUpdate: Uint8Array | null = null;
    peerDoc.on('update', (update) => {
      peerUpdate = update;
    });
    peerDoc.getText('default').insert(19, ' [Concurrent]');
    expect(peerDoc.getText('default').toString()).toBe('Version 1 - Revised [Concurrent]');

    // 4. Restore "Version 1" snapshot using a forward-update transaction (like Phase 07)
    // To restore safely without breaking history, we delete the current contents and insert the snapshot text
    const targetDoc = new Y.Doc();
    Y.applyUpdate(targetDoc, snapshotBytes);
    const targetText = targetDoc.getText('default').toString(); // "Version 1"
    targetDoc.destroy();

    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, targetText);
    });

    expect(text.toString()).toBe('Version 1');

    // 5. Apply the peer's concurrent edit to the restored document
    Y.applyUpdate(doc, peerUpdate!);

    // Assert: The restore replaced the content to "Version 1", but because it was done
    // as a forward edit, the peer's concurrent insert is preserved and merged correctly!
    const finalMergedText = text.toString();
    expect(finalMergedText).toContain('Version 1');
    expect(finalMergedText).toContain('[Concurrent]');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Zod Schema Validation Test (Phase 08 Security)
  // ─────────────────────────────────────────────────────────────────────────────
  it('PROVES SCHEMA VALIDATION: Zod schema rejects malformed payloads and size violations', () => {
    // Correct Payload structure
    const validPayload = {
      updates: ['AQID', 'BAUG'],
      lastSeenLogId: 'log-123',
    };
    expect(SyncPayloadSchema.safeParse(validPayload).success).toBe(true);

    // Malformed: updates field is not an array of strings
    const malformedPayload = {
      updates: 'not-an-array',
    };
    expect(SyncPayloadSchema.safeParse(malformedPayload).success).toBe(false);

    // Malformed: exceeds maximum allowed updates per request
    const tooManyUpdates = {
      updates: Array(MAX_UPDATES_PER_SYNC + 1).fill('AQID'),
    };
    const tooManyResult = SyncPayloadSchema.safeParse(tooManyUpdates);
    expect(tooManyResult.success).toBe(false);

    // Malformed: single update string exceeds maximum characters length
    const hugeUpdate = {
      updates: ['a'.repeat(MAX_UPDATE_BASE64_LENGTH + 1)],
    };
    const hugeResult = SyncPayloadSchema.safeParse(hugeUpdate);
    expect(hugeResult.success).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Role Authorization Helper Test
  // ─────────────────────────────────────────────────────────────────────────────
  it('PROVES AUTHORIZATION HELPER: getDocumentRole resolves roles correctly for all cases', async () => {
    const mockFindUnique = vi.mocked(db.documentCollaborator.findUnique);

    // Case 1: Owner role
    mockFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    const role1 = await getDocumentRole('user-1', 'doc-1');
    expect(role1).toBe('OWNER');

    // Case 2: Editor role
    mockFindUnique.mockResolvedValueOnce({ role: 'EDITOR' });
    const role2 = await getDocumentRole('user-2', 'doc-1');
    expect(role2).toBe('EDITOR');

    // Case 3: Viewer role
    mockFindUnique.mockResolvedValueOnce({ role: 'VIEWER' });
    const role3 = await getDocumentRole('user-3', 'doc-1');
    expect(role3).toBe('VIEWER');

    // Case 4: No collaborator row (No access)
    mockFindUnique.mockResolvedValueOnce(null);
    const role4 = await getDocumentRole('user-4', 'doc-1');
    expect(role4).toBeNull();
  });
});
