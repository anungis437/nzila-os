# Platform Surface Migrations

> Tracks identified surface boundary violations and their migration plans.
> Each entry documents overlapping or misplaced routes and the plan to resolve them.

---

## Active Migrations

### 1. Platform Admin `/platform-health` → Configuration Only

**Current state**: Platform Admin has a `/platform-health` route that may overlap with Control Plane `/overview`.

**Target**: `/platform-health` should be configuration-only (threshold management, alerting rules). Runtime health monitoring belongs exclusively in Control Plane.

**Migration plan**:
- Audit the current `/platform-health` page content
- Extract any runtime monitoring into Control Plane if not already present
- Retain only configuration UI (thresholds, alert rules, health check schedules)
- Update `route.meta.json` to clarify scope

**Status**: Documented, pending review

---

### 2. Console Evidence Routes vs App-Level Evidence

**Current state**: Console has `/proof-center` and `/proof-pack` for evidence generation. Individual apps (union-eyes, flow) also have evidence export endpoints.

**Target**: Console evidence tools are platform-level cross-app evidence assembly. App-level evidence exports feed into them but are not duplicates.

**Migration plan**:
- No route movement needed — this is architectural alignment, not duplication
- Ensure app-level evidence routes use `@nzila/platform-evidence-pack` contracts
- Console evidence tools should aggregate from app adapters

**Status**: Aligned, no action required

---

## Migration Rules

1. **Never delete routes without replacement** — deprecate first, document in this file
2. **Mark deprecated routes** in `route.meta.json` with `"deprecated": true`
3. **Provide migration path** — where should users go instead?
4. **Timeline** — deprecations should have a target removal date (typically 2 release cycles)
5. **Update check scripts** — `pnpm platform:surface:model:check` should flag deprecated routes as warnings

---

## Completed Migrations

_None yet._
