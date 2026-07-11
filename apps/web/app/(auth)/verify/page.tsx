'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { verifyTokenAction, resendVerification } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Mail, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { signIn } from 'next-auth/react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>(
    'idle',
  );
  const [resendMessage, setResendMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  // Execute verification on mount if token is present
  useEffect(() => {
    if (!token) {
      Promise.resolve().then(() => {
        setStatus('error');
        setErrorMessage('No verification token was provided. Please check your verification link.');
      });
      return;
    }

    const verify = async () => {
      try {
        const res = await verifyTokenAction(token);
        if (res.success) {
          setStatus('success');
          if (res.loginToken && res.email) {
            // Auto-login the verified user
            const signInRes = await signIn('credentials', {
              email: res.email,
              tokenLogin: 'true',
              secret: res.loginToken,
              redirect: false,
              callbackUrl: '/',
            });
            if (signInRes?.ok) {
              window.location.href = '/';
            } else {
              router.push('/login');
            }
          } else {
            setTimeout(() => {
              router.push('/login');
            }, 3000);
          }
        } else {
          setStatus('error');
          setErrorMessage(res.error || 'Verification failed.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('An unexpected error occurred during email verification.');
      }
    };

    verify();
  }, [token, router]);

  // Handle requesting a new token
  const handleResend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;

    setResendStatus('sending');
    setResendMessage('');

    startTransition(async () => {
      try {
        const res = await resendVerification(email);
        if (res.success) {
          setResendStatus('success');
          setResendMessage('A fresh verification link has been sent to your inbox.');
        } else {
          setResendStatus('error');
          setResendMessage(res.error || 'Failed to resend verification link.');
        }
      } catch {
        setResendStatus('error');
        setResendMessage('Something went wrong. Please try again.');
      }
    });
  };

  return (
    <div className="border-border bg-card/80 w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md">
      {/* Visual Header Indicator */}
      <div className="h-1.5 w-full bg-gradient-to-r from-violet-950 via-purple-900 to-indigo-950" />

      <div className="px-8 pt-8 pb-4 text-center">
        {status === 'loading' && (
          <div className="bg-muted/60 mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-full" />
        )}
        {status === 'success' && (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
        )}
        {status === 'error' && (
          <div className="bg-destructive/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <AlertCircle className="text-destructive h-6 w-6" />
          </div>
        )}

        <h2 className="text-foreground mt-4 flex justify-center text-2xl font-bold tracking-tight">
          {status === 'loading' && <Skeleton className="h-7 w-48 rounded" />}
          {status === 'success' && 'Security Clearance Confirmed'}
          {status === 'error' && 'Access Authorization Failed'}
        </h2>
        <div className="text-muted-foreground mt-2 flex flex-col items-center gap-1.5">
          {status === 'loading' && (
            <>
              <Skeleton className="h-4 w-64 animate-pulse rounded" />
              <Skeleton className="h-4 w-40 animate-pulse rounded" />
            </>
          )}
          {status === 'success' && (
            <p className="text-sm font-medium text-emerald-500">
              Your credentials have been verified. Redirecting to workspace...
            </p>
          )}
          {status === 'error' && (
            <p className="text-sm">
              Unable to authorize session. The security token is invalid or has expired.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6 px-8 py-4">
        {status === 'error' && (
          <div className="space-y-4">
            <div className="bg-destructive/10 text-destructive rounded-xl p-3.5 text-sm leading-relaxed font-medium">
              {errorMessage}
            </div>

            {/* Resend verification panel */}
            <div className="border-border border-t pt-5">
              <h4 className="mb-2 text-sm font-semibold">Request a new verification link</h4>
              <p className="text-muted-foreground mb-4 text-xs">
                Enter your email address below and we will send you a fresh link to activate your
                profile.
              </p>

              <form onSubmit={handleResend} className="space-y-3">
                <div className="relative flex items-center">
                  <Mail className="text-muted-foreground/75 absolute left-3.5 h-4 w-4" />
                  <input
                    type="email"
                    placeholder="nikhiljain@docsync.dev"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={resendStatus === 'sending'}
                    className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm transition-all outline-none focus:ring-2 disabled:opacity-50"
                  />
                </div>

                {resendMessage && (
                  <div
                    className={`rounded-xl p-3 text-xs font-medium ${
                      resendStatus === 'success'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {resendMessage}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={resendStatus === 'sending' || isPending}
                  className="w-full rounded-xl bg-violet-950 py-5 text-xs font-semibold text-white shadow-md transition-all hover:bg-violet-900 active:scale-[0.99]"
                >
                  {resendStatus === 'sending' ? 'Sending Link...' : 'Send Verification Link'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-center text-sm">
              Redirecting you to the sign-in page. If you are not redirected automatically within 3
              seconds, please click the button below.
            </p>
            <Link href="/login" className="block w-full">
              <Button className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-violet-950 py-6 text-sm font-semibold text-white shadow-md hover:bg-violet-900">
                Access Secure Workspace <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="border-border/50 bg-muted/30 flex justify-center border-t px-8 py-5">
        <Link href="/login" className="text-primary text-xs font-medium hover:underline">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="from-background to-muted/40 flex min-h-screen items-center justify-center bg-radial px-4 py-12">
      <React.Suspense
        fallback={
          <div className="border-border bg-card/80 w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md">
            <div className="h-1.5 w-full bg-gradient-to-r from-violet-950 via-purple-900 to-indigo-950" />
            <div className="flex flex-col items-center justify-center space-y-4 p-12">
              <div className="bg-muted/60 h-12 w-12 animate-pulse rounded-full" />
              <Skeleton className="h-6 w-48 rounded" />
              <div className="flex w-full flex-col items-center gap-1.5">
                <Skeleton className="h-4 w-64 animate-pulse rounded" />
                <Skeleton className="h-4 w-40 animate-pulse rounded" />
              </div>
            </div>
          </div>
        }
      >
        <VerifyContent />
      </React.Suspense>
    </div>
  );
}
