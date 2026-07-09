'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useYDoc } from '@/hooks/use-ydoc';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Y from 'yjs';

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

// Custom toggle blocks
import { ToggleBlock, ToggleHeader, ToggleContent } from '@/lib/editor/toggle-block';

// Icons
import {
  ArrowLeft,
  Users,
  History,
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
  Ban
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
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', 
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'
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

  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-radial from-background to-muted/30">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Entering secure workspace...</p>
        </div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated' || !session) {
    router.push('/login');
    return null;
  }

  return (
    <EditorWorkspace 
      documentId={documentId} 
      userId={session.user.id} 
      userName={session.user.name || session.user.email} 
    />
  );
}

function EditorWorkspace({ documentId, userId, userName }: { documentId: string; userId: string; userName: string }) {
  const { doc, provider, content, synced, connectionStatus, awareness, broadcastUpdate } = useYDoc(documentId);
  const router = useRouter();

  // Local/UI states
  const [currentUserRole, setCurrentUserRole] = useState<'OWNER' | 'EDITOR' | 'VIEWER' | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [activePeers, setActivePeers] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [previewingSnapshot, setPreviewingSnapshot] = useState<Snapshot | null>(null);
  const [previewText, setPreviewText] = useState('');
  
  // Tab panels
  const [activeTab, setActiveTab] = useState<'timeline' | 'share'>('timeline');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  
  // Share form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'OWNER' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [isInviting, setIsInviting] = useState(false);

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
  const [aiSearchResult, setAiSearchResult] = useState<{ matchedSnapshotId: string | null; rationale: string } | null>(null);
  
  // Writing Assist states
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiAssistInstruction, setAiAssistInstruction] = useState('improve clarity and make it more professional');
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiAssistResult, setAiAssistResult] = useState<{ originalText: string; improvedText: string } | null>(null);

  // Aria Announcer
  const [ariaLiveAnnouncement, setAriaLiveAnnouncement] = useState('');

  // Load collaborator and snapshot records
  const loadCollaborators = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`);
      if (res.ok) {
        const list: Collaborator[] = await res.json();
        setCollaborators(list);
        
        // Find current user's role
        const me = list.find((c) => c.userId === userId);
        if (me) {
          setCurrentUserRole(me.role);
        }
      } else if (res.status === 403) {
        alert('Access denied: You are not registered as a collaborator on this document');
        router.push('/');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSnapshots = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/snapshots`);
      if (res.ok) {
        const list = await res.json();
        setSnapshots(list);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (synced) {
      loadCollaborators();
      loadSnapshots();
    }
  }, [synced, documentId]);

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
    setAriaLiveAnnouncement(announcement);
  }, [connectionStatus]);

  // Presence awareness sync
  useEffect(() => {
    if (!awareness) return;

    const handleAwarenessChange = () => {
      const states = Array.from(awareness.getStates().entries()) as Array<[number, any]>;
      const otherPeers = states
        .filter(([clientId, state]) => state.user && state.user.userId !== userId)
        .map(([clientId, state]) => ({
          clientId,
          user: state.user,
        }));
      setActivePeers(otherPeers);
    };

    const userColor = getUserColor(userId);
    awareness.setLocalStateField('user', {
      userId,
      name: userName,
      color: userColor,
    });

    awareness.on('change', handleAwarenessChange);
    handleAwarenessChange();

    return () => {
      awareness.off('change', handleAwarenessChange);
    };
  }, [awareness, userId, userName]);

  // ─── Tiptap Editor Core Instantiation ─────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Collaboration handles undo/redo
      } as any),
      Collaboration.configure({
        document: doc || undefined,
        fragment: content || undefined,
      }),
      CollaborationCursor.configure({
        provider: provider || undefined,
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
        dragHandleWidth: 24,
      }),
      // Custom Collapsible nodes
      ToggleBlock,
      ToggleHeader,
      ToggleContent,
    ],
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert focus:outline-none min-h-[480px] w-full max-w-none text-base leading-relaxed',
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
              })
            );
            return true;
          }
        }
        return false;
      },
    },
    immediatelyRender: false,
  }, [doc, provider, content]);

  // Sync edit permissions
  const isViewer = currentUserRole === 'VIEWER';
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isViewer);
  }, [editor, currentUserRole]);

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
    return () => { editor.off('selectionUpdate', handleSelection); };
  }, [editor]);

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
  const slashItems = [
    { name: 'Heading 1', desc: 'Large title header', icon: Heading1, command: 'h1' },
    { name: 'Heading 2', desc: 'Medium section title', icon: Heading2, command: 'h2' },
    { name: 'Heading 3', desc: 'Small subsection title', icon: Heading3, command: 'h3' },
    { name: 'Bulleted List', desc: 'Simple bulleted list', icon: List, command: 'bullet' },
    { name: 'Numbered List', desc: 'Sequential list', icon: ListOrdered, command: 'ordered' },
    { name: 'To-do Checklist', desc: 'Collapsible task checkboxes', icon: CheckSquare, command: 'todo' },
    { name: 'Toggle List', desc: 'Collapsible nested content', icon: ChevronRight, command: 'toggle' },
    { name: 'Blockquote', desc: 'Capture a highlighted quote', icon: Quote, command: 'quote' },
    { name: 'Code Block', desc: 'Formatted syntax block', icon: Code2, command: 'codeblock' },
    { name: 'Divider', desc: 'Horizontal separation rule', icon: Minus, command: 'divider' },
  ];

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
          setSlashMenu({
            x: coords.left,
            y: coords.top + window.scrollY + 24, // Position just below the block cursor
            filterText: query,
            selectionFrom: $from.start(),
          });
          setSlashSelectedIndex(0);
        } catch (e) {
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

  // Intercept keys when slash menu is open
  useEffect(() => {
    if (!editor || !slashMenu) return;

    const handleSlashMenuKeys = (e: KeyboardEvent) => {
      const filtered = slashItems.filter(item =>
        item.name.toLowerCase().includes(slashMenu.filterText)
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
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
  }, [editor, slashMenu, slashSelectedIndex]);

  const executeSlashCommand = (cmd: string) => {
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
        editor.chain().focus().insertContent({
          type: 'toggleBlock',
          attrs: { open: true },
          content: [
            {
              type: 'toggleHeader',
              content: [{ type: 'text', text: 'Toggle block title' }]
            },
            {
              type: 'toggleContent',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested contents go here...' }] }]
            }
          ]
        }).run();
        break;
      case 'quote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'codeblock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'divider':
        editor.chain().focus().setHorizontalRule().run();
        break;
    }

    setSlashMenu(null);
  };

  const filteredSlashItems = slashMenu
    ? slashItems.filter(item => item.name.toLowerCase().includes(slashMenu.filterText))
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
        setAiSummary(prev => prev + chunk);
      }
    } catch (e: any) {
      console.error(e);
      setAiSummary(`Error: ${e.message}`);
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
        alert(data.error || 'Failed to search versions');
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
      alert('Please select a paragraph or block of text first to improve.');
      return;
    }

    setAiAssistLoading(true);
    setAiAssistResult(null);

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
        alert(data.error || 'AI assist request failed');
      }
    } catch (err) {
      console.error(err);
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
  const handleSaveVersion = async () => {
    const label = prompt('Specify a checkpoint version label:');
    if (label === null) return;

    setIsSavingVersion(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });

      if (res.ok) {
        loadSnapshots();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create snapshot');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingVersion(false);
    }
  };

  const handlePreviewSnapshot = async (snapshot: Snapshot) => {
    setPreviewingSnapshot(snapshot);
    setPreviewText('Loading version details...');

    try {
      const res = await fetch(`/api/documents/${documentId}/snapshots/${snapshot.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      const tempDoc = new Y.Doc();
      const stateUpdateBytes = new Uint8Array(
        atob(data.state).split('').map(c => c.charCodeAt(0))
      );
      Y.applyUpdate(tempDoc, stateUpdateBytes);
      
      const xmlFragment = tempDoc.getXmlFragment('default');
      setPreviewText(xmlFragment.toString() || '(Empty document)');
      tempDoc.destroy();
    } catch (e) {
      setPreviewText('Failed to render snapshot preview.');
    }
  };

  const handleRestoreSnapshot = async (snapshot: Snapshot) => {
    if (!confirm(`Restore to checkpoint "${snapshot.label}"?\nConnected peers will merge details dynamically.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${documentId}/snapshots/${snapshot.id}/restore`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Restore failed');
      }

      const { id: logId, update: base64Update } = await res.json();
      const updateBytes = new Uint8Array(
        atob(base64Update).split('').map(c => c.charCodeAt(0))
      );
      if (doc) {
        Y.applyUpdate(doc, updateBytes, 'server-sync');
      }

      broadcastUpdate(base64Update, logId);
      setPreviewingSnapshot(null);
      loadSnapshots();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Collaborators invitation management
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || isInviting) return;

    setIsInviting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      if (res.ok) {
        setInviteEmail('');
        loadCollaborators();
      } else {
        const err = await res.json();
        alert(err.error || 'Invitation failed');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (targetId: string, role: 'OWNER' | 'EDITOR' | 'VIEWER') => {
    const collaborator = collaborators.find((c) => c.userId === targetId);
    if (!collaborator) return;

    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: collaborator.user.email, role }),
      });

      if (res.ok) {
        loadCollaborators();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to modify role');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveCollaborator = async (targetId: string) => {
    if (!confirm('Remove this collaborator from workspace access?')) return;

    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators?userId=${targetId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadCollaborators();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to remove collaborator');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Connection State badge style
  const getConnectionPill = () => {
    switch (connectionStatus) {
      case 'synced':
        return (
          <span 
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 transition-all duration-300"
            role="status"
          >
            <Wifi className="h-3.5 w-3.5" /> Synced
          </span>
        );
      case 'syncing':
        return (
          <span 
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-400 border border-amber-500/20 animate-pulse transition-all duration-300"
            role="status"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
          </span>
        );
      case 'connecting':
        return (
          <span 
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-500/10 px-3 py-1 text-xs font-semibold text-neutral-800 dark:text-neutral-300 border border-neutral-500/20 animate-pulse transition-all duration-300"
            role="status"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Reconnecting
          </span>
        );
      case 'offline':
      default:
        return (
          <span 
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-800 dark:text-red-400 border border-red-500/20 transition-all duration-300"
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

  return (
    <div className="flex min-h-screen flex-col bg-radial from-background to-muted/20">
      
      {/* Screen Reader connection alerts */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaLiveAnnouncement}
      </div>

      {/* Main Top Header */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted transition-colors" aria-label="Go back to Dashboard">
              <ArrowLeft className="h-4.5 w-4.5 text-muted-foreground group-hover:text-foreground" />
            </Link>
            <div>
              <h1 className="text-lg font-bold tracking-tight">DocSync Editor Workspace</h1>
              <p className="text-[10px] text-muted-foreground select-all">Document ID: {documentId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getConnectionPill()}
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open document timeline and sharing panel"
            >
              <Menu className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Split Panels */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 items-stretch gap-6 px-6 py-8">
        
        {/* Editor Main Section */}
        <div className="flex-1 min-w-0 space-y-4">
          
          {/* Document metadata card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono">Live Workspace</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground">Access Level:</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  {currentUserRole || 'Resolving Role...'}
                </span>
              </div>
            </div>
            
            <h2 className="text-2xl font-extrabold tracking-tight">
              {documentId === 'doc-a' ? 'Document A: Project Roadmap' : 'Document B: Technical Architecture'}
            </h2>
          </div>

          {/* Unconfigured API Key friendly alert banner */}
          {!isAiConfigured && (
            <div className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4 text-xs">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <span className="font-bold text-amber-800 dark:text-amber-400">AI Integration Notice:</span>
                <p className="text-muted-foreground mt-0.5">
                  AI Summarizer, writing assist, and semantic version search are currently disabled because no API keys were found. To enable them, set <code className="bg-muted px-1 rounded font-mono text-[10px]">GROQ_API_KEY</code> or <code className="bg-muted px-1 rounded font-mono text-[10px]">GEMINI_API_KEY</code> in your environment. Core editing and live syncing remain fully functional.
                </p>
              </div>
            </div>
          )}

          {/* Collaborative interactive container */}
          <div className="relative rounded-2xl border border-border bg-card p-8 md:p-12 shadow-xl min-h-[500px]">
            
            {/* Embedded Drag Handle and Plus gutter controls (rendered adjacent to active line) */}
            {!isViewer && editor && (
              <div className="absolute left-3 top-0 z-20 flex flex-col gap-0.5 pointer-events-none opacity-0 hover:opacity-100 transition-opacity" id="editor-gutter-controls">
                <button
                  onClick={handleGutterPlus}
                  className="pointer-events-auto flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Insert paragraph below"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <div className="pointer-events-auto drag-handle flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
              </div>
            )}

            {/* Notion Bubble Menu (shows on text selection) */}
            {editor && !isViewer && (
              <BubbleMenu editor={editor} {...{ tippyOptions: { duration: 150 } } as any}>
                <div className="flex items-center gap-1 rounded-xl border border-border bg-background/90 backdrop-blur-md p-1.5 shadow-xl animate-in zoom-in-95 duration-100">
                  
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
                        className="h-7 w-7 text-primary hover:text-primary"
                        aria-label="AI Writing Assist"
                        title="AI Improve Selection"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </Button>
                      <div className="h-4 w-px bg-border/60 mx-1" />
                    </>
                  )}

                  <Button
                    variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={toggleBold}
                    className="h-7 w-7"
                    aria-label="Format Bold"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={toggleItalic}
                    className="h-7 w-7"
                    aria-label="Format Italic"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={editor.isActive('highlight') ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
                    className="h-7 w-7"
                    aria-label="Highlight Text"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={editor.isActive('code') ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={toggleCode}
                    className="h-7 w-7"
                    aria-label="Format Code"
                  >
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                  
                  <div className="h-4 w-px bg-border/60 mx-1" />

                  {showLinkInput ? (
                    <form onSubmit={applyLink} className="flex items-center gap-1.5 px-1.5 animate-in slide-in-from-left-2 duration-100">
                      <input
                        type="url"
                        placeholder="https://..."
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        className="rounded border border-input bg-background px-2 py-0.5 text-xs outline-none focus:border-primary"
                        autoFocus
                      />
                      <Button type="submit" size="xs" className="h-6 px-2 text-[10px]">
                        Save
                      </Button>
                      <button type="button" onClick={() => setShowLinkInput(false)} className="text-[10px] text-muted-foreground hover:text-foreground">
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
                      className="h-7 w-7"
                      aria-label="Insert Link"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </BubbleMenu>
            )}

            {/* AI Writing Assist Diff Suggestion Popover (Floating panel above bubble menu) */}
            {showAiAssist && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 w-96 rounded-xl border border-border bg-background/95 backdrop-blur-md p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs font-bold text-primary flex items-center gap-1">
                    <Wand2 className="h-3.5 w-3.5" /> AI Paragraph Assist
                  </span>
                  <button onClick={() => { setShowAiAssist(false); setAiAssistResult(null); }} className="text-muted-foreground hover:text-foreground text-xs">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {!aiAssistResult ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground">What changes would you like to make to the selection?</p>
                    <input
                      type="text"
                      placeholder="e.g. make it professional, make it more concise..."
                      value={aiAssistInstruction}
                      onChange={(e) => setAiAssistInstruction(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <Button 
                      onClick={handleAiWritingAssist} 
                      disabled={aiAssistLoading} 
                      size="xs" 
                      className="w-full"
                    >
                      {aiAssistLoading ? 'Thinking...' : 'Generate Suggestion'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 text-[11px]">
                      <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-2 text-red-800 dark:text-red-400">
                        <span className="font-bold block text-[9px] uppercase tracking-wider text-red-600">Original text</span>
                        {aiAssistResult.originalText}
                      </div>
                      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-400">
                        <span className="font-bold block text-[9px] uppercase tracking-wider text-emerald-600">AI Improved text</span>
                        {aiAssistResult.improvedText}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAcceptAssist} size="xs" className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700">
                        <Check className="h-3 w-3" /> Accept & Edit
                      </Button>
                      <Button onClick={() => setAiAssistResult(null)} variant="outline" size="xs" className="flex-1 gap-1">
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
                className="absolute z-50 w-64 rounded-xl border border-border bg-background/95 backdrop-blur-md p-1.5 shadow-2xl animate-in zoom-in-95 duration-100 overflow-hidden"
                style={{ top: slashMenu.y, left: slashMenu.x }}
                role="listbox"
                aria-label="Block creation commands"
              >
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b border-border/20 mb-1">
                  Commands
                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5">
                  {filteredSlashItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isSelected = idx === slashSelectedIndex;
                    return (
                      <button
                        key={item.name}
                        onClick={() => executeSlashCommand(item.command)}
                        className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left transition-colors ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-muted text-foreground'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className={`p-1 rounded-md shrink-0 ${isSelected ? 'bg-primary-foreground/10 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold leading-tight">{item.name}</div>
                          <div className={`text-[9px] leading-normal ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
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
            {!synced ? (
              <div className="flex h-64 flex-col items-center justify-center space-y-2">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p className="text-xs text-muted-foreground">Hydrating collaborative document...</p>
              </div>
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>

          {/* Active Collaborators Presence indicator bar */}
          {activePeers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground font-semibold">Collaborating now:</span>
              <div className="flex flex-wrap gap-2">
                {activePeers.map((peer, idx) => (
                  <span 
                    key={peer.clientId || idx} 
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${peer.user?.color}15`, color: peer.user?.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: peer.user?.color }}></span>
                    {peer.user?.name || 'Anonymous'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar panels */}
        <aside className="hidden lg:block w-80 shrink-0 space-y-6">
          <SidebarContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            snapshots={snapshots}
            collaborators={collaborators}
            previewingSnapshot={previewingSnapshot}
            previewText={previewText}
            setPreviewingSnapshot={setPreviewingSnapshot}
            handlePreviewSnapshot={handlePreviewSnapshot}
            handleRestoreSnapshot={handleRestoreSnapshot}
            handleSaveVersion={handleSaveVersion}
            isSavingVersion={isSavingVersion}
            inviteEmail={inviteEmail}
            setInviteEmail={setInviteEmail}
            inviteRole={inviteRole}
            setInviteRole={setInviteRole}
            handleInvite={handleInvite}
            isInviting={isInviting}
            handleUpdateRole={handleUpdateRole}
            handleRemoveCollaborator={handleRemoveCollaborator}
            currentUserRole={currentUserRole}
            currentUserId={userId}
            isAiConfigured={isAiConfigured}
            aiSummary={aiSummary}
            isSummarizing={isSummarizing}
            handleAiSummarize={handleAiSummarize}
            aiSearchQuery={aiSearchQuery}
            setAiSearchQuery={setAiSearchQuery}
            aiSearchLoading={aiSearchLoading}
            aiSearchResult={aiSearchResult}
            handleAiVersionSearch={handleAiVersionSearch}
          />
        </aside>

      </div>

      {/* Mobile sidebar sliding sheet */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-xs lg:hidden">
          <div className="h-full w-80 border-l border-border bg-card p-6 shadow-2xl overflow-y-auto relative animate-in slide-in-from-right duration-200">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar panel"
            >
              <X className="h-4.5 w-4.5" />
            </Button>
            
            <div className="pt-6">
              <SidebarContent
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                snapshots={snapshots}
                collaborators={collaborators}
                previewingSnapshot={previewingSnapshot}
                previewText={previewText}
                setPreviewingSnapshot={setPreviewingSnapshot}
                handlePreviewSnapshot={handlePreviewSnapshot}
                handleRestoreSnapshot={handleRestoreSnapshot}
                handleSaveVersion={handleSaveVersion}
                isSavingVersion={isSavingVersion}
                inviteEmail={inviteEmail}
                setInviteEmail={setInviteEmail}
                inviteRole={inviteRole}
                setInviteRole={setInviteRole}
                handleInvite={handleInvite}
                isInviting={isInviting}
                handleUpdateRole={handleUpdateRole}
                handleRemoveCollaborator={handleRemoveCollaborator}
                currentUserRole={currentUserRole}
                currentUserId={userId}
                isAiConfigured={isAiConfigured}
                aiSummary={aiSummary}
                isSummarizing={isSummarizing}
                handleAiSummarize={handleAiSummarize}
                aiSearchQuery={aiSearchQuery}
                setAiSearchQuery={setAiSearchQuery}
                aiSearchLoading={aiSearchLoading}
                aiSearchResult={aiSearchResult}
                handleAiVersionSearch={handleAiVersionSearch}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

interface SidebarContentProps {
  activeTab: 'timeline' | 'share';
  setActiveTab: (tab: 'timeline' | 'share') => void;
  snapshots: Snapshot[];
  collaborators: Collaborator[];
  previewingSnapshot: Snapshot | null;
  previewText: string;
  setPreviewingSnapshot: (s: Snapshot | null) => void;
  handlePreviewSnapshot: (s: Snapshot) => void;
  handleRestoreSnapshot: (s: Snapshot) => void;
  handleSaveVersion: () => void;
  isSavingVersion: boolean;
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  inviteRole: 'OWNER' | 'EDITOR' | 'VIEWER';
  setInviteRole: (role: 'OWNER' | 'EDITOR' | 'VIEWER') => void;
  handleInvite: (e: React.FormEvent) => void;
  isInviting: boolean;
  handleUpdateRole: (id: string, role: 'OWNER' | 'EDITOR' | 'VIEWER') => void;
  handleRemoveCollaborator: (id: string) => void;
  currentUserRole: 'OWNER' | 'EDITOR' | 'VIEWER' | null;
  currentUserId: string;
  isAiConfigured: boolean;
  aiSummary: string;
  isSummarizing: boolean;
  handleAiSummarize: () => void;
  aiSearchQuery: string;
  setAiSearchQuery: (q: string) => void;
  aiSearchLoading: boolean;
  aiSearchResult: { matchedSnapshotId: string | null; rationale: string } | null;
  handleAiVersionSearch: (e: React.FormEvent) => void;
}

function SidebarContent({
  activeTab,
  setActiveTab,
  snapshots,
  collaborators,
  previewingSnapshot,
  previewText,
  setPreviewingSnapshot,
  handlePreviewSnapshot,
  handleRestoreSnapshot,
  handleSaveVersion,
  isSavingVersion,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  handleInvite,
  isInviting,
  handleUpdateRole,
  handleRemoveCollaborator,
  currentUserRole,
  currentUserId,
  isAiConfigured,
  aiSummary,
  isSummarizing,
  handleAiSummarize,
  aiSearchQuery,
  setAiSearchQuery,
  aiSearchLoading,
  aiSearchResult,
  handleAiVersionSearch
}: SidebarContentProps) {
  const isOwner = currentUserRole === 'OWNER';
  const isViewer = currentUserRole === 'VIEWER';

  return (
    <div className="space-y-6">
      
      {/* Tab controls */}
      <div className="flex rounded-xl border border-border bg-card p-1 shadow-xs">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeTab === 'timeline' 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-selected={activeTab === 'timeline'}
          role="tab"
        >
          <History className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" /> Timeline
        </button>
        <button
          onClick={() => setActiveTab('share')}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeTab === 'share' 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-selected={activeTab === 'share'}
          role="tab"
        >
          <Users className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" /> Sharing
        </button>
      </div>

      {/* Tab Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Version timeline</span>
            {!isViewer && (
              <Button 
                variant="outline" 
                size="xs" 
                onClick={handleSaveVersion} 
                disabled={isSavingVersion}
                className="gap-1.5 focus-visible:ring-2"
              >
                <Save className="h-3.5 w-3.5" /> Checkpoint
              </Button>
            )}
          </div>

          {/* AI Semantic Search Input */}
          {isAiConfigured && (
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2">
              <span className="text-[9px] font-bold uppercase text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Semantic version search
              </span>
              <form onSubmit={handleAiVersionSearch} className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Ask AI e.g. when did I write pricing..."
                  value={aiSearchQuery}
                  onChange={(e) => setAiSearchQuery(e.target.value)}
                  className="flex-1 rounded border border-input bg-background/50 px-2 py-1 text-[10px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                <Button type="submit" size="xs" disabled={aiSearchLoading} className="h-7 px-2 shrink-0">
                  <Search className="h-3 w-3" />
                </Button>
              </form>

              {aiSearchResult && (
                <div className="text-[10px] rounded-lg bg-primary/5 border border-primary/10 p-2 space-y-1.5 animate-in fade-in duration-100">
                  <div className="font-semibold text-primary">
                    {aiSearchResult.matchedSnapshotId ? '✓ Found Match' : '▲ No Clear Match'}
                  </div>
                  <p className="text-muted-foreground leading-normal">{aiSearchResult.rationale}</p>
                  
                  {aiSearchResult.matchedSnapshotId && (
                    <div className="pt-1 flex gap-2">
                      {snapshots.find(s => s.id === aiSearchResult.matchedSnapshotId) && (
                        <button
                          onClick={() => {
                            const match = snapshots.find(s => s.id === aiSearchResult.matchedSnapshotId);
                            if (match) handlePreviewSnapshot(match);
                          }}
                          className="text-[9px] font-bold text-primary hover:underline"
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

          {previewingSnapshot && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-primary">Snapshot Preview</span>
                <button 
                  onClick={() => setPreviewingSnapshot(null)} 
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <div className="text-xs font-bold truncate">{previewingSnapshot.label}</div>
              <textarea
                readOnly
                value={previewText}
                className="h-32 w-full rounded-lg border border-border bg-background/60 p-2.5 text-[11px] outline-none resize-none font-sans"
              />
              {!isViewer && (
                <Button 
                  onClick={() => handleRestoreSnapshot(previewingSnapshot)} 
                  className="w-full text-xs py-1.5" 
                  size="sm"
                >
                  Restore this version
                </Button>
              )}
            </div>
          )}

          {/* Snapshot listing timeline */}
          <div className="space-y-3 rounded-xl border border-border bg-card p-4 max-h-[300px] overflow-y-auto" role="list">
            {snapshots.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">No checkpoints recorded.</p>
            ) : (
              snapshots.map((snap) => {
                const isMatched = aiSearchResult?.matchedSnapshotId === snap.id;
                return (
                  <div 
                    key={snap.id} 
                    className={`text-xs border-b border-border/20 last:border-0 pb-2.5 last:pb-0 space-y-1.5 transition-all duration-300 ${
                      isMatched ? 'bg-primary/5 border-primary/30 p-2 rounded-lg -mx-1 ring-1 ring-primary/20 shadow-sm' : ''
                    }`} 
                    role="listitem"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-foreground break-all">{snap.label}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {new Date(snap.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Author: {snap.creator?.name || 'Anonymous'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreviewSnapshot(snap)}
                        className="text-[10px] font-semibold text-primary hover:underline focus-visible:ring-1"
                      >
                        Preview
                      </button>
                      {!isViewer && (
                        <button
                          onClick={() => handleRestoreSnapshot(snap)}
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

          {/* AI Summarize Block in Timeline Gutter */}
          {isAiConfigured && (
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase text-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> AI document summary
                </span>
                <Button 
                  onClick={handleAiSummarize} 
                  disabled={isSummarizing} 
                  size="xs" 
                  className="h-6 px-2 text-[9px] gap-1"
                  variant="outline"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${isSummarizing ? 'animate-spin' : ''}`} /> 
                  {isSummarizing ? 'Summarizing...' : 'Summarize'}
                </Button>
              </div>
              
              {aiSummary && (
                <div className="text-[10px] rounded-lg bg-muted p-2.5 leading-relaxed text-muted-foreground border border-border/40 max-h-32 overflow-y-auto animate-in fade-in duration-150">
                  {aiSummary}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Tab Sharing */}
      {activeTab === 'share' && (
        <div className="space-y-4">
          
          {/* Invite user forms */}
          {isOwner && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invite Collaborator</span>
              <form onSubmit={handleInvite} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="collaborator@domain.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                
                <div className="flex gap-2">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="flex-1 rounded-lg border border-input bg-background/50 px-2 py-1.5 text-xs outline-none transition-all focus:border-primary"
                  >
                    <option value="OWNER">Owner</option>
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <Button type="submit" size="xs" disabled={isInviting}>
                    Invite
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Collaborator list */}
          <div className="space-y-3 rounded-xl border border-border bg-card p-4 max-h-[350px] overflow-y-auto" role="list">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block border-b border-border/20 pb-2">
              Collaborator list
            </span>
            
            {collaborators.map((col) => {
              const isColMe = col.userId === currentUserId;
              return (
                <div key={col.userId} className="flex items-center justify-between text-xs py-1.5 border-b border-border/10 last:border-0" role="listitem">
                  <div className="space-y-0.5 max-w-[65%]">
                    <div className="font-bold truncate" title={col.user.name || col.user.email || ''}>
                      {col.user.name || col.user.email} {isColMe && '(You)'}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{col.user.email}</div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isOwner && !isColMe ? (
                      <select
                        value={col.role}
                        onChange={(e) => handleUpdateRole(col.userId, e.target.value as any)}
                        className="rounded border border-input bg-background/50 px-1 py-0.5 text-[9px] font-semibold outline-none"
                      >
                        <option value="OWNER">Owner</option>
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    ) : (
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                        {col.role}
                      </span>
                    )}

                    {isOwner && !isColMe && (
                      <button
                        onClick={() => handleRemoveCollaborator(col.userId)}
                        className="text-red-500 hover:text-red-600 transition-colors p-1"
                        aria-label={`Remove collaborator ${col.user.name || col.user.email}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
