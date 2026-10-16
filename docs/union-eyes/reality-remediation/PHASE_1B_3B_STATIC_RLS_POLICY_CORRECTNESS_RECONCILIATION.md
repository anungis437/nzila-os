# Phase 1B.3B — normalized static RLS policy model

## Normalized gate and state

```text
PHASE_1B_3BN_GATE = PASS
PHASE_1B_3B_ANALYSIS_WORK = ACCEPTED
PHASE_1B_3B_GATE = PASS
PHASE_1B_3B = SOURCE_CEILING_ACCEPTED
STATIC_RLS_POLICY_MODEL = CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS
PHASE_1B_3B_STATIC_WORK_REMAINING = 0
NO_FURTHER_PHASE_1B_3B_GENERAL_STATIC_PASS = YES
RLS_STATIC_MODEL_CLOSED = YES
PHASE_1B_3 = NOT_YET_COMPLETE
PHASE_1B_3C = AUTHORIZED_NOT_STARTED
PHASE_1B_3C_STARTED = NO
PRODUCT_READY = NO
```

PASS measures completion of exact-once bounded adjudication and normalization, not absence of known defects or proof of deployed policy correctness. Source/catalog ceilings are categorized assurance obligations, not unfinished general static analysis.

Authoritative B3A census (`PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS.json`, not committed), SHA-256 `5755b17e89fbb81b3afb1b6fda4e18ba107153cd52680bad21041e466c13a883`. Normalized JSON (`PHASE_1B_3B_STATIC_RLS_POLICY_CORRECTNESS_RECONCILIATION.json`, not committed) preserves accepted evidence and adds canonical dimensions, exact ceiling linkage and the fixed runtime-proof denominator. [Deterministic reconciler](../../../scripts/ue/reconcile-static-rls-policy-correctness.mjs) now runs the artifact-only normalization path; historical analysis code is not executed.

## Canonical 612-object accounting

| Classification                      | Count |
| ----------------------------------- | ----: |
| STATIC_RLS_MATCH                    |     0 |
| STATIC_RLS_PARTIAL                  |     0 |
| STATIC_RLS_REQUIRED_CONTROL_MISSING |     0 |
| STATIC_RLS_SEMANTIC_MISMATCH        |     0 |
| STATIC_RLS_REQUIREMENT_CEILING      |   339 |
| STATIC_RLS_POLICY_CEILING           |     0 |
| MIXED_STATIC_RLS_RESULT             |   273 |

**612 = 0 + 0 + 0 + 0 + 339 + 0 + 273**. All object IDs and all dimension-level internal results remain preserved. Canonical dimension values are aliases derived from those existing results/findings/ceiling records only; no SQL expression, authority requirement or source path is re-adjudicated.

Requirements remain **337 organization**, **29 user/resource**, **114 organization-plus-resource**, **132 requirement ceilings**. Requirement-by-canonical-disposition arithmetic is retained in JSON.

## Known defects and source ceilings preserved

- **159** unique objects retain required-RLS declaration-gap findings.
- **2** exact objects retain nullable-org semantic mismatches: `union-eyes::public.account_mappings` and `union-eyes::public.holidays`.
- The two migration-comment global-read intents remain documented; their frozen requirements remain strict-org. No exemption or runtime defect proof is invented.
- **3,169** static finding records and **2,656** correctness ceiling records are unchanged; **612** unique objects are affected by current ceiling records.
- Mixed dispositions preserve known missing/partial/mismatch facts alongside independent requirement, policy and catalog obligations. No known defect is collapsed into a generic ceiling.

## Exact 842-predecessor-ceiling reconciliation

| Classification                      | Count |
| ----------------------------------- | ----: |
| RESOLVED_BY_STATIC_ANALYSIS         |     0 |
| RETAINED_AS_REQUIREMENT_CEILING     |   132 |
| RETAINED_AS_POLICY_CEILING          |    46 |
| RETAINED_AS_RUNTIME_CATALOG_CEILING |   640 |
| SPLIT_INTO_MULTIPLE_B3B_CEILINGS    |    24 |

Sum: **842** predecessor IDs, each represented once; unaccounted: **0**. These counts describe predecessor records, not current output ceiling-record counts.

No predecessor ceiling is declared resolved without resolution evidence. Existing direct predecessor links are used first. Shared-scope obligations without exact affected objects are explicitly linked to the existing B3B register and retain their original scope/reason/required evidence. One-to-many links are counted as splits; no substantive B3B ceiling is added, removed or claimed resolved. Original dynamic/global obligations remain explicit.

## Policy and effective-group preservation

**1,490** unique final policy identities; lost **0**, duplicates **0**. **3,244** row-direction analyses and **6,120** direction-combination records remain unchanged. **4,896** object/command/role groups retain those direction records and all applicable policy IDs; unaccounted groups **0**.

All **8 clients**, **9 context primitives**, **11 SQL function boundaries** and **26 grants/revokes** are preserved. The accepted partial callback/context and privileged-path adjudications are unchanged.

## Fixed B3C runtime-proof denominator

**3124** deterministic runtime-proof items normalized from the unchanged accepted proposal:

| Classification                  | Count |
| ------------------------------- | ----: |
| BYPASSRLS_ROLE                  |     2 |
| CONNECTION_POOL_CONTEXT_LEAKAGE |     8 |
| CONTEXT_ISOLATION               |     9 |
| CROSS_ORG_DELETE                |   612 |
| CROSS_ORG_INSERT                |   612 |
| CROSS_ORG_READ                  |   612 |
| CROSS_ORG_UPDATE                |   612 |
| FUNCTION_EXECUTION              |    11 |
| GRANT_EFFECT                    |    26 |
| OWNER_RLS                       |   612 |
| PRIVILEGED_CLIENT               |     8 |

| Classification                                 | Count |
| ---------------------------------------------- | ----: |
| READY_FOR_RUNTIME_PROOF                        |     0 |
| BLOCKED_BY_KNOWN_STATIC_DEFECT                 |   663 |
| BLOCKED_BY_REQUIREMENT_DECISION                |  1007 |
| BLOCKED_BY_FIXTURE_OR_ENVIRONMENT_PRECONDITION |   814 |
| CATALOG_EVIDENCE_ONLY                          |   640 |

Each item includes an ID, exact object/group/client linkage, allow/deny-case shape, fix/acceptance preconditions and required runtime/catalog evidence. No concrete fixture or row-set expectation is invented; absent item-specific contracts and environment evidence are explicitly unsatisfied preconditions. No item is executable now. Catalog-only items distinguish attribute capture from application allow/deny probes.

B3C is **AUTHORIZED_NOT_STARTED** as a controlled future mission. Known-defect and requirement-decision items remain blocked; execution still requires its future prompt and satisfied item preconditions. No repairs or runtime tests are performed here.

## Evidence preservation and validation

All **20** substantive pre/post SHA-256 digests are unchanged. The historical full 612-object digest is also retained; only final classifications/state change. Policy expressions, row-direction analyses, combinations, findings, ceilings, context/client/function/grant adjudications, proposal evidence, source/entry registries and prior-phase carry-forwards remain unchanged.

Only the two fixed JSON artifacts and this reconciler are inspected by normalization. No application/migration source is read, no SQL expression re-evaluated, no runtime DB/auth accessed, no migration/write executed, no policy/product repaired and no PR created.

Preserved: **1,910** server entries, **1,710** prior findings, **3,672** prior ceilings, **43** historical expectations, **207** authority ceilings, **3** R2B defects, **56** R2C chains (**43** resolved, **13** target ceilings), and **247** frozen Phase 1A unknown-effect chains. Fingerprints and prior validated source ranges are preserved without rescanning source.

Validation commands:

- `node --check scripts/ue/reconcile-static-rls-policy-correctness.mjs`
- `node scripts/ue/reconcile-static-rls-policy-correctness.mjs --self-test`
- `node scripts/ue/reconcile-static-rls-policy-correctness.mjs`
- `node scripts/ue/reconcile-static-rls-policy-correctness.mjs --check`
- Scoped `pnpm exec prettier --check` for the reconciler and two reports.
- `pnpm validate:docs`

## Proof boundaries

```text
RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN = NO
TENANT_ISOLATION_RUNTIME_PROVEN = NO
PRIVILEGED_DB_RUNTIME_BEHAVIOR_PROVEN = NO
DATABASE_ROLE_RUNTIME_IDENTITY_PROVEN = NO
OWNER_RLS_RUNTIME_BEHAVIOR_PROVEN = NO
PHASE_1B_3C_STARTED = NO
PRODUCT_READY = NO
```
