# Nzila OS Decision Layer — Pricing & Packaging

## Product Tiers

The Decision Layer is available as a modular add-on to the Nzila OS platform. Pricing is structured in three tiers with vertical bundles.

### Tier 1 — Base Platform

Included in every Nzila OS deployment:

- Core platform infrastructure (events, governance, observability)
- Control Plane dashboard (overview, governance, modules)
- Change Management
- Base anomaly detection
- Base intelligence signals
- Standard audit logging

> The Base Platform provides signal generation but **does not include** decision recommendations, evidence linking, or approval workflows.

### Tier 2 — Decision Layer Add-On

Premium capability added to the Base Platform:

| Feature | Included |
|---------|----------|
| Decision Engine (8 built-in rules) | ✓ |
| Evidence linking (anomaly, insight, metric, policy, change) | ✓ |
| Confidence scoring | ✓ |
| Control Plane decision pages (/decisions, /decisions/[id]) | ✓ |
| Decision summary view | ✓ |
| Policy-aware execution gating | ✓ |
| Status lifecycle (8 states, governed transitions) | ✓ |
| Feedback loop (approve, reject, defer, execute, comment) | ✓ |
| Basic audit trail | ✓ |
| NL decision queries | ✓ |
| Up to 5 decision categories | ✓ |

> Decision Layer Add-On unlocks recommendation-first decision support with evidence and review.

### Tier 3 — Enterprise Decision Layer

Full Decision Layer with governance, compliance, and procurement features:

| Feature | Included |
|---------|----------|
| All Tier 2 features | ✓ |
| All 10 decision categories | ✓ |
| Custom decision rules | ✓ |
| Decision export packs (SHA-256 signed) | ✓ |
| Procurement proof integration | ✓ |
| Multi-stakeholder approval workflows | ✓ |
| Advanced audit trail with export | ✓ |
| Environment-aware policy enforcement | ✓ |
| Decision value metrics and reporting | ✓ |
| Priority support | ✓ |

> Enterprise tier is designed for regulated organisations, government buyers, and procurement-heavy environments.

## Vertical Bundles

Pre-configured bundles for specific markets:

### Union Operations Bundle

| Component | Tier |
|-----------|------|
| UnionEyes | Base |
| Control Plane | Base |
| Decision Layer | Add-On |
| Governance / Procurement Proof | Enterprise |
| CFO | Optional Add-On |

Decision categories activated: STAFFING, COMPLIANCE, RISK, GOVERNANCE

### Assessment Governance Bundle

| Component | Tier |
|-----------|------|
| Assessment App | Base |
| Control Plane | Base |
| Decision Layer | Add-On |
| Intelligence Layer | Add-On |
| Governance / Compliance | Enterprise |

Decision categories activated: COMPLIANCE, RISK, GOVERNANCE, OPERATIONS

### Agri / Trade Operations Bundle

| Component | Tier |
|-----------|------|
| Cora / Agrimo / Trade | Base |
| CFO | Base |
| Control Plane | Base |
| Decision Layer | Add-On |

Decision categories activated: FINANCIAL, PARTNER, OPERATIONS, RISK

## Pricing Logic

### Per-Organisation Pricing

Pricing is per organisation (org_id), not per user. This aligns with how decisions are scoped — every decision belongs to an organisation.

### Decision Category Gating

- **Tier 2** includes up to 5 decision categories (configurable per deployment)
- **Tier 3** includes all 10 categories with no restrictions
- Custom rules are available only in Tier 3

### Volume Considerations

The Decision Layer does not charge per decision generated. Pricing is based on the tier and vertical bundle, not decision volume. This removes perverse incentives to suppress decision generation.

## Special Packages

### Pilot Package

For evaluation and proof-of-value:

- 30–90 day deployment
- Up to 3 decision categories
- 2 review workflows
- 1 procurement proof deliverable
- Weekly decision review sessions
- Success metrics tracking
- Full audit trail
- No long-term commitment

### Sovereign / Regulated Premium

For government, financial services, and regulated industries:

- All Enterprise features
- On-premise deployment support
- Data residency guarantees
- Extended audit retention
- Compliance export formats
- Dedicated governance review
- Custom policy rules
- SLA-backed decision SLOs

## What Is Not Included

To set clear expectations:

| Not Included | Why |
|-------------|-----|
| Autonomous execution | Recommendation-first by design |
| Predictive modelling | Rules are deterministic, not probabilistic |
| Cross-tenant analytics | Decisions are org-scoped |
| Real-time streaming | Decisions are batch-generated from accumulated signals |
| Custom ML model training | Engine uses versioned rules, not trained models |
