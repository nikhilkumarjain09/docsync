import { NextResponse } from 'next/server';

export function handleApiError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';

  if (
    name === 'ForbiddenError' ||
    message.includes('Unauthorized') ||
    message.includes('Forbidden')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ error: message || 'Internal server error' }, { status: 500 });
}
