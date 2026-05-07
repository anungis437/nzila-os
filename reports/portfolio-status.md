# Portfolio Status

Generated: 2026-05-07
Authority: governance/portfolio/product-catalog.json

## Executive Matrix

| Product | Tier | Status | GTM | Revenue | Proof | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| FAIRCASE | 1 | pilot | sell-now | pilot-contracting | pilot-proof | critical |
| Flow | 1 | pilot | sell-now | pilot-contracting | internal-proof | high |
| Union Eyes | 1 | pilot | sell-now | pilot-contracting | pilot-proof | critical |
| CFO | 2 | pilot | maintain | pre-revenue | internal-proof | medium |
| Partners | 2 | pilot | maintain | pre-revenue | none | medium |
| Console | 3 | internal | internal-only | internal-cost-center | internal-proof | high |
| Control Plane | 3 | internal | internal-only | internal-cost-center | internal-proof | high |
| Nzila HQ | 3 | incubating | internal-only | internal-cost-center | internal-proof | high |
| Orchestrator API | 3 | internal | internal-only | internal-cost-center | internal-proof | medium |
| TrustCore | 3 | incubating | hold | pre-revenue | internal-proof | high |
| TrustCore Trust-Ops Console | 3 | incubating | hold | pre-revenue | internal-proof | high |
| Web | 3 | pilot | maintain | pre-revenue | internal-proof | medium |
| Agrimo | 4 | incubating | hold | pre-revenue | none | low |
| Cora | 4 | incubating | hold | pre-revenue | none | low |
| Maestria | 4 | incubating | internal-only | internal-cost-center | internal-proof | high |
| Mobility | 4 | incubating | hold | pre-revenue | none | low |
| NACP Exams | 4 | incubating | hold | pre-revenue | none | low |
| Trade | 4 | incubating | hold | pre-revenue | none | low |
| Veridian Admin | 4 | incubating | hold | pre-revenue | internal-proof | high |
| Veridian Care | 4 | incubating | hold | pre-revenue | internal-proof | high |
| Veridian Site | 4 | incubating | hold | pre-revenue | internal-proof | medium |
| WeekOne | 4 | frozen | internal-only | pre-revenue | internal-proof | medium |
| Zonga | 4 | pilot | hold | pre-revenue | internal-proof | low |
| Mobility Client Portal | 5 | frozen | sunset | sunsetting | none | low |
| Platform Admin | 5 | frozen | sunset | sunsetting | none | low |
| Test Scaffold GP | 5 | frozen | sunset | sunsetting | none | low |

## Allocation Summary

- Sell now: abr, flow, union-eyes
- Strategic growth: cfo, partners
- Internal only: console, control-plane, nzila-hq, orchestrator-api, maestria, weekone
- Frozen / sunset: mobility-client-portal, platform-admin, test-scaffold-gp

## Engine Topology

| Engine | Status | Consumers |
| --- | --- | --- |
| Flow Engine | incubating | flow, maestria |
| Cognition Engine | incubating | union-eyes, veridian-care, maestria, console |
| Ledger Engine | stable | union-eyes, flow, cfo, maestria |
| Identity Engine | stable | web, console, flow, maestria, union-eyes, partners |

## Score Engine

Weights: revenue=0.2, traction=0.2, strategic_fit=0.2, maintenance_burden=0.1, readiness=0.2, margin_potential=0.1

| Product | Weighted Score | Recommendation | Operational Tier | Readiness |
| --- | ---: | --- | --- | --- |
| FAIRCASE | 8.0 | KEEP | EXPERIMENTAL | pilot-safe |
| Flow | 7.0 | KEEP | PRODUCTION | pilot-safe |
| Union Eyes | 8.0 | KEEP | PRODUCTION | pilot-safe |
| CFO | 5.6 | HOLD | PILOT | pilot-safe |
| Partners | 4.8 | HOLD | PILOT | pilot-safe |
| Console | 5.0 | HOLD | PRODUCTION | internal-only |
| Control Plane | 5.0 | HOLD | PILOT | internal-only |
| Nzila HQ | 5.0 | HOLD | EXPERIMENTAL | internal-only |
| Orchestrator API | 4.8 | HOLD | EXPERIMENTAL | internal-only |
| TrustCore | 5.0 | HOLD | UNREGISTERED | internal-only |
| TrustCore Trust-Ops Console | 5.0 | HOLD | UNREGISTERED | internal-only |
| Web | 5.0 | HOLD | PRODUCTION | pilot-safe |
| Agrimo | 3.6 | HOLD | INCUBATING | internal-only |
| Cora | 3.6 | HOLD | INCUBATING | internal-only |
| Maestria | 4.8 | HOLD | INCUBATING | internal-only |
| Mobility | 3.6 | HOLD | INCUBATING | internal-only |
| NACP Exams | 3.6 | HOLD | INCUBATING | internal-only |
| Trade | 3.6 | HOLD | INCUBATING | internal-only |
| Veridian Admin | 5.2 | HOLD | INCUBATING | internal-only |
| Veridian Care | 5.2 | HOLD | INCUBATING | internal-only |
| Veridian Site | 4.6 | HOLD | INCUBATING | internal-only |
| WeekOne | 4.6 | HOLD | INCUBATING | internal-only |
| Zonga | 4.4 | HOLD | INCUBATING | pilot-safe |
| Mobility Client Portal | 2.0 | SUNSET | EXPERIMENTAL | internal-only |
| Platform Admin | 2.0 | SUNSET | EXPERIMENTAL | internal-only |
| Test Scaffold GP | 2.0 | SUNSET | DEPRECATED | internal-only |

