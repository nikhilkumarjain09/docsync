import { z } from 'zod';

export * from './authorize';

// ─── Security Constants ──────────────────────────────────────────────────────
// These are shared between the HTTP API routes and the WebSocket relay server
// so that limits are consistent across all transport layers.

/** Maximum size of a single Yjs update in bytes (256KB). */
export const MAX_UPDATE_BYTES = 256 * 1024;

/** Maximum size of a single base64-encoded update string (~350KB covers 256KB binary). */
export const MAX_UPDATE_BASE64_LENGTH = 350_000;

/** Maximum number of updates allowed in a single sync HTTP request. */
export const MAX_UPDATES_PER_SYNC = 50;

/** Maximum length of a snapshot label. */
export const MAX_SNAPSHOT_LABEL_LENGTH = 200;

/** Maximum payload size for the sync HTTP endpoint (300KB). */
export const MAX_SYNC_PAYLOAD_BYTES = 300 * 1024;

/** Token bucket rate limiter defaults for WebSocket connections. */
export const RATE_LIMIT = {
  /** Maximum tokens (burst capacity). */
  MAX_TOKENS: 100,
  /** Tokens replenished per second. */
  REFILL_RATE: 50,
  /** Interval in ms between refills. */
  REFILL_INTERVAL_MS: 1000,
} as const;

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

/** Schema for the HTTP sync endpoint POST body. */
export const SyncPayloadSchema = z.object({
  updates: z
    .array(
      z.string().max(MAX_UPDATE_BASE64_LENGTH, {
        message: `Individual update exceeds maximum size of ${MAX_UPDATE_BASE64_LENGTH} characters`,
      }),
    )
    .max(MAX_UPDATES_PER_SYNC, {
      message: `Cannot send more than ${MAX_UPDATES_PER_SYNC} updates per request`,
    })
    .optional()
    .default([]),
  lastSeenLogId: z.string().nullable().optional().default(null),
});

/** Schema for the snapshot creation POST body. */
export const SnapshotCreateSchema = z.object({
  label: z
    .string()
    .max(MAX_SNAPSHOT_LABEL_LENGTH, {
      message: `Label cannot exceed ${MAX_SNAPSHOT_LABEL_LENGTH} characters`,
    })
    .optional()
    .default(''),
  /** Base64-encoded Y.Doc state from the client. When provided, the server
   *  uses this authoritative state instead of rebuilding from DB update logs,
   *  which avoids race conditions with async WebSocket persistence. */
  state: z.string().optional(),
});

/** Schema for WebSocket sync messages. */
export const WsSyncMessageSchema = z.object({
  type: z.literal('sync'),
  update: z.string().max(MAX_UPDATE_BASE64_LENGTH),
  id: z.string().optional(),
});

/** Schema for WebSocket awareness messages. */
export const WsAwarenessMessageSchema = z.object({
  type: z.literal('awareness'),
  update: z.any(),
});

/** Union schema for all valid WebSocket messages. */
export const WsMessageSchema = z.discriminatedUnion('type', [
  WsSyncMessageSchema,
  WsAwarenessMessageSchema,
]);

// ─── Legacy Schemas (kept for backwards compatibility) ───────────────────────

export const HandshakeSchema = z.object({
  token: z.string(),
  docId: z.string(),
});

export const SyncRequestSchema = z.object({
  docId: z.string(),
  update: z.string(),
});

export type HandshakeInput = z.infer<typeof HandshakeSchema>;
export type SyncRequestInput = z.infer<typeof SyncRequestSchema>;
export type SyncPayload = z.infer<typeof SyncPayloadSchema>;
export type SnapshotCreatePayload = z.infer<typeof SnapshotCreateSchema>;
export type WsMessage = z.infer<typeof WsMessageSchema>;
