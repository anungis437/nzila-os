# Architectural Boundaries — Nzila OS

> Anti-entropy guardrail: dependency directions are governed. Circular
> dependencies, sideways sprawl, and deprecated package usage are prohibited.

## Allowed Dependency Directions

```
┌─────────────────────────────────────────────┐
│                   APPS                       │
│  (apps/union-eyes, apps/flow, ...)   │
└──────────────────┬──────────────────────────┘
                   │ may depend on
                   ▼
┌─────────────────────────────────────────────┐
│            DOMAIN SHARED PACKAGES            │
│  (commerce-*, agri-*, mobility-*, trade-*)  │
└──────────────────┬──────────────────────────┘
                   │ may depend on
                   ▼
┌─────────────────────────────────────────────┐
│           PLATFORM CORE PACKAGES             │
│  (platform-*, os-core, db, org, evidence)   │
└─────────────────────────────────────────────┘
```

### Detailed Rules

| Source | Allowed Targets | Forbidden |
|--------|----------------|-----------|
| `apps/*` | `packages/*` (any) | Other `apps/*` |
| `DOMAIN_SHARED` packages | `PLATFORM_CORE` packages, lower-level domain packages in same vertical | Other verticals' domain packages without approval |
| `PLATFORM_CORE` packages | Other `PLATFORM_CORE` packages (lower-level) | `DOMAIN_SHARED` packages, `APP_SUPPORT` packages |
| `APP_SUPPORT` packages | `PLATFORM_CORE` packages, their parent domain packages | Other `APP_SUPPORT` packages |
| `DEPRECATED` packages | Nothing new | Everyone (with migration path) |

### Specific Constraints

1. **No circular dependencies** — package A depends on B depends on A is forbidden
2. **No cross-vertical domain imports** — `commerce-*` must not depend on `agri-*`
3. **No app-to-app imports** — apps must communicate through shared packages or events
4. **No upward dependencies** — platform packages must not depend on domain or app packages
5. **No deprecated package imports** in production apps unless explicitly allowlisted

### Vertical Boundaries

| Vertical | Packages | May Not Depend On |
|----------|----------|-------------------|
| Commerce | `commerce-*`, `pricing-engine`, `fx`, `tax`, `qbo`, `finops`, `payments-stripe` | `agri-*`, `mobility-*`, `trade-*` |
| Agri | `agri-*` | `commerce-*`, `mobility-*`, `trade-*` |
| Mobility | `mobility-*` | `commerce-*`, `agri-*`, `trade-*` |
| Trade | `trade-*` | `commerce-*`, `agri-*`, `mobility-*` |
| Integration | `integrations-*`, `crm-hubspot`, `webhooks` | vertical domain packages |
| Comms | `comms-*`, `chatops-*` | vertical domain packages |

## Enforcement

- Dependency check: `pnpm exec tsx scripts/dependency-boundary-check.ts` (`scripts/dependency-boundary-check.ts`)
- CI: Runs on every PR

## Exception Process

If a cross-boundary dependency is genuinely needed:

1. Document the reason in the dependent package's `package.meta.json`
2. Add the exception to `scripts/dependency-boundary-check.ts` allowlist
3. Get platform team review
4. Plan for removal if temporary
