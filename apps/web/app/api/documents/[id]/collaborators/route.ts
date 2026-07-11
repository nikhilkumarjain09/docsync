import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getCollaboratorsSecured,
  addOrUpdateCollaboratorSecured,
  removeCollaboratorSecured,
} from '@docsync/db';
import { handleApiError } from '@/lib/api-error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CollaboratorSchema = z.object({
  email: z.string().email().max(100),
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  try {
    const collaborators = await getCollaboratorsSecured(userId, documentId);
    return NextResponse.json(collaborators);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = CollaboratorSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, role } = parseResult.data;

  try {
    const collaborator = await addOrUpdateCollaboratorSecured(userId, documentId, email, role);
    return NextResponse.json(collaborator);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('exist') || message.includes('demote')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handleApiError(err);
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

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId');

  if (!targetUserId) {
    return NextResponse.json({ error: 'Missing target userId to remove' }, { status: 400 });
  }

  try {
    await removeCollaboratorSecured(userId, documentId, targetUserId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('remove yourself')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handleApiError(err);
  }
}
