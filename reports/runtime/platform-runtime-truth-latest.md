# Platform Runtime Truth — May 2026

> **STALENESS NOTICE — HISTORICAL / STALE EVIDENCE.** Annotated 2026-09-26 (NZ-008-C06). No live probe was run for this note.
>
> Last live verify is **May 2026**. This markdown file is dated **2026-05-14**. The companion JSON records `generatedAt` **2026-05-14** and `liveEvidenceVerifiedAt` **2026-05-21** (`reports/runtime/live-captures/2026-05-20/live-evidence-manifest.2026-05-20.json`).
>
> This artifact does **not** certify MAIN tip `cce162dbb2f89cf68abb9085f3f0cc051de38887`, or current MAIN, as **RUNTIME_VERIFIED**.
>
> **MAIN_GREEN ≠ DEPLOYED ≠ RUNTIME_VERIFIED.**
>
> Classification: historical / stale evidence. JSON `overallStatus` remains the historical May 2026 value **HEALTHY** — do not promote maturity from HEALTHY. The narrative below is unchanged May 2026 text (it still reads DEGRADED / EXC-001 open as of the 2026-05-14 draft). Neither status is a September 2026 runtime claim.

> **Authoritative runtime status report.** This file supersedes all prior runtime health, deployment, and residency reports.
> Generated: 2026-05-14
> Source JSON: `reports/runtime/platform-runtime-truth-latest.json`
>
> The word "authoritative" in this May 2026 header means authoritative among the May 2026 runtime reports it superseded. It does not certify current MAIN as RUNTIME_VERIFIED. See the staleness notice above.

---

## Overall Status: ⚠️ DEGRADED

Production and staging share the same Azure resource group and container app environment.
This is a **P1 blast-radius risk**. No data-residency violations detected in deployed apps.
P0 org-isolation controls were fixed in this sprint.

---

## GO / NO-GO

| Use Case | Status | Notes |
|---|---|---|
| Controlled demo | ✅ GO | |
| Controlled pilot (limited users) | ✅ GO | P0 RLS + idempotency fixes applied |
| Sensitive multi-org production | ❌ NO-GO | Prod/staging blast-radius separation required first |
| Investor review | ✅ GO | |
| Enterprise procurement | ⚠️ CONDITIONAL | Buyer pack must distinguish pilot-ready from production-hardened |

---

## Section Status

| Section | Status | Summary |
|---|---|---|
| Health (CI/deploy metrics) | ✅ HEALTHY | 1 deploy, 0 rollbacks, 100% CI success (May 2026) |
| Deployment | ⚠️ DEGRADED | All 14 apps in `canadacentral` ✅; prod/staging share resource group ❌ |
| Data Residency | ✅ HEALTHY | All container app endpoints in `canadacentral`. No eastus violations detected. |
| Org Isolation (P0) | ✅ FIXED | RLS fail-closed, org-scoped idempotency, assignClaim scoped, regression tests added |
| Instrumentation | ⚠️ PARTIAL | Union Eyes / Flow / ABR instrumented; Tier 2 apps partial |

---

## P0 Org-Isolation Fixes Applied This Sprint

1. **`with-rls-context.ts`** — `withRLSContext` now throws when `orgId` is missing (fail-closed). Added `withSystemRLSContext` and `withPlatformAdminRLSContext` as explicit audited bypass paths.
2. **`intake/route.ts`** — Idempotency hash now includes `organizationId`. Duplicate check moved inside `withRLSContext` with org-scoped `WHERE` clause.
3. **`claims-queries.ts`** — `getClaimsByMember`, `updateClaimStatus`, `assignClaim` now require `organizationId` with `and()` WHERE guards.
4. **`workflow-engine.ts`** — `assignClaim` wrapped in `withRLSContext`; both SELECT and UPDATE use org-scoped WHERE.
5. **Cross-org regression tests** — 4 cross-org denial tests in `workflow-engine.test.ts`; 4 idempotency isolation tests in `intake/__tests__/cross-org-idempotency.test.ts`.
6. **DB import guard** — `scripts/check-ue-db-import-guard.ts` scans Union Eyes case/claim modules for raw DB imports. Passes CI (0 new violations). 13 pre-existing violations documented in allowlist as P1 migration backlog.

---

## Known Exceptions

| ID | Type | Description | Severity | Status |
|---|---|---|---|---|
| EXC-001 | Blast radius | Prod/staging share `nzila-canada-staging-rg` and `nzila-canada-staging-env` | P1 | Open — must fix before multi-org production |

---

## Remaining P1 Backlog

- Separate production and staging Azure resource groups, Key Vaults, storage, and container app environments
- Migrate 13 remaining Union Eyes API/query files from raw `db` to `withRLSContext`
- Harden Union Eyes TypeScript (`noImplicitAny`, reduce exclusions)
- Reduce workflow/script sprawl (canonical Tier 1/2/3 command tiers)
- Resolve staging vs production language in buyer-facing docs

---

## Stale Reports (do not use for buyer-facing claims)

- `runtime-health-status-2026-05-11.json` — superseded by this report
- `live-health-failure-matrix.json` — superseded
- `mainline-runtime-baseline-2026-05-12.json` — superseded
- All `wave-*` reports — internal implementation records, not authoritative runtime truth

For buyer-facing claims, reference only this document or `platform-runtime-truth-latest.json`.
