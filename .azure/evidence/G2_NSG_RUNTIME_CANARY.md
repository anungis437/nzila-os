# G2 NSG runtime canary

**Mission:** `NZ-20261008-INFRA-001`  
**Gate:** `G2_PRIVATE_CONTROL_PLANE`  
**Diagnostic slice:** `G2_NSG_RUNTIME_CANARY`  
**Classification:** Proof of concept - isolated synthetic infrastructure proof only  
**Disposition:** `NSG_RUNTIME_DIAGNOSIS_COMPLETE`  
**Root-cause classification:** `NSG_ROOT_CAUSE_OTHER`  
**Stage 1:** `STAGE1_DISCOVERY_FAILED`  
**Bootstrap:** `BOOTSTRAP_NOT_READY`  
**Overall G2:** `FAIL`

## Finding

Actual NSG creation reproduced the original `SecurityRuleInvalidAccessType` error. Bisection reduced the failure to the single `AllowPlatformDns` rule, with `destinationAddressPrefix: AzurePlatformDNS` and `access: Allow`. A single VirtualNetwork Allow rule succeeded, and the exact remaining five-rule collection also succeeded.

**`MINIMUM_RUNTIME_FAILING_RULESET = [AllowPlatformDns]`**

This is a singleton rule restriction, not a blanket runtime rejection of Allow and not a demonstrated interaction between rules. `NSG_ROOT_CAUSE_OTHER` is therefore the selected classification. The observed provider response for this singleton says that only `Deny` is allowed. It is not classified as a transient failure, nested-deployment failure, or general Network RP defect.

The original Stage 1 PUT body remains unavailable. These new exact requests reproduce the same error using the original emitted rule, but cannot retroactively prove the historical wire payload.

## Baseline and concurrency

- Worktree: `C:\APPS\worktrees\nzila-g2-provenance`; the shared dirty worktree was not used.
- Branch: `g2/synthetic-health-source`.
- HEAD: `7bec20aad11d43eeae8099c14e021b3074154b27`.
- Authoritative source archive SHA-256: `DF81CAE6D23555FC43AD1D96EF38CBA0BA67FB06D551A5183168FF151AD2528E`.
- Subscription: `5d819f33-d16f-429c-a3c0-5b0e94740ba3`.
- Region: `canadacentral`.
- Proof RG: `nzila-g2-proof-xre47vggs5uhw`.
- Baseline resource snapshot: `2026-10-10T04:58:33.826399Z`.
- Six retained child resources; no NSGs. Full resource readbacks and returned role-assignment records were captured.
- Microsoft.Network registration: `Registered`.
- Effective policy assignments were retrieved with the ARM `atScope()` filter, including inheritance:
  - Management-group `sys.blockwesteurope`: West Europe region restriction, with a deny override. The canaries used Canada Central.
  - Subscription `SecurityCenterBuiltIn`: `Default` enforcement, empty parameters, assignment description states audit-only defaults.
- Before every evidence-write batch the branch, HEAD, archive hash, and active subscription were checked. Existing untracked `.azure/` and builder files were not dispositioned or committed.

## Runtime experiments

All requests used the same RG, Canada Central, API `2024-05-01`, and original six attribution tags. Rules were copied from [G2_STAGE1_FAILED_NSG_EMITTED_PAYLOAD.json](./G2_STAGE1_FAILED_NSG_EMITTED_PAYLOAD.json), preserving order and values. Resource names were unique and never the final Stage 1 NSG name.

The create method was direct ARM REST `PUT` to `Microsoft.Network/networkSecurityGroups/{unique-name}`. Exact JSON bodies were persisted before submission. Each attempt captured timestamps, client/server request IDs, correlation/routing IDs, HTTP status, response headers, full provider response, polling results where applicable, readback, and cleanup in [G2_NSG_RUNTIME_CANARY.json](./G2_NSG_RUNTIME_CANARY.json).

| Experiment | Rules in original order | Create | HTTP | Cleanup |
|---|---|---|---|---|
| Canary 1 | `AllowVirtualNetworkOutbound` | PASS | 201 | Successful NSG verified unattached, deleted, GET returned 404 |
| Canary 3 | Original six rules | FAIL | 400 | GET returned 404; nothing to delete |
| Bisection first half | VirtualNetwork, platform DNS, IMDS Allow | FAIL | 400 | GET returned 404; nothing to delete |
| Bisection singleton | `AllowPlatformDns` | FAIL | 400 | GET returned 404; nothing to delete |
| Complement confirmation | Original five rules excluding `AllowPlatformDns` | PASS | 201 | Successful NSG verified unattached, deleted, GET returned 404 |

Every failed create returned:

```json
{
  "error": {
    "code": "SecurityRuleInvalidAccessType",
    "message": "Security rule has invalid Accees type. Value provided: Allow Allowed values: Deny.",
    "details": []
  }
}
```

**`CANARY1_CREATE=PASS`**  
**`CANARY3_EXACT_RULESET_CREATE=FAIL`**

Canary 2 was not run because Canary 1 succeeded. The optional nested canary was not run because its prerequisite, successful direct creation of the exact original collection, was false. No further experiment was needed after isolating a failing singleton and confirming that its exact complement succeeds.

### Identifiers and chronology

All times below are UTC. Full precision and all per-request timestamps are in the JSON evidence.

| Experiment | Create start / result end | Request / async operation ID | Correlation ID |
|---|---|---|---|
| Canary 1 | 04:59:11.993 / 04:59:23.043 | `c9099a7b-fd17-4698-b123-c8902c28bd54` | `b81b5de4-e1e4-44a5-8365-e5b137035c19` |
| Canary 3 | 04:59:50.941 / 04:59:54.651 | `c35c673d-ae11-4aa7-b51b-f593333b99dd` | `5fa1ff17-a426-438b-bf1f-6d9dd1eca850` |
| First half | 05:00:26.693 / 05:00:30.780 | `b802dd8b-ca1d-45ee-9fad-a5d747d01b38` | `24dd00c1-1105-4726-a463-c0062e055db2` |
| DNS singleton | 05:00:47.667 / 05:00:52.112 | `f5a0e3f4-333a-4b24-b8d2-59b0db141696` | `199d69a0-327b-464f-b666-e246e2ed8698` |
| Without DNS rule | 05:02:21.201 / 05:02:31.930 | `a5992ea7-8b45-4a6b-bed7-e3477c0e9409` | `eec1f54f-fb40-49c4-98e4-3f48f9a5c1ae` |

Failed requests were rejected synchronously, so no async operation ID was allocated; those rows show the server request ID only. Successful rows have that identifier in the Azure-AsyncOperation URL as well. Cleanup of the last created NSG completed at `2026-10-10T05:02:43.218639Z`. Final estate verification completed at `2026-10-10T05:06:18.304419Z`.

## Azure platform DNS semantics

Microsoft documents that DNS communication to the default Azure DNS address is not subject to configured NSGs unless explicitly targeted with `AzurePlatformDNS`, and that an outbound Deny rule using this tag disables that service:

- [Azure IP address 168.63.129.16 overview](https://learn.microsoft.com/en-us/azure/virtual-network/what-is-ip-address-168-63-129-16).
- [Azure service tags overview](https://learn.microsoft.com/en-us/azure/virtual-network/service-tags-overview).

The documentation explains why an explicit Allow rule is unnecessary; the exact Deny-only restriction is evidenced here by the provider responses, not inferred solely from the documentation. Removing this explicit Allow rule preserves default platform DNS behavior. It must not be replaced by Deny, an Internet/DNS wildcard, a generic Internet rule, or an AzureCloud rule. VM DNS/private-ACR runtime proof still belongs to Stage 1 after a separately authorized retry.

## Cleanup and preservation verification

Final ARM readbacks verified:

- Zero NSGs in the proof RG, including all five attempted canary names.
- Only two NSGs were actually created, and both were deleted after checking absent NIC/subnet attachments. Three failed creates left no resource.
- The six retained resources have identical baseline/final inventories and full resource readbacks.
- The resource group and all returned role-assignment records are unchanged.
- SHA-256 checks confirm all pre-existing evidence files are unchanged.
- No Stage 1 retry, nested deployment, source correction, other Azure resource write, image push, package activity, product mutation, or production/staging mutation occurred.

## Corrected Stage 1 retry authorization packet - PROPOSED, NOT EXECUTED

This packet requires a new explicit authorization. It is not a deployment approval from this diagnostic mission.

### Mission and authority

- Mission: `NZ-20261008-INFRA-001`.
- Execution slice: `G2_STAGE1_DISCOVERY_RETRY_AFTER_NSG_DNS_CORRECTION`.
- Same worktree, branch, subscription, Canada Central region, and proof RG as above.
- Synthetic source remains commit `7bec20aad11d43eeae8099c14e021b3074154b27` and archive SHA-256 `DF81CAE6D23555FC43AD1D96EF38CBA0BA67FB06D551A5183168FF151AD2528E`; no synthetic-service change is required.
- Before deployment, record the corrected IaC revision and compiled-template SHA-256 separately. Do not pretend the unchanged synthetic source archive includes an uncommitted IaC correction. Do not commit foreign files or merge to `main`.

### Only proposed correction

In [builder.bicep](../../infrastructure/landing-zone/g2-builder/builder.bicep), remove only the complete `AllowPlatformDns` security-rule object. Keep API `2024-05-01`, all remaining rule names, priorities, values, order, and NSG naming unchanged.

Add a focused regression contract that rejects `access: Allow` with destination `AzurePlatformDNS` and verifies the exact five-rule collection tested here. Recompile through the normal Bicep toolchain into a new validation artifact rather than overwriting historical emitted-template evidence.

No DNS rule substitution, identity broadening, firewall change, package-egress opening, subnet reconfiguration, or other security-control redesign is proposed.

### Preconditions for any retry

1. Refresh branch/HEAD/worktree, archive hash, active subscription, retained-resource readbacks and role scopes. Stop on unreviewed foreign or Azure drift.
2. Verify the corrected emitted NSG equals the successful complementary five-rule collection, except for its intended final name and ARM parameter expressions.
3. Pass Bicep build/lint, emitted-template checks, the existing negative contracts, and the new DNS regression. Record exact commands and results. No full test repetition unrelated to this correction is required.
4. Pass Azure provider validation and save fresh structured subscription what-if against the retained partial estate, with package sources still empty.
5. Review the exact resource IDs and payloads in that new what-if. Do not reuse the historical 17-Create criterion: the RG, six child resources, and two registry-scope role assignments already exist. The expected missing resource set is:
   - builder NSG;
   - builder VNet;
   - Azure Firewall;
   - private DNS VNet link;
   - ACR private endpoint;
   - private endpoint DNS zone group;
   - builder NIC;
   - builder VM.
   Expect eight missing managed resources to be created and the retained desired resources to remain unchanged. If expansion/counting differs, or what-if reports any Modify, Delete, Unsupported, extra Create, or different retained-resource payload, STOP for review instead of silently accepting or repairing it.
6. Bind the new authorization to the reviewed corrected IaC/template hashes, exact parameters, resource-ID list, and what-if artifact before the single retry.

### Proposed execution boundary

Execute the corrected discovery-only [main.bicep](../../infrastructure/landing-zone/g2-builder/main.bicep) once using the existing [parameters.preview.json](../../infrastructure/landing-zone/g2-builder/parameters.preview.json), with only the execution toggle `previewOnly=false`; `approvedAptSources=[]` remains unchanged. Use subscription deployment mode to the existing proof RG as originally designed.

No image push, apt update/install, Go/Buildah installation, build on the VM, Run Command, SSH/RDP, public VM IP, public ACR, admin credentials, trusted-service bypass, product data, or production/staging/product mutation is authorized. Do not delete or intentionally change the retained ACR, identities, route table, DNS zone, public IP, resource group, or repository-scoped assignments.

Capture the corrected template before execution, preserve full ARM deployment/operation errors and correlation IDs, and request deployment debug content for resource request/response records where supported. Keep sensitive content out of public output and redact any secret before durable publication. Do not assume that Azure will retain every provider wire request.

### Required post-retry proof

Compare the completed estate with the approved missing-resource list and retained-resource baseline; verify private ingress, firewall/UDR, private ACR/DNS, distinct builder/runtime UAMIs and scoped roles. Retrieve marked discovery output through Azure Boot Diagnostics/serial only. Observe exact image/APT sources, real IMDS, and private ACR DNS/HTTPS; token exchange may be tooling-only BLOCKED. Save all outcomes without tokens. Generate no Stage 2 allowlist from guessed endpoints.

On failure, capture evidence and stop; no blind second retry or broader controls. Stage 1 may advance only to its original runtime-evidence disposition once those proofs exist. Overall G2 remains `FAIL`; no Stage 2 work is authorized by this packet.
