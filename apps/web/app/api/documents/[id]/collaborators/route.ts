/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
import {
  getCollaboratorsSecured,
  addOrUpdateCollaboratorSecured,
  removeCollaboratorSecured,
  ForbiddenError,
} from '@docsync/db';
import { z } from 'zod';

const CollaboratorSchema = z.object({
  email: z.string().email().max(100),
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
});

// GET: Retrieve the list of collaborators for a specific document
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
  } catch (e: any) {
    console.error('[COLLAB API DEBUG] getCollaboratorsSecured error:', e.name, e.message, e.stack);
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    console.error('[CollaboratorsRoute] GET error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add a new collaborator or update their role (Only OWNER can perform this)
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
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // Zod validation
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
  } catch (e: any) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    // Handle specific errors like user not found
    if (e.message.includes('exist') || e.message.includes('demote')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[CollaboratorsRoute] POST error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a collaborator (Only OWNER can perform this)
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

  // Extract collaborator userId to remove from query params
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId');

  if (!targetUserId) {
    return NextResponse.json({ error: 'Missing target userId to remove' }, { status: 400 });
  }

  try {
    await removeCollaboratorSecured(userId, documentId, targetUserId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.message.includes('remove yourself')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[CollaboratorsRoute] DELETE error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
