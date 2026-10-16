# G2 Stage 1 Synthetic Discovery Deployment

## Disposition

**`STAGE1_DISCOVERY_FAILED`**  
**Overall G2: `FAIL`**

The approved Canada Central deployment was attempted once and failed while creating the builder network security group (NSG). Azure rejected the NSG with `SecurityRuleInvalidAccessType`: “Security rule has invalid Accees type. Value provided: Allow Allowed values: Deny.” The underlying cause has not been established. No retry, NSG/network modification, or cleanup was performed.

The partial estate is retained for diagnosis. It consists of the proof resource group and six successfully created child resources; see [G2_STAGE1_RESOURCE_INVENTORY.json](./G2_STAGE1_RESOURCE_INVENTORY.json). The public IP is the planned firewall egress address and has no IP configuration; it is not attached to a VM.

## Pre-execution checks

- Branch: `g2/synthetic-health-source`
- Source HEAD: `7bec20aad11d43eeae8099c14e021b3074154b27`
- Authoritative archive SHA-256: `DF81CAE6D23555FC43AD1D96EF38CBA0BA67FB06D551A5183168FF151AD2528E`
- Subscription: `5d819f33-d16f-429c-a3c0-5b0e94740ba3`
- Region: `canadacentral`
- Proof resource group did not exist before deployment; no pre-existing G2 proof resource conflict was found.
- Fresh structured what-if: 17 `Create`, 0 `Modify`, 0 `Delete`, 0 `Unsupported`.
- Deployment used the approved preview parameters with `previewOnly=false`; `approvedAptSources` remained empty.

The fresh what-if response was verified before deployment but was not saved as a raw response file. Its verified counts are preserved here and in [G2_STAGE1_DEPLOYMENT_RESULT.json](./G2_STAGE1_DEPLOYMENT_RESULT.json). The earlier validation what-if evidence was not overwritten.

## Partial deployment and boundary verification

The subscription deployment failed in nested deployment `nzilaG2SyntheticBuilder` on:

`/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3/resourceGroups/nzila-g2-proof-xre47vggs5uhw/providers/Microsoft.Network/networkSecurityGroups/nzila-g2-builder-nsg-y3koaeijzi6mu`

Read-only Azure inventory at `2026-10-10T04:20:32.741Z` found the resource group in Canada Central with the approved synthetic-proof tags and six child resources. No VM, NIC, NSG, VNet, firewall, or private endpoint was present. The VNet link list for `privatelink.azurecr.io` was empty. Consequently, there was no VM ingress state to validate and no cloud-init/discovery execution.

The ACR readback confirmed Premium SKU, public network access disabled, admin user disabled, and trusted-service bypass `None`. The two role assignments were at registry scope and use repository-name conditions for `synthetic-health`. The builder and runtime UAMIs are distinct. No image was pushed and no token was requested or recorded.

See [G2_STAGE1_RUNTIME_EVIDENCE.json](./G2_STAGE1_RUNTIME_EVIDENCE.json) for explicit outcomes for every required runtime proof. Missing VM-derived values are recorded as not observed, not inferred. In particular:

- `BOOT_DIAGNOSTICS_PROOF=FAIL` — no VM was created and no serial/boot record could be retrieved.
- `OBSERVED_APT_ENDPOINTS=NOT_OBSERVED` — no VM image was instantiated; no endpoint is inferred.
- `IMDS_IDENTITY_PROOF=FAIL` — the request was not run because no VM existed; this is not evidence of an IMDS authentication failure.
- `PRIVATE_ACR_NETWORK_PROOF=FAIL` — private DNS resolution and HTTPS reachability could not be tested without the VNet, private endpoint, and VM.
- `ACR_TOKEN_EXCHANGE_PROOF=NOT_RUN` — no VM/client environment existed. This is not the permitted tooling-only `BLOCKED` case.
- `STAGE2_PROPOSED_APT_ALLOWLIST=NOT_GENERATED` — there are no observed endpoints from which to build a safe exact allowlist.

No firewall rule was changed, no package egress was enabled, and no package installation, Buildah/Go installation, Run Command, SSH, RDP, or image build occurred. No production, staging, Cora, UE, or product application/runtime resource was mutated.

## Timeline and cost observation

- Deployment start: approximately `2026-10-10T04:14:08.886Z`, calculated from the Azure deployment timestamp and reported duration.
- Deployment completion: `2026-10-10T04:14:47.781Z` (failed).
- NSG failure event: `2026-10-10T04:14:12.946Z`.
- ACR creation: `2026-10-10T04:14:12.884Z`.
- Public IP creation succeeded: `2026-10-10T04:14:16.080Z`.
- VM start: none; VM was not created.
- Firewall creation: none.
- Proof-attempt completion: `2026-10-10T04:14:47.781Z` (deployment failure).
- Evidence inventory snapshot: `2026-10-10T04:20:32.741Z`.
- Approximate elapsed time from ACR creation to evidence snapshot: 6 minutes 20 seconds. The partial ACR, public IP, and DNS zone remain deployed and may continue accruing charges.

The existing Canada Central retail-rate baseline in `g2-builder-validation-results.md` is retained: ACR Premium `$1.6666/day`, Standard static IPv4 `$0.005/hour`, Private DNS zone `$0.50/month`; planned but uncreated components include Standard_B2s `$0.0464/hour`, Azure Firewall Basic `$0.395/hour`, Private Endpoint `$0.01/hour`, and StandardSSD_LRS E4 `$2.64/month`. These are USD PAYG unit rates, not a precise invoice estimate. No VM, firewall, private endpoint, or disk was created. Data-processing, storage, DNS-query, and applicable egress charges remain usage-dependent/unresolved. Do not infer a precise total from this short observation window.

## Failure handling and next gate

The partial estate has not been deleted: no unexpected open ingress or ACR public access was found, and cleanup could destroy useful diagnostic state. Do not retry until the NSG provider rejection is diagnosed and the corrected deployment is separately reviewed/authorized. No Stage 2 work is authorized by this failed Stage 1 result.

