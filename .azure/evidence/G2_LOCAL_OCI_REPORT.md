# G2 local OCI manifest contract repair

Mission `NZ-20261008-INFRA-001`.
Slice `G2_STAGE2A_LOCAL_OCI_CONTRACT_REPAIR`.

**LOCAL_OCI_MANIFEST_CONTRACT_PROVEN**

**EXECUTION_AUTHORITY_CONSUMED = NO**

**OVERALL_G2 = FAIL**

## Actual reproduction

Official Linux AMD64 ORAS1.3.4 release archive SHA:
`f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`.
Extracted binary SHA:
`246c47e91bf2749a555ffe00a9824844c6df3a26d61974e3ce08f2077d79c556`.

Both actual version executions returned 1.3.4. Existing local docker-desktop
WSL was used, not an Azure guest. Each packaging run used a separate temporary
directory and Linux `unshare -n` with a cleared `env -i` environment.
No registry endpoint/authentication configured; only `--oci-layout` used.
Acquisition contacted the official GitHub release asset, not Azure/ACR.
No software/package install or container-image pull performed.

Both runs preserved the exact prior local command flags:

```text
oras push --oci-layout <isolated-directory>/layout:<bound-tag>
  --artifact-type application/vnd.nzila.g2.synthetic-health.v1
  --image-spec v1.1
  --annotation org.opencontainers.image.created=2000-01-01T00:00:00Z
  --export-manifest <isolated-directory>/manifest.json
  synthetic-health.json:application/vnd.nzila.g2.synthetic-health.v1+json
```

The archive was hash-checked before extracting only the approved executable.
Separate temporary working payload copies were used; sealed source bytes/tag
unchanged. Root/query/private-import logic was not exercised or modified.

## Exact mismatch matrix

| Field | Prior expectation | Actual ORAS1.3.4 | Source of truth | Disposition |
|---|---|---|---|---|
| config.data | Absent; exact descriptor equality rejected additions | `"e30="` | ORAS_1_3_4_RUNTIME; supported by OCI_SPEC | REPAIR_EXPECTATION |

`MANIFEST_CONTRACT_MISMATCH_COUNT = 1`.

Every other expected top-level field, config field, layer descriptor and
annotation matches. This reproduces the exact prior
`LOCAL_MANIFEST_DESCRIPTOR_MISMATCH` rejection with the unchanged command.
The prior guest manifest was deleted during cleanup and is **not recovered**;
no claim that the specific historical bytes have been inspected.

OCI1.1.1 [descriptor `data`](https://github.com/opencontainers/image-spec/blob/v1.1.1/descriptor.md)
permits base64 embedded content and requires it to equal referenced content.
Actual `"e30="` decodes to `{}`, whose size is 2 and hash equals config digest.
The config is OCI empty config, not synthetic payload.

## Inventory and determinism

| Field | Actual governed value |
|---|---|
| schemaVersion | 2 |
| MANIFEST_MEDIA_TYPE | application/vnd.oci.image.manifest.v1+json |
| ARTIFACT_TYPE | application/vnd.nzila.g2.synthetic-health.v1 |
| CONFIG_MEDIA_TYPE | application/vnd.oci.empty.v1+json |
| CONFIG_DIGEST | sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a |
| CONFIG_SIZE | 2 |
| config.data | e30= |
| PAYLOAD_MEDIA_TYPE | application/vnd.nzila.g2.synthetic-health.v1+json |
| EXPECTED_PAYLOAD_BLOB_DIGEST / PAYLOAD_BLOB_DIGEST | sha256:2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db |
| PAYLOAD_SIZE | 326 |
| LOCAL_MANIFEST_DIGEST | sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690 |
| PACKAGING_DETERMINISTIC | PASS |
| subject | ABSENT |
| Additional top-level fields | NONE |

Layer annotation exactly `org.opencontainers.image.title=synthetic-health.json`.
Top-level annotation exactly `org.opencontainers.image.created=2000-01-01T00:00:00Z`.
The prior supported explicit timestamp option is preserved, not regenerated.

Run1/run2 manifest bytes are identical; payload and config digest are identical.
Each OCI layout retains `oci-layout`, `index.json`, manifest blob, config blob
and payload blob, plus export-manifest bytes. Every captured file/blob is
hash-bound; actual descriptors agree with each blob hash and length.
The manifest digest is calculated from **actual raw ORAS bytes**, not a
hand-serialized JSON expectation. Payload, config and manifest digest domains
are independently bound.

## Repair and validation

New [validator](../../infrastructure/landing-zone/g2-builder/stage2a/local-oci-repair/validator.py)
requires exact schema/media/artifact type, one exact layer, explicit config
including `data`, correct blob bytes/digests/sizes, only fixed annotations,
no subject/other fields and exact actual manifest-byte digest.
It rejects duplicate JSON keys and equivalent models serialized to different
bytes. No arbitrary descriptor/property relaxation.

New [adapter](../../infrastructure/landing-zone/g2-builder/stage2a/local-oci-repair/adapter.py)
preserves the original local packaging invocation and delegates to this
contract. Fresh [candidate](../../infrastructure/landing-zone/g2-builder/stage2a/local-oci-repair/candidate-extension.bicep)
composes frozen helpers/production source plus only the new local contract.
Historical failed sources/tests/executed snapshots remain unchanged.

`python -m unittest discover -s <stage2a/folder> -p test_*.py -v`:
**93 PASS** across existing85 plus local8.
Local tests load captured **actual ORAS fixtures** from both runs, validate
layout/blob/index agreement, reproduced prior failure and candidate adapter.
Negative cases cover payload/config digest, config media/size/data, extra/
wrong layer, artifact/manifest/payload media type, payload size, subject,
timestamp/additional annotations, schema, descriptor URLs, duplicate keys
and raw-byte canonicalization. Sixteen field mutations are rejected.

`az bicep build --file <local-oci-repair/candidate-extension.bicep>
--outfile .azure/evidence/G2_LOCAL_OCI_CANDIDATE_TEMPLATE.json`: **PASS**.
`az bicep lint --file <local-oci-repair/candidate-extension.bicep>`: **PASS**.
These are local compiler commands, not Azure resource API requests.
`git diff --check`: **PASS**.
Provider validation, what-if, deployment and registry checks: **NOT_RUN**.

## Concurrency and preserved history

Branch `g2/synthetic-health-source`, HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`.
Status remains `?? .azure/`, `?? infrastructure/landing-zone/g2-builder/`.
No foreign delta observed/dispositioned in the isolated lane.
Prior source/evidence roots checked byte-for-byte. Current plan updated
only with local repair chronology; historical plan hashes remain historical.
Protected16 is the accepted prior estate, **not a refreshed live Azure census**
in this explicitly local-only packet.

New files: local reproduction/forensics/validator/adapter/tests/candidate,
requested run1/run2 forensic OCI artifacts and G2_LOCAL_OCI evidence,
[plan](../deployment-plan.md), report and future authority proposal.
No Azure parameters/dispatch controller created. Downloaded archive and
local executable/workspaces cleaned; captured forensic blobs retained.

## Stop boundary

```text
AZURE_MUTATION = NO
AZURE_ACCESS = NO
REGISTRY_MUTATION = NO
REGISTRY_ACCESS = NO
EXECUTION_AUTHORITY_CONSUMED = NO
OVERALL_G2 = FAIL
```

Local contract proof does not prove synthetic-health push, confinement,
runtime identity or product readiness. Builder artifact remains PARTIAL.
Prior runtime authority stays consumed; no rerun occurred.

[Corrected production authority proposal](G2_LOCAL_OCI_NEXT_PRODUCTION_AUTHORITY_DRAFT.md)
is prepared only; **not approved or executed**. No Stage2B or Stage3.

## Evidence

- [Actual run1 manifest](G2_LOCAL_OCI_RUN1/manifest.json)
- [Actual run2 manifest](G2_LOCAL_OCI_RUN2/manifest.json)
- [Exact mismatch matrix](G2_LOCAL_OCI_MISMATCH_MATRIX.json)
- [Inventory](G2_LOCAL_OCI_MANIFEST_INVENTORY.json)
- [Local disposition](G2_LOCAL_OCI_LOCAL_DISPOSITION.json)
- [Source authority](G2_LOCAL_OCI_SOURCE_AUTHORITY.json)
- [Final integrity root](G2_LOCAL_OCI_FINAL_VERIFICATION.json)
