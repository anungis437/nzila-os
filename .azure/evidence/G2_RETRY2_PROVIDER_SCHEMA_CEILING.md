# G2 Retry 2 provider schema ceiling

Mission: `NZ-20261008-INFRA-001`  
Slice: `G2_RETRY2_PROVIDER_SCHEMA_CEILING`

`NIC_PROVIDER_SCHEMA_DEFECT_EVIDENCE = CONFIRMED`  
`PRIVATE_ENDPOINT_PROVIDER_SCHEMA_DEFECT_EVIDENCE = CONFIRMED`  
`NETWORK_RP_SCHEMA_RESPONSE_MISMATCH = ACCEPTED_EXACT_PATHS_ONLY`

## Provider evidence and authority boundary

[Azure/bicep-types-az issue 1524](https://github.com/Azure/bicep-types-az/issues/1524)
reports missing NIC kind/allowPort25Out type properties. Its discussion describes
non-idempotent what-if behavior and an April 2026 report against API 2025-05-01.
[Azure/azure-rest-api-specs issue 31315](https://github.com/Azure/azure-rest-api-specs/issues/31315)
reports extra Private Endpoint GET fields, including
isIPv6EnabledPrivateEndpoint=false, and explicitly identifies Bicep what-if
differences. Both issues were open at capture.

These are reports in provider-maintained repositories, correlated with local
exact-version schemas and controls. They are not a documented writable PUT
contract or proof that arbitrary omitted fields are safe. The active human
authorization accepts this exact source ceiling instead of unsupported IaC.
Raw issues/comments and content hashes are preserved in
[the issue snapshot](./G2_RETRY2_PROVIDER_SCHEMA_ISSUES.json).

## Exact ceiling, no sibling or wildcard waiver

| Resource | API | Path | Exact live | Desired |
|---|---|---|---|---|
| nzila-g2-builder-nic-y3koaeijzi6mu | 2024-05-01 | kind | Regular | OMITTED |
| nzila-g2-builder-nic-y3koaeijzi6mu | 2024-05-01 | properties.allowPort25Out | false | OMITTED |
| nzila-g2-acr-pe-y3koaeijzi6mu | 2024-05-01 | properties.isIPv6EnabledPrivateEndpoint | false | OMITTED |

Each is classified
`PROVIDER_SCHEMA_RESPONSE_MISMATCH_NO_DECLARATIVE_ACTION`, with schema class
`PROVIDER_RESPONSE_FIELD_ABSENT_FROM_DECLARATIVE_SCHEMA`.
The expected provider delta is Delete of the response field, with null after.
Any resource/path/value/type mismatch invalidates the ceiling.

[Machine-readable ceiling](./G2_RETRY2_PROVIDER_SCHEMA_CEILING.json) contains
full resource IDs, dates, issue references, exact controls, fresh live GETs,
inventory and unchanged source authority. NIC-A documented-live control still
reports these two omissions. PE explicit false gives NoChange; ordinary
omission gives the exact Modify. Neither field is inserted into Bicep.

## Preserved platform contract

Branch/HEAD remain g2/synthetic-health-source /
7bec20aad11d43eeae8099c14e021b3074154b27. Fresh inventory equals the twelve-resource
baseline, with no VM/firewall or prior Retry 2 deployment. NIC subnet unchanged,
allocation Dynamic, private IP 10.90.1.4 unpinned, no public IP. Private endpoint
subnet/registry relationship unchanged. No inbound administration or IPv6
capability is introduced. Private DNS declarative state stays identical.

The proven NIC scalar and VNet Disabled policy preservation, management /26,
dedicated firewall management IP, Basic SKU and public-key-only VM provisioning
remain intact. Source/template/parameters/public-key hashes match
[the existing corrected authority](./G2_RETRY2_NETWORK_RP_AUTHORITY.json).
No source change is made for ceiling acceptance.

## Execution gate

Ceiling adjudication:
`NETWORK_RP_PUT_SEMANTICS_CLOSED_WITH_PROVIDER_SCHEMA_CEILING`.
Deployment still requires fresh local checks, provider validation, raw what-if,
exact tolerated-leaf manifest and final live/source recheck. The adjudication
record itself does not consume Retry 2.

Fresh local tests and provider validation passed (correlation
ba4aa194-2a57-43b7-83bd-f83cf2145126). A new raw execution what-if was captured:
three Create, seven Modify, eight NoChange, one Ignore, zero Delete/Unsupported.
Its SHA-256 is 82F0476CF139DDB4AC7A147F3028EBDD69AF0F1EEB17C0DB0F0CC118D5C1BCD6.
Every exact delta matches the prior per-path proof or the three new ceiling
tuples; no unresolved/unrelated path remains. See
[the exact categorized manifest](./G2_RETRY2_FINAL_TOLERATED_WHATIF_MODIFIES.json)
and [execution gate](./G2_RETRY2_WHATIF_EXECUTION_GATE.json).

`CURRENT_PARTIAL_ESTATE_WHATIF=PASS`; `RETRY2_DEPLOYMENT_AUTHORIZED=YES`.
This is the pre-deployment snapshot; later deployment/runtime evidence owns
execution status.

## Subsequent single execution and runtime outcome

The authorized deployment `g2-stage1-retry2-20261010-180236` succeeded,
correlation `4bd2f1d8-e66a-41e0-acdc-4968c8e1b039`. Retry 2 authority is
consumed. Sixteen resources remain, including all twelve retained resources.
The exact source ceiling did not require any undocumented Bicep field.

Stage 1 is `STAGE1_DISCOVERY_PARTIAL`; overall G2 remains `FAIL`.
Private ACR DNS/HTTPS and token exchange passed, but APT observation, required
identity metadata assertion and literal boot start/result markers did not.
See [execution report](./G2_RETRY2_EXECUTION_REPORT.md) and
[authoritative final disposition](./G2_RETRY2_FINAL_DISPOSITION.json).
No further retry, cleanup or Stage 2 is authorized.
