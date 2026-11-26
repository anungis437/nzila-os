# Union Eyes V2 Step 2 deployment and data plan

This plan prepares a preserving transition. It does not apply one.

`STAGING_GO = HELD`

`PRODUCTION_GO = HELD`

`UE_SAAS_OPERATIONAL_READINESS = NO_GO`

`fullReadiness = NOT_YET_PROVEN`

`STEP_2_ENGINEERING_COMPLETE = NO`

`STEP_2_ACCEPTED = NO`

`STEP_2_PLANNING_COMPLETE = YES` for the planning package only.

## Source lineage

| Artifact | Identity | What S2.00 actually observed |
| --- | --- | --- |
| Step 1 head | `b00a3624619be09aa77cd201fa7fe8a8c16b21f3` | Local `HEAD` and open draft PR #1309. Not an ancestor of `origin/main`. |
| `origin/main` | `97cd90fb029af07dbfcbf4455c1068acfd6e1cb8` | Merge of PR #1307. Repository observation only. |
| Deployment pin | `6a60c95c9de17e9343e0414bb51766afbc190054` | `tooling/scripts/lib/ue-v2-staging-candidate.json` on this branch. |
| Image built for that pin | `nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2@sha256:2bf18216fda45d71395b6396ec65b3974745f5446696d378f6ea6d37fe2e67ef` | Historical, build `45214964440`, in the operator binding. Not reread from the registry in S2.00. |
| ClamAV image in that binding | `sha256:8a46b4ff234bc0840cf89e19f706005fce2f4dd8fe86fa03980eca3ee3b07715` | Historical. |
| Cron image in that binding | `sha256:5a91ea0c9c3ee27b4abe657b68cf6bf0676afa13b236b3bda34283cb3924d4f6` | Historical. |
| Source plan in that binding | `6ec71d4631810207ffad4e5b78046be219528d27608a3da13170f3bb96c41161` | Historical. S2.01 must compare the merge commit's plan before binding. |
| Workflow that deploys | `.github/workflows/ue-v2-staging-deploy.yml` | App `nzila-ue-v2-staging-app`, group `nzila-canada-staging-rg`. What-if refuses deletes. Traffic starts at zero. Promotion is a separate step. |
| Forward upgrade and rollback | `.github/workflows/ue-v2-staging-forward-upgrade.yml`, `.github/workflows/ue-v2-staging-rollback-rehearsal.yml` | The execution path for S2.02. Not launched by S2.00. |

## Serving identity is CONFLICTED_HISTORICAL

S2.00 made no Azure call. Fresh observation is `UNEXECUTED`.

Two historical receipts disagree:

- `docs/union-eyes/staging/evidence/ue-v2-forward-upgrade-20261122/operator-binding-6a60c95c.json`, recorded `2026-11-23T16:38:17Z`, says serving source `cccfc8c311a1017f80241bf089c00ef0c6828751` and `actualStagingApply` `NOT_LAUNCHED`. The same day's remaining-work note says rehearsal `45140991614` failed the retained audit-grant admission and that no apply was launched.
- `docs/union-eyes/staging/evidence/ue-v2-forward-upgrade-20261122/document-family-remediation-20261123.json`, recorded `2026-11-24T00:41:59Z`, sets `currentlyServingApplicationSourceSha` to `6a60c95c9de17e9343e0414bb51766afbc190054`. That object does not contain a revision name, a traffic weight, or the command that observed it.

Neither receipt is the current environment. S2.02-PREIMAGE reads `az containerapp revision list` for `nzila-ue-v2-staging-app` and records revision, traffic, image digest and source label. Until that file exists, no rehearsal and no apply starts.

File 26 names a different app, `nzila-os-union-eyes-staging`, revision `0000142`, image `sha256:9deb89a1898c2454f8b65853651944ed193f05a46b4f1a661e600f7e599f4eff`, source `0a2c9fa0b`, and an RLS failure. That is a September 2026 ledger. It is not the V2 preimage and it is not a claim that the V2 database is repaired.

## Database preimage

The preimage is read-only. It records PostgreSQL version, installed migrations, table owners, ACLs, RLS enablement, application-role attributes (`BYPASSRLS` included), sequences, and business row counts. Historical rehearsals already showed three facts that the next rehearsal must still prove rather than assume:

- The managed administrator has had `BYPASSRLS` while the operator fixture required `NOBYPASSRLS`.
- Retained `audit_security.audit_logs` still had runtime `SELECT`/`INSERT` when the current contract withdraws both. Rehearsal `45140991614` failed there. No apply followed.
- Function-owner and catalog rehearsals failed, rolled back, and matched the prior catalog object count. A failed rehearsal is not a successful upgrade.

No-delete means no `DROP`, `TRUNCATE`, or business-table delete in the upgrade. Temporary grants come off before the candidate is called healthy. Forward recovery keeps the upgraded data and moves to the qualified application. It does not restore by emptying the database. If the committed upgrade cannot start the candidate, the stop is a forward fix or a rehearsed rollback, not a silent rebuild.

## Legacy topology gate

Disposition carried from Step 1: `OUTSIDE_STEP_1_WITH_TRACKED_DEPENDENCY`.

Step 2 applicability: `APPLICABLE_UNTIL_DISPROVEN`.

The four cases live in `apps/union-eyes/db/__tests__/current-security-installer.native.test.ts` and in `tooling/scripts/lib/ue-native-expected-skips.json`. They are not passes. The test refuses a database that already contains `user_management.auth_business_org_authorized(uuid,text[])`. It needs a database named `ue_*`, owned by `uev2admin`, with the event trigger `ue_guard_deadline_reassignment_convergence_policy` owned by `uev2admin`, and an authentic `UE_CURRENT_SECURITY_LEGACY_OWNER_URL`. The only GitHub release `v1.0.0` does not supply that database.

S2.02-LEGACY-GATE uses the fresh preimage:

- If the preimage lacks the current security function topology, all four cases run on authentic historical provenance before this transition. A current-schema bootstrap is not a substitute. The Step 1 exclusion does not authorize the upgrade.
- If the preimage already has current topology, the four cases stay tracked for a later restore of an older database. They are still not passes, and they do not block this particular forward move.

The owner is `team-union-eyes-engineering@nzila.ai`.

## Identity, storage and workers

Entra, Redis, storage, Key Vault, the email provider and the ClamAV adapter are external dependencies named by CHG-2026-0114 and the operator binding. S2.00 did not reread those resources. S2.04 and S2.06 observe the serving revision's real sessions, inbox and workers. A synthetic QA cookie is not an Entra session. A queued invitation is not provider delivery.

## Authorization boundary

CHG-2026-0114 is founder-operated staging authority for the candidates it names. It is not a standing approval for `b00a362` or for the merge commit that will follow PR #1309. S2.01 waits for founder merge approval. S2.03 waits for a separate founder apply approval. The deploy workflow's `ue-staging` environment checkpoint remains the apply gate. Production, customer-data mutation outside the preserving upgrade, finance activation and mandate issuance stay closed.

O09 and O10 are deferred and are not part of this deployment.
