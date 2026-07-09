import { z } from 'zod';

export * from './authorize';

export const HandshakeSchema = z.object({
  token: z.string(),
  docId: z.string(),
});

export const SyncRequestSchema = z.object({
  docId: z.string(),
  update: z.string(), // Base64 represented update string
});

export type HandshakeInput = z.infer<typeof HandshakeSchema>;
export type SyncRequestInput = z.infer<typeof SyncRequestSchema>;
