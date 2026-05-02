# Nzila AI Dev Agent System - Operating Model

## Objective

Establish a deterministic, reproducible internal AI-assisted dev workflow for NzilaOS that:

- enforces existing gates,

- blocks unsafe/unverifiable changes,

- aligns RBAC with implementation reality,

- preserves decision-core and NAR guarantees,

- requires humans for trust-critical finalization.

## System Topology

Pipeline order (fixed, fail-fast):

1. Repo Analyst Agent
2. Implementation Agent
3. QA Agent
4. Security/Governance Agent
5. Docs/Release Agent
6. Final QA Gate Authority

Rules:

- Stop on first failure.

- No downstream agent may override upstream failures.

- QA gate authority is final GO/NO-GO decision.

- Human approval is mandatory for trust-critical layers before merge/release.

## Determinism and Reproducibility

Controls:

- Fixed stage order and fixed command order.

- Fail-fast behavior with non-zero exit on first blocking error.

- Every run emits structured artifacts under `artifacts/ai-dev-agent/`.

- Validation uses existing repo scripts only.

- Report includes command, exit code, and stage status.

## Stage Responsibilities

Repo Analyst:

- Produce evidence-backed findings from real files only.

Implementation:

- Apply minimal scoped changes aligned to approved findings.

QA:

- Run API/E2E and UE QA gate; enforce RBAC/Decision/NAR test expectations.

Security/Governance:

- Validate authorization integrity, org isolation, decision coverage strictness, and NAR chain integrity.

Docs/Release:

- Update runbooks/docs/evidence references to match validated implementation.

Final QA Gate:

- Enforce final GO/NO-GO based on all required validations.

## Mandatory Output Standard (All Agents)

Every agent output must include:

- Changed files list.

- Summary of changes.

- Validation commands run.

- Validation results.

- Remaining gaps.

- Risk level (`low`, `medium`, `high`, `critical`).

## Safety Constraints (Hard Rules)

Agents must never:

- invent roles/permissions,

- bypass auth guards,

- skip decision-core enforcement,

- skip NAR proof guarantees,

- fake or fabricate test coverage,

- modify audit records to hide failures,

- weaken governance gates or policies.

## Repo Integration

Automation entrypoint:

- `scripts/ai-agent-runner.ts`

Commands:

- `pnpm ai:analyze`

- `pnpm ai:implement`

- `pnpm ai:qa`

- `pnpm ai:validate`

- `pnpm ai:full-run`

## GO / NO-GO Logic

GO only when:

- all mandatory validations pass,

- no RBAC `UNKNOWN` remains,

- no required Decision/NAR expectation is missing,

- no cross-org leakage indicator remains,

- no critical alerting state remains.

Any violation is NO-GO.
