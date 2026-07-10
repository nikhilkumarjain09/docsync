'use client';

import { useActionState, useEffect, useState, useRef, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logIn, signUp, resendVerification, verifyOtpAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  RefreshCw,
  Users,
  Shield,
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

/** Duration in ms to keep the password visible before auto-hiding (industry standard: 2-5s). */
const PASSWORD_REVEAL_DURATION_MS = 3000;

// Premium document synchronization card mockup graphic
function AuthGraphic() {
  return (
    <div className="relative flex w-full items-center justify-center py-4">
      <div className="bg-primary/20 absolute inset-0 rounded-full blur-3xl" />
      <div className="relative flex w-full max-w-[280px] flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="font-mono text-[10px] tracking-widest text-white/50 uppercase">
              Sync Status
            </span>
          </div>
          <RefreshCw
            className="h-3.5 w-3.5 animate-spin text-indigo-400"
            style={{ animationDuration: '4s' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-2.5 text-white">
            <FileText className="h-5 w-5 text-purple-300" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="h-2.5 w-24 rounded-sm bg-white/20" />
            <div className="h-2 w-16 rounded-sm bg-white/10" />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-white/60">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> 3 Online
          </span>
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-indigo-300" /> Secure
          </span>
        </div>
      </div>
    </div>
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

  // Email verification pending state
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>(
    'idle',
  );
  const [resendMessage, setResendMessage] = useState('');
  const [, startTransition] = useTransition();

  // Password visibility state with auto-hide timer
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);
  const [signupPasswordVisible, setSignupPasswordVisible] = useState(false);
  const loginPwTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signupPwTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // OTP Verification States
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  const otpRef0 = useRef<HTMLInputElement>(null);
  const otpRef1 = useRef<HTMLInputElement>(null);
  const otpRef2 = useRef<HTMLInputElement>(null);
  const otpRef3 = useRef<HTMLInputElement>(null);
  const otpRef4 = useRef<HTMLInputElement>(null);
  const otpRef5 = useRef<HTMLInputElement>(null);

  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3, otpRef4, otpRef5];

  const handleOtpChange = (index: number, value: string) => {
    // Only allow single digits
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    setOtpError('');

    // Shift focus forward if value is entered
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Shift focus backward on Backspace
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasteData)) {
      const digits = pasteData.split('');
      setOtpDigits(digits);
      setOtpError('');
      // Focus the last input
      otpRefs[5].current?.focus();
    }
  };

  const handleOtpSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingVerificationEmail || otpVerifying || otpSuccess) return;

    const code = otpDigits.join('');
    if (code.length !== 6) {
      setOtpError('Please enter all 6 digits of the code.');
      return;
    }

    setOtpVerifying(true);
    setOtpError('');

    try {
      const res = await verifyOtpAction(pendingVerificationEmail, code);
      if (res.success) {
        setOtpSuccess(true);
        // Clear all inputs
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1500);
      } else {
        setOtpError(res.error || 'Failed to verify code.');
        // Clear all inputs and focus the first one on error
        setOtpDigits(['', '', '', '', '', '']);
        otpRefs[0].current?.focus();
      }
    } catch {
      setOtpError('An unexpected error occurred. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  }, [otpDigits, pendingVerificationEmail, otpVerifying, otpSuccess, router, otpRefs]);

  // Auto-verify when all 6 digits are filled
  useEffect(() => {
    const isCompleted = otpDigits.every((digit) => digit !== '');
    if (isCompleted && pendingVerificationEmail && !otpSuccess && !otpVerifying) {
      handleOtpSubmit();
    }
  }, [otpDigits, pendingVerificationEmail, otpSuccess, otpVerifying, handleOtpSubmit]);

  const toggleLoginPassword = useCallback(() => {
    setLoginPasswordVisible((prev) => {
      if (loginPwTimerRef.current) clearTimeout(loginPwTimerRef.current);
      if (!prev) {
        loginPwTimerRef.current = setTimeout(
          () => setLoginPasswordVisible(false),
          PASSWORD_REVEAL_DURATION_MS,
        );
      }
      return !prev;
    });
  }, []);

  const toggleSignupPassword = useCallback(() => {
    setSignupPasswordVisible((prev) => {
      if (signupPwTimerRef.current) clearTimeout(signupPwTimerRef.current);
      if (!prev) {
        signupPwTimerRef.current = setTimeout(
          () => setSignupPasswordVisible(false),
          PASSWORD_REVEAL_DURATION_MS,
        );
      }
      return !prev;
    });
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (loginPwTimerRef.current) clearTimeout(loginPwTimerRef.current);
      if (signupPwTimerRef.current) clearTimeout(signupPwTimerRef.current);
    };
  }, []);

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
      setPendingVerificationEmail(null); // Clear pending state on navigation back/forward
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect on successful authentication, or trigger verification pending screen
  useEffect(() => {
    if (loginState?.success) {
      router.push('/');
      router.refresh();
      return;
    }

    if (signupState?.success) {
      if (signupState.emailVerified) {
        router.push('/');
        router.refresh();
      } else {
        Promise.resolve().then(() => {
          setPendingVerificationEmail(signupState.email || '');
        });
      }
    }
  }, [loginState, signupState, router]);

  // Intercept unverified logins to redirect to verification pending screen
  useEffect(() => {
    if (loginState?.error === 'EmailNotVerified') {
      Promise.resolve().then(() => {
        setPendingVerificationEmail(loginState.email || '');
      });
    }
  }, [loginState]);

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
        <AuthGraphic />
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
            placeholder="nikhiljain@docsync.dev"
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
          <div className="relative">
            <input
              id="password"
              name="password"
              type={loginPasswordVisible ? 'text' : 'password'}
              placeholder="••••••••"
              required
              className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-4 py-2.5 pr-11 text-sm transition-all outline-none focus:ring-2"
            />
            <button
              type="button"
              onClick={toggleLoginPassword}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors focus:outline-none"
              aria-label={loginPasswordVisible ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {loginPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {loginState?.error && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">
            {loginState.error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loginIsPending}
          className="w-full rounded-xl bg-violet-950 py-6 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:bg-violet-900 active:scale-[0.99]"
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
            placeholder="Nikhil Jain"
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
            placeholder="nikhiljain@docsync.dev"
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
          <div className="relative">
            <input
              id="signup-password"
              name="password"
              type={signupPasswordVisible ? 'text' : 'password'}
              placeholder="••••••••"
              required
              className="border-input bg-background focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-4 py-2.5 pr-11 text-sm transition-all outline-none focus:ring-2"
            />
            <button
              type="button"
              onClick={toggleSignupPassword}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors focus:outline-none"
              aria-label={signupPasswordVisible ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {signupPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {signupState?.error && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">
            {signupState.error}
          </div>
        )}

        <Button
          type="submit"
          disabled={signupIsPending}
          className="w-full rounded-xl bg-violet-950 py-6 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:bg-violet-900 active:scale-[0.99]"
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

  // Sub-component rendering for Verification Pending state
  const renderVerificationPending = () => {
    const handleResend = (e: React.FormEvent) => {
      e.preventDefault();
      if (!pendingVerificationEmail) return;

      setResendStatus('sending');
      setResendMessage('');

      startTransition(async () => {
        try {
          const res = await resendVerification(pendingVerificationEmail);
          if (res.success) {
            setResendStatus('success');
            setResendMessage('Verification code resent successfully.');
          } else {
            setResendStatus('error');
            setResendMessage(res.error || 'Failed to resend code.');
          }
        } catch {
          setResendStatus('error');
          setResendMessage('An error occurred. Please try again.');
        }
      });
    };

    if (otpSuccess) {
      return (
        <motion.div
          key="otp-success-screen"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="flex w-full flex-col items-center justify-center py-6 text-center"
        >
          {/* Premium Animated Green Checkmark SVG */}
          <div className="relative flex h-20 w-20 items-center justify-center">
            {/* Pulsing background outer ring */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.18, 1], opacity: [0.1, 0.25, 0.1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-emerald-500"
            />
            {/* Soft backdrop fill ring */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
              className="absolute inset-2 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"
            />
            {/* Self-drawing SVG path checkmark */}
            <svg className="h-9 w-9 text-emerald-500 z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.25 }}
            className="mt-6 space-y-2"
          >
            <h3 className="text-foreground text-2xl font-bold tracking-tight">Verification Successful!</h3>
            <p className="text-muted-foreground text-sm">
              Your account is active. Redirecting you to DocSync...
            </p>
          </motion.div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key="verification-pending-container"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="w-full space-y-6 text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10">
          <Mail className="h-7 w-7 text-indigo-500" />
        </div>

        <div className="space-y-2">
          <h3 className="text-foreground text-2xl font-bold tracking-tight">Verify your email</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We sent a verification code to <br />
            <strong className="text-foreground font-semibold text-wrap break-all">
              {pendingVerificationEmail}
            </strong>. <br />
            Enter the 6-digit code below to activate your account.
          </p>
        </div>

        {/* OTP Input Code Boxes */}
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div className="flex justify-center gap-2.5">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={otpRefs[index]}
                type="text"
                maxLength={1}
                inputMode="numeric"
                pattern="[0-9]*"
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                onPaste={index === 0 ? handleOtpPaste : undefined}
                disabled={otpVerifying || otpSuccess}
                className="border-input bg-background focus:border-primary focus:ring-primary/20 h-12 w-10 rounded-xl border text-center text-lg font-bold transition-all outline-none focus:ring-2 disabled:opacity-50 sm:h-14 sm:w-12"
              />
            ))}
          </div>

          {otpError && (
            <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">
              {otpError}
            </div>
          )}

          <Button
            type="submit"
            disabled={otpVerifying || otpSuccess || otpDigits.some((d) => d === '')}
            className="w-full rounded-xl bg-violet-950 py-6 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:bg-violet-900 active:scale-[0.99]"
          >
            {otpVerifying ? 'Verifying Code...' : 'Verify Code'}
          </Button>
        </form>

        <div className="border-t border-white/10 pt-4">
          <form onSubmit={handleResend} className="space-y-3">
            {resendMessage && (
              <div
                className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs leading-relaxed font-medium ${
                  resendStatus === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {resendStatus === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                {resendMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={resendStatus === 'sending' || otpSuccess}
              className="text-primary text-xs font-semibold hover:underline focus:outline-none disabled:opacity-50"
            >
              {resendStatus === 'sending' ? 'Resending Code...' : "Didn't get a code? Resend Code"}
            </button>
          </form>
          <p className="text-muted-foreground mt-3 text-[11px]">
            Tip: You can also verify by clicking the link in your email.
          </p>
        </div>

        <button
          type="button"
          disabled={otpVerifying || otpSuccess}
          onClick={() => {
            setPendingVerificationEmail(null);
            setResendStatus('idle');
            setResendMessage('');
            setOtpError('');
            setOtpDigits(['', '', '', '', '', '']);
          }}
          className="text-muted-foreground hover:text-foreground mx-auto flex items-center justify-center gap-1 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Sign In
        </button>
      </motion.div>
    );
  };

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
          <div className="flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 p-6 text-center text-white">
            <div className="rounded-xl bg-white/10 p-2.5 text-white">
              {pendingVerificationEmail ? (
                <Mail className="h-6 w-6 animate-pulse text-purple-300" />
              ) : (
                <FileText className="h-6 w-6 animate-pulse text-purple-300" />
              )}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={
                  pendingVerificationEmail
                    ? 'verify-mobile-title'
                    : isSignup
                      ? 'signup-mobile-title'
                      : 'login-mobile-title'
                }
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="space-y-1"
              >
                <h2 className="text-xl font-extrabold tracking-tight">
                  {pendingVerificationEmail
                    ? 'Verify your email'
                    : isSignup
                      ? 'Join your team'
                      : 'Welcome back'}
                </h2>
                <p className="text-xs text-indigo-100/80">
                  {pendingVerificationEmail
                    ? 'Check your inbox to activate your account.'
                    : isSignup
                      ? 'Co-author document version histories in real-time.'
                      : 'Log in to continue to DocSync editor.'}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile Form container */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {pendingVerificationEmail
                ? renderVerificationPending()
                : isSignup
                  ? renderSignupForm()
                  : renderLoginForm()}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        // Desktop Layout (Centered 880px Card with coordinated sliding transition)
        <div className="border-border bg-card relative flex h-[580px] w-full max-w-[880px] flex-row overflow-hidden rounded-3xl border shadow-2xl">
          {/* 1. Branding / Marketing Slide Panel (translates left/right based on isSignup, centers if verifying) */}
          <motion.div
            className="absolute top-0 bottom-0 left-0 z-10 flex h-full w-1/2 flex-col justify-between bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 p-12 text-white"
            animate={{ x: pendingVerificationEmail ? '0%' : isSignup ? '100%' : '0%' }}
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.45 }}
          >
            <AnimatePresence mode="wait">
              {pendingVerificationEmail ? (
                <motion.div
                  key="verify-brand"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full flex-col justify-between text-center sm:items-start sm:text-left"
                >
                  <div className="space-y-4">
                    <h2 className="text-3xl font-extrabold tracking-tight">Confirm your email</h2>
                    <p className="max-w-sm text-sm text-indigo-100/90">
                      We need to verify your email address to ensure your account security and
                      enable secure collaboration.
                    </p>
                  </div>
                  <div className="flex w-full items-center justify-center py-6">
                    <AuthGraphic />
                  </div>
                  <div className="text-xs text-indigo-200/70">
                    © {new Date().getFullYear()} DocSync. All rights reserved.
                  </div>
                </motion.div>
              ) : (
                renderBrandContent()
              )}
            </AnimatePresence>
          </motion.div>

          {/* 2. Interactive Forms Slide Panel (translates right/left based on isSignup, centers if verifying) */}
          <motion.div
            className="bg-card absolute top-0 right-0 bottom-0 z-0 flex h-full w-1/2 flex-col justify-center p-12"
            animate={{ x: pendingVerificationEmail ? '0%' : isSignup ? '-100%' : '0%' }}
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.45 }}
          >
            <div className="flex w-full items-center justify-center">
              <AnimatePresence mode="wait">
                {pendingVerificationEmail
                  ? renderVerificationPending()
                  : isSignup
                    ? renderSignupForm()
                    : renderLoginForm()}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
