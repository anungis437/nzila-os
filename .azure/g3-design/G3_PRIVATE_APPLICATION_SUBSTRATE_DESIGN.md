# G3_PRIVATE_APPLICATION_SUBSTRATE_DESIGN

Mission `NZ-20261008-INFRA-001`. **DESIGN ONLY / SYNTHETIC ONLY**.
G3 runtime state: **NOT_EXECUTED**, not PASS and not production-ready.
The [governance decision](G3_GOVERNANCE_DECISION.md) authorizes this design,
not implementation, Azure reads/preflight/mutations or application deployment.

## 1. Evidence, concurrency and architectural inventory

Design worktree: `C:\APPS\worktrees\nzila-g2-provenance`,
branch `g2/synthetic-health-source`,
HEAD `7bec20aad11d43eeae8099c14e021b3074154b27`.
Initial status: untracked `.azure/` and `infrastructure/landing-zone/g2-builder/`.
Shared product worktree: `C:\APPS\nzila-os`,
observed HEAD `1c337567635bb86ea0df7831557d8d2d22df1e6f`.
It has extensive foreign changes, including modified legacy Bicep and an
untracked newer landing-zone. Those changes are inputs, not owned deliverables.
No staging/stashing/reverting/committing/disposition of foreign work occurs.

The [source inventory](SOURCE_INVENTORY.json) binds reviewed bytes, both HEADs,
the supplied authority and G2's sealed evidence. Shared-worktree observations
are explicitly **uncommitted target declarations**, not live Azure proof.
No current Azure inventory is taken. Last live observation is the
[G2 terminal estate](../evidence/G2_TERMINAL_LIVE_ESTATE.json) at
2026-10-12T00:42:37Z; its 16-resource census is historical evidence, not a claim
of freshly observed state during this design.

| Repository surface | Actual pattern | G3 interpretation |
|---|---|---|
| [Legacy orchestrator](../../infrastructure/bicep/main.bicep) and [ACA module](../../infrastructure/bicep/modules/container-apps.bicep) in isolated HEAD | Container Apps Consumption profile; tag images; shared UAMI; DB secrets; public ingress default; bundled DB/edge/monitoring | Prior art only. Do not deploy it: default app array includes products, large prod profiles and mutable tags |
| Shared-worktree legacy ACA modifications, hash-bound in inventory | Production digest map with no tag fallback; nonproduction still permits tags | Record concurrency divergence; no repair/overwrite or inference that it is deployed |
| Shared-worktree `infrastructure/landing-zone/README.md`, `runtime.bicep`, `foundation.bicep` | G1 target: Canada Central, product/environment boundaries, private services, dedicated identity; internal workload-profiles runtime and digest images; foundation also creates DB/storage | Strongest architecture prior art, not a ready G3 module. Product allow-list is UE/Cora; do not label a synthetic platform proof as either product. Do not deploy bundled data resources |
| [GitOps README](../../infrastructure/gitops/README.md) | Container Apps delivery; historical tag example | Existing delivery ownership, not permission to dispatch |
| [Web production workflow](../../.github/workflows/deploy-web-production.yml) | Separate build/deploy authority, source-SHA tag plus digest deployment, revision rollback | Reuse concepts, not product workflow or identities |
| [Deployment authority inventory](../../docs/readiness/deployment-authority-inventory.md) and [historical Azure baseline](../../docs/readiness/azure-production-baseline.md) | ACA-centric operational history; varying dated findings | Dated observations do not override current mission or product NO_GO |
| [Deployment profiles](../../docs/categories/platform-and-operations/deploy/profiles.md) | App Service in managed/sovereign/hybrid diagrams; older non-Canadian default geography | App Service is contemplated, not selected/deployed proof. Canadian contract supersedes its geography example for this mission |
| [G2 builder](../../infrastructure/landing-zone/g2-builder/builder.bicep) and [Stage2B runtime](../../infrastructure/landing-zone/g2-builder/stage2b/runtime.bicep) | Private ACR, repository ABAC, distinct VM identities, scoped proof and teardown | Consume immutable evidence and technique; no VM-as-production-runtime inference |
| [Synthetic Go server](../../infrastructure/landing-zone/synthetic-health/main.go) and [scratch Dockerfile](../../infrastructure/landing-zone/synthetic-health/Dockerfile) | Minimal Go health server, non-root scratch container pattern | Suitable source prior art, but no configuration/identity/secret/lifecycle proof yet. Do not edit frozen G2 source |

Scanned Bicep and infrastructure/workflow paths contain no App Service or
Functions deployment module; App Service appears in the cited architecture
document. Functions is a governance-proposed alternative, not established
repository infrastructure. This is a bounded inventory, not a claim that no
such code exists anywhere in every product/package.

## 2. Runtime comparison and selection

Scores: 1 weak, 3 viable with work, 5 strongest fit. They are design judgments,
not benchmarks, service guarantees or current live capability proofs.

| Criterion | ACA workload profiles / Consumption | App Service Linux custom container | Functions Premium/custom container | Private VM |
|---|---:|---:|---:|---:|
| Actual Nzila Bicep/delivery fit | 5 | 2 | 1 | 3 |
| Private ingress + named egress controls | 5 | 4 | 4 | 5 |
| Dedicated managed identity | 5 | 5 | 5 | 5 |
| Digest-bound OCI image consumption | 5 | 4 | 4 | 4 |
| Governed synthetic secret reference | 5 | 5 | 5 | 4 |
| Managed lifecycle / operational simplicity | 5 | 5 | 3 | 1 |
| Progressive idle/proof capacity | 5 | 3 | 2 | 3 |
| Portable synthetic container contract | 5 | 5 | 2 | 4 |
| Future multi-product reuse with isolated identities | 5 | 4 | 3 | 2 |
| Total /45 | 45 | 37 | 29 | 31 |

**Select Azure Container Apps**, a new **internal workload-profiles environment**
using only the **Consumption** workload profile. Do not confuse this with the
legacy Consumption-only environment, which lacks the same egress capabilities.
Use internal load-balancer ingress, not an ACA Private Link endpoint for this
single-VNet proof. Private Link for ACR/Key Vault remains required.

Reasons: consistent Canadian landing-zone target and existing image/revision
delivery practices; immutable portable Linux container; managed identity;
small Consumption allocation; no Kubernetes cluster ownership or dedicated
App Service minimum capacity. G3 still has to prove native ACA private image
pull with ABAC; G2's custom VM HTTP pull does not prove it.

App Service is viable but adds a different plan/slot/SCM surface, independent
inbound Private Link and outbound VNet integration, and new IaC/delivery work.
Its Private Endpoint alone does not privatize outbound traffic. Functions
adds an unnecessary trigger/host contract for a long-running HTTP proof;
Flex Consumption has no custom-container support, while Premium/Dedicated
add capacity floors. VM hosting repeats OS/package supervision already
encountered in G2 rather than proving a managed reusable application substrate.
AKS is not required; no cluster is justified by this synthetic proof.

## 3. Concrete target and environment boundaries

- Subscription: existing transitional subscription
  `5d819f33-d16f-429c-a3c0-5b0e94740ba3`.
- Tenant: `5082b8be-b04d-4a13-b61c-b6397670177b`.
- New RG: `nzila-shared-test-g3-001-rg`; Canada Central, integration-test,
  platform-owned, synthetic-only. Never use a product RG/environment.
- Proposed VNet `10.91.0.0/16`; apps `10.91.0.0/27`, private endpoints
  `10.91.3.0/24`, builders `10.91.4.0/28`, proof clients `10.91.5.0/28`.
  Address availability/nonoverlap is **not live-verified**; collision is a stop,
  not permission to silently choose another range.
- Private-endpoint subnet NSG enforcement requires the corresponding private
  endpoint network policy enabled and provider-validated. A subnet NSG with
  endpoint policies disabled is not credited as endpoint access enforcement.
- No peering, G2 subnet mutation, shared firewall update, NAT Gateway, public
  application ingress, product DNS, Front Door or WAF. No multi-region runtime.
- Future reuse means module/contract reuse, not sharing product secrets,
  identities or app environments by default. Products remain separately gated.
- Tag every taggable parent: `product=Nzila`, `environment=integration-test`,
  `service=<resource function>`, `owner=Nzila Platform`,
  `cost_center=NZ-20261008-INFRA-001`, `data_classification=synthetic-only`.
  Add `purpose=infrastructure-proof`, `gate=G3`, transaction ID and expiry.
  Untaggable children inherit documented parent attribution.

## 4. Resource manifest (proposed; none created)

All names below are selected **design names**, not a name-availability assertion.
Regional resources are Canada Central; DNS/authorization resources are global
metadata scope. Every resource uses the new RG except explicitly listed
existing ACR children. C=create, U=update, D=delete refers only to authority a
future approved transaction would need; **current authority is NONE**.

T = `TRANSIENT_PROOF`; C = `CANDIDATE_STEADY_STATE`; E = retained proof evidence.
Default outcome is removal of T and C. Retention of C needs a separate explicit
accepted inventory; no automatic adoption into production.

| ARM type / logical item | Exact proposed name | Identity / attachment / public exposure | Disposition; future authority | Monthly cost basis |
|---|---|---|---|---|
| `Microsoft.Resources/resourceGroups` | `nzila-shared-test-g3-001-rg` | Platform governance; no data ingress | T; C,D only if transaction-created and empty | $0 |
| `Microsoft.Network/virtualNetworks` | `nzila-g3-test-001-vnet` | Four named subnets; no peering | C; C,D; U only own subnet policies | $0 control plane |
| VNet subnets (four) | `apps`, `private-endpoints`, `builders`, `proof-clients` | Apps delegated to `Microsoft.App/environments`; PE undelegated; clients no public IP | C; C,D with own VNet | $0 |
| `Microsoft.Network/networkSecurityGroups` (four) | `nzila-g3-test-001-{apps,pe,build,probe}-nsg` | Respective subnet; explicit allow then deny, not default broad VNet/Internet allow | C except build/probe T; C,U,D | $0 |
| `Microsoft.Network/privateEndpoints` | `nzila-g3-test-001-acr-pe` | PE subnet -> existing G2 ACR, registry group; private HTTPS | C; C,D; explicit target connection approval only | $7.30 + processing |
| PE NIC (provider-managed) | Provider-returned NIC of `nzila-g3-test-001-acr-pe` | Exact ID captured from PE; no guessed deletion/name | C; owned by PE, not separately PUT | Included in PE |
| ACR PE DNS zone + link + zone group | `privatelink.azurecr.io`; link `nzila-g3-test-001-acr-link`; zone group `default` | New RG zone linked only to G3 VNet; login/data records managed by zone group | C; C,D; no G2 DNS edit | $0.50 zone + queries |
| ACR DNS records (provider-managed) | `nzilag2tzo75uuozprbo`, `nzilag2tzo75uuozprbo.canadacentral.data` | Map to the new PE's captured private addresses, not hardcoded G2 .5/.4 | C; owned by zone group | Included |
| ACR target connection child (provider-managed) | Connection ID returned for `nzila-g3-test-001-acr-pe` | Under existing `nzilag2tzo75uuozprbo` in G2 RG | C; approve/remove only this connection under separate authority | No extra registry base fee |
| `Microsoft.ManagedIdentity/userAssignedIdentities` (three) | `nzila-g3-test-001-{app,build,probe}-mi` | App -> ACA only; build -> build VM only; probe -> probe VM only | App C; build/probe T; C,D | $0 |
| `Microsoft.KeyVault/vaults` | `nzl-g3-test-001-kv` | Standard, RBAC, public Disabled, bypass None, purge protection, 90-day soft delete | C; C,D; **no purge** | Operation-meter quote pending |
| KV secrets (data-plane items) | `substrate-proof`, `unrelated-proof` | Both random synthetic values; app permitted only first; version IDs captured, values never evidence | E metadata/tombstone; set/disable/soft-delete under future proof authority | Operations |
| KV PE + provider NIC | `nzila-g3-test-001-kv-pe`; returned NIC ID | PE subnet -> `vault`; HTTPS private only | C; C,D; NIC owned by PE | $7.30 + processing |
| KV DNS zone + link + zone group + record | `privatelink.vaultcore.azure.net`; `nzila-g3-test-001-kv-link`; `default`; `nzl-g3-test-001-kv` | Only G3 VNet; PE DNS association | C; C,D | $0.50 zone + queries |
| `Microsoft.OperationalInsights/workspaces` | `nzila-g3-test-001-law` | Proof console/system/KV telemetry only; no Sentinel/AI service | C; C,D; retention deliberate | $2.76/GB ingestion, no grant assumed |
| Diagnostic settings | `g3-runtime-proof`, `g3-secret-audit` | On ACA environment and KV respectively -> LAW | C; C,D | Included ingestion |
| `Microsoft.App/managedEnvironments` | `nzila-g3-test-001-env` | Apps subnet, internal=true, publicNetworkAccess Disabled; Consumption profile only | C; C,D; no topology mutation | Managed-network charges to quote |
| ACA provider-managed RG/resources | Requested RG `nzila-g3-test-001-managed-rg`; provider-returned ILB/NIC/IP IDs | Provider-owned; cannot enumerate intrinsic IDs before creation; exact manifest captured before acceptance | C; lifecycle via environment; no direct cleanup | LB/public egress meter quote pending |
| Internal ACA DNS zone + link + wildcard record | Environment-returned `defaultDomain`; link `nzila-g3-test-001-app-link`; record `*` | `*` -> returned private `staticIp`; not `privatelink.*` without an ACA PE | C; C,D | $0.50 zone + queries |
| `Microsoft.App/containerApps` | `nzila-g3-test-001-health` | App UAMI only; private ILB HTTPS -> port 3000; no custom domain or admin console use | T; C,U,D for exact image/config/revision | Compute/request formula below |
| Container app revisions (provider-managed) | Prefix `g3-<frozen contract prefix>`; exact returned revision ID | Same app identity; source/image/config binding captured | T; by app lifecycle | Replica compute |
| Proof VMs (two) | `nzila-g3-test-001-build-vm`, `nzila-g3-test-001-probe-vm` | Pinned Linux image; Standard_B2s; one corresponding UAMI each; no system MI, SSH, public IP or package egress | T; C,D; no G2 builder execution | VM quote pending; 4h each proposed |
| VM NICs + OS disks | `nzila-g3-test-001-{build,probe}-nic`; `nzila-g3-test-001-{build,probe}-os` | Respective subnet; 32GiB StandardSSD_LRS; no data disks | T; C,D exact transaction ownership | Disk/transaction quote pending |
| VM CSEs (one per VM) | Each VM's `g3-proof` child | Hash-bound local controller, no SAS/secret in command; guest input delivery must be validated | T; C,D; no RunCommand fallback | No separate CSE fee |
| Three registry role assignments | Logical names `g3-app-reader`, `g3-build-writer`, `g3-probe-reader` | Existing target ACR only; exact `g3-synthetic-app` ABAC condition | T; C,D only new assignment IDs | $0 |
| Three KV secret-scope assignments | `g3-app-secret-reader`, `g3-probe-secret-author`, `g3-probe-unrelated-author` | App Secrets User on `substrate-proof`; probe narrowly scoped author on the two synthetic secrets | T; C,D; revocation only own app-reader ID | $0 |
| Custom role definition + assignment(s) | Logical `g3-secret-author`, `g3-substrate-deployer`, `g3-boundary-approver` | Exact existing operator principals unresolved; actions/dataActions frozen before approval | T or preexisting delegated rights; no broad Contributor/Owner | $0 |
| OCI image content (data-plane item) | ACR repository `g3-synthetic-app`; tag `g3-<source SHA>-<contract SHA>` | Build writer only; runtime/probe read only; no product image | E; one new image push, **no artifact deletion** | Incremental existing ACR storage quote |

Logical role labels are not invented Azure assignment GUIDs. The future
implementation must render deterministic GUID names from the exact scope,
principal and role seed, and freeze the complete ID map before each assignment
write. Generated PE/ACA identifiers are expressly provider-resolved children,
not permission for unnamed operator-created resources. ARM deployments and
deployment-operation records must also have one exact transaction name per
approved phase; they are proof records, not disposable artifacts.

**G2 boundary delta:** a new ACR private connection, three new G3-conditioned
assignments and a new repository are necessary proposed additive changes to
the existing registry. These are not covered by G2 authorities. A future packet
must authorize precisely those additions and eventual connection/role removal.
Existing 16 resources, original private endpoint/DNS, bypass/public/admin
settings, G2 principals/conditions and retained repository bytes must remain
unchanged except the explicitly approved new connection metadata. No new ACR,
G2 VNet peering, source-registry import or AzureServices bypass is planned.

## 5. Identity and authorization matrix

| Identity | ARM permissions | Data-plane permissions / exact scope | Prohibited |
|---|---|---|---|
| Maintainer-selected deployment/operator principal | Custom enumerated actions for G3 resources only; UAMI assign action only three new UAMIs; no grant delegation by the runtime | None; no token/value evidence | G2 VM/network/RBAC replacement, product resources, broad Contributor/Owner |
| Separate boundary approver | Existing approved or temporary enumerated ACR private-connection approval and scoped role-assignment write/delete | None | Registry config change, arbitrary principals/conditions, artifact deletion |
| G3 build UAMI | `actions: []` | Repository Writer `2a1e307c-b015-4ebd-883e-5b7698a07328`, ABAC exactly `g3-synthetic-app`, conditionVersion 2.0 | App identity attachment, runtime management, tooling/G2/product repo access, secrets |
| G3 app UAMI | `actions: []` | Repository Reader `b93aa761-3e63-49ed-ac28-beffa264f7ac`, ABAC exactly `g3-synthetic-app`; Secrets User `4633458b-17de-408a-b874-0445c86b69e6` at named `substrate-proof` secret scope | Image write/delete, catalog listing, tooling/other repositories, unrelated secret, ARM writes |
| G3 probe/secret-author UAMI | `actions: []` | Same G3 repository Reader; custom KV dataActions only secret set/get/disable/delete needed by lifecycle, scoped to the two named synthetic secrets | App management, image write, role mutation, other vaults/secrets |
| G2 builder UAMI | Frozen existing contract, no new rights | Existing tooling Reader + synthetic-health Writer only | G3 app attachment, G3 repository/secret access |
| G2 runtime UAMI | Frozen existing contract, no new rights | Existing synthetic-health Reader only | G3 repository/secret/write/management rights |
| ACA/provider platform identities | Provider lifecycle only, no human-created RBAC assumed | No blanket customer ACR/KV grants | Substitute system identity, undocumented service principal/bypass |

Actual deployment/approver principal IDs, role definition IDs and exact ARM
actions remain an approval prerequisite; do not silently designate an existing
staging or production principal. No new app registration/federation is assumed.
All inherited/subscription/group grants must be included in the effective
census, not merely these direct assignments.

Never grant legacy `AcrPull` on this ABAC registry, grant Catalog Lister, or
broaden repository matching to make native pulls work. Existing terminal
evidence records ARM-audience token policy enabled; reread under future
preflight authority, do not change it silently.

## 6. Network contract and native platform constraints

Use the selected internal environment, app-level `external=true` for access
from the proof-client subnet **within the private VNet**, target port 3000,
`allowInsecure=false`, HTTPS on the default app FQDN. This is not public origin
access. ACA Private Link/Front Door is unnecessary for this isolated proof and
would add management charges and another ingress boundary. No ACA PE is planned.

| Source -> destination | Protocol / port | Control / authentication |
|---|---|---|
| Probe VM -> exact app FQDN/private ILB | TLS HTTPS 443; required backend edge port 31443 in NSG | Exact proof-client subnet allow; certificate/SNI validation; signed proof requests |
| ACA load balancer -> app subnet | TCP 30000-32767 documented platform health range | AzureLoadBalancer only; provider infrastructure requirement, not user administrative ingress |
| ACA within delegated app subnet | Platform-required subnet-local traffic | Explicit same-subnet allow; not broad cross-VNet/lateral allow |
| App/build/probe -> ACR login + dedicated data hosts | TLS 443 to new ACR PE IPs | ABAC UAMI; DNS private mapping + peer/SNI validation; no public ACR fallback |
| App/probe -> named Key Vault host | TLS 443 to KV PE IP | Selected UAMI, exact secret scope; no secret values in proof |
| App subnet -> Microsoft platform registries | HTTPS 443, MicrosoftContainerRegistry and AzureFrontDoor.FirstParty tags | Required managed-system image egress, not app Docker Hub access |
| App subnet -> identity services | HTTPS 443, AzureActiveDirectory tag | Required platform managed identity; local ACA identity endpoint is not VM IMDS |
| App subnet -> proof telemetry | HTTPS 443, AzureMonitor tag | LAW ingestion; no subscription-wide log query role |
| App subnet -> documented regional image/platform storage dependency | HTTPS 443, Storage.CanadaCentral tag if required by pinned platform schema | Explicit platform dependency allowance; not application storage integration or customer data access |
| All three guest/runtime subnets -> Azure DNS | TCP/UDP 53, AzurePlatformDNS / 168.63.129.16 | Azure-provided DNS; private zones linked only to this VNet |
| Build/probe VM -> WireServer/IMDS | Provider-documented guest-agent ports and local IMDS 80 | Exact agent/identity dependencies pinned before CSE; no public SSH |
| All remaining outbound and inbound | All | Explicit deny after the named platform/private rules; no Internet/AzureCloud 443 catch-all |

Selected lower-cost enforcement is **NSG service-tag/IP allow-listing**, not
FQDN-specific firewall policy. Service tags include provider-owned address
ranges shared with other tenants; they are named, bounded dependencies but
are **not tenant-specific exfiltration isolation**. State this limitation for
maintainer acceptance. No claim of arbitrary-egress prevention inside every
allowed Microsoft service tag, DNS exfiltration prevention, or full security
certification. Runtime/application test also attempts an unapproved HTTPS
destination and must be blocked. If the accepted G3 boundary requires narrower
FQDN/tenant controls, revise this design to a UDR/firewall packet with cost
approval; do not deploy a permissive workaround.

Public managed-platform control/telemetry endpoints are allowed dependencies;
private-by-default does not mean every Azure control endpoint is Private Link.
No arbitrary public package feeds, GitHub downloads, Docker Hub or external AI.
Required service tags/ports must be validated against the chosen API and
current official dependency documentation before execution. Missing ACA
startup connectivity is FAIL, not authority to add Internet allow or bypass.

Private DNS:

- New G3 `privatelink.azurecr.io` zone/zone group handles the **new** ACR PE's
  login and dedicated data IPs. Do not reuse G2's fixed .5/.4 in an isolated VNet.
- `privatelink.vaultcore.azure.net` maps the G3 vault to its PE.
- Internal app DNS zone is the **returned environment defaultDomain**, with
  wildcard A -> **returned staticIp**. Do not fabricate a deployment suffix or
  use ACA `privatelink.canadacentral.azurecontainerapps.io` without an ACA PE.
- Exact provider-generated DNS zone/IP outputs are resolved and bound during
  the approved create/configure phase before dependent writes. No public DNS
  cutover, resolver appliance or product zone links.

Ingress authentication: externally requested `/health`, `/ready`, `/proof/*`
require a proof-client Ed25519 signature over method/path/nonce/expiry;
deployment binds only the public key. The private key is ephemeral, never
in source/ARM/evidence/logs, and destroyed on teardown. Reject missing/invalid/
replayed/expired signatures with 401/403; require short nonce lifetime.
Native startup/liveness/readiness probes use separate `/probes/*` boolean
endpoints, explicitly unauthenticated inside the private boundary, with no
identity/config/secret output. They are not proof-client authorization tests.
TLS terminates at ACA; backend HTTP inside the platform is not claimed as
end-to-end mTLS. No custom certificates or public customer clients are needed.

## 7. Immutable executable artifact: a necessary new proof

The G2 synthetic artifact is a 326-byte JSON payload with artifact type
`application/vnd.nzila.g2.synthetic-health.v1` and empty OCI config. Its proven
manifest `sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690`
is **not a runnable Linux container image**. Assigning it to ACA would be a
category error. G2 proves path/provenance technique, not G3 native runtime pull.

Future artifact fields:

```text
ARTIFACT_REPOSITORY = g3-synthetic-app
ARTIFACT_TAG = g3-<full source SHA>-<frozen nonrecursive contract SHA>
ARTIFACT_MANIFEST_DIGEST = UNRESOLVED_UNTIL_APPROVED_BUILD
ARTIFACT_PAYLOAD_DIGEST = UNRESOLVED_EXECUTABLE_AND_LAYER_DIGESTS
ARTIFACT_TYPE = OCI_LINUX_AMD64_CONTAINER_IMAGE
OCI_MANIFEST_MEDIA_TYPE = application/vnd.oci.image.manifest.v1+json
OCI_CONFIG_MEDIA_TYPE = application/vnd.oci.image.config.v1+json
```

Build a non-root static Go synthetic executable in a scratch image, based on
the existing synthetic source pattern, in a **new** future G3 source location.
Bind source/tree/toolchain, executable SHA, tar layer compressed/uncompressed
digests, OCI config and manifest raw hashes, architecture, entrypoint and user.
No `latest`, public base image, product dependency or mutable deploy tag.
Compile/package twice locally with network disabled; exact reproducibility
must pass before any remote push. Nonrecursive source contract does not embed
its own or final image manifest digest. Image digest is a deploy input only.

Reuse the G2 approved pattern: local OCI packaging/strict descriptors,
no-retry private upload and digest readback with correct redirect/SNI/token
handling. A separately authorized G3 build identity/repository is a **formally
superseding application-image path**, not replay of consumed G2 authority.
Its new implementation must undergo its own source/schema/negative tests.
Do not run ORAS remote operations or import under this design.

Compiler/packager/CA-bundle provenance and guest delivery are prerequisites:
select versioned immutable inputs, validate archive/binary hashes and licenses,
stage only on an explicitly approved private channel, no guest package restore
or hidden internet bootstrap. The G2 ORAS archive may be a verified local
input only when its bytes and authorized transfer are explicitly bound; G3
identities are not automatically granted `g2-tooling` read.

Digest roundtrip binds uploaded manifest/config/layers, tag resolution,
image-by-digest in ARM and the exact healthy running revision, plus app-reported
source/executable/config binding. An environment variable echo of the desired
digest alone is not runtime image evidence. If ACA does not expose a measured
container image ID, disclose that platform-reporting limit; do not fabricate a
CRI hash or claim independent guest attestation/signing/SBOM certification.

## 8. Configuration and synthetic secret contract

| Class | Contract | Owner / mutation authority / audit / rollback |
|---|---|---|
| Immutable artifact | Source/build metadata, non-root entrypoint, fixed endpoint schema, no product data | Platform build owner; new source review/build authority; raw digest evidence; same previous immutable image |
| Deployment-time | Selected UAMI client ID, port 3000, probe public key, contract SHA, versioned secret URI | Platform deployer, hash-bound template/params; ARM operation + readback; previous complete config snapshot |
| Environment | Default domain, PE/private IPs, LAW ID, Canada Central; no product URLs | Platform network owner, enumerated resources only; provider outputs/readback; recreate from resolved contract |
| Secret reference | Versioned `https://nzl-g3-test-001-kv.vault.azure.net/secrets/substrate-proof/<version>` | Probe secret author on exact secret; audit operation metadata, no value; exact approved version, never portal-only edits |

Select **direct managed-identity resolution of a versioned Key Vault URI** for
the synthetic app, rather than injected ACA secret environment values.
It tests the application identity and private DNS path, makes per-request
revocation measurable, and avoids claiming that cached ACA environment secrets
are revoked immediately. This is a governed secret-reference mechanism, not
production secret migration or a recommendation to hand-roll general secret
management. Native ACA Key Vault references remain a future option with their
refresh/cache/restart semantics separately proven.

Probe author creates two random synthetic values over private TLS. App uses
the ACA injected identity endpoint/header and explicit client ID; token
audience is Key Vault. No tokens/identity headers are durable. Validate runtime
client/principal against approved bindings, not identity endpoint availability
alone. ARM operations stay outside runtime identity.

App's normal secret reference retrieves only `substrate-proof`'s pinned
version; a fixed negative-test path targets `unrelated-proof` and must deny.
Use an in-memory nonce/
MAC comparison between proof client and application to verify exact consumption;
persist only PASS/FAIL and safe request/status metadata, not value, derived
MAC, value hash or token. `unrelated-proof` retrieval must return authenticated
403. No echo, env dump, raw exception response body or broad catch/default.
Readiness fails with safe explicit error codes if required config, identity,
DNS, TLS or secret retrieval fails.

Revoke only the newly created app secret-reader assignment under the separate
approver's future authority. On **fresh** app retrieval (no successful-value
cache), require authenticated 403 and readiness failure within a bounded
10-minute observation window. Collect fresh-token and metadata evidence;
delayed RBAC propagation is not called an immediate revocation success.
Timeout is FAIL and stop. Restore only that exact role if the approved packet
permits a single recovery, otherwise proceed to teardown. No rollback depends
on a secret version that was disabled/deleted. Clear app/client memory and
destroy proof private keys/workspaces before VM deletion; do not claim
forensic erasure of provider caches.

## 9. Synthetic endpoints and proof telemetry

Proposed small app: static Go, no product/database/filesystem persistence.
CPU 0.25 vCPU / memory 0.5GiB, min=1/max=1 during active proof, no autoscale
benchmark. Idle retained model min=0/max=1 only if retention is explicitly
accepted. Single revision default; no duplicate-capacity canary/blue-green.

- `/health`: signed-client request, deterministic JSON status/schema.
- `/ready`: signed-client binding status; missing required config/secret/MI
  returns 503, not success-shaped fallback.
- `/proof/identity`, `/proof/secret`, `/proof/denials`: signed, bounded probes
  return booleans/sanitized metadata only. Never expose arbitrary URL/command.
- `/probes/startup`, `/probes/live`, `/probes/ready`: native platform boolean
  probe routes; explicit thresholds in implementation. Example design target:
  startup within 120s, health/readiness within 5min of revision start, ten
  consecutive healthy checks spaced 10s apart; runtime timeouts recorded.
- SIGTERM initiates bounded graceful shutdown, no silent request truncation.

LAW contains only `G3_PROOF_TELEMETRY`: deployment/revision/startup status,
safe runtime health and authorization-failure events, KV audit metadata.
No Application Insights external integration, Sentinel, dashboard/alert/on-call
programme or production SLO. 30-day operational log retention is a design
profile, not a proven retained audit contract. Local hash-bound reports retain
sanitized proof snapshots after transient substrate removal. Disable request
header/body/env logging; run log/evidence hygiene scan before acceptance.

## 10. Measurable eventual runtime acceptance

None of these has run. Architecture document validation is not G3 PASS.
All claims must bind exact transaction/source/image/params and observed times.

| Required output | Future required measurement |
|---|---|
| `G3_RUNTIME_SUBSTRATE_CREATED = PASS` | Exact enumerated resources, internal environment and healthy named revision; no unexpected created resources |
| `G3_RUNTIME_IDENTITY = PASS` | App identity only, no builder/probe/system MI; exact principal/client binding and effective census |
| `G3_IMMUTABLE_ARTIFACT_DEPLOYMENT = PASS` | Valid executable OCI image, frozen digest in ARM, healthy revision binding; no tag fallback |
| `G3_PRIVATE_NETWORK_CONTRACT = PASS` | Runtime/probe private DNS and TLS/SNI/peer traces to ACR/KV/app; required egress, unauthorized destination blocked |
| `G3_CONFIGURATION_PROVENANCE = PASS` | Exact source/template/params and safe ARM/config readback agree; deliberate required-config failure -> 503 |
| `G3_SECRET_BOUNDARY = PASS` | Same synthetic value consumed in memory; unrelated secret denied; bounded fresh-fetch revocation; no cached-success claim |
| `G3_HEALTH_PROBE = PASS` | Declared schema, startup deadline and ten healthy checks; unauthenticated signed-route request denied |
| `G3_PUBLIC_EXPOSURE = AS_AUTHORIZED` | App and KV/ACR private; no administrative ingress; declared platform control-plane egress disclosed; no public origin response |
| `G3_ARTIFACT_DIGEST_ROUNDTRIP = PASS` | Local-to-registry manifest/config/layer hashes, tag -> same digest, desired/runtime revision and source/binary/config witness |
| `G3_UNAUTHORIZED_IDENTITY_ACCESS = DENIED` | Meaningful authenticated data/ARM denials; no DNS/TLS/404 substituted for authorization evidence |
| `G3_ROLLBACK_OR_TEARDOWN = PASS` | Exact owned-resource teardown, bounded revocation/soft-delete, preserved artifacts and original G2 posture |
| `G3_RESIDUAL_STATE = ACCEPTABLE` | Named residual register including retained OCI proof and KV tombstone; no VM/CSE/NIC/disk/role/connection orphan |

Negative tests: build identity cannot attach/manage app or assume app UAMI;
app cannot write `g3-synthetic-app`, read `g2-tooling`/`synthetic-health`/product
repositories or `unrelated-proof`, mutate ARM or assume build/probe identity;
G2 identities have no new G3 access. Compare exact direct/inherited role
censuses with authenticated HTTP 401/403 and structured denied codes.
Test wrong/missing proof signatures and explicit config/secret failures.
Transport failures are separately classified; an unapproved network-path block
is evidence of network control, not RBAC denial.

Public exposure testing needs a named authorized external observer sending
only unsigned synthetic requests, no credential sharing, in the future packet.
No external browser/test is performed now. A public DNS lookup or ARM flag
alone cannot prove an unreachable public origin. Provider management/egress
public IPs are not application ingress; enumerate them honestly.

## 11. Governed lifecycle, stop rules and retained state

Selected proof lifecycle:

`CREATE -> CONFIGURE -> DEPLOY ONE IMMUTABLE SYNTHETIC IMAGE -> VERIFY -> TEARDOWN`.

Do not require a second artifact/revision merely to claim rollback; the
acceptance allows teardown. Full revision rollback remains future workload
work. Configuration rollback is from the complete prior hash-bound snapshot,
never guessing portal state or falling back to tags. No automatic retained
environment/app unless an exact candidate-steady-state inventory is approved.

Future phased transaction: (1) identities/network/vault and private channel,
(2) compiler-bound deterministic packaging and one private image push,
(3) runtime with one frozen image/config, (4) bounded positive/negative and
revocation proofs, (5) owned-resource teardown and read-only reconciliation.
Do not publish if local image validation fails; do not create the app if
private readback fails; do not broaden roles/network after native pull failure.

Snapshot existence/bodies/roles before creation. Any name collision with a
foreign resource is a stop, not takeover/delete authority. Track exact create
ownership and provider children immediately. Remove app/revisions, extensions,
VMs/NICs/disks, new G3 grants, PEs/new connection, DNS links/records, environment/
managed group and remaining owned infrastructure in dependency order.
Vault is soft-deleted, never purged; tombstone retention and generated
synthetic secret versions are intentional residuals with 90-day expiry metadata.
No "zero residuals" claim hides this. Retained proof logs/export/evidence and
G3 OCI image are proof evidence, not runtime steady state.

Never delete G2 artifacts, source/target registry, original PE/DNS/G2 roles,
builder VM/network, or unrelated resources. G3's new role and connection
removal must leave the original census/private mappings/settings unchanged.
Resource-group deletion is not the initial cleanup mechanism and is permitted
only for an empty transaction-created RG, not a shared/product/G2 group.
On any surviving G3 blocker: record FAIL and residuals, use only approved
owned-resource failure cleanup, request a separate corrective authority.

## 12. Cost and capacity foundation

USD public retail, 730h/month, Canada Central or documented global network
meters; no tax/FX/discount/free grant assumed. Rates retrieved during design,
with meter provenance in [PUBLIC_PRICING.json](PUBLIC_PRICING.json).
The subscription may already consume free grants. This is an **incremental
design estimate**, not FinOps proof or approved spending.

| Component | Rate / assumption | 4h proof scenario | Candidate idle month |
|---|---|---:|---:|
| ACA 0.25 vCPU / 0.5GiB, active | $0.000034/vCPU-s + $0.000004/GiB-s | $0.1512 | $27.594 if active all 730h |
| ACA same allocation, idle eligible min=1 | $0.000004/vCPU-s + $0.000004/GiB-s | Not relied on during proof | $7.884 only if idle criteria met |
| ACA scale-to-zero | No running replicas | Not the active-proof profile | $0 app compute; not zero network cost |
| Requests | $0.40/1M | $0.0004 for 1,000 | $0.04 for 100,000 |
| Two Standard Private Link PEs: ACR, KV | $0.01/PE-h | $0.08 + data processing | $14.60 + data processing |
| Three private DNS zones | $0.50/zone-month, tier 0 conservative | $1.50 allowance, not assumed hourly prorating | $1.50 |
| DNS queries | $0.40/1M | $0.004 for 10,000 | $0.04 for 100,000 |
| LAW Analytics ingestion | $2.76/GB paid tier | $0.276 for 0.1GB | $2.76 for 1GB |
| Key Vault Standard operations | **Quote pending**; don't substitute primary Premium meter | Unpriced dependency | Unpriced dependency |
| Two transient B2s VMs + E4 disks/transactions | 4h per VM; Linux pinned, 32GiB StandardSSD_LRS | **Quote pending** | $0 after verified teardown |
| Managed ACA network / ILB / any platform egress IP | Provider-created costs must be quoted | **Quote pending** | **Quote pending** |
| Existing ACR additional image storage; PE processing | Existing Premium base already purchased, not attributed $0 overall | **Incremental quote pending** | **Incremental quote pending** |

Priced scenario subtotal: **$2.012** for 4h, excluding all expressly unpriced
components. It is **not** the complete proof budget.
Priced retained fixed/usage allowance subtotal with min=0, 100k requests/DNS
and 1GB logs: **$18.94/month**, plus **active compute while serving requests**,
managed network, vault operations, processing and ACR incremental storage.
Scale-to-zero is not free request processing. For a separate always-running
illustration, min=1 idle-eligible compute is $7.884/month and fully active
compute is $27.594/month; actual mixed active/idle billing must be calculated
from duty cycle, not credited wholly at the idle rate while handling requests.
Retention is not selected or authorized merely because an estimate is low.

No ACA private endpoint means its additional endpoint/management fees are not
included; no dedicated profile, GPU, planned-maintenance feature, NAT/firewall,
database, HA duplicate or DR region is selected. Verify feature charging
against final API/SKU; new public price meters alone do not prove which features
are billable. The region-wide/global bulk pricing attempts received HTTP 429;
narrow PE/DNS queries succeeded. VM/Standard KV/managed-network quote gaps
remain explicit **execution blockers**, not zero-cost defaults.

Before authority approval: current rate quote for every unpriced item,
all-in proof/idle retained totals, hard hours/replica/storage/log limits and
maintainer spending ceiling. Validate Canada Central workload-profiles
availability, selected API/SKU support, subnet/IP capacity, VM B-series quota,
regional Consumption vCPU quota (app needs 0.25), two VM count (4 vCPU),
private-connection limits and provider registrations. No account/quota API
was called during design. No capacity inferred from user-count forecasts.

## 13. Execution prerequisites and approval boundary

Design selection is recorded; technical implementation/execution is not.
Before asking for execution approval, resolve:

1. New G3 source, tested signed probe/auth/MI/KV implementation and shutdown;
   deterministic executable image, exact toolchain/CA bundle/digests.
2. Private guest input delivery without signed-URL/secret persistence or public
   package bootstrap; pinned VM image and guest-agent/NSG flows.
3. New G3-scoped Bicep, provider schemas, subnet delegation/NSG policies,
   native ACA ABAC pull compatibility, secret-scope RBAC support including
   authorization to create the first named version before a secret exists.
   If secret-scope creation is unsupported, stop for a revised explicitly
   approved bootstrap-only author contract; no implicit vault-wide grant.
4. Every direct/inherited operator/grant principal, role GUID, custom actions,
   ABAC condition and private-connection approval; transaction GUID names.
5. Address/name availability, returned network/domain fields, quota/region/API
   support; no approval inferred from G1 or old Bicep.
6. Maintainer acceptance of named service-tag egress breadth, or revised
   firewall design/cost; no silently unlimited HTTPS.
7. Full cost quote/ceilings; raw what-if + independently reviewed allowed
   additive ACR delta, no product/G2 overwrite.
8. Exact external observer, max executions, positive/negative timeouts,
   revocation recovery policy and safe owned-resource teardown.

The [execution draft](G3_PRIVATE_APPLICATION_SUBSTRATE_EXECUTION_AUTHORITY_DRAFT.md)
is the handoff shape, not a dispatchable authority. No numeric next G4/G5,
product rollout, database or full operations gate is approved here.

## 14. Official service references consulted

These public-document reads contain no repository content or credentials and
make no subscription/Azure-resource call.

- [ACA networking and environment types](https://learn.microsoft.com/azure/container-apps/networking)
- [ACA NSG dependency rules](https://learn.microsoft.com/azure/container-apps/firewall-integration)
- [ACA controlled egress with Firewall/UDR](https://learn.microsoft.com/azure/container-apps/use-azure-firewall)
- [ACA private endpoints, internal DNS and additional charges](https://learn.microsoft.com/azure/container-apps/private-endpoints-with-dns)
- [ACA managed identity image pull and ARM-audience policy](https://learn.microsoft.com/azure/container-apps/managed-identity-image-pull)
- [ACR ABAC repository permissions; legacy AcrPull not honored](https://learn.microsoft.com/azure/container-registry/container-registry-rbac-abac-repository-permissions)
- [ACA secret references and version/cache semantics](https://learn.microsoft.com/azure/container-apps/manage-secrets)
- [ACA billing and subscription-level free grants](https://learn.microsoft.com/azure/container-apps/billing)
- [App Service private endpoint vs outbound integration](https://learn.microsoft.com/azure/app-service/overview-private-endpoint)
- [Functions hosting and container compatibility](https://learn.microsoft.com/azure/azure-functions/functions-scale)
- [Public Azure Retail Prices API](https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview)
