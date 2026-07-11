import { db } from '@docsync/db';
import { SearchProvider, SearchResult } from './search-provider';

interface PostgresSearchResultRow {
  id: string;
  title: string;
  updatedAt: Date;
  ownerName: string | null;
  ownerEmail: string | null;
  tags: string | null;
  categories: string | null;
  keywords: string | null;
  department: string | null;
  score: number;
  title_highlight: string | null;
  headings_highlight: string | null;
  content_highlight: string | null;
  paragraphs_highlight: string | null;
  tables_highlight: string | null;
  lists_highlight: string | null;
}

export class PostgresSearchProvider implements SearchProvider {
  private static indexInitialized = false;

  private async ensureSearchIndex() {
    if (PostgresSearchProvider.indexInitialized) return;
    try {
      // Create GIN index for combined full text search to optimize query execution plans
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS doc_fts_gin_idx ON "Document" USING gin(
          (
            to_tsvector('english', coalesce(title, '')) ||
            to_tsvector('english', coalesce(headings, '')) ||
            to_tsvector('english', coalesce(content, '')) ||
            to_tsvector('english', coalesce(paragraphs, '')) ||
            to_tsvector('english', coalesce(tables, '')) ||
            to_tsvector('english', coalesce(lists, '')) ||
            to_tsvector('english', coalesce(tags, '')) ||
            to_tsvector('english', coalesce(categories, '')) ||
            to_tsvector('english', coalesce(keywords, '')) ||
            to_tsvector('english', coalesce(department, ''))
          )
        );
      `);
      PostgresSearchProvider.indexInitialized = true;
      console.log('[PostgresSearchProvider] Full-text search GIN index ensured successfully.');
    } catch (e: unknown) {
      console.error('[PostgresSearchProvider] Failed to ensure GIN index:', (e as Error).message);
    }
  }

  async search(query: string, userId: string): Promise<SearchResult[]> {
    await this.ensureSearchIndex();

    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    // Tokenize query words and format with :* suffix for fuzzy partial prefix matching
    const formattedQuery = trimmed
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => `${w.replace(/[^a-zA-Z0-9]/g, '')}:*`)
      .join(' & ');

    if (!formattedQuery) {
      return [];
    }

    const sqlQuery = `
      SELECT 
        d.id,
        d.title,
        d."updatedAt",
        u.name as "ownerName",
        u.email as "ownerEmail",
        d.tags,
        d.categories,
        d.keywords,
        d.department,
        ts_rank_cd(
          setweight(to_tsvector('english', coalesce(d.title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(d.headings, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(d.content, '')), 'C') ||
          setweight(to_tsvector('english', coalesce(d.paragraphs, '')), 'C') ||
          setweight(to_tsvector('english', coalesce(d.tables, '')), 'D') ||
          setweight(to_tsvector('english', coalesce(d.lists, '')), 'D') ||
          setweight(to_tsvector('english', coalesce(d.tags, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(d.categories, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(d.keywords, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(d.department, '')), 'B'),
          to_tsquery('english', $1)
        ) as score,
        ts_headline('english', coalesce(d.title, ''), to_tsquery('english', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=15, MinWords=5') as title_highlight,
        ts_headline('english', coalesce(d.headings, ''), to_tsquery('english', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=15, MinWords=5') as headings_highlight,
        ts_headline('english', coalesce(d.content, ''), to_tsquery('english', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=20, MinWords=10') as content_highlight,
        ts_headline('english', coalesce(d.paragraphs, ''), to_tsquery('english', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=20, MinWords=10') as paragraphs_highlight,
        ts_headline('english', coalesce(d.tables, ''), to_tsquery('english', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=20, MinWords=10') as tables_highlight,
        ts_headline('english', coalesce(d.lists, ''), to_tsquery('english', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=20, MinWords=10') as lists_highlight
      FROM "Document" d
      LEFT JOIN "User" u ON d."ownerId" = u.id
      JOIN "DocumentCollaborator" c ON d.id = c."documentId"
      WHERE c."userId" = $2 
        AND d."deletedAt" IS NULL 
        AND (
          to_tsvector('english', coalesce(d.title, '')) ||
          to_tsvector('english', coalesce(d.headings, '')) ||
          to_tsvector('english', coalesce(d.content, '')) ||
          to_tsvector('english', coalesce(d.paragraphs, '')) ||
          to_tsvector('english', coalesce(d.tables, '')) ||
          to_tsvector('english', coalesce(d.lists, '')) ||
          to_tsvector('english', coalesce(d.tags, '')) ||
          to_tsvector('english', coalesce(d.categories, '')) ||
          to_tsvector('english', coalesce(d.keywords, '')) ||
          to_tsvector('english', coalesce(d.department, ''))
        ) @@ to_tsquery('english', $1)
      ORDER BY score DESC
      LIMIT 30
    `;

    try {
      const dbResults = (await db.$queryRawUnsafe(
        sqlQuery,
        formattedQuery,
        userId,
      )) as PostgresSearchResultRow[];

      return dbResults.map((row) => {
        let snippet = '';
        let matchField: SearchResult['matchField'] = 'content';

        if (row.title_highlight && row.title_highlight.includes('<mark>')) {
          snippet = row.title_highlight;
          matchField = 'title';
        } else if (row.headings_highlight && row.headings_highlight.includes('<mark>')) {
          snippet = row.headings_highlight;
          matchField = 'headings';
        } else if (row.content_highlight && row.content_highlight.includes('<mark>')) {
          snippet = row.content_highlight;
          matchField = 'content';
        } else if (row.paragraphs_highlight && row.paragraphs_highlight.includes('<mark>')) {
          snippet = row.paragraphs_highlight;
          matchField = 'paragraphs';
        } else if (row.tables_highlight && row.tables_highlight.includes('<mark>')) {
          snippet = row.tables_highlight;
          matchField = 'tables';
        } else if (row.lists_highlight && row.lists_highlight.includes('<mark>')) {
          snippet = row.lists_highlight;
          matchField = 'lists';
        } else {
          snippet = row.title_highlight || row.content_highlight || '';
          matchField = 'title';
        }

        const parseTags = (str: string | null): string[] => {
          if (!str) return [];
          return str
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        };

        return {
          id: row.id,
          title: row.title,
          snippet,
          matchField,
          updatedAt: new Date(row.updatedAt).toISOString(),
          ownerName: row.ownerName || 'Anonymous',
          ownerEmail: row.ownerEmail || '',
          score: Number(row.score) || 0,
          tags: parseTags(row.tags),
          categories: parseTags(row.categories),
          keywords: parseTags(row.keywords),
          department: row.department,
        };
      });
    } catch (e: unknown) {
      console.error('[PostgresSearchProvider] Search execution failed:', (e as Error).message);
      return [];
    }
  }
}
