/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/auth';
import { getDocumentsForUserSecured } from '@docsync/db';
import { redirect } from 'next/navigation';
import { FileText, Star, Users, TrendingUp } from 'lucide-react';
import { DashboardClient } from '@/components/shell/dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const rawDocuments = await getDocumentsForUserSecured(userId);

  // Convert Date objects to strings for Client Component serialization
  const documents = rawDocuments.map((doc: any) => ({
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = session.user.name || session.user.email?.split('@')[0] || 'User';

  // Compute stats on the server
  const total = documents.length;
  const owned = documents.filter((d: any) => d.ownerId === userId).length;
  const shared = documents.filter((d: any) => d.ownerId !== userId).length;
  const today = new Date();
  const todayActive = documents.filter(
    (d: any) => new Date(d.updatedAt).toDateString() === today.toDateString(),
  ).length;

  return (
    <div className="from-background to-muted/10 h-full overflow-y-auto bg-linear-to-b p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-3xl font-extrabold tracking-tight md:text-4xl">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Welcome back to your local-first collaborative space. Let&apos;s build something great.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border-border bg-card rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 rounded-lg p-2">
                <FileText className="text-primary h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Total Docs
                </p>
              </div>
            </div>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Star className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{owned}</p>
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Owned
                </p>
              </div>
            </div>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{shared}</p>
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Shared
                </p>
              </div>
            </div>
          </div>
          <div className="border-border bg-card rounded-2xl border p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayActive}</p>
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Active Today
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard client interactivity */}
        <DashboardClient initialDocuments={documents} />
      </div>
    </div>
  );
}
