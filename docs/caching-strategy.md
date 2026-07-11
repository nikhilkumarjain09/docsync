# Caching & Query Performance Strategy

This document outlines the caching policies, data loading structures, and database query index analysis implemented in DocSync.

---

## 1. Route-Level Caching Policy

Deterministic conflict resolution and real-time collaboration depend on fetching fresh state. Accidental or default Next.js caching would result in stale CRDT merges, collaborator state desynchronization, and silent data loss.

### A. Live Document & CRDT State Endpoints

- **Routes**:
  - `/api/documents/[id]/sync`
  - `/api/documents/[id]/snapshots`
  - `/api/documents/[id]/snapshots/[snapshotId]`
  - `/api/documents/[id]/collaborators`
  - `/api/documents`
  - `/api/documents/[id]`
  - `/api/documents/favorites`
  - `/api/documents/trash`
  - `/api/documents/search`
- **Policy**: `export const dynamic = 'force-dynamic'` (Dynamic Rendering / No Cache).
- **Rationale**: These endpoints directly read and write live database records related to CRDT document updates, collaborator statuses, and search parameters. Stale cached results would cause client-side local-first synchronization engines to loop or merge incorrect changes.

### B. Static & Read-Mostly Paths

- **Routes**: `/login`, `/signup`, `/verify`, `/icon.png`
- **Policy**: Standard static page generation (SSG) / ISR.
- **Rationale**: Rare updates; static HTML compilation ensures instant loads and minimal server-side compute.

---

## 2. Server/Client Renders Division

To achieve high perceived rendering speeds (no initial client-side spinner) and zero prefetch pollution:

1. **Server Component (`app/(app)/page.tsx`)**:
   - Performs direct database fetches for active user documents on the server.
   - Computes stats (Total, Owned, Shared, Active Today) and pre-renders the dashboard layout container.
2. **Client Component (`components/shell/dashboard-client.tsx`)**:
   - Hydrates the interactive elements: view mode toggles, filter chips, and dialogs.
   - Leverages React dynamic imports with `ssr: false` to bundle Tiptap and its rich editor extensions into a separate split chunk, only loaded when navigating to `/documents/[id]`.

---

## 3. Database Indexes & Query Plans

We validated the query execution plans on PostgreSQL using `EXPLAIN ANALYZE`.

### Query A: Sync Pull Query (Append-only CRDT Update Logs)

- **SQL**:
  ```sql
  EXPLAIN ANALYZE SELECT * FROM "DocumentUpdateLog" WHERE "documentId" = 'some-doc-id' ORDER BY "createdAt" ASC;
  ```
- **Execution Plan**:
  ```
  Sort  (cost=8.31..8.31 rows=1 width=133) (actual time=0.239..0.275 rows=0 loops=1)
    Sort Key: "createdAt"
    Sort Method: quicksort  Memory: 25kB
    ->  Index Scan using "DocumentUpdateLog_documentId_idx" on "DocumentUpdateLog"  (cost=0.28..8.30 rows=1 width=133) (actual time=0.072..0.107 rows=0 loops=1)
          Index Cond: ("documentId" = 'some-doc-id'::text)
  Planning Time: 1.492 ms
  Execution Time: 0.380 ms
  ```
- **Analysis**: The query optimizer performs a direct **Index Scan** using `"DocumentUpdateLog_documentId_idx"`. This avoids a full table sequence scan and queries logs in sub-millisecond time.

### Query B: Document List Query (Dashboard)

- **SQL**:
  ```sql
  EXPLAIN ANALYZE SELECT * FROM "Document" d
  WHERE EXISTS (
    SELECT 1 FROM "DocumentCollaborator" c
    WHERE c."documentId" = d.id AND c."userId" = 'some-user-id'
  )
  ORDER BY d."updatedAt" DESC;
  ```
- **Execution Plan**:
  ```
  Sort  (cost=6.04..6.05 rows=1 width=428) (actual time=0.146..0.148 rows=0 loops=1)
    Sort Key: d."updatedAt" DESC
    Sort Method: quicksort  Memory: 25kB
    ->  Hash Join  (cost=3.09..6.03 rows=1 width=428) (actual time=0.135..0.137 rows=0 loops=1)
          Hash Cond: (d.id = c."documentId")
          ->  Seq Scan on "Document" d  (cost=0.00..2.74 rows=74 width=428) (actual time=0.007..0.007 rows=1 loops=1)
          ->  Hash  (cost=3.08..3.08 rows=1 width=26) (actual time=0.019..0.019 rows=0 loops=1)
                ->  Seq Scan on "DocumentCollaborator" c  (cost=0.00..3.08 rows=1 width=26) (actual time=0.018..0.018 rows=0 loops=1)
                      Filter: ("userId" = 'some-user-id'::text)
  Planning Time: 2.082 ms
  Execution Time: 0.189 ms
  ```
- **Analysis**: Under minimal data (fewer than 100 rows), PostgreSQL uses a sequence scan due to low table overhead. In order to optimize for scale, we created a index `@@index([userId])` on the `DocumentCollaborator` model to ensure that as dataset grows, the optimizer switches to an index scan on `userId`.

---

## 4. Connection Pooling (PgBouncer)

For scalable concurrency:

- **Production**: Configured to connect directly to the Neon database connection pooler URL (`-pooler` subdomain), which leverages PgBouncer to multiplex client connection handles, keeping backend database query contention to zero.
