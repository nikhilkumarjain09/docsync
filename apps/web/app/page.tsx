import { auth, signOut } from '@/auth';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-radial from-background to-muted/30 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">DocSync</h1>
          <p className="text-muted-foreground">
            Local-first collaborative document editor
          </p>
        </div>

        <div className="rounded-xl bg-muted/40 p-4 text-left space-y-2 text-sm border border-border/50">
          <p className="font-semibold text-muted-foreground pb-1 border-b border-border/30">Active Session Details:</p>
          <div><span className="font-medium text-muted-foreground">User ID:</span> <code className="bg-muted px-1.5 py-0.5 rounded text-xs select-all">{session.user.id}</code></div>
          <div><span className="font-medium text-muted-foreground">Email:</span> <code className="bg-muted px-1.5 py-0.5 rounded text-xs select-all">{session.user.email}</code></div>
          {session.user.name && (
            <div><span className="font-medium text-muted-foreground">Name:</span> <code className="bg-muted px-1.5 py-0.5 rounded text-xs select-all">{session.user.name}</code></div>
          )}
        </div>

        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <Button type="submit" variant="outline" className="w-full">
            Log Out
          </Button>
        </form>
      </div>
    </main>
  );
}
