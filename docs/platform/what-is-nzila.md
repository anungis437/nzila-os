# What Is Nzila OS?

Nzila OS is the internal operating system that powers every venture under Nzila Digital Ventures. It is a polyglot monorepo (TypeScript + Python/Django) containing **17 apps** and **150+ shared packages** that span commerce, finance, union management, agriculture, media, trade, and compliance.

## In 30 Seconds

- **One platform, many businesses.** Every Nzila venture — from union grievance management to creator economy ticketing to agricultural traceability — runs on the same platform with shared auth, evidence, telemetry, and governance.
- **Revenue is unavoidable.** Every financial event passes through `@nzila/platform-revenue` and is automatically traced via an evidence bridge. No app can process payments outside the governed pipeline.
- **Governance is structural, not aspirational.** 140+ contract tests enforce invariants at CI time: auth purity, revenue enforcement, control-plane authority, platform drift prevention. If it can break, there's a test that prevents it.
- **Org-scoped multi-tenancy.** Every data query, every API call, every evidence record is scoped to the authenticated organization. There is no global namespace for business data.
- **Evidence-first.** Every action that matters — a payment, a vote, a compliance attestation — produces a tamper-evident audit entry with a deterministic trace ID, linked to the governance timeline.

## Key Architecture Choices

| Principle | Implementation |
|-----------|---------------|
| Single auth layer | `@nzila/platform-auth` — Argon2id passwords + Entra SSO, PG sessions |
| Unified revenue | `@nzila/platform-revenue` — all revenue events aggregate to control plane |
| Evidence chain | `@nzila/evidence` — hash-sealed artefacts with 7-year retention policy |
| Contract enforcement | 140+ Vitest contract tests run on every PR via CI |
| Control plane | Dedicated app that aggregates system state, health, and revenue across all apps |

## Who Is This For?

Nzila OS is internal infrastructure. It is not a product you install — it is the backbone that Nzila's products run on. If you are reading this, you are likely a developer, auditor, or stakeholder evaluating the platform's architecture.

For business context, see [README.business.md](../../README.business.md).
For architecture details, see [ARCHITECTURE.md](../../ARCHITECTURE.md).
For the portfolio breakdown, see [portfolio-matrix.md](portfolio-matrix.md).
