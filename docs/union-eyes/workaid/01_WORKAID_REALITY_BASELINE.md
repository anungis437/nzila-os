# 01 — WorkAid reality baseline

**Platform source inspected:** `anungis437/nzila-os` `main` at `38a824918cf2e7d7cfb7fcb0e796cbde45433be8` (verified equal to `origin/main` at the start and end of this slice).
**Method:** read-only source inspection of the pinned commit (the harness reads blobs with `git show 38a824918:<path>`); no staging, database, network or credential access. Where a claim below is checked by an executable test, the test title is named.
**State vocabulary** (mission §6): `PROVEN_RUNTIME`, `SOURCE_TESTED`, `DEMO_CONFIGURED`, `PARTIAL`, `PROPOSED`, `BLOCKED`, `NOT_IMPLEMENTED`. Nothing in this inventory is `PROVEN_RUNTIME`.

## Gate context (Union Eyes)

| Gate | Value | Source |
|---|---|---|
| `UE_SAAS_OPERATIONAL_READINESS` | `NO_GO — RUNTIME_PROOF_REQUIRED` | `docs/union-eyes/reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md`; restated in `apps/union-eyes-demo/DEMO_SANDBOX_P0.md` |
| `UE_RUNTIME_RLS_TENANT_ISOLATION` | `FAIL` (historical) / not re-measured | `DEMO_SANDBOX_P0.md`; `30_UE_PRODUCTION_READINESS_20261021.md` |
| Latest production-readiness document | `NO_GO / RUNTIME_DEFECT` for the deployed service | `30_UE_PRODUCTION_READINESS_20261021.md` |
| `CUSTOMER_DATA_EXECUTION_AUTHORIZED` | `NO` | `DEMO_SANDBOX_P0.md` |
| Staging probes (Grok R3, 2026-10-23) | HTTP 503 maintenance | `grok-redteam-01/WA_GROK_R3_ADVERSARIAL_FINDINGS.md`; informational only, not independently re-probed here |

None of the WorkAid work below depends on, or changes, these gates. Codex owns staging.

## Capability inventory

| Capability | Candidate source | State | Evidence | Limitations |
|---|---|---|---|---|
| Claims and intake | `apps/union-eyes/app/api/cases/intake/route.ts` | `PARTIAL` | Reads: CUPE vocabulary validation (`@nzila/cupe-vocabulary`), entitlement guard, RLS context, NAR audit adapter | Grievance/CUPE vocabulary; no referral concept, no WSIB claim/decision/issue model. Not reusable for WorkAid intake without independent domain and authorization tests. Not executed here |
| Member identity and membership | `organizationMembers` (read by `recipient-resolver.ts`) | `PARTIAL` | Source read | Tenant isolation unproven at runtime; no WorkAid member/claim identity binding |
| Organization and tenant authorization | RLS + `withRLSContext`, org membership | `BLOCKED` | Gate table above | Runtime RLS result is `FAIL`/unmeasured; every WorkAid isolation claim here is contract-level only |
| External representation authority | `db/schema/representation-authority-schema.ts`, `lib/services/representation-authority-service.ts` | `SOURCE_TESTED` (tests exist upstream; **not executed in this mission**) | Evaluator `evaluateRepresentationAuthority` checks status, revocation, effectiveness, expiry, user, organization, specialist organization, matter | Authority `scope` array is stored but not read by `evaluateRepresentationAuthority` or the external evaluators (routes not exhaustively checked); `representativeOrganizationId` check is skipped when the caller omits it; matter-type enum has `grievance` and `wcb_claim` only; no acceptance record; evidence document is not typed (WA-R3-009) |
| Matter and document grants | `external-resource-authorization-service.ts`, `app/api/external/**` | `PARTIAL` | Every external route rejects any matter type except `'grievance'` (`if (context.matterType !== 'grievance')`) | `wcb_claim` has schema but no routes: **WSIB matter access is `NOT_IMPLEMENTED`**. `wcb_claim` is a generic label, not Ontario WSIB specialization |
| Revocation | `revokeRepresentationAuthority` | `PARTIAL` | Test `[WA-T084] revokeRepresentationAuthority at the pinned SHA updates the authority and audits, with no grant or session handling` | Updates authority and audits; **no cascade to matter/document grants, no session invalidation** (WA-R3-008, WA-R3-015). Evaluators re-check authority, so an effective bypass is unproven, but the gap is source-confirmed |
| Deadline engine | `lib/deadline-engine/*`; registry `UE-DEADLINE-CORE/REMINDERS/DELIVERY…` | `PARTIAL` (registry: `LIMITED`) | Registry entries; staging run did not invoke the scheduler service | Recipient resolution is grievance-specific. See next row |
| Claim deadlines | `db/schema/domains/claims/deadlines.ts`; registry `UE-CLAIM-DEADLINES-SURFACE` | `NOT_IMPLEMENTED` | Test `[WA-T086] the resolver at the pinned SHA throws for claim_deadlines and resolves grievance recipients only`: `resolveGrievanceDeadlineRecipients` throws `source table … not yet supported (Phase A grievance-only)` | No API route, no UI; not a WSIB timer. WorkAid obligations are a separate contract (`src/deadlines.ts`); a tripwire test asserts the harness imports nothing from the engine |
| Notifications and dispatch | `deadline-engine/email-adapter.ts`, notification schemas | `PARTIAL` | Deadline email adapter is minimum-necessary (Grok R3-010 reading) | General notification `title`/`message` are free-form (WA-R3-010/022); delivery sink not proven at runtime |
| Audit and evidence persistence | `deadline_audit_events` (append-only), NAR proof adapter in intake | `PARTIAL` | Registry; route source | Not exercised for WorkAid events; atomicity with storage unproven (WA-R1-08) |
| Document storage | `lib/services/document-storage-service.ts` | `PARTIAL` with defects | Tests `[WA-T082]`, `[WA-INT-001]`, `[WA-INT-002]`, `[WA-INT-003]` read the pinned blob | One-year S3/R2 presign; key and logs contain the document name; Azure branch returns an unsigned URL; put-then-sign orphan risk. All source-confirmed; exposure unproven |
| Universal search | `app/api/search/universal/route.ts` | `PARTIAL` with concern | Test `[WA-T090] source at the pinned SHA queries by title before applying the visibility policy` | Match-then-filter order; leak not demonstrated |
| Server-action org-scope detector | `tooling/contract-tests/server-action-org-scoping.test.ts` | `PARTIAL` with defect | Tests `[WA-T081] …` (source line, behavioural reproduction, measured counts at the pinned SHA) | Recognizes only single-quoted `'use server'`; 7 of the 10 `apps/union-eyes/actions/*-actions.ts` files use double quotes |
| Member portal and document surfaces | main-app member routes | `NOT_INSPECTED` in this slice | — | Carried to the next slice; not asserted either way |
| Demo sandbox | `apps/union-eyes-demo/DEMO_SANDBOX_P0.md` | `DEMO_CONFIGURED` | Document states `AUTH_START_WORKAID=NO`, no counterpart credentials, no practice-system connector; four synthetic personas | Demonstrates ideas and grants, not production behaviour; handoff states `OFFERED`/`ACCEPTED_VIEW` are not professional acceptance (WA-R3-007) |
| Clio connector | none | `NOT_IMPLEMENTED` | Only demo phrase-blocking forbids "Clio-integrated" | Must stay true for the pilot candidate; enforced by test `[WA-T096]` |
| Privacy controls (small-cell, retention) | — | `PROPOSED` | Spec only | Retention is a legal decision (T067 blocked) |

## Reusable Union Eyes capabilities confirmed (source level)

1. The three-layer grant shape (authority → matter grant → document grant) with status, expiry and revocation columns, and organization-bound ids.
2. Evaluators that deny on wrong user, organization, specialist organization and matter, and check expiry at call time.
3. The deadline engine's *transport patterns* (durable schedule row, idempotent key, recipient snapshot, retry/dead-letter, append-only audit) — mirrored as a contract, not imported.
4. Demo persona vocabulary for the specialist, institutional admin, union viewer and member roles.

## Corrections to v0.1 and to the Grok baseline

- v0.1 §2 listed `recipient-resolver.ts` as "rejects `claim_deadlines`" — confirmed, and strengthened: the reuse hazard is closed by separation, not by adaptation.
- The Grok R4–R6 research clone was at `34f441d3`, which did not contain the pack SHA; its source citations are therefore attributed to the sibling R3 clone at `38a824918`, which does. Everything above was read from `38a824918` directly.
- `wcb_claim` is **not** evidence of an Ontario WSIB specialization (Grok architecture note); it is a generic scope label with no routes.

## Unverified assumptions (carried, not resolved)

1. Existing unit tests for the evaluators and external routes pass at `38a824918` — not executed here (no installed workspace in this worktree).
2. The members-and-memberships model can carry a WorkAid member across two unions without a join by name or claim number.
3. Main-app member portal surfaces.
4. Whether a Clio API supports the receipt-task deep links assumed by Option B — no official capability check has been made.
