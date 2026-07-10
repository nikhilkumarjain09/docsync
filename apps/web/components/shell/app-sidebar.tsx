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
  ChevronLeft,
  MoreHorizontal,
  Settings,
  LogOut,
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

export function AppSidebar({
  width,
  setWidth,
  isCollapsed,
  setIsCollapsed,
  isResizing,
  setIsResizing,
}: {
  width: number;
  setWidth: (w: number) => void;
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
  isResizing: boolean;
  setIsResizing: (r: boolean) => void;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Resize Handlers
  const startResizing = React.useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, [setIsResizing]);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, [setIsResizing]);

  const resize = React.useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX;
        if (newWidth >= 180 && newWidth <= 450) {
          setWidth(newWidth);
          localStorage.setItem('sidebar_width', String(newWidth));
        }
      }
    },
    [isResizing, setWidth]
  );

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Context Menu State
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    docId: string;
    docTitle: string;
    isFavorite: boolean;
  } | null>(null);

  React.useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('contextmenu', handleCloseMenu);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('contextmenu', handleCloseMenu);
    };
  }, []);

  const handleContextMenu = React.useCallback((e: React.MouseEvent, docId: string, docTitle: string, isFavorite: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Bounds check
    const menuWidth = 160;
    const menuHeight = 220;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    let adjustedX = e.clientX;
    let adjustedY = e.clientY;
    
    if (adjustedX + menuWidth > screenWidth) {
      adjustedX = screenWidth - menuWidth - 8;
    }
    if (adjustedY + menuHeight > screenHeight) {
      adjustedY = screenHeight - menuHeight - 8;
    }
    
    setContextMenu({
      x: adjustedX,
      y: adjustedY,
      docId,
      docTitle,
      isFavorite,
    });
  }, []);

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
  const hasFetchedOnce = React.useRef(false);

  const fetchAllData = React.useCallback(async (silent = false) => {
    if (!session?.user) return;
    // Only show skeleton loading state on the very first fetch
    if (!silent && !hasFetchedOnce.current) {
      setIsLoading(true);
    }
    try {
      const [docsRes, favsRes, trashRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/documents/favorites'),
        fetch('/api/documents/trash'),
      ]);

      if (docsRes.ok) setDocuments(await docsRes.json());
      if (favsRes.ok) setFavorites(await favsRes.json());
      if (trashRes.ok) setTrash(await trashRes.json());
      hasFetchedOnce.current = true;
    } catch {
      toast.error('Failed to load documents list');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Initial fetch only — no pathname dependency to avoid sidebar flicker
  React.useEffect(() => {
    Promise.resolve().then(() => {
      fetchAllData();
    });
  }, [fetchAllData]);

  // Silent background refresh when the user navigates between routes
  React.useEffect(() => {
    if (hasFetchedOnce.current) {
      fetchAllData(true);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div
      style={{
        width: isCollapsed ? 0 : width,
        transition: isResizing ? 'none' : 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      className={`border-border bg-sidebar text-sidebar-foreground flex h-full flex-col border-r select-none relative group/sidebar ${
        isResizing ? 'select-none' : ''
      } ${isCollapsed ? 'border-r-0' : ''} overflow-hidden`}
    >
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={startResizing}
          className="absolute top-0 right-0 z-50 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors group/resize"
        >
          <div className="absolute right-0 top-0 h-full w-[1px] bg-border group-hover/resize:bg-primary/50" />
        </div>
      )}

      {/* Top action and Title */}
      <div className="border-sidebar-border flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="/assets/docsyncIcon.png"
            alt="DocSync"
            className="h-7 w-7 rounded-lg object-contain shadow-md"
          />
          <span className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-sm font-bold tracking-tight">
            DocSync Workspace
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setIsCollapsed(true);
            localStorage.setItem('sidebar_collapsed_state', 'true');
          }}
          className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-md cursor-pointer hover:bg-sidebar-accent"
          title="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
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
                    onContextMenu={(e) => handleContextMenu(e, doc.id, doc.title, true)}
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
                    onContextMenu={(e) => handleContextMenu(e, doc.id, doc.title, favorites.some((f) => f.id === doc.id))}
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
                    onContextMenu={(e) => handleContextMenu(e, doc.id, doc.title, favorites.some((f) => f.id === doc.id))}
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
              href="https://github.com/nikhilkumarjain09"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/80 underline hover:text-primary hover:underline-offset-2 flex items-center gap-1"
            >
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
            <span className="text-muted-foreground/30">•</span>
            <a
              href="https://www.linkedin.com/in/nikhil-kumar-jain-b05909278/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/80 underline hover:text-primary hover:underline-offset-2 flex items-center gap-1"
            >
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
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

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[170px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-md animate-in fade-in-50 zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Document Actions
          </div>
          <div className="my-1 border-t border-border/40" />
          <button
            onClick={() => {
              router.push(`/documents/${contextMenu.docId}`);
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded-lg px-2 py-1.5 text-xs text-left font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors"
          >
            Open Document
          </button>
          <button
            onClick={() => {
              window.open(`/documents/${contextMenu.docId}`, '_blank');
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded-lg px-2 py-1.5 text-xs text-left font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors"
          >
            Open in New Tab
          </button>
          <button
            onClick={() => {
              handleToggleFavorite(contextMenu.docId);
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded-lg px-2 py-1.5 text-xs text-left font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors"
          >
            {contextMenu.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </button>
          <button
            onClick={() => {
              setActiveDocId(contextMenu.docId);
              setActiveDocTitle(contextMenu.docTitle);
              setRenameOpen(true);
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded-lg px-2 py-1.5 text-xs text-left font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors"
          >
            Rename
          </button>
          <button
            onClick={() => {
              handleDuplicate(contextMenu.docId);
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded-lg px-2 py-1.5 text-xs text-left font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors"
          >
            Duplicate
          </button>
          <button
            onClick={() => {
              setActiveDocId(contextMenu.docId);
              setShareOpen(true);
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded-lg px-2 py-1.5 text-xs text-left font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors"
          >
            Share settings
          </button>
          <div className="my-1 border-t border-border/40" />
          <button
            onClick={() => {
              setActiveDocId(contextMenu.docId);
              setConfirmDeleteOpen(true);
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded-lg px-2 py-1.5 text-xs text-left font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors"
          >
            Move to Trash
          </button>
        </div>
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
  onContextMenu,
}: {
  doc: DocumentItem;
  isFavorited: boolean;
  onFavorite: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onShare: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === `/documents/${doc.id}`;

  return (
    <div
      onClick={() => router.push(`/documents/${doc.id}`)}
      onContextMenu={onContextMenu}
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
