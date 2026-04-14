# UnionEyes — Pilot Metrics Validation

Updated: 2026-04-14

This report validates UnionEyes pilot proof instrumentation after the pilot-metrics refactor.

## Scope of Validation

Validated runtime emit points:
- case creation
- assignment
- workflow transitions (success and blocked)
- acknowledgement and resolution timings
- evidence exports
- SLA watchdog breach/compliance emissions

Validated platform guarantees:
- required trace and actor/system identity
- org/pilot consistency checks before write
- audit linkage for successful metric records

## Runtime Wiring Status

| Path | Validation Outcome |
|---|---|
| [apps/union-eyes/app/api/cases/route.ts](apps/union-eyes/app/api/cases/route.ts) | Emits `cases_created` with trace + actor context |
| [apps/union-eyes/app/api/cases/[caseId]/assign/route.ts](apps/union-eyes/app/api/cases/[caseId]/assign/route.ts) | Emits `assignment_efficiency` |
| [apps/union-eyes/app/api/cases/[caseId]/export/route.ts](apps/union-eyes/app/api/cases/[caseId]/export/route.ts) | Emits `evidence_pack_exports` |
| [apps/union-eyes/app/api/workflow/transition/route.ts](apps/union-eyes/app/api/workflow/transition/route.ts) | Emits transition success/failure and response/resolution metrics |
| [apps/union-eyes/app/api/cron/sla-watchdog/route.ts](apps/union-eyes/app/api/cron/sla-watchdog/route.ts) | Emits `sla_breach_count` and `sla_compliance_rate` with denominator inputs |
| [apps/union-eyes/lib/pilot-metrics.ts](apps/union-eyes/lib/pilot-metrics.ts) | Central adapter for UnionEyes metric emits |

## Platform Guardrail Status

| Guardrail | Source | Status |
|---|---|---|
| traceId required | [packages/platform-pilot-metrics/src/service.ts](packages/platform-pilot-metrics/src/service.ts) | enforced |
| actor or system actor required | [packages/platform-pilot-metrics/src/service.ts](packages/platform-pilot-metrics/src/service.ts) | enforced |
| org/pilot consistency check | [packages/platform-pilot-metrics/src/service.ts](packages/platform-pilot-metrics/src/service.ts) | enforced |
| audit linkage insertion | [packages/platform-pilot-metrics/src/service.ts](packages/platform-pilot-metrics/src/service.ts) | enforced |
| guardrail tests | [packages/platform-pilot-metrics/src/service.audit.test.ts](packages/platform-pilot-metrics/src/service.audit.test.ts) | passing in targeted run |

## Validation Commands

Use these commands for repeatable checks:

```bash
pnpm --filter @nzila/union-eyes typecheck
pnpm vitest run --project contract-tests tooling/contract-tests/pilot-metrics-governance.test.ts tooling/contract-tests/pilot-metrics-e2e-proof.test.ts
pnpm vitest run packages/platform-pilot-metrics/src/service.audit.test.ts
```

## Known Boundaries

- Contract and wiring tests confirm route/service integration and guardrails.
- Full live-environment multi-service replay with production-like traffic remains a separate operational validation activity.

## Canonical References

- [apps/union-eyes/docs/PILOT_SCOPE.md](apps/union-eyes/docs/PILOT_SCOPE.md)
- [docs/union-eyes/pilot-kpis.md](docs/union-eyes/pilot-kpis.md)
- [docs/platform/pilot-metrics-architecture.md](docs/platform/pilot-metrics-architecture.md)
