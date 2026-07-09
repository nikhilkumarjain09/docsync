# DocSync — WebSocket Relay Server

## Why is this a separate package?

Next.js serverless functions (on Vercel, Netlify, etc.) are designed for
short-lived request/response cycles. They **cannot hold persistent WebSocket
connections** — the function spins up, handles one HTTP request, and gets torn
down by the platform.

Real-time collaborative editing requires long-lived bidirectional connections
between every client and a relay that broadcasts Yjs document updates. That
means the WebSocket server must run as a **standalone, always-on Node.js
process** — not as a Next.js API route.

### Deployment split

| Service         | Deploys to       | Why                                     |
| --------------- | ---------------- | --------------------------------------- |
| Next.js app     | Vercel           | SSR, API routes, static assets          |
| WS relay server | Fly.io / Railway | Long-lived WebSocket connections needed |

This is a **deliberate architectural decision**, not an oversight.

## Environment Variables WARNING

> [!WARNING]
> Both `apps/web/` and `apps/ws-relay/` require their own `.env` files.
> You **MUST** ensure that `DATABASE_URL` and `AUTH_SECRET` match exactly across both configurations:
> - If `DATABASE_URL` differs, they will point to different databases and updates won't synchronize.
> - If `AUTH_SECRET` differs, JWT session verification on the WebSocket handshake will silently fail, rejecting all client connections.

## Getting started

```bash
# From the workspace root:
pnpm --filter ws-relay dev
```

## Build & deploy

```bash
pnpm --filter ws-relay build
pnpm --filter ws-relay start
```
