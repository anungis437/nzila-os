# GTM Sales Engine (Product-Led)

## Scope

This document defines the implemented sales-engine surfaces in Nzila OS.

## Implemented Surfaces

1. Lead capture and demo request intake

- Endpoint: apps/web/app/api/contact/route.ts
- Features:
  - Input validation and anti-spam honeypot
  - Rate limiting
  - Qualification scoring (enterprise-ready, pilot-fit, nurture)
  - Optional HubSpot sync (contact and deal)
  - Optional sales signal webhook dispatch
  - Optional orchestrator workflow dispatch for pilot intake automation

2. CRM-ready sales signal export

- Endpoint: apps/console/app/api/sales/signals/route.ts
- Features:
  - Operator-role access control
  - Exposes active pilots, upcoming pilot end windows, high-risk pilots, unresolved SLA alerts, and quote pipeline counts
  - Returns 503 when source data is unavailable

3. Usage and follow-up signals

- Pilot and quote signals are sourced from schema-backed tables:
  - packages/db/src/schema/pilot-metrics.ts
  - packages/db/src/schema/commerce.ts

4. Onboarding trigger automation

- Contact intake can dispatch onboarding_trigger workflow to orchestrator when API key is configured.
- Dispatch is fail-safe: submission succeeds even if orchestration is temporarily unavailable.

## Operating Rules

- No synthetic conversion metrics are reported as real performance.
- Any external dashboard must declare freshness and source tables.
- Pipeline and pilot status should be reviewed weekly in Console operator mode.
