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
