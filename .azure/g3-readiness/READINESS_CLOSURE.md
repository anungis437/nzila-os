# G3 private application substrate execution-readiness closure

Mission `NZ-20261008-INFRA-001`. Authority:
**READ_ONLY + LOCAL_ARTIFACT_QUALIFICATION ONLY**.

## Ruling

**G3_EXECUTION_READINESS = BLOCKED**.
Local qualification is successful, but it is not Azure runtime proof and
several approval-critical bindings cannot honestly be closed in this packet.
No Azure resource/account/quota/what-if call, Azure authentication, target
registry read/write, deployment, RBAC/network/vault mutation or product action
occurred. Public documentation, public retail-pricing reads and download of a
missing pinned compiler image are distinguished from target-registry operations.

The prior [design](../g3-design/G3_PRIVATE_APPLICATION_SUBSTRATE_DESIGN.md) and
its [seal](../g3-design/DESIGN_VERIFICATION.json) remain unchanged.
This closure refines the candidate without reopening ACA selection:

- Repository becomes **`g3-synthetic-runtime`**, replacing the previous
  `g3-synthetic-app` design name. Neither exists by authority of this packet.
- Image pull and application runtime use **separate UAMIs**. This replaces
  the earlier single app identity's combined ACR/KV role model.
- One synthetic secret, **`substrate-proof`**. The prior second
  `unrelated-proof` secret proposal is not carried forward.
- Two future slices **G3A/G3B**, not one mixed build/deploy transaction.
- Internal workload-profiles environment / Consumption remains selected.
  **No ACA environment private endpoint** is required.

Current machine-readable fields and evidence bindings are in
[READINESS_DISPOSITION.json](READINESS_DISPOSITION.json).
G2 terminal PASS is preserved; G3 runtime is **NOT_EXECUTED**.

## 1. Frozen local executable image

The existing [synthetic health source](../../infrastructure/landing-zone/synthetic-health/main.go)
was reviewed, not changed. It uses Go module language 1.22, listens on 3000
unless `PORT` is supplied, serves GET `/health/readiness` and
`/health/liveness` with `{"status":"ok"}`, and has no `/health`, `/ready`,
configuration authority, identity, secrets, outbound call or graceful
shutdown proof. Its Dockerfile expects a prebuilt binary.
It is synthetic-only but insufficient for G3.

A **separate minimal candidate** is prepared in [runtime](runtime/).
No UE/Cora/product code, production config, copied datasets or credentials.
Only standard-library Go is used; no third-party Go dependency download.

| Local contract | Qualified value |
|---|---|
| Source authority | Deterministic five-file USTAR archive SHA `2f0866acebb61f7aaa7216c2b8e952b934f04b835e93f49178d884a71040c1ad` |
| Compiler/base | `golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8`, official Go 1.27.2, linux/amd64 |
| Runtime base | `scratch`, empty root filesystem; no runtime base-image digest exists to invent |
| User/entrypoint | `65532:65532`, `/g3-runtime` |
| Config digest | `sha256:225937313ca5db5f581fd1a863dd66eb9373f67f5e9cc99c636952e7792867e0` |
| OCI manifest digest | `sha256:1a6085926ff5fd78cc81bb2fb6df8ceb9bc62660e3222bbe088e47807a91bb61` |
| OCI index digest | `sha256:257955d42b68164bd50f0760c2b793753433b062e7ccf4e4e472bbb4aab98363` |
| Platform | `linux/amd64`; extracted executable verified ELF64 x86-64 |
| Image size | 3,271,902 bytes sum of manifest/config/compressed layer blobs; 3,279,360-byte OCI archive |
| Repository | `g3-synthetic-runtime` in proven G2 target ACR |
| Tag | `g3-2f0866acebb61f7aaa7216c2b8e952b934f04b835e93f49178d884a71040c1ad` |
| Future deployment | `nzilag2tzo75uuozprbo.azurecr.io/g3-synthetic-runtime@sha256:1a6085926ff5fd78cc81bb2fb6df8ceb9bc62660e3222bbe088e47807a91bb61` |

The builder image was resolved by exact platform manifest and pulled only to
the **local Docker Desktop Linux daemon** after host Go/Ubuntu WSL compiler
checks failed. Docker engine 29.2.0, local named-pipe context `desktop-linux`;
no remote build daemon or external source upload.

[qualify_local.py](qualify_local.py) independently performs two **no-cache**,
network-disabled multi-stage Docker builds with `CGO_ENABLED=0`, `linux/amd64`,
`GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off`, trimpath, no VCS/build ID,
fixed `SOURCE_DATE_EPOCH=946684800`, OCI timestamp rewriting and no automatic
provenance/SBOM side manifests. Each build runs unit tests and `go vet`.
The Dockerfile is digest-pinned, not `latest`; the final image contains only
the static executable and the pinned builder's CA bundle.

[Local qualification](local-image-qualification/LOCAL_IMAGE_QUALIFICATION.json)
proves exact config, manifest, index, compressed and uncompressed layer digest
equivalence. No mutable metadata exception is needed. Timestamp-dependent log
timestamps are not application status/build identity and do not alter image
bytes. This reproducibility is demonstrated for the bound local builder,
BuildKit flags and source context, not claimed across arbitrary Docker versions.

[smoke_local.py](smoke_local.py) loaded the OCI image locally and tested:
non-root, read-only filesystem, no capabilities, no-new-privileges, network
`none`, no published ports; signed `/health` 200, unsigned `/health` 401,
signed `/ready` 503 when the deliberately absent local identity service is
unavailable, native live probe 200, ready probe 503, graceful SIGTERM exit 0.
The exact transaction-created app/helper containers were removed; local image
archives and binary remain qualification evidence.
[Smoke evidence](local-image-qualification/LOCAL_CONTAINER_SMOKE.json).

**503 is expected fail-closed local readiness, not Azure secret/MI proof.**
No signing private key, secret value, token or raw identity header was retained.
Local test strings are explicitly fake/synthetic, not Azure credentials.

Remaining candidate-source limitations: no measured Azure principal/tenant
claim witness, exact-secret in-memory challenge response, fixed negative-proof
endpoints, private peer/DNS trace or credential-safe execution controller yet.
The source can fetch a named version with explicitly selected runtime client
ID and sanitize errors, but local mocks do not close these future gate proofs.
Those gaps are explicit blockers, not runtime capabilities inferred from tests.

## 2. Ingress/private-endpoint decision

```text
G3_ENVIRONMENT_ACCESSIBILITY = INTERNAL
G3_APP_INGRESS_VISIBILITY = EXTERNAL_TRUE_WITHIN_INTERNAL_VNET
G3_HEALTH_PROBE_CALLER = NEW_G3_PRIVATE_PROOF_CLIENT
G3_ACA_PRIVATE_ENDPOINT = NOT_REQUIRED
```

| Decision dimension | A: internal VNet-injected environment, selected | B: additional ACA Private Link, not selected |
|---|---|---|
| Benefit | No public application environment endpoint; private ILB, subnet controls, signed client proof | Explicit PE connection approval/network boundary, potentially useful for separate VNet callers |
| Caller | New G3 proof-client subnet in same VNet -> private ILB HTTPS | Named PE-connected caller VNet -> private endpoint |
| DNS | Provider-returned environment defaultDomain, wildcard A -> private staticIp | Regional ACA Private Link DNS/zone group plus declared app DNS path |
| Extra resources | No ACA PE | At least ACA PE/NIC/connection/zone group and private DNS association |
| Complexity | Native internal runtime proof, no redundant inbound boundary | Connection approval, extra IP/DNS/lifecycle and overlap with ILB |
| Billing | No PE-triggered ACA management fee; managed networking/ILB still costs | Private Link PE/processing plus documented ACA endpoint infrastructure/Dedicated Plan Management fee |
| Estimate | CAD total unresolved for explicitly listed meters | At least previously observed USD $0.12/h endpoint-related ACA meter + $0.01/h PE = $94.90/month before processing/DNS; **not a CAD quote or authorization**, exact billing-meter mapping remains prerequisite if B is reconsidered |

No same-VNet trust requirement in this proof justifies the extra boundary.
ACR and KV **do** retain private endpoints. `external=true` at the app ingress
does not mean Internet public when the environment itself is internal.
No Front Door/WAF/product hostname/customer traffic or public app origin.
Platform-managed control/egress IPs, if returned, must be enumerated separately;
internal environment is not claimed to eliminate every provider public IP.

Official sources:
[networking](https://learn.microsoft.com/azure/container-apps/networking),
[private endpoint/DNS/billing](https://learn.microsoft.com/azure/container-apps/private-endpoints-with-dns),
[billing](https://learn.microsoft.com/azure/container-apps/billing).

## 3. Identity split and exact proposed RBAC

| Identity | Proposed use | Direct rights / forbidden |
|---|---|---|
| `nzila-g3-test-001-pull-mi` | ACA platform image acquisition only | Reader `b93aa761-3e63-49ed-ac28-beffa264f7ac` on target ACR, exact `g3-synthetic-runtime` ABAC; no KV, write, catalog or ARM rights |
| `nzila-g3-test-001-runtime-mi` | Main application code only | Secrets User `4633458b-17de-408a-b874-0445c86b69e6` scoped to `substrate-proof`; no ACR read/write, build, management or other product/vault rights |
| `nzila-g3-test-001-build-mi` | Independently approved G3A producer | Writer `2a1e307c-b015-4ebd-883e-5b7698a07328`, exact new repository; no catalog/delete/other repositories/KV/runtime attachment |
| `nzila-g3-test-001-probe-mi` | Future private controller/one-secret author candidate | No automatic registry/runtime role. Minimal named synthetic-secret bootstrap/author contract remains **unresolved** |
| Existing G2 identities | Retained original proof boundaries | No new assignment, identity attachment or permission |
| Operator/deployer and boundary approver | Exact selected principal(s) required before approval | No Contributor/Owner convenience role; enumerated operations below; IDs/delegation checks unresolved |

Both pull and runtime UAMIs are attached to ACA because platform image pull
requires the pull identity. **They are not both usable by application code**:
`identitySettings` sets pull lifecycle **`None`** and runtime lifecycle
**`Main`**. This differs deliberately from the earlier single-app-UAMI design.
Future proof must demonstrate that app code cannot obtain the pull UAMI token
even when it deliberately requests that client ID, and that native acquisition
still works. A declared lifecycle value alone is not proof.
[Official identity lifecycle documentation](https://learn.microsoft.com/azure/container-apps/managed-identity).

[registry-roles.bicep](bicep/registry-roles.bicep) uses the proven G2 pattern:
deny all relevant read/write actions unless
`@Request[Microsoft.ContainerRegistry/registries/repositories:name]`
`StringEqualsIgnoreCase 'g3-synthetic-runtime'`, `conditionVersion='2.0'`.
Reader/Writer definitions in retained G2 evidence have `actions: []`.
Role assignment name is deterministic `guid(registry.id, principalId, roleId,
'g3-synthetic-runtime')`; G3A and G3B are separate module invocations.
No prefix/wildcard repository condition, catalog lister, AcrPull or bypass.

[secret-role.bicep](bicep/secret-role.bicep) assigns runtime Secrets User only
at the ARM ID of the one named existing secret, not vault-wide. It does not
write any value. Actual principal IDs/assignment GUID outputs are not fabricated
before identity creation; future phased authority must bind returned IDs
before granting permissions.

Historical [ACR posture](../evidence/G2_TERMINAL_LIVE_ESTATE.json):
`AbacRepositoryPermissions`, admin disabled, public Disabled, bypass None,
ARM-audience token policy enabled and proven existing PE/private DNS.
G3 proposes a **new** private connection for its independent VNet.
No target posture reread/change occurred now.
`ACA_IMAGE_PULL_WITH_REPOSITORY_CONDITION = MUST_PROVE`.
Separate MI-pull and ABAC documentation is not combined runtime evidence.
If native ACA demands broader rights, stop with a governance blocker.

Operator ARM action intent, at exact new RG/resource scopes:

- Resource group create/read and empty-owned-RG delete; deployment
  read/write/operations read at explicit transaction scope.
- `Microsoft.App/managedEnvironments` and `containerApps` read/write/delete.
- `Microsoft.ManagedIdentity/userAssignedIdentities` read/write/delete;
  `assign/action` only four named new identity IDs.
- `Microsoft.Network/virtualNetworks`, `networkSecurityGroups`,
  `privateEndpoints`, `privateEndpoints/privateDnsZoneGroups`,
  `privateDnsZones`, `privateDnsZones/virtualNetworkLinks` and
  `privateDnsZones/A` read/write/delete, scoped only to G3 resources.
- `Microsoft.KeyVault/vaults` read/write/delete; no purge, keys/certificates,
  production secret values or vault-wide administrative data grant.
- `Microsoft.OperationalInsights/workspaces` read/write/delete and
  `Microsoft.Insights/diagnosticSettings` read/write/delete on G3 resources.
- If the two named private VMs are approved: exact NIC, VM, managed disk and
  VM-extension read/write/delete; no RunCommand/SSH/Bastion/public-IP action.
- Separate grant approver: new G3 role-assignment read/write/delete at exact
  ACR/secret scopes and exact new ACR private-connection approval/removal only.
  Provider-operation names, principal/delegation conditions and least-privilege
  custom role definition must be validated; no unrestricted roleAssignments
  delegation implied by this list.

This enumerates intent; it is **not an already approved exact operator role**.
Without live inherited/group/subscription grants and chosen principals,
execution readiness remains blocked.

## 4. Network, subnet capacity and egress

Candidate VNet `10.91.0.0/16`, no G2 peering/subnet/DNS/firewall update:

| Subnet | CIDR | Contract |
|---|---|---|
| `apps` | `10.91.0.0/27` | Workload profiles minimum /27, delegated `Microsoft.App/environments`, one 0.25-vCPU/0.5GiB replica maximum |
| `private-endpoints` | `10.91.3.0/24` | Two PEs, no delegation; NSG endpoint policy enabled explicitly |
| `builders` | `10.91.4.0/28` | Potential separate G3A private builder; no implicit public outbound/SSH |
| `proof-clients` | `10.91.5.0/28` | Potential G3B private observer; no public IP |

Local address arithmetic confirms pairwise nonoverlap/containment, /27 has
32 addresses (27 after Azure's five reservation convention), /24 has 256,
each /28 has 16. ACA's additional platform reservations/IP scaling requirements
are separate from that arithmetic. Current subscription overlap, usable
platform IP count and quotas are **not checked** without resource-call authority.
Minimum-profile capacity is a design bound, not an Azure allocation guarantee.

[Foundation candidate](bicep/foundation.bicep) creates default-deny NSGs,
explicit PE-subnet HTTPS, platform DNS, signed probe-client ingress and required
ACA platform rules. PE subnet uses `NetworkSecurityGroupEnabled`, not a
disabled endpoint policy while claiming NSG enforcement.
No route table/UDR/firewall is selected; service-tag/IP allow-listing is the
stated mechanism, not arbitrary unrestricted Internet/AzureCloud HTTPS.

| Destination / source | Protocol / port | Private/public; purpose | Classification / control |
|---|---|---|---|
| Target `nzilag2tzo75uuozprbo.azurecr.io` | TLS 443 | Private new ACR PE login; image acquisition/readback | PLATFORM_REQUIRED; private DNS, PE and ABAC; no public fallback |
| `nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io` | TLS 443 | Private new ACR PE data path | PLATFORM_REQUIRED; dedicated endpoint DNS/peer/SNI proof |
| `nzl-g3-test-001-kv.vault.azure.net` | TLS 443 | Private new KV PE; one synthetic secret | PLATFORM_REQUIRED; private DNS and runtime secret-scoped RBAC |
| Environment-returned defaultDomain app FQDN | TLS 443 | Private ILB; signed health/readiness client | PLATFORM_REQUIRED for proof; no product/public DNS |
| AzurePlatformDNS / `168.63.129.16` | TCP/UDP 53 | Azure platform DNS, not private customer DNS appliance | PLATFORM_REQUIRED; explicit rule, required Consumption dependency |
| MicrosoftContainerRegistry | TCP 443 | Public managed-system artifact service; not Docker Hub | PLATFORM_REQUIRED; bounded service tag |
| AzureFrontDoor.FirstParty | TCP 443 | Public first-party registry dependency; not customer Front Door deployment | PLATFORM_REQUIRED; bounded service tag |
| AzureActiveDirectory | TCP 443 | Public identity service | PLATFORM_REQUIRED; bounded service tag |
| AzureMonitor | TCP 443 | Public regional proof-log ingestion | PROOF_TELEMETRY; bounded service tag |
| Storage.CanadaCentral | TCP 443 | Documented regional platform/image dependency, not app storage/data integration | PLATFORM_REQUIRED candidate; freeze necessity against selected platform contract |
| Apps subnet -> itself | Platform-required traffic | Private same-subnet service mesh/infrastructure | PLATFORM_REQUIRED, explicit subnet boundary |
| AzureLoadBalancer -> apps | TCP 30000-32767 | Private managed health plumbing | PLATFORM_REQUIRED; service tag, not user admin access |
| VM WireServer/IMDS | Exact future pinned guest-agent/identity ports | Platform-local guest prerequisites | PLATFORM_REQUIRED if VMs selected; not yet bound, **controller/VM blocker** |
| Remaining outbound/ingress | All | Not required | Denied; no OPTIONAL service-tag rule selected |

Service-tag destinations represent shared Microsoft ranges; **not
tenant-exclusive exfiltration isolation**, and DNS is not exfiltration-proof.
`G3_SERVICE_TAG_EGRESS_LIMITATION = DOCUMENTED`. Risk-owner acceptance or
explicitly costed narrower firewall design remains required. No existing G2
firewall changes or hidden reuse: its base capacity is **EXISTING_SUNK_G2_COST**;
selected isolated G3 topology has **no G2 firewall traffic/path**, so G2
incremental processing is not incurred by this design. Do not charge G2's
whole firewall to G3 or describe an unselected shared path as free.

ACR/KV Private DNS zones in new RG link only G3 VNet. The new ACR PE gets
new provider-resolved IPs, not hardcoded G2 10.90.2.5/.4. Internal ACA DNS
uses provider output defaultDomain and staticIp; no ACA PE zone without a PE.
Returned DNS naming requires a **dependent Bicep module** because runtime
properties cannot be used as a start-of-deployment zone resource name.
The initial BCP120 failure is retained; corrected modules build cleanly.

## 5. One-secret and configuration contract

`NEW_G3_KEY_VAULT = nzl-g3-test-001-kv`, Standard in Canada Central;
public Disabled, bypass None, RBAC, private endpoint/DNS, soft delete
90 days, purge protection enabled. One secret `substrate-proof`, random
synthetic value generated only under future explicit secret-write authority.
No `unrelated-proof` creation, product vault or production credential.

Runtime uses a **version-pinned direct Key Vault URI**, selected client ID
through ACA's local identity endpoint/header, HTTPS CA validation, no proxy
or redirects, bounded response/timeouts and sanitized error stages.
No success cache: `/ready` makes a fresh identity/secret request, permitting
a measurable future revocation check. Missing startup config fails explicitly.
Value/token/header exist in memory only; no response contains them.

Initial-version author/bootstrap rights are not resolved by declaring a
secret-scoped reader. No Administrator/Contributor/Owner or convenience
vault-wide runtime permission. Future proof must establish authorized read,
unauthorized identity read denied, unrelated-secret read denied with an
authenticated 403 rather than 404, and revocation readiness failure. If one
secret is the only created secret, do not invent evidence of a second existing
secret; use the approved single-secret forbidden-name authorization path,
require actual 403, or stop with an inconclusive denial.

| Input | Classification | Contract |
|---|---|---|
| Endpoint schema, port 3000, Go/CA/executable identity | IMAGE_IMMUTABLE | Frozen archive/config/layers; no env-dependent build |
| `G3_ENVIRONMENT=integration-test` | DEPLOYMENT_CONFIGURATION | Platform-owned exact value |
| `G3_SOURCE_AUTHORITY=<archive SHA>` | DEPLOYMENT_CONFIGURATION | Exact qualified archive; not recursive image self-hash |
| `G3_PROOF_MODE=synthetic-only` | DEPLOYMENT_CONFIGURATION | Exact accepted mode, no real logging/data mode |
| `G3_PROBE_PUBLIC_KEY` | DEPLOYMENT_CONFIGURATION | Ephemeral Ed25519 public key; private key never ARM/source/evidence |
| `G3_SECRET_URI` | SECRET_REFERENCE | Named vault/secret, pinned 32-hex version ID; no secret value in params |
| `AZURE_CLIENT_ID` | DEPLOYMENT_CONFIGURATION | Runtime UAMI only, not pull/build client |
| `IDENTITY_ENDPOINT`, `IDENTITY_HEADER` | PLATFORM_CONFIGURATION | ACA injected local service; identity header never persisted |
| Returned FQDN/IP/DNS, LAW ID, region | PLATFORM_CONFIGURATION | ARM metadata bindings, no portal-only mutation |
| Startup/liveness/readiness cadence | DEPLOYMENT_CONFIGURATION | Fixed paths, startup 24x5s, live/ready 10s, max one replica |

GET `/health`: signed request -> HTTP200 `{"status":"ok"}`.
GET `/ready`: signed request and required MI/secret fetch -> HTTP200 same
schema; dependency failure -> HTTP503 `{"status":"not_ready"}`.
Missing/invalid/replayed/expired signature -> HTTP401
`{"status":"unauthorized"}`. Sign method/path/64-hex nonce/expiry; validity
at most 60s, bounded anti-replay table. Native `/probes/*` endpoints are
deliberately unauthenticated boolean routes inside the private boundary.
Unknown route404, unsupported method405; JSON, no-store. No secret values,
tokens or sensitive platform metadata. TLS termination at ACA plus selected
peer encryption is not claimed as an independently proven end-to-end mTLS
client identity mechanism.

## 6. Exact proposed resource inventory and APIs

All operator-created names remain deterministic; no resource is currently
created. [Bicep candidates](bicep/) define foundation, identities, private
dependencies, runtime/DNS and roles. Provider-returned child IDs cannot be
invented; exact response manifests must be bound by a future phased authority.

| Type / deterministic name | RG; region | Purpose, identity, network | Cost; disposition / teardown owner |
|---|---|---|---|
| RG `nzila-shared-test-g3-001-rg` | Same name; Canada Central | Separate platform integration-test proof | Control-plane; transient, transaction only if created/empty |
| VNet `nzila-g3-test-001-vnet` + four subnets above | New G3 RG; Canada Central | Isolated delegated runtime/private endpoints/build/probe | Network; candidate steady state, default owned teardown |
| NSGs `nzila-g3-test-001-{apps,pe,build,probe}-nsg` | New G3 RG; Canada Central | Exact respective subnet controls | No separate capacity charge; owned teardown |
| Four UAMIs `nzila-g3-test-001-{pull,runtime,build,probe}-mi` | New G3 RG; Canada Central | Separate matrix in section3; no system identity | Identity; pull/runtime candidate, build/probe transient |
| ACR PE `nzila-g3-test-001-acr-pe`, zone group `default`, link `nzila-g3-test-001-acr-link`, zone `privatelink.azurecr.io` | New G3 RG; PE Canada Central, DNS global | New G3 VNet -> existing target registry private connection | PE/DNS/processing; owned connection only |
| ACR PE NIC/connection/records | NIC in new RG, connection in G2 RG | Provider children of that exact new PE, IDs recorded from response | Included PE; teardown via PE, no G2 original connection/DNS edit |
| KV `nzl-g3-test-001-kv` and one versioned `substrate-proof` | New G3 RG; Canada Central | Synthetic secret only, runtime reader scope | KV operations; soft-delete tombstone remains90d, no purge |
| KV PE `nzila-g3-test-001-kv-pe`, group `default`, link `nzila-g3-test-001-kv-link`, zone `privatelink.vaultcore.azure.net` | New G3 RG; PE Canada Central, DNS global | Private runtime/author access; provider NIC/A record declared children | PE/DNS/processing; transaction-owned teardown |
| LAW `nzila-g3-test-001-law` | New G3 RG; Canada Central | Proof telemetry only, local auth disabled,30d retention | Ingestion/retention; candidate, default export + teardown |
| Diagnostic settings `g3-secret-audit`, `g3-runtime-proof` | On G3 vault/environment | Audit/system/console safe metadata -> LAW | LAW ingestion; owned teardown |
| Environment `nzila-g3-test-001-env` | New G3 RG; Canada Central | Internal workload profiles, Consumption only | Compute/managed network; candidate, default teardown |
| Provider infrastructure RG `nzila-g3-test-001-managed-rg`, exact returned ILB/NIC/IP/platform IDs | Canada Central | Provider-managed runtime infrastructure, no operator-created public app IP | Managed network; via environment lifecycle, no guessed direct delete |
| App `nzila-g3-test-001-health`; returned revision IDs | New G3 RG; Canada Central | One frozen image, pull lifecycleNone/runtimeMain, private HTTPS | Compute/request; transient |
| Zone returned `defaultDomain`, link `nzila-g3-test-001-app-link`, wildcard `*` | New G3 RG; global DNS | Private app -> returned environment staticIp | DNS; owned dependent module |
| G3A writer / G3B pull-reader assignments | Existing target ACR in G2 RG; global metadata | Deterministic GUID formula in module; new principals only, exact repo | Authorization; transient own assignment removal only |
| Runtime secret-reader assignment | Exact `substrate-proof` scope; global metadata | Deterministic GUID formula in secret module | Authorization; transient, revoke/remove exact new role only |
| Proposed private build/probe VMs `nzila-g3-test-001-{build,probe}-vm`, matching `-nic`, `-os`, child `g3-proof` CSE | New G3 RG; Canada Central | Separate controller slices, no public/SSH/G2 VM reuse | Compute/disks; transient **templates/controller/input delivery not yet frozen** |
| Proposed deployment/approver/one-secret-author custom roles/assignments | Exact principals/scopes unresolved | Narrow action contract, no broad default | Not provisioned; **readiness blocker** |
| OCI image `g3-synthetic-runtime:<qualified tag>` | Existing Canadian target registry | G3A writer/G3B pull only; immutable digest | Incremental storage; retained proof artifact, no automatic deletion |

No route table, new firewall, NAT, ACA PE, Front Door, public IP chosen by the
operator, PostgreSQL, product Storage or external AI is proposed.
Global DNS/authorization metadata is not a Canadian storage-region assurance;
all runtime/data-bearing proposed resources are Canada Central, no secondary.

[API_SCHEMA_REFERENCES.json](API_SCHEMA_REFERENCES.json) binds16 official
published format snippets/content hashes, not live provider availability.
Chosen documented APIs: App2025-07-01 (MI lifecycle supported);
Network2024-05-01; PrivateDNS2024-06-01; ManagedIdentity2023-01-31;
KeyVault2023-07-01; OperationalInsights2023-09-01;
diagnostics2021-05-01-preview; Authorization2022-04-01;
existing ACR2025-11-01. They are deliberately pinned documented versions,
not all claimed latest. Provider acceptance and region/version support remain
future preflight. Secret values are never embedded in ARM.

All seven prepared modules passed local Bicep0.48.1 build/lint.
The initial zone-name BCP120 and subsequent clean correction are retained in
[initial diagnostics](bicep-local-validation/RESULTS.json) and
[final diagnostics](bicep-local-validation-final/RESULTS.json).
The repository attribute was tightened to the known Request contract and
[revalidated](bicep-registry-condition-validation/RESULTS.json).
`G3_BICEP_LOCAL_BUILD=PASS` means these **prepared candidates** are valid;
it does not mean missing VM/controller/operator templates or deployment
parameter/effective permission bindings exist.

## 7. Cost closure: honest partial result

Pricing date2026-10-12, CAD public retail where returned, no discounts/taxes,
730h/month, no free grant assumed. G3B4h active proof target; max1 replica;
one3.27MB image; two private endpoints; three DNS zones; <=0.1GB proof logs;
no extra region, GPU, dedicated workload profile or planned maintenance.
Four-hour VM durations proposed but not yet quoted/authorized.

Public rate attempts are preserved in
[initial CAD observations](PUBLIC_CAD_PRICING_INITIAL.json),
[targeted CAD observations](PUBLIC_CAD_PRICING_OBSERVATIONS.json),
[narrow CAD attempts](PUBLIC_CAD_PRICING_NARROW.json).
Several exact queries returned429, and some service-name queries returned0
rows. Primary CAD Private Link rates are established; paid LAW rate established.
The Standard Key Vault Canada Central Operations row is **non-primary**;
the matching primary Global row is labeled **Premium**, so no Standard
primary price is silently substituted. Prior USD ACA/DNS prices are recorded
design inputs, not an invented current CAD exchange rate.

| Component | Qualified rate/assumption | Closure |
|---|---|---|
| ACA compute/requests | Prior design USD prices, active0.25/0.5GiB; CAD query429 | CAD quote unresolved |
| ACA PE/PE-triggered management | Not selected; no extra endpoint management feature | Not applicable by chosen design, not blanket zero environment cost |
| Managed internal network/ILB/provider egress IP | Service lookup empty/429; exact provider output still future | Material cost unresolved |
| Two standard private endpoints | CAD0.014166/PE-h Global primary | CAD0.113328 for4h; CAD20.68136 for730h |
| Private Link data | CAD0.014166/GB ingress and same egress, tier0 | Bounded example1GB each direction = CAD0.028332; traffic ceiling still requires approval |
| ACR incremental storage | Global Data Stored CAD0.141655/GB-month primary; Premium replication meter separate | Worst-case charge every new byte rather than assume remaining included capacity; ~CAD0.000464 per3.27MB image/month; base existing Premium is sunk G2 |
| KV Standard operations | Non-primary Canadian row / primary Premium row mismatch | Standard primary quote unresolved, no default0 |
| DNS zones/queries | Prior USD design, CAD query429 | CAD quote unresolved |
| LAW proof ingestion | CAD3.909678/GB paid tier, no free grant | <=0.1GB ~CAD0.390968;30d retention no extended-retention assumption |
| LAW additional retention | CAD0.169986/GB-month if retained beyond included window | No extra-retention proof feature selected; retained-export lifecycle still must be bound |
| Two private VMs/disks/agent traffic | Proposed separate build/probe, no frozen executable controller | Quote and usage ceiling unresolved |
| G2 firewall base | EXISTING_SUNK_G2_COST | No whole-base reallocation to G3 |
| G2 firewall incremental | Not on selected unpeered G3 path | No G2 firewall processing incurred by this design; redesign requires explicit costing |

**G3_PROOF_COST_CEILING_CAD = UNRESOLVED**.
**G3_CANDIDATE_IDLE_MONTHLY_COST_CAD = UNRESOLVED**.
Priced pieces are not an all-in budget. Scale-to-zero eliminates running app
compute only; PE/DNS/network remain, and serving requests incurs active
compute. No actual expenditure ceiling is manufactured from partial meters.
Quota/region availability, address collision, PE/identity limits and operator
permission are likewise unqueried under this no-resource-call packet.

## 8. Future negative proofs and transaction split

| Required negative field | Exact future proof; pass condition |
|---|---|
| `IMAGE_PULL_IDENTITY_OTHER_REPOSITORY_READ` | Request `g2-tooling`/`synthetic-health` pull scope and actual read with pull identity; authenticated401/403 denied, no network/404 substitute |
| `IMAGE_PULL_IDENTITY_REGISTRY_WRITE` | Push scope + bounded denied upload request to new repo; actual denial, no artifact creation |
| `RUNTIME_IDENTITY_ACR_WRITE` | Main runtime identity authenticated registry write probe; denial, no broader role |
| `RUNTIME_IDENTITY_BUILD_REPOSITORY_ACCESS` | Runtime identity read of `g3-synthetic-runtime`/G2 tooling denied; runtime has no ACR role |
| `RUNTIME_IDENTITY_UNAUTHORIZED_SECRET_READ` | Fixed forbidden path under G3 vault, authenticated403; absent-path404 is inconclusive; independent unauthorized identity approved-secret read also denied |
| `PUBLIC_CONTAINER_APP_ACCESS` | Exact external unsigned observer request cannot obtain private app response; report network-exposure denial separately from RBAC |
| `PULL_IDENTITY_TOKEN_AVAILABLE_TO_MAIN` | Deliberate pull-client token request from main app denied with lifecycleNone |
| `RUNTIME_ARM_MANAGEMENT_ACCESS` | Token-scoped read/write boundary plus exact inherited census; authenticated denial |

None has been run in Azure. Native ACA pull plus repository condition is
MUST_PROVE, not a readiness requirement to execute a forbidden deployment now.
Actual live permission/transport/secret witnesses require a later approved
packet; the source/controller must be able to collect them safely before approval.

**G3_ARTIFACT_EXECUTION_SPLIT = G3A_G3B**.

G3A: new source/image/producer/tooling/private-channel authority; local build
contract already qualified -> one separately approved private delivery ->
immutable manifest/config/layer readback -> writer cleanup / retained image
proof. No ACA, runtime secret or product deployment.

G3B: baseline -> create separate pull/runtime identities and private substrate
-> bind G3A proven target digest -> create one synthetic secret under named
author rights -> native ACA pull with lifecycle isolation -> signed private
health/config/secret/negative checks -> revoke/readiness checks ->
owned teardown (selected) or separately accepted candidate inventory ->
preserved final evidence. No repeat G3A push/import while diagnosing runtime.

Stop on unexpected permissions/resources, digest/config mismatch, public
fallback, unapproved action/cost, source drift or failed native ABAC pull.
Use only explicit transaction-owned failure cleanup; retain G2 history and
image evidence. KV soft-deleted tombstone remains90d with purge protection.
No production rollout or next numbered gate follows automatically.

## 9. Surviving execution-readiness blockers

1. **Live quota/capability/collision/effective-role checks are not authorized
   here.** A separate read-only readiness authority is needed; no account or
   resource call was made to pretend they are checked.
2. **Complete CAD cost/usage ceiling remains unresolved** after bounded public
   attempts; Standard vault primary meter, ACA/DNS CAD, managed-network,
   producer/probe compute/disks and provider-cost attribution need closure.
3. **Exact operator/approver principal IDs and constrained grants are unbound**;
   no convenient Contributor/Owner, G2 identity reuse or role waiver.
4. **One-secret initial-version author contract, private delivery/controller
   and transient VM templates are not frozen/qualified.** Seven candidate
   modules compile but do not supply those missing surfaces.
5. **Candidate runtime proof instrumentation remains incomplete** for exact
   secret challenge, principal/tenant witness, private path and fixed negative
   token/repository/management probes. Local tests cover source behavior,
   not a complete G3 execution evidence harness.
6. **Service-tag breadth acceptance and final provider/guest dependencies
   need explicit approval**, including private VM agent flows. No catch-all
   Internet allowance is added.

The [G3A candidate](G3A_EXECUTABLE_IMAGE_PRODUCTION_AUTHORITY.md) and
[G3B candidate](G3B_PRIVATE_APPLICATION_SUBSTRATE_AUTHORITY.md) are
**INCOMPLETE / NOT APPROVED / NOT EXECUTABLE**. They do not become executable
because local qualification or Bicep build passed. No claim of execution
readiness PASS, G3 runtime PASS or product readiness is made.
