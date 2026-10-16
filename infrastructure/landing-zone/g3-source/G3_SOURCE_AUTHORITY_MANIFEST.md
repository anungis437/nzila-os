# Prospective G3 source authority V1 - G3R2I amendment

Original lineage **PROSPECTIVE_G3R2**; image amendment **PROSPECTIVE_G3R2_IMAGE_QUALIFICATION**, authority **G3_SYNTHETIC_PROOF_V1**.
Eight modules remain; all nine Bicep entrypoints compile. Historical recovery remains **0/7**.
[Manifest](./G3_SOURCE_AUTHORITY_MANIFEST.json) binds the [new workload](./workload/synthetic-proof/README.md),
verified builder digest, matching binary hashes, proof contracts and local config digest.
The local config digest is not a registry manifest: a future authorized immutable ACR digest is still required.

The [frozen G3R2 source snapshot](../g3-readiness-evidence/g3r2-frozen-source/G3_SOURCE_AUTHORITY_MANIFEST.json)
and every original G3/G3R1/G3R2 evidence file preserve the rejected candidate's BLOCKED decision.
Do not run the G3R2 writer on the amended source: it belongs to the frozen historical lane.
Use the G3R2I writer/checker for this prospective amendment.

ROOT-1 is CLOSED_BY_PROSPECTIVE_SUPERSESSION, not recovered. Local fake-secret HMAC proves application behavior,
not live Key Vault injection, identity/RBAC, private network reachability or deployment readiness.
Exactly two identities, locked-false provisioning/activation/RBAC flags, G2 external dependencies,
capacity gates, rollback and reconciliation remain unchanged. Controllers were not executed.

Remaining roots: accountable operator and separate human approver; explicit G2-side authority;
complete future costs and human ceiling. G3 execution BLOCKED; G3A/G3B NOT_AUTHORIZED.
