# Union Eyes — Controlled Pilot Readiness Memo

**Classification:** Internal — Executive & Buyer Review  
**Status:** ✅ CONTROLLED PILOT — GO  
**Last updated:** 2026-05-14  
**Source of truth:** `apps/union-eyes/` codebase + `reports/runtime/platform-runtime-truth-latest.json`  
**Supersedes:** All versions dated before 2026-05-14  
**Live-evidence dependencies:** RUNTIME_EVIDENCE_PACK.md §B — pending Azure access

---

## Decision

Union Eyes is cleared for a controlled CUPE pilot:  
**one union local, up to 5 worksites, up to 200 members, no broad production data until operational evidence is confirmed.**

This is not a demo-only clearance. The security controls, type discipline, and org-isolation invariants now warrant genuine pilot exposure to member data under the conditions defined in § Conditions below.

---

## What Is Implemented

### Core platform (shipping)

| Capability | Evidence |
|---|---|
| Auth / RBAC / RLS (org-scoped, 238 policies) | `apps/union-eyes/db/schema/`, RLS CI gate |
| Case and grievance model | `db/schema/claims-schema.ts`, `grievance-schema.ts`, `grievance-workflow-schema.ts` |
| Server-side FSM enforcement | `lib/case-fsm-enforcement.ts`, `lib/services/claim-workflow-fsm.ts`, `lib/workflows/grievance-state-machine.ts`; 19/19 lifecycle tests pass |
| Hash-chained audit trail | `lib/audited-case-mutations.ts`; `backend/core/migrations/0002_audit_hash_chain.py`; 6/6 seal/verify lifecycle tests |
| Evidence export + seal verification | `lib/evidence-export.ts`; routes `app/api/cases/[caseId]/export/route.ts`, `app/api/evidence/export/route.ts`; UI `components/admin/evidence-export.tsx` |
| File storage, OCR, DMS | `lib/blob-client.ts`; org-scoped signed URLs; contract test `union-eyes-malware-scan-enforcement` |
| ClamAV malware scanning | `lib/security/clamav.ts`; `__tests__/clamav.test.ts` |
| Org-scoped idempotency | Intake hash includes `organizationId`; duplicate check in `app/api/cases/intake/route.ts` |
| Fail-closed RLS context | `withRLSContext` throws on missing `organizationId`; no silent bypass paths |
| Zero raw-db import violations | `pnpm exec tsx scripts/check-ue-db-import-guard.ts` — 0 violations (zero-tolerance CI guard) |
| Prod/staging blast-radius separation | EXC-001 resolved; `deploy-production.yml` hardcodes `nzila-canada-prod-rg`; blast-radius gate hard-blocks cross-contamination |
| TypeScript strict mode | `noImplicitAny: true`; `pnpm typecheck` — 0 errors |
| Correlation IDs across routes/DB | `lib/governance-observability/correlation.ts`; Django backend parity; 5/5 parity tests pass |
| Pilot readiness checklist | `lib/pilot-metrics.ts`; `components/pilot/pilot-readiness-checklist.tsx` |
| Canadian data residency | All 14 container apps in `canadacentral`; 0 data-residency violations detected |

### Not in pilot scope (intentionally deferred)

| Item | Reason |
|---|---|
| Finance core persistence | In-memory by design; no financial transactions in pilot |
| Tier 2 app instrumentation (Zonga, Agrimo, Cora, Trade, Mobility) | Not Union Eyes; separate roadmap |
| SOC 2 Type I audit | Readiness scaffold complete; external audit is post-pilot |
| Penetration test | Scheduled post-controlled-pilot |
| Broad multi-org production | Requires operational evidence confirmation (see § Conditions) |

---

## Conditions for Pilot Launch

1. **Operational environment confirmation** — run `pnpm exec tsx scripts/proof/ingest-azure-runtime.ts` to confirm physical placement in `nzila-canada-prod-rg`; record in `reports/runtime/`.
2. **Live smoke tests** — hit `/api/health` and `/api/readiness` on the pilot URL; capture and store output in `reports/runtime/`.
3. **Key Vault separation verification** — confirm prod Key Vault is `nzila-ue-prod-kv` (not staging); log in `reports/runtime/`.
4. **DPA signature** — signed Data Processing Agreement (template at `docs/compliance/dpa-template.md`) on file before any real member data is entered.
5. **Pilot scope acknowledgement** — the union IT contact (James persona) must receive and sign the pilot scope letter (template at `docs/union-eyes/pilot-evidence-pack/PILOT_SCOPE_LOCK.md`).
6. **Restore drill** — ✅ **COMPLETE 2026-05-21** (RESTORE-DRILL-2026-05-20-001; manifest at `reports/runtime/live-captures/2026-05-20/restore-drill/restore-drill-manifest.json`). Quarterly cadence; next drill due 2026-08-21.

---

## What Changed Since March 2026 Baseline

| March baseline | May 2026 |
|---|---|
| FSM: partial (client-side only) | ✅ Full server-side enforcement + tests |
| Audit: schema exists, chain unverified | ✅ Hash-chain + seal/verify lifecycle tested |
| Evidence export: not built | ✅ Shipped with seal verification |
| ClamAV: missing | ✅ Shipped |
| RLS: fail-open (warn on missing orgId) | ✅ Fail-closed (throws) |
| Raw DB imports: 14 violations | ✅ 0 violations, zero-tolerance guard |
| Prod/staging blast radius: shared (EXC-001) | ✅ Separated |
| TypeScript: `noImplicitAny: false` | ✅ `noImplicitAny: true`, 0 errors |
| Readiness: ~70% | ✅ ~92–95%; critical-path complete |

---

## Remaining Risks (Accepted for Controlled Pilot)

| Risk | Mitigation | Residual |
|---|---|---|
| No external pen-test yet | Network isolation + fail-closed RLS + strict TS + zero raw-db imports | Low for controlled pilot |
| No SOC 2 Type I yet | Readiness scaffold + control mapping complete; audit scheduled | Low for controlled 1-org pilot |
| Finance persistence in-memory | Finance excluded from pilot scope | None for this pilot |
| Broad multi-org production not yet confirmed | Conditional GO; requires `pnpm exec tsx scripts/proof/ingest-azure-runtime.ts` confirmation | Medium — must complete before expanding |

---

*This memo should be updated after each condition above is satisfied.*  
*See also: `SECURITY_BUYER_PACK.md`, `CI_GOVERNANCE_EVIDENCE.md`, `PILOT_SCOPE_LOCK.md` in this directory.*
