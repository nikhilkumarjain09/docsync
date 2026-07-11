import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentsForUserSecured, createDocumentSecured } from '@docsync/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CreateDocSchema = z.object({
  title: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const documents = await getDocumentsForUserSecured(userId);
    return NextResponse.json(documents);
  } catch (err: unknown) {
    console.error('[DocumentsListRoute] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

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
  } catch (err: unknown) {
    console.error('[DocumentsListRoute] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
