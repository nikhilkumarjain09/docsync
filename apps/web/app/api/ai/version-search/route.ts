import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { runWithUserContext } from '@docsync/db';
import { getDocumentRole } from '@docsync/shared';
import { generateTextWithFallback, hasAiConfigured } from '@/lib/ai/ai-provider';
import { isRateLimited } from '@/lib/ai/rate-limit';
import { z } from 'zod';

const SearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query is too long'),
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

  const parseResult = SearchSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { query, documentId } = parseResult.data;

  const role = await getDocumentRole(userId, documentId);
  if (!role) {
    return NextResponse.json({ error: 'Access denied: Not a collaborator' }, { status: 403 });
  }

  try {
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

    let parsedResult;
    try {
      const cleanJson = aiText.trim().replace(/^```json\s*|```$/g, '');
      parsedResult = JSON.parse(cleanJson);
    } catch {
      console.warn('[AI Search] Failed to parse JSON response:', aiText);
      parsedResult = {
        matchedSnapshotId: null,
        rationale: 'AI was unable to format the search matches. Please try search query again.',
      };
    }

    return NextResponse.json(parsedResult);
  } catch (err: unknown) {
    console.error('[AI Search] Semantic version search failed:', err);
    return NextResponse.json({ error: 'Failed to execute semantic search' }, { status: 500 });
  }
}
