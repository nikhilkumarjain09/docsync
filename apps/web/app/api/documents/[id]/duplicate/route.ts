/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { duplicateDocumentSecured } from '@docsync/db';

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
