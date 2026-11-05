# WA-GROK Reality Baseline — Reusable Capability Classification

**Mission:** WA-GROK-REDTEAM-01  
**Inspected HEAD:** `38a824918cf2e7d7cfb7fcb0e796cbde45433be8` (= pack reference)  
**Clone:** `/workspace/missions/WA-GROK-REDTEAM-01/repo` (fresh shallow `main`, anonymous HTTPS)  
**Date:** 2026-10-23 America/Toronto  
**Proof vocabulary:** `PROVEN_RUNTIME` | `SOURCE_TESTED` | `DEMO_CONFIGURED` | `PROPOSED` | `UNVERIFIED` | `BLOCKED`  
**Note:** No capability is `PROVEN_RUNTIME` for WorkAid pilot or UE production promotion. Staging public probes returned HTTP 503 maintenance (informational only).

---

## Summary table

| Capability | Class | Reuse boundary |
|---|---|---|
| Membership / tenant auth | SOURCE_TESTED | Session + membership helpers exist; Entra staging denial **BLOCKED** |
| Union org ownership | SOURCE_TESTED | Org models + selection tests; not WorkAid multi-union proven |
| Case / grievance models | SOURCE_TESTED | CUPE/grievance vocabulary; **not** WSIB claim graph |
| Claims / docs (general UE) | SOURCE_TESTED | Documents + grants + governance labels; WorkAid publication **PROPOSED** |
| Representation / external-specialist permissions | SOURCE_TESTED + DEMO_CONFIGURED | Schema + evaluators + demo sandbox; professional acceptance ≠ grant **PROPOSED** |
| Deadline / reminder | SOURCE_TESTED | Phase A **grievance_deadlines only**; `claim_deadlines` rejected |
| Notifications | SOURCE_TESTED (deadline email) / UNVERIFIED (general) | Min-necessary deadline adapter; free-form notif schemas remain |
| Member views | DEMO_CONFIGURED | Sandbox limited status; production WorkAid member publication **PROPOSED** |
| Audit | SOURCE_TESTED | Mandatory audit helpers + deadline PII guards; not full medical canary proven |
| Identity / revocation / sessions | SOURCE_TESTED / UNVERIFIED wiring | Revoke APIs exist; cascade + session invalidate **not** proven wired |
| External integrations (Clio) | PROPOSED | **No Clio connector in source** — do not assert existence |
| Demo vs prod | DEMO_CONFIGURED vs NO_GO | Demo explicit; prod readiness **NO_GO** |
| Server-action org scoping detector | SOURCE_TESTED **with defect** | Quote-style false skip for `"use server"` — see WA-R3-001 |
| Document visibility / publication | SOURCE_TESTED (labels) / PROPOSED (WorkAid release) | Grievance privacy labels ≠ MemberStatusPublication |
| Public readiness probe | BLOCKED / informational 503 | Maintenance page; does not clear NO-GO |

---

## 1. Membership / tenant auth

| Field | Value |
|---|---|
| Classification | **SOURCE_TESTED** (helpers/tests); runtime IdP **BLOCKED** |
| Paths | `lib/organization-utils.ts`, `lib/auth/*`, `lib/member-segments/authorize-segment-access.ts`, `lib/api-auth-guard.ts`, `scripts/bootstrap-v2/organization-selection-native.test.ts` |
| SHA | HEAD `38a82491…` |
| Tests | Org selection native tests; member-segment unit tests (often mocked auth) |
| Limitations | `authorizeMemberSegmentAccess` admits caller org id only after membership check — good design, not staging-proven. UE-D-IDENTITY not executed. |
| Reuse | Reuse membership bind pattern; do not treat as WorkAid-complete authz. |

## 2. Union org ownership

| Field | Value |
|---|---|
| Classification | **SOURCE_TESTED** |
| Paths | `db/schema-organizations` (via imports), `lib/auth/canonical-organization-selection.ts`, `lib/org-scope-middleware.ts` |
| Limitations | Multi-union worker (D-08) unresolved; aggregates cross-union **UNVERIFIED** for medical safety. |
| Reuse | Institutional org as tenant spine OK; WorkAid specialist org is separate dimension (`representativeOrganizationId`). |

## 3. Case / grievance models

| Field | Value |
|---|---|
| Classification | **SOURCE_TESTED** for CUPE grievance/case intake |
| Paths | `app/api/cases/intake/route.ts`, `db/schema/domains/claims/grievances.ts`, CUPE vocabulary validation |
| Limitations | Intake is grievance/CUPE-oriented (`grievance_case_suite` entitlement). **Must not** be reused as WSIB intake without independent domain + authz tests (spec §2). |
| Reuse | Pattern for idempotent intake/audit only; new WorkAid referral contract required. |

## 4. Claims / documents

| Field | Value |
|---|---|
| Classification | **SOURCE_TESTED** (UE docs/claims); WorkAid WSIB claim/decision/ITO graph **PROPOSED** |
| Paths | `db/schema/documents-schema.ts`, `db/schema/claims-schema.ts`, `db/schema/domains/health-safety/*` (wsib fields), `lib/services/document-*-service.ts`, `app/api/documents/**` |
| Tests | document governance/authorization unit tests; download route tests |
| Limitations | Health-safety WSIB columns ≠ WorkAid matter model. 1-year signed URLs in `document-storage-service.ts` (**defect**). Download path SAS default 60m via `@nzila/blob`. |
| Reuse | Document grant + privacy label machinery reusable after WorkAid data-class mapping; storage URL TTL must be fixed first. |

## 5. Representation / external-specialist permissions

| Field | Value |
|---|---|
| Classification | **SOURCE_TESTED** (schema/services/tests) + **DEMO_CONFIGURED** (sandbox) |
| Paths | `db/schema/representation-authority-schema.ts`, migration `20260915_external_representation_authority.sql`, `lib/services/representation-authority-service.ts`, `external-resource-authorization-service.ts`, `external-document-grant-service.ts`, `app/api/external/**`, `apps/union-eyes-demo/DEMO_SANDBOX_P0.md` |
| Tests | `lib/services/__tests__/external-*.test.ts`, `app/api/external/__tests__/external-routes.test.ts`, `lib/demo-sandbox/__tests__/nz007-p0-grants.test.ts`, demo `sandbox-p0.test.ts` |
| Limitations | Matter types `grievance` \| `wcb_claim` only. Demo handoff ≠ legal status. Revoke does not cascade grants/sessions. No Clio. `AUTH_START_WORKAID=NO`. |
| Reuse | Grant evaluators are the right spine; add professional-acceptance + DOA instruments before WorkAid actions. |

## 6. Deadline / reminder

| Field | Value |
|---|---|
| Classification | **SOURCE_TESTED** (Phase A grievance) |
| Paths | `lib/deadline-engine/*` especially `recipient-resolver.ts`, `reminder-scheduler.ts`, `reminder-worker.ts`, `email-adapter.ts` |
| Tests | `lib/deadline-engine/__tests__/*` — explicitly rejects `claim_deadlines` |
| Limitations | Admin escalation NOT_IMPLEMENTED; claim deadlines unsupported; calendar/business-day rules for WorkAid **PROPOSED** (D-01). |
| Reuse | **Do not** map WSIB obligations onto grievance deadlines. Build separate `DeadlineObligation` / receipt follow-up. |

## 7. Notifications

| Field | Value |
|---|---|
| Classification | Deadline email: **SOURCE_TESTED**; general/push: **UNVERIFIED** for sensitive minimization |
| Paths | `db/schema/notifications-schema.ts`, `push-notifications.ts`, deadline `email-adapter.ts` |
| Limitations | Free-form title/body; document_update channel exists; lock-screen safety unproven. |
| Reuse | Copy deadline min-necessary pattern; do not reuse raw templates for medical events. |

## 8. Member views

| Field | Value |
|---|---|
| Classification | **DEMO_CONFIGURED** |
| Paths | `apps/union-eyes-demo` external-specialist sandbox member section; `app/[locale]/dashboard/member*` (general UE member UX) |
| Limitations | Spec `MemberStatusPublication` not implemented as WorkAid product object. |
| Reuse | Demo projection rules as acceptance oracles only. |

## 9. Audit

| Field | Value |
|---|---|
| Classification | **SOURCE_TESTED** |
| Paths | `lib/audit/mandatory-audit.ts`, `lib/audit-logger.ts`, deadline `audit.ts` |
| Limitations | Fail-closed mandatory audit on download path good; AI/log canaries incomplete. |
| Reuse | Keep mandatory audit on every sensitive mint/download; extend redaction policy. |

## 10. Identity / revocation / sessions

| Field | Value |
|---|---|
| Classification | **SOURCE_TESTED** APIs; end-to-end revoke **UNVERIFIED** |
| Paths | `lib/auth/session.ts` (`revokeSession`, `revokeAllUserSessions`); representation/document revoke services |
| Limitations | Authority revoke ≠ session revoke ≠ URL invalidate (WA-R3-006/008/015). |
| Reuse | Wire cascade before any external specialist pilot. |

## 11. External integrations (Clio / WSIB)

| Field | Value |
|---|---|
| Classification | **PROPOSED** only — **Clio does not exist as code** |
| Paths | Demo `claim-labels.ts` **blocks** phrases `clio-integrated` / `proven-wsib`; no `apps/**/clio*` connector |
| Limitations | Spec IntegrationLedger is future design. Pilot must remain manual attestation. |
| Reuse | None for sync. Deep-link-out documentation only if WorkAid chooses. |

## 12. Demo vs production

| Field | Value |
|---|---|
| Demo | **DEMO_CONFIGURED** — `DEMO_SANDBOX_P0.md`, personas `@persona.demo.invalid`, `AUTH_START_WORKAID=NO` |
| Production / staging | **NO_GO** per `docs/union-eyes/reality-remediation/30_UE_PRODUCTION_READINESS_20261021.md`; public probe **503 maintenance** |
| Classification | Demo ≠ prod. Never promote demo evidence to `PROVEN_RUNTIME`. |

## 13. Server-action org scoping (COMMAND carry-forward)

| Field | Value |
|---|---|
| Classification | Detector: **SOURCE_TESTED with known defect**; member-segments: **PARTIALLY_MITIGATED** source helper |
| Paths | `tooling/contract-tests/server-action-org-scoping.test.ts` (single-quote `'use server'` only); `governance/exceptions/org-required-server-actions.json` (UE actions expire 2026-11-17); `actions/member-segments-actions.ts` |
| Status at HEAD | Quote-style defect **still present**. Member-segments authorize helper **still present** and unit-tested with mocks. Cross-tenant concern **not FIXED_PROVEN** at runtime. |

## 14. Document visibility / publication controls

| Field | Value |
|---|---|
| Classification | Label policy **SOURCE_TESTED**; WorkAid publication workflow **PROPOSED** |
| Paths | `document-governance-service.ts`, search/download routes, demo hidden-title behavior |
| Limitations | Labels are institutional grievance-oriented; steward-plus broad visibility unsuitable for WorkAid medical default. |

---

## Capability reuse headline

**PROVEN_RUNTIME:** none for WorkAid or UE production promotion.  
**SOURCE_TESTED (reusable with bounds):** representation grant evaluators, document governance helpers, deadline engine (grievance-only), org membership checks, demo/external unit tests, mandatory audit helper.  
**DEMO_CONFIGURED:** external specialist sandbox handoff + member limited view.  
**PROPOSED:** Clio ledger, MemberStatusPublication, WSIB decision/ITO/receipt task product, WorkAid professional acceptance dimension.  
**BLOCKED:** staging RLS/IdP/customer-data execution; live counterpart validation.

*Not DESIGN_COMPLETE.*
