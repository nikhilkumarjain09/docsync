export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  matchField: 'title' | 'content' | 'headings' | 'paragraphs' | 'tables' | 'lists' | 'metadata';
  updatedAt: string;
  ownerName: string;
  ownerEmail: string;
  score: number;
  tags: string[];
  categories: string[];
  keywords: string[];
  department: string | null;
}

export interface SearchProvider {
  search(query: string, userId: string): Promise<SearchResult[]>;
}
