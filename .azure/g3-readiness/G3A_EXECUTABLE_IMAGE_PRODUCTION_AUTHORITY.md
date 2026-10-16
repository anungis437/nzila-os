# G3A_EXECUTABLE_IMAGE_PRODUCTION_AUTHORITY

**CANDIDATE / INCOMPLETE / NOT APPROVED / NOT EXECUTABLE**.
Mission `NZ-20261008-INFRA-001`; one slice of G3, not product rollout.

Consume the frozen [local image qualification](local-image-qualification/LOCAL_IMAGE_QUALIFICATION.json),
not G2's non-runnable JSON artifact:

- Repository `g3-synthetic-runtime`, qualified archive-derived tag.
- Manifest `sha256:1a6085926ff5fd78cc81bb2fb6df8ceb9bc62660e3222bbe088e47807a91bb61`.
- Exact config/index/layers/executable in local evidence; no repackaging or
  rebuilding with different inputs while claiming the same authority.
- New `nzila-g3-test-001-build-mi`; Writer conditioned to this repository only.
  No G2 builder/runtime principal grant or consumed G2 CSE authority replay.

Proposed limit: one named producer transaction, one image upload attempt,
one final manifest commit, exact digest readback. No ORAS transport auto-retry,
registry import, public registry bypass, product build/deploy workflow or
runtime environment/vault deployment. Build archive/CA/toolchain/input transfer
must use the explicitly approved private channel; source qualification on the
local workstation does not establish that channel.

Still required before approval: named build runner/private transfer/controller,
transient VM/agent inputs and templates if used, exact operator/approver IDs,
new ACR connection and conditioned-role GUID map, effective census, CAD cost
ceiling, quota/collision checks and approved expected what-if.

Allowed future artifact evidence: exact manifest/config/layer hashes,
scoped grants, private DNS/TLS/SNI/HTTP path traces without tokens/headers/
signed URIs, producer write/readback and forbidden-repository denial.
Retain uploaded proof artifact; remove only newly authorized role/connection/
runner resources under explicit teardown authority.

Failure means stop and retain honest evidence, not adaptive privilege/network
repair. G3B cannot proceed without a separately sealed target-image proof.

```text
G3A_AUTHORIZED = NO
G3A_EXECUTED = NO
G3_TECHNICAL_EXECUTION_AUTHORIZED = NO
APPLICATION_ROLLOUT_AUTHORIZED = NO
PRODUCTION_DATA_AUTHORIZED = NO
```
