# Nzila OS Decision Layer — Capabilities

## Decision Engine

The core engine processes platform signals through deterministic rules and produces structured decision records.

### Decision Rules (8 built-in)

| Rule | Domain | Trigger Signal | Output Category |
|------|--------|---------------|-----------------|
| Grievance Backlog | Union / HR | `grievance_spike` anomaly | STAFFING |
| Arbitration Risk | Legal / Compliance | `compliance_deviation` anomaly in union-eyes | COMPLIANCE |
| Budget Variance | Finance | `financial_irregularity` anomaly | FINANCIAL |
| Pricing Anomaly | Commerce | `pricing_outlier` anomaly | FINANCIAL |
| Partner Performance | Partnerships | `partner_performance_drop` anomaly | PARTNER |
| Deployment Risk | Platform / DevOps | HIGH-risk PROD `ChangeRecord` | DEPLOYMENT |
| Cross-App Insight | Operations | Critical `CrossAppInsight` | OPERATIONS / COMPLIANCE |
| Governance State | Governance | `threshold_breach` / `spike` signal | GOVERNANCE |

### Decision Record Structure

Every decision includes:

| Field | Purpose |
|-------|---------|
| `decision_id` | Unique ID (format: `DEC-YYYY-NNNN`) |
| `org_id` | Organisation scope |
| `category` | One of 10 operational categories |
| `type` | RECOMMENDATION, ESCALATION, REVIEW_REQUEST, or PRIORITIZATION |
| `severity` | LOW, MEDIUM, HIGH, or CRITICAL |
| `title` / `summary` / `explanation` | Human-readable decision description |
| `confidence_score` | 0.0–1.0 engine confidence |
| `evidence_refs` | Typed references to source anomalies, insights, metrics, policies |
| `recommended_actions` | Ordered list of suggested next steps |
| `required_approvals` | Roles that must approve before execution |
| `review_required` | Boolean flag — true for all HIGH and CRITICAL decisions |
| `policy_context` | Whether execution is allowed and why |
| `environment_context` | Environment level and protection status |
| `status` | Current lifecycle state |
| `generated_by` | Source, engine version, model version |

## Evidence System

Every decision links to typed evidence references:

| Evidence Type | Source | Example |
|---------------|--------|---------|
| `anomaly` | Anomaly Engine | Grievance spike detection |
| `insight` | Intelligence Layer | Cross-app performance correlation |
| `metric` | Observability | Response time SLO breach |
| `policy` | Policy Engine | Environment protection rule |
| `change` | Change Management | High-risk deployment record |
| `event` | Event Fabric | Platform lifecycle event |
| `snapshot` | Governance | Compliance snapshot reference |
| `artifact` | Procurement Proof | Evidence pack reference |

## Policy Integration

The Decision Layer evaluates four policy dimensions:

1. **Environment protection** — Decisions targeting protected environments (PRODUCTION, STAGING) require elevated approval.
2. **Severity escalation** — CRITICAL decisions automatically require senior leadership review.
3. **Pending approvals** — Execution is blocked until all required approvals are satisfied.
4. **Expiration** — Decisions past their expiry window cannot be executed.

Policy evaluation produces a `PolicyContext` with explicit `execution_allowed` flag and human-readable `reasons`.

## Status Lifecycle

```
GENERATED ──► PENDING_REVIEW ──► APPROVED ──► EXECUTED ──► CLOSED
                    │                │
                    ├──► REJECTED ──►│
                    │                │
                    ├──► DEFERRED ──►│
                    │                │
                    └──► EXPIRED  ──►│
                                    │
                                    └──────────────────► CLOSED
```

Eight states with governed transitions:

- **GENERATED** → PENDING_REVIEW, EXPIRED, CLOSED
- **PENDING_REVIEW** → APPROVED, REJECTED, DEFERRED, EXPIRED, CLOSED
- **APPROVED** → EXECUTED, DEFERRED, EXPIRED, CLOSED
- **REJECTED** → CLOSED
- **DEFERRED** → PENDING_REVIEW, EXPIRED, CLOSED
- **EXECUTED** → CLOSED
- **EXPIRED** → CLOSED
- **CLOSED** → (terminal)

## Ranking & Prioritisation

Decisions are scored and ranked using weighted multi-factor scoring:

| Factor | Weight | Source |
|--------|--------|--------|
| Severity | 2.0 | Decision severity level |
| Confidence | 1.5 | Engine confidence score |
| Evidence density | 1.0 | Number of evidence refs |
| Policy urgency | 1.0 | Policy context constraints |
| Recency | 1.0 | Time since generation |
| Action density | 0.5 | Number of recommended actions |

## Audit Trail

Every decision lifecycle event is logged:

| Event | Logged Data |
|-------|-------------|
| `decision_generated` | Full decision record, rule that triggered it |
| `decision_viewed` | Actor, timestamp |
| `decision_approved` | Actor, timestamp, notes |
| `decision_rejected` | Actor, timestamp, reason |
| `decision_deferred` | Actor, timestamp, deferral reason |
| `decision_executed` | Actor, timestamp, execution notes |
| `decision_expired` | Timestamp, expiry policy |
| `decision_feedback_recorded` | Actor, action, notes |

Audit entries are persisted to `ops/decision-audit/` as JSON files.

## Decision Export

Decisions can be exported as tamper-evident packs containing:

- Full decision record
- All evidence refs
- Policy context snapshot
- Governance status snapshot
- Change status snapshot
- SHA-256 integrity hash
- Export timestamp

## Natural Language Query

The Decision Layer supports structured NL queries:

| Intent | Example Query |
|--------|---------------|
| `list_open` | "Show all open decisions" |
| `list_critical` | "What are the critical decisions?" |
| `summary` | "Give me a decision summary" |
| `detail` | "Show decision DEC-2026-0001" |
| `count` | "How many pending decisions?" |

## Control Plane Integration

The Decision Layer surfaces in the Control Plane with:

- **Decision summary cards** — Total, pending review, critical open, executed counts
- **Decision table** — Sortable list with severity/status badges, confidence scores, and category filters
- **Decision detail page** — Full evidence panel, recommended actions, policy context, metadata, review history
- **Decision summary view** — Buyer-friendly overview by category, severity, and approval status
