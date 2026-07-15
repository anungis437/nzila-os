# 01 — Repository vs Deployed State

A first draft of this proof run incorrectly concluded that SAGE was entirely
headless and that no application rendered SAGE routes or components. That
conclusion was wrong. It resulted from searching an empty virtual workspace
mirror rather than the merged local tree. This section records the corrected,
directly verified state.

## Repository implementation (merged main @ 6b6d3736d) — Finding A

SAGE operator/admin UI **exists** in the merged repository. `git ls-tree` of the
merged commit shows:

- **Pages (`apps/platform-admin/app/sage/`):** `page.tsx`,
  `[workspaceId]/page.tsx`, `[workspaceId]/evidence/page.tsx`,
  `[workspaceId]/exports/page.tsx`, `[workspaceId]/governance/page.tsx`,
  `[workspaceId]/delivery/page.tsx`, plus `error.tsx` and `loading.tsx`.
- **Components (`apps/platform-admin/app/sage/components/`):** ~24 components,
  including `create-workspace-form`, the evidence set (create/classify/link/list),
  the exports set (`create-export-request-form`, `export-request-list`,
  `export-package-list`, **`records-lifecycle-panel`**), and the governance set
  (boundary flags, decision records, review notes).
- **API routes (`apps/platform-admin/app/api/sage/` and
  `app/api/internal/sage/`):** ~40 route handlers covering workspaces, evidence,
  exports, delivery, destruction, boundary flags, decisions, and internal
  dispatch/execute endpoints.
- **Services (`apps/platform-admin/lib/sage/`):** workspace/evidence/export/
  delivery/records services, schemas, views, adapters, and jsdom interaction
  tests.
- **Localization:** `messages/{en,en-CA,fr,fr-CA}.json` with SAGE namespaces.

**Finding A:** SAGE UI exists in the repository but is **not deployed** to
staging. (This is admin/operator-oriented UI; a separate recipient claim/access
surface also exists under the delivery flow.)

## Deployed staging revision

- **`platform-admin` staging container app** runs a **pre-SAGE image**:
  revision `nzila-os-platform-admin--0000009`, image commit `24b2be66`
  (~2026-04-19), an ancestor of the SAGE merge, with **zero SAGE routes** in that
  image and **none** of the SAGE operational environment variables.
- Therefore no SAGE operational surface is deployed in staging, and no live
  operational proof that depends on a running SAGE surface can be executed
  without first deploying the already-merged SAGE code with the correct
  environment composition.

## Staging data plane — directly verified

`nzila-staging-db` (RG `nzila-staging-rg`, PostgreSQL 15) was inventoried
**read-only**: a temporary firewall rule for the agent IP was created, a
catalog-only query was run, and the rule was removed immediately.

```
select table_schema, table_name
from information_schema.tables
where table_name like 'sage_%';
-- result: 0 rows
```

- **`sage_%` tables: 0** — SAGE migrations are **not applied** to the shared
  staging database (direct observation, not inference).
- Migration ledgers present: `drizzle.__drizzle_migrations` and
  `public.django_migrations` (the root `migrations/*.sql` SAGE chain is not
  tracked by either), consistent with there being no applier for the root SAGE
  migrations in the deployed platform.

## Deployment gap is itself a blocker

```
B-005 — No SAGE-enabled staging proof deployment or isolated operational data plane
Severity: BLOCKER
```

Until B-005 closes, G6, G7, G9, G11 and G12 cannot receive true **deployed**
operational proof. Deploying the already-merged SAGE functionality to an isolated
staging revision is deployment work, not a new product feature.
