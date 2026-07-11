import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { duplicateDocumentSecured } from '@docsync/db';
import { handleApiError } from '@/lib/api-error';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  try {
    const doc = await duplicateDocumentSecured(userId, documentId);
    return NextResponse.json(doc);
  } catch (err) {
    return handleApiError(err);
  }
}
