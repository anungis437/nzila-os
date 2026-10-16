# Fresh-boot NIC retention closure

Mission: `NZ-20261008-INFRA-001`  
Slice: `G2_STAGE1_FRESH_BOOT_RUNTIME_PROOF`

`NIC_RETENTION_GATE_CLOSED_BY_DOCUMENTED_DEFAULT_PERSISTENCE`

## Authoritative omitted-value behavior

[Microsoft's VM deletion FAQ](https://learn.microsoft.com/sk-sk/azure/virtual-machines/delete)
states under "How do I persist the disks, NIC, and Public IPs associated with a VM?":

> By default, disks, NICs, and Public IPs associated with a VM are persisted when the VM is deleted.

The [documentation record](./G2_FRESH_BOOT_NIC_RETENTION_DOCUMENTATION.json)
captures the exact quote, URL, capture time and retrieved HTML hash.
This product-level default contract resolves the previous exact-schema
omission question. No live delete-option patch is needed or performed.

## Fresh correlation and source authority

The [refreshed baseline](./G2_FRESH_BOOT_RETENTION_CLOSURE_BASELINE.json)
contains sixteen exact resource IDs, raw resource reads and current roles.
Raw resource state matches the previous baseline, excluding only etag and
systemData metadata. Exact principal/role/scope/condition contracts match.

The raw VM still omits NIC-reference deleteOption, reports OS disk Detach,
attaches the exact builder UAMI and references the exact existing builder NIC.
The NIC remains private-only Dynamic IPv4 and attached only to that VM.
The old managed OS disk remains attached, not orphaned.

V2 discovery/cloud-init/tests, candidate template, unchanged infrastructure
files and V2-bound historical evidence hashes all match. Prior evidence is
unchanged. Branch and HEAD remain `g2/synthetic-health-source` /
`7bec20aad11d43eeae8099c14e021b3074154b27`; no foreign work was dispositioned.

| Retention field | Result |
|---|---|
| NIC_DELETE_OPTION_LIVE_REPRESENTATION | OMITTED |
| NIC_OMISSION_DOCUMENTED_BEHAVIOR | PERSIST_ON_VM_DELETE |
| NIC_EFFECTIVE_DELETE_BEHAVIOR | DETACH/PERSIST |
| BUILDER_NIC_REUSE_SAFE | YES |
| OLD_VM_DELETE_WILL_DELETE_NIC | NO |
| OLD_VM_DELETE_WILL_DELETE_OS_DISK | NO; explicit Detach |
| OLD_VM_DELETE_WILL_DELETE_PUBLIC_IP | NOT_APPLICABLE |
| PREDELETE_DELETE_OPTION_PATCH_REQUIRED | NO |

The previous topology-unresolved report remains historical; this record
supersedes its NIC-retention disposition without overwriting it.

## Separate execution blocker

The mandatory Azure preparation skill could not be invoked. Both attempts
returned a tool-hook denial/error. This is not a NIC, provider or source
authority defect. The preparation/validation/deployment workflow must be
available before destructive execution; it was not bypassed with direct CLI
deletion or deployment.

No provider validation, what-if, VM/disk deletion, replacement creation or
guest execution occurred in this continuation. No preparatory Azure patch
occurred. The sixteen-resource estate is preserved.

`FRESH_BOOT_EXECUTION_AUTHORITY_CONSUMED = NO`  
`PROTECTED_INFRASTRUCTURE_UNCHANGED = YES`  
`OLD_OS_DISK_ORPHANED = NO`  
`STAGE1_DISCOVERY_PARTIAL`  
`OVERALL_G2 = FAIL`

The [machine-readable closure](./G2_FRESH_BOOT_NIC_RETENTION_CLOSURE.json)
separates accepted retention semantics from the tool-workflow blocker.
Resume the already-granted, unconsumed fresh-boot sequence when required
workflow tools are available, after fresh hash/estate checks and the remaining
validation/destructive gates. No new architecture cycle or live delete-option
patch is required.
