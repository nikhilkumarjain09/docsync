/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { POST } from '@/app/api/documents/[id]/sync/route';
import { auth } from '@/auth';
import { db, runWithUserContext, PrismaClient } from '@docsync/db';
import { NextRequest } from 'next/server';

// Mock NextAuth 'auth'
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

describe('Sync API Route Integration Tests', () => {
  const docId = 'integration-test-doc-id';
  const ownerId = 'user-owner';
  const editorId = 'user-editor';
  const viewerId = 'user-viewer';
  const strangerId = 'user-stranger';

  let testDb: any = null;

  // Seed test data in the Postgres database
  beforeAll(async () => {
    // Clean up any stale test records from previous runs
    await db.$executeRawUnsafe(`TRUNCATE TABLE "DocumentUpdateLog" CASCADE;`);
    await db.$executeRawUnsafe(`TRUNCATE TABLE "DocumentCollaborator" CASCADE;`);
    await db.$executeRawUnsafe(`TRUNCATE TABLE "Document" CASCADE;`);
    await db.$executeRawUnsafe(`TRUNCATE TABLE "User" CASCADE;`);

    // Create users
    await db.user.createMany({
      data: [
        { id: ownerId, email: 'owner@test.com', name: 'Owner' },
        { id: editorId, email: 'editor@test.com', name: 'Editor' },
        { id: viewerId, email: 'viewer@test.com', name: 'Viewer' },
        { id: strangerId, email: 'stranger@test.com', name: 'Stranger' },
      ],
    });

    // Create document (Nikhil/Owner context)
    await db.document.create({
      data: {
        id: docId,
        title: 'Integration Test Doc',
        ownerId: ownerId,
      },
    });

    // Add collaborators
    await db.documentCollaborator.createMany({
      data: [
        { documentId: docId, userId: ownerId, role: 'OWNER' },
        { documentId: docId, userId: editorId, role: 'EDITOR' },
        { documentId: docId, userId: viewerId, role: 'VIEWER' },
      ],
    });

    // Initialize the restricted RLS test user/role (if not already created by RLS script)
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'docsync_app_test') THEN
          CREATE ROLE docsync_app_test WITH LOGIN PASSWORD 'docsync_app_test';
        ELSE
          ALTER ROLE docsync_app_test WITH LOGIN PASSWORD 'docsync_app_test';
        END IF;
      END
      $$;
    `);
    await db.$executeRawUnsafe(
      `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO docsync_app_test;`,
    );
    await db.$executeRawUnsafe(
      `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO docsync_app_test;`,
    );

    // Construct a restricted Prisma client to enforce RLS (superuser bypasses RLS)
    const superuserUrl =
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/docsync';
    const testDbUrl = superuserUrl.replace(
      /^(postgres(?:ql)?:\/\/)[^@]+@/,
      '$1docsync_app_test:docsync_app_test@',
    );
    testDb = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.$disconnect();
    }
    // Clean up test data
    await db.$executeRawUnsafe(`TRUNCATE TABLE "DocumentUpdateLog" CASCADE;`);
    await db.$executeRawUnsafe(`TRUNCATE TABLE "DocumentCollaborator" CASCADE;`);
    await db.$executeRawUnsafe(`TRUNCATE TABLE "Document" CASCADE;`);
    await db.$executeRawUnsafe(`TRUNCATE TABLE "User" CASCADE;`);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Authorization: VIEWER cannot push updates
  // ─────────────────────────────────────────────────────────────────────────────
  it('rejects update pushes from a user with VIEWER role with status 403', async () => {
    // Mock session as VIEWER user
    vi.mocked(auth).mockResolvedValue({
      user: { id: viewerId, email: 'viewer@test.com' },
      expires: '',
    });

    const payload = {
      updates: [Buffer.from('Viewer tried to edit').toString('base64')],
      lastSeenLogId: null,
    };

    const req = new NextRequest(`http://localhost:3000/api/documents/${docId}/sync`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(req, { params: Promise.resolve({ id: docId }) });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('Viewers cannot push updates');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Authorization: EDITOR can push and pull updates
  // ─────────────────────────────────────────────────────────────────────────────
  it('allows EDITOR to push updates (200) and yields the update on the next pull', async () => {
    // Mock session as EDITOR user
    vi.mocked(auth).mockResolvedValue({
      user: { id: editorId, email: 'editor@test.com' },
      expires: '',
    });

    const updatePayload = 'aGVsbG8='; // base64 for 'hello'
    const pushPayload = {
      updates: [updatePayload],
      lastSeenLogId: null,
    };

    const pushReq = new NextRequest(`http://localhost:3000/api/documents/${docId}/sync`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(pushPayload),
    });

    const pushRes = await POST(pushReq, { params: Promise.resolve({ id: docId }) });
    expect(pushRes.status).toBe(200);
    const pushBody = await pushRes.json();
    expect(pushBody.lastSeenLogId).not.toBeNull();

    // Now pull updates from the document (as Editor) using no lastSeenLogId
    const pullPayload = {
      updates: [],
      lastSeenLogId: null,
    };

    const pullReq = new NextRequest(`http://localhost:3000/api/documents/${docId}/sync`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(pullPayload),
    });

    const pullRes = await POST(pullReq, { params: Promise.resolve({ id: docId }) });
    expect(pullRes.status).toBe(200);
    const pullBody = await pullRes.json();

    // Assert: the update pushed is present in the pull logs
    expect(pullBody.updates.length).toBeGreaterThan(0);
    expect(pullBody.updates[0].update).toBe(updatePayload);
    expect(pullBody.updates[0].createdBy).toBe(editorId);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Database RLS: Tenant Isolation Verification
  // ─────────────────────────────────────────────────────────────────────────────
  it('PROVES DATABASE RLS: Querying document data under a non-collaborator user context returns zero rows', async () => {
    /*
      EXPLANATION:
      Row Level Security (RLS) policies are active on the Postgres database to enforce tenant isolation.
      When a database transaction is wrapped in a user context using a restricted connection role,
      the session variable `app.current_user_id` is set. This query proves that a user who is not a
      collaborator (strangerId) cannot view any rows, returning 0 results.
    */

    // Helper helper context execution for testDb (simulating runWithUserContext but on the RLS test client)
    const runWithTestUserContext = async (userId: string, fn: (tx: any) => Promise<any>) => {
      return await testDb.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}';`);
        return await fn(tx);
      });
    };

    // Query as EDITOR -> should return the document
    const editorDocs = await runWithTestUserContext(editorId, async (tx) => {
      return tx.document.findMany({
        where: { id: docId },
      });
    });
    expect(editorDocs.length).toBe(1);

    // Query as STRANGER (No collaborator row) -> RLS must block it completely
    const strangerDocs = await runWithTestUserContext(strangerId, async (tx) => {
      return tx.document.findMany({
        where: { id: docId },
      });
    });
    // Assert: STRANGER gets exactly zero rows!
    expect(strangerDocs.length).toBe(0);

    const strangerLogs = await runWithTestUserContext(strangerId, async (tx) => {
      return tx.documentUpdateLog.findMany({
        where: { documentId: docId },
      });
    });
    // Assert: STRANGER gets exactly zero logs!
    expect(strangerLogs.length).toBe(0);
  });
});
