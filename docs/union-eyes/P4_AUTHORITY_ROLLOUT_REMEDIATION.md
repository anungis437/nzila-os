# Union Eyes P4 Authority Rollout Remediation

## Status

- P3.2 migration correctness is complete at reviewed SHA `020d6ef4d0b3e82aad63d951b1297df4d04a0701`.
- The first P4 activity was a read-only production preflight. It ended `NO_GO`; no production SQL, DDL, DML, workflow rollout, application deployment, secret change, or merge occurred.
- The preflight exposed three rollout-architecture gaps: the migration credential was absent, production accepted only `main`, and the ordinary deployment workflow coupled authority inputs to application deployment.
- P4 remediation baseline: `P4_READY_FOR_REVIEW`.
- This disposition means the authority-only source baseline is ready for independent review. It does not authorize or perform production rollout.
- `UE_SAAS_OPERATIONAL_READINESS` remains `NO_GO — RUNTIME_PROOF_REQUIRED`.

## Authority-only workflow

`.github/workflows/union-eyes-authority-rollout.yml` is the sole executable P4 authority path. It accepts one required operation value, `p4_authority_rollout`, plus the independently authorized full commit SHA. It runs only against the protected `production` GitHub Environment and only from `refs/heads/main` when `github.sha` exactly equals the authorized SHA.

The workflow performs a read-only production identity and database census before this fixed success-only chain:

1. authority schema prerequisites;
2. automation-rules ownership migration;
3. RLS foundation migration;
4. authority enforcement migration;
5. Round 58 grant-order correction;
6. Round 59 geometry-gap closure;
7. independent read-only post-mutation attestation.

It contains no image build, registry push, ordinary application migration, Container App update, traffic operation, revision activation, or restart. The former six P4 jobs in the ordinary deployment workflow are unreachable and their dispatch inputs have been removed.

## Production credential contract

Credential provisioning is a separate, auditable Azure administrative action and is not performed by this remediation.

| Requirement | Contract |
|---|---|
| Secret name | `union-eyes-migration-admin-database-url` |
| Key Vault | `nzila-canada-prod-kv` |
| URI | `postgresql://<migration-role>:<secret>@nzila-os-union-eyes-prod-db.postgres.database.azure.com:5432/nzila_os_prod?sslmode=require` |
| Database authority | Only the privileges required by the reviewed Django schema migrations, role/RLS foundation, authority enforcement, grant correction, and geometry closure |
| Workflow access | Production GitHub OIDC deployment identity receives Key Vault data-plane `get` access scoped as narrowly as Azure permits |
| Runtime access | The Union Eyes Container App identity and runtime configuration must not receive this secret or permission to read it |
| Rotation | Production database/platform owner provisions, rotates, revokes, and records the secret under change control |
| Handling | Process-local only; mask immediately; never write to workflow outputs, environment files, artifacts, summaries, application configuration, or logs |

Before authorization, an administrator must prove secret metadata exists and that the workflow identity can retrieve it without revealing the value. Application identity access must be independently shown absent.

## Mainline promotion sequence

Production's `main`-only Environment policy remains mandatory. The prior requirement to obtain production proof before merge is superseded by this sequence:

1. independently approve P3.2 and this P4 remediation;
2. merge the reviewed changes to `main` through normal branch protection;
3. freeze the resulting main SHA and verify all required CI on that SHA;
4. independently review and explicitly authorize that exact main SHA;
5. provision and verify the migration credential through a separate audited change;
6. dispatch the authority-only workflow with `operation=p4_authority_rollout` and `authorized_sha=<frozen-main-sha>`;
7. allow the read-only census to produce `GO` or stop `NO_GO` before mutation;
8. only on `GO`, allow the fixed authority chain and post-mutation attestation to complete.

Any ref, SHA, subscription, resource group, Container Apps environment, runtime app, PostgreSQL server/host/database, Key Vault, credential, migration-ledger, or schema-geometry mismatch stops before the first authority mutation. The historical drill server cannot satisfy the positive production-server assertion.