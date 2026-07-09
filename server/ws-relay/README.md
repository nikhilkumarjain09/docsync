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

## Getting started

```bash
cd server/ws-relay
npm install
npm run dev    # starts relay with tsx --watch
```

## Build & deploy

```bash
npm run build  # compiles TS → dist/
npm start      # runs compiled JS (production)
```
