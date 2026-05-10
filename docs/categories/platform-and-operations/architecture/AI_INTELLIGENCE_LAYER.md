# AI Intelligence Layer

> Cross-app intelligence, anomaly detection, and AI governance for Nzila OS.

## Overview

The AI Intelligence Layer provides cross-application insights, natural language querying, anomaly detection, agent-driven workflows, and AI governance across the Nzila OS platform.

## Package Architecture

```
@nzila/platform-intelligence      ← Event aggregation + cross-app insights + signals
@nzila/platform-ai-query          ← Natural language queries with evidence-backed answers
@nzila/platform-anomaly-engine    ← Grievance spikes, financial irregularities, pricing outliers, partner drops
@nzila/platform-agent-workflows   ← Event-driven recommendations, policy-engine obedient
@nzila/platform-ai-governance     ← Model registry, prompt versioning, decision logging, review
```

## @nzila/platform-intelligence

**Purpose:** Aggregate events across all apps and generate operational insights.

### Capabilities

- **Event Aggregation**: Collect and store events from all apps with filtering by app, org, type
- **Cross-App Insights**: Detect patterns across multiple applications (error correlation, volume anomalies)
- **Operational Signals**: Detect spikes, drops, threshold breaches, and trend changes against baselines

### Cross-App Correlation Patterns

| Pattern | Source Apps | Signal | Severity |
|---------|-----------|--------|----------|
| Staffing Imbalance | Union-Eyes + CFO | grievance_spike + overtime_increase | critical |
| Demand Weakness | Shop Quoter + Web | quote_volume_drop + lead_decline | warning |
| Partner Revenue Risk | Partners + CFO | performance_drop + revenue_variance | warning/cost |

### Signal Detection

Signals are generated when metric deviations exceed a configurable threshold (default 20%):

- **Spike**: >50% above baseline
- **Drop**: >50% below baseline
- **Threshold Breach**: 20-50% deviation

## @nzila/platform-ai-query

**Purpose:** Enable natural language queries against platform data with evidence-backed answers.

### Capabilities

- **Intent Classification**: status, comparison, trend, anomaly, compliance
- **Query Parsing**: Structured query objects with org/actor context
- **Evidence-Backed Answers**: Results include references to events, metrics, policies, and audit entries
- **Evidence Validation**: Coverage assessment across 4 evidence types (≥50% required)

## @nzila/platform-anomaly-engine

**Purpose:** Detect domain-specific anomalies across the platform.

### Detectors

| Detector | Domain | Default Threshold |
|----------|--------|-------------------|
| Grievance Spike | Union-Eyes | 2x baseline |
| Financial Irregularity | CFO | 1.5x baseline |
| Pricing Outlier | Shop Quoter | 1.3x baseline |
| Partner Performance Drop | Partners | 1.5x below baseline |

### Severity Classification

| Factor vs Threshold | Severity |
|---------------------|----------|
| ≥3x | Critical |
| ≥2x | High |
| ≥1.5x | Medium |
| <1.5x | Low |

### Default Rules

Pre-configured rules for common anomaly patterns with adjustable thresholds.

## @nzila/platform-agent-workflows

**Purpose:** Event-driven workflow orchestration with policy engine integration.

### Capabilities

- **Workflow Creation**: Define multi-step workflows triggered by events
- **Policy-Obedient Execution**: Every step can include policy checks (allow/deny/requires_approval)
- **Blocked Step Handling**: Steps blocked by policy generate approval recommendations
- **Recommendation Engine**: Contextual recommendations based on workflow state
- **Audit Event Emission**: Every workflow creation, step execution, and recommendation emits a governance audit event
- **Human Review**: All recommendations are flagged with `humanReviewRequired: true`

### Workflow States

```
pending → running → completed
                  → failed
                  → blocked (by policy)
```

## @nzila/platform-ai-governance

**Purpose:** Govern AI model usage, prompt evolution, and decision quality.

### Model Registry

- Register AI models with version, provider, capabilities, and risk level
- Approval workflow for production deployment
- Audit trail for model changes

### Prompt Versioning

- Version-controlled prompt templates
- Automatic deactivation of previous versions
- Change reason tracking
- Full version history

### AI Decision Logging

- Log every AI-assisted decision with confidence score
- All decisions require human review (`requiresHumanReview: true` always)
- Low-confidence decisions (<0.7) are flagged as `pending` for immediate review
- Supports `modelVersion`, `engineVersion`, and `evidenceRefs` for traceability
- Decision audit trail with review status

### Human Review

- Flag decisions for human review with priority levels
- Resolution tracking
- Pending review queue

## Integration Points

All AI packages integrate with the platform foundation:

| Package | Depends On |
|---------|------------|
| platform-intelligence | platform-events, platform-observability |
| platform-ai-query | platform-events, platform-intelligence |
| platform-anomaly-engine | platform-events, platform-intelligence |
| platform-agent-workflows | platform-events, platform-policy-engine |
| platform-ai-governance | platform-events, platform-policy-engine |
| platform-decision-engine | platform-anomaly-engine, platform-intelligence, platform-change-management, platform-policy-engine, platform-governance, platform-environment |

## Decision Layer

The **Decision Layer** (`@nzila/platform-decision-engine`) sits above the intelligence and anomaly engines. It transforms signals into evidence-backed, policy-aware decision recommendations that human operators review and act on.

See [DECISION_LAYER_ARCHITECTURE.md](DECISION_LAYER_ARCHITECTURE.md) for full documentation.
