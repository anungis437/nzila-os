# Nzila AI Dev Agent System - Human Review Policy

## Policy Objective

Define trust boundaries between AI agents and human approvers for NzilaOS.

## What AI Agents CAN Do

- Implement scoped code and tests.
- Generate and update technical documentation.
- Analyze repo structure and enforcement drift.
- Execute validation commands and produce reports.

## What AI Agents CANNOT Finalize

- Security-critical logic acceptance.
- RBAC definition or authorization model finalization.
- Audit/NAR guarantee finalization.
- Production deployment approval.

## Human Review Is Required For

- RBAC changes (roles, permissions, guard behavior, authorization scope).
- Decision-core and NAR requirement changes.
- Governance pipeline or gate logic changes.
- Production release approvals.

## Human Reviewer Checklist (Blocking)

1. Verify RBAC changes match implementation and policy docs.
2. Verify decision-core + NAR guarantees remain intact.
3. Verify cross-org isolation remains enforced.
4. Verify mandatory gates passed from fresh run artifacts.
5. Verify no unresolved high/critical risks remain.

## Approval Model

- AI output is a proposal, never final trust authority.
- Human reviewer signs off trust-critical changes before merge.
- Without required sign-off, status remains `NO-GO`.
