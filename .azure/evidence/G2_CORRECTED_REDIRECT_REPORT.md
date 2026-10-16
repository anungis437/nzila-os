# Corrected redirect observer: private delivery partial

Mission `NZ-20261008-INFRA-001`.
Slice `G2_STAGE2A_CORRECTED_REDIRECT_OBSERVER`.

## Final disposition

| Required field | Result |
|---|---|
| Delivery | STAGE2A_PRIVATE_ORAS_DELIVERY_PARTIAL |
| HISTORICAL_REDIRECT_REJECTOR | UNRECOVERABLE_BY_DESIGN |
| CURRENT_REDIRECT_VALIDATION | FAIL |
| CURRENT_REDIRECT_FAILURE_PREDICATE | REDIRECT_PATH_INVALID |
| BLOB_INITIAL_HTTP_STATUS | 307 |
| REDIRECT_HOST | nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io |
| DATA_ENDPOINT_RESOLVED_IP | NOT_REACHED |
| DATA_ENDPOINT_TLS | NOT_REACHED |
| DATA_ENDPOINT_HTTP_STATUS | NOT_REACHED |
| TARGET_ARCHIVE_SHA256 | UNPROVEN |
| SOURCE_TARGET_ARTIFACT_EQUIVALENCE | UNRESOLVED |
| CORRECTED_REDIRECT_OBSERVER_AUTHORITY_CONSUMED | YES |
| CUSTOMSCRIPT_EXTENSION_PRESENT | NO |
| OVERALL_G2 | FAIL |

Exactly one corrected observer ran. Deployment
`g2-corrected-redirect-20261011-215838`, correlation
`2c8f8022-4807-47ce-a4d1-180b11cae96a`, reached terminal Failed.
[Deployment](G2_CORRECTED_REDIRECT_DEPLOYMENT.json),
[consumption](G2_CORRECTED_REDIRECT_AUTHORITY_CONSUMED.json),
[retirement](G2_CORRECTED_REDIRECT_EXTENSION_RETIREMENT.json).

## Governance and source authority

The new packet terminates the historical evidence question as
`UNRECOVERABLE_BY_DESIGN`; it supersedes only that prerequisite.
[Governance](G2_CORRECTED_REDIRECT_GOVERNANCE.json).
All historical consumed source/results and local Phase A evidence remain
unchanged. This run identifies only the CURRENT rejection, not the old one.

The fresh template composes frozen authentication/manifest/per-hop helpers,
the separately tested predicate-specific validator, and a small adapter.
No consumed helper was edited. Exact source/template/parameter hashes,
approved manifest/archive contracts and private mapping are recorded in
[source authority](G2_CORRECTED_REDIRECT_SOURCE_AUTHORITY.json).
Executed source snapshots are preserved byte-for-byte.

## Current protocol observations

Both manifest-by-tag and manifest-by-digest returned authenticated HTTP 200
over private registry IP `10.90.2.5`, with correct Host/SNI and certificate
validation. The raw manifest matches known source:
`sha256:644f66c67367de24eeb3c5d921d7cd31c59afe3d3965e7e82c41e104fdcc2f0f`.
The one layer descriptor is `application/gzip`, 4,679,642 bytes,
`sha256:f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`.
Descriptor equality is not archive hash proof.

The registry blob request returned HTTP 307. Sanitized metadata:

- HTTPS.
- Exact approved Canada Central data hostname.
- Default port.
- Query present.
- **Parsed path absent (`REDIRECT_PATH_PRESENT = false`).**

The repaired validator passed scheme/host/port/userinfo/fragment checks and
rejected the CURRENT redirect at `if not url.path`:
`REDIRECT_VALIDATION_REDIRECT_PATH_INVALID_FAILED`.
This is concrete predicate evidence, not generic `blob-http-failure`.
[Sanitized result](G2_CORRECTED_REDIRECT_OBSERVER_RESULT.json) and
[redirect proof](G2_CORRECTED_REDIRECT_REDIRECT_PROOF.json).

The packet requires a nonempty absolute path. Therefore the observer did not
substitute an implicit root path, alter the signed request target, or follow
the redirect. Count 0; data-endpoint DNS/TLS/HTTP/body NOT_REACHED.
No signed URL, path, query names/values, response body or tokens were saved.
No archive file was written. Empty parsed URI path does not by itself establish
that Azure emitted an invalid HTTP download contract: URI/HTTP root handling
and any future normalization require a separately reviewed change/authority.
No provider defect or DNS/network repair is inferred.

The inherited `ACTIVE_STAGE` field carries an old generic bookkeeping label;
the adapter emits exact `FAILURE_STAGE` and current rejection predicate.
The executed result is preserved honestly, not rewritten to hide that label.
Actual failure/disposition uses the precise predicate-specific fields.

## Private final controls

Fresh pre-binding and pre-execution baselines, then final readback, verify:

- Registry hostname maps to `10.90.2.5`; data hostname to `10.90.2.4`.
  ARM private DNS A records and PE NIC private-link FQDN/IP mappings agree.
- Target public access Disabled, network bypass None.
- Source and target temporary importer roles absent.
- Exact builder g2-tooling Reader remains; synthetic-health Writer unchanged.
- Runtime synthetic-health Reader unchanged; runtime tooling access absent.
- Protected infrastructure count sixteen, resource bodies unchanged excluding
  volatile `etag`/`systemData`; no new persistent authorization delta.
- Exact corrected observer extension absent.

[Final estate](G2_CORRECTED_REDIRECT_FINAL_ESTATE.json) and
[final disposition](G2_CORRECTED_REDIRECT_FINAL_DISPOSITION.json).
Package/configuration SHA remained
`14a842cd6529f89932f59e02abd00a90febb23eb2387094e15307878678287bb`.
Extension retirement does not claim guest handler caches/logs are erased.

No source staging/import repeat, trusted-services window, network/RBAC change,
package installation, extraction/ORAS execution, synthetic-health push,
Stage 2B or Stage 3. Existing artifacts and isolated proof branches retained.
No product-lane source changed; UE/Cora NO_GO remains unchanged.

## Validation and concurrency

Branch `g2/synthetic-health-source`, HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`; unchanged observed untracked roots
`.azure/` and `infrastructure/landing-zone/g2-builder/`.
Subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3`, tenant
`5082b8be-b04d-4a13-b61c-b6397670177b`, Canada Central.

- Four unittest discover commands: validator 12, frozen observer 16,
  private-import 20, adapter 4: **52 PASS**.
- Bicep build/lint: PASS.
- Official core helper CLI/auth/build/provider/what-if: OVERALL PASS.
- Fresh raw FullResourcePayloads: one exact CSE Create, no other
  Create/Modify/Delete/Unsupported. Helper textual count two Creates is
  non-authoritative; raw records supersede it.
- Applicable policy list empty; no RBAC/network declarations in template.
- Governed prepare/validate/deploy sequence followed. Skill reload hook
  failures did not skip the retained official workflow/helper steps.
- `git diff --check`: PASS; untracked files separately covered by tests,
  build and source hashes.
- Historical sealed evidence, local validator and frozen Stage 1/inventory
  sources verified unchanged. Final JSON parsing and hash root:
  [verification](G2_CORRECTED_REDIRECT_FINAL_VERIFICATION.json).
- No PR review requested; monorepo-wide PR eligibility checks not run.

## Stop

The new execution authority is consumed. No retry or corrected second run.
Delivery remains PARTIAL, so the conditional next ORAS/synthetic lifecycle
packet is not activated or prepared. A future authority would need to address
the observed empty parsed path without weakening exact-host/TLS, credential
isolation, secret handling, single-run or terminal retirement boundaries.
