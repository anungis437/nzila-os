# G2 Retained-Resource PUT Semantics

Mission: `NZ-20261008-INFRA-001`  
Gate: `G2_PRIVATE_CONTROL_PLANE`  
Slice: `G2_RETAINED_RESOURCE_PUT_SEMANTICS`  
Recorded: 2026-10-10  

## Disposition

The final, narrowed Bicep template is provider-valid. Its fresh subscription-scope
what-if has the exact eight previously authorized Creates, six NoChange resources,
zero Deletes, and zero Unsupported changes. It reports three Modify resources:
the retained ACR and its two ACR-scoped role assignments. Each delta is classified
below against the freshly read live values. The Public IP is now NoChange after
explicitly preserving its live Regional tier and inherited DDoS mode.

No Azure resource was created or updated during this semantics investigation.
The single corrected Stage 1 retry remains the only authorized deployment.

## ACR omitted properties

The what-if reports deletion of `properties.encryption` and
`properties.networkRuleBypassAllowedForTasks` because those properties remain
omitted from the template:

| Property | Live value | Effective omitted/default value | Disposition |
|---|---|---|---|
| `properties.encryption` | `{"status":"disabled"}` | ACR uses service-managed encryption by default; customer-managed-key encryption is not enabled | `ACCEPT_SEMANTICALLY_NO_CHANGE` |
| `properties.networkRuleBypassAllowedForTasks` | `false` | `false` for the versioned ACR resource schema | `ACCEPT_SEMANTICALLY_NO_CHANGE` |

This relies on Azure Resource Manager incremental deployment semantics: omitted
properties on a resource included in the template are reapplied as provider
defaults, not merged from the existing resource. The defaults above are
equivalent to the exact-version live reads. The source therefore leaves these
fields omitted rather than adding values solely to suppress a what-if delta.

## ACR role-assignment representation deltas

The what-if leaves each `principalId` expression unevaluated. Fresh ARM identity
reads prove the expressions resolve to the existing principal IDs. Both role
assignments retain the same deterministic assignment IDs, ACR resource scope,
role definition, condition version `2.0`, and `synthetic-health` repository
condition:

| Assignment | Role | Existing principal / identity expression | Disposition |
|---|---|---|---|
| `1caf1212-c9f0-5165-a0b7-9827ab84df7b` | Container Registry Repository Reader | `b150b19a-645d-493f-9bb4-0aa81cb0c449` / runtime UAMI principal reference | `ACCEPT_SEMANTICALLY_NO_CHANGE` |
| `ba1fd686-3000-51dc-8fa6-1cfdedf67d20` | Container Registry Repository Writer | `c59571aa-66ea-47c5-83d5-59946b318ae2` / builder UAMI principal reference | `ACCEPT_SEMANTICALLY_NO_CHANGE` |

The reported principal-type delta is `NoEffect`. No role, scope, condition,
identity, or permission broadening is present in the reviewed template.

## Public IP preservation

The final source explicitly declares the live values:

- `sku.name`: `Standard`
- `sku.tier`: `Regional`
- `properties.ddosSettings.protectionMode`: `VirtualNetworkInherited`
- `properties.publicIPAllocationMethod`: `Static`
- `properties.publicIPAddressVersion`: `IPv4`

The live Public IP is unattached. The final what-if reports it as `NoChange`.
These explicit fields preserve live state rather than relying on unproven
omission behavior.

## Final gate evidence

- Provider validation: `Succeeded`; correlation ID
  `e43d7adf-40d9-4849-b47f-1371f34c7e21`.
- Fresh full-resource-payload what-if: `Succeeded`; SHA-256
  `1D5D294E2A6672DC9483D2657591D85779BD171BB0935468593C31DE2F2E1056`.
- Counts: 8 Create, 3 semantically explained Modify, 6 NoChange, 0 Delete,
  0 Unsupported.
- The eight Create resource IDs exactly match the original authorized Create set.
- Fresh proof-RG inventory matches the retained six-resource baseline; no NSG
  or diagnostic canary exists.
- `Microsoft.Network` is registered. The effective subscription policy
  assignment is unchanged and has no Canada Central restriction in the returned
  assignments.
- Focused DNS/identity/network and negative contracts passed; Bicep lint/build
  passed; `git diff --check` passed.
- No Stage 1 deployment has yet run as of this record.

The raw post-preservation what-if and the machine-readable classification are
stored alongside this report. Earlier discovery-authority, failed retry,
NSG-canary, and original what-if evidence remain unchanged.

## Content-addressed retry authority

This record binds the corrected retry to the following reviewed bytes:

| File | SHA-256 |
|---|---|
| `infrastructure/landing-zone/g2-builder/discovery.py` | `C9A12D5CE1BC92C3ED19610DB62A23B2E3090B5760E104785731D9206CDACFAB` |
| `infrastructure/landing-zone/g2-builder/tests/test_discovery.py` | `559A4619F9239011EF5F52DAE131FFEBBF2D2C2540B422F96571B412E72A717D` |
| `infrastructure/landing-zone/g2-builder/cloud-init.yaml` | `98BF84B5D3AF6D10B1BC617A61D5A5E237AB7F487AE1A63E932F51E9F22E937D` |
| `infrastructure/landing-zone/g2-builder/main.bicep` | `5AFDC3866DCB336C2E1E6DE474040E5D185E3549C14AD2C54CC369FC9685A3D0` |
| `infrastructure/landing-zone/g2-builder/builder.bicep` | `F0C03AC3D3AE23A0754DC0AF8D11C49E8AF020664C4FCC433F17D0A61B89E3D5` |
| `infrastructure/landing-zone/g2-builder/tests/dns-retry-contract.tests.ps1` | `7068253ED57A5F497C2679C6BDD16D6D1BBD8E6EA737AB6728B88F80182D7C40` |
| `infrastructure/landing-zone/g2-builder/tests/negative-contract.tests.ps1` | `0AF5807CCE708F65CF0BE3662FC1ACA6886947F15EA087D3E754ED4CA5C073D9` |
| `infrastructure/landing-zone/g2-builder/main.json` | `7489E5E80C3E4B92BBB2BF44A3D3A188AF94846E12DAED10226D661BAFB90562` |
| `infrastructure/landing-zone/g2-builder/parameters.preview.json` | `DB603F950696BA17485D166BADDBE31820DF79974ED5CC0C74EAE79F09630EDD` |
| `.azure/evidence/G2_STAGE1_RETRY_PARAMETERS.json` | `AAE183E5D7F7A1BFCC530A5D271479682780DBC14D5DF41C860E39ED30668DB2` |

The synthetic source archive authority remains separate. No discovery or IaC
changes are represented as part of that archive.

## References

- [ARM deployment modes](https://learn.microsoft.com/azure/azure-resource-manager/templates/deployment-modes)
- [ACR resource schema, API 2025-11-01](https://learn.microsoft.com/azure/templates/microsoft.containerregistry/2025-11-01/registries)
- [ACR customer-managed keys](https://learn.microsoft.com/azure/container-registry/container-registry-customer-managed-keys)
- [Public IP resource schema, API 2024-05-01](https://learn.microsoft.com/azure/templates/microsoft.network/2024-05-01/publicipaddresses)
