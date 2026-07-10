import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, runWithUserContext } from '@docsync/db';
import { getDocumentRole } from '@docsync/shared';
import { generateTextWithFallback, hasAiConfigured } from '@/lib/ai/ai-provider';
import { z } from 'zod';

const SearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query is too long'),
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
  const parseResult = SearchSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { query, documentId } = parseResult.data;

  // 5. Auth-gate: Check if user is collaborator
  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied: Not a collaborator' }, { status: 403 });
  }

  try {
    // 6. Fetch snapshots for the document
    const snapshots = await runWithUserContext(userId, async (tx) => {
      return tx.documentSnapshot.findMany({
        where: { documentId },
        select: {
          id: true,
          label: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    if (snapshots.length === 0) {
      return NextResponse.json({
        matchedSnapshotId: null,
        rationale: 'No version checkpoints exist for this document yet.',
      });
    }

    // 7. Prompt the LLM to perform semantic search ranking
    const promptText = `
User Query: "${query}"

Version Checkpoints:
${snapshots.map((s, idx) => `[${idx}] ID: "${s.id}", Label: "${s.label || 'UnnamedCheckpoint'}", Saved At: ${new Date(s.createdAt).toLocaleString()}`).join('\n')}

Task: Determine which version checkpoint (from the list above) matches the user query.
Return your answer strictly as a JSON object containing two fields:
- matchedSnapshotId (string, the exact ID of the matching snapshot, or null if no snapshots match the query semantically)
- rationale (string, a short one-sentence explanation of why this snapshot matches or why none match)

Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or add text before/after.
`;

    const { text: aiText } = await generateTextWithFallback({
      system:
        'You are an AI assistant that finds and matches historical document checkpoints based on natural language queries.',
      prompt: promptText,
    });

    // Parse the JSON block cleanly
    let parsedResult;
    try {
      // Strip markdown code block formatting if returned
      const cleanJson = aiText.trim().replace(/^```json\s*|```$/g, '');
      parsedResult = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn('[AI Search] Failed to parse JSON response:', aiText);
      // Fallback response
      parsedResult = {
        matchedSnapshotId: null,
        rationale: 'AI was unable to format the search matches. Please try search query again.',
      };
    }

    return NextResponse.json(parsedResult);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[AI Search] Semantic version search failed:', errMsg);
    return NextResponse.json({ error: 'Failed to execute semantic search' }, { status: 500 });
  }
}
