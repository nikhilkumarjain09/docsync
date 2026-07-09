'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Check, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  currentUserRole: 'OWNER' | 'EDITOR' | 'VIEWER' | null;
  currentUserId: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  documentId,
  currentUserRole,
  currentUserId,
}: ShareDialogProps) {
  const [collaborators, setCollaborators] = React.useState<Collaborator[]>([]);
  const [loadingList, setLoadingList] = React.useState(true);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<'OWNER' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [isInviting, setIsInviting] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);

  // Row-level loading states
  const [loadingRows, setLoadingRows] = React.useState<Record<string, boolean>>({});

  const isOwner = currentUserRole === 'OWNER';

  const loadCollaborators = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`);
      if (res.ok) {
        const list = await res.json();
        setCollaborators(list);
      }
    } catch {
      // Ignore error
    } finally {
      setLoadingList(false);
    }
  }, [documentId]);

  React.useEffect(() => {
    if (open && documentId) {
      Promise.resolve().then(() => {
        setLoadingList(true);
        loadCollaborators();
      });
    }
  }, [open, documentId, loadCollaborators]);

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
        toast.success(`Successfully invited ${inviteEmail.trim()}`);
        setInviteEmail('');
        loadCollaborators();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Invitation failed');
      }
    } catch {
      toast.error('Network error during invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (targetId: string, role: 'OWNER' | 'EDITOR' | 'VIEWER') => {
    const collaborator = collaborators.find((c) => c.userId === targetId);
    if (!collaborator) return;

    setLoadingRows((prev) => ({ ...prev, [targetId]: true }));
    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: collaborator.user.email, role }),
      });

      if (res.ok) {
        toast.success('Role updated successfully');
        loadCollaborators();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to modify role');
      }
    } catch {
      toast.error('Network error modifying role');
    } finally {
      setLoadingRows((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const handleRemoveCollaborator = async (targetId: string) => {
    setLoadingRows((prev) => ({ ...prev, [targetId]: true }));
    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators?userId=${targetId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Collaborator removed successfully');
        loadCollaborators();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to remove collaborator');
      }
    } catch {
      toast.error('Network error removing collaborator');
    } finally {
      setLoadingRows((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/documents/${documentId}`;
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    toast.success('Share link copied to clipboard');
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Manage who has access to this collaborative workspace.
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <form onSubmit={handleInvite} className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={isInviting}
              required
              className="flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'OWNER' | 'EDITOR' | 'VIEWER')}
              disabled={isInviting}
              className="border-input bg-background h-9 rounded-lg border px-2 text-sm outline-none"
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
              <option value="OWNER">Owner</option>
            </select>
            <Button type="submit" disabled={isInviting} className="shrink-0 gap-1.5">
              {isInviting && <Loader2 className="h-3 w-3 animate-spin" />}
              Invite
            </Button>
          </form>
        )}

        <div className="space-y-3 pt-2">
          <span className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
            Collaborators
          </span>

          <div className="max-h-[220px] space-y-2.5 overflow-y-auto pr-1">
            {loadingList ? (
              <div className="flex justify-center py-6">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : collaborators.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-xs italic">
                No collaborators listed.
              </div>
            ) : (
              collaborators.map((col) => {
                const isColMe = col.userId === currentUserId;
                const isRowLoading = !!loadingRows[col.userId];
                return (
                  <div key={col.userId} className="flex items-center justify-between py-1 text-xs">
                    <div className="flex max-w-[60%] items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(col.user.name || col.user.email || 'U').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <div className="truncate font-bold">
                          {col.user.name || col.user.email} {isColMe && '(You)'}
                        </div>
                        <div className="text-muted-foreground truncate text-[10px]">
                          {col.user.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isRowLoading ? (
                        <Loader2 className="text-muted-foreground mr-1 h-3 w-3 animate-spin" />
                      ) : null}

                      {isOwner && !isColMe ? (
                        <select
                          value={col.role}
                          onChange={(e) =>
                            handleUpdateRole(
                              col.userId,
                              e.target.value as 'OWNER' | 'EDITOR' | 'VIEWER',
                            )
                          }
                          disabled={isRowLoading}
                          className="border-input bg-background h-7 rounded border px-1.5 text-[11px] font-semibold outline-none"
                        >
                          <option value="EDITOR">Editor</option>
                          <option value="VIEWER">Viewer</option>
                          <option value="OWNER">Owner</option>
                        </select>
                      ) : (
                        <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-[10px] font-bold uppercase">
                          {col.role}
                        </span>
                      )}

                      {isOwner && !isColMe && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRemoveCollaborator(col.userId)}
                          disabled={isRowLoading}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-border/50 flex items-center justify-between gap-3 border-t pt-4">
          <div className="bg-muted text-muted-foreground flex-1 truncate rounded-lg px-3 py-2 font-mono text-[11px] select-all">
            {documentId
              ? `${window.location.origin}/documents/${documentId}`
              : 'Generating link...'}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            disabled={!documentId}
            className="shrink-0 gap-1.5"
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {isCopied ? 'Copied' : 'Copy Link'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
