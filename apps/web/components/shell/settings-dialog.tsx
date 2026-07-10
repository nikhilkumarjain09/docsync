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
  const [isSaving, setIsSaving] = React.useState(false);

  // Sync state with open transitions
  React.useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setName(session?.user?.name || '');
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
      const res = await updateProfileAction(name);
      if (res.success) {
        // Trigger NextAuth update so client session reflects name change
        await update({ name });
        toast.success('Your profile display name has been updated.');
      } else {
        toast.error(res.error || 'Failed to update profile name.');
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
      <DialogContent className="max-w-[720px] p-0 overflow-hidden flex flex-col md:flex-row h-[480px]">
        {/* Sidebar Nav */}
        <div className="w-full md:w-[220px] bg-muted/20 border-b md:border-b-0 md:border-r border-border p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-sm tracking-tight px-2">Workspace Settings</h3>
              <p className="text-muted-foreground text-[10px] px-2">Manage configurations & profile</p>
            </div>
            <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
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

          {/* Social info inside settings sidebar */}
          <div className="hidden md:block pt-4 border-t border-border/50 text-[10px] text-muted-foreground/60 space-y-1">
            <div className="font-bold text-muted-foreground/80">Developer Profile</div>
            <div>Nikhil Jain</div>
            <div className="flex items-center gap-2 pt-0.5">
              <a
                href="https://github.com/nikhilkumarjain09"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary hover:underline flex items-center gap-1"
              >
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span>GitHub</span>
              </a>
              <span>•</span>
              <a
                href="https://www.linkedin.com/in/nikhil-kumar-jain-b05909278/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary hover:underline flex items-center gap-1"
              >
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
                <span>LinkedIn</span>
              </a>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between">
          <div className="space-y-6">
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold tracking-tight">Identity & Profile</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Update your public-facing display details within the collaborative workspace environment.
                  </p>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Registered Email (Read-Only)
                    </label>
                    <Input
                      value={session?.user?.email || ''}
                      disabled
                      className="bg-muted/40 opacity-75 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="settings-name" className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Display Name
                    </label>
                    <Input
                      id="settings-name"
                      placeholder="Nikhil Jain"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSaving}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={isSaving} className="gap-2 font-semibold shadow-xs">
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
