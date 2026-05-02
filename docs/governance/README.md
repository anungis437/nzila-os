# Governance

Governance in NzilaOS is now centered on decision infrastructure.

The governance layer defines how the platform captures policy references, validates actor authority, preserves proof, and inventories migration gaps before full Nzila Audit Record enforcement.

## Decision Governance Artifacts

- `docs/governance/decision-coverage-inventory.md` — route-by-route decision coverage, audit posture, and migration gaps
- `docs/governance/DECISION_POLICY_MODEL.md` — policy design reference
- `docs/governance/DECISION_REVIEW_WORKFLOW.md` — review and escalation workflow
- `docs/governance/audit-logging-model.md` — audit evidence model
- `docs/governance/decision-intelligence-revenue.md` — monetization, tiering, and data-moat policy for intelligence APIs

## Current Guardrails

- `pnpm decision:coverage` — warning-only decision registration coverage check
- `pnpm decision:coverage:strict` — blocking decision-proof gate (coverage, mappings, proof-required enforcement)
- `pnpm governance:check` — existing governance checks
- `pnpm validate:governance:gate` — governance gate validation

The platform now runs both modes: warning inventory for local visibility and strict blocking gate for CI non-bypassability.

## Audit Guarantees

- Decisions are immutable and retained through append-only records plus immutable blob retention metadata.
- Decision proofs are externally verifiable through hash, signature, and chain continuity checks.
- Audit exports are signed and reproducible through `pnpm audit:pack:verify`.
- Auditor access is time-bound, org-scoped, and read-only.

## Intelligence Guarantees

- Aggregates are generated from immutable decision records and stored separately from the raw ledger.
- Policy insights are derived from aggregate behavior, not mutable operator notes.
- Cross-org benchmarks are anonymized, bucketed, and aggregate-only.
- Intelligence APIs are tier-gated to preserve monetization boundaries.
