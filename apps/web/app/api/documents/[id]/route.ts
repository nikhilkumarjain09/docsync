/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
import { renameDocumentSecured, softDeleteDocumentSecured, getDocumentSecured } from '@docsync/db';
import { z } from 'zod';

const RenameSchema = z.object({
  title: z.string().min(1).max(100),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  try {
    const doc = await getDocumentSecured(userId, documentId);
    return NextResponse.json(doc);
  } catch (e: any) {
    console.error('[DOC DETAILS DEBUG] getDocumentSecured error:', e.name, e.message, e.stack);
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = RenameSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid title value' }, { status: 400 });
  }

  const { title } = parseResult.data;

  try {
    const doc = await renameDocumentSecured(userId, documentId, title);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  try {
    await softDeleteDocumentSecured(userId, documentId);
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
