# G3 execution readiness live account closure — BLOCKED

Mission `NZ-20261008-INFRA-001`. Account facts captured 2026-10-12T02:26:14.5725747Z. Subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3`. All Azure calls are account-show, explicit GET, or the documented non-reserving Key Vault name-availability POST. No deployment, what-if, resource mutation, RBAC changes, ACR push/import, secret access or guest execution occurred.

## Closed census facts

All eight required providers are registered; Canada Central provider metadata supports the nine checked resource types. Two existing Canada Central environments have explicit Consumption workload profiles. This proves regional/subscription visibility, not reserved capacity for a future environment.

The G3 resource group is absent. Proposed `10.91.0.0/16` does not overlap visible `10.1.0.0/16` or G2 `10.90.0.0/16`. ACA `10.91.1.0/24` is dedicated and delegated to `Microsoft.App/environments`; PE `10.91.2.0/24` and future builder `10.91.3.0/24` are distinct. Workload profiles require at least /27; this /24 has proof headroom, not a Consumption-only /23 assumption.

The registry GET using subscription-supported stable API 2025-11-01 returned `roleAssignmentMode=AbacRepositoryPermissions`. ABAC mode is now proven explicitly; the older API's absent field is not used as the conclusion. G3 repository-conditioned grants and future ACA image-pull proof still belong to the unexecuted package.

| Provider                      | Live state |
| ----------------------------- | ---------- |
| Microsoft.App                 | Registered |
| Microsoft.ContainerRegistry   | Registered |
| Microsoft.ManagedIdentity     | Registered |
| Microsoft.Network             | Registered |
| Microsoft.KeyVault            | Registered |
| Microsoft.OperationalInsights | Registered |
| Microsoft.Insights            | Registered |
| Microsoft.Authorization       | Registered |

Managed environment count: 4/20; proof requires one, with headroom 16. The new environment's Consumption cores quota is environment-scoped and not queryable before it exists. An unavailable identity usages API is not unlimited quota.

| Network quota            | Current | Limit | Proposed additional | Remaining before proof |
| ------------------------ | ------- | ----- | ------------------- | ---------------------- |
| VirtualNetworks          | 1       | 1000  | 1                   | 999                    |
| NetworkSecurityGroups    | 2       | 5000  | 1                   | 4998                   |
| RouteTables              | 1       | 600   | 1                   | 599                    |
| PrivateEndpoints         | 1       | 65536 | 1                   | 65535                  |
| NetworkInterfaces        | 6       | 65536 | 2                   | 65530                  |
| StandardSkuLoadBalancers | 2       | 1000  | 1                   | 998                    |
| PublicIPAddresses        | 2       | 20    | 0                   | 18                     |

## Surviving blockers

### G3-PRIOR-AUTHORITY-PACKAGE-MISSING

The visible workspace contains G2 templates and an older synthetic-health source, but none of the referenced seven G3 modules, G3A/G3B controllers, qualified 3,271,902-byte image source/provenance, or sealed G2 terminal-root packet.

Required: Bind read-only paths/digests for the existing frozen G3 readiness/source/controller/module packet and sealed G2 terminal record. Do not rebuild another artifact and claim the supplied digest.

### G3-CAPACITY-LIMITS-NOT-PREPROVEN

Regional managed-environment quota and network quotas have headroom. The new environment consumption-core limit is environment-scoped and cannot be read for an environment that does not exist. Microsoft.ManagedIdentity regional usages is not an exposed resource type at the attempted API.

Required: An accepted pre-execution capacity assurance path for 0.25 Consumption vCPU and two UAMIs; record documented limits/support/capacity evidence rather than treating inventory count or missing API as unlimited quota.

### G3-OPERATOR-GRANTS-AND-ACCOUNTABILITY-UNBOUND

Existing GitHub-federated build/staging principals are visible, but their grants target legacy resources. No G3 scope grants were returned. Subscription-wide Contributors are unsuitable shortcuts. Nonpersonal lifecycle ownership and the accountable G3 human governance approver are not bound by this packet.

Required: Select an appropriate existing nonpersonal operator with its lifecycle owner and separate human approver; approve exact future G3A/G3B scoped grants. No grants created here.

### G3-FIREWALL-TRANSIT-AND-DNS-UNBOUND

The retained G2 firewall is Basic at 10.90.0.4; the returned application/network rule collections are empty and no G2 VNet peerings exist. A G3 VNet 10.91.0.0/16 route to that private firewall is not currently reachable. Private ACR DNS/link/transit and exact ACA platform/telemetry egress are not wired.

Required: Bind a governed routing/peering/DNS/allowlist design and reconcile any future changes to retained G2 against its sealed terminal authority;no associations or rules changed now.

### G3-CONTROLLERS-BICEP-AND-PROOF-MECHANICS-INCOMPLETE

The supplied qualified image cannot be inspected locally from its authority packet. Existing visible G2 health code has only two health routes and no secret challenge. No G3 top-level transaction/controllers are available to compile or to prove ownership, one bounded push, negative authorization, rollback and retained-state reconciliation.

Required: Complete the existing G3A/G3B package from its recovered source authority, including the private builder, artifact-preserving secret proof, repository-conditioned pull/write bindings, lifecycle None/Main, secret-scoped runtime role, and negative probes. Do not execute it.

### G3-COST-TOTAL-AND-HUMAN-CEILING-UNRESOLVED

Current CAD compute/network/DNS/logging meters are captured. Exact applicable normal-vault secret-operation and nonreplicated ACR excess-storage meter mappings are not finalized; builder selection, proof durations/log/traffic budgets and platform-managed egress-IP billing treatment are unbound. No acceptable hard cost ceiling was supplied by the human risk owner.

Required: Finalize all material incremental quantities/meters and complete proof/idle totals; propose at least 1.5x contingency for explicit human approval. Do not count existing G2 firewall base cost or ACA Private Endpoint charges.

## Candidate names and authority ceiling

These deterministic candidates are local planning metadata, not reservations or deployment permission. No subscription name matches were returned; the documented non-reserving Key Vault name check returned `nameAvailable=true`. Future execution must recheck collisions.

| Resource              | Candidate                       |
| --------------------- | ------------------------------- |
| resourceGroup         | nzila-shared-test-g3-001-rg     |
| environment           | nzila-g3-env-95086e2f           |
| application           | nzila-g3-proof-95086e2f         |
| pullIdentity          | nzila-g3-pull-95086e2f          |
| runtimeIdentity       | nzila-g3-runtime-95086e2f       |
| keyVault              | nzg3kv95086e2f                  |
| vnet                  | nzila-g3-vnet-95086e2f          |
| acaSubnet             | G3ContainerAppsSubnet           |
| privateEndpointSubnet | G3PrivateEndpointSubnet         |
| builderSubnet         | G3BuilderSubnet                 |
| nsg                   | nzila-g3-aca-nsg-95086e2f       |
| routeTable            | nzila-g3-aca-rt-95086e2f        |
| keyVaultEndpoint      | nzila-g3-kv-pe-95086e2f         |
| keyVaultDnsZone       | privatelink.vaultcore.azure.net |
| keyVaultDnsLink       | nzila-g3-kv-link-95086e2f       |
| workspace             | nzila-g3-logs-95086e2f          |

The exact prior G3 source/image authority is not present. The supplied image freeze is preserved:

- Repository: `g3-synthetic-runtime`
- Tag: `g3-2f0866acebb61f7aaa7216c2b8e952b934f04b835e93f49178d884a71040c1ad`
- Manifest: `sha256:1a6085926ff5fd78cc81bb2fb6df8ceb9bc62660e3222bbe088e47807a91bb61`
- Platform: `linux/amd64`; blob size: 3,271,902 bytes.

TARGET_REGISTRY_IMAGE_PRESENT=NOT_PROVEN. Existing G2 health source is not substituted for the qualified G3 image.

## Accepted platform egress and private topology

G3_PLATFORM_EGRESS_BREADTH=ACCEPTED_FOR_SYNTHETIC_PROOF.
G3_SERVICE_TAG_EGRESS_LIMITATION=ACCEPTED_AND_DOCUMENTED.
Exact categories, FQDNs, service tags and DNS `168.63.129.16:53` are in [the JSON report](./G3_EXECUTION_READINESS.json). Use the documented tag `AzureFrontDoorFirstParty`, not the dotted spelling. Docker Hub runtime egress is prohibited.
Acceptance is only for documented Microsoft platform dependencies, not arbitrary Internet, tenant-exclusive isolation, exfiltration-proofing or production certification. Existing firewall rule collections are empty, no peering exists, and no new rules/routes/associations were made.

G3_ACA_PRIVATE_ENDPOINT=NOT_REQUIRED. INTERNAL_ENVIRONMENT != PUBLIC_ENVIRONMENT_WITH_PRIVATE_ENDPOINT. No ACA Private Endpoint or associated Dedicated Plan Management charge is included. Key Vault Private Endpoint/private DNS remains required.

## Future identity and proof contracts

Separate pull UAMI: Container Registry Repository Reader (condition v2, exact `g3-synthetic-runtime`), lifecycle None, no AcrPull fallback. ACA_ABAC_IMAGE_PULL=MUST_PROVE, not already proven compatible.

Separate runtime UAMI: lifecycle Main, no ACR/build roles, secret-scoped Key Vault Secrets User. Microsoft supports individual-secret RBAC scope; vault-level scope is not forced. A narrower getSecret-only custom role remains a governed option, not a created role.

One synthetic secret `g3-proof-secret` is planned in a new Canada Central RBAC/private Key Vault. No secret value was collected or persisted. The purge-protection decision and image-supported challenge remain unbound.

Future private path: runtime -> private DNS -> Key Vault PE -> TLS -> identity authorization. Incorrect-reference 404 is not denial proof; a wrong identity accessing an existing protected secret must produce authorization 403. ACR negative fixtures must exist and connectivity must be proven so timeout/404 is not counted as RBAC denial. Unexpected successful negative writes require containment/cleanup. No probes were executed.

## CAD meters and unresolved totals

Current public CAD primary meters, paginated responses and GET ledger are persisted. No free-grant assumption is made. The existing G2 firewall base is excluded; Basic traffic at 0.092076 CAD/GB remains incremental.

| Component                 | Meter                                         | Region        | CAD rate | Billing unit |
| ------------------------- | --------------------------------------------- | ------------- | -------- | ------------ |
| activeCpu                 | Standard vCPU Active Usage                    | canadacentral | 0.000048 | 1 Second     |
| activeMemory              | Standard Memory Active Usage                  | canadacentral | 0.000006 | 1 GiB Second |
| requests                  | Standard Requests                             | canadacentral | 0.56662  | 1M           |
| logIngestion              | Analytics Logs Data Ingestion                 | canadacentral | 3.909678 | 1 GB         |
| vaultPrivateEndpoint      | Standard Private Endpoint                     | Global        | 0.014166 | 1 Hour       |
| privateEndpointData       | Standard Data Processed - Ingress             | Global        | 0.014166 | 1 GB         |
| privateDnsZone            | Private Zone                                  | Global meter  | 0.708275 | 1            |
| privateDnsQueries         | Private Queries                               | Global meter  | 0.56662  | 1M           |
| loadBalancer              | Standard Included LB Rules and Outbound Rules | Global        | 0.035414 | 1 Hour       |
| loadBalancerData          | Standard Data Processed                       | Global        | 0.007083 | 1 GB         |
| firewallData              | Basic Data Processed                          | Global        | 0.092076 | 1 GB         |
| potentialPlatformEgressIp | Standard IPv4 Static Public IP                | Global        | 0.007083 | 1 Hour       |
| unselectedBuilderCpu      | B1s                                           | canadacentral | 0.016432 | 1 Hour       |
| unselectedBuilderDisk     | E4 LRS Disk                                   | canadacentral | 3.739692 | 1/Month      |

Known idle standing subtotal: 37.60995 CAD/month for 730h \* (one Key Vault PE + one Standard LB <=5 rules) + two private DNS zones. **Not the candidate idle total.** Scale-zero ACA compute contributes zero under that assumption; logs, operations, traffic, storage and potential managed egress IP remain unresolved.

The two-zone term assumes two newly billed zones only. Reusing the retained G2 ACR private DNS zone does not incur another zone base charge. The selected DNS reuse/topology decision remains unbound.

Potential documented managed egress IPv4 adds 5.17059 CAD/month if triggered. A user-managed G3 public IP is not selected; platform-managed charges must not be silently zeroed.

G3_PROOF_COST_CEILING_CAD=UNRESOLVED; G3_CANDIDATE_IDLE_MONTHLY_COST_CAD=UNRESOLVED. Builder B1s/E4 rates are examples only, not selected or qualified G3A substrate. Contingency >=1.5x requires a complete model and explicit human ceiling approval.

## Ledger and preservation

71 attempted Azure calls: 64 successful / 7 failed. Full commands/status/digests are in [Azure read ledger](./azure-read-only-ledger.json); public pricing GETs are in [pricing read ledger](./public-pricing-read-ledger.json). Failed CLI transport and unsupported usages URLs are retained as failures, not silent defaults. One historical failed response has a retention limitation; successful corrected GET snapshots corroborate current facts. No credentials/secret values were queried; the human approver remains unbound rather than storing personal IDs.

Current fact aliases, Graph page aggregates and primary pricing summaries are checked against retained raw response hashes/data. All successful Azure responses must be retained. Historical failed-response loss is explicit, not presented as successful evidence.

Local G2 source files are unchanged; hashes are recorded. The accepted G2 PASS is not reopened. Its sealed terminal root cannot be byte-compared without the missing packet, so G2_TERMINAL_ROOT_UNCHANGED is not falsely asserted as proven. No G2 authority was reused and no Azure G2 mutation occurred.

G3A_BICEP_LOCAL_BUILD=FAIL and G3B_BICEP_LOCAL_BUILD=FAIL mean no passing build evidence is available. Both build attempts are NOT_RUN_FROZEN_PACKAGE_NOT_AVAILABLE, not observed compiler failures.

## Local validation

Exact commands and results are recorded in `localValidation` in [the JSON report](./G3_EXECUTION_READINESS.json). Offline Node regressions: 75 passed. PowerShell AST/negative-policy tests: 15 rejected commands/stages, with zero Azure calls or ledger changes. JavaScript syntax, scoped Prettier, deterministic generation and documentation validation passed.

Scoped ESLint could not run because ESLint 9 found no root `eslint.config.*`; this is recorded as FAILED_CONFIGURATION_NOT_FOUND, not a lint pass. No new tooling or configuration was added to mask it. These checks do not certify the missing executable G3A/G3B package.

## Terminal state

G3_EXECUTION_READINESS=BLOCKED;G3_PRIVATE_APPLICATION_SUBSTRATE=NOT_EXECUTED.
G3_TECHNICAL_EXECUTION_AUTHORIZED=NO;APPLICATION_ROLLOUT_AUTHORIZED=NO;PRODUCTION_DATA_AUTHORIZED=NO.
AZURE_MUTATIONS=0;REGISTRY_MUTATIONS=0;UE_INFRA=INFRA_NO_GO;CORA_INFRA=INFRA_NO_GO.
No G3A/G3B authority is issued. The smallest further readiness authority is read-only binding of the missing frozen package/G2 root plus local package, capacity, cost and owner/grant closure — not permission to deploy.
