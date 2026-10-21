# UE deployment safety — 2026-10-21

Branch `ops/ue-deployment-safety-20261021`, created from `origin/main` `596ef6b2ab6eb9745bd8c10e44ebc6cca4c0944d`. This change is not in PR #981.

`UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO — RUNTIME_PROOF_REQUIRED`. `UE_RUNTIME_RLS_TENANT_ISOLATION` stays `FAIL`. `PRODUCTION_DEPLOYMENT_AUTHORIZED` stays `NO`. `CUSTOMER_DATA_EXECUTION_AUTHORIZED` stays `NO`.

## Live inventory

This environment has no Azure CLI and no signed-in subscription. The current staging revision, replica, label, and traffic inventory was not queried. That inventory is `BLOCKED_EXTERNAL_AUTHORITY` until an authorized `az containerapp revision list` runs inside the deployment workflow. No staging resource was changed.

## Release sequence

`tooling/scripts/lib/union-eyes-deployment-safety.mjs` is the fail-closed decision. The deploy workflow calls it and then stops.

1. Inventory active revisions. After the rehearsal record is present, deactivate active revisions whose traffic weight is 0 before any database migration. Leave the single serving revision in place. An unauthorized dispatch fails before that deactivation.
2. Require frontend and backend image digests to be `sha256` values resolved from the release source SHA. Both image builds set `org.opencontainers.image.revision` to that SHA.
3. Run `manage.py showmigrations --plan` and require restored-clone rehearsal evidence before `manage.py migrate`. The rehearsal record must name a change record, a human approver, and point-in-time restore as the recovery method.
4. Refuse `nzilaadmin`, `union_eyes_runtime`, `union_eyes_system`, and any `BYPASSRLS` or superuser migration role.
5. Pin ingress to the serving revision, then create the candidate. The candidate is not given traffic.
6. Probe that candidate with `x-ms-container-app-revision`. A request to the stable ingress is not acceptance.
7. A failed migration, image check, tenant-isolation check, or health probe stops the release. Traffic is not promoted. A traffic change is not recorded as recovery for committed DDL.

`allowTrafficPromotion` is always false. `workflow_dispatch` with the emergency acknowledgement is not change authorization. `CHG-2026-0112` stays proposed. Phase 3B stays closed.
