import { db, runWithUserContext } from '@docsync/db';

export type DocumentRole = 'OWNER' | 'EDITOR' | 'VIEWER';

/**
 * Checks a user's role for a specific document.
 * Returns 'OWNER', 'EDITOR', 'VIEWER', or null if no collaborator record exists.
 */
export async function getDocumentRole(
  userId: string,
  documentId: string,
): Promise<DocumentRole | null> {
  try {
    const collaborator = await runWithUserContext(userId, async (tx) => {
      return tx.documentCollaborator.findUnique({
        where: {
          documentId_userId: {
            documentId,
            userId,
          },
        },
      });
    });

    return collaborator ? (collaborator.role as DocumentRole) : null;
  } catch (err) {
    // Return null if RLS context query fails (e.g. invalid user format or blocked)
    return null;
  }
}
