# Corrected Stage 2A Phase 1 inventory

Mission: `NZ-20261008-INFRA-001`  
Slice: `G2_STAGE2A_PHASE1_INVENTORY_RETRY`  
Disposition: **`STAGE2A_PHASE1_INVENTORY_PROVEN`**

| Contract | Result |
|---|---|
| `STAGE2_BUILD_TOOLCHAIN` | `MISSING` |
| `CUSTOMSCRIPT_EXTENSION_PRESENT` | `NO` |
| `PHASE1_CORRECTED_RETRY_AUTHORITY_CONSUMED` | `YES` |
| `PROTECTED_INFRASTRUCTURE_UNCHANGED` | `YES` |
| `RESOURCE_COUNT` | `16` |
| `STAGE1_EVIDENCE_CHAIN_VERIFIED` | `YES` |
| `PRIVATE_ACR_DNS` | `PASS` |
| `PRIVATE_ACR_HTTPS` | `PASS` |
| `BUILDER_IMDS_TARGETED_TOKEN` | `PASS` |
| `OVERALL_G2` | `FAIL` |

## Concurrency and scope

Branch `g2/synthetic-health-source`, HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27` unchanged. Existing untracked
infrastructure/evidence trees observed; no tracked foreign changes reverted,
committed or dispositioned. No product-domain source touched.

Subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3`, tenant
`5082b8be-b04d-4a13-b61c-b6397670177b`, existing Canada Central proof group.
Pre-validation, immediate pre-execution and final raw estate/roles compared
against final Stage 1 state, excluding only `etag` and `systemData`.

## Version and payload authority

Current regional image listing proves CustomScript `2.1` family available.
Publisher `Microsoft.Azure.Extensions`, type `CustomScript`,
`typeHandlerVersion=2.1`, `autoUpgradeMinorVersion=false`,
`enableAutomaticUpgrade=false`.

Azure selects Patch.Hotfix within Major.Minor 2.1 at deployment; exact patch
is not pinned by source. Instance view reports 2.1; no more-specific running
package version is claimed.

Before review, previous corrected source bytes were preserved. A concrete
scope defect was removed: previous inventory requested ACR `pull,push` token.
This retry makes no ACR exchange/token request and no push authentication.
It requests only targeted IMDS metadata/token, examines safe identity claims
in memory and performs an unauthenticated private ACR `GET /v2/`.

Explicit DNS/HTTPS statuses and no-write/auth-flow regressions bind this narrower
contract. Source, tests, embedded raw script bytes, resolved settings, Bicep
template and parameters are covered by fresh [source authority](G2_STAGE2A_RETRY_SOURCE_AUTHORITY.json).
All old failed-attempt evidence remains unchanged.

## Validation

- Inventory tests: **12 PASS**, zero skipped.
- Bicep build and lint: **PASS**.
- `git diff --check`: **PASS**.
- Governed validation workflow/core helper: **PASS**.
- Fresh provider validation: **PASS**, saved separately from failed candidate.
- Fresh structured FullResourcePayloads what-if: exactly **one intended child
  Create**, sixteen Ignore records, no Modify/Delete/Unsupported.
- The helper's summary duplicates the Create count; the raw resource records,
  not the summary, were execution authority.
- Current policy context unchanged; no policy error from fresh validation.

The source regression initially matched the allowed IMDS `oauth2` path;
it was narrowed to ACR endpoint scope before authority binding. No failed
local check was used as execution permission.

## Single corrected execution

- Deployment: `g2-stage2a-inventory-retry-20261011-005512`.
- Correlation: `66796730-fb41-446f-9e0f-f29b124cad8a`.
- State: `Succeeded`.
- Authority consumed before Create; no further corrected retry.
- Exactly one complete sanitized inventory result marker.

| Tool | Observation | Resolved path | Version |
|---|---|---|---|
| shell | PRESENT | `/usr/bin/sh` | POSIX shell path observed; numerical version not established |
| Python | PRESENT | `/usr/bin/python3` | 3.12.3 |
| curl | PRESENT | `/usr/bin/curl` | 8.5.0 |
| Go | MISSING | none on execution PATH | none |
| Docker | MISSING | none on execution PATH | none |
| Podman | MISSING | none on execution PATH | none |
| Buildah | MISSING | none on execution PATH | none |
| Skopeo | MISSING | none on execution PATH | none |
| ORAS | MISSING | none on execution PATH | none |
| Azure CLI | MISSING | none on execution PATH | none |

These are executable availability observations in the root execution context,
not an exhaustive scan of arbitrary paths or package-cache capability.
Guest reports Linux/x86_64, kernel `6.17.0-1022-azure`; no additional userland
version is inferred. Temporary workspace writable, 30,427,054,080 bytes free.

Private registry DNS resolved only to `10.90.2.5`. HTTPS connection pinned to
that IP used registry SNI and normal certificate verification; HTTP 401 is
the expected unauthenticated registry challenge. IMDS returned HTTP 200 for
the exact builder client; client/principal/tenant claims matched in memory.
No ACR token exchange or repository-scope issuance occurred.

Package database/APT/resolver before/after SHA-256:
`14a842cd6529f89932f59e02abd00a90febb23eb2387094e15307878678287bb`.
This sampled package/configuration state is unchanged; it is not a claim
that extension logs/cache or the whole guest filesystem remained unwritten.

## Retirement and containment

Removed only `nzila-g2-stage2a-inventory` after terminal success. No other
extension or resource deleted. Raw final estate returns to sixteen protected
resources; builder-only UAMI attachment and roles unchanged. No Stage 1 rerun.

Plan/subscription and exact child-removal confirmation tools were attempted;
user was unavailable. Actions remained within the explicit corrected
create/execute/retire packet. No broader permission inferred.

No packages installed/updated, no build/push, no cross-repository test,
no runtime identity proof, no SSH, no Run Command and no Stage 2B.
No token bodies or raw stdout/stderr persisted.

## Evidence

- [Handler family and settings](G2_STAGE2A_RETRY_HANDLER_CONTRACT.json)
- [Baseline](G2_STAGE2A_RETRY_BASELINE.json)
- [Provider validation](G2_STAGE2A_RETRY_PROVIDER_VALIDATION.json)
- [Raw what-if](G2_STAGE2A_RETRY_WHATIF_RAW.json)
- [Pre-execution gate](G2_STAGE2A_RETRY_PRE_EXECUTION_GATE.json)
- [Deployment](G2_STAGE2A_RETRY_DEPLOYMENT_RESULT.json)
- [Operations](G2_STAGE2A_RETRY_OPERATIONS.json)
- [Sanitized inventory](G2_STAGE2A_RETRY_INVENTORY_RESULT.json)
- [Retirement](G2_STAGE2A_RETRY_EXTENSION_RETIREMENT.json)
- [Final estate](G2_STAGE2A_RETRY_FINAL_ESTATE.json)
- [Final disposition](G2_STAGE2A_RETRY_FINAL_DISPOSITION.json)
- [Next prerequisite/Phase 2 proposal](G2_STAGE2A_RETRY_NEXT_AUTHORITY_PROPOSAL.md)
