# Union Eyes V2 — scoped staging GO, residual qualification and capability boundaries

**Recorded:** 2026-11-15  
**Decision class:** Scope/evidence reconciliation, not an amended deployment authorization  
**Accepted app source:** `241006d302c14567e541d619675fbead3ec3f258`  
**Accepted workflow/source evidence:** `c51dcd75094e4af364b5c9d54a75f3321e2eef1b`  
**Current scoped decision:** `STAGING_GO`, 17/17 required criteria PASS  
**Production:** NOT AUTHORIZED  
**Scope control:** Leave deployed image, accepted source tree, finance features, and historical evidence unchanged

## Decision boundary

The [scoped staging acceptance](UE_STAGING_GO_CONTRACT.json) establishes that the named base journeys passed on one admitted staging application image. It does **not** certify every application route, conceptual persona, additional browser/device, operational dashboard, complete SaaS programme, or production release.

A repair that changes a false HTTP 200 or a misleading UI affordance to an honest unavailable state is successful **defect containment**, but not the implementation of that feature. Preserve this distinction in every subsequent claim.

Evidence relied upon:

- [Seven real-Entra role runs](evidence/ue-v2-execution-20261113/security-boundary/actual-seven-personas-and-restoration-241006d3.json).
- [Six reconciled base journeys](evidence/ue-v2-execution-20261113/security-boundary/actual-base-six-reconciled-241006d3.json).
- [Worker scenarios and owned-fixture retirement](evidence/ue-v2-execution-20261113/security-boundary/actual-worker-six-and-retirement-241006d3.json).
- [Bilingual/mobile browser review](evidence/ue-v2-execution-20261113/security-boundary/actual-bilingual-mobile-core-visual-review-241006d3.json).
- [Bounded recovery evidence](evidence/ue-v2-execution-20261113/security-boundary/actual-recovery-241006d3.json).

## Verified role and workflow coverage — do not broaden the assertion

The seven tested **provisioned role values** are `member`, `steward`, `officer`, `secretary_treasurer`, `admin`, `chief_steward`, and `app_owner`. This is not the same as the seven conceptual persona families in the Gate-0 persona specification, and is not proof for every role alias, privilege combination, institutional role or organization protocol.

Within the exact accepted casework journeys, receipts support scoped filing/intake, assignment, directory restrictions, representation authority, document bytes/scanning/revocation, staff-managed deadlines, in-app conversations/replies, formal-grievance reminder scenarios, EN/FR browser presentation, audit/evidence seals, retained original data and bounded recovery.

Specific claims must remain attached to the pertinent receipt; navigation visibility alone does not prove a working operation.

## Next qualification work, in execution order

| Priority | Work | What the evidence supports now | Completion receipt required | What must not be inferred |
|---|---|---|---|---|
| **P0** | New-member invitation and first use | Create/accept routes and automated tests exist; accepted seven-role runs use already-provisioned accounts | Real staging org admin creates a synthetic-member invitation; controlled recipient receives usable invite; recipient redeems it as the correct principal/organization; first authorized case/intake journey persists; replay, expired/foreign/wrong-role and revoked access fail closed; audit and clean fixture retirement | Provider acceptance, link creation or login by an existing account is not full onboarding |
| **P0** | End-to-end persona/access completeness for the **enabled base roles and scenarios** | Seven exact role values tested and positive/negative scoped journeys passed | Record exact roles and org protocols enabled in the base pilot; compare each actual capability to its canonical authority; test direct route/API/resource, cross-tenant and same-tenant unrelated record denial, revocation, and positive permitted mutations on fresh real sessions; report exceptions by role and journey | Seven tested role values do not certify all conceptual/persona variants |
| **P1** | Continuous backup and daily audit-seal **monitoring** | One-time restore, hash chain and evidence seal have accepted receipts | Freshness from authoritative Azure backup metadata; actual daily seal/checkpoint and integrity evidence; accurate age/last-run/severity; failure and inaccessible-source states remain `unknown` or `fail`, not `pass` | A successful one-time restore is not continuously monitored backup health |
| **P1** | Controlled inbox delivery proof | Resend provider accepted worker test messages with retries/continuity | Controlled eligible recipient inbox receipt (and any required webhook/event correlation) on real staging with redacted evidence | API/provider acceptance is not inbox delivery |
| **P1** | Authenticated casework performance | Public-profile p95=354.1058007 ms against 500 ms in the existing receipt | Representative authenticated case/intake/assignment/message/document routes at declared concurrency and workload; route-specific latency/error budgets; repeatable source-bound traces | Public endpoint latency cannot certify authenticated workload |
| **P1** | Scope-accurate capability registry and operational status | Several deadline/operational-health descriptions predate the admitted application and are historical | Reconcile the in-app registry and operational probes at the **next separately admitted application candidate**, preserving `LIMITED` and `unknown` wherever appropriate; cite actual receipts, and verify no regression or claimed new capability | Editing a TypeScript registry file in the admitted app tree changes its source identity; don't imply the old image includes new text |
| **P2 / separately authorized** | Full-traffic failover rehearsal, physical-device/browser-engine certification | Zero-traffic fault/recovery and 390/1440 browser journeys passed | Controlled run plan with impact/rollback boundary; actual traffic and physical target receipts if required for a later release level | Restored-copy proof is not an exercised 100%-traffic cutover |

Do not add administrative approval theatre: use existing founder-operated engineering authority. Before any new Azure/database mutation, verify the applicable current staging-only authorization window and scope. Never mutate production under this record.

## Deadline capability disposition

The current [case-deadline service](../../../apps/union-eyes/lib/cases/case-deadlines.ts) supports staff-entered due dates in the organization's time zone, authorized create/reschedule/complete/cancel, retained terminal records, optimistic concurrency and mandatory audit. [Final-source deadline receipts](evidence/ue-v2-execution-20261113/security-boundary/actual-base-six-reconciled-241006d3.json) cover the accepted case lifecycle.

Two separate things are **not implemented in the accepted base service**:

1. Automatic legal filing-date computation from jurisdiction, agreement, filing/incident date and holiday rules. Staff enter the date; the UI must not assert a legally calculated due date.
2. Intake `claim_deadlines` email reminders. The service returns `remindersAvailable:false`. Formal `grievance_deadlines` use the separate scheduler and its tested worker path; this does not imply intake emails or controlled inbox receipt.

The existing `UE-CASE-DEADLINE-MANAGEMENT` capability registry note still says final source/runtime qualification is pending. Other broad deadline entries use July 2026 evidence as though it were the latest. Correct this **truthful descriptive drift** on the next explicitly admitted source candidate, without changing current runtime behavior, elevating all deadline subcapabilities to `REAL`, or rewriting historical evidence.

The retired `/api/deadlines/[id]/complete` generic route is a different legacy surface from the newly implemented `/api/cases/[caseId]/deadlines` mutation path. Do not label the new case-deadline completion capability unavailable merely because the generic legacy route remains retired.

## Deferred capability requests, not current base acceptance failures

- Direct Add Member form: unavailable; invitation-based onboarding is the intended path and its fresh staging journey still needs proof.
- Standalone case-timeline page: unavailable/unlinked; distinct from accepted case-detail casework.
- Document approval/template authoring: unavailable; document storage, policy-scoped access and evidence are the qualified scope.
- SMS, campaigns, digest and quiet hours: unavailable; persisted in-app messages/replies are the qualified scope.
- Union finance/dues persistence and Financial Officer 2.1: excluded from base; keep existing confidentiality/mandate denials. Nzila subscription billing is a separate commercial system.

Do not turn unavailable extensions into P0 simply because source stubs or UI placeholders exist.

## Completion discipline

For every remaining **P0**:

1. Reproduce or characterize the gap against the exact admitted image; distinguish unverified from failed.
2. If code is defective, fix root cause and add both positive and adversarial regression tests.
3. Re-qualify the new code against the actual staging deployment (with revised, valid source provenance); preserve the accepted old decision as historical.
4. Verify persisted business effects, identity/org/resource scope, failure and retry behavior, audit/notifications and fixture cleanup.
5. Report whether this is a new P0 pass, a bounded unsupported feature, or an external operational dependency.

Never relabel scoped `STAGING_GO` as full SaaS/production GO. Do not reopen accepted work without new contrary evidence. Base-release completion is measured by working promised journeys and correct persona access, not by the volume of feature flags or documentation.
