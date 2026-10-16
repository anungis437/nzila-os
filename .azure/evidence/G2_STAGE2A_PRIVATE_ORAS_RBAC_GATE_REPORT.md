# G2 Stage 2A private ORAS delivery: first RBAC gate

Mission: `NZ-20261008-INFRA-001`  
Gate: `G2_PRIVATE_CONTROL_PLANE`  
Slice: `G2_STAGE2A_PRIVATE_ORAS_DELIVERY`

## Disposition

`STAGE2A_BUILDER_ARTIFACT_PARTIAL`

`TOOLING_STAGING_PRINCIPAL_AVAILABLE = NO`

Stop at the packet's first gate. No authorized existing tooling uploader was
established from the observed active role assignments. Do not infer staging
authority from the ability to administer the registry or write role assignments.
No upload, download, guest execution, authentication exchange, principal
creation or role mutation was performed. ORAS execution authority is unconsumed.

This is a bounded active-assignment finding, not a tenant-wide assertion that no
potential/eligible principal exists. No PIM activation, directory credential
inventory or unrelated principal authentication was attempted.

## Concurrency and protected state

Worktree: `C:\APPS\worktrees\nzila-g2-provenance`.  
Branch: `g2/synthetic-health-source`.  
HEAD: `7bec20aad11d43eeae8099c14e021b3074154b27`.

Pre-write status remains only untracked `.azure/` and
`infrastructure/landing-zone/g2-builder/`. No foreign work was dispositioned.
Stage 1, failed attempts, inventory retry and prior ORAS evidence hashes were
verified unchanged. No executable or infrastructure source was changed.

The fresh [raw baseline](G2_STAGE2A_PRIVATE_ORAS_READ_ONLY_BASELINE.json) contains
exactly sixteen resources. Exact accepted API GETs were compared to the frozen
Stage 1 estate, excluding only `etag` and `systemData`. The ACR role contracts
match, and the VM has no extension. Subscription and tenant match the approved
values; the resource group is Canada Central.

`RESOURCE_COUNT = 16`  
`PROTECTED_INFRASTRUCTURE_UNCHANGED = YES`  
`CUSTOMSCRIPT_EXTENSION_PRESENT = NO`

## Repository and permission-mode decision

`TOOLING_REPOSITORY_NAME = g2-tooling`  
`BUILDER_TOOLING_READ_REQUIRED = YES`  
`BUILDER_TOOLING_WRITE_REQUIRED = NO`  
`RUNTIME_TOOLING_ACCESS_REQUIRED = NO`

The repository is proposed only. No data-plane listing or artifact existence
check was run, and no repository/artifact was created. A repository is not a new
ARM resource; an upload would create data-plane state only after all gates.

The accepted registry API `2025-11-01` returns
`properties.roleAssignmentMode = AbacRepositoryPermissions`. The earlier
`2025-04-01` projection omitted the property. That omission must not be treated
as a different mode or a basis for silently defaulting to RBAC-only behavior.

[Microsoft's ABAC documentation](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions)
states that in ABAC mode Owner/Contributor/Reader grant registry control-plane
permissions, not repository/image data-plane access; legacy AcrPull/AcrPush/
AcrDelete are not honored. The observed role definitions corroborate the
absence of ACR repository data actions on inherited management roles.

## Exact active assignment findings

The [raw roles and definitions](G2_STAGE2A_PRIVATE_ORAS_RBAC_RAW.json) include
current scope, inherited and group-inclusive assignment results, sanitized to
authority fields without user emails or directory profiles.

| Principal | Existing permission | Tooling conclusion |
|---|---|---|
| Builder `c59571aa-66ea-47c5-83d5-59946b318ae2` | Repository Writer; conditionVersion 2.0; exact `synthetic-health` | Neither tooling read nor tooling write granted by this assignment |
| Runtime `b150b19a-645d-493f-9bb4-0aa81cb0c449` | Repository Reader; conditionVersion 2.0; exact `synthetic-health` | No tooling grant |
| Inherited Owner/User Access Administrator/Contributor principals | Management actions; no ACR repository data actions | Not an existing staging grant |
| Inherited Foundry User principal | CognitiveServices data actions only | Not an ACR staging grant |

The [per-assignment analysis](G2_STAGE2A_PRIVATE_ORAS_REPOSITORY_RBAC_ANALYSIS.json)
records every observed assignment and its role definition. Only the builder and
runtime assignments grant ACR repository data actions; both exclude
`g2-tooling`. No personal credentials, administrator-enabled registry access or
self-grant was substituted.

These are static authorization conclusions, not runtime DENIED proofs.
Builder tooling-write denial, cross-repository denial, token scopes and runtime
confinement remain NOT_RUN.

## Exact future role-authority proposal

[Machine-readable proposed authority](G2_STAGE2A_PRIVATE_ORAS_PROPOSED_EXACT_ROLE_AUTHORITY.json)
contains the exact scope, role IDs, data actions and condition text. It is not
an applied template or an authorization to execute.

Registry scope:

`/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3/resourceGroups/nzila-g2-proof-xre47vggs5uhw/providers/Microsoft.ContainerRegistry/registries/nzilag2tzo75uuozprbo`

1. Maintainer nominates an **existing nonpersonal staging principal**, by exact
   object ID/type, with a proven private-path preparation context and an
   approved nonsecret authentication model. No suitable uploader is selected
   yet; Contributor status alone is not sufficient.
2. Proposed separate staging assignment: Repository Writer
   `2a1e307c-b015-4ebd-883e-5b7698a07328`, conditionVersion `2.0`, exact
   `g2-tooling` condition on its metadata/content read/write actions.
3. Proposed separate builder assignment: Repository Reader
   `b93aa761-3e63-49ed-ac28-beffa264f7ac`, conditionVersion `2.0`, exact
   `g2-tooling` condition on metadata/content read actions. No tooling write.
4. Preserve existing builder `synthetic-health` Writer and runtime
   `synthetic-health` Reader unchanged. No runtime tooling assignment.
5. Bind new assignment IDs and their duration/retirement explicitly before any
   deployment. No principal creation, wildcard condition, registry-wide role,
   identity attachment or network change is proposed.

**Protected-estate caveat:** additive role assignments are authorization
resources even if ordinary `az resource list` does not enumerate them. The
packet requires no new ARM resources and unchanged protected infrastructure.
A later exact authorization must expressly admit those additive assignment
deltas and distinguish sixteen workload/network resources from changed RBAC.
They cannot be silently described as "unchanged" or applied under this gate.

The external uploader's private ACR connectivity is also unproven. Public
network access remains Disabled, admin access false; no public exception or
firewall change is inferred.

## Execution outcomes not run

| Requested proof | Result |
|---|---|
| External exact archive download/checksum | NOT_RUN in this slice; prior official release metadata preserved |
| Staging artifact authority/upload/manifest digest | NOT_RUN |
| Builder tooling read/authentication/private pull/local checksum | NOT_RUN; grant absent |
| Extension validation/what-if/execution | NOT_RUN; first gate stopped |
| Synthetic artifact push/digest roundtrip | NOT_RUN |
| Cross-repository and tooling-write runtime denial | NOT_RUN |
| Temporary extraction/workspace cleanup | NOT_REQUIRED; workspace never created |
| Extension retirement | NOT_REQUIRED; extension absent |
| Staged tooling retention | NOT_CREATED_BY_THIS_SLICE; no retention YES claim |
| Stage 2B / Stage 3 | NOT_EXECUTED |

ORAS remains exactly version `1.3.4`, Linux AMD64, approved archive SHA-256
`f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`.
No archive was fetched to either operator or builder in this slice.

## Verification and files

The bounded read-only controller passed: exact subscription/tenant/region,
sixteen-resource raw comparison, exact role preservation, extension absence,
accepted registry mode, observed assignment/data-action analysis, frozen
source/historical hashes, and `git diff --check`.
The controller used only Azure GET/list commands. No provider validate,
what-if or deployment was appropriate after this first-gate stop.

Evidence-only changes require no Bicep build or product test suite: executable
source was unchanged. JSON/hash integrity and final concurrency checks are
recorded in the final verification record.

New non-overwriting evidence:

- [Read-only baseline](G2_STAGE2A_PRIVATE_ORAS_READ_ONLY_BASELINE.json)
- [Sanitized raw RBAC](G2_STAGE2A_PRIVATE_ORAS_RBAC_RAW.json)
- [Repository/RBAC analysis](G2_STAGE2A_PRIVATE_ORAS_REPOSITORY_RBAC_ANALYSIS.json)
- [Exact future role proposal](G2_STAGE2A_PRIVATE_ORAS_PROPOSED_EXACT_ROLE_AUTHORITY.json)
- [Final disposition](G2_STAGE2A_PRIVATE_ORAS_FINAL_DISPOSITION.json)
- [Preflight integrity](G2_STAGE2A_PRIVATE_ORAS_PREFLIGHT_VERIFICATION.json)
- This report and final integrity verification

Deployment-plan chronology was updated without changing its validation status
or treating prior inventory validation as authority for this new slice.

`STAGE1_DISCOVERY_PROVEN` remains.  
`STAGE2A_PHASE1_INVENTORY_PROVEN` remains.  
`STAGE2A_BUILDER_ARTIFACT_PARTIAL`  
`OVERALL_G2 = FAIL`
