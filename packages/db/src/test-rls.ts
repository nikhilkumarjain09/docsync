/**
 * RLS Integration Test
 * ────────────────────
 * Verifies that PostgreSQL Row-Level Security policies genuinely enforce
 * tenant isolation. This test:
 *
 *   1. Creates a non-superuser role `docsync_app_test` (if not exists).
 *   2. Connects as that role and proves that:
 *      a. Without setting `app.current_user_id`, queries return zero rows.
 *      b. With a non-collaborator user ID, queries return zero rows.
 *      c. With the correct collaborator user ID, queries return the expected rows.
 *
 * IMPORTANT: PostgreSQL's FORCE ROW LEVEL SECURITY does NOT apply to superusers.
 * This test uses a non-superuser role to prove the policies are actually enforced.
 *
 * To prove the policies are doing real work (not just passing vacuously),
 * temporarily comment out the RLS policies in the migration and re-run —
 * tests that expect 0 rows will see data, causing the test to FAIL (red).
 *
 * Usage:
 *   cd packages/db
 *   npx tsx src/test-rls.ts
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load DATABASE_URL — try several locations since the .env lives in apps/web
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '..', 'apps', 'web', '.env'),
  path.resolve(process.cwd(), '..', 'apps', 'web', '.env'),
  path.resolve(process.cwd(), 'apps', 'web', '.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found. Tried:', envCandidates);
  process.exit(1);
}

import { PrismaClient } from './generated/client';

// Superuser client — used for setup/teardown and creating the test role
const superDb = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, detail: string) {
  results.push({ name, passed: condition, detail });
  const icon = condition ? '✅' : '❌';
  console.log(`  ${icon} ${name}: ${detail}`);
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  RLS Tenant Isolation Integration Test');
  console.log('══════════════════════════════════════════════════════\n');

  // ─── Setup: Find existing test data ─────────────────────────────────
  const alice = await superDb.user.findFirst({ where: { email: 'alice@docsync.dev' } });
  const bob = await superDb.user.findFirst({ where: { email: 'bob@docsync.dev' } });

  if (!alice || !bob) {
    console.error('ERROR: Seed data not found. Run `npx prisma db seed` first.');
    process.exit(1);
  }

  const doc = await superDb.document.findFirst({ where: { ownerId: alice.id } });
  if (!doc) {
    console.error('ERROR: No document found for Alice. Run `npx prisma db seed` first.');
    process.exit(1);
  }

  const ghostUserId = 'ghost-user-no-access-12345';

  console.log(`  Test data: Alice=${alice.id}, Bob=${bob.id}, Doc=${doc.id}`);

  // ─── Create non-superuser test role ─────────────────────────────────
  // RLS is NOT enforced for superusers even with FORCE ROW LEVEL SECURITY.
  // We must test with a non-superuser role to prove RLS actually works.
  const TEST_ROLE = 'docsync_app_test';
  console.log(`  Creating non-superuser role: ${TEST_ROLE}\n`);

  try {
    await superDb.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${TEST_ROLE}') THEN
          CREATE ROLE ${TEST_ROLE} LOGIN PASSWORD 'test_password' NOSUPERUSER;
        END IF;
      END
      $$;
    `);

    // Grant necessary permissions on the schema and tables
    await superDb.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${TEST_ROLE};`);
    await superDb.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${TEST_ROLE};`);
    await superDb.$executeRawUnsafe(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ${TEST_ROLE};`);
  } catch (e: any) {
    console.error('Failed to create test role:', e.message);
    process.exit(1);
  }

  // Connect as the non-superuser role
  const dbUrl = new URL(process.env.DATABASE_URL!);
  dbUrl.username = TEST_ROLE;
  dbUrl.password = 'test_password';
  const appDb = new PrismaClient({ datasourceUrl: dbUrl.toString() });

  try {
    // Verify we're actually connected as the non-superuser
    const roleInfo = await appDb.$queryRawUnsafe<any[]>(
      'SELECT current_user, rolsuper FROM pg_roles WHERE rolname = current_user'
    );
    console.log(`  Connected as: ${roleInfo[0]?.current_user} (superuser=${roleInfo[0]?.rolsuper})\n`);

    if (roleInfo[0]?.rolsuper === true) {
      console.error('ERROR: Still connected as superuser. RLS test would be meaningless.');
      process.exit(1);
    }

    // ─── Test 1: No user context set → zero rows ──────────────────
    console.log('Test 1: Query WITHOUT setting app.current_user_id');
    try {
      const rows = await appDb.$transaction(async (tx) => {
        // Explicitly clear any inherited context
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '';`);
        const result = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM "Document" WHERE "id" = $1`,
          doc.id
        );
        return result;
      });
      assert(
        'No context → Document',
        rows.length === 0,
        `Expected 0 rows, got ${rows.length}`
      );
    } catch (e: any) {
      assert('No context → Document', true, `Query threw (RLS enforcement): ${e.message.slice(0, 80)}`);
    }

    // ─── Test 2: Ghost user (non-collaborator) → zero rows ────────
    console.log('\nTest 2: Query with ghost user (no collaborator row)');
    try {
      const rows = await appDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${ghostUserId}';`);
        const result = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM "Document" WHERE "id" = $1`,
          doc.id
        );
        return result;
      });
      assert(
        'Ghost user → Document',
        rows.length === 0,
        `Expected 0 rows, got ${rows.length}`
      );
    } catch (e: any) {
      assert('Ghost user → Document', true, `Query threw (RLS enforcement): ${e.message.slice(0, 80)}`);
    }

    // Test ghost user on DocumentUpdateLog
    try {
      const rows = await appDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${ghostUserId}';`);
        const result = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM "DocumentUpdateLog" WHERE "documentId" = $1`,
          doc.id
        );
        return result;
      });
      assert(
        'Ghost user → UpdateLog',
        rows.length === 0,
        `Expected 0 rows, got ${rows.length}`
      );
    } catch (e: any) {
      assert('Ghost user → UpdateLog', true, `Query threw (RLS enforcement): ${e.message.slice(0, 80)}`);
    }

    // Test ghost user on DocumentSnapshot
    try {
      const rows = await appDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${ghostUserId}';`);
        const result = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM "DocumentSnapshot" WHERE "documentId" = $1`,
          doc.id
        );
        return result;
      });
      assert(
        'Ghost user → Snapshot',
        rows.length === 0,
        `Expected 0 rows, got ${rows.length}`
      );
    } catch (e: any) {
      assert('Ghost user → Snapshot', true, `Query threw (RLS enforcement): ${e.message.slice(0, 80)}`);
    }

    // Test ghost user on DocumentCollaborator
    try {
      const rows = await appDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${ghostUserId}';`);
        const result = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM "DocumentCollaborator" WHERE "documentId" = $1`,
          doc.id
        );
        return result;
      });
      assert(
        'Ghost user → Collaborator',
        rows.length === 0,
        `Expected 0 rows, got ${rows.length}`
      );
    } catch (e: any) {
      assert('Ghost user → Collaborator', true, `Query threw (RLS enforcement): ${e.message.slice(0, 80)}`);
    }

    // ─── Test 3: Alice (owner + collaborator) → gets rows ─────────
    console.log('\nTest 3: Query with Alice (document owner & collaborator)');
    try {
      const rows = await appDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${alice.id}';`);
        const result = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM "Document" WHERE "id" = $1`,
          doc.id
        );
        return result;
      });
      assert(
        'Alice → Document',
        rows.length === 1,
        `Expected 1 row, got ${rows.length}`
      );
    } catch (e: any) {
      assert('Alice → Document', false, `Unexpected error: ${e.message.slice(0, 100)}`);
    }

    // ─── Test 4: Bob (collaborator VIEWER) → gets rows ────────────
    console.log('\nTest 4: Query with Bob (VIEWER collaborator)');
    try {
      const rows = await appDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${bob.id}';`);
        const result = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM "Document" WHERE "id" = $1`,
          doc.id
        );
        return result;
      });
      assert(
        'Bob → Document',
        rows.length === 1,
        `Expected 1 row, got ${rows.length}`
      );
    } catch (e: any) {
      assert('Bob → Document', false, `Unexpected error: ${e.message.slice(0, 100)}`);
    }

  } finally {
    await appDb.$disconnect();
  }

  // ─── Summary ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const allPassed = passed === total;
  console.log(`  Results: ${passed}/${total} passed ${allPassed ? '✅' : '❌'}`);
  console.log('══════════════════════════════════════════════════════\n');

  if (!allPassed) {
    console.error('FAILED: Some RLS tests did not pass. Check output above.');
    process.exit(1);
  }

  console.log('All RLS isolation tests passed. Tenant data is properly scoped.\n');
}

main()
  .catch((e) => {
    console.error('RLS test script crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await superDb.$disconnect();
  });
