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
