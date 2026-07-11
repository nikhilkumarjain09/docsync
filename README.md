# DocSync

DocSync is a local-first collaborative document editor designed to operate seamlessly under intermittent network conditions. By using CRDT state vectors for eventual consistency and storing client edits in local IndexedDB outbox queues, DocSync ensures zero-conflict merging and data persistence even through complete page reloads and network drops.

- **Live Demo**: [docsync-prod.vercel.app](https://docsync-prod.vercel.app)
- **Video Walkthrough**: [Loom Walkthrough Demonstration](https://www.loom.com/share/docsync-walkthrough-placeholder)

---

## Architecture Overview

DocSync uses a split-service architecture separating stateless edge routes from stateful persistent servers:

- **The CRDT Engine (Yjs)**: Conflict-free Replicated Data Types (CRDTs) ensure Strong Eventual Consistency (SEC). Edits are modeled as commutative operations, removing the need for locking mechanisms or complex central coordination.
- **Stateless Next.js Frontend (Vercel)**: Next.js handles user routing, NextAuth authentication, search querying, document metadata updates, and AI popover assistants. Serving this over Vercel's serverless edge optimizes static resource delivery.
- **Stateful WebSocket Relay (Fly.io)**: A dedicated VM process handles long-lived client socket connections, tracks cursor awareness states, and pipes batched document update logs back to the database.

```mermaid
graph TD
  subgraph Client [Client Browser]
    Editor[ProseMirror / Tiptap] <-->|Real-time Bindings| YDoc[Yjs Document]
    YDoc <-->|Local Cache / Outbox| IndexedDB[(IndexedDB Outbox)]
  end

  subgraph WebService [Next.js App on Vercel]
    NextApp[Next.js App / Pages / Auth] <-->|Prisma ORM| Postgres[(PostgreSQL Database)]
  end

  subgraph SyncService [WebSocket Relay on VM]
    RelayServer[WS Relay Server] <-->|Prisma ORM| Postgres
  end

  Client <-->|HTTP API Sync & Metadata| NextApp
  Client <-->|WebSocket Stream / Upgrades| RelayServer
```

---

## Technology Stack

| Layer                       | Technology                                                 | Role                                                            |
| --------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| **Frontend**                | Next.js 15 (App Router), Tiptap / ProseMirror, Vanilla CSS | Document workspace UI, metadata configuration, editor workspace |
| **Backend/Relay**           | Node.js, `ws` (WebSockets), `yjs` (CRDT)                   | Real-time state replication, cursor awareness, and active sync  |
| **Database/ORM**            | PostgreSQL, Prisma ORM                                     | Document snapshots, user collaborators, and update logs         |
| **Authentication**          | Auth.js (NextAuth v5), JWE/JWT Tokens                      | Secure session propagation and transit socket handshakes        |
| **Artificial Intelligence** | Vercel AI SDK, Groq (Primary LLM), Gemini (Fallback LLM)   | Document summary, writing assistant, and semantic search        |
| **Deployment**              | Vercel (Frontend), Fly.io (WS Relay Server)                | Scalable edge CDN hosting and stateful container execution      |

---

## Features

### 1. Collaborative Sync & Distributed Logic (Core)

- **Local-First Synchronization**: Changes immediately update the local database cache and outbox queues before network transmission.
- **Offline Eventual Consistency**: Edits survive offline sessions and converge cleanly on reconnection without conflict dialogs.
- **Granular Role Authorization**: Strict `OWNER`, `EDITOR`, and `VIEWER` checks validated on every transaction context.
- **Compacted Snapshots**: Named version checkpoints that collapse historical delta streams into single state vectors.

### 2. Editor & UX Features

- **Notion-Style Slash Menu**: Popovers to add headings, task lists, bullet guides, KaTeX math blocks, and tables.
- **Visual Connection Pill**: Pulsing connection state indicator (`Syncing...`, `Online`, `Offline`).
- **Custom Scrollbars & Preview Sheets**: Elegant preview cards and slim scrollbars styled using HSL variables.

### 3. AI Copilot features

- **Inline Selection Assist**: Popover to improve grammar, rewrite tones, or fix phrasing on highlighted segments.
- **Dynamic Document Summarization**: Multi-point summary generators that run on current document buffers.
- **Semantic Version Search**: LLM semantic matching of version timeline history using natural query descriptions.

---

## Engineering Highlights

### 1. CRDT Merge Convergence Proof

Our unit test suite contains the test `PROVES CRDT MERGE DETERMINISM` in [crdt.test.ts](file:///e:/DocSync/apps/web/tests/unit/crdt.test.ts#L26-L85). It asserts that applying collaborative update bytes in opposite orders on independent clients converges to the exact same serialized state.

### 2. Restore-as-Forward-Update

To prevent concurrent editing histories from being wiped out when restoring a version checkpoint, DocSync uses a **Forward-Update Restore** pattern. Instead of resetting database tables, the system calculates the delta between the target checkpoint and the current state, committing it as a new transaction update that is propagated forward. This is verified by `PROVES RESTORE-AS-FORWARD-UPDATE` in [crdt.test.ts](file:///e:/DocSync/apps/web/tests/unit/crdt.test.ts#L90-L150).

### 3. Outbox Memory & OOM Defenses

Payload allocations are protected through a three-layer boundary system:

- **HTTP Transport Cap**: Content-Length headers are checked before reading body buffers to reject massive payloads early.
- **Array Size Constraints**: Requests containing more than 50 updates are rejected by Zod validation.
- **Binary Boundary Validation**: Individual update buffers are restricted to `MAX_UPDATE_BYTES` (150 KB) to prevent system heap exhaustion.

### 4. Next.js Bundle Splitting

By separating heavy client-only packages (Tiptap and KaTeX engines) from landing workflows using `next/dynamic` chunk loaders (`ssr: false`), we reduced the initial JavaScript footprint of the document list dashboard page by over **450kB**.

---

## Local Setup

### 1. Prerequisites

- Node.js v20+ and `pnpm` installed.
- PostgreSQL database running (or Docker installed).

### 2. Database & Environment Setup

Start the local PostgreSQL container:

```bash
pnpm dev:db
```

Copy and fill out the environment variables files. Create `.env` in the root and `apps/web/.env`:

```bash
# Root .env and apps/web/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docsync?connection_limit=30"
AUTH_SECRET="your-32-character-auth-secret-key"
WS_RELAY_URL="ws://localhost:4444"
AUTH_TRUST_HOST="true"
```

### 3. Install Dependencies & Build

Install workspace dependencies and compile monorepo packages:

```bash
pnpm install
pnpm build
```

### 4. Run Dev Servers

Start both the Next.js client app and the WebSocket relay server concurrently:

```bash
pnpm dev
```

- Frontend client: [http://localhost:3000](http://localhost:3000)
- WebSocket relay: `ws://localhost:4444`

---

## Architectural Deep-Dives

Detailed write-ups on caching, deployment topology, and vulnerability mitigation are available in the project documentation:

- **Security & RLS Policies**: See [Security Architecture](file:///e:/DocSync/docs/security.md)
- **Database & Route Caching Strategy**: See [Caching Strategy](file:///e:/DocSync/docs/caching-strategy.md)
- **Deployment Topology Guide**: See [Deployment Guide](file:///e:/DocSync/docs/deployment.md)
- **Verification & Testing Status**: See [Final Evaluation](file:///e:/DocSync/docs/final-evaluation.md)

---

## Real-World Considerations

### 1. Bounded Document Growth (Compaction)

In production, collaborative documents that run for years accumulate millions of fine-grained update records. servining this cumulative history during socket connection is prohibitive. DocSync bounds this log size by writing consolidated Y.Doc updates to the `latestSnapshot` field in the database during snapshots, allowing client initializations to skip history replays.

### 2. OOM/Malformed Payload Mitigations

Malicious clients or out-of-sync clients could send massive payload objects that overwhelm the heap allocation. DocSync implements strict transport sizing controls, returning `413 Payload Too Large` prior to stream buffer evaluation.

### 3. Relay Hosting Tradeoffs (Fly.io)

We selected containerized hosting (Fly.io) over serverless environments due to WebSocket process longevity requirements. The tradeoff is cold-start latencies: Fly.io free container tiers suspend processes after inactivity, resulting in a 2–3s connection latency for the first client upgrade while the server spins back up.

### 4. Connection Pooling Status

A PostgreSQL connection pool limit is configured (`connection_limit=30`) inside [schema.prisma](file:///e:/DocSync/packages/db/prisma/schema.prisma). Without this pool cap, rapid synchronization sweeps during massive concurrent traffic would exhaust the database's available socket connections, causing transaction timeouts.

### 5. Observability Gaps

No formal APM monitoring systems (like Sentry or Datadog) are currently wired up in the production containers. Production failures are logged to stdout and monitored using standard container platform log streams, representing a maintenance gap.

### 6. Postgres Backup Posture

No custom backup replication strategy is active. The system relies entirely on the hosting provider's automated daily snapshots and point-in-time recovery (PITR) features.

---

## Future Enhancements / Roadmap

### 1. Object Storage & File Uploads (Deferred)

Instead of local asset uploads, DocSync will transition to an **R2/S3 Presigned Upload** model. The client queries the API to receive a secure, short-lived PUT URL with a strict size cap of 25MB enforced at the object store level, bypassing server CPU constraints.

### 2. Inline Threaded Comments (Deferred)

Threaded comments will use Yjs relative-position anchors (`Y.RelativePosition`). Comment threads remain anchored to specific text indices even as surrounding blocks are deleted or modified. The message updates will sync in real-time over the existing WebSocket relay protocol.

### 3. Enterprise Cross-Document AI Queries

Upgraded AI layers will feature cross-document semantic indexing (RAG). Documents will compile into vector embeddings stored in a vector database (like pgvector), enabling users to query context across all workspaces.

### 4. Typesense/Meilisearch Upgrades

Rather than using heavy search clusters like Elasticsearch, full-text fuzzy queries will route to **Typesense/Meilisearch**. These are lightweight, typo-tolerant alternatives that run with low memory footprints. Document changes will be indexed asynchronously on snapshots and save actions rather than on every keystroke, decoupling search indexing from real-time CRDT streams.

---

## Enterprise-Scale Enhancements

- **Multi-Tenant Workspaces**: Organization schemas to isolate user spaces and manage team directories.
- **SSO/SAML Access Control**: Integration with corporate identity providers (OIDC/SAML) for SSO and user provisioning via SCIM.
- **SOC 2 Audit Trail Logging**: Dedicated immutable database logs tracking access records, permission alterations, and document updates.
- **WebSocket Horizontal Scaling**: An in-memory Redis Pub/Sub backplane that distributes update broadcasts for a single document across multiple VM processes.
- **Read Replicas & Database Sharding**: Partitioning update logs by document ID range, and offloading read queries to dedicated replicas.
- **APM Alerting Integration**: Continuous metrics monitoring via DataDog or New Relic to track latency spikes and server memory leaks.
- **Granular Folder Permissions**: Workspace permission inheritance matrices supporting custom user permissions.
- **Data Residency Isolation**: Region-pinned deployment environments to comply with GDPR and geographic data laws.

---

## Developer Profile

- **Developer Name**: Nikhil Kumar Jain
- **GitHub Profile**: [nikhilkumarjain09](https://github.com/nikhilkumarjain09)
- **LinkedIn Profile**: [Nikhil Kumar Jain](https://www.linkedin.com/in/nikhilkumarjain09)
