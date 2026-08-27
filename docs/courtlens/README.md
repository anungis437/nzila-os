# CourtLens (Pilot / active MVP)

CourtLens is the governed access-to-justice and legal matter-intelligence platform that converts intake into triaged, evidence-backed, human-reviewed matters and referral-ready outputs. It is evolved and productized on the ABR technical substrate (`apps/abr/`, package `@nzila/abr`) and retains FAIRCASE tribunal-intelligence and Anti-Black-racism accountability capabilities as lineage.

**Status:** Pilot / active MVP (Phases 2A–2F shipped). This folder retains the Phase 0 planning artifacts as historical context and continues to host the doctrine and reuse mapping.

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
