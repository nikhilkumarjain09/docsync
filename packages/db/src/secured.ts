import { db, Role, runWithUserContext } from './index';

/**
 * Custom error class for unauthorized data access attempts.
 */
export class ForbiddenError extends Error {
  constructor(message = 'Unauthorized access to document data') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Checks if a user is a collaborator on a document.
 * Throws ForbiddenError if they are not.
 */
async function assertCollaborator(userId: string, documentId: string): Promise<void> {
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

  if (!collaborator) {
    throw new ForbiddenError();
  }
}

/**
 * Fetches a single document ensuring the querying user is a collaborator.
 */
export async function getDocumentSecured(userId: string, documentId: string) {
  const doc = await runWithUserContext(userId, async (tx) => {
    return tx.document.findFirst({
      where: {
        id: documentId,
        collaborators: {
          some: {
            userId,
          },
        },
      },
    });
  });

  if (!doc) {
    throw new ForbiddenError('Document not found or access denied');
  }

  return doc;
}

/**
 * Fetches all documents where the user is registered as a collaborator.
 */
export async function getDocumentsForUserSecured(userId: string, includeDeleted = false) {
  return runWithUserContext(userId, async (tx) => {
    return tx.document.findMany({
      where: {
        collaborators: {
          some: {
            userId,
          },
        },
        deletedAt: includeDeleted ? undefined : null,
      },
      include: {
        owner: {
          select: { name: true, email: true },
        },
        collaborators: {
          select: { userId: true, role: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  });
}

/**
 * Creates a new document and automatically adds the creator as OWNER collaborator.
 */
export async function createDocumentSecured(userId: string, title: string) {
  return runWithUserContext(userId, async (tx) => {
    return tx.document.create({
      data: {
        title,
        ownerId: userId,
        collaborators: {
          create: {
            userId,
            role: Role.OWNER,
          },
        },
      },
    });
  });
}

/**
 * Fetches append-only updates for a document after checking user collaborator status.
 */
export async function getUpdateLogsSecured(userId: string, documentId: string) {
  await assertCollaborator(userId, documentId);

  return runWithUserContext(userId, async (tx) => {
    return tx.documentUpdateLog.findMany({
      where: {
        documentId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  });
}

/**
 * Appends a Yjs state update to a document after checking user collaborator status.
 */
export async function createUpdateLogSecured(
  userId: string,
  documentId: string,
  update: Uint8Array,
) {
  await assertCollaborator(userId, documentId);

  return runWithUserContext(userId, async (tx) => {
    return tx.documentUpdateLog.create({
      data: {
        documentId,
        update: update as any,
        createdBy: userId,
      },
    });
  });
}

/**
 * Fetches periodic snapshots for a document after checking user collaborator status.
 */
export async function getSnapshotsSecured(userId: string, documentId: string) {
  await assertCollaborator(userId, documentId);

  return runWithUserContext(userId, async (tx) => {
    return tx.documentSnapshot.findMany({
      where: {
        documentId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });
}

/**
 * Saves a document checkpoint after checking user collaborator status.
 */
export async function createSnapshotSecured(
  userId: string,
  documentId: string,
  state: Uint8Array,
  label?: string,
) {
  await assertCollaborator(userId, documentId);

  return runWithUserContext(userId, async (tx) => {
    // 1. Create the snapshot
    const snapshot = await tx.documentSnapshot.create({
      data: {
        documentId,
        state: state as any,
        createdBy: userId,
        label,
      },
    });

    // 2. Update the document's latestSnapshot reference and increment the snapshotVersion
    await tx.document.update({
      where: {
        id: documentId,
      },
      data: {
        latestSnapshot: state as any,
        snapshotVersion: {
          increment: 1,
        },
      },
    });

    return snapshot;
  });
}

/**
 * Fetches all collaborators for a document after checking user collaborator status.
 */
export async function getCollaboratorsSecured(userId: string, documentId: string) {
  await assertCollaborator(userId, documentId);

  return runWithUserContext(userId, async (tx) => {
    return tx.documentCollaborator.findMany({
      where: {
        documentId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  });
}

/**
 * Adds a new collaborator or updates an existing collaborator's role.
 * Only the document OWNER is permitted to manage collaborators.
 */
export async function addOrUpdateCollaboratorSecured(
  invitingUserId: string,
  documentId: string,
  inviteeEmail: string,
  role: Role,
) {
  // 1. Verify that the inviting user is indeed the document owner
  const invitingCollaborator = await runWithUserContext(invitingUserId, async (tx) => {
    return tx.documentCollaborator.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId: invitingUserId,
        },
      },
    });
  });

  if (!invitingCollaborator || invitingCollaborator.role !== Role.OWNER) {
    throw new ForbiddenError('Unauthorized: Only document owners can manage collaborators');
  }

  // 2. Find the user being invited by email
  const invitee = await db.user.findUnique({
    where: {
      email: inviteeEmail,
    },
  });

  if (!invitee) {
    throw new Error(`User with email "${inviteeEmail}" does not exist`);
  }

  // 3. Prevent an owner from changing their own role (to avoid orphaned documents)
  if (invitee.id === invitingUserId && role !== Role.OWNER) {
    // Check if there are other owners
    const ownerCount = await runWithUserContext(invitingUserId, async (tx) => {
      return tx.documentCollaborator.count({
        where: {
          documentId,
          role: Role.OWNER,
        },
      });
    });
    if (ownerCount <= 1) {
      throw new Error('Cannot demote yourself: you are the only owner of this document');
    }
  }

  // 4. Create or update the collaborator entry
  return runWithUserContext(invitingUserId, async (tx) => {
    return tx.documentCollaborator.upsert({
      where: {
        documentId_userId: {
          documentId,
          userId: invitee.id,
        },
      },
      update: {
        role,
      },
      create: {
        documentId,
        userId: invitee.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  });
}

/**
 * Removes a collaborator from the document.
 * Only the document OWNER is permitted to remove collaborators.
 */
export async function removeCollaboratorSecured(
  ownerUserId: string,
  documentId: string,
  targetUserId: string,
) {
  // 1. Verify that the deleting user is indeed the document owner
  const ownerCollaborator = await runWithUserContext(ownerUserId, async (tx) => {
    return tx.documentCollaborator.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId: ownerUserId,
        },
      },
    });
  });

  if (!ownerCollaborator || ownerCollaborator.role !== Role.OWNER) {
    throw new ForbiddenError('Unauthorized: Only document owners can remove collaborators');
  }

  // 2. Prevent removing the owner if they are the only owner
  if (targetUserId === ownerUserId) {
    const ownerCount = await runWithUserContext(ownerUserId, async (tx) => {
      return tx.documentCollaborator.count({
        where: {
          documentId,
          role: Role.OWNER,
        },
      });
    });
    if (ownerCount <= 1) {
      throw new Error('Cannot remove yourself: you are the only owner of this document');
    }
  }

  // 3. Delete the collaborator row
  return runWithUserContext(ownerUserId, async (tx) => {
    return tx.documentCollaborator.delete({
      where: {
        documentId_userId: {
          documentId,
          userId: targetUserId,
        },
      },
    });
  });
}

/**
 * Asserts that a user has one of the allowed roles for a document.
 * Throws ForbiddenError if they do not.
 */
async function assertRole(userId: string, documentId: string, allowedRoles: Role[]): Promise<void> {
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

  if (!collaborator || !allowedRoles.includes(collaborator.role)) {
    throw new ForbiddenError('Unauthorized: Insufficient role permissions');
  }
}

/**
 * Soft deletes a document (sets deletedAt). Only OWNER can delete.
 */
export async function softDeleteDocumentSecured(userId: string, documentId: string) {
  await assertRole(userId, documentId, [Role.OWNER]);
  return runWithUserContext(userId, async (tx) => {
    return tx.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
  });
}

/**
 * Restores a soft-deleted document (clears deletedAt). Only OWNER can restore.
 */
export async function restoreDocumentSecured(userId: string, documentId: string) {
  await assertRole(userId, documentId, [Role.OWNER]);
  return runWithUserContext(userId, async (tx) => {
    return tx.document.update({
      where: { id: documentId },
      data: { deletedAt: null },
    });
  });
}

/**
 * Permanently deletes a document. Only OWNER can delete.
 */
export async function permanentlyDeleteDocumentSecured(userId: string, documentId: string) {
  await assertRole(userId, documentId, [Role.OWNER]);
  return runWithUserContext(userId, async (tx) => {
    return tx.document.delete({
      where: { id: documentId },
    });
  });
}

/**
 * Renames a document. OWNER or EDITOR can rename.
 */
export async function renameDocumentSecured(userId: string, documentId: string, title: string) {
  await assertRole(userId, documentId, [Role.OWNER, Role.EDITOR]);
  return runWithUserContext(userId, async (tx) => {
    return tx.document.update({
      where: { id: documentId },
      data: { title },
    });
  });
}

/**
 * Duplicates a document. OWNER or EDITOR can duplicate.
 */
export async function duplicateDocumentSecured(userId: string, documentId: string) {
  await assertRole(userId, documentId, [Role.OWNER, Role.EDITOR]);

  const original = await runWithUserContext(userId, async (tx) => {
    return tx.document.findUnique({
      where: { id: documentId },
      include: {
        updateLogs: true,
      },
    });
  });
  if (!original) throw new Error('Original document not found');

  return runWithUserContext(userId, async (tx) => {
    const duplicated = await tx.document.create({
      data: {
        title: `${original.title} (Copy)`,
        ownerId: userId,
        latestSnapshot: original.latestSnapshot,
        snapshotVersion: original.snapshotVersion,
        collaborators: {
          create: {
            userId,
            role: Role.OWNER,
          },
        },
      },
    });

    if (original.updateLogs.length > 0) {
      await tx.documentUpdateLog.createMany({
        data: original.updateLogs.map((log) => ({
          documentId: duplicated.id,
          update: log.update,
          createdBy: log.createdBy,
          restoredFromSnapshotId: log.restoredFromSnapshotId,
          createdAt: log.createdAt,
        })),
      });
    }

    return duplicated;
  });
}

/**
 * Toggles the favorite status of a document for a user.
 */
export async function toggleFavoriteSecured(userId: string, documentId: string) {
  await assertCollaborator(userId, documentId);
  const existing = await runWithUserContext(userId, async (tx) => {
    return tx.favoriteDocument.findUnique({
      where: {
        userId_documentId: {
          userId,
          documentId,
        },
      },
    });
  });

  if (existing) {
    await runWithUserContext(userId, async (tx) => {
      return tx.favoriteDocument.delete({
        where: {
          userId_documentId: {
            userId,
            documentId,
          },
        },
      });
    });
    return { favorited: false };
  } else {
    await runWithUserContext(userId, async (tx) => {
      return tx.favoriteDocument.create({
        data: {
          userId,
          documentId,
        },
      });
    });
    return { favorited: true };
  }
}

/**
 * Retrieves all favorited documents for a user that are not soft-deleted.
 */
export async function getFavoritesForUserSecured(userId: string) {
  const favorites = await runWithUserContext(userId, async (tx) => {
    return tx.favoriteDocument.findMany({
      where: {
        userId,
        document: {
          deletedAt: null,
          collaborators: {
            some: {
              userId,
            },
          },
        },
      },
      include: {
        document: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });
  return favorites.map((f) => f.document);
}
