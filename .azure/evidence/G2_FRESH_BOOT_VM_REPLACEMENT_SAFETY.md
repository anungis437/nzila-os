# Fresh-boot VM replacement safety adjudication

Mission: `NZ-20261008-INFRA-001`  
Slice: `G2_STAGE1_FRESH_BOOT_RUNTIME_PROOF`

`VM_REPLACEMENT_TOPOLOGY_UNRESOLVED`  
`STAGE1_DISCOVERY_PARTIAL`  
`FRESH_BOOT_EXECUTION_AUTHORITY_CONSUMED = NO`  
`PROTECTED_INFRASTRUCTURE_UNCHANGED = YES`  
`OLD_OS_DISK_ORPHANED = NO`  
`OVERALL_G2 = FAIL`

## Exact current estate and source authority

Read-only refresh returned sixteen exact resource IDs matching the retained
Retry 2 final inventory. VM, builder NIC, attached OS disk, NSG, VNet, route
table, Basic firewall, both firewall public IPs, ACR private endpoint/managed
NIC, DNS zone/link, ACR and both UAMIs remain present. Exact repository-scoped
role principal/definition/scope/condition tuples match the prior accepted
snapshot.

Raw resource state and API versions are stored in
[pre-delete estate](./G2_FRESH_BOOT_PREDELETE_ESTATE.json). This is a snapshot
before any deletion, not evidence that deletion occurred.

Branch/HEAD remain `g2/synthetic-health-source` /
`7bec20aad11d43eeae8099c14e021b3074154b27`. Existing untracked `.azure/` and
builder trees remain; no foreign work was changed or dispositioned.

Every V2 discovery/cloud-init/test hash, unchanged infrastructure hash and
candidate template hash matches
[the final V2 authority](./G2_STAGE1_RUNTIME_DISCOVERY_REPAIR_V2.json).
The [hash-verification record](./G2_FRESH_BOOT_V2_HASH_VERIFICATION.json)
also preserves previous evidence hashes. No intermediate repair manifest was
used. The live SSH public key matches the approved Retry 2 parameters.

## VM/NIC/disk relationships

- VM name: `nzila-g2-builder-y3koaeijzi6mu`.
- NIC name: `nzila-g2-builder-nic-y3koaeijzi6mu`.
- OS disk name:
  `nzila-g2-builder-y3koaeijzi6mu_OsDisk_1_bef21f9b3fc74d49bce5c836f9b1e8a1`.
- Exact full IDs appear in
  [machine-readable safety analysis](./G2_FRESH_BOOT_VM_REPLACEMENT_SAFETY.json).
- NIC is attached to the exact current VM; private allocation remains Dynamic,
  with no public IP.
- OS disk is managed by the exact current VM; `createOption=FromImage`,
  `deleteOption=Detach`, StandardSSD_LRS, 32 GiB.
- No data disks, availability-set reference or zones.
- VM remains Standard_B2s on pinned Ubuntu `24.04.202609040`, with managed Boot
  Diagnostics and exact builder UAMI attachment. Password authentication stays
  disabled.
- Custom Data is not exposed by the raw VM model. Historical deployed authority
  binds the previous first-boot payload; V2 remains unexecuted.

## Specific failed precondition

The exact `2024-11-01` Compute API GET returns:

```json
{
  "networkInterfaces": [{
    "properties": {"primary": true}
  }]
}
```

The NIC reference's `properties.deleteOption` is **omitted**. This is not a
proven explicit `Detach` value.

The [exact public Compute schema](https://github.com/Azure/azure-rest-api-specs/blob/main/specification/compute/resource-manager/Microsoft.Compute/Compute/stable/2024-11-01/ComputeRP.json)
defines the property as `DeleteOptions` and describes it as specifying what
happens when the VM is deleted. It does not declare an omitted-value default.
The schema hash, property definition and enum are captured in the safety JSON.

[Microsoft deletion guidance](https://learn.microsoft.com/en-us/azure/virtual-machines/delete)
defines explicit `Detach` as retaining the resource. Generic default guidance
and search-generated summaries are not used to manufacture proof for this
omitted existing-NIC value. ARM what-if does not preview a direct VM DELETE
cascade; no non-mutating cascade preview has been established.

Therefore:

| Required field | Current finding |
|---|---|
| NIC_RETENTION_PROVEN | NO |
| BUILDER_NIC_REUSE_SAFE | UNRESOLVED |
| OLD_VM_DELETE_WILL_DELETE_NIC | UNRESOLVED |
| OLD_VM_DELETE_WILL_DELETE_OS_DISK | NO; explicit Detach |
| OLD_VM_DELETE_WILL_DELETE_PUBLIC_IP | NOT_APPLICABLE |
| FRESH_OS_DISK_REQUIRED | YES |

No claim is made that omission will delete the NIC. The finding is narrower:
the required exact retention proof has not been established.

If retention is later proven, the current explicit OS-disk Detach supports
preservation followed by exact authorized disk deletion after detachment;
never reuse it as the replacement boot source. No disk was deleted, and the
old disk remains attached, not orphaned.

## Stop before destructive execution

The packet explicitly requires STOP when NIC reuse/retention cannot be proven.
No VM-only execution template was submitted; no provider validation, what-if,
VM deletion, disk deletion, replacement deployment or guest execution occurred.
Neither fresh-boot authority nor any new retry was consumed.

To close only this blocker, provide either exact authoritative omitted-value
semantics or new narrow authority to set the old VM's existing NIC-reference
`deleteOption=Detach`, verify it by raw GET, and then repeat the original
replacement gate. Such a pre-delete VM update is not one of this packet's
listed minimum execution actions and was not silently performed.

All protected resources and previous deployment/failure evidence are preserved.
No cleanup or Stage 2 occurred.
