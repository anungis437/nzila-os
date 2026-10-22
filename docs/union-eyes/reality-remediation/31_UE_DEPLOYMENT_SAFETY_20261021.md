# UE deployment safety — 2026-10-21

Branch `ops/ue-deployment-safety-20261021`. This change is not in PR #981. PR #981 remains the source for migration `0019_deadline_reassignment_convergence`. This branch does not contain that SQL file, so the pre-mutation gate fails closed with `MIGRATION_0019_ABSENT_FROM_CANDIDATE` until that migration is on the candidate source and this branch is rebased after an independent merge.

`UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO — RUNTIME_PROOF_REQUIRED`. `UE_RUNTIME_RLS_TENANT_ISOLATION` stays `FAIL`. `PRODUCTION_DEPLOYMENT_AUTHORIZED` stays `NO`. `CUSTOMER_DATA_EXECUTION_AUTHORIZED` stays `NO`.

## Live inventory

This environment has no Azure CLI and no signed-in subscription. The current staging revision, replica, label, and traffic inventory was not queried. That inventory is `BLOCKED_EXTERNAL_AUTHORITY`. No staging resource was changed. `CHG-2026-0112` stays proposed. A JSON field that names an approver is not an approval.

## Release sequence

`tooling/scripts/lib/union-eyes-deployment-safety.mjs` is the fail-closed decision. The deploy workflow calls it with evidence files and stops when the phase is not allowed.

1. `database-premutation-gate` needs only `plan`. Authority-only corrections, including the congress membership jobs, wait on that gate and do not wait on the image build. `release-premutation-gate` still needs the built images and comes before ICRA `0005`, scoped `0019`, Django migrations, and deploy. Neither gate applies SQL, deactivates revisions, or rewrites ingress weights.
2. Authenticated approval evidence must be an Ed25519-signed record whose status is `APPROVED`, whose approvers cover the required set, and whose body binds the source SHA, both image digests, the database baseline, the restored-clone tests, and the change record. A firewall rule is an infrastructure action in that same signed record. The workflow validates the signature before it creates the rule, and a failed deletion fails the job. Missing, unsigned, stale, mismatched, and unapproved records stop the release.
3. `showmigrations --plan` is stored as inspection output. Apply proof comes from the signed restored-clone receipt, not from that plan and not from a pass/fail flag.
4. Migration `0019` must be present in the candidate source. The workflow passes bare `--require-0019-recorded` before RLS preflight. That flag requires the file's hash to already be in `drizzle.__drizzle_migrations`. A signed schedule is not a substitute for the recorded hash.
5. The build may check out `application_source_sha` while the workflow definition runs from `github.sha`. The decision refuses that pair unless the signed approval's `twoSha` block names both commits, the executor hashes, and the journal hash, and the hashed SQL comes from the application commit. When the two SHAs are equal, no separate block is accepted.
6. On staging, the RLS step runs even when `UE_RLS_FOUNDATION_ENFORCED_STAGING` is not `true`, and that run fails. Database isolation evidence records the actual runtime connection identity, migration ledger, and a signed two-tenant synthetic fixture. It is explicitly database-only evidence. Candidate acceptance separately requires observations from the candidate label endpoint, correlated to this database evidence. An application HTTP response cannot replace the SQL isolation test.
7. Each mutation takes a new inventory read. The read id must differ from the gate read, and the traffic and revision fingerprint must match. A reused or changed inventory is stale.
8. Ingress weights are not rewritten. A labeled revision remains reachable at weight 0 or with no weight. Missing weights stay missing. The workflow does not deactivate revisions.
9. The candidate revision name and container images come from the container app update response. A revision label is added only after a fresh read and an authorization for `candidate-label`. Probes use `https://<label>.<app-fqdn>` for `/api/health`, `/api/ready`, `/api/version`, and `/api/admin/database/health`. The version body must report the release SHA and both image digests. A response from the ordinary hostname is not acceptance. Candidate ordinary traffic stays at 0 percent. Traffic promotion stays forbidden.

An active revision other than the single serving revision and the labeled candidate stops candidate acceptance. This workflow will not remove that revision or move its weight to make the check pass. Recovery from committed DDL remains an approved point-in-time restore.

## Staging evidence correction — 2026-10-21

`union-eyes-read-staging-rls.sh` delegates to the adjacent Node runner. Its arguments
are the output path, release-manifest path, signed-approval path, trust-anchor path,
and foundation value. It no longer accepts a candidate revision or a release SHA
as an asserted observation. The manifest must specify `environment: staging`.

The signed approval must contain `acceptanceFixture` with these fields:

- `fixtureId`, `environment: staging`, `synthetic: true`, and
  `allowRolledBackWriteProbe: true`.
- `databaseName` and `databaseBaseline`; the latter must equal the approved
  restored baseline in the parent approval.
- `tenantA` and `tenantB`, each with a lowercase UUID `organizationId`, `userId`,
  and `recordId`. Organizations, users, and record IDs must differ across tenants.
  Record IDs identify existing synthetic `public.grievances` records belonging to
  those organizations. The runner does not create fixtures. Provisioning them
  requires separate authorization in the acceptance environment.

Before any probe, the runner validates the approval signature, release/image
binding, approval period, and restored-clone receipt. Inside one runtime database
connection and repeatable-read transaction it refuses any effective/session user
other than `union_eyes_runtime`, or any SUPERUSER/BYPASSRLS role. It observes
`current_user`, `session_user`, `current_database()`, and the role attributes from
that connection. It checks both signed record IDs under their own organization
contexts, denies A reading B and B reading A, and requires a zero count across the
whole table with empty organization context. Empty or entirely hidden tables
cannot satisfy the two positive controls.

Two rolled-back inserts clone each authorized synthetic record into the other
organization with a new synthetic ID/number. Only an actual row-security WITH CHECK violation (SQLSTATE
42501) counts as refusal; missing table privileges, other SQL errors, zero-row
inserts, and successful inserts fail. Expected policy violations use
subtransactions; the enclosing transaction always rolls back. No staging probe
or fixture provisioning is authorized by this source change. An update alone is
not sufficient: PostgreSQL can enforce the new-row SELECT policy on updates even
when an unsafe INSERT check would admit a cross-tenant record.

Every SQL output has a named `UE_...=` frame. Each expected count must occur
exactly once and contain a nonnegative safe integer. PostgreSQL command tags are
never parsed as counts. Unexpected stdout, stderr, nonzero exit status, missing
frames, and duplicate frames fail without emitting an evidence file. Stale output
is removed before an attempted observation.

The database evidence ID hashes its body, including the approved baseline,
release SHA, synthetic fixture, observed principal, ledger hash, exact executed
SQL and its hash, results, and observation time. The release gate checks the
ledger hash and migration-0019 recorded state and refuses proof older than one
hour (or more than five minutes in the future). A database-only artifact carries
no candidate-revision or serving-revision claim.

The later candidate-label probe must report the release SHA and image digests
from `/api/version`, plus runtime and system principal identities, non-bypass
attributes, and database names from the authenticated database-health endpoint.
Its `databaseProof` correlation records the database evidence ID, baseline,
release SHA, and runtime principal. The gate matches these to the database
artifact and approved manifest; the endpoint cannot substitute for the SQL
results. Both observations are retained as workflow artifacts. Correlation
establishes matching release/database evidence; it does not claim the SQL
connection originated inside the candidate container.

Qualification commands for this correction:

```sh
node --test tooling/scripts/lib/union-eyes-deployment-safety.test.mjs
UE_TEST_POSTGRES_BIN="$(pg_config --bindir)" node --test tooling/scripts/lib/union-eyes-staging-runner.test.mjs
pnpm exec vitest run --project union-eyes apps/union-eyes/app/api/__tests__/admin-database-health.route.test.ts apps/union-eyes/scripts/rls-enforcement/__tests__/deployment-dag-contract.test.ts
```

The shell parser suite covers BEGIN/ROLLBACK tags, errors, empty/malformed values,
and duplicate result rows. The engine suite creates a disposable local database
and synthetic minimal grievance relation; it exercises policy failures and the
real runner, not the deployed schema or staging. The shared CI lane runs both
Node suites. Existing signed approval, two-SHA source binding, immutable ingress,
and migration-0019 requirements remain in force. Source/local qualification does
not close the runtime-proof queue. Independent merge of #981 and subsequent
normal integration/requalification of #982 are still required.
