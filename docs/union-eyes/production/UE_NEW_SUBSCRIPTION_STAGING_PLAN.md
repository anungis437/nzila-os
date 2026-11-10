# Union Eyes — staging on the new Azure subscription (plan)

> **Status: plan, nothing provisioned.** Written 2026-11-04 from read-only inventories of both
> subscriptions. No Azure resource was created, changed or deleted, and no secret or database was read.
> Decisions D1–D8 were adopted by the New Azure Subscription Migration Directive (product owner and
> release authority, 2026-11-04), which authorizes staging preparation and, after security review and
> an approved change record, isolated staging provisioning only. Cost efficiency is a requirement (§6).

```
UE_SAAS_OPERATIONAL_READINESS      = NO_GO — RUNTIME_PROOF_REQUIRED   (file 25; unchanged)
UE_RUNTIME_RLS_TENANT_ISOLATION    = FAIL (deployed, old subscription)  (files 29, 30; unchanged)
UE_V2_CANONICAL_FRESH_BOOTSTRAP    = UNQUALIFIED                        (file 30; unchanged)
PRODUCTION_DEPLOYMENT_AUTHORIZED   = NO
CUSTOMER_DATA_EXECUTION_AUTHORIZED = NO
```

This plan extends [README.md](./README.md) (V2 production hardening) and
[RUNBOOK_DATABASE_BOOTSTRAP.md](./RUNBOOK_DATABASE_BOOTSTRAP.md). It covers one thing those documents
do not: standing up a **Union Eyes staging environment on the new subscription**, so that the runtime
proofs in file 25 §6 can finally run against infrastructure that production will also use.

## 1. Where things stand (inventory, 2026-11-04)

**New subscription** `d562ba7f-d891-4504-a489-10917c0ebaaf` (tenant `cc15259a-…`, "Default Directory"):

| Resource                                         | State                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `nzila-canada-prod-rg` (Canada Central)          | only resource group                                                              |
| `nzila-canada-prod-env`                          | Container Apps environment: no VNet, not zone-redundant, Consumption profile     |
| `nzila-os-web-prod`                              | public web site (`nzilaventures.com`, `www.`), pinned by digest, min replicas 0  |
| `nzilaventuresacr`                               | registry: **Basic**, public network access, admin disabled; only `nzila/web`     |
| `nzila-canada-prod-law`                          | Log Analytics workspace                                                          |
| Union Eyes                                       | **nothing** (no app, database, vault, storage, Redis, action group or identity)  |

**Old subscription** `5d819f33-…` (tenant `5082b8be-…`) still runs every Union Eyes environment:

| App                                | Observed                                                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nzila-os-union-eyes-prod`         | running, 2 replicas, `/api/ready` 200; source `c890d1a2` (2026-10-05), **without** #948 and #981; app FQDN publicly reachable, no IP rules, no probes; `app.unioneyes.app` fails TLS (certificate name mismatch at Front Door) |
| `nzila-os-union-eyes-prod-db`      | PG 16, zone-redundant, 30-day PITR, geo backup, public access, `AllowAllAzureServices`                                                                                             |
| `nzila-os-union-eyes-staging`      | multiple-revision mode; serving revision is a maintenance page (503); candidate `ue-rec-eacaa2e720` runs at 0% traffic **with** the Django backend (gate `UE-C-REVISION-ISOLATION`) |
| `nzila-staging-db`                 | PG 15, public, three operator IP rules from September; restored copy `nzila-ue-recovery-20261022` also exists                                                                      |
| pilot, django-pilot, demo, v2-staging | scaled to zero, except django-pilot (running at 0% traffic, internal, `allowInsecure`, image by tag)                                                                           |

## 2. Decisions needed before anything is provisioned

| ID  | Decision                                                                                                   | Recommendation                                                                                                                                                                     | Owner                     |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| D1  | Staging topology                                                                                           | New `nzila-canada-staging-rg` in the new subscription, deployed from `infrastructure/bicep/ue-v2/main.bicep` with `env=staging` (its own VNet, Container Apps environment, vault, storage, Redis, PostgreSQL). Do not share the prod environment. | Platform engineer         |
| D2  | Registry (README R-6)                                                                                      | Upgrade `nzilaventuresacr` to **Premium** (private endpoint, retention) and keep one registry, promoting by digest; or a separate staging registry. Pull by managed identity only.     | Platform engineer         |
| D3  | Staging data origin                                                                                        | **Fresh V2 bootstrap with synthetic tenants only.** No copy of the old staging or production databases.                                                                             | Product owner + DBA       |
| D4  | Old production data                                                                                        | Establish (read-only, under a change record) whether `nzila_os_prod` holds real member data. That decides whether production is a fresh start or a migration (README R-18).          | Product owner             |
| D5  | Identity tenant                                                                                            | The new subscription sits in a **different Entra tenant** from the old one. Decide which tenant owns the Union Eyes app registration and staff/member accounts before step S7.        | Security owner            |
| D6  | Edge (README R-5)                                                                                          | Front Door **Premium** with WAF and Private Link for production; staging may use the Container Apps ingress with IP restrictions to keep cost down.                                  | Platform engineer         |
| D7  | Django sidecar                                                                                             | The V2 template has no Django container, while 29 legacy routes call `DJANGO_API_URL`. Confirm the V2 runtime serves none of them (or that each answers 501) before staging.          | Engineering               |
| D8  | Old production exposure                                                                                    | Independent of this plan: lock down (IP restriction or scale to zero) or keep `nzila-os-union-eyes-prod` running, given it predates the RLS fixes.                                   | Product owner             |

## 3. Engineering prerequisites (in the repository)

These block step S4 or S6. None of them needs Azure.

1. **Merge the open work:** PR #1014, then PR #1078 (anonymous filing, end-of-day deadlines, locale,
   overdue reminders). Staging must run merged source built by CI (README R-7).
2. **Qualify the V2 bootstrap.** `UE_BOOTSTRAP_V2_LOCAL_VALIDATION.json` reads
   `engineeringReadiness = FAIL`. `UE_V2_APP_SCHEMA_COMPATIBILITY.json` (generated 2026-10-17 by
   `scripts/bootstrap-v2/app-schema-compat.ts`) lists 237 tables missing 3,378 columns and 49 tables
   absent; re-run against current source it reads **151 tables missing 1,723 columns and 34 absent**.
   Of those, **67 tables (23 absent, 360 columns)** are reachable from live routes or pages; the other
   118 may stay out of V2 if their paths fail closed. Steps and per-table lists:
   [`UE_V2_QUALIFICATION_WORKPLAN.md`](../bootstrap-v2/UE_V2_QUALIFICATION_WORKPLAN.md). Ten `scripts/bootstrap-v2/*` test files fail on the current branch:
   source-hash drift in the SYSTEM mutation contracts and its knock-on failures (requalify, never
   re-pin hashes blindly), the plan missing current lookups (`bootstrap-v2.test`), Django reward-model
   drift (`reward-source`), and a missing `python` executable on non-Linux hosts (`local-vault-fixture`,
   environmental). The plan digest must be regenerated after #1078 (Django `grievances/0010` changes
   the `claims.is_anonymous` default) and after `migrations-cache/0019`.
3. **Parameterize the template for staging.** `ue-v2/modules/apps.bicep` hard-codes
   `UE_ENVIRONMENT=production`, `UE_DEPLOYMENT_TYPE=prod` and `NEXT_PUBLIC_APP_ENV=production`;
   `main.bicep` defaults to production sizes. Add `parameters/ue-v2-staging.json` (Burstable or small
   General Purpose PostgreSQL, `appDatabaseName=ue_v2_staging`, 1–2 replicas) and derive the
   environment variables from `env`.
4. **Refuse test bypasses outside test runs.** The old staging app carries `PLAYWRIGHT_TEST_AUTH`,
   `UE_E2E_RISK_BYPASS` and `UNION_EYES_ACCEPTANCE_AUTH_ENABLED`. Add a template or CI assertion that
   these are absent from any staging or production revision.
5. **Move the pipelines.** `deploy-union-eyes.yml`, `ue-build-push-proof.yml` and related workflows
   target `nzilacanadaacr` and `nzila-canada-*-rg`. Point them at the new subscription with an OIDC
   federated credential scoped to the staging resource group (as #1044 did for web), keeping the
   fail-closed gates in `tooling/scripts/lib/union-eyes-deployment-safety.mjs`.
6. **Close or hide `UE-CLAIM-DEADLINES-SURFACE`** (capability registry): give claim deadlines
   reminders, or remove their listing from Priorities, before the SaaS gate can pass.

## 4. Provisioning sequence (staging)

Each step records its evidence under `docs/union-eyes/reality-remediation/evidence/` and stops on the
first failure. Nothing here touches production.

| Step | Action                                                                                                                                                               | Gate before it                         | Evidence                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| S0   | Change record for staging infrastructure (new CHG) and approval of D1–D7                                                                                              | —                                      | signed CHG                                                     |
| S1   | Create `nzila-canada-staging-rg`, an action group, the deploy identity (OIDC) with least-privilege roles on that group only                                          | S0                                     | role assignment list                                           |
| S2   | `az deployment group what-if` for `ue-v2/main.bicep` with staging parameters                                                                                          | S1, prerequisite 3                     | what-if output                                                 |
| S3   | Key Vault secrets per README §4 and the RSA key `pii-encryption-key` (values generated in the vault, never in a file)                                                | S2                                     | secret **names** and versions only                             |
| S4   | Deploy `main.bicep` (`dbAdminPassword` from a secure prompt)                                                                                                         | S3                                     | deployment outputs                                             |
| S5   | CI builds the staging image from merged source with staging `NEXT_PUBLIC_*` build arguments; push to `nzilaventuresacr`; import ClamAV adapter and cron images by digest | prerequisites 1, 5                     | image digests bound to the source SHA                          |
| S6   | Database bootstrap per `RUNBOOK_DATABASE_BOOTSTRAP.md` from the **qualified** V2 candidate; then `rls-verify --mode=preflight --require-deadline-engine-tables`      | prerequisite 2                         | catalog digest, migration ledger, rls-verify transcript        |
| S7   | Entra app registration in the tenant chosen in D5; synthetic staff and member users for two synthetic organizations                                                   | D5                                     | app id, user list (no secrets)                                 |
| S8   | DNS `staging.unioneyes.app`, managed certificate, ingress restriction (D6)                                                                                            | S4                                     | `curl` of `/api/health`, `/api/ready`, `/api/version` with SHA and digests |
| S9   | First administrator per `RUNBOOK_FIRST_ADMIN_BOOTSTRAP.md`                                                                                                            | S6, S7                                 | audit record                                                   |
| S10  | Runtime acceptance: every `REQUIRED_BEFORE_SAAS_PASS` row of file 25 §6 (below)                                                                                       | S1–S9                                  | one artifact per row                                           |
| S11  | Third ledger rerun against the post-acceptance `main` SHA                                                                                                             | S10                                    | new numbered ledger file                                       |

**S10 rows, each with its own artifact:** live RLS tenant-boundary probes with the signed two-tenant
fixture (file 31); grievance deadline assignment convergence; concurrent worker and lease recovery;
successor reminder delivery to a test inbox through Resend (including an overdue reminder);
auth, session and offboarding against the Entra tenant from D5; deployed route health for the 43
canonical navigation destinations; OTEL traces in Azure Monitor; audit and history persistence;
document and evidence access revocation; anonymous-claim identity withholding (PR #1078) across two
readers.

## 5. After staging: what production adds

Production repeats S1–S9 in its own resource group with README §2 sizing (zone-redundant HA, 35-day
PITR, geo backup, Front Door Premium with WAF), then README §11–§14. It also needs D4 resolved, a
separate signed authorization (README G-authorization), and a cutover and decommission plan for the
old subscription: legacy production, its database, the four other Union Eyes apps, the recovery
server `nzila-ue-recovery-20261022` and the stale firewall rules.

## 6. Cost: efficient by default

Requirement (product owner, 2026-11-04): staging and production must be cost-effective and
right-sized. Measured baseline, Azure Cost Management, 2026-10-05..2026-11-03 (actual cost):

| Subscription | 30-day cost | Largest items |
| --- | --- | --- |
| Old (`5d819f33-…`) | **CAD 1,877.67** | staging Container Apps 618.01 (18 always-on apps); `nzila-g2-proof-…` Azure Firewall 284.36 + VM/registry/VNet 94.77; prod Container Apps 227.27; demo PostgreSQL 145.23 (app scaled to zero); `nzila-staging-db` 97.83; prod PostgreSQL 75.98; deleted-resource PostgreSQL 157.04 |
| New (`d562ba7f-…`) | CAD 1.44 | registry |

**Staging sizing rules** (encode them in `parameters/ue-v2-staging.json`, prerequisite 3):

| Component | Staging choice | Why it is enough |
| --- | --- | --- |
| Container Apps | Consumption profile; app `minReplicas 0`, `maxReplicas 2`; ClamAV `minReplicas 0` | Billed per use; cold start is acceptable in staging. Set `minReplicas 1` only during an acceptance run (worker and concurrency rows of S10). |
| Cron | Container Apps **Job** (per-execution billing), not an always-on container | Reminder sweep runs every 5 minutes for seconds. |
| PostgreSQL | Burstable `B1ms` (scale to `B2s` for concurrency tests), no HA, 7-day backup, 32 GB, **stopped outside test windows** | Tenant isolation, migrations and workers do not need HA to be proven; HA is a production property tested in the production drill. |
| Redis | Smallest Azure Managed Redis SKU the template supports (confirm price at S2) | Rate-limiter fail-closed behaviour must be proven on the same technology as production. |
| Edge | No Front Door in staging; Container Apps ingress with IP restrictions | Front Door Premium (D6) has a fixed monthly base; it is production-only. |
| Private endpoints | Keep the four (vault, storage, Redis, PostgreSQL) | Network isolation is part of what staging must prove; small fixed cost each. |
| Logs | Reuse one Log Analytics workspace per subscription; 30-day retention; daily ingestion cap on staging | Ingestion is the main log cost. |
| Registry | One registry, promote by digest (no duplicate staging registry) | D2 Premium is a fixed monthly cost; do not pay it twice. |
| Guardrails | Azure **budget with alerts** on each resource group (staging and production), tags `env`, `app`, `owner`, `costCenter` on every resource | Overspend is seen within the month, not after it. |

**Production sizing:** README §2 applies (zone-redundant HA, 35-day PITR, geo backup, Front Door
Premium), but start at the smallest General Purpose PostgreSQL SKU that passes the load and restore
drill rather than the template default `Standard_D4ds_v5`, and keep app `minReplicas 2` only if
availability targets require it. Revisit after 30 days of measured usage.

**Old-subscription spend to decide on (not authorized by the directive, listed for decision):**
the idle `nzila-g2-proof-…` firewall environment, the demo PostgreSQL behind a scaled-to-zero app,
always-on staging apps and 0%-traffic revisions, `nzila-ue-recovery-20261022`, and `nzila-staging-db`.
Stopping or removing any of them is a separate, authorized change.

## 7. Conflicting status statements

[README.md](./README.md) records `PRODUCTION_READY = YES_WITH_OPERATIONAL_GATES` for the V2
candidate. The readiness ledgers (files 25, 29, 30) record `NO_GO`, and the bootstrap-v2 records
read `engineeringReadiness = FAIL` and final acceptance `FAIL`. This plan follows the strictest
reading. The S11 ledger rerun is where they are reconciled; until then none of the README's
"operational gates only" framing applies to the new subscription.

## 8. What this plan does not do

It does not authorize any Azure change, merge, deployment, customer-data use or Phase 3B work, and
it does not change any gate above. Each step needs its own approval.
