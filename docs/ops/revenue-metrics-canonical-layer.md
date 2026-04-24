# Revenue Metrics Canonical Layer

## Objective

Define canonical commercial and operating metrics used in Console and buyer conversations.

## Canonical Metrics

1. Leads

- Definition: New inbound qualified contact records from marketing intake.
- Source: apps/web/app/api/contact/route.ts events and CRM sync logs.

2. Demos booked

- Definition: Qualified opportunities converted to scheduled product demo.
- Source: CRM stage transitions (HubSpot or integrated CRM).

3. Pilots active

- Definition: Count of pilot_definitions where status = active.
- Source table: pilot_definitions.

4. Conversion percentage

- Definition: Paid conversions / completed pilots over a selected period.
- Source tables: pilot_definitions + commercial contract records where available.

5. Churn risk

- Definition: Pilot accounts with high or critical risk level.
- Source table: pilot_health_scores.

6. MRR and ARR readiness model

- Definition: Scenario model based on active pilots, conversion rates, and contract assumptions.
- Constraint: Scenario only unless backed by booked revenue.

7. CAC placeholders

- Definition: Explicit placeholder until marketing and sales spend attribution is complete.
- Rule: Never present placeholder as measured CAC.

8. Activation rate

- Definition: Percentage of pilots reaching minimum operating success criteria in onboarding window.
- Source: pilot metric events and pilot health scoring.

9. Time-to-value

- Definition: Time from pilot start to first measurable KPI threshold.
- Source: pilot_definitions.started_at and pilot metrics milestones.

10. Support burden

- Definition: Incident and support load per active pilot.
- Source tables: pilot_alerts plus support ticketing integration where configured.

## Console Implementation

- Operator boards use schema-backed counts from pilot, alert, workflow, and quote tables.
- Revenue page uses quote pipeline, pilot status, and revenue event summaries.

## Governance

- Freshness labels must be visible on operational dashboards.
- Data gaps must be shown as unavailable, not estimated.
