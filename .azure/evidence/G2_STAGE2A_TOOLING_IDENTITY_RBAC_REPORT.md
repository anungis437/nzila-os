# G2 tooling identity and RBAC prerequisite gate

Mission: `NZ-20261008-INFRA-001`  
Slice: `G2_STAGE2A_TOOLING_IDENTITY_RBAC`

## Final disposition

`STAGE2A_TOOLING_IDENTITY_RBAC_BLOCKED`

`STAGING_PRINCIPAL = bfa4a851-696a-4d3f-927b-5fb1526f79f2`  
`STAGING_PRIVATE_ACR_PATH = NOT_AVAILABLE`  
`AUTHORIZED_RBAC_RESOURCE_COUNT_DELTA = 0`  
`PROTECTED_INFRASTRUCTURE_RESOURCE_COUNT = 16`  
`ORAS_EXECUTION_AUTHORITY_CONSUMED = NO`  
`OVERALL_G2 = FAIL`

`TOOLING_PRIVATE_STAGING_SUBSTRATE_REQUIRED`

The selected principal is a read-only planning selection, not an executed
authentication context or a grant. No upload, builder pull, artifact push,
identity creation, network change, role assignment, extension or workflow
dispatch occurred. Conditional RBAC execution was not reached because the
selected staging context's private ACR path was not proven.

## Concurrency

Worktree `C:\APPS\worktrees\nzila-g2-provenance`; branch
`g2/synthetic-health-source`; HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`.
Before writes, status remained the existing untracked `.azure/` and
`infrastructure/landing-zone/g2-builder/`. No foreign changes were
dispositioned. Executable source and historical evidence remain unchanged.

## Phase A: census and objectively supported selection

`STAGING_IDENTITY_CANDIDATES = 6`

The census screened visible tenant-owned automation/application names,
subscription assignments and existing UAMIs. Six shared Nzila automation
principals received detailed application, federation, credential-metadata,
owner-object-ID and current assignment review:

| Candidate | Principal ID | Assessment |
|---|---|---|
| nzila-os-build | bfa4a851-696a-4d3f-927b-5fb1526f79f2 | Preferred: build-only, GitHub OIDC, no password/certificate credentials, one role on another registry |
| nzila-os-deploy-staging | 66ec0cdf-ff35-42bd-9104-f424f7c8a455 | Not selected: deployment identity, six current subscription assignments |
| nzila-os-deploy-demo | 4d38a271-c8e8-4994-bd46-ed91b2d65700 | Not selected: deployment identity, three assignments |
| nzila-os-deploy-pilot | 6fd23298-4708-47ce-88cb-a813765ca3d0 | Not selected: deployment identity, three assignments |
| nzila-os-deploy-prod | 52f8fa31-c000-4459-aa75-0f78a2f72b8c | Not selected: production deployment identity, seven assignments |
| nzila-os-cicd | 87321708-6150-4ea7-9d09-b26cd5080221 | Not selected: no federation, seven assignments; no reason to prefer it over dedicated build OIDC |

Counts refer to observed assignments in the current subscription, not every
possible directory role or other subscription. Related product automation/
application-auth identities were screened and excluded rather than repurposed.
The two subscription UAMIs are the builder/runtime identities and are explicitly
excluded. No personal or third-party identity was nominated.

[Candidate census](G2_STAGE2A_TOOLING_IDENTITY_RBAC_CANDIDATE_IDENTITY_CENSUS.json)
contains client/application/object IDs, credential metadata only, exact
federations, owner object IDs, current scopes, workload/lifecycle and assessment.
No credential values or tokens were read or persisted. Named individual on-call
ownership was not established; that limitation is recorded rather than invented.

### Preferred principal

`PROPOSED_TOOLING_STAGING_PRINCIPAL_ID = bfa4a851-696a-4d3f-927b-5fb1526f79f2`

- Client ID: `5c02d25b-cbdc-412f-8c2a-9ed43b73ac20`.
- Application object ID: `3594a951-fcff-4877-a52f-043ed52a9eb0`.
- Owning tenant: `5082b8be-b04d-4a13-b61c-b6397670177b`.
- Federation issuer: `https://token.actions.githubusercontent.com`.
- Subject: `repo:anungis437/nzila-os:environment:build`.
- Audience: `api://AzureADTokenExchange`.
- Password and certificate credential metadata arrays: empty.
- Existing permission: one AcrPush assignment on `nzilacanadaacr`, a different
  registry. No observed grant on the G2 ACR.

The existing build-identity proof workflow pins this exact client ID and uses
the `build` environment with OIDC. This objectively supports selecting it over
deployment identities. The existing workflow itself was **not** run or modified:
it targets another registry and performs writes/deletion outside this packet.

The existing different-registry role is not claimed to be tooling-only globally.
It is preserved, not extended or removed. Proposed G2 permission would cover
only `g2-tooling` on the G2 registry.

[Selection rationale](G2_STAGE2A_TOOLING_IDENTITY_RBAC_SELECTED_IDENTITY_RATIONALE.json)
records hashed local workflow references and the explicit ownership/lifecycle
qualification. Continued reuse should be registered with the Nzila build/platform
maintainers before future execution; no individual approval is fabricated.

## Phase B: private connectivity not available in observed context

`STAGING_PRIVATE_ACR_PATH_NOT_AVAILABLE`

Observed evidence:

- Reviewed Azure-login workflow jobs use GitHub-hosted `ubuntu-latest`; no
  self-hosted execution declaration was observed in those jobs.
- Repository Actions runner endpoint returned zero registered self-hosted
  runners.
- G2 VNet peerings: empty.
- The G2 `privatelink.azurecr.io` zone has one link, to the G2 builder VNet only.
- The sole subscription VM is the protected builder. Its prior private ACR
  proof cannot be transferred to the uploader trust domain.
- Other visible Container Apps environments are outside the G2 VNet connection
  boundary; no admissible ingestion workload or execution authority was found.
- No visible VPN/ExpressRoute/private DNS resolver path was established.

DNS resolution and HTTPS from a selected private staging execution context:
**NOT_RUN**, because no admissible such context was established. The approved
ACR private endpoint IP remains `10.90.2.5`; no public endpoint was contacted,
and no write authentication was attempted.

[Connectivity evidence](G2_STAGE2A_TOOLING_IDENTITY_RBAC_PRIVATE_CONNECTIVITY_DISCOVERY.json)
contains observed runner metadata, VNet peerings, DNS link, VM inventory and
Container Apps environment network configuration. NOT_AVAILABLE is scoped to
the discovered permitted contexts: it is not a claim that every organization
runner, externally managed network or future larger-runner path is impossible.
Organization-level networking entitlements were not audited. The workstation
was not assumed to have private connectivity.

## Exact role planning and conflict analysis

[Role definitions and conditions](G2_STAGE2A_TOOLING_IDENTITY_RBAC_ROLE_DEFINITIONS_AND_CONDITIONS.json)
preserve resolved live role permissions and exact conditionVersion `2.0` text:

- Staging principal: Repository Writer
  `2a1e307c-b015-4ebd-883e-5b7698a07328`; metadata/content read/write on exact
  `g2-tooling`.
- Builder: Repository Reader
  `b93aa761-3e63-49ed-ac28-beffa264f7ac`; metadata/content read on exact
  `g2-tooling`, no write.
- Both proposed at the exact G2 ACR scope, without wildcard repository patterns.
- Existing builder Writer/runtime Reader restricted to `synthetic-health`
  unchanged; no runtime tooling grant.

`EQUIVALENT_STAGING_ASSIGNMENT_EXISTS = NO`  
`EQUIVALENT_BUILDER_READ_ASSIGNMENT_EXISTS = NO`

No broader conflicting G2 grant for the selected principal was observed.
Inherited management permissions were not interpreted as repository grants.
[Conflict analysis](G2_STAGE2A_TOOLING_IDENTITY_RBAC_ASSIGNMENT_CONFLICT_ANALYSIS.json)
records active direct/inherited/group-inclusive assignments and separates the
selected principal's role on the other registry.

This is static configuration analysis, not runtime ALLOWED/DENIED proof.
No deterministic assignment IDs or executable source authority were bound:
the private-path prerequisite failed first. Future authority must bind those
IDs deterministically before validation/application, never generate them
randomly at execution.

Provider validation/change gate: NOT_RUN.  
RBAC execution/post-RBAC readback: NOT_RUN/NOT_APPLICABLE.  
Maximum conditional +2 allowance remains unexecuted; actual delta is zero.

The revised resource-count doctrine is accepted: protected infrastructure
count and authorization-resource delta are tracked separately. This does not
permit any network/substrate resource under this packet.

## Protected state and verification

[Preflight baseline](G2_STAGE2A_TOOLING_IDENTITY_RBAC_PROTECTED_BASELINE.json)
uses exact accepted API GETs and compares all sixteen protected resources to
the prior baseline, excluding only `etag`/`systemData`. Existing ACR roles match
exactly and the extension is absent. Subscription/tenant are exact.

Final verification repeats the raw protected-state/role check after report
creation and verifies frozen Stage 1 and inventory source, historical evidence,
JSON parsing and `git diff --check`. No broad product tests/Bicep deployment
checks are appropriate for this evidence-only stopped slice.

Local census initially encountered Windows Azure CLI output decoding errors.
No evidence/authority was written by those failed reads. The successful
read-only controller uses explicit Windows CLI codepage decoding; relevant
identity IDs and federation strings are ASCII. No Azure retry/deployment
authority was consumed.

[Next-boundary proposal](G2_STAGE2A_TOOLING_IDENTITY_RBAC_NEXT_AUTHORITY_PROPOSAL.md)
compares least-state staging options. All are proposals only.

Stage 1 and Phase 1 inventory remain proven. Stage 2A artifact proof remains
PARTIAL; no Stage 2B, Stage 3 or workload deployment.
