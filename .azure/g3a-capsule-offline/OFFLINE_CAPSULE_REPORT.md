# Offline G3A production capsule readiness

## Disposition

**G3A_TRANSACTION_READINESS = BLOCKED**.
Stopped at the pinned-guest isolation evidence gate required by sections
7 and 34 of the new local/offline authority. No controller or top-level
Bicep changes were made. No control-plane bootstrap authority was issued.

## Measured local progress

Constructed a separate, fail-closed runtime-packaging candidate from the
already-qualified registry/controller primitives and their exact frozen
sources. The first-byte witness was not changed or executed again.

- Candidate SHA-256: `b41226ceb1488a68f18e013faa4dab7a13a2d8d55a582579b7dc9a601cb738b2`.
- Candidate bytes: **25800828**.
- Candidate source-binding digest: `5aa4ec60578397ef49cd234ca0a156d439b984ab879df0880b32129738ff8ba2`.
- Outer launcher: static Linux/amd64 ELF, no PT_INTERP or PT_DYNAMIC.
- Inner runtime: embedded CPython 3.11.17, explicit dynamic loader and
  native dependencies. It is **not** described as an all-static runtime.
- Exact candidate dependency census: 141 files, 22,570,298 member bytes.
- Cached preparation image pinned by full digest; no pull or installation.
- Offline import test: 128 modules resolved inside the extracted package,
  PATH `/unavailable`, no capabilities, no-new-privileges, network disabled.
- Six candidate archive/disabled-entrypoint fixtures PASS.
- Eight isolation evidence-gate fixtures PASS.

The import test is not a full transaction, exhaustive runtime-dependency
qualification, isolated-root build proof, or production handoff proof.
Candidate entrypoints reject production execution unconditionally.
Compiler trees, product build source, runtime OCI payload, final image
and credentials are not embedded.

Two initial preparation failures (Windows separator handling and cached
site initialization) were explicit, preserved, and corrected before any
candidate was built. No cloud retry or proof replay occurred.

## Exact stop boundary

The sealed VM model proves only the pinned image identity:
`Canonical:ubuntu-24_04-lts:server:24.04.202609040`.
It contains no observation of inherited CAP_SYS_ADMIN, CAP_SYS_CHROOT,
CAP_SETUID or CAP_SETGID, namespace/mount restrictions, syscall filters,
privilege-drop behavior, or host-filesystem/network boundary negatives.

The proposed lowest-state runner uses Linux kernel mount/PID/network
namespaces, a private root, read-only staged inputs and dedicated writable
work/output, followed by credential/capability drop and no-new-privileges.
It adds no daemon. This is a **proposed contract**, not an implemented or
qualified runner. A Docker Desktop kernel and container capabilities
cannot establish those properties for the pinned Azure guest.
Absence of evidence is not a claim that Azure or Ubuntu cannot support it.

The unchanged witness additionally emits its marker and self-hash, then
exits. It has no capsule retrieval, capsule SHA check, or capsule exec
path. No new shim or public fallback was silently substituted. A separate
hash-bound handoff must be qualified without changing the witness in place.
The 25.8 MB candidate is not substituted for the 1.8 MB Blob witness or
for its accepted bootstrap-byte cap.

## Payload and cost boundaries

The candidate artifact/dependencies are exactly inventoried. The complete
future private OCI envelope, handoff payload, configuration and staged-input
census remain unresolved, so no estimated byte total is presented as exact.
Known extracted frozen input-member sizes are not OCI transport sizes.

The accepted CAD 4.8973042 expected / CAD 7.35 ceiling scenario is preserved
only as the prior bounded scenario. It is not a final new-payload cost
claim. Pricing freshness, quantitative lifetime enforcement and full
failure-cleanup coverage are not complete and are marked FAIL, not PASS.

## Preservation and concurrency

Latest first-byte root remains
`96dced437ec2cddb1ec000db7e337ba02eb676caac667e106fc0104f8fbeeda8`.
Verified 719 prior root/file references unchanged, including G2
and all directly protected builder/uploader/first-byte packet bytes.
There was no builder, compressor, frozen image, uploader, parser or
first-byte requalification.

Active worktree HEAD: `7bec20aad11d43eeae8099c14e021b3074154b27`.
Foreign HEAD: `1c337567635bb86ea0df7831557d8d2d22df1e6f`; observed status entries: 569.
Foreign work was observed only; nothing was edited, staged, reverted or
dispositioned. Candidate compiler cache was removed after local checks.

**AZURE_MUTATIONS = 0; ENTRA_MUTATIONS = 0; REGISTRY_MUTATIONS = 0.**
No Azure metadata/pricing call, deployment, VM, CSE, Blob upload, ACR upload
or role assignment was performed under this authority.
All execution authorizations remain NO; UE and Cora remain INFRA_NO_GO.

## Deliverables

- [Full requested disposition](FINAL_DISPOSITION.json)
- [Candidate provenance](CANDIDATE_BINDING.json)
- [Exact embedded dependency census](RUNTIME_CENSUS.json)
- [Candidate versus unresolved production payload census](CANDIDATE_PAYLOAD_CENSUS.json)
- [Isolation gate](ISOLATION_DISPOSITION.json)
- [Handoff boundary](HANDOFF_DISPOSITION.json)
- [Offline import test](CANDIDATE_SELFTEST.json)
- [Archive fixtures](LAUNCHER_FIXTURES.json)
- [Isolation gate fixtures](FINAL_ISOLATION_GATE_FIXTURES.json)
- [Seal](OFFLINE_VERIFICATION.json)
- [Independent verification](OFFLINE_INDEPENDENT_VERIFICATION.json)
