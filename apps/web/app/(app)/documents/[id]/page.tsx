'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { use, useState, useEffect, useRef } from 'react';
import { useYDoc } from '@/hooks/use-ydoc';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Y from 'yjs';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shell/confirm-dialog';
import { CheckpointLabelDialog } from '@/components/shell/checkpoint-label-dialog';
import { ShareDialog } from '@/components/shell/share-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

// Tiptap core & Starter Kit
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';

// Tiptap Notion-Style extensions
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import LinkExtension from '@tiptap/extension-link';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';

// New Tiptap extensions
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';

// Custom toggle and callout blocks
import { ToggleBlock, ToggleHeader, ToggleContent } from '@/lib/editor/toggle-block';
import { CalloutBlock } from '@/lib/editor/callout-block';

// Icons
import {
  ArrowLeft,
  Users,
  History,
  Loader2,
  Share2,
  Trash2,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  Save,
  Menu,
  X,
  CheckSquare,
  ChevronDown,
  Quote,
  AlertCircle,
  Code2,
  Minus,
  Link as LinkIcon,
  Sparkles,
  ChevronRight,
  GripVertical,
  Wand2,
  Search,
  Check,
  Ban,
  Strikethrough,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table as TableIcon,
  Image as ImageIcon,
  FileText,
  Info,
  Lightbulb,
  Smile,
  Star,
  MoreHorizontal,
  Settings,
  LogOut,
  FileCheck,
  Undo,
  Redo,
  Eye,
  Edit,
  Copy,
  Move,
  Archive,
  Download,
  Printer,
  ExternalLink,
  Calendar,
  Paperclip,
  Bookmark,
  Lock,
  Unlock,
  Type,
  Maximize2,
  Globe,
  MessageSquare,
  Files,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Snapshot {
  id: string;
  label: string | null;
  createdAt: string;
  creator: {
    name: string | null;
    email: string | null;
  };
}

interface Collaborator {
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

// User color lookup for Cursor Presence
const colors = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
];
function getUserColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function DocumentPage({ params }: PageProps) {
  const { id: documentId } = use(params);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [sessionStatus, router]);

  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated' || !session) {
    return <DocumentWorkspaceSkeleton message="Entering secure workspace..." />;
  }

  return (
    <EditorWorkspace
      documentId={documentId}
      userId={session.user.id}
      userName={session.user.name || session.user.email}
    />
  );
}

function DocumentWorkspaceSkeleton({ message }: { message: string }) {
  return (
    <div className="from-background to-muted/20 flex h-screen flex-col overflow-hidden bg-radial">
      {/* Skeleton Top Header */}
      <header className="border-border/40 bg-background/80 sticky top-0 z-10 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40 rounded" />
              <div className="flex items-center gap-1.5">
                <div className="bg-muted-foreground/30 h-1.5 w-1.5 animate-pulse rounded-full" />
                <span className="text-muted-foreground animate-pulse text-[10px] font-medium">
                  {message}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </header>

      {/* Skeleton Split Panels */}
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 items-stretch gap-6 overflow-hidden px-6 py-6">
        {/* Editor Main Section */}
        <div className="scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 flex min-h-0 min-w-0 flex-1 scrollbar-thin scrollbar-track-transparent flex-col gap-4 overflow-y-auto pr-1.5 transition-colors">
          {/* Metadata outline */}
          <div className="border-border bg-card space-y-3 rounded-2xl border p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <Skeleton className="h-9 w-full max-w-md rounded-lg" />
          </div>

          {/* Editor Canvas Area outline */}
          <div className="space-y-4 px-4 py-6">
            <Skeleton className="h-8 w-1/3 rounded-lg" />
            <div className="space-y-2.5 pt-4">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-[95%] rounded" />
              <Skeleton className="h-4 w-[92%] rounded" />
              <Skeleton className="h-4 w-[85%] rounded" />
            </div>
            <div className="space-y-2.5 pt-4">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-[97%] rounded" />
              <Skeleton className="h-4 w-[90%] rounded" />
            </div>
          </div>
        </div>

        {/* Right timeline sidebar outline */}
        <div className="border-border bg-card scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 hidden min-h-0 w-80 shrink-0 scrollbar-thin scrollbar-track-transparent flex-col space-y-4 overflow-y-auto rounded-2xl border p-4 pr-1.5 pb-4 shadow-xs transition-colors lg:flex">
          <Skeleton className="mb-4 h-5 w-32 rounded" />
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorWorkspace({
  documentId,
  userId,
  userName,
}: {
  documentId: string;
  userId: string;
  userName: string;
}) {
  const { doc, provider, content, synced, connectionStatus, awareness, broadcastUpdate } =
    useYDoc(documentId);
  const router = useRouter();

  if (!synced || !doc || !content || !awareness || !provider) {
    return <DocumentWorkspaceSkeleton message="Hydrating collaborative document..." />;
  }

  return (
    <EditorWorkspaceContent
      documentId={documentId}
      userId={userId}
      userName={userName}
      doc={doc}
      provider={provider}
      content={content}
      connectionStatus={connectionStatus}
      awareness={awareness}
      broadcastUpdate={broadcastUpdate}
    />
  );
}

function EditorWorkspaceContent({
  documentId,
  userId,
  userName,
  doc,
  provider,
  content,
  connectionStatus,
  awareness,
  broadcastUpdate,
}: {
  documentId: string;
  userId: string;
  userName: string;
  doc: any;
  provider: any;
  content: any;
  connectionStatus: any;
  awareness: any;
  broadcastUpdate: any;
}) {
  const router = useRouter();

  // Capture stable references to prevent crashes during the React unmount render pass
  const stableDocRef = useRef(doc);
  const stableContentRef = useRef(content);
  const stableProviderRef = useRef(provider);
  const stableAwarenessRef = useRef(awareness);

  // eslint-disable-next-line react-hooks/refs
  if (doc) stableDocRef.current = doc;
  // eslint-disable-next-line react-hooks/refs
  if (content) stableContentRef.current = content;
  // eslint-disable-next-line react-hooks/refs
  if (provider) stableProviderRef.current = provider;
  // eslint-disable-next-line react-hooks/refs
  if (awareness) stableAwarenessRef.current = awareness;

  // eslint-disable-next-line react-hooks/refs
  const stableDoc = stableDocRef.current;
  // eslint-disable-next-line react-hooks/refs
  const stableContent = stableContentRef.current;
  // eslint-disable-next-line react-hooks/refs
  const stableProvider = stableProviderRef.current;
  // eslint-disable-next-line react-hooks/refs
  const stableAwareness = stableAwarenessRef.current;

  // Local/UI states
  const [currentUserRole, setCurrentUserRole] = useState<'OWNER' | 'EDITOR' | 'VIEWER' | null>(
    null,
  );
  const [activePeers, setActivePeers] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [previewingSnapshot, setPreviewingSnapshot] = useState<Snapshot | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Custom document appearance & lock configurations
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [isSmallText, setIsSmallText] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [suggestEdits, setSuggestEdits] = useState(false);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Tab panels
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);

  // Document metadata state
  const [docMetadata, setDocMetadata] = useState<{ title: string } | null>(null);

  // Unified overlay states
  const [shareOpen, setShareOpen] = useState(false);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [confirmTrashOpen, setConfirmTrashOpen] = useState(false);
  const [pendingRestoreSnapshot, setPendingRestoreSnapshot] = useState<Snapshot | null>(null);
  const [isAllVersionsOpen, setIsAllVersionsOpen] = useState(false);
  const [versionsSearchQuery, setVersionsSearchQuery] = useState('');

  // Notion Slash Menu state
  const [slashMenu, setSlashMenu] = useState<{
    x: number;
    y: number;
    filterText: string;
    selectionFrom: number;
  } | null>(null);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // Link Dialog states
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // AI Feature States
  const [isAiConfigured, setIsAiConfigured] = useState(true);
  const [aiSummary, setAiSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchResult, setAiSearchResult] = useState<{
    matchedSnapshotId: string | null;
    rationale: string;
  } | null>(null);

  // Writing Assist states
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiAssistInstruction, setAiAssistInstruction] = useState(
    'improve clarity and make it more professional',
  );
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiAssistResult, setAiAssistResult] = useState<{
    originalText: string;
    improvedText: string;
  } | null>(null);
  const [aiAssistError, setAiAssistError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Aria Announcer
  const [ariaLiveAnnouncement, setAriaLiveAnnouncement] = useState('');

  const autoSaveInterval = useRef<any>(null);
  const hasUnsavedChanges = useRef(false);

  // Load document metadata
  const loadDocMetadata = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`);
      if (res.ok) {
        const data = await res.json();
        setDocMetadata(data);
      }
    } catch {
      // Ignore error
    }
  }, [documentId, setDocMetadata]);

  const loadCollaborators = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`);
      if (res.ok) {
        const list = await res.json();
        setActivePeers(list);

        // Find current user's role in this document
        const me = list.find((p: Collaborator) => p.userId === userId);
        if (me) {
          setCurrentUserRole(me.role);
        } else {
          console.warn('[COLLAB DEBUG] me not found in list!');
        }
      } else if (res.status === 403) {
        toast.error('Access denied: You are not registered as a collaborator on this document');
        router.push('/');
      }
    } catch {
      // Ignore error
    }
  }, [documentId, userId, router, setCurrentUserRole]);

  const loadSnapshots = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/snapshots`);
      if (res.ok) {
        const list = await res.json();
        setSnapshots(list);
      }
    } catch {
      // Ignore error
    }
  }, [documentId, setSnapshots]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadCollaborators();
      loadSnapshots();
      loadDocMetadata();
    });
  }, [documentId, loadCollaborators, loadSnapshots, loadDocMetadata]);

  // Announce status changes
  useEffect(() => {
    let announcement = '';
    switch (connectionStatus) {
      case 'synced':
        announcement = 'Document fully synced with collaborators.';
        break;
      case 'syncing':
        announcement = 'Uploading changes...';
        break;
      case 'connecting':
        announcement = 'Attempting connection...';
        break;
      case 'offline':
        announcement = 'Relay disconnected. Edits will sync when connection returns.';
        break;
    }
    Promise.resolve().then(() => {
      setAriaLiveAnnouncement(announcement);
    });
  }, [connectionStatus]);

  // Presence awareness sync
  useEffect(() => {
    if (!stableAwareness) return;

    const handleAwarenessChange = () => {
      const states = Array.from(stableAwareness.getStates().entries()) as Array<
        [number, { user?: { userId: string } }]
      >;
      const otherPeers = states
        .filter(([, state]) => state.user && state.user.userId !== userId)
        .map(([clientId, state]) => ({
          clientId,
          user: state.user,
        }));
      setActivePeers(otherPeers);
    };

    const userColor = getUserColor(userId);
    stableAwareness.setLocalStateField('user', {
      userId,
      name: userName,
      color: userColor,
    });

    stableAwareness.on('change', handleAwarenessChange);
    handleAwarenessChange();

    return () => {
      stableAwareness.off('change', handleAwarenessChange);
    };
  }, [stableAwareness, userId, userName]);

  // ─── Tiptap Editor Core Instantiation ─────────────────────────────────
  /* eslint-disable react-hooks/refs */
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          undoRedo: false, // Collaboration handles undo/redo
          dropcursor: {
            color: 'var(--primary)',
            width: 2,
          },
        }),
        Collaboration.configure({
          document: stableDoc || undefined,
          fragment: stableContent || undefined,
        }),
        CollaborationCursor.configure({
          provider:
            stableProvider && stableAwareness
              ? Object.assign(Object.create(stableProvider), { awareness: stableAwareness })
              : ({ awareness: {}, doc: {} } as unknown as Record<string, unknown>),
          user: {
            name: userName,
            color: getUserColor(userId),
          },
        }),
        Placeholder.configure({
          placeholder: "Type '/' for commands...",
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Highlight.configure({
          multicolor: true,
        }),
        LinkExtension.configure({
          openOnClick: false,
        }),
        GlobalDragHandle.configure({
          dragHandleWidth: 36,
          dragHandleSelector: '#editor-gutter-controls',
        }),
        // Custom Collapsible nodes
        ToggleBlock,
        ToggleHeader,
        ToggleContent,
        // Formatting and layout extensions
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TextStyle,
        Color,
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({
          allowBase64: true,
        }),
        CalloutBlock,
      ],
      editorProps: {
        attributes: {
          class:
            'prose dark:prose-invert focus:outline-none min-h-[480px] w-full max-w-none text-base leading-relaxed',
        },
        // Click handler to toggle collapsed list states
        handleClickOn(view, pos, node, nodePos, event) {
          const target = event.target as HTMLElement;
          if (target.classList.contains('toggle-chevron-indicator')) {
            const transaction = view.state.tr;
            const parentNode = view.state.doc.nodeAt(nodePos);
            if (parentNode && parentNode.type.name === 'toggleBlock') {
              const nextOpen = !parentNode.attrs.open;
              view.dispatch(
                transaction.setNodeMarkup(nodePos, undefined, {
                  ...parentNode.attrs,
                  open: nextOpen,
                }),
              );
              return true;
            }
          }
          return false;
        },
      },
      immediatelyRender: false,
    },
    [doc, provider, content],
  );
  /* eslint-enable react-hooks/refs */

  // Sync edit permissions
  const isViewer = currentUserRole === 'VIEWER';
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isViewer && !isLocked);
  }, [editor, isViewer, isLocked]);

  // Template loader logic
  useEffect(() => {
    if (editor && editor.isEmpty) {
      const template = localStorage.getItem(`doc-template-${documentId}`);
      if (template) {
        localStorage.removeItem(`doc-template-${documentId}`);
        if (template === 'notes') {
          editor
            .chain()
            .focus()
            .insertContent(
              `<h1>Meeting Notes</h1><p>Date: ${new Date().toLocaleDateString()}</p><h2>Attendees</h2><ul><li></li></ul><h2>Agenda</h2><p></p><h2>Discussion</h2><p></p><h2>Action Items</h2><ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"><span></span></label><div></div></li></ul>`,
            )
            .run();
        } else if (template === 'brief') {
          editor
            .chain()
            .focus()
            .insertContent(
              `<h1>Project Brief</h1><h2>Overview</h2><p></p><h2>Goals</h2><ul><li></li></ul><h2>Scope</h2><p></p><h2>Timeline</h2><p></p>`,
            )
            .run();
        }
      }
    }
  }, [editor, documentId]);

  // Hide AI assist option on deselect
  useEffect(() => {
    if (!editor) return;
    const handleSelection = () => {
      const { empty } = editor.state.selection;
      if (empty) {
        setShowAiAssist(false);
        setAiAssistResult(null);
      }
    };
    editor.on('selectionUpdate', handleSelection);
    return () => {
      editor.off('selectionUpdate', handleSelection);
    };
  }, [editor]);

  // Track editor changes for auto-saving
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      hasUnsavedChanges.current = true;
    };
    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  // Google Docs style auto-saving: save versions automatically in background
  useEffect(() => {
    if (isViewer || !editor || !doc) return;

    autoSaveInterval.current = setInterval(
      async () => {
        if (!hasUnsavedChanges.current) return;

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const autoLabel = `Auto-save (${timestamp})`;

        try {
          const stateUpdate = Y.encodeStateAsUpdate(doc);
          let binary = '';
          for (let i = 0; i < stateUpdate.byteLength; i++) {
            binary += String.fromCharCode(stateUpdate[i]);
          }
          const stateBase64 = btoa(binary);

          const res = await fetch(`/api/documents/${documentId}/snapshots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: autoLabel, state: stateBase64 }),
          });

          if (res.ok) {
            hasUnsavedChanges.current = false;
            loadSnapshots();
            console.log(`[Auto-save] Version checkpoint saved successfully: ${autoLabel}`);
          }
        } catch (err) {
          console.error('[Auto-save] Background snapshot creation failed:', err);
        }
      },
      5 * 60 * 1000,
    ); // Check every 5 minutes

    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
    };
  }, [editor, doc, documentId, isViewer, loadSnapshots]);

  // Close slash menu on scroll
  useEffect(() => {
    if (!slashMenu) return;
    const handleScroll = () => setSlashMenu(null);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [slashMenu]);

  // ─── Keyboard Shortcuts Setup ─────────────────────────────────────────
  useEffect(() => {
    if (!editor || isViewer) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Notion style list shortcuts:
      // Cmd/Ctrl+Shift+8 = Bullet list
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '8') {
        e.preventDefault();
        editor.chain().focus().toggleBulletList().run();
      }
      // Cmd/Ctrl+Shift+7 = Numbered list
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '7') {
        e.preventDefault();
        editor.chain().focus().toggleOrderedList().run();
      }
      // Cmd/Ctrl+Shift+9 = Todo checklist
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '9') {
        e.preventDefault();
        editor.chain().focus().toggleTaskList().run();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, isViewer]);

  // ─── Notion Slash Command Selection Handling ──────────────────────────
  const slashItems = React.useMemo(
    () => [
      { name: 'Heading 1', desc: 'Large title header', icon: Heading1, command: 'h1' },
      { name: 'Heading 2', desc: 'Medium section title', icon: Heading2, command: 'h2' },
      { name: 'Heading 3', desc: 'Small subsection title', icon: Heading3, command: 'h3' },
      { name: 'Heading 4', desc: 'Mini header level 4', icon: Heading4, command: 'h4' },
      { name: 'Heading 5', desc: 'Mini header level 5', icon: Heading5, command: 'h5' },
      { name: 'Heading 6', desc: 'Mini header level 6', icon: Heading6, command: 'h6' },
      { name: 'Bulleted List', desc: 'Simple bulleted list', icon: List, command: 'bullet' },
      { name: 'Numbered List', desc: 'Sequential list', icon: ListOrdered, command: 'ordered' },
      {
        name: 'To-do Checklist',
        desc: 'Collapsible task checkboxes',
        icon: CheckSquare,
        command: 'todo',
      },
      {
        name: 'Toggle List',
        desc: 'Collapsible nested content',
        icon: ChevronRight,
        command: 'toggle',
      },
      { name: 'Blockquote', desc: 'Capture a highlighted quote', icon: Quote, command: 'quote' },
      { name: 'Callout Box', desc: 'Highlighted alert box', icon: Lightbulb, command: 'callout' },
      { name: 'Table', desc: 'Insert a 3x3 table', icon: TableIcon, command: 'table' },
      { name: 'Image', desc: 'Embed an abstract illustration', icon: ImageIcon, command: 'image' },
      {
        name: 'File Attachment',
        desc: 'Embed a file download link',
        icon: Paperclip,
        command: 'file',
      },
      {
        name: 'Bookmark Card',
        desc: 'Embed a rich link card',
        icon: Bookmark,
        command: 'bookmark',
      },
      { name: 'Code Block', desc: 'Formatted syntax block', icon: Code2, command: 'codeblock' },
      { name: 'Divider', desc: 'Horizontal separation rule', icon: Minus, command: 'divider' },
    ],
    [],
  );

  // Monitor cursor selection for Slash commands
  useEffect(() => {
    if (!editor || isViewer) return;

    const handleEditorUpdate = () => {
      const { state } = editor;
      const { $from } = state.selection;
      const currentBlock = $from.node($from.depth);
      const text = currentBlock.textContent;

      // Only open menu if line starts with '/'
      if (text.startsWith('/')) {
        const query = text.slice(1).toLowerCase();
        try {
          const coords = editor.view.coordsAtPos($from.pos);
          const spaceBelow = window.innerHeight - coords.bottom;
          const openAbove = spaceBelow < 280; // Estimated height of the command dropdown

          setSlashMenu({
            x: coords.left,
            y: openAbove ? coords.top - 280 - 8 : coords.top + 24, // Open above or below depending on vertical space
            filterText: query,
            selectionFrom: $from.start(),
          });
          setSlashSelectedIndex(0);
        } catch {
          setSlashMenu(null);
        }
      } else {
        setSlashMenu(null);
      }
    };

    editor.on('selectionUpdate', handleEditorUpdate);
    editor.on('update', handleEditorUpdate);

    return () => {
      editor.off('selectionUpdate', handleEditorUpdate);
      editor.off('update', handleEditorUpdate);
    };
  }, [editor, isViewer]);

  const executeSlashCommand = React.useCallback(
    (cmd: string) => {
      if (!editor || !slashMenu) return;

      const { selectionFrom } = slashMenu;
      const to = editor.state.selection.$from.pos;

      // First delete the slash query text
      editor.chain().focus().deleteRange({ from: selectionFrom, to }).run();

      // Insert block type
      switch (cmd) {
        case 'h1':
          editor.chain().focus().setNode('heading', { level: 1 }).run();
          break;
        case 'h2':
          editor.chain().focus().setNode('heading', { level: 2 }).run();
          break;
        case 'h3':
          editor.chain().focus().setNode('heading', { level: 3 }).run();
          break;
        case 'h4':
          editor.chain().focus().setNode('heading', { level: 4 }).run();
          break;
        case 'h5':
          editor.chain().focus().setNode('heading', { level: 5 }).run();
          break;
        case 'h6':
          editor.chain().focus().setNode('heading', { level: 6 }).run();
          break;
        case 'bullet':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'ordered':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'todo':
          editor.chain().focus().toggleTaskList().run();
          break;
        case 'toggle':
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'toggleBlock',
              attrs: { open: true },
              content: [
                {
                  type: 'toggleHeader',
                  content: [{ type: 'text', text: 'Toggle block title' }],
                },
                {
                  type: 'toggleContent',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Nested contents go here...' }],
                    },
                  ],
                },
              ],
            })
            .run();
          break;
        case 'quote':
          editor.chain().focus().toggleBlockquote().run();
          break;
        case 'callout':
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'calloutBlock',
              attrs: { emoji: '💡', color: 'default' },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Callout text here...' }],
                },
              ],
            })
            .run();
          break;
        case 'table':
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          break;
        case 'image':
          editor
            .chain()
            .focus()
            .setImage({
              src: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
            })
            .run();
          break;
        case 'file':
          editor
            .chain()
            .focus()
            .insertContent(
              `
          <p class="file-attachment border border-border p-3 rounded-lg flex items-center gap-2 bg-muted/20 my-2 select-none" contenteditable="false">
            <svg class="h-4 w-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span class="font-semibold text-xs text-foreground truncate">attachment.pdf</span>
            <span class="text-[10px] text-muted-foreground shrink-0">(2.4 MB)</span>
          </p>
        `,
            )
            .run();
          break;
        case 'bookmark':
          editor
            .chain()
            .focus()
            .insertContent(
              `
          <p class="bookmark-block border border-border p-3 rounded-lg flex items-center gap-3 bg-muted/10 my-2 cursor-pointer hover:bg-muted/20 transition-colors" contenteditable="false">
            <span class="flex-1 space-y-0.5 min-w-0">
              <span class="font-bold text-xs block text-foreground truncate">DocSync</span>
              <span class="text-[10px] text-muted-foreground block truncate">A collaborative local-first real-time workspace.</span>
            </span>
            <span class="text-[10px] font-mono text-primary select-all shrink-0">https://docsync.dev</span>
          </p>
        `,
            )
            .run();
          break;
        case 'codeblock':
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case 'divider':
          editor.chain().focus().setHorizontalRule().run();
          break;
      }

      setSlashMenu(null);
    },
    [editor, slashMenu, setSlashMenu],
  );

  // Intercept keys when slash menu is open
  useEffect(() => {
    if (!editor || !slashMenu) return;

    const handleSlashMenuKeys = (e: KeyboardEvent) => {
      const filtered = slashItems.filter((item) =>
        item.name.toLowerCase().includes(slashMenu.filterText),
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[slashSelectedIndex]) {
          executeSlashCommand(filtered[slashSelectedIndex].command);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenu(null);
      }
    };

    window.addEventListener('keydown', handleSlashMenuKeys, true);
    return () => window.removeEventListener('keydown', handleSlashMenuKeys, true);
  }, [editor, slashMenu, slashSelectedIndex, executeSlashCommand, slashItems]);

  const filteredSlashItems = slashMenu
    ? slashItems.filter((item) => item.name.toLowerCase().includes(slashMenu.filterText))
    : [];

  // Gutter reordering triggers
  const handleGutterPlus = () => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type: 'paragraph' }).run();
    editor.chain().insertContent('/').run();
  };

  // ─── AI Feature: Document Summarization ──────────────────────────────
  const handleAiSummarize = async () => {
    if (!editor) return;
    setIsSummarizing(true);
    setAiSummary('');

    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editor.getText(),
          documentId,
        }),
      });

      if (response.status === 503) {
        setIsAiConfigured(false);
        setAiSummary('AI keys are not configured. Summarization is disabled.');
        return;
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate summary');
      }

      // Stream the response reader
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setAiSummary((prev) => prev + chunk);
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setAiSummary(`Error: ${msg}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // ─── AI Feature: Semantic Version History Search ─────────────────────
  const handleAiVersionSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiSearchQuery.trim()) return;

    setAiSearchLoading(true);
    setAiSearchResult(null);

    try {
      const res = await fetch('/api/ai/version-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: aiSearchQuery.trim(),
          documentId,
        }),
      });

      if (res.status === 503) {
        setIsAiConfigured(false);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setAiSearchResult(data);
      } else {
        toast.error(data.error || 'Failed to search versions');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiSearchLoading(false);
    }
  };

  // ─── AI Feature: Writing Assist (Improve Text) ───────────────────────
  const handleAiWritingAssist = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (!selectedText.trim()) {
      toast.warning('Please select a paragraph or block of text first to improve.');
      return;
    }

    setAiAssistLoading(true);
    setAiAssistResult(null);
    setAiAssistError(null);

    try {
      const res = await fetch('/api/ai/writing-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectedText,
          documentId,
          instruction: aiAssistInstruction,
        }),
      });

      if (res.status === 503) {
        setIsAiConfigured(false);
        setShowAiAssist(false);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setAiAssistResult(data);
      } else {
        setAiAssistError(data.error || 'AI assist request failed');
        toast.error(data.error || 'AI assist request failed');
      }
    } catch (err: any) {
      console.error(err);
      setAiAssistError(err.message || 'An unexpected error occurred');
    } finally {
      setAiAssistLoading(false);
    }
  };

  const handleAcceptAssist = () => {
    if (!editor || !aiAssistResult) return;
    // Replace text as standard ProseMirror edit, so it merges cleanly with other collaborators and is tracked in RLS/history
    editor.chain().focus().insertContent(aiAssistResult.improvedText).run();
    setShowAiAssist(false);
    setAiAssistResult(null);
  };

  // Apply link in Bubble Menu
  const applyLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;

    if (linkUrl.trim()) {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkUrl('');
    setShowLinkInput(false);
  };

  // Snapshot operations
  const executeSaveVersion = async (label: string) => {
    setIsSavingVersion(true);
    try {
      // Capture the client's authoritative Y.Doc state at checkpoint time.
      // Sending this to the server avoids race conditions where the WS relay
      // has already persisted future edits to the DB by the time this POST
      // is processed.
      let stateBase64: string | undefined;
      if (doc) {
        const stateUpdate = Y.encodeStateAsUpdate(doc);
        // Convert Uint8Array to base64
        let binary = '';
        for (let i = 0; i < stateUpdate.byteLength; i++) {
          binary += String.fromCharCode(stateUpdate[i]);
        }
        stateBase64 = btoa(binary);
      }

      const res = await fetch(`/api/documents/${documentId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, state: stateBase64 }),
      });

      if (res.ok) {
        toast.success(`Checkpoint "${label}" saved`);
        loadSnapshots();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create snapshot');
      }
    } catch (e) {
      console.error(e);
      toast.error('Network error creating snapshot');
    } finally {
      setIsSavingVersion(false);
    }
  };

  const handlePreviewSnapshot = async (snapshot: Snapshot) => {
    setPreviewingSnapshot(snapshot);
    setIsPreviewLoading(true);
    setPreviewText('');
    setIsPreviewOpen(true);

    if (typeof window !== 'undefined' && !navigator.onLine) {
      setPreviewText('Offline Mode: Snapshot preview is unavailable while offline.');
      setIsPreviewLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/documents/${documentId}/snapshots/${snapshot.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      const tempDoc = new Y.Doc();
      const stateUpdateBytes = new Uint8Array(
        atob(data.state)
          .split('')
          .map((c) => c.charCodeAt(0)),
      );
      Y.applyUpdate(tempDoc, stateUpdateBytes);

      const xmlFragment = tempDoc.getXmlFragment('default');
      setPreviewText(xmlFragment.toString() || '(Empty document)');
      tempDoc.destroy();
    } catch {
      if (typeof window !== 'undefined' && !navigator.onLine) {
        setPreviewText('Offline Mode: Snapshot preview is unavailable while offline.');
      } else {
        setPreviewText('Failed to render snapshot preview.');
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const executeRestoreSnapshot = async () => {
    if (!pendingRestoreSnapshot) return;
    try {
      const res = await fetch(
        `/api/documents/${documentId}/snapshots/${pendingRestoreSnapshot.id}/restore`,
        {
          method: 'POST',
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Restore failed');
      }

      const { snapshotState: base64State } = await res.json();

      if (doc && editor) {
        // 1. Hydrate target snapshot state into a temporary Y.Doc
        const targetDoc = new Y.Doc();
        const stateBytes = new Uint8Array(
          atob(base64State)
            .split('')
            .map((c) => c.charCodeAt(0)),
        );
        Y.applyUpdate(targetDoc, stateBytes);
        const targetFragment = targetDoc.getXmlFragment('default');

        // 2. Extract plain text from the target snapshot
        const targetXml = targetFragment.toString();
        const targetText = targetXml.replace(/<[^>]*>/g, '');

        // 3. Use TipTap editor to replace content — this correctly propagates
        //    through ProseMirror → Yjs Collaboration binding → Y.Doc
        editor.chain().selectAll().deleteSelection().run();
        if (targetText) {
          editor.chain().focus().insertContent(targetText).run();
        }

        targetDoc.destroy();
      }

      toast.success(`Restored to checkpoint "${pendingRestoreSnapshot.label}"`);
      setPreviewingSnapshot(null);
      loadSnapshots();
    } catch (err) {
      console.error('[Restore] Snapshot restore error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to restore snapshot';
      toast.error(msg);
    } finally {
      setPendingRestoreSnapshot(null);
    }
  };

  const handleSaveVersionTrigger = () => {
    setCheckpointOpen(true);
  };

  const handleRestoreSnapshotTrigger = (snapshot: Snapshot) => {
    setPendingRestoreSnapshot(snapshot);
    setConfirmRestoreOpen(true);
  };

  // Connection State badge style
  const getConnectionPill = () => {
    switch (connectionStatus) {
      case 'synced':
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800 transition-all duration-300 dark:text-emerald-400"
            role="status"
          >
            <Wifi className="h-3.5 w-3.5" /> Synced
          </span>
        );
      case 'syncing':
        return (
          <span
            className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800 transition-all duration-300 dark:text-amber-400"
            role="status"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
          </span>
        );
      case 'connecting':
        return (
          <span
            className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-neutral-500/20 bg-neutral-500/10 px-3 py-1 text-xs font-semibold text-neutral-800 transition-all duration-300 dark:text-neutral-300"
            role="status"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Reconnecting
          </span>
        );
      case 'offline':
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-800 transition-all duration-300 dark:text-red-400"
            role="status"
          >
            <WifiOff className="h-3.5 w-3.5" /> Offline
          </span>
        );
    }
  };

  const toggleBold = () => editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
  const toggleCode = () => editor?.chain().focus().toggleCode().run();
  const toggleUnderline = () => editor?.chain().focus().toggleUnderline().run();
  const toggleStrike = () => editor?.chain().focus().toggleStrike().run();
  const toggleBulletList = () => editor?.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor?.chain().focus().toggleOrderedList().run();
  const toggleTaskList = () => editor?.chain().focus().toggleTaskList().run();
  const clearFormatting = () => editor?.chain().focus().clearNodes().unsetAllMarks().run();
  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/documents/${documentId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Share link copied to clipboard');
  };

  const handleCopyContents = () => {
    if (!editor) return;
    const text = editor.getText();
    navigator.clipboard.writeText(text);
    toast.success('Page contents copied to clipboard');
  };

  const handleDuplicateDocument = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/duplicate`, {
        method: 'POST',
      });
      if (res.ok) {
        const newDoc = await res.json();
        toast.success('Document duplicated successfully');
        router.push(`/documents/${newDoc.id}`);
      } else {
        toast.error('Failed to duplicate document');
      }
    } catch {
      toast.error('Failed to duplicate document');
    }
  };

  const handleMoveToTrash = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Document moved to trash');
        router.push('/');
      } else {
        toast.error('Failed to move document to trash');
      }
    } catch {
      toast.error('Failed to move document to trash');
    }
  };

  const handleTranslate = async (lang: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ') || editor.getText();

    if (!selectedText.trim()) {
      toast.warning('No text found to translate');
      return;
    }

    toast.promise(
      (async () => {
        const res = await fetch('/api/ai/writing-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: selectedText,
            documentId,
            instruction: `Translate the text into fluent ${lang}. Retain formatting as plain paragraphs.`,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Translation failed');
        }
        const data = await res.json();
        editor.chain().focus().insertContent(data.improvedText).run();
      })(),
      {
        loading: `Translating text to ${lang}...`,
        success: `Translated successfully!`,
        error: (err: any) => err.message || `Could not translate text.`,
      },
    );
  };

  const handleExportHTML = () => {
    if (!editor) return;
    const htmlContent = editor.getHTML();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docMetadata?.title || 'document'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Document exported as HTML');
  };

  return (
    <div className="from-background to-muted/20 flex h-screen flex-col overflow-hidden bg-radial">
      {/* Screen Reader connection alerts */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaLiveAnnouncement}
      </div>

      {/* Main Top Header */}
      <header className="border-border/40 bg-background/80 sticky top-0 z-10 shrink-0 border-b py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="group border-border bg-card hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
              aria-label="Go back to Dashboard"
            >
              <ArrowLeft className="text-muted-foreground group-hover:text-foreground h-4 w-4" />
            </Link>

            {/* Minimalist Document Title & Status indicators */}
            <div className="flex items-center gap-2">
              {docMetadata ? (
                <span className="text-foreground max-w-[140px] truncate text-xs font-semibold sm:max-w-[240px]">
                  {docMetadata.title}
                </span>
              ) : (
                <Skeleton className="h-4 w-24 animate-pulse rounded" />
              )}
              <div className="bg-border/60 h-3 w-px" />
              <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                {saveStatus === 'saving' && (
                  <>
                    <Loader2 className="text-primary h-2.5 w-2.5 animate-spin" />
                    <span className="hidden sm:inline">Saving...</span>
                  </>
                )}
                {saveStatus === 'dirty' && (
                  <>
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    <span className="hidden sm:inline">Unsaved</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="hidden sm:inline">Saved</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {getConnectionPill()}
            <button
              data-testid="share-document-btn"
              onClick={() => setShareOpen(true)}
              className="border-border bg-background hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>

            {/* Notion-Style More Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="group border-border bg-background hover:bg-muted flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors"
                  aria-label="More document options"
                >
                  <MoreHorizontal className="text-muted-foreground group-hover:text-foreground h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-border/80 w-64 p-1.5 shadow-lg duration-75"
              >
                {/* Action Search Input */}
                <div className="relative mb-1 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <Search className="text-muted-foreground/60 absolute top-1/2 left-4.5 h-3.5 w-3.5 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search actions..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="border-border/60 bg-muted/40 focus:border-primary/40 focus:bg-background text-foreground placeholder:text-muted-foreground/60 w-full rounded-lg border py-1.5 pr-3 pl-8 text-xs transition-colors outline-none"
                  />
                </div>

                {/* Fonts Picker section - hidden if search matches other stuff */}
                {(!menuSearch ||
                  'style font typography family sans serif mono'.includes(
                    menuSearch.toLowerCase(),
                  )) && (
                  <>
                    <div className="px-2.5 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="text-muted-foreground mb-2 text-[10px] font-bold tracking-wider uppercase">
                        Font style
                      </div>
                      <div className="bg-muted/40 border-border/40 grid grid-cols-3 gap-1 rounded-lg border p-0.5">
                        <button
                          onClick={() => setFontFamily('sans')}
                          className={`flex cursor-pointer flex-col items-center justify-center rounded-md border px-1 py-2.5 text-[10px] font-semibold transition-all ${
                            fontFamily === 'sans'
                              ? 'bg-background border-border text-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground border-transparent'
                          }`}
                        >
                          <span className="mb-1 font-sans text-base leading-none font-bold">
                            Ag
                          </span>
                          <span>Default</span>
                        </button>
                        <button
                          onClick={() => setFontFamily('serif')}
                          className={`flex cursor-pointer flex-col items-center justify-center rounded-md border px-1 py-2.5 text-[10px] font-semibold transition-all ${
                            fontFamily === 'serif'
                              ? 'bg-background border-border text-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground border-transparent'
                          }`}
                        >
                          <span className="mb-1 font-serif text-base leading-none font-bold">
                            Ag
                          </span>
                          <span>Serif</span>
                        </button>
                        <button
                          onClick={() => setFontFamily('mono')}
                          className={`flex cursor-pointer flex-col items-center justify-center rounded-md border px-1 py-2.5 text-[10px] font-semibold transition-all ${
                            fontFamily === 'mono'
                              ? 'bg-background border-border text-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground border-transparent'
                          }`}
                        >
                          <span className="mb-1 font-mono text-base leading-none font-bold">
                            Ag
                          </span>
                          <span>Mono</span>
                        </button>
                      </div>
                    </div>
                    <DropdownMenuSeparator className="my-1.5" />
                  </>
                )}

                {/* Page margins toggles - hidden if search matches other stuff */}
                {(!menuSearch ||
                  'small text wide width lock document edit page'.includes(
                    menuSearch.toLowerCase(),
                  )) && (
                  <>
                    <div className="px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                      {(!menuSearch ||
                        'small text font size typography'.includes(menuSearch.toLowerCase())) && (
                        <div className="hover:bg-muted/40 flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors">
                          <div className="flex items-center gap-2">
                            <Type className="text-muted-foreground h-3.5 w-3.5" />
                            <span className="text-xs">Small text</span>
                          </div>
                          <button
                            onClick={() => setIsSmallText(!isSmallText)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent outline-hidden transition-colors duration-200 ease-in-out focus:outline-none ${
                              isSmallText ? 'bg-primary' : 'bg-muted'
                            }`}
                          >
                            <span
                              className={`bg-background pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out ${
                                isSmallText ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {(!menuSearch ||
                        'wide width full size layout margins'.includes(
                          menuSearch.toLowerCase(),
                        )) && (
                        <div className="hover:bg-muted/40 flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors">
                          <div className="flex items-center gap-2">
                            <Maximize2 className="text-muted-foreground h-3.5 w-3.5" />
                            <span className="text-xs">Full width</span>
                          </div>
                          <button
                            onClick={() => setIsFullWidth(!isFullWidth)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent outline-hidden transition-colors duration-200 ease-in-out focus:outline-none ${
                              isFullWidth ? 'bg-primary' : 'bg-muted'
                            }`}
                          >
                            <span
                              className={`bg-background pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out ${
                                isFullWidth ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {(!menuSearch ||
                        'lock protect document freeze static'.includes(
                          menuSearch.toLowerCase(),
                        )) && (
                        <div className="hover:bg-muted/40 flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors">
                          <div className="flex items-center gap-2">
                            {isLocked ? (
                              <Lock className="text-muted-foreground h-3.5 w-3.5" />
                            ) : (
                              <Unlock className="text-muted-foreground h-3.5 w-3.5" />
                            )}
                            <span className="text-xs">Lock page</span>
                          </div>
                          <button
                            onClick={() => setIsLocked(!isLocked)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent outline-hidden transition-colors duration-200 ease-in-out focus:outline-none ${
                              isLocked ? 'bg-primary' : 'bg-muted'
                            }`}
                          >
                            <span
                              className={`bg-background pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out ${
                                isLocked ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                    <DropdownMenuSeparator className="my-1.5" />
                  </>
                )}

                {/* Actions list filtered dynamically */}
                <div className="space-y-0.5 px-1 py-0.5">
                  {/* AI Writing assistance tools */}
                  {(!menuSearch ||
                    'ai write assistant translation suggest edits summarize'.includes(
                      menuSearch.toLowerCase(),
                    )) && (
                    <>
                      {isAiConfigured && (
                        <DropdownMenuItem
                          onClick={() => {
                            if (!editor) return;
                            const { from, to } = editor.state.selection;
                            const selectedText = editor.state.doc.textBetween(from, to, ' ');
                            if (!selectedText.trim()) {
                              toast.warning('Please highlight a section of text to analyze first.');
                              return;
                            }
                            setAiAssistInstruction(
                              'Summarize this paragraph and suggest core bullet improvements.',
                            );
                            handleAiWritingAssist();
                          }}
                          className="hover:bg-primary/10 text-primary flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Use with AI</span>
                        </DropdownMenuItem>
                      )}

                      <div
                        className="hover:bg-muted/40 flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="text-muted-foreground h-3.5 w-3.5" />
                          <span className="text-xs">Suggest edits</span>
                        </div>
                        <button
                          onClick={() => {
                            setSuggestEdits(!suggestEdits);
                            toast.success(
                              suggestEdits ? 'Suggestions disabled' : 'Suggestions enabled',
                            );
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent outline-hidden transition-colors duration-200 ease-in-out focus:outline-none ${
                            suggestEdits ? 'bg-primary' : 'bg-muted'
                          }`}
                        >
                          <span
                            className={`bg-background pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out ${
                              suggestEdits ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs">
                          <Globe className="text-muted-foreground h-3.5 w-3.5" />
                          <span>Translate</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent className="border-border bg-popover z-50 w-36 rounded-xl border shadow-md">
                            {['Spanish', 'French', 'German', 'Chinese', 'Hindi'].map((lang) => (
                              <DropdownMenuItem
                                key={lang}
                                onClick={() => handleTranslate(lang)}
                                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs"
                              >
                                {lang}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>

                      <DropdownMenuSeparator className="my-1.5" />
                    </>
                  )}

                  {/* Standard options */}
                  {(!menuSearch || 'copy link url share'.includes(menuSearch.toLowerCase())) && (
                    <DropdownMenuItem
                      onClick={handleCopyLink}
                      className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <LinkIcon className="text-muted-foreground h-3.5 w-3.5" />
                        <span>Copy link</span>
                      </div>
                      <kbd className="text-muted-foreground font-mono text-[10px]">Ctrl+Alt+L</kbd>
                    </DropdownMenuItem>
                  )}

                  {(!menuSearch ||
                    'copy page text text contents content doc'.includes(
                      menuSearch.toLowerCase(),
                    )) && (
                    <DropdownMenuItem
                      onClick={handleCopyContents}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <Copy className="text-muted-foreground h-3.5 w-3.5" />
                      <span>Copy page contents</span>
                    </DropdownMenuItem>
                  )}

                  {(!menuSearch ||
                    'duplicate clone document copy'.includes(menuSearch.toLowerCase())) && (
                    <DropdownMenuItem
                      onClick={handleDuplicateDocument}
                      className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Files className="text-muted-foreground h-3.5 w-3.5" />
                        <span>Duplicate</span>
                      </div>
                      <kbd className="text-muted-foreground font-mono text-[10px]">Ctrl+D</kbd>
                    </DropdownMenuItem>
                  )}

                  {(!menuSearch || 'undo backward return'.includes(menuSearch.toLowerCase())) && (
                    <DropdownMenuItem
                      onClick={() => editor?.chain().focus().undo().run()}
                      disabled={!editor?.can().undo()}
                      className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Undo className="text-muted-foreground h-3.5 w-3.5" />
                        <span>Undo</span>
                      </div>
                      <kbd className="text-muted-foreground font-mono text-[10px]">Ctrl+Z</kbd>
                    </DropdownMenuItem>
                  )}

                  {(!menuSearch ||
                    'export download html save'.includes(menuSearch.toLowerCase())) && (
                    <DropdownMenuItem
                      onClick={handleExportHTML}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <Download className="text-muted-foreground h-3.5 w-3.5" />
                      <span>Export as HTML</span>
                    </DropdownMenuItem>
                  )}

                  {(!menuSearch ||
                    'delete trash remove move destroy'.includes(menuSearch.toLowerCase())) && (
                    <>
                      <DropdownMenuSeparator className="my-1.5" />
                      <DropdownMenuItem
                        onClick={() => setConfirmTrashOpen(true)}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Trash2 className="text-destructive h-3.5 w-3.5" />
                          <span>Move to Trash</span>
                        </div>
                        <kbd className="text-destructive/60 font-mono text-[10px]">
                          Ctrl+Shift+T
                        </kbd>
                      </DropdownMenuItem>
                    </>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open document timeline panel"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Split Panels */}
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 items-stretch gap-6 overflow-hidden px-6 py-6">
        {/* Editor Main Section */}
        <div className="scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 flex min-h-0 min-w-0 flex-1 scrollbar-thin scrollbar-track-transparent flex-col gap-4 overflow-y-auto pr-1.5 transition-colors">
          {/* Document metadata card */}
          <div className="border-border bg-card shrink-0 space-y-3 rounded-2xl border p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-primary font-mono text-[10px] font-bold tracking-wider uppercase">
                Live Workspace
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[10px] font-semibold">
                  Access Level:
                </span>
                <span className="bg-muted rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                  {currentUserRole || 'Resolving Role...'}
                </span>
              </div>
            </div>

            {/* Inline premium rename field */}
            {docMetadata ? (
              <input
                type="text"
                value={docMetadata.title}
                onChange={(e) =>
                  setDocMetadata((prev) => (prev ? { ...prev, title: e.target.value } : null))
                }
                onBlur={async () => {
                  if (!docMetadata.title.trim()) return;
                  try {
                    const res = await fetch(`/api/documents/${documentId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: docMetadata.title.trim() }),
                    });
                    if (res.ok) {
                      toast.success('Title saved');
                    } else {
                      toast.error('Failed to update title');
                    }
                  } catch {
                    toast.error('Failed to update title');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                disabled={isViewer}
                className="hover:border-border/30 focus:border-primary/50 w-full rounded border-b border-transparent bg-transparent py-1 text-2xl font-extrabold tracking-tight focus:outline-none"
                placeholder="Untitled Document"
              />
            ) : (
              <div className="py-1">
                <Skeleton className="h-8 w-64 animate-pulse rounded-lg" />
              </div>
            )}
          </div>
          {/* Unconfigured API Key friendly alert banner */}
          {!isAiConfigured && (
            <div className="border-warning/20 bg-warning/5 flex shrink-0 items-center gap-3 rounded-xl border p-4 text-xs">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <span className="font-bold text-amber-800 dark:text-amber-400">
                  AI Integration Notice:
                </span>
                <p className="text-muted-foreground mt-0.5">
                  AI Summarizer, writing assist, and semantic version search are currently disabled
                  because no API keys were found. To enable them, set{' '}
                  <code className="bg-muted rounded px-1 font-mono text-[10px]">GROQ_API_KEY</code>,{' '}
                  <code className="bg-muted rounded px-1 font-mono text-[10px]">
                    NVIDIA_API_KEY
                  </code>
                  , or{' '}
                  <code className="bg-muted rounded px-1 font-mono text-[10px]">
                    GEMINI_API_KEY
                  </code>{' '}
                  in your environment. Core editing and live syncing remain fully functional.
                </p>
              </div>
            </div>
          )}

          {/* Collaborative interactive container */}
          <div
            className={`border-border bg-card relative min-h-[500px] shrink-0 rounded-2xl border p-8 shadow-xl transition-all md:p-12 ${
              fontFamily === 'serif'
                ? 'editor-font-serif'
                : fontFamily === 'mono'
                  ? 'editor-font-mono'
                  : 'editor-font-sans'
            } ${isSmallText ? 'editor-small-text' : ''} ${isFullWidth ? 'editor-full-width' : ''}`}
          >
            <div className="relative h-full w-full">
              {/* Embedded Drag Handle and Plus gutter controls */}
              {!isViewer && editor && (
                <div
                  className="absolute z-20 flex flex-row items-center gap-1"
                  id="editor-gutter-controls"
                >
                  <button
                    onClick={handleGutterPlus}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground pointer-events-auto flex h-5 w-5 items-center justify-center rounded-sm transition-colors"
                    title="Insert paragraph below"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <div className="drag-handle global-drag-handle text-muted-foreground hover:bg-muted hover:text-foreground pointer-events-auto flex h-5 w-5 cursor-grab items-center justify-center rounded-sm active:cursor-grabbing">
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                </div>
              )}

              {/* Notion Bubble Menu */}
              {editor && !isViewer && (
                <BubbleMenu
                  editor={editor}
                  {...({
                    tippyOptions: {
                      duration: 150,
                      onClickOutside(instance: any, event: any) {
                        const target = event.target as HTMLElement;
                        if (
                          target.closest('[data-radix-popper-content-wrapper]') ||
                          target.closest('[role="menu"]') ||
                          target.closest('[role="dialog"]') ||
                          target.closest('.fixed') ||
                          target.closest('#editor-gutter-controls')
                        ) {
                          return;
                        }
                        instance.hide();
                      },
                    },
                  } as any)}
                >
                  <div className="border-border bg-background/98 animate-in zoom-in-95 flex max-w-[90vw] flex-wrap items-center gap-1 rounded-xl border p-1.5 shadow-xl duration-75">
                    {/* AI Writing Assist Button */}
                    {isAiConfigured && (
                      <>
                        <Button
                          variant={showAiAssist ? 'secondary' : 'ghost'}
                          size="icon"
                          onClick={() => {
                            setAiAssistResult(null);
                            setShowAiAssist(!showAiAssist);
                          }}
                          className="text-primary hover:text-primary h-7 w-7 shrink-0"
                          aria-label="AI Writing Assist"
                          title="AI Improve Selection"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                        </Button>
                        <div className="bg-border/60 mx-1 h-4 w-px shrink-0" />
                      </>
                    )}

                    {/* Undo & Redo Actions */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => editor?.chain().focus().undo().run()}
                      disabled={!editor?.can().undo()}
                      className="h-7 w-7 shrink-0"
                      title="Undo (Ctrl+Z)"
                      aria-label="Undo"
                    >
                      <Undo className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => editor?.chain().focus().redo().run()}
                      disabled={!editor?.can().redo()}
                      className="h-7 w-7 shrink-0"
                      title="Redo (Ctrl+Y)"
                      aria-label="Redo"
                    >
                      <Redo className="h-3.5 w-3.5" />
                    </Button>

                    <div className="bg-border/60 mx-1 h-4 w-px shrink-0" />

                    {/* 1. Block Conversion Dropdown */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 gap-1 px-2 text-xs font-semibold"
                          title="Convert block type"
                        >
                          {(() => {
                            if (editor.isActive('heading', { level: 1 })) return 'H1';
                            if (editor.isActive('heading', { level: 2 })) return 'H2';
                            if (editor.isActive('heading', { level: 3 })) return 'H3';
                            if (editor.isActive('heading', { level: 4 })) return 'H4';
                            if (editor.isActive('heading', { level: 5 })) return 'H5';
                            if (editor.isActive('heading', { level: 6 })) return 'H6';
                            if (editor.isActive('bulletList')) return 'Bullet List';
                            if (editor.isActive('orderedList')) return 'Numbered List';
                            if (editor.isActive('taskList')) return 'Todo List';
                            if (editor.isActive('toggleBlock')) return 'Toggle Block';
                            if (editor.isActive('blockquote')) return 'Quote';
                            if (editor.isActive('codeBlock')) return 'Code Block';
                            if (editor.isActive('calloutBlock')) return 'Callout';
                            return 'Text';
                          })()}
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-64 w-44 overflow-y-auto">
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setParagraph().run()}
                        >
                          <FileText className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Text
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        >
                          <Heading1 className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Heading 1
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        >
                          <Heading2 className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Heading 2
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        >
                          <Heading3 className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Heading 3
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                        >
                          <Heading4 className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Heading 4
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
                        >
                          <Heading5 className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Heading 5
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
                        >
                          <Heading6 className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Heading 6
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleBulletList().run()}
                        >
                          <List className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Bullet List
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        >
                          <ListOrdered className="text-muted-foreground mr-2 h-3.5 w-3.5" />{' '}
                          Numbered List
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleTaskList().run()}
                        >
                          <CheckSquare className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Todo
                          List
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        >
                          <Quote className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        >
                          <Code2 className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Code Block
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().toggleCallout().run()}
                        >
                          <Lightbulb className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Callout
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="bg-border/60 mx-1 h-4 w-px shrink-0" />

                    {/* 2. Formatting Style Toggles */}
                    <Button
                      variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={toggleBold}
                      className="h-7 w-7 shrink-0"
                      aria-label="Format Bold"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={toggleItalic}
                      className="h-7 w-7 shrink-0"
                      aria-label="Format Italic"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={toggleUnderline}
                      className="h-7 w-7 shrink-0"
                      aria-label="Format Underline"
                    >
                      <UnderlineIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={toggleStrike}
                      className="h-7 w-7 shrink-0"
                      aria-label="Format Strikethrough"
                    >
                      <Strikethrough className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={editor.isActive('code') ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={toggleCode}
                      className="h-7 w-7 shrink-0"
                      aria-label="Format Code"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearFormatting}
                      className="h-7 w-7 shrink-0"
                      title="Clear Formatting"
                      aria-label="Clear Formatting"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>

                    <div className="bg-border/60 mx-1 h-4 w-px shrink-0" />

                    {/* Direct List Toggles */}
                    <Button
                      variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={toggleBulletList}
                      className="h-7 w-7 shrink-0"
                      title="Bullet List"
                      aria-label="Bullet List"
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={toggleOrderedList}
                      className="h-7 w-7 shrink-0"
                      title="Numbered List"
                      aria-label="Numbered List"
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={editor.isActive('taskList') ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={toggleTaskList}
                      className="h-7 w-7 shrink-0"
                      title="Todo List"
                      aria-label="Todo List"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </Button>

                    <div className="bg-border/60 mx-1 h-4 w-px shrink-0" />

                    {/* 3. Text Alignment Dropdown */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="Text alignment"
                        >
                          {(() => {
                            if (editor.isActive({ textAlign: 'center' }))
                              return <AlignCenter className="h-3.5 w-3.5" />;
                            if (editor.isActive({ textAlign: 'right' }))
                              return <AlignRight className="h-3.5 w-3.5" />;
                            if (editor.isActive({ textAlign: 'justify' }))
                              return <AlignJustify className="h-3.5 w-3.5" />;
                            return <AlignLeft className="h-3.5 w-3.5" />;
                          })()}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-32">
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        >
                          <AlignLeft className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Left
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        >
                          <AlignCenter className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Center
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        >
                          <AlignRight className="text-muted-foreground mr-2 h-3.5 w-3.5" /> Right
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                        >
                          <AlignJustify className="text-muted-foreground mr-2 h-3.5 w-3.5" />{' '}
                          Justify
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* 4. Text Color Dropdown */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="Text Color"
                        >
                          <span className="decoration-primary text-xs font-bold underline decoration-2">
                            A
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-36">
                        <DropdownMenuItem onClick={() => editor.chain().focus().unsetColor().run()}>
                          <div className="border-border bg-foreground h-3 w-3 shrink-0 rounded-full border" />
                          Default
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setColor('#6b7280').run()}
                        >
                          <div className="h-3 w-3 shrink-0 rounded-full bg-gray-500" />
                          Gray
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setColor('#3b82f6').run()}
                        >
                          <div className="h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                          Blue
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setColor('#10b981').run()}
                        >
                          <div className="h-3 w-3 shrink-0 rounded-full bg-emerald-500" />
                          Green
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setColor('#f59e0b').run()}
                        >
                          <div className="h-3 w-3 shrink-0 rounded-full bg-amber-500" />
                          Yellow
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setColor('#ef4444').run()}
                        >
                          <div className="h-3 w-3 shrink-0 rounded-full bg-red-500" />
                          Red
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().setColor('#8b5cf6').run()}
                        >
                          <div className="h-3 w-3 shrink-0 rounded-full bg-violet-500" />
                          Purple
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* 5. Highlight Color Dropdown */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="Highlight Color"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-40">
                        <DropdownMenuItem
                          onClick={() => editor.chain().focus().unsetHighlight().run()}
                        >
                          <span className="text-muted-foreground mr-2 shrink-0 text-[10px] line-through">
                            None
                          </span>
                          Clear Highlight
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()
                          }
                        >
                          <div className="h-3 w-3 shrink-0 rounded border border-yellow-300 bg-yellow-200" />
                          Yellow
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            editor.chain().focus().toggleHighlight({ color: '#bfdbfe' }).run()
                          }
                        >
                          <div className="h-3 w-3 shrink-0 rounded border border-blue-300 bg-blue-200" />
                          Blue
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            editor.chain().focus().toggleHighlight({ color: '#bbf7d0' }).run()
                          }
                        >
                          <div className="h-3 w-3 shrink-0 rounded border border-green-300 bg-green-200" />
                          Green
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            editor.chain().focus().toggleHighlight({ color: '#fbcfe8' }).run()
                          }
                        >
                          <div className="h-3 w-3 shrink-0 rounded border border-pink-300 bg-pink-200" />
                          Pink
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            editor.chain().focus().toggleHighlight({ color: '#fecaca' }).run()
                          }
                        >
                          <div className="h-3 w-3 shrink-0 rounded border border-red-300 bg-red-200" />
                          Red
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            editor.chain().focus().toggleHighlight({ color: '#ddd6fe' }).run()
                          }
                        >
                          <div className="h-3 w-3 shrink-0 rounded border border-violet-300 bg-violet-200" />
                          Purple
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="bg-border/60 mx-1 h-4 w-px shrink-0" />

                    {/* 6. Link Editing */}
                    {showLinkInput ? (
                      <form
                        onSubmit={applyLink}
                        className="animate-in slide-in-from-left-2 flex shrink-0 items-center gap-1.5 px-1.5 duration-100"
                      >
                        <input
                          type="url"
                          placeholder="https://..."
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          className="border-input bg-background focus:border-primary w-28 rounded border px-2 py-0.5 text-xs outline-none"
                          autoFocus
                        />
                        <Button type="submit" size="xs" className="h-6 px-2 text-[10px]">
                          Save
                        </Button>
                        <button
                          type="button"
                          onClick={() => setShowLinkInput(false)}
                          className="text-muted-foreground hover:text-foreground text-[10px]"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <Button
                        variant={editor.isActive('link') ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => {
                          setLinkUrl(editor.getAttributes('link').href || '');
                          setShowLinkInput(true);
                        }}
                        className="h-7 w-7 shrink-0"
                        aria-label="Insert Link"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </BubbleMenu>
              )}

              {/* AI Writing Assist Diff Suggestion Popover */}
              {showAiAssist && (
                <div className="border-border bg-background/98 animate-in fade-in slide-in-from-top-1 absolute top-12 left-1/2 z-30 w-[90vw] max-w-sm -translate-x-1/2 space-y-3 rounded-xl border p-4 shadow-2xl duration-75">
                  <div className="border-border/30 flex items-center justify-between border-b pb-2">
                    <span className="text-primary flex items-center gap-1 text-xs font-bold">
                      <Wand2 className="h-3.5 w-3.5" /> AI Paragraph Assist
                    </span>
                    <button
                      onClick={() => {
                        setShowAiAssist(false);
                        setAiAssistResult(null);
                      }}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {!aiAssistResult ? (
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-[10px]">
                        What changes would you like to make to the selection?
                      </p>
                      <input
                        type="text"
                        placeholder="e.g. make it professional, make it more concise..."
                        value={aiAssistInstruction}
                        onChange={(e) => setAiAssistInstruction(e.target.value)}
                        className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:ring-1"
                      />
                      <Button
                        onClick={handleAiWritingAssist}
                        disabled={aiAssistLoading}
                        size="xs"
                        className="w-full"
                      >
                        {aiAssistLoading ? 'Thinking...' : 'Generate Suggestion'}
                      </Button>
                      {aiAssistError && (
                        <div className="flex items-start gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-[10px] text-red-500">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="leading-tight">{aiAssistError}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid w-full min-w-0 grid-cols-1 gap-2 text-[11px]">
                        <div className="min-w-0 rounded-lg border border-red-500/10 bg-red-500/5 p-2 text-red-800 dark:text-red-400">
                          <span className="block text-[9px] font-bold tracking-wider text-red-600 uppercase">
                            Original text
                          </span>
                          <p className="line-clamp-3 overflow-hidden break-words text-ellipsis">
                            {aiAssistResult.originalText}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-2 text-emerald-800 dark:text-emerald-400">
                          <span className="block text-[9px] font-bold tracking-wider text-emerald-600 uppercase">
                            AI Improved text
                          </span>
                          <p className="line-clamp-3 overflow-hidden break-words text-ellipsis">
                            {aiAssistResult.improvedText}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAcceptAssist}
                          size="xs"
                          className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check className="h-3 w-3" /> Accept & Edit
                        </Button>
                        <Button
                          onClick={() => setAiAssistResult(null)}
                          variant="outline"
                          size="xs"
                          className="flex-1 gap-1"
                        >
                          <Ban className="h-3 w-3" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notion Floating Slash Menu */}
              {slashMenu && filteredSlashItems.length > 0 && (
                <div
                  className="border-border bg-background/98 animate-in zoom-in-95 fixed z-50 w-64 overflow-hidden rounded-xl border p-1.5 shadow-2xl duration-75"
                  style={{ top: `${slashMenu.y}px`, left: `${slashMenu.x}px` }}
                  role="listbox"
                  aria-label="Block creation commands"
                >
                  <div className="text-muted-foreground border-border/20 mb-1 border-b px-2 py-1 text-[10px] font-bold uppercase">
                    Commands
                  </div>
                  <div className="max-h-60 space-y-0.5 overflow-y-auto">
                    {filteredSlashItems.map((item, idx) => {
                      const Icon = item.icon;
                      const isSelected = idx === slashSelectedIndex;
                      return (
                        <button
                          key={item.name}
                          onClick={() => executeSlashCommand(item.command)}
                          className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted text-foreground'
                          }`}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div
                            className={`shrink-0 rounded-md p-1 ${isSelected ? 'bg-primary-foreground/10 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs leading-tight font-bold">{item.name}</div>
                            <div
                              className={`text-[9px] leading-normal ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                            >
                              {item.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ProseMirror Editor Canvas */}
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Active Collaborators Presence indicator bar */}
          {activePeers.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground font-semibold">Collaborating now:</span>
              <div className="flex flex-wrap gap-2">
                {activePeers.map((peer, idx) => (
                  <span
                    key={peer.clientId || idx}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium"
                    style={{ backgroundColor: `${peer.user?.color}15`, color: peer.user?.color }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: peer.user?.color }}
                    ></span>
                    {peer.user?.name || 'Anonymous'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar panels */}
        <aside className="scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 hidden min-h-0 w-80 shrink-0 scrollbar-thin scrollbar-track-transparent flex-col space-y-6 overflow-y-auto pr-1.5 pb-6 transition-colors lg:flex">
          <SidebarContent
            snapshots={snapshots}
            previewingSnapshot={previewingSnapshot}
            previewText={previewText}
            setPreviewingSnapshot={setPreviewingSnapshot}
            handlePreviewSnapshot={handlePreviewSnapshot}
            handleRestoreSnapshotTrigger={handleRestoreSnapshotTrigger}
            handleSaveVersionTrigger={handleSaveVersionTrigger}
            isSavingVersion={isSavingVersion}
            isAiConfigured={isAiConfigured}
            aiSummary={aiSummary}
            isSummarizing={isSummarizing}
            handleAiSummarize={handleAiSummarize}
            aiSearchQuery={aiSearchQuery}
            setAiSearchQuery={setAiSearchQuery}
            aiSearchLoading={aiSearchLoading}
            aiSearchResult={aiSearchResult}
            handleAiVersionSearch={handleAiVersionSearch}
            isViewer={isViewer}
            onShowAllVersions={() => setIsAllVersionsOpen(true)}
          />
        </aside>
      </div>

      {/* Mobile sidebar sliding sheet */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 lg:hidden">
          <div className="border-border bg-card animate-in slide-in-from-right relative h-full w-80 overflow-y-auto border-l p-6 shadow-2xl duration-100">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar panel"
            >
              <X className="h-4.5 w-4.5" />
            </Button>

            <div className="pt-6">
              <SidebarContent
                snapshots={snapshots}
                previewingSnapshot={previewingSnapshot}
                previewText={previewText}
                setPreviewingSnapshot={setPreviewingSnapshot}
                handlePreviewSnapshot={handlePreviewSnapshot}
                handleRestoreSnapshotTrigger={handleRestoreSnapshotTrigger}
                handleSaveVersionTrigger={handleSaveVersionTrigger}
                isSavingVersion={isSavingVersion}
                isAiConfigured={isAiConfigured}
                aiSummary={aiSummary}
                isSummarizing={isSummarizing}
                handleAiSummarize={handleAiSummarize}
                aiSearchQuery={aiSearchQuery}
                setAiSearchQuery={setAiSearchQuery}
                aiSearchLoading={aiSearchLoading}
                aiSearchResult={aiSearchResult}
                handleAiVersionSearch={handleAiVersionSearch}
                isViewer={isViewer}
                onShowAllVersions={() => setIsAllVersionsOpen(true)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Popups & Dialog Modals */}
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        documentId={documentId}
        currentUserRole={currentUserRole}
        currentUserId={userId}
      />

      <CheckpointLabelDialog
        open={checkpointOpen}
        onOpenChange={setCheckpointOpen}
        onSubmit={executeSaveVersion}
        isLoading={isSavingVersion}
      />

      <ConfirmDialog
        open={confirmRestoreOpen}
        onOpenChange={setConfirmRestoreOpen}
        title="Restore Checkpoint"
        description={`Are you sure you want to restore the document state to checkpoint "${pendingRestoreSnapshot?.label || ''}"? Connected peers will merge details dynamically.`}
        confirmLabel="Restore"
        onConfirm={executeRestoreSnapshot}
      />

      <ConfirmDialog
        open={confirmTrashOpen}
        onOpenChange={setConfirmTrashOpen}
        title="Move to Trash"
        description="Are you sure you want to move this document to the trash? You can restore it later from the sidebar."
        confirmLabel="Move to Trash"
        onConfirm={handleMoveToTrash}
      />

      {/* Slide-over sheet/sidebar to view all versions */}
      {isAllVersionsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="absolute inset-0" onClick={() => setIsAllVersionsOpen(false)} />
          <div className="border-border bg-card animate-in slide-in-from-right relative z-10 flex h-full w-[380px] max-w-full flex-col border-l p-6 shadow-2xl duration-100">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-foreground text-base font-bold">All Checkpoints</h3>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  Restore or preview any past checkpoint.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAllVersionsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4.5 w-4.5" />
              </Button>
            </div>
            <div className="py-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-3 h-3.5 w-3.5" />
                <input
                  placeholder="Search by label or author..."
                  value={versionsSearchQuery}
                  onChange={(e) => setVersionsSearchQuery(e.target.value)}
                  className="border-input bg-background/50 focus:border-primary focus:ring-primary/20 flex h-9 w-full rounded-lg border px-3 py-1 pl-9 text-xs outline-none focus:ring-1 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            <div className="flex-1 scrollbar-thin space-y-3 overflow-y-auto pr-1">
              {snapshots.filter((s) => {
                const query = versionsSearchQuery.toLowerCase();
                return (
                  (s.label || '').toLowerCase().includes(query) ||
                  (s.creator?.name || s.creator?.email || '').toLowerCase().includes(query)
                );
              }).length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-xs italic">
                  No checkpoints match search query.
                </div>
              ) : (
                snapshots
                  .filter((s) => {
                    const query = versionsSearchQuery.toLowerCase();
                    return (
                      (s.label || '').toLowerCase().includes(query) ||
                      (s.creator?.name || s.creator?.email || '').toLowerCase().includes(query)
                    );
                  })
                  .map((snap) => (
                    <div
                      key={snap.id}
                      className="border-border/20 space-y-1.5 border-b pb-3 text-xs last:border-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-foreground font-bold break-all">{snap.label}</span>
                        <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                          {new Date(snap.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        Saved by: {snap.creator?.name || snap.creator?.email || 'Anonymous'}
                      </div>
                      <div className="flex gap-2.5 pt-0.5">
                        <button
                          onClick={() => handlePreviewSnapshot(snap)}
                          className="text-primary text-[10px] font-semibold hover:underline"
                        >
                          Preview
                        </button>
                        {!isViewer && (
                          <button
                            onClick={() => handleRestoreSnapshotTrigger(snap)}
                            className="text-[10px] font-semibold text-violet-500 hover:underline"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bigger scrollable document-prose Snapshot Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="border-border bg-card flex h-[80vh] w-[90vw] max-w-4xl flex-col rounded-2xl border p-6">
          <DialogHeader className="border-border/50 border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">
                  Version History Snapshot Preview
                </DialogTitle>
                {previewingSnapshot && (
                  <DialogDescription className="text-muted-foreground mt-1 text-xs">
                    Label:{' '}
                    <span className="text-foreground font-semibold">
                      {previewingSnapshot.label}
                    </span>{' '}
                    • Saved on {new Date(previewingSnapshot.createdAt).toLocaleString()} by{' '}
                    {previewingSnapshot.creator.name || previewingSnapshot.creator.email}
                  </DialogDescription>
                )}
              </div>
              {previewingSnapshot && !isViewer && (
                <Button
                  onClick={async () => {
                    await handleRestoreSnapshotTrigger(previewingSnapshot);
                    setIsPreviewOpen(false);
                  }}
                  size="sm"
                  className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <RefreshCw className="animate-spin-once h-3.5 w-3.5" /> Restore This Version
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="bg-muted/10 border-border/30 mt-4 flex-1 overflow-y-auto rounded-xl border px-4 py-6">
            <div className="mx-auto max-w-3xl">
              {isPreviewLoading ? (
                <div className="animate-pulse space-y-6">
                  {/* Simulate title skeleton */}
                  <div className="bg-muted-foreground/15 h-7 w-2/3 rounded-lg" />

                  {/* Simulate content paragraphs */}
                  <div className="space-y-3 pt-4">
                    <div className="bg-muted-foreground/10 h-4 w-full rounded" />
                    <div className="bg-muted-foreground/10 h-4 w-[95%] rounded" />
                    <div className="bg-muted-foreground/10 h-4 w-[90%] rounded" />
                    <div className="bg-muted-foreground/10 h-4 w-[85%] rounded" />
                  </div>
                  <div className="space-y-3 pt-4">
                    <div className="bg-muted-foreground/10 h-4 w-full rounded" />
                    <div className="bg-muted-foreground/10 h-4 w-[92%] rounded" />
                    <div className="bg-muted-foreground/10 h-4 w-[80%] rounded" />
                  </div>
                  <div className="space-y-3 pt-4">
                    <div className="bg-muted-foreground/10 h-4 w-full rounded" />
                    <div className="bg-muted-foreground/10 h-4 w-[96%] rounded" />
                    <div className="bg-muted-foreground/10 h-4 w-[75%] rounded" />
                  </div>
                </div>
              ) : (
                /* Styled like document prose */
                <div
                  className="prose dark:prose-invert max-w-none text-base leading-relaxed break-words"
                  dangerouslySetInnerHTML={{ __html: previewText }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SidebarContentProps {
  snapshots: Snapshot[];
  previewingSnapshot: Snapshot | null;
  previewText: string;
  setPreviewingSnapshot: (s: Snapshot | null) => void;
  handlePreviewSnapshot: (s: Snapshot) => void;
  handleRestoreSnapshotTrigger: (s: Snapshot) => void;
  handleSaveVersionTrigger: () => void;
  isSavingVersion: boolean;
  isAiConfigured: boolean;
  aiSummary: string;
  isSummarizing: boolean;
  handleAiSummarize: () => void;
  aiSearchQuery: string;
  setAiSearchQuery: (q: string) => void;
  aiSearchLoading: boolean;
  aiSearchResult: { matchedSnapshotId: string | null; rationale: string } | null;
  handleAiVersionSearch: (e: React.FormEvent) => void;
  isViewer: boolean;
  onShowAllVersions: () => void;
}

function SidebarContent({
  snapshots,
  previewingSnapshot,
  previewText,
  setPreviewingSnapshot,
  handlePreviewSnapshot,
  handleRestoreSnapshotTrigger,
  handleSaveVersionTrigger,
  isSavingVersion,
  isAiConfigured,
  aiSummary,
  isSummarizing,
  handleAiSummarize,
  aiSearchQuery,
  setAiSearchQuery,
  aiSearchLoading,
  aiSearchResult,
  handleAiVersionSearch,
  isViewer,
  onShowAllVersions,
}: SidebarContentProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Version timeline
          </span>
          {!isViewer && (
            <Button
              variant="outline"
              size="xs"
              onClick={handleSaveVersionTrigger}
              disabled={isSavingVersion}
              className="gap-1.5 focus-visible:ring-2"
            >
              <Save className="h-3.5 w-3.5" /> Checkpoint
            </Button>
          )}
        </div>

        {/* AI Semantic Search Input */}
        {isAiConfigured && (
          <div className="border-border bg-card space-y-2 rounded-xl border p-3 shadow-xs">
            <span className="text-primary flex items-center gap-1 text-[9px] font-bold uppercase">
              <Sparkles className="h-3 w-3" /> Semantic version search
            </span>
            <form onSubmit={handleAiVersionSearch} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Ask AI e.g. when did I write pricing..."
                value={aiSearchQuery}
                onChange={(e) => setAiSearchQuery(e.target.value)}
                className="border-input bg-background/50 focus:border-primary focus:ring-primary/20 flex-1 rounded border px-2 py-1 text-[10px] outline-none focus:ring-1"
              />
              <Button
                type="submit"
                size="xs"
                disabled={aiSearchLoading}
                className="h-7 shrink-0 px-2"
              >
                <Search className="h-3 w-3" />
              </Button>
            </form>

            {aiSearchResult && (
              <div className="bg-primary/5 border-primary/10 animate-in fade-in space-y-1.5 rounded-lg border p-2 text-[10px] duration-100">
                <div className="text-primary font-semibold">
                  {aiSearchResult.matchedSnapshotId ? '✓ Found Match' : '▲ No Clear Match'}
                </div>
                <p className="text-muted-foreground leading-normal">{aiSearchResult.rationale}</p>

                {aiSearchResult.matchedSnapshotId && (
                  <div className="flex gap-2 pt-1">
                    {snapshots.find((s) => s.id === aiSearchResult.matchedSnapshotId) && (
                      <button
                        onClick={() => {
                          const match = snapshots.find(
                            (s) => s.id === aiSearchResult.matchedSnapshotId,
                          );
                          if (match) handlePreviewSnapshot(match);
                        }}
                        className="text-primary text-[9px] font-bold hover:underline"
                      >
                        Preview Match
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Snapshot listing timeline */}
        <div
          className="border-border bg-card max-h-[300px] space-y-3 overflow-y-auto rounded-xl border p-4"
          role="list"
        >
          {snapshots.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs italic">
              No checkpoints recorded.
            </p>
          ) : (
            snapshots.slice(0, 3).map((snap) => {
              const isMatched = aiSearchResult?.matchedSnapshotId === snap.id;
              return (
                <div
                  key={snap.id}
                  className={`border-border/20 space-y-1.5 border-b pb-2.5 text-xs transition-all duration-300 last:border-0 last:pb-0 ${
                    isMatched
                      ? 'bg-primary/5 border-primary/30 ring-primary/20 -mx-1 rounded-lg p-2 shadow-sm ring-1'
                      : ''
                  }`}
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-foreground font-bold break-all">{snap.label}</span>
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {new Date(snap.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    Author: {snap.creator?.name || 'Anonymous'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreviewSnapshot(snap)}
                      className="text-primary text-[10px] font-semibold hover:underline focus-visible:ring-1"
                    >
                      Preview
                    </button>
                    {!isViewer && (
                      <button
                        onClick={() => handleRestoreSnapshotTrigger(snap)}
                        className="text-[10px] font-semibold text-violet-500 hover:underline focus-visible:ring-1"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {snapshots.length > 3 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onShowAllVersions}
            className="text-primary hover:bg-primary/5 hover:text-primary mt-1 w-full text-center text-[10px] font-bold"
          >
            Show all versions ({snapshots.length}) →
          </Button>
        )}

        {/* AI Summarize Block in Timeline Gutter */}
        {isAiConfigured && (
          <div className="border-border bg-card mt-4 space-y-2 rounded-xl border p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-primary flex items-center gap-1 text-[9px] font-bold uppercase">
                <Sparkles className="h-3 w-3" /> AI document summary
              </span>
              <Button
                onClick={handleAiSummarize}
                disabled={isSummarizing}
                size="xs"
                className="h-6 gap-1 px-2 text-[9px]"
                variant="outline"
              >
                <RefreshCw className={`h-2.5 w-2.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                {isSummarizing ? 'Summarizing...' : 'Summarize'}
              </Button>
            </div>

            {aiSummary && (
              <div className="bg-muted text-muted-foreground border-border/40 animate-in fade-in max-h-32 overflow-y-auto rounded-lg border p-2.5 text-[10px] leading-relaxed duration-150">
                {aiSummary}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
