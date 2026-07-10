'use client';

import * as React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import {
  FileText,
  Plus,
  Search,
  Star,
  BookOpen,
  Trash2,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Settings,
  LogOut,
  FileCheck,
  Undo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateDocumentDialog } from './create-document-dialog';
import { ShareDialog } from './share-dialog';
import { RenameDialog } from './rename-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { CommandPalette } from './command-palette';
import { SettingsDialog } from './settings-dialog';
import { toast } from 'sonner';

interface DocumentItem {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export function AppSidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Dialog open states
  const [createOpen, setCreateOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [confirmPermDeleteOpen, setConfirmPermDeleteOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsTab, setSettingsTab] = React.useState<'profile' | 'appearance' | 'security' | 'sync'>('profile');

  // Target document for actions
  const [activeDocId, setActiveDocId] = React.useState<string | null>(null);
  const [activeDocTitle, setActiveDocTitle] = React.useState('');

  // Collapsible sections states (persisted in localStorage)
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed');
      return saved
        ? JSON.parse(saved)
        : {
            favorites: false,
            private: false,
            shared: false,
            templates: false,
            trash: true,
          };
    }
    return {
      favorites: false,
      private: false,
      shared: false,
      templates: false,
      trash: true,
    };
  });

  const toggleSection = (section: string) => {
    const next = { ...collapsed, [section]: !collapsed[section] };
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', JSON.stringify(next));
  };

  // Data lists
  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  const [favorites, setFavorites] = React.useState<DocumentItem[]>([]);
  const [trash, setTrash] = React.useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchAllData = React.useCallback(async () => {
    if (!session?.user) return;
    setIsLoading(true);
    try {
      const [docsRes, favsRes, trashRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/documents/favorites'),
        fetch('/api/documents/trash'),
      ]);

      if (docsRes.ok) setDocuments(await docsRes.json());
      if (favsRes.ok) setFavorites(await favsRes.json());
      if (trashRes.ok) setTrash(await trashRes.json());
    } catch {
      toast.error('Failed to load documents list');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  React.useEffect(() => {
    Promise.resolve().then(() => {
      fetchAllData();
    });
  }, [pathname, fetchAllData]);

  // Operations
  const handleRename = async (newTitle: string) => {
    if (!activeDocId) return;
    try {
      const res = await fetch(`/api/documents/${activeDocId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        toast.success('Document renamed');
        fetchAllData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to rename');
      }
    } catch {
      toast.error('Error renaming document');
    }
  };

  const handleDuplicate = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/duplicate`, { method: 'POST' });
      if (res.ok) {
        toast.success('Document duplicated');
        fetchAllData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to duplicate');
      }
    } catch {
      toast.error('Error duplicating document');
    }
  };

  const handleMoveToTrash = async () => {
    if (!activeDocId) return;
    try {
      const res = await fetch(`/api/documents/${activeDocId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Document moved to trash');
        if (pathname === `/documents/${activeDocId}`) {
          router.push('/');
        }
        fetchAllData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to move to trash');
      }
    } catch {
      toast.error('Error moving document to trash');
    }
  };

  const handleRestore = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/restore`, { method: 'POST' });
      if (res.ok) {
        toast.success('Document restored');
        fetchAllData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to restore');
      }
    } catch {
      toast.error('Error restoring document');
    }
  };

  const handlePermanentDelete = async () => {
    if (!activeDocId) return;
    try {
      const res = await fetch(`/api/documents/trash?id=${activeDocId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Document deleted permanently');
        fetchAllData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to permanently delete');
      }
    } catch {
      toast.error('Error deleting document permanently');
    }
  };

  const handleToggleFavorite = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/favorite`, { method: 'POST' });
      if (res.ok) {
        fetchAllData();
      }
    } catch {
      toast.error('Error updating favorites');
    }
  };

  if (!session?.user) return null;
  const userId = session.user.id;

  const privateDocs = documents.filter((doc) => doc.ownerId === userId);
  const sharedDocs = documents.filter((doc) => doc.ownerId !== userId);

  return (
    <div className="border-border bg-sidebar text-sidebar-foreground flex h-full w-64 flex-col border-r select-none">
      {/* Top action and Title */}
      <div className="border-sidebar-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="from-primary flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr to-violet-500 shadow-md">
            <FileCheck className="text-primary-foreground h-4 w-4" />
          </div>
          <span className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-sm font-bold tracking-tight">
            DocSync Workspace
          </span>
        </div>
      </div>

      {/* Persistent create and search actions */}
      <div className="space-y-1 p-3">
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-9 w-full justify-start gap-2 rounded-lg text-xs font-semibold shadow-xs"
        >
          <Plus className="h-4 w-4" /> New Document
        </Button>
        <button
          onClick={() => setSearchOpen(true)}
          className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground border-border/50 bg-background/50 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search or jump to...</span>
          <kbd className="bg-muted text-muted-foreground pointer-events-none rounded border px-1.5 font-mono text-[9px] font-medium select-none">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Main navigation links */}
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-1">
        {/* FAVORITES */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSection('favorites')}
            className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-wider uppercase"
          >
            {collapsed.favorites ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Favorites
          </button>
          {!collapsed.favorites && (
            <div className="space-y-0.5">
              {isLoading ? (
                <SidebarSkeleton />
              ) : favorites.length === 0 ? (
                <div className="text-muted-foreground px-6 py-1 text-[10px] italic">
                  No starred items.
                </div>
              ) : (
                favorites.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    isFavorited={true}
                    onFavorite={() => handleToggleFavorite(doc.id)}
                    onRename={() => {
                      setActiveDocId(doc.id);
                      setActiveDocTitle(doc.title);
                      setRenameOpen(true);
                    }}
                    onDuplicate={() => handleDuplicate(doc.id)}
                    onDelete={() => {
                      setActiveDocId(doc.id);
                      setConfirmDeleteOpen(true);
                    }}
                    onShare={() => {
                      setActiveDocId(doc.id);
                      setShareOpen(true);
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* PRIVATE (OWNED) */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSection('private')}
            className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-wider uppercase"
          >
            {collapsed.private ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Private
          </button>
          {!collapsed.private && (
            <div className="space-y-0.5">
              {isLoading ? (
                <SidebarSkeleton />
              ) : privateDocs.length === 0 ? (
                <div className="text-muted-foreground px-6 py-1 text-[10px] italic">
                  No private documents.
                </div>
              ) : (
                privateDocs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    isFavorited={favorites.some((f) => f.id === doc.id)}
                    onFavorite={() => handleToggleFavorite(doc.id)}
                    onRename={() => {
                      setActiveDocId(doc.id);
                      setActiveDocTitle(doc.title);
                      setRenameOpen(true);
                    }}
                    onDuplicate={() => handleDuplicate(doc.id)}
                    onDelete={() => {
                      setActiveDocId(doc.id);
                      setConfirmDeleteOpen(true);
                    }}
                    onShare={() => {
                      setActiveDocId(doc.id);
                      setShareOpen(true);
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* SHARED WITH ME */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSection('shared')}
            className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-wider uppercase"
          >
            {collapsed.shared ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Shared with me
          </button>
          {!collapsed.shared && (
            <div className="space-y-0.5">
              {isLoading ? (
                <SidebarSkeleton />
              ) : sharedDocs.length === 0 ? (
                <div className="text-muted-foreground px-6 py-1 text-[10px] italic">
                  No shared documents.
                </div>
              ) : (
                sharedDocs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    isFavorited={favorites.some((f) => f.id === doc.id)}
                    onFavorite={() => handleToggleFavorite(doc.id)}
                    onRename={() => {
                      setActiveDocId(doc.id);
                      setActiveDocTitle(doc.title);
                      setRenameOpen(true);
                    }}
                    onDuplicate={() => handleDuplicate(doc.id)}
                    onDelete={() => {
                      setActiveDocId(doc.id);
                      setConfirmDeleteOpen(true);
                    }}
                    onShare={() => {
                      setActiveDocId(doc.id);
                      setShareOpen(true);
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* TEMPLATES */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSection('templates')}
            className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-wider uppercase"
          >
            {collapsed.templates ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Templates
          </button>
          {!collapsed.templates && (
            <div className="space-y-0.5 px-2">
              <button
                onClick={() => setCreateOpen(true)}
                className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-all"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Standard Meeting Notes</span>
              </button>
              <button
                onClick={() => setCreateOpen(true)}
                className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-all"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Standard Project Brief</span>
              </button>
            </div>
          )}
        </div>

        {/* TRASH */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSection('trash')}
            className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-wider uppercase"
          >
            {collapsed.trash ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Trash
          </button>
          {!collapsed.trash && (
            <div className="space-y-0.5">
              {isLoading ? (
                <SidebarSkeleton />
              ) : trash.length === 0 ? (
                <div className="text-muted-foreground px-6 py-1 text-[10px] italic">
                  Trash is empty.
                </div>
              ) : (
                trash.map((doc) => (
                  <div
                    key={doc.id}
                    className="group text-muted-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center justify-between rounded-lg px-2.5 py-1 text-xs transition-all"
                  >
                    <span className="flex max-w-[70%] items-center gap-2 truncate">
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{doc.title}</span>
                    </span>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => handleRestore(doc.id)}
                        title="Restore"
                        className="hover:bg-muted rounded-sm p-1"
                      >
                        <Undo className="text-primary h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          setActiveDocId(doc.id);
                          setConfirmPermDeleteOpen(true);
                        }}
                        title="Delete permanently"
                        className="hover:bg-muted rounded-sm p-1"
                      >
                        <Trash2 className="text-destructive h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* User profile & actions at bottom */}
      <div className="border-sidebar-border bg-sidebar-muted/10 flex flex-col border-t p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div
            onClick={() => {
              setSettingsTab('profile');
              setSettingsOpen(true);
            }}
            className="flex max-w-[75%] cursor-pointer items-center gap-2 rounded-xl p-1 hover:bg-sidebar-accent/50 transition-all active:scale-[0.98]"
            title="View profile details"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {(session.user.name || session.user.email || 'U').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="truncate text-xs">
              <div className="truncate font-bold">{session.user.name || session.user.email}</div>
              <div className="text-muted-foreground truncate text-[10px]">{session.user.email}</div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-7 w-7"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => {
                  setSettingsTab('appearance');
                  setSettingsOpen(true);
                }}
              >
                <Settings className="mr-2 h-3.5 w-3.5" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })} destructive>
                <LogOut className="mr-2 h-3.5 w-3.5" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Footer */}
        <div className="text-muted-foreground/60 border-sidebar-border/50 flex flex-col gap-0.5 border-t pt-2 text-[10px] leading-relaxed font-medium">
          <div>
            Developer: <span className="text-muted-foreground font-semibold">Nikhil Jain</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <a
              href="https://github.com/nikhiljain"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/80 underline hover:text-primary hover:underline-offset-2"
            >
              GitHub
            </a>
            <span className="text-muted-foreground/30">•</span>
            <a
              href="https://linkedin.com/in/nikhiljain"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/80 underline hover:text-primary hover:underline-offset-2"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>

      {/* Modals and Dialogs */}
      <CreateDocumentDialog open={createOpen} onOpenChange={setCreateOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} defaultTab={settingsTab} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} documents={documents} />

      {activeDocId && (
        <>
          <ShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            documentId={activeDocId}
            currentUserRole={
              activeDocId
                ? documents.find((d) => d.id === activeDocId)?.ownerId === userId
                  ? 'OWNER'
                  : 'EDITOR'
                : null
            }
            currentUserId={userId}
          />
          <RenameDialog
            open={renameOpen}
            onOpenChange={setRenameOpen}
            initialTitle={activeDocTitle}
            onSubmit={handleRename}
          />
          <ConfirmDialog
            open={confirmDeleteOpen}
            onOpenChange={setConfirmDeleteOpen}
            title="Move to Trash"
            description="Are you sure you want to move this document to the trash? You can restore it later."
            confirmLabel="Move to Trash"
            onConfirm={handleMoveToTrash}
          />
          <ConfirmDialog
            open={confirmPermDeleteOpen}
            onOpenChange={setConfirmPermDeleteOpen}
            title="Delete Permanently"
            description="This action is permanent and cannot be undone. Are you sure you want to delete this document?"
            confirmLabel="Delete Permanently"
            onConfirm={handlePermanentDelete}
          />
        </>
      )}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-1.5 px-6 py-1">
      <div className="bg-muted/40 h-3 w-3/4 animate-pulse rounded" />
      <div className="bg-muted/40 h-3 w-1/2 animate-pulse rounded" />
    </div>
  );
}

function DocumentRow({
  doc,
  isFavorited,
  onFavorite,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
}: {
  doc: DocumentItem;
  isFavorited: boolean;
  onFavorite: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === `/documents/${doc.id}`;

  return (
    <div
      onClick={() => router.push(`/documents/${doc.id}`)}
      className={`group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-all ${
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
          : 'hover:bg-sidebar-accent/50 text-foreground'
      }`}
    >
      <span className="flex max-w-[70%] items-center gap-2 truncate">
        <FileText
          className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
        />
        <span className="truncate">{doc.title}</span>
      </span>

      <div
        className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFavorite}
          className={`hover:bg-muted rounded-sm p-1 ${isFavorited ? 'text-amber-500' : 'text-muted-foreground'}`}
        >
          <Star className="h-3.5 w-3.5 fill-current" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-sm p-1">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={onShare}>Share</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} destructive>
              Move to Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
