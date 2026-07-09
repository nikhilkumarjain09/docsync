# DocSync Security Architecture

This document describes the security defenses implemented across the DocSync sync and relay layers, the threat model they address, and what is explicitly out of scope for a take-home project.

---

## 1. OOM Attack Vector: Oversized Payloads

### The Problem

A Yjs CRDT update produced by a single keystroke or paste operation is typically a few hundred bytes. However, without size limits, an attacker (or a buggy client) can POST or WebSocket-send a multi-megabyte payload containing:

- Arbitrarily large base64 strings that inflate into huge `Buffer` / `Uint8Array` allocations.
- Payloads that trigger expensive Yjs merge operations, consuming CPU and memory.
- Enough concurrent large payloads to exhaust Node.js heap memory (OOM kill).

This is a realistic attack because the sync endpoints accept raw binary data (Yjs updates are opaque byte sequences), making traditional input sanitization insufficient.

### Two-Layer Defense

| Layer | Where | Mechanism | Effect |
|-------|-------|-----------|--------|
| **Transport-level size cap** | `ws` library `maxPayload` option / HTTP `Content-Length` header check | Rejects the message **before the buffer is allocated** | Prevents OOM entirely — the server never reads the oversized payload into memory |
| **Application-level size cap** | Zod schema (`MAX_UPDATE_BASE64_LENGTH`) + binary byte check (`MAX_UPDATE_BYTES`) | Validates each individual update string after JSON parse | Catches payloads that slip past Content-Length (e.g., chunked transfer encoding, or many small updates that sum to a large total) |

**Constants** (defined in `@docsync/shared`):

- `MAX_UPDATE_BYTES`: 256 KB per individual Yjs update binary
- `MAX_UPDATE_BASE64_LENGTH`: 350,000 characters per base64 string (covers 256 KB with encoding overhead)
- `MAX_SYNC_PAYLOAD_BYTES`: 300 KB total HTTP request body
- `MAX_UPDATES_PER_SYNC`: 50 updates per HTTP sync request

---

## 2. Backpressure: Rate Limiting

### The Problem

Even if each message is under the size cap, a malicious client can flood the relay with thousands of tiny messages per second. Each message triggers:

1. JSON parsing
2. Zod validation
3. Yjs update application (CPU-intensive merge)
4. Postgres write (I/O)
5. Fan-out broadcast to all room clients

At sufficient volume, this exhausts CPU and starves legitimate clients.

### Token Bucket Rate Limiter

Each WebSocket connection gets its own `TokenBucket` instance:

- **Capacity**: 30 tokens (burst allowance)
- **Refill rate**: 10 tokens/second
- **Enforcement**: checked **before** JSON parsing, so the CPU cost of processing a flood is near zero

When the bucket is empty, messages are silently dropped. This is intentional — a legitimate collaborative editor generates at most a few updates per second; 30 tokens handles normal bursts (paste operations, rapid typing) while capping sustained throughput.

Rate-limit warnings are logged at intervals to avoid log flooding from the same mechanism that prevents message flooding.

---

## 3. Input Validation with Zod

Every HTTP API route validates its request body against a strict Zod schema **before any database operation**:

| Route | Schema | Validates |
|-------|--------|-----------|
| `POST /api/documents/[id]/sync` | `SyncPayloadSchema` | `updates` array (max 50 items, each string max 350K chars), `lastSeenLogId` nullable string |
| `POST /api/documents/[id]/snapshots` | `SnapshotCreateSchema` | `label` string (max 200 chars) |

WebSocket messages are validated against `WsMessageSchema` (discriminated union of `sync` and `awareness` types).

Malformed or oversized input returns `400 Bad Request` with structured error details. No malformed JSON ever reaches Prisma or the Yjs library.

---

## 4. Yjs Update Validation

Every call to `Y.applyUpdate()` in the codebase is wrapped in a `try/catch` block:

- **WebSocket relay** (`apps/ws-relay`): A corrupt update from one client is logged and discarded; other clients and their documents are unaffected.
- **HTTP routes** (snapshot creation, restore): Corrupt log entries are skipped with a warning; the operation completes using the remaining valid entries.
- **Hydration on connect**: Corrupt entries in the Postgres update log are skipped during initial state reconstruction.

This ensures that adversarial byte sequences (crafted to exploit Yjs internals) result in a logged warning and a rejected message — never an unhandled exception that crashes the relay process for every connected user.

---

## 5. Row-Level Security (Defense in Depth)

### Application-Level Checks

Every API route and WebSocket handshake independently verifies authorization:

| Surface | Auth Check | Role Check |
|---------|-----------|------------|
| WebSocket upgrade (`/doc/:id`) | JWT decode + verify | `getDocumentRole()` — reject if null |
| `POST /api/documents/[id]/sync` | `auth()` session | `getDocumentRole()` — reject if null |
| `GET /api/documents/[id]/snapshots` | `auth()` session | `getDocumentRole()` — reject if null |
| `POST /api/documents/[id]/snapshots` | `auth()` session | `getDocumentRole()` — OWNER or EDITOR only |
| `GET /api/documents/[id]/snapshots/[snapshotId]` | `auth()` session | `getDocumentRole()` — reject if null |
| `POST /api/documents/[id]/snapshots/[snapshotId]/restore` | `auth()` session | `getDocumentRole()` — OWNER or EDITOR only |

No route assumes "if they got this far they must be authorized."

### Database-Level RLS

PostgreSQL RLS policies are enabled and **forced** on all data tables (`Document`, `DocumentCollaborator`, `DocumentUpdateLog`, `DocumentSnapshot`). Every database query runs inside a transaction that sets `app.current_user_id` via `runWithUserContext()`.

**Why RLS is defense-in-depth, not the only check:**

1. **Application checks are faster** — they short-circuit before hitting the database, reducing load on Postgres.
2. **RLS catches bugs** — if a developer forgets to call `getDocumentRole()` in a new route, or accidentally uses `db.` instead of `runWithUserContext()`, RLS prevents data leakage at the database level.
3. **RLS is not role-aware** — it checks collaborator existence, not role (OWNER vs. VIEWER). Write restrictions (e.g., viewers can't push updates) are enforced at the application level.
4. **Defense-in-depth principle** — neither layer alone is sufficient; together they provide overlapping protection.

### RLS Integration Test

The test at `packages/db/src/test-rls.ts` connects to Postgres and verifies:

1. Query with empty/missing `app.current_user_id` → 0 rows
2. Query with a ghost user ID (no collaborator row) → 0 rows
3. Query with the document owner → 1 row
4. Query with a VIEWER collaborator → 1 row

To prove the test is not vacuously passing, temporarily comment out the RLS policies in the migration SQL and re-run — tests 1 and 2 will fail, demonstrating the policies are actively enforced.

---

## 6. Out of Scope

The following are explicitly out of scope for a take-home project but would be required for production:

| Concern | Why Out of Scope | Production Approach |
|---------|-----------------|---------------------|
| **Full DDoS protection** | Requires infrastructure-level mitigation (Cloudflare, AWS Shield) | Deploy behind a CDN/WAF with rate limiting at the edge |
| **Web Application Firewall (WAF)** | Platform-specific, not application code | Cloudflare WAF, AWS WAF, or equivalent |
| **IP-based rate limiting** | Requires reverse proxy or edge function | Nginx `limit_req`, Cloudflare rate limiting rules |
| **CSRF protection** | NextAuth handles this for session-based auth | Already handled by NextAuth's CSRF token |
| **Content Security Policy (CSP)** | Deployment-specific header configuration | Set via `next.config.ts` headers or reverse proxy |
| **Audit logging to external SIEM** | Requires infrastructure integration | Ship structured logs to Datadog/Splunk |
| **Encryption at rest** | Database-level configuration | Enable Postgres TDE or use encrypted storage volumes |
| **Penetration testing** | Requires dedicated security team | Engage third-party pentest firm before production launch |
