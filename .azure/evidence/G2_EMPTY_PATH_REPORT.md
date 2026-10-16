# G2 Stage 2A empty-path redirect closure

Mission: `NZ-20261008-INFRA-001`.
Slice: `G2_STAGE2A_EMPTY_PATH_REDIRECT_CLOSURE`.

## Disposition

**STAGE2A_PRIVATE_ORAS_DELIVERY_PROVEN**

**OVERALL_G2 = FAIL**

This closes private archive delivery only. It does not prove ORAS execution,
synthetic-health artifact production, Stage 2B, Stage 3, or product readiness.
UE/Cora `INFRA_NO_GO` remains unchanged.

## Concurrency checkpoint

Branch `g2/synthetic-health-source`; HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`.
Isolated worktree; status remained `?? .azure/` and
`?? infrastructure/landing-zone/g2-builder/`.
HEAD/status refreshed before write batches. Previously untracked G2 work
was retained; no product-lane work was edited or dispositioned.
No new foreign delta detected in this isolated lane. This is not a census
or acceptance of unrelated changes in other worktrees.

## Runtime proof

| Field | Evidence |
|---|---|
| NONEMPTY_REDIRECT_PATH_REQUIREMENT | UNSUPPORTED_LOCAL_ASSUMPTION |
| HISTORICAL_REDIRECT_REJECTOR | UNRECOVERABLE_BY_DESIGN |
| EMPTY_PATH_REPAIR_SOURCE_AUTHORITY | CREATED |
| MANIFEST_BY_TAG_HTTP | 200 |
| MANIFEST_BY_DIGEST_HTTP | 200 |
| SOURCE_TARGET_MANIFEST_EQUIVALENCE | PASS |
| BLOB_INITIAL_HTTP_STATUS | 307 |
| CURRENT_REDIRECT_VALIDATION | PASS |
| REDIRECT_PATH_CLASS | EMPTY |
| REDIRECT_HOST | nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io |
| DATA_ENDPOINT_RESOLVED_IP | 10.90.2.4 |
| DATA_ENDPOINT_PRIVATE | YES |
| DATA_ENDPOINT_TLS | PASS |
| DATA_ENDPOINT_HTTP_STATUS | 200 |
| DATA_ENDPOINT_REMOTE_IP | 10.90.2.4 |
| DATA_ENDPOINT_CONTENT_LENGTH | 4679642 |
| DATA_ENDPOINT_BYTES_READ | 4679642 |
| REGISTRY_AUTH_HEADER_FORWARDED_TO_DATA_ENDPOINT | NO |
| TARGET_ARCHIVE_SHA256 | f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454 |
| SOURCE_TARGET_ARTIFACT_EQUIVALENCE | PASS |
| EMPTY_PATH_CLOSURE_AUTHORITY_CONSUMED | YES |
| CUSTOMSCRIPT_EXTENSION_PRESENT | NO |
| OVERALL_G2 | FAIL |

Manifest authority:
`sha256:644f66c67367de24eeb3c5d921d7cd31c59afe3d3965e7e82c41e104fdcc2f0f`.
Its digest domain differs from the archive SHA. Saved source manifest bytes
hash to that authority; both target manifest reads retain that digest.
The descriptor and streamed bytes also match the approved archive.

Deployment `g2-empty-path-20261011-222120`: Succeeded.
Correlation `69dd7efb-754d-439f-8a8f-7be96d0049d7`.
Runtime observation `2026-10-11T22:21:30.759100+00:00`.
Exactly one temporary extension write verified in sanitized deployment
operations; exact extension retired after capture.

## Final steady state

- Target public network access Disabled; bypass None; admin disabled.
- Both transaction-created importer roles ABSENT.
- Builder `g2-tooling` Repository Reader PRESENT, unchanged condition.
- Builder synthetic-health Writer and runtime synthetic-health Reader UNCHANGED.
- Runtime tooling access ABSENT; only builder identity attached to VM.
- Protected infrastructure exactly 16 resources; bodies unchanged except
  excluded volatile etag/systemData, with DNS/PE NIC ownership rechecked.
- Source registry settings and role census unchanged.
- Configuration before/after SHA:
  `14a842cd6529f89932f59e02abd00a90febb23eb2387094e15307878678287bb`.
- Signed URI, query details, tokens, response error bodies and raw
  instance-view messages were not persisted.

## Validation and authority

62 tests PASS: redirect-guard 12, frozen blob observer 16,
private-import 20, corrected adapter 4, empty-path 10.
Tests cover real mocked HTTP wire root/query construction without modifying
the URI, Host/SNI/IP, no credential forwarding, no second redirect,
precise failure stages, size/hash rejection and sanitized marker size.
Bicep build/lint, whitespace and provider validation PASS.
Official azure-prepare -> azure-validate -> azure-deploy flow completed.
Fresh raw what-if showed exactly one CSE Create and no other mutation.
The helper's textual Create:2 count is qualified, not mutation authority.
Source/helper/test/template/parameter/artifact inputs and executed snapshots
are hash-bound. Prior evidence/source hashes remain intact; previous plan
hashes remain historical and do not refer to the subsequently updated plan.

## Files changed

- New scoped validator, observer, Bicep and tests under
  [empty-path](../../infrastructure/landing-zone/g2-builder/stage2a/empty-path).
- [Deployment plan](../deployment-plan.md) updated with active chronology.
- New `G2_EMPTY_PATH_*` baseline, validation, authority, executed snapshots,
  consumed record, sanitized result, retirement, final estate/disposition,
  report, next-authority draft and integrity root.
- Generated adjacent observer-extension.json removed after verifying its
  hash equals the retained compiled template. No historical files removed.

## Runtime changes and exclusions

One approved read-only CSE was created, executed once and retired.
No new source staging/import; no registry/RBAC/network/DNS change.
No package installation, archive extraction, ORAS execution, artifact push
or product action. Existing staging/import branches and artifacts retained.

## Next step

[Artifact-production authority draft](G2_EMPTY_PATH_NEXT_ARTIFACT_PRODUCTION_AUTHORITY_DRAFT.md)
is prepared only. Execution is NOT authorized or performed.
Stop before artifact production; Stage 2B and Stage 3 remain separate.

## Evidence

- [Safe runtime result](G2_EMPTY_PATH_OBSERVER_RESULT.json)
- [Final disposition](G2_EMPTY_PATH_FINAL_DISPOSITION.json)
- [Final protected estate](G2_EMPTY_PATH_FINAL_ESTATE.json)
- [Source authority](G2_EMPTY_PATH_SOURCE_AUTHORITY.json)
- [Integrity root](G2_EMPTY_PATH_FINAL_VERIFICATION.json)
