# DocSync

Local-first collaborative document editor.

## Architecture

- **Next.js app** (`/app`) → deployed to Vercel
- **WebSocket relay** (`/server/ws-relay`) → deployed to Fly.io / Railway (see [why it's separate](./server/ws-relay/README.md))
- **CRDT engine**: Yjs with y-indexeddb for offline-first local persistence
- **Auth**: Auth.js (NextAuth v5), JWT strategy
- **Database**: PostgreSQL via Prisma
- **AI**: Vercel AI SDK (Groq primary, Gemini fallback)

## Getting started

```bash
# Install dependencies
npm install
cd server/ws-relay && npm install && cd ../..

# Copy env vars
cp .env.example .env

# Start development
npm run dev           # Next.js app on :3000
cd server/ws-relay && npm run dev  # WS relay on :4444
```

## Scripts

| Command                | Description                    |
| ---------------------- | ------------------------------ |
| `npm run dev`          | Start Next.js dev server       |
| `npm run build`        | Production build               |
| `npm run lint`         | Run ESLint                     |
| `npm run format`       | Format all files with Prettier |
| `npm run format:check` | Check formatting               |

## Project structure

```
/app                 → Next.js routes (App Router)
/server/ws-relay     → Standalone WebSocket relay server
/lib/crdt            → Yjs doc setup, snapshot/restore
/lib/sync            → Outbox queue, reconciliation
/lib/db              → Prisma client, helpers
/prisma              → Schema + migrations
/components          → React components
/tests               → Vitest + Playwright tests
```

## Engineering Highlights & Scale Narrative

### 1. Document State-Size Growth & Compaction

As collaborative documents accumulate edit history over years, the raw Yjs update log can grow indefinitely, causing overhead during initial load. DocSync handles this through a **Compaction & Snapshotting** mechanism:

- When a user saves a version, the server reconstructs the Y.Doc state, extracts full-text headings/content, and collapses all previous update logs into a single compressed state vector stored in the `DocumentSnapshot` database table.
- The `latestSnapshot` field in the `Document` table stores the latest consolidated state. When new clients connect or sync, the system can serve the compacted snapshot rather than replaying millions of individual fine-grained keys from the update logs, effectively bounding transport size and memory overhead.

### 2. Architectural Two-Service Split

DocSync is split into two independent services:

- **Next.js Web Frontend** (deployed to Vercel/Serverless): Handles page routing, Auth.js session cookies, metadata API endpoints, AI actions, and static dashboards. This scales horizontally and benefits from serverless edge latency.
- **Stateful WebSocket Relay** (deployed to Fly.io/Railway/VM): WebSocket connections require long-lived TCP connections and stateful, persistent in-memory Yjs sync maps. Serverless functions are unfit for WebSockets due to execution timeouts and lack of shared memory. A dedicated VM runner manages connection states, authenticates sockets transitively via JWT cookies, and writes batched update streams back to the database.
