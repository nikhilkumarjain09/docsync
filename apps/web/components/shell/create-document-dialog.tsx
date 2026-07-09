'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Calendar, Compass, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATES = [
  { id: 'blank', name: 'Blank Document', icon: FileText, desc: 'Start fresh with a clean page.' },
  {
    id: 'notes',
    name: 'Meeting Notes',
    icon: Calendar,
    desc: 'A pre-filled structure for meeting notes.',
  },
  {
    id: 'brief',
    name: 'Project Brief',
    icon: Compass,
    desc: 'A clean outline for project definitions.',
  },
];

export function CreateDocumentDialog({ open, onOpenChange }: CreateDocumentDialogProps) {
  const [title, setTitle] = React.useState('');
  const [selectedTemplate, setSelectedTemplate] = React.useState('blank');
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (open) {
      Promise.resolve().then(() => {
        setTitle('');
        setSelectedTemplate('blank');
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const docTitle = title.trim() || 'Untitled';

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: docTitle }),
      });

      if (res.ok) {
        const newDoc = await res.json();
        toast.success(`Created "${docTitle}" successfully`);

        if (selectedTemplate !== 'blank') {
          localStorage.setItem(`doc-template-${newDoc.id}`, selectedTemplate);
        }

        onOpenChange(false);
        router.push(`/documents/${newDoc.id}`);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create document');
      }
    } catch {
      toast.error('Network error creating document');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Document</DialogTitle>
          <DialogDescription>
            Specify a title and select a starter template for your new workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Input
              placeholder="e.g. Q3 Roadmap Proposal (Leave blank for Untitled)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="space-y-2.5">
            <span className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
              Starter Templates
            </span>
            <div className="grid grid-cols-1 gap-2">
              {TEMPLATES.map((tpl) => {
                const Icon = tpl.icon;
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl.id)}
                    disabled={isLoading}
                    className={`hover:bg-muted/40 flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-card text-foreground'
                    }`}
                  >
                    <div
                      className={`rounded-lg p-2 ${
                        isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">{tpl.name}</div>
                      <div className="text-muted-foreground mt-0.5 text-[10px]">{tpl.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Creating...' : 'Create & Open'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
