# Operational Evidence Snapshot

> **Schema version**: 1.0.0  
> **Generated**: 2026-04-22  
> **Refresh cadence**: Monthly (manual for now; automated wiring tracked in maturity gaps)

This snapshot provides a single-page view of platform health for internal review, investor due diligence, and buyer evaluations.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Live value — sourced from a system of record |
| 🔲 | Not yet wired — TODO item with identified source |
| ⚠️ | Estimated / manual — flagged as such |

---

## Deployment Velocity

| Metric | Value | Source |
|---|---|---|
| Deployment frequency (per week) | 🔲 TODO | GitHub Actions run count |
| Lead time (commit → production, hours) | 🔲 TODO | GitHub Actions API |
| Last production deploy | ✅ 2026-04-22 | git history |
| Current CI status | ✅ Passing | GitHub Actions |

---

## Build Pipeline Health

| Metric | Value | Source |
|---|---|---|
| Build success rate (30d, %) | 🔲 TODO | GitHub Actions API |
| Median build duration (min) | 🔲 TODO | GitHub Actions API |

---

## Incident Response

| Metric | Value | Source |
|---|---|---|
| MTTR (hours) | 🔲 TODO | No incident mgmt tool configured |
| Open P1 incidents | ✅ 0 | Manual review |
| Last incident date | ✅ None recorded | Manual review |

> **Note**: MTTR tracking requires an incident management workflow (PagerDuty / Opsgenie / GitHub Issues SLA tagging). Add to observability roadmap.

---

## Uptime (30-Day)

| App | Uptime % | Source |
|---|---|---|
| union-eyes | 🔲 TODO | Azure Monitor — nzila-canada-staging-env |
| web | 🔲 TODO | Azure Monitor |
| console | 🔲 TODO | Azure Monitor |

---

## Error Rates

| App | Error rate % | Source |
|---|---|---|
| union-eyes | 🔲 TODO | Application Insights / Sentry |
| web | 🔲 TODO | Application Insights / Sentry |

---

## Latency (P50 / P95 ms)

| App | P50 | P95 | Source |
|---|---|---|---|
| union-eyes | 🔲 TODO | 🔲 TODO | Azure Monitor |

---

## Authentication

| Metric | Value | Source |
|---|---|---|
| Login success rate (30d, %) | 🔲 TODO | platform-auth logs |
| Account lockout events (30d) | 🔲 TODO | platform-auth logs |

---

## Feature Usage — Union Eyes

| Metric | Value | Source |
|---|---|---|
| Active users (30d) | 🔲 TODO | DB query |
| Cases opened (30d) | 🔲 TODO | DB query |
| Evidence packs generated (30d) | 🔲 TODO | DB query |

---

## Onboarding Pipeline

| Metric | Value | Source |
|---|---|---|
| Pilots signed | ✅ 1 | maturity.json |
| Pilots in negotiation | ⚠️ 2 (estimated) | Founder log |
| Avg onboarding time (days) | 🔲 TODO | Not yet tracked |

---

## Infrastructure Cost

| Metric | Value | Source |
|---|---|---|
| Monthly Azure cost (CAD) | 🔲 TODO | Azure Cost Management |

> **Action**: Export billing data monthly to `reports/ops/cost-YYYY-MM.json`.

---

## Security Posture

| Control | Status | Source |
|---|---|---|
| Last dependency audit | ✅ 2026-04-22 | supply-chain-policy.ts |
| Open CRITICAL vulns | ✅ 0 | pnpm audit + Snyk |
| Open HIGH vulns | ✅ 0 | pnpm audit + Snyk |
| SOC 2 Type II | 🗺️ Roadmap | No current audit engagement |
| Third-party pen test | 🗺️ Planned | Not yet scheduled |

---

## Wiring Roadmap

The following actions convert `TODO` cells to live values:

1. **Deployment metrics**: Add GitHub Actions job to `POST` run results to `reports/ops/deployments.jsonl`
2. **Uptime + error rates**: Wire Azure Monitor alerts to a scheduled export script
3. **Auth metrics**: Add platform-auth monthly summary job to report login/lockout stats
4. **Feature usage**: Add a nightly DB rollup script in `apps/union-eyes/scripts/ops-rollup.ts`
5. **Infrastructure cost**: Schedule monthly Azure Cost Management export

See `apps/union-eyes/maturity.json → maturity_gaps.observability` for the full observability remediation plan.
