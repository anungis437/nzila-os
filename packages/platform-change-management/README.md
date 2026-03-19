# @nzila/platform-change-management

Enterprise change enablement with ITIL-aligned, Git-native, code-governed change control. Includes approval workflows, freeze windows, calendar conflict detection, and audit logging.

## Capabilities

| Area | Functions |
|------|-----------|
| **Service** | `loadChangeRecord`, `evaluateChangeRequirements` — change record lifecycle |
| **Approvals** | Approval chain workflows and escalation |
| **Calendar** | `detectWindowConflicts`, `isInFreezePeriod` — change window management |
| **Checks** | Pre-deployment verification checks |
| **Audit** | Change audit trail and compliance logging |

## Source Layout

```
src/
├── approvals.ts
├── audit.ts
├── calendar.ts
├── checks.ts
├── schemas.ts
├── service.ts
├── types.ts
├── utils.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./types` — change management type definitions
- `./schemas` — Zod validation schemas
- `./service` — core change service
- `./approvals` — approval workflows
- `./calendar` — change window calendar
- `./checks` — pre-deployment checks
- `./audit` — audit trail
- `./utils` — utility functions
