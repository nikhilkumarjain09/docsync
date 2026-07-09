import { db } from '@docsync/db';

export type DocumentRole = 'OWNER' | 'EDITOR' | 'VIEWER';

/**
 * Checks a user's role for a specific document.
 * Returns 'OWNER', 'EDITOR', 'VIEWER', or null if no collaborator record exists.
 */
export async function getDocumentRole(
  userId: string,
  documentId: string
): Promise<DocumentRole | null> {
  const collaborator = await db.documentCollaborator.findUnique({
    where: {
      documentId_userId: {
        documentId,
        userId,
      },
    },
  });

  return collaborator ? (collaborator.role as DocumentRole) : null;
}
