# G2 Retry 2 execution and Stage 1 partial discovery

Mission: `NZ-20261008-INFRA-001`  
Provider ceiling: `NETWORK_RP_PUT_SEMANTICS_CLOSED_WITH_PROVIDER_SCHEMA_CEILING`  
Pre-deployment what-if: `PASS`  
Stage 1: `STAGE1_DISCOVERY_PARTIAL`  
Overall G2: `FAIL`  
`RETRY2_AUTHORITY_CONSUMED = YES`

## Single authorized execution

Deployment `g2-stage1-retry2-20261010-180236` succeeded.
Correlation ID: `4bd2f1d8-e66a-41e0-acdc-4968c8e1b039`.
All 21 nested operations report Succeeded. No subsequent deployment, cleanup,
SSH, Run Command, package install/update, image build/push or Stage 2 occurred.

Immediate pre-create checks verified branch/HEAD, individual source hashes,
template/parameter/public-key hashes, private-key destruction evidence, tenant,
subscription, Canada Central, twelve exact resource IDs, absent VM/firewall,
fresh what-if hash and exact accepted manifest. The previously unconsumed
Retry 2 was executed once through the completed azure-validate/azure-deploy
workflow.

Evidence:
[pre-deploy checks](./G2_RETRY2_PREDEPLOY_VERIFICATION.json),
[deployment result](./G2_RETRY2_DEPLOYMENT_RESULT.json),
[subscription operations](./G2_RETRY2_DEPLOYMENT_SUB_OPERATIONS.json),
[nested operations](./G2_RETRY2_DEPLOYMENT_GROUP_OPERATIONS.json).

## Estate convergence

The estate now contains sixteen resources: all twelve original resources,
plus builder VM, Basic firewall, management public IP and VM-managed OS disk.
The disk is part of the approved VM provisioning contract, not an extra
top-level what-if Create.

- VM provisioning succeeded and guest agent is Ready; VM has no public IP.
- Password authentication remains disabled with exactly one provisioning key.
- NIC stays Dynamic IPv4 at `10.90.1.4`; no inbound Allow rule was introduced.
- Firewall is Basic with correct distinct data/management subnets and public IPs.
- Management subnet is `10.90.0.64/26`; management IP is Standard/Regional,
  Static, Canada Central, attached exclusively to firewall management.
- VNet policy Disabled, existing named subnet CIDRs, data-plane public IP,
  private ACR posture and repository-conditioned principal/role contracts
  remain preserved.
- PE IPv6 response flag remains false; no IPv6 capability was enabled.

[Final disposition](./G2_RETRY2_FINAL_DISPOSITION.json) stores exact final IDs,
post-control state, operation counts and all runtime requirements.
[Retained-state snapshot](./G2_RETRY2_POSTDEPLOY_RETAINED_STATE.json) and
[firewall state](./G2_RETRY2_FIREWALL_STATE.json) contain the underlying reads.

## Boot and runtime discovery

Boot Diagnostics retrieval succeeds; instance view and serial show cloud-init
completed. A complete token-free `NZILA_G2_STAGE1_DISCOVERY_V1` JSON record was
recovered and reports `DISCOVERY_INCOMPLETE`.

The CLI returns serial output as a JSON string, and direct serial output
interleaves with cloud-init stdout on one line. Earlier capture snapshots
mistakenly found no complete object; they are preserved as chronology.
[Verified runtime evidence](./G2_RETRY2_RUNTIME_DISCOVERY_VERIFIED.json)
supersedes their interpretation by decoding the wrapper and checking every
discovery-object start. No raw serial log or token body was persisted.

| Required proof | Result | Evidence |
|---|---|---|
| BOOT_DIAGNOSTICS_PROOF | FAIL | Retrieval succeeds and V1 record exists, but required start/result strings are absent |
| IMDS_IDENTITY_PROOF | FAIL | IMDS metadata/token HTTP 200; metadata returns tenantId only, targetClientIdPresent=false |
| PRIVATE_ACR_NETWORK_PROOF | PASS | Private DNS 10.90.2.5; TCP 443; HTTPS /v2/ returns 401 |
| ACR_TOKEN_EXCHANGE_PROOF | PASS | Private exchange and repository-token HTTP 200; token values not emitted; no push |
| APT source observation | FAIL | Entries observed but 35 unparsed-deb822-line errors; complete=false |

`OBSERVED_APT_ENDPOINTS = ["http://azure.archive.ubuntu.com/ubuntu/"]`

The observed endpoint is not an approved package-egress allowlist. No APT
repository contact, update or installation was initiated by discovery.

Required literal `NZILA_G2_DISCOVERY_STARTED` and
`NZILA_G2_DISCOVERY_RESULT=` are absent from runtime serial. The unchanged
approved discovery source emits the V1 JSON marker instead; no marker/source
rewrite was made under provider-schema-ceiling authority.

Token exchange success demonstrates working managed-identity authentication,
but it does not override the required identity metadata assertion or fabricate
overall discovery success. APT parser root cause and identity proof-contract
remediation have not been established from permitted serial evidence alone.

## Stop

The provisioning corrections and exact schema ceiling converged successfully.
The Stage 1 runtime proof did not fully pass, so only
`STAGE1_DISCOVERY_PARTIAL` is asserted. Overall G2 remains `FAIL`.

Retry 2 is consumed. No third attempt, cleanup, product deployment or Stage 2
is authorized. Preserve the sixteen-resource estate and all prior evidence.
Any discovery/source remediation or further execution requires new bounded
authority.
