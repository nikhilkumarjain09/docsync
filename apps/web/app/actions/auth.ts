'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from '@docsync/db';
import { signIn, auth } from '@/auth';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { sendVerificationEmail } from '@/lib/mail';

const CredentialsSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().optional(),
});

export async function signUp(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  const result = CredentialsSchema.safeParse({ email, password, name });
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  try {
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return { error: 'Email already registered' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const isTest = process.env.PLAYWRIGHT_TEST === 'true';

    // Create the user (auto-verified if running E2E tests)
    await db.user.create({
      data: {
        email,
        hashedPassword,
        name: name || null,
        emailVerified: isTest ? new Date() : null,
      },
    });

    if (isTest) {
      return { success: true, emailVerified: true, email };
    }

    // Generate secure 6-digit OTP code and a long secure token
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const secureToken = randomBytes(32).toString('hex');
    const token = `${otp}:${secureToken}`;
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    await db.verificationToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Send verification email
    await sendVerificationEmail(email, token);

    // Return status so UI knows to prompt for verification
    return { success: true, emailVerified: false, email };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as any).digest === 'string' &&
      (error as any).digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error;
    }
    console.error('Sign up error:', error);
    return { error: 'Something went wrong during sign up' };
  }
}

export async function logIn(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const result = CredentialsSchema.pick({ email: true, password: true }).safeParse({
    email,
    password,
  });

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  try {
    // Check if user exists and password is correct BEFORE signing in
    // to determine if they need email verification
    const user = await db.user.findUnique({ where: { email } });
    if (user && user.hashedPassword) {
      const passwordsMatch = await bcrypt.compare(password, user.hashedPassword);
      if (passwordsMatch && !user.emailVerified) {
        return { error: 'EmailNotVerified', email };
      }
    }

    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password' };
        default:
          return { error: 'Authentication failed' };
      }
    }
    throw error;
  }
}

/**
 * Resend verification token with rate limiting and secure token rotation
 */
export async function resendVerification(email: string) {
  if (!email || typeof email !== 'string') {
    return { error: 'Invalid email address' };
  }

  try {
    // 1. Check if user is already verified
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal account presence, act as if sent
      return { success: true };
    }

    if (user.emailVerified) {
      return { error: 'Email is already verified' };
    }

    // 2. Rate-limiting: Max 1 verification email every 60 seconds
    const latestToken = await db.verificationToken.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (latestToken) {
      const timeSinceLast = Date.now() - latestToken.createdAt.getTime();
      if (timeSinceLast < 60 * 1000) {
        const secondsRemaining = Math.ceil((60 * 1000 - timeSinceLast) / 1000);
        return {
          error: `Please wait ${secondsRemaining} seconds before requesting another email.`,
        };
      }
    }

    // 3. Invalidate/Delete old verification tokens
    await db.verificationToken.deleteMany({ where: { email } });

    // 4. Generate new token
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const secureToken = randomBytes(32).toString('hex');
    const token = `${otp}:${secureToken}`;
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    await db.verificationToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // 5. Send verification email
    await sendVerificationEmail(email, token);

    return { success: true };
  } catch (error) {
    console.error('[AUTH] Resend verification error:', error);
    return { error: 'Failed to resend verification email' };
  }
}

/**
 * Validates a verification token, updates user status to verified, and deletes token
 */
export async function verifyTokenAction(token: string) {
  if (!token || typeof token !== 'string') {
    return { error: 'Verification token is required.' };
  }

  try {
    // 1. Look up token in database
    const dbToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!dbToken) {
      return { error: 'This verification link is invalid or has already been used.' };
    }

    // 2. Check if token is expired
    if (dbToken.expires < new Date()) {
      // Invalidate expired token
      await db.verificationToken.delete({ where: { token } });
      return { error: 'This verification link has expired. Please request a new one.' };
    }

    // 3. Look up user
    const user = await db.user.findUnique({
      where: { email: dbToken.email },
    });

    if (!user) {
      return { error: 'No account associated with this verification link was found.' };
    }

    // 4. Mark user email as verified
    await db.user.update({
      where: { email: dbToken.email },
      data: { emailVerified: new Date() },
    });

    // Create sample document if user doesn't have any
    const docCount = await db.document.count({
      where: { ownerId: user.id },
    });
    if (docCount === 0) {
      await db.document.create({
        data: {
          title: 'Getting Started with DocSync 🚀',
          ownerId: user.id,
          collaborators: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });
    }

    // 5. Delete token to prevent reuse
    await db.verificationToken.delete({
      where: { token },
    });

    // Generate login token for auto-login
    const loginToken = randomBytes(32).toString('hex');
    await db.verificationToken.create({
      data: {
        email: user.email,
        token: `login:${loginToken}`,
        expires: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes expiry
      },
    });

    return { success: true, email: user.email, loginToken };
  } catch (error) {
    console.error('[AUTH] Token verification error:', error);
    return { error: 'Something went wrong during email verification.' };
  }
}

/**
 * Validates a 6-digit OTP code, updates user status to verified, and deletes token
 */
export async function verifyOtpAction(email: string, otp: string) {
  if (!email || !otp) {
    return { error: 'Email and verification code are required.' };
  }

  const cleanOtp = otp.trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    return { error: 'Verification code must be exactly 6 digits.' };
  }

  try {
    // 1. Look up the active verification token for this email
    const dbToken = await db.verificationToken.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (!dbToken) {
      return {
        error: 'No active verification code found for this email. Please request a new one.',
      };
    }

    // 2. Check if token has expired
    if (dbToken.expires < new Date()) {
      await db.verificationToken.deleteMany({ where: { email } });
      return { error: 'This verification code has expired. Please request a new one.' };
    }

    // 3. Extract and check the OTP part
    const [dbOtp] = dbToken.token.split(':');
    if (dbOtp !== cleanOtp) {
      return { error: 'Invalid verification code. Please check and try again.' };
    }

    // 4. Mark user email as verified
    const user = await db.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    // Create sample document if user doesn't have any
    const docCount = await db.document.count({
      where: { ownerId: user.id },
    });
    if (docCount === 0) {
      await db.document.create({
        data: {
          title: 'Getting Started with DocSync 🚀',
          ownerId: user.id,
          collaborators: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });
    }

    // 5. Delete all tokens for this email to prevent reuse
    await db.verificationToken.deleteMany({
      where: { email },
    });

    // Generate login token for auto-login
    const loginToken = randomBytes(32).toString('hex');
    await db.verificationToken.create({
      data: {
        email,
        token: `login:${loginToken}`,
        expires: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes expiry
      },
    });

    return { success: true, email, loginToken };
  } catch (error) {
    console.error('[AUTH] OTP verification error:', error);
    return { error: 'Something went wrong during code verification.' };
  }
}

/**
 * Updates the user's profile display name in the database.
 */
export async function updateProfileAction(name: string, image?: string) {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: 'Unauthorized. Please sign in.' };
  }

  const cleanName = name.trim();
  if (!cleanName) {
    return { error: 'Profile display name cannot be blank.' };
  }

  try {
    await db.user.update({
      where: { email: session.user.email },
      data: {
        name: cleanName,
        ...(image !== undefined && { image }),
      },
    });
    return { success: true };
  } catch (error) {
    console.error('[AUTH] Update profile error:', error);
    return { error: 'Failed to update profile details.' };
  }
}
