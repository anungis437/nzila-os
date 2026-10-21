# UE deployment safety — 2026-10-21

Branch `ops/ue-deployment-safety-20261021`. This change is not in PR #981. PR #981 remains the source for migration `0019_deadline_reassignment_convergence`. This branch does not contain that SQL file, so the pre-mutation gate fails closed with `MIGRATION_0019_ABSENT_FROM_CANDIDATE` until that migration is on the candidate source and this branch is rebased after an independent merge.

`UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO — RUNTIME_PROOF_REQUIRED`. `UE_RUNTIME_RLS_TENANT_ISOLATION` stays `FAIL`. `PRODUCTION_DEPLOYMENT_AUTHORIZED` stays `NO`. `CUSTOMER_DATA_EXECUTION_AUTHORIZED` stays `NO`.

## Live inventory

This environment has no Azure CLI and no signed-in subscription. The current staging revision, replica, label, and traffic inventory was not queried. That inventory is `BLOCKED_EXTERNAL_AUTHORITY`. No staging resource was changed. `CHG-2026-0112` stays proposed. A JSON field that names an approver is not an approval.

## Release sequence

`tooling/scripts/lib/union-eyes-deployment-safety.mjs` is the fail-closed decision. The deploy workflow calls it with evidence files and stops when the phase is not allowed.

1. `release-premutation-gate` runs after the images exist and before every database mutation, including ICRA `0005`, scoped `0019`, Django migrations, and the historical migration jobs. The gate reads ACR digests and OCI labels, ingress traffic, revision state, `pg_roles`, and `drizzle.__drizzle_migrations`. It does not apply SQL, deactivate revisions, or rewrite ingress weights.
2. Authenticated approval evidence must be an Ed25519-signed record whose status is `APPROVED`, whose approvers cover the required set, and whose body binds the source SHA, both image digests, the database baseline, the restored-clone tests, and the change record. Missing, unsigned, stale, mismatched, and unapproved records stop the release.
3. `showmigrations --plan` is stored as inspection output. Apply proof comes from the signed restored-clone receipt, not from that plan and not from a pass/fail flag.
4. Migration `0019` must be present in the candidate source. It must already be in the ledger or be scheduled through `applyScopedMigrations` before RLS preflight. The RLS preflight command does not run until the ledger contains that file's hash.
5. Each mutation takes a new inventory read. The read id must differ from the gate read, and the traffic and revision fingerprint must match. A reused or changed inventory is stale.
6. Ingress weights are not rewritten. A labeled revision remains reachable at weight 0 or with no weight. Missing weights stay missing. The workflow does not deactivate revisions.
7. The candidate revision name and container images come from the container app update response. A revision label is added only after a fresh read and an authorization for `candidate-label`. Probes use `https://<label>.<app-fqdn>` for `/api/health`, `/api/ready`, `/api/version`, and `/api/admin/database/health`. The version body must report the release SHA and both image digests. A response from the ordinary hostname is not acceptance. Candidate ordinary traffic stays at 0 percent. Traffic promotion stays forbidden.

An active revision other than the single serving revision and the labeled candidate stops candidate acceptance. This workflow will not remove that revision or move its weight to make the check pass. Recovery from committed DDL remains an approved point-in-time restore.
