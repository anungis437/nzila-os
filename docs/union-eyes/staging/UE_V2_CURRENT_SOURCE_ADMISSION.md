# Current-source staging schema admission

The previous generator deliberately retained an older hash for the organization
switch route. That allowed deterministic plan regeneration to pass while the
committed source did not match the current file. A strict export rejected it.

The plan now binds the actual switch-route bytes, and the plan CLI checks every
repository source commitment. Python module commitments remain verified through
the pinned interpreter and hash-locked wheelhouse. The regression test admits
the current bytes and proves that a tampered commitment is refused. Source
admission does not imply execution or staging qualification.

Regeneration retained 771 tables, 6,255 statements and identical schema SQL;
source and derived provenance digests changed. The local-only schema exporter
provides a reproducible current-plan path instead of the removed historical
helpers. It requires a clean committed source tree and empty absolute output
directory, verifies the plan twice, checks real native PostgreSQL catalog and
privilege contracts, and checks the receipt-backed repeat NOOP. It writes no
application login passwords and cannot connect to staging or production.

## Verified staging identity

The owner directed reuse of verified existing staging credentials. The active
legacy staging app and Entra token verification identify application
`c0a29862-9432-4b54-bb25-796ff987091f` in tenant
`5082b8be-b04d-4a13-b61c-b6397670177b` (`union-eyes-staging-auth`). The V2 vault's
`azure-ad-client-secret` is that verified staging credential. It is independent
of the Azure resource subscription's tenant.

The staging parameter files now supply those public identifiers. Runtime reads
the secret by managed identity, restricts staging login to the configured
tenant, and uses the existing 900-second staging session policy. Build
environment variables were aligned to the same registration. The V2 app's
stable HTTPS Entra callback was added without removing any existing callback:

`https://nzila-ue-v2-staging-app.whitemoss-055b7430.canadacentral.azurecontainerapps.io/api/auth/callback/microsoft-entra-id`

No production registration, secret, resource or deployment was changed.
Production's optional identifier defaults remain empty. Real deployed Entra
sessions and all remaining Phase 3A proofs are still required for `STAGING_GO`.

## Operator credential boundary

Staging workload deployment grants the application identity read access only to
the named runtime secrets, not the whole vault. `pg-admin-password` and generated
operator/login bootstrap password secrets are excluded. Production retains its
existing vault role scope. The infrastructure-only pass does not add workload
secret grants before the database bootstrap completes.

When adopting this change on a partially provisioned staging stack, first create
the named runtime-secret grants and remove the old vault-wide Secrets User
assignment for the staging app identity. Incremental deployment does not remove
that old assignment automatically. Verify that required runtime secret reads
succeed and operator-password reads are denied before storing operator
credentials. Temporary operator grants remain vault-scoped and are removed after
bootstrap; no permanent write access is given to the application identity.

The private check in `evidence/ue-v2-private-db-bootstrap-20261110.json` recorded
runtime-secret HTTP 200 and operator-password HTTP 403 after replacing the old
vault-wide app read grant with named secret scopes. Four generated password
secrets were created without logging their values, and the protected
`UE_V2_STAGING_DB_ADMIN_PASSWORD` workflow secret was synchronized through an
ephemeral encrypted transport. Temporary operator access was removed and the
scanner's prior scale was restored. These are password-preparation receipts;
they do not claim that the PostgreSQL server or its login roles already exist.

## Native export evidence

`evidence/ue-v2-current-export-20261110.json` records the measured local export:
23,849 catalog objects, equal reference/installed catalogs, a receipt-backed
repeat NOOP and zero native privilege mismatches. This is local qualification
only. The export's application-source SHA, pinned image, source-plan/catalog
digests and file hashes must be recorded again against the accepted candidate
before a staging restore. The time-column verifier normalizes SQL `time` to
PostgreSQL's `time without time zone` while preserving timezone/precision
differences. The current plan has no vector extension and the restore transform
explicitly verifies its absence.

The final native check also restored the emitted SQL into a third fresh database
through the protocol-only adapter, then verified the catalog, native privilege
contract and receipt-backed repeat NOOP again. Client commands other than one
matched pg_dump guard pair are refused; SQL before/after guards is refused.

The versioned catalog digest normalizes only lossless PG16 dump representations:
ACL entry order, implicit versus explicit owner-only table defaults, and a
specific varchar-array-to-text-array cast distribution in constraints, indexes
and policies. It preserves grantors, grant options, ownership, RLS flags,
function bodies and every policy literal/operator. Negative regressions prove
that public grants, BYPASSRLS, tenant-predicate changes and role-literal changes
remain different. No object was missing or extra in the measured round trip.
