import { z } from 'zod';

export * from './authorize';

export const HandshakeSchema = z.object({
  token: z.string(),
  docId: z.string().uuid(),
});

export const SyncRequestSchema = z.object({
  docId: z.string().uuid(),
  update: z.string(), // Base64 or binary represented as string
});

export type HandshakeInput = z.infer<typeof HandshakeSchema>;
export type SyncRequestInput = z.infer<typeof SyncRequestSchema>;
