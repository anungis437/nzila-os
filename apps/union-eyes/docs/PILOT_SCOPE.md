# UnionEyes — Pilot Scope Definition

This document defines the current technical scope for UnionEyes pilot proof metrics after the pilot-metrics refactor.

Audience-friendly overview: [Pilot Overview](../../docs/union-eyes/pilot-overview.md)

## Pilot Objective

Validate pilot outcomes from real production actions by recording auditable metrics for:
1. Case throughput and workflow movement
2. Response/resolution timeliness
3. SLA compliance and breach risk
4. Evidence export and assignment efficiency

## Included Runtime Scope

The pilot proof path is now action-based and route-driven.

| Runtime Path | Metrics Emitted |
|---------|-------------|
| `POST /api/cases` | `cases_created` |
| `POST /api/cases/[caseId]/assign` | `assignment_efficiency` |
| `POST /api/workflow/transition` | `workflow_transition_success_rate`, `workflow_failures`, `cases_acknowledged`, `avg_time_to_first_response`, `avg_time_to_resolution` |
| `GET /api/cases/[caseId]/export` | `evidence_pack_exports` |
| `POST /api/cron/sla-watchdog` | `sla_breach_count`, `sla_compliance_rate` |

All emits are executed through [apps/union-eyes/lib/pilot-metrics.ts](apps/union-eyes/lib/pilot-metrics.ts), which resolves the active pilot by `org_id + app_scope=union-eyes`.

## Platform Write Guarantees

Metric writes in [packages/platform-pilot-metrics/src/service.ts](packages/platform-pilot-metrics/src/service.ts) enforce:
- required `traceId`
- required identity (`actorId` or `systemActorId`)
- required org/pilot scope consistency (`orgId` must match pilot owner org)
- audit linkage write for successful metric events

## Out of Scope

The current pilot scope intentionally excludes:
- synthetic/seed fallback in proof surfaces
- backfilling historical pilot metrics from legacy tables
- non-auditable metric writes without actor/trace context
- metrics not tied to a declared active pilot definition

## Operational Dependencies

- An active pilot definition must exist in `pilot_definitions` for the org and app scope.
- Requests should include `x-trace-id`; server fallback trace IDs are generated when absent.
- SLA watchdog emits system-actor metrics under `system:ue-sla-watchdog`.

## Success and Readiness Inputs

Pilot readiness should be evaluated from recorded metrics, not inferred UI activity:
- volume: `cases_created`, `cases_acknowledged`
- timeliness: `avg_time_to_first_response`, `avg_time_to_resolution`
- reliability/compliance: `sla_compliance_rate`, `sla_breach_count`
- operational completion: `workflow_transition_success_rate`, `evidence_pack_exports`
