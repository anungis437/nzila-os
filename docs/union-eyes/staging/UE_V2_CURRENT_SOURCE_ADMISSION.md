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
