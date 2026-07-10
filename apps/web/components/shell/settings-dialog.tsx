'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  User,
  Monitor,
  Shield,
  Database,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { updateProfileAction } from '@/app/actions/auth';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'profile' | 'appearance' | 'security' | 'sync';
}

type TabType = 'profile' | 'appearance' | 'security' | 'sync';

export function SettingsDialog({ open, onOpenChange, defaultTab = 'profile' }: SettingsDialogProps) {
  const { data: session, update } = useSession();
  const { theme: currentTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = React.useState<TabType>(defaultTab);
  const [name, setName] = React.useState('');
  const [avatar, setAvatar] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  // Mock states for extra profile options
  const [jobTitle, setJobTitle] = React.useState('Product Manager');
  const [department, setDepartment] = React.useState('Engineering');
  const [bio, setBio] = React.useState('Collaborating on document syncing.');

  const AVATAR_TEMPLATES = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&h=100&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&h=100&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&h=100&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=100&h=100&q=80',
  ];

  // Sync state with open transitions
  React.useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setName(session?.user?.name || '');
      setAvatar(session?.user?.image || '');
    }
  }, [open, defaultTab, session]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Profile display name cannot be blank.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateProfileAction(name, avatar);
      if (res.success) {
        // Trigger NextAuth update so client session reflects name & image change
        await update({ name, image: avatar });
        toast.success('Your profile details have been updated.');
      } else {
        toast.error(res.error || 'Failed to update profile details.');
      }
    } catch {
      toast.error('An unexpected network error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'User Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Monitor },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'sync', label: 'System & Sync', icon: Database },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] p-0 overflow-hidden flex flex-col md:flex-row h-[520px]">
        {/* Sidebar Nav */}
        <div className="w-full md:w-[200px] bg-muted/20 border-b md:border-b-0 md:border-r border-border p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-xs tracking-tight px-2">Account Workspace</h3>
              <p className="text-muted-foreground text-[9px] px-2">Manage settings & profile</p>
            </div>
            <nav className="flex flex-row md:flex-col gap-0.5 overflow-x-auto md:overflow-x-visible">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between">
          <div className="space-y-5">
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold tracking-tight">Identity & Profile Details</h4>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Update your public avatar and collaborator details within the enterprise sync workspace.
                  </p>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-4">
                  {/* Avatar Picker & Preview */}
                  <div className="space-y-2">
                    <label className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                      Profile Picture
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                        {avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatar} alt="Profile Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-bold text-muted-foreground text-sm uppercase">
                            {name ? name.substring(0, 2) : 'U'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground mb-1.5">Select a pre-configured enterprise avatar:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {AVATAR_TEMPLATES.map((imgUrl, i) => {
                            const isSelected = avatar === imgUrl;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setAvatar(imgUrl)}
                                className={`relative h-7 w-7 rounded-full overflow-hidden border transition-all ${
                                  isSelected 
                                    ? 'border-primary ring-1 ring-primary scale-110 shadow-xs' 
                                    : 'border-border/60 hover:scale-105'
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={imgUrl} alt={`Avatar option ${i + 1}`} className="h-full w-full object-cover" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                        Registered Email (Read-Only)
                      </label>
                      <Input
                        value={session?.user?.email || ''}
                        disabled
                        className="bg-muted/40 opacity-75 font-mono text-[11px] h-8"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="settings-name" className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                        Display Name
                      </label>
                      <Input
                        id="settings-name"
                        placeholder="Nikhil Jain"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSaving}
                        required
                        className="text-[11px] h-8"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="settings-title" className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                        Job Title
                      </label>
                      <Input
                        id="settings-title"
                        placeholder="Product Manager"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        disabled={isSaving}
                        className="text-[11px] h-8"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="settings-dept" className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                        Department
                      </label>
                      <Input
                        id="settings-dept"
                        placeholder="Engineering"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={isSaving}
                        className="text-[11px] h-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="settings-bio" className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                      Biography
                    </label>
                    <textarea
                      id="settings-bio"
                      placeholder="Collaborating on documents..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      disabled={isSaving}
                      className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-md border p-2 text-[11px] h-14 outline-none focus:ring-1 resize-none"
                    />
                  </div>

                  <Button type="submit" disabled={isSaving} className="gap-2 font-semibold shadow-xs text-xs h-8 px-3 mt-1">
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isSaving ? 'Updating Profile...' : 'Save Configuration'}
                  </Button>
                </form>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold tracking-tight">Appearance & Interface</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Customize workspace rendering variables, colors, and layout aesthetics.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase">
                      Workspace Theme
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {['system', 'light', 'dark'].map((t) => {
                        const isActive = currentTheme === t;
                        return (
                          <button
                            key={t}
                            onClick={() => {
                              setTheme(t);
                              toast.success(`Interface theme updated to ${t}`);
                            }}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                              isActive
                                ? 'border-primary ring-2 ring-primary/10 bg-primary/5 text-primary'
                                : 'border-border bg-card hover:bg-muted/30 text-foreground'
                            }`}
                          >
                            <Monitor className={`h-4 w-4 mb-1.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span>{t}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-muted/20 border border-border/50 rounded-2xl p-4 flex items-start gap-3">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-bold text-foreground block mb-0.5">High-DPI Adaptive Rendering</span>
                      Aesthetics auto-adapt based on device hardware and browser color profiles.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold tracking-tight">Security & Active Access Sessions</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Monitor authorization status, active connections, and security variables.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold">2-Factor Authentication</div>
                      <div className="text-muted-foreground text-[10px]">Email verification OTP guard enabled</div>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Enforced
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase">
                      Active Sessions
                    </span>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-muted/20 border border-border/40 p-2.5 rounded-xl text-[11px]">
                        <div>
                          <span className="font-bold block text-foreground">Next.js Standalone Vercel Platform</span>
                          <span className="text-muted-foreground font-mono">rhel-openssl-3.0.x • Serverless Session</span>
                        </div>
                        <span className="text-emerald-500 font-bold">Active Now</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sync' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold tracking-tight">System Architecture & Synchronization</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Local-first Yjs replication parameters and database synchronization engine details.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="bg-muted/15 border border-border/40 p-3 rounded-2xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Sync Engine</span>
                      <span className="font-mono font-bold text-foreground">Yjs Document Protocol</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/30 pt-2">
                      <span className="text-muted-foreground">Local Storage Fallback</span>
                      <span className="font-mono font-bold text-foreground">IndexedDB Persistence</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/30 pt-2">
                      <span className="text-muted-foreground">Database Engine</span>
                      <span className="font-mono font-bold text-foreground">Neon PostgreSQL Client</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/30 pt-2">
                      <span className="text-muted-foreground">Relay Server Location</span>
                      <span className="font-mono font-bold text-foreground text-wrap break-all">wss-relay.docsync.dev</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/50 pt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Dismiss Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
