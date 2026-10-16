# G2 private blob readback closure: partial

Mission: `NZ-20261008-INFRA-001`

Slice: `G2_STAGE2A_PRIVATE_BLOB_READBACK_CLOSURE`

**`STAGE2A_PRIVATE_ORAS_DELIVERY_PARTIAL`**

**`FAILURE_STAGE = BLOB_REDIRECT_INVALID`**

**`SOURCE_TARGET_ARTIFACT_EQUIVALENCE = UNRESOLVED`**

**`OVERALL_G2 = FAIL`**

## Scope and execution

Exactly one diagnostic CSE ran, under the existing builder's exact
`repository:g2-tooling:pull` grant. The authorized execution is consumed;
there is no corrected rerun authority. No source staging/import repeat,
trusted-services bypass, importer role, network/DNS/firewall/RBAC mutation,
archive extraction/execution, synthetic-health push, Stage 2B or Stage 3.

Branch `g2/synthetic-health-source`; HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`. The two observed untracked roots
remain `.azure/` and `infrastructure/landing-zone/g2-builder/`. No tracked
foreign work or product-domain source was changed. Existing UE/Cora NO_GO
dispositions are not softened.

Subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3`, tenant
`5082b8be-b04d-4a13-b61c-b6397670177b`, Canada Central.

## Fresh mapping

[Pre-execution mapping](G2_BLOB_READBACK_PRE_EXECUTION_MAPPING.json) confirms:

| Endpoint | Private IP |
|---|---|
| nzilag2tzo75uuozprbo.azurecr.io | 10.90.2.5 |
| nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io | 10.90.2.4 |

Read-only ARM evidence correlates exact A records, Private Endpoint NIC
private-link FQDN/IP configurations and private DNS zone-group ownership.
[Microsoft data-path evidence](G2_BLOB_READBACK_MICROSOFT_PROTOCOL.md) records
the documented login-server / 307 / regional data-endpoint distinction.

## Exact runtime evidence

| Stage | Observed result |
|---|---|
| Targeted builder identity and exact pull grant | PASS |
| Tag manifest GET | HTTP 200; private login IP .5; TLS/SNI/certificate PASS |
| Immutable digest manifest GET | HTTP 200; same raw manifest authority |
| Manifest artifact type | application/vnd.nzila.g2.tooling.oras.v1 |
| Payload media type | application/gzip |
| Payload descriptor size | 4,679,642 bytes |
| Registry blob GET | HTTP 307; private login IP .5; TLS/SNI/certificate PASS |
| Redirect metadata | Present; HTTPS; approved regional data hostname; default port; query present |
| Observer redirect guard | Rejected: BLOB_REDIRECT_INVALID |
| Redirect follow count | 0 |
| Builder-side data-endpoint DNS/TLS/HTTP/body | NOT_RUN |
| Target archive SHA | UNPROVEN |
| Package/configuration unchanged | PASS |

Target manifest digest:
`sha256:644f66c67367de24eeb3c5d921d7cd31c59afe3d3965e7e82c41e104fdcc2f0f`.
This closes manifest equality only, not archive retrieval.

Blob descriptor digest:
`sha256:f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`.
The manifest descriptor is not substituted for a locally observed archive SHA.
Manifest and archive digests are distinct domains.

[Complete sanitized result](G2_BLOB_READBACK_OBSERVER_RESULT.json),
[manifest read](G2_BLOB_READBACK_MANIFEST_READ.json),
[blob initial response](G2_BLOB_READBACK_BLOB_INITIAL_RESPONSE.json),
[redirect metadata](G2_BLOB_READBACK_REDIRECT_METADATA.json), and
[data-endpoint evidence](G2_BLOB_READBACK_DATA_ENDPOINT_PROOF.json) preserve
the exact boundary; the empty data-endpoint observation is NOT a successful test.

## Failure interpretation and source ceiling

This attempt stops at the observer's own URI-validation guard, not an observed
data-endpoint HTTP or TLS failure. Scheme/hostname/port validation passed
far enough to emit approved metadata. The remaining guard rejects userinfo,
password, fragment, missing/nonabsolute path, or a double-leading-slash path.
The executed observer used one shared failure code for those checks.

No signed Location, URI path, query names/values, response body or credential
was persisted. Consequently, saved evidence cannot identify which of those
remaining guard conditions fired. Do not infer malformed Azure behavior, a
network repair requirement, or a precise URI compatibility bug. A compatible
redirect could have been rejected by an overstrict software guard; that remains
unresolved. This diagnostic limitation is recorded rather than hidden.

Do not rewrite the executed source to imply a different observation.
[Executed observer](G2_BLOB_READBACK_EXECUTED_observer.py),
[executed helper](G2_BLOB_READBACK_EXECUTED_HELPER.py), and
[source authority](G2_BLOB_READBACK_SOURCE_AUTHORITY.json) remain hash-bound.
A narrower guard-disambiguation observer would require new authority;
no automatic correction or guest rerun occurs here.

## Terminal retirement and final controls

Deployment `g2-blob-readback-20261011-185510`, correlation
`1daa1904-90ed-42c4-9136-141c141363a3`, reached Failed after emitting the
sanitized diagnostic. The exact CSE was removed after terminal state.
[Deployment metadata](G2_BLOB_READBACK_DEPLOYMENT.json) and
[retirement](G2_BLOB_READBACK_EXTENSION_RETIREMENT.json).

Final contracts:

- Target public access Disabled; trusted-services bypass None.
- Source/target temporary importer roles absent.
- Builder tooling Reader present; synthetic-health Writer unchanged.
- Runtime synthetic-health Reader unchanged; tooling access absent.
- Private Endpoint/DNS and all protected resource bodies unchanged,
  excluding only volatile `etag`/`systemData` in comparison.
- Protected infrastructure count sixteen; no lasting new authorization delta.
- Exact observer extension absent.
- Tokens and signed URLs not persisted; no archive durable file created.

Observed package/configuration digest remained
`14a842cd6529f89932f59e02abd00a90febb23eb2387094e15307878678287bb`.
Extension retirement does not claim agent logs/cache erased.
Previous import artifacts, failed observers, authorities and historical
evidence are retained unchanged. Source/target artifacts and isolated GitHub
proof branches are not deleted.

## Validation and integrity

- `python -m unittest discover -s infrastructure/landing-zone/g2-builder/stage2a/blob-readback -p test_*.py -v`: **16 PASS**.
- Same command targeting `stage2a/private-import`: **20 PASS**.
- Bicep build/lint: PASS.
- Governed core CLI/auth/build/provider/what-if helper: OVERALL PASS.
  Its textual count of two Creates is not authoritative.
- Fresh raw FullResourcePayloads: exactly one intended CSE Create;
  zero Modify/Delete/Unsupported. Raw Ignore/NoChange entries do not mutate state.
- Governed prepare/validate/deploy workflow completed before execution.
- `git diff --check`: PASS; does not by itself cover untracked source.
- Frozen Stage 1/inventory and previous helper/evidence hashes verified.
- Final JSON parsing, evidence/source/plan hash root and final live controls:
  [verification](G2_BLOB_READBACK_FINAL_VERIFICATION.json),
  [estate](G2_BLOB_READBACK_FINAL_ESTATE.json), and
  [disposition](G2_BLOB_READBACK_FINAL_DISPOSITION.json).
- No PR review requested; monorepo-wide PR eligibility checks were not run.

## Stop boundary

The proof advanced through private manifest equality and the initial 307,
but did not reach the private data endpoint or hash the archive.
Delivery remains PARTIAL and overall G2 FAIL. No next ORAS execution/synthetic
lifecycle packet is activated. Any further observer or repair needs separate
authority; import/staging must not be repeated.
