'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Plus, Clock, Compass } from 'lucide-react';
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

  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated' || !session) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

  return (
    <div className="from-background to-muted/10 h-full overflow-y-auto bg-linear-to-b p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-1">
          <h1 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-3xl font-extrabold tracking-tight md:text-4xl">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Welcome back to your local-first collaborative space. Let&apos;s build something great.
          </p>
        </div>

        <div className="border-border bg-card relative overflow-hidden rounded-3xl border p-6 shadow-md md:p-8">
          <div className="from-primary/10 absolute top-0 right-0 -z-10 h-48 w-48 rounded-full bg-gradient-to-bl to-violet-500/10 blur-2xl" />
          <div className="max-w-xl space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Create a new workspace</h2>
            <p className="text-muted-foreground text-xs leading-relaxed md:text-sm">
              Start a fresh document or select one of our outline templates to bootstrap your ideas
              instantly.
            </p>
            <div className="pt-2">
              <Button onClick={() => setCreateOpen(true)} className="gap-2 font-semibold shadow-sm">
                <Plus className="h-4 w-4" /> Create new document
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
              <Clock className="h-4 w-4" />
              <span>Recently Updated</span>
            </h3>
            {documents.length > 0 && (
              <span className="text-muted-foreground text-xs font-medium">
                {documents.length} document{documents.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {loadingDocs ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
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
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {documents.slice(0, 4).map((doc) => (
                <Link key={doc.id} href={`/documents/${doc.id}`} className="group block">
                  <div className="border-border bg-card hover:border-primary/20 hover:bg-muted/10 h-full rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                    <div className="flex h-full flex-col items-start justify-between gap-3">
                      <div className="w-full space-y-1">
                        <h4 className="group-hover:text-primary text-sm leading-snug font-bold break-words transition-colors">
                          {doc.title}
                        </h4>
                      </div>
                      <div className="text-muted-foreground border-border/40 flex w-full items-center gap-1.5 border-t pt-3 text-[10px]">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>Updated {new Date(doc.updatedAt).toLocaleDateString()}</span>
                      </div>
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
