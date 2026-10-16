# W3D — governance decision compatibility adjudication

## Gate: BLOCKED_IMPLEMENTATION_GOVERNANCE_CONFLICT

The explicit W3D maintainer instruction approves the role identity/delegation intent and guarded vector non-requirement. They are recorded in the [decision packet](PHASE_1B_3C_A1I_W3D_GOVERNANCE_DECISION_COMPATIBILITY.json), but **not integrated into canonical 1.2** because the unchanged accepted verifier contract conflicts with authorized delegation. W3 remains BLOCKED; no 1.3/PASS/W4 authorization is fabricated.

## Two authorized decisions

- `UE-1B3CA1G-DECISION-4e0fdb9b7d80bdb5`: externally bound LOGIN principal may assume exactly its scope-local NOLOGIN authorization role; no passwords/rotation on authorization roles, no cross-scope/runtime-to-migration/nested/admin-option delegation, no privileged attributes. Existing five principal binding keys and frozen authorization-name constraints are preserved. Runtime owns no domain/helper/financial objects; migration authorization owns only legitimate scope-local producer objects. LOGIN principal creation, credentials, rotation and bounded migration activation belong to external secret/deployment authority and W8, not W3.
- `UE-1B3CA1G-DECISION-7e108c57ea428e21`: OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED. Exactly 22 recorded consumers receive one artifact-backed CURRENTLY_NOT_AUTHORIZED_TO_REQUIRE_VECTOR classification; no explicit mandatory vector declaration appears in the permitted extension/prerequisite linkage. This is governance non-requirement, **not source/replay semantic proof**. Any future vector-dependent consumer fails contract drift until an explicit consumer/prerequisite/amendment/provisioning/availability sequence is approved. The four mandatory extensions remain unchanged.

## Concrete compatibility conflict

All five accepted [W3 role specifications](UE_ROLE_EXTENSION_PROVISIONING_CONTRACT.json) require **NO_MEMBERSHIPS_IN_EITHER_DIRECTION**; the privilege contract likewise says NONE_IN_EITHER_DIRECTION. Both preserved SQL templates query pg_auth_members for roles appearing as either granted role or member role. The W3 snapshot/verifier contract rejects memberRoles as well as memberships.

Authorizing LOGIN_PRINCIPAL → authorization role necessarily creates a member of that authorization role. That legitimate member conflicts with the unchanged W3 descriptor contract. Hiding it by returning an empty catalog projection is not valid verification. Zero memberships may be a correct **pre-delegation** provisioner check, but no distinct pre-delegation/post-delegation verifier lifecycle is established in the accepted artifacts.

Bounded next authorization needed: explicitly limit the W3 verifier to the pre-delegation phase and require a separate exact W8 post-delegation verifier, **or** authorize a scoped verifier/spec/test change for only the governed direct login delegation. This mission forbids reimplementation, so neither change was made. Publishing 1.3/PASS while the mechanism's recorded membership expectation contradicts the decision would be false completion.

## Eleven-obligation model and preservation

All 11 IDs are retained exactly once in the JSON proposal. The four implemented installer mechanisms remain implemented. Seven dependency records retain their W6 object-ACL / W8 binding / later proof duties; role-dependent completion is not promoted while compatibility is unresolved. All four opaque packets, nine drift links and two SQL/verify templates remain unchanged.

Whole-file before/after hashes cover canonical 1.2, W1/W1N/W2, database contract and W3 JSON/Markdown. Section hashes preserve role/extension specifications, target validation, privilege/mode contracts, templates, opaque/drift/downstream packets and historical validation. Accepted provisioning/test code hashes remain referenced unchanged; no source rescan or code edit occurs. Required change flags are all NO.

## Version and proof boundary

Canonical version remains **1.2**, SHA256 `fe5bc24c5f1cc91af7e225e45887bb870a62e5811a2162fb74302af1e8df5cd2`. Its version 1/1.1 reconstruction chain is retained, not replaced. No 1.3 amendment is written while compatibility is blocked. The 803/118/86 universes, 23 frozen manifest hashes and W1/W2 namespace models are preserved.

W3D is blocked on implementation/governance compatibility, **not a missing human decision**. W3 remains BLOCKED; W4 is not authorized and not started. Roles, LOGIN bindings, credentials, extensions, grants, schema/RLS/deployment changes and runtime proof remain NO; READY_FOR_RUNTIME_PROOF = 0. No later workstream or PR was started.

## Validation

Artifact-only deterministic generator/check and synthetic compatibility/exact-ID tests:

```powershell
node --check scripts\ue\adjudicate-w3-governance-closure.mjs
node scripts\ue\adjudicate-w3-governance-closure.mjs --self-test --check
```

Existing 39 W3 tests, scoped types/ESLint, formatting, docs and independent preservation/version-chain/consumer/ID checks are run at closeout. Passing unchanged offline tests is preservation evidence, not proof the new delegation decision is compatible.
