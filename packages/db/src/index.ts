import { PrismaClient } from './generated/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

/**
 * Runs a set of Prisma queries inside an interactive transaction with the database-level
 * Row-Level Security (RLS) user context set.
 * 
 * This is defense-in-depth to ensure that if a query fails to perform application-level
 * collaborator checks, PostgreSQL will reject the transaction due to violating RLS policies.
 */
export async function runWithUserContext<T>(
  userId: string,
  fn: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$use' | '$on'>) => Promise<T>
): Promise<T> {
  // Validate CUID/UUID to prevent SQL injection in raw query
  if (!/^[a-z0-9-_]+$/i.test(userId)) {
    throw new Error('Invalid user ID format');
  }

  return db.$transaction(async (tx) => {
    // SET LOCAL only persists for the duration of this specific transaction block.
    await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}';`);
    return fn(tx as any);
  });
}

export * from './generated/client';
export { Role } from './generated/client';
export * from './secured';

