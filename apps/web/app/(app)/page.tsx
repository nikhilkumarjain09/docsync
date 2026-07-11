'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreateDocumentDialog } from '@/components/shell/create-document-dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface DocumentItem {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  // Memoized stats
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

  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated' || !session) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-5xl space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
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

  return (
    <div className="from-background to-muted/10 h-full overflow-y-auto bg-linear-to-b p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header with greeting */}
        <div className="space-y-1">
          <h1 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-3xl font-extrabold tracking-tight md:text-4xl">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Welcome back to your local-first collaborative space. Let&apos;s build something great.
          </p>
        </div>

        {/* Stats Overview Cards */}
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

        {/* Quick Actions Banner */}
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
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
              <Clock className="h-4 w-4" />
              <span>All Documents</span>
            </h3>
            <div className="flex items-center gap-3">
              {documents.length > 0 && (
                <span className="text-muted-foreground text-xs font-medium">
                  {documents.length} document{documents.length === 1 ? '' : 's'}
                </span>
              )}
              {/* Grid / List Toggle */}
              <div className="border-border bg-muted/30 flex items-center gap-0.5 rounded-lg border p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`cursor-pointer rounded-md p-1.5 transition-all ${
                    viewMode === 'grid'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`cursor-pointer rounded-md p-1.5 transition-all ${
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {loadingDocs ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            )
          ) : documents.length === 0 ? (
            <div className="border-border bg-card/50 space-y-4 rounded-3xl border border-dashed p-12 text-center">
              <div className="bg-muted text-muted-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
                <Compass className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground font-semibold">No documents found</p>
                <p className="text-muted-foreground text-xs">
                  Get started by creating your very first local-first collaborative document.
                </p>
              </div>
              <Button
                onClick={() => setCreateOpen(true)}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Create Document
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <Link key={doc.id} href={`/documents/${doc.id}`} className="group block">
                  <div className="border-border bg-card hover:border-primary/20 hover:bg-muted/10 h-full rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                    <div className="flex h-full flex-col items-start justify-between gap-3">
                      <div className="w-full space-y-2">
                        <div className="flex items-start gap-2">
                          <FileText className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                          <h4 className="group-hover:text-primary text-sm leading-snug font-bold break-words transition-colors">
                            {doc.title}
                          </h4>
                        </div>
                        <p className="text-muted-foreground/60 pl-6 text-[10px] font-medium">
                          Created {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-muted-foreground border-border/40 flex w-full items-center justify-between border-t pt-3 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{getRelativeTime(doc.updatedAt)}</span>
                        </div>
                        <span className="bg-muted/60 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase">
                          {doc.ownerId === session.user.id ? 'Owned' : 'Shared'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-xs">
              {documents.map((doc, i) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className={`group hover:bg-muted/30 flex items-center justify-between px-5 py-3.5 transition-colors ${
                    i !== documents.length - 1 ? 'border-border/50 border-b' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="text-primary h-4 w-4 shrink-0" />
                    <div>
                      <p className="group-hover:text-primary text-sm font-semibold transition-colors">
                        {doc.title}
                      </p>
                      <p className="text-muted-foreground/60 text-[10px] font-medium">
                        Created {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="bg-muted/60 text-muted-foreground rounded px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase">
                      {doc.ownerId === session.user.id ? 'Owned' : 'Shared'}
                    </span>
                    <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{getRelativeTime(doc.updatedAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateDocumentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
