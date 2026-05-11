# Nzila OS — Residual Closure Layer

> **Doctrine.** Residual elimination, stewardship hardening — not new systems.

This layer closes the 9 named residuals (R1–R9) recorded in [`../nzila-sovereignty-proving/full-tier2-operational-sovereignty-review.md`](../nzila-sovereignty-proving/full-tier2-operational-sovereignty-review.md). Anti-expansion: every change closes a named residual; no architecture churn, no feature growth, no semantic expansion.

## Residual register

| ID | Doc | Severity | Status (this PR) |
|---|---|---|---|
| R1 | [r1-pilot-django-sidecar-binding-closure.md](./r1-pilot-django-sidecar-binding-closure.md) | High | **DEFERRED** — runbook + procedure shipped; live deploy is a substrate-cost action scoped to a discrete chore PR |
| R2 | [r2-cognition-degradation-drill-corpus.md](./r2-cognition-degradation-drill-corpus.md) | Medium | **PARTIALLY CLOSED** — drill protocol shipped; live execution scoped to recurring chore cadence |
| R3 | [r3-continuity-degradation-drill-corpus.md](./r3-continuity-degradation-drill-corpus.md) | Medium | **PARTIALLY CLOSED** — drill protocol shipped; live execution scoped to recurring chore cadence |
| R4 | [r4-notification-degradation-drill-corpus.md](./r4-notification-degradation-drill-corpus.md) | Low | **PARTIALLY CLOSED** — drill protocol shipped; live execution scoped to recurring chore cadence |
| R5 | [r5-locale-double-prefix-fix.md](./r5-locale-double-prefix-fix.md) | Low | **CLOSED** — locale alias normalization landed in `apps/union-eyes/proxy.ts`; single-hop 308 |
| R6 | [r6-seeded-persona-corpus-completion.md](./r6-seeded-persona-corpus-completion.md) | Medium | **DEFERRED** — corpus inventory shipped; substrate seeding scoped to a discrete chore PR |
| R7 | [r7-operational-honesty-copy-sweep.md](./r7-operational-honesty-copy-sweep.md) | Low | **PARTIALLY CLOSED** — sweep inventory shipped; copy edits scoped to a discrete chore PR |
| R8 | [r8-provider-key-rotation-cadence.md](./r8-provider-key-rotation-cadence.md) | Medium | **PARTIALLY CLOSED** — rotation cadence + procedure shipped; first quarterly rotation scoped to chore cadence |
| R9 | [r9-org-resolver-callsite-audit.md](./r9-org-resolver-callsite-audit.md) | Low | **CLOSED at the audit layer** — call-site enumeration shipped with named ambiguity sites; surgical removal scoped to chore PR |

Final review: [full-residual-elimination-review.md](./full-residual-elimination-review.md)

## Validator

`pnpm validate:residual-closure` → [tooling/scripts/validate-residual-closure.mjs](../../tooling/scripts/validate-residual-closure.mjs)

## Operational honesty preface

This PR ships **doctrine, procedure, and the two surgical real fixes that are tractable and verifiable in a single discrete PR** (R5 middleware fix + R9 audit). Live-deploy actions (R1 sidecar) and recurring drill cadences (R2/R3/R4/R8) and substrate-mutation actions (R6 seeded personas) and copy-sweep actions (R7) are scoped to **named chore PRs** with bounded, evidence-anchored procedures here.

The terminal Tier 2 verdict therefore remains **CONDITIONAL GO**. This is the institutional honesty of the layer: residual closure is a stewardship cadence, not a one-shot certification.
