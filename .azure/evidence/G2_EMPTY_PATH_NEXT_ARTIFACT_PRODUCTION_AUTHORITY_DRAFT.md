# DRAFT ONLY - G2 Stage 2A artifact production

Mission: `NZ-20261008-INFRA-001`.
Proposed gate: `G2_PRIVATE_CONTROL_PLANE`.
Proposed slice: `G2_STAGE2A_ARTIFACT_PRODUCTION`.

**EXECUTION_AUTHORIZED = NO**

**EXECUTED = NO**

This document requests separate future approval. Successful empty-path
readback does not authorize extraction, ORAS execution or artifact writes.
No production script/CSE is prepared or dispatched by this closure packet.

## Proven prerequisite

`STAGE2A_PRIVATE_ORAS_DELIVERY_PROVEN`, as recorded in
[the closure report](G2_EMPTY_PATH_REPORT.md) and
[hash-bound disposition](G2_EMPTY_PATH_FINAL_DISPOSITION.json).
Exactly one previous staging/import remains the only staging/import;
this proposal does not permit repeating either.
Overall G2 remains FAIL. No UE/Cora product data or code is in scope.

## Proposed boundary

Use only the existing Canada Central builder and target private ACR
`nzilag2tzo75uuozprbo`; existing attached builder UAMI only.
Before any future dispatch, refresh HEAD/status, protected16, target
Disabled/None/admin disabled, exact role census, absent importer roles,
no CSE, and private login .5/data .4 DNS/PE NIC mappings.
Stop on drift without remediation. No new network/RBAC/capacity.
Do not reopen AzureServices, use admin credentials, access GitHub Internet
from builder, install packages or request runtime tooling access.

## Proposed exact execution

1. **Bind source before dispatch.** Create separate content-addressed authority
   for the frozen approved deterministic synthetic-health source, exact
   payload bytes/media types, OCI manifest/tag, expected artifact digest,
   runner/CSE/tests/template/parameters and all helper inputs.
   No mutable latest reference, timestamps/random payloads, or unbound
   artifact. If required synthetic artifact format/tag/digest is not already
   accepted, obtain explicit acceptance before execution.
2. **Private retrieval and revalidation.** Use builder UAMI IMDS and exact
   `repository:g2-tooling:pull` grant, frozen manifest digest
   `sha256:644f66c67367de24eeb3c5d921d7cd31c59afe3d3965e7e82c41e104fdcc2f0f`.
   Follow the exact validated signed URI in memory with no registry
   Authorization forwarding. Require .4 DNS/peer, certificate/SNI/Host
   validation and HTTP200. Revalidate archive size 4,679,642 and SHA
   `f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`
   before extraction or execution.
3. **Temporary extraction/version.** Use a uniquely scoped temporary
   directory; validate archive members before extraction (no traversal,
   absolute names, links or special files; only explicitly approved regular
   members). Extract the approved ORAS executable only. Prove ORAS 1.3.4,
   Linux AMD64, record binary hash and sanitized version, never install it
   globally or modify package configuration.
4. **Builder push identity.** Obtain builder UAMI token targeted by client ID;
   verify tenant/principal/client claims. Exchange for exact
   `repository:synthetic-health:pull,push` scope. Check actual token grant
   set, expiry and existing conditioned Writer; no broader catalog/write
   scope. Use temporary private credential material only if required by
   ORAS, never command-line bearer arguments or logs.
5. **Exactly one deterministic push.** Preflight the exact accepted
   synthetic-health tag with authenticated private absence proof. If it
   already exists, STOP and preserve it. Use the source-bound bytes and
   digest; perform exactly one ORAS push invocation, with no controller
   retry or fallback tag. Explicitly bound/disable client retries where
   supported. Any uncertain partial push is a stop, not authority to retry
   or delete registry data. No other repository push.
6. **Digest roundtrip.** Read the accepted tag and immutable digest privately,
   compare raw manifest and descriptors to precomputed authority, stream
   and compare payload hashes. Record exactly the artifact type, repository,
   tag, digest and byte counts. A success exit code alone is insufficient.
7. **Repository confinement denial.** Test builder write denial on a fixed
   out-of-scope probe repository using non-mutating authorization checks:
   scoped exchange/grant inspection and fail-closed denial. Never attempt an
   actual out-of-scope blob upload/manifest PUT or create a probe artifact.
   Fail if write capability is granted; never "prove" denial by mutation.
8. **Cleanup and retirement.** On terminal success/failure remove only exact
   temporary files/directories created by this future runner, including
   archive, executable and credential material. Verify configuration
   unchanged, no global ORAS and exact CSE absent. Preserve pushed artifact
   and all evidence even on failure; registry deletion is not proposed.

## Proposed validation and future approval

Require all current historical tests plus new production/extraction/auth/
determinism/cleanup/confinement tests; Bicep build/lint, whitespace, provider
validation and raw exact-one-CSE Create, no other mutation.
Follow azure-prepare -> azure-validate -> azure-deploy.
Bind accepted product-free synthetic source authority before approval and
dispatch. Request exactly one separately consumable CSE execution.
Do not infer approval from this draft or the consumed empty-path packet.

## Proposed final proof

Require ORAS SHA/version, builder identity and exact push grant, one push,
immutable synthetic-health artifact digest and roundtrip hashes,
non-mutating repository-confinement denial, temporary credential/tooling
cleanup, CSE retirement, unchanged protected16/DNS/RBAC/source registry
and no product action. Retain exact failure stage on any failure.

Stage 2B remains separate; no runtime deployment or Stage 3.
Overall G2 remains FAIL until later independently required proofs close.
