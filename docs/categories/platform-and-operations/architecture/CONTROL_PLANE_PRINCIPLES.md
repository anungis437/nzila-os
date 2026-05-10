# Control Plane Principles — Nzila OS

> Anti-entropy guardrail: the Control Plane is an operating shell, not a
> dashboard dumping ground. Every feature must belong to HEALTH, ATTENTION,
> or ACTION.

## Purpose

The Nzila OS Control Plane exists to give platform operators a single pane
for understanding platform state and taking action. It is not a place
for duplicating app-local admin UIs or adding vanity metrics.

## The Three Buckets

Every Control Plane page, card, or widget must belong to exactly one bucket:

### 1. HEALTH — Is the platform healthy?

| Concern | Examples |
|---------|----------|
| Environment status | Service health, deploy state, infrastructure |
| Governance posture | Compliance level, policy coverage, evidence completeness |
| Change state | Active change windows, deployment status |
| Architecture health | Package ownership, dependency boundaries, AI contract |

### 2. ATTENTION — What needs attention?

| Concern | Examples |
|---------|----------|
| Anomalies | Unusual patterns, threshold breaches, spikes |
| Decisions pending | Awaiting human review, escalated items |
| Governance gaps | Missing evidence, policy violations, uncovered surfaces |
| Degraded state | Failing health checks, SLO breaches |

### 3. ACTION — What can I act on?

| Concern | Examples |
|---------|----------|
| Approvals | Change approvals, decision reviews |
| Exports | Evidence packs, compliance reports, procurement packs |
| Review queues | AI review queue, anomaly triage, governance review |
| Recommended actions | Agent recommendations, remediation suggestions |

## Prohibited Patterns

| Pattern | Why |
|---------|-----|
| App-local admin UIs embedded in Control Plane | Creates duplicate surfaces; apps own their admin |
| Dashboard cards without operational meaning | "Vanity cards" clutter the signal |
| Duplicate app dashboards | Control Plane shows summary/orchestration, not app detail |
| Uncontrolled feature additions | Every page must pass route governance review |

## Route Governance

Every Control Plane route must be documented in:

- `apps/control-plane/docs/ROUTE_GOVERNANCE.md` (human-readable)
- `apps/control-plane/route.meta.json` (machine-readable)

New routes require:

1. Assigned bucket (HEALTH / ATTENTION / ACTION)
2. Named primary user / persona
3. Clear actionability description
4. Documented source data

## Enforcement

- Route check: `pnpm control-plane:check` (`scripts/control-plane-check.ts`)
- Route manifest: `apps/control-plane/route.meta.json`
- CI: Runs on every PR

## Design Guidelines

1. **Summary first** — Control Plane shows aggregated state, not raw data
2. **Actionable** — every page should have at least one action the operator can take
3. **Cross-app** — if it only applies to one app, it belongs in that app's admin
4. **Org-scoped** — all data respects org isolation
5. **Evidence-backed** — claims are traceable to source data
