# Union Eyes V2 — production hardening and go-live candidate

> **Status: release candidate, not deployed.** No production resource was created or changed, no customer
> data was used, and merge and production deploy are not authorized.

Scope corrections frozen in the final release-candidate lane: **member dues collection is not initial
launch scope** (no member payment UI, the dues Stripe flow is a dormant optional capability), **Stripe's
primary purpose is client-commercial management** and is not an initial-launch requirement (R-13 =
POST_LAUNCH_COMMERCIAL_ENABLEMENT, see [COMMERCIAL_STRIPE_BOUNDARY.md](./COMMERCIAL_STRIPE_BOUNDARY.md)),
the production server profile is **internal**, and the initial cutover is **run alongside**.

```
PRODUCTION_READY             = YES_WITH_OPERATIONAL_GATES
PRODUCTION_DEPLOY_AUTHORIZED = NO
CUSTOMER_DATA_AUTHORIZED     = NO
MERGE_AUTHORIZED             = NO
```

`YES_WITH_OPERATIONAL_GATES` means no unfinished application or security engineering remains for the
launch scope. Every remaining gate is a human decision, a provider action or an infrastructure
operation (section 14). Two caveats apply and are not hidden:

- the infrastructure template compiles and lints but has **not been deployed** (not even `what-if`,
  which needs a target resource group), so the first deployment is itself a gate;
- the production image digest is **PENDING_CI_MERGED_SOURCE**: NEXT*PUBLIC*\* values are build-time inputs and a local build of an uncommitted tree has no release authority. The staging image below is evidence only.

Machine-readable record: [UE_PRODUCTION_HARDENING_PACKAGE.json](./UE_PRODUCTION_HARDENING_PACKAGE.json).
Template: [infrastructure/bicep/ue-v2/](../../../infrastructure/bicep/ue-v2/main.bicep).
Smoke: [go-live-smoke.ts](../../../apps/union-eyes/scripts/production/go-live-smoke.ts).

## 1. What this pass found and proved

Hardening was meant to be configuration-only. The operational probes found two real defects in one
file, `apps/union-eyes/lib/rate-limiter.ts`, so source changed (and only that file, plus its tests).

| Finding                                                                                                                                                                        | Class          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The `REDIS_URL` rate-limit adapter dropped per-command errors, so with Redis down the count read as 0 and **explicit, fail-closed limits (financial, AI) allowed the request** | B (security)   | Staging, Redis down: handler ran (409) before the fix, **429** after. Control with Redis up: 409. Negative-control test fails without the fix.                                                                                                                                                                                                                                                                                   |
| A Redis command that never settled hung every organization-scoped request, and the app **did not recover after Redis came back** until it was restarted                        | A (resilience) | Reproduced on staging by the go-live smoke (60 s timeouts on every org-scoped route). Fixed with a bounded store timeout (2 s, `RATE_LIMIT_STORE_TIMEOUT_MS`), ioredis `commandTimeout`/`connectTimeout`, and discarding and recreating the client after a timed-out command. A first attempt that only called `disconnect()` did **not** recover on staging, so it was replaced. Negative-control tests fail without each part. |

Other results:

| Item                                                | Result                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resend environment isolation                        | PASS. A staging-specific **send-only** key (it gets 401 on key management) replaced the production key copied during the staging proof. Production key versions are disabled in `nzila-staging-kv`, the staging app secret was replaced, fingerprints differ, and a reminder was delivered through the app (`sent`). |
| Point-in-time restore drill                         | PASS. Restored the staging database to a new server in **7 min 11 s**; 695 tables, 1,223 policies, 134 functions, 2,187 indexes and 694 RLS tables matched exactly; data stopped at the restore point (later rows absent). Scratch server deleted.                                                                   |
| Alert queries                                       | Calibrated against the real staging logs (see section 10).                                                                                                                                                                                                                                                           |
| Go-live smoke                                       | Validated against staging, unauthenticated and authenticated.                                                                                                                                                                                                                                                        |
| Image secret scan                                   | No credential in the image; the only prefix matches are `startsWith("whsec_")` validators.                                                                                                                                                                                                                           |
| Legacy `POST /api/payments/checkout/create`         | Fails closed: 500, no Stripe session, dues row untouched. Not linked from any launch page.                                                                                                                                                                                                                           |
| Staging recovery after a Redis outage (fixed image) | PASS. With Redis down: explicit limit 429, org-scoped read 200 in ~2 s. With Redis back and **no app restart**, the limiter passed again 26 s later. Go-live smoke 16/16 on the same image.                                                                                                                          |

## 2. Target production architecture

A **new, isolated** stack. The live legacy UE stack is hand-built with no VNet, a public PostgreSQL
endpoint and `AllowAllAzureServices`, and a Container Apps environment cannot be given a VNet in
place, so V2 does not reuse it.

```
Internet -> Front Door PREMIUM (WAF: default + bot rule sets, Prevention)
              -> Private Link -> Container Apps env (VNet-integrated, internal)
                  - union-eyes app   (min 2, max 6, probes, user-assigned identity)
                  - clamav scanner   (min 1, internal only)
                  - cron job         (deadline reminders, every 5 min)
              -> private endpoints / VNet injection:
                  - PostgreSQL flexible server (zone-redundant HA, PITR 35 d, geo backup, no public access)
                  - Azure Managed Redis        (TLS, private endpoint)
                  - Storage (documents)        (private endpoint, versioning, soft delete, lifecycle)
                  - Key Vault                  (RBAC, purge protection, private endpoint)
Registry: images pulled by identity (AcrPull); admin credentials not used.
Logs/alerts: existing prod Log Analytics workspace + action group.
```

Managed identity: **Key Vault** (secrets by reference, plus Crypto User for the PII key) and the
**registry** use the user-assigned identity. **Storage cannot**: `@nzila/blob` signs SAS URLs with
the account key and has no managed-identity path, so the key stays (private endpoint, Key Vault,
rotation runbook) and managed-identity support is a backlog item (R-8). **Database** access uses password-based connection strings held in Key Vault (the app has no token-authentication path), so their rotation is covered in section 4.

## 3. Resources the template creates

`infrastructure/bicep/ue-v2/main.bicep` (modules: `private-endpoint`, `acr-pull`, `storage`,
`redis`, `apps`, `alerts`; reuses `../modules/postgres.bicep`): VNet with delegated subnets, four
private DNS zones, user-assigned identity, Key Vault + private endpoint, storage + lifecycle +
diagnostics, Azure Managed Redis (API 2025-07-01) + private endpoint, PostgreSQL (`azure.extensions =
VECTOR`), role assignments (Key Vault Secrets User, Key Vault Crypto User, AcrPull), Container Apps
environment, three workloads and the alerts. PgBouncer is off because V2 relies on per-transaction
`SET LOCAL ROLE`.

## 4. Production secret manifest

No value appears here or in the repository. Every secret is a Key Vault secret referenced by the Container App through the user-assigned identity. **Stripe secrets are optional at initial launch.**

| Secret name                        | Variable                                      | Owner                                        | System of record                                                              | Rotation owner                           | Rotation                                                                                                                                                                     | Consumer                                             | Required |
| ---------------------------------- | --------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| database-url                       | DATABASE_URL                                  | Platform DBA                                 | Key Vault (value generated at role creation; role lives in PostgreSQL)        | Platform DBA                             | 90 days; create the new password on the login role, set a new Key Vault version, restart the revision                                                                        | app                                                  | true     |
| system-database-url                | SYSTEM_DATABASE_URL                           | Platform DBA                                 | Key Vault                                                                     | Platform DBA                             | 90 days, same procedure                                                                                                                                                      | app                                                  | true     |
| auth-database-url                  | AUTH_DATABASE_URL / AUTH_SYSTEM_DATABASE_URL  | Platform DBA                                 | Key Vault                                                                     | Platform DBA                             | 90 days, same procedure                                                                                                                                                      | app                                                  | true     |
| pg-admin-password                  | (none; operators only)                        | Platform DBA                                 | Key Vault, break-glass                                                        | Platform DBA                             | After every bootstrap/restore; 90 days                                                                                                                                       | operators (bootstrap, restore, catalog verification) | true     |
| auth-secret                        | AUTH_SECRET                                   | Security owner                               | Key Vault                                                                     | Security owner                           | Annually or on suspicion; rotation signs every user out                                                                                                                      | app                                                  | true     |
| mfa-encryption-key                 | AUTH_MFA_ENCRYPTION_KEY                       | Security owner                               | Key Vault                                                                     | Security owner                           | NOT ROTATABLE with the current code: stored TOTP secrets are encrypted with it and there is no re-encryption path (risk R-11)                                                | app                                                  | true     |
| voting-secret                      | VOTING_SECRET                                 | Security owner                               | Key Vault                                                                     | Security owner                           | Only between elections                                                                                                                                                       | app                                                  | true     |
| cron-secret                        | CRON_SECRET_KEY                               | Platform engineer                            | Key Vault                                                                     | Platform engineer                        | 90 days; the app and the cron job read the same secret and restart together                                                                                                  | app, cron job                                        | true     |
| redis-url                          | REDIS_URL                                     | Platform engineer                            | Key Vault (rediss://:<access key>@<host>:10000); key from Azure Managed Redis | Platform engineer                        | 90 days; regenerate the secondary key, publish the URL, restart, then regenerate the primary                                                                                 | app                                                  | true     |
| stripe-secret-key                  | STRIPE_SECRET_KEY                             | Finance owner (Stripe account holder)        | Stripe Dashboard -> Key Vault                                                 | Finance owner + Platform engineer        | Use a restricted live key (rk_live) limited to PaymentIntents; roll every 90 days with Stripe rolling-key expiry (applies only if client-commercial billing is enabled)      | app                                                  | false    |
| stripe-webhook-secret              | STRIPE_WEBHOOK_SECRET                         | Finance owner                                | Stripe Dashboard (production endpoint) -> Key Vault                           | Finance owner + Platform engineer        | On endpoint secret roll; the route verifies one secret, so roll in a quiet window and restart immediately (risk R-12) (applies only if client-commercial billing is enabled) | app                                                  | false    |
| resend-api-key                     | RESEND_API_KEY                                | Communications owner (Resend account holder) | Resend Dashboard -> Key Vault                                                 | Communications owner + Platform engineer | 90 days; create the new send-only key, publish, restart, then revoke the old key                                                                                             | app                                                  | true     |
| storage-account-key                | AZURE_STORAGE_ACCOUNT_KEY                     | Platform engineer                            | Azure Storage -> Key Vault                                                    | Platform engineer                        | 90 days; alternate key1/key2 so the old key stays valid until the restart completes                                                                                          | app                                                  | true     |
| pii-encryption-key                 | AZURE_KEY_VAULT_URL (key, not a secret value) | Security owner                               | Key Vault RSA key; app identity holds Key Vault Crypto User                   | Security owner                           | New key versions only after a re-wrap plan exists; never delete the old version                                                                                              | app (managed identity)                               | true     |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | build argument (public value)                 | Finance owner                                | Stripe Dashboard -> release pipeline variable                                 | Release engineer                         | Only when the Stripe account changes                                                                                                                                         | release image build (client bundle)                  | false    |

## 5. Stripe production configuration plan

Stripe is **not an initial-launch requirement** and no live credential is provisioned. Its primary purpose is client-commercial management, not member dues; the boundary and the future object model are in [COMMERCIAL_STRIPE_BOUNDARY.md](./COMMERCIAL_STRIPE_BOUNDARY.md).

- Member dues collection is out of initial launch scope; no member payment UI is built; the dues Stripe flow is a dormant optional capability that answers `501` unless `UE_MEMBER_DUES_PAYMENTS=1`.
- The proven controls (signature verification, provider-originated delivery, idempotent settlement, tamper rejection, server-owned amount/organization/payer binding, canonical audit, exactly-once mutation, fail-closed provider handling) are preserved for reuse by client-commercial payments.
- If a client-commercial payment is later selected for a rollout: create a restricted live key, register a **production** endpoint for exactly `payment_intent.succeeded`, `payment_intent.payment_failed` and `payment_intent.canceled` (plus `invoice.paid` if hosted invoices are used), store the secrets, and deploy with `enableStripe=true`. No live charge test is authorized by this package.

## 6. Resend production configuration plan

Domain `unioneyes.app` is already **verified** in the Resend account. Create a production
send-only key restricted to that domain (do not reuse the staging key), store it as
`resend-api-key`, and set `EMAIL_FROM`/`RESEND_FROM_EMAIL` (`noreply@unioneyes.app`) and
`EMAIL_REPLY_TO` (`support@unioneyes.app`). Recipient safety: production sends go only to real
members; staging and rehearsals use `delivered@resend.dev`. No inbound webhook is used by V2, so no
Resend webhook secret is required. Staging and production keys stay separate.

## 7. Production storage

Private container `ue-v2-documents`; blob public access off; private endpoint only; versioning, 30
day soft delete and container soft delete, 90 day change feed, lifecycle (Cool at 90 days, versions
expire at 365 days); read/write/delete diagnostics to Log Analytics; tenant authorization and the
malware scan are enforced by the app (EICAR rejected, scanner outage returns 503 and stores nothing —
both proven on staging). Provenance is the canonical audit row for every upload and download. No
customer documents are loaded.

## 8. Database operations

- **Backup / PITR:** 35 day retention, geo-redundant, zone-redundant HA. **Restore procedure**
  (drilled): `az postgres flexible-server restore --source-server <db> --name <new> --restore-time <UTC>`;
  verify catalog parity and data boundary; cut over by publishing new connection secrets and
  restarting; keep the old server until verified. Drill result: 7m11s at staging size; repeat at
  production size after first deployment (R-20).
- **Schema bootstrap (R-9: procedure approved, execution pending).** The V2 installer is local-only by design, so production is a verified restore of the qualified candidate (CANONICAL_BOOTSTRAP_V2). The exact preconditions, commands, expected results, verification, rollback and stop conditions are in [RUNBOOK_DATABASE_BOOTSTRAP.md](./RUNBOOK_DATABASE_BOOTSTRAP.md). The restore transform is a tested tool (scripts/production/prepare-bootstrap-restore.ts) that reproduces the Azure-proven restore byte for byte.
- **Rollback:** the application rolls back by deploying the previous image digest (single-revision
  mode); the schema is forward-only, so a bad data change is undone by PITR to a new server and a
  secret cut-over. Edge rollback is switching the Front Door origin group back to the legacy origin.
- **Credential rotation / maintenance:** section 4; Azure minor-version maintenance in an agreed
  low-traffic window, `azure.extensions` unchanged.
- **First administrator (R-10: engineering PASS, production execution pending).** An operator-only tool (scripts/production/first-admin-cli.ts): no HTTP surface, no default identity or password, one transaction under an advisory lock, idempotent, canonical audit, enrolled MFA, refuses when any administrator exists. Procedure: [RUNBOOK_FIRST_ADMIN_BOOTSTRAP.md](./RUNBOOK_FIRST_ADMIN_BOOTSTRAP.md).

## 9. Redis and rate limiting

Azure Managed Redis (TLS 1.2, private endpoint, access-key auth, port 10000, `EnterpriseCluster`
policy for the non-cluster client), stored as `redis-url`. Behavior (proven on staging):

- explicit limits **fail closed** when Redis is down (429), catch-all limits fail open by design;
- a request waits at most 2 s on the store, then the policy applies, the stuck client is discarded and
  recreated, and the circuit breaker opens for 30 s; the limiter then recovers on its own (26 s after
  Redis returned in the staging proof, with no app restart);
- the health endpoint is shallow (returned 200 with Redis down, R-15), so Redis is monitored by
  alert and by the go-live smoke, not by container probes.

## 10. Observability

Existing production workspace and action group are reused. Log alerts use patterns **validated on
the staging logs**; signals with no log line use platform metrics.

| Signal                        | Alert                                                                                        | Basis                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Unexpected 5xx (501 excluded) | log alert, severity 1                                                                        | validated: 500 x2, 502 x6                                           |
| Database unavailable          | metric `is_db_alive` < 1, severity 0; plus DB-error log alert                                | metric is platform-native; log pattern validated (9)                |
| Redis unavailable             | log alert (`[rate-limiter] ioredis error`, `Rate limit check failed`)                        | validated (7), observed during the outage                           |
| ClamAV unavailable            | metric `Replicas` < 1 on the scanner                                                         | no log line exists (upload returns 503 silently)                    |
| Stripe webhook failure        | log alert (`[stripe-webhook]` warn/error)                                                    | validated (5)                                                       |
| Resend failure                | log alert (`Error sending email`)                                                            | validated (2)                                                       |
| Cron failure / dead letter    | job failure alert (**pattern unvalidated until first run**) + Resend alert + daily SQL check | no dead-letter log line exists                                      |
| Audit persistence failure     | log alert (`Failed query` + `audit_logs`)                                                    | shape validated on the same Drizzle error format; no occurrence yet |
| No running replicas           | metric on the app                                                                            | platform-native                                                     |

Daily dead-letter check (operator, read-only):
`SELECT count(*) FROM audit_logs WHERE action='deadline.reminder.dead_lettered' AND created_at > now() - interval '1 day';`

## 11. Deployment package (not executed)

| Item                | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan digest         | `0a5ee060e7c3e3e373192ca8a4a1d58a47b44bfe490c6a7f8587f05127553ef4` (re-frozen for the clean release; previous qualified digest `4f9732e25ce07fc953648d5275c1901d674c833c78631b814f389bb90cc4c748`, see UE_RELEASE_PLAN_REFREEZE.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Production image    | **PENDING_CI_MERGED_SOURCE** (deliberately not built locally). NEXT*PUBLIC*\* values are baked at build time, so production needs its own image, built by CI from the merged branch (R-7). Build arguments: NEXT_PUBLIC_APP_URL=https://app.unioneyes.app, NEXT_PUBLIC_SITE_URL=https://unioneyes.app, NEXT_PUBLIC_UNION_EYES_URL, UE_APP_URL, UE_MARKETING_URL, UE_ENVIRONMENT=production, NEXT_PUBLIC_APP_ENV=production, UE_DEPLOYMENT_TYPE=prod, ARTIFACT_ID=plan-<plan digest>, RELEASE_ID. No Stripe publishable key is needed (no payment page is mounted). |
| Staging proof image | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes-v2@sha256:c1a206c17450581a8c8b21685343f753ce7ade2c8cbf7ccf720b93cc3ce2a7ec` (revision `r13`)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Release rule        | rebuild in CI from the merged branch, promote by digest, never by tag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Order: (1) human approvals (section 14) -> (2) deploy to a **non-production** resource group first
and run `what-if` -> (3) create secrets in the new vault and the RSA key `pii-encryption-key`
-> (4) deploy `main.bicep` with `dbAdminPassword` from a secure prompt -> (5) bootstrap the database
(section 8) -> (6) import images by digest and the curl image for the cron job -> (7) Front Door
Premium, Private Link origin, WAF rule sets, custom domain and certificate -> (8) register the Resend
production configuration (Stripe only if client billing is selected; deploy with nableStripe=true then) -> (9) go-live smoke -> (10) first-administrator runbook.

Environment note: `AZURE_CLIENT_ID` is set to the user-assigned identity because the app uses
`DefaultAzureCredential` for the Key Vault key (staging used a system identity).

## 12. Go-live smoke (small, no payment, no email)

Run `tsx scripts/production/go-live-smoke.ts <base-url>` with an optional dedicated **synthetic**
smoke operator in a dedicated smoke organization. It checks: health, release identity (artifact and
environment), anonymous denial, the Stripe webhook failing closed (401 when configured, 503 when Stripe is
not enabled, which is the expected state at initial launch), cron denies without credential and accepts the credential, password login, MFA,
canonical memberships, organization selection, foreign-organization denial (tenant isolation), a
member read, the Redis limiter (409 or 501 = the limiter passed before the handler; 429/503 = unavailable) and the malware
scanner (EICAR rejected, 400). Afterwards confirm audit persistence with a read-only SQL check
(`SELECT action,count(*) FROM audit_logs WHERE created_at > now() - interval '15 minutes' GROUP BY 1`)
and Resend health with the Resend dashboard (domain verified, no failed sends). Not covered, on
purpose: payments, the full journey suite, and anything with customer data.

## 13. Risk matrix

| ID   | Risk                                                                                                                         | Current control                                                                                                                                                                                                                                                                                                                                             | Residual risk                                                                                                                     | Owner                          | Go-live gate      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------- |
| R-1  | Rate limiter failed open when Redis was unreachable (ioredis pipeline errors were dropped)                                   | FIXED this pass: adapter propagates per-command errors; proven fail-closed on staging (409 before, 429 after)                                                                                                                                                                                                                                               | Low                                                                                                                               | Engineering                    | NO                |
| R-2  | A stuck Redis command hung every org-scoped request until the app was restarted after an outage                              | FIXED this pass: bounded store timeout (2s, RATE_LIMIT_STORE_TIMEOUT_MS), ioredis commandTimeout/connectTimeout, and the client is discarded and recreated after a timed-out command. Proven on staging with no app restart: recovered 26s after Redis returned (an earlier revision that only called disconnect() did not recover)                         | Low                                                                                                                               | Engineering                    | NO                |
| R-3  | Production credential copied into staging                                                                                    | REMOVED this pass: staging-specific send-only key, old versions disabled, app secret replaced, key fingerprints differ                                                                                                                                                                                                                                      | None                                                                                                                              | Platform engineer              | NO                |
| R-4  | Production PostgreSQL private connectivity: legacy production is on a public endpoint with AllowAllAzureServices             | V2 template: VNet-injected server, private DNS, no public access, no firewall rules; the runbooks use an in-VNet operator host                                                                                                                                                                                                                              | Open until the V2 stack is deployed (template compiled and linted, not deployed)                                                  | Platform engineer              | YES (operational) |
| R-5  | Front Door is Standard: no managed WAF rule sets and no Private Link; the legacy app FQDN is reachable directly (WAF bypass) | V2 env is internal; required: upgrade the profile to Premium, add Private Link origin and the Microsoft default + bot rule sets in Prevention                                                                                                                                                                                                               | WAF protection absent until upgraded                                                                                              | Platform engineer              | YES (operational) |
| R-6  | Registry has admin credentials enabled, is Basic, public, and shared by staging and production                               | V2 pulls by managed identity (AcrPull); required: disable admin after staging apps move to identity pull, import by digest, preferably a dedicated Premium registry                                                                                                                                                                                         | Supply-chain exposure while admin stays enabled                                                                                   | Platform engineer              | YES (operational) |
| R-7  | Release source is an uncommitted working tree; no CI-built, signed artifact exists                                           | Release image is PENDING_CI_MERGED_SOURCE. Required: commit, PR with the repository checks, merge, CI build from the protected branch, promote by digest. The final source digest is recorded in the ledger.                                                                                                                                                | Digest below is a candidate only                                                                                                  | Release owner                  | YES (operational) |
| R-8  | Storage uses a shared account key; @nzila/blob has no managed-identity or user-delegation SAS path                           | Private endpoint only, key only in Key Vault, rotation runbook, versioning and soft delete                                                                                                                                                                                                                                                                  | Key compromise requires network access first; managed-identity support is backlog                                                 | Engineering (backlog)          | NO                |
| R-9  | Production schema bootstrap execution (the V2 installer is local-only by design)                                             | PROCEDURE_APPROVED: CANONICAL_BOOTSTRAP_V2 as a verified restore of the qualified candidate. RUNBOOK_DATABASE_BOOTSTRAP.md has preconditions, exact commands, expected results, verification, rollback and stop conditions; the restore tool reproduces the Azure-proven restore byte for byte                                                              | EXECUTION_PENDING (human, in-VNet operator host)                                                                                  | Platform DBA + product owner   | YES (operational) |
| R-10 | First administrator for the new production database                                                                          | ENGINEERING PASS: operator-only tool (no HTTP surface, no default identity or password), one transaction under an advisory lock, idempotent, canonical audit, enrolled MFA, refuses when any administrator exists. Proven on real PostgreSQL with the canonical schema (9 native tests, race test fails without the lock). RUNBOOK_FIRST_ADMIN_BOOTSTRAP.md | EXECUTION_PENDING (owner-supplied identity, production execution)                                                                 | Product owner + Security owner | YES (operational) |
| R-11 | The MFA encryption key cannot be rotated (no re-encryption path)                                                             | Key held only in Key Vault with purge protection; documented as non-rotatable                                                                                                                                                                                                                                                                               | Compromise would force an MFA re-enrollment of all users                                                                          | Engineering (backlog)          | NO                |
| R-12 | Stripe webhook route verifies a single secret, so a secret roll briefly rejects events (relevant only if Stripe is enabled)  | Roll in a quiet window and restart; Stripe retries failed deliveries for up to three days                                                                                                                                                                                                                                                                   | Low; N/A at initial launch                                                                                                        | Finance owner                  | NO                |
| R-13 | CLIENT_COMMERCIAL_PAYMENT_STRATEGY: whether Stripe must be active at initial launch                                          | RECLASSIFIED. R-13 = POST_LAUNCH_COMMERCIAL_ENABLEMENT. Member dues collection is out of launch scope, the dues payment UI is not built, the dues Stripe flow is a dormant optional capability (501 unless UE_MEMBER_DUES_PAYMENTS=1), and no initial-launch journey depends on Stripe. See COMMERCIAL_STRIPE_BOUNDARY.md                                   | None for launch; live Stripe configuration becomes a gate only if a client-commercial payment is selected for the initial rollout | Product owner                  | NO                |
| R-14 | Legacy POST /api/payments/checkout/create returned 500 under V2                                                              | CLOSED: it now answers 501 NOT_IMPLEMENTED while member dues payment is not enabled (auth first, then 501; no database or provider access); covered by tests                                                                                                                                                                                                | None                                                                                                                              | Engineering (backlog)          | NO                |
| R-15 | /api/health is shallow: it returned 200 while Redis was down                                                                 | Dependency alerts (Redis, ClamAV, database, Stripe, Resend) and the go-live smoke probe dependencies directly                                                                                                                                                                                                                                               | Container probes do not detect dependency loss                                                                                    | Engineering (backlog)          | NO                |
| R-16 | No log signal for ClamAV outage or cron dead-lettering                                                                       | ClamAV: replica-count metric alert; cron: job-failure alert (pattern unvalidated until first run) plus the Resend-failure alert and a daily dead-letter SQL check                                                                                                                                                                                           | Dead-letter visibility is partly manual                                                                                           | Platform engineer              | NO                |
| R-17 | Nothing schedules the deadline-reminder cron in production                                                                   | Template defines a Container Apps job (5 minute schedule) with the secret from Key Vault; needs a curl image imported into the registry                                                                                                                                                                                                                     | Operational step                                                                                                                  | Platform engineer              | NO                |
| R-18 | Cutover from the legacy production UE stack                                                                                  | DECISION_CLOSED: INITIAL_CUTOVER = RUN_ALONGSIDE (no big-bang replacement; the legacy stack keeps serving its users). Cutover conditions: new stack healthy, authentication healthy, tenant isolation verified, first admin established, providers healthy where required, audit persistence healthy, synthetic production smoke clean, rollback available  | EXECUTION_PENDING                                                                                                                 | Product owner                  | YES (operational) |
| R-19 | Server feature profile                                                                                                       | CLOSED_PRODUCT_DECISION: PRODUCTION_SERVER_PROFILE = internal (the qualified profile). executive is post-launch                                                                                                                                                                                                                                             | None                                                                                                                              | Product owner                  | NO                |
| R-20 | Production restore time is unmeasured at production size (staging drill: 7 minutes for a B1ms server with synthetic data)    | PITR with 35 day retention and geo-redundant backup in the template; run the same drill after the first deployment                                                                                                                                                                                                                                          | RTO unknown at scale                                                                                                              | Platform DBA                   | NO                |

## 14. Go-live gates

**`INTERNAL_RELEASE_BLOCKERS` = 0.** The gates below are operational or human actions, not unfinished engineering. Deployment, merge and customer data are each separately authorized (all NO today).

| ID              | Gate                                                                                                                                 | Kind               | Owner                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------- |
| R-4             | Production PostgreSQL private connectivity: legacy production is on a public endpoint with AllowAllAzureServices                     | OPERATIONAL_GATE   | Platform engineer                        |
| R-5             | Front Door is Standard: no managed WAF rule sets and no Private Link; the legacy app FQDN is reachable directly (WAF bypass)         | OPERATIONAL_GATE   | Platform engineer                        |
| R-6             | Registry has admin credentials enabled, is Basic, public, and shared by staging and production                                       | OPERATIONAL_GATE   | Platform engineer                        |
| R-7             | Release source is an uncommitted working tree; no CI-built, signed artifact exists                                                   | OPERATIONAL_GATE   | Release owner                            |
| R-9             | Production schema bootstrap execution (the V2 installer is local-only by design)                                                     | OPERATIONAL_GATE   | Platform DBA + product owner             |
| R-10            | First administrator for the new production database                                                                                  | OPERATIONAL_GATE   | Product owner + Security owner           |
| R-18            | Cutover from the legacy production UE stack                                                                                          | OPERATIONAL_GATE   | Product owner                            |
| G-secrets       | Production secret provisioning in the new Key Vault (the manifest lists what is required and what is optional)                       | OPERATIONAL_ACTION | Platform engineer                        |
| G-dns           | Production DNS, certificate and provider setup (Resend production key and sending domain; Stripe only if client billing is selected) | OPERATIONAL_ACTION | Platform engineer + Communications owner |
| G-authorization | Merge, production deployment and customer-data authorizations                                                                        | HUMAN_DECISION     | Aubert                                   |

Decisions now closed: **R-13** `POST_LAUNCH_COMMERCIAL_ENABLEMENT`; **R-18** run alongside (execution pending); **R-19** `internal` profile; **R-9** procedure approved (execution pending). Member dues are not a gate. Stripe live configuration is a gate only if client-commercial payment is selected for the initial rollout.

## 15. Final release-candidate record

| Item                        | Value                                                                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FINAL_SOURCE_DIGEST`       | `c5f4510100e61443330a2cfd7728340d56e99d407480c5d51ce506c3a4b03e17` (1,328 files; definition below)                                                                                                    |
| `FINAL_PLAN_DIGEST`         | `0a5ee060e7c3e3e373192ca8a4a1d58a47b44bfe490c6a7f8587f05127553ef4` (re-frozen; previous `4f9732e25ce07fc953648d5275c1901d674c833c78631b814f389bb90cc4c748`)                                                                                                                        |
| Git status                  | HEAD `1c337567` on `main`; 230 modified and 1,142 untracked files; nothing committed                                                                                                                  |
| `FINAL_TEST_FAST`           | **38,285 passed, 0 failed, 114 skipped** (2,283 files passed, 13 skipped), exact frozen source. The run exited 1 on one unhandled worker-start timeout, classified `INFRASTRUCTURE_FLAKE` (see below) |
| Typecheck / lint / targeted | PASS / 0 errors / 96 tests in 11 files                                                                                                                                                                |
| `INTERNAL_RELEASE_BLOCKERS` | **0**                                                                                                                                                                                                 |
| `PRODUCTION_READY`          | `YES_WITH_OPERATIONAL_GATES`                                                                                                                                                                          |
| `PRODUCTION_IMAGE_DIGEST`   | `PENDING_CI_MERGED_SOURCE`                                                                                                                                                                            |

Digest definition: sha256 over the HEAD commit and, for every modified or untracked file outside
`docs/`, `reports/` and `artifacts/` (generated test evidence), its path and sha256, sorted. It was
identical before and after the final regression; only generated `artifacts/` files changed during the run.
The final run **exited 1**: vitest reported one unhandled error ("Failed to start forks worker for test files `lib/__tests__/api.test.ts` ... Timeout waiting for worker to respond"), not a failed test. That file passed in isolation (6 of 6), so the flake rule applies: `INFRASTRUCTURE_FLAKE`, no product code changed. It is not separately evidenced that this one file executed inside the run, so a clean exit-0 `test:fast` in CI before merge is recommended. An earlier `manifest-native` failure (a Postgres-container test failing under load while an image build ran) was classified the same way and passed in isolation.

## 16. Out of scope and preserved

PayPal, Microsoft Calendar, PKI, CUPE seed tooling and the automated billing lifecycle are not
production-enabled. `cron/billing-lifecycle` stays **501**. No acceptance suite was repeated: the
only application source change is `lib/rate-limiter.ts` and its tests.
