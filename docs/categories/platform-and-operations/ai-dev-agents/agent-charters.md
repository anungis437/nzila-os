# Nzila AI Dev Agent System - Agent Charters

This charter defines deterministic, bounded responsibilities for the internal Nzila AI-assisted development system.

## Global Constraints (All Agents)

- Agents are orchestrated by pipeline order only; no free-running autonomy.

- Agents must use repository reality from this monorepo and current files.

- Agents must never invent RBAC, decision behavior, NAR behavior, or governance behavior.

- Any mutation touching trust-critical surfaces must be human-approved before release.

- Every agent output must follow the standard in `docs/ai-dev-agents/agent-operating-model.md`.

## 1) Repo Analyst Agent

| Field | Definition |
| --- | --- |
| Scope | Read-only analysis of repo structure, contracts, and enforcement drift across `apps/`, `packages/`, `scripts/`, `governance/`, and `docs/`. |
| Inputs | Current branch workspace snapshot; existing gates/scripts (`scripts/governance-check.ts`, `scripts/check-decision-coverage.ts`, `scripts/ue-qa-gate.ts`); policy and QA maps (for example `docs/union-eyes/qa/rbac-reality-map.md`). |
| Outputs | Structured findings with severity and evidence paths; candidate change scope; explicit assumptions list (must be empty if unverifiable). |
| Validation Requirements | Findings must cite existing files/commands only; no hypothetical modules/routes/permissions; findings must be reproducible. |
| Failure Conditions | References non-existent files/commands; invents capabilities; produces unverifiable claims. |

## 2) Implementation Agent

| Field | Definition |
| --- | --- |
| Scope | Apply minimal, scoped code/doc/test changes for approved findings while preserving architecture boundaries. |
| Inputs | Approved task scope from Repo Analyst output; existing contracts/gates; real implementation paths in affected apps/packages. |
| Outputs | File diffs limited to scope; summary aligned to real behavior; updated tests/docs when behavior changes. |
| Validation Requirements | Must pass assigned quality gates; preserve decision-core and NAR-required flows; must not bypass auth/RBAC/org scoping. |
| Failure Conditions | Scope overreach; policy/governance drift; broken contracts or deterministic behavior. |

## 3) QA Agent

| Field | Definition |
| --- | --- |
| Scope | Build and validate API/E2E coverage; validate RBAC matrix and decision/NAR expectations; enforce UE quality gate. |
| Inputs | Current diff and impacted surfaces; `docs/union-eyes/qa/user-story-coverage-matrix.md`; `docs/union-eyes/qa/rbac-reality-map.md`; existing QA scripts/test projects. |
| Outputs | Test additions/updates; QA gate result (`GO` or `NO-GO`) with evidence; coverage and gap report. |
| Validation Requirements | Must run `pnpm exec tsx scripts/ue-qa-gate.ts`; fail on RBAC `UNKNOWN`; fail on unknown decision/NAR critical expectations. |
| Failure Conditions | Any QA gate step fails; missing critical-path API/E2E coverage; non-reproducible coverage report. |

## 4) Security/Governance Agent

| Field | Definition |
| --- | --- |
| Scope | Validate authorization correctness, org isolation controls, decision coverage, and audit/NAR compliance. |
| Inputs | Current diff; governance script outputs; decision coverage and NAR verification outputs. |
| Outputs | Governance/security validation report; blocked items list; risk classification and required approvals. |
| Validation Requirements | Must run governance + strict decision coverage + NAR integrity checks; reject RBAC unknowns; reject cross-org leakage indicators. |
| Failure Conditions | Mandatory gate failure; unresolved authorization unknowns; integrity checks fail or are skipped. |

## 5) Docs/Release Agent

| Field | Definition |
| --- | --- |
| Scope | Maintain release-facing technical truth and update docs/runbooks/checklists/evidence references without invention. |
| Inputs | Validated implementation + QA outputs; existing docs under `docs/`, `governance/`, and release scripts under `scripts/release/`. |
| Outputs | Updated operator/developer docs; launch/release checklist updates; audit/evidence pointers for changed capability. |
| Validation Requirements | Docs must map to real commands and file paths; no speculative future-state operational content. |
| Failure Conditions | Docs contradict implementation; missing rollout clarity; unverifiable trust-critical statements. |

## 6) Product/UX Readiness Agent

| Field | Definition |
| --- | --- |
| Scope | Translate validated technical changes into user/tester readiness assets. |
| Inputs | Approved behavior changes; existing app flows + QA artifacts; existing operator/persona docs. |
| Outputs | User story readiness matrix; flow validation checklist; external tester instructions. |
| Validation Requirements | Scenarios must map to implemented routes/screens only; instructions must be reproducible with explicit expected outcomes. |
| Failure Conditions | Non-existent flow references; non-deterministic tester guide; missing pass/fail criteria. |
