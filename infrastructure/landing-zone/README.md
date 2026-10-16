# Nzila Institutional Landing Zone

Mission: NZ-20261008-INFRA-001. Gate: G1_FOUNDATION.

## Current mission disposition: closed NO-GO

Mission `NZ-20261008-INFRA-001` is **CLOSED_NO_GO_CURRENT_PROOF_ARCHITECTURE**.
The [terminal disposition](./g3-readiness-evidence/G3_TERMINAL_DISPOSITION.md)
is the current governance ruling; the G1/G2 material below remains historical
foundation evidence, not execution authorization.

Prospective G3 source, local infrastructure builds and local synthetic-image
qualification are preserved. Live Builder A qualification failed because the
existing G2 VM lacks indispensable rootless prerequisites; private ACR DNS/TCP
passed. Builder A is disqualified, Builder B is parked, and no builder is selected.
G3A/G3B are not authorized. Further G3 builder engineering requires a **new
explicit human architecture charter**. This closes the current proof path,
not the broader Nzila Azure private-control-plane strategy.

This directory is the canonical **target foundation**, not a statement that the
live estate matches it. Legacy Bicep/GitOps/product deployment paths remain the
temporary operational authority until an approved, tested migration. Nothing in
this gate changes Cora or UE from `INFRA_NO_GO`.

## LIVE_STATE_VS_IAC_DIFF

Read-only observations on 2026-10-08 in subscription
`5d819f33-d16f-429c-a3c0-5b0e94740ba3`, tenant
`5082b8be-b04d-4a13-b61c-b6397670177b`.

| Dimension | Live observation | Previous declaration | Classification / G1 resolution |
|---|---|---|---|
| Subscription | One visible subscription; prod/nonprod coexist | No authoritative subscription model | LIVE_IS_AUTHORITATIVE_TEMPORARILY: keep it, scoped boundaries; future split requires approval |
| RG topology | Canada staging/demo/pilot/prod RGs plus legacy East US RGs | Environment-wide shared services | IAC_IS_INTENDED_TARGET: product/environment data-plane RGs plus shared operations/security/edge |
| Naming | UE dedicated suffixed apps/DBs; legacy staging DB | Shared `nzila-prod-*` Bicep names | LIVE_IS_AUTHORITATIVE_TEMPORARILY: never redeploy legacy Bicep over current names; new `nzila-{product}-{environment}` foundation names |
| Regions | Canadian runtime/DB; US legacy storage/KV/VNet and two US AI accounts | Canadian GitOps; global Bicep profile uses East US | IAC_IS_INTENDED_TARGET: Canada Central primary / Canada East recovery; global profile is not an institutional target |
| Network | Only listed VNet in East US; Canadian prod env has no VNet | Shared VNet/private PostgreSQL | IAC_IS_INTENDED_TARGET: per-product/env segmented VNet; replacement env, not in-place migration |
| Front Door/WAF | UE Standard profile, custom-only WAF, single origin | Shared Premium/managed rules; no origin routes in shared WAF module | IAC_IS_INTENDED_TARGET: Premium/private origin per product; WAF/route tests G2/G3; legacy edge retained meanwhile |
| Container Apps | 21 apps, four environments; prod UE/web/partners; Cora staging only | Four default shared apps and large prod scaling | IAC_IS_INTENDED_TARGET: no Cora deployment now; managed identities and private runtime; progressive sizing |
| PostgreSQL | UE prod D2s_v3, 256 GB, zone HA, 30-day geo-backup; public, Azure-service firewall | E8/1 TB/two replicas, 35 days, private | LIVE_IS_AUTHORITATIVE_TEMPORARILY for size; IAC_IS_INTENDED_TARGET for private network/35-day retention; no automatic upscale or DB cutover |
| Storage | Prod GRS/TLS1.2/no anonymous blobs; public default Allow; staging LRS | GRS declaration, no shared storage module | IAC_IS_INTENDED_TARGET: separate product storage, private Blob endpoint, no shared-key access; GRS prod, LRS synthetic nonprod |
| Key Vault | Prod RBAC, purge protection, 90-day soft delete; public | Firewalled service endpoint; rotation comments | IAC_IS_INTENDED_TARGET: private endpoint/public disabled, per-product vault; rotation implementation G2 |
| Identities | System identities on many apps; prod web/partners none; subscription Contributors | Shared UAMI/vault-wide DB admin URL | IAC_IS_INTENDED_TARGET: workload-scoped UAMI, Entra DB role contract; inventory/removal dependencies G2 |
| Diagnostics | Prod ACA logs configured; no DB/KV/storage diagnostic settings returned | Sentinel and diagnostic declarations | IAC_IS_INTENDED_TARGET: separate operational/security workspaces and audit storage; retention verification G5 |
| GitOps | Nonprod GitOps; UE separate deploy; production digest gate; no reviewer rule returned | README claims prod GitOps/manual approvals | LIVE_IS_AUTHORITATIVE_TEMPORARILY for workflow ownership; target gated promotion, approval remediation G2 |
| DR | DB geo-backup/HA configured; no Canada East runtime in inventory | Canada East declaration; old report disabled geo-backup; RTO4h/RPO1h | IAC_IS_INTENDED_TARGET: cold Canadian recovery, RPO15m/RTO2h targets; restoration and timing G4 |
| AI | US accounts in Canadian staging RG; UE demo references US regional endpoints | No accepted restricted-data processor contract | REQUIRES_DECISION: Cora sensitive classes prohibited; no automatic account migration |
| Tags | Inconsistent/missing tags across estate | Partial environment/service/component tags | IAC_IS_INTENDED_TARGET: six required allocation/classification dimensions on all new taggable resources |

All 83 top-level inventory entries lacked each of the six canonical tag keys at
capture time. Some entries are provider-managed or not independently taggable;
their allocation must be traced through tagged parents rather than a fictitious
claim that every child can receive ARM tags. No live tags were rewritten.

## G1 selected desired state and decision boundaries

The accepted mission supplies the assurance/geography requirements. Under that
authorization, G1 selects the single migration target below: retain the current
subscription temporarily, separate product/environment data planes, Canadian
primary/cold recovery, private ingress, and no restricted Cora US-AI processing.
No separate subscription purchase, foreign processor approval or shared-service
cutover is silently authorized. Those decisions remain held closed. Live
resource names/capacity remain authoritative temporarily. Existing deployment
workflows must not use the new foundation until migration acceptance conditions
are met. This selection does not record new human risk acceptance.

### SUBSCRIPTION_AND_ENVIRONMENT_MODEL

- Retain the current subscription as a transitional administrative boundary.
  Scope build to ACR only; each deployment identity to one product/environment RG.
  Workload identity has no subscription or RG Contributor role.
- Target RGs: `nzila-{product}-{environment}-rg`; product names are `union-eyes`
  and `cora`. Shared RGs: `nzila-shared-{environment}-{edge|security|operations}-rg`.
  Production and nonproduction must never share database, vault, storage account
  or workload identity. No cross-product data permissions by shared identity.
- Canonical environments: `development`, `integration-test`, `staging`,
  `production`. Demo/pilot are legacy release profiles, not equivalent to prod;
  retain UE ownership until coordinated mapping to synthetic/test or staging.
- Development may be local. Integration/test is ephemeral synthetic data with
  bounded B-series DB and scale-to-zero; staging uses small capacity with the
  production network/identity shape. Production starts with modest two-vCore GP
  HA PostgreSQL, zero read replicas and bounded Consumption runtime. Scaling is
  explicit after measured demand. HA is assurance, not a user-count forecast.
- Shared ACR remains transitional until build/pull boundaries are verified;
  private ACR, runner connectivity and operations access are G2 migration
  prerequisites. No expensive HA production clones in ordinary nonprod.
- Separate production subscription and independently operated security
  subscription remain approval-dependent future isolation options, not G1
  provisioning. Reassess before sensitive institutional onboarding.

### TARGET_LANDING_ZONE / NETWORK_FOUNDATION

- Canada Central primary; Canada East cold recovery where each service/model
  supports it. No active/active. No Canadian-residency guarantee inferred from
  RG location or a globally scoped service.
- Per-product/environment nonoverlapping VNet: delegated ACA subnet, delegated
  PostgreSQL subnet, private-endpoint subnet. No automatic peering between
  products/environments. Explicit future ops routing; no broad lateral access.
- PostgreSQL uses delegated private networking; KV and Blob use Private Link,
  public access disabled. Product data plane has no broad Azure-service bypass.
  DNS zones link only to that product/environment VNet:
  `*.postgres.database.azure.com`, `privatelink.vaultcore.azure.net`,
  `privatelink.blob.core.windows.net` and ACA regional private-link DNS.
- Front Door Premium uses a private-link origin to the workload-profiles
  environment; ACA public network access disabled. App `external=true` means
  environment ingress, not permission to expose its public origin. No
  header-only origin protection, public-IP allowlist or empty ingress fallback.
- DNS/custom domain cutover, Front Door private-link connection approval,
  provider-region support and runner/private DNS connectivity must be proven
  before traffic migration. Existing ACA environment is replaced, never
  assumed reconfigurable in place.
- Subnets define segmentation; egress restrictions/NSG hardening/runner and
  operator connectivity require explicit G2 design/testing. This foundation
  does not claim that subnet separation alone enforces tenant isolation.

### IDENTITY_FOUNDATION

Inventory metadata only: role assignments, principal IDs/type/names,
federated subjects, credential IDs/expiry, managed identity IDs and secret
references. Never capture secret values, tokens or connection strings.

Target: one workload UAMI per product/environment app; no shared data authority.
Entra PostgreSQL authentication with separate approved admin group and
product-owned non-admin DB roles; Azure RBAC does not create PostgreSQL roles.
KV secret-reader on the product vault only where unavoidable secrets are
required, Blob Data Contributor limited to product storage, ACR Pull only.
Build identity receives ACR Push, no data or deploy permissions. Deploy identity
does not get Key Vault secret reads or permanent role-assignment permission.

### IDENTITY_REMEDIATION_PLAN

The [sanitized inventory](./live-inventory-2026-10-08.json) records 64
subscription/resource-scoped assignments, 25 assigned service-principal IDs,
21 workload configurations (19 with system identity), no listed UAMIs,
876 visible tenant service-principal catalog entries and 27 application
registrations. Only subscription-linked principal credential metadata is
exported; this is not a claim to have mapped all tenant application dependencies.

| Principal / scope | Observed dependency metadata | Remediation ownership contract |
|---|---|---|
| NATO-MEL-MIL, DiasporaCore, FinePrint / subscription Contributor | Entra-issued federated credentials; no application owners returned | Platform + named workload owner must establish responsibility and scoped contract before any removal |
| Azure-CourtLens-Production-SP / subscription Contributor | Password credential expires 2026-10-27 | CourtLens owner to prove consumer and rotation before expiry; BASTION does not retire it |
| CourtLens-GitHub-Actions / subscription Contributor | Password expires 2026-10-31 | CourtLens release owner; prove exact repo/runner and scope |
| github-actions-congowave / subscription Contributor | Password expires 2027-01-21 | Congowave release owner; scope/removal only after dependencies proven |
| nzila-os-cicd / five RG Contributors + AcrPush + Blob Contributor | Password expires 2027-02-20; no federation returned | Platform CI owner; map legacy callers before scoped OIDC replacement |
| nzila-os-deploy-prod / prod RG + AcrPull + multiple vault secret-reader assignments | OIDC `environment:production`; no password credentials returned | Platform release owner; remove vault access only after deploy dependencies proven |
| nzila-os-deploy-staging / staging RG + legacy DB Contributor + Blob roles | OIDC `environment:staging` | Platform release owner; verify legacy DB cross-RG dependency before narrowing |
| nzila-os-deploy-demo and nzila-os-deploy-pilot / respective RGs | OIDC environment subjects | UE + platform release owners; retain release-profile identity contracts |
| nzila-os-build / AcrPush | OIDC `environment:build` | Platform build owner; no data-plane/deploy role in target |
| System-assigned workload identities | IDs/assignments/secret references recorded for current apps | Product app owner; per-app UAMI only after private connectivity/token tests |
| `c2cde012-3b1a-4e94-ae0c-a2b4c619e6cd`, `e90efc42-1006-4289-9968-07490a685d54` | Role assignments exist; not found in visible Entra catalog | UNRESOLVED: Key Vault Secrets User / AcrPull respectively; do not infer orphan/removability |

No application owners were returned for the 12 subscription-linked application
principals. Target owner roles above are accountability contracts, not assertions
that those people are already assigned in Entra.

1. Map subscription-scoped principals to application owner, exact workflow,
   federated subject, runner and active credentials. Tenant catalog entries
   unrelated to this subscription are not BASTION-owned.
2. Resolve six broad subscription Contributors and legacy RG CI/CD identity
   dependencies. Use observed names, not assumptions of abandonment.
3. Compare environment-scoped deploy/build identities to declared RBAC.
   Prove denied cross-environment/product access using those identities.
4. Create parallel workload UAMIs/private resource access only under approved
   later deployment; provision Entra DB roles with product agents.
5. Migrate dependencies, exercise fallback/rollback, then retire credentials
   or excess RBAC only after explicit approval. Remove nothing in G1.
6. Review privileged human access/PIM/CA with tenant administrators in G2.

### DATA_RESIDENCY_REGISTER / AI_DATA_RESIDENCY_DISPOSITION

| Service/data path | Current geography | G1 restriction / alternative |
|---|---|---|
| Canadian ACA/DB/prod storage/KV/logs | Canada Central | Primary approved target geography, not full processor certification |
| Recovery | Canada East declared, runtime unproven | Cold restore; service availability/restore proof G4 |
| Legacy staging KV/storage/VNet | East US | No new institutional data; inventory dependents before replacement |
| `nzila-openai-eastus` | East US, public OpenAI account | Restricted for Cora sensitive classes pending approval |
| `nzila-openai-eastus2` | East US 2, public OpenAI account | Same restriction; no implied legal conclusion |
| UE demo AI config | East US and East US 2 regional endpoints | Observed configured consumer; actual data/calls unverified; UE owner to classify |
| Cora staging AI config | No AI endpoint in inspected app env metadata | Usage not proven absent; shared AI provider is env-driven; fail closed by contract |
| Front Door | Global edge | Caching disabled in target; logs/processors/edge treatment require compliance approval |
| Canadian ACR | Canada Central | Container artifacts, not evidence storage; build/pull permissions and provenance remain separate contracts |
| External Redis/payment/email processors | Upstash/Stripe/Resend credential references observed; geography unverified | References are not usage evidence; processor/data-class approval and recovery dependencies must be inventoried before institutional onboarding |
| Entra/GitHub/DNS control planes | External/global administration; data path geography not established by this audit | Identity/release/DNS ownership is distinct from Canadian application-data residency; no blanket residency certification |

US AI endpoints may receive only public or synthetic, nonpersonal data after
documented purpose/source permission and platform/privacy approval. No
institutional evidence, producer evidence, certifications, personal information
or institutional audit data from Cora may be sent until explicitly approved.
This is a conservative platform restriction, not a finding of unlawful use.
The restriction is a platform contract, not a claim of runtime enforcement.

The current East US account has `gpt-4` (model `gpt-4.1-mini`, version
`2025-04-14`, Standard capacity 10) and `text-embedding-3-small` (version 1,
Standard capacity 10); East US 2 has `whisper` (001, Standard capacity 1).
The demo's regional URLs do not, by themselves, prove its credentials map to
these particular accounts. Correlation and request/data classification remain
explicitly unverified.

Candidate replacement requires a Canada Central regional Azure OpenAI
**Standard** deployment, subject to actual model/version/quota support.
The live Canada Central catalog query returned **GlobalStandard** for the
embedding model, global/developer SKUs for `gpt-4.1-mini`, and no SKU for Whisper.
It did **not** establish regional parity for any of the three current workloads.
Therefore no eligible Canadian replacement is claimed or provisioned. A resource in Canada
using GlobalStandard or DataZone deployment is not proof of Canada-only
processing. Audio/model parity must be confirmed; if unsupported, disable the
restricted feature rather than fall back to US. Migration needs endpoint/model
parity tests, workload identity/secret update, legal processor approval,
egress controls and rollback preserving this restriction. No AI account is
created, deleted or reconfigured in G1.

### IAC_AUTHORITY_MATRIX

| Surface | Authority now | Management classification |
|---|---|---|
| This directory and foundation templates | Canonical target; no production apply authority | Source-managed preparation, runtime reproduction UNPROVEN |
| `infrastructure/bicep/main.bicep` and parameters | Legacy generic template; not institutional desired state | Partial/drifted; do not deploy over current estate |
| `infrastructure/gitops/environments/*.yml` | Transitional application release profiles | Partial: workflows do not reconcile all declared infra fields |
| UE app infra/workflows | UE-owned operational deployment paths | Product-lane authority; migration coordinated, not edited here |
| Existing DB/KV/storage/ACA/Front Door | ARM inventory plus exact deploy records | Partial/manual/drifted until resource-to-source mapping proven |
| Entra roles/federated credentials/GitHub environments | Live APIs | Partial/external to current foundation; no credential retirement |
| Custom DNS domains/registrar/provider | External owner | External; do not infer management from repo scripts |
| DR/alert/restore evidence | Signed, time-bound runtime records | Configuration is not proof; future gates |

The visible RG deployment histories returned only demo `union-eyes-env` and
production `ue-prod-bootstrap`; six RGs returned no deployments. History
retention/manual CLI operations can explain missing records. No template hash
was matched to a source commit; no live service is newly certified fully
IaC-managed. The snapshot preserves names/status/hash metadata, not template
parameters or secret outputs.

The legacy shared orchestrator now passes its environment and per-app digest
map to both runtime modules. Production uses only `@sha256:{digest}`; missing
entries fail evaluation, malformed digests are invalid image references, and
`imageTag=latest` cannot supply a production fallback. Nonproduction tag behavior
is intentionally preserved. UE-owned deployment paths are not changed.

### COST_ATTRIBUTION_FOUNDATION

All new taggable resources require `product`, `environment`, `service`, `owner`,
`cost_center`, `data_classification`. Product uses the actual product or `shared`.
Environment uses the canonical names; classification is synthetic for cheap
nonprod and institutional for protected products. Tag inherited child resources
through their parent where ARM does not support tags. Shared cost pools use
explicit allocation rules, never zero-cost product reporting. Premium edge,
Private Link/ACA management fees, HA, geo-backup, GRS, logs and egress are
assurance overhead with owners; actual budget/anomaly tests belong to G6.

### CORA_PLATFORM_CONTRACT

Cora is not deployed. Product agent supplies isolation/DB-role acceptance,
evidence/audit classifications and complete nonsampled audit outputs. Platform
provides separate private persistence/workload identity and approved Canadian
processor contracts. Targets: SLO >=99.9%, design toward 99.95%, RPO <=15m,
RTO <=2h. No US AI fallback for prohibited classes. Product authorization and
certification/evidence semantics remain Cora-owned.

### UE_PLATFORM_CONTRACT

UE deploy/auto-promote/product infra stay untouched. Private networking requires
parallel environment/data migration, maintenance/rollback and UE acceptance of
DNS, secret, non-admin DB-role and health/probe interfaces. Preserve existing
live modest capacity until measurements justify growth. Product-owned audit
completeness and tenant isolation proofs are prerequisites, not inferred from
networking or Azure identity. UE remains `INFRA_NO_GO`.

## Migration gates and deferred work

- G2: actual private connectivity/edge approval and origin-denial tests, RBAC
  negative tests, WAF managed rules, credentials/PIM/CA, egress and deploy review.
- G3: capacity measurements, availability SLO, health/load/dependency failure
  tests, transactional migration and rollback exercise.
- G4: actual Canadian restore/DR, audit/provenance recovery and timed RPO/RTO.
- G5: telemetry/security/audit separation, retention, complete audit delivery,
  log access, incident owners and exercised alert paths.
- G6: budgets, cost attribution/anomalies and observed cost drivers.

No existing production resource is migrated by this foundation. New
product/environment names intentionally avoid in-place overwrite. A production
deployment requires an approved change record, provider what-if, private runner
and operator access, DB migration/recovery evidence and coordinated acceptance.

## Official design references

- [ACA with Front Door Private Link](https://learn.microsoft.com/en-us/azure/container-apps/how-to-integrate-with-azure-front-door)
- [ACA private endpoints and DNS](https://learn.microsoft.com/en-us/azure/container-apps/private-endpoints-with-dns)
- [ACA managed environment API](https://learn.microsoft.com/en-us/azure/templates/microsoft.app/2025-07-01/managedenvironments)
- [Azure AI data processing geography](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy)

Compilation and local contract tests do not prove deployability, runtime
isolation, private connectivity, availability, DR or production readiness.

## Source entrypoints and validation

- [landing-zone.bicep](./landing-zone.bicep): subscription-scope RG boundaries,
  separate security/operations workspace scopes, product foundation only.
- [foundation.bicep](./foundation.bicep): network/DNS, Entra-only PostgreSQL,
  private vault/Blob, workload identity and attributable diagnostics. Does not
  deploy application code. New names are intentionally distinct from live UE.
- [runtime.bicep](./runtime.bicep): separate opt-in workload deployment using
  foundation outputs, a product-owned immutable image/probes and identity.
- [edge.bicep](./edge.bicep): separate opt-in Premium private origin/WAF/route
  deployment in the shared edge RG. No custom-domain traffic cutover.
- [operations.bicep](./operations.bicep): one workspace in its own approved RG.
- [artifact-registry.bicep](./artifact-registry.bicep): proof-scoped Premium
  ACR with public/admin/anonymous/bypass access disabled, registry Private Link,
  private DNS integration, runtime-UAMI-only `AcrPull`, and a separate
  builder-UAMI-only `AcrPush` contract. These are source declarations, not live
  role grants.
- [g2-artifact-foundation.bicep](./g2-artifact-foundation.bicep): narrow
  synthetic G2 bootstrap without runtime, data services, shared diagnostics,
  or edge. It composes only the approved proof resource group, VNet/subnets,
  builder NSG, ACR private DNS/link, runtime and builder UAMIs, and private
  Premium ACR/endpoint. The latest structured JSON what-if contains 12
  top-level `Create` changes, including both registry-scoped role assignments,
  and no `Unsupported` changes. The validation helper's line-count summary
  says 13; the structured `changes` array is authoritative for the 12-resource
  count.
- [g2-proof.bicep](./g2-proof.bicep): fixed synthetic proof orchestration;
  registry login server is derived from the in-boundary ACR module rather than
  supplied as an arbitrary host.
- [capture-inventory.ps1](./capture-inventory.ps1): read-only Azure/Entra metadata;
  explicitly fails if reads fail or the subscription differs.
- [validate.mjs](./validate.mjs): emitted ARM controls and runtime input checks.

The VNet allocation reserves 10.32-35.0.0/16 for UE and 10.48-51.0.0/16 for Cora
in environment order. Confirm no external peering/VPN address collision before
deployment. Only the Azure subscription visible to this audit was inventoried.
Resource names use product/environment prefixes; globally unique KV/storage
names use a deterministic subscription/RG/product/environment suffix and tags.
Runtime/edge names use [naming.json](./naming.json) environment short codes
`dev`, `test`, `stg`, `prod` to respect ACA/Front Door name-length limits;
classification/allocation tags retain the full environment names.

Compile each entrypoint with `az bicep build --file <entrypoint> --outfile
<artifact-directory>\<name>.json` (including landing-zone, operations,
`artifact-registry`, `g2-proof` and `g2-artifact-foundation`). Use
`g1-foundation.json`, `g1-runtime.json`, `g1-edge.json`, `g1-operations.json`,
`g2-artifact-registry.json`, `g2-proof.json`, `g2-artifact-foundation.json`,
and `g1-legacy-main.json` when running the emitted-template validator.
Run `node infrastructure\landing-zone\validate.mjs <artifact-directory>
[runtime-parameters.json]`. Set `G1_BICEP_OUTPUT` to that directory, then run
`pnpm exec vitest run --project contract-tests
tooling\contract-tests\landing-zone-foundation.test.ts
tooling\contract-tests\gitops-app-selection.test.ts`.
Also compile the legacy shared orchestrator to
`<artifact-directory>\g1-legacy-main.json` to check both emitted production
digest gates. Its pre-existing Sentinel/Key Vault linter warnings do not
apply to the warning-free canonical entrypoints and remain unresolved.

Runtime parameters must pass the validator before any later deployment; cheap
nonproduction profiles admit synthetic data only. Real-data staging requires an
explicit separately approved profile, not a changed classification label.
The G2 synthetic proof must not use the existing staging ACR: it is outside the
approved boundary. Source declares a separate private ACR, runtime-UAMI-only
registry-scoped `AcrPull`, and separate builder-UAMI-only registry-scoped
`AcrPush`; none is live. The narrowed bootstrap includes the proof VNet,
subnets, builder NSG, both UAMIs, ACR private DNS/link, private endpoint and
role-assignment resources; it does not create data services or shared
telemetry. A repeat structured JSON what-if returned 12 top-level `Create`
changes in the one approved proof RG, with no `Unsupported`, `Modify`, or
`Delete` changes. The separate validation helper printed 13 creates using a
formatted-line counter; use the structured resource-change list as the
authoritative count. Provider validate still reported
`NestedDeploymentShortCircuited` for a nested registry module.

The selected builder design is a short-lived private Linux VM invoked with
Azure VM Run Command and the builder UAMI; it has no public SSH/RDP. Its subnet
disables default outbound access and the NSG denies inbound traffic. The VM,
temporary NAT/egress arrangement, artifact, and provenance are not provisioned
or proven. The builder cannot run until the outbound path and cleanup controls
are approved and verified. ACR VNet agent pools remain unproven and are not
selected. Entra DB roles, app secret/environment wiring, custom domains,
private-link approval and rollback are deliberately product-coordinated
migration steps, not hidden G1 deployment defaults.

Reuse: legacy helpers lack private KV/Blob endpoints and use shared admin
credentials/identity. The canonical private-endpoint helper is shared across
vault/storage/runtime; the operations module is shared across independently
scoped workspaces. Legacy source is not copied or silently promoted to authority.

## G1 handoff

### CONCURRENCY_CHECKPOINT / FOREIGN_CHANGES_OBSERVED

HEAD remained `1c337567635bb86ea0df7831557d8d2d22df1e6f` on `main`.
Before the final documentation batch: 60 tracked modified files (two BASTION
infrastructure files plus the 58 already-dirty tracked paths) and 117 fully
expanded untracked files (14 BASTION additions at that checkpoint). The initial
85 untracked-path count used directory-collapsed status and is not directly
comparable to the expanded file count. Product/catalog/auth/database/report
work continued concurrently; no foreign changes were accepted, reverted,
stashed, committed or dispositioned.

The documentation validator rewrote its existing, already-dirty
`reports/doc-consistency.json` and `reports/doc-consistency.md` outputs.
Subsequent audits use its exported read-only function to avoid rewriting those
shared reports again. Their pre-existing contents are not claimed as BASTION
work or gate evidence for either product.

### FILES_CHANGED / RUNTIME_CHANGES

Added this directory's architecture, templates, shared naming map, sanitized
inventory/capture tool and emitted-control validator/type declarations; added
the G1 deployment plan and targeted contract test. Changed the two legacy
shared Bicep files for the production-only digest contract and added an
authority notice to the GitOps README. No product files, package manifests,
workflows or production parameters were edited.

Runtime changes: **none**. Read-only subscription validate/what-if preflight
was run for the narrowed G2 bootstrap; no deployment, traffic change, database
migration, principal removal, live tag update, subscription creation or Cora
deployment occurred. No secret values were exported.

### Validation evidence

- `az bicep build`: all five canonical entrypoints PASS with no resource-schema
  warnings; legacy main PASS with pre-existing Sentinel/Key Vault warnings.
- `node infrastructure\landing-zone\validate.mjs <artifact-directory>`: PASS on
  emitted private controls, tag dictionaries and both legacy production gates.
- Targeted Vitest with `G1_BICEP_OUTPUT`: **38 tests PASS**, including negative
  public-data-plane/origin, mutable/malformed artifact, missing cost-tag and
  invalid environment/profile/name tests; existing GitOps selection preserved.
- Targeted `tsc --noEmit` with existing Vitest Node type roots: PASS.
- `node --check`, PowerShell parser and metadata-only output-shape checks: PASS.
- `pnpm validate:docs`: zero errors, 1215 warnings and 1678 informational
  findings. Final exported read-only audit also returned zero errors.
- `git diff --check`: PASS.
- Direct ESLint: unavailable for these root-level paths because the repository
  has no applicable root ESLint configuration. No dependencies were added.
- Full `pnpm lint`, `pnpm typecheck`, `pnpm test:fast`, `pnpm governance:audit`:
  not run; no PR review requested, scope limited to foundation contracts.

### G1_FOUNDATION

**PASS_WITH_LIMITATIONS** for architectural/source preparation only.

There is one selected Canadian/private migration target and explicit treatment
of live exceptions; the source contracts can now be examined and security
hardening planned/tested without pretending the existing estate is private.
Provider validation/what-if, private runner and origin connectivity, regional AI
parity, credential-dependency closure and coordinated product acceptance remain
unproven. Deployment/reproduction, live architectural convergence, security, DR,
reliability, tenant isolation, audit completeness and production readiness are
**not** certified. Cora and UE remain **INFRA_NO_GO**.
