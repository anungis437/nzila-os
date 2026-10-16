# G2 Stage 2A revised synthetic artifact production

Mission `NZ-20261008-INFRA-001`.
Slice `G2_STAGE2A_SYNTHETIC_ARTIFACT_PRODUCTION_REVISED`.

**STAGE2A_BUILDER_ARTIFACT = PARTIAL**

**EXECUTION_AUTHORITY_CONSUMED = YES**

**OVERALL_G2 = FAIL**

## Execution

Exactly one CSE deployment `g2-synthetic-revised-20261011-225602`.
Correlation `305cdc85-d0a3-4b4b-8483-419d8cbe7c9e`. Terminal Failed.
Guest observation `2026-10-11T22:56:15.128090+00:00`.

Private retrieval succeeded at dedicated data endpoint IP `10.90.2.4`,
TLS PASS, exactly 4,679,642 bytes and approved archive SHA.
Archive member/ELF AMD64 validation and temporary extraction passed.
Temporary `oras version` returned 1.3.4. No persistent install.

The ORAS **local OCI-layout** command succeeded, then candidate validation
rejected its config/layer descriptor shape:

`FAILURE_STAGE = LOCAL_MANIFEST_DESCRIPTOR_MISMATCH`.

No remote registry push was attempted. No second execution or retry.
Local manifest/config/working payload/tooling were removed in workspace
cleanup. Saved evidence does not distinguish which descriptor field
differed; neither a specific field nor corrected behavior is claimed.
The unit fixtures represented the expected shape, not the actual binary
output. Local mocked test success is not runtime compatibility proof.

## Composite authorization gate

`BUILDER_MANAGEMENT_PLANE_ROLE_READ_REQUIRED = NO`.

Operator canonical snapshots include assignment ID, principal, role
definition ID, exact scope, original condition text and condition version,
sorted by assignment ID and JSON keys with compact ASCII encoding.
Only the two relevant builder assignments are included. No volatile
timestamps or irrelevant assignments enter the digest.

```text
PREDISPATCH_ARM_AUTHORIZATION_CENSUS = PASS
PREDISPATCH_AUTHORIZATION_SNAPSHOT_SHA256 = ab355ef1e0697b1bf0e4328cdfb68d2a6f92eb49e8721c8326f93261a950fd63
IMMEDIATE_PREDISPATCH_AUTHORIZATION_SHA256 = ab355ef1e0697b1bf0e4328cdfb68d2a6f92eb49e8721c8326f93261a950fd63
POSTEXEC_AUTHORIZATION_SNAPSHOT_SHA256 = ab355ef1e0697b1bf0e4328cdfb68d2a6f92eb49e8721c8326f93261a950fd63
ARM_AUTHORIZATION_UNCHANGED_ACROSS_EXECUTION = PASS
BUILDER_ARM_ROLE_READ_PERMISSION_ADDED = NO
```

Guest tooling read ALLOWED by actual manifest/archive retrieval.
Effective tooling-write denial, exact synthetic-health write grant, control
write denial, collision check and actual authorized push were not reached.
Thus the complete composite runtime gate did not PASS.

## Required disposition fields

| Field | Result |
|---|---|
| STAGE2A_BUILDER_ARTIFACT | PARTIAL |
| ORAS_ARCHIVE_SHA256 | f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454 |
| ORAS_VERSION | 1.3.4 |
| SYNTHETIC_SOURCE_SHA256 | 2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db |
| TARGET_REPOSITORY | synthetic-health |
| TARGET_TAG | stage2a-2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db |
| EFFECTIVE_TOOLING_READ | ALLOWED |
| EFFECTIVE_TOOLING_WRITE | NOT_RUN |
| EFFECTIVE_SYNTHETIC_HEALTH_WRITE_AUTH | NOT_RUN |
| AUTHORIZED_PUSH | NOT_RUN |
| AUTHORIZED_PUSH_ATTEMPT_CONSUMED | NO |
| REMOTE_BLOB_DIGEST | UNPROVEN |
| REMOTE_MANIFEST_DIGEST | UNPROVEN |
| PAYLOAD_BLOB_DIGEST_MATCH | NOT_RUN |
| MANIFEST_DIGEST_ROUNDTRIP | NOT_RUN |
| AUTHORIZED_ARTIFACT_READBACK | NOT_RUN |
| BUILDER_CROSS_REPOSITORY_WRITE | NOT_RUN |
| BUILDER_TOOLING_WRITE | NOT_RUN |
| TOKEN_BODIES_PERSISTED | NO |
| TEMPORARY_STAGE2A_WORKSPACE_PRESENT | NO |
| CUSTOMSCRIPT_EXTENSION_PRESENT | NO |
| PROTECTED_INFRASTRUCTURE_RESOURCE_COUNT | 16 |
| EXECUTION_AUTHORITY_CONSUMED | YES |
| OVERALL_G2 | FAIL |

Local payload raw SHA remains the sealed source SHA above.
Local payload OCI digest is that SHA prefixed by `sha256:`.
No verified remote payload/manifest digest exists for this packet.

## Implementation choice

ORAS 1.3.4 uses the oras-go/v2 2.6.2 default retry transport, with five
protocol retries on retryable responses/timeouts. No-response decision
preserved the packet's strict no-retry rule without modifying the approved
binary or adding a TLS proxy: ORAS builds locally with explicit artifact
and payload media types and fixed creation annotation; a tested pinned
Python uploader was intended to transfer those exact bytes with no retries.
The remote uploader was never reached.

No ORAS remote CLI push is claimed. No controller retry, tag change, payload
change, alternate registry, role adjustment or network workaround occurred.

Upstream references inspected:

- [ORAS 1.3.4 remote transport](https://github.com/oras-project/oras/blob/v1.3.4/cmd/oras/internal/option/remote.go)
- [ORAS 1.3.4 dependency versions](https://github.com/oras-project/oras/blob/v1.3.4/go.mod)
- [oras-go 2.6.2 retry policy](https://github.com/oras-project/oras-go/blob/v2.6.2/registry/remote/retry/policy.go)
- [ORAS push flags](https://oras.land/docs/commands/oras_push/)

## Final protected state

- Target public network Disabled, bypass None, admin disabled.
- Both temporary import roles absent.
- Builder conditioned tooling Reader present, tooling Writer absent;
  synthetic-health Writer present.
- Runtime synthetic-health Reader unchanged; tooling access absent.
- Only builder identity attached; no management-plane privilege added.
- Private endpoint NIC, private DNS and zone group unchanged.
- Exactly 16 protected resource bodies unchanged except ignored volatile
  etag/systemData; source registry settings and roles unchanged.
- Exact CSE removed. Guest workspace absent. Configuration SHA unchanged:
  `14a842cd6529f89932f59e02abd00a90febb23eb2387094e15307878678287bb`.
- No source/import writes, package installation, completed registry artifact,
  out-of-scope upload session, runtime identity attachment or product action.

## Concurrency, validation and files

Branch `g2/synthetic-health-source`, HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`.
Status stayed `?? .azure/`, `?? infrastructure/landing-zone/g2-builder/`.
No new foreign delta observed in this isolated lane and no foreign changes
reverted, accepted or dispositioned.

85 tests PASS (existing62 + source-binding6 + production17).
Bicep build/lint, `git diff --check`, provider validation and structured
what-if PASS. Official prepare/validate/deploy sequence completed.
Core helper textual Create:2 is not authority: raw FullResourcePayloads
proved exactly one temporary CSE Create, no other mutation.
No PR review requested; monorepo PR eligibility checks not run.

New [production source/tests/Bicep](../../infrastructure/landing-zone/g2-builder/stage2a/synthetic-revised),
scoped [plan chronology](../deployment-plan.md), and
`G2_SYNTHETIC_REVISED_*` baseline/census/validation/authority/snapshots/
consumption/safe-result/retirement/final-state/report/integrity evidence.
Generated adjacent compiled JSON removed after hash equality with retained
template was verified. Sealed payload/tag and all historical source/evidence
preserved. Earlier plan SHA values remain historical after this scoped update.

## Stop boundary

Execution authority is consumed. No further runtime action authorized.
Any local-manifest diagnostic or corrected execution requires fresh authority;
do not reuse this one. Source snapshots stay frozen.
Stage2B authority was not prepared because builder artifact proof did not
PASS. No Stage3. Prior private delivery remains PROVEN.
UE/Cora INFRA_NO_GO and overall G2 FAIL remain unchanged.

## Evidence

- [Guest result](G2_SYNTHETIC_REVISED_GUEST_RESULT.json)
- [Final disposition](G2_SYNTHETIC_REVISED_FINAL_DISPOSITION.json)
- [Post-execution census](G2_SYNTHETIC_REVISED_POSTEXEC_AUTHORIZATION.json)
- [Source authority](G2_SYNTHETIC_REVISED_SOURCE_AUTHORITY.json)
- [Final estate](G2_SYNTHETIC_REVISED_FINAL_ESTATE.json)
- [Integrity root](G2_SYNTHETIC_REVISED_FINAL_VERIFICATION.json)
