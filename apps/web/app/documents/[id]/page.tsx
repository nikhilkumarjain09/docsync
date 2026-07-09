'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useYDoc } from '@/hooks/use-ydoc';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import * as Y from 'yjs';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DocumentPage({ params }: PageProps) {
  const { id } = use(params);
  const [editorMounted, setEditorMounted] = useState(true);
  const { data: session, status: sessionStatus } = useSession();

  // If session is loading, show a loading placeholder
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

  // Redirect to login if unauthenticated
  if (sessionStatus === 'unauthenticated' || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-radial from-background to-muted/30">
        <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-sm space-y-4 shadow-xl">
          <h2 className="text-xl font-bold">Authentication Required</h2>
          <p className="text-sm text-muted-foreground">Please log in to collaborate on documents.</p>
          <Link href="/login" className="block">
            <Button className="w-full">Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-radial from-background to-muted/30 p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DocSync Real-Time Workspace</h1>
            <p className="text-sm text-muted-foreground">
              Logged in as <span className="font-semibold text-foreground">{session.user?.name || session.user?.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/documents/doc-a">
              <Button variant={id === 'doc-a' ? 'default' : 'outline'} size="sm">
                Document A
              </Button>
            </Link>
            <Link href="/documents/doc-b">
              <Button variant={id === 'doc-b' ? 'default' : 'outline'} size="sm">
                Document B
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
          </div>
        </div>

        {/* Life cycle controller */}
        <div className="flex items-center justify-between rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm">
          <div>
            <span className="font-semibold text-amber-700 dark:text-amber-500">Live Relay Testing:</span>
            <p className="text-muted-foreground mt-0.5">Toggle editor mounting to test active WebSocket connection cleanup and provider teardown.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setEditorMounted(prev => !prev)}
            className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            {editorMounted ? 'Disconnect WebSocket & Unmount' : 'Connect WebSocket & Mount'}
          </Button>
        </div>

        {/* Editor Container */}
        {editorMounted ? (
          <EditorContainer documentId={id} currentUserId={session.user?.id || ''} />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 text-center">
            <div>
              <p className="font-semibold text-muted-foreground">Relay Disconnected & Editor Unmounted</p>
              <p className="text-xs text-muted-foreground mt-1">WebSocket has closed and memory buffers have been freed.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function EditorContainer({ documentId, currentUserId }: { documentId: string; currentUserId: string }) {
  const { doc, content, synced, connectionStatus, awareness } = useYDoc(documentId);
  const [textVal, setTextVal] = useState('');
  const [peers, setPeers] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const yTextRef = useRef<Y.Text | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 14)
    ]);
  };

  // Sync Yjs doc updates to textarea
  useEffect(() => {
    if (!content) return;

    let yText: Y.Text;
    if (content.length === 0) {
      yText = new Y.Text();
      content.insert(0, [yText]);
      addLog('Initialized Y.Text inside XmlFragment.');
    } else {
      yText = content.get(0) as Y.Text;
      addLog('Hydrated Y.Text from XmlFragment.');
    }

    yTextRef.current = yText;
    setTextVal(yText.toString());

    const handleUpdate = () => {
      setTextVal(yText.toString());
    };

    yText.observe(handleUpdate);

    return () => {
      yText.unobserve(handleUpdate);
      yTextRef.current = null;
    };
  }, [content]);

  // Log connection status transitions
  useEffect(() => {
    addLog(`WebSocket connection status changed to: ${connectionStatus.toUpperCase()}`);
  }, [connectionStatus]);

  // Log local database hydration state
  useEffect(() => {
    if (synced) {
      addLog('Local document state successfully loaded from IndexedDB.');
      if (yTextRef.current) {
        setTextVal(yTextRef.current.toString());
      }
    }
  }, [synced]);

  // Yjs Awareness Presence handlers
  useEffect(() => {
    if (!awareness) return;

    const handleAwarenessChange = () => {
      const states = Array.from(awareness.getStates().entries()) as Array<[number, any]>;
      const otherPeers = states
        .filter(([clientId, state]: [number, any]) => state.user && state.user.userId !== currentUserId)
        .map(([clientId, state]: [number, any]) => ({
          clientId,
          user: state.user,
          cursor: state.cursor,
        }));
      setPeers(otherPeers);
    };

    awareness.on('change', handleAwarenessChange);
    handleAwarenessChange();

    return () => {
      awareness.off('change', handleAwarenessChange);
    };
  }, [awareness, currentUserId]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    const yText = yTextRef.current;
    if (!yText) return;

    // Apply transaction
    doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, nextVal);
    });

    setTextVal(nextVal);
    updateCursorAwareness(e.target);
  };

  // Broadcast cursor indexes via Yjs Awareness
  const updateCursorAwareness = (textarea: HTMLTextAreaElement) => {
    if (!awareness) return;
    
    const index = textarea.selectionStart;
    awareness.setLocalStateField('cursor', {
      index,
      updatedAt: Date.now(),
    });
  };

  const handleSelectionOrFocus = (e: any) => {
    updateCursorAwareness(e.target);
  };

  // Helper to color code the badges
  const getStatusBadgeStyle = () => {
    switch (connectionStatus) {
      case 'synced':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20';
      case 'syncing':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 animate-pulse';
      case 'connecting':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 animate-pulse';
      case 'offline':
      default:
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Editor & Presence indicators */}
      <div className="lg:col-span-3 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 relative">
          
          {/* Badge Indicators */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editor Workspace</span>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeStyle()}`}>
                {connectionStatus === 'synced' && '● Connected & Synced'}
                {connectionStatus === 'syncing' && '◌ Saving edits...'}
                {connectionStatus === 'connecting' && '⚡ Connecting...'}
                {connectionStatus === 'offline' && '▲ Offline (Local-only)'}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 border border-blue-500/20">
                y-indexeddb ready
              </span>
            </div>
          </div>

          {/* Doc details */}
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">
              {documentId === 'doc-a' ? 'Document A: Project Roadmap' : 'Document B: Technical Architecture'}
            </h2>
            <p className="text-xs text-muted-foreground select-all">Document ID: {documentId}</p>
          </div>

          {/* Peer Presence list */}
          {peers.length > 0 && (
            <div className="flex items-center gap-1.5 py-1.5 border-y border-border/40 text-xs">
              <span className="text-muted-foreground font-medium">Active Collaborators:</span>
              <div className="flex flex-wrap gap-2">
                {peers.map((peer) => (
                  <span 
                    key={peer.clientId} 
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${peer.user?.color}15`, color: peer.user?.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: peer.user?.color }}></span>
                    {peer.user?.name} 
                    {peer.cursor?.index !== undefined && ` (at char ${peer.cursor.index})`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Editor Area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={textVal}
              onChange={handleTextareaChange}
              onKeyUp={handleSelectionOrFocus}
              onMouseUp={handleSelectionOrFocus}
              onFocus={handleSelectionOrFocus}
              placeholder="Collaborate offline and online here..."
              className="h-[450px] w-full rounded-xl border border-input bg-background/40 p-5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none font-sans leading-relaxed"
            />
            
            {/* Live Peer cursor overlays in editor footer */}
            {peers.length > 0 && (
              <div className="absolute bottom-3 left-4 flex flex-col gap-1 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-xs px-2 py-1.5 rounded-lg border border-border">
                {peers.map((peer) => (
                  <div key={peer.clientId} className="flex items-center gap-1.5">
                    <span className="font-semibold" style={{ color: peer.user?.color }}>
                      {peer.user?.name}:
                    </span>
                    <span>
                      {peer.cursor?.index !== undefined 
                        ? `viewing character position ${peer.cursor.index}` 
                        : 'viewing document'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <div>
              {connectionStatus === 'offline' 
                ? '⚠️ Offline changes buffered. Will upload automatically upon reconnect.' 
                : '✓ Synchronized with real-time websocket server.'}
            </div>
            <div>
              Characters: {textVal.length}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Operation Logs */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl h-full flex flex-col min-h-[400px]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/50">
            Sync Operations
          </h3>
          
          <div className="flex-1 mt-4 overflow-y-auto font-mono text-[10px] space-y-1.5 max-h-[450px] pr-1">
            {logs.length === 0 ? (
              <p className="text-muted-foreground italic">Connecting to relay...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-muted-foreground leading-relaxed break-all border-b border-border/20 pb-1">
                  {log}
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 text-[11px] text-muted-foreground space-y-1.5">
            <div><span className="font-semibold">Relay URI:</span> <code className="bg-muted px-1 rounded text-[10px]">ws://localhost:4444</code></div>
            <div><span className="font-semibold">Hydration:</span> {synced ? 'Ready (Local DB)' : 'Loading local DB...'}</div>
            <div><span className="font-semibold">Active Peers:</span> {peers.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
