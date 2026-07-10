import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, generateText } from 'ai';

// Keep this export for backward compatibility with route gates
export const hasAiConfigured = true;

/**
 * Streams text output using first-available provider with fallback (Groq -> NVIDIA -> Gemini).
 */
export async function streamTextWithFallback({
  system,
  prompt,
}: {
  system?: string;
  prompt: string;
}) {
  const groqKey = process.env.GROQ_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !nvidiaKey && !geminiKey) {
    throw new Error(
      'AI features are not configured. Set GROQ_API_KEY, NVIDIA_API_KEY, or GEMINI_API_KEY.',
    );
  }

  // 1. Try Groq
  if (groqKey) {
    try {
      console.log('[AI] Attempting text stream with primary provider: Groq (Llama)');
      const groq = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: groqKey,
      });
      return await streamText({
        model: groq('llama-3.3-70b-versatile'),
        system,
        prompt,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[AI] Groq streaming failed, attempting fallback:', errMsg);
    }
  }

  // 2. Try NVIDIA
  if (nvidiaKey) {
    try {
      console.log('[AI] Attempting text stream with secondary provider: NVIDIA (Llama)');
      const nvidia = createOpenAI({
        baseURL: 'https://integrate.api.nvidia.com/v1',
        apiKey: nvidiaKey,
      });
      return await streamText({
        model: nvidia('meta/llama-3.3-70b-instruct'),
        system,
        prompt,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[AI] NVIDIA streaming failed, attempting fallback:', errMsg);
    }
  }

  // 3. Try Gemini
  if (geminiKey) {
    console.log('[AI] Attempting text stream with tertiary provider: Gemini (Flash)');
    const google = createGoogleGenerativeAI({
      apiKey: geminiKey,
    });
    return await streamText({
      model: google('gemini-2.0-flash'),
      system,
      prompt,
    });
  }

  throw new Error('No configured AI provider succeeded.');
}

/**
 * Generates text output using first-available provider with fallback (Groq -> NVIDIA -> Gemini).
 */
export async function generateTextWithFallback({
  system,
  prompt,
}: {
  system?: string;
  prompt: string;
}) {
  const groqKey = process.env.GROQ_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !nvidiaKey && !geminiKey) {
    throw new Error(
      'AI features are not configured. Set GROQ_API_KEY, NVIDIA_API_KEY, or GEMINI_API_KEY.',
    );
  }

  // 1. Try Groq
  if (groqKey) {
    try {
      console.log('[AI] Attempting generation with primary provider: Groq (Llama)');
      const groq = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: groqKey,
      });
      return await generateText({
        model: groq('llama-3.3-70b-versatile'),
        system,
        prompt,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[AI] Groq generation failed, attempting fallback:', errMsg);
    }
  }

  // 2. Try NVIDIA
  if (nvidiaKey) {
    try {
      console.log('[AI] Attempting generation with secondary provider: NVIDIA (Llama)');
      const nvidia = createOpenAI({
        baseURL: 'https://integrate.api.nvidia.com/v1',
        apiKey: nvidiaKey,
      });
      return await generateText({
        model: nvidia('meta/llama-3.3-70b-instruct'),
        system,
        prompt,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[AI] NVIDIA generation failed, attempting fallback:', errMsg);
    }
  }

  // 3. Try Gemini
  if (geminiKey) {
    console.log('[AI] Attempting generation with tertiary provider: Gemini (Flash)');
    const google = createGoogleGenerativeAI({
      apiKey: geminiKey,
    });
    return await generateText({
      model: google('gemini-2.0-flash'),
      system,
      prompt,
    });
  }

  throw new Error('No configured AI provider succeeded.');
}
