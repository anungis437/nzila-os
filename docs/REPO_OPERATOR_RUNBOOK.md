# Repo Operator Runbook

> Practical guide for day-to-day architectural operations in the Nzila OS monorepo.

---

## Quick Reference

### Run All Architecture Checks

```bash
pnpm architecture:check
```

This runs (in sequence):
1. `architecture:layers:check` — dependency direction validation
2. `app:domain-core:check` — app internal architecture compliance
3. `platform:surface:model:check` — route ↔ surface capability alignment
4. `platform:contract:check` — contract package and adapter scaffolds
5. `registry:consistency:check` — cross-registry validation
6. `control-plane:coherence:check` — cross-surface duplication detection

### Individual Checks

| Command | What It Validates |
|---|---|
| `pnpm architecture:layers:check` | Apps don't import from other apps; layers respect dependency rules |
| `pnpm app:domain-core:check` | Target apps have domain/services/workflows/queries/events layers |
| `pnpm platform:surface:model:check` | Route feature classes match surface capabilities |
| `pnpm platform:contract:check` | platform-contracts package exists; apps have adapter scaffolds |
| `pnpm control-plane:coherence:check` | No route duplication across surfaces; bucket balance |
| `pnpm registry:consistency:check` | All registry files exist; app tiers match; env apps valid |
| `pnpm control-plane:check` | Control plane routes match manifest |
| `pnpm control-plane:surface:check` | Control plane surface governance |
| `pnpm registry:check` | Platform registry structure |
| `pnpm governance:check` | SBOM, evidence, policy engine |
| `pnpm ai:contract:check` | AI output patterns |

---

## Common Operations

### Adding a New App

1. Create the app directory under `apps/`
2. Add entry to `platform/registry/apps.json` (set tier to INCUBATING)
3. Create `app-architecture.meta.json` following the domain-core standard
4. Create `docs/ARCHITECTURE_SHAPE.md`
5. Create canonical layer directories (`domain/`, `services/`, etc.)
6. Create `lib/platform-adapters/index.ts`
7. Run `pnpm architecture:check` to validate

### Adding a New Route to a Surface

1. Add the route page under the surface app's `app/` directory
2. Add entry to the surface's `route.meta.json`
3. Ensure `feature_class` is in the surface's `allowed_capabilities` (see `platform/registry/platform-surfaces.json`)
4. Run `pnpm platform:surface:model:check`
5. Run `pnpm control-plane:coherence:check` to detect cross-surface overlap

### Promoting an App Tier

1. Update `tier` in `platform/registry/apps.json`
2. Update `app_tier` in the app's `app-architecture.meta.json`
3. Run `pnpm registry:consistency:check` to verify alignment
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
| `docs/ARCHITECTURE_GOVERNANCE_INDEX.md` | Master governance index |

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
