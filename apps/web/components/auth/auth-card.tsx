'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logIn, signUp } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// Minimalist single-continuous-stroke SVG line-art cat
function LineArtCat({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M25 65 
           C25 55, 30 45, 42 45 
           C48 35, 54 28, 52 28 
           C50 28, 45 35, 45 40 
           C45 42, 47 45, 49 45 
           C54 45, 58 35, 56 35 
           C54 35, 52 40, 52 45 
           C52 50, 58 55, 62 55 
           C68 55, 72 45, 68 40 
           C66 38, 62 38, 62 44 
           C62 50, 68 52, 75 45 
           C82 38, 80 28, 70 32 
           C60 36, 54 50, 56 65 
           C58 78, 70 82, 78 78 
           C86 74, 84 65, 78 70 
           C72 74, 70 70, 72 65"
      />
    </svg>
  );
}

interface AuthCardProps {
  initialIsSignup: boolean;
}

export function AuthCard({ initialIsSignup }: AuthCardProps) {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(initialIsSignup);
  const [isMobile, setIsMobile] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Refs for focus management
  const loginEmailRef = useRef<HTMLInputElement>(null);
  const signupNameRef = useRef<HTMLInputElement>(null);

  // Server actions hooks
  const [loginState, loginFormAction, loginIsPending] = useActionState(logIn, null);
  const [signupState, signupFormAction, signupIsPending] = useActionState(signUp, null);

  // Responsive layout listener
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen to popstate to sync state with back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setIsSignup(window.location.pathname === '/signup');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect on successful authentication
  useEffect(() => {
    if (loginState?.success || signupState?.success) {
      router.push('/');
      router.refresh();
    }
  }, [loginState, signupState, router]);

  // Handle mode toggles and history state updates
  const toggleMode = (targetSignup: boolean) => {
    setIsSignup(targetSignup);
    setAnnouncement(
      targetSignup
        ? 'Now showing sign up form. Focus is set on your full name.'
        : 'Now showing log in form. Focus is set on your email.',
    );
    const newPath = targetSignup ? '/signup' : '/login';
    window.history.pushState(null, '', newPath);
  };

  // Focus management on mode switch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isSignup) {
        signupNameRef.current?.focus();
      } else {
        loginEmailRef.current?.focus();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isSignup]);

  // Sub-component rendering for Brand Panel content
  const renderBrandContent = () => (
    <motion.div
      key={isSignup ? 'signup-brand' : 'login-brand'}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col items-center justify-between text-center sm:items-start sm:text-left"
    >
      <div className="space-y-4">
        <h2 className="text-3xl font-extrabold tracking-tight">
          {isSignup ? 'Join your team' : 'Welcome back'}
        </h2>
        <p className="max-w-sm text-sm text-indigo-100/90">
          {isSignup
            ? 'Create an account to start co-authoring and managing document version histories in real-time.'
            : 'Log in to keep editing and collaborating on documents with your team.'}
        </p>
      </div>

      <div className="flex w-full items-center justify-center py-6">
        <LineArtCat className="h-40 w-40 text-white/95 drop-shadow-md" />
      </div>

      <div className="text-xs text-indigo-200/70">
        © {new Date().getFullYear()} DocSync. All rights reserved.
      </div>
    </motion.div>
  );

  // Sub-component rendering for Login Form
  const renderLoginForm = () => (
    <motion.div
      key="login-form-container"
      initial={{ opacity: 0, x: isMobile ? 0 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isMobile ? 0 : -20 }}
      transition={{ duration: 0.25 }}
      className="w-full space-y-6"
    >
      <div className="space-y-1">
        <h3 className="text-foreground text-2xl font-bold tracking-tight">Sign In</h3>
        <p className="text-muted-foreground text-sm">Access your collaborative workspace</p>
      </div>

      <form action={loginFormAction} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
          >
            Email Address
          </label>
          <input
            ref={loginEmailRef}
            id="email"
            name="email"
            type="email"
            placeholder="alice@docsync.dev"
            required
            className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-4 py-2.5 text-sm transition-all outline-none focus:ring-2"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >
              Password
            </label>
            <a
              href="#forgot"
              className="text-primary text-xs font-medium hover:underline"
              onClick={(e) => e.preventDefault()}
            >
              Forgot password?
            </a>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-4 py-2.5 text-sm transition-all outline-none focus:ring-2"
          />
        </div>

        {loginState?.error && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">
            {loginState.error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loginIsPending}
          className="w-full rounded-xl py-6 text-sm font-semibold"
        >
          {loginIsPending ? 'Signing In...' : 'Log In'}
        </Button>
      </form>

      <div className="text-muted-foreground pt-2 text-center text-sm">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={() => toggleMode(true)}
          className="text-primary font-semibold hover:underline focus:outline-none"
        >
          Sign up
        </button>
      </div>
    </motion.div>
  );

  // Sub-component rendering for Signup Form
  const renderSignupForm = () => (
    <motion.div
      key="signup-form-container"
      initial={{ opacity: 0, x: isMobile ? 0 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isMobile ? 0 : 20 }}
      transition={{ duration: 0.25 }}
      className="w-full space-y-6"
    >
      <div className="space-y-1">
        <h3 className="text-foreground text-2xl font-bold tracking-tight">Create Account</h3>
        <p className="text-muted-foreground text-sm">Register your new profile</p>
      </div>

      <form action={signupFormAction} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
          >
            Full Name
          </label>
          <input
            ref={signupNameRef}
            id="name"
            name="name"
            type="text"
            placeholder="Alice Vance"
            required
            className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-4 py-2.5 text-sm transition-all outline-none focus:ring-2"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="alice@docsync.dev"
            required
            className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-4 py-2.5 text-sm transition-all outline-none focus:ring-2"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-4 py-2.5 text-sm transition-all outline-none focus:ring-2"
          />
        </div>

        {signupState?.error && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">
            {signupState.error}
          </div>
        )}

        <Button
          type="submit"
          disabled={signupIsPending}
          className="w-full rounded-xl py-6 text-sm font-semibold"
        >
          {signupIsPending ? 'Creating Account...' : 'Sign Up'}
        </Button>
      </form>

      <div className="text-muted-foreground pt-2 text-center text-sm">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => toggleMode(false)}
          className="text-primary font-semibold hover:underline focus:outline-none"
        >
          Log in
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="from-background to-muted/40 flex min-h-screen items-center justify-center bg-radial px-4 py-12">
      {/* Screen Reader Live region for accessible mode announcements */}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {isMobile ? (
        // Mobile Layout (Stacked + Fades, no slide translation)
        <div className="border-border bg-card flex w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl">
          {/* Mobile Branding Banner */}
          <div className="flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-6 text-center text-white">
            <LineArtCat className="h-16 w-16 text-white" />
            <AnimatePresence mode="wait">
              <motion.div
                key={isSignup ? 'signup-mobile-title' : 'login-mobile-title'}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="space-y-1"
              >
                <h2 className="text-xl font-extrabold tracking-tight">
                  {isSignup ? 'Join your team' : 'Welcome back'}
                </h2>
                <p className="text-xs text-indigo-100/80">
                  {isSignup
                    ? 'Co-author document version histories in real-time.'
                    : 'Log in to continue to DocSync editor.'}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile Form container */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {isSignup ? renderSignupForm() : renderLoginForm()}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        // Desktop Layout (Centered 880px Card with coordinated sliding transition)
        <div className="border-border bg-card relative flex h-[580px] w-full max-w-[880px] flex-row overflow-hidden rounded-3xl border shadow-2xl">
          {/* 1. Branding / Marketing Slide Panel (translates left/right based on isSignup) */}
          <motion.div
            className="absolute top-0 bottom-0 left-0 z-10 flex h-full w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white"
            animate={{ x: isSignup ? '100%' : '0%' }}
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.45 }}
          >
            <AnimatePresence mode="wait">{renderBrandContent()}</AnimatePresence>
          </motion.div>

          {/* 2. Interactive Forms Slide Panel (translates right/left based on isSignup) */}
          <motion.div
            className="bg-card absolute top-0 right-0 bottom-0 z-0 flex h-full w-1/2 flex-col justify-center p-12"
            animate={{ x: isSignup ? '-100%' : '0%' }}
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.45 }}
          >
            <div className="flex w-full items-center justify-center">
              <AnimatePresence mode="wait">
                {isSignup ? renderSignupForm() : renderLoginForm()}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
