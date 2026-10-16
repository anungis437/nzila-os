# Stage 1 fresh-boot execution and runtime proof

Mission: `NZ-20261008-INFRA-001`  
Slice: `G2_STAGE1_FRESH_BOOT_RUNTIME_PROOF`

`STAGE1_DISCOVERY_PROVEN`  
`FRESH_BOOT_EXECUTION_AUTHORITY_CONSUMED = YES`  
`PROTECTED_INFRASTRUCTURE_UNCHANGED = YES`  
`OLD_OS_DISK_ORPHANED = NO`  
`OVERALL_G2 = FAIL`

## Governed preparation and exact source binding

The preparation skill became callable and the existing unconsumed authority
resumed. No new architecture or execution authority was issued. The
azure-prepare, azure-validate workflow and azure-deploy steps completed.
The validation script advanced through all required stages and the deployment
plan records actual validation proof.

Fresh raw sixteen-resource/role checks matched the retention-closure baseline.
Branch/HEAD stayed `g2/synthetic-health-source` /
`7bec20aad11d43eeae8099c14e021b3074154b27`. V2 discovery/cloud-init/test hashes,
candidate template and all bound infrastructure/historical evidence hashes
remained unchanged. No foreign tracked work was edited or dispositioned.

The VM-only execution template is a projection of the exact V2 candidate:
only the VM resource remains, with its protected external dependencies removed
from dependsOn. Resource contents are otherwise identical; unused compiler
metadata and outputs are removed. Outer default attribution tags are inherited.
No protected NIC/network/ACR/identity/role definition was submitted.

[Preparation/hash binding](./G2_FRESH_BOOT_RESUME_PREPARATION.json),
[baseline](./G2_FRESH_BOOT_RESUME_BASELINE.json),
[VM-only template](./G2_FRESH_BOOT_RESUME_VM_ONLY_TEMPLATE.json),
[parameters](./G2_FRESH_BOOT_RESUME_VM_ONLY_PARAMETERS.json).

## Validation and destructive gate

- Required V2 Python suite: 22 PASS, zero skipped.
- Bicep build/lint: PASS.
- DNS/NSG, VM/firewall/preservation and negative contracts: PASS.
- `git diff --check`: PASS.
- Governed core helper: OVERALL PASS on an isolated Bicep representation.
- Exact authority JSON provider validation: PASS.
- Fresh FullResourcePayloads what-if: existing VM NoChange; protected
  resources Ignore. Only leaf is exact VM disk storageAccountType NoEffect,
  null to StandardSSD_LRS, corroborated by live disk SKU.
- Policy review: inherited West Europe restriction does not block Canada
  Central; SecurityCenter audit-only. No provider policy denial.

What-if is not represented as a preview of the direct DELETE cascade. The
separately authorized same-name VM DELETE/recreate and exact old-disk retirement
are individually bound to IDs in the destructive gate. No wildcard tolerance
or unrelated resource lifecycle action was admitted.

[Provider validation](./G2_FRESH_BOOT_RESUME_PROVIDER_VALIDATION.json),
[fresh what-if](./G2_FRESH_BOOT_RESUME_WHATIF_RAW.json),
[exact execution gate](./G2_FRESH_BOOT_RESUME_EXECUTION_GATE.json),
[immediate pre-delete gate](./G2_FRESH_BOOT_RESUME_FINAL_PREDELETE_GATE.json),
[final pre-delete state](./G2_FRESH_BOOT_RESUME_FINAL_PREDELETE_ESTATE.json).

Confirmation tools were invoked before VM/disk destructive steps; the user was
unavailable. Execution used the active explicit written approval of those
exact actions, not a guessed new approval. No preparatory live patch occurred.

## One execution only

Old VM deletion succeeded. Fresh-boot authority was persistently marked consumed
before that invocation. No force deletion or second delete attempt occurred.

The exact existing NIC and old OS disk survived. The NIC became unattached;
the disk became Unattached. All protected resources and role tuples remained.
A strict comparison paused on read-only NIC primary/internalDomainNameSuffix
metadata removal; exact 2024-05-01 schema confirms both are derived from VM
attachment, not configured network/DNS properties. Only those exact transitions
were correlated; private IP/allocation/subnet/NSG/routes/DNS were unchanged.
The VM-derived suffix remained omitted after reattachment, while primary and
VM reference returned. No provider metadata was written back to source or live
resources.

[VM deletion result](./G2_FRESH_BOOT_RESUME_VM_DELETE_RESULT.json),
[post-delete estate](./G2_FRESH_BOOT_RESUME_POSTDELETE_ESTATE.json),
[exact NIC detachment correlation](./G2_FRESH_BOOT_RESUME_NIC_DETACHMENT_RESPONSE_CORRELATION.json),
[verified mid-sequence gate](./G2_FRESH_BOOT_RESUME_MIDSEQUENCE_GATE.json).

A fresh post-delete what-if contained one exact VM Create and Ignore for every
retained resource. Exactly one replacement deployment was executed:

- Name: `g2-stage1-freshboot-20261010-193024`.
- State: `Succeeded`.
- Correlation: `bf6cc464-63f1-4b83-82d7-439fb34da3f4`.
- Same VM resource ID/name, existing NIC and builder UAMI.
- New VM unique ID: `81d34950-d46d-4026-95ff-c0308ccdd5d1`.
- New FromImage OS disk:
  `nzila-g2-builder-y3koaeijzi6mu_OsDisk_1_50cfc12f1bfb422ca576ad15e790b725`.
- Standard_B2s, pinned Ubuntu `24.04.202609040`, private-only topology and
  public-key-only provisioning retained.

[Post-delete what-if](./G2_FRESH_BOOT_RESUME_POSTDELETE_WHATIF_RAW.json),
[deployment](./G2_FRESH_BOOT_RESUME_REPLACEMENT_DEPLOYMENT.json),
[operations](./G2_FRESH_BOOT_RESUME_REPLACEMENT_OPERATIONS.json),
[fresh VM/disk proof](./G2_FRESH_BOOT_RESUME_REPLACEMENT_PROVISIONING_PROOF.json).

## First-boot runtime proof

Boot Diagnostics retrieval found exactly one standalone start marker and
exactly one complete compact result line. Counts of literal occurrences were
also one each, with start preceding result. No legacy record was substituted,
no interleaved fragments were spliced, and no raw serial log was persisted.
The bounded, validated result contains no token bodies or authorization values.
VM instance view confirms provisioned/running state.

| Proof | Result |
|---|---|
| SERIAL_MARKER_CONTRACT_RUNTIME | PASS |
| APT_DEB822_RUNTIME_PROOF | PASS; zero parsing errors |
| VM_UAMI_ATTACHMENT_PROOF | PASS |
| IMDS_TARGETED_TOKEN_REQUEST_PROOF | PASS |
| TOKEN_IDENTITY_CORRELATION_PROOF | PASS |
| PRIVATE_ACR_NETWORK_PROOF | PASS; private 10.90.2.5, TCP443 and HTTPS |
| ACR_TOKEN_EXCHANGE_PROOF | PASS |

Observed APT endpoint: `http://azure.archive.ubuntu.com/ubuntu/`.
This observation does not approve an egress allowlist or package contact.
The accepted serial result is mechanically reconciled with exact live
VM/UAMI/client/principal attachment metadata; unsupported IMDS identity fields
are not required.

`APT_UPDATE = NOT_ATTEMPTED`  
`PACKAGE_INSTALL = NOT_ATTEMPTED`  
`IMAGE_BUILD = NOT_ATTEMPTED`  
`IMAGE_PUSH = NOT_ATTEMPTED`  
`RUN_COMMAND = NOT_USED`  
`SSH = NOT_USED`  
`STAGE2 = NOT_STARTED`

[Token-free runtime result and reconciliation](./G2_FRESH_BOOT_RESUME_RUNTIME_DISCOVERY.json),
[status-only instance view](./G2_FRESH_BOOT_RESUME_INSTANCE_VIEW.json),
[runtime estate](./G2_FRESH_BOOT_RESUME_RUNTIME_ESTATE.json).

## Exact old disk retirement and final estate

Before deletion, the old disk ID was rechecked against the pre-delete record,
with Unattached state and no managedBy references. The replacement uses a
different fresh disk. Subscription-wide VM/disk/snapshot/image reads found no
reference to the old disk ID/unique ID. Only that exact old disk was deleted.
No unrelated cleanup occurred.

[Disk-deletion gate](./G2_FRESH_BOOT_RESUME_OLD_DISK_DELETE_GATE.json),
[exact deletion result](./G2_FRESH_BOOT_RESUME_OLD_DISK_DELETE_RESULT.json).

The final estate contains sixteen resources, no old OS disk, the replacement
VM/fresh disk, retained NIC and unchanged protected network/security estate
and roles.

[Final estate](./G2_FRESH_BOOT_RESUME_FINAL_ESTATE.json),
[final disposition](./G2_FRESH_BOOT_RESUME_FINAL_DISPOSITION.json).

Stage 1 is proven. Overall G2 remains FAIL; bootstrap, image build/push,
production readiness and Stage 2 are not claimed or authorized.
No further fresh-boot attempt is authorized.
