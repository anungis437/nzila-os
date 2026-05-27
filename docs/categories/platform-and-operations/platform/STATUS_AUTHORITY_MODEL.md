# Nzila OS — Status Authority Model

This document defines the canonical status model used across portfolio, operations, and procurement surfaces.

## Why this exists

Nzila OS distinguishes product-tier positioning from deployment-readiness reality.
This prevents contradictory statements such as claiming `PRODUCTION` in a portfolio table while runtime maturity remains `pilot` or `internal`.

## Canonical axes

### 1. Product Tier (registry axis)

Authoritative source:

- `packages/platform-contracts/src/registry.ts`

Allowed values:

- `PRODUCTION`
- `PILOT`
- `INCUBATING`
- `EXPERIMENTAL`

Meaning:

- Portfolio classification, strategic positioning, and product-line governance.
- Does not, by itself, certify operational deployment readiness.

### 2. Deployment Status (runtime axis)

Authoritative sources:

- `apps/*/maturity.json` (per-app declaration)
- `nzila-truth-manifest.json` (repo-level aggregate)

Allowed values:

- `production`
- `pilot`
- `internal`
- `scaffold`
- `deprecated`

Meaning:

- Current runtime maturity and deployability state.
- Used by fail-closed governance and release-readiness gates.

### 3. Readiness Tier (platform aggregate axis)

Authoritative source:

- `nzila-truth-manifest.json`

Allowed values:

- `production-ready`
- `pilot-safe`
- `internal-only`
- `scaffold-only`
- `deprecated`

Meaning:

- Normalized label used for executive/procurement communication.

## Required alignment rules

1. Every app in registry must exist in `nzila-truth-manifest.json`.
2. `app_status.<app>.registry_tier` must match `registry.ts`.
3. `app_status.<app>.deployment_status` must match `apps.<app>` in truth manifest.
4. Truth manifest deployment status must match `apps/<app>/maturity.json`.
5. Public docs must explicitly label whether they are reporting product tier or deployment status.

These rules are enforced by `pnpm exec tsx scripts/validate-truth-authority.ts`.

## Communication standard

- Use "product tier" language for registry classifications.
- Use "deployment status" or "readiness" language for runtime maturity.
- Never use product tier as a proxy for legal, audit, or operational certification.
