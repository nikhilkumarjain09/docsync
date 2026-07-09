'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Search, Share2, LogOut, Clock, Shield, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch documents list on mount or session change
  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchDocuments();
    }
  }, [sessionStatus]);

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (res.ok) {
        const newDoc = await res.json();
        router.push(`/documents/${newDoc.id}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create document');
      }
    } catch (e) {
      console.error(e);
      alert('Network error creating document');
    } finally {
      setIsCreating(false);
      setShowCreateModal(false);
      setNewTitle('');
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-radial from-background to-muted/30">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-sm text-muted-foreground">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated' || !session) {
    router.push('/login');
    return null;
  }

  const userId = session.user.id;
  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ownedDocs = filteredDocs.filter((doc) => doc.ownerId === userId);
  const sharedDocs = filteredDocs.filter((doc) => doc.ownerId !== userId);

  return (
    <main className="flex min-h-screen flex-col bg-radial from-background to-muted/20">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-violet-500 shadow-md shadow-primary/20">
              <FileText className="h-5.5 w-5.5 text-primary-foreground" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                DocSync
              </span>
              <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                Local-First
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-sm font-semibold">{session.user.name || session.user.email}</span>
              <span className="text-xs text-muted-foreground">{session.user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Log Out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 space-y-8">
        
        {/* Intro Hero Box */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-10 shadow-xl">
          <div className="absolute top-0 right-0 h-64 w-64 bg-gradient-to-bl from-primary/10 to-violet-500/10 blur-3xl -z-10 rounded-full" />
          <div className="max-w-2xl space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              Collaborative Rich Editor Workspace
            </h2>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
              Experience seamless, offline-ready document editing. Changes sync instantly via local IndexedDB persistence and low-latency WebSocket relays.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => setShowCreateModal(true)} className="gap-2 shadow-lg shadow-primary/15">
                <Plus className="h-4 w-4" /> Create Document
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Action Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-b border-border/30 pb-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-input bg-background/50 pl-10 pr-4 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            Total Available: {documents.length}
          </div>
        </div>

        {/* Documents Grid / Lists */}
        {loadingDocs ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="font-semibold text-muted-foreground">No documents found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery ? 'Try matching another name.' : 'Get started by creating your first document.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Column 1: Owned by Me */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-primary uppercase">
                <Shield className="h-4 w-4" />
                <span>Owned by me ({ownedDocs.length})</span>
              </div>
              
              <div className="space-y-3">
                {ownedDocs.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} isOwner={true} />
                ))}
                {ownedDocs.length === 0 && (
                  <p className="text-xs text-muted-foreground italic pl-2">No documents owned by you.</p>
                )}
              </div>
            </div>

            {/* Column 2: Shared with Me */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-violet-500 uppercase">
                <Share2 className="h-4 w-4" />
                <span>Shared with me ({sharedDocs.length})</span>
              </div>

              <div className="space-y-3">
                {sharedDocs.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} isOwner={false} />
                ))}
                {sharedDocs.length === 0 && (
                  <p className="text-xs text-muted-foreground italic pl-2">No shared documents found.</p>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Create Modal Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold">New Document</h3>
              <p className="text-xs text-muted-foreground">Specify the title for your new local-first workspace.</p>
            </div>
            
            <form onSubmit={handleCreateDocument} className="space-y-4">
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Q3 Roadmap Proposal"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTitle('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create & Open'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function DocumentCard({ doc, isOwner }: { doc: DocumentItem; isOwner: boolean }) {
  return (
    <Link href={`/documents/${doc.id}`} className="block group">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20 hover:bg-muted/10 duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 max-w-[85%]">
            <h4 className="font-bold leading-snug group-hover:text-primary transition-colors text-base break-words">
              {doc.title}
            </h4>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Updated {new Date(doc.updatedAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1 select-all font-mono">
                ID: {doc.id}
              </span>
            </div>
          </div>
          <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold ${
            isOwner 
              ? 'bg-primary/5 text-primary border-primary/10' 
              : 'bg-violet-500/5 text-violet-500 border-violet-500/10'
          }`}>
            {isOwner ? 'O' : 'S'}
          </div>
        </div>
      </div>
    </Link>
  );
}
