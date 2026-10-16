# DRAFT ONLY - corrected Stage2A production authority

Mission `NZ-20261008-INFRA-001`.
Proposed slice `G2_STAGE2A_OCI_REPAIRED_ARTIFACT_PRODUCTION`.

**EXECUTION_AUTHORIZED = NO**

**EXECUTED = NO**

Separate future approval is required. This local-only packet authorizes
neither CSE execution nor any registry read/write.

## Bound correction

Use [local source authority](G2_LOCAL_OCI_SOURCE_AUTHORITY.json) and
[actual manifest inventory](G2_LOCAL_OCI_MANIFEST_INVENTORY.json).
Config now requires exact `data="e30="`, embedded `{}`, size2 and digest
`sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`.
Manifest raw bytes must hash to
`sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690`.
Exact one payload layer digest
`sha256:2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db`,
size326. No new media types, layers, subject, annotations or timestamp.

Preserve payload bytes and target:
`synthetic-health:stage2a-2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db`.
Use the approved archive hash and temporary ORAS1.3.4.

## Proposed future execution contract

1. Rebaseline concurrency, protected16, source settings, target Disabled/None,
   no CSE/importer roles, exact private .5/.4 DNS/PE mappings and identities.
2. Fresh canonical operator ARM census of exact builder assignments:
   tooling Reader only, synthetic-health Writer only. No management roles.
   Bind assignment/scope/principal/definition/condition/version digest.
3. Hash-bind all fresh candidate/source/test/template/parameter/payload/
   manifest inputs. Full local tests plus build/lint/provider/raw exact-one-CSE
   Create and governed prepare/validate/deploy sequence required.
4. Immediately before one dispatch reread canonical ARM snapshot, require
   hash equality. Reserve/consume separate single-use execution authority.
5. Private tooling retrieval/hash/safe temporary extraction/version gate;
   original local ORAS layout command plus repaired exact fixture-derived
   validator. Stop on any output drift. No package/global install.
6. Immediate guest effective tooling read, tooling-write denial,
   unauthorized control-write denial and exact synthetic-health pull/push
   capability; no ARM access. Least-mutating probes only, no denied-repo
   manifest commit. Unexpected allowance stops without concealing evidence.
7. Authenticated bound-tag absence; no overwrite. One no-retry transfer of
   exact ORAS-created config/payload/manifest bytes, one tag/manifest commit.
   No controller/client retry. Preserve any partial result; no deletion
   authority or fallback tag.
8. Verify tag plus immutable manifest raw bytes/digest, payload readback/hash,
   config relationship, artifact type and media types. Reconfirm tooling
   write denial, then remove exact temporary tooling/auth/workspace.
9. Retire exact terminal CSE and reread ARM census; require pre/immediate/
   post hash equality and unchanged protected16/network/source/roles.

## Implementation acceptance required

The current fresh candidate uses ORAS for **local OCI packaging** and the
prior no-retry pinned Python uploader for remote transfer. It does not
perform an ORAS remote CLI push, whose built-in retry transport conflicts
with the strict no-retry contract. Future approval must explicitly accept
this packaging/transfer division; it is not silently assumed to be an
ORAS remote-push proof.

Do not infer approval from local contract PASS or from consumed prior
production authorities. Stage2B remains separate; no runtime identity
attachment, application rollout, product action or Stage3.
Overall G2 remains FAIL even if corrected Stage2A later succeeds.
