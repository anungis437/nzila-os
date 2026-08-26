# 02 — Capability Reality Register

**Wave:** 0 (living document; updated every wave)

This document is a human-readable rendering of the machine-readable
registry at
[`apps/union-eyes/lib/reality/capability-registry.ts`](../../../apps/union-eyes/lib/reality/capability-registry.ts).
When the two conflict, the TypeScript file wins.

## Wave 0 baseline

| Capability ID                     | Title                                      | State             | Target wave |
|-----------------------------------|--------------------------------------------|-------------------|-------------|
| `UE-CRON-MONTHLY-DUES`            | Monthly dues cron                          | `NOT_IMPLEMENTED` | 5           |
| `UE-CRON-OVERDUE-NOTIFICATIONS`   | Overdue-notifications cron                 | `NOT_IMPLEMENTED` | 3           |
| `UE-CRON-PROCESS-MESSAGES`        | Message-processing cron                    | `NOT_IMPLEMENTED` | 4           |
| `UE-CRON-PROCESS-NOTIFICATIONS`   | Notification-processing cron               | `NOT_IMPLEMENTED` | 4           |
| `UE-CRON-SCHEDULED-REPORTS`       | Scheduled-reports cron                     | `NOT_IMPLEMENTED` | 8           |
| `UE-ADMIN-PILOT-STATUS`           | Pilot readiness aggregator                 | `LIMITED`         | 3           |
| `UE-FIN-BOC-EXCHANGE-RATE`        | Bank of Canada FX rate resolution          | `LIMITED`         | 7           |
| `UE-DEMO-CUPE4373`                | CUPE 4373 demo profile                     | `DEMO_ONLY`       | 6           |

## Legend

- `REAL` — production-ready and validated.
- `LIMITED` — real implementation with clearly documented limits.
- `DEGRADED` — running with a known non-fatal defect.
- `DISABLED` — code exists, intentionally off.
- `DEMO_ONLY` — active in demo profile only; blocked outside development.
- `NOT_IMPLEMENTED` — handler returns HTTP 501.
- `DEPRECATED` — replacement exists; scheduled for removal.
- `REMOVED` — deleted from codebase; history-only entry.
