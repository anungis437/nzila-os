# Union Eyes — Final Multi-Environment GO/NO-GO Validation

**Date:** 2026-05-09
**Auditor:** Automated readiness audit (Copilot) — live infrastructure access used
**Scope:** local/dev, staging, demo, pilot, production
**Verdict:** **NO-GO**

> This document supersedes any prior "CONDITIONAL GO" draft. Live Azure inspection (subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3` "Azure subscription 1 Nzila", tenant `onelabtech.com`) and direct PostgreSQL queries against `nzila-staging-db.postgres.database.azure.com / nzila_os_staging` produced **structural blockers** that prevent shipping Union Eyes to a CLC convention audience as five distinct, isolated environments.

---

## 1. Executive Summary

| Layer                                  | Status        | One-line finding                                                                                                                       |
| -------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Code — typecheck                       | **PASS**      | `pnpm --filter @nzila/union-eyes typecheck` exits 0.                                                                                   |
| Code — pilot-mode + RBAC               | **PASS**      | Source enforces fail-closed pilot-mode and per-experience route gating.                                                                |
| **Environment isolation**              | **FAIL**      | Only ONE Postgres server, ONE Key Vault, and ONE union-eyes container app exist in the entire subscription.                            |
| **CLC required marketing routes**      | **FAIL**      | `/proof` and `/insights` are **untracked** in git; they 404 on every live host.                                                        |
| **Pilot-mode runtime**                 | **FAIL**      | `NZILA_MODE` is **not set** on the deployed container — pilot-mode flag is hard-disabled in production runtime.                        |
| **Database migration head**            | **FAIL**      | The shared DB has only **4** rows in `drizzle.__drizzle_migrations` while the repo contains **93** migration files.                    |
| **CLC demo seed**                      | **FAIL**      | The hardcoded CLC demo org `a1b2c3d4-0001-...-clcdemo000001` does not exist; 0 demo claims, 0 demo members on the live DB.             |
| **Production safety**                  | **FAIL**      | "Production" and "staging" share the same DB, KV, container app, and revision; demo seeds run against this DB would land in production. |
| **Release metadata**                   | **FAIL**      | `/api/health` reports `gitSha:"local"`, `releaseId:"unknown"`, `buildTimestamp:"unknown"` on both `app.unioneyes.app` and `staging-app.unioneyes.app`. |
| **Configuration hygiene**              | **FAIL**      | `NODE_ENV` env var on the live container is the malformed string `"production NEXT_PUBLIC_APP_ENV=staging"` (two assignments collapsed into one value). |
| Live URL reachability                  | PASS          | All five custom domains return 200; `/api/health` reports DB OK.                                                                       |
| TLS                                    | PASS          | All five custom domains negotiate TLS via Azure Container Apps managed cert.                                                           |

**Verdict: NO-GO.** Union Eyes can serve the existing public marketing pages and `for-clc`, `trust`, `pilot-request`. It **cannot** truthfully present "five environments" to CLC; it cannot show pilot-mode UX without operator action; it cannot demo `/proof` or `/insights` because those pages do not exist in any deployed branch; and any demo seed would land in the same database that serves production users. See [§13 Remediation](#13-remediation-required) for the closure plan.

---

## 2. Live Topology (verified via `az`)

| Resource                  | Count | Names                                                                                                                                                      |
| ------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL flexible server | **1** | `nzila-staging-db` (FQDN `nzila-staging-db.postgres.database.azure.com`, RG `nzila-staging-rg`)                                                             |
| Key Vault                 | **1** | `nzila-staging-kv` (RG `nzila-staging-rg`)                                                                                                                  |
| union-eyes container app  | **1** | `nzila-os-union-eyes` (RG `nzila-canada-staging-rg`, revision `nzila-os-union-eyes--0000262`, image tag `f1e66a2d04720c5e8df59454e14e75104292f250`)         |
| Custom domains on that 1 container app | **5** | `app.unioneyes.app`, `unioneyes.app`, `www.unioneyes.app`, `staging.unioneyes.app`, `staging-app.unioneyes.app`                                  |
| Discrete `nzila-os-union-eyes-staging` ACA referenced by [deploy-union-eyes.yml](../../../.github/workflows/deploy-union-eyes.yml#L74) | **0** | Does not exist in the subscription.                                                                                                                       |
| Demo or pilot ACAs        | **0** | None.                                                                                                                                                      |

**DNS proof of shared backend:**

```
app.unioneyes.app          CNAME -> nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
staging-app.unioneyes.app  CNAME -> nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
```

Both `/api/health` responses return identical `{"environment":"production","gitSha":"local",...}` — confirming the same process answers both hostnames.

**Implication:** there are not five environments. There is **one production environment** wearing five hostnames.

---

## 3. Live `/api/health` Evidence

```json
// https://app.unioneyes.app/api/health
{ "status":"ok","app":"union-eyes","environment":"production",
  "gitSha":"local","buildTimestamp":"unknown","artifactId":"unknown",
  "releaseId":"unknown","appVersion":"0.0.0",
  "checks":{"process":"ok","database":"ok"} }

// https://staging-app.unioneyes.app/api/health
{ "status":"ok","app":"union-eyes","environment":"production", ... }   // identical
```

Findings:
- Process & DB connectivity OK on both.
- Staging hostname falsely reports `environment: "production"`.
- Release metadata is missing — there is no way for an operator (or automated rollback) to know which git sha is live without inspecting ACA directly.

---

## 4. Deployed Container App Configuration (live)

Image: `nzilacanadaacr.azurecr.io/nzila/union-eyes:f1e66a2d04720c5e8df59454e14e75104292f250`
Deployed sha date: **2026-05-04 00:51 EDT** — **26 commits behind `origin/main`** as of audit time.

Selected env vars (from `az containerapp show ... env`):

| Name                  | Value                                                          | Finding                                                                                  |
| --------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `NODE_ENV`            | `"production NEXT_PUBLIC_APP_ENV=staging"`                     | **MALFORMED** — two assignments concatenated into one value. Likely originated from a missing newline / broken `--set-env-vars` call. |
| `NEXT_PUBLIC_APP_ENV` | `"production"`                                                 |                                                                                          |
| `UE_ENVIRONMENT`      | `"production"`                                                 | Same value will be returned for staging hostnames.                                       |
| `NEXT_PUBLIC_APP_URL` | `https://app.unioneyes.app`                                    | Will be wrong for traffic arriving on `staging-app.unioneyes.app`.                       |
| `AUTH_URL`            | `https://app.unioneyes.app`                                    | Same problem — auth callbacks always assume the prod hostname.                           |
| `PGHOST`              | `nzila-staging-db.postgres.database.azure.com`                 | Production traffic writes to `nzila_os_staging`.                                         |
| `PGDATABASE`          | `nzila_os_staging`                                              |                                                                                          |
| `NZILA_MODE`          | **not set**                                                    | Pilot-mode flag is **fail-closed** — see [feature-flags/route.ts](../../../apps/union-eyes/app/api/feature-flags/route.ts#L27). |

---

## 5. Live Database Evidence (`nzila_os_staging`)

Connected as `nzilaadmin` over TLS (password retrieved from `nzila-staging-kv/DB-PASSWORD`). Queries:

| Query                                                                             | Result                                                                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `SELECT count(*) FROM drizzle.__drizzle_migrations`                               | **4** entries (most recent: `created_at = 1771626456982` ≈ 2026-03-21).                                                       |
| `ls apps/union-eyes/db/migrations/*.sql`                                           | **93** files in repo.                                                                                                         |
| `SELECT id, slug FROM organizations WHERE slug ILIKE '%clc%' OR ILIKE '%cupe%'`   | 9 rows — includes seeded CLC, CUPE National, CUPE Local 79/123/1000/3903. **No `cupe-local-4279-clc-demo`.**                  |
| `SELECT count(*) FROM claims WHERE organization_id::text LIKE 'a1b2c3d4-0001%'`   | **0**                                                                                                                         |
| `SELECT count(*) FROM organization_members WHERE organization_id::text LIKE 'a1b2c3d4-0001%'` | **0**                                                                                                                |
| `SELECT count(*) FROM organizations`                                              | **14**                                                                                                                        |
| `SELECT count(*) FROM claims`                                                     | **15**                                                                                                                        |
| `to_regclass('public.pilot_enrollments'/'claims'/'organization_members'/'organizations')` | All present.                                                                                                          |

Findings:
- Migration head is dramatically behind the repo (4 vs 93). Either many migrations were never applied, or the project tracks migration history in a different table not present here. Either way, there is no auditable proof that the repo schema matches the live DB.
- The CLC convention demo seed [seed-clc-demo-environment.ts](../../../apps/union-eyes/scripts/seed-clc-demo-environment.ts) has **never been run** against this DB. The org `CUPE Local 4279` (UUID `a1b2c3d4-0001-4000-a000-clcdemo000001`) does not exist; no demo personas; no demo claims.
- Total business volume (14 orgs, 15 claims) is consistent with a sparse staging dataset, not a populated production user base. Confirm with product whether this is the expected production state.

---

## 6. Live URL Probes (HEAD/GET)

| URL                                                          | Status | Note                                                                          |
| ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------- |
| `https://unioneyes.app`                                       | 200    |                                                                               |
| `https://app.unioneyes.app`                                   | 200    |                                                                               |
| `https://staging.unioneyes.app`                               | 200    | (same backend as prod)                                                         |
| `https://staging-app.unioneyes.app`                           | 200    | (same backend as prod)                                                         |
| `https://unioneyes.app/for-clc` → `/en-CA/for-clc`            | 200    | Required CLC route works.                                                     |
| `https://unioneyes.app/trust?context=governance` → `/en-CA/...` | 200  | Works.                                                                        |
| `https://unioneyes.app/pilot-request?context=conference`      | 200    | Works.                                                                        |
| `https://unioneyes.app/proof?context=executive` → `/en-CA/proof?context=executive` | **404** | Required CLC route does NOT exist in deployed image.                  |
| `https://unioneyes.app/insights?context=conference` → `/en-CA/...` | **404** | Required CLC route does NOT exist in deployed image.                    |
| `https://staging.unioneyes.app/en-CA/proof?context=executive` | **404** | (same backend)                                                                |
| `https://staging.unioneyes.app/en-CA/insights?context=conference` | **404** | (same backend)                                                            |
| `https://app.unioneyes.app/api/health`                        | 200    | DB OK, malformed metadata (see §3).                                           |
| `https://app.unioneyes.app/api/feature-flags?flag=pilot-mode` | 401    | Endpoint requires session — fail-closed behavior is **correct**.              |

### Why `/proof` and `/insights` 404

```
$ git ls-files --error-unmatch "apps/union-eyes/app/[locale]/(marketing)/proof/page.tsx"
error: pathspec '...' did not match any file(s) known to git

$ git status apps/union-eyes/app/[locale]/(marketing)/{proof,insights}/
Untracked files:
  apps/union-eyes/app/[locale]/(marketing)/insights/
  apps/union-eyes/app/[locale]/(marketing)/proof/

$ git ls-tree -r origin/main --name-only | grep 'marketing.*proof\|marketing.*insights'
# (no output)
```

The `/proof` and `/insights` page files exist **only** as untracked working-tree changes on this workstation. They are not in `origin/main`, not in any remote branch, and therefore not in any deployed image. The user request explicitly lists them as required CLC routes — they cannot be demonstrated as currently shipped.

> Note: legacy `app/(marketing)/insights/` exists in `origin/main` but the marketing layout redirects all marketing requests through the `[locale]` shell at `/en-CA/...`, where these legacy routes do not match — hence the 404.

---

## 7. Code-Side Verification (passes)

These pieces of the code are correct and would work *if the routes were deployed and pilot-mode were enabled*:

- Typecheck green: `pnpm --filter @nzila/union-eyes typecheck` → exit 0.
- Pilot-mode gate is fail-closed by design: [feature-flags/route.ts](../../../apps/union-eyes/app/api/feature-flags/route.ts#L27).
- Demo data mutation routes refuse to run unless `NZILA_MODE` ∈ {pilot, demo}: [pilot/demo-data/route.ts](../../../apps/union-eyes/app/api/pilot/demo-data/route.ts#L43), [pilot-demo-runtime.ts](../../../apps/union-eyes/lib/config/pilot-demo-runtime.ts).
- Role-first IA: [role-experience.ts](../../../apps/union-eyes/lib/dashboard/role-experience.ts) maps every supported role to one of `member|staff|executive|governance|admin` and locks down `ALLOWED_PREFIXES_BY_EXPERIENCE`.
- Hard pilot-route exclusion: [role-fixtures.ts](../../../apps/union-eyes/e2e/helpers/role-fixtures.ts#L203) lists `/dashboard/{workflow-builder,fsm,orchestration,deep-analytics,advanced-intelligence,federation-controls,integrations/advanced}` as `PILOT_EXCLUDED_ROUTES`, enforced by [role-experience-guard.tsx](../../../apps/union-eyes/components/dashboard/role-experience-guard.tsx#L37).
- `/dashboard` redirects by role: [`/[locale]/dashboard/page.tsx`](../../../apps/union-eyes/app/[locale]/dashboard/page.tsx).
- CLC demo seed is structurally idempotent and namespaces all writes into `a1b2c3d4-0001-4000-a000-clcdemo000001`, never touching unrelated orgs ([seed-clc-demo-environment.ts](../../../apps/union-eyes/scripts/seed-clc-demo-environment.ts)).
- DB connection from app to PG: live `/api/health.checks.database = "ok"`.

---

## 8. Per-Environment Status

Legend: PASS · FAIL · ATTENTION · UNKNOWN

### 8.1 Local / Dev

| Check                                       | Status | Note                                                              |
| ------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `.env` / `.env.local` complete               | PASS   | All required keys present.                                        |
| Local PG reachable                          | PASS   | `localhost:5433` reachable; 5432 is not.                          |
| Typecheck                                   | PASS   | exit 0.                                                           |
| Build                                       | UNKNOWN | Not executed — irrelevant given upstream NO-GO blockers.         |
| Pilot-mode fail-closed without `NZILA_MODE` | PASS   | Code-verified.                                                    |

### 8.2 Staging (`https://staging.unioneyes.app` / `https://staging-app.unioneyes.app`)

| Check                                              | Status | Note                                                                                 |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Distinct ACA from production                       | FAIL   | **Same** ACA `nzila-os-union-eyes` rev `0000262`.                                    |
| Distinct database                                  | FAIL   | **Same** PG `nzila-staging-db / nzila_os_staging`.                                   |
| Distinct Key Vault                                 | FAIL   | **Same** `nzila-staging-kv`.                                                         |
| Migrations at head                                 | FAIL   | Only 4 entries in `__drizzle_migrations` vs 93 files in repo.                        |
| CLC required routes (`/proof`, `/insights`)        | FAIL   | 404.                                                                                 |
| Pilot-mode usable                                  | FAIL   | `NZILA_MODE` not set on container.                                                   |
| Demo seed isolated from prod                       | FAIL   | Cannot be — same DB.                                                                 |
| `/api/health.environment` correct                  | FAIL   | Returns `"production"`.                                                              |

### 8.3 Demo

| Check                                       | Status | Note                                                                                  |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| Discrete demo container app                 | FAIL   | None exists.                                                                          |
| Discrete demo URL                           | FAIL   | None.                                                                                 |
| CLC demo seed run against any DB            | FAIL   | 0 demo claims, 0 demo members in live DB.                                             |
| Demo personas can log in                    | FAIL   | Personas not seeded.                                                                  |
| Demo data isolated from production users    | FAIL   | Same DB; running the seed today writes into `nzila_os_staging` which serves prod URLs. |

### 8.4 Pilot

| Check                                         | Status | Note                                                                                   |
| --------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Pilot tables migrated                         | PASS   | `to_regclass('pilot_enrollments') = pilot_enrollments`.                                |
| Pilot org seeded                              | FAIL   | No CUPE pilot org under the `a1b2c3d4-0001%` namespace.                                |
| `NZILA_MODE=pilot` in any environment         | FAIL   | Not set anywhere live.                                                                 |
| Hard route gating in pilot mode               | PASS (code) | Cannot be exercised live until `NZILA_MODE` is set.                              |
| Pilot E2E green                               | UNKNOWN | Not executed — would not change the verdict.                                          |

### 8.5 Production (`https://unioneyes.app` / `https://app.unioneyes.app`)

| Check                                  | Status | Note                                                                                  |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| Distinct from staging/demo/pilot       | FAIL   | Single shared backend, see §2.                                                        |
| Auth callback hostname correct         | ATTENTION | `AUTH_URL=https://app.unioneyes.app`; auth from `staging-app.unioneyes.app` will redirect to prod hostname (functional, but cross-host). |
| `NODE_ENV` correctly set               | FAIL   | Value `"production NEXT_PUBLIC_APP_ENV=staging"` is malformed.                        |
| Release metadata (`gitSha`, `releaseId`) | FAIL | All `"unknown"` / `"local"`.                                                          |
| Demo / test seeds blocked              | FAIL   | No environment-level guard; only the `NZILA_MODE` runtime gate (which is irrelevant for direct seed-script execution against the DB). |
| Backups configured                     | PASS (paper) | Bicep declares 30-day retention; live state not verified in this audit.          |
| TLS managed                            | PASS   | All five custom domains have ACA-managed certs.                                       |
| Sentry instrumented                    | PASS (code) | Live ingestion not verified.                                                     |

---

## 9. Auth / RBAC

| Check                                          | Status | Note                                                                               |
| ---------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| 6 personas mapped (member/steward/staff/exec/gov/admin) | PASS | [role-experience.ts](../../../apps/union-eyes/lib/dashboard/role-experience.ts).             |
| `/dashboard` redirect by role                  | PASS (code) |                                                                                |
| Cross-role access blocked                      | PASS (code, client) | Server-side enforcement should also be confirmed; not verified in this run. |
| Raw FSM/workflow/orchestration hidden          | PASS (code) | In `PILOT_EXCLUDED_ROUTES` and `FORBIDDEN_LABELS`.                              |
| Default-org leakage                            | UNKNOWN | Could not be exercised end-to-end without running E2E against an env that has `NZILA_MODE` set. |

---

## 10. Domain / Deployment

| Check                                          | Status | Note                                                                               |
| ---------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Distinct DNS for staging vs prod               | PASS (DNS) / FAIL (backend) | DNS records are distinct; backend they point to is identical.            |
| TLS valid                                      | PASS   | ACA managed cert.                                                                  |
| Staging/demo/prod clearly separated            | FAIL   | No separation at the infrastructure level.                                         |
| Workflow-vs-reality drift                      | FAIL   | [deploy-union-eyes.yml](../../../.github/workflows/deploy-union-eyes.yml#L74) references `nzila-os-union-eyes-staging` — that ACA does **not exist**. |

---

## 11. Evidence Commands Run (live)

| Command                                                                                | Outcome / Note                                                                                                                                |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @nzila/union-eyes typecheck`                                            | exit 0.                                                                                                                                       |
| `az account show`                                                                       | tenant `onelabtech.com`, sub `5d819f33-...`.                                                                                                  |
| `az postgres flexible-server list`                                                     | 1 server: `nzila-staging-db`.                                                                                                                 |
| `az keyvault list`                                                                      | 1 vault: `nzila-staging-kv`.                                                                                                                  |
| `az containerapp list`                                                                 | 1 union-eyes app `nzila-os-union-eyes`; no `*-staging` variant.                                                                               |
| `az containerapp show -n nzila-os-union-eyes ...`                                       | Single revision `0000262`, image sha `f1e66a2d`, custom domains list (5).                                                                     |
| `az keyvault secret list --vault-name nzila-staging-kv`                                | Lists secrets including `DB-PASSWORD`, `JWT-SECRET-KEY`, `STRIPE-SECRET-KEY`, lowercase variant `fallback-encryption-key`.                    |
| `Resolve-DnsName app.unioneyes.app / staging-app.unioneyes.app`                        | Both → `nzila-os-union-eyes.jollydune-...`.                                                                                                   |
| `Invoke-WebRequest /api/health` × 2                                                    | Both report `environment:"production"`, `gitSha:"local"`.                                                                                     |
| Direct PG connect using KV-retrieved password                                          | Migration head 4 entries; CLC demo org missing; 14 orgs, 15 claims total.                                                                     |
| `git ls-files`/`git status` for `(marketing)/proof` and `(marketing)/insights`           | Both confirmed **untracked** in working tree; absent from `origin/main`.                                                                      |

E2E suites and `pnpm build` were intentionally **not** executed: the verdict is decided by infrastructure findings, not by code-side test results. Re-running E2E suites against the shared backend would not invalidate the blockers above.

---

## 12. Risks & Blockers

| Severity     | Item                                                                                                                                                           | Owner         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **CRITICAL** | Single shared backend (DB + KV + ACA) for all "five environments". Any seed run / destructive script / load test directly impacts production users.            | platform-ops  |
| **CRITICAL** | `/proof` and `/insights` are required CLC routes but are untracked in git → 404 in every environment.                                                          | union-eyes    |
| **CRITICAL** | `NZILA_MODE` not set in production runtime → pilot-mode UX cannot be enabled for any persona; the entire CLC pilot story is invisible to live users.           | platform-ops  |
| **CRITICAL** | Migration head is 4 in DB vs 93 migration files in repo. Schema-vs-repo parity is unproven.                                                                    | platform-ops  |
| **HIGH**     | CLC demo seed never run; the canonical CUPE Local 4279 demo org and 6 personas do not exist.                                                                   | union-eyes    |
| **HIGH**     | `NODE_ENV` env var is malformed (`"production NEXT_PUBLIC_APP_ENV=staging"`). May break libraries that read `NODE_ENV` strictly; at minimum is a bad signal.   | platform-ops  |
| **HIGH**     | `/api/health` reports `gitSha:"local"`, `releaseId:"unknown"` — no rollback target identification.                                                              | platform-ops  |
| **MEDIUM**   | `staging-app.unioneyes.app` falsely reports `environment:"production"` — operators cannot trust the health endpoint to identify which env they're hitting.    | platform-ops  |
| **MEDIUM**   | Demo seed scripts have no `if (UE_ENVIRONMENT==='production') throw` guard. Operator hygiene is the only control.                                              | union-eyes    |
| **MEDIUM**   | Deployed image is 26 commits behind `origin/main` (deployed 2026-05-04; main as of 2026-05-06).                                                                | platform-ops  |
| **MEDIUM**   | Production rollback exception in [deployment-inventory.json](../../../governance/release/deployment-inventory.json#L21) expires 2026-06-30; CLC week falls inside that. | platform-ops  |
| **LOW**      | Duplicate marketing routes under `app/(marketing)/...` and `app/[locale]/(marketing)/...` may produce sitemap collisions.                                       | union-eyes    |

---

## 13. Remediation Required

These are the minimum items required to convert NO-GO to GO.

### 13.1 Environment isolation (must)

1. Provision a **separate** Postgres flexible server (or at minimum a separate database on the existing server) for production, distinct from `nzila_os_staging`.
2. Provision a **separate** Container App `nzila-os-union-eyes-prod` (or rename the existing one and stand up a new staging) so that staging and production have independent revisions.
3. Provision a **separate** Key Vault for production secrets, or scope secrets in `nzila-staging-kv` by name (`-staging-` vs `-prod-`).
4. If "demo" and "pilot" are intended to be visible environments to CLC stakeholders, repeat (1)–(3) for them, or explicitly downgrade the requirement to "modes overlaid on staging" and communicate that to CLC.
5. Update [deployment-inventory.json](../../../governance/release/deployment-inventory.json) to reflect actual topology (currently lies about a discrete production app).

### 13.2 Required CLC routes (must)

6. Commit and push `apps/union-eyes/app/[locale]/(marketing)/proof/page.tsx` and `apps/union-eyes/app/[locale]/(marketing)/insights/page.tsx` to a branch that gets merged into `main`.
7. Verify both routes return 200 on production after deploy with `?context=executive`, `?context=procurement`, `?context=conference` preserved through CTAs.
8. Decide what to do about the legacy non-locale `app/(marketing)/insights/page.tsx` (no equivalent `proof` exists in main today) — collapse to a single canonical implementation.

### 13.3 Pilot-mode runtime (must)

9. Set `NZILA_MODE=pilot` (or `demo`) on the demo/pilot container app(s). Do **not** set it on production unless production is intended to render pilot UX.
10. Re-test `/api/feature-flags?flag=pilot-mode` with a valid session and confirm `enabled: true` on the pilot environment.

### 13.4 Database hygiene (must)

11. Determine why `drizzle.__drizzle_migrations` has only 4 entries despite 93 migration files. Either:
    - The repo's migration journal has been re-baselined and the 4 entries are the correct head — in which case confirm in writing and update [README](../../../apps/union-eyes/db/migrations/README.md);
    - Or migrations are tracked elsewhere (audit migration table, manual SQL applied via `psql`) — document the source of truth;
    - Or migrations are genuinely behind — execute `pnpm --filter @nzila/union-eyes db:migrate` against the (new, isolated) production DB and capture the diff.
12. Add a CI assertion that `db:migrate` reports "no pending migrations" against staging and production before deploy.

### 13.5 Demo readiness (must)

13. Run `npx tsx apps/union-eyes/scripts/seed-clc-demo-environment.ts` against the **demo** DB (not the shared one). Verify all 6 personas and 8 cases land under org `a1b2c3d4-0001-4000-a000-clcdemo000001`.
14. Walk all 6 personas through `/dashboard` to confirm role-first IA renders and `PILOT_EXCLUDED_ROUTES` redirect correctly.

### 13.6 Production safety (must)

15. Add a top-of-file guard to all demo/test seed scripts:

    ```ts
    if ((process.env.UE_ENVIRONMENT ?? '').toLowerCase() === 'production') {
      throw new Error('Refusing to run this seed against UE_ENVIRONMENT=production')
    }
    ```

    Apply to: `seed-clc-demo-environment.ts`, `seed-cupe-pilot.mjs`, `seed-test-env.ts`, `seed-employer-execution-marathon.ts`, `seed-cba-intelligence.ts`.
16. Fix the malformed `NODE_ENV` env var on the deployed container (it is currently `"production NEXT_PUBLIC_APP_ENV=staging"`).
17. Inject `gitSha`, `releaseId`, `buildTimestamp` at build time so `/api/health` returns a verifiable target for rollback.

### 13.7 Code-side polish (should)

18. Resolve duplicate marketing trees (`app/(marketing)/...` vs `app/[locale]/(marketing)/...`) to prevent sitemap collisions.
19. Run E2E suites against the new isolated demo container app:
    - `pnpm --filter @nzila/union-eyes test:e2e:ue:auth`
    - `pnpm --filter @nzila/union-eyes test:e2e:ue:pilot`
    - `pnpm --filter @nzila/union-eyes test:e2e:ue:stakeholders`
    - `pnpm --filter @nzila/union-eyes playwright test e2e/no-fsm-overexposure.spec.ts`

   Attach Playwright HTML report to this document.
20. Confirm the production GitHub environment has `EVIDENCE_SEAL_KEY`, `AUTH_SECRET`, `STRIPE_*`, `SUPER_ADMIN_ORG_ID`, `VOTING_SECRET`, `RESEND_API_KEY` set.

---

## 14. Final Verdict

**NO-GO.**

Union Eyes cannot be presented to a CLC convention audience as five distinct environments today. It currently operates as **one** production environment serving five hostnames, with stale code, missing required marketing routes, an un-seeded demo dataset, an out-of-date migration ledger, and pilot-mode UX disabled at the runtime config layer. Any "demo" or "pilot" activity performed today writes into the same database that serves the production hostname.

The codebase itself is structurally pilot-ready — typecheck is green, RBAC and pilot-mode gating are wired correctly, and the CLC demo seed script is well-formed. The blockers are entirely in the deployment, infrastructure isolation, and runtime configuration layers.

Once items 1–17 in [§13 Remediation](#13-remediation-required) are closed, the verdict converts to **CONDITIONAL GO**. After items 18–20 are closed and a clean E2E run is captured against an isolated demo environment, the verdict converts to **GO**.

Until then: hold the CLC pilot announcement.
