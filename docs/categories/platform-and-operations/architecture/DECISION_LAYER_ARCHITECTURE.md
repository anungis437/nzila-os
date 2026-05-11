# Decision Layer Architecture

> Governed, auditable, recommendation-first decision system for Nzila OS.

## Overview

The Decision Layer sits above events, insights, anomalies and policies, and below human operators. It transforms platform signals into **evidence-backed recommendations** that humans review, approve, and act on.

**Key principles:**

- **Recommendation-first** — no autonomous mutation of business data
- **Every decision must include** confidence score, evidence refs, and review requirement
- **Auditable** — full lifecycle audit trail from generation to closure
- **Policy-aware** — decisions are filtered through policy context and environment constraints

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Control Plane UI                            │
│  ┌────────────┐  ┌────────────────┐  ┌───────────────────────┐  │
│  │ Decisions  │  │ Decision Detail│  │  Summary Dashboard    │  │
│  │   Table    │  │ Evidence Panel │  │  Cards & Metrics      │  │
│  └────────────┘  └────────────────┘  └───────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Decision Engine                               │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌────────────────┐  │
│  │  Rules   │  │ Evidence │  │ Policy  │  │   Ranking      │  │
│  │ 8 rules  │  │ Builder  │  │ Filter  │  │ Priority Score │  │
│  └──────────┘  └──────────┘  └─────────┘  └────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌────────────────┐  │
│  │  Audit   │  │ Feedback │  │ Export  │  │  NL Support    │  │
│  │  Trail   │  │  Loop    │  │  Pack   │  │  Queries       │  │
│  └──────────┘  └──────────┘  └─────────┘  └────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Platform Signal Layer                          │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐ │
│  │  Anomalies   │  │  Intelligence  │  │  Change Management  │ │
│  │  6 types     │  │  Insights +    │  │  Records + Risk     │ │
│  │              │  │  Signals       │  │                     │ │
│  └──────────────┘  └────────────────┘  └─────────────────────┘ │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐ │
│  │  Policy      │  │  Governance    │  │  Environment        │ │
│  │  Engine      │  │  Status        │  │  Context            │ │
│  └──────────────┘  └────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Package: `@nzila/platform-decision-engine`

### Module Map

| File | Purpose |
|------|---------|
| `types.ts` | Canonical type definitions — DecisionRecord, 25 fields |
| `schemas.ts` | Zod runtime validation schemas |
| `utils.ts` | ID generation (DEC-YYYY-NNNN), timestamps, hashing |
| `status.ts` | Status transition governance |
| `store.ts` | File-backed persistence under `ops/decisions/` |
| `rules.ts` | 8 decision rules — one per signal pattern |
| `engine.ts` | Pipeline: ingest → rules → output + summarise |
| `evidence.ts` | Evidence ref builders from anomalies, insights, signals, changes |
| `policy.ts` | Policy-aware filtering — executable vs blocked |
| `ranking.ts` | Priority scoring and ranking algorithm |
| `audit.ts` | Audit trail persistence under `ops/decision-audit/` |
| `feedback.ts` | Human feedback recording with status transitions |
| `export.ts` | Decision export packs with integrity hash |
| `nl.ts` | Natural language query support |

### Decision Flow

1. **Ingest** — `DecisionEngineInput` carries anomalies, insights, signals, governance status, change records, and environment
2. **Rules evaluate** — each rule maps specific signal patterns to `DecisionRecord` candidates
3. **Evidence attached** — evidence refs link decisions to source data
4. **Policy filter** — checks environment protection, severity escalation, approval requirements
5. **Ranking** — priority score based on severity, confidence, recency, evidence density
6. **Persist** — saved to `ops/decisions/{DEC-YYYY-NNNN}.json`
7. **Display** — Control Plane `/decisions` page shows table, summary cards, detail view
8. **Review** — humans provide feedback (APPROVE/REJECT/DEFER/EXECUTE/COMMENT)
9. **Audit** — every lifecycle event emitted to `ops/decision-audit/`

### Decision Rules (8)

| Rule | Signal | Category | Trigger |
|------|--------|----------|---------|
| `grievance-backlog` | `grievance_spike` anomaly | STAFFING | Union grievance spikes |
| `arbitration-risk` | `compliance_deviation` anomaly | COMPLIANCE | Union compliance deviations |
| `budget-variance` | `financial_irregularity` anomaly | FINANCIAL | CFO budget variances |
| `pricing-anomaly` | `pricing_outlier` anomaly | FINANCIAL | ShopQuoter pricing deviations |
| `partner-performance-drop` | `partner_performance_drop` anomaly | PARTNER | Partners SLA drops |
| `deployment-risk` | ChangeRecord (HIGH, PROD) | DEPLOYMENT | Risky deployments |
| `cross-app-insight` | CrossAppInsight (critical) | OPERATIONS | Multi-app issues |
| `governance-stale-state` | OperationalSignal (breach) | GOVERNANCE | Threshold violations |

## Storage

```
ops/
├── decisions/                    # DecisionRecord JSON files
│   ├── DEC-2025-0001.json
│   └── DEC-2025-0002.json
├── decision-feedback/            # Feedback entries
│   └── DEC-2025-0001-1735000000.json
└── decision-audit/               # Audit trail entries
    ├── DEC-2025-0001-decision_generated-1735000000.json
    └── DEC-2025-0001-decision_approved-1735001000.json
```

## Status Lifecycle

```
GENERATED → PENDING_REVIEW → APPROVED → EXECUTED → CLOSED
                           ↘ REJECTED → CLOSED
                           ↘ DEFERRED → PENDING_REVIEW
         → EXPIRED → CLOSED
```

## Integration Points

- **platform-anomaly-engine** — `Anomaly` (6 types)
- **platform-intelligence** — `CrossAppInsight`, `OperationalSignal`
- **platform-change-management** — `ChangeRecord`
- **platform-policy-engine** — `PolicyDecision`
- **platform-governance** — `GovernanceStatus`
- **platform-environment** — environment context
- **platform-ai-query** — NL query integration
- **Control Plane** — UI pages at `/decisions`, `/decisions/[id]`
