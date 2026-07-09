'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useYDoc } from '@/hooks/use-ydoc';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as Y from 'yjs';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DocumentPage({ params }: PageProps) {
  const { id } = use(params);
  
  // State to force unmount the editor wrapper to test clean .destroy() calls
  const [editorMounted, setEditorMounted] = useState(true);

  return (
    <main className="flex min-h-screen flex-col bg-radial from-background to-muted/30 p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DocSync Local Workspace</h1>
            <p className="text-sm text-muted-foreground">Test offline-first synchronization and memory management</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/documents/doc-a">
              <Button variant={id === 'doc-a' ? 'default' : 'outline'} size="sm">
                Open Document A
              </Button>
            </Link>
            <Link href="/documents/doc-b">
              <Button variant={id === 'doc-b' ? 'default' : 'outline'} size="sm">
                Open Document B
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">Back Home</Button>
            </Link>
          </div>
        </div>

        {/* Unmount Testing Controller */}
        <div className="flex items-center justify-between rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm">
          <div>
            <span className="font-semibold text-amber-700 dark:text-amber-500">Memory Lifecycle Testing:</span>
            <p className="text-muted-foreground mt-0.5">Toggle editor mount state to verify that Y.Doc and IndexedDB connections are cleanly destroyed.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setEditorMounted(prev => !prev)}
            className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            {editorMounted ? 'Force Unmount Editor' : 'Mount Editor'}
          </Button>
        </div>

        {/* Editor Wrapper */}
        {editorMounted ? (
          <EditorContainer documentId={id} />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 text-center">
            <div>
              <p className="font-semibold text-muted-foreground">Editor Unmounted</p>
              <p className="text-xs text-muted-foreground mt-1">Both the Y.Doc and the IndexedDB provider connections have been `.destroy()`ed.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function EditorContainer({ documentId }: { documentId: string }) {
  const { doc, provider, content, synced } = useYDoc(documentId);
  const [textVal, setTextVal] = useState('');
  const [dbStats, setDbStats] = useState<string[]>([]);
  const yTextRef = useRef<Y.Text | null>(null);

  // Sync state log helper
  const addLog = (msg: string) => {
    setDbStats(prev => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 14)
    ]);
  };

  useEffect(() => {
    if (!content) return;

    // Get or initialize a Y.Text node inside the XML Fragment
    let yText: Y.Text;
    if (content.length === 0) {
      yText = new Y.Text();
      content.insert(0, [yText]);
      addLog('Initialized empty Y.Text node in XmlFragment.');
    } else {
      yText = content.get(0) as Y.Text;
      addLog('Retrieved existing Y.Text node from XmlFragment.');
    }
    
    yTextRef.current = yText;
    setTextVal(yText.toString());

    // Listen to changes in Yjs to update the UI
    const handleUpdate = () => {
      setTextVal(yText.toString());
      addLog(`Local Yjs change observed. New length: ${yText.toString().length}`);
    };

    yText.observe(handleUpdate);

    return () => {
      yText.unobserve(handleUpdate);
      yTextRef.current = null;
    };
  }, [content]);

  // Log IndexedDB hydration
  useEffect(() => {
    if (synced) {
      addLog('Hydrated document content successfully from IndexedDB.');
      if (yTextRef.current) {
        setTextVal(yTextRef.current.toString());
      }
    } else {
      addLog('Hydrating content from local IndexedDB storage...');
    }
  }, [synced]);

  // Listen to IndexedDB provider events
  useEffect(() => {
    if (!provider) return;

    const handleSyncedEvent = () => {
      addLog('IndexedDB Provider emitted "synced" event.');
    };

    provider.on('synced', handleSyncedEvent);

    return () => {
      provider.off('synced', handleSyncedEvent);
    };
  }, [provider]);

  // Handle typing inside the editor
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    const yText = yTextRef.current;
    if (!yText) return;

    // Apply delta edit to Yjs
    doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, nextVal);
    });

    setTextVal(nextVal);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* The Text Editor Card */}
      <div className="md:col-span-2 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editor Workspace</span>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                synced ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}>
                {synced ? 'Hydrated' : 'Hydrating...'}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                Offline Mode Ready
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">
              {documentId === 'doc-a' ? 'Document A: Project Roadmap' : 'Document B: Technical Architecture'}
            </h2>
            <p className="text-xs text-muted-foreground select-all">ID: {documentId}</p>
          </div>

          <textarea
            value={textVal}
            onChange={handleTextareaChange}
            placeholder="Start typing your document content here (works fully offline)..."
            className="h-80 w-full rounded-xl border border-input bg-background/50 p-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none font-sans"
          />
          
          <div className="text-xs text-muted-foreground text-right">
            Character Count: {textVal.length}
          </div>
        </div>
      </div>

      {/* Sync Logs and Stats Column */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl h-full flex flex-col min-h-[400px]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/50">
            Local Sync & Database Logs
          </h3>
          
          <div className="flex-1 mt-4 overflow-y-auto font-mono text-[10px] space-y-1.5 max-h-80 pr-1">
            {dbStats.length === 0 ? (
              <p className="text-muted-foreground italic">No logs recorded yet.</p>
            ) : (
              dbStats.map((log, i) => (
                <div key={i} className="text-muted-foreground leading-relaxed break-all border-b border-border/20 pb-1">
                  {log}
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
            <div><span className="font-semibold">Local Storage:</span> IndexedDB Persistence</div>
            <div><span className="font-semibold">Store name:</span> <code className="bg-muted px-1 rounded">{documentId}</code></div>
            <div><span className="font-semibold">Sync state:</span> {synced ? 'In sync with storage' : 'Hydrating local DB...'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
