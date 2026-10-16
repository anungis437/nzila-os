# G3R2I image qualification - PASS

## Preservation and lineage

Rejected synthetic-health candidate unchanged. All G3/G3R1/G3R2 evidence preserved, including G3R2's BLOCKED
image decision. [Preservation manifest](./G3R2I_HISTORICAL_PRESERVATION.json) and the frozen source snapshot
retain exact bytes. New authority **G3_SYNTHETIC_PROOF_V1**, lineage **PROSPECTIVE_G3R2_IMAGE_QUALIFICATION**, is prospective, not historical recovery.

## Source, compiler and binary

[Qualification record](./G3R2I_IMAGE_QUALIFICATION.json) binds source/context/file digests, compiler and public
manifest verification. Builder **Go 1.26.9 linux/amd64**, `sha256:bcef992b77b1e2031aaaa51da75cebc32da8e9c182e12e633ea79023c79d9eff`; runtime **scratch**.
No dependency downloads, prebuilt host binary or floating execution authority.
Binary compiled twice under identical flags: **a4580e13a03bacce4e36ecfbd6090dcfc81eaedee8c5c3f57c172f9af7dfe341**, byte-identical.
Public Go version advisory checks found zero matches; this is bounded version evidence, not a full builder OS scan.

## Local build and runtime

Local image build **PASS**. Local image/config digest **sha256:76f0a7294abf7b6dcf25a717362077bb8f5df72dd4f47b5efa8ab980ddf6e4cf** is
**not** future ACR manifest authority. Health, independent HMAC challenge, different nonce/key, missing-secret
generic503 and malformed/oversize/content-type denial **PASS**. Fake secret disclosed **NO** across response,
stdout/stderr/log/error tests. UID/GID **65532:65532**, read-only root, no capabilities, no-new-privileges,
network none, no host published port, port3000 only, graceful SIGTERM.

## Integration and validation

[Local Bicep evidence](./G3R2I_LOCAL_BUILD_EVIDENCE.json): all nine entrypoints **PASS**, zero warnings/errors.
[Amended manifest](../g3-source/G3_SOURCE_AUTHORITY_MANIFEST.json) binds new source authority.
Proof manifest specifies exact HMAC protocol, non-disclosure, failure behavior and safe artifacts.
Ten future negative probes cover app-level denial and independent identity/network/capacity boundaries;
only fake local app probes ran. [Scanner](./G3R2I_SECRET_SCAN.json) has zero unresolved findings.
Raw source scanner findings remain explicit exact public-name/role-ID adjudications; config unchanged.
Existing G3R2 regressions validate the frozen source/evidence, not a rewrite of the accepted BLOCKED record.
[Validation record](./G3R2I_LOCAL_VALIDATION.json): 296 Node tests, 26 Go tests/subtests, 27 PowerShell
rejection cases, formatting, syntax, repeat-generation/hash checks and documentation audit with zero errors
(existing warnings retained). Local compiler tests use bounded executable temporary storage only;
the runtime requires no writes.

## Disposition and costs

ROOT-1 **CLOSED_BY_PROSPECTIVE_SUPERSESSION**. G3R2 **PASS by prospective supersession**.
Remaining roots: accountable operator/separate approver, explicit G2-side mutation authority,
complete future costs/human ceiling. BOM remains23 resources/3 inline subnets; runtime sizing unchanged.
Local qualification does not qualify a future private builder or close vault/registry/egress costs.
Known CAD scenario subtotals remain2.05/43.18/45.15/52.93/170.74; all-in ceiling unresolved, human ceiling unbound.

## Execution boundary

G3 execution **BLOCKED**, G3A/G3B **NOT_AUTHORIZED**.
Azure resource/RBAC/registry and G2 mutations **0**; no resource/identity/network creation or changes;
no Azure image build, push, live secret challenge, controller execution, G3A or G3B.
Local image build/container tests **YES**, explicitly authorized. Future immutable ACR digest **REQUIRED**.
