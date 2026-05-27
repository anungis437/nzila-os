# Full Governance Noise Reduction

> Reduces governance exhaustion. Establishes precise, trustworthy, scope-bounded CI gating. Authorizes a separate runtime hardening PR.

## Authority Anchors

- [Runtime Integrity README](README.md)
- [Full Governance-Safe Failure Architecture](full-governance-safe-failure-architecture.md)

## Posture

Governance must increasingly feel **precise** and **trustworthy**, not fragile or noisy. A CI gate that fails on PRs unrelated to its scope is governance theater, not governance discipline.

A trustworthy governance gate is:

- explicit in its scope
- bounded in its blast radius
- continuity-safe under partial CI degradation
- reviewer-of-record traceable
- evidence-anchored
- distinguishable between **informational** and **blocking**

## Audit Targets

| Surface | Concern | Required Posture |
| --- | --- | --- |
| `.github/workflows/flow-shopmoica-cutover-gate.yml` | previously triggered on `package.json` (already narrowed) | reviewed every quarter against actual flow-pilot scope |
| `scripts/flow-shopmoica-cutover-check.ts` | runtime sub-gates now respect `--enforce` (already remediated) | all sub-gates must remain explicit; informational vs blocking distinction must be preserved |
| pilot gates (`pnpm exec tsx scripts/pilot-check.ts`) | currently fails when slo-gate, contract-test, or test fail | each subgate must declare whether failure is institutional-blocking or institutional-informational; subgate failure must produce evidence, not noise |
| infra gates | governance, residency, DORA collectors | each gate must declare its blast radius (which PR types it gates) and respect that boundary |
| validator blast radius | doctrine validators | each validator must run only on PRs that touch its scope, plus a daily scheduled run for canary coverage |
| workflow scope | every `paths:` filter | reviewed against actual file dependencies; over-broad filters are governance noise |
| unrelated pipeline coupling | e.g. `package.json` triggering pilot infra checks | eliminated wherever the coupling is incidental |

## Required Implementation (downstream PR)

The downstream PR (`refactor/nzila-governance-noise-reduction`) must actually:

- audit every `.github/workflows/*.yml` `paths:` filter and document its scope rationale alongside the workflow file
- distinguish informational vs blocking subgates inside `scripts/pilot-check.ts` so that informational failures do not exit non-zero on unrelated PRs
- introduce a `gate-scope.json` evidence artifact that records, per workflow, which file globs caused it to run, so unrelated triggers become observable evidence
- add a daily scheduled run (`workflow_dispatch` + `schedule`) for every doctrine validator so per-PR scope reduction does not lose canary coverage
- ensure the cutover gate `--enforce` semantics remain intact for release pipelines while remaining quiet on unrelated PRs

## Forbidden Posture

The following are explicitly rejected:

- **ai-first** flakiness suppression (forbidden — flake suppression is institutional, not ai-powered, not copilot-driven, not chatbot-driven, not workforce ai)
- **autonomous executive** auto-merge of governance-failing PRs (forbidden — every merge is reviewer-of-record gated)
- silent gate skipping (forbidden — silence is incompatible with governance-safe operation)
- **engagement gamification** of CI dashboards (forbidden — CI is institutional, never a productivity optimization, never an ai assistant or ai ceo surface)

## Stewardship Cadence

Governance noise is reviewed on the standing daily / weekly / monthly / quarterly stewardship cadence. Recurrent unrelated gate firings are treated as continuity-safe drift and remediated under reviewer-of-record approval.

## Authorized Downstream PR

This document authorizes exactly one runtime hardening PR titled `refactor/nzila-governance-noise-reduction`. It must not bundle other axis work.
