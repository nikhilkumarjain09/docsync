import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentRole } from '@docsync/shared';
import { streamTextWithFallback, hasAiConfigured } from '@/lib/ai/ai-provider';
import { isRateLimited } from '@/lib/ai/rate-limit';
import { z } from 'zod';

const SummarizeSchema = z.object({
  text: z.string().min(1, 'Text content is required').max(500_000, 'Text content is too large'),
  documentId: z.string().min(1, 'Document ID is required'),
});

export async function POST(request: NextRequest) {
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

  if (isRateLimited(userId)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before trying again.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = SummarizeSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { text, documentId } = parseResult.data;

  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied: Not a collaborator' }, { status: 403 });
  }

  try {
    const stream = await streamTextWithFallback({
      system:
        'You are a professional editor. Summarize the following document content concisely in 2-3 bullet points.',
      prompt: `Document content to summarize:\n\n${text}`,
    });

    return stream.toTextStreamResponse();
  } catch (err: unknown) {
    console.error('[AI Summarize] Error generating summary:', err);
    return NextResponse.json({ error: 'Failed to process AI summary' }, { status: 500 });
  }
}
