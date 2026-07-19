# CourtLens Migration Planning (Phase 0)

This folder contains migration planning documents for bringing the legacy CourtLens Access product model into the current NzilaOS ABR stack.

Phase 0 scope is documentation and domain mapping only.

## CourtLens Doctrine

- CourtLens is supervised, review-ready justice operations infrastructure.
- CourtLens is not an AI lawyer and does not provide final legal advice.
- AI output is draft-only until human reviewer approval.
- Tenant isolation is mandatory.
- Auditability is mandatory.
- Privacy-safe handling of sensitive client data is mandatory.
- Bilingual readiness (EN/FR) is mandatory.
- Canadian access-to-justice context is mandatory.
- CourtLens should reuse ABR's existing incident, organization, RBAC, evidence, audit, and AI governance structure wherever possible; new CourtLens-specific structures require a documented gap.

## Documents

- `legacy-product-inventory.md`: Legacy Base44 product inventory, reusable concepts, and explicit non-migration items.
- `target-architecture.md`: Mapping from legacy CourtLens concepts to the current `@nzila/abr` and platform infrastructure.
- `migration-gap-analysis.md`: Capability-by-capability gap analysis with pilot/demo/later/do-not-migrate classification.
- `pilot-readiness-plan.md`: Smallest credible access-to-justice pilot definition and strict demo gate.
- `implementation-sequence.md`: Phase-by-phase implementation sequence and validation gates.

## Phase 0 Guardrails

- No application code changes.
- No schema changes.
- No route or API handler changes.
- No Stripe implementation work.
- No copying of secrets, app IDs, keys, or environment-specific values.
