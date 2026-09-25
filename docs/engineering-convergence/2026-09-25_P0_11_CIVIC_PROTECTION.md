# P0.11 CIVIC Protection

**Baseline:** `abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`

**Constitutional source:** merged PR #810

**Ruling:** `CIVIC_DOCTRINE = AUTHORITATIVE`; `CIVIC_RUNTIME = UNAUTHORIZED`;
`RUNTIME_GUARD_SCOPE = GAP_FOUND`

Current main remains authoritative for CIVIC/OCI doctrine. The canonical
method is OCI; CIVIC is the public-service front door; CLEAR articulates OCI's
evidence discipline; OCRA is a recognition-phase instrument within OCI. Human
review and institutional adoption remain authoritative. The prohibited AI,
profiling, ranking, and surveillance categories remain unchanged.

No active open PR inspected in P0.3 changes the CIVIC doctrine contract or the
`apps/civic` placeholder. Documentation conflicts must resolve in favor of the
merged contract and its machine authorities.

## Blocked local runtime lane

LANE-009 contains untracked public routes under:

```text
apps/union-eyes/app/[locale]/civic/
```

The route set includes a public front door, framing material, and a
forwardable note. Its prose attempts to respect the non-surveillance and
human-authority doctrine, but that does not authorize a runtime surface.

The lane is `BLOCKED_DECISION` and must not be integrated under the current
contract. A route inside Union Eyes would also blur the deliberately separate
CIVIC identity and create a live public surface while
`runtimeAuthorization.authorized` remains false.

## Guard-scope finding

The merged validator's runtime check walks only the configured
`runtimeAuthorization.applicationRoot`, currently `apps/civic`. Its adversarial
test proves that `apps/civic/src/index.ts` is rejected. It does not detect a
CIVIC route, alias, rewrite, package, or executable source placed inside a
different application.

Therefore PR #810 remains a valid constitutional control, but its runtime
guard is not repository-complete against the newly discovered bypass shape.
The convergence programme must harden it before claiming CIVIC runtime
non-regression across the entire repository.

## Required hardening

The control should continue to use deterministic checks and add bounded,
explicit protection for runtime aliases outside `apps/civic`:

- reject route directories or executable files named for CIVIC under other
  application roots while runtime authorization is false;
- reject proxy rewrites, redirects, navigation entries, and package scripts
  that publish a CIVIC runtime surface;
- reject runtime imports that create a CIVIC-branded executable entrypoint;
- allow doctrine documents, governance metadata, tests, and historical scope
  without turning the check into a repository-wide arbitrary prose scanner;
- include adversarial tests for the exact
  `apps/union-eyes/app/[locale]/civic` bypass shape;
- preserve current checks for OCI method ownership, human authority, AI
  boundaries, anti-surveillance rules, first-touch posture, and the
  `apps/civic` placeholder.

The new guard must not infer that every occurrence of the word `civic` is a
runtime product. It should inspect route/config/package semantics and a small
set of declared aliases.

## Authorization path

If CIVIC runtime is later proposed, authorization requires a separate
architectural decision that deliberately changes both the contract and the
validator. That decision must define product ownership, data boundaries,
privacy notice, human review, institutional adoption, deployment inventory,
readiness evidence, and production eligibility. Moving files into another app
or changing a route label cannot authorize it.

## Exit conditions

P0.11 can change to PASS for convergence when:

- the LANE-009 source is preserved for owner disposition but excluded from all
  integration branches;
- the runtime guard rejects the cross-application route bypass;
- doctrine contract tests and Portfolio Governance pass at the exact head;
- no documentation or navigation advertises a live CIVIC runtime, assessment,
  pilot, or product state beyond portfolio authority.

This finding does not authorize CIVIC implementation. It strengthens the
constitutional boundary before implementation pressure resumes.
