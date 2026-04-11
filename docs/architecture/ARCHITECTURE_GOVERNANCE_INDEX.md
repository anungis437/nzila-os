# Architecture Governance Index

> Master index of all anti-entropy architecture hardening documents, scripts, and enforcement tools.

---

## Governance Documents

| Document | Purpose |
|---|---|
| [ARCHITECTURAL_LAYERS.md](ARCHITECTURAL_LAYERS.md) | Four-layer dependency model: Apps → Platform Services → Shared Packages → Infrastructure |
| [APP_LIFECYCLE_MATRIX.md](../governance/APP_LIFECYCLE_MATRIX.md) | App maturity tiering: PRODUCTION / PILOT / INCUBATING / EXPERIMENTAL |
| [PLATFORM_SURFACE_RESPONSIBILITIES.md](../governance/PLATFORM_SURFACE_RESPONSIBILITIES.md) | Control Plane vs Console vs Platform Admin vs App Admin boundaries |
| [PLATFORM_VS_APP_DECISION_RULE.md](../governance/PLATFORM_VS_APP_DECISION_RULE.md) | Decision framework: when a capability belongs in platform vs app |
| [PACKAGE_OWNERSHIP.md](../governance/PACKAGE_OWNERSHIP.md) | Package registry: owner, category, stability, allowed dependents |
| [PACKAGE_LIFECYCLE_POLICY.md](../governance/PACKAGE_LIFECYCLE_POLICY.md) | Create, graduate, deprecate, and remove packages |
| [DOMAIN_VS_AUDIT_MODEL.md](DOMAIN_VS_AUDIT_MODEL.md) | Rules separating domain state from audit/evidence stores |
| [AI_PLATFORM_CONTRACT.md](AI_PLATFORM_CONTRACT.md) | Canonical AI output schemas and prohibited patterns |
| [PLATFORM_SURFACE_MODEL.md](../platform/PLATFORM_SURFACE_MODEL.md) | Operating shell model: Control Plane, Console, Platform Admin, App Admin |
| [APP_DOMAIN_CORE_STANDARD.md](APP_DOMAIN_CORE_STANDARD.md) | Internal app architecture: domain/services/workflows/queries/events/ui |
| [CONTROL_PLANE_PRINCIPLES.md](CONTROL_PLANE_PRINCIPLES.md) | Control Plane route buckets (HEALTH/ATTENTION/ACTION) |
| [ARCHITECTURAL_BOUNDARIES.md](ARCHITECTURAL_BOUNDARIES.md) | Dependency direction rules and vertical isolation |
| [DAPL_PLATFORM_LEDGER.md](DAPL_PLATFORM_LEDGER.md) | Dues-Aware Platform Ledger: 5-layer financial architecture for UnionEyes |
| [APP_GOLD_STANDARD.md](../governance/APP_GOLD_STANDARD.md) | Structural requirements for production-ready apps |

## Platform Registry (Machine-Readable)

| File | Purpose |
|---|---|
| [platform/registry/layers.json](../../platform/registry/layers.json) | Layer map with paths, dependency rules, and allowed overrides |
| [platform/registry/apps.json](../../platform/registry/apps.json) | App registry: tier, owner, domain, capability flags |
| [platform/registry/platform-registry.json](../../platform/registry/platform-registry.json) | Canonical registry: apps, platform services, shared packages, governance surfaces |
| [platform/registry/platform-surfaces.json](../../platform/registry/platform-surfaces.json) | Surface capability registry: allowed/forbidden feature classes per surface |
| [platform/registry/environments.json](../../platform/registry/environments.json) | Environment definitions: development, staging, production |

## Templates

| Template | Purpose |
|---|---|
| [templates/architecture-decision-record.md](../../templates/architecture-decision-record.md) | ADR template for platform-vs-app placement decisions |

## App Domain Models

| App | Document |
|---|---|
| union-eyes | [apps/union-eyes/docs/DOMAIN_MODEL.md](../../apps/union-eyes/docs/DOMAIN_MODEL.md) |
| flow | [apps/flow/docs/DOMAIN_MODEL.md](../../apps/flow/docs/DOMAIN_MODEL.md) |
| zonga | [apps/zonga/docs/DOMAIN_MODEL.md](../../apps/zonga/docs/DOMAIN_MODEL.md) |

## App Architecture Shapes

| App | Shape Doc | Meta |
|---|---|---|
| union-eyes | [ARCHITECTURE_SHAPE.md](../../apps/union-eyes/docs/ARCHITECTURE_SHAPE.md) | [meta](../../apps/union-eyes/app-architecture.meta.json) |
| flow | [ARCHITECTURE_SHAPE.md](../../apps/flow/docs/ARCHITECTURE_SHAPE.md) | [meta](../../apps/flow/app-architecture.meta.json) |
| zonga | [ARCHITECTURE_SHAPE.md](../../apps/zonga/docs/ARCHITECTURE_SHAPE.md) | [meta](../../apps/zonga/app-architecture.meta.json) |
| cfo | [ARCHITECTURE_SHAPE.md](../../apps/cfo/docs/ARCHITECTURE_SHAPE.md) | [meta](../../apps/cfo/app-architecture.meta.json) |
| partners | [ARCHITECTURE_SHAPE.md](../../apps/partners/docs/ARCHITECTURE_SHAPE.md) | [meta](../../apps/partners/app-architecture.meta.json) |
| control-plane | [ARCHITECTURE_SHAPE.md](../../apps/control-plane/docs/ARCHITECTURE_SHAPE.md) | [meta](../../apps/control-plane/app-architecture.meta.json) |
| web | [ARCHITECTURE_SHAPE.md](../../apps/web/docs/ARCHITECTURE_SHAPE.md) | [meta](../../apps/web/app-architecture.meta.json) |

## Control Plane Governance

| Document | Purpose |
|---|---|
| [Route Governance](../apps/control-plane/docs/ROUTE_GOVERNANCE.md) | Per-route bucket assignment and justification |
| [route.meta.json](../apps/control-plane/route.meta.json) | Machine-readable route manifest (v2: with actionability_score, duplication_risk, source_contracts_used) |

## Route Manifests (All Surfaces)

| Surface | Manifest | Routes |
|---|---|---|
| Control Plane | [route.meta.json](../apps/control-plane/route.meta.json) | 13 routes |
| Console | [route.meta.json](../apps/console/route.meta.json) | 22 routes |
| Platform Admin | [route.meta.json](../apps/platform-admin/route.meta.json) | 13 routes |

## Surface Migration Tracking

| Document | Purpose |
|---|---|
| [platform-surface-migrations/README.md](platform-surface-migrations/README.md) | Active surface boundary violations and migration plans |

## Enforcement Scripts

| Script | Command | Purpose |
|---|---|---|
| `scripts/architecture-layer-check.ts` | `pnpm architecture:layers:check` | Validate dependency directions across architectural layers |
| `scripts/app-lifecycle-check.ts` | `pnpm app:lifecycle:check` | Validate app registration and tier-specific requirements |
| `scripts/platform-registry-check.ts` | `pnpm registry:check` | Validate platform-registry.json shape and path existence |
| `scripts/control-plane-surface-check.ts` | `pnpm control-plane:surface:check` | Validate control-plane routes against surface responsibilities |
| `scripts/platform-vs-app-check.ts` | `pnpm platform:vs-app:check` | Validate platform vs app classification and registry coverage |
| `scripts/package-ownership-check.ts` | `pnpm package:ownership:check` | Validate `package.meta.json` schema across all packages |
| `scripts/dependency-boundary-check.ts` | `pnpm deps:check` | Detect circular deps, cross-vertical deps, deprecated usage |
| `scripts/ai-contract-check.ts` | `pnpm ai:contract:check` | Scan apps for prohibited AI patterns |
| `scripts/control-plane-check.ts` | `pnpm control-plane:check` | Validate control plane routes against `route.meta.json` |
| `scripts/app-gold-standard-check.ts` | `pnpm app:gold-standard:check` | Check app compliance with gold standard |
| `scripts/package-deprecation-check.ts` | `pnpm package:deprecation:check` | Validate deprecation metadata consistency |
| `scripts/governance-check.ts` | `pnpm governance:check` | Existing: SBOM, evidence, policy engine validation |
| `scripts/platform-surface-model-check.ts` | `pnpm platform:surface:model:check` | Validate route feature classes against surface capabilities |
| `scripts/app-domain-core-check.ts` | `pnpm app:domain-core:check` | Validate app internal architecture (domain-core standard) |
| `scripts/platform-contract-check.ts` | `pnpm platform:contract:check` | Validate platform contract package and app adapter scaffolds |
| `scripts/control-plane-coherence-check.ts` | `pnpm control-plane:coherence:check` | Cross-surface coherence: duplication detection, contract alignment |
| `scripts/registry-consistency-check.ts` | `pnpm registry:consistency:check` | Registry cross-validation: surfaces, environments, tiers |

## Aggregate Commands

| Command | Purpose |
|---|---|
| `pnpm architecture:check` | Run all architecture checks: layers, domain-core, surface model, contracts, registry, coherence |

## Contract Tests

| Test | Location |
|---|---|
| Domain vs Audit guardrails | `tooling/contract-tests/domain-vs-audit.test.ts` |
| Domain/audit allowlist | `tooling/contract-tests/domain-audit-allowlist.json` |

## Packages Created

| Package | Purpose |
|---|---|
| `@nzila/platform-ai-contract` | Canonical AI output types and validation schemas |
| `@nzila/platform-contracts` | Platform-wide contract interfaces: health, metrics, governance, evidence, environment, change |

## Dashboard

| Route | Bucket | Purpose |
|---|---|---|
| `/architecture` | HEALTH | Lifecycle tiers, registry completeness, package ownership, app compliance, platform service health |

## Seed / Demo

| Script | Command | Purpose |
|---|---|---|
| `scripts/seed-architecture-demo.ts` | `pnpm arch:seed` | Generate static architecture snapshot to `demo-output/` |

---

## How These Documents Fit Together

```
┌─────────────────────────────────────────────┐
│         ARCHITECTURAL_LAYERS.md             │  ← Layer model (what depends on what)
│  layers.json                                │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         APP_LIFECYCLE_MATRIX.md             │  ← Which apps are mature enough
│  apps.json                                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  platform-registry.json                     │  ← Canonical source of truth
│  PACKAGE_OWNERSHIP.md                       │
│  PACKAGE_LIFECYCLE_POLICY.md                │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  PLATFORM_SURFACE_RESPONSIBILITIES.md       │  ← Where things appear in UI
│  PLATFORM_VS_APP_DECISION_RULE.md           │
│  architecture-decision-record.md (template) │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Enforcement Scripts                        │  ← CI checks validate everything
│  Control Plane /architecture                │  ← Dashboard visualises it
└─────────────────────────────────────────────┘
```
