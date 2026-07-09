import { db } from '@docsync/db';

export type DocumentRole = 'owner' | 'editor' | 'viewer' | 'none';

/**
 * Gets a user's role for a specific document.
 * 
 * TODO: Actually read permissions from a UserDocumentPermission junction table in the DB.
 * For now, this is a placeholder implementation returning 'editor' if both user and doc exist.
 */
export async function getDocumentRole(userId: string, documentId: string): Promise<DocumentRole> {
  const [user, doc] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.document.findUnique({ where: { id: documentId } }),
  ]);

  if (!user || !doc) {
    return 'none';
  }

  // Temporary default role for testing and demo purposes
  return 'editor';
}
