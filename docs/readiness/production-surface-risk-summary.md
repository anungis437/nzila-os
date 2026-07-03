# Production Surface Risk Summary (Phase -1)

**Companion to:** [production-surface-inventory.md](production-surface-inventory.md)
**Manifest:** [`governance/readiness/production-surface.json`](../../governance/readiness/production-surface.json)

- **As of:** 2026-07-03 · Commit `0e95c11`
- **Bottom line:** The surface is now **frozen and unambiguous**, but it is **not
  production-safe**. Zero apps are `PRODUCTION`; the one externally-live surface
  (union-eyes) carries three high-severity ambiguities, and all production deploy
  workflows still use a long-lived credential.

## Highest-risk exposed surfaces

1. **union-eyes (PILOT, but externally live).** Live on `unioneyes.app` /
   `app.unioneyes.app` with a production database, yet classified `pilot` in the
   truth manifest and `prod-approved` in the deployment inventory. Highest
   real-world exposure of any surface. Blockers: **OSB-1** (classification
   conflict), **OSB-3** (rollback exception expired 2026-06-30).
2. **web (PILOT, public).** Publicly navigable; deployed via `deploy-web` +
   `canary` using long-lived `AZURE_CREDENTIALS`.
3. **abr / CourtLens (PILOT).** Public-intake product; external demo **BLOCKED**.
   Abuse hardening, bilingual legal-boundary copy, and synthetic-data enforcement
   unproven (Phase 3).

## Workflow / deploy ambiguity

- **OSB-2 (high): production shares resource group AND container-app environment
  with staging** (`deployment-inventory.json` → `topology.production.sharedWithStaging=true`).
  No real production/staging isolation — blast radius spans both.
- **All 3 production deploy workflows** (`deploy-production`, `gitops-deploy`,
  `canary-deploy`) authenticate with long-lived `AZURE_CREDENTIALS` (Phase 4).
- **OSB-4 (medium):** `deploy-production.yml` exposes a `zonga_prod_override`
  input — a potential gate-bypass path that needs audit.
- **`deploy-production` / `gitops-deploy` accept a free-form `apps` input** (`*`
  targets) — any app, including internal ones, is technically dispatchable to the
  production pipeline. Guard this against `INTERNAL_ONLY`/`RETIRED`/`TEST_ONLY`.

## Retired / test surfaces still to watch

- `weekone`, `mobility-client-portal`, `platform-admin` (RETIRED) and
  `test-scaffold-gp` (TEST_ONLY) currently have **no dedicated deploy workflow**
  (validator confirms), but the wildcard `apps` input on the generic deploy
  workflows means they are not *structurally* barred. Next step: enforce a
  deny-list in the deploy workflows themselves.
- Proof workflows `br5-proof-deploy-staging.yml` and `build-identity-proof.yml`
  (TEST_ONLY) must never be treated as production signals.

## Internal apps with potential public paths

- **OSB-5 (medium):** `console` (INTERNAL_ONLY) rides the same `canary-deploy`
  pipeline as external apps `web`/`partners`/`union-eyes`. Confirm it is never
  publicly routed.
- **OSB-6 (low):** `veridian-site` is `incubating`/`INTERNAL_ONLY` but its name
  implies a public marketing site. Confirm no public domain/deploy exists.

## Legacy / API guard review

- CourtLens/ABR legacy incident routes need guard verification (Phase 3, carried
  from the readiness delta).
- Generic deploy workflows need an allow-list so only `PILOT`/`PRODUCTION` apps
  are dispatchable.

## Product exposure classification

- **CourtLens/ABR:** `PILOT`, external demo **BLOCKED**. Not production-bound.
- **Union Eyes:** `PILOT` with live production infrastructure — the only surface
  with genuine external production exposure. Must resolve OSB-1/2/3 before any
  `PRODUCTION` classification.

## Production-blocking unknowns

- **None `UNKNOWN`** after the freeze (validator enforces). The residual
  production-blocking items are the **7 open surface blockers (OSB-1..7)** plus
  the platform-wide blockers already tracked in
  [full-production-readiness-delta.md](full-production-readiness-delta.md)
  (missing evidence corpora, BR-6 open, OIDC incomplete).

## Recommended order (updated from the delta)

1. **Production surface freeze** — ✅ done (this pass).
2. **OIDC / credential closure (Phase 4)** — highest leverage: removes long-lived
   `AZURE_CREDENTIALS` from all production deploy paths and lets us enforce a
   deploy allow-list. Also resolves OSB-2/OSB-4 groundwork.
3. **BR-6 closure (Phase 2).**
4. **CourtLens external gate (Phase 3).**
5. **Live infra evidence → finalization corpus → flip target gates to production-blocking.**
