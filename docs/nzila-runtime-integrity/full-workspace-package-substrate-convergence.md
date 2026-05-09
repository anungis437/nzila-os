# Full Workspace & Package Substrate Convergence

> Eliminates CI / local / runtime substrate drift. Establishes deterministic workspace resolution so local truth and CI truth are **identical**. Authorizes a separate runtime hardening PR.

## Authority Anchors

- [Runtime Integrity README](README.md)
- [Full Auth & Role Lineage Audit](full-auth-role-lineage-audit.md)
- [Full Dashboard & Runtime Failure Integrity](full-dashboard-runtime-failure-integrity.md)

## Posture

The workspace substrate must be:

- singular
- deterministic
- governance-safe
- continuity-safe
- reviewer-of-record traceable
- evidence-anchored
- explicitly bounded
- institutionally calm

Local truth and CI truth must become **identical**. Any divergence is a substrate integrity violation, not a developer-experience curiosity.

## Audit Targets

| Surface | Concern | Required Posture |
| --- | --- | --- |
| pnpm workspace (`pnpm-workspace.yaml`) | which paths participate in workspace linking | every package consumed by a runtime app must be in scope; no shadow packages |
| package exports | `exports` map per package | every consumed subpath (e.g. `@nzila/platform-ontology/schema`) must be declared and physically present |
| ontology packages (`@nzila/platform-ontology`, `@nzila/platform-event-fabric`, `@nzila/platform-knowledge-registry`) | re-exported from `packages/db/src/schema/index.ts` | workspace symlinks must exist in `packages/db/node_modules/@nzila` after `pnpm install` |
| db packages | `@nzila/db/client`, `@nzila/db/schema` | resolvable from runtime apps and from CLI scripts (`tsx`) without manual link patching |
| package visibility | which packages are public vs internal | declared once and not contradicted by `private: true` mismatches |
| symlink integrity | `node_modules/@nzila/*` | every workspace dependency must be physically linked, not silently absent |
| TS path aliases | `tsconfig.base.json` paths | must resolve identically in `tsc`, `tsx`, Turbopack, Vitest, and Next.js |
| runtime imports | apps consuming workspace packages | extensionless imports (per established `Turbopack / Next.js Build` rule) |
| CI package resolution | `pnpm install --frozen-lockfile` | must produce the same resolution graph as local `pnpm install` |
| local package resolution | developer machines | must produce the same graph as CI |

## Required Implementation (downstream PR)

The downstream PR (`refactor/nzila-workspace-package-substrate-convergence`) must actually:

- audit `packages/db/node_modules/@nzila` and ensure every workspace re-export (`@nzila/platform-ontology/schema`, `@nzila/platform-event-fabric/schema`, `@nzila/platform-knowledge-registry/schema`) is symlinked after a clean `pnpm install`
- add a contract test that fails if any subpath import re-exported from `packages/db/src/schema/index.ts` cannot be resolved by `tsx`
- declare and validate `exports` maps for every workspace package consumed across more than one app
- enforce extensionless imports at lint level for all workspace packages consumed by Next.js apps (per the established Turbopack / Next.js build rule)
- add a CI step that compares `pnpm list --recursive --depth=0 --json` between a freshly installed CI environment and a snapshot stored in `tooling/repo-inventory/output/` so substrate drift is observable evidence

## Forbidden Posture

The following are explicitly rejected:

- **ai-first** package resolution heuristics (forbidden — resolution is deterministic, not ai-powered, not copilot-driven, not chatbot-driven)
- **autonomous executive** package upgrades during CI (forbidden — every dependency change is reviewer-of-record gated)
- silent CI-only resolution paths that diverge from local (forbidden — silent divergence is incompatible with governance-safe operation)
- **engagement gamification** of dependency dashboards (forbidden — dependency hygiene is institutional, not a productivity optimization, not a workforce ai surface, not an ai assistant or ai ceo affordance)

## Stewardship Cadence

Substrate divergence is reviewed on the standing daily / weekly / monthly / quarterly stewardship cadence. Any divergence is treated as continuity-safe drift and remediated under reviewer-of-record approval.

## Authorized Downstream PR

This document authorizes exactly one runtime hardening PR titled `refactor/nzila-workspace-package-substrate-convergence`. It must not bundle auth lineage, organization convergence, persona hardening, or dashboard failure integrity work.
