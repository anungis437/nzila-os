# Azure Deployment Plan — G2 Hermetic Builder

## Terminal ruling: G2 private control-plane foundation

Status: Adjudicated PASS. Mission `NZ-20261008-INFRA-001`.
Authority: `TERMINAL G2 ADJUDICATION`, READ_ONLY / EVIDENCE_ONLY.
Ruling recorded 2026-10-12; no technical execution or Azure mutation.
`G2_PRIVATE_CONTROL_PLANE = PASS`.
`STAGE3_AUTHORIZED = NO`. `APPLICATION_ROLLOUT_AUTHORIZED = NO`.
UE/Cora `INFRA_NO_GO` unchanged. This is not product production readiness.

Scope: private target-registry access; bounded separate builder/runtime
identities; deterministic content-addressed artifact production/consumption;
repository separation; no unsafe public bypass; governed steady state.
Not a claim of private ARM operator endpoint or production-ready platform.
All five roots/discovery source authority and consumed histories verified
before Azure readback. Historical plan hashes match byte-exact retained
chronology suffixes; shared workflow hash matches recorded completed status.
Live readback protected16/full estate/source/RBAC/private NIC/DNS/zone mappings
unchanged. Temporary runtime VM/NIC/disk and CSE absent. Target public Disabled,
bypass None; importers absent; staging/OIDC no surviving target/inherited role.
Current combined runtime/builder authorization SHA:
`0e6214005c7de533e0facc7bbd631db6744ee8e5139bba0a3e2c071c688b445e`.
26 failed/blocked/success/local phases accounted;15 live deployment records
linked to retained names/correlations. Historical failures are not rewritten.
No G2 blocker survives; all limitations classified OUTSIDE_G2.
No registry artifact query/push/import, guest execution, RBAC/network write,
retained proof cleanup, application or product-domain change performed.

Authoritative [terminal disposition](evidence/G2_TERMINAL_DISPOSITION.json),
[mission/gate status](mission-gate-status.json),
[adjudication report](evidence/G2_TERMINAL_REPORT.md),
[limitations](evidence/G2_TERMINAL_LIMITATIONS.json).
Next governance decision [WHAT IS STAGE3?](evidence/G2_TERMINAL_STAGE3_GOVERNANCE_DECISION_DRAFT.md)
is proposal only. Do not infer its meaning from prior drafts.
All following plan sections and their FAIL/NO_GO rulings are historical
execution records, not an override of this separately authorized narrow gate.

## Current slice: Stage2B runtime identity proof

Status: Executed; runtime identity PROVEN; Stage2B authority consumed.
Recipe: Bicep with Azure CLI group deployment.
Approved packet `G2_STAGE2B_RUNTIME_IDENTITY_PROOF`.
One distinct temporary private Linux VM, NIC, OS disk, optional one-shot CSE;
only existing runtime UAMI attached. Never execute on/change builder.
Existing subscription/Canada Central/private builder subnet retained.
No public IP, SSH session, package installation, ORAS, network/RBAC changes,
artifact mutation, application deployment, or Stage3.
Fresh canonical runtime/builder assignment census and protected16 baseline
before creation; immediate matching census before single deployment;
post-teardown matching census and protected16 full estate equality.
Bind exact sealed Stage2A manifest/payload, script/template/parameters,
runtime identity, allowed read/denied writes/tooling read, teardown inventory.
Ephemeral public SSH provisioning key bound; private key destroyed before
deployment. Preinstalled Python only; fail closed if unavailable.
Unit/contracts, build/lint, provider/policy/raw bounded what-if and governed
azure-validate required before azure-deploy.
Terminal proof result then delete only transaction-owned resources even on
failure. No retry or second VM. Overall G2 FAIL and UE/Cora NO_GO unchanged.
Stage2A consumed sources/evidence remain frozen; historical plan hashes
refer to historical plan content, not this authorized new section.
Final proposal: separate terminal G2 adjudication, never automatic G2 PASS.

### Stage2B accepted design and preparation

Fresh exact runtime Reader/synthetic-health and unchanged builder
Reader/tooling + Writer/synthetic-health census PASS. Combined canonical SHA:
`0e6214005c7de533e0facc7bbd631db6744ee8e5139bba0a3e2c071c688b445e`.
Frozen Stage2A evidence/source root preserved; full protected16 baseline PASS.
One `nzila-g2-runtime-proof` VM, `nzila-g2-runtime-proof-nic`, implicit
`nzila-g2-runtime-proof-osdisk`, and child `nzila-g2-runtime-once` CSE.
No existing resource definitions: subnet/NSG/UAMI references only.
Direct-resource narrow Bicep matches prior proven substrate pattern and binds
explicit lifecycle names; no general-purpose module side effects.
Reuse existing BuilderSubnet and existing NSG, no inbound/network edits.
VM Standard_B2s, 32GB StandardSSD_LRS, Canada Central.
Exact Canonical ubuntu-24_04-lts/server/24.04.202609040 image available,
SKU unrestricted, existing2+requested2 within10 B-family/regional core quotas.
Only runtime UAMI `nzila-g2-runtime-y3koaeijzi6mu`.
CSE one-shot shell prechecks preinstalled Python then pinned private HTTPS/
runtime-specific IMDS/scopes, exact manifest/tag/payload reads and
authorization-boundary write-init/tooling-read denials. No completed writes.
Unexpected grant/write acceptance produces explicit security failure.
Network/malformed/404 errors are not authorization-denial evidence.
Boot diagnostics disabled; no SSH session, package update/install or ORAS.
Temporary RSA3072 provisioning private key destroyed before validation.
Public key bound into immutable parameters; no private key retained.
16 new contract tests +93 preserved regressions, build/lint/diff PASS.

- [x] All validation checks pass
  - [x] Core helper: CLI/auth/build/provider/what-if
  - [x] Runtime tests + regression tests, Bicep build/lint, diff --check
  - [x] Azure Policy Validation
  - [x] Static roles: runtime-only attachment, no new RBAC
  - [x] Raw Create3 plus explicit implicit OS disk and source authority

### Section 7: Stage2B validation proof

Preparation completed 2026-10-12T00:01:38Z.
`python stage2b-controller.py prepare`: PASS,109 tests/build/lint/diff;
image/SKU/quota checks PASS; provisioning private key destroyed.
Validation completed 2026-10-12T00:05:18Z:

- `python stage2b-controller.py validate`: PASS; prevalidation census unchanged,
  provider validation PASS, raw FullResourcePayloads exactly NIC+VM+CSE Create3,
  Modify0/Delete0/Unsupported0. Named implicit OS disk lifecycle explicitly
  bound. No existing protected resource modification proposed.
- Official `validate-deployment.ps1 -Scope group -ResourceGroup
  nzila-g2-proof-xre47vggs5uhw -Subscription
  5d819f33-d16f-429c-a3c0-5b0e94740ba3 -Template
  infrastructure/landing-zone/g2-builder/stage2b/runtime.bicep -Parameters
  .azure/evidence/G2_STAGE2B_PARAMETERS.json`: PASS.
  CLI/auth/build/provider/what-if PASS. Helper textual Create4 is formatting
  double-count; authoritative raw JSON explicitly contains3 Create resources.
- `az bicep build` / `az bicep lint`: PASS, no source lint warnings.
  Official adjacent compile matches sealed template SHA
  `a058b18a715bd7f6a8f57b04e5dec8d03b325698b7bfbd16f767672a56840f5f`.
- `git diff --check`: PASS;109 runtime/regression tests PASS.
- Six controller exact-delta/nonterminal/unowned cleanup contracts PASS.
- Applicable Azure Policy assignments empty. Static candidate review PASS:
  only NIC/VM/CSE; runtime-only UserAssigned identity; existing subnet/NSG
  references; no RBAC, public IP, network-rule or protected-resource definitions.
  Runtime conditioned Reader sufficient for intended reads and denies.
- Source/template/parameters/expected identity/digests/operations/teardown
  inventory bound in `G2_STAGE2B_SOURCE_AUTHORITY.json`.

No validation error remained. Immediate equal census and fresh exact raw gate
passed before the single dispatch.

### Stage2B execution and final disposition

Exactly one deployment `g2-runtime-proof-20261012-000819`, Succeeded.
Correlation `326d227d-37e1-4fb9-ba23-e13f236cfaae`.
Live distinct private VM/NIC/OS disk/CSE inventory verified; only runtime UAMI,
no builder/other/system identity, no public IP; exact subnet/NSG references.
Preinstalled Python performed the proof without installation or SSH.
Runtime identity assertion, private login .5/data .4 DNS/Host/SNI/TLS PASS.
Synthetic-health read by tag and immutable digest ALLOWED; exact manifest
contract/raw digest and 326-byte payload digest/bytes PASS.
Synthetic-health write-init DENIED; g2-tooling manifest read/write-init DENIED.
Denied results require registry HTTP401/403 with UNAUTHORIZED/DENIED response,
not DNS/network/malformed/404 failures. No artifact mutation or completed write.
No token bodies/raw runtime messages persisted; package/resolver config unchanged.
Exact transaction CSE/VM/NIC/OS disk deleted; zero transient residuals.
Final full protected estate/private NIC/DNS/zone mappings/source/RBAC PASS,16.
Predispatch/prevalidation/immediate/post-teardown combined canonical hashes:
`0e6214005c7de533e0facc7bbd631db6744ee8e5139bba0a3e2c071c688b445e`.
Builder untouched; no guest execution or identity/RBAC/CSE changes on builder.
Stage2A historical sources/evidence preserved.
`STAGE2B_RUNTIME_IDENTITY_PROVEN`. Overall G2 FAIL; UE/Cora INFRA_NO_GO.
Evidence chain reconciled; separate terminal G2 adjudication proposal only.
No application rollout, Stage3, or terminal G2 PASS authorized.

## Current slice: corrected synthetic artifact production

Status: Executed; builder artifact PROVEN; corrected authority consumed.
Recipe: Bicep with Azure CLI group deployment.
Approved `G2_STAGE2A_CORRECTED_SYNTHETIC_ARTIFACT_PRODUCTION`.
Exactly one new CSE on existing Canada Central builder/subscription/tenant.
Preserve all prior sources/evidence and local OCI proof root. Payload/tag fixed.
Fresh canonical operator ARM census before validation, immediate equal snapshot
before dispatch, matching post-retirement census. Protected16/private DNS/
roles/source unchanged; no privileges/config/network changes.
Rerun actual local ORAS package construction and exact raw manifest contract.
Use frozen repaired validator/adapter candidate. Approved ORAS local only,
no-retry uploader remote only, at most one artifact attempt/manifest commit.
Private retrieval/hash/version; generated exact inline-config manifest;
effective read/write/denial gate; tag absence; digest/blob immutable roundtrip;
temporary workspace cleanup and exact terminal CSE retirement.
`PRIOR_LOCAL_MANIFEST_DESCRIPTOR_DEFECT = config.data omitted from expected descriptor`.
Disposition REPAIRED. Exactly one corrected authority consumed.
No Stage2B/Stage3 or product readiness claim. Overall G2 FAIL.

Fresh baseline/canonical ARM census PASS, unchanged exact .5/.4 mapping,
roles/source/settings, protected16 and all local/prior roots.
Predispatch snapshot:
`ab355ef1e0697b1bf0e4328cdfb68d2a6f92eb49e8721c8326f93261a950fd63`.
Two fresh actual local ORAS runs with network disabled PASS. Both exact bytes
match frozen manifest and repaired validation:
`sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690`.
Frozen local candidate unchanged. No new guest adapter or validator edits.

- [x] All validation checks pass
  - [x] Core helper: CLI/auth/build/provider/what-if
  - [x] All 93 tests, exact local reproduction, Bicep lint, diff --check
  - [x] Static roles/policy review: no new role/network/identity declarations
  - [x] Raw exact single CSE Create and full source/manifest/payload hashes

### Section 7: Corrected production validation proof

Current checks completed by 2026-10-11T23:35:35Z:

- `python corrected-production-controller.py validate`: PASS, all 93
  regressions across eight scoped suites; exact prevalidation census equality,
  provider validation, raw FullResourcePayloads Create1/Modify0/Delete0/
  Unsupported0, applicable policy assignments empty, sealed source authority.
- Official `validate-deployment.ps1 -Scope group -ResourceGroup
  nzila-g2-proof-xre47vggs5uhw -Subscription
  5d819f33-d16f-429c-a3c0-5b0e94740ba3 -Template
  infrastructure/landing-zone/g2-builder/stage2a/local-oci-repair/candidate-extension.bicep
  -Parameters .azure/evidence/G2_CORRECTED_PRODUCTION_PARAMETERS.json`: PASS.
  CLI/auth/build/provider/what-if all PASS. Helper textual Create2 double-counts
  formatting; current raw JSON authority proves exactly one CSE Create.
- `az bicep build` and `az bicep lint` frozen candidate: PASS.
  Official adjacent compiled JSON equals current sealed template SHA256
  `de0d91136e9753d630c2b1abb3932d04f39c160e1bb18d713d3a810a19e7e6ab`.
- `git diff --check`: PASS. Fresh mandatory actual local packaging twice PASS.
- Static candidate review: only existing VM reference and one temporary CSE;
  no new RBAC/network/identity resources. Existing conditioned builder tooling
  Reader and synthetic-health Writer sufficient for intended data operations;
  no management-plane reads added. Runtime Reader remains unused.
- Current source/template/parameters/local-gate/payload bindings retained in
  `G2_CORRECTED_PRODUCTION_SOURCE_AUTHORITY.json`.

Immediate canonical hash equality and fresh exact raw gate still required
before the single dispatch. No validation error remains.

### Corrected execution and final disposition

Executed once: `g2-corrected-production-20261011-233826`.
Correlation: `037823f0-5925-4261-85d1-8021700c875b`. Deployment Succeeded.
Fresh exact raw gate and immediate ARM snapshot equality PASS.
Private ORAS archive hash/version/TLS/.4 and strict actual generated OCI
manifest PASS; original descriptor defect repaired without broader acceptance.
Guest effective tooling read allowed, tooling/control write denied, exact
synthetic-health pull/push grant allowed. Authenticated target tag absent.
No-retry uploader remote push PASS; exactly one manifest commit.
Remote manifest equals frozen local digest; payload exact bytes/hash match.
Immutable tag/digest readback PASS. Final tooling denial PASS.
No sensitive material persisted, no persistent installation, workspace absent,
guest configuration unchanged. Exact terminal CSE removed.
Final protected16/full roles/source/private NIC/DNS/zone mappings unchanged.
Post-retirement authorization SHA equals prevalidation/immediate snapshot:
`ab355ef1e0697b1bf0e4328cdfb68d2a6f92eb49e8721c8326f93261a950fd63`.
No builder management-plane permission added.
`STAGE2A_BUILDER_ARTIFACT_PROVEN`. Overall G2 FAIL, UE/Cora NO_GO unchanged.
Stage2B separate authority proposal only; no runtime identity attached,
application deployed, Stage3 or additional registry operation authorized.

## Current slice: local OCI manifest contract repair

Status: Local-only contract PROVEN; corrected candidate prepared, not deployed.
Approved packet `G2_STAGE2A_LOCAL_OCI_CONTRACT_REPAIR`.
No Azure/provider/registry read or mutation performed. No new execution
authority/parameters created. Historical consumed candidate/source unchanged.
Exact Linux AMD64 ORAS1.3.4 archive acquired locally from official release;
hash equals the previously approved archive. Existing docker-desktop WSL
executes twice in isolated temporary dirs with `unshare -n` and `env -i`.
Exact original local layout flags/payload/tag/media types and fixed created
annotation preserved. Actual raw manifest, oci-layout/index and config/
payload/manifest blobs retained for both runs; all hashes deterministic.
One reproduced mismatch: `config.data` absent in old expected descriptor,
actual `e30=` embeds `{}`. OCI1.1.1 descriptor data permits it. Require that
exact value, decoded bytes, descriptor/config-blob hash/size and raw manifest
digest. No permissive schema relaxation. Deleted guest bytes not recovered;
comparison is proven exact-command local reproduction versus frozen contract.
New validator/adapter/Bicep compose frozen production logic, changing only
local manifest validation. 93 tests PASS, including real captured fixtures
and 16 negative mutations. Local Bicep build/lint and diff --check PASS.
No provider validation/what-if/deployment or effective guest authorization
proof run here; those require fresh future authority.
Local manifest digest:
`sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690`.
Sealed payload and tag unchanged. Local reproduction tooling/workspace
cleaned; only requested forensic layout/evidence retained.
Next corrected Stage2A authority prepared as proposal only. No Stage2B/Stage3.
Overall G2 FAIL; builder artifact remains PARTIAL; UE/Cora NO_GO unchanged.

## Current slice: revised synthetic artifact production

Status: Executed; artifact PARTIAL; revised execution authority consumed.
Recipe: Bicep with Azure CLI group deployment.
Approved packet `G2_STAGE2A_SYNTHETIC_ARTIFACT_PRODUCTION_REVISED`.
`BUILDER_MANAGEMENT_PLANE_ROLE_READ_REQUIRED = NO`.
Composite gate: canonical exact operator ARM census before candidate/
dispatch, immediate guest effective repository checks, unchanged post-run
ARM census. No RBAC mutation or management permission added.
Preserve sealed payload bytes and full bound stage2a tag. Fresh protected16,
network/DNS/identities/roles/source baseline before generating candidate.
Retrieve/hash/safely extract temporary ORAS 1.3.4; exact one synthetic-health
push with explicit media types, no retry; immutable readback and least-mutating
tooling/control write negatives. Clean workspace and retire exact terminal CSE.
No source writes/imports/packages/public bypass/identity attachment or
Stage 2B/Stage 3. Full current validation and hash authority required.
Execution authority unconsumed. Overall G2 FAIL.

Fresh protected16/full roles/source/DNS/prior-hash census PASS. Canonical
assignment snapshot SHA:
`ab355ef1e0697b1bf0e4328cdfb68d2a6f92eb49e8721c8326f93261a950fd63`.
Sealed payload/tag unchanged. Guest candidate: exact private retrieval,
safe regular-member extraction and ELF AMD64/version gate, ORAS local OCI
layout creation with fixed created annotation, then strict pinned Python
HTTP transfer with no retries (two referenced blobs, one manifest commit).
ORAS's native remote transport has built-in retries. No-response decision:
use local ORAS packaging + independently tested no-retry uploader to honor
the strict packet; do not modify binary, proxy TLS, or grant privileges.
No ORAS remote CLI push is claimed. Exact source relationship is preserved.
Before push: tooling pull success, push-only denied grant and HTTP401/403
upload-init denial, control denial, exact synthetic-health pull/push grant,
authenticated bound-tag absence. After push: raw manifest tag/digest equality,
exact payload bytes/hash, tooling denial, temporary workspace cleanup.
No denial manifest commit or out-of-scope payload upload. Unexpected
upload authorization stops without deleting/concealing evidence.
17 new production tests and Bicep build/lint PASS. Full current validation
pending; do not use any previous validated plan as dispatch authority.

- [x] All validation checks pass
  - [x] Core helper: CLI/auth/build/provider/what-if
  - [x] All 85 tests, Bicep lint, git diff --check
  - [x] Applicable policy and static role review (no role/network declarations)
  - [x] Raw exact-one-CSE Create and full source/payload/template authority

### Section 7: Revised production validation proof

2026-10-11: `validate-deployment.ps1 -Scope group -ResourceGroup
nzila-g2-proof-xre47vggs5uhw -Subscription
5d819f33-d16f-429c-a3c0-5b0e94740ba3 -Template
infrastructure/landing-zone/g2-builder/stage2a/synthetic-revised/production-extension.bicep
-Parameters .azure/evidence/G2_SYNTHETIC_REVISED_PARAMETERS.json`: OVERALL PASS
(CLI/auth/build/provider/what-if). Helper textual Create:2 is not authority;
current raw FullResourcePayloads shows exactly one temporary production CSE
Create, no Modify/Delete/Unsupported.
`python -m unittest discover -s <stage2a/folder> -p test_*.py -v`: 85 PASS
(redirect-guard12/blob16/private-import20/corrected4/empty-path10/
source-contract6/production17).
`az bicep lint --file <synthetic-revised/production-extension.bicep>`: PASS.
`git diff --check`: PASS. Compiled template/adjacent build SHA identical:
`EBFE673450BF0AD84D0698483FA336ED11DED846A31433EA2E5FD89349AB2448`.
Applicable inherited policy assignments empty. Static role review PASS:
exact existing builder identity/pull and repository Writer contracts;
no RBAC/network/identity declaration added. Production creates no persistent
infrastructure. Source/helper/test/template/parameter/payload/census hashes
bound in G2_SYNTHETIC_REVISED_SOURCE_AUTHORITY.json.
Canonical authorization frozen before candidate validation; final immediate
recheck identically before dispatch and after exact retirement.
No PR review requested; monorepo-wide PR eligibility commands not run.

### Revised production execution and final proof

Exactly one deployment `g2-synthetic-revised-20261011-225602`,
correlation `305cdc85-d0a3-4b4b-8483-419d8cbe7c9e`, terminal Failed.
Guest timestamp `2026-10-11T22:56:15.128090+00:00`.
Private ORAS download: .4, TLS PASS, 4,679,642 bytes, approved archive SHA.
Safe extraction/ELF AMD64 gate and ORAS version1.3.4 PASS.
ORAS local OCI command succeeded but exact config/layer descriptor validation
stopped at `LOCAL_MANIFEST_DESCRIPTOR_MISMATCH`. Ephemeral manifest was
removed by cleanup; saved evidence does not distinguish the specific field.
No claim of a narrower root cause. Tests used mocked expected descriptor
fixtures, not actual ORAS-generated descriptors.
No effective write/denial gate, tag collision check or remote push reached.
Push-attempt consumption NO; zero remote manifest commit attempts.
Execution authority YES consumed; no retry. Exact terminal CSE removed.
Workspace absent; no token/config persisted or persistent install;
configuration SHA unchanged. Final protected16, source settings/roles,
target Disabled/None, DNS/PE NIC, identities and prior hashes unchanged.
Predispatch/immediate/postexec canonical ARM SHA all
`ab355ef1e0697b1bf0e4328cdfb68d2a6f92eb49e8721c8326f93261a950fd63`.
ARM authorization unchanged PASS, no management privilege added.
`STAGE2A_BUILDER_ARTIFACT = PARTIAL`; overall G2 FAIL.
No Stage2B authority prepared because artifact proof did not PASS.
No Stage3/product action. Executed source snapshots frozen; any correction/
diagnostic execution requires new authority, not reuse of this consumed one.

## Current slice: synthetic artifact production

Status: Blocked before execution; production authority unconsumed.
Recipe: Bicep with Azure CLI group deployment.
Approved packet `G2_STAGE2A_SYNTHETIC_ARTIFACT_PRODUCTION`.
Existing subscription/tenant/Canada Central builder and private ACR only.
Fresh protected16/network/DNS/repository-conditioned role baseline first;
stop on drift. Bind fixed SYNTHETIC_ONLY payload/source authority/exact tag.
Retrieve proven ORAS archive privately; hash before safe temporary extraction;
verify version 1.3.4. Authenticate builder UAMI only. Require authenticated
tag absence and a fresh live authorization recheck immediately before
exactly one ORAS synthetic-health push. Prove digest/blob roundtrip and
cross-repository/tooling write denial without manifest commit elsewhere.
Clean exact temporary workspace and retire exact terminal CSE.
No import, role/network changes, packages, public access, runtime identity
attachment, Stage 2B or Stage 3. All historical bytes remain frozen.
Fresh read-only baseline PASS: protected16, full target/source roles/settings,
private DNS/PE NIC/zone group, exact attached builder identity and prior hashes.
Both builder roles have no management Actions, only repository DataActions.
The packet requires live condition re-read immediately before push. The guest
cannot read ARM role-assignment conditions with these roles. A predispatch
operator census is proven, but is not substituted for that later check.
No authorized bridge exists in the bounded single-CSE channel; no operator
token/credential passed to guest and no RBAC added. Stop before dispatch.
Payload/tag binding complete; full execution-source authority NOT_CREATED.
No CSE/runner/Bicep production source created; no archive retrieval, extraction,
ORAS execution, token acquisition, collision check, push or denial probe.
Six local source-contract tests and git diff --check PASS.
Provider/what-if/build/lint/azure-validate/azure-deploy NOT_RUN for this slice:
there is no executable deployment candidate. Historical validation is not
current authority. Governing proof is G2_SYNTHETIC_PRODUCTION_BASELINE.json.
Bound source SHA:
`2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db`.
Exact tag:
`stage2a-2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db`.
Authority unconsumed. Await an authorized immediate condition-read mechanism,
or explicit acceptance of predispatch ARM census plus immediate guest scoped
grant/denial checks as the revised gate. No such change is assumed.
Overall G2 FAIL; UE/Cora INFRA_NO_GO unchanged.

## Current slice: empty-path redirect closure

Status: Executed; private delivery PROVEN; empty-path authority consumed.
Recipe: Bicep with Azure CLI group deployment.
Approved packet `G2_STAGE2A_EMPTY_PATH_REDIRECT_CLOSURE` supersedes only the
unsupported nonempty-path assumption. All historical sources/results remain
frozen. Exactly one temporary CSE may run on the existing builder, approved
subscription/tenant/Canada Central, after fresh private estate/DNS/role
baseline, all regression suites, build/lint/provider/raw exact-Create gate.

New validator accepts empty or absolute URI path under exact HTTPS/default
port/no credentials/no fragment/data-host restrictions. Pass the exact signed
URI into Python urllib Request; let the HTTP library construct origin-form
root/query. Do not edit/reconstruct the URL. Disable proxies and automatic
redirect chaining; use the frozen DNS/IP/SNI/certificate-pinned connection
for the dedicated data host. Registry bearer headers are never forwarded.
Stream and hash without durable archive. Retire exact terminal CSE on any
result; no retry, import, RBAC, network/DNS, package, extraction, ORAS execution
or push. Prepare next artifact-production authority only if delivery PROVEN.
Fresh baseline PASS: protected16, exact roles/settings/source registry and
private DNS/PE NIC login .5/data .4 unchanged; no CSE attached.
Validation proof PASS. Overall G2 FAIL; earlier slices below historical.

- [x] All validation checks pass
  - [x] Core helper: CLI/auth/build/provider/what-if
  - [x] All 62 relevant tests and Bicep lint/build; git diff --check
  - [x] Static role verification: no role/network declarations; policy context
  - [x] Fresh raw exact single CSE Create and source/template/parameter hashes

### Section 7: Empty-path validation proof

2026-10-11: `validate-deployment.ps1 -Scope group -ResourceGroup
nzila-g2-proof-xre47vggs5uhw -Subscription
5d819f33-d16f-429c-a3c0-5b0e94740ba3 -Template
infrastructure/landing-zone/g2-builder/stage2a/empty-path/observer-extension.bicep
-Parameters .azure/evidence/G2_EMPTY_PATH_PARAMETERS.json`: OVERALL PASS.
CLI/auth/build/provider/what-if all PASS. Helper textual count Create:2
is not mutation authority: fresh structured FullResourcePayloads shows exactly
one real `nzila-g2-empty-path` CSE Create, no Modify/Delete/Unsupported.
`python -m unittest discover -s <stage2a/folder> -p test_*.py -v`: PASS for
redirect-guard 12, blob-readback 16, private-import 20, corrected-redirect 4,
empty-path 10 (62 total). Tests include actual urllib wire root/query,
unchanged signed URI, Host/SNI/private IP, no Authorization forwarding,
no second redirect, exact DNS/TLS/HTTP/body failure and output-size contract.
`az bicep lint --file <empty-path/observer-extension.bicep>`: PASS.
`git diff --check`: PASS. Helper build and bound template SHA-256 both
`3FA8C50F91D40AEF4F41890FC4818032EB6DAD9F05EAEF585F312ACB256C23CD`.
Applicable inherited policy assignments: none. Static role review PASS:
no RBAC/identity/network resource added; frozen IMDS builder exact pull-only
grant contracts unchanged. Existing repo-conditioned tooling Reader suffices.
Fresh source/test/template/parameter/host/IP/artifact hashes bound in
`G2_EMPTY_PATH_SOURCE_AUTHORITY.json`. Authority still unconsumed.
Historical roots remain byte-for-byte; their old plan hashes are historical,
not claims about this updated plan. No PR review requested; monorepo PR
eligibility checks are not part of this bounded infrastructure observer.

### Empty-path execution and final verification

2026-10-11: exactly one deployment `g2-empty-path-20261011-222120`,
correlation `69dd7efb-754d-439f-8a8f-7be96d0049d7`, Succeeded.
The sentence "Authority still unconsumed" above describes predeployment
validation only; this execution has now consumed the packet, with zero retries.
Manifest-by-tag and by-digest HTTP200; raw manifest digest equals frozen
source authority. Registry blob HTTP307; exact signed URI accepted with
EMPTY path by urllib root/query semantics (no manual URL modification).
Data host resolves/peers at 10.90.2.4; HTTPS certificate/Host/SNI PASS;
HTTP200, Content-Length and bytes read 4,679,642; streamed archive SHA
`f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`.
Registry Authorization forwarding NO. No durable archive/extraction/execution.
Exact terminal CSE retired. Final protected16, target Disabled/None,
source settings, repository conditions/roles, DNS/PE NIC and prior
source/evidence hashes unchanged; importer roles absent and runtime tooling
access absent. Configuration SHA unchanged.
`STAGE2A_PRIVATE_ORAS_DELIVERY_PROVEN`; overall G2 FAIL. No product
readiness/security/DR claims. UE/Cora INFRA_NO_GO unchanged.
Next artifact-production authority draft prepared only, not approved,
not dispatched, and no executable production extension created.
Stage 2B and Stage 3 remain separate.

## Current slice: corrected redirect observer

Status: Executed; private delivery PARTIAL; corrected execution consumed.
Recipe: Bicep with Azure CLI group deployment.
Approved authority `G2_STAGE2A_CORRECTED_REDIRECT_OBSERVER` closes only the
impossible historical-predicate prerequisite:
`HISTORICAL_REDIRECT_REJECTOR = UNRECOVERABLE_BY_DESIGN`.
The old observer and results remain frozen. Exactly one new corrected CSE
may run on the same builder/subscription/tenant/Canada Central.

Compose frozen authentication and per-hop readback helpers with the separately
tested predicate-specific validator and a small integration adapter.
Recheck private login .5/data .4 mapping, protected16 and exact unchanged
roles/public Disabled/bypass None before binding and execution.
Keep signed queries in memory, do not forward registry credentials, stream
SHA without archive files. Stop on precise failure; retire exact terminal CSE.
No imports, staging, packages, extraction, ORAS execution, synthetic-health
push, network/RBAC changes or automatic retry. Overall G2 remains FAIL.
Preparation PASS: fresh private DNS/PE-NIC mapping .5/.4, exact existing
roles/target Disabled/None and protected16 unchanged. All 52 regressions pass
(12 validator, 16 frozen observer, 20 private-import, 4 integration).
Build/lint PASS; new raw provider gate shows one exact CSE Create only.
Query-bearing and double-leading-slash paths use an explicit pinned HTTPS
connection; no URL joining or alternate authority, no header forwarding.
Python urlsplit with the required HTTPS netloc yields an absolute path;
the validator requires a nonempty path without storage-internal assumptions.

- [x] All validation checks pass
  - [x] Core helper: CLI/auth/build/provider/what-if
  - [x] All 52 tests and Bicep lint
  - [x] Applicable policy list empty; no role/network declarations in IaC
  - [x] Fresh exact-Create raw gate and full source/template hashes bound

### Section 7: Corrected observer validation proof

2026-10-11: shared `validate-deployment.ps1 -Scope group -ResourceGroup
nzila-g2-proof-xre47vggs5uhw -Subscription
5d819f33-d16f-429c-a3c0-5b0e94740ba3 -Template
infrastructure/landing-zone/g2-builder/stage2a/corrected-redirect/observer-extension.bicep
-Parameters .azure/evidence/G2_CORRECTED_REDIRECT_PARAMETERS.json`:
OVERALL PASS. Helper textual count two Creates is not authority; fresh
structured FullResourcePayloads gives exactly one CSE Create and no
Modify/Delete/Unsupported. Build/lint and git diff --check PASS.
Four `python -m unittest discover -s <stage2a suite> -p test_*.py -v`
commands for redirect-guard, blob-readback, private-import, corrected-redirect:
12 + 16 + 20 + 4 tests PASS. Empty applicable policy list; exact preserved
Reader and synthetic roles live-rechecked; no RBAC declarations in template.
Fresh baseline, tests and source authority recorded as
`G2_CORRECTED_REDIRECT_BASELINE.json`, `G2_CORRECTED_REDIRECT_TESTS.json`,
`G2_CORRECTED_REDIRECT_SOURCE_AUTHORITY.json`, and provider/raw gate evidence.
Skill reload hook errored; retained azure-validate instructions and official
workflow/helper were followed without skipping validation.
Earlier sections below are historical.

### Corrected observer terminal result

Deployment `g2-corrected-redirect-20261011-215838`, correlation
`2c8f8022-4807-47ce-a4d1-180b11cae96a`, terminal Failed. Exactly one new
observer executed and retired. Manifest tag/digest both HTTP 200, raw source
manifest equality reconfirmed; initial blob HTTP 307. Approved HTTPS data
hostname, default port, signed query present, parsed path absent.
Exact current failure: `REDIRECT_VALIDATION_REDIRECT_PATH_INVALID_FAILED`.
The repaired guard proved which CURRENT predicate failed: `if not url.path`.
It did not recover or reinterpret the historical rejector.

Redirect validation FAIL; count 0. Data endpoint DNS/TLS/HTTP/body not reached;
archive SHA unproven; content equivalence UNRESOLVED. This packet explicitly
requires nonempty absolute path; no implicit-root normalization or second
execution was performed. The frozen observer's ACTIVE_STAGE retains an old
bookkeeping label, but actual FAILURE_STAGE and CURRENT_REDIRECT_FAILURE_PREDICATE
are precise and authoritative. Executed bytes were not rewritten.

Final protected16, exact roles, source registry settings, target Disabled/None
and private DNS/PE-NIC mapping unchanged. CSE absent; package/config digest
unchanged; prior evidence/frozen source hashes verified. No packages, import,
staging, network/RBAC change, ORAS extraction/execution or artifact push.
No next synthetic lifecycle authority is prepared because delivery is PARTIAL.
[Corrected report](evidence/G2_CORRECTED_REDIRECT_REPORT.md) and
[final disposition](evidence/G2_CORRECTED_REDIRECT_FINAL_DISPOSITION.json).

## Current slice: private blob readback closure

Status: Executed, private delivery PARTIAL; single execution authority consumed.
Recipe: Bicep with Azure CLI group deployment.
Authority: `G2_STAGE2A_PRIVATE_BLOB_READBACK_CLOSURE`, mission
`NZ-20261008-INFRA-001`; approved subscription/tenant/Canada Central unchanged.
This approved packet permits exactly one new pull-only diagnostic CSE execution
on the existing builder after source/test/template hash binding, tests,
build/lint, provider validation and extension-only Create what-if.

First recheck protected16, exact existing roles, target Disabled/None and
private DNS/PE NIC ownership (.5 login/.4 data). Reuse the frozen authentication
and manifest helpers, adding a separate source for per-hop observable readback.
Record only safe HTTP status, approved hostname, IP, TLS/SNI validation,
redirect metadata and streaming byte/hash results. Never persist signed URL,
query, credentials or response body. No file download/extraction/execution.
Retire the exact terminal extension even on proof failure; no corrected rerun.
No import/staging, RBAC, firewall, DNS or endpoint changes authorized.

Preparation complete: current live endpoint/DNS/PE-NIC mapping PASS; historical
evidence and reused source hashes PASS; sixteen new observer tests and twenty
frozen-helper tests PASS. Bicep build/lint PASS. Separate observer source composes
the unchanged private-import authentication/manifest helper; no failed bytes
are overwritten. Tests caught and corrected a config-digest transcription
before execution; the current manifest contract uses SHA-256 of literal `{}`.
Complete mocked success output fits the bounded CSE result marker.

Validation proof: provider and exact-one-Create gate PASS for this new slice;
all prior results below historical.

### Blob-readback validation checklist

- [x] All validation checks pass
  - [x] Core helper: CLI/auth/Bicep build/provider validate/what-if
  - [x] Bicep lint and sixteen observer/twenty frozen-helper tests
  - [x] Azure Policy context: no applicable assignments returned at exact RG
  - [x] Fresh raw gate: one exact observer Create; no Modify/Delete/Unsupported
  - [x] Source/helper/template/parameters/DNS authority hashes bound

### Section 7: Blob-readback validation proof

2026-10-11: `validate-deployment.ps1 -Scope group -ResourceGroup
nzila-g2-proof-xre47vggs5uhw -Subscription
5d819f33-d16f-429c-a3c0-5b0e94740ba3 -Template
infrastructure/landing-zone/g2-builder/stage2a/blob-readback/observer-extension.bicep
-Parameters .azure/evidence/G2_BLOB_READBACK_PARAMETERS.json`: OVERALL PASS
(CLI/auth/build/provider/what-if). Helper textual count of two Creates is
not authority: fresh raw FullResourcePayloads shows exactly one extension
Create and zero Modify/Delete/Unsupported. Bicep lint PASS.

`python -m unittest discover -s infrastructure/landing-zone/g2-builder/stage2a/blob-readback
-p test_*.py -v`: sixteen tests PASS.
Same runner against `stage2a/private-import`: twenty tests PASS.
Applicable policy context empty at exact RG; static Bicep defines only
one existing-VM child, no role/network/resources. Persistent Reader and
original source/runtime roles have been live-rechecked unchanged.

[Source authority](evidence/G2_BLOB_READBACK_SOURCE_AUTHORITY.json),
[provider validation](evidence/G2_BLOB_READBACK_PROVIDER_VALIDATION.json),
[raw what-if](evidence/G2_BLOB_READBACK_WHATIF_RAW.json), and
[test evidence](evidence/G2_BLOB_READBACK_TESTS.json) bind exact execution inputs.
Final delivery can be PROVEN only with successful private redirect/TLS/blob SHA
proof and final steady-state/retirement checks. Overall G2 remains FAIL.

### Blob-readback terminal execution

Deployment `g2-blob-readback-20261011-185510` reached a terminal Failed state;
correlation `1daa1904-90ed-42c4-9136-141c141363a3`. One observer executed.
Both tag and immutable-digest manifest GETs returned HTTP 200 through private
login endpoint `.5` with hostname/SNI/certificate validation. The target raw
manifest matches source authority; payload descriptor is the approved archive
digest, `application/gzip`, 4,679,642 bytes.

Initial blob GET returned HTTP 307. Sanitized Location metadata: HTTPS,
approved Canada Central data hostname, default port, query present.
Observer returned `BLOB_REDIRECT_INVALID` from its own URI guard before
any data-endpoint request. The particular rejected URI detail was not emitted;
the saved evidence cannot distinguish userinfo, fragment, empty/nonabsolute
path, or double-leading-slash path. Do not claim that Azure's redirect is
invalid or that DNS/TLS/data-endpoint permissions failed. Guard compatibility
or diagnostic granularity may be a software limitation; no corrected execution
is authorized. Executed bytes remain preserved unchanged.

`REDIRECT_COUNT = 0`; data-endpoint DNS/TLS/HTTP/body/hash NOT_RUN. Source/target
archive equivalence remains UNRESOLVED; no archive was written, extracted or
executed. Package/configuration digest unchanged. Exact extension retired.
Final state and retained historical evidence:
[readback report](evidence/G2_BLOB_READBACK_REPORT.md),
[final disposition](evidence/G2_BLOB_READBACK_FINAL_DISPOSITION.json).
No next ORAS execution/lifecycle packet is activated because delivery is not
PROVEN. No import, staging, network or RBAC changes; no rerun.

> **Status:** Private ORAS delivery PARTIAL. Builder tooling Reader and pre-import absence proven; source staged through existing build OIDC; exactly one server-side import succeeded. All temporary importer exceptions are retired. Private archive readback remains UNRESOLVED at `blob-http-failure`; no ORAS extraction/execution or synthetic-health push. Overall G2 FAIL.

## Current private import with builder verifier: partial

Reader assignment `6628bb3e-5e59-5dcb-9f7b-80b421a7a7f8` remains restricted
to builder metadata/content read on `g2-tooling`. The authenticated private
pre-import verifier proved the exact tag absent and was retired.

Source staging run [38148994904](https://github.com/anungis437/nzila-os/actions/runs/38148994904)
verified the approved archive SHA and one generic OCI manifest. Import-only
run [38149872921](https://github.com/anungis437/nzila-os/actions/runs/38149872921)
succeeded once using source digest
`sha256:644f66c67367de24eeb3c5d921d7cd31c59afe3d3965e7e82c41e104fdcc2f0f`.
Both isolated proof branches remain retained; main was not modified.

An overly broad local marker parser matched GitHub's echoed shell command as
well as the actual result. Its assertion triggered the transaction's `finally`
before post-readback. This ordering deviation is recorded, not erased: bypass
was restored and both transaction-created importer roles removed after
289.894698 seconds. The import success marker was recovered from the same run;
the import was not repeated and broader exceptions were not reopened.

Three terminal post-import observers ran under restored private-only controls,
each with newly bound source/template/provider/exact-one-Create gates and
extension retirement. The original failed with opaque `ValueError`. The
host-specific private data-endpoint correction (`10.90.2.4`, distinct from
registry `10.90.2.5`) was necessary but not sufficient; the corrected observer
also failed. The final diagnostic-only observer emitted `blob-http-failure`.
That identifies a non-200 archive retrieval response, not its HTTP status,
response body, failing host, or root cause. Do not infer a 401/403 or a network
permission defect. No target archive SHA or content-equivalence PASS is claimed.

All three attempts preserved the package/configuration digest
`14a842cd6529f89932f59e02abd00a90febb23eb2387094e15307878678287bb`.
Temporary verifier workspaces use context-managed cleanup on success/failure;
no payload was extracted or executed. Extension retirement does not imply
agent execution logs/cache are erased.

Current local validation: twenty private-import regressions PASS; diagnostic
Bicep build/lint PASS; provider validation and raw FullResourcePayloads gate
PASS (one exact extension Create, no Modify/Delete/Unsupported).
Historical executed verifier/test snapshots are retained separately from
the corrected and diagnostic source. Source/import artifacts are retained
without unauthorized deletion. Final evidence and exact outstanding blocker:
[private delivery report](evidence/G2_PRIVATE_IMPORT_REPORT.md) and
[final disposition](evidence/G2_PRIVATE_IMPORT_FINAL_DISPOSITION.json).

Authority `G2_STAGE2A_PRIVATE_IMPORT_WITH_BUILDER_VERIFIER` explicitly changes
ordering: establish exact steady builder Reader to `g2-tooling`, run pull-only
pre-import CSE, require authenticated tag absence and retire extension, stage
exact archive through existing build OIDC, bind source digest, apply temporary
importer roles/bypass, import once, execute separately hashed post verifier,
tear down broader exceptions regardless of readback outcome, retire extension,
and verify protected16 plus lasting Reader only. No ORAS extraction/execution.

Historical pre-execution status: Validated for exact Reader and pre-import observer only. Twelve verifier regressions pass; exact
Reader and CSE templates build/lint without warnings. Preserve historical
status and all evidence. Existing subscription/tenant/Canada Central are fixed
by the written mission authority. No new compute/network/private staging
substrate, no SSH/Run Command, no product-lane changes.

Source/test/template hashes and raw provider/what-if gates will be bound before
each exact Reader/extension deployment. Only exact Create records may execute.
The pre/post observer requests repository `g2-tooling:pull`, keeps authentication
material only in memory, pins private TLS and emits bounded sanitized results.
Post verification may hash one temporary archive blob but never extract it.
Removal after terminal extension execution is authorized; it is not cancellation.
Stop on PRESENT or UNRESOLVED collision without opening import exceptions.

### Private-import validation checklist

- [x] All validation checks pass
  - [x] Shared core helper: CLI/auth/build/provider validate/what-if for Reader and pre observer
  - [x] Bicep lint and twelve focused pull-only verifier tests
  - [x] Policy context: no inherited/applicable assignments returned for exact RG scope
- [x] Static role contract: builder Repository Reader only metadata/content read
      to exact g2-tooling; no catalog/write; source/runtime roles untouched.
- [x] Content-addressed source/template/parameters and raw exact-Create gate

### Section 7: Private-import validation proof

Both `validate-deployment.ps1 -Scope group -ResourceGroup
nzila-g2-proof-xre47vggs5uhw -Subscription
5d819f33-d16f-429c-a3c0-5b0e94740ba3` invocations with exact Reader/pre-CSE
templates and evidence parameter files: OVERALL PASS. Bicep build/lint PASS.
`python -m unittest discover -s infrastructure/landing-zone/g2-builder/stage2a/private-import
-p test_verifier.py -v`: twelve tests PASS, zero skipped.
Applicable policy list empty; static Reader metadata/content-only role PASS.
Fresh raw FullResourcePayloads validation/what-if for each: exact one intended
Create, zero Delete/Unsupported/Modify. Shared text helper counted two Creates;
raw structured records supersede that non-authoritative textual summary.
Evidence `G2_PRIVATE_IMPORT_PRE_SOURCE_AUTHORITY.json`,
`G2_PRIVATE_IMPORT_READER_EXECUTION_GATE.json` and
`G2_PRIVATE_IMPORT_PRE_EXECUTION_GATE.json` binds exact bytes and scope.

## Historical transactional import: private target observation prerequisite blocked

The `G2_STAGE2A_TRANSACTIONAL_ACR_IMPORT` packet now explicitly accepts the
temporary source/target importer roles and target `None -> AzureServices -> None`
as transactional, not steady-state, exceptions. These are no longer rejected
permission/network ceilings. Fresh identity/source role recheck passes.

An exact deterministic change/rollback plan was recorded, but no transaction
opened: target tag-collision and content readback require an established private
observer. Trusted-service ACR import does not make the hosted client a private
data-plane reader. The workstation pinned private HTTPS test timed out; no
private runner was found. Builder guest execution is explicitly prohibited,
and builder tooling Reader is ordered only after teardown.

`STAGE2A_PRIVATE_ORAS_DELIVERY_PARTIAL`;
`TARGET_COLLISION_AND_CONTENT_READBACK_CONTEXT_NOT_AUTHORIZED`.
No source staging, role/bypass changes, import, builder Reader or guest action.
Protected16 and existing assignments remain unchanged; actual steady RBAC
delta 0. Import/ORAS execution authority unconsumed. No teardown was needed.

[Transaction preflight report](evidence/G2_STAGE2A_TRANSACTIONAL_ACR_IMPORT_REPORT.md)
and [exact planned changes](evidence/G2_STAGE2A_TRANSACTIONAL_ACR_IMPORT_TRANSACTION_CHANGE_PLAN.json)
record the remaining dependency: a separately bounded read-only private
observer and explicit pre-teardown identity/ordering contract. No new staging
substrate is designed. No Stage 2B or Stage 3.

## Historical ACR-to-ACR import feasibility: exact prerequisites blocked

The `G2_STAGE2A_ACR_IMPORT_FEASIBILITY` packet is read-only. Existing source
`nzilacanadaacr` is Basic/Canada Central, public Enabled with no firewall rules,
LegacyRegistryPermissions. Existing build OIDC AcrPush permits source tooling
writes registry-wide; current configuration and historical hosted OIDC/push
success substantiate the source path without a new workflow.

Microsoft documents server-side ACR-to-ACR OCI artifact import without client
private line-of-sight to G2. Both home regions/tenant match. No new private
staging substrate is intrinsically required by this supported design.

`ACR_TO_ACR_TOOLING_DELIVERY_BLOCKED`: target bypass is `None`; documented
network-restricted import requires `AzureServices`. No setting was enabled.
Combined Data Importer and Data Reader grants registry-wide read/catalog/import
authority, not documented exact repository conditions. That scope is unaccepted.
Existing build principal is proposed importer for planning only.

[Feasibility report](evidence/G2_STAGE2A_ACR_IMPORT_REPORT.md) and
[next-decision proposal](evidence/G2_STAGE2A_ACR_IMPORT_NEXT_DECISION_PROPOSAL.md)
record exact network/role ceilings. No upload/import/role/registry mutation.
Protected count 16 and authorization delta 0; ORAS authority unconsumed.
Import is not conclusively rejected; do not create a new staging substrate.
Top validation status still applies only to historical inventory execution.

## Historical tooling identity/RBAC gate: private substrate required

The subsequent `G2_STAGE2A_TOOLING_IDENTITY_RBAC` packet permits read-only
identity/path discovery and conditionally at most two exact repository role
assignments. Six shared automation candidates were reviewed. Existing
`nzila-os-build` OIDC principal `bfa4a851-696a-4d3f-927b-5fb1526f79f2` is the
preferred planning selection: repository-bound build federation, no stored
password/certificate credentials and one existing role on a different registry.

Its observed GitHub-hosted execution context has no established private G2 ACR
path. No repository self-hosted runner was found; G2 VNet peerings are empty,
private DNS links only locally, and the sole VM is the excluded builder.
`STAGE2A_TOOLING_IDENTITY_RBAC_BLOCKED`;
`TOOLING_PRIVATE_STAGING_SUBSTRATE_REQUIRED`.

Protected infrastructure count is 16; authorized RBAC resource count delta is
0. This explicitly separates authorization resources from protected topology.
No roles, identities, network resources, workflows or artifacts were changed.
No provider/write gate was reached. ORAS authority remains unconsumed.

[Identity/path report](evidence/G2_STAGE2A_TOOLING_IDENTITY_RBAC_REPORT.md) and
[next-boundary proposal](evidence/G2_STAGE2A_TOOLING_IDENTITY_RBAC_NEXT_AUTHORITY_PROPOSAL.md)
record the findings and least-state options. Validation status at the top still
applies only to the completed inventory slice, not this blocked execution gate.

## Historical private ORAS delivery: first RBAC gate stopped

The current `G2_STAGE2A_PRIVATE_ORAS_DELIVERY` packet was evaluated read-only.
Accepted ACR API `2025-11-01` confirms `AbacRepositoryPermissions`; only the
builder Writer/runtime Reader have observed ACR repository data actions, both
conditioned exactly to `synthetic-health`. No authorized existing `g2-tooling`
staging principal was established, and builder tooling read is not granted.
Inherited management roles do not substitute for ABAC repository permission.

`TOOLING_STAGING_PRINCIPAL_AVAILABLE = NO`. Stop as required by the first gate.
No upload/download, guest execution, role/principal change or Azure mutation.
ORAS authority remains unconsumed. Exact sixteen-resource protected state,
existing roles, frozen source and historical evidence remain unchanged.
Stage 2A artifact proof remains PARTIAL; overall G2 FAIL.

[First-gate report](evidence/G2_STAGE2A_PRIVATE_ORAS_RBAC_GATE_REPORT.md) and
[exact role proposal](evidence/G2_STAGE2A_PRIVATE_ORAS_PROPOSED_EXACT_ROLE_AUTHORITY.json)
record the next prerequisite: nominate an existing nonpersonal private-path
staging identity and separately authorize exact tooling Writer/builder Reader
assignments, including their IDs and lifecycle. Explicitly reconcile additive
RBAC resources with the packet's no-new-ARM/unchanged-protected-state wording.
No runtime tooling grant, registry-wide access or egress broadening.

The validation status above applies only to the completed historical inventory
slice; it does not authorize or validate private ORAS execution.

## Current corrected Phase 1 retry

User authorization: `G2_STAGE2A_PHASE1_INVENTORY_RETRY`, 2026-10-10.
Check current `2.1` family, raw sixteen-resource/Stage 1 and failed-evidence
hash chain, then bind a new source authority. Existing `autoUpgradeMinorVersion`
and `enableAutomaticUpgrade` remain false: Azure selects Patch.Hotfix within
Major.Minor 2.1 at deployment; exact patch is not source-pinned.

Pre-review source was copied byte-exact to new non-overwriting evidence.
Newly discovered scope defect: inventory requested ACR `pull,push` scoped token.
Remove that exchange/token flow before authority binding; retain only targeted
IMDS observation. Add explicit DNS/HTTPS statuses for this packet and tests
rejecting ACR token exchange or write methods. No Stage 1 source changes.

Validate via the governed workflow, fresh provider validation and raw exact
one-child Create what-if. Immediately recheck all hashes/state before consuming
the new one-shot authority. Capture sanitized result, retire only exact child
if it exists, verify sixteen protected resources. Stop regardless of tooling.
No automatic retry and no Phase 2.

### Corrected retry validation checklist

- [x] All validation checks pass
  - [x] Governed core helper: CLI/auth, Bicep build, fresh validate/what-if
  - [x] Lint and twelve inventory regressions
  - [x] Policy context checked for exact existing scope
- [x] Static role/source review: no identity/role resource; targeted builder
      IMDS GET only; ACR private unauthenticated GET; no token exchange/write.
- [x] Fresh source/script/settings/template/parameter hashes recorded in
      `G2_STAGE2A_RETRY_SOURCE_AUTHORITY.json`; old failed hashes preserved.

## Current bounded Stage 2A plan

Authority: user packet `G2_STAGE2A_BUILDER_ARTIFACT_PROOF`, 2026-10-10.
Preserve all historical sections below as chronology, not current execution authority.

1. Adjudicate Microsoft.Azure.Extensions / CustomScript Linux 2.1.19, root
   execution, embedded nonsecret script, output persistence, sequence-number
   reruns and exact child-resource retirement.
2. Recheck frozen Stage 1 hashes and raw sixteen-resource estate/roles, VM agent
   Ready, builder-only UAMI attachment and absence of conflicting extensions.
3. Prepare content-addressed inventory only; review and test no installation,
   package-source/network configuration changes, secrets in output or image push.
4. Validate extension-only Bicep/ARM and require one exact extension Create;
   reject unrelated modifications or resource creation.
5. Execute Phase 1 once only after all gates; capture sanitized result and retire
   only that extension. Recheck exact sixteen-resource protected estate.
6. If tools are missing or unresolved, stop without installation/build/push.
   If present, separately bind/review a second one-shot synthetic build/push
   payload before proceeding under the conditional Phase 2 authority.
7. Propose Stage 2B runtime-only substrate; do not attach runtime UAMI to builder
   or create any Stage 2B resource.

The user specifies the existing subscription/tenant and Canada Central. Only
the temporary extension child addition/removal is authorized infrastructure
change in this slice. No Storage resource, new role, new network rule or VM
replacement. Extension framework files/logs necessarily change; this is not
guest filesystem immutability. Package/configuration state must remain unchanged.

Plan confirmation was attempted through the confirmation tool; the user was
unavailable. Proceeding only on the packet's explicit conditional Phase 1
create/execute/remove authority, not an inferred blanket deployment approval.

### Stage 2A validation checklist

- [x] All validation checks pass
  - [x] Core helper: CLI/auth, Bicep build, provider validation and what-if
  - [x] Bicep lint
  - [x] Azure Policy validation for exact extension-only Canada Central scope
- [x] Inventory tests: 9 PASS, zero skipped
- [x] Static role review: extension template creates no identity or role;
      payload uses existing targeted builder UAMI and private ACR flow only.
- [x] Build/lint and source authority recorded in
      `.azure/evidence/G2_STAGE2A_PHASE1_PAYLOAD_AUTHORITY.json`.

Generated: 2026-10-08
Approval recorded: 2026-10-09

---

## 1. Project Overview

**Goal:** Close the synthetic-only G2 private builder design and source/infrastructure proof. Replace the Node synthetic health probe with a standard-library Go service and a static `FROM scratch` image; deliver committed source through deterministic VM Custom Data; use a private, non-admin ACR with managed-identity authentication; bound ordinary builder egress; and prepare reproducible Bicep plus evidence.

**Path:** Modify existing project, in the isolated branch `g2/synthetic-health-source`.

**Mission:** `NZ-20261008-INFRA-001`

**Gate:** `G2_PRIVATE_CONTROL_PLANE` / `G2_HERMETIC_BUILDER`

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Proof of concept — isolated synthetic infrastructure proof only |
| Scale | Small — one temporary builder VM and one synthetic artifact |
| Budget | Cost-Optimized — capacity only for this short build; report 1-, 4-, and 24-hour costs |
| Subscription | Azure subscription 1 Nzila (`5d819f33-d16f-429c-a3c0-5b0e94740ba3`); read-only provider checks/structured what-if and the separately authorized isolated Stage 1 discovery estate only |
| Location | Canada Central (`canadacentral`), as required by the mission |
| Data/compliance | Synthetic data only. No Cora, UE, customer, producer, certification, personal, or institutional audit data. No US AI endpoints. |
| Deployment boundary | Stage 1 authorization permits only isolated synthetic discovery-estate deployment in Canada Central. No image push, package/toolchain installation, `apt update`, package egress, new/broader egress, product workload, production/staging mutation, DNS cutover, merge to `main`, Run Command, or cleanup of pre-existing identities/resources is authorized. |

The user explicitly approved this plan on 2026-10-09 and confirmed the classification and subscription. Canada Central is explicit in the mission.

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| Synthetic health probe | API | Existing Node.js source; proposed Go standard library | `infrastructure/landing-zone/synthetic-health` |
| Temporary image builder | Infrastructure proof | Ubuntu 24.04, cloud-init, Buildah candidate | New G2 Bicep resources |
| Artifact registry | Infrastructure dependency | Private Azure Container Registry Premium | G2-only registry boundary |
| Private network and egress | Infrastructure dependency | VNet, builder subnet, NSG, UDR, private endpoint/DNS, Azure Firewall Basic candidate | New G2 Bicep resources |

The isolated branch currently contains the committed synthetic source only; the G2 infrastructure definitions from the shared worktree are not present in this branch. They will not be copied from or used to disposition the shared/foreign worktree. The accepted source baseline is `92f706b61a2077eeda5d8ac733ee361d51a2d3b9`, archive SHA-256 `6c80eac1cc48d34c42ea092a228d9b6a76fca206b68cf50ad37a9ed91c631152`.

## 4. Recipe Selection

**Selected:** Bicep with Azure CLI for read-only validation and structured what-if.

**Rationale:** The request explicitly requires Bicep build/lint, emitted-template validation, Azure validation, and structured what-if. No AZD application deployment or deployment execution is in scope.

## 5. Architecture

**Stack:** One temporary private Linux VM, source delivered by Custom Data/cloud-init, static synthetic OCI image pushed to a private G2 ACR.

### Service Mapping

| Component | Azure Service | Planned profile |
|-----------|---------------|----------------|
| Temporary builder | `Microsoft.Compute/virtualMachines` | Small burstable Linux VM candidate, no public IP, no inbound administration; final SKU subject to package/build proof and regional availability |
| Builder identity | `Microsoft.ManagedIdentity/userAssignedIdentities` | Dedicated builder UAMI; no Contributor |
| Builder network | `Microsoft.Network/virtualNetworks`, `subnets`, `networkSecurityGroups`, `routeTables`, `networkInterfaces` | Dedicated builder and private-endpoint subnets; default outbound routed through the selected egress control |
| Egress | `Microsoft.Network/azureFirewalls` plus a static public IP candidate | Azure Firewall Basic is the leading candidate for auditable, exact FQDN HTTPS/HTTP package rules; builder subnet only |
| Registry | `Microsoft.ContainerRegistry/registries` | Premium, public network disabled, admin disabled, trusted-service bypass `None` |
| Registry path | `Microsoft.Network/privateEndpoints`, private DNS zone and link | Private ACR endpoint, private DNS, no application Storage resource |
| Build evidence | VM boot diagnostics | Azure-managed storage; cloud-init proof output explicitly mirrored to the serial console; retrieval command is `az vm boot-diagnostics get-boot-log` |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Azure-managed boot diagnostics | Retrieve serial-console build result without a customer Storage Account |
| Builder UAMI | Obtain a short-lived ACR token and push only to the G2 artifact boundary |
| Separate runtime identity | Pull-only role; must not receive push permission |
| Private DNS | Resolve the ACR private endpoint and required ACR data endpoints |

### Proposed Build and Network Contract

- Implement only `GET /health/liveness` and `GET /health/readiness`; preserve 404, 405, JSON body, and `Cache-Control: no-store` behavior; use Go standard library only and `CGO_ENABLED=0` for Linux AMD64.
- Final image is `FROM scratch`, includes only the static binary, runs as a numeric non-root UID, and has no external base image or CA bundle unless a demonstrated requirement exists.
- Candidate Ubuntu packages: `golang-go` and `buildah`, with only dependencies proven necessary. Both are available from Ubuntu 24.04 package listings; exact package closure and actual Azure-image APT source endpoints remain implementation gates.
- No Docker Hub, GitHub, third-party package repository, Docker Inc. repository, curl-to-shell installer, public Entra browser flow, Run Command, generic Internet rule, wildcard FQDN, or `AzureCloud` rule for orchestration.
- Exact package FQDNs and ports must be derived from the selected Ubuntu 24.04 Azure image's actual APT source configuration. Do not author the allowlist from generic Ubuntu assumptions.
- Platform/link-local IMDS traffic is classified separately from ordinary Internet egress. Registry data-plane calls resolve privately and do not traverse the ordinary Internet egress path.
- Candidate managed-identity sequence: request an IMDS token with `resource=https://containerregistry.azure.net/` and `Metadata: true`; exchange it at the private registry's `/oauth2/exchange`; request a narrowly scoped registry token for `repository:<repository>:pull,push`; pass it transiently to Buildah; remove transient auth material; push and capture the resulting digest. The audience and exchange/token steps are checked against the [ACR managed-identity guidance](https://learn.microsoft.com/azure/container-registry/container-registry-authentication-managed-identity) and [ACR AAD OAuth flow](https://azure.github.io/acr/AAD-OAuth.html). Runtime identity, Buildah compatibility, and push remain unproven and prohibited in Stage 1.
- Boot diagnostics is GA and the CLI `get-boot-log` command is GA. Microsoft documents it as serial/console output retrieval and notes logs may take time to appear. The source design must tee the single structured proof record to the serial console; no end-to-end runtime retrieval can be claimed without a later, separately authorized deployment.

### Provisioning Limit Checklist

**Purpose:** No resources will be deployed in this plan; therefore the deployable-resource count is zero and subscription quotas are not consumed. Read-only `az quota list` completed for Microsoft.Compute and Microsoft.Network in Canada Central. Compute reports 10 regional vCPUs with a 10-vCPU Standard BS family limit (usage field not returned); the quotas API marked virtual-machine count and network VNet count as not applicable. These values do not establish actual SKU availability or image availability.

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| All Azure resource types | 0 | No change | Not applicable | Source preparation, validation, and read-only what-if only; no deployment authorized |
| Microsoft.Compute / Standard BS family | 0 | Unchanged | Limit 10 regional vCPUs; usage unavailable in response | No capacity is consumed. Fresh SKU/usage check required before any separately authorized deployment. |

**Policy constraints observed:** Subscription policy listing returned the default Azure Security Center audit-only assignment and a management-group policy blocking West Europe. No returned policy names a Canada Central restriction. The final provider validation must still report policy/what-if results against the selected subscription.

## 6. Execution Plan (Stage 1 discovery deployment only)

1. Rebaseline isolated branch and worktree; keep the shared worktree untouched.
2. Verify the selected Ubuntu 24.04 image's actual APT source configuration without contacting package repositories or allowing package egress; verify documented ACR managed-identity token-flow prerequisites; determine whether managed boot diagnostics can retrieve the marked cloud-init proof.
3. Implement Go service and behavior-parity tests; replace the Node image with the `FROM scratch` image contract.
4. Run source tests and static Linux AMD64 build. Commit only the synthetic source changes to the existing G2 branch; regenerate deterministic archive from committed blobs; record commit and archive SHA-256.
5. Implement only the builder-inclusive G2 Bicep resources and static negative contract tests. Keep builder and runtime identities distinct; no production/staging references.
6. For Stage 1 only, emit discovery-only cloud-init Custom Data that does not install packages, update APT, build, or push; it must emit a token-free marked JSON result record to serial output and collect actual image/APT/network/identity facts. ACR token exchange may be tested only if available with the base image and without package installation, egress changes, or image push.
7. Estimate final architecture costs in Canada Central for 1, 4, and 24 hours, including VM, OS disk, Firewall/public IP, ACR Premium, private endpoint, data processing, package traffic, and other billed components.
8. Run Go/source tests, static binary build, OCI/Docker check, Bicep build/lint, emitted-template validation, focused contract tests, `git diff --check`, Azure validation, and structured JSON what-if. Before deployment, verify fresh inventory and a create-only what-if that exactly matches this isolated Stage 1 discovery scope.
9. Deploy only the approved Stage 1 discovery estate after validation completes; retrieve boot/serial and runtime discovery evidence. Do not push an image or execute Run Command. Classify Stage 1 using only `STAGE1_DISCOVERY_PROVEN`, `STAGE1_DISCOVERY_PARTIAL`, or `STAGE1_DISCOVERY_FAILED`. Overall G2 remains `FAIL`; no merge to `main`.

### Stage 1 authorization boundary

Stage 1 is an isolated synthetic discovery deployment—not approval for the full builder bootstrap. Keep `approvedAptSources` empty and do not open package egress. Do not install packages, run `apt update`, compile or build an image on the VM, push an image, or expose product data. Collect actual cloud-init/serial, image, APT configuration, private-network/ACR reachability, and IMDS managed-identity metadata without printing credentials or tokens. If any required control cannot be observed without crossing this boundary, report it as a blocker; do not substitute a broader mechanism.

## 7. Validation and Acceptance

### Corrected Phase 1 retry validation proof — 2026-10-11 UTC

Execution outcome: `STAGE2A_PHASE1_INVENTORY_PROVEN`.
Deployment `g2-stage2a-inventory-retry-20261011-005512` Succeeded; correlation
`66796730-fb41-446f-9e0f-f29b124cad8a`. Exactly one sanitized result marker:
private DNS 10.90.2.5, private HTTPS 401 challenge and targeted IMDS HTTP 200
with exact client/principal/tenant correlation PASS. Package/configuration
before/after hashes equal. Shell/Python 3.12.3/curl 8.5.0 present; all observed
OCI builders and Go absent. No package action or artifact operation.

Exact child removed under written retirement authority; final sixteen-resource
raw estate and role contracts match frozen Stage 1, all old evidence hashes
unchanged. Follow-up proof requires toolchain prerequisite adjudication before
any valid Phase 2 build/push; this plan is not permission to install packages.
See current retry report and next-authority proposal in new evidence.

- `python -m unittest discover -s infrastructure/landing-zone/g2-builder/stage2a -p test_inventory.py -v`: 12 PASS, zero skipped. Scope regression initially matched allowed IMDS oauth2 path; test narrowed to ACR exchange endpoint before authority binding.
- `az bicep build --file infrastructure/landing-zone/g2-builder/stage2a/inventory-extension.bicep --outfile .azure/evidence/G2_STAGE2A_RETRY_TEMPLATE.json`: PASS.
- `az bicep lint --file infrastructure/landing-zone/g2-builder/stage2a/inventory-extension.bicep`: PASS.
- Governed `validate-deployment.ps1 -Scope group -ResourceGroup nzila-g2-proof-xre47vggs5uhw -Template infrastructure/landing-zone/g2-builder/stage2a/inventory-extension.bicep -Parameters .azure/evidence/G2_STAGE2A_RETRY_PARAMETERS.json -Subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3`: OVERALL PASS.
- Fresh exact JSON `az deployment group validate`: PASS; saved new retry provider result.
- Fresh `az deployment group what-if --result-format FullResourcePayloads --no-pretty-print`: PASS, exactly one intended extension Create; sixteen Ignore; no Modify/Delete/Unsupported. Helper summary duplicates Create count; raw records are authority.
- Current subscription policy listing unchanged `SecurityCenterBuiltIn`; no policy error in fresh provider validation.
- Static source review: no new role/identity/network resources; no ACR exchange or push authentication; only targeted IMDS GET and private ACR GET.
- `git diff --check`: PASS. Current `2.1` family queried and available; minor/automatic upgrades false. Script and resolved settings hashes bound; previous failed-attempt evidence verified unchanged.

### Stage 2A Phase 1 validation proof — current slice

#### Subsequent execution outcome

- Deployment `g2-stage2a-inventory-20261011-001517`: FAILED before child creation.
- Correlation `8f988eb2-e40b-4dd7-8191-3c8201b47a47`; operation `B42A284648DBE244`.
- Error: `InvalidParameter`, target `typeHandlerVersion`: "The value of parameter typeHandlerVersion is invalid."
- Root cause: package release `2.1.19` was incorrectly used as the extension
  property. Microsoft documents that customers can specify only Major.Minor;
  platform selects Patch.Hotfix. This is a source-authoring mistake, not a
  provider-schema waiver.
- No inventory, private-path recheck, auth, package change, build or push.
- Exact extension absence confirmed; no Delete was issued because no child
  existed. Fresh final raw sixteen-resource baseline matches frozen Stage 1.
- Historical failed source/template and authority preserved. Current source-only
  `2.1` correction and regression test do not renew consumed authority. No
  corrected provider validation/what-if/deployment was attempted.

The successful pre-deployment checks below remain historical evidence, not
current retry permission or proof that Compute accepted handler version syntax.

- `python -m unittest discover -s infrastructure/landing-zone/g2-builder/stage2a -p test_inventory.py -v`: 9 PASS, zero skipped. Initial Windows mock/AST-test defects corrected before any Azure mutation.
- `az bicep build --file infrastructure/landing-zone/g2-builder/stage2a/inventory-extension.bicep`: PASS.
- `az bicep lint --file infrastructure/landing-zone/g2-builder/stage2a/inventory-extension.bicep`: PASS.
- Governed `validate-deployment.ps1 -Scope group -ResourceGroup nzila-g2-proof-xre47vggs5uhw -Template infrastructure/landing-zone/g2-builder/stage2a/inventory-extension.bicep -Parameters .azure/evidence/G2_STAGE2A_PHASE1_PARAMETERS.json -Subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3`: OVERALL PASS.
- Exact emitted JSON independently provider-validated: PASS, saved `G2_STAGE2A_PROVIDER_VALIDATION.json`.
- Fresh structured `FullResourcePayloads --no-pretty-print` preview: exactly one extension Create; sixteen protected resources Ignore; no Modify/Delete/Unsupported. Saved raw evidence and gate.
- The helper's compact summary counted two Creates; the actual structured resource records contain exactly one Create. No deployment relies on that summary count. Initial pretty-output JSON parsing failed locally; structured capture corrected without source changes.
- Policy: fresh RG assignment listing empty; subscription listing contains existing `SecurityCenterBuiltIn` initiative, consistent with the earlier Stage 1 policy record. Exact provider validation has no policy error; no new identity/network/compute profile is being submitted.
- Static roles: extension-only source creates no roles or identity. Existing builder targeted IMDS client, tenant and principal correlate; runtime remains unattached. Private ACR auth check is not static proof of cross-repository denial.
- `git diff --check`: PASS.
- Exact script expression and raw CRLF source bytes verified; no historical source/template/evidence was changed. Initial local emitter-expression/newline assertions corrected before authority finalization.

Only after completing the governed validation workflow may status become
Validated and the deployment skill be invoked for the bounded Phase 1 execution.

### Fresh-boot execution complete - 2026-10-10

The governed workflow resumed successfully. Single replacement deployment
`g2-stage1-freshboot-20261010-193024` succeeded, correlation
`bf6cc464-63f1-4b83-82d7-439fb34da3f4`. The old VM alone was deleted,
existing NIC/old disk retention verified, and the same-name VM created using
the same NIC/UAMI and exact V2 first-boot payload with a distinct FromImage
disk. Exact old detached disk retirement completed after dependency checks.

`STAGE1_DISCOVERY_PROVEN`; all required V2 literal serial, deb822 (zero errors),
attachment/targeted token/correlation and private ACR network/exchange proofs
PASS. No token bodies persisted; no package update/install/build/push, SSH,
Run Command or Stage 2. Final estate sixteen resources; protected network
semantics and role contracts unchanged. NIC read-only VM-derived suffix
transition is explicitly correlated, not a configured DNS change.

Fresh-boot authority is consumed. No further attempt is authorized.
Overall G2 remains FAIL. Prior stops/partial results below are historical.
See [execution report](./evidence/G2_FRESH_BOOT_RESUME_EXECUTION_REPORT.md)
and [final disposition](./evidence/G2_FRESH_BOOT_RESUME_FINAL_DISPOSITION.json).

### Fresh-boot governed preparation restored - 2026-10-10

- [ ] All validation checks pass:
  - [x] Core validation: CLI/auth, Bicep build, provider validation and what-if.
  - [x] Bicep lint and 22 V2 tests, zero skipped.
  - [x] Azure Policy validation.
  - [x] Exact VM-only difference gate; immediate destructive recheck still required.

Fresh-boot validation proof (2026-10-10):

- `validate-deployment.ps1 -Scope group -ResourceGroup nzila-g2-proof-xre47vggs5uhw
  -Template <session fresh-boot-validation.bicep> -Parameters
  G2_FRESH_BOOT_RESUME_VM_ONLY_PARAMETERS.json -Subscription
  5d819f33-d16f-429c-a3c0-5b0e94740ba3`: OVERALL PASS.
  The helper uses an isolated decompiled Bicep representation, not the deployed
  execution artifact. Exact authority JSON independently validates below.
- `az deployment group validate --template-file
  G2_FRESH_BOOT_RESUME_VM_ONLY_TEMPLATE.json --parameters
  @G2_FRESH_BOOT_RESUME_VM_ONLY_PARAMETERS.json`: PASS.
- `az deployment group what-if --result-format FullResourcePayloads
  --no-pretty-print` with the same exact template/parameters: PASS.
  VM NoChange; exact StandardSSD_LRS NoEffect corroborated by raw OS disk SKU;
  protected resources Ignore. No Delete/Unsupported/Create or semantic Modify.
  Separate authorized VM DELETE/recreate and old-disk retirement are explicitly
  enumerated; what-if is not misrepresented as a deletion cascade preview.
- `az bicep build --file infrastructure/landing-zone/g2-builder/main.bicep
  --stdout`: PASS; `az bicep lint` on the same file: PASS.
- `python -m unittest discover -s <builder tests> -p test_*.py`: 22 PASS,
  zero skipped; DNS/NSG, VM/firewall/preservation and negative contract scripts:
  PASS. `git diff --check`: PASS.
- MCP Azure policy assignment review: PASS for proposed Canada Central VM;
  inherited West Europe restriction not applicable, SecurityCenter audit-only.
  Exact policy list persisted; provider validation contains no policy denial.
- Static role verification: PASS via exact scoped identity/condition contract
  tests; no role declarations submitted by VM-only template.

Raw proof and content hashes: `G2_FRESH_BOOT_RESUME_PROVIDER_VALIDATION.json`,
`G2_FRESH_BOOT_RESUME_WHATIF_RAW.json`,
`G2_FRESH_BOOT_RESUME_EXECUTION_GATE.json`.

Preparation completed: exact V2 VM-only ARM projection and parameters are
stored as `G2_FRESH_BOOT_RESUME_VM_ONLY_TEMPLATE.json` and
`G2_FRESH_BOOT_RESUME_VM_ONLY_PARAMETERS.json`. VM definition is unchanged from
the authorized inner candidate except removal of external-resource dependsOn;
compiler metadata/outputs removed. Outer default tags are explicitly inherited.
No protected resource is submitted. Baseline and hashes bound in
`G2_FRESH_BOOT_RESUME_PREPARATION.json`.

Local checks: 22 discovery tests, zero skipped; Bicep build/lint; exact DNS/NSG,
VM/firewall/preservation and negative contracts; git diff --check all PASS.
This Ready for Validation status is not permission to delete before remaining
provider/what-if and immediate destructive gates pass.

The required azure-prepare invocation now succeeds. Resume existing unconsumed
fresh-boot authority, not a new architecture or execution approval. Prepare a
VM-only incremental desired-state template with unchanged VM semantics except
the exact V2 first-boot payload. Protected resource definitions will not be
submitted. Before mutation verify sixteen exact IDs/raw state/roles and bound
V2 hashes, local tests, provider validation and fresh FullResourcePayloads
what-if. Only authorized VM fresh boot and exact old-disk retirement may differ.

Execution order: final gated pre-delete snapshot; delete old VM only; verify
unattached NIC, retained old disk and unchanged protected state; create same-name
VM using retained NIC/UAMI and fresh disk/image; retrieve serial proof; delete
exact old detached disk only after distinct replacement disk and absence of
dependencies are proven. No automatic retry or unrelated cleanup.

### NIC retention continuation: documentation closure, tool-workflow stop - 2026-10-10

Microsoft's deletion FAQ explicitly documents default persistence of disks,
NICs and public IPs. Fresh exact sixteen-resource raw state and role comparison
passed; V2 source/template/infrastructure and prior evidence hashes match.
NIC omission now has documented DETACH/PERSIST behavior; OS disk remains
explicit Detach. No live patch is required.

The required azure-prepare skill invocation failed twice with a tool-hook
error. Preparation/validation/deployment workflow was not bypassed. No provider
validation, what-if, deletion, replacement or guest execution occurred.
Fresh-boot authority remains unconsumed; Stage 1 PARTIAL and overall G2 FAIL.
Historical Validated status is still Retry 2-only, not replacement eligibility.

See [NIC retention closure](./evidence/G2_FRESH_BOOT_NIC_RETENTION_CLOSURE.md)
and [fresh baseline](./evidence/G2_FRESH_BOOT_RETENTION_CLOSURE_BASELINE.json).

### Fresh-boot authorization: pre-delete safety stop - 2026-10-10

New authority permits one conditional same-name fresh-boot VM replacement;
it does not reuse consumed Retry 2. Preparation began with exact V2 hashes
and read-only sixteen-resource/role refresh. No Azure write occurred.

The raw 2024-11-01 VM model explicitly reports OS disk Detach but omits the
NIC-reference deleteOption. Exact API schema does not declare an omitted
default, so mandatory NIC retention/reuse proof is unresolved.
`VM_REPLACEMENT_TOPOLOGY_UNRESOLVED`; fresh-boot authority remains unconsumed.
Stage 1 remains PARTIAL; overall G2 remains FAIL.

The Validated status above is historical Retry 2 validation, not validation
or deployment eligibility for this new replacement slice. No replacement
provider validation/what-if/deletion/creation was performed. No Ready for
Validation handoff is made while the mandatory preparation safety gate fails.

See [replacement safety report](./evidence/G2_FRESH_BOOT_VM_REPLACEMENT_SAFETY.md)
and [exact pre-delete estate](./evidence/G2_FRESH_BOOT_PREDELETE_ESTATE.json).

### Retry 2 execution and current runtime disposition - 2026-10-10

The single deployment `g2-stage1-retry2-20261010-180236` succeeded, correlation
`4bd2f1d8-e66a-41e0-acdc-4968c8e1b039`, with 21 successful nested operations.
Pre-create live/source/hash checks passed. The estate contains sixteen
resources, preserving all twelve prior resources and adding VM, managed OS
disk, Basic firewall and dedicated management public IP. VM private-only,
Dynamic NIC address, disabled passwords, Basic data/management configurations,
management /26, ACR controls and exact conditioned identity roles were verified.

`STAGE1_DISCOVERY_PARTIAL`; overall G2 `FAIL`.
Boot retrieval succeeded and a complete V1 discovery JSON record was recovered
from interleaved serial output, but its status is DISCOVERY_INCOMPLETE.
Required start/result literal strings are absent; APT observation reports 35
deb822 parse errors; target identity metadata assertion fails despite successful
IMDS token and ACR exchange requests. Private ACR DNS/HTTPS and token exchange
are PASS. No token bodies were persisted; no package/build/push/administration
or Stage 2 action occurred.

Retry 2 authority is consumed. No third retry or cleanup is authorized. The
Validated status records pre-deployment checks, not complete runtime proof.
See [execution report](./evidence/G2_RETRY2_EXECUTION_REPORT.md),
[authoritative final disposition](./evidence/G2_RETRY2_FINAL_DISPOSITION.json),
and [verified runtime record](./evidence/G2_RETRY2_RUNTIME_DISCOVERY_VERIFIED.json).
Earlier runtime capture interpretations are preserved but superseded by the
verified decoded/interleaved-record extraction.

### Retry 2 provider-schema ceiling execution gate - 2026-10-10

The active authorization accepts only exact NIC kind=Regular,
allowPort25Out=false and PE isIPv6EnabledPrivateEndpoint=false response/schema
mismatches, each omitted from source. Provider issue snapshots and independent
local/live correlations are recorded without adding undocumented IaC.

- [ ] All validation checks pass:
  - [x] 1. Core Validation (CLI, auth, build, validate, what-if).
  - [x] 2. Bicep lint.
  - [x] 3. Azure Policy Validation.
  - [x] Nine discovery tests and all negative/DNS/NSG/VM/firewall/preservation contracts.
  - [x] Unchanged content authority and exact final tolerated property manifest.
  - [x] Fresh three-Create what-if; zero Delete/Unsupported/unresolved/unrelated paths.
  - [ ] Final twelve-resource estate, VM/firewall absence, tenant/subscription and key checks.

All earlier Failed/Unresolved entries below are historical records. The exact
ceiling acceptance is not a security, product readiness, Stage 2 or cleanup gate.

#### Provider-schema ceiling validation proof

- Bicep build and lint against current main.bicep: PASS; emitted template SHA-256
  remains `5569AA608DE8AFAE7FBFBE41A6037EF425455377506C1F770C715434532666BD`.
- `python -B -m unittest discover -s tests -p test_discovery.py -v`: PASS,
  nine tests; discovery source bytes unchanged.
- `dns-retry-contract.tests.ps1`, `negative-contract.tests.ps1`, and
  `vm-firewall-contract.tests.ps1` against current template/parameters/baseline:
  PASS, including all preservation and administration negative mutations.
- `git diff --check`: PASS.
- Static role verification: two distinct UAMIs; builder repository writer and
  runtime repository reader scoped to the private ACR and synthetic-health
  condition; exact previous role deltas unchanged; no Contributor/Owner.
- Fresh `az deployment sub validate`: PASS, Succeeded, correlation
  `ba4aa194-2a57-43b7-83bd-f83cf2145126`.
- Fresh `az deployment sub what-if --result-format FullResourcePayloads
  --no-pretty-print`: PASS, three Create, seven Modify, eight NoChange,
  one Ignore, zero Delete/Unsupported. Every leaf matches the exact manifest;
  all three previously unresolved paths match the accepted schema ceiling.
  New raw execution evidence was captured even though its deterministic hash
  equals the previous raw result.
- Fresh effective policy read returned SecurityCenterBuiltIn; provider validation
  returned no policy error.
- Exact local/live ceiling and unchanged source/template/parameters/public-key
  hashes: PASS. Current estate remains twelve resources, VM/firewall absent.
- `CURRENT_PARTIAL_ESTATE_WHATIF=PASS`; conditional Retry 2 deployment authorized
  YES, subject to immediate final live/hash recheck.

See the new ceiling, tolerated-modify, provider validation, raw what-if and
execution-gate JSON records. No deployment has run at this validation snapshot.

### Retry 2 Network RP semantics closure - 2026-10-10

`NETWORK_RP_PUT_SEMANTICS_UNRESOLVED`; current what-if FAIL; Retry 2 deployment
authorized NO. Seven exact-source non-mutating controls passed provider
validation and what-if execution. DNS declarative state and dynamic-IP
retention semantics closed. Proven writable live values were preserved in
source: VNet policy Disabled, NIC auxiliaryMode/Sku None, TCP tracking enabled,
and IPv4 version. Dynamic allocation remains unpinned; no policy value changed.

Required build/lint, nine discovery tests, existing negative/DNS/NSG contracts,
and VM/firewall/preservation regressions (ten negative mutations) passed.
`git diff --check` passed. Fresh provider validation returned Succeeded,
correlation ID `d5617a7f-4e1e-4ff4-aa4d-18be99fec635`. Final raw what-if remains
three Create, seven Modify, eight NoChange, one Ignore, zero Delete/Unsupported.
The prior ACR/role paths remain identical. The remaining unwaived paths are NIC
kind, NIC allowPort25Out and PE isIPv6EnabledPrivateEndpoint. Their exact
public writable/read-only/default/update contracts were not established.

The new source/template authority supersedes the preceding source bytes only
for these reviewed preservation corrections; prior evidence remains unchanged.
No deployment or cleanup occurred; current twelve-resource inventory matches.
The corrected revision is not marked Validated. See
[the semantics report](./evidence/G2_RETRY2_NETWORK_RP_PUT_SEMANTICS.md) and
[machine-readable evidence](./evidence/G2_RETRY2_NETWORK_RP_PUT_SEMANTICS.json).

### VM + Firewall Basic corrective retry 2 - 2026-10-10

Authority: `G2_STAGE1_DISCOVERY_RETRY_2_VM_FIREWALL_CORRECTION`.
The current twelve-resource baseline, not the original six-resource estate or
eight-Create gate, is authoritative. Corrections are limited to one proof-only
SSH public key, the smallest available management `/26`, a distinct static
Standard management public IP, and Basic firewall management configuration.
No existing subnet is resized and no administrative ingress is authorized.

- [ ] All validation checks pass:
  - [ ] 1. Core Validation (CLI, auth, build, validate, what-if).
  - [ ] 2. Bicep lint.
  - [ ] 3. Azure Policy Validation.
  - [x] Discovery tests: nine passed; discovery and cloud-init bytes unchanged.
  - [x] Existing negative contracts and exact five-rule DNS/NSG contracts.
  - [x] VM authentication and Basic management-plane regressions, including
    negative mutations, existing subnet preservation, no VM public IP, and no
    inbound administration.
  - [ ] Content-addressed source, template, parameters, public-key and what-if
    authority; exact live inventory and unchanged retained-security deltas.
  - [ ] Three remaining resource Creates and only the narrow VNet management
    subnet addition; no unrelated Create/Modify, Delete or Unsupported.
  - [x] Revised cost evidence including the second public IP.

#### Corrective retry 2 validation proof and stop

- `az bicep build --file infrastructure/landing-zone/g2-builder/main.bicep`
  and `az bicep lint --file infrastructure/landing-zone/g2-builder/main.bicep`:
  PASS.
- `python -B -m unittest discover -s tests -p test_discovery.py -v`
  (from the builder directory): PASS, nine tests.
- `vm-firewall-contract.tests.ps1` with the corrected template, parameters and
  baseline: PASS, six rejected negative mutations.
- `dns-retry-contract.tests.ps1 -TemplatePath main.json`: PASS, exact five-rule
  contract and five rejected negative mutations.
- `negative-contract.tests.ps1`: PASS, discovery-only and private-ACR contracts.
- `git diff --check`: PASS.
- The azure-validate Bicep recipe helper: PASS for CLI/auth/build/provider
  validation/what-if execution. Its text-line change counts are not resource
  counts and are not used for the acceptance gate.
- Fresh `az deployment sub validate`: PASS, `Succeeded`, correlation ID
  `bd200de6-7497-4eef-afbc-86e3ae907b9c`.
- Fresh `az deployment sub what-if --result-format FullResourcePayloads
  --no-pretty-print`: execution PASS; acceptance FAIL. Raw result: three Create,
  seven Modify, eight NoChange, one Ignore, zero Delete/Unsupported.
- The exact prior ACR and two role-assignment deltas still match. Four other
  retained-resource Modifies are not covered by those waivers: builder NIC,
  private endpoint, private DNS zone group, and VNet (policy omission beyond
  the authorized management subnet addition). Their PUT semantics are not
  claimed equivalent without evidence.
- Current subscription policy read returned `SecurityCenterBuiltIn`. Provider
  validation returned no policy error. This does not establish a security PASS.
- Fixed retail equivalents including both public IPs: USD 0.53557/1 hour,
  2.14228/4 hours, 12.85369/24 hours, before variable charges. The management IP
  adds USD 0.005/hour; no standalone subnet charge is assumed.

See [the corrective retry 2 report](./evidence/G2_RETRY2_20261010_1720_REPORT.md)
and its content-addressed JSON evidence. The azure-validate workflow is stopped
at exact what-if acceptance; the corrected revision is not `Validated`.
No Azure create, cleanup, SSH, Run Command, package contact, image push, or
Stage 2 action occurred. Stage 1 remains `STAGE1_DISCOVERY_FAILED`; G2 is `FAIL`.

Fresh non-overwriting evidence uses prefix `G2_RETRY2_20261010_1720`.
The preceding failure record remains unchanged. This authorization allows one
conditional discovery-only deployment; it grants no third retry, cleanup, SSH,
Run Command, package installation, package contact, image build/push, or Stage 2.

### Corrected Stage 1 retry validation - 2026-10-10

The approved retry removes only `AllowPlatformDns`. Prior validation below is
historical, not authority for the corrected retry.

- [ ] All validation checks pass:
  - [ ] 1. Core Validation (CLI, auth, build, validate, what-if).
  - [ ] 2. Linting (optional).
  - [ ] 3. Azure Policy Validation.
  - [ ] Core validation: authenticated subscription/tenant, corrected Bicep build,
    provider validation, and saved raw structured what-if.
  - [ ] Bicep lint and emitted-template parity: only the DNS Allow object removed.
  - [ ] Existing negative contracts and focused DNS/identity/network regressions.
  - [ ] Effective policy and retained-estate drift checks.
  - [ ] Exactly eight intended missing creates; no Delete, Unsupported, unrelated
    Modify, retained payload change, or extra resource class.
- [ ] Record corrected IaC revision, template/parameter/what-if hashes and exact
  resource IDs before any single authorized retry.

Detailed current results will be recorded in
[G2_STAGE1_DISCOVERY_RETRY.md](./evidence/G2_STAGE1_DISCOVERY_RETRY.md).
The synthetic commit/archive are unchanged; corrected IaC provenance is separate.

The earlier stop below is superseded by the retained-resource PUT-semantics
resolution recorded in
[G2_RETAINED_RESOURCE_PUT_SEMANTICS.md](./evidence/G2_RETAINED_RESOURCE_PUT_SEMANTICS.md).
The final source explicitly preserves the Public IP values. Fresh validation and
what-if confirm the exact eight intended Creates, zero Deletes, zero Unsupported,
and three individually classified, semantically equivalent Modify resources.
No unrelated Modify or retained effective-state change remains. Stage 1 has not
yet been executed.

## Role Assignment Verification

- Status: Static role design verified; retained assignment deltas are reconciled as unevaluated references to the existing principals.
- Identities checked: builder UAMI and runtime UAMI; the builder UAMI is attached to the synthetic builder VM.
- Roles confirmed: builder UAMI has Container Registry Repository Writer and runtime UAMI has Container Registry Repository Reader, both scoped to the retained ACR and ABAC-limited to the `synthetic-health` repository.
- Remaining display delta: what-if reports both assignments as `Modify` because it compares current principal-ID values with ARM identity-reference expressions. Fresh UAMI and assignment reads confirm matching principal IDs, deterministic assignment IDs, roles, ACR scope, and repository conditions. No role assignment was changed during validation.

### Earlier validation proof (historical; superseded for the current retry)

- [x] Core Validation: the Azure CLI account was confirmed against the approved subscription; `az deployment sub validate` returned `error: null`.
- [x] Bicep linting: `az bicep build --file main.bicep` and `az bicep lint --file main.bicep` passed.
- [x] Emitted-template and negative contract checks: `tests/negative-contract.tests.ps1` passed the discovery-only guard, five prohibited-mutation checks, and base-template checks.
- [x] Focused discovery tests: `python -m unittest discover -s tests -v` ran 3 tests with 0 failures and 0 skips; `python -m py_compile discovery.py tests\test_discovery.py` passed.
- [x] Go source: `go test ./...` and `go vet ./...` passed. The static Linux/AMD64 build and local `FROM scratch` image/health check passed earlier on this branch; the image was removed and never pushed.
- [x] Historical structured JSON what-if: the earlier result contained 17 `Create` changes and no `Modify`, `Delete`, or `Unsupported` changes. It is not the current retry preview.
- [x] Static role review: builder uses repository-conditioned `Container Registry Repository Writer`; runtime uses repository-conditioned `Container Registry Repository Reader`; neither receives `Contributor` or `Owner`.
- [ ] Critical runtime and complete-cost gates: exact Ubuntu image APT facts, actual ACR token exchange, retrievable boot/serial output, and complete traffic costs remain unproven. Keep `BOOTSTRAP_NOT_READY`.

The historical structured what-if targeted isolated Canada Central Stage 1 resources. Its result is superseded by the current authority-gate preview below.

### Initial discovery-authority what-if (2026-10-10; superseded)

- `az deployment sub validate --subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3 --location canadacentral --template-file infrastructure\landing-zone\g2-builder\main.json --parameters @.azure\evidence\G2_STAGE1_RETRY_PARAMETERS.json --only-show-errors -o json` — PASS; correlation ID `e2210754-8b75-4b56-88de-3a4d1b341a33`.
- `az deployment sub what-if --subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3 --location canadacentral --template-file infrastructure\landing-zone\g2-builder\main.json --parameters @.azure\evidence\G2_STAGE1_RETRY_PARAMETERS.json --result-format FullResourcePayloads --no-pretty-print --only-show-errors -o json` — ARM response `Succeeded`; exact counts: 8 Create, 4 Modify, 0 Delete, 0 Unsupported, 5 NoChange. The eight Creates match the intended list, but the four retained-resource Modifies fail the retry gate. Raw response: `.azure/evidence/G2_DISCOVERY_AUTHORITY_WHATIF_RAW.json`.
- `pwsh -NoProfile -File <azure-validate>/references/recipes/scripts/validate-deployment.ps1 -Scope sub -Location canadacentral -Template .\infrastructure\landing-zone\g2-builder\main.bicep -Parameters .\.azure\evidence\G2_STAGE1_RETRY_PARAMETERS.json -Subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3` — PASS as a command sequence; its formatted-text change counter reported 9 Create / 7 Modify / 5 Delete and is superseded by the complete structured JSON counts above.
- No Stage 1 deployment was run. The exact zero-Modify condition is not met; the plan remains unvalidated.

### Retained-resource semantics and final retry validation (2026-10-10)

- `az bicep lint --file infrastructure\landing-zone\g2-builder\main.bicep` — PASS.
- `az bicep build --file infrastructure\landing-zone\g2-builder\main.bicep --outfile infrastructure\landing-zone\g2-builder\main.json` — PASS; template SHA-256 `7489E5E80C3E4B92BBB2BF44A3D3A188AF94846E12DAED10226D661BAFB90562`.
- `python -m unittest discover -s tests -p test_discovery.py` — PASS; 9 tests.
- `pwsh -NoProfile -File infrastructure\landing-zone\g2-builder\tests\dns-retry-contract.tests.ps1 -TemplatePath infrastructure\landing-zone\g2-builder\main.json -BuilderDirectory infrastructure\landing-zone\g2-builder` — PASS.
- `pwsh -NoProfile -File infrastructure\landing-zone\g2-builder\tests\negative-contract.tests.ps1 -BuilderDirectory infrastructure\landing-zone\g2-builder` — PASS.
- `git diff --check` — PASS.
- `az deployment sub validate --subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3 --location canadacentral --template-file infrastructure\landing-zone\g2-builder\main.json --parameters @.azure\evidence\G2_STAGE1_RETRY_PARAMETERS.json --only-show-errors -o json` — PASS; provisioning state `Succeeded`; correlation ID `e43d7adf-40d9-4849-b47f-1371f34c7e21`.
- Fresh `az deployment sub what-if` using `FullResourcePayloads` — PASS; 8 Create, 3 Modify, 6 NoChange, 0 Delete, 0 Unsupported. The Create set exactly matches the original authorization. Raw response SHA-256 `1D5D294E2A6672DC9483D2657591D85779BD171BB0935468593C31DE2F2E1056`, saved as `.azure/evidence/G2_DISCOVERY_AUTHORITY_WHATIF_POST_PRESERVATION.json`.
- The three Modify resources are individually classified in `.azure/evidence/G2_STAGE1_TOLERATED_WHATIF_MODIFIES.json`: the two omitted ACR properties resolve to live-equivalent provider defaults; two role-assignment principal references resolve to the existing UAMI IDs and preserve role, scope, and ABAC condition. The Public IP is NoChange after explicit preservation.
- Fresh live inventory matches all six retained baseline resources; zero NSGs/canaries remain. `Microsoft.Network` is Registered. Current subscription policy inventory contains `SecurityCenterBuiltIn`; no returned assignment names a Canada Central restriction.
- Content-addressed source, template, and parameter hashes are recorded in `.azure/evidence/G2_RETAINED_RESOURCE_PUT_SEMANTICS.json`. Earlier evidence files remain unchanged.
- At validation completion, the workflow recorded the plan as `Validated`; the authorized Stage 1 attempt below ran afterward and failed. The validation status records pre-deployment checks, not successful deployment or runtime proof.

### Authorized Stage 1 runtime attempt (2026-10-10) — FAILED

- The single authorized subscription deployment `g2-stage1-retry-20261010-1627` failed with correlation ID `091c3906-e372-4a10-8f8d-974f63551cf4`.
- ARM rejected the builder VM because neither SSH public-key authentication nor username/password authentication was enabled; the template disables passwords and supplies an empty SSH key list.
- ARM rejected Azure Firewall Basic because `managementIpConfiguration` is missing.
- Seventeen nested deployment operations succeeded and two failed. The partial estate contains the original six retained resources plus the Stage 1 NSG, VNet, builder NIC, ACR private endpoint, its managed NIC, and private DNS VNet link. The VM and firewall were not created.
- Post-failure reads reconfirmed the retained ACR, Public IP, and ACR role-assignment effective values. No cleanup or further resource mutation was performed.
- No VM boot, cloud-init, serial, or discovery evidence exists. No ACR token exchange or image push was attempted. Stage 1 is `STAGE1_DISCOVERY_FAILED`; overall G2 remains `FAIL`.
- The single authorized retry is consumed. No second deployment or cleanup is authorized. See [G2_STAGE1_RETRY_DEPLOYMENT_FAILURE_20261010.md](./evidence/G2_STAGE1_RETRY_DEPLOYMENT_FAILURE_20261010.md) and its JSON operation record.

## Role Assignment Verification

- Status: Verified statically; the Azure role definitions were also read from the target subscription.
- Builder identity: `Container Registry Repository Writer`, scoped to the isolated ACR and ABAC-conditioned to the `synthetic-health` repository.
- Runtime identity: `Container Registry Repository Reader`, scoped to the isolated ACR and ABAC-conditioned to the `synthetic-health` repository.
- Other assignments: None in the G2 builder template. No `Contributor` or `Owner` role is assigned.
- Stage 1 boundary: role assignments are provisioned for the isolated proof estate, but no registry push is attempted.

- All required tests run with zero skips.
- Hash mismatch aborts before package installation, compilation, image build, authentication, or push.
- Bicep and contract tests prove no builder public IP/inbound management, no broad egress, no external image, no registry bypass/admin credential, separate identities, no builder Contributor, no runtime push, exact G2 registry boundary, and no production/staging references.
- The initial structured what-if exposed retained-resource `Modify` deltas and blocked deployment. After explicit preservation and semantic review, the final pre-deployment what-if passed with eight authorized Creates and three individually classified Modifies, as documented above. The subsequent authorized runtime attempt failed; that failure does not change the recorded pre-deployment validation result.
- If an exact Ubuntu egress allowlist, supported managed-identity token flow, or retrievable boot proof cannot be established, disposition remains `BOOTSTRAP_NOT_READY`.

## 8. Cost Estimate

### Canada Central fixed-cost baseline

Live Azure Retail Prices API rates (USD, consumption/PAYG) and the official Private Link/Private DNS pricing pages were used for a Stage 1 fixed-cost baseline. The registry daily unit is conservatively charged as one full day even for the 1- and 4-hour cases; the E4 disk and DNS-zone monthly units are prorated on a 730-hour month.

| Component | Unit rate | 1 hour | 4 hours | 24 hours |
|-----------|-----------|-------:|--------:|---------:|
| Linux Standard_B2s VM | $0.0464/hour | $0.0464 | $0.1856 | $1.1136 |
| Azure Firewall Basic | $0.395/hour | $0.3950 | $1.5800 | $9.4800 |
| Standard IPv4 public IP | $0.005/hour | $0.0050 | $0.0200 | $0.1200 |
| One Private Endpoint | $0.01/hour | $0.0100 | $0.0400 | $0.2400 |
| E4 StandardSSD_LRS OS disk | $2.64/month | $0.0036 | $0.0145 | $0.0868 |
| ACR Premium registry unit | $1.6666/day | $1.6666 | $1.6666 | $1.6666 |
| One Private DNS zone | $0.50/month | $0.0007 | $0.0027 | $0.0164 |
| **Fixed-cost baseline** | | **$2.1273** | **$3.5094** | **$12.7234** |

These totals exclude variable traffic and DNS query charges. Relevant variable rates are Azure Firewall Basic data processing at $0.065/GB, Private Link data processing at $0.01/GB, ACR stored data at $0.10/GB-month where applicable, and Private DNS queries at $0.40 per million for the first billion monthly queries. Package-download bytes and applicable outbound Internet transfer tier have not been established; actual package traffic is not zero-cost evidence. VNet, NSG, route table, role assignments, managed identities, NIC, and Azure-managed boot-diagnostics storage have no separate line item identified in this baseline.

This is not a complete final-build cost gate: package traffic volume and the applicable Internet egress tier remain unresolved, and no image push or package download is authorized. Do not use the baseline to claim full builder cost closure.

## 9. Risks, Limitations, and Human Actions

- This plan does not authorize actions beyond the separately approved Stage 1 discovery boundary. No image push or production/staging change is authorized.
- The package source FQDNs must be verified from the exact image configuration; third-party search claims are not accepted as evidence.
- The ACR token audience/exchange protocol is now checked against first-party ACR references; runtime success, Buildah token acceptance, and push remain unproven.
- Boot diagnostics documents serial log retrieval, not guaranteed capture of arbitrary cloud-init stdout. The result must be directed to the serial device and retrieval documented; without runtime evidence, do not claim end-to-end proof.
- Existing G2 infrastructure is absent from this clean branch. Any final what-if must identify all resources and must not claim convergence with unseen or foreign state.
- Full builder bootstrap, image push, package egress, and any deployment beyond Stage 1 require a separate explicit authorization and fresh quota/provider checks.
