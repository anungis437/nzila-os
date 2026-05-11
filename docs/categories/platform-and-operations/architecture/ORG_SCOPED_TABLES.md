# Org-Scoped Tables — Architecture & Registry

> **Invariant**: Every table that contains an `org_id` column MUST be in the  
> Org-scoped table registry. Every query on these tables MUST be auto-scoped  
> to the active Org. No exceptions without CODEOWNERS approval.

## 1. Terminology

| Term    | Meaning                                                       |
| ------- | ------------------------------------------------------------- |
| **Org** | A legal entity managed in NzilaOS (`entities.id` = Org ID).   |
| orgId   | The UUID passed to `createScopedDb({ orgId })`.               |
| org_id | The Postgres column name on every Org-scoped table.         |

> **ABSOLUTE RULE**: Use "Org" in all public APIs, docs, and comments.  
> Do NOT introduce "tenant" anywhere.

## 2. Registry Location

```text
packages/db/src/org-registry.ts
```

Two arrays:

- `ORG_SCOPED_TABLES` — tables that require `org_id` filtering.
- `NON_ORG_SCOPED_TABLES` — tables intentionally excluded, each with a documented reason.

## 3. API Surface

### Read-only (default)

```ts
import { createScopedDb } from '@nzila/db/scoped'

const db = createScopedDb({ orgId: ctx.orgId })
const meetings = await db.select(tables.meetings)
// → WHERE org_id = orgId (automatic)
```

`createScopedDb({ orgId })` returns a `ReadOnlyScopedDb` — no `insert`, `update`, or `delete` methods.

### Write-enabled (audited)

```ts
import { createAuditedScopedDb } from '@nzila/db/audit'

const db = createAuditedScopedDb({
  orgId: ctx.orgId,
  actorId: ctx.userId,
  correlationId: ctx.correlationId,
})
await db.insert(meetings, { kind: 'board', ... })
// → org_id auto-injected + audit event auto-emitted
```

`createAuditedScopedDb()` returns an `AuditedScopedDb` — writes auto-emit hash-chained audit events. If audit emission fails, the mutation is blocked.

### Legacy (deprecated)

```ts
// ⚠️ DEPRECATED — will be removed.
// Returns full CRUD without audit enforcement.
const db = createScopedDb(orgId)
```

## 4. Structural Guarantees

| Guarantee                         | Enforced by                                      |
| --------------------------------- | ------------------------------------------------ |
| No query without Org filter       | `getOrgIdColumn()` throws if column missing       |
| No write without audit            | `createAuditedScopedDb()` wraps every mutation    |
| No raw DB in apps                 | ESLint `no-shadow-db` + contract test             |
| Registry consistent with schema   | `org-scoped-registry.test.ts` contract test       |
| Missing orgId throws immediately  | `ScopedDbError` in `createScopedDb()`             |

## 5. Adding a New Org-Scoped Table

1. Add the table to the schema with `orgId: uuid('org_id').notNull().references(() => entities.id)`.
2. Add the table's export name to `ORG_SCOPED_TABLES` in `packages/db/src/org-registry.ts`.
3. Run `pnpm contract-tests` to verify the registry is consistent.
4. The GA Gate (`ga-check`) will also verify this on every PR.

## 6. Adding a Non-Org-Scoped Table

1. Add the table to the schema WITHOUT `org_id`.
2. Add an entry to `NON_ORG_SCOPED_TABLES` in `packages/db/src/org-registry.ts` with a `reason`.
3. Get CODEOWNERS approval (requires `@nzila/platform` review).

## 7. Allowlist (Raw DB Access)

The following paths are allowed to import `@nzila/db/raw` or `@nzila/db/client`:

| Path                     | Reason                                |
| -------------------------| ------------------------------------- |
| `packages/os-core/**`    | Platform layer (migrations, system ops) |
| `packages/db/**`         | Self (internal implementation)        |
| `tooling/**`             | Migrations, scripts, contract tests   |

Any new entry requires CODEOWNERS approval from `@nzila/platform`.

## 8. Contract Tests

| Test file                              | Invariant |
| -------------------------------------- | --------- |
| `org-scoped-registry.test.ts`          | INV-20: Registry ↔ schema bidirectional consistency |
| `scoped-dal-negative.test.ts`          | INV-21: Negative fixtures (missing orgId, write-on-read-only, filter override) |
| `db-boundary.test.ts`                  | INV-06/07: No raw DB in apps, Org isolation |

## 9. Current Registry (auto-generated reference)

### Org-Scoped (org_id present)

| Module        | Tables |
| ------------- | ------ |
| entities.ts   | orgRoles, orgMembers |
| governance.ts | meetings, resolutions, approvals, votes |
| operations.ts | governanceActions, documents, filings, complianceTasks, auditEvents, evidencePacks |
| equity.ts     | shareClasses, shareholders, shareLedgerEntries, shareCertificates, capTableSnapshots |
| finance.ts    | closePeriods, closeTasks, closeExceptions, closeApprovals, qboConnections, qboSyncRuns, qboReports, financeGovernanceLinks |
| payments.ts   | stripeConnections, stripeWebhookEvents, stripePayments, stripeRefunds, stripeDisputes, stripePayouts, stripeReports, stripeSubscriptions |
| ai.ts         | aiCapabilityProfiles, aiRequests, aiUsageBudgets, aiKnowledgeSources, aiEmbeddings, aiActions, aiActionRuns, aiKnowledgeIngestionRuns, aiDeploymentRoutes |
| ml.ts         | mlDatasets, mlModels, mlTrainingRuns, mlInferenceRuns, mlScoresStripeDaily, mlScoresStripeTxn, mlScoresUECasesPriority, mlScoresUESlaRisk |
| ue.ts         | ueCases |
| tax.ts        | taxProfiles, taxYears, taxFilings, taxInstallments, taxNotices, indirectTaxAccounts, indirectTaxPeriods |

### Not Org-Scoped (intentional exclusions)

See `NON_ORG_SCOPED_TABLES` in `packages/db/src/org-registry.ts` for the complete list with reasons.
