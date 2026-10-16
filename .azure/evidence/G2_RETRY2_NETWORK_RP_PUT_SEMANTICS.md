# G2 Retry 2 Network RP PUT semantics

Mission: `NZ-20261008-INFRA-001`  
Slice: `G2_RETRY2_NETWORK_RP_PUT_SEMANTICS`  
Disposition: `NETWORK_RP_PUT_SEMANTICS_UNRESOLVED`  
`CURRENT_PARTIAL_ESTATE_WHATIF = FAIL`  
`RETRY2_DEPLOYMENT_AUTHORIZED = NO`

No Azure resource create/update/delete or cleanup was executed. Retry 2
remains unconsumed. Stage 1 remains `STAGE1_DISCOVERY_FAILED`; overall G2
remains `FAIL`. No runtime proof or Stage 2 work was attempted.

## Authority and concurrency

Worktree: `C:\APPS\worktrees\nzila-g2-provenance`; branch:
`g2/synthetic-health-source`; HEAD:
`7bec20aad11d43eeae8099c14e021b3074154b27`.
Every manual repository write batch was preceded by this unchanged baseline:
only the existing untracked `.azure/` and `infrastructure/landing-zone/g2-builder/`
trees; no tracked modifications. Shared/product work was neither changed nor
dispositioned.

All requested prior JSON inputs were consumed and hashed. Prior source,
template, parameters and raw what-if hashes were verified against their
authority/classification records before correction. Exact input hashes are in
[the fresh baseline](./G2_RETRY2_NETWORK_RP_BASELINE.json).
The final check verifies those historical input bytes remain unchanged.

Fresh inventory matches the exact twelve-resource baseline. VM and firewall
are absent; no `g2-stage1-retry2-` subscription deployment exists. Exact-version
GETs use NIC/PE/DNS `2024-05-01` and VNet `2024-07-01`. Final inventory again
matches all twelve IDs.

## Non-mutating controls

Every control received resource-group provider validation and structured
`FullResourcePayloads` what-if. No PUT/create was performed. The final V3 controls
represent the original authorized source shape with IDs resolved, not a copied
GET body. NIC-A projects documented writable live fields only; it does not
invent writable contracts for `kind` or `allowPort25Out`. PE-A's disputed field
is diagnostic only and was not admitted into source.

| Required result | Result | Exact finding |
|---|---|---|
| NIC_EXPLICIT_LIVE_WHATIF | MODIFY | kind and allowPort25Out omissions; primary NoEffect |
| NIC_CURRENT_IAC_WHATIF | MODIFY | All original disputed omissions; primary NoEffect |
| NIC_DEFAULT_PRESERVATION_WHATIF | MODIFY | kind, allowPort25Out and assigned dynamic address omissions; primary NoEffect |
| PE explicit-live control | NO_CHANGE | Explicit false eliminates the displayed delta |
| PE authorized-omission control | MODIFY | isIPv6EnabledPrivateEndpoint=false omitted |
| VNET_EXPLICIT_LIVE_WHATIF | MODIFY | Only authorized subnet-array addition/reordering |
| VNET_OMISSION_WHATIF | MODIFY | Subnet addition plus privateEndpointVNetPolicies omission |

All seven final controls passed provider validation and what-if execution.
Exact templates, commands, start/end times, results and raw deltas are in
`G2_RETRY2_NETWORK_RP_CONTROL_*_V3_*` evidence and
[the V3 result index](./G2_RETRY2_NETWORK_RP_CONTROL_RESULTS_V3.json).
Earlier V1/V2 controls remain preserved as diagnostic chronology, not authority:
their GET/SDK-derived bodies included client annotations or injected defaults.
V3 removed those confounders and reproduces the exact source resource shape.

## Builder NIC: each property separately

| Exact path | Live value | State classification | Decision |
|---|---|---|---|
| kind | Regular | UNRESOLVED | Absent from exact public writable schema; do not copy or waive |
| properties.allowPort25Out | false | UNRESOLVED | Absent from exact public writable schema; do not copy or waive |
| properties.auxiliaryMode | None | WRITABLE_EXPLICIT_STATE | Explicit preservation required; exact live None emitted |
| properties.auxiliarySku | None | WRITABLE_EXPLICIT_STATE | Explicit preservation required; exact live None emitted |
| properties.disableTcpStateTracking | false | WRITABLE_EXPLICIT_STATE | Explicit preservation required; exact live false emitted |
| IP configuration privateIPAddress | 10.90.1.4 | REPRESENTATION_ONLY under Dynamic allocation | Provider assigned; not pinned |
| IP configuration privateIPAddressVersion | IPv4 | SERVER_DEFAULTED_STATE | Documented IPv4 default; exact live value now explicit |
| IP configuration primary | true | WRITABLE_EXPLICIT_STATE; NoEffect representation | Existing true remains; no correction |

Explicit scalar controls eliminate the known writable scalar predictions.
This establishes exact preservation for the gate; it does not claim an actual
omitted-field PUT was run or proven to reset them.

`BUILDER_NIC_PRIVATE_IP_SEMANTICS =
PROVIDER_ASSIGNED_DYNAMIC_IP_RETAINED_WITH_UNCHANGED_NIC_SUBNET_ALLOCATION`

Live allocation is `Dynamic`, address `10.90.1.4`, version `IPv4`, primary
`true`, on `BuilderSubnet`. Microsoft's dynamic allocation contract releases
an assigned address when the NIC is deleted, moved to another subnet, or its
allocation method changes to Static with a different address. None is proposed.
The successful NIC stays in place with Dynamic allocation and the same subnet.
The address remains unpinned; no conversion to Static was introduced.

Reference:
[private IP allocation and release semantics](https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/private-ip-addresses).
Exact writable-property reference:
[NIC 2024-05-01](https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-05-01/networkinterfaces).

## Private endpoint

`PRIVATE_ENDPOINT_SEMANTICS_UNRESOLVED`

Live `properties.isIPv6EnabledPrivateEndpoint=false`. PE-A explicitly supplies
false and returns NoChange; PE-B omits it and returns Modify. This is an exact
representation difference, but the field is absent from the template reference
and exact `2024-05-01` Swagger properties. Authoritative API source searches
also returned no definition for it. No writable/read-only/default or update
contract was established.

Consequently the required premise that PE-B predicts a *writable state change*
is not established. Validation accepting the diagnostic property is not proof
that PUT honors it or that omission is harmless. No undocumented field was
inserted into Bicep, no API version was changed, and no preview feature was
enabled. The blocker remains explicit rather than silently becoming a waiver.

Reference:
[PE 2024-05-01](https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-05-01/privateendpoints).

## Private DNS zone group

`DNS_ZONE_GROUP_DECLARATIVE_STATE_IDENTICAL = YES`

Group name `default`, configuration name `acr`, and exact `privateDnsZoneId`
match in live GET and before/after what-if. The four remaining child deltas
are individually classified `READ_ONLY_OR_COMPUTED_PROPERTY`:

- `properties.privateDnsZoneConfigs.0.etag`
- `properties.privateDnsZoneConfigs.0.id`
- `properties.privateDnsZoneConfigs.0.type`
- `properties.privateDnsZoneConfigs.0.properties.provisioningState`

The configuration schema declares name and properties/privateDnsZoneId;
provider metadata is not writable configuration. No metadata was copied into
Bicep. Exact before/after values and schema evidence are preserved per path.

Reference:
[DNS zone group 2024-05-01](https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-05-01/privateendpoints/privatednszonegroups).

## VNet policy

`LIVE_PRIVATE_ENDPOINT_VNET_POLICIES=Disabled`  
`DESIRED_PRIVATE_ENDPOINT_VNET_POLICIES=explicit Disabled`  
`VNET_POLICY_EXPLICIT_PRESERVATION_REQUIRED`

The exact schema marks this property writable. VNET-A removes the unintended
policy delta while retaining the authorized management `/26` addition.
VNET-B retains the policy omission. The permitted correction therefore emits
exactly the existing `Disabled` value.

The final template still adds only `AzureFirewallManagementSubnet =
10.90.0.64/26`; all existing named subnet CIDRs and NSG/route associations
remain unchanged. Index-based diffs show array reordering, not subnet
replacement. Source-omitted non-builder subnet defaults remain omitted in
the template; SDK-produced after-image defaults were not copied into IaC.

Reference:
[VNet 2024-07-01](https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2024-07-01/virtualnetworks).

## Corrected authority and validation

Only documented exact-live preservation was added: VNet policy Disabled;
NIC auxiliaryMode None, auxiliarySku None, disableTcpStateTracking false,
and IPv4 version. Related regressions reject policy change, TCP-state change,
dynamic IP pinning and Static allocation. Discovery semantics, NSG, ACR,
roles, subnet ranges, application source and public-key parameters are unchanged.

- New IaC revision: `sha256:BCD2FAEF66DF97BEF29669477BA60E0056E208CA3DD95EE844E127D13985451E`
- Template SHA-256: `5569AA608DE8AFAE7FBFBE41A6037EF425455377506C1F770C715434532666BD`
- Parameters SHA-256: `470FFADFA8FA8388E53A1C7FF7C9DF38FC40C9C29A8FF95A04E4C6D92A79C1BB`
- Public-key hash and private-key destruction evidence are unchanged.

[New authority manifest](./G2_RETRY2_NETWORK_RP_AUTHORITY.json) binds individual
source hashes, template, parameters and public key. The IaC revision is
content-addressed, not a new Git commit.

Required local checks passed: Bicep build and lint; nine discovery tests;
existing negative contracts; DNS/NSG contracts; VM/firewall/preservation
regressions (ten negative mutations); `git diff --check`.

[Fresh provider validation](./G2_RETRY2_NETWORK_RP_PROVIDER_VALIDATION_FINAL.json)
returned Succeeded, no error, correlation
`d5617a7f-4e1e-4ff4-aa4d-18be99fec635`.
[Final raw what-if](./G2_RETRY2_NETWORK_RP_WHATIF_FINAL.json) SHA-256:
`82F0476CF139DDB4AC7A147F3028EBDD69AF0F1EEB17C0DB0F0CC118D5C1BCD6`.

Final counts remain **3 Create, 7 Modify, 8 NoChange, 1 Ignore**, with
**zero Delete, Unsupported or extra Create**. The prior ACR and both
role-assignment waivers match exactly. Three unresolved property deltas remain
across two resources: NIC kind, NIC allowPort25Out, PE IPv6 flag.
No resource-level or property wildcard tolerance was issued.

## Stop and next prerequisite

The [machine-readable record](./G2_RETRY2_NETWORK_RP_PUT_SEMANTICS.json)
contains every resource ID, exact leaf path, before/after values, provider
change type, classification, schema evidence, control result, final inventory
and gate decision. Resolved paths are partial evidence, not a deployment waiver.

To close the gate requires authoritative writable/read-only/default and update
semantics for the three undocumented fields. Do not treat omission from public
schema as proof of read-only state or deploy to test that assumption.
No Stage 1 create or cleanup is authorized while these semantics remain
unresolved. The conditional Retry 2 authorization remains unconsumed.
