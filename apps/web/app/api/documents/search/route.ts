import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
import { PostgresSearchProvider } from '@/lib/search/postgres-provider';
import { ElasticsearchSearchProvider } from '@/lib/search/elasticsearch-provider';

// GET /api/documents/search?q=query
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const userId = session.user.id;

  try {
    // Choose search provider based on configuration
    const isElasticEnabled = process.env.SEARCH_PROVIDER === 'elasticsearch';
    const provider = isElasticEnabled
      ? new ElasticsearchSearchProvider()
      : new PostgresSearchProvider();

    const results = await provider.search(query, userId);
    return NextResponse.json(results);
  } catch (err: unknown) {
    console.error('[SearchRoute] GET failed:', (err as Error).message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
