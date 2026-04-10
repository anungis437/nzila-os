# Platform vs App Decision Rule — Nzila OS

> Official rule for deciding whether a new capability belongs in a platform service,
> a shared package, or an application.
>
> Enforced by: `pnpm platform:vs-app:check`
> ADR template: `templates/architecture-decision-record.md`

---

## Decision Framework

### Put it in PLATFORM if it is

- **Cross-app** — used or usable by multiple applications
- **Governance-related** — policy enforcement, compliance, audit integration
- **AI-related** — intelligence layer, anomaly detection, reasoning, AI query
- **Observability-related** — telemetry, metrics, tracing, monitoring
- **Identity-related** — authentication, authorisation, org isolation
- **Environment/deployment-related** — environment orchestration, deployment, rollback
- **Likely to be reused** across domains or verticals
- **Required for control-plane visibility** — governance signals, health metrics

### Put it in a SHARED PACKAGE if it is

- **A utility or abstraction** used by multiple packages or apps
- **Domain-shared logic** used across apps within the same vertical (e.g., `commerce-core`)
- **Infrastructure abstraction** (database client, blob storage, config resolution)
- **Not a service** — it's a library, not a running capability

### Put it in an APP if it is

- **Deeply domain-specific** — only relevant to one vertical's workflows
- **Primarily product workflow logic** — user-facing domain behaviour
- **Unlikely to be reused** outside that app or vertical
- **User-facing domain behaviour** rather than platform behaviour
- **App-local admin or operational UI** — belongs in the app, not the platform

---

## Concrete Examples from Nzila OS

### PLATFORM examples

| Capability | Location | Why Platform |
|------------|----------|-------------|
| Anomaly engine | `packages/platform-anomaly-engine` | Cross-app, control-plane visible, governance |
| Decision engine | `packages/platform-decision-engine` | Cross-app approval workflow, governance |
| Policy engine | `packages/platform-policy-engine` | Used by all production apps |
| Governance checks | `packages/platform-governance` | Cross-app compliance, control-plane visible |
| Environment orchestration | `packages/platform-environment` | Cross-app environment management |
| Change management | `packages/platform-change-management` | Cross-app change lifecycle |
| Evidence packing | `packages/platform-evidence-pack` | Cross-app compliance artifact generation |
| AI query interface | `packages/platform-ai-query` | Cross-app AI capability |

### SHARED PACKAGE examples

| Capability | Location | Why Shared Package |
|------------|----------|--------------------|
| Database client | `packages/db` | Used by all packages needing DB access |
| Org isolation primitives | `packages/org` | Used by all multi-tenant code |
| UI component library | `packages/ui` | Shared across all front-end apps |
| OpenTelemetry core | `packages/otel-core` | Instrumentation used everywhere |
| Commerce domain types | `packages/commerce-core` | Shared across commerce-vertical apps |

### APP examples

| Capability | Location | Why App |
|------------|----------|---------|
| Grievance intake form | `apps/union-eyes` | Domain-specific to union case management |
| Quote approval portal | `apps/flow` | Domain-specific to commerce quoting |
| Release moderation queue | `apps/zonga` | Domain-specific to media/creator moderation |
| Program eligibility UX | `apps/mobility` | Domain-specific to investment migration |
| Supplier operations board | `apps/flow` | Domain-specific to commerce suppliers |
| Vehicle deal management | `apps/trade` | Domain-specific to vehicle trade |
| Financial reconciliation views | `apps/cfo` | Domain-specific to finance operations |

---

## Anti-Patterns

### Building app-local versions of cross-app concerns

```
✗ apps/flow/lib/anomaly-detector.ts
  → Should use @nzila/platform-anomaly-engine

✗ apps/zonga/lib/governance-check.ts
  → Should use @nzila/platform-governance

✗ apps/union-eyes/lib/custom-policy-engine.ts
  → Should use @nzila/platform-policy-engine
```

### Putting domain-specific UI in platform packages

```
✗ packages/platform-governance/src/components/UnionCaseTable.tsx
  → UnionEyes-specific UI belongs in apps/union-eyes

✗ packages/platform-intelligence/src/views/FlowInsights.tsx
  → Flow-specific views belong in apps/flow
```

---

## ADR Trigger

A short Architecture Decision Record (ADR) is required when:

1. **A new package** is created under `packages/`
2. **A new platform service** is introduced under `packages/platform-*`
3. **A major shared abstraction** is extracted from an app
4. **An existing app capability** is proposed for promotion to platform

Use the ADR template at `templates/architecture-decision-record.md`.

The ADR does not need to be long. It must capture:

- Why the capability exists
- Why it belongs where it was placed (platform vs app vs package)
- What reuse is expected
- What governance impact it has

---

## Enforcement

- **Automated check**: `pnpm platform:vs-app:check` flags:
  - New packages without registry/category metadata
  - New platform services without documentation
  - Suspicious app-local implementations of cross-app concerns
- **Manual review**: PRs introducing new packages or platform services should reference an ADR
- **Contract tests**: `tooling/contract-tests/platform-api-surface.test.ts`

---

## Related Documents

- [ARCHITECTURAL_LAYERS.md](ARCHITECTURAL_LAYERS.md) — layer model and dependency directions
- [PACKAGE_OWNERSHIP.md](PACKAGE_OWNERSHIP.md) — package metadata and ownership
- [PACKAGE_LIFECYCLE_POLICY.md](PACKAGE_LIFECYCLE_POLICY.md) — package creation and graduation
- [PLATFORM_SURFACE_RESPONSIBILITIES.md](PLATFORM_SURFACE_RESPONSIBILITIES.md) — control plane vs console vs admin
