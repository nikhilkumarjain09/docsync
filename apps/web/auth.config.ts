import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';

export const authConfig = {
  providers: [
    // GitHub provider is conditionally configured based on env presence.
    // It will be filtered/configured in the main auth.ts but we register
    // the definition skeleton here.
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Credentials({
      async authorize(credentials) {
        // Validation and DB query will be handled in auth.ts
        // which runs in Node.js runtime environment (not Edge).
        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
    newUser: '/signup',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isApiRoute = nextUrl.pathname.startsWith('/api');
      const isAuthPage = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/signup');

      // Allow API routes to perform their own auth checking.
      if (isApiRoute) {
        return true;
      }

      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/', nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
