# G2 Private Control-Plane Evidence

Mission: `NZ-20261008-INFRA-001`. Initial evidence captured 2026-10-08;
G2 preflight follow-up captured 2026-10-09; private-artifact source follow-up
captured 2026-10-10.

This report records a read-only control-plane review and code-only G2
orchestration/preflight work. It does not authorize production cutover, data
migration, identity cleanup, or changes to UE/Cora-owned release paths. No
Azure deployment was performed. The G1 target and its limits remain in
[README.md](./README.md); neither product's `INFRA_NO_GO` disposition changes.

## CONCURRENCY_CHECKPOINT / FOREIGN_CHANGES_OBSERVED

Before this report write:

- Branch: `main`
- HEAD: `1c337567635bb86ea0df7831557d8d2d22df1e6f`
- Staged changes: 0
- Unstaged tracked paths: 61
- Untracked paths: 119
- Existing `infrastructure/landing-zone/` content was untracked before this
  report; this report is one additional file in that existing tree.

Concurrent work is present across application, documentation, package,
governance, infrastructure, report, tooling, and root configuration paths.
No foreign file was staged, reverted, stashed, committed, accepted, or
dispositioned. Recheck the baseline before any subsequent write batch.

The post-write `pnpm validate:docs` check regenerated
`reports/doc-consistency.json` and `reports/doc-consistency.md`. Both paths
were already modified in the pre-check baseline. Their pre-check contents were
not separately preserved, so no blind restore or staging was attempted; the
regenerated reports remain unstaged.

For the 2026-10-09 G2 follow-up, HEAD remained
`1c337567635bb86ea0df7831557d8d2d22df1e6f`; the pre-write porcelain snapshot
contained 199 path entries, 138 reported as untracked. Concurrent foreign
changes remained across product, documentation, tooling, and configuration
paths. No foreign path was staged, reverted, stashed, committed, accepted, or
dispositioned.

Before the 2026-10-10 private-artifact documentation batch, HEAD was still
`1c337567635bb86ea0df7831557d8d2d22df1e6f`. The scoped landing-zone, test,
and deployment-plan paths were already untracked in the broad worktree. The
source-only ACR work and this documentation update remain within those paths;
foreign work was not staged, reverted, stashed, committed, accepted, or
dispositioned. No Azure, Entra, GitHub, product, or production mutation was
performed.

Before the 2026-10-10 fresh provider-preflight documentation batch, HEAD
remained `1c337567635bb86ea0df7831557d8d2d22df1e6f` on `main`; `git status
--porcelain=v1 --untracked-files=all` showed 59 modified tracked paths, 182
untracked files, and zero staged paths. The broad foreign worktree remains
untouched and undispositioned. Only the landing-zone evidence, README, and
deployment plan are in scope for this write batch.

Fresh read-only Azure preflight ran `az deployment sub validate` and
`az deployment sub what-if` against the narrowed `g2-artifact-foundation.bicep`
target. Neither command deploys resources. The exact results and the
deployment-time role-assignment limitation are recorded below; no Azure,
Entra, GitHub, product, or production mutation occurred.

## LIVE_STATE_VS_IAC_DIFF

The live observations below are limited to the visible subscription
`5d819f33-d16f-429c-a3c0-5b0e94740ba3`. They are configuration evidence, not
runtime reachability tests or proof that every resource in the tenant was
enumerated.

| Dimension | Refreshed live state | Target/source declaration | Classification |
|---|---|---|---|
| Subscription and RG topology | One visible subscription contains production and nonproduction. Existing product RGs remain operational. | Keep the subscription transitional; separate product/environment data-plane RGs and shared operations/security/edge RGs. | `LIVE_IS_AUTHORITATIVE_TEMPORARILY` |
| Names and environment boundaries | Legacy names and demo/pilot profiles remain in use. | New `nzila-{product}-{environment}-rg` names; canonical development, integration-test, staging, production. No in-place adoption of legacy names. | `IAC_IS_INTENDED_TARGET` |
| Regions | Four ACA environments are in Canada Central. The only listed VNet is in East US; two OpenAI accounts are in East US/East US 2. | Canada Central primary; Canada East cold recovery only where each service supports it. | `IAC_IS_INTENDED_TARGET` |
| Network and private DNS | No private endpoints and no private DNS zones were returned. No Canadian VNet was returned. ACA public network access is `Enabled`. | Segmented per-product/environment Canadian VNets, private endpoints, linked private DNS, no broad peering, and public access disabled. | `IAC_IS_INTENDED_TARGET` |
| Front Door/WAF | UE profile `nzila-ue-afd-prod` is Standard. Its origin points at the public ACA FQDN and has no `sharedPrivateLinkResource`. Route accepts HTTP/HTTPS, redirects HTTP to HTTPS, and forwards HTTPS-only. WAF is Prevention mode with custom rules, but zero managed rule sets. | Premium Front Door private-link origin, HTTPS-only route, managed default and bot rules, separate edge/security diagnostics. | `IAC_IS_INTENDED_TARGET` |
| Container Apps | All four observed ACA environments have public network access enabled. Selected apps use external ingress; 19/21 observed workloads have system-assigned identity and two have no identity. | Internal environment, public access disabled, controlled Front Door private ingress, per-workload user-assigned identity, immutable image digest. | `IAC_IS_INTENDED_TARGET` |
| PostgreSQL | Four selected servers were previously observed public-enabled; live size/HA settings are retained as the capacity baseline, not a sizing recommendation. | Private delegated networking, Entra-authenticated access, modest measured capacity, and no automatic production migration. | `IAC_IS_INTENDED_TARGET` |
| Key Vault and Storage | Selected vaults are public-enabled; selected Storage accounts use network default `Allow`. No private endpoints were returned. | Per-product private endpoints, public access disabled, scoped identity access, TLS and data-classification tags. | `IAC_IS_INTENDED_TARGET` |
| Identity and RBAC | 64 role assignments, 25 service-principal role principals, two unresolved IDs, six subscription-scope service-principal Contributors, and one subscription-scope human Owner. No UAMI was returned. | Product/environment workload identities with least-privilege resource/data roles; no workload subscription Contributor. | `REQUIRES_DECISION` |
| Diagnostics | ACA logs are configured on observed production apps; diagnostic settings for selected PostgreSQL, Key Vault, and Storage were not returned in the prior resource review. | Separate operations/security destinations and explicit resource diagnostics; retention and delivery still require proof. | `IAC_IS_INTENDED_TARGET` |
| GitOps and deploy authority | UE release uses GitHub-hosted `ubuntu-latest` jobs and OIDC. Production deployment is manual-dispatch only in the workflow; auto-promotion excludes production. GitHub production environment has a branch-policy rule but no required-reviewer rule was returned. | Environment-scoped federated identities, gated promotion, digest-only deployment, and private network operator/runner access where required. | `REQUIRES_DECISION` |
| DR | PostgreSQL HA/geo-backup settings are observed, but Canada East application recovery and timed restore are not proven. | Canadian cold recovery with service-specific support checks and tested restore. | `IAC_IS_INTENDED_TARGET` |
| AI residency | Two public OpenAI accounts are in the Canada staging RG but located in East US and East US 2. Only UE demo endpoint configuration was observed. | No restricted Cora processing at these endpoints; Canadian-region model deployment only after residency, SKU, and behavior are confirmed. | `REQUIRES_DECISION` |
| IaC authority | Deployment-history metadata is incomplete; live templates were not matched to source commits. The canonical subscription entrypoint remains distinct from the new G2 composition. | Foundation, runtime, and edge compile and the G2 module graph validates; live provisioning and end-to-end reproducibility remain unproven. | `REQUIRES_DECISION` |
| Cost attribution | 83 visible top-level resources; all 83 lack at least one of the six required tag keys. Some provider-managed/child resources require parent-based allocation. | New taggable resources carry `product`, `environment`, `service`, `owner`, `cost_center`, and `data_classification`. | `IAC_IS_INTENDED_TARGET` |
| Policy | Subscription-scope query returned only `ASC Default`, enforcement mode `Default`; this does not establish required landing-zone policy enforcement. | Add policy controls only through an approved rollout with exemptions and impact review. | `REQUIRES_DECISION` |

No mismatch silently changes which side is authoritative. Existing live resources
remain operationally authoritative until an approved, tested migration; the
private Canadian architecture is the intended target, not current state.

## TARGET_LANDING_ZONE

Retain the current subscription as a transitional administrative boundary.
Isolate each product/environment data plane, with shared operations, security,
and edge services in distinct environment-scoped resource groups. Canada Central
is primary. Canada East is a cold recovery location only where the individual
Azure service and model are available and the recovery process is tested.

The private target is expressed as separate foundation, runtime, and edge
templates. The runtime uses an internal ACA environment with public network
access disabled; the edge template uses Front Door Premium Private Link to the
ACA managed environment. The new `g2-proof.bicep` composition connects those
modules in source. This is code-level orchestration, not a complete deployable
or proven runtime chain: the 44-create what-if does not prove provisioning,
Front Door association, Private Link approval, DNS resolution, or direct-origin
denial.

## SUBSCRIPTION_AND_ENVIRONMENT_MODEL

- Preserve the one visible subscription temporarily; no subscription split or
  additional subscription is authorized by this evidence pass.
- Product/environment RGs are separate from shared operations, security, and
  edge RGs. Production and nonproduction must not share a database, vault,
  storage account, or workload identity.
- Canonical environments are `development`, `integration-test`, `staging`, and
  `production`. Demo and pilot remain legacy release profiles until their
  owners approve mapping.
- Use local development and ephemeral synthetic integration/test. Staging uses
  production-like network and identity controls at smaller capacity. Do not
  replicate expensive production capacity into every environment.
- Cora was not provisioned by this work. The existing Cora staging app remains
  part of the live estate and is not evidence of the new target being deployed.

## NETWORK_FOUNDATION

**Observed:** one East US VNet (`10.1.0.0/16`), no private DNS zones, and no
private endpoints were returned. All four listed ACA environments are in
Canada Central and have `publicNetworkAccess: Enabled`. The UE production
Front Door origin targets the public ACA FQDN with no Private Link resource.
The route redirects HTTP to HTTPS but still advertises both protocols. The
origin/environment configuration leaves a direct-origin bypass path available
by configuration; no HTTP probe was performed.

**Target:** nonoverlapping product/environment VNets; separate delegated ACA and
PostgreSQL subnets and a nondelegated private-endpoint subnet; product-scoped
private DNS links; no automatic cross-product peering; private PostgreSQL,
vault, storage, and ACA origin; public origin access disabled. DNS, NSG/egress,
runner reachability, Front Door private-link approval, and origin-denial tests
remain unproven.

## IDENTITY_FOUNDATION / IDENTITY_REMEDIATION_PLAN

The latest metadata-only inventory returned 64 role assignments, 25
service-principal role principals, two unresolved principal IDs, six
subscription-scope service-principal Contributor assignments, one
subscription-scope human Owner, zero UAMIs, 19 system-assigned workload
identities, and two workloads with no identity. Six principal records had
password-credential metadata. Federated-credential counts differed from the
prior inventory; no credential values, tokens, or connection strings were read.

1. Resolve the two principal IDs and map every principal to its application,
   owner, workflow, workload, scope, and last exercised dependency. Treat
   unresolved or ownerless metadata as `UNKNOWN_DO_NOT_REMOVE`.
2. Reconcile the credential metadata delta principal-by-principal. Confirm
   federated OIDC subjects and environment scoping before considering any
   credential retirement.
3. After each product/environment target is independently deployed and
   exercised, replace broad subscription Contributor access with the minimum
   resource-group, ACR, Key Vault, and database permissions required.
4. Use separate workload identities per product/environment, with no cross
   product data access. Grant ACR pull only to runtime identities; keep build
   push authority separate. Scope PostgreSQL Entra role membership to the
   approved product database. The new artifact-registry source grants only
   registry-scoped `AcrPull` to the runtime UAMI; it grants no build/push or
   deployment role.
5. Remove no principal or credential until owner approval, dependency proof,
   successful target rollout, monitoring, and rollback evidence are on file.

## DATA_RESIDENCY_REGISTER / AI_DATA_RESIDENCY_DISPOSITION

| Service/configuration | Observed geography and use | Restriction / alternative |
|---|---|---|
| `nzila-openai-eastus` | East US; public network access enabled. UE demo has `AZURE_OPENAI_ENDPOINT=https://eastus.api.cognitive.microsoft.com/`. | No Cora restricted data. Endpoint configuration does not prove actual calls, account binding, or data sent. |
| `nzila-openai-eastus2` | East US 2; public network access enabled. UE demo has `AZURE_OPENAI_WHISPER_ENDPOINT=https://eastus2.api.cognitive.microsoft.com/`. | Same restriction. |
| Cora staging | The inspected ACA environment metadata did not show the listed AI endpoint variables. | This is not proof that application code or another configuration source cannot use the US services. Fail closed. |
| Canada Central model catalog | `gpt-4.1-mini` and `text-embedding-3-small` returned global/developer SKUs; Whisper returned no SKU. | Global SKUs do not establish Canada-only processing or regional parity. No Canadian replacement is approved or claimed. |

Until an explicit processor/data-residency decision and tested configuration
exist, Cora institutional evidence, producer evidence, certifications, personal
information, and institutional audit data are **prohibited** from both US AI
endpoints. This is a conservative platform restriction, not a claim that current
usage is unlawful. UE demo data classification and actual request contents also
remain unverified.

## IAC_AUTHORITY_MATRIX

| Area | Current authority/evidence | G2 conclusion |
|---|---|---|
| Legacy/live product infrastructure | Live resource state and existing product workflows | Temporary operational authority; no automatic re-deployment from new templates. |
| Canonical foundation and private artifact source | Bicep subscription entrypoint, data foundation, private ACR, runtime, edge, and narrowed G2 network/registry bootstrap; source compile, emitted validation, focused contracts, and fresh provider preflight passed with a role-assignment what-if limitation | Source and provider preflight are validated only for their stated scope; no ACR or other resource from this source is provisioned, and live convergence is not established. |
| Runtime and edge | Separate opt-in Bicep templates | Not invoked by the subscription entrypoint; their integrated provider deployment and private connectivity remain unproven. |
| GitOps/deploy workflows | Existing UE workflow owns UE releases; GitOps history is incomplete | Preserve product ownership. Do not edit its release behavior as part of this platform evidence report. |
| Manual/drifted/external | Deployment history is incomplete and source hashes were not reconciled; subscription policy is not a complete drift-control proof | Do not claim all current resources are IaC-managed or reproducible. |
| Image contract | UE workflow publishes mutable aliases, including backend `:latest`, and SHA tags; it resolves SHA-tag digests and deployment jobs pass `@sha256` images. Canonical runtime requires a digest. | Production image consumption is digest-pinned in the inspected workflow; mutable aliases are not production evidence. No workflow change made. |

## COST_ATTRIBUTION_FOUNDATION

The refreshed inventory found 83 visible resources and no resource with all six
canonical allocation/classification tags. The target Bicep tags new taggable
resources with `product`, `environment`, `service`, `owner`, `cost_center`, and
`data_classification`. Provider-managed or untaggable children must be allocated
through their tagged parent rather than represented as individually tagged.
Budgets, anomaly alerts, shared-pool allocation proofs, and observed cost drivers
remain G6 work.

## CORA_PLATFORM_CONTRACT

Cora remains `INFRA_NO_GO`. No new Cora environment or data plane was deployed.
Keep institutional/producer evidence, certifications, personal information,
and institutional audit data out of the two US AI endpoints. The current Cora
staging app's public ingress/system-assigned identity are legacy live state,
not an accepted target. Future Cora deployment requires separate private
persistence, product/environment identity, approved Canadian processor/model
contract, data-classification acceptance, and product-owned evidence/audit
semantics.

## UE_PLATFORM_CONTRACT

UE remains `INFRA_NO_GO`. Do not alter UE-owned deploy or auto-promote workflows.
The automatic promotion matrix excludes production. The explicit production
workflow uses OIDC and digest-pinned images, but the GitHub production
environment has no required-reviewer rule in the returned protection metadata.
The live UE production origin is not Private Link protected. UE must approve
parallel environment/data migration, DNS, database roles, secret/interface
contracts, health probes, rollback, and product-owned tenant/audit proofs before
any cutover.

## DEFERRED_TO_G2

- Build and verify a private deployment/operator path; confirm no unapproved
  subscription/RG privilege or long-lived credential dependency.
- The narrowed `g2-artifact-foundation.bicep` composes only the approved
  synthetic proof resource group, proof VNet/subnets, ACR private DNS/link,
  workload UAMI, and private Premium ACR/endpoint. It does not compose
  PostgreSQL, Key Vault, Storage, runtime, Front Door, or shared workspaces.
  The fresh what-if reported those intended creates, but marked the
  registry-scoped `AcrPull` assignment `Unsupported` because its principal ID
  is resolved at deployment time. Resolve that uncertainty without broadening
  role scope before deployment; private build/push approval is also still
  required.
- Prove an immutable synthetic artifact and provenance. The existing staging
  ACR remains outside the proof boundary and forbidden; no `AcrPush` identity
  or private builder has been established. VNet-connected ACR agent pools are
  not presumed viable; the private self-hosted runner is only a candidate.
- Reconcile every principal, role, owner, credential record, and workload
  identity without deleting any principal.
- Validate the separate runtime and edge templates at provider level in an
  isolated nonproduction target; verify private-link approval, DNS resolution,
  controlled ingress, and direct-origin denial.
- Add/verify managed WAF rules and identify required subscription/RG policy
  assignments, exemptions, and drift controls.
- Establish the approved production reviewer rule and reconcile immutable
  artifact provenance end-to-end.
- Verify PostgreSQL, Key Vault, Storage diagnostics and private-network controls.

## DEFERRED_TO_G3

Measured capacity baselines, load/failure testing, availability/SLO proof,
transactional data migration and rollback. Do not upscale database or runtime
profiles solely because legacy static configuration is large.

## DEFERRED_TO_G4

Canada East service/model support, restore, failover, provenance recovery, and
timed RPO/RTO exercises.

## DEFERRED_TO_G5

End-to-end audit completeness, telemetry/security separation, log access and
retention, alert delivery, incident ownership, and exercised response paths.

## DEFERRED_TO_G6

Budgets, cost allocation and anomaly proofs, and measured cost-driver review.

## G2_PREFLIGHT_AND_EXECUTION_OUTCOME

Approved scope was synthetic-only `union-eyes` / `integration-test` in Canada
Central and the four named resource groups. The current result is **no
deployment**: all four groups returned `false` from `az group exists`, and no
Azure resource or GitHub configuration was changed.

| Historical validation (before the private ACR source changes) | Result |
|---|---|
| Bicep compilation of foundation, operations, runtime, edge, private endpoint, subscription, and legacy digest-gate entrypoints | Passed before private ACR source changes |
| `node infrastructure/landing-zone/validate.mjs <compiled-artifact-directory>` | Passed |
| `pnpm exec vitest run --project=contract-tests tooling/contract-tests/landing-zone-foundation.test.ts` | Passed: 29 tests; 12 compiled-template tests skipped because `G1_BICEP_OUTPUT` was unset. The separate emitted-template validator passed. |
| `pnpm typecheck` | Passed: Turbo typechecked 259 packages |
| `pnpm validate:docs` | Passed with 0 errors, 1,215 warnings, and 1,690 info findings |
| `az deployment sub validate` | Passed with preflight-only values, including a placeholder digest/source commit; this is not artifact or deployment proof |
| `az deployment sub what-if` | 44 `Create` changes; the corrected parser read the top-level `changes` array and found zero resource IDs outside the four approved RGs. This predates ACR changes and is stale for deployment review. |
| `gh api repos/anungis437/nzila-os/actions/runners` | Passed read-only query; zero self-hosted runners |

The historical proposed change counts were 10 in the edge RG, 2 in operations, 2 in
security, and 30 in the UE synthetic integration/test RG. The resource-type
counts are 4 resource groups, 2 Container Apps managed environments, 1
Container App, 8 Front Door profile resources, 3 PostgreSQL Flexible Servers,
3 Key Vaults, 4 Storage accounts, 6 private endpoints, 8 private DNS zones, 1
VNet, 1 user-assigned managed identity, 2 Log Analytics workspaces, and 1 WAF
policy. These are proposed changes only.

The corrected historical scope check closes the earlier parser error: the JSON contains
the `changes` array at its root, not under `properties`. The first parser read
the wrong property and reported a misleading scope failure; the full corrected
check found 44 proposed resource changes, all `Create`, with none outside the
approved RGs. This does not make the parameters deployable or prove runtime
behavior. No current what-if has been run against the private-ACR templates.

### Private artifact source follow-up (2026-10-10)

The proof source no longer accepts an arbitrary registry host. It now declares
a proof-scoped Premium ACR with public network access, admin credentials,
anonymous pull, and Azure-service bypass disabled; a `registry` private
endpoint with `privatelink.azurecr.io`; and registry-scoped `AcrPull` for the
foundation workload UAMI. The proof runtime obtains the login server from that
ACR module. Source adds a fourth private endpoint and a fifth private DNS
zone/link to the product foundation.

Source-only checks after these changes:

| Check | Result |
|---|---|
| `az bicep build` for canonical foundation, runtime, edge, operations, private ACR, subscription entrypoint, integrated proof, artifact-foundation stage, and legacy digest-gate entrypoint | Passed. Legacy Sentinel/Key Vault warnings are pre-existing. |
| `node infrastructure\landing-zone\validate.mjs <compiled-artifact-directory>` | Passed: emitted private controls validated; no runtime certification. |
| `G1_BICEP_OUTPUT=<compiled-artifact-directory> pnpm exec vitest run --project=contract-tests tooling\contract-tests\landing-zone-foundation.test.ts` | Passed: 50 tests, including compiled-template checks and negative checks for public ACR and incorrect `AcrPull` role, scope, and principal. |
| `node infrastructure\landing-zone\synthetic-health\server.test.mjs` | Passed: 3/3 synthetic health endpoint tests (source-level only; no runtime deployed). |
| Direct TypeScript check using `tooling/contract-tests/tsconfig.json` | Not run: the attempted config path does not exist. |

### Fresh non-mutating provider preflight (2026-10-10)

Exact commands:

```powershell
az deployment sub validate --name nzila-g2-artifact-preflight-20261010 --location canadacentral --subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3 --template-file infrastructure\landing-zone\g2-artifact-foundation.bicep --parameters owner=platform costCenter=institutional
az deployment sub what-if --name nzila-g2-artifact-preflight-20261010 --location canadacentral --subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3 --template-file infrastructure\landing-zone\g2-artifact-foundation.bicep --parameters owner=platform costCenter=institutional --no-pretty-print
```

`validate` returned `provisioningState: Succeeded` and `error: null`. It
reported a `NestedDeploymentShortCircuited` warning for the registry module
because one nested parameter was not fully evaluated; therefore validation did
not validate every registry child resource.

`what-if` returned `status: Succeeded` and `error: null`. It proposed eight
`Create` changes, all confined to
`nzila-union-eyes-integration-test-rg` in Canada Central: the resource group,
Premium private ACR, workload UAMI, `privatelink.azurecr.io` private DNS zone
and VNet link, VNet/subnets, ACR private endpoint, and private DNS zone group.
It returned one `Unsupported` change for the intended registry-scoped
`AcrPull` role assignment: ARM cannot calculate the role-assignment resource
ID/API version until deployment because the assignment GUID uses the UAMI
principal ID returned by a deployment-time `reference()`. This is not evidence
that the role assignment will succeed or fail. The role remains statically
scoped to the ACR and to the workload UAMI; do not widen it to work around the
what-if limitation. Resolve the assignment identity uncertainty before any
deployment.

The narrowed bootstrap contains no database, Key Vault, Storage, Container App,
Front Door, or Log Analytics resource. The `validate` warning and the
`Unsupported` role-assignment what-if result remain preflight limitations; the
fresh what-if is not a deployment approval. The preceding read-only inventory
reported the proof resource group absent and the current what-if proposes its
creation. No resource was deployed, and the stale historical 44-create
what-if remains inapplicable to this narrowed template.

This is source preparation, not a live in-boundary registry: no ACR or role
assignment has been deployed, no proof-scoped `AcrPush` identity has been
granted, no private builder has been proven, and no immutable synthetic image or provenance has
been verified. The existing staging ACR in `nzila-canada-staging-rg` remains
forbidden. ACR VNet agent pools are not accepted as a build dependency without
preview, quota, monitoring-egress, and private-connectivity proof. A
short-lived private self-hosted builder remains an unapproved candidate.

The artifact-first `g2-artifact-foundation.bicep` now composes only a
proof-scoped VNet/DNS/UAMI module and the private ACR module; it no longer
composes the full product data foundation or shared diagnostics. Fresh
non-mutating preflight has been run and its proposed scope reviewed. Deployment
remains blocked by the `AcrPull` role-assignment what-if limitation, absent
private builder/build identity and immutable artifact provenance, and
unresolved private operator/deployment and database-admin prerequisites.

A dedicated database-admin group, least-privilege deployment identity, private
operator/build route, artifact provenance, and live runtime proofs remain
unresolved. Do not deploy or weaken the scope to clear these blockers.

No runtime assertions were executed: private DNS and data-plane reachability,
Front Door-to-origin connectivity, direct-origin denial, unauthorized identity
denial, WAF behavior, diagnostic delivery, artifact provenance, and adversarial
falsification all remain **unproven**. Production governance also remains
unresolved: an authorized repository/org administrator must add and verify at
least one required reviewer on the GitHub `production` environment before any
production deployment. No governance rule was changed.

## Current identity and private-builder closure update

The source now expresses three separate identity contracts:

| Identity | Intended permission | Live state |
|---|---|---|
| Proof workload UAMI | `AcrPull` on the proof ACR only | Declared in source; not provisioned |
| Builder UAMI | `AcrPush` on the proof ACR only | Declared in source; not provisioned |
| Deployment/operator identity | Separately approved deployment-scope permissions; no registry push or application data-plane access | Not selected or provisioned |

The role-assignment name for runtime pull is deterministic from the stable
UAMI resource ID. The build identity and role are separate from runtime. Static
source and emitted-template tests enforce the distinct role, principal, and
exact registry scope; they do not prove that either assignment has been
created or that the identities can authenticate.

The selected builder path is a short-lived private Linux VM in the dedicated
builder subnet, invoked through Azure VM Run Command rather than public
SSH/RDP, with the builder UAMI attached. The subnet has
`defaultOutboundAccess: false` and its NSG denies inbound traffic. The VM,
temporary NAT/egress arrangement, build, push, image digest, source-commit
provenance, and cleanup have not been provisioned or tested. An approved
outbound path is still required for Azure control-plane/Run Command access and
the pinned Docker Hub base image. ACR VNet agent pools remain unselected and
unproven.

Fresh linked Bicep compilation, emitted-template validation, and the focused
landing-zone contract suite passed; the suite reported **57 tests passed**.
The source-level synthetic health suite also passed **3/3** in a fresh run.
These results do not constitute Azure deployment or runtime proof.

Fresh provider `validate` succeeded with `error: null` but returned
`NestedDeploymentShortCircuited` for a nested registry module, so that result
does not validate every registry child. A repeat direct structured JSON
what-if against the narrow artifact-foundation template completed with **12
top-level `Create` changes, 0 `Unsupported`, 0 `Modify`, and 0 `Delete`**,
all in `nzila-union-eyes-integration-test-rg` / Canada Central: resource group,
private Premium ACR, registry-scoped `AcrPull` and `AcrPush` role assignments,
runtime UAMI, builder UAMI, builder NSG, private DNS zone, VNet link, ACR
private endpoint, DNS zone group, and proof VNet. This resolves the former
what-if `Unsupported` result; it does not prove successful deployment-time
role assignment or reachability.

The validation helper reported 13 creates, while its PowerShell recipe counts
formatted `+ ` output lines. The direct JSON `changes` array contains 12
resource changes and is the authoritative resource count. Preserve this
presentation discrepancy rather than treating it as a thirteenth resource.

Read-only identity inventory confirms that
`nzila-g2-integration-test-db-admins` and the proof resource group remain
absent. The signed-in `support@onelabtech.com` account has broad subscription
Owner and tenant-root User Access Administrator authority and is not evidence
of the intended dedicated operator identity. Human authorization is still
required for the least-privilege operator and for the exact database-admin
group owner/member list. Do not remove existing principals without dependency
proof. The production-reviewer hold remains separate.

The Bicep recipe checklist for this preflight is recorded in
[deployment-plan.md](../../.azure/deployment-plan.md): core CLI/auth/build/
validate/what-if completed with the nested-validation caveat; lint passed with
zero SARIF diagnostics for the four changed G2 Bicep entrypoints; and the
subscription policy-assignment review found `ASC Default` in audit-only mode
and an inherited region restriction that blocks West Europe, not Canada
Central. This is assignment-level review only, not deployed-resource
compliance evidence. No Azure resources, directory groups, identities, role
assignments, credentials, GitHub configuration, or runtime were mutated.

## FILES_CHANGED / RUNTIME_CHANGES

- Updated [deployment-plan.md](../../.azure/deployment-plan.md).
- Updated [landing-zone.bicep](./landing-zone.bicep),
  [operations.bicep](./operations.bicep),
  [foundation.bicep](./foundation.bicep), [runtime.bicep](./runtime.bicep),
  and [edge.bicep](./edge.bicep) with proof-scope tag propagation.
- Added [g2-proof.bicep](./g2-proof.bicep), which composes foundation, runtime,
  and edge for the fixed synthetic proof boundary.
- Added [artifact-registry.bicep](./artifact-registry.bicep) and
  [g2-artifact-foundation.bicep](./g2-artifact-foundation.bicep); updated the
  foundation DNS, private-endpoint allowlist, proof registry wiring, validator,
  focused contracts, [README.md](./README.md), and
  [deployment-plan.md](../../.azure/deployment-plan.md). The G2 bootstrap
  now provisions only the proof network/DNS/UAMI and ACR boundary.
- Updated [validate.mjs](./validate.mjs) and
  [landing-zone-foundation.test.ts](../../tooling/contract-tests/landing-zone-foundation.test.ts)
  for the emitted orchestration contract.
- Updated this evidence report.
- `pnpm validate:docs` regenerated
  [doc-consistency.json](../../reports/doc-consistency.json) and
  [doc-consistency.md](../../reports/doc-consistency.md); both were already
  modified in the pre-check baseline and remain unstaged.
- No Azure resource, GitHub environment, workflow, identity, role, credential,
  DNS, or production runtime was changed. Read-only validate/what-if calls were
  performed; no deployment, migration, cutover, commit, or staging operation
  was performed.

## G2_BOOTSTRAP_DEPLOYMENT

**Disposition: `BOOTSTRAP_DEPLOYMENT_FAILED` (blocked before deployment).**
This is a pre-deployment gate failure, not a failed Azure deployment.

- Authorization: the latest user instruction authorizes only the synthetic
  bootstrap in subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3`, Canada
  Central, and `nzila-union-eyes-integration-test-rg`. It does not authorize
  production/staging resources, product data, migrations, DNS changes, or
  runtime cutover.
- Concurrency checkpoint before this evidence update: branch `main`, HEAD
  `1c337567635bb86ea0df7831557d8d2d22df1e6f`, zero staged paths, and 280
  worktree entries. The scoped plan, validation status, and G2 evidence paths
  were already untracked. No foreign work was staged, reverted, stashed,
  committed, accepted, or dispositioned.
- Live target check: authenticated Azure CLI identity was
  `support@onelabtech.com` in tenant `5082b8be-b04d-4a13-b61c-b6397670177b`
  on the approved subscription; the target proof resource group did not exist.
- Deployment name/ID: none. Deployment result: **not started**. No Azure
  resources, VMs, public IPs, firewall, routes, managed identities, or role
  assignments were created or changed. No cleanup was performed.
- The latest previously recorded provider what-if is stale for this
  authorization: it covers the 12-resource artifact foundation only and does
  not include a VM builder or controlled egress. No final builder-inclusive
  validate/what-if was produced in this turn; the 12-change result is not
  treated as approval for a different change set.
- The private VM builder and egress path are not implemented in the current
  template. A deterministic FQDN allowlist requires a separately represented
  outbound enforcement path; the candidate Azure Firewall Basic path would
  add an `AzureFirewallSubnet`, Firewall public IP, Azure Firewall, and a
  builder-subnet route table/route beyond the previously reviewed resources.
  This resource delta has not been incorporated into a final what-if or
  validated against the approved change-set boundary. No public egress or
  default outbound path was enabled as a workaround.
- Official validation workflow checkpoint remains `ResolveErrors`, not
  `Validated`; the deployment plan still records validation as a hard
  prerequisite. Per the Azure validation/deployment workflow, deployment was
  not invoked and this state was not manually advanced.
- Source provenance is also not ready: the synthetic-health build context is
  untracked and absent from HEAD `1c337567635bb86ea0df7831557d8d2d22df1e6f`.
  That HEAD cannot truthfully be recorded as the source commit for an image
  built from the current working tree.
- Builder DNS resolution, ACR private connectivity, public data-plane denial,
  Run Command, effective positive/negative RBAC, image digest, source
  provenance, and runtime tests were not run. No image was built or pushed.
- `COST_BEARING_TEMPORARY_RESOURCE`: none created. An indicative Canada
  Central Linux `Standard_B2s` VM rate was returned as CAD 0.0657/hour
  (approximately CAD 47.96 per 730 hours, excluding disk and egress). No
  authoritative Firewall Basic price was returned, so firewall cost remains
  unestimated and no firewall was provisioned.
- `HUMAN_ACTION_REQUIRED`: review the exact firewall/route/public-IP resource
  delta and its cost before it is added to the approved deployment set. Also
  publish or otherwise establish a source commit containing the synthetic
  builder input before claiming commit-based provenance. The deployment plan
  must then pass the official validation workflow and produce a fresh
  builder-inclusive structured what-if before any Azure mutation.

## G2_STATUS

`FAIL`.

The gate did not pass. The latest structured what-if calculates both
registry-scoped role-assignment resources, but no deployment occurred.
Artifact provenance, private-builder egress and lifecycle, dedicated operator
identity, database-admin group authorization, and runtime evidence remain
unproven.
There is no synthetic runtime evidence, and the existing live estate's public
ACA access, UE origin without Front Door Private Link, absent private
endpoints/private DNS zones, unresolved identity ownership, and missing
production reviewer rule remain unchanged. This is not a production-readiness
or security approval.

G1 remains **`PASS_WITH_LIMITATIONS` for architectural/source preparation only**
as recorded in [README.md](./README.md). This does not pass security, DR,
reliability, tenant isolation, audit completeness, or production readiness.

## G2_BUILDER_EGRESS_PROVENANCE — current preflight update

### CONCURRENCY_CHECKPOINT

Immediately before this update, branch `main` remained at HEAD
`1c337567635bb86ea0df7831557d8d2d22df1e6f`. The expanded
`git status --short --untracked-files=all` snapshot contained 291 paths: 61
modified tracked files, 230 untracked files, and zero staged files. Concurrent
work continues across the repository. No foreign path was staged, reverted,
stashed, committed, or dispositioned. The source and evidence paths described
here remain untracked; no source provenance commit was created.

### Source contract and validation

The synthetic service now exposes only `GET /health/liveness` and
`GET /health/readiness`. The Docker health check and landing-zone runtime input
contract use the same paths. The Docker build context is restricted to
`server.mjs`; unrelated files are excluded.

Current read-only checks:

| Check | Result |
|---|---|
| `node infrastructure\landing-zone\synthetic-health\server.test.mjs` | **Passed, 3/3** |
| `docker buildx build --check --file infrastructure\landing-zone\synthetic-health\Dockerfile infrastructure\landing-zone\synthetic-health` | **Passed**, no warnings; Buildx resolved the pinned base-image metadata and reported a 60-byte context. This was a syntax/check operation, not an image build or push. |
| Current G1/G2 Bicep entrypoint builds | **Passed** for foundation, runtime, edge, operations, proof, artifact foundation, artifact network, and artifact registry. |
| G2 Bicep lint | **Passed**, zero SARIF diagnostics for the four G2 entrypoints/modules. |
| `node infrastructure\landing-zone\validate.mjs <compiled-artifact-directory>` | **Passed** against the freshly compiled current landing-zone templates. |
| `pnpm exec vitest run --project=contract-tests tooling\contract-tests\landing-zone-foundation.test.ts` with `G1_BICEP_OUTPUT` set to the compiled outputs | **Passed, 52/52; zero skipped.** The legacy-main test fixture was the previously captured session artifact; the current G1/G2 landing-zone templates were rebuilt from this worktree. |

These checks validate source contracts only. They do not establish a deployed
builder, firewall, egress policy, image, or runtime. The compiled
artifact-foundation output still has the previously reviewed 12-resource
boundary and does not include a VM or controlled egress.

### Egress decision and Azure boundary

Microsoft's [Linux VM extension network-access guidance](https://learn.microsoft.com/azure/virtual-machines/extensions/features-linux#network-access)
says a supported Azure Linux Agent can redirect agent communication through
the Azure fabric controller, while an unsupported agent may require regional
Azure Storage access. It also identifies `168.63.129.16` as necessary for
extensions and notes that lack of access to `*.blob.windows.net` and
`*.blob.storage.azure.net` can delay agent initialization and extension
installation. No builder VM or agent version exists here to verify which path
would apply.

The source image remains pinned to
`node:22.14.0-alpine3.21@sha256:9bef0ef1e268f60627da9ba7d7605e8831d5b56ad07487d24d1aa386336d1944`.
The build-check resolved its metadata from Docker Hub, but no Docker Hub pull
was performed by a private builder and no minimal destination set has been
proven. Because the exact builder/agent and external image-fetch dependency set
is not evidenced, no permissive or guessed firewall allowlist, firewall,
public IP, route table, or builder VM was added.

The existing 12-resource what-if remains stale for builder/egress scope. No
fresh provider `validate` or structured builder-inclusive `what-if` was run;
`.azure/validate-status.json` remains at `ResolveErrors`, not `Validated`.
The current mission explicitly prohibits Azure deployment. No Azure resource,
identity, role assignment, route, DNS, product workload, or runtime was
created or changed. No image was built or pushed.

### Cost evidence and limits

Canada Central retail-price evidence is in CAD. The following 1-, 4-, and
24-hour scenarios assume one Standard_B2s VM, Azure Firewall Basic, one
Standard static IPv4 on the firewall, and an assumed 32-GiB Standard SSD E4
LRS OS disk, all present only for the stated window. The disk estimate
prorates CAD 3.74/month over 730 hours. The table's traffic scenario assumes
1 GB total processed by Azure Firewall. It includes one full CAD 2.36 daily
Premium ACR registry unit per scenario, conservatively, because the registry
is persistent and sub-day billing granularity was not confirmed.

| Builder window | VM + firewall + firewall IP + assumed OS disk | With 1 GB firewall processing | Add one daily Premium ACR unit | Scenario subtotal |
|---:|---:|---:|---:|---:|
| 1 hour | CAD 0.6403 | CAD 0.7324 | CAD 2.36 | CAD 3.0924 |
| 4 hours | CAD 2.5613 | CAD 2.6534 | CAD 2.36 | CAD 5.0134 |
| 24 hours | CAD 15.3678 | CAD 15.4599 | CAD 2.36 | CAD 17.8199 |

Rate components: Standard_B2s CAD 0.0657/hour; Firewall Basic CAD
0.5595/hour plus CAD 0.0921/GB processed; Standard static IPv4 CAD
0.01/hour; E4 LRS disk CAD 3.74/month; Premium ACR CAD 2.36/day plus CAD
0.14/GB/month stored. These are planning estimates, not a bill or deployment
quote. Registry storage, Private Link endpoint/data-processing charges,
Azure internet bandwidth charges, taxes, and any additional VM-agent or
extension traffic are excluded because they were not resolved in the
Canada-Central itemized query. Thus the cost boundary is **not complete** and
must not be treated as deployment approval.

### FILES_CHANGED / RUNTIME_CHANGES / FOREIGN_CHANGES_OBSERVED

Changed within this task:

- [synthetic-health/server.mjs (historical source)](https://github.com/anungis437/nzila-os/blob/92f706b61a2077eeda5d8ac733ee361d51a2d3b9/infrastructure/landing-zone/synthetic-health/server.mjs)
- [synthetic-health/server.test.mjs (historical source)](https://github.com/anungis437/nzila-os/blob/92f706b61a2077eeda5d8ac733ee361d51a2d3b9/infrastructure/landing-zone/synthetic-health/server.test.mjs)
- [synthetic-health/Dockerfile](./synthetic-health/Dockerfile)
- [synthetic-health/.dockerignore](./synthetic-health/.dockerignore)
- [landing-zone-foundation.test.ts](../../tooling/contract-tests/landing-zone-foundation.test.ts)
- [deployment-plan.md](../../.azure/deployment-plan.md)
- This evidence report.

Runtime changes: **none**. Foreign changes observed: 61 modified tracked paths
and 230 untracked paths in the immediately preceding expanded baseline, with
zero staged paths. They remain untouched and undispositioned.

### G2_BOOTSTRAP_DISPOSITION

**`BOOTSTRAP_NOT_READY`**. Overall G2 remains **`FAIL`**. The prior
`BOOTSTRAP_DEPLOYMENT_FAILED` label continues to mean blocked before
deployment, not that an Azure deployment failed. Do not deploy.

Remaining closure items include a reviewed bounded egress strategy, itemized
private-endpoint and bandwidth cost evidence, a source-only commit that can be
created without disrupting the concurrent worktree, a fresh provider
validation and structured builder-inclusive what-if, and separately
authorized live builder/image/runtime proof.
