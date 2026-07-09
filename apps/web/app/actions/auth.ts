'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from '@docsync/db';
import { signIn } from '@/auth';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { z } from 'zod';

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
    await db.user.create({
      data: {
        email,
        hashedPassword,
        name: name || null,
      },
    });

    // Automatically sign in the user after successful sign up
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    return { success: true };
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
