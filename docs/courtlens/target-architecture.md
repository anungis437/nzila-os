# Target Architecture: CourtLens on `@nzila/abr`

## Objective

Map the legacy CourtLens product model into existing NzilaOS ABR and platform primitives as an access-to-justice vertical configuration, without porting legacy Base44 runtime assumptions.

## Reuse-First Architecture Principle

CourtLens is not a parallel architecture beside ABR.

CourtLens is ABR applied to access-to-justice operations:

- Reuse ABR incident/workflow patterns as the foundation for matters.
- Reuse ABR org context and scoped DB patterns for tenant isolation.
- Reuse ABR RBAC and visibility patterns before introducing CourtLens-specific role structures.
- Reuse ABR AI legal actions and compose them into review-packet workflows.
- Reuse ABR evidence/NAR/audit patterns for packet proof and AI-vs-human traceability.

CourtLens implementation must not duplicate ABR primitives for incident lifecycle, org scoping, RBAC, audit, evidence, NAR, blob/document handling, or AI legal actions unless a documented Phase 1 reuse audit proves the ABR primitive cannot safely support the CourtLens requirement.

New CourtLens-specific structures are allowed only where a documented gap exists.

## Build on Existing Infrastructure

Migration design centers on existing platform capabilities:

- `@nzila/db` for scoped data access.
- `createAuditedScopedDb(orgId, actor)` for write-time audit enforcement.
- `ORG_SCOPED_TABLES` registry for org boundary governance.
- Scoped DB forced-audit-on-write behavior to prevent unaudited mutation paths.
- Existing ABR org-context and API guards.
- Existing ABR RBAC and visibility/redaction patterns.
- Existing ABR AI legal action patterns.
- Existing evidence and NAR proof patterns.
- Existing blob/document/evidence infrastructure where available.

## Legacy-to-Target Concept Mapping

- Legacy four surfaces map to ABR views/permissions/scope layers:
  - Public intake surface (unauth).
  - Tenant operations surface (org-scoped).
  - Parent/network oversight surface (aggregate scope).
  - Platform operations surface (platform scope).

- Legacy matter model maps to ABR incident/case patterns with CourtLens vocabulary.

- Legacy source verification and jurisdiction intelligence map to ABR intelligence/governance patterns plus CourtLens trust adapters where ABR does not already provide the surface behavior.

## Reuse Mapping (Legacy Concept -> ABR Primitive -> CourtLens Adaptation)

A CourtLens matter should be treated as an ABR incident/case specialization unless Phase 1 proves a hard domain mismatch.

- Matter -> ABR incident/case pattern -> CourtLens vocabulary and field semantics.
- Matter status -> ABR incident FSM pattern -> A2J lifecycle state adaptation.
- Client profile -> ABR participant/client representation if available -> minimal CourtLens extension only if needed.
- Documents -> existing blob/evidence/document infrastructure -> CourtLens document views and packet linkage.
- Review packet -> ABR AI legal actions + evidence/NAR composition -> supervised packet workflow.
- Referral/status -> governed workflow and incident transition patterns -> A2J referral state layer.
- Tenant isolation -> ABR org context + `x-org-id` + scoped DB -> CourtLens tenant-safe projections.
- Audit proof -> audited scoped DB + evidence/NAR -> packet/reviewer/AI traceability outputs.

## Domain Facets and Thin Adapters

CourtLens workstreams should be treated as domain facets or thin adapters over ABR primitives, not automatically as new isolated packages/modules.

Planned facets:

- Matters.
- Clients.
- Documents.
- Referrals.
- Reviewer workflow.
- Audit.
- AI review packet generation.
- Public intake.
- Tenant intake.
- Impact reporting.
- Billing.
- Jurisdiction/source verification.

Implementation posture:

- Start by adapting ABR primitives.
- Add CourtLens-specific adapter layers only for proven gaps.
- Avoid duplicating ABR incident/workflow/audit/RBAC foundations.

## Facet Intent and Boundaries

## Matters
- Owns matter lifecycle, status transitions, urgency/risk indicators, assignment, and queue visibility.
- Reuses ABR incident transition and queue patterns with CourtLens naming and policy tuning.
- Writes must use `createAuditedScopedDb(orgId, actor)`.

## Clients
- Owns sensitive intake/client profile records.
- Reuses ABR representation patterns where available before extending schema models.
- Strictly tenant-scoped reads/writes and redacted projection surfaces for higher-level aggregations.

## Documents
- Owns document metadata, storage references, provenance, and review linkage.
- Reuses existing blob/evidence/document primitives; no direct secret coupling.

## Referrals
- Owns referral suggestion/approval/sent/completed lifecycle.
- Reuses governed workflow transition patterns and supervised handoff controls.

## Reviewer Workflow
- Owns assignment, review states, notes, and approval actions.
- Reuses ABR workflow and visibility patterns, adapted to legal-service review context.
- Provides queue ordering by risk and urgency.

## Audit
- Owns structured activity/event streams and exportable accountability traces.
- Reuses ABR audited scoped DB and evidence + NAR lineage patterns.

## AI Review Packet Generation
- Composes ABR AI legal actions into structured draft packet generation from intake + documents + extracted facts + source citations.
- AI output remains non-final until human approval status update.

## Public Intake
- Public issue intake collection and document submission pre-processing.
- Reuses ABR governance and request-context controls for intake mutation paths.
- No legal advice output.

## Tenant Intake
- Tenant-managed intake operations and intake triage controls.
- Reuses ABR org-scoped access patterns and role-based visibility.
- Includes staff-level correction and follow-up workflows.

## Impact Reporting
- Aggregated metrics for tenant/parent/platform audiences with least-disclosure enforcement.
- Reuses ABR reporting/export primitives where applicable.

## Billing
- Operationally separate from casework domain modules.
- Subscription and invoicing status should not govern core case lifecycle logic.

## Jurisdiction/Source Verification
- Tracks source freshness, citation trust, and jurisdiction applicability.
- Reuses ABR intelligence/governance source handling before adding specialized adapters.
- Surfaces confidence and provenance signals to reviewers.

## Tenant Boundary Enforcement Model

Design requirements:

- Every tenant-owned table is org scoped and listed in `ORG_SCOPED_TABLES` unless explicitly exempted with documented reason.
- All writes flow through `createAuditedScopedDb(orgId, actor)`.
- Read models must prove organization scope before query execution.
- Parent/network views consume aggregate projections that avoid child tenant matter detail leakage.
- Platform views are policy-controlled and auditable.

Operational implications:

- No raw cross-tenant query paths for operational case detail.
- Support session access, if implemented, must use explicit approval workflow and audit trail.

## Parent/Network Aggregation Model

Parent layer behavior:

- Parent users view child tenant metadata and aggregate performance metrics.
- Parent users do not get unrestricted direct access to child tenant matter details.
- Detail access, if required for support/escalation, must be gated by explicit support session controls and audit proof.

This model should reuse ABR aggregation and redaction patterns before introducing CourtLens-specific reporting layers.

## Human-in-the-Loop AI Governance

Required controls:

- AI outputs carry draft status only.
- Reviewer approval required for externalized outputs.
- Draft status lifecycle (for example, AI Draft -> Needs Verification -> Approved/Rejected/Revised) is explicit and auditable.
- Output provenance includes source citation and jurisdiction context.
- Audit differentiates AI-generated artifacts from human-approved decisions.

This control plane is implemented by composing ABR AI actions with ABR audit/evidence/NAR primitives, not by introducing a separate AI subsystem.

## Jurisdiction/Source Verification and Reviewer Trust

Trust model requirements:

- Each packet references source artifacts and jurisdiction metadata.
- Stale or unverified source states are visible to reviewers.
- Reviewer-facing trust indicators are included before approval action.
- Verification checks are logged as auditable events.

## Role Model (Phase 0 Documentation Decision)

Legacy and target role reality:

- Legacy CourtLens role model: 13 roles across platform/parent/tenant layers.
- Current ABR role model: 9 roles with ABR-specific permissions and redaction rules.

Phase 0 recommendation:

- Document a CourtLens role map and permission intent.
- Prioritize adapting ABR RBAC and visibility patterns before inventing CourtLens-specific RBAC structures.
- Defer final implementation path choice (adapt ABR role model vs. layered CourtLens role map) to Phase 1 architecture implementation.
- Do not commit to either implementation path in Phase 0.
