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

interface CheckpointLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (label: string) => void | Promise<void>;
  isLoading?: boolean;
}

export function CheckpointLabelDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: CheckpointLabelDialogProps) {
  const [label, setLabel] = React.useState('');

  React.useEffect(() => {
    if (open) {
      Promise.resolve().then(() => {
        setLabel('');
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    await onSubmit(label.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Checkpoint</DialogTitle>
          <DialogDescription>
            Specify a version label for your new document checkpoint.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="e.g. Added pricing sections"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={isLoading}
            autoFocus
            required
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !label.trim()}>
              {isLoading ? 'Saving...' : 'Create Checkpoint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
