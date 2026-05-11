# Semantic Convergence: entity → org

> **Status**: Complete  
> **Date**: 2026-02-28  
> **Invariant**: `SEMANTIC_CONVERGENCE_ENTITY_TO_ORG_001`

## Objective

Eliminate "entity" as an organizational concept across NzilaOS.  
Canonical terminology: **org**, **orgId**, **/orgs** routes, **OrgContext**.

## Inventory

### 1. Routes containing `/business/entities`

| Path | Type |
|------|------|
| `apps/console/app/(dashboard)/business/entities/page.tsx` | Dashboard — entity list |
| `apps/console/app/(dashboard)/business/entities/[entityId]/page.tsx` | Dashboard — entity detail |
| `apps/console/app/(dashboard)/business/entities/[entityId]/activation/` | Dashboard — activation |
| `apps/console/app/(dashboard)/business/entities/[entityId]/audit/` | Dashboard — audit |
| `apps/console/app/(dashboard)/business/entities/[entityId]/equity/` | Dashboard — equity |
| `apps/console/app/(dashboard)/business/entities/[entityId]/finance/` | Dashboard — finance |
| `apps/console/app/(dashboard)/business/entities/[entityId]/governance/` | Dashboard — governance |
| `apps/console/app/(dashboard)/business/entities/[entityId]/minutebook/` | Dashboard — minutebook |
| `apps/console/app/(dashboard)/business/entities/[entityId]/year-end/` | Dashboard — year-end |
| `apps/console/app/api/entities/route.ts` | API — list/create |
| `apps/console/app/api/entities/[entityId]/route.ts` | API — get/update |
| `apps/console/app/api/entities/[entityId]/approvals/` | API |
| `apps/console/app/api/entities/[entityId]/audit/` | API |
| `apps/console/app/api/entities/[entityId]/compliance/` | API |
| `apps/console/app/api/entities/[entityId]/documents/` | API |
| `apps/console/app/api/entities/[entityId]/equity/` | API (4 sub-routes) |
| `apps/console/app/api/entities/[entityId]/filings/` | API |
| `apps/console/app/api/entities/[entityId]/governance-actions/` | API |
| `apps/console/app/api/entities/[entityId]/meetings/` | API |
| `apps/console/app/api/entities/[entityId]/people/` | API |
| `apps/console/app/api/entities/[entityId]/resolutions/` | API |
| `apps/console/app/api/entities/[entityId]/route.ts` | API |
| `apps/console/app/api/entities/[entityId]/shareholders/` | API |
| `apps/console/app/api/entities/[entityId]/templates/` | API |
| `apps/console/app/api/entities/[entityId]/year-end/` | API |

### 2. Variable / identifier usage (`entityId` as org)

~300 files across:

- **apps/**: cfo, console, flow, nacp-exams, partners, trade, union-eyes, zonga
- **packages/**: ai-core, ai-sdk, commerce-*, db, fx, ml-*, nacp-core, org, os-core, payments-stripe, platform-*, tax, tools-runtime, trade-*, zonga-core
- **tooling/**: ai-evals, contract-tests, ml, scripts, security

Key patterns:

- `resolveOrgContext()` returns `{ entityId: orgId }` (nacp, zonga, trade)
- `requireEntityAccess(entityId)` in console api-guards
- `authorizeEntityAccess(ctx, entityId)` in os-core
- `AuditContext.entityId` in db/audit.ts
- `ScopedDb.entityId` (deprecated alias) in db/scoped.ts
- `fromEntityId()` / `fromEntityIdDb()` bridges in @nzila/org

### 3. UI labels referencing "entity"

- Console: "Entity Management", entity list headings, entity detail breadcrumbs
- Navigation links to `/business/entities/*`

### 4. Database tables/columns with `entity_id` as org scope

**154 org-scoped tables** across all schema files use:

```typescript
entityId: uuid('entity_id').notNull().references(() => entities.id)
```

Tables defined in: `packages/db/src/schema/{entities,governance,operations,equity,finance,payments,ai,ml,ue,tax,nacp,zonga,commerce,platform,trade,partners}.ts`

**3 entity-domain tables** (table names contain "entity"):

- `entities` — root org/tenant table (id IS the org)
- `entityMembers` — console access membership
- `entityRoles` — governance roles

## Rename Plan

### What IS renamed

| Current | Target | Scope |
|---------|--------|-------|
| `entityId` (variable/param) | `orgId` | All application code |
| `/business/entities/[entityId]` | `/orgs/[orgId]` | Console dashboard routes |
| `/api/entities/[entityId]` | `/api/orgs/[orgId]` | Console API routes |
| `requireEntityAccess()` | `requireOrgAccess()` | Console api-guards |
| `getEntityMembership()` | `getOrgMembership()` | Console api-guards |
| `authorizeEntityAccess()` | `authorizeOrgAccess()` | os-core/policy |
| `fromEntityId()` | REMOVED | @nzila/org (deprecated bridge) |
| `fromEntityIdDb()` | REMOVED | @nzila/org (deprecated bridge) |
| `ScopedDb.entityId` | REMOVED | packages/db/scoped.ts (deprecated alias) |
| `AuditContext.entityId` | `AuditContext.orgId` | packages/db/audit.ts |
| `entity_id` (SQL column) | `org_id` | DB migration (all 154 tables) |
| `entities` (SQL table) | `orgs` | DB migration |
| `entity_members` (SQL table) | `org_members` | DB migration |
| `entity_roles` (SQL table) | `org_roles` | DB migration |
| Drizzle field `entityId` | `orgId` | All schema files |

### What is NOT renamed

| Term | Reason |
|------|--------|
| Business "entity" in legal/corporate governance context | Legitimate business concept (legal entity) retained in governance docs where distinct from org scoping |
| `NZILA_ENTITY_ID` env var | Renamed to `NZILA_ORG_ID` (with compat alias) |
| Python ML scripts `entity_id` param | Renamed to `org_id` |
| DB migration history files | Left as-is (historical record) |
| Drizzle migration snapshots | Left as-is (historical record) |
