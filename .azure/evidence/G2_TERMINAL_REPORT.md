# Terminal G2 adjudication

Mission `NZ-20261008-INFRA-001`. Authority: **READ_ONLY / EVIDENCE_ONLY**.

## Terminal ruling

**G2_PRIVATE_CONTROL_PLANE = PASS**

No surviving `G2_BLOCKER`. All recorded limitations are `OUTSIDE_G2`.
PASS is not inferred from a count of successful stages; the requirement
matrix below reconciles frozen evidence with fresh live steady state.
PASS_WITH_LIMITATIONS is not used to obscure an unproven invariant.

**STAGE3_AUTHORIZED = NO**
**APPLICATION_ROLLOUT_AUTHORIZED = NO**
**UE_INFRA = INFRA_NO_GO**
**CORA_INFRA = INFRA_NO_GO**

The accepted gate is a private target-registry/control foundation: bounded
separate builder/runtime identities, deterministic content-addressed artifact
path, private production and consumption, repository separation, no unsafe
public bypass, and restoration to governed steady state.
It is not a production-ready platform, product rollout approval, general
security certification, or private Azure ARM operator endpoint proof.

The [non-overwriting disposition](G2_TERMINAL_DISPOSITION.json) is authoritative.
The [mission/gate register](../mission-gate-status.json) and current
[plan status](../deployment-plan.md) reflect this new narrow ruling.
Historical overall G2 FAIL records remain unmodified.

## Required terminal outputs and requirement-to-evidence matrix

| Required check | Result | Exact evidence and interpretation |
|---|---|---|
| G2_EVIDENCE_CHAIN_INTEGRITY | PASS | [Five-root verification](G2_TERMINAL_INTEGRITY.json); referenced evidence/source bytes match, historical plans match exact suffix hashes, workflow matches |
| G2_FAILED_ATTEMPT_ACCOUNTING | COMPLETE | [Accounting](G2_TERMINAL_ATTEMPT_ACCOUNTING.json);26 phases,15 current ARM deployment records,all dedicated consumed records and bounded local/blocked phases |
| G2_FINAL_INFRASTRUCTURE_STATE | PASS | [Fresh estate](G2_TERMINAL_LIVE_ESTATE.json);16 exact protected bodies,zero unexpected/runtime transient resources,no CSE |
| G2_FINAL_REGISTRY_NETWORK_POSTURE | PASS | Fresh estate: target public Disabled,bypass None,admin disabled; approved PE/private DNS records/NIC/zone group unchanged |
| G2_FINAL_AUTHORIZATION_MATRIX | PASS | [Fresh exact census](G2_TERMINAL_LIVE_AUTHORIZATION.json) and [staging census](G2_TERMINAL_STAGING_AUTHORIZATION.json);exact conditioned roles,no management privilege or surviving importers/staging target role |
| G2_IDENTITY_SEPARATION | PASS | [Runtime substrate](G2_STAGE2B_RUNTIME_SUBSTRATE.json),[runtime result](G2_STAGE2B_GUEST_RESULT.json),[builder result](G2_CORRECTED_PRODUCTION_GUEST_RESULT.json);runtime-only distinct VM,read/write/tooling/control denials |
| G2_PRIVATE_PATH_PROOF | PASS | [Stage1](G2_FRESH_BOOT_RESUME_RUNTIME_DISCOVERY.json),[tooling readback](G2_EMPTY_PATH_OBSERVER_RESULT.json),builder/runtime results;private .5/.4 peer/DNS/SNI/TLS,production and consumption without target public fallback |
| G2_ARTIFACT_PROVENANCE | PASS | [Payload binding](G2_SYNTHETIC_PRODUCTION_PAYLOAD_BINDING.json),[local manifest](G2_CORRECTED_PRODUCTION_LOCAL_RUN1/manifest.json),builder/runtime readbacks;exact raw manifest and326-byte payload linkage |
| G2_SECRET_HYGIENE | PASS | Integrity scan of653 retained evidence files,manual narrative false-positive review,stage token-free markers and ephemeral-key destruction contracts;no durable token/Authorization/signed-query/private-key material found |
| G2_RESIDUAL_STATE | ACCEPTABLE | [Residual register](G2_TERMINAL_RESIDUAL_REGISTER.json);explicit STEADY_STATE/PROOF_EVIDENCE classifications,zero unsafe residuals,no adjudication cleanup |
| G2_SCOPE_INTERPRETATION | PASS | This report's accepted scope;all [limitations](G2_TERMINAL_LIMITATIONS.json) outside the gate,none waived inside it |

Protected infrastructure resource count: **16**.
Current Stage2A builder artifact: **PROVEN**.
Current Stage2B runtime identity: **PROVEN**.

## Phase A: root and chronological status integrity

Five roots verified before any live Azure read:

1. [Stage1 fresh boot](G2_FRESH_BOOT_RESUME_FINAL_VERIFICATION.json).
2. [Stage2A private tooling](G2_EMPTY_PATH_FINAL_VERIFICATION.json).
3. [Local deterministic OCI](G2_LOCAL_OCI_FINAL_VERIFICATION.json).
4. [Corrected builder production](G2_CORRECTED_PRODUCTION_FINAL_VERIFICATION.json).
5. [Runtime identity proof](G2_STAGE2B_FINAL_VERIFICATION.json).

682 unique hash-bound files verified across five roots and approved discovery
source/infrastructure authority. Both current sources and executed snapshots
match their respective stage authority. Historical failed bytes are not
compared dishonestly against later repaired sources.

Deployment-plan hashes are chronological,not expected to all equal today's
expanded plan. The original header plus each untouched historical section's
byte-exact suffix reproduces the recorded empty-path/local-OCI/corrected
production/Stage2B plan SHA. No guessed normalization or reconstructed edits.
Stage1's root records validation flags/template/parameters rather than a
separate plan SHA; its preserved preparation and report establish that scope.
Where recorded,the validation-workflow SHA equals the retained completed
UpdateStatus record. It is not represented as a fresh deploy authorization.

Latest baseline plan SHA before this authorized terminal section:
`70775b08ba00f6c297e5023a9a63337cc5ef4e84bd65d0975a2134f079e9201d`.
Older hashes remain bound to their exact chronology; no old root is overwritten.
Source authority consumption is consistent with bounded deployments and
zero remaining executions. This packet creates no technical execution authority.

## Phase B: failed/partial/blocked history reconciliation

The machine-readable [accounting](G2_TERMINAL_ATTEMPT_ACCOUNTING.json) preserves
all26 local,blocked,failed,partial and successful phases. Key closures:

| Historical boundary | Honest disposition and later closure |
|---|---|
| Initial Stage1 NSG provider error | Wire payload/root cause unavailable,not invented;failure retained. Later reviewed NSG/retry state converged and current private invariants are proven |
| Stage1 VM auth / Basic firewall failure | Empty SSH auth and missing management NIC corrected under separate authority;partial12 retained,then estate16 |
| Retry2 retained PUT delta stops | Exact Network RP/provider-schema ceiling reviewed before dispatch;no silent waiver |
| Retry2 serial/IMDS/deb822 partial discovery | Partial result preserved;source repair followed by one same-name fresh-boot replacement;old disk retired |
| Inventory2.1.19 handler rejection | No guest execution;separate2.1 retry proved inventory and honestly reported missing toolchain;CSE absent |
| Public ORAS/staging identity/private path/import feasibility stops | No unauthorized egress,RBAC,runner,import or bypass guessed;later explicit private source/import contract |
| Import parser-triggered teardown | Exactly one staging and successful server-side import. Echo/result parser stopped sequencing;289.894698s exception window closed,roles removed,bypass restored;no reimport |
| Post/corrected/diagnostic verifier failures | Opaque ValueError/blob-http-failure retained without invented status;each terminal CSE removed |
| Blob/redirect observers | Historical exact predicate unrecoverable by deliberate signed-URI nonpersistence. Separately authorized observer isolated current empty-path rejection;new closure proved307/.4/TLS/200/archive SHA |
| Initial production ARM-read stop | No management privilege added;explicit composite operator census/guest effective boundary authority superseded impossible guest ARM reread |
| Revised production local manifest failure | Private retrieval/version passed,descriptor check failed,no push;workspace/CSE removed,census unchanged |
| Local OCI repair and corrected production | Actual binary reproduced inline config;strict raw digest contract repaired. One no-retry push/manifest commit and exact immutable readback proved |
| Runtime identity proof | Distinct runtime-only VM proved read/denials,then CSE/VM/NIC/disk removed;estate16,census unchanged |

All dedicated consumed records are retained. Early subscription/nested
deployment history uses a reused nested ARM name; today's success for that
name is not substituted for earlier failed attempts. Immutable failed operation
snapshots account for those attempts. Some sanitized observer deployment
records contain name/status but omit correlation; fresh ARM listing is joined
by exact name or recorded correlation,not a fabricated historical value.

## Phases C-E: fresh live state and exact authorization

Readback completed approximately2026-10-12T00:43Z.
Full protected ARM bodies match accepted Stage2B state,excluding only transport
metadata etag/systemData. Private endpoint NIC,DNS A records,zone group,
target/source registry settings and assignment tuples unchanged.
No runtime VM/NIC/disk,CSE,Bastion,new public IP,runner or unexpected network
resource. Subscription-wide exact runtime-name query also returned empty.
Existing firewall data/management public IPs are part of accepted16,not VM
ingress or an added public fallback.

| Identity | Repository | Current exact role |
|---|---|---|
| Builder UAMI | g2-tooling | Repository Reader,present;Writer absent |
| Builder UAMI | synthetic-health | Repository Writer,present,exact condition |
| Runtime UAMI | synthetic-health | Repository Reader,present,exact condition |
| Runtime UAMI | g2-tooling | Reader/Writer absent |
| Existing staging/OIDC | G2 target/inherited scope | No surviving role |
| Temporary source/target importers | Source/target ACR | Absent |

Combined exact authorization SHA:
`0e6214005c7de533e0facc7bbd631db6744ee8e5139bba0a3e2c071c688b445e`.
Matches all four runtime-proof snapshots. Builder-only Stage2A hash is a
different scope and is not falsely equated to this combined digest.
Role definitions have no management-plane Actions. No registry-wide builder
AcrPush,runtime Writer,or wildcard repository scope introduced.
Staging's preexisting source-only permissions remain external and unchanged.

## Phases F-H: identities,private paths and provenance

Builder's role is artifact production. Runtime's role is consumption only.
Runtime proof's live VM readback had only runtime UAMI,not builder or another
identity. That VM no longer exists. Builder retains only builder UAMI.
Effective runtime synthetic-health write and tooling read/write denials
required authenticated registry401/403 authorization responses.
Builder tooling and cross-repository write denials were proven before/after
the single corrected artifact production. Network errors/404 do not count.

Private login host: `nzilag2tzo75uuozprbo.azurecr.io` -> `10.90.2.5`.
Private data host: `nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io` -> `10.90.2.4`.
Both builder and runtime evidence pin DNS and remote peer,real Host/SNI and
certificate validation. Dedicated data URI receives no registry Authorization.
No fresh guest network or registry data-plane test was executed here;retained
runtime evidence plus fresh ARM mapping/current closed posture establish
the adjudicated path. Management-plane access is not misrepresented as private.

| Digest domain | Exact value |
|---|---|
| Canonical synthetic source contract | `c55178058d1e2475066761759edda464fd9afc4eab6825d6048065d3ab5ab303` |
| Synthetic payload SHA / OCI blob | `2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db` |
| Synthetic OCI manifest | `13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690` |
| ORAS1.3.4 archive SHA | `f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454` |
| ORAS tooling OCI manifest | `644f66c67367de24eeb3c5d921d7cd31c59afe3d3965e7e82c41e104fdcc2f0f` |

OCI digests use the `sha256:` prefix. Payload326 bytes equals the runtime
readback;the manifest digest is distinct from source/blob digest.
Tag `stage2a-2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db`.
ORAS local packaging plus frozen no-retry uploader was explicitly approved;
native remote ORAS push is not claimed. Hash lineage is not cryptographic
signing,attestation,SBOM,or general software supply-chain certification.

## Phases I-J: hygiene and explicit residual classification

Local durable-evidence scanning found no JWT bodies,token fields,signed token
URLs or private-key material. Two `authorization` keys were reviewed as human
approval narratives,not HTTP headers. Sanitized runtime result contracts,
source behavior and ephemeral-key destruction records independently support
token hygiene. This is not an assertion that all Azure guest-handler caches
or provider logs were erased. No retained artifacts were cleaned.

| Retained element | Classification |
|---|---|
| Original16,builder VM/NIC/current disk,network/security/ACR/UAMIs | STEADY_STATE |
| Exact builder/runtime synthetic-health roles | STEADY_STATE |
| Approved builder g2-tooling Reader | STEADY_STATE |
| Existing firewall data/management public IPs | STEADY_STATE |
| Source/target ORAS tooling artifact | PROOF_EVIDENCE |
| Synthetic artifact/tag/manifest/payload | PROOF_EVIDENCE |
| Failed/success evidence,executed source snapshots,forensic local layouts | PROOF_EVIDENCE |
| Retained isolated source staging/import branches | PROOF_EVIDENCE |

The builder is the retained foundation,not the transient runtime probe.
No temporary execution CSE or interactive guest access workflow remains.
Source-only preexisting staging permissions are unchanged,not a new target
privilege. No proof-only runtime compute or unsafe public/import exception
survives.

## Phases K-L: limitations,all OUTSIDE_G2

Every following item is **OUTSIDE_G2**,not a concealed G2 blocker:

- Application/workload deployment and application runtime configuration.
- Database connectivity,data-plane integration and application secrets.
- DNS cutover,production data,staging/production migration.
- Monitoring/alerting,operational runbooks,scaling,availability/SLA.
- Backup/restore and disaster recovery.
- Product-specific validation and UE/Cora production readiness.
- Existing external source/staging ACR public/admin posture.
- Signing/attestation/SBOM and recurring CI/capacity/repeatability guarantees.
- Historical NSG wire-payload and opaque redirect forensic limits.
- Builder extension-handler cache/log erasure beyond retained token-free proof.
- Private Azure ARM operator management endpoint/device connectivity.

These are explicitly recorded in [limitations](G2_TERMINAL_LIMITATIONS.json).
No item is used to relax target private access,bounded identities,artifact
equivalence,denial evidence,exception closure,or16-resource restoration.
Institutional security/DR/reliability/audit/tenant-isolation gates remain
separate. Neither product is declared ready.

## Concurrency,validation and files

Isolated branch `g2/synthetic-health-source`,HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`.
Write baselines remained only existing untracked `.azure/` and
`infrastructure/landing-zone/g2-builder/`. No foreign changes reverted or
dispositioned;no product source edited.

New `G2_TERMINAL_*` outputs created exclusively,mission/gate register added,
terminal plan section prepended with historical suffix bytes preserved.
No original evidence/source/authority file overwritten or removed.
Current packet runs hash/schema/lineage/authorization/estate/document-link
checks and whitespace validation,not builds or new runtime tests. Prior109
tests and governed validation remain historical proof,not rerun claims.
No PR requested;monorepo PR-eligibility checks are not claimed.

The complete evidence chain is frozen by
[terminal integrity root](G2_TERMINAL_FINAL_VERIFICATION.json).
No Azure mutation,registry query/commit,guest execution,or retained proof
cleanup occurred. Read calls are recorded in
[read-only ledger](G2_TERMINAL_READ_ONLY_CALLS.json).

## Stop and next governance decision

[WHAT IS STAGE3?](G2_TERMINAL_STAGE3_GOVERNANCE_DECISION_DRAFT.md) is prepared
as a separate governance decision proposal only. It intentionally selects
none of application substrate,workload deployment,observability/operations,
data integration or another infrastructure gate.

Maintainers must define Stage3 and approve its bounded acceptance contract
and any execution separately. **No Stage3 or application rollout authorized.**
