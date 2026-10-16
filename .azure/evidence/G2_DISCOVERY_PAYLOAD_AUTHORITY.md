# G2 Discovery Payload Authority

**Mission:** `NZ-20261008-INFRA-001`  
**Gate:** `G2_PRIVATE_CONTROL_PLANE`  
**Slice:** `G2_DISCOVERY_PAYLOAD_AUTHORITY`  
**Disposition:** `DISCOVERY_PAYLOAD_AUTHORIZED`  
**Azure provider validation:** PASS.  
**Structured what-if:** Captured; retry gate FAIL because four retained resources report `Modify`.  
**Stage 1 deployment:** Not executed.

## Concurrency and source baseline

- Branch: `g2/synthetic-health-source`
- HEAD: `7bec20aad11d43eeae8099c14e021b3074154b27`
- Synthetic archive SHA-256: `DF81CAE6D23555FC43AD1D96EF38CBA0BA67FB06D551A5183168FF151AD2528E`
- Worktree baseline before edits: only the pre-existing untracked `.azure/` and `infrastructure/landing-zone/g2-builder/` payloads; no foreign tracked changes were observed in this worktree.
- The synthetic source archive does not contain the infrastructure or discovery changes.
- Historical Stage 1, NSG canary, failure, and retry evidence was not modified.

## Three-change semantic adjudication

| Change | Historical behavior | Authorized/current behavior | Runtime, network, identity, mutation and sensitivity assessment | Required for Stage 1 proof | Decision |
|---|---|---|---|---|---|
| APT testability | `read_apt_sources()` read the production APT source paths directly and had no injectable path list. | Optional `source_paths` injection is used by tests; when omitted in production, the same source-list and deb822 paths are read and normalized. | File reads only; no APT command, package mutation, repository contact, inferred endpoint, or egress change. URI credentials and query values are redacted. No Azure mutation or credential output. | Offline observation is required; test injection is safe and preserves production behavior. `APT_DISCOVERY_OBSERVATION_ONLY=true`. | `ACCEPT` |
| IMDS audience | Requested `https://management.azure.com/` while the returned AAD access token was sent to ACR `/oauth2/exchange`. | Requests `https://containerregistry.azure.net/` from IMDS, with the selected builder `client_id` and Metadata header. | This is the ACR audience, not an ARM token. The AAD access token is exchanged at the registry endpoint for an ACR refresh token, then optionally exchanged for a repository-scoped ACR access token. No token body is logged or serialized; no image push occurs. | Correct ACR identity authentication evidence is required; token acquisition is independently checked. | `ACCEPT` |
| Discovery completion requirements | Completion checks included `aptConfiguration`, IMDS metadata/target identity, registry DNS/TCP and required successful repository-scoped token issuance. Results did not report a status per component. | Explicit `PASS`/`FAIL`/`BLOCKED`/`NOT_RUN` component states; requires image metadata, APT observation, IMDS identity and ACR-audience token, private DNS, HTTPS response and successful serial write for `STAGE1_DISCOVERY_PROVEN`. ACR token exchange is reported separately and is not a required check; transport inability can be `BLOCKED`, prerequisites can be `NOT_RUN`. Python-unavailable fallback remains `DISCOVERY_INCOMPLETE` with components `NOT_RUN`. | The current pre-adjudication rule incorrectly made the optional ACR exchange mandatory; it was revised. Registry proof now performs HTTPS `/v2/` reachability, accepting the expected unauthenticated `401` challenge, not just TCP connect. No broad catch, token output, package action, image push, or Azure mutation was introduced. | Required proof components fail closed; optional exchange cannot fabricate either success or a required-check failure. | `REVISE` (revision implemented and tested) |

The repository payload was untracked at the authorized source HEAD, so a historical commit/change-request rationale for these edits is not recoverable. The purposes above describe the requested testability, correct ACR audience, and the revised proof contract; they are not claims about undocumented authorship.

## ACR authentication authority

`IMDS_REQUESTED_RESOURCE=https://containerregistry.azure.net/`

Ordered protocol:

1. `GET http://169.254.169.254/metadata/identity/oauth2/token` with `api-version=2018-02-01`, `resource=https://containerregistry.azure.net/`, the builder UAMI client ID, and `Metadata: true` → Microsoft Entra AAD access token.
2. `POST https://<registry-login-server>/oauth2/exchange` with `grant_type=access_token`, registry `service`, tenant, and AAD access token → ACR refresh token.
3. `POST https://<registry-login-server>/oauth2/token` with `grant_type=refresh_token`, registry `service`, repository scope, and ACR refresh token → repository-scoped ACR access token.
4. No Docker login, image push, or token-body persistence is performed by Stage 1 discovery.

The IMDS token resource is distinct from the ACR refresh token and repository-scoped token. Microsoft’s VM managed-identity guidance defines requesting a token for a target resource through IMDS; the ACR Data Plane REST reference identifies the `.default` OAuth scope as `https://containerregistry.azure.net/.default` and documents `/oauth2/exchange`; the ACR OAuth protocol reference documents the exchange and subsequent `/oauth2/token` steps:

- [Microsoft Learn: VM managed-identity token acquisition](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-use-vm-token)
- [Microsoft Learn: ACR managed-identity authentication](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-authentication-managed-identity)
- [Microsoft Learn: ACR Data Plane exchange AAD access token for ACR refresh token](https://learn.microsoft.com/en-us/rest/api/registry-dataplane/authentication/exchange-aad-access-token-for-acr-refresh-token?view=rest-registry-dataplane-2021-07-01)
- [Azure Container Registry: AAD OAuth protocol](https://azure.github.io/acr/AAD-OAuth.html)

## Sensitive-output contract

Discovery emits statuses, safe expiry metadata where present, requested resource, identity identifiers, private DNS addresses, HTTPS status, and normalized/redacted APT observations. It does not emit AAD access tokens, ACR refresh tokens, repository access tokens, Authorization headers, passwords, registry credentials, cloud-init secrets, or IMDS response bodies. Tests reject sensitive token-like keys and assert that representative token values do not occur in serialized results. APT source observation is offline and read-only.

## Content-addressed authority manifest

The authorized compiled candidate is `infrastructure/landing-zone/g2-builder/main.json`.

| Reviewed input | SHA-256 |
|---|---|
| `infrastructure/landing-zone/g2-builder/discovery.py` | `C9A12D5CE1BC92C3ED19610DB62A23B2E3090B5760E104785731D9206CDACFAB` |
| `infrastructure/landing-zone/g2-builder/tests/test_discovery.py` | `559A4619F9239011EF5F52DAE131FFEBBF2D2C2540B422F96571B412E72A717D` |
| `infrastructure/landing-zone/g2-builder/cloud-init.yaml` | `98BF84B5D3AF6D10B1BC617A61D5A5E237AB7F487AE1A63E932F51E9F22E937D` |
| `infrastructure/landing-zone/g2-builder/main.bicep` | `5AFDC3866DCB336C2E1E6DE474040E5D185E3549C14AD2C54CC369FC9685A3D0` |
| `infrastructure/landing-zone/g2-builder/builder.bicep` | `4A5380BC6F88D089A0C39D52CD97C7C517658485250951362AE992983F6B2518` |
| `infrastructure/landing-zone/g2-builder/tests/dns-retry-contract.tests.ps1` | `9D7AEE0E336E200F5D336B77F880E71E9E4C72AC1240D3E332C416BA290BA9E5` |
| `infrastructure/landing-zone/g2-builder/tests/negative-contract.tests.ps1` | `0AF5807CCE708F65CF0BE3662FC1ACA6886947F15EA087D3E754ED4CA5C073D9` |
| `infrastructure/landing-zone/g2-builder/main.json` (compiled template) | `93E8754B0857A444534FA30586F6D8B8A931BAE502DD7DD84319E85D77C56FE2` |
| `infrastructure/landing-zone/g2-builder/parameters.preview.json` | `DB603F950696BA17485D166BADDBE31820DF79974ED5CC0C74EAE79F09630EDD` |
| `.azure/evidence/G2_STAGE1_RETRY_PARAMETERS.json` (execution parameters) | `AAE183E5D7F7A1BFCC530A5D271479682780DBC14D5DF41C860E39ED30668DB2` |

`CURRENT_TEMPLATE_SHA256 == AUTHORIZED_TEMPLATE_SHA256` and `CURRENT_DISCOVERY_SHA256 == AUTHORIZED_DISCOVERY_SHA256` at record creation. Any byte change to either invalidates this authorization and requires re-adjudication. The old retry template/provenance files remain historical and unchanged.

## Required local validation

All commands passed against the authorized worktree:

| Command | Result |
|---|---|
| `python -m unittest discover -s tests -p 'test_discovery.py' -v` | PASS — 9 tests |
| `az bicep build --file main.bicep --outfile main.json` | PASS |
| `az bicep lint --file main.bicep` | PASS |
| `pwsh -NoProfile -File tests\dns-retry-contract.tests.ps1 -TemplatePath (Resolve-Path main.json)` | PASS — exact runtime-proven five-rule NSG; no `AllowPlatformDns`; negative mutations rejected |
| `pwsh -NoProfile -File tests\negative-contract.tests.ps1 -BuilderDirectory (Get-Location).Path` | PASS — base contract and all negative mutations |
| `git diff --check` | PASS |

The tests cover offline APT observation/no package or network operations, exact IMDS resource, OAuth request construction and token redaction, optional exchange `BLOCKED`, required-check/serial fail-closed behavior, deterministic success output, and the Python-unavailable fallback.

## Azure validation and exact retry gate

Read-only validation was run on 2026-10-10 against subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3`, region `canadacentral`, and the existing proof resource group `nzila-g2-proof-xre47vggs5uhw`. The fresh baseline showed the expected six retained resources, no NSGs, `Microsoft.Network` registered, and the subscription-level `SecurityCenterBuiltIn` policy assignment. The branch/HEAD and all content-addressed source hashes still matched the authority manifest.

- Provider validation passed. ARM validation correlation ID: `e2210754-8b75-4b56-88de-3a4d1b341a33`.
- Full structured what-if response status: `Succeeded`.
- Raw provider-validation response: [G2_DISCOVERY_AUTHORITY_PROVIDER_VALIDATION.json](./G2_DISCOVERY_AUTHORITY_PROVIDER_VALIDATION.json), SHA-256 `BC17F9128297168F64F50C5C473DF7FDBDD7F381C5FA9497F9E1BA98E1276656`.
- Raw structured what-if: [G2_DISCOVERY_AUTHORITY_WHATIF_RAW.json](./G2_DISCOVERY_AUTHORITY_WHATIF_RAW.json), SHA-256 `C86AFD1EA64E63F1FEA82445ED1792E16F564646546541CF7271DECA9A48B0EA`.
- Authoritative structured counts: 8 `Create` (the exact eight intended resource IDs), 4 `Modify`, 0 `Delete`, 0 `Unsupported`, and 5 `NoChange`.

The four proposed modifications are all to retained resources:

1. Existing Premium ACR: removes `properties.encryption.status=disabled` and `properties.networkRuleBypassAllowedForTasks=false` from the desired payload.
2. Existing ACR writer role assignment: reports `principalId` changing from the current value to an identity-reference expression, and `principalType` from null to `ServicePrincipal`.
3. Existing ACR reader role assignment: reports the same classes of role-assignment property changes.
4. Existing egress public IP: removes `properties.ddosSettings.protectionMode=VirtualNetworkInherited` and `sku.tier=Regional` from the desired payload.

The expected Create set matches, but the authorization explicitly requires zero `Modify` and unchanged retained-resource payloads. The retry gate therefore **FAILS**. Do not execute Stage 1, repair the retained resources, or change the template under this authority; resolve the four retained-resource diffs and obtain fresh review/authorization first. Stage 1 deployment remains `NOT_EXECUTED`, and Stage 2 remains unauthorized.

The generic validation helper reported a formatted-text count of 9 Create / 7 Modify / 5 Delete despite a successful command exit. The preserved full structured JSON is authoritative and reports 8 Create / 4 Modify / 0 Delete / 5 NoChange; do not use the helper's text-count summary as the gate result. The what-if response did not expose a correlation/request ID in its structured result.

## Authority result

`APT_DISCOVERY_OBSERVATION_ONLY=true`  
`DISCOVERY_PAYLOAD_AUTHORIZED=true`  
`DISCOVERY_PAYLOAD_AUTHORIZED`
