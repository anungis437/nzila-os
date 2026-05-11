# Executive Governance Review Workflows

> **Status:** Canonical governance operations · **Layer:** Executive review · **Inherits:** [governance-operations-dashboard-system.md](governance-operations-dashboard-system.md)

## 1. Objective

Design governance-safe executive operational review flows that preserve strategic cognition and never devolve into engineering review.

## 2. Required workflows

| Workflow | Reviewer audience |
|---|---|
| Deployment review | Platform leadership |
| Continuity review | Executive leadership + governance forum |
| Governance posture review | Governance forum |
| Modernization readiness review | Executive + platform leadership |
| Pilot readiness review | Pilot governance forum |
| AI governance review | AI governance forum |
| Operational legitimacy review | Executive + audit observers |

## 3. UX principles

Review flows MUST:

- **Stay calm.** No urgency framing, no countdown timers, no escalation-by-design.
- **Stay readable.** Each step renders one decision at a time.
- **Stay sparse.** Each screen carries the minimum information needed for the decision.
- **Preserve strategic cognition.** No engineering jargon, no orchestration internals, no telemetry walls.
- **Avoid escalation flooding.** A single advisory channel per workflow.

## 4. Decision model

Each workflow has a deterministic decision shape:

- `acknowledge` — review noted; no further action needed.
- `request_clarification` — back to operations with cited unclear point.
- `approve_with_conditions` — explicit conditions written into the record.
- `reject` — cited basis required.

Decisions are append-only and become part of the governance ledger.

## 5. Prohibited patterns

- Real-time review surfaces.
- Composite scoring of products.
- Person-resolving content under any review surface.
- Coercive escalation pathways.
- Over-engineering of the review queue.

## 6. Discipline

Executive review succeeds when leaders end the session with a clearer understanding of the institution and a single, deliberate decision. Sessions that produce ten micro-decisions or none at all are failures of the review surface, not the leadership.
