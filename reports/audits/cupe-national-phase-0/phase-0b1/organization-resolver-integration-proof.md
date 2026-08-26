# Phase 0B.1 — Organization Resolver Integration Proof (Gap Analysis)

**Status:** ⚠️ **INTEGRATION GAP** — resolver exists and is test-covered
but is not wired into any production code path.  
**Origin:** Commit `c40a3e33a` added
`apps/union-eyes/lib/organizations/platform-tenant.ts` and its test
file. No baseline caller was added in the same commit.

## What was added

- `getPlatformTenantId(organizationId, db)` → `string | null`
- `resolvePlatformTenantIdOrThrow(organizationId, db)` → throws
  `PlatformTenantMappingRequired` when unresolved (fail-closed).
- `ensureOrgAndPlatformTenantMapping(organizationId, db, opts)` →
  provisioning helper that inserts an `orgs` row and back-fills
  `organizations.platform_tenant_id` idempotently.

## What was NOT added

A grep of `apps/union-eyes/**/*.ts` for `getPlatformTenantId` (see
transcript) returns **0 non-test call-sites**:

```
apps/union-eyes/lib/__tests__/platform-tenant.test.ts   ← test only
apps/union-eyes/lib/organizations/platform-tenant.ts    ← definition only
```

## Baseline call-sites that MUST wire the resolver (once architecture is decided)

Based on the 135 references to `organizationId` / `organization_id` across
31 Union Eyes API route files, the following routes read/write data that
crosses the `organizations` ↔ `orgs` boundary and therefore must call
`resolvePlatformTenantIdOrThrow(...)` before executing their DB work:

| Route file | Why it must resolve |
| --- | --- |
| `app/api/admin/dues/overview/route.ts` | Billing overview scoped to org. |
| `app/api/admin/billing-cycles/route.ts` | Creates billing cycles per org. |
| `app/api/admin/billing-cycles/preview/route.ts` | Same. |
| `app/api/admin/ingest/route.ts` | Ingests data per org tenant. |
| `app/api/admin/ingest/retry/route.ts` | Retries per org. |
| `app/api/admin/users/route.ts` | Currently uses raw `sql\`${organizations.id}::text\`` cast — highest priority. |
| `app/api/admin/stats/activity/route.ts` | Cross-lineage read. |
| `app/api/ai/mamba/route.ts` | AI feature per org context. |
| `app/api/ai/match-precedents/route.ts` | Same. |
| `app/api/ai/pension/members/[id]/projection/route.ts` | Pension data per org. |
| `app/api/ai/pension/plans/[id]/funding/route.ts` | Same. |
| `app/api/ai/pension/plans/[id]/trustee-summary/route.ts` | Same. |
| `app/api/ai/search/route.ts` | AI search per org entitlement. |
| `app/api/ai/semantic-search/route.ts` | Same. |
| `app/api/ai/summarize/route.ts` | Same. |
| `app/api/billing/batch-status/[jobId]/route.ts` | Billing scoped to org. |
| `app/api/billing/credits/check-expired/route.ts` | Same. |
| `app/api/billing/replay-invoice/route.ts` | Same. |
| `app/api/billing/send-batch/route.ts` | Same. |
| `app/api/billing/send-invoice/route.ts` | Same. |
| `app/api/billing/subscriptions/route.ts` | Same. |
| `app/api/billing/subscriptions/[id]/route.ts` | Same. |
| `app/api/billing/validate/route.ts` | Same. |
| `app/api/breaks/compliance/route.ts` | Compliance per org. |
| `app/api/cognition/cases/[id]/risk/route.ts` | Passes `organizationId` to cognition engine. |
| `app/api/cognition/engagement/route.ts` | Same. |
| `app/api/cognition/executive-summary/route.ts` | Same. |
| `app/api/cognition/kpis/route.ts` | Writes raw `WHERE organization_id = ${orgId}::uuid` — must be tenant-resolved. |
| `app/api/cognition/precedents/route.ts` | Same. |
| `app/api/cognition/workload/route.ts` | Same. |
| `app/api/workflow/transition/route.ts` | Workflow state per org. |

## Fail-closed integration pattern (to be applied per route)

Once the architecture decision selects a boundary model, every route above
must adopt:

```ts
import { resolvePlatformTenantIdOrThrow } from '@/lib/organizations/platform-tenant';

// inside the handler, after auth resolved organizationId:
const platformTenantId = await resolvePlatformTenantIdOrThrow(organizationId, db);
// use platformTenantId for any query that hits platform-lineage tables (orgs, orgs_*).
// use organizationId for any query that hits union-eyes-lineage tables (organizations, organization_members, ...).
```

`PlatformTenantMappingRequired` is intentionally uncaught inside the route
so the error propagates to the global error handler as a 5xx and produces
an audit event. This is the fail-closed guarantee: no code path silently
falls back to "everyone's data".

## Baseline commit definition

A single commit titled *"chore(union-eyes): wire platform tenant resolver
into cognition + admin baseline"* will:

1. Add `resolvePlatformTenantIdOrThrow` calls to (at minimum) the four
   `app/api/cognition/*/route.ts` files and `app/api/admin/users/route.ts`.
2. Add per-route integration tests that assert:
   - a 5xx response and audit event when `platform_tenant_id` is NULL, and
   - a 2xx response when the resolver returns the expected id.
3. Add a lint rule / test gate (`tooling/checks/tenant-resolver-required.ts`)
   that fails CI on any new `app/api/**/route.ts` that reads `organizationId`
   from the request context but never calls the resolver.

Until this commit lands on the clean branch, the resolver is treated as
**inert scaffolding** rather than a Phase 0B production artifact.

## What Phase 0B.1 will NOT do about this gap

- It will not silently claim the resolver is integrated.
- It will not perform the integration itself. Wiring 31+ routes without
  the architecture decision (Options A/B/C/D) would guarantee rework.
- The integration commit is authorized only after Aubert selects an
  option in `phase-0b-lineage-architecture-decision.md`.
