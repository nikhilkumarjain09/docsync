import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { toggleFavoriteSecured } from '@docsync/db';
import { handleApiError } from '@/lib/api-error';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  try {
    const result = await toggleFavoriteSecured(userId, documentId);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
