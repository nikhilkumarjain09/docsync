import NextAuth from 'next-auth';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@docsync/db';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db as any),
  session: { strategy: 'jwt' },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Credentials({
      async authorize(credentials) {
        console.log('[AUTH DEBUG] authorize callback received credentials:', credentials);
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          console.log('[AUTH DEBUG] authorize parsing failed:', parsedCredentials.error.format());
          return null;
        }

        const { email, password } = parsedCredentials.data;
        const user = await db.user.findUnique({ where: { email } });
        console.log(
          '[AUTH DEBUG] authorize found user:',
          user ? { id: user.id, email: user.email } : null,
        );
        if (!user || !user.hashedPassword) {
          return null;
        }

        const passwordsMatch = await bcrypt.compare(password, user.hashedPassword);
        console.log('[AUTH DEBUG] authorize passwords match:', passwordsMatch);
        if (passwordsMatch) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      if (trigger === 'update' && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.picture = session.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
});
export type { Session } from 'next-auth';
export type { JWT } from 'next-auth/jwt';
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}
