# Existing first-byte retry: consumed, failed download, cleanup complete

## Terminal result

**CSE_FAILURE_OTHER. G3A first byte remains BLOCKED.**

The deployment tooling gate recovered. The unchanged, validated retry was
dispatched once under the existing authority, not a new authority.
ARM accepted selector **2.1**, created the extension resource and reached
guest CustomScript **2.1.19**. The guest reported error **72** while downloading
the managed-identity file:

> processing file downloads failed ... unable to download the MSI. This may
> be due to firewall rules or a networking error

The message includes service request ID
`5077d162-c01e-003f-7c72-5a3064000000`; no precise underlying HTTP status/error
or identity-token stage is captured. The V1/V2 probe command did not run.
There are no runtime markers or self-hashes. This does **not** prove version
selection ignored/unsupported, identity failure or private-path failure.

The raw controller raised `CSE_NOT_TERMINAL_NO_RETRY` because it compared
terminal status codes exactly and did not recognize `ProvisioningState/failed/0`.
The captured instance view unambiguously establishes a terminal failed guest
download. Closeout corrects that observation without changing or replaying the
validated controller.

## Preserved gates and transaction

- Predeploy root and every sealed input checked unchanged.
- Only time-sensitive safety gates refreshed; no source archaeology, portable
  builder/uploader qualification replay or binary rebuild.
- Subscription/tenant/principal, write/role permissions, providers, RG absence,
  selected CIDR, B2s/headroom and Canada Central 2.1 family PASS.
- Current like-for-like CAD retail meter refresh PASS; expected CAD 1.5363953
  remains within the independent CAD 3.00 ceiling. An initial default pricing
  API read rounded rates; its failure is retained and the matching preview API
  contract was used. No validated-package edit was required.
- V1 historical version and V2 current unversioned bytes both verified.
- Writer removed, producer exception cleared, public network disabled,
  private endpoint/DNS and exact-container Reader verified before VM consumption.
- One CSE deployment attempt; no force tag, timestamp, repair or retry.
- No ACR, image build, qualified uploader, ABAC transaction, ACA or product work.

## Cleanup and accounting

The positive creation receipt and exact ownership inventory preceded cleanup.
Both temporary role assignments were deleted. The dedicated RG cascade removed
extension/VM/disk/NIC/UAMI/Storage/Blob/PE/DNS/network state; the subscription
deployment record was deleted. Final resource/role census is empty.
Exact UAMI/Storage and Graph principal absence checks supplement the census.
G2 resource/role snapshots and protected root remain unchanged.

[Mutation accounting](MUTATION_ACCOUNTING.json) defines caller-level dispatch
counters separately from explicit resource operations and internal cascades.
The one non-successful CSE dispatch was a guest provisioning failure, **not**
an ARM rejection of the repaired selector. UAMI creates/deletes entail nonzero
platform-managed Entra lifecycle; exact internal Graph write count is unobserved.

[Cost estimate](ACTUAL_COST_ESTIMATE.json) uses observed VM/PE lifetime upper
bounds and retained conservative DNS-month/disk-day/operation/traffic allowances.
It is not an Azure invoice. The previous CAD 1.3567668 estimate remains separate.

## Governance and next boundary

[Full final disposition](FINAL_DISPOSITION.json) preserves G3 BLOCKED,
controller/package INCOMPLETE, full G3A cost UNRESOLVED, all execution
authorizations NO and UE/Cora INFRA_NO_GO.

Conditional local package/cost closure is NOT_ACTIVATED because the proof failed.
The [minimal amendment](MINIMAL_FAILURE_AMENDMENT.md) addresses only download
observability and terminal-status recognition; it grants no further run.
Stop after evidence closure. Do not redesign first byte or execute a third proof.

## Concurrency and persistence

All new closeout/refresh evidence is in this resume lane. The validated retry
package received only previously defined transaction-generated evidence; its
sealed predeploy bytes remain unchanged. Older failed packet is preserved.
No protected historical plan edits, commits, staging or foreign disposition.
Active HEAD remains `7bec20aad11d43eeae8099c14e021b3074154b27`;
shared foreign HEAD `1c337567635bb86ea0df7831557d8d2d22df1e6f`,
505 foreign status entries observed.

The closeout seal and independent verification check exact packet/evidence
hashes, accounting, cost, cleanup and blocked governance. Protected ancestor
roots are checked without claiming a fresh replay of every ancestor leaf.
