# Proposed Stage 1 first-boot execution authority

**PROPOSAL ONLY - NOT AUTHORIZED**

Mission: `NZ-20261008-INFRA-001`  
Mode: `NEW_VM_EXECUTION_REQUIRED`  
Retry 2: CONSUMED; this is not its continuation.

## Proposed bounded next scope

Request a separately authorized first-boot VM execution of the repaired
discovery payload. Retain Canada Central, pinned image/size, private-only
networking, builder UAMI selector, exact NSG rules, firewall, management subnet,
private ACR/PE/DNS and conditioned repository roles.

No package contact/update/install, image build/push, SSH, Run Command,
extensions, network weakening, product deployment or Stage 2.

## Decisions requiring explicit execution authority

The current VM/OS disk cannot receive new Custom Data non-mutatively.
Choose and explicitly authorize the exact create/replacement mechanism before
implementation. A parallel VM entails new NIC/VM/disk names, temporary capacity
and exact new-resource authority; replacement entails destructive existing
VM/disk lifecycle authority and an explicit retained-NIC plan. Neither is
authorized by this proposal. Do not attempt an unchanged full-template PUT
against the existing VM with new Custom Data.

No cleanup of the existing sixteen-resource estate is authorized.

## Required pre-execution packet

1. Fresh concurrency/live sixteen-resource inventory and exact identity,
   tenant/subscription/region checks.
2. Bind source/test hashes to
   [the repair manifest](./G2_STAGE1_RUNTIME_DISCOVERY_REPAIR.json).
3. Explicit mechanism, resource IDs, OS-disk lifecycle, capacity/cost bound,
   approved SSH-public-key-only provisioning and private-key destruction proof.
4. New compiled template/parameters manifest. The current repaired candidate
   is a source/static-validation artifact, not an approved deployment against
   the existing VM.
5. Focused tests, provider validation and fresh FullResourcePayloads what-if.
   Enumerate every Create/Modify/Delete and exact tolerated provider path.
   Any replacement Delete must be separately approved; do not import blanket
   schema waivers or consumed Retry 2 authority.
6. One explicit execution authorization, unique deployment name, immediate
   hash/estate recheck and failure-stop contract. No implicit subsequent retry.

## Required runtime acceptance

Retrieve serial/Boot Diagnostics only. Verify exactly one standalone start
marker and one complete bounded compact result marker, no credentials, all
required local checks, complete APT endpoint denominator and independent live
VM attachment/targeted-token correlation. Optional exchange BLOCKED remains
distinct; accepted ACR/network history must not substitute for contradictory
new results. Correlate source and VM identity before accepting Stage 1 proof.

Overall G2 remains FAIL until its separately required gates close.
