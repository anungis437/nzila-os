# CourtLens Implementation Sequence

## Scope Control

This sequence is intentionally strict and prevents pre-mature expansion into code changes before domain lock.

## Phase 0: Documentation and Domain Mapping Only

## Objective
- Lock CourtLens product doctrine, domain boundaries, and migration architecture.

## Included Work
- Legacy product inventory.
- Target architecture mapping.
- Gap analysis.
- Pilot readiness plan.
- Implementation sequencing.

## Excluded Work
- Application code changes.
- Schema/table changes.
- Route/API changes.
- Billing implementation.

## Validation Gate
- CourtLens planning docs created and internally consistent.
- Docs index regeneration succeeds (if command available).
- Docs validation passes.

## Stop Condition
- Do not begin Phase 1 until Phase 0 docs are approved.

## Phase 1: ABR Reuse Audit and Tenant-Safe Read Model

## Objective
- Establish a reuse-first ABR adaptation baseline and safe read foundations.

## Included Work
- ABR reuse audit covering:
	- which incident APIs can serve CourtLens matters.
	- which incident FSM pattern can serve CourtLens matter lifecycle.
	- which ABR RBAC roles/visibility patterns can map to CourtLens role intent.
	- which evidence/blob/audit primitives can support documents and review packets.
	- which true gaps require thin CourtLens adapters.
- Minimal CourtLens-specific adapters/configuration for documented gaps only.
- Org-scoped read model adaptation using existing scoped DB patterns.
- Role model implementation decision (deferred from Phase 0).
- CourtLens RBAC/visibility mapping by adapting ABR patterns first.

## Excluded Work
- Public intake production flow.
- Full review packet automation.
- Billing rollout.
- New parallel domain stack that duplicates ABR primitives.

## Validation Gate
- Reuse audit completed and approved.
- Tenant-scope proof for read paths.
- Role-based visibility tests pass.
- No unaudited write paths introduced.

## Stop Condition
- Halt before any public-facing intake release if tenant safety checks fail.
- Halt immediately if implementation starts duplicating ABR incident/workflow/audit/RBAC primitives instead of reusing them.

## Phase 2: Public Intake and Matter Queue

## Objective
- Deliver intake-to-queue operational foundation.

## Included Work
- Public intake flow.
- Tenant intake flow.
- Matter queue and detail baseline.
- Document linkage baseline.

## Excluded Work
- Full packet approval orchestration.
- Parent/platform parity features.

## Validation Gate
- Intake creates tenant-scoped matters.
- Queue behavior and matter visibility pass role/scope tests.
- Core flow audit events emitted.

## Stop Condition
- Halt if any cross-tenant leakage is detected.

## Phase 3: Review Packet Workflow

## Objective
- Deliver supervised packet lifecycle for reviewer operations.

## Included Work
- AI packet draft generation.
- Draft status lifecycle and reviewer approval/revision/rejection controls.
- Source/jurisdiction trust signals surfaced in reviewer workflow.
- Referral/status tracking completion.

## Excluded Work
- Advanced parent analytics and platform-wide admin completion.
- Full billing hardening.

## Validation Gate
- Human approval required before externalized packet use.
- AI-to-human decision lineage auditable.
- Source/jurisdiction verification status visible to reviewer.

## Stop Condition
- Halt if approval gate can be bypassed.

## Phase 4: Audit, Reporting, and Billing Hardening

## Objective
- Production-grade governance, reporting, and commercial hardening.

## Included Work
- Expanded audit/event and evidence integrity checks.
- Impact reporting for tenant/parent/platform audiences.
- Billing integration hardening with clean separation from casework.
- Parent/network aggregation controls and support workflow hardening.

## Excluded Work
- New domain expansions not tied to pilot-to-production hardening.

## Validation Gate
- Audit/export and reporting correctness checks pass.
- Billing boundaries verified (no casework coupling regressions).
- Security/compliance checks pass for scoped production readiness.

## Stop Condition
- Halt release promotion if governance/audit or billing-separation gates fail.

## Build-First Recommendation

Build this sequence first:

Public intake -> matter queue -> review packet -> human approval -> referral/status.

This sequence is the smallest path to real institutional value while preserving CourtLens doctrine and legal safety boundaries.
