# G2 Stage 2 preflight and execution-channel disposition

Mission: `NZ-20261008-INFRA-001`  
Slice: `G2_STAGE2_PRIVATE_CONTROL_PLANE`

## Disposition

`STAGE2_SYNTHETIC_ARTIFACT_PARTIAL` — blocked before build, not a failed push.

`STAGE1_DISCOVERY_PROVEN` remains frozen. `OVERALL_G2 = FAIL`.

## Verified baseline

- Branch `g2/synthetic-health-source`, HEAD `7bec20aad11d43eeae8099c14e021b3074154b27`.
- Subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3`, tenant `5082b8be-b04d-4a13-b61c-b6397670177b`, Canada Central.
- Fresh exact sixteen-resource inventory, each raw resource read using the final Stage 1 API-version map.
- No raw-state differences after excluding only `etag` and `systemData`; resource IDs and saved ACR assignment contracts also match.
- All final-verification evidence hashes, V2 source/infrastructure/prior-evidence hashes and candidate-template hash match.
- Existing untracked infrastructure/evidence trees observed; no tracked foreign changes reverted or dispositioned.
- Requested proof label is `union-eyes / integration-test`; no live resource retagging or product-source changes.

See [baseline](G2_STAGE2_BASELINE.json) and [Stage 1 chain](G2_STAGE2_STAGE1_EVIDENCE_CHAIN.json).

## Toolchain visibility blocker

The installed toolchain cannot honestly be classified as PRESENT or MISSING.
The frozen [cloud-init source](../../infrastructure/landing-zone/g2-builder/cloud-init.yaml)
delivers and executes first-boot discovery only. It contains neither build-tool
inventory nor a general post-boot execution service. The fresh estate contains
no VM extension. The provisioning private key was destroyed.

Run Command, interactive SSH administration, first-boot rerun, package installation
and infrastructure changes are not authorized. Non-interactive SSH is not
categorically prohibited by the packet, but no usable authenticated private
channel has been established; permission to create keys or broaden ingress
cannot be inferred. ARM inspection and boot evidence do not establish installed
build-tool availability. No serial console command was injected.

Therefore `STAGE2_BUILD_TOOLCHAIN = UNDETERMINED`, with inventory `BLOCKED`.
This is an explicit limitation rather than a success-shaped fallback or a
fabricated package-missing result. A package-install proposal is premature.

See [toolchain inventory](G2_STAGE2_TOOLCHAIN_INVENTORY.json).

## Runtime identity blocker

Only the builder UAMI is attached to the proven VM. The runtime UAMI and its
saved read-scoped repository assignment still exist unchanged, but no permitted
runtime-authenticated execution channel was established. Static assignment
comparison is not proof that a runtime write request was denied.

Do not substitute builder/workstation authentication, attach the runtime UAMI,
or broaden roles. Identify an existing authorized runtime proof mechanism or
obtain bounded authority for one.

See [identity contracts](G2_STAGE2_IDENTITY_AUTHORIZATION.json).

## Actions withheld

No guest inventory command, Stage 1 rerun, package action, synthetic source
creation, build, ACR authentication, push, negative probe, runtime pull,
infrastructure mutation or Stage 3 operation occurred. Private ACR reconfirmation
from the builder is `NOT_RUN`; historical Stage 1 proof is not reused as a fresh
Stage 2 observation. No digest or provenance completion is claimed.

## Required resolution

1. A permitted bounded post-boot inventory/build execution channel on the existing
   private builder, without silently introducing credentials or network access.
2. A permitted authentication/proof channel for the runtime UAMI without role or
   identity-attachment changes under this packet.

The next proof remains Stage 2 itself; no later G2 gate is inferred.

## Evidence preservation and checks

New non-overwriting evidence only. No historical source, template, plan status
or Stage 1 evidence was edited. The read-only collector passed chain/estate
checks; `git diff --check` passed before this evidence batch. Final evidence
verification separately binds the new records and rechecks historical hashes.

See [final disposition](G2_STAGE2_FINAL_DISPOSITION.json).
