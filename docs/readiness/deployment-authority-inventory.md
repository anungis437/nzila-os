# Deployment Authority Inventory (Phase 4A)

- **As of:** 2026-07-03 · Commit base `0e95c11`
- **Validator:** `pnpm validate:production-deploy-authority` → `tooling/scripts/validate-production-deploy-authority.mjs`
- **Surface authority:** [`governance/readiness/production-surface.json`](../../governance/readiness/production-surface.json)
- **Policy resolver:** `scripts/release/resolve-deploy-apps.ts`

> This pass removed one real class of danger — the long-lived `AZURE_CREDENTIALS`
> fallback in every workflow that still carried it. Remaining items are **real
> owner-policy blockers**, surfaced honestly (advisory), not force-passed.

## Credential change landed

Removed the live `creds: ${{ secrets.AZURE_CREDENTIALS }}` fallback step from **4
workflows** and replaced each with a fail-closed OIDC guard (`exit 1` if OIDC env
is unset): `deploy-web.yml`, `deploy-console.yml`, `deploy-partners.yml`,
`retire-legacy-union-eyes-ca.yml`. After this change **no workflow references
`secrets.AZURE_CREDENTIALS`** (verified). The other workflows that mentioned it
(`canary-deploy`, `deploy-union-eyes`, `gitops-deploy`, `br5-proof-deploy-staging`)
only did so in explanatory comments — those paths were already OIDC-only.

## Deploy workflow authority table

| Workflow | Trigger | Prod authority | Credential | App selection | Env approval | Digest-pinned | Allow-list | Bypass risk | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deploy-production | dispatch + push(tag) | Yes | OIDC | `apps` input → resolver | `environment:` | Yes (artifact+SBOM+attestation) | resolve-deploy-apps.ts | zonga_prod_override (OSB-4) | BOUNDED (policy admits internal-only) |
| gitops-deploy | push + dispatch | Yes | OIDC (env-scoped) | `apps` → plan→resolver | per-env | build artifact | resolve-deploy-apps.ts | — | BOUNDED |
| canary-deploy | dispatch | Yes | OIDC (prod env) | fixed `options` | `environment: production` | tag | hardcoded list incl. console | offers INTERNAL_ONLY console (V5) | **BLOCKED** |
| deploy-web | dispatch | Yes | **OIDC (fallback removed)** | fixed | none | tag | — | fail-closed if no OIDC | OIDC-only |
| deploy-console | dispatch | Internal | **OIDC (fallback removed)** | fixed | none | tag | — | console is INTERNAL_ONLY | OIDC-only |
| deploy-partners | dispatch | Yes | **OIDC (fallback removed)** | fixed | none | tag | — | fail-closed | OIDC-only |
| deploy-union-eyes | push + dispatch | Yes | OIDC (env-scoped) | fixed | per-env | tag | — | — | OIDC-only |
| auto-promote-union-eyes | push | dispatch-only | none (dispatches) | fixed | matrix envs | n/a | — | — | OIDC-only |
| deploy-staging | dispatch (emergency) | No (staging) | OIDC | `apps` → resolver | `environment: staging` | build | resolve-deploy-apps.ts | emergency ack | OK |
| preview-deploy | pull_request | No | none | n/a | none | n/a | — | ephemeral | OK |
| br5-proof-deploy-staging | dispatch | No (staging proof) | OIDC (env-scoped) | `app` input | `environment:` | n/a | — | TEST_ONLY proof | OK (non-prod) |
| retire-legacy-union-eyes-ca | dispatch | Yes (`environment: production`) | **OIDC (fallback removed)** | fixed | `environment: production` | n/a | — | completed retirement op | OIDC-only; consider disabling |

## Deploy-authority policy status (Phase 4B)

```
DEPLOYMENT AUTHORITY POLICY: CLOSED
pnpm validate:production-deploy-authority → EXIT 0
```

Production-eligible set is now `{union-eyes, web, partners}` (all PILOT, external, tier-1).

### Closed in Phase 4B

- **V2 (console/control-plane INTERNAL_ONLY prod-eligible):** `prodPromotionEligible: false`
  in `deployment-inventory.json` + `resolve-deploy-apps.ts` production branch no
  longer admits `internal-only`. They deploy via their dedicated internal workflow.
- **V3 (5 expired exceptions):** replaced by structured, non-expired exceptions in
  `governance/release/production-exceptions.json` (owner + expiry 2026-09-30 + scope
  + rollback plan + explicit "PILOT, not full-production" limitation, PROVISIONAL).
  Validator now requires a complete, non-expired structured exception per prod-eligible app.
- **V5 (canary offers console):** `nzila-os-console` removed from `canary-deploy.yml` options.

### Digest-pinning classification (4B.6)

```
Production promotion (deploy-production.yml): PROVEN_FOR_PRODUCTION_PROMOTION
App-specific deploys (deploy-web/console/partners/union-eyes, canary):     PARTIALLY_PROVEN
```

`deploy-production.yml` consumes a verified staging artifact (artifact-manifest +
SBOM + release-attestation + `subject-digest: sha256`). The app-specific deploy
workflows still deploy by image **tag**; confirming they consume the digest-pinned
promoted artifact is `EXTERNAL VERIFICATION REQUIRED` and tracked as a remaining
(non-4B) blocker.

## Remaining (external, not deploy-authority policy)

- **OSB-2 (Critical):** production shares resource group + container-app environment
  with staging — `EXTERNAL IMPLEMENTATION REQUIRED` (Azure-side).
- **OIDC federation existence** — `EXTERNAL VERIFICATION REQUIRED`.
- **Pilot exceptions PROVISIONAL** — require platform-ops re-attestation before 2026-09-30.
