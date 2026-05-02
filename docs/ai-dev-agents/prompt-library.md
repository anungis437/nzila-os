# Nzila AI Dev Agent System - Prompt Library

All prompts are reusable templates grounded in existing NzilaOS structure.

## Prompt Rules

- Use only real repo paths and commands.
- Do not assume missing features exist.
- Cite evidence (`apps/`, `packages/`, `scripts/`, `docs/`, `governance/`).
- If a capability is missing, state it explicitly as a gap.

## 1) Repo Analysis Prompts

### A1 - Drift and Enforcement Snapshot

"Analyze repo enforcement drift using current scripts and docs. Use `package.json` scripts, `scripts/governance-check.ts`, `scripts/check-decision-coverage.ts`, `scripts/ue-qa-gate.ts`, `docs/union-eyes/qa/rbac-reality-map.md`, and `docs/union-eyes/qa/user-story-coverage-matrix.md`. Output gaps with file evidence, severity, and reproducible commands."

### A2 - Decision/NAR Surface Audit

"Inventory changed mutation surfaces and verify each maps to decision-core and NAR expectations. Use existing route files in `apps/**/app/api/**/route.ts`, decision coverage script behavior, and UE QA matrix expectations. Flag every missing mapping as blocking."

## 2) Implementation Prompts

### I1 - Minimal Scoped Fix

"Implement only the approved scope from analyst findings. Modify the smallest set of files possible. Preserve existing architecture boundaries in `apps/`, `packages/`, and `scripts/`. Add/adjust tests when behavior changes."

### I2 - Contract-Safe Refactor

"Refactor affected module without changing external behavior or contracts. Keep route signatures, package exports, and existing governance/QA command compatibility."

## 3) QA Prompts

### Q1 - API and E2E Coverage Build

"Generate or update API and E2E tests for changed critical paths only. Ensure tests are deterministic and executable in existing test projects."

### Q2 - UE Gate Enforcement

"Run `pnpm ue:qa:gate` and report the exact failing stage(s) if any. Treat any RBAC `UNKNOWN`, missing decision expectation, or missing NAR expectation as blocking."

## 4) RBAC Discovery Prompts

### R1 - RBAC Reality Mapping

"Discover RBAC from implementation reality only. Cross-check route guards, auth middleware, and role checks against `docs/union-eyes/qa/rbac-reality-map.md`. Do not invent roles/permissions. Mark unverifiable entries as gaps."

### R2 - Authorization Unknown Elimination

"Find and resolve `UNKNOWN` authorization expectations by linking each entry to real guard logic and tests. If unresolved, keep as blocking and do not downgrade severity."

## 5) Audit/NAR Validation Prompts

### N1 - Decision Coverage Strict Validation

"Run strict decision coverage and summarize all blocking failures with file evidence and route/decision mapping impact."

### N2 - NAR Integrity Validation

"Run NAR/pipeline integrity checks and report pass/fail with command outputs. Any integrity failure is blocking."

## 6) Pipeline Validation Prompts

### P1 - Full Gate Validation

"Execute required validation gates in strict order: `pnpm typecheck`, `pnpm lint`, `pnpm test:fast`, `pnpm governance:check`, `pnpm decision:coverage:strict`, `pnpm ue:qa:gate`, plus pipeline/integrity/alert checks. Stop on first failure."

### P2 - Final GO/NO-GO Report

"Produce final report with stage outcomes, commands, exit codes, remaining gaps, and risk level. Output explicit GO or NO-GO with rationale."
