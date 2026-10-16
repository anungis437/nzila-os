# G2 Stage 1 Retry Delta Classification

**Mission:** `NZ-20261008-INFRA-001`  
**Gate:** `G2_PRIVATE_CONTROL_PLANE`  
**Slice:** `G2_STAGE1_RETRY_DELTA_CLASSIFICATION`  
**Reviewed at:** `2026-10-10T14:39:51.7050036Z`  
**Disposition:** `RETRY_GATE_BLOCKED_UNRESOLVED_MODIFIES`  
**Azure writes:** None.  
**Stage 1 deployment:** Not executed.

## Concurrency checkpoint

- Worktree: `C:\APPS\worktrees\nzila-g2-provenance`
- Branch: `g2/synthetic-health-source`
- HEAD: `7bec20aad11d43eeae8099c14e021b3074154b27`
- Status before this evidence write: only pre-existing untracked `.azure/` and `infrastructure/landing-zone/g2-builder/`; no tracked modifications.
- All ten files in the approved discovery-payload authority hash manifest still matched their recorded SHA-256 values before this write.
- The two files created for this reconciliation are separate evidence; no source, template, parameter, or Azure resource was changed.

## Evidence checked

| Evidence | SHA-256 |
|---|---|
| `.azure/evidence/G2_STAGE1_RESOURCE_INVENTORY.json` | `285C2003A273FFCB56AB8A409E6FCEF53DB51C93222603D887E43782CD0612B7` |
| `.azure/evidence/G2_STAGE1_RETRY_BASELINE.json` | `577F5762FA7B6EC6D67CDD8DDE61AF69F44D7B50468EEEC8188D5A6CBEFF9B5F` |
| `.azure/evidence/G2_DISCOVERY_AUTHORITY_WHATIF_RAW.json` | `C86AFD1EA64E63F1FEA82445ED1792E16F564646546541CF7271DECA9A48B0EA` |
| Authorized compiled template `infrastructure/landing-zone/g2-builder/main.json` | `93E8754B0857A444534FA30586F6D8B8A931BAE502DD7DD84319E85D77C56FE2` |

Read-only Azure CLI resource queries confirmed the current properties below. The retained estate inventory reports six resources in the proof resource group; the four resources raised by what-if are existing ACR, two ACR-scope role assignments, and an unattached public IP. No resources were modified during these queries.

## `LIVE_STATE_VS_IAC_DIFF`

| Resource and property | Live provider value | Current IaC / what-if delta | Classification | Assessment and required resolution |
|---|---|---|---|---|
| Existing registry `nzilag2tzo75uuozprbo`: `properties.encryption` | `{ "status": "disabled" }` | The registry resource omits `encryption`; what-if reports `Delete properties.encryption`. | `LIVE_IS_AUTHORITATIVE_TEMPORARILY` | The read confirms the live state, not that omission preserves it. Microsoft documents that some omitted/defaulted properties can appear as deletions in what-if, but that general caveat does not prove this field is harmless. Hold it unchanged until a content-authorized template explicitly preserves the agreed target or a focused provider test proves the omission is a no-op. |
| Existing registry `nzilag2tzo75uuozprbo`: `properties.networkRuleBypassAllowedForTasks` | `false` | The registry resource omits the field; what-if reports `Delete properties.networkRuleBypassAllowedForTasks`. | `LIVE_IS_AUTHORITATIVE_TEMPORARILY` | Live task-bypass is disabled, consistent with the private-registry intent. The template also sets `networkRuleBypassOptions: 'None'`, but that is a separate property and does not prove omission of this boolean is non-mutating. Keep `false` authoritative until the exact target is declared and the repeated what-if is clean. |
| Reader assignment `1caf1212-c9f0-5165-a0b7-9827ab84df7b`: `properties.principalId` | `b150b19a-645d-493f-9bb4-0aa81cb0c449`, exactly the retained runtime UAMI principal ID | IaC references `runtimeIdentity.properties.principalId`; what-if reports a `Modify` from the literal live value to the unevaluated ARM `reference(...)` expression. | `IAC_IS_INTENDED_TARGET` | The live assignment's principal matches the UAMI queried by resource ID. The role, scope, condition, and repository restriction also match the authorized resource payload; `principalType` is reported as `NoEffect`, not a changed effective value. This is a proven identity-equivalent expression, not evidence of a different principal. Nevertheless, what-if still reports a resource `Modify`, so the strict retry gate remains failed. |
| Writer assignment `ba1fd686-3000-51dc-8fa6-1cfdedf67d20`: `properties.principalId` | `c59571aa-66ea-47c5-83d5-59946b318ae2`, exactly the retained builder UAMI principal ID | IaC references `builderIdentity.properties.principalId`; what-if reports a `Modify` from the literal live value to the unevaluated ARM `reference(...)` expression. | `IAC_IS_INTENDED_TARGET` | The live assignment's principal matches the UAMI queried by resource ID. The role, scope, condition, and repository restriction also match the authorized resource payload; `principalType` is reported as `NoEffect`, not a changed effective value. This is a proven identity-equivalent expression, not evidence of a different principal. Nevertheless, what-if still reports a resource `Modify`, so the strict retry gate remains failed. |
| Unattached public IP `nzila-g2-egress-y3koaeijzi6mu`: `properties.ddosSettings` | `{ "protectionMode": "VirtualNetworkInherited" }` | The public-IP resource omits `ddosSettings`; what-if reports `Delete properties.ddosSettings`. | `LIVE_IS_AUTHORITATIVE_TEMPORARILY` | The current protection mode is a documented configurable value. No evidence here establishes that omission retains the inherited mode. Preserve the live setting until IaC explicitly declares whether this is the intended target. |
| Same public IP: `sku.tier` | `Regional` | IaC declares `sku.name: 'Standard'` but omits `sku.tier`; what-if reports `Delete sku.tier`. | `REQUIRES_DECISION` | The API schema exposes `Regional` and `Global` as tier values, and the current resource is `Regional`. The evidence does not establish whether the omitted field is safely inferred from `Standard` by this provider/API version. Explicitly decide and declare the intended tier; do not whitelist the reported deletion based on assumption. |

The current template's `principalType: 'ServicePrincipal'` matches the live role assignments. The what-if `NoEffect` classification means the reported field is not effective; it does not add another `Modify` to the four-resource count.

## Retry gate

The raw structured what-if completed successfully and reports:

- `Create`: 8; the expected eight-resource Create set matches.
- `Modify`: 4.
- `Delete`: 0.
- `Unsupported`: 0.
- `NoChange`: 5.

The four `Modify` resources are enumerated above. The two role-assignment principal changes are identity-equivalent based on direct live UAMI reads, but the retry contract requires **zero reported Modify resources**. The ACR and public-IP property deletions are also unproven as harmless omissions. Therefore, the exact-create gate does not pass. Provider validation `PASS` does not supersede this failed what-if gate.

**No Stage 1 retry, nested deployment, or Azure write is authorized by this reconciliation.** Do not relax the zero-Modify condition. Resolve the three omission cases and remove or otherwise eliminate the two role-assignment what-if deltas under a new reviewed source/template hash set, then rerun provider validation and the complete structured what-if gate. Deployment remains prohibited unless the exact eight-Create / zero-Modify / zero-Delete / zero-Unsupported conditions all pass against the authorized bytes.

## Microsoft documentation

- [ARM template what-if: change types and omitted/defaulted properties](https://learn.microsoft.com/azure/azure-resource-manager/templates/deploy-what-if)
- [Microsoft.ContainerRegistry registries API 2025-11-01](https://learn.microsoft.com/azure/templates/microsoft.containerregistry/2025-11-01/registries)
- [Microsoft.Authorization roleAssignments API 2022-04-01](https://learn.microsoft.com/azure/templates/microsoft.authorization/2022-04-01/roleassignments)
- [Microsoft.Network publicIPAddresses API 2024-05-01](https://learn.microsoft.com/azure/templates/microsoft.network/2024-05-01/publicipaddresses)
