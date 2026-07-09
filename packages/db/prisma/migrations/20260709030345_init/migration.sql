-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "hashedPassword" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "latestSnapshot" BYTEA,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCollaborator" (
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCollaborator_pkey" PRIMARY KEY ("documentId","userId")
);

-- CreateTable
CREATE TABLE "DocumentUpdateLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "update" BYTEA NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentUpdateLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSnapshot" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "state" BYTEA NOT NULL,
    "createdBy" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DocumentUpdateLog_documentId_idx" ON "DocumentUpdateLog"("documentId");

-- CreateIndex
CREATE INDEX "DocumentSnapshot_documentId_idx" ON "DocumentSnapshot"("documentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCollaborator" ADD CONSTRAINT "DocumentCollaborator_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCollaborator" ADD CONSTRAINT "DocumentCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpdateLog" ADD CONSTRAINT "DocumentUpdateLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpdateLog" ADD CONSTRAINT "DocumentUpdateLog_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSnapshot" ADD CONSTRAINT "DocumentSnapshot_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSnapshot" ADD CONSTRAINT "DocumentSnapshot_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row Level Security (RLS) Policies (Defense-in-depth) ─────────

-- Enable RLS and Force it for owners (so Prisma superuser connection is checked)
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" FORCE ROW LEVEL SECURITY;

ALTER TABLE "DocumentCollaborator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentCollaborator" FORCE ROW LEVEL SECURITY;

ALTER TABLE "DocumentUpdateLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentUpdateLog" FORCE ROW LEVEL SECURITY;

ALTER TABLE "DocumentSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentSnapshot" FORCE ROW LEVEL SECURITY;

-- Create helper function to check collaborator status
-- SECURITY DEFINER bypasses RLS on DocumentCollaborator to avoid policy recursion.
CREATE OR REPLACE FUNCTION check_document_collaborator(doc_id TEXT, user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "DocumentCollaborator"
    WHERE "documentId" = doc_id AND "userId" = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Document Policy: Access allowed if user is the document owner OR is a collaborator.
CREATE POLICY document_access_policy ON "Document"
  FOR ALL
  USING (
    "Document"."ownerId" = current_setting('app.current_user_id', true)
    OR check_document_collaborator("Document"."id", current_setting('app.current_user_id', true))
  );

-- 2. DocumentCollaborator Policy: Access allowed if user matches the collaborator record OR is already a collaborator on that document.
CREATE POLICY collaborator_access_policy ON "DocumentCollaborator"
  FOR ALL
  USING (
    "DocumentCollaborator"."userId" = current_setting('app.current_user_id', true)
    OR check_document_collaborator("DocumentCollaborator"."documentId", current_setting('app.current_user_id', true))
  );

-- 3. DocumentUpdateLog Policy: Access allowed if user is a collaborator on the document.
CREATE POLICY update_log_access_policy ON "DocumentUpdateLog"
  FOR ALL
  USING (
    check_document_collaborator("DocumentUpdateLog"."documentId", current_setting('app.current_user_id', true))
  );

-- 4. DocumentSnapshot Policy: Access allowed if user is a collaborator on the document.
CREATE POLICY snapshot_access_policy ON "DocumentSnapshot"
  FOR ALL
  USING (
    check_document_collaborator("DocumentSnapshot"."documentId", current_setting('app.current_user_id', true))
  );

