/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentsForUserSecured, permanentlyDeleteDocumentSecured } from '@docsync/db';

// GET: Retrieve the list of soft-deleted documents for the current user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const documents = await getDocumentsForUserSecured(userId, true);
    const trashedDocs = documents.filter((doc) => doc.deletedAt !== null);
    return NextResponse.json(trashedDocs);
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Permanently delete a document
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('id');

  if (!documentId) {
    return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
  }

  try {
    await permanentlyDeleteDocumentSecured(userId, documentId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (
      e.name === 'ForbiddenError' ||
      e.message.includes('Unauthorized') ||
      e.message.includes('Forbidden')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
