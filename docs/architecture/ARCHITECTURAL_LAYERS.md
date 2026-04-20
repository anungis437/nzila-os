# Architectural Layers — Nzila OS

> Canonical dependency model for the Nzila OS platform monorepo.
> This document defines the official layers, allowed dependency directions,
> and prohibited import patterns.
>
> Enforced by: `pnpm architecture:layers:check`
> Machine-readable source: `platform/registry/layers.json`

---

## Layer Model

### Layer 1 — APPS

Business applications under `apps/`.

Examples:

- `union-eyes` — union case management and governance
- `flow` — commerce quoting and supplier operations
- `zonga` — creator/media marketplace and moderation
- `cfo` — financial intelligence and reporting
- `partners` — partner operations portal
- `web` — public-facing marketing and product site
- `control-plane` — executive/operator platform shell
- `console` — operator/developer diagnostics and tooling
- `platform-admin` — platform configuration administration
- `abr` — audit/bridge/reconciliation engine
- `cora` — compliance and regulatory assurance
- `agrimo` — data intelligence and analytics
- `trade` — trade and vehicle commerce
- `mobility` — investment migration advisory (CBI/RBI)
- `mobility-client-portal` — mobility customer self-service
- `nacp-exams` — examination and certification workflows
- `orchestrator-api` — API orchestration layer

### Layer 2 — PLATFORM SERVICES

Reusable platform capabilities under `platform/` and approved `platform-*` packages.

Examples:

- `platform-governance` — governance engine and policy integration
- `platform-intelligence` — AI intelligence layer
- `platform-ai-query` — structured AI query interface
- `platform-anomaly-engine` — anomaly detection and alerting
- `platform-observability` — telemetry and observability
- `platform-policy-engine` — policy evaluation and enforcement
- `platform-change-management` — change request lifecycle
- `platform-environment` — environment orchestration
- `platform-decision-engine` — decision lifecycle management
- `platform-evidence-pack` — evidence packaging and export
- `platform-compliance-snapshots` — compliance state capture
- `platform-feature-flags` — feature flag management

### Layer 3 — SHARED PACKAGES

Reusable libraries under `packages/`.

Examples:

- `db` — database client and query utilities
- `blob` — blob/object storage abstraction
- `org` — organisation context and isolation primitives
- `config` — configuration resolution
- `os-core` — shared core types and utilities
- `ui` — shared component library
- `evidence` — evidence generation helpers
- `secrets` — secret management abstraction
- `otel-core` — OpenTelemetry instrumentation
- `analytics` — analytics contract types
- `auth` — authentication utilities (via Clerk)
- `payments-stripe` — Stripe payment integration
- Domain-shared packages (`commerce-core`, `agri-core`, `trade-core`, etc.)

### Layer 4 — INFRASTRUCTURE / TOOLING

Scripts, tooling, ops, and infrastructure adapters.

Examples:

- `scripts/` — CI checks, seed scripts, validation utilities
- `tooling/` — contract tests, security scanners, build helpers
- `ops/` — operational policies, runbooks, change records
- `infrastructure/` — GitOps manifests, environment definitions
- `governance/` — governance profiles, exceptions, reports

---

## Allowed Dependency Directions

```
Layer 1 (APPS) ──────────► Layer 2 (PLATFORM SERVICES)
      │                           │
      │                           ▼
      └──────────────────► Layer 3 (SHARED PACKAGES)

Layer 2 (PLATFORM SERVICES) ──► Layer 3 (SHARED PACKAGES)
      │
      └──────────────────► Layer 4 (INFRASTRUCTURE) [approved adapters only]

Layer 3 (SHARED PACKAGES) ────► Layer 3 (SHARED PACKAGES) [same or lower vertical]

Layer 4 (INFRASTRUCTURE) ─────► Layer 3 (SHARED PACKAGES) [for tooling utilities]
```

### Rules

1. **Apps may depend on** platform services and approved shared packages.
2. **Platform services may depend on** shared packages and approved infrastructure adapters.
3. **Shared packages must not depend on** apps.
4. **Infrastructure/tooling must not become** implicit runtime dependencies for app business logic.
5. **Governance/tooling/scripts must not be imported** directly into app runtime code except through approved platform wrappers.
6. **Apps must not import** other apps' internal code.
7. **Cross-vertical domain packages** must not depend on each other (e.g., `commerce-core` must not import `agri-core`).

---

## Anti-Patterns

### App importing another app's internal code

```ts
// ✗ FORBIDDEN — cross-app import
import { CaseActions } from '../../apps/union-eyes/lib/actions'
```

Apps are isolated. If two apps need the same logic, extract it to a shared package.

### App importing scripts/ or tooling/ directly

```ts
// ✗ FORBIDDEN — runtime import of CI tooling
import { validateGovernance } from '../../../scripts/governance-check'
```

Scripts and tooling are Layer 4. They run in CI or development, never in app runtime.

### Shared package depending on app code

```ts
// ✗ FORBIDDEN — upward dependency
// Inside packages/commerce-core/src/index.ts
import { ShopConfig } from '../../apps/flow/lib/config'
```

Packages must never depend upward toward apps. Extract shared types to the package itself.

### Platform service depending on app-local domain UI code

```ts
// ✗ FORBIDDEN — platform importing app-specific UI
// Inside packages/platform-governance/src/dashboard.tsx
import { CaseTable } from '../../apps/union-eyes/components/CaseTable'
```

Platform services provide APIs and logic, not app-specific UI. App-specific rendering belongs in the app.

### Infrastructure script imported as runtime dependency

```ts
// ✗ FORBIDDEN — tooling as runtime dep
// Inside apps/web/lib/api.ts
import { generateSbom } from '../../../tooling/security/supply-chain-policy'
```

If an app needs a capability provided by infrastructure, wrap it in a platform service.

---

## Enforcement

- **Machine-readable layer map**: `platform/registry/layers.json`
- **Automated check**: `pnpm architecture:layers:check` (runs `scripts/architecture-layer-check.ts`)
- **Contract tests**: `tooling/contract-tests/arch-layer.test.ts`
- **CI integration**: Runs on every PR alongside `pnpm deps:check`

---

## Related Documents

- [ARCHITECTURAL_BOUNDARIES.md](ARCHITECTURAL_BOUNDARIES.md) — detailed dependency direction rules and vertical isolation
- [PACKAGE_OWNERSHIP.md](../governance/PACKAGE_OWNERSHIP.md) — package metadata registry
- [PACKAGE_LIFECYCLE_POLICY.md](../governance/PACKAGE_LIFECYCLE_POLICY.md) — package creation, graduation, and deprecation
- [PLATFORM_VS_APP_DECISION_RULE.md](../governance/PLATFORM_VS_APP_DECISION_RULE.md) — deciding where new capabilities belong
