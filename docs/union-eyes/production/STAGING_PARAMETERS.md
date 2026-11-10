# Union Eyes V2 — staging parameters for the Bicep stack

> **Status: prepared, not deployed.** This page describes template parameters only. No Azure resource
> was created, changed or queried (`what-if` included) to write it. It does not change any gate:
> `UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`, and section 14 of [README.md](./README.md) still applies.
> A staging deployment still needs the security review and approved change record required by the
> 2026-11-04 product-owner directive.

Template: [infrastructure/bicep/ue-v2/main.bicep](../../../infrastructure/bicep/ue-v2/main.bicep).
Example parameters: [staging.parameters.example.json](../../../infrastructure/bicep/ue-v2/parameters/staging.parameters.example.json).
The deploy workflow uses the committed, non-secret
[main.staging.parameters.json](../../../infrastructure/bicep/ue-v2/main.staging.parameters.json);
image digests are replaced from the release manifest and the database password is supplied only from
the protected `ue-staging` GitHub environment.

## 1. How `env` works

`env` accepts `staging` or `prod`. Every environment-dependent default is derived from it, so a
parameter file only has to override what differs from those defaults. With `env=prod` every default
is the value the template used before staging support was added. The production deployment snapshot
(`bicep snapshot`, all expressions evaluated) is identical before and after the change.

| Value                                         | `prod`                                | `staging`                                       |
| --------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| `UE_ENVIRONMENT` / `NEXT_PUBLIC_APP_ENV`      | `production`                          | `staging`                                       |
| `UE_DEPLOYMENT_TYPE`                          | `prod`                                | `staging`                                       |
| App URL (`NEXT_PUBLIC_APP_URL`, `AUTH_URL`)   | `https://app.unioneyes.app`           | Container Apps default FQDN of the app          |
| `NEXT_PUBLIC_SITE_URL`                        | `https://unioneyes.app`               | the app URL                                     |
| Sender / reply-to                             | `noreply@` / `support@unioneyes.app`  | no default: must be set (staging sender)        |
| Database name                                 | `ue_v2_prod`                          | `ue_v2_staging`                                 |
| Container Apps environment                    | internal (Private Link, Front Door)   | external, optional IP allow-list, no Front Door |
| Cost tags `env`, `app`, `owner`, `costCenter` | not added (production tags unchanged) | on every taggable resource                      |

`NODE_ENV` stays `production` in both: it describes the Next.js build mode, not the environment.

## 2. Staging sizing and cost choices

| Resource            | Staging setting                                                                                                                                | Why                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container Apps      | Consumption profile; app `min 0 / max 2`; ClamAV `min 0 / max 2`                                                                               | Pay only while a request or job runs. Replica counts are parameters.                                                                                                             |
| Reminder cron       | One Container Apps **Job** per entry of `apps/union-eyes/lib/operations/scheduled-jobs.json`, on the manifest's schedules (same as production) | Billed per execution. The manifest is the single schedule source (its contract test enforces it); a staging-only cadence would need a manifest change, not a template parameter. |
| PostgreSQL          | `Standard_B1ms`, no HA, 7-day backup, no geo backup, 32 GB, default storage tier, `max_connections=50`                                         | Smallest SKU. B1ms supports 50 connections; the module default (200) is for GP SKUs.                                                                                             |
| Azure Managed Redis | `Balanced_B0`, high availability off                                                                                                           | Smallest SKU the module accepts; no replica (dev/test only).                                                                                                                     |
| Storage             | `Standard_LRS`                                                                                                                                 | Synthetic data only; production keeps GZRS.                                                                                                                                      |
| Key Vault           | soft delete 7 days, purge protection on                                                                                                        | Shorter hold after a teardown. Purge protection is a security control and stays.                                                                                                 |
| Network             | VNet, delegated subnets and the four private endpoints (Key Vault, blob, Redis, PostgreSQL VNet injection)                                     | Network isolation is part of what staging must prove.                                                                                                                            |
| Front Door          | none                                                                                                                                           | Ingress is the Container Apps FQDN, limited by `ingressAllowedIpRanges`.                                                                                                         |
| Log Analytics       | reused by name (`createLogAnalytics=false`)                                                                                                    | No extra workspace. See section 3 for the daily cap.                                                                                                                             |
| Budget              | optional `budgetAmount` (0 = none), actual alerts at 50/80/100 %, forecast alert at 100 %                                                      | Cost guardrail scoped to the resource group.                                                                                                                                     |

The replica alerts (`app-no-replicas`, `clamav-unavailable`) are only created when the matching
minimum is above 0: a scale-to-zero workload has no replica most of the time, so the alert would always fire.

## 3. Prerequisites and parameters to fill in

- **Action group.** The new subscription has none. Set `createActionGroup=true` with
  `actionGroupEmailReceivers` (the template then creates `<prefix>-ops`), or pass an existing
  `actionGroupId`. One of the two is required: every alert and the budget notify it.
- **Log Analytics.** A reused workspace is only referenced, never modified, so a daily cap cannot be set
  on it from this template. To cap staging ingestion, set `createLogAnalytics=true` and
  `logAnalyticsDailyCapGb` (the workspace is created in `logAnalyticsResourceGroup`, which must exist).
- **Images.** `NEXT_PUBLIC_*` values are baked in at build time, so staging needs its own image built with
  `NEXT_PUBLIC_APP_ENV=staging` and the staging app URL. Without `publicHostName`, that URL contains the
  environment's generated default domain, which only exists after the environment is created.
- **Registry access.** `acrName` / `acrResourceGroup` must be in the same subscription; the template grants
  the app identity AcrPull on it.
- **Email.** `emailFrom` / `emailReplyTo` have no staging default; use a sender verified for staging.
- **Tags.** `owner` and `costCenter` are free text and applied to every taggable resource. Role assignments,
  configuration and child resources, DNS zone groups, diagnostic settings and budgets cannot carry tags.
- **Budget.** Set `budgetAmount` to the approved monthly amount (the example file has 0, meaning no budget).
  `budgetStartDate` must be the first day of a month, not before the current month. `budgetThresholds` takes
  exactly three percentages.

## 4. Acceptance runs

For an acceptance or recording run, raise `appMinReplicas` and `clamavMinReplicas` to 1 for the duration,
then set them back. With ClamAV at 0, the first upload after idle waits for the scanner to start and fails
closed until it is up. This is expected and is not evidence about the upload path.

## 5. Validation performed

- `bicep build` and `bicep lint` on `ue-v2/main.bicep`: no errors, no warnings. The root
  `infrastructure/bicep/main.bicep`, which shares `modules/postgres.bicep`, still compiles.
- `bicep snapshot` for `env=prod`: the predicted resources and outputs are identical to the snapshot
  taken before the change.
- `bicep snapshot` for `env=staging`: every value in section 2 was checked against the predicted resources.
- Checkov (the CI `iac-scan` options) on `infrastructure/bicep`: 30 passed, 0 failed, 0 parsing errors,
  1 skipped: `CKV_AZURE_206` on the storage account, because replication is now a parameter. Production
  still passes `Standard_GZRS`. Before the change: 31 passed.
- No `what-if`, no deployment and no resource-changing `az` command was run.
