import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFavoritesForUserSecured } from '@docsync/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const favorites = await getFavoritesForUserSecured(userId);
    return NextResponse.json(favorites);
  } catch (err) {
    console.error('[Favorites GET] Failed to fetch favorites:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
