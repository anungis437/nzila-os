# Final V2 acceptance: superseded key-authority blocker

**Verdict: FAIL. No final acceptance or final coherent candidate is qualified.**
The [source-bound JSON report](UE_V2_FINAL_V2_ACCEPTANCE_BLOCKERS.json) contains
exact hashes, observations, commands and evidence limitations.

## Current disposition

The prior irreducible/product-owner key-authority claim below is **disproven and
superseded**, not an active blocker. An owned HTTPS vault and identity wire-protocol
fixture executes the real Azure SDK with normal certificate validation,
authenticated challenges, no SDK mocks and no fallback key. Production provisioning
remains an external gate; locally executable engineering does not.

The discovered production custody defect is fixed prospectively: each AES-GCM
ciphertext now carries its RSA-OAEP-256 wrapped data key and exact vault key version.
Fresh process decryption succeeds for both original and rotated ciphertext; old
versions remain in the vault rather than depending on a process-local AES cache.
Untrusted vault identifiers and modified ciphertext are denied. Historical vault
ciphertext lacking a wrapped key is explicitly refused: a lost process-random AES
key cannot be recovered or invented.

`pnpm --dir apps\union-eyes exec vitest run scripts\bootstrap-v2\local-vault-fixture.test.ts scripts\bootstrap-v2\connection-environment-surface.test.ts scripts\bootstrap-v2\next-acceptance.test.ts lib\__tests__\encryption.test.ts --reporter=json --outputFile=..\..\artifacts\ue-v2-durable-custody-tests.json`
passed **39/39 tests across four files, zero failures/skips**. The current production
encryption digest is `0e7d048a2c0ccbe801210531a126e0913a5f368d93a8c23179f71715440c4847`;
the accepted fixture observed two authenticated identities, two wraps, six unwraps
and one rotation. All owned identity/vault listeners exited and their state was
removed. Re-encryption decisions follow durable key identifiers after restart,
not process-local numeric versions. Legacy envelopes without wrapped keys are
denied. This is custody/provider proof, not
the complete HTTP/caller/finance acceptance.

Strict application validation:

- `pnpm --dir apps\union-eyes exec tsc --project scripts\bootstrap-v2\application-typecheck.json --incremental false` — passed.
- `pnpm --dir apps\union-eyes exec tsc --noEmit --incremental false` with
  `NODE_OPTIONS=--max-old-space-size=12288` — passed. The first default-heap
  attempt exhausted memory; the subsequent run exposed and fixed a missing
  wrap-response identifier check before the final successful run.
- Scoped ESLint on encryption and the three edited fixture/environment test
  files — passed with `--max-warnings 0`.

The newer actual Next receipt
`artifacts/ue-v2-next-receipt-b6e21f46-521c-44db-86ff-d00fb42d0316.json`
records build exit 0, runtime readiness and `/api/version` HTTP 200, observed
loopback transports and owned cleanup. It still records `serverRuntimeSmoke =
NOT_PROVEN`, warnings and whole acceptance FAIL. Subsequent custody fixes require
a new coherent build/regression; no proof is transferred between candidates.

## Historical rejected blocker (preserved verbatim below)

| Required field                                | Evidence                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SOURCE_PATH                                   | `apps/union-eyes/lib/encryption.ts:120–251`; SHA-256 `dce36b1ec4db0d0d4bfd860920272abb914acfd5c0744fb16a8ff77bfa4486a2`                                                                                                                                                                    |
| CALLER                                        | `POST /api/enterprise/sso/providers`, `route.ts:93`: a non-empty `oidcClientSecret` awaits `encryptSecret` before `db.insert(ssoProviders)` at line 97                                                                                                                                     |
| ACTOR                                         | Authenticated organization admin or higher, with canonical user/live authorized organization context; organization and creator are bound from handler context                                                                                                                              |
| DATABASE_SCOPE                                | Operational Union Eyes `public.sso_providers` INSERT, specifically `oidc_client_secret`; not the standalone financial database                                                                                                                                                             |
| EXPECTED AUTHORITY                            | Production encryption requires Azure Key Vault/`DefaultAzureCredential`; environment and test fallback keys are forbidden                                                                                                                                                                  |
| OBSERVED BEHAVIOR                             | Executing the genuine current `encryptSecret` source under `NODE_ENV=production` refuses both absent-vault and synthetic-fallback configurations                                                                                                                                           |
| WHY LOCAL IMPLEMENTATION CANNOT SAFELY FIX IT | Using Azure violates this mission's restrictions; fallback, a test environment, mocked SDK, or skipped encryption would change a mandatory control. The source supplies no approved alternative production key-custody/identity contract                                                   |
| REQUIRED PRODUCT-OWNER DECISION               | Specify and approve a non-Azure production-grade key-authority backend and local qualification contract: authenticated key access, durable custody, versioned decryption, rotation, audit and scope separation. Retain the no-fallback control; no harness-only bypass or caller exclusion |

The observed error is:

> Azure Key Vault initialization failed in production environment. Please verify
> AZURE_KEY_VAULT_URL and Azure credentials are configured correctly.

The immutable acceptance contract requires `NO_EXTERNAL_SECRET_STORE`, zero
external connection targets, and no disabling mandatory security controls.
No Azure resource was accessed, no production/staging/customer database was used,
and no new key authority was invented or represented as approved.

## Executed evidence and locally closable caller defect

The current encryption function was executed in isolated production Node
children, with sanitized environment and the real source-bound transport
preload. Test results and observed errors are persisted in:

- `artifacts/ue-v2-production-key-authority-absent.json`
- `artifacts/ue-v2-production-key-authority-fallback-refused.json`
- `artifacts/ue-v2-production-key-authority-and-caller-tests.json`

**18/18 tests passed, three files, zero skips.** The two production encryption
refusals execute real source. The ten SSO route tests are dependency-isolated
unit regressions, not production HTTP/actor/database qualification.

Tracing the exact caller also exposed a local engineering defect: `withApi`
already consumes mutation JSON, but SSO POST consumed the same request again.
The handler now uses `ctx.body`, rejects an absent/non-object body, preserves
canonical organization/creator attribution and credential redaction, and does
not insert when encryption refuses. A consumed real `Request` regression
verifies that body is not read twice.

The exact targeted Vitest command, scoped zero-warning ESLint command, official
application typecheck, and strict acceptance typecheck all passed. Commands and
results are recorded in the JSON report.

`pnpm validate:docs` also passed: 2,657 files scanned, zero critical errors,
1,218 warnings and 1,704 informational findings. That result is not a claim
that all repository documentation warnings have been resolved.

## Actual Next attempt: historical, not current acceptance

The owned production webpack attempt
`692b860b-c466-427a-a137-3f5d4d80fd19` built successfully with original licensed
local Poppins assets, then logged Next readiness. Its initial HTTP probe timed
out after ten seconds. Its verdict remains **FAIL**; startup instrumentation,
authenticated HTTP, warnings, callers, actors and finance were not qualified.
The archive retains the observed production Key Vault initialization errors.

- Source snapshot: `4194f878c31acde62fbb54f8903cad09f150ad068578bb32f9ac4a9f1519950c`
- Build artifacts: `d299b9ef4464d1c433e93890bbb3a333a3835beda23ca2be82ef58dab8fedcd9`
- Build exit: `0`
- Owned child exited; owned snapshot removed; cleanup errors: zero.
- Independent Docker ownership-label query returned zero runtime fixtures.

Subsequent transport-observer/caller/configuration edits are **not** covered by
that production attempt. Its initialized zero external-target field was not an
observed counter and must not be treated as isolation proof.

The current observer records source-bound child loading and individual
allowed/denied Node transports, rejects unowned named pipes and invalid ports,
and passes real child/worker isolation tests. It explicitly does **not** prove
OS confinement of native binaries/arbitrary executables. The probe budget is
now 120 seconds with a required HTTP 200 assertion; no new production attempt
has qualified these edits.

The full caller inventory, actor map, financial scope qualification and final
full-regression/source-digest closure are not asserted by this report. Their
uncompleted work is **not** being labeled an external gate or used as the
specific blocker.
