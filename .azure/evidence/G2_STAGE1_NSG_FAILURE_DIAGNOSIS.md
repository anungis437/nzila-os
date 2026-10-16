# G2 Stage 1 NSG failure diagnosis

**Mission:** `NZ-20261008-INFRA-001`  
**Execution slice:** `G2_STAGE1_DISCOVERY_DEPLOYMENT`  
**Classification:** Proof of concept — isolated synthetic infrastructure proof only  
**Diagnosis:** `NSG_ROOT_CAUSE_UNRESOLVED`  
**Stage 1 disposition:** `STAGE1_DISCOVERY_FAILED`  
**Overall G2:** `FAIL`

## Finding

The authorized Stage 1 deployment failed while creating `Microsoft.Network/networkSecurityGroups/nzila-g2-builder-nsg-y3koaeijzi6mu`. Azure returned `SecurityRuleInvalidAccessType` with the message: “Security rule has invalid Accees type. Value provided: Allow Allowed values: Deny.” The deployment correlation ID is `58b7664a-5d58-4a1c-8edd-ee219fc5ea4a`; the failed operation tracking ID is `57a1754a-18c6-48e6-9d2e-2486a8a5e112`.

The original failed operation did not retain its request or response body (`request: null`, `response: null`). Therefore, the actual NSG PUT payload that Azure evaluated is unavailable. The compiled ARM resource in [G2_STAGE1_FAILED_NSG_EMITTED_PAYLOAD.json](./G2_STAGE1_FAILED_NSG_EMITTED_PAYLOAD.json) is evidence of the emitted template, **not** proof of the wire payload.

## Evidence and interpretation

| Question | Evidence | Interpretation |
|---|---|---|
| Did the Bicep source request `Allow`? | Yes. Four rules in the NSG source use `Allow`; two use `Deny`. | This alone does not explain why the deployment error listed only `Deny` as accepted. |
| Did compilation change the NSG rules? | The Bicep NSG definition and compiled `main.json` resource were inspected and match. | A source-to-emitted-template change is not indicated. |
| Does the API schema permit `Allow`? | Microsoft.Network `2024-05-01` schema lists both `Allow` and `Deny`; the provider reports the API version and Canada Central as available. | A straightforward enum/schema incompatibility is not supported. |
| Do isolated provider checks accept the rules? | All seven isolated validate and what-if variants succeeded: full, empty, deny-only, and each individual Allow rule. | Validation and what-if do not prove that the historical PUT had the same payload or that the resource provider execution path will accept it. |
| Is there evidence of an Azure Policy deny? | Read-only assignment listing confirms subscription assignment `SecurityCenterBuiltIn`, `Default` enforcement, and empty assignment parameters. Prior initiative inspection found the relevant NSG monitoring policies default to `AuditIfNotExists`. | No specific deny policy is established as the cause. Assignment metadata alone cannot rule out every inherited/related control. |
| Was the failure reproduced? | No. No redeployment or NSG mutation was performed. | No reproduction evidence distinguishes a transient/provider-path issue from a request transformation or other cause. |

Provider checks and assignment readback are preserved in [G2_STAGE1_NSG_PROVIDER_VALIDATION.json](./G2_STAGE1_NSG_PROVIDER_VALIDATION.json). Historical deployment and partial-estate evidence remains in [G2_STAGE1_DEPLOYMENT_RESULT.json](./G2_STAGE1_DEPLOYMENT_RESULT.json) and [G2_STAGE1_RESOURCE_INVENTORY.json](./G2_STAGE1_RESOURCE_INVENTORY.json).

## Root-cause disposition

**`NSG_ROOT_CAUSE_UNRESOLVED`**

The available evidence weighs against an obvious Bicep/compiled-template enum error and against a directly evidenced policy deny. It does not establish why Azure reported that `Allow` was invalid during the failed resource operation. Do not call this an Azure provider defect, and do not make a source correction based only on the error text.

## Safety and scope

- No deployment retry, Azure resource mutation, NSG edit, network/identity-control relaxation, or cleanup was performed during this diagnosis.
- The six-resource partial G2 estate remains retained for diagnosis.
- No image push, package egress, package installation, VM access, production/staging change, Cora change, or UE runtime change was performed.
- No repository source or existing evidence file was modified as part of the diagnosis.

## Evidence needed to resolve the cause

For a future, separately authorized deployment attempt, preserve the exact fully expanded NSG request as submitted, the resource-provider response/operation details, and the correlated Activity Log event. Compare those records against the emitted resource captured here. Do not retry until the failed operation is understood and the deployment is separately reviewed and authorized.
