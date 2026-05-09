# 01 — Full Environment Inventory Audit

**Authority:** Canonical environment truth layer.
**Scope:** Inventory every live Nzila OS environment with operational honesty.
**Source anchors:** `governance/release/domain-routing-registry.json`,
`tooling/scripts/validate-rollout-legitimacy.mjs`,
`.github/workflows/gitops-deploy.yml`,
`infrastructure/gitops/environments/*.yml`.

---

## 1. Canonical Environment Tiers

The promotion lineage is defined in [tooling/scripts/validate-rollout-legitimacy.mjs](../../tooling/scripts/validate-rollout-legitimacy.mjs#L32):

```
const REQUIRED_TIERS = ['local', 'dev', 'staging', 'demo', 'pilot', 'prod'];
```

| Tier      | Purpose                                              | Audit Treatment                  |
|-----------|------------------------------------------------------|----------------------------------|
| `local`   | Developer laptop                                     | Out of scope (no live runtime)   |
| `dev`     | Ephemeral developer-shared environment               | `DEFERRED` — see §2              |
| `staging` | Canada Central ACA — pre-prod integration tier       | `LIVE` — see §3                  |
| `demo`    | Demo-isolated tenancy on staging fabric              | `STAGING-ONLY` — see §4          |
| `pilot`   | Customer pilot tenants (UE: CUPE pilot)              | `STAGING-ONLY` — see §5          |
| `prod`    | Customer production tenants                          | `RESERVED` (per app) — see §6    |

> **Operational honesty note:** As of this audit, only `staging` is fully
> materialized as a deployed Azure subscription tier. `dev`, `demo`, and
> `pilot` reuse staging fabric with logical isolation. `prod` exists as
> reserved domains and frozen `release` lineage; no production traffic flows.

---

## 2. dev — `DEFERRED`

| Attribute            | Value                                                          |
|----------------------|----------------------------------------------------------------|
| Resource group       | `nzila-canada-development-rg` (planned, not provisioned)       |
| Container Apps env   | `nzila-canada-development-env` (planned, not provisioned)      |
| Region               | Canada Central                                                 |
| Status               | `DEFERRED` — Devs run `pnpm dev` locally; ephemeral PR previews not implemented |
| Workflow             | `.github/workflows/gitops-deploy.yml` accepts `development` input but no live targets exist in RG |
| Auth                 | Local `nzila_dev` Postgres + `AUTH_SECRET=test-auth-secret`    |

**Gap:** No always-on dev environment. Deferred until customer demand justifies cost.
**Mitigation:** `pnpm dev` + Docker compose (docker-compose.yml) provides equivalent fidelity locally.

---

## 3. staging — `LIVE`

Authoritative ACA fabric.

| Attribute            | Value                                                          |
|----------------------|----------------------------------------------------------------|
| Resource group       | `nzila-canada-staging-rg`                                      |
| Container Apps env   | `nzila-canada-staging-env`                                     |
| Region               | `canadacentral`                                                |
| Default ACA domain   | `jollydune-88c1e97f.canadacentral.azurecontainerapps.io`       |
| ACR                  | `nzilacanadaacr.azurecr.io`                                    |
| Database             | `nzila-staging-db` (PostgreSQL Flexible, Canada Central, lives in `nzila-staging-rg`) |
| Key Vault            | `nzila-staging-kv` (in `nzila-staging-rg`)                     |
| Storage              | `nzilacanadastore` (containers: backups, documents, exports, media, evidence) |
| Cache                | None (Redis removed 2026-04-05; apps confirmed no-Redis-required) |
| Auth                 | `@nzila/platform-auth` (Argon2id PG sessions + Entra SSO)      |
| Telemetry            | App Insights (per app), Sentry (UE, Zonga)                     |

### Deployed Container Apps (verified live)

| App                  | Container App name              | Health endpoint                    | Status   |
|----------------------|----------------------------------|------------------------------------|----------|
| web                  | `nzila-os-web`                  | `/api/health`                      | `LIVE`   |
| console              | `nzila-os-console`              | `/`                                | `LIVE`   |
| union-eyes           | `nzila-os-union-eyes`           | `/api/auth_core/health/`           | `LIVE`   |
| zonga                | `nzila-os-zonga`                | `/api/health`                      | `LIVE`   |
| partners             | `nzila-os-partners`             | `/`                                | `PARTIAL` (last verified 404; root route incomplete) |

### Container Apps registered but not yet returning 200

| App                  | Status           | Reason                                          |
|----------------------|------------------|-------------------------------------------------|
| control-plane        | `RESERVED`       | Container app exists; image not yet promoted    |
| platform-admin       | `RESERVED`       | Release status `frozen` per registry            |
| flow                 | `STAGING-ONLY`   | Release status `staging-only`                   |
| cfo                  | `STAGING-ONLY`   | Release status `staging-only`                   |
| abr (FairCase)       | `BLOCKED`        | Release status `blocked` per registry           |
| orchestrator-api     | `STAGING-ONLY`   | Release status `staging-only`                   |
| agrimo               | `STAGING-ONLY`   | Release status `staging-only`                   |
| cora                 | `RESERVED`       | Release status `incubating`                     |
| trade                | `RESERVED`       | Release status `incubating`                     |
| mobility             | `STAGING-ONLY`   | Release status `staging-only`                   |
| mobility-client-portal | `RESERVED`     | Not in routing registry                         |
| nacp-exams           | `RESERVED`       | Not in routing registry                         |

**Source:** [governance/release/domain-routing-registry.json](../../governance/release/domain-routing-registry.json)

---

## 4. demo — `STAGING-ONLY`

| Attribute   | Value                                                                  |
|-------------|------------------------------------------------------------------------|
| Tenancy     | Demo orgs seeded into staging DB via `pnpm --filter @nzila/union-eyes seed:test-env` |
| Isolation   | Logical (org_id) only — no separate Azure subscription                 |
| URL         | Same as staging (`staging.unioneyes.app`, etc.)                        |
| Status      | `STAGING-ONLY` — demo is a seeded persona pattern on staging fabric    |
| Risk        | If staging is corrupted, demo is corrupted                             |
| Mitigation  | Demo seed scripts are idempotent and re-runnable                       |

---

## 5. pilot — `STAGING-ONLY` (CUPE)

| Attribute   | Value                                                                  |
|-------------|------------------------------------------------------------------------|
| Workflow    | `.github/workflows/cupe-pilot-readiness.yml`                           |
| Targeted org | CUPE pilot tenant (logical org on staging fabric)                     |
| Evidence    | `apps/union-eyes/evidence-artifacts/` per-SHA manifests                |
| Status      | `STAGING-ONLY` — no separate pilot Azure environment provisioned       |
| Promotion path | Pilot evidence → `proof-artifacts/finalization/certifications/` |

---

## 6. prod — `RESERVED`

Production is **declared** by domain reservation in
[governance/release/domain-routing-registry.json](../../governance/release/domain-routing-registry.json)
but is **not** an actively-serving Azure tier.

| App        | Production host              | DNS Status                  | ACA binding         |
|------------|------------------------------|-----------------------------|---------------------|
| web        | `www.nzilaventures.com`      | `active`                    | `active`            |
| union-eyes | `app.unioneyes.app`          | `active`                    | `active`            |
| partners   | `partners.nzilaventures.com` | `active`                    | `active`            |
| console    | `console.nzilaventures.com`  | `active`                    | `active`            |
| zonga      | `zonga.nzilaventures.com`    | `active`                    | `tls-cert-provisioning` |
| All others | various                      | `pending-manual-cloudflare` | `not-yet-bound`     |

**Operational reality:** Production hosts share the staging container apps via
custom-domain bindings on the staging ACA environment. There is **one** Azure
subscription tier; "prod" is the customer-facing DNS face of the staging fabric
for apps that have completed their custom-domain TLS provisioning.

> **Verdict:** Calling staging "production" once a custom domain is bound is
> consistent with the rollout-attestation discipline, but the audit must record
> that there is no separate prod resource group, no separate prod database, and
> no separate prod ACR. This is a **conscious DEFERRED** decision documented
> here for procurement transparency.

---

## 7. Environment Lineage Map

```
                  ┌──────────────┐
                  │   local      │  pnpm dev / docker-compose
                  └──────┬───────┘
                         │ git push
                         ▼
                  ┌──────────────┐
                  │   staging    │  Canada Central ACA
                  │  (LIVE)      │  nzila-canada-staging-{rg,env}
                  └──┬───────┬───┘
                     │       │
        custom-domain│       │seed
                     ▼       ▼
              ┌──────────┐ ┌──────┐ ┌────────┐
              │  prod    │ │ demo │ │ pilot  │
              │(RESERVED)│ │(STG) │ │ (STG)  │
              └──────────┘ └──────┘ └────────┘
```

**`dev` is intentionally absent from the runtime lineage** — local replaces it.

---

## 8. Environment Legitimacy Map

| Tier      | Provisioned | Reachable | Isolated  | Restorable | Verdict          |
|-----------|-------------|-----------|-----------|------------|------------------|
| local     | n/a         | n/a       | per-dev   | n/a        | LEGITIMATE       |
| dev       | NO          | NO        | n/a       | n/a        | DEFERRED         |
| staging   | YES         | YES       | YES       | YES (PITR) | LEGITIMATE       |
| demo      | shared      | YES       | logical   | YES        | LEGITIMATE-SHARED |
| pilot     | shared      | YES       | logical   | YES        | LEGITIMATE-SHARED |
| prod      | DNS-only    | partial   | shared    | shared     | LIMITED-LEGITIMATE |

---

## 9. Unresolved Environment Gaps

| Gap                                                  | Severity | Owner               | Mitigation Plan                          |
|------------------------------------------------------|----------|---------------------|------------------------------------------|
| No separate `dev` Azure tier                         | Low      | platform-admin      | Local-first; add when customer demand    |
| `prod` shares staging fabric (no separate RG)        | Medium   | platform-admin      | Documented; revisit at first paid pilot  |
| 18 CNAME records pending manual Cloudflare creation  | Medium   | platform-admin      | See URL audit §5 for the explicit list   |
| `partners` root route returns 404                    | Medium   | partners-engineering | Tracked; not blocking governance gates  |
| `platform-admin` release `frozen`                    | Low      | platform-admin      | Intentional; access via Console           |
| `abr` (FairCase) release `blocked`                   | High     | abr-engineering     | Doctrine realignment in flight (`docs/nzila-cognition-doctrine/faircase-governance-realignment.md`) |
| No separate ACR for prod                             | Low      | platform-admin      | Single ACR with image-tag promotion only |

---

**Verdict for §1:** Environment inventory is **operationally honest** — staging
is the only live tier, `dev`/`demo`/`pilot`/`prod` are accurately characterized
above their own facade, and the gaps are explicitly catalogued.
