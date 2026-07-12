-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "categories" TEXT,
ADD COLUMN     "content" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "department" TEXT,
ADD COLUMN     "headings" TEXT,
ADD COLUMN     "keywords" TEXT,
ADD COLUMN     "lists" TEXT,
ADD COLUMN     "paragraphs" TEXT,
ADD COLUMN     "tables" TEXT,
ADD COLUMN     "tags" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FavoriteDocument" (
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteDocument_pkey" PRIMARY KEY ("userId","documentId")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_email_token_key" ON "VerificationToken"("email", "token");

-- CreateIndex
CREATE INDEX "DocumentCollaborator_userId_idx" ON "DocumentCollaborator"("userId");

-- AddForeignKey
ALTER TABLE "FavoriteDocument" ADD CONSTRAINT "FavoriteDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDocument" ADD CONSTRAINT "FavoriteDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
