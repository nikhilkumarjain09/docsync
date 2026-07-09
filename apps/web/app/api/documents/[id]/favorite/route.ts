/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { toggleFavoriteSecured } from '@docsync/db';

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
