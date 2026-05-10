# Union Eyes Pilot KPIs

## KPI Focus

- cases_created
- cases_acknowledged
- avg_time_to_first_response
- avg_time_to_resolution
- sla_compliance_rate
- sla_breach_count
- overdue_case_count
- evidence_pack_exports
- workflow_transition_success_rate
- assignment_efficiency
- per_rep_case_load

## Instrumentation Points

- `POST /api/cases` -> `cases_created`
- `POST /api/cases/[caseId]/assign` -> `assignment_efficiency`
- `POST /api/workflow/transition` -> `workflow_transition_success_rate`, `workflow_failures`, `cases_acknowledged`, `avg_time_to_first_response`, `avg_time_to_resolution`
- `GET /api/cases/[caseId]/export` -> `evidence_pack_exports`
- `POST /api/cron/sla-watchdog` -> `sla_breach_count`, `sla_compliance_rate` (compliant + scanned denominator)

All metric writes are auditable and require trace + actor/system identity in the platform metrics service.

## Interpretation

- Operations improving when response/resolution times trend down and transitions stay successful.
- Risk increases when SLA breaches rise and overdue case counts grow.
- Adoption health improves with sustained role-based case activity.
