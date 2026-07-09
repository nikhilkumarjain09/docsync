import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // NextAuth v5 session cookie key prefix depends on environmental security
  const isProd = process.env.NODE_ENV === 'production';
  const cookieName = isProd 
    ? '__Secure-authjs.session-token' 
    : 'authjs.session-token';

  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Session token not found' }, { status: 404 });
  }

  return NextResponse.json({ token });
}
