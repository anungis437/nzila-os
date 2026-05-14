# Executive Reliability Report (30/60/90 Days)

Date: 2026-04-22  
Audience: Executive leadership, enterprise buyers, diligence reviewers.

## Data Sources

- GitHub Actions API (`gh api repos/anungis437/nzila-os/actions/runs`).
- GitHub Issues API (`gh issue list --state all`).
- Live HTTPS probes for production domains.
- TLS certificate checks (remote cert expiry date).
- `reports/ops/snapshot.json` for current canonical 30-day ops snapshot.

## 1) Deployment Cadence

| Window | Deploy Runs | Successful Deploy Runs | Success Rate |
|---|---:|---:|---:|
| 30d | 125 | 50 | 40.0% |
| 60d | 125 | 50 | 40.0% |
| 90d | 125 | 50 | 40.0% |

Notes:

- Deploy workflow names filtered by `Deploy|GitOps`.
- Current API sampling returned identical values across 30/60/90 windows due high run concentration in available dataset.

## 2) Build Success Trend

| Window | Completed Workflow Runs | Successful Runs | Success Rate |
|---|---:|---:|---:|
| 30d | 2000 | 1404 | 70.2% |
| 60d | 2000 | 1404 | 70.2% |
| 90d | 2000 | 1404 | 70.2% |

Cross-check:

- Canonical 30-day ops snapshot currently reports 81.5% from a smaller curated run sample.
- Recommendation: standardize one calculation method and persist in automated artifact.

## 3) Incidents

| Metric | Value | Status |
|---|---:|---|
| Incidents last 30 days | 0 | Available |
| MTTR | source_needed | Incident tracker export not yet wired |

## 4) Service Uptime and Domain Health

Current probes (2026-04-22):

| Domain | HTTP | Health |
|---|---:|---|
| <https://nzilaventures.com> | 200 | Operational |
| <https://unioneyes.app> | 200 | Operational |
| <https://partners.nzilaventures.com> | 200 | Operational |
| <https://console.nzilaventures.com> | 200 | Operational |

Uptime percentage over 30/60/90 days: `source_needed` (requires automated uptime exporter).

## 5) Certificate Health

| Domain | Certificate Expiry (UTC Date) | Status |
|---|---|---|
| nzilaventures.com | 2026-07-21 | Valid |
| unioneyes.app | 2026-10-22 | Valid |
| partners.nzilaventures.com | 2026-10-22 | Valid |
| console.nzilaventures.com | 2026-10-22 | Valid |

## 6) Release Cadence

Interpretation from deployment runs:

- Active deployment cadence exists, but delivery reliability is below enterprise target.
- Recommended enterprise target baseline: >95% successful deploys in rolling 30 days.

## 7) Issue Resolution Velocity

| Window | Closed Issues | Avg Days to Close | Median Days to Close |
|---|---:|---:|---:|
| 30d | 0 | source_needed | source_needed |
| 60d | 0 | source_needed | source_needed |
| 90d | 0 | source_needed | source_needed |

Notes:

- Current repository issue workflow appears not to be the primary incident/remediation tracker.
- Add canonical ticket source mapping for executive reliability reporting.

## 8) Executive Assessment

Reliability posture is operationally active and externally reachable, with strong current-point domain and cert health. The main credibility gap is trend consistency and measurement standardization across deploy/build reliability and incident resolution telemetry.

## 9) Source Needed Backlog

1. Automated uptime exporter with rolling 30/60/90 statistics.
2. Incident/MTTR feed integration.
3. Unified build/deploy metric definition to remove conflicting sample methods.
4. Canonical issue-resolution source (if not GitHub Issues).
