# @nzila/platform-environment

Environment detection, configuration resolution, health checks, and observability namespacing for the NzilaOS platform.

## Capabilities

| Area | Functions |
|------|-----------|
| **Detection** | `getEnvironment` — detect current runtime environment |
| **Config** | `getEnvironmentConfig` — resolve environment-specific configuration |
| **Observability** | `getEnvironmentNamespace` — scoped observability namespacing |
| **Governance** | `saveGovernanceSnapshot` — persist environment governance snapshots |

## Source Layout

```
src/
├── config.ts
├── env.ts
├── environment.ts
├── observability.ts
├── schemas.ts
├── service.ts
├── types.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./types` — environment type definitions
- `./schemas` — Zod validation schemas
- `./env` — environment variable helpers
- `./environment` — environment detection
- `./service` — environment service layer
- `./config` — configuration resolution
- `./observability` — observability namespacing
