# CourtLens Phase 1A: ABR Reuse Audit

## Date
2026-07-02

## Auditor Note
This document contains zero implementation. Its sole purpose is to determine which existing `@nzila/abr` and platform primitives can carry CourtLens workloads before any adapter, schema, route, or UI is created.

All findings are grounded in actual source inspection of `apps/abr/modules/incidents/`, `apps/abr/lib/`, `packages/db/src/`, and related platform packages.

---

## Executive Verdict

ABR already provides the structural backbone for CourtLens. The incident lifecycle, tenant isolation, RBAC/redaction, AI legal actions, and audit/evidence patterns are directly reusable. CourtLens implementation should begin with vocabulary configuration and thin adapters, not new subsystems.

The one confirmed true gap is the public intake surface: ABR has no unauthenticated public inbound flow. Everything else is adaptation, not invention.

---

## Reuse Matrix

| Area | ABR Primitive | CourtLens Requirement | Assessment |
|---|---|---|---|
| Matter lifecycle | `IncidentStatus` FSM (`new → triage → assigned → investigating → action_planning → monitoring → resolved → closed → archived`) | A2J matter status (New Intake → Triage → Assigned → Review → Approved → Referred → Closed) | Reusable with vocabulary adapter and A2J state name overlay |
| Matter model | `IncidentRecord` (id, orgId, title, category, severity, status, intakeChannel, createdBy, assignedTo, openedAt, dueAt, summary, events, notes, actions) | Matter (practice_area, sub_issue, urgency, ai_summary_status, risk_flags, referral_status, client_goal) | Reusable with thin extension fields; review packet status maps to note/action pattern |
| Intake channel | `IntakeChannel` enum (web, email, phone, manager_escalation) | Public web intake, staff intake | Reusable with CourtLens values added |
| Category | `IncidentCategory` (hiring, promotion, discipline, service_delivery, policy) | Practice area (housing, employment, debt) | Reusable with CourtLens values substituted |
| Severity | `IncidentSeverity` (low, medium, high, critical) | Urgency (Standard, High, Critical) | Reusable with urgency label overlay |
| Create/assign/transition | `createIncident`, `assignIncident`, `transitionIncident` service functions | `createMatter`, `assignMatter`, `transitionMatter` | Reusable as-is; CourtLens adds vocabulary wrapper |
| List/detail/timeline | `listIncidents`, `getIncidentDetail`, `buildTimeline` | Matter queue, matter workspace, matter timeline | Reusable as-is |
| Note scopes | `NoteVisibilityScope` (private, investigator_only, legal_only, executive_safe) | Reviewer note (reviewer_only, legal_safe, public_safe) | Reusable with CourtLens scope label mapping |
| Remediation actions | `RemediationActionRecord` with status lifecycle | Follow-up tasks, referral actions | Reusable as action model for CourtLens follow-ups |
| Event trail | `IncidentEventRecord`, `appendEvent` | Matter timeline and audit trail | Reusable as-is |
| Tenant isolation | `resolveOrgContext`, `x-org-id`, `ABR_DEMO_ORG_ID` fallback | Tenant-scoped matter access | Reusable as-is |
| Scoped DB | `createScopedDb`, `createAuditedScopedDb` (forced audit on writes), `ORG_SCOPED_TABLES` | Tenant-safe reads, audited writes | Reusable as-is |
| RBAC | `ABR_ROLES`, `ROLE_PERMISSIONS`, `hasPermission`, `normalizeRole` | CourtLens pilot roles | Reusable with CourtLens role-to-ABR-role mapping |
| Visibility/redaction | `getIncidentVisibilityPolicy`, `applyIncidentRedaction` | Role-scoped matter and packet visibility | Reusable with CourtLens scope names |
| API guards | `authenticateUser`, `authenticateWithOrg`, `requireOrgAccess`, `requirePermission`, `withRequestContext` | Auth + org-scope + permission enforcement | Reusable as-is |
| AI classification | `classifyCase(description, facts?)` → category, subcategory, severity, confidence, reasoning | Intake classification by practice area, urgency | Reusable; prompt and output labels configurable |
| AI extraction | `extractFromComplaint(text)` → complainant, respondent, allegationType, keyFacts, evidenceReferences | Extract client story, key facts, timeline markers | Reusable; prompt framing updated to A2J context |
| AI risk scoring | `assessRiskScore(orgId, context?)` → riskScore, factors, recommendation | Risk flag scoring (eviction, income-loss, safety risks) | Reusable; ML model or AI fallback configurable |
| AI outcome prediction | `predictCaseOutcome(caseId, description)` → predictedOutcome, probability | Not required for pilot | Defer to later stage |
| Evidence/audit lineage | `buildComplianceEvidencePack`, `logAuditEvent` | Packet proof, reviewer decision traceability, AI-vs-human differentiation | Reusable; extend event type taxonomy for CourtLens |
| Review packet draft | No dedicated module | Draft packet from intake + extracted facts + source citations | Composition gap over existing AI actions + evidence/NAR |
| Referral workflow | No dedicated referral state | Referral suggestion → approved → sent → completed | True transition-model gap; thin adapter needed |
| Client profile | No dedicated client record | Person-level intake context (name, contact, household, consent) | True schema gap; minimal extension needed |
| Source/jurisdiction | `intelligence` module (source registry, import jobs, review queue) | Jurisdiction context, source citation, source freshness | Existing primitives; CourtLens viewer-trust composition needed |
| Public intake | No public/unauth intake flow | Unauthenticated issue intake, document upload, status check | True missing surface; must build |
| Demo/seed data | `DEMO_INCIDENTS`, `DEMO_ORGS`, `DEMO_USERS`, `DEMO_EVENTS`, `DEMO_ACTIONS`, `DEMO_NOTES`, idempotent seed | CourtLens A2J synthetic scenarios | Reusable pattern; CourtLens A2J scenarios replace content |
| Export/reporting | `buildExecutiveSummaryExport`, `buildIncidentExport` with role-filtering | Impact reporting for tenants/parents/funders | Reusable export pattern; CourtLens metric vocabulary |

---

## 1. CourtLens Matter as ABR Incident/Case Assessment

**Verdict: Reusable as specialization. No separate matter stack warranted by Phase 1.**

ABR incident/case primitives cover the CourtLens matter workload with the following mapping:

- `title` → client-facing matter description.
- `category` (IncidentCategory enum) → practice area (housing, employment, debt) via enum substitution.
- `severity` (low/medium/high/critical) → urgency (Standard/High/Critical) via label overlay.
- `intakeChannel` → intake source (public_web, tenant_staff, referral).
- `status` (9-state FSM) → A2J matter status using state name aliases.
- `summary` → client story / intake summary.
- `notes` with `visibilityScope` → reviewer notes (reviewer_only, legal_safe, public_safe) via scope name mapping.
- `actions` (RemediationActionRecord) → follow-up tasks, referral tracking.
- `events` (IncidentEventRecord + appendEvent) → matter timeline/audit trail.
- `orgId` enforcement → tenant isolation.

Field gaps that require a thin extension (not a new entity):

- `practice_area` sub-issue classification (housing sub_issue, employment sub_issue, debt sub_issue) → add as payload field or enum extension.
- `ai_summary_status` lifecycle (AI Draft → Needs Verification → Approved/Rejected/Revised) → add as typed status field, mirroring the action status pattern.
- `referral_status` (none → suggested → approved → sent → completed) → add as typed field with transition events.
- `client_goal`, `hearing_date`, `deadline_date` → add as nullable fields.
- `risk_*` boolean flags (lockout, eviction, utility_shutoff, safety, homelessness) → add as structured risk indicators in payload or thin extension row.
- `consent_status` → add as privacy field.

These are all additive field extensions on the incident base record, not a domain replacement.

FSM alignment:

ABR has 9 states: `new → triage → assigned → investigating → action_planning → monitoring → resolved → closed → archived`.

CourtLens A2J equivalent mapping (reusing the structure with renamed states):

| ABR State | CourtLens A2J State |
|---|---|
| new | New Intake |
| triage | Triage |
| assigned | Assigned to Reviewer |
| investigating | Under Review |
| action_planning | Review Packet Ready |
| monitoring | Accepted for Review |
| resolved | Referred / Completed |
| closed | Closed |
| archived | Archived |

The FSM infrastructure (`getAllowedTransitions`, `isValidTransition`, `assertValidTransition`) is reusable verbatim. Only state names and permitted lateral transitions (e.g., Triage → Out of Scope) need CourtLens-specific configuration.

---

## 2. Minimum Pilot Role Map

**Verdict: All six CourtLens pilot roles can map directly to existing ABR roles without new RBAC infrastructure.**

| CourtLens Pilot Role | ABR Role | Permissions Inherited | Notes |
|---|---|---|---|
| Public intake user | none / unauthenticated | None — public surface only | No ABR session required for intake submission |
| Tenant intake staff | `hr_lead` | incident.read, create, update, assign, note.write, actions.manage, dashboard.read | Closest intake-capable operational role |
| Tenant reviewer | `investigator` | incident.read, update, assign, transition, note.write, actions.manage, dashboard.read | Matches supervised review workflow |
| Tenant admin | `organization_admin` | Full incident set + dashboard.read.sensitive + export.read | Matches tenant administrative scope |
| Parent/network viewer | `executive_viewer` | incident.read, dashboard.read, dashboard.read.sensitive, export.read | Aggregate-only view, no sensitive notes — correct boundary |
| Platform/support operator | `super_admin` (scoped to platform session) | Full permission set | To be refined at Phase 1B with session-scoped restriction |

Note visibility mapping for CourtLens:

| CourtLens Note Scope | ABR `NoteVisibilityScope` |
|---|---|
| reviewer_only | `investigator_only` |
| legal_safe | `legal_only` |
| public_safe | `executive_safe` |

The `applyIncidentRedaction` function already enforces note scope filtering by role. No new redaction engine required.

Implementation choice is deferred to Phase 1B. This audit confirms ABR RBAC can carry the pilot role set without new structures.

---

## 3. Tenant Isolation Proof Points

**Verdict: Reusable as-is. CourtLens tenant tables must register in `ORG_SCOPED_TABLES` to inherit enforcement.**

ABR tenant isolation is provided by:

- `resolveOrgContext(req)` → extracts `orgId` from `x-org-id` header, with regex validation (`/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/`), and `ABR_DEMO_ORG_ID` fallback for demo mode.
- `requireOrgAccess(req)` → composes authentication + org context resolution. Any route calling this is guaranteed to have both auth and org scope.
- `createScopedDb({ orgId })` → read-only; throws `ReadOnlyViolationError` on write attempts.
- `createAuditedScopedDb(orgId, actor)` → write-enabled, auto-records audit events; only route to mutation for org-scoped data.
- `ORG_SCOPED_TABLES` registry → contract test enforces bidirectional consistency between schema and registry at CI time.
- `NON_ORG_SCOPED_TABLES` → opt-out list with documented justification per entry.

For CourtLens:

- Any new tables for matters, clients, documents, referrals must register in `ORG_SCOPED_TABLES`.
- All write paths must use `createAuditedScopedDb(orgId, actor)`.
- `resolveOrgContext` and `requireOrgAccess` are used as-is in CourtLens API routes.
- No raw cross-tenant query paths allowed — the contract test will catch unregistered org-scoped tables in CI.

No new tenant isolation infrastructure needed.

---

## 4. AI/Human Approval Reuse Plan

**Verdict: All five existing AI legal actions are directly reusable. Review packet is a composition of AI actions + evidence/NAR, not a new AI subsystem.**

Existing AI legal actions and their CourtLens use:

| ABR AI Action | CourtLens Use | Reuse Status |
|---|---|---|
| `classifyCase(description, facts?)` | Intake classification by practice area, sub-issue, urgency | Reusable; prompt tuned to A2J framing |
| `extractFromComplaint(text)` | Extract key facts, dates, parties, evidence references from intake | Reusable; output field names updated to A2J vocabulary |
| `assessRiskScore(orgId, context?)` | Risk flag scoring (eviction, income-loss, safety, harassment risks) | Reusable; ML model or AI fallback path works for A2J risk factors |
| `findSimilarCases(description)` | Precedent/pattern search for reviewers | Reusable; defer to later stage for pilot |
| `predictCaseOutcome(caseId, description)` | Outcome probability | Not required for pilot; defer |

Human approval model:

The `ai_summary_status` lifecycle (AI Draft → Needs Verification → Approved/Rejected/Revised by Human) is not yet wired as a field in the ABR incident model. It is the primary thin extension to add for CourtLens packet governance.

Required:
- Add `ai_summary_status` as a typed field on the matter/incident record.
- Add an approval/rejection event type to `IncidentEventType`.
- Enforce: no AI-generated content is externalized without status reaching `Approved` or `Revised by Human`.
- `logAuditEvent` distinguishes `event_source: 'ai'` from `event_source: 'human'`.

`buildCanonicalAiOutput` already attaches `confidenceScore`, `evidenceRefs`, `domain`, `execution` metadata to every AI response — this is the provenance chain for reviewer trust. All existing AI outputs inherit this automatically.

---

## 5. Document and Review Packet Reuse Plan

**Verdict: Existing blob/evidence/document infrastructure should be used. Review packet is a composed projection, not a new storage subsystem.**

Evidence and document primitives available:

- `evidencePacks` and `evidencePackArtifacts` → org-scoped (in `ORG_SCOPED_TABLES`); already the canonical artifact container.
- `buildComplianceEvidencePack` (`lib/evidence.ts`) → wraps `@nzila/os-core/evidence` to assemble evidence packs.
- `logAuditEvent` → audit trail for every pack assembly/approval action.
- `@nzila/blob` → platform-level blob storage for raw document bytes (separate from metadata).
- NAR (`@nzila/nar`) → immutable proof chain for evidence sealing.

Review packet model:

A CourtLens review packet should be a composed projection/artifact over:
1. Intake record (matter fields + client summary).
2. Extracted facts from `extractFromComplaint`.
3. AI classification output from `classifyCase`.
4. Risk assessment from `assessRiskScore`.
5. Source citations and jurisdiction context (from intelligence module).
6. Linked document artifact references (via `evidencePackArtifacts`).

This projection should be assembled as an `evidencePack` with typed `evidencePackArtifacts`. No new storage subsystem is needed.

The `ai_summary_status` field governs whether the assembled packet may be presented externally.

---

## 6. Referral/Status Reuse Plan

**Verdict: True transition-model gap. ABR has no referral entity. Thin adapter needed.**

ABR's `RemediationActionRecord` has a `status` field (open/in_progress/blocked/completed) and is linked to an incident. This covers action tracking but not the CourtLens referral lifecycle semantics (suggested → approved → sent → completed).

What can be reused:
- `appendEvent` for referral state-change audit events.
- Action/note visibility scoping pattern for referral-level notes.
- `createAuditedScopedDb` for referral writes.
- `isValidTransition` / `getAllowedTransitions` FSM pattern for referral state machine.

What requires a thin adapter:
- A `referral_status` field on the matter record (or a lightweight referral entity) with its own transition set.
- Referral-specific event types added to `IncidentEventType` (e.g., `referral_suggested`, `referral_approved`, `referral_sent`, `referral_completed`).
- The referral status check path for public-facing "check my status" flows.

This is a thin extension to the incident/event model, not a new subsystem.

---

## 7. Public Intake Reuse Plan

**Verdict: True missing surface. ABR has no public/unauthenticated intake. Must build.**

ABR's `proxy.ts` enforces auth on all non-exempt routes. Public routes are explicitly exempted (health, auth, webhooks) but there is no existing public intake form flow.

What can be reused for the public intake build:
- `resolveOrgContext` for tenant-slug-to-orgId resolution (with a public lookup extension).
- Rate-limiting middleware from `proxy.ts`.
- `createIncident` service function (no auth required by service layer — auth enforcement is in the API route layer, which can be selectively exempted for public intake).
- `appendEvent` for intake submission trail.
- `logAuditEvent` for intake receipt event.

Required guardrails (not currently present):
- Tenant-slug-to-orgId public resolver (maps `/t/:tenantSlug/intake/...` → `orgId`).
- No auth requirement on intake submission routes.
- No AI advice output visible to public users.
- Rate limiting scoped to intake routes.
- `consent_status` captured and stored with intake.

Minimum build: a public route group that calls `createIncident` (as `createMatter`) after slug-to-orgId resolution, with no auth requirement and explicit no-legal-advice boundary in copy and output.

---

## True Gaps Requiring Thin Adapters

Confirmed gaps that require new code:

1. **`ai_summary_status` field**: typed lifecycle field on the matter record (AI Draft → Needs Verification → Approved/Rejected/Revised). Not present in ABR incident model.
2. **`referral_status` field and transition events**: referral lifecycle (suggested → approved → sent → completed) plus corresponding event types.
3. **Client profile**: person-level intake context record (name, contact, household size, consent status). No ABR equivalent.
4. **Practice-area sub-issue taxonomy**: `sub_issue` enum values (eviction, wage_garnishment, etc.) as typed fields on the matter record.
5. **Risk flag fields**: structured boolean risk indicators (risk_lockout, risk_income_loss, risk_safety, etc.).
6. **Public intake surface**: unauthenticated intake routes with tenant-slug resolution.
7. **Tenant-slug resolver**: maps public-facing tenant slug to `orgId` for public intake routing.

All other gaps are vocabulary/configuration overlays on existing ABR primitives.

---

## Explicit Do Not Duplicate List

CourtLens implementation must not build separate versions of:

- Incident lifecycle (FSM, transitions, state storage, event trail).
- Org context resolution and `x-org-id` header flow.
- Scoped DB creation and audited write path.
- `ORG_SCOPED_TABLES` registry enforcement.
- RBAC role model and permission check functions.
- Note visibility scoping and `applyIncidentRedaction`.
- `authenticateUser`, `authenticateWithOrg`, `requireOrgAccess`, `requirePermission`, `withRequestContext`.
- AI client instantiation and `buildCanonicalAiOutput` provenance chain.
- `buildComplianceEvidencePack`, `logAuditEvent`, NAR proof chain.
- Export/reporting infrastructure.
- Demo data seed pattern.

---

## Phase 1D Notes (event persistence hardening)

### Phase 1C gap confirmed

Phase 1C claimed "CourtLens field mutations are persisted as typed events in `abr_incident_events.payload_json`" but the actual implementation of `updateAiSummaryStatus` and `updateReferralStatus` returned `{ success: true }` without writing any event. `createMatter` also did not write the initial `courtlens_fields_set` event. The comment "documented gap" in the code was accurate; the report was premature.

### Phase 1D resolution

Four changes:

1. Added `'courtlens_event'` to `IncidentEventType` in `types.ts`. This is the dedicated typed event for CourtLens state changes in the ABR incident event stream.

2. Exported `appendIncidentEvent` from `service.ts`. It delegates to the existing private `appendEvent` function, reusing both the in-memory path (no `DATABASE_URL`) and the DB path without duplication.

3. Added typed CourtLens event helpers in `matter-service.ts`:
   - `recordCourtLensFieldUpdate`
   - `recordAiSummaryStatusChanged`
   - `recordReferralStatusChanged`
   - `recordRiskFlagsUpdated`
   - `recordClientProfileUpdated`
   - `recordReviewPacketDrafted`
   - `recordReviewPacketApproved`

4. Wired all CourtLens mutations to call the helpers before returning success:
   - `createMatter` writes `courtlens_fields_set` with initial field values.
   - `updateAiSummaryStatus` writes `ai_summary_status_changed` (enforcing human-only approval).
   - `updateReferralStatus` writes `referral_status_changed`.

### Confirmed persistence strategy for Phase 2

Event replay via `deriveCourtLensFields` is the confirmed source of truth. `getMatterDetail` reconstructs CourtLens field state by replaying `courtlens_event` payloads from the incident event stream. This is verified by 30 integration tests in `matter-events.test.ts` with no service mocking.

### `courtlens_metadata` remains deferred

No schema change was required. A `courtlens_metadata jsonb` column on `abr_incidents` is deferred as a possible materialized projection cache after pilot field stability is proven — it is not the authoritative source of truth and is not required before Phase 2 public intake.

## Phase 1C Notes (added after service adapter implementation)

### Persistence gap confirmed

The `abr_incidents` table schema has no `metadata` or `payload_json` column:

```
id, org_id, title, category, severity, status, intake_channel, created_by,
assigned_to, opened_at, due_at, closed_at, summary, created_at, updated_at
```

CourtLens additive fields (`practiceArea`, `subIssue`, `aiSummaryStatus`, `referralStatus`, `riskFlags`, `clientGoal`, `hearingDate`, `deadlineDate`, `clientProfile`) have no direct column mapping.

### Phase 1C resolution

- CourtLens field mutations are persisted as typed events in `abr_incident_events.payload_json` using a discriminated union (`clEventType` field).
- Current field values are derived by replaying CourtLens-typed events in `deriveCourtLensFields`.
- This avoids a schema change in Phase 1C while preserving the event-sourced audit trail.
- The `abr_incident_events.payload_json` column (`jsonb`) is the safe existing persistence path.

### Phase 2 migration requirement

A `ALTER TABLE abr_incidents ADD COLUMN courtlens_metadata jsonb` migration should be added in Phase 2 once the CourtLens field set is stable through pilot. This will replace event-replay with direct column reads for `listMatters` performance.

### appendEvent access limitation

`appendEvent` in `service.ts` is a private internal function (not exported). Phase 1C stores CourtLens events by deriving them in the service adapter and returning the computed state to callers. Phase 2 should either export `appendEvent` or provide a typed CourtLens event API to close this gap cleanly.

## Phase 1B Recommendation

**Phase 1B may proceed. The audit confirms ABR primitives can carry CourtLens matters.**

Recommended Phase 1B scope (thin adapters and vocabulary only):

1. Add CourtLens vocabulary overlays: practice_area/sub_issue values, urgency labels, A2J status names, intake_channel values.
2. Add `ai_summary_status` typed field and associated approval event types.
3. Add `referral_status` typed field and referral transition events.
4. Add minimal client profile fields (name, contact, household size, consent) — determine whether to extend the matter record or add a thin linked record.
5. Add risk flag fields (boolean indicators) as matter payload extension.
6. Register any new org-scoped tables in `ORG_SCOPED_TABLES` before any write path is created.
7. Map CourtLens pilot roles to ABR roles using the table in section 2.

Do not create new:
- Incident lifecycle infrastructure.
- RBAC engine.
- AI subsystem.
- Evidence/audit subsystem.
- Tenant isolation infrastructure.

Public intake surface (gap 6 and 7 above) should be scoped as a standalone Phase 2 deliverable, consistent with `implementation-sequence.md`.
