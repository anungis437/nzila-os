# W3 — role/extension provisioning closure

## Offline gate: PASS

Canonical **1.3**, amendment **ROLE_EXTENSION_PROVISIONING_GOVERNANCE_CLOSURE**. W3/W3D/W3E are PASS **for offline contract/implementation only**. The unchanged [historical W3D report](PHASE_1B_3C_A1I_W3D_GOVERNANCE_DECISION_COMPATIBILITY.json) retains its original blocked ruling; this [W3E evidence](PHASE_1B_3C_A1I_W3E_DELEGATION_MEMBERSHIP_ALIGNMENT.json) supersedes that incompatibility, not its history.

## Exact delegation contract

Five canonical NOLOGIN authorization roles, each with a distinct externally supplied LOGIN binding. Existing `principals` are authorization identities; the new required `loginPrincipals` packet maps all five role classes to external authentication identities. No fallback, inference, passwords or LOGIN creation. Authorization roles have no secret/rotation; external secret/deployment authority owns authentication and rotation.

Direction: `GRANT "authorization_role" TO "bound_login_principal";` — never reversed, no ADMIN OPTION. One operation per scoped role class. Missing binding fails before planning. Bound offline plans are not authenticated runtime bindings; unbound templates remain NOT_RUNTIME_BOUND.

The full membership graph and each role's incoming/outgoing descriptor must agree. Only the exact edge is healthy after apply. Missing edge is detected by verify and may be granted by future governed apply. Extra login members, reverse edges, authorization nesting, runtime-to-migration/cross-scope edges and ADMIN OPTION fail drift before **any** mutation. No automatic membership revocation. Existing role attribute drift still fails.

Bound LOGIN principals must already exist and be LOGIN without superuser/BYPASSRLS/CREATEDB/CREATEROLE/replication. The membership query additionally measures SET capability (PostgreSQL 16+ set_option via to_jsonb; earlier versions implicitly permit SET). This ensures “may assume” is real rather than accepting an unusable edge. No secret/catalog credential fields are selected.

## Plan/verifier lifecycle and safety

Offline no-argument mode still fails; standalone --apply is blocked. --plan emits specifications or a bound nonsecret plan; --verify requires bindings and a nonsecret snapshot including complete `membershipEdges` (`grantedRole`, `memberRole`, `adminOption`, `setOption`) plus authorization/LOGIN descriptors. W8 must later supply authenticated target, exact external bindings, complete catalog projection and one transaction client under separate authorization. No W8 implementation or runtime execution occurs here.

NOLOGIN create SQL, four mandatory extension installer SQL, target/search-path/privilege/ownership/default-ACL checks remain unchanged outside authorized delegation metadata. PUBLIC/TEMP/public-schema doctrine is unchanged. No vector SQL, broad grants, password SQL, attribute repair or live GRANT.

## Obligation and vector closure

Exactly **11 obligations**, **two approved-and-implemented decisions**, **22 vector consumers**, **four opaque W6 packets**, **nine W2 drift links**. Four installer mechanisms remain implemented. W3-owned role/vector/shared-input portions are complete; W6 object ACL implementation and W8 external runtime bindings/application/W9 evidence remain pending, not generic W3 blockers.

vector = OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED, outside the exact four mandatory extensions. All 22 classifications are preserved byte-for-byte as decision records from W3D; no source reanalysis. Future vector dependency fails contract drift until explicitly amended before dependent execution. This is not replay/source semantic proof.

Nine drift records: VALIDATION_IMPLEMENTED = YES; SOURCE_CONFIGURATION_ALIGNED = NO; RUNTIME_ALIGNED = NO.

## Preservation and version chain

The JSON holds inverse patches and hashes reconstructing exact prior canonical **1.2** (`fe5bc24c5f1cc91af7e225e45887bb870a62e5811a2162fb74302af1e8df5cd2`) and prior W3 contract/report bytes, plus preserved W3D/target bytes, old implementation hashes and non-delegation plan digests. Existing version 1/1.1 reconstruction references remain intact. W1/W2 are PASS; their accepted lock/graph/universe evidence remains unmodified.

Stable digests cover ROLE_SPECIFICATIONS, MEMBERSHIP_PLAN, MEMBERSHIP_VERIFY_QUERIES, FULL_W3_PLAN and VECTOR_DECISION_MODEL. Two generator runs must match.

## Validation commands

```powershell
pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\provisioning\governed-provisioning.test.ts
pnpm exec tsx scripts\ue\align-w3-delegation-contract.mjs --self-test --check
```

Closeout results: **59 offline tests PASS**, including **95 prohibited directed edges per scope**; scoped TypeScript and UE ESLint PASS; generator self-tests/check/two-run determinism PASS; historical W3D check PASS; scoped formatting PASS; documentation audit PASS (**0 errors, 1,215 warnings**). Independent checks PASS for exact **1.3 → 1.2 → 1.1 → 1 bytes**, W1/W2/frozen universes, 11/2/22 exact IDs, five exact directed GRANTs/four preserved installers and prohibited/admin/SET edges. Exact commands/results are recorded in the JSON. Synthetic injected execution in tests is not SQL executed against a database.

## Proof boundary and next authority

W4 = **AUTHORIZED_NOT_STARTED**, W4_STARTED = NO. W5–W10/replay/PR are not started. DATABASE_ROLES_PROVISIONED, LOGIN_PRINCIPALS_BOUND, ROLE_MEMBERSHIPS_APPLIED, SECRETS_ACCESSED, EXTENSIONS_RUNTIME_PROVEN, DATABASE_RUNTIME_CONFIGURATION_APPLIED, DJANGO_SCHEMA_MATERIALIZED, PRECONSUMER_BASELINE_MATERIALIZED, BOOTSTRAP_IMPLEMENTATION_COMPLETE, FAITHFUL_SCHEMA_REPLAY_PROVEN, PRODUCTION_SCHEMA_PROVEN, RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN, TENANT_ISOLATION_RUNTIME_PROVEN and PRODUCT_READY are **NO**. READY_FOR_RUNTIME_PROOF = **0**.
