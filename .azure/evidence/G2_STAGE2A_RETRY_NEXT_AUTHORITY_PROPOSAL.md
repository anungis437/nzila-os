# Proposed next authority — not executable permission

Mission: `NZ-20261008-INFRA-001`. Phase 1 is PROVEN; tooling MISSING.
No build, push, package action or Stage 2B execution is authorized now.

## Proven prerequisites and exact missing capability

Available: root shell, Python 3.12.3, curl 8.5.0, writable temporary workspace,
private ACR/DNS and targeted builder IMDS. Missing on root PATH: Docker, Podman,
Buildah, Go, Skopeo, ORAS and Azure CLI.

The intended static Go/scratch builder mechanism cannot run as presently
installed: no Go compiler or OCI builder. Do not silently replace it with an
ad-hoc Python registry uploader to bypass the tooling gate.

## Separate package-resolution proposal

Proposed minimal direct prerequisites: Ubuntu `golang-go` and `buildah`.
No Docker daemon, Podman, Azure CLI, ORAS, Skopeo or third-party installer is
proposed solely because inventory found them absent.

Before any installation, obtain separate authority for an observation-only
package-resolution payload:

1. Rebaseline sixteen resources and frozen evidence.
2. Re-observe actual configured APT sources; retain Stage 1's observed
   `azure.archive.ubuntu.com` URI as historical evidence, not a fresh guarantee.
3. Inspect existing local package index/candidate metadata and simulate the
   exact two-package transaction offline. No `apt update`, install or network
   repository test during resolution.
4. Enumerate exact package/version/dependency closure, bytes and provenance.
   If metadata is insufficient, stop and propose a separately bounded,
   endpoint-specific index refresh; never infer versions.
5. Review egress against the existing firewall. Any required change needs
   explicit authority; do not broaden networking under a package packet.

Only that evidence can justify an exact install transaction. This document
does not manufacture package versions or authorize `apt install`.
Post-install tooling proof would need a new bounded payload and hashes.

## Conditional Stage 2A Phase 2 build/push packet

After prerequisites are installed under separate authority and verified,
request exactly one source-bound execution with:

- Proven binary paths/versions for Go and Buildah; no inferred tooling.
- New isolated synthetic-only standard-library Go source, no application repo
  or real data; Linux/AMD64, CGO disabled, deterministic metadata.
- Exact source/context hashes and source commit
  `7bec20aad11d43eeae8099c14e021b3074154b27`; do not claim newly created source
  is committed unless it actually is.
- Scratch-only image, no external base image or dependency downloads.
- Exact reviewed workspace-limited build commands, fixed timestamp/content,
  nonroot image user; no package or host-network/security modification.
- New explicit source/script/settings/template/parameter authority and one
  extension-only Create what-if. Same Major.Minor 2.1 platform patch-selection
  boundary, no automatic updates, no reusable administration service.
- Immediately rechecked exact writer role/condition, builder-only UAMI and
  private ACR path.
- Explicit permission for in-memory builder IMDS -> ACR exchange -> scoped
  token authentication for this Phase 2 only.
- One nonconflicting deterministic tag in `synthetic-health`; one push,
  fail/stop on error; local/remote digest equivalence authoritative.
- Non-destructive cross-repository authorization probe expected DENIED.
  No successful foreign-repository write, role change or retry.
- Token-free provenance tying source, inputs, exact commands/tool versions,
  VM/UAMI/principal, registry/repository/tag/digest and results.
- Exact extension retirement and final sixteen-resource rebaseline.

Exact build command bytes, tag and digest cannot be authorized now: required
tool paths/versions and synthetic source do not yet exist. Bind those after
the prerequisite gate, rather than issuing a success-shaped build packet.

Even then, overall G2 remains FAIL pending separate Stage 2B runtime-only proof.
