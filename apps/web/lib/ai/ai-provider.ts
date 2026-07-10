import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, generateText } from 'ai';

const groqApiKey = process.env.GROQ_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

export const hasAiConfigured = !!(groqApiKey || geminiApiKey);

// Initialize Groq provider (using OpenAI-compatible SDK configured for Groq)
const groq = groqApiKey
  ? createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: groqApiKey,
    })
  : null;

// Initialize Google Gemini provider
const google = geminiApiKey
  ? createGoogleGenerativeAI({
      apiKey: geminiApiKey,
    })
  : null;

/**
 * Streams text output using Groq (Llama) as primary, falling back to Gemini (Flash) if Groq fails or is unconfigured.
 */
export async function streamTextWithFallback({
  system,
  prompt,
}: {
  system?: string;
  prompt: string;
}) {
  if (!hasAiConfigured) {
    throw new Error('AI features are not configured. Set GROQ_API_KEY or GEMINI_API_KEY.');
  }

  if (groq) {
    try {
      console.log('[AI] Attempting text stream with primary provider: Groq (Llama)');
      return await streamText({
        model: groq('llama-3.3-70b-specdec'),
        system,
        prompt,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[AI] Groq streaming failed, attempting fallback to Gemini:', errMsg);
      if (google) {
        return await streamText({
          model: google('gemini-2.0-flash'),
          system,
          prompt,
        });
      }
      throw err;
    }
  }

  if (google) {
    console.log('[AI] Groq unconfigured. Streaming directly with Gemini (Flash)');
    return await streamText({
      model: google('gemini-2.0-flash'),
      system,
      prompt,
    });
  }

  throw new Error('No active AI provider configured.');
}

/**
 * Generates text output using Groq as primary, falling back to Gemini if Groq fails or is unconfigured.
 */
export async function generateTextWithFallback({
  system,
  prompt,
}: {
  system?: string;
  prompt: string;
}) {
  if (!hasAiConfigured) {
    throw new Error('AI features are not configured. Set GROQ_API_KEY or GEMINI_API_KEY.');
  }

  if (groq) {
    try {
      console.log('[AI] Attempting generation with primary provider: Groq (Llama)');
      return await generateText({
        model: groq('llama-3.3-70b-specdec'),
        system,
        prompt,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[AI] Groq generation failed, attempting fallback to Gemini:', errMsg);
      if (google) {
        return await generateText({
          model: google('gemini-2.0-flash'),
          system,
          prompt,
        });
      }
      throw err;
    }
  }

  if (google) {
    console.log('[AI] Groq unconfigured. Generating directly with Gemini (Flash)');
    return await generateText({
      model: google('gemini-2.0-flash'),
      system,
      prompt,
    });
  }

  throw new Error('No active AI provider configured.');
}
