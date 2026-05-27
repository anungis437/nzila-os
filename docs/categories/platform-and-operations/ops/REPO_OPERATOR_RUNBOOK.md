# Repo Operator Runbook

> Practical guide for day-to-day architectural operations in the Nzila OS monorepo.

---

## Quick Reference

### Run All Architecture Checks

```bash
pnpm exec tsx scripts/architecture-layer-check.ts && pnpm exec tsx scripts/app-domain-core-check.ts && pnpm exec tsx scripts/platform-surface-model-check.ts && pnpm exec tsx scripts/platform-authority-check.ts && pnpm exec tsx scripts/platform-contract-check.ts && pnpm exec tsx scripts/registry-consistency-check.ts && pnpm exec tsx scripts/control-plane-coherence-check.ts && pnpm exec tsx scripts/platform-adoption-gate.ts
```

This runs (in sequence):

1. `pnpm exec tsx scripts/architecture-layer-check.ts` — dependency direction validation
2. `pnpm exec tsx scripts/app-domain-core-check.ts` — app internal architecture compliance
3. `pnpm exec tsx scripts/platform-surface-model-check.ts` — route ↔ surface capability alignment
4. `pnpm exec tsx scripts/platform-contract-check.ts` — contract package and adapter scaffolds
5. `pnpm exec tsx scripts/registry-consistency-check.ts` — cross-registry validation
6. `pnpm exec tsx scripts/control-plane-coherence-check.ts` — cross-surface duplication detection

### Individual Checks

| Command | What It Validates |
|---|---|
| `pnpm exec tsx scripts/architecture-layer-check.ts` | Apps don't import from other apps; layers respect dependency rules |
| `pnpm exec tsx scripts/app-domain-core-check.ts` | Target apps have domain/services/workflows/queries/events layers |
| `pnpm exec tsx scripts/platform-surface-model-check.ts` | Route feature classes match surface capabilities |
| `pnpm exec tsx scripts/platform-contract-check.ts` | platform-contracts package exists; apps have adapter scaffolds |
| `pnpm exec tsx scripts/control-plane-coherence-check.ts` | No route duplication across surfaces; bucket balance |
| `pnpm exec tsx scripts/registry-consistency-check.ts` | All registry files exist; app tiers match; env apps valid |
| `pnpm exec tsx scripts/control-plane-check.ts` | Control plane routes match manifest |
| `pnpm exec tsx scripts/control-plane-surface-check.ts` | Control plane surface governance |
| `pnpm exec tsx scripts/platform-registry-check.ts` | Platform registry structure |
| `pnpm exec tsx scripts/governance-check.ts` | SBOM, evidence, policy engine |
| `pnpm exec tsx scripts/ai-contract-check.ts` | AI output patterns |

---

## Common Operations

### Adding a New App

1. Create the app directory under `apps/`
2. Add entry to `platform/registry/apps.json` (set tier to INCUBATING)
3. Create `app-architecture.meta.json` following the domain-core standard
4. Create `docs/ARCHITECTURE_SHAPE.md`
5. Create canonical layer directories (`domain/`, `services/`, etc.)
6. Create `lib/platform-adapters/index.ts`
7. Run `pnpm exec tsx scripts/architecture-layer-check.ts && pnpm exec tsx scripts/app-domain-core-check.ts && pnpm exec tsx scripts/platform-surface-model-check.ts && pnpm exec tsx scripts/platform-authority-check.ts && pnpm exec tsx scripts/platform-contract-check.ts && pnpm exec tsx scripts/registry-consistency-check.ts && pnpm exec tsx scripts/control-plane-coherence-check.ts && pnpm exec tsx scripts/platform-adoption-gate.ts` to validate

### Adding a New Route to a Surface

1. Add the route page under the surface app's `app/` directory
2. Add entry to the surface's `route.meta.json`
3. Ensure `feature_class` is in the surface's `allowed_capabilities` (see `platform/registry/platform-surfaces.json`)
4. Run `pnpm exec tsx scripts/platform-surface-model-check.ts`
5. Run `pnpm exec tsx scripts/control-plane-coherence-check.ts` to detect cross-surface overlap

### Promoting an App Tier

1. Update `tier` in `platform/registry/apps.json`
2. Update `app_tier` in the app's `app-architecture.meta.json`
3. Run `pnpm exec tsx scripts/registry-consistency-check.ts` to verify alignment
4. For PRODUCTION promotion: ensure all domain-core layers are populated

### Creating a Platform Contract Adapter

1. Create the adapter file in `apps/<app>/lib/platform-adapters/`
2. Import the contract type from `@nzila/platform-contracts/<module>`
3. Implement the contract interface using the app's internal domain logic
4. Export from `lib/platform-adapters/index.ts`
5. Wire to the appropriate API route

---

## Key Files

| File | Purpose |
|---|---|
| `platform/registry/apps.json` | App registry — tier, owner, capabilities |
| `platform/registry/layers.json` | Layer dependency rules |
| `platform/registry/platform-surfaces.json` | Surface capability definitions |
| `platform/registry/environments.json` | Environment definitions |
| `apps/<app>/app-architecture.meta.json` | Per-app domain-core metadata |
| `apps/<surface>/route.meta.json` | Per-surface route governance |
| `packages/platform-contracts/` | Canonical contract interfaces |
| `docs/architecture/ARCHITECTURE_GOVERNANCE_INDEX.md` | Master governance index |

---

## Troubleshooting

### "Layer X declared present but directory not found"

The `app-architecture.meta.json` says a layer exists but the directory doesn't. Create the directory or update the meta.

### "feature_class not in allowed_capabilities"

A route's feature class doesn't match its surface's allowed list. Either move the route to the correct surface or add the capability (with justification).

### "Potential overlap on keyword"

The coherence check found similar route purposes across surfaces. Review whether both routes are needed or if one should be deprecated.

### "App tier mismatch"

The `app_tier` in `app-architecture.meta.json` doesn't match the `tier` in `apps.json`. Update one to match the other.
