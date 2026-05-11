# Console Operator Manual v2

## Purpose

Enable a second operator to run the executive system without founder context loss.

## Weekly protocol

1. Check CEO page for current truth snapshot.
2. Process Autopilot recommendations and approve actionable items.
3. Reconcile execution drifts in Accountability and Execution pages.
4. Push high-risk items into Briefing with explicit decision owners.

## Monthly protocol

1. Recalculate runway assumptions and validate scenario shifts.
2. Review scoreback accuracy and confidence gap trend.
3. Publish board summary using Board page and briefing sentence.
4. Archive completed initiatives with outcome notes.

## Escalation rules

- Runway below 4 months: immediate burn controls and collections sprint.
- Data freshness under 60%: restore adapters before relying on guidance.
- P0 decisions overdue beyond 7 days: force resolution in weekly review.

## Source-of-truth map

- Finance spine: apps/console/lib/finance-spine.ts
- Executive intelligence: apps/console/lib/executive-intelligence.ts
- Autopilot engine: apps/console/lib/autopilot-engine.ts
- Forecast engine: apps/console/lib/forecast-engine.ts
- Decision learning store: decision_scorebacks table
