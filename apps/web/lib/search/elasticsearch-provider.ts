import { db } from '@docsync/db';
import { SearchProvider, SearchResult } from './search-provider';
import { PostgresSearchProvider } from './postgres-provider';

interface ElasticSearchHit {
  _id: string;
  _score: number | null;
  _source: {
    title?: string;
    updatedAt?: string;
    ownerName?: string;
    ownerEmail?: string;
    tags?: string | string[];
    categories?: string | string[];
    keywords?: string | string[];
    department?: string;
  };
  highlight?: {
    title?: string[];
    headings?: string[];
    content?: string[];
    paragraphs?: string[];
    tables?: string[];
    lists?: string[];
  };
}

export class ElasticsearchSearchProvider implements SearchProvider {
  private postgresProvider = new PostgresSearchProvider();
  private url = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
  private username = process.env.ELASTICSEARCH_USERNAME;
  private password = process.env.ELASTICSEARCH_PASSWORD;

  async search(query: string, userId: string): Promise<SearchResult[]> {
    if (!process.env.ELASTICSEARCH_URL) {
      return this.postgresProvider.search(query, userId);
    }

    try {
      const documents = await db.document.findMany({
        where: {
          collaborators: {
            some: { userId },
          },
          deletedAt: null,
        },
        select: { id: true },
      });

      const allowedDocIds = documents.map((d) => d.id);
      if (allowedDocIds.length === 0) {
        return [];
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.username && this.password) {
        const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const body = {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: [
                    'title^4',
                    'headings^3',
                    'tags^3',
                    'categories^3',
                    'keywords^3',
                    'department^2',
                    'content',
                    'paragraphs',
                    'tables',
                    'lists',
                  ],
                  fuzziness: 'AUTO',
                  prefix_length: 2,
                },
              },
            ],
            filter: [
              {
                terms: {
                  _id: allowedDocIds,
                },
              },
            ],
          },
        },
        highlight: {
          fields: {
            title: {},
            headings: {},
            content: {},
            paragraphs: {},
            tables: {},
            lists: {},
          },
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
        },
        size: 30,
      };

      const res = await fetch(`${this.url}/docsync-documents/_search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Elasticsearch server responded with status: ${res.status}`);
      }

      const data = (await res.json()) as { hits?: { hits?: ElasticSearchHit[] } };
      const hits = data?.hits?.hits || [];

      return hits.map((hit: ElasticSearchHit) => {
        const source = hit._source;
        const highlights = hit.highlight || {};

        let snippet = '';
        let matchField: SearchResult['matchField'] = 'content';

        if (highlights.title) {
          snippet = highlights.title[0];
          matchField = 'title';
        } else if (highlights.headings) {
          snippet = highlights.headings[0];
          matchField = 'headings';
        } else if (highlights.content) {
          snippet = highlights.content[0];
          matchField = 'content';
        } else if (highlights.paragraphs) {
          snippet = highlights.paragraphs[0];
          matchField = 'paragraphs';
        } else if (highlights.tables) {
          snippet = highlights.tables[0];
          matchField = 'tables';
        } else if (highlights.lists) {
          snippet = highlights.lists[0];
          matchField = 'lists';
        } else {
          snippet = source.title || '';
          matchField = 'title';
        }

        const parseTags = (val: string | string[] | undefined): string[] => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          return String(val)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        };

        return {
          id: hit._id,
          title: source.title || 'Untitled',
          snippet,
          matchField,
          updatedAt: source.updatedAt || new Date().toISOString(),
          ownerName: source.ownerName || 'Anonymous',
          ownerEmail: source.ownerEmail || '',
          score: hit._score || 0,
          tags: parseTags(source.tags),
          categories: parseTags(source.categories),
          keywords: parseTags(source.keywords),
          department: source.department || null,
        };
      });
    } catch (e: unknown) {
      console.warn(
        `[ElasticsearchSearchProvider] Connection error: "${(e as Error).message}". Falling back to Postgres full-text search.`,
      );
      return this.postgresProvider.search(query, userId);
    }
  }
}
