import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentRole } from '@docsync/shared';
import { streamTextWithFallback, hasAiConfigured } from '@/lib/ai/ai-provider';
import { z } from 'zod';

const SummarizeSchema = z.object({
  text: z.string().min(1, 'Text content is required').max(500_000, 'Text content is too large'),
  documentId: z.string().min(1, 'Document ID is required'),
});

// Simple in-memory rate limiter per user (max 10 requests per minute)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record) {
    rateLimitMap.set(userId, { count: 1, lastReset: now });
    return false;
  }

  if (now - record.lastReset > 60_000) {
    // Reset window after 1 minute
    rateLimitMap.set(userId, { count: 1, lastReset: now });
    return false;
  }

  if (record.count >= 10) {
    return true;
  }

  record.count++;
  return false;
}

export async function POST(request: NextRequest) {
  // 1. Session verification
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  if (!hasAiConfigured) {
    return NextResponse.json(
      {
        error:
          'AI features are currently unavailable. Set GROQ_API_KEY, NVIDIA_API_KEY, or GEMINI_API_KEY.',
      },
      { status: 503 },
    );
  }

  // 3. Rate limiting check
  if (isRateLimited(userId)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before trying again.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // 4. Zod input validation
  const parseResult = SummarizeSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { text, documentId } = parseResult.data;

  // 5. Auth-gate: Check if user is collaborator
  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied: Not a collaborator' }, { status: 403 });
  }

  try {
    // 6. Stream summary back to client
    const stream = await streamTextWithFallback({
      system:
        'You are a professional editor. Summarize the following document content concisely in 2-3 bullet points.',
      prompt: `Document content to summarize:\n\n${text}`,
    });

    return stream.toTextStreamResponse();
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[AI Summarize] Error generating summary:', errMsg);
    return NextResponse.json({ error: 'Failed to process AI summary' }, { status: 500 });
  }
}
