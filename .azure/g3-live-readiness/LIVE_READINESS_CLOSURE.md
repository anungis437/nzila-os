# G3 live-account execution-readiness closure

Mission `NZ-20261008-INFRA-001`.
Authority: **G3 EXECUTION READINESS LIVE ACCOUNT CLOSURE**,
read-only Azure/Entra inventory, public research and local work only.

**G3_EXECUTION_READINESS = BLOCKED**.
**G3_PRIVATE_APPLICATION_SUBSTRATE = NOT_EXECUTED**.

No Azure resource/RBAC/network/vault/registry mutation, explicit login or
credential change, guest execution, deployment, validation POST or what-if occurred.
The existing authenticated session was used for reads only. One explicitly
documented **non-mutating POST** checked vault name availability; it did not
reserve/create the name. Its exact operation is recorded, not concealed as GET.

## Closed account-specific questions

- All eight required providers are Registered, including the returned
  lowercase `microsoft.insights` namespace. Microsoft.Compute is also Registered.
- Provider metadata exposes Canada Central for the selected resource types;
  pinned APIs remain visible. The regional workload-profile GET explicitly
  returns **Consumption**, not merely Dedicated profile support.
- Managed environment quota: **4 used / 20 limit / 16 headroom**; one new
  environment leaves15. CLI quota and native usage results agree.
- G3 resource group and provider-managed RG do not exist. The complete
  subscription resource/group census has no next page or G3 name collision.
  Vault name `nzl-g3-test-001-kv` is available via the documented non-reserving
  availability operation; deleted vaults were separately checked.
- Live VNets are `10.1.0.0/16` and G2 `10.90.0.0/16`, with no peerings.
  Candidate `10.91.0.0/16` and four contained, disjoint subnets do not overlap
  either live VNet or published ACA reserved ranges. Apps `/27` is the
  documented workload-profiles minimum, delegated only to ACA; endpoint `/24`
  and two private-runner `/28`s have no incompatible delegation.
- Regional network usage exposes VNet1/1000, NIC6/65536, PE1/65536,
  NSG2/5000, route table1/600 and public IP2/20.
  Exact returned usage/limits and proof requirements are bound in
  [LIVE_ACCOUNT_ASSESSMENT.json](LIVE_ACCOUNT_ASSESSMENT.json).
- Standard_B2s is subscription-visible without restrictions. Regional VM
  cores and B-series headroom are each8 (2 used/10); two2-core transient
  VMs would require4. This is not a VM allocation guarantee or runner approval.
- Human governance approver is **BOUND** to the accountable maintainer issuing
  this mission packet, not an invented Azure grant principal. No unnecessary
  personal approver identifiers are bound into runtime configuration.

## Governance acceptance now recorded

```text
G3_PLATFORM_EGRESS_BREADTH = ACCEPTED_FOR_SYNTHETIC_PROOF
G3_SERVICE_TAG_EGRESS_LIMITATION = ACCEPTED_AND_DOCUMENTED
G3_ACA_PRIVATE_ENDPOINT = NOT_REQUIRED
G3_ARTIFACT_EXECUTION_SPLIT = G3A_G3B
TARGET_REGISTRY_IMAGE_PRESENT = NOT_PROVEN
```

This accepts only the documented Microsoft platform dependencies, not arbitrary
Internet, tenant-exclusive egress, exfiltration-proof controls or production
certification. It closes the former **governance breadth** blocker, not the
missing physical routing/firewall/controller bindings below.

Internal environment != public environment with a private endpoint. No ACA PE
or PE-triggered Dedicated management fee is added. ACR/KV retain private paths.
Microsoft's managed-resources documentation separately describes **one Standard
load balancer and one provider-managed Standard static public egress IP** for
this topology. `PUBLIC_IP=NOT_REQUIRED` means no operator-created public
runner/app ingress IP, **not that every provider-managed IP/charge is absent**.
This additional cost/quota surface is explicitly carried forward.

## Surviving blockers

### B1. New-environment Consumption core quota cannot yet be bound

Subscription/regional managed environment capacity is proven. However,
**Managed Environment Consumption Cores is scoped to an existing environment**.
The new G3 environment does not exist and no creation is authorized.
The returned subscription `SandboxCores` row is `isQuotaApplicable=false`;
its200 value is **not** the proposed environment's available Consumption cores.
An unrelated existing environment's quota would not prove the new environment's
limit either.

The frozen proof requests0.25vCPU/0.5GiB, min1/max1. A narrowly approved
post-environment-create, pre-app-deploy quota checkpoint (or an explicit
subscription-specific service capacity confirmation) is needed to close this
ordering dependency. No quota update/provider registration/support request
was issued.

Managed identity quota CLI returned **InvalidResourceType** for the
Microsoft.Quota integration API2023-02-01. The2 existing UAMIs and4 proposed
UAMIs are inventoried, but a queryable current UAMI limit/headroom is not
manufactured from an unsupported API. That capacity/limit binding remains
within this blocker. Provider-managed networking requirements are carried
separately from the operator's no-public-IP runner contract.

### B2. Existing firewall is not a connected, configured G3 egress path

Live G2 firewall is **Basic**, private IP `10.90.0.4`. Its network,
application and NAT rule collections are empty. The live G2 route table
contains `0.0.0.0/0 -> VirtualAppliance 10.90.0.4` and is associated only
with the G2 BuilderSubnet. Both live VNets have zero peerings; candidate G3
VNet remains nonexistent.

Workload-profiles ACA supports UDR. But a G3 default route pointing at
`10.90.0.4` alone would **blackhole traffic**, not prove governed egress.
No G2 firewall rules, peering, route association or subnet body was changed.

[route-table.bicep](bicep/route-table.bicep) freezes the new route-table name
`nzila-g3-test-001-egress-rt`, region, no propagated BGP and exact observed
next hop. It compiles/lints locally; **no association is prepared or claimed**.
Its output explicitly records the missing connectivity/rule prerequisite.
The initial isolated direct service-tag design remains historical. The new
packet's shared-firewall requirement cannot be silently described as already
implemented by that unpeered design.

Required next binding: approved bidirectional G3/G2 connectivity, forwarded
traffic/return path, source-scoped firewall rules, unchanged original G2
access boundaries, exact new-resource ownership and teardown/reconciliation.
These would be new additive/protected-estate changes requiring future explicit
authority, not repairs under this read-only packet.

Dependency classification evaluated from current guidance:

| Category | Allowed intent, not an already deployed rule |
|---|---|
| PLATFORM_MANDATORY | `MicrosoftContainerRegistry`, Artifact Registry first-party dependency, DNS168.63.129.16 TCP/UDP53, platform-local probe/mesh plumbing |
| IDENTITY | `AzureActiveDirectory`; `*.identity.azure.net`, `login.microsoftonline.com`, `*.login.microsoftonline.com`, `*.login.microsoft.com` HTTPS443 |
| ACR | Exact private login/data FQDNs; documented `AzureContainerRegistry`/AAD control dependencies and `login.microsoft.com`; no public fallback for the target's private image |
| KEY_VAULT | Exact private vault FQDN plus documented `AzureKeyVault`/AAD dependencies and `login.microsoft.com`; no product vault |
| TELEMETRY | `AzureMonitor`, selected LAW ingestion only |

The guidance spells its first-party tag `AzureFrontDoorFirstParty`; the live
service-tag API and existing NSG candidate spell **`AzureFrontDoor.FirstParty`**.
This alias distinction is recorded rather than writing a nonexistent tag.
`*.blob.core.windows.net` appears in the generic ACR firewall guidance;
any needed platform blob dependency must be justified/scoped rather than
used as a target ACR public data-path bypass. Docker Hub is **not** runtime
egress. No optional Service Bus, Aspire, product data or AI dependency.

### B3. Operator candidate exists, but exact new grants/bootstrap are not bound

Preferred discovered candidate:

- Object/principal `66ec0cdf-ff35-42bd-9104-f424f7c8a455`.
- Application/client `8bfc2641-827c-4acd-8350-22434d64bcf1`.
- Name `nzila-os-deploy-staging`, application service principal.
- GitHub OIDC issuer `https://token.actions.githubusercontent.com`,
  subject `repo:anungis437/nzila-os:environment:staging`,
  audience `api://AzureADTokenExchange`.
- Existing Contributor grants on Canada staging RG and the staging DB scope.
  No new G3 scope/role-assignment delegation is inferred from those grants.
- Intended lifecycle owner: Nzila platform maintainers, **candidate pending
  explicit G3 designation**; do not commandeer an active product staging lane.

Four scoped deployment apps are federated; `nzila-os-cicd` and three other
subscription-level app candidates have no listed federation. Other
subscription Contributor candidates are product-specific Azure DevOps
federations, not a reason to grant broad G3 authority.
The census does not inspect credential values. An empty federation list
does not prove absence of certificates/client secrets.

Pull and runtime data-role contracts are READY as designs: exact repository
Reader with Request ABAC/lifecycleNone, runtime lifecycleMain plus named-secret
Secrets User, no runtime ACR role. ACA+ABAC remains MUST_PROVE, not runtime PASS.
The human approver's mission authority is not conflated with an Azure
authorization-assignment writer.

Missing: exact G3 scope-limited deployer role and distinct constrained
grant/bootstrap executor, approved execution channel/federation environment,
new-G3 principal IDs bound after identity creation, delegated allowed
role/principal/scope conditions, exact initial-version secret author and removal
checkpoint. Existing built-in Contributor cannot create role assignments;
using subscription Contributor/Owner or broad vault runtime privileges is
not an acceptable shortcut.

Exactly one `substrate-proof` synthetic secret is retained. Secret reader
scope can be object-specific; **initial secret creation is not accomplished
by that reader grant**. Any temporary new-vault author scope has broader
name-creation potential and must be explicitly bounded/revoked, not represented
as preexisting single-object isolation.

### B4. Frozen image cannot furnish all requested runtime witnesses

The qualified five-file source, tag and manifest remain byte-identical.
No rebuild/replacement/registry presence is asserted.
The image implements signed boolean health/readiness and a version-pinned
selected-UAMI secret fetch. It does **not** implement:

- an exact secret-value hash/HMAC/challenge witness;
- measured tenant/principal claims and pull-client token denial witness;
- runtime private DNS/IP/TLS peer trace;
- fixed credential-safe negative ACR/KV/management probe instrumentation.

External private-client DNS proof cannot be relabeled as the app's own socket
path. A boolean readiness200/nonempty secret cannot be relabeled as exact
secret equivalence. Network timeout/404 cannot pass an authenticated RBAC denial.

Adding these mechanisms to the immutable executable changes its source and
manifest; this packet specifically freezes the old image. No unapproved
sidecar/second image or mutable code download is introduced to evade that
contract. A separate source/instrumentation qualification decision is needed.

Accordingly complete G3A/G3B controllers and **complete transactional top-level
Bicep packages remain unprepared**. Seven prior modules and the new standalone
route candidate compile; neither substitutes for an executable transaction.
`G3A_BICEP_LOCAL_BUILD=FAIL` and `G3B_BICEP_LOCAL_BUILD=FAIL` in the required
two-valued output mean **complete package not prepared**, not a compiler
failure in the seven preserved modules.

G3A also requires an independently authorized fresh private image-production/
upload runner, private input delivery, pinned VM/toolchain/template, exactly one
bounded push/readback/negative transaction, writer removal and retained-artifact
ownership. G3B needs secret author, private proof-client, signed challenge/
negative controller, revocation, teardown and retained-state reconciliation.
No consumed G2 authority is reused. No partial controller is labeled complete.

### B5. All-in CAD scenario/ceiling remains unbound

The former missing ACA/DNS/load-balancer/firewall retail quotes are now largely
resolved. Public CAD primary observations are retained, including failures.
The first broad load-balancer service lookup returned no rows; product-name
lookup resolved the actual primary Global meter. A429 firewall attempt is
retained; lookup by the observed meter ID resolved Global primary.

| Material component | CAD primary observation / applicability |
|---|---|
| ACA active vCPU |0.000048/vCPU-second |
| ACA active memory |0.000006/GiB-second |
| ACA requests |0.56662/million external-environment requests; no free grant assumed |
| Private DNS |0.708275/zone-month first25;0.56662/million queries |
| Standard LB included rules |0.035414/hour; overage0.014166/rule-hour; processed0.007083/GB |
| Provider egress IPv4 |0.007083/hour Global Standard IPv4 Static Public IP; other Standard Static meter0.008499/h is distinct, no silent interchange |
| Existing Basic firewall processing |0.092076/GB Global, meter `ff9d9feb-e6a5-5070-98dd-864487cdf2a6`; base existing firewall remains sunk G2 cost |
| Proposed Standard_B2s Linux |0.065728/hour; VM read shows selected SKU without restrictions |
| Standard SSD E4/E6 |3.739692 /7.479384 per disk-month; actual runner disk size/rounding still unbound |
| KV operations |Canadian Standard row non-primary; primary Global same meter is labeled Premium,0.042497/10K. Shared secret-operation applicability still needs authoritative billing mapping, not automatic SKU substitution |
| Two dependency PEs, LAW, ACR storage |Preserved prior primary CAD evidence; no ACA PE charge or whole existing Premium ACR base reallocation |

Four hours of ACA active compute alone:
`14400 * (0.25 * 0.000048 + 0.5 * 0.000006) = CAD0.216`.
Three DNS standing zones alone: `3 *0.708275 = CAD2.124825/month`.
These are priced components, **not all-in cost ceilings**.

Controller/runner/input-delivery lifetime, disk selection and billing rounding,
logs/requests/DNS/network byte ceilings, provider-managed actual charges,
firewall path selection and Standard secret-operation applicability remain
unbound. The frozen proof is min1/max1; a future idle min0 scenario cannot
be claimed as the current candidate's implemented steady state.
No hard budget/50% contingency can honestly be approved from incomplete
usage and component bindings.

`G3_PROOF_COST_CEILING_CAD = UNRESOLVED`.
`G3_CANDIDATE_IDLE_MONTHLY_COST_CAD = UNRESOLVED`.

## Evidence and preservation

[AZURE_READ_ONLY_LEDGER.jsonl](AZURE_READ_ONLY_LEDGER.jsonl) records START/
COMPLETE for every attempted CLI invocation. Responses and errors are retained
separately, including12 initial Graph-wrapper failures caused by Windows
`&$select` shell interpretation, **not directory authorization denials**.
Typed `az ad ... show`/federation-list reads corrected the wrapper; no permission
change/login or hidden retry. Current reader rejects shell URL metacharacters.
No explicit token-disclosure, secret-value or signed-artifact-URI operation
was issued; no such credential material is retained in response evidence.
Ledger entries are CLI invocation records, not a claim of capturing every
internal SDK token refresh/pagination HTTP request.

Live protected G2 resource census remains16 and original three conditioned
ACR role assignments remain present. This bounded live census is not a
byte-for-byte reread of every G2 resource property.
Historical G2 terminal root, sealed G3 design and previous50-file readiness
packet are reverified by bytes; no old evidence/source is rewritten.

[Further authority candidate](FURTHER_READINESS_AUTHORITY_CANDIDATE.md) is
**NOT APPROVED / NOT EXECUTABLE** and narrows only these surviving decisions.
Both products remain `INFRA_NO_GO`. G3A/G3B remain unauthorized.

## Official references

- [Quota scopes](https://learn.microsoft.com/azure/container-apps/quotas)
- [Networking and /27 support](https://learn.microsoft.com/azure/container-apps/networking)
- [Platform firewall dependencies](https://learn.microsoft.com/azure/container-apps/use-azure-firewall)
- [UDR support](https://learn.microsoft.com/azure/container-apps/user-defined-routes)
- [Managed resource charges](https://learn.microsoft.com/azure/container-apps/custom-virtual-networks)
- [Billing](https://learn.microsoft.com/azure/container-apps/billing)
- [Vault name check, non-reserving POST](https://learn.microsoft.com/rest/api/keyvault/keyvault/vaults/check-name-availability)
- [Pinned route-table schema](https://learn.microsoft.com/azure/templates/microsoft.network/2024-05-01/routetables)
