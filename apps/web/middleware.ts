import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // Protect all routes except static files, next internals, and auth endpoints.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public|login|signup).*)'],
};
