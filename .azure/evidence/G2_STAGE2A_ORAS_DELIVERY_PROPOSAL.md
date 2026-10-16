# Separate governed ORAS delivery proposal

Proposal only. No networking, Storage, registry write, guest download or
extension execution is authorized by this document.

## Preserve current control boundary

Do not add GitHub/wildcard Internet egress. Do not create a new Storage account
solely to stage ORAS. Do not install a container engine, package, Snap or
system-wide ORAS. Keep ORAS 1.3.4/Linux AMD64 and exact archive digest:
`f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`.

## Candidate: existing private ACR as immutable binary-delivery boundary

Evaluate staging the verified upstream archive as a digest-addressed blob or
generic OCI artifact in the **existing** private ACR, under separately granted
delivery authority. The builder already has Python and a proven private ACR
path, so bootstrap retrieval need not require ORAS itself: a reviewed
standard-library HTTPS client can retrieve an explicitly authorized manifest
and blob through the private endpoint, then verify archive bytes before
extracting only the ORAS executable into the bounded temporary workspace.

This requires explicit adjudication; it is not an assumed workaround:

1. Identify an **existing, authorized private-path uploader** and its identity.
   No suitable uploader has been proven by this preflight. Do not use personal
   credentials, expose ACR publicly, attach identities to the builder or deploy
   upload compute under this proposal.
2. Independently verify archive bytes and trusted upstream signing metadata
   in that governed supply-chain context, not only release API labels.
3. Authorize exact staging registry/repository/tag/digest, writer identity and
   one bounded staging upload. The current one synthetic proof push packet
   does not authorize an additional tool-staging artifact or another repository.
   Preserve repository ABAC; do not broaden builder roles.
4. Explicitly resolve staging/proof repository coexistence and staging artifact
   retention. A different repository requires new scope authority; staging in
   `synthetic-health` still requires separate write/count authority.
5. Bind one-shot extension script, archive digest, manifest/blob descriptors,
   pinned private retrieval/TLS, safe token handling, strict extraction, reviewed
   ORAS proof commands, temporary-file cleanup and final extension retirement.
6. Revalidate exact sixteen-resource/hash/identity baseline and extension-only
   what-if before any execution.

If no existing governed private uploader is available, stop for a maintainer
delivery decision. Do not invent a public ingress/egress or credential channel.

## Why not silently embed the archive?

Custom Script embedded payloads have a documented 256 KB script-value limit.
Do not assume a binary archive fits or introduce an unreviewed multi-extension
chunking mechanism. Handler/fabric transport is not authority to deliver an
arbitrary unbounded binary through unrelated channels.

The recommended next packet is **private binary-delivery authority resolution**,
not general package installation or immediate Stage 2A push permission.
All new artifacts/identities/commands must be explicit and content-addressed.
