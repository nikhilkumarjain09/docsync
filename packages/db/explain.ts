import { db } from './src';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  console.log('[EXPLAIN] Explaining database query execution plans...');

  try {
    const plan1 = await db.$queryRawUnsafe(`
      EXPLAIN ANALYZE SELECT * FROM "DocumentUpdateLog" WHERE "documentId" = 'some-doc-id' ORDER BY "createdAt" ASC;
    `);
    console.log('\n--- SYNC PULL QUERY PLAN ---');
    console.log(plan1);
  } catch (e: any) {
    console.error('Failed to run sync pull query plan explain:', e.message);
  }

  try {
    const plan2 = await db.$queryRawUnsafe(`
      EXPLAIN ANALYZE SELECT * FROM "Document" d
      WHERE EXISTS (
        SELECT 1 FROM "DocumentCollaborator" c
        WHERE c."documentId" = d.id AND c."userId" = 'some-user-id'
      )
      ORDER BY d."updatedAt" DESC;
    `);
    console.log('\n--- DOCUMENT LIST QUERY PLAN ---');
    console.log(plan2);
  } catch (e: any) {
    console.error('Failed to run document list query plan explain:', e.message);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
