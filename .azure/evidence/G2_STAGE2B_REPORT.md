# Stage2B runtime identity boundary proof

Mission `NZ-20261008-INFRA-001`, gate `G2_PRIVATE_CONTROL_PLANE`.
Slice `G2_STAGE2B_RUNTIME_IDENTITY_PROOF`.

## Disposition

**STAGE2B_RUNTIME_IDENTITY_PROVEN**.
**OVERALL_G2 = FAIL**. UE and Cora remain **INFRA_NO_GO**.
This is a synthetic private-registry identity boundary proof, not product
production readiness, tenant isolation, DR, or broad security certification.

Exactly one deployment `g2-runtime-proof-20261012-000819` Succeeded.
Correlation `326d227d-37e1-4fb9-ba23-e13f236cfaae`.
Stage2B authority consumed; remaining executions zero.
Guest result captured 2026-10-12T00:10:56.922263Z.
Transaction teardown completed 2026-10-12T00:13:53.199464Z.

## Hard separation

Distinct VM `nzila-g2-runtime-proof`, NIC `nzila-g2-runtime-proof-nic`,
OS disk `nzila-g2-runtime-proof-osdisk`, CSE `nzila-g2-runtime-once`.
Only runtime UAMI `nzila-g2-runtime-y3koaeijzi6mu` attached.
Live VM identity readback matched runtime client/principal exactly.
No builder/other/system identity, public IP, Bastion, or SSH session.
Runtime-specific IMDS identity assertion PASS.
Builder had no guest execution, identity/RBAC/CSE changes, or artifact push.
No artifact was mutated during Stage2B.

Private Standard_B2s in Canada Central,32GB StandardSSD_LRS, pinned Ubuntu
24.04.202609040, existing BuilderSubnet/NSG references only.
No VNet/subnet/inbound/firewall/route configuration changes.
Preinstalled Python only; no package update/install, Docker, or ORAS.
Boot diagnostics disabled; sanitized CSE marker used for result capture.
RSA3072 provisioning public key bound to immutable parameters;
temporary local private key destroyed before deployment.

## Canonical authorization evidence

Runtime exactly conditioned synthetic-health Repository Reader.
Builder exactly conditioned tooling Repository Reader and synthetic-health
Repository Writer, unchanged from Stage2A. No management privilege added.
Census includes assignee assignments with inherited/group discovery.
Original scope/condition text/version retained, sorted by assignment id.

Predispatch, prevalidation, immediate predispatch, and post-teardown hashes:

`0e6214005c7de533e0facc7bbd631db6744ee8e5139bba0a3e2c071c688b445e`

All identical. This combined both-identity hash is intentionally different
from Stage2A's builder-only canonical hash; the underlying assignments match.

## Runtime read and deny results

| Boundary | Result |
|---|---|
| Runtime identity assertion | PASS |
| Private login DNS/pinned peer/SNI/TLS,10.90.2.5 | PASS |
| Private data DNS/pinned peer/SNI/TLS,10.90.2.4 | PASS |
| synthetic-health read by tag and immutable manifest digest | ALLOWED |
| Raw manifest/config/layer and payload integrity | PASS |
| synthetic-health write | DENIED |
| g2-tooling read | DENIED |
| g2-tooling write | DENIED |

Manifest:
`sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690`.
Payload:
`sha256:2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db`.
Readback size326, exact sealed bytes. Artifact type
`application/vnd.nzila.g2.synthetic-health.v1`; payload media
`application/vnd.nzila.g2.synthetic-health.v1+json`.
Strict reused validator binds inline config `e30=` and exact raw manifest
digest; tag and immutable-digest manifest bytes both validated.
Registry credential is never forwarded to the approved data redirect.

Denial checks require both an empty effective scoped grant and an authenticated
request reaching the registry with HTTP401/403 and UNAUTHORIZED/DENIED JSON.
No DNS, TLS, malformed request,404, or repository-existence fallback counts.
Write tests use empty upload-init POST only; no blob/manifest/tag commit exists
in the runtime request allowlist. Unexpected grants/allowed writes stop with
explicit security failure. No such failure occurred.
Exact HTTP401 versus403 is not retained individually in the compact guest
marker; the frozen executed code requires one of those two codes.

## Teardown and steady state

Transaction ownership checked against baseline absence, exact deployment
Create operations, VM/disk binding, and disk creation timestamp.
Deleted only exact transaction CSE,VM,NIC,OS disk. Zero residual resources.
Protected estate returned to16 with full original ARM body equality except
transport metadata etag/systemData. Private endpoint NIC/DNS A records/zone
group, protected resource IDs, target/source role snapshots, source registry,
builder identities, and runtime assignments unchanged.
Target public Disabled, bypass None, admin disabled.
Temporary importer roles absent; builder tooling Reader remains.
Runtime tooling access absent. Package/resolver configuration unchanged.
No Entra/ACR token, signed URI, Authorization header, raw error body, or raw
instanceview persisted. No provisioning private key retained.
Local generated adjacent compile removed; immutable template retained.

## Validation

- `python stage2b-controller.py prepare`: PASS,109 tests across nine suites
  (16 new runtime contracts +93 preserved tests), build/lint/diff checks,
  image/SKU/core availability, provisioning private-key destruction.
- `python stage2b-controller.py validate`: PASS,provider/raw/policy and census.
- Official `validate-deployment.ps1`: PASS,CLI/auth/build/provider/what-if.
- `az bicep build` / `az bicep lint`: PASS,no source lint warnings.
- `git diff --check`: PASS.
- Six extra controller exact-delta and ownership/nonterminal teardown tests: PASS.
- Raw FullResourcePayloads: Create3,NIC+VM+CSE; no Modify/Delete/Unsupported.
  The named implicit OS disk is bound separately. Helper textual Create4
  double-counts formatted output; it is not four explicit template resources.
- Actual Create operations exactly3,Succeeded. All four temporary resources
  were observed and removed.
- Governed azure-prepare / azure-validate / azure-deploy sequence completed.
- Final both-identity census,full estate,executed-source/history bindings: PASS.

## Concurrency and files

Branch `g2/synthetic-health-source`,HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`.
Before each write batch,status remained the two existing untracked areas
`.azure/` and `infrastructure/landing-zone/g2-builder/`.
No foreign work reverted or dispositioned; no UE/Cora files changed.
New sources: runtime script/template/16 tests under `stage2b/`.
Plan updated with current authority; prior plan hashes remain historical.
Stage2A sources/evidence preserved; Stage2B evidence exclusively created.

## Reconciled G2 chain and stop boundary

| Stage | Current proof | Evidence |
|---|---|---|
| Stage1 discovery | PROVEN | [Fresh-boot disposition](G2_FRESH_BOOT_RESUME_FINAL_DISPOSITION.json) |
| Stage2A private tooling delivery | PROVEN | [Private readback disposition](G2_EMPTY_PATH_FINAL_DISPOSITION.json) |
| Stage2A builder artifact production | PROVEN | [Corrected disposition](G2_CORRECTED_PRODUCTION_DISPOSITION.json) |
| Stage2B runtime boundary | PROVEN | [Runtime disposition](G2_STAGE2B_DISPOSITION.json) |
| Final private steady state |16,unchanged,no transient resources | [Final estate](G2_STAGE2B_FINAL_ESTATE.json) |

The stage chain is hash-bound in [reconciliation](G2_STAGE2B_EVIDENCE_CHAIN.json).
Current proof root: [final verification](G2_STAGE2B_FINAL_VERIFICATION.json).
Guest evidence: [sanitized result](G2_STAGE2B_GUEST_RESULT.json).
Teardown evidence: [exact deletions](G2_STAGE2B_TEARDOWN.json).

STOP. [Terminal G2 adjudication packet](G2_STAGE2B_TERMINAL_G2_ADJUDICATION_DRAFT.md)
is a proposal only,not adjudication or execution authority.
No application rollout or Stage3. Overall G2 FAIL remains until a separately
authorized terminal adjudication explicitly changes the gate disposition.
