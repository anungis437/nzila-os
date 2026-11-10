# Controlled staging apply 42774059371

Date: 2026-11-10. Change: `CHG-2026-0114`. Candidate:
`884391997bb797637615361f2782697604d6d973`.

PR [#1163](https://github.com/anungis437/nzila-os/pull/1163) merged as
`049a8f91ee546925a4cde589feddc72267a64294` after 110 passing checks and nine skips.
Read-only [what-if 42772826430](https://github.com/anungis437/nzila-os/actions/runs/42772826430)
passed. Controlled [apply 42774059371](https://github.com/anungis437/nzila-os/actions/runs/42774059371)
passed its plan, change-record, image attestation, fresh what-if, change-window,
protected environment and drift gates, then failed during resource creation.
The environment checkpoint recorded delegated founder operation, not independent review.

The reviewed and fresh what-if fingerprint was
`cfcaebca85708791f357f17d15f4cb39feb93bfe12539c1f1f56a5fd4a037409`.
The deployment artifact is `ue-v2-staging-deployment-42774059371`.

## Observed failures

- PostgreSQL returned `ServerEditionIncompatibleWithSkuSize`. The module correctly
  classified `Standard_B1ms` as Burstable for HA and configuration, but primary and
  replica SKU tiers still tested the obsolete `B_` prefix. Both tier expressions
  now use the existing `isBurstable` classifier.
- The app returned `ContainerAppOperationError`: its managed identity could not
  resolve Key Vault references, including database, auth, Redis, storage, cron,
  voting, MFA and Resend secrets. This error alone does not distinguish missing
  secrets, permissions, network reachability or propagation.
- A metadata-only secret-list attempt from the operator host returned
  `ForbiddenByConnection`: the vault has public network access disabled and this
  host does not use its approved private endpoint. No secret values were read.

## Required next steps

1. Merge and build the corrected infrastructure candidate through normal CI;
   bind its exact SHA through the existing staging authorization process.
2. Complete and verify secret bootstrap from an approved private network path,
   following `docs/union-eyes/production/UE_NEW_SUBSCRIPTION_STAGING_PLAN.md` S3
   and the V2 README. Verify secret names/versions, managed identity access and
   private DNS/connectivity. Preserve vault privacy and use actual staging
   credentials; do not substitute production secrets or placeholder receipts.
3. Run a new reviewed what-if and controlled apply. A successful preview does
   not prove secret resolution or successful resource provisioning.
4. Qualify deployed revision identity, database bootstrap and migrations,
   tenant isolation, real Entra sessions and the remaining Phase 3A runtime proof.

`STAGING_NO_GO` remains in effect. Partial resource creation is not runtime
acceptance. No production action or Phase 3B authorization is recorded here.

## Validation of the tier correction

- `az bicep build --file infrastructure/bicep/modules/postgres.bicep` passed.
- Existing staging release and census test suites: 15 passed, zero failed.
