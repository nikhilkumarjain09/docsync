import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentRole } from '@docsync/shared';
import { generateTextWithFallback, hasAiConfigured } from '@/lib/ai/ai-provider';
import { z } from 'zod';

const AssistSchema = z.object({
  text: z.string().min(1, 'Selection text is required').max(10_000, 'Selection is too large'),
  documentId: z.string().min(1, 'Document ID is required'),
  instruction: z.string().max(500).optional().default('improve grammar, clarity, and tone'),
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

  // 2. Graceful check for unconfigured keys
  if (!hasAiConfigured) {
    return NextResponse.json(
      { error: 'AI features are currently unavailable. Set GROQ_API_KEY or GEMINI_API_KEY.' },
      { status: 503 }
    );
  }

  // 3. Rate limiting check
  if (isRateLimited(userId)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before trying again.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // 4. Zod input validation
  const parseResult = AssistSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { text, documentId, instruction } = parseResult.data;

  // 5. Auth-gate: Check if user is collaborator
  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied: Not a collaborator' }, { status: 403 });
  }

  // Viewers cannot modify documents, so they shouldn't run writing assist
  if (role === 'VIEWER') {
    return NextResponse.json({ error: 'Access denied: Viewers cannot edit documents' }, { status: 403 });
  }

  try {
    // 6. Generate the improved paragraph suggestion
    const promptText = `
Paragraph to improve:
"${text}"

Instruction:
${instruction}

Task: Write the improved version of this paragraph. Focus on quality, grammar, flow, and clarity. Maintain the original message.
Return ONLY the raw improved paragraph text. Do not wrap it in quotes, markdown code blocks, or include introductory/explanatory sentences.
`;

    const { text: improvedText } = await generateTextWithFallback({
      system: 'You are an expert copywriter. Improve the text as requested, returning only the revised copy.',
      prompt: promptText,
    });

    return NextResponse.json({
      originalText: text,
      improvedText: improvedText.trim(),
    });
  } catch (e: any) {
    console.error('[AI Assist] Writing assist failed:', e.message);
    return NextResponse.json({ error: 'Failed to process writing assist' }, { status: 500 });
  }
}
