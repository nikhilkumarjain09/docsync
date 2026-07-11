import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentsForUserSecured, permanentlyDeleteDocumentSecured } from '@docsync/db';
import { handleApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const documents = await getDocumentsForUserSecured(userId, true);
    const trashedDocs = documents.filter((doc) => doc.deletedAt !== null);
    return NextResponse.json(trashedDocs);
  } catch (err) {
    console.error('[Trash GET] Failed to fetch trash list:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
  } catch (err) {
    return handleApiError(err);
  }
}
