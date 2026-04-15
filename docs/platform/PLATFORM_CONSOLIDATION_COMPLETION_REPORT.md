# Platform Consolidation Completion Report

Date: 2026-04-14
Scope: precision consolidation and adoption pass on existing platform layers

## 1) Authoritative Package Map

Normative source: governance/platform-package-authority.json

- auth: @nzila/platform-auth
- contracts: @nzila/platform-contracts (supporting: @nzila/contracts)
- eventing: @nzila/platform-events + @nzila/platform-event-fabric (supporting: @nzila/events)
- observability: @nzila/os-core + @nzila/platform-observability (supporting: @nzila/otel-core, @nzila/observability)
- org context: @nzila/org
- evidence: @nzila/platform-evidence-pack (supporting: @nzila/evidence)
- notifications: @nzila/platform-notifications
- integrations: @nzila/platform-integrations + @nzila/platform-integrations-control-plane (supporting: integrations-core/runtime/db)
- revenue: @nzila/platform-revenue
- billing: @nzila/platform-billing
- deployment: @nzila/platform-deploy
- feature flags: @nzila/platform-feature-flags
- data fabric: @nzila/platform-data-fabric

## 2) Packages Narrowed, Deprecated, or Clarified

Clarified as subordinate / not for expansion:

- @nzila/contracts (supporting, not primary cross-app contract surface)
- @nzila/events (supporting, not primary event envelope/fabric)
- @nzila/observability (supporting, not primary telemetry boot path)
- @nzila/integrations (legacy for compatibility; new orchestration work in @nzila/platform-integrations)

Authoritative package ownership boundaries documented with new READMEs:

- packages/platform-auth/README.md
- packages/platform-integrations/README.md
- packages/platform-revenue/README.md
- packages/platform-billing/README.md
- packages/platform-notifications/README.md

## 3) App Adoption Gaps Closed

Concern-based adoption gate now computes per-app required concerns by tier and app role, with explicit exception handling:

- script: scripts/platform-adoption-gate.ts
- report artifact: governance/reports/platform-concern-adoption-report.json

Current gate snapshot:

- fully adopted: 16 apps
- exception-approved: 1 app (orchestrator-api)
- partially adopted: 0 apps
- legacy migration path: 0 apps

## 4) Checks Added or Extended

Added:

- scripts/platform-authority-check.ts
- package script: pnpm platform:authority:check

Extended:

- scripts/platform-adoption-gate.ts (moved from shell/schema/workflow checks to concern authority adoption checks)
- scripts/platform-vs-app-check.ts (now validates governance/platform-package-authority.json)
- scripts/platform-contract-check.ts (removed stale non-existent shop-quoter target)
- package script architecture:check includes platform:authority:check

## 5) Docs Updated

- docs/architecture/PLATFORM_PACKAGE_AUTHORITY.md
- docs/platform/WHEN_TO_USE_PLATFORM_PACKAGES.md
- docs/platform/runtime-adoption-matrix.md
- docs/architecture/ARCHITECTURE_GOVERNANCE_INDEX.md
- docs/README.md
- ARCHITECTURE.md

## 6) Intentionally Deferred Items

- Full package.meta.json coverage across all packages (platform-vs-app check still reports many historical missing metadata files).
- Route manifest cleanup for control-plane and console (surface model check reports warnings for undocumented routes).
- Control-plane observability dual declaration (@nzila/observability and authoritative observability stack) remains warning-only pending migration sequence.

## 7) Exact Files Changed

Core governance and checks:

- governance/platform-package-authority.json
- governance/exceptions/platform-concern-adoption-exceptions.json
- governance/reports/platform-concern-adoption-report.json
- scripts/platform-authority-check.ts
- scripts/platform-adoption-gate.ts
- scripts/platform-vs-app-check.ts
- scripts/platform-contract-check.ts
- package.json
- scripts/README.md

Registry and architecture alignment:

- platform/registry/platform-registry.json
- apps/cfo/app-architecture.meta.json
- apps/zonga/app-architecture.meta.json
- apps/flow/docs/ARCHITECTURE_SHAPE.md

Documentation:

- docs/architecture/PLATFORM_PACKAGE_AUTHORITY.md
- docs/platform/WHEN_TO_USE_PLATFORM_PACKAGES.md
- docs/platform/runtime-adoption-matrix.md
- docs/architecture/ARCHITECTURE_GOVERNANCE_INDEX.md
- docs/README.md
- ARCHITECTURE.md

Package README ownership boundaries:

- packages/platform-auth/README.md
- packages/platform-integrations/README.md
- packages/platform-revenue/README.md
- packages/platform-billing/README.md
- packages/platform-notifications/README.md
- packages/contracts/README.md
- packages/events/README.md
- packages/observability/README.md

## 8) Validation Steps Run

Commands executed:

- pnpm platform:authority:check
- pnpm platform:adoption:check
- pnpm platform:contract:check
- pnpm architecture:check

Outcome:

- architecture:check passes
- non-blocking warnings remain in platform:surface:model:check and control-plane:coherence:check
- platform:authority:check passes with one warning (control-plane observability overlap)

## 9) Honest Remaining Risks

- Taxonomy metadata debt: missing package.meta.json files still reduce strictness of platform-vs-app governance.
- Surface manifest drift: many undocumented routes create governance/reporting blind spots.
- Observability overlap in control-plane can reintroduce ambiguity if not migrated to authoritative stack.
- Concern adoption currently validates package-level and key code markers; deeper runtime enforcement per route remains an ongoing hardening path.
