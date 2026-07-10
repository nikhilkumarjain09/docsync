import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = request.cookies.get('__Secure-authjs.session-token')?.value 
    || request.cookies.get('authjs.session-token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Session token not found' }, { status: 404 });
  }

  const wsRelayUrl = process.env.WS_RELAY_URL || 'ws://localhost:4444';

  return NextResponse.json({ token, wsUrl: wsRelayUrl });
}
