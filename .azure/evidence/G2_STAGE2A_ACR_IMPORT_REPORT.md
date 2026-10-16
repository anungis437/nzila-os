# G2 ACR-to-ACR tooling import feasibility

Mission `NZ-20261008-INFRA-001`; slice `G2_STAGE2A_ACR_IMPORT_FEASIBILITY`.

## Disposition

`ACR_TO_ACR_TOOLING_DELIVERY_BLOCKED`

Primary blocker: `TARGET_ACR_TRUSTED_SERVICE_IMPORT_BLOCKED`.

The documented architecture does not inherently need a new private staging
runner. However, the current target rejects its required trusted-service path,
and the combined importer role introduces an unaccepted registry-wide
authorization boundary. Neither setting nor permission was changed.

| Required result | Value |
|---|---|
| SOURCE_ACR | `/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3/resourceGroups/nzila-canada-staging-rg/providers/Microsoft.ContainerRegistry/registries/nzilacanadaacr` |
| SOURCE_TOOLING_WRITE_ALREADY_AUTHORIZED | YES, through existing legacy registry-wide AcrPush |
| TARGET_ACR_IMPORT_TRUSTED_SERVICE_PATH | DISABLED |
| PROPOSED_IMPORT_PRINCIPAL | `bfa4a851-696a-4d3f-927b-5fb1526f79f2`, existing `nzila-os-build`, planning only |
| GENERIC_OCI_ACR_IMPORT_SUPPORTED | YES, documented capability; exact custom artifact roundtrip NOT_RUN |
| NEW_STAGING_SUBSTRATE_REQUIRED | NO for this documented design; not a current execution PASS |
| AUTHORIZED_RBAC_RESOURCE_COUNT_DELTA | 0 |
| PROTECTED_INFRASTRUCTURE_RESOURCE_COUNT | 16 |
| ORAS_EXECUTION_AUTHORITY_CONSUMED | NO |
| OVERALL_G2 | FAIL |

No upload, import, identity/role/network/registry mutation, guest execution,
workflow dispatch, Stage 2B or Stage 3 occurred. This is not a rejection of
server-side import and does not return to designing new infrastructure.

## Concurrency and preserved state

Worktree `C:\APPS\worktrees\nzila-g2-provenance`; branch
`g2/synthetic-health-source`; HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`. Pre-write status remained the
existing untracked `.azure/` and `infrastructure/landing-zone/g2-builder/`.
No foreign changes were dispositioned.

Exact accepted API reads match sixteen protected resources and existing role
contracts, excluding only `etag`/`systemData`. Extension remains absent.
Source registry is also read back unchanged at final verification. All prior
evidence and frozen Stage 1/inventory source bytes are preserved.

## A: source registry and existing build authority

[Live registries and roles](G2_STAGE2A_ACR_IMPORT_LIVE_REGISTRIES_AND_ROLES.json)
use API `2025-11-01`.

Source is `nzilacanadaacr`, subscription
`5d819f33-d16f-429c-a3c0-5b0e94740ba3`, tenant
`5082b8be-b04d-4a13-b61c-b6397670177b`, Canada Central, Basic.

`SOURCE_ACR_ROLE_ASSIGNMENT_MODE = LegacyRegistryPermissions`  
`SOURCE_ACR_PUBLIC_NETWORK_ACCESS = Enabled`  
`SOURCE_ACR_TRUSTED_SERVICE_BYPASS = AzureServices`

Source has no networkRuleSet or private endpoint connections. Its current
trusted-service path is NOT_REQUIRED because the registry is not
network-restricted; the bypass setting is already AzureServices.

Build principal `bfa4a851-696a-4d3f-927b-5fb1526f79f2`, client
`5c02d25b-cbdc-412f-8c2a-9ed43b73ac20`, has exact source-scope assignment
`456bd3f1-4ee2-423b-bc1a-8b99e8338e19` for AcrPush
`8311e382-0749-4cb8-b61a-304f252e45ec`. Condition and version are null.

Actual role Actions:

- `Microsoft.ContainerRegistry/registries/pull/read`
- `Microsoft.ContainerRegistry/registries/push/write`

DataActions are empty. This does **not** mean no data access: this source uses
the legacy model where these Actions grant registry-wide pull/push. The role
therefore permits `g2-tooling`, but it is not technically tooling-only.

`SOURCE_ACR_EXISTING_WRITE_CAPABILITY = YES`  
`SOURCE_TOOLING_WRITE_ALREADY_AUTHORIZED = YES`

No additional source Writer is needed merely to stage. Do not layer an ABAC
role onto this legacy source or silently change its permission mode. The
existing role is preserved, not normalized as repository-confined.

Proposed repository is `g2-tooling`. Collision/existing-tag checks remain
NOT_RUN: no source data-plane authentication/listing was performed. Future
upload authority must stop on an existing tag rather than overwrite.

### Existing CI connectivity evidence

`GITHUB_HOSTED_TO_SOURCE_ACR_PATH = PROVEN`

This result combines current unrestricted public-network configuration with
existing historical successful hosted OIDC login, identity assertion, ACR
login, push and digest steps in run
[36468116707](https://github.com/anungis437/nzila-os/actions/runs/36468116707).
The exact workflow blob at that run SHA pins `nzila-os-build`,
`nzilacanadaacr` and `ubuntu-latest`; its hash and successful job-step metadata
are retained in [CI path evidence](G2_STAGE2A_ACR_IMPORT_SOURCE_CI_PATH_EVIDENCE.json).

No new workflow was executed. This is historical execution evidence plus
current configuration, not a fresh probe or ORAS-specific runtime proof.

## B: target and network/region contract

G2 target `nzilag2tzo75uuozprbo` is Premium, Canada Central, same subscription
and tenant. Its private endpoint is Approved and unchanged.

`roleAssignmentMode = AbacRepositoryPermissions`  
`publicNetworkAccess = Disabled`  
`networkRuleBypassOptions = None`

`TARGET_ACR_IMPORT_TRUSTED_SERVICE_PATH = DISABLED`

[Microsoft import documentation](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-import-images)
explicitly says import to/from a network-restricted registry fails without
allow-trusted-services. The precise required target mutation would be:

`properties.networkRuleBypassOptions: None -> AzureServices`

That mutation is **not authorized** here. It changes an intentional private
control-plane boundary. It is a trusted-service-class setting, not an
import-only, repository-only, principal-only or digest-only network allowlist.
[Trusted-services documentation](https://learn.microsoft.com/en-us/azure/container-registry/allow-access-trusted-services)
lists several service usages, including ACR import; identity/authorization
requirements still apply. Public access could remain Disabled if a later
packet explicitly authorizes this change, but it must not be called unchanged.
Source/IaC authority must be amended before any governed mutation.

`SOURCE_TENANT == TARGET_TENANT`  
`ACR_IMPORT_REGION_CONTRACT = PASS`

Microsoft requires the source ACR home/global source, not its regional endpoint,
and writes imports in the downstream home region. Both are Canada Central;
the subscription RP is Registered and includes Canada Central. No cross-region
or cross-tenant behavior is assumed.

## C: server-side invocation and generic OCI artifacts

`CLIENT_PRIVATE_ENDPOINT_LINE_OF_SIGHT_REQUIRED = NO`

Microsoft documents ACR-to-ACR OCI artifact import, source resource-ID integrated
Entra authentication, invocation locally/Cloud Shell, and no need for the
target's public endpoint. The supported flow uses the Azure registry import
operation; it does not route the GitHub client to the G2 private endpoint.
This does **not** establish direct target manifest readback from that client:
later equivalence proof must use a separately authorized private read context.

`GENERIC_OCI_ACR_IMPORT_SUPPORTED = YES`

Import documentation expressly includes OCI artifacts, not only runnable
images. Microsoft's [ORAS artifact documentation](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-manage-artifact)
demonstrates arbitrary artifact types and file blobs. The proposed form is one
standard OCI image-manifest envelope
`application/vnd.oci.image.manifest.v1+json` with
`artifactType=application/vnd.nzila.g2.tooling.oras.v1`,
empty OCI config and one `application/gzip` archive layer. It is not a runnable
image. Do not adopt the experimental artifact-manifest media type shown in some
older examples or assert an exact runtime roundtrip before executing one.

The approved archive SHA remains
`f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`.
Source manifest digest and blob SHA are different evidence objects. Future
execution must bind both and prove target equivalence; there are no current
artifact bytes/digests to claim.

## Import role and least-privilege ceiling

Resolved role: Container Registry Data Importer and Data Reader,
`577a9874-89fd-4f24-9dbd-b5034d0ad23a`.

Actions:

- `Microsoft.ContainerRegistry/registries/importImage/action`
- `Microsoft.ContainerRegistry/registries/read`
- `Microsoft.ContainerRegistry/registries/pull/read`

DataActions:

- `Microsoft.ContainerRegistry/registries/repositories/content/read`
- `Microsoft.ContainerRegistry/registries/repositories/metadata/read`
- `Microsoft.ContainerRegistry/registries/catalog/read`

No NotActions/NotDataActions. Current same-tenant Microsoft guidance specifies
this role on **source and target**. Existing source AcrPush is not automatically
treated as the documented combined importer role; no target grant exists.

`IMPORT_ROLE_REPOSITORY_SCOPING_LIMITATION = PRESENT`

The [ABAC roles list](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions)
documents repository conditions only for Repository Reader/Writer/Contributor.
The combined importer/catalog role is not listed. There is no documented
conditionable target repository attribute for its control-plane
`importImage/action`. Do not invent a `g2-tooling` condition on this role.
Even conditioning a read action would not prove import destination confinement.

The documented role grants registry-wide content/metadata/catalog reads and
ability to trigger imports at registry scope. It does not grant ordinary push,
but imports themselves can create target content beyond a repository-constrained
Writer. Binding one command is an execution restriction, not technical RBAC
repository isolation.

`PROPOSED_IMPORT_PRINCIPAL = bfa4a851-696a-4d3f-927b-5fb1526f79f2`

Existing build OIDC is preferred for planning; never builder/runtime or a
personal durable importer. A later **explicitly accepted time-bounded** grant
to it could be evaluated, with exact assignment IDs, no delegation, one digest,
preflight conflict checks and proven retirement. This broader access is not
accepted here, and no new ephemeral principal is automatically proposed or
created. If maintainers reject the broader role, import authority remains
unresolved rather than quietly waived.

## Evidence and next branch

[Microsoft contract record](G2_STAGE2A_ACR_IMPORT_MICROSOFT_CONTRACT.json)
persists references, retrieval UTC, source-output hashes, page metadata and
bounded exact excerpts. [Feasibility matrix](G2_STAGE2A_ACR_IMPORT_FEASIBILITY_MATRIX.json)
separates source write, source network, target bypass, role ceiling, regions and
OCI support.

The next [decision proposal](G2_STAGE2A_ACR_IMPORT_NEXT_DECISION_PROPOSAL.md)
addresses these prerequisites without authorizing mutation. The import design
is not conclusively rejected; do not create or redesign a private staging runner.

Verification: protected16 and role preservation, source registry unchanged,
frozen source/historical evidence hashes, JSON parsing, concurrency and
`git diff --check`. Initial read-only controller query hit a Windows shell
parenthesis parsing error; it wrote no evidence and was corrected without any
Azure operation retry or deployment. No executable repository source changed.

Stage 1/Phase 1 inventory remain proven; Stage 2A artifact remains PARTIAL.
