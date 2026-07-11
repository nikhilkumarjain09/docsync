/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
import { getDocumentsForUserSecured, createDocumentSecured } from '@docsync/db';
import { z } from 'zod';

const CreateDocSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(100, 'Title is too long'),
});

// GET: List all documents collaborator is associated with
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const documents = await getDocumentsForUserSecured(userId);
    return NextResponse.json(documents);
  } catch (e: any) {
    console.error('[DocumentsListRoute] GET error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new document for this user (automatically adds them as OWNER)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // Zod validation
  const parseResult = CreateDocSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { title } = parseResult.data;

  try {
    const doc = await createDocumentSecured(userId, title);
    return NextResponse.json(doc);
  } catch (e: any) {
    console.error('[DocumentsListRoute] POST error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
