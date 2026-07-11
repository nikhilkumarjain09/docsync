'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Clock,
  Compass,
  LayoutGrid,
  List,
  FileText,
  TrendingUp,
  Users,
  Star,
  Search,
  MoreHorizontal,
  Trash2,
  Copy,
  Share2,
  ExternalLink,
  Pencil,
  Filter,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreateDocumentDialog } from '@/components/shell/create-document-dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface DocumentCollaborator {
  userId: string;
  role: string;
}

interface DocumentItem {
  id: string;
  title: string;
  ownerId: string;
  content: string | null;
  headings: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { name: string | null; email: string | null };
  collaborators: DocumentCollaborator[];
}

interface ContextMenuState {
  x: number;
  y: number;
  docId: string;
  docTitle: string;
}

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [notification, setNotification] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'owned' | 'shared' | 'today'>('all');
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch {
      // Ignore error
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      Promise.resolve().then(() => {
        fetchDocuments();
      });
    }
  }, [sessionStatus, fetchDocuments]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  // Close context menu on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  }, []);

  const stats = useMemo(() => {
    const ownedDocs = documents.filter((d) => d.ownerId === session?.user?.id);
    const sharedDocs = documents.filter((d) => d.ownerId !== session?.user?.id);
    const today = new Date();
    const todayDocs = documents.filter(
      (d) => new Date(d.updatedAt).toDateString() === today.toDateString(),
    );
    return {
      total: documents.length,
      owned: ownedDocs.length,
      shared: sharedDocs.length,
      todayActive: todayDocs.length,
    };
  }, [documents, session?.user?.id]);

  const filteredDocuments = useMemo(() => {
    const userId = session?.user?.id;
    const today = new Date();
    switch (activeFilter) {
      case 'owned':
        return documents.filter((d) => d.ownerId === userId);
      case 'shared':
        return documents.filter((d) => d.ownerId !== userId);
      case 'today':
        return documents.filter(
          (d) => new Date(d.updatedAt).toDateString() === today.toDateString(),
        );
      default:
        return documents;
    }
  }, [documents, activeFilter, session?.user?.id]);

  // ── Actions ──────────────────────────────────────────────
  const handleDuplicate = async (docId: string) => {
    setContextMenu(null);
    try {
      const res = await fetch(`/api/documents/${docId}/duplicate`, { method: 'POST' });
      if (res.ok) {
        showNotification('Document duplicated successfully');
        fetchDocuments();
      } else {
        showNotification('Failed to duplicate document');
      }
    } catch {
      showNotification('Failed to duplicate document');
    }
  };

  const handleTrash = async (docId: string) => {
    setContextMenu(null);
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedAt: new Date().toISOString() }),
      });
      if (res.ok) {
        showNotification('Document moved to trash');
        fetchDocuments();
      } else {
        showNotification('Failed to trash document');
      }
    } catch {
      showNotification('Failed to trash document');
    }
  };

  const handleFavorite = async (docId: string) => {
    setContextMenu(null);
    try {
      await fetch(`/api/documents/${docId}/favorite`, { method: 'POST' });
      showNotification('Added to favorites');
    } catch {
      showNotification('Failed to add to favorites');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, doc: DocumentItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, docId: doc.id, docTitle: doc.title });
  };

  // ── Helpers ──────────────────────────────────────────────
  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated' || !session) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-5xl space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = session.user.name || session.user.email?.split('@')[0] || 'User';

  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getContentPreview = (doc: DocumentItem) => {
    const text = doc.content || doc.headings || '';
    if (!text) return 'Empty document';
    return text.length > 120 ? text.substring(0, 120) + '…' : text;
  };

  return (
    <div className="from-background to-muted/10 h-full overflow-y-auto bg-linear-to-b p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-3xl font-extrabold tracking-tight md:text-4xl">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Welcome back to your local-first collaborative space. Let&apos;s build something great.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border-border bg-card rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 rounded-lg p-2">
                <FileText className="text-primary h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Total Docs
                </p>
              </div>
            </div>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Star className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.owned}</p>
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Owned
                </p>
              </div>
            </div>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.shared}</p>
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Shared
                </p>
              </div>
            </div>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.todayActive}</p>
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Active Today
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-border bg-card relative overflow-hidden rounded-3xl border p-6 shadow-md md:p-8">
          <div className="from-primary/10 absolute top-0 right-0 -z-10 h-48 w-48 rounded-full bg-gradient-to-bl to-violet-500/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 -z-10 h-32 w-32 rounded-full bg-gradient-to-tr from-emerald-500/8 to-sky-500/8 blur-2xl" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl space-y-2">
              <h2 className="text-xl font-bold tracking-tight">Quick Actions</h2>
              <p className="text-muted-foreground text-xs leading-relaxed md:text-sm">
                Start a fresh document, search across all your content, or jump into a recent
                workspace.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setCreateOpen(true)} className="gap-2 font-semibold shadow-sm">
                <Plus className="h-4 w-4" /> New Document
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const event = new KeyboardEvent('keydown', {
                    key: 'k',
                    ctrlKey: true,
                    bubbles: true,
                  });
                  document.dispatchEvent(event);
                }}
                className="gap-2 font-semibold"
              >
                <Search className="h-4 w-4" /> Search
              </Button>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
              <Clock className="h-4 w-4" />
              <span>All Documents</span>
            </h3>
            <div className="flex items-center gap-3">
              {filteredDocuments.length > 0 && (
                <span className="text-muted-foreground text-xs font-medium">
                  {filteredDocuments.length} document{filteredDocuments.length === 1 ? '' : 's'}
                </span>
              )}
              <div className="border-border bg-muted/30 flex items-center gap-0.5 rounded-lg border p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`cursor-pointer rounded-md p-1.5 transition-all ${viewMode === 'grid' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`cursor-pointer rounded-md p-1.5 transition-all ${viewMode === 'list' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="text-muted-foreground h-3.5 w-3.5" />
            {[
              { key: 'all' as const, label: 'All', icon: FileText },
              { key: 'owned' as const, label: 'Owned by me', icon: Star },
              { key: 'shared' as const, label: 'Shared with me', icon: Users },
              { key: 'today' as const, label: 'Active today', icon: TrendingUp },
            ].map((chip) => (
              <button
                key={chip.key}
                onClick={() => setActiveFilter(activeFilter === chip.key ? 'all' : chip.key)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  activeFilter === chip.key
                    ? 'border-primary/40 bg-primary/10 text-primary shadow-xs'
                    : 'border-border bg-background text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <chip.icon className="h-3 w-3" />
                {chip.label}
                {activeFilter === chip.key && chip.key !== 'all' && (
                  <X className="h-3 w-3 opacity-60" />
                )}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loadingDocs ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-44" />
                <Skeleton className="h-44" />
                <Skeleton className="h-44" />
              </div>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            )
          ) : filteredDocuments.length === 0 ? (
            <div className="border-border bg-card/50 space-y-4 rounded-3xl border border-dashed p-12 text-center">
              <div className="bg-muted text-muted-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
                <Compass className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground font-semibold">
                  {documents.length === 0 ? 'No documents found' : 'No matching documents'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {documents.length === 0
                    ? 'Get started by creating your very first local-first collaborative document.'
                    : "Try adjusting your filters to find what you're looking for."}
                </p>
              </div>
              {documents.length === 0 ? (
                <Button
                  onClick={() => setCreateOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Document
                </Button>
              ) : (
                <Button
                  onClick={() => setActiveFilter('all')}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Clear Filter
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ─── GRID VIEW ─── */
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  onContextMenu={(e) => handleContextMenu(e, doc)}
                  className="group relative"
                >
                  <Link href={`/documents/${doc.id}`} className="block">
                    <div className="border-border bg-card hover:border-primary/20 hover:bg-muted/10 h-full rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                      <div className="flex h-full flex-col gap-3">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <FileText className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                            <h4 className="group-hover:text-primary text-sm leading-snug font-bold break-words transition-colors">
                              {doc.title}
                            </h4>
                          </div>
                          <span className="bg-muted/60 text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase">
                            {doc.ownerId === session.user.id ? 'Owned' : 'Shared'}
                          </span>
                        </div>

                        {/* Content preview */}
                        <div className="bg-muted/30 border-border/40 flex-1 rounded-lg border px-3 py-2">
                          <p className="text-muted-foreground line-clamp-3 text-[11px] leading-relaxed">
                            {getContentPreview(doc)}
                          </p>
                        </div>

                        {/* Footer */}
                        <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{getRelativeTime(doc.updatedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3 w-3 shrink-0" />
                            <span>{doc.collaborators.length}</span>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="max-w-[80px] truncate">
                              {doc.owner.name || doc.owner.email}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Hover action buttons */}
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFavorite(doc.id);
                      }}
                      className="bg-background/80 hover:bg-muted border-border cursor-pointer rounded-md border p-1.5 backdrop-blur-xs transition-colors"
                      title="Add to favorites"
                    >
                      <Star className="h-3 w-3 text-amber-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDuplicate(doc.id);
                      }}
                      className="bg-background/80 hover:bg-muted border-border cursor-pointer rounded-md border p-1.5 backdrop-blur-xs transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="text-muted-foreground h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleContextMenu(e, doc);
                      }}
                      className="bg-background/80 hover:bg-muted border-border cursor-pointer rounded-md border p-1.5 backdrop-blur-xs transition-colors"
                      title="More options"
                    >
                      <MoreHorizontal className="text-muted-foreground h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ─── LIST VIEW ─── */
            <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-xs">
              {/* Table header */}
              <div className="border-border/50 bg-muted/30 text-muted-foreground flex items-center border-b px-5 py-2.5 text-[10px] font-bold tracking-wider uppercase">
                <div className="min-w-0 flex-1">Title</div>
                <div className="hidden w-32 shrink-0 sm:block">Owner</div>
                <div className="hidden w-28 shrink-0 md:block">Collaborators</div>
                <div className="w-24 shrink-0 text-right">Updated</div>
                <div className="w-20 shrink-0 text-right">Status</div>
                <div className="w-16 shrink-0 text-right">Actions</div>
              </div>
              {filteredDocuments.map((doc, i) => (
                <div
                  key={doc.id}
                  onContextMenu={(e) => handleContextMenu(e, doc)}
                  className={`group hover:bg-muted/30 flex items-center px-5 py-3 transition-colors ${i !== filteredDocuments.length - 1 ? 'border-border/30 border-b' : ''}`}
                >
                  {/* Title + preview */}
                  <Link
                    href={`/documents/${doc.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <FileText className="text-primary h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                        {doc.title}
                      </p>
                      <p className="text-muted-foreground/50 max-w-xs truncate text-[10px] font-medium">
                        {getContentPreview(doc).substring(0, 60)}
                      </p>
                    </div>
                  </Link>

                  {/* Owner */}
                  <div className="hidden w-32 shrink-0 sm:block">
                    <p className="text-muted-foreground truncate text-xs">
                      {doc.owner.name || doc.owner.email || '—'}
                    </p>
                  </div>

                  {/* Collaborators count */}
                  <div className="hidden w-28 shrink-0 md:block">
                    <div className="flex items-center gap-1.5">
                      <Users className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground text-xs">
                        {doc.collaborators.length} member{doc.collaborators.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {/* Updated */}
                  <div className="w-24 shrink-0 text-right">
                    <span className="text-muted-foreground text-[10px] font-medium">
                      {getRelativeTime(doc.updatedAt)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="w-20 shrink-0 text-right">
                    <span className="bg-muted/60 text-muted-foreground rounded px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase">
                      {doc.ownerId === session.user.id ? 'Owned' : 'Shared'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex w-16 shrink-0 items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFavorite(doc.id);
                      }}
                      className="hover:bg-muted cursor-pointer rounded-md p-1.5 transition-colors"
                      title="Add to favorites"
                    >
                      <Star className="h-3 w-3 text-amber-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContextMenu(e, doc);
                      }}
                      className="hover:bg-muted cursor-pointer rounded-md p-1.5 transition-colors"
                      title="More options"
                    >
                      <MoreHorizontal className="text-muted-foreground h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="border-border bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 fixed z-[100] w-52 overflow-hidden rounded-xl border p-1 shadow-xl"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-xs font-bold">{contextMenu.docTitle}</p>
          </div>
          <div className="bg-border my-1 h-px" />
          <button
            onClick={() => {
              router.push(`/documents/${contextMenu.docId}`);
              setContextMenu(null);
            }}
            className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open Document
          </button>
          <button
            onClick={() => {
              window.open(`/documents/${contextMenu.docId}`, '_blank');
              setContextMenu(null);
            }}
            className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
          </button>
          <div className="bg-border my-1 h-px" />
          <button
            onClick={() => handleFavorite(contextMenu.docId)}
            className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
          >
            <Star className="h-3.5 w-3.5 text-amber-500" /> Add to Favorites
          </button>
          <button
            onClick={() => handleDuplicate(contextMenu.docId)}
            className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
          >
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button
            onClick={() => {
              setContextMenu(null);
            }}
            className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          <button
            onClick={() => {
              setContextMenu(null);
            }}
            className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
          <div className="bg-border my-1 h-px" />
          <button
            onClick={() => handleTrash(contextMenu.docId)}
            className="hover:bg-destructive/10 text-destructive flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Move to Trash
          </button>
        </div>
      )}

      <CreateDocumentDialog open={createOpen} onOpenChange={setCreateOpen} />

      {notification && (
        <div className="border-border bg-card/90 text-foreground animate-in fade-in slide-in-from-bottom-4 fixed right-4 bottom-4 z-[110] flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md duration-200">
          <FileText className="text-primary h-4 w-4" />
          <span className="text-xs font-semibold">{notification}</span>
        </div>
      )}
    </div>
  );
}
