# DocSync — Next.js Web App

This is the Next.js web application for DocSync, providing the collaboration user interface, authentication, and API endpoints.

## Environment Variables WARNING

> [!WARNING]
> Both `apps/web/` and `apps/ws-relay/` require their own `.env` files.
> You **MUST** ensure that `DATABASE_URL` and `AUTH_SECRET` match exactly across both configurations:
> - If `DATABASE_URL` differs, they will point to different databases and updates won't synchronize.
> - If `AUTH_SECRET` differs, JWT session verification on the WebSocket handshake in the relay will silently fail, rejecting all client connections.

## Getting Started

To run the Next.js app in development:

```bash
pnpm --filter web dev
```

To build and start for production:

```bash
pnpm --filter web build
pnpm --filter web start
```
