# STAGE2B_RUNTIME_IDENTITY_PROOF - proposal only

Mission `NZ-20261008-INFRA-001`. Gate `G2_PRIVATE_CONTROL_PLANE`.
**UNAUTHORIZED / NOT EXECUTED**. This document grants no execution authority.

## Proven prerequisite

Stage2A builder artifact PROVEN in exactly one corrected execution.
Private ORAS delivery and deterministic local OCI contract PROVEN.
Protected16 preserved; overall G2 FAIL; UE/Cora infrastructure NO_GO.
See [sealed Stage2A disposition](G2_CORRECTED_PRODUCTION_DISPOSITION.json).

## Proposed objective

Prove the runtime identity can read the exact already-published synthetic
artifact through the private registry path and cannot write synthetic-health,
read/write g2-tooling, or write an unauthorized repository.
Do not attach the runtime UAMI to the builder. Do not use builder credentials
or operator credentials to impersonate runtime data-plane permission.

## Decisions requiring separate authority

- Select and authorize a distinct isolated execution host/service with only
  runtime UAMI. No new host, workload, or identity attachment is authorized now.
- Define permitted temporary resources, immutable executable inputs,
  maximum execution count, denial-probe semantics, retirement, and exact
  protected-resource comparison boundaries.
- Define how to stop and preserve evidence if a negative probe unexpectedly
  succeeds. Never conceal an allowed write by deleting remote evidence.
- Approve a fresh canonical runtime assignment census and explicit effective
  read/deny checks, with matching postexecution snapshot.

## Proposed immutable read target

Registry `nzilag2tzo75uuozprbo`, repository `synthetic-health`.
Manifest:
`sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690`.
Payload:
`sha256:2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db`.
Manifest bytes/media/artifact/config/layer contract must match sealed Stage2A.

## Proposed proof and restrictions

Require private DNS/IP, Host/SNI/TLS, runtime IMDS identity, exact pull grant,
digest-bound manifest and payload readback, scoped negative checks, no
credential persistence, terminal extension/workspace cleanup, unchanged
private registry/source/RBAC/network and accepted protected infrastructure.
Do not push, import, install packages, change RBAC, reopen public/bypass access,
deploy product applications, enter Stage3, or declare overall G2 PASS.

Next action is maintainer review and explicit Stage2B authority, not execution.
