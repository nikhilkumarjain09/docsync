'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logIn } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(logIn, null);

  useEffect(() => {
    if (state?.success) {
      router.push('/');
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-background to-muted/30 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue to DocSync editor
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="alice@docsync.dev"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {state?.error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {state.error}
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Logging In...' : 'Log In'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
