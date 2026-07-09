import { db, Role } from './index';

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
  const collaborator = await db.documentCollaborator.findUnique({
    where: {
      documentId_userId: {
        documentId,
        userId,
      },
    },
  });

  if (!collaborator) {
    throw new ForbiddenError();
  }
}

/**
 * Fetches a single document ensuring the querying user is a collaborator.
 */
export async function getDocumentSecured(userId: string, documentId: string) {
  const doc = await db.document.findFirst({
    where: {
      id: documentId,
      collaborators: {
        some: {
          userId,
        },
      },
    },
  });

  if (!doc) {
    throw new ForbiddenError('Document not found or access denied');
  }

  return doc;
}

/**
 * Fetches all documents where the user is registered as a collaborator.
 */
export async function getDocumentsForUserSecured(userId: string) {
  return db.document.findMany({
    where: {
      collaborators: {
        some: {
          userId,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
}

/**
 * Creates a new document and automatically adds the creator as OWNER collaborator.
 */
export async function createDocumentSecured(userId: string, title: string) {
  return db.document.create({
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
}

/**
 * Fetches append-only updates for a document after checking user collaborator status.
 */
export async function getUpdateLogsSecured(userId: string, documentId: string) {
  await assertCollaborator(userId, documentId);

  return db.documentUpdateLog.findMany({
    where: {
      documentId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

/**
 * Appends a Yjs state update to a document after checking user collaborator status.
 */
export async function createUpdateLogSecured(userId: string, documentId: string, update: Uint8Array) {
  await assertCollaborator(userId, documentId);

  return db.documentUpdateLog.create({
    data: {
      documentId,
      update: update as any,
      createdBy: userId,
    },
  });
}

/**
 * Fetches periodic snapshots for a document after checking user collaborator status.
 */
export async function getSnapshotsSecured(userId: string, documentId: string) {
  await assertCollaborator(userId, documentId);

  return db.documentSnapshot.findMany({
    where: {
      documentId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Saves a document checkpoint after checking user collaborator status.
 */
export async function createSnapshotSecured(
  userId: string,
  documentId: string,
  state: Uint8Array,
  label?: string
) {
  await assertCollaborator(userId, documentId);

  return db.$transaction(async (tx) => {
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

  return db.documentCollaborator.findMany({
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
}

/**
 * Adds a new collaborator or updates an existing collaborator's role.
 * Only the document OWNER is permitted to manage collaborators.
 */
export async function addOrUpdateCollaboratorSecured(
  invitingUserId: string,
  documentId: string,
  inviteeEmail: string,
  role: Role
) {
  // 1. Verify that the inviting user is indeed the document owner
  const invitingCollaborator = await db.documentCollaborator.findUnique({
    where: {
      documentId_userId: {
        documentId,
        userId: invitingUserId,
      },
    },
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
    const ownerCount = await db.documentCollaborator.count({
      where: {
        documentId,
        role: Role.OWNER,
      },
    });
    if (ownerCount <= 1) {
      throw new Error('Cannot demote yourself: you are the only owner of this document');
    }
  }

  // 4. Create or update the collaborator entry
  return db.documentCollaborator.upsert({
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
}

/**
 * Removes a collaborator from the document.
 * Only the document OWNER is permitted to remove collaborators.
 */
export async function removeCollaboratorSecured(
  ownerUserId: string,
  documentId: string,
  targetUserId: string
) {
  // 1. Verify that the deleting user is indeed the document owner
  const ownerCollaborator = await db.documentCollaborator.findUnique({
    where: {
      documentId_userId: {
        documentId,
        userId: ownerUserId,
      },
    },
  });

  if (!ownerCollaborator || ownerCollaborator.role !== Role.OWNER) {
    throw new ForbiddenError('Unauthorized: Only document owners can remove collaborators');
  }

  // 2. Prevent removing the owner if they are the only owner
  if (targetUserId === ownerUserId) {
    const ownerCount = await db.documentCollaborator.count({
      where: {
        documentId,
        role: Role.OWNER,
      },
    });
    if (ownerCount <= 1) {
      throw new Error('Cannot remove yourself: you are the only owner of this document');
    }
  }

  // 3. Delete the collaborator row
  return db.documentCollaborator.delete({
    where: {
      documentId_userId: {
        documentId,
        userId: targetUserId,
      },
    },
  });
}

