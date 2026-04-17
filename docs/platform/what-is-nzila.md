# What Is Nzila OS?

Nzila OS is the governed operating system for Nzila Digital Ventures. It is a **system platform** — not a collection of apps. Every venture runs on the same infrastructure with enforced invariants, a mandatory revenue pipeline, and evidence-sealed audit trails.

## In 30 Seconds

- **One platform, many businesses.** Every Nzila venture — from union grievance management to creator economy streaming to agricultural traceability — runs on the same platform with shared auth, evidence, telemetry, and governance.
- **Control Plane as the entry point.** The Control Plane aggregates system health, revenue oversight, account governance, and architecture compliance across all 17 apps. It is the lens through which the entire system is observed.
- **Revenue is unavoidable.** Every financial event passes through `@nzila/platform-revenue` and is automatically traced via an evidence bridge. No app can process payments outside the governed pipeline.
- **Governance is structural, not aspirational.** 1,900+ contract tests enforce invariants at CI time: auth purity, revenue enforcement, control-plane authority, platform drift prevention. 23 GA gates — all passing.
- **Org-scoped multi-tenancy.** Every data query, every API call, every evidence record is scoped to the authenticated organization. There is no global namespace for business data.
- **Evidence-first.** Every action that matters — a payment, a vote, a compliance attestation — produces a tamper-evident audit entry with a deterministic trace ID, linked to the governance timeline.

## Key Architecture Choices

| Principle | Implementation |
|-----------|---------------|
| Single auth layer | `@nzila/platform-auth` — Argon2id passwords + Entra SSO, PG sessions |
| Mandatory revenue pipeline | `@nzila/platform-revenue` — all revenue events aggregate to control plane (REV-001–008) |
| Control-plane authority | Every app registered in platform-contracts, manifest-validated (CTRL-001–009) |
| Evidence chain | `@nzila/evidence` — hash-sealed artefacts with 7-year retention policy |
| Contract enforcement | 1,900+ Vitest contract tests run on every PR via CI |
| 23 GA gates | Final deployment gates — all must pass before release |

## Flagship Products

- **UnionEyes** — Union case management (grievance lifecycle, collective bargaining, elections, evidence-sealed audit trails). 3,000+ source files.
- **Zonga** — Music distribution and streaming (artist management, royalties, content distribution, creator payouts).

> Flow (commerce) and CFO (finance) are pilot-tier revenue verticals under active deployment. Full classification: [portfolio-matrix.md](portfolio-matrix.md).

## Who Is This For?

Nzila OS is internal infrastructure. It is not a product you install — it is the backbone that Nzila's products run on. If you are reading this, you are likely a developer, auditor, or stakeholder evaluating the platform's architecture.

For business context, see [README.business.md](../../README.business.md).
For architecture details, see [ARCHITECTURE.md](../../ARCHITECTURE.md).
For the portfolio breakdown, see [portfolio-matrix.md](portfolio-matrix.md).
