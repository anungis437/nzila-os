# Production Surface Inventory (Phase -1 Freeze)

**Authoritative machine manifest:** [`governance/readiness/production-surface.json`](../../governance/readiness/production-surface.json)
**Validator:** `pnpm validate:production-surface` → `tooling/scripts/validate-production-surface.mjs`
**Verdict source:** [production-certification.md](production-certification.md)

- **As of:** 2026-07-03
- **Commit:** `0e95c11438b21fe801e624256b01930921c065a6`
- **Surface status:** `FROZEN` (every app + workflow classified; no `UNKNOWN`)
- **PRODUCTION apps declared:** **0**

> This inventory is the production-surface freeze required before closing
> individual blockers (BR-6, OIDC, CourtLens). It is derived from repo truth
> (`nzila-truth-manifest.json`, `governance/release/deployment-inventory.json`,
> `governance/foundations/rollout/environments.json`) — not fabricated. The
> single most important fact: **no application is classified `PRODUCTION`**; the
> highest declared maturity is `pilot`. Production certification therefore
> currently applies to an empty PRODUCTION set.

## Classification enum

`PRODUCTION` · `PILOT` · `DEMO` · `INTERNAL_ONLY` · `RETIRED` · `TEST_ONLY` · `UNKNOWN`

`UNKNOWN` is production-blocking. `TEST_ONLY`/`RETIRED` may have no active deploy
path. `INTERNAL_ONLY` may not be publicly navigable or hold a public domain.
`DEMO` may not touch production data. `PILOT` may not touch production data
without an explicit approval reference. `PRODUCTION` requires owner + deploy path
+ domains + route classification + gate coverage.

## Apps (26)

| App | Class | Maturity | Deploy workflow(s) | Public domains | Notes |
| --- | --- | --- | --- | --- | --- |
| union-eyes | PILOT | pilot | deploy-union-eyes, auto-promote, canary | unioneyes.app (+app/demo/pilot) | prod-approved conflict (OSB-1); rollback exception expired (OSB-3) |
| abr (CourtLens) | PILOT | pilot | — | — | external demo BLOCKED (Phase 3) |
| flow | PILOT | pilot | gitops-deploy | — | shopmoica cutover gate |
| cfo | PILOT | pilot | gitops-deploy | — | |
| partners | PILOT | pilot | deploy-partners, canary | — | AZURE_CREDENTIALS (Phase 4) |
| web | PILOT | pilot | deploy-web, canary | (public) | AZURE_CREDENTIALS (Phase 4) |
| zonga | PILOT | pilot | deploy-production (override) | — | zonga_prod_override (OSB-4) |
| console | INTERNAL_ONLY | internal | deploy-console, canary | — | in canary w/ external apps (OSB-5) |
| control-plane | INTERNAL_ONLY | internal | — | — | |
| orchestrator-api | INTERNAL_ONLY | internal | — | — | |
| nzila-hq | INTERNAL_ONLY | incubating | — | — | |
| trustcore | INTERNAL_ONLY | incubating | — | — | |
| trustcore-trustops | INTERNAL_ONLY | incubating | — | — | |
| agrimo | INTERNAL_ONLY | incubating | — | — | |
| cora | INTERNAL_ONLY | incubating | — | — | |
| maestria | INTERNAL_ONLY | incubating | — | — | |
| mobility | INTERNAL_ONLY | incubating | — | — | |
| nacp-exams | INTERNAL_ONLY | incubating | — | — | |
| trade | INTERNAL_ONLY | incubating | — | — | |
| veridian-admin | INTERNAL_ONLY | incubating | — | — | |
| veridian-care | INTERNAL_ONLY | incubating | — | — | |
| veridian-site | INTERNAL_ONLY | incubating | — | — | name implies public site (OSB-6) |
| weekone | RETIRED | frozen | — | — | no deploy path |
| mobility-client-portal | RETIRED | frozen | — | — | no deploy path |
| platform-admin | RETIRED | frozen | — | — | no deploy path |
| test-scaffold-gp | TEST_ONLY | frozen | — | — | scaffold; never deployable |

**Counts:** PILOT 7 · INTERNAL_ONLY 15 · RETIRED 3 · TEST_ONLY 1 · PRODUCTION 0 · DEMO 0 · UNKNOWN 0.

## Workflows (52)

Classified in full in the manifest. Summary by role:

- **Production deploy** (`PRODUCTION`): `deploy-production.yml`, `gitops-deploy.yml`, `canary-deploy.yml` — all use long-lived `AZURE_CREDENTIALS` (Phase 4 blocker).
- **App/pilot deploy** (`PILOT`/`INTERNAL_ONLY`): `deploy-web`, `deploy-partners`, `deploy-union-eyes`, `auto-promote-union-eyes`, `deploy-console`, `deploy-staging`, `preview-deploy`.
- **Proof / test** (`TEST_ONLY`): `br5-proof-deploy-staging.yml`, `build-identity-proof.yml` — must not act as normal production signals.
- **Retirement op** (`RETIRED`): `retire-legacy-union-eyes-ca.yml`.
- **Governance / CI / security / ops** (`INTERNAL_ONLY`): the remaining ~38 workflows (ci, compliance, sbom, trivy, dast, red-team, secret-scan, governance gates, etc.).

## Environments

| Env | Class | Note |
| --- | --- | --- |
| local | TEST_ONLY | no institutional data, no promotion target |
| dev | INTERNAL_ONLY | shared dev integration |
| staging | PILOT | nzila-canada-staging-rg / -env |
| demo | DEMO | must not touch production data (OSB-7) |
| pilot | PILOT | sovereign nzila-canada-pilot-db |
| production | PRODUCTION | **shares RG + CA env with staging (OSB-2)** |

## Validator rules (all enforced, exit 1 on violation)

1. Every `apps/*` classified · 2. Every workflow classified · 3. No `UNKNOWN` ·
4. Enum-valid · 5. `RETIRED`/`TEST_ONLY` have no deploy path · 6. `INTERNAL_ONLY`
not public · 7. `DEMO` no production data · 8. `PILOT`+prod-data needs approval
ref · 9. `PRODUCTION` needs owner/deploy/domains/routeClassification/gateCoverage
· 10. Every app has an owner · 11. No deploy workflow targets `RETIRED`/`TEST_ONLY`.

Proven non-rubber-stamp: injecting one `UNKNOWN` yields
`PRODUCTION SURFACE: NOT FROZEN` exit 1; reverting restores exit 0.

## What remains before this becomes production-blocking in `final:go`

- Resolve open blockers **OSB-1..OSB-7** (see [risk summary](production-surface-risk-summary.md)).
- Add per-route classification + gate coverage for any app promoted to `PRODUCTION`.
- Prove demo/pilot data isolation with an executable check.
- Then flip `validate-production-surface` to `production-blocking` in
  `governance/gates/gate-authority-registry.json` and wire it into a release gate.
