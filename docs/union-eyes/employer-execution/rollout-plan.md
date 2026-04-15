# Employer Execution Rollout Plan

## Phase 1: Pilot Enablement
- Apply schema domain and API routes.
- Seed Marathon pilot org and entitlement set.
- Validate upload -> payroll -> remittance -> replay -> evidence flow.

## Phase 2: Controlled Expansion
- Add additional employers under same runtime profile.
- Harden mapping dictionaries for classification/worksite resolution.
- Add approval workflow integrations with governance controls.

## Phase 3: Production Hardening
- Add queue-backed worker orchestration for long-running runs.
- Add stronger artifact storage backend and signed retrieval.
- Expand controls reporting and exception analytics.

## Exit Criteria
- Deterministic replay parity across pilot data sets.
- Zero cross-org leakage in execution queries.
- Verified evidence seal integrity on official runs.
