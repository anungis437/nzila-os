# Assurance Dashboard

> Real-time platform health, compliance score, and control family coverage.

## Overview

The Assurance Dashboard (`/assurance` in the console app) provides a live
overview of the platform's compliance and operational health. It aggregates
scores from the Procurement Proof Center, policy engine, and compliance
snapshot engine.

## Route

```
GET /assurance          → Dashboard UI (apps/console/app/(dashboard)/assurance/page.tsx)
GET /api/assurance      → JSON API for assurance data
```

## Sections

| Section | Source | Metric |
|---------|--------|--------|
| **Overall Score** | All sections combined | 0-100 with letter grade |
| **Security** | Dependency audit, attestation, vuln scan | Score + grade |
| **Data Lifecycle** | Manifests, retention controls, encryption | Score + grade |
| **Operational** | SLO compliance, latency, MTTR | Score + grade |
| **Governance** | Evidence packs, snapshot chain, policy compliance | Score + grade |
| **Sovereignty** | Region, residency, regulatory frameworks | Score + grade |

## Grading Scale

| Grade | Score Range | Meaning |
|-------|------------|---------|
| **A** | 90-100 | Excellent — all controls passing |
| **B** | 80-89 | Good — minor gaps |
| **C** | 70-79 | Acceptable — action items needed |
| **D** | 60-69 | Below threshold — remediation required |
| **F** | 0-59 | Critical — deployment blocked |

## Data Flow

```
Compliance Snapshots  ─┐
Evidence Packs        ─┤
Policy Evaluations    ─┼──►  Assurance Aggregator  ──►  Dashboard UI
SLO Compliance        ─┤
Dependency Audits     ─┘
```

## Packages

- **`@nzila/platform-assurance`** — Score computation and aggregation
- **`@nzila/platform-procurement-proof`** — Section-level proof collection
- **`@nzila/platform-compliance-snapshots`** — Snapshot chain verification
