# G3 final readiness blocker closure

Mission: `NZ-20261008-INFRA-001`.

`G3_EXECUTION_READINESS = BLOCKED`.

This packet completes local witness qualification and records governed design
dispositions. It is not a G3A/G3B execution authorization or a production claim.
All previous packets remain byte-preserved, including their historical failures.
The authoritative machine output is [FINAL_READINESS_DISPOSITION.json](./FINAL_READINESS_DISPOSITION.json).

## Remaining blockers only

1. **Executor and secret-bootstrap binding.** The reviewed staging application
   and service principal have no registered Entra owners. Their federation is
   already bound to the repository's `staging` environment, and existing product
   workflows use it for staging deployments. Existing grants include product
   staging resources, not the G3 transaction/delegation contract. This is not
   proof the principal is malicious or generally unusable. It is insufficient
   evidence to commandeer its lifecycle for this isolated synthetic lane.
   `G3_EXECUTOR_IDENTITY = NONE`; deployment, exact grant execution, private
   secret author and revocation accountability remain unbound. Evidence:
   [SP owners](./EXECUTOR_SP_OWNERS.json), [app owners](./EXECUTOR_APP_OWNERS.json),
   [sealed role/federation census](../g3-live-readiness/LIVE_ACCOUNT_ASSESSMENT.json),
   [staging proof workflow](../../.github/workflows/br5-proof-deploy-staging.yml)
   and [staging deployment workflow](../../.github/workflows/deploy-staging.yml).

2. **Executable private-runner transaction delivery.** Select a new transient
   G3-owned builder, not implicit reuse of G2. However, source, the pinned compiler,
   tooling and OCI artifact have no bound end-to-end delivery channel to that
   private VM. The qualified OCI archive alone exceeds the documented 256 KiB
   Custom Script Extension inline parameter ceiling. Cloud-init's smaller limit
   is not a solution. CSE `fileUris` with managed identity is a legitimate
   alternative, but requires a private transfer store and an authorized,
   connected producer; no such input store/caller is currently bound. A public
   blob/SAS, Docker Hub egress, unstated G2 tooling grant, oversized inline
   payload or unexplained ARM chunk tunnel is not substituted.
   The exact VM image, extension/platform dependencies and authenticated private
   probe/secret-bootstrap channel also remain unwired. Thus G3A/G3B controllers
   and top-level packages are **INCOMPLETE**, not locally compiled success stubs.
   The two [split phase templates](./bicep/) and tested
   [offline guards](./transaction_guards.py) are useful partial components, not
   complete controllers. The negative requests are fixed in the machine packet,
   but their private pull-identity caller and public observer are not executable.
   Evidence: [reference excerpts](./PUBLIC_REFERENCE_PROVENANCE.json),
   [qualification](./local-image-frozen/LOCAL_IMAGE_QUALIFICATION.json).

3. **All-in proof cost and ceiling.** The two-hour G3A/four-hour G3B component
   scenario is explicit, but unbound delivery/probe resources and traffic,
   final endpoint hours and Standard Key Vault secret-operation billing mapping
   prevent an all-in CAD estimate. No Premium SKU substitution or partial
   compute sum is presented as the total. The [cost model](./COST_MODEL.json)
   includes billed provider-managed LB and public egress IP even for an internal
   ACA environment; Option C has no incremental firewall charge. The retained
   image-only storage amount is a proposed billable upper bound, not measured
   Azure idle state. A future proof ceiling must cover the resolved whole
   transaction with at least 50% contingency.

## Dispositions that are no longer blockers

### Quotas

Managed identity: `PASS_DOCUMENTED_LIMIT`, not invented regional population
headroom. Official limits are 400 tenant/region and 80 subscription/region create
operations per 20 seconds; assignment limits are 400 and 300 respectively.
Managed identities consume Entra objects. A fresh directory read returned
500,000 total / 1,183 used / 498,817 available. This supports the planned two
application identities plus two candidate transient identities without claiming
guaranteed allocation or a live ManagedIdentity quota API result.
See [limits provenance](./MANAGED_IDENTITY_LIMIT_SOURCES.json) and
[directory capacity](./DIRECTORY_CAPACITY.json).

Consumption: `DEFERRED_FAIL_CLOSED`. The official environment-scoped GET is
`managedEnvironments/<name>/usages?api-version=2025-07-01`, counter
`ManagedEnvironmentConsumptionCores`, unit `Count`. Immediately after environment
creation, before any app deployment, require at least 1.0 available cores:
0.25 for the single replica and 0.75 explicit proof/revision reserve. Missing,
duplicate, invalid, incomplete or insufficient quota evidence stops the
transaction and tears down only its created environment. Do not retry or deploy
a workload. This guard is unit tested; its live invocation remains part of the
incomplete future controller, not something executed here.

### Egress

`NO_FORCED_TUNNEL`; `G3_FIREWALL_UDR_MODEL = NOT_SELECTED`;
`G3_EGRESS_INSPECTION = NOT_PROVEN`.

No G2 peering, route, firewall rule or IP reference is added. No G3 firewall, NAT,
public application ingress IP or UDR is introduced. An internal workload-profiles
environment uses provider-managed outbound infrastructure. Public platform
service tags remain broad and accepted **only for synthetic proof**.

| Class | Endpoint/tag | Port / transport | Enforcement / purpose |
|---|---|---|---|
| PLATFORM_MANDATORY | MicrosoftContainerRegistry; AzureFrontDoor.FirstParty | TCP 443 | Apps NSG; provider platform image/bootstrap dependencies |
| PLATFORM_MANDATORY | Storage.CanadaCentral | TCP 443 | Apps NSG; provider platform dependency, not synthetic data storage authorization |
| PLATFORM_MANDATORY | AzurePlatformDNS | UDP/TCP 53 | Subnet NSGs; Azure DNS |
| IDENTITY | AzureActiveDirectory; login.microsoftonline.com within that tag | TCP 443 | Apps NSG; platform identity control plane |
| IDENTITY | ACA-injected local identity endpoint | HTTP loopback | Explicit client selection, no proxy/redirect, off-host dial forbidden |
| ACR | nzilag2tzo75uuozprbo.azurecr.io and its regional data endpoint | TCP 443, private | New G3 PE/DNS; no public data-path fallback, no Docker Hub |
| KEY_VAULT | nzl-g3-test-001-kv.vault.azure.net | TCP 443, private | New G3 PE/DNS; exact versioned synthetic secret |
| TELEMETRY | AzureMonitor | TCP 443 | Apps NSG; bounded proof logs, no tokens/secrets |
| PRIVATE_PROOF | Internal app FQDN, actual returned private IP | TCP 443 | Private proof subnet + Ed25519 request authentication |
| PLATFORM_PROBES | AzureLoadBalancer / app-local platform traffic | TCP 30000-32767 / local probes | Private apps NSG and separate boolean-only endpoints |

The live tag spelling is `AzureFrontDoor.FirstParty`; documentation may spell
the alias `AzureFrontDoorFirstParty`. Private dependency access is allowed to the
G3 PE subnet, never copied G2 PE IPs. No generic Internet/AzureCloud rule is added.
This selects the application egress design; it does not qualify an unspecified
VM compiler/download or guest-execution channel.

### New runtime

The [frozen qualification](./local-image-frozen/LOCAL_IMAGE_QUALIFICATION.json)
binds a new source archive and manifest, superseding all earlier local image
contracts without deleting them. Two offline/no-cache linux/amd64 builds run
tests and vet and produce equivalent manifest/config/index/layers.
[Local smoke](./local-image-frozen/LOCAL_CONTAINER_SMOKE.json) proves non-root,
read-only/network-none/no published ports, signed health, unsigned rejection,
fail-closed readiness/proofs and graceful exit 0. It is **not Azure proof**.

Only sanitized witnesses are returned: private resolution/pinned peer, verified
TLS, selected identity claims, challenge ID/hash comparison and authorization
status. JWT claims are bound locally but JWT signatures are not independently
verified by the application; resource acceptance of the acquired token is
reported accurately. Tokens, identity headers and clear secret values are not
persisted. A generic HTTP 400 does not prove pull-identity lifecycle denial.
Forbidden-secret HTTP 403 requires `ForbiddenByRbac`; firewall/unclassified 403
and 404 remain inconclusive.

The smoke challenge is expressly local-only and was destroyed. The future target
challenge and signing key must be generated by the bound private bootstrap
process; no placeholder local challenge is promoted to the Key Vault contract.

## Future permission contract, not grants

The accountable maintainer and risk owner remain `BOUND` by the mission
authority, separately from Azure execution. Their governance role does not
identify an Azure grant executor.

* Resource deployment: a selected federated executor, Contributor
  (`b24988ac-6180-42a0-ab88-20f7382dd24c`) only at the new G3 RG, not subscription
  scope. The new RG must be provisioned/delegated by a separately bound maintainer
  operation; no subscription-wide Contributor shortcut.
* G3A writer: only the new transient build/push UAMI, Container Registry
  Repository Writer (`2a1e307c-b015-4ebd-883e-5b7698a07328`) at the existing target
  registry, ABAC condition version 2.0 with exact
  `@Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEqualsIgnoreCase 'g3-synthetic-runtime'`.
  Collision check, one push and immutable readback remain unwired.
* G3B pull: separate pull UAMI, Repository Reader
  (`b93aa761-3e63-49ed-ac28-beffa264f7ac`) with the same exact repository condition;
  app lifecycle `None`. Runtime UAMI lifecycle `Main`, no ACR rights.
* Runtime secret access: Key Vault Secrets User
  (`4633458b-17de-408a-b874-0445c86b69e6`) only at the named `substrate-proof`
  secret, not the whole vault.
* One-time secret bootstrap: prefer the selected nonpersonal federated executor
  through the private caller, temporary Key Vault Secrets Officer
  (`b86a8fe4-44ce-4948-aee5-eccb2c155cd7`) only at the newly created synthetic
  vault, revoked by exact assignment ID immediately after one versioned write.
  This built-in role is broader than a single write **within that new vault**;
  no persistent grant or product vault access is accepted.
* Role assignments and the existing ACR private connection approval require a
  **separate, named grant executor with a reviewed exact delegation contract**.
  It is not currently bound. No Owner/subscription UAA grant or fabricated
  delegation readiness is claimed. G2 steady-state principals/grants stay intact.

These are proposed exact built-in role/scoping contracts, not a complete
authorization design. The existing staging owner/delegation gap is retained
explicitly instead of laundering maintainer accountability into Azure access.

## Verification and preservation

Four ledgered Azure calls, all reads; zero Azure/registry mutations and no guest
execution. Fresh G2 resource census: 16. Exact historical root/file preservation,
new source/OCI/ELF checks, phase build/lint, five guard tests, cost arithmetic,
link and whitespace checks are bound by
[FINAL_READINESS_VERIFICATION.json](./FINAL_READINESS_VERIFICATION.json).
A separate direct-byte verifier record is
[FINAL_READINESS_INDEPENDENT_VERIFICATION.json](./FINAL_READINESS_INDEPENDENT_VERIFICATION.json).

No G3A/G3B technical execution, application rollout or production data is
authorized. UE and Cora remain `INFRA_NO_GO`. No product source, shared foreign
work or historical packet is edited, staged, committed or dispositioned.
