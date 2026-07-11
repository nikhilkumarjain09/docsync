'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Search, Loader2, Clock, X, Trash2, Tag, Briefcase } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { SearchResult } from '@/lib/search/search-provider';
import { useSession } from 'next-auth/react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: { id: string; title: string }[]; // Keeping signature compatibility
}

interface RecentSearchItem {
  id: string;
  title: string;
  timestamp: number;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [recentSearches, setRecentSearches] = React.useState<RecentSearchItem[]>([]);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  // Load recent searches from localStorage on dialog open
  React.useEffect(() => {
    if (open) {
      Promise.resolve().then(() => {
        setQuery('');
        setDebouncedQuery('');
        setResults([]);

        const saved = localStorage.getItem('recent_searches');
        if (saved) {
          setRecentSearches(JSON.parse(saved) as RecentSearchItem[]);
        } else {
          setRecentSearches([]);
        }
      });
    }
  }, [open]);

  // Debouncing logic: delay search requests by 250ms
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => clearTimeout(handler);
  }, [query]);

  // Perform search fetch when debounced query changes
  React.useEffect(() => {
    if (!debouncedQuery.trim()) {
      Promise.resolve().then(() => {
        setResults([]);
        setIsLoading(false);
      });
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/documents/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (res.ok) {
          const data = (await res.json()) as SearchResult[];
          setResults(data);
        }
      } catch (err: unknown) {
        console.error('[SearchPalette] Failed to query documents:', (err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  const handleSelect = (docId: string, docTitle: string, matchedSnippet?: string) => {
    // Add selected item to recent searches history asynchronously to avoid impure render loop warnings
    setTimeout(() => {
      const saved = localStorage.getItem('recent_searches');
      const recent = saved ? (JSON.parse(saved) as RecentSearchItem[]) : [];
      const updated = [
        { id: docId, title: docTitle, timestamp: Date.now() },
        ...recent.filter((item: RecentSearchItem) => item.id !== docId),
      ].slice(0, 5);
      localStorage.setItem('recent_searches', JSON.stringify(updated));
    }, 0);

    onOpenChange(false);

    // Extract highlight term: either raw query, or text between mark tags
    let highlightTerm = debouncedQuery.trim();
    if (matchedSnippet && matchedSnippet.includes('<mark>')) {
      const match = matchedSnippet.match(/<mark>(.*?)<\/mark>/);
      if (match && match[1]) {
        highlightTerm = match[1];
      }
    }

    const highlightParam = highlightTerm ? `?highlight=${encodeURIComponent(highlightTerm)}` : '';
    router.push(`/documents/${docId}${highlightParam}`);
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    localStorage.removeItem('recent_searches');
    setRecentSearches([]);
  };

  const clearQuery = () => {
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/80 max-w-2xl overflow-hidden border p-0 shadow-2xl">
        <Command
          shouldFilter={false}
          className="bg-background flex h-full w-full flex-col overflow-hidden rounded-xl"
        >
          {/* Custom Search Input Header with clear button and loader */}
          <div
            className="border-border relative flex items-center border-b px-3"
            data-slot="command-input-wrapper"
          >
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents by content, title, tags, tables..."
              className="placeholder:text-muted-foreground flex h-11 w-full rounded-md bg-transparent py-3 pr-8 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
            <div className="absolute right-3 flex items-center gap-1.5">
              {isLoading && <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />}
              {query && (
                <button
                  onClick={clearQuery}
                  className="hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <CommandList className="max-h-[380px] overflow-y-auto p-2">
            {/* Empty State suggestions */}
            {!isLoading && results.length === 0 && query.trim() !== '' && (
              <div className="py-12 text-center">
                <CommandEmpty className="text-muted-foreground text-sm font-semibold">
                  No results found.
                </CommandEmpty>
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  Try refining your search terms or using keywords.
                </p>
              </div>
            )}

            {/* Loading Skeleton */}
            {isLoading && (
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted/60 h-4 w-4 animate-pulse rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="bg-muted/60 h-3 w-1/3 animate-pulse rounded" />
                    <div className="bg-muted/60 h-2.5 w-3/4 animate-pulse rounded" />
                  </div>
                </div>
                <div className="border-border/30 flex items-center gap-3 border-t pt-3">
                  <div className="bg-muted/60 h-4 w-4 animate-pulse rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="bg-muted/60 h-3 w-1/4 animate-pulse rounded" />
                    <div className="bg-muted/60 h-2.5 w-1/2 animate-pulse rounded" />
                  </div>
                </div>
              </div>
            )}

            {/* Search Results */}
            {!isLoading && results.length > 0 && (
              <CommandGroup heading={`Search Results (${results.length})`}>
                <div className="space-y-1.5">
                  {results.map((doc) => {
                    const isOwner = session?.user?.email === doc.ownerEmail;
                    const scopeLabel = isOwner ? 'Private' : 'Shared';

                    return (
                      <CommandItem
                        key={doc.id}
                        value={doc.id}
                        onSelect={() => handleSelect(doc.id, doc.title, doc.snippet)}
                        className="hover:border-border hover:bg-muted/30 flex cursor-pointer flex-col items-start gap-1 rounded-xl border border-transparent p-3 transition-all duration-75"
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="text-primary h-4 w-4 shrink-0" />
                            <span className="text-foreground text-sm font-semibold">
                              {doc.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.department && (
                              <span className="text-muted-foreground bg-muted/60 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
                                <Briefcase className="h-2.5 w-2.5" />
                                {doc.department}
                              </span>
                            )}
                            <span className="text-muted-foreground/60 bg-border/40 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                              {scopeLabel}
                            </span>
                          </div>
                        </div>

                        {/* Snippet Matching */}
                        {doc.snippet && (
                          <div className="w-full pr-2 pl-6">
                            <div className="text-muted-foreground/45 mb-0.5 text-[9px] font-bold tracking-wide uppercase">
                              Matches {doc.matchField}
                            </div>
                            <div
                              className="text-muted-foreground [&_mark]:bg-primary/20 [&_mark]:text-primary text-xs leading-relaxed font-medium break-words [&_mark]:rounded-xs [&_mark]:px-0.5 [&_mark]:font-semibold"
                              dangerouslySetInnerHTML={{ __html: doc.snippet }}
                            />
                          </div>
                        )}

                        {/* Metadata Row */}
                        <div className="text-muted-foreground/70 mt-1.5 flex w-full items-center justify-between pl-6 text-[10px] font-medium">
                          <div className="flex items-center gap-1.5">
                            <span>
                              Owner:{' '}
                              <strong className="text-foreground/80 font-bold">
                                {doc.ownerName}
                              </strong>
                            </span>
                            {doc.tags && doc.tags.length > 0 && (
                              <>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="flex items-center gap-1">
                                  <Tag className="h-2.5 w-2.5" />
                                  {doc.tags.slice(0, 3).join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                          <span>Updated {new Date(doc.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </div>
              </CommandGroup>
            )}

            {/* Recent Searches */}
            {!isLoading && query.trim() === '' && (
              <>
                {recentSearches.length > 0 ? (
                  <CommandGroup
                    heading={
                      <div className="flex w-full items-center justify-between pr-1">
                        <span>Recent Searches</span>
                        <button
                          onClick={clearRecentSearches}
                          className="hover:bg-muted flex cursor-pointer items-center gap-1 rounded p-1 text-[9px] font-bold text-red-500 uppercase hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" /> Clear History
                        </button>
                      </div>
                    }
                  >
                    <div className="mt-1 space-y-0.5">
                      {recentSearches.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={item.id}
                          onSelect={() => handleSelect(item.id, item.title)}
                          className="hover:bg-muted/40 flex cursor-pointer items-center justify-between rounded-lg p-2"
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="text-muted-foreground/60 h-3.5 w-3.5 shrink-0" />
                            <span className="text-foreground text-xs font-medium">
                              {item.title}
                            </span>
                          </div>
                          <span className="text-muted-foreground/40 font-mono text-[10px]">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                        </CommandItem>
                      ))}
                    </div>
                  </CommandGroup>
                ) : (
                  <div className="text-muted-foreground/50 py-8 text-center text-xs font-medium italic">
                    No recent searches. Type to search document tags, content, or titles.
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
