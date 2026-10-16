# Phase 1B.3A - RLS / privileged DB / tenant-isolation surface census

## Gate and boundaries

- Phase 1B.3A gate: `SOURCE_CEILING`.
- RLS, client trust, and context surfaces: `CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS`.
- Phase 1B.3 remains `NOT_YET_COMPLETE`.
- Phase 1B.3B static policy reconciliation: `AUTHORIZED`; started: `NO`.
- Policy correctness, runtime tenant isolation, and product readiness: `NO`.
- Historical runtime RLS claims: `HISTORICAL_REFERENCE_ONLY`, not current proof.

## Relational denominator

612 distinct source-qualified relational objects, with one or more explicit origins: accepted Phase 1B.1 target, active RLS declaration, shared auth/database dependency, privileged DB path, or policy-function dependency. Logical database scopes are not collapsed.

### Observed source RLS state

| Classification                    | Count |
| --------------------------------- | ----: |
| RLS_ENABLED                       |     0 |
| RLS_ENABLED_AND_FORCED            |   333 |
| RLS_DISABLED_EXPLICIT             |     0 |
| NO_RLS_DECLARATION_OBSERVED       |   251 |
| RLS_NOT_APPLICABLE_BY_OBJECT_TYPE |     0 |
| SOURCE_CEILING_RLS_STATE          |    28 |

Sum: **612**. These are checked-in active migration declarations, not applied catalog state. Frozen historical migrations and rollback SQL are not active-lineage evidence.

### Isolation requirements

| Classification                    | Count |
| --------------------------------- | ----: |
| ORG_RLS_REQUIRED                  |   337 |
| USER_OR_RESOURCE_RLS_REQUIRED     |    29 |
| ORG_AND_RESOURCE_RLS_REQUIRED     |   114 |
| SYSTEM_ONLY_WITH_EXPLICIT_BYPASS  |     0 |
| GLOBAL_REFERENCE_RLS_NOT_REQUIRED |     0 |
| RLS_NOT_APPLICABLE                |     0 |
| REQUIREMENT_SOURCE_CEILING        |   132 |

Sum: **612**. Requirement and observed state remain separate; no business-policy exemptions are invented.

## Policy inventory

Total concrete final source policy identities: **1490**.

| Classification | Count |
| -------------- | ----: |
| SELECT         |   288 |
| INSERT         |   279 |
| UPDATE         |   278 |
| DELETE         |   276 |
| ALL            |   369 |

Final source declarations keyed by database scope + schema + table + policy name, after source DROP/replacement order. FOR ALL counted once, four-command coverage recorded separately. Unexpanded dynamic SQL is separately registered, never silently counted as concrete policies.

Literal helper invocations are expanded from checked-in function bodies without executing SQL. Exact USING/WITH CHECK expressions and role lists are preserved. Dynamic/catalog-dependent SQL remains separately inventoried (1 records) with explicit ceilings. Policy presence is not predicate adequacy.

Reachable inline schema/application RLS SQL declarations: **10**, covering **4** distinct candidate policy identities with repeated declaration sources retained. They are separately source-classified with exact raw expressions, source ranges, target linkage and applicability ceilings. These templates are not counted as configured forward-migration policies and do not override that lineage's observed state.

## Database clients and bypass paths

Client constructor records: **8**.

| Classification  | Count |
| --------------- | ----: |
| SUBJECT_TO_RLS  |     0 |
| EXPECTED_BYPASS |     2 |
| MIXED           |     1 |
| SOURCE_CEILING  |     5 |

Privileged/system-client symbol-reference-linked entries: **1040**. Broader module-import candidates: **1784**. Exact entry-export-to-system-client symbol paths are retained separately from module candidates; conditional runtime invocation is not proven. System credential/full-access policies are distinguished from PostgreSQL BYPASSRLS. Credential role/owner binding remains ceiling.

## Context model

- Context variables: **2**.
- Context establishment primitives: **9**.
- Transaction local: **9**.
- Session scoped: **0**.
- Scope ceilings: **0**.

Exact setting names, setter source expressions, dependent policy IDs, local flags, and transaction signals are inventoried. No runtime pooling, missing-context predicate correctness, or caller-controllability claim is made.

## Elevated SQL and grants

- SECURITY DEFINER definitions: **0**; source-linked UE subset: **0**.
- Other RLS-manipulating SQL functions: **10**; source-linked UE subset: **10**.
- Total source SQL function boundaries retained, including non-definer trigger functions: **11**; trigger invocation records: **1**. Exact function-to-ceiling links are preserved.
- Established security-sensitive views: **0**; source-linked UE subset: **0**. Queried relations without an established table/view declaration retain object-type/RLS-state ceilings, not a naming-derived type.
- Relevant source grant/revoke records: **26**.

Owner, callable-role, search-path, and catalog-generated grant uncertainty is explicit. No elevated-execution verdict is issued.

## Structural findings and ceilings

- Structural finding records: **612**.
- Explicit source-ceiling records: **842**.

| Classification                                        | Count |
| ----------------------------------------------------- | ----: |
| ORG_SCOPED_OBJECT_WITH_NO_ORG_POLICY_SIGNAL           |   147 |
| PRIVILEGED_CLIENT_REACHABLE_FROM_USER_ENTRY           |     3 |
| RESOURCE_SCOPED_OBJECT_WITH_NO_RESOURCE_POLICY_SIGNAL |   281 |
| RLS_ENABLED_WITH_NO_POLICY_FOR_COMMAND                |    22 |
| RLS_REQUIRED_BUT_NO_RLS_DECLARATION                   |   159 |

| Classification             | Count |
| -------------------------- | ----: |
| CLIENT_BYPASS              |     7 |
| CONTEXT_SCOPE              |     2 |
| DATABASE_ROLE              |   614 |
| DATABASE_SCOPE             |     1 |
| FUNCTION_SECURITY          |    11 |
| GRANT_SCOPE                |     1 |
| POLICY_EXPRESSION          |    10 |
| RELATIONAL_OBJECT_IDENTITY |    36 |
| REQUIREMENT                |   132 |
| RLS_STATE                  |    28 |

These are census records, not final security defects or affected-entry counts. No runtime DB, runtime auth, cross-tenant tests, migrations, or writes were performed. No policy, grants, roles, schema, context behavior, or product code changed.

## Frozen phase preservation

- Phase 1B.2: 1,910 unique final entries, 1,710 finding records, 3,672 ceiling records unchanged by accepted input/payload hashes.
- Historical page expectations: 43 carried forward without investigation.
- Phase 1B.1: 207 authority ceilings, 3 known authority defects, 56 input targetless chains, 43 resolved, 13 target-resolution ceilings, 0 targetless static work, and 247 Phase 1A unknown chains retained.
- RLS identity/policy evidence does not resolve authority ceilings or rewrite R2C.

## Validation

- OBJECTS_EXACTLY_ONCE: `PASS`
- POLICY_IDENTITIES_EXACTLY_ONCE: `PASS`
- COMMAND_ACCOUNTING: `PASS`
- CLIENT_ACCOUNTING: `PASS`
- CONTEXT_ACCOUNTING: `PASS`
- ACCEPTED_ENTRY_LINKAGE_IDS_VALID: `PASS`
- FROZEN_INPUT_HASHES_UNCHANGED: `PASS`
- FINAL_1910_ENTRY_MODEL_UNCHANGED: `PASS`
- ACCEPTED_ENTRY_SOURCE_RANGES_MATCH: `PASS`
- PHASE_1B_2_1710_FINDINGS_UNCHANGED: `PASS`
- PHASE_1B_2_3672_CEILINGS_UNCHANGED: `PASS`
- HISTORICAL_43_PAGES_PRESERVED: `PASS`
- PHASE_1B_1_CARRY_FORWARDS_PRESERVED: `PASS`
- DYNAMIC_SQL_EXPLICIT_NOT_SILENTLY_OMITTED: `PASS`
- NO_RUNTIME_DB_INSPECTED: `YES`
- NO_RUNTIME_AUTH_EXECUTED: `YES`
- NO_MIGRATION_EXECUTED: `YES`
- NO_DATABASE_WRITE_EXECUTED: `YES`
- NO_POLICY_CHANGED: `YES`
- NO_APPLICATION_BEHAVIOR_CHANGED: `YES`
- PHASE_1B_3B_STARTED: `NO`

All consumed files are fingerprinted with whole-file/range hashes. `--check` verifies frozen inputs, consumed source closure, and byte-identical JSON/Markdown. Full object, policy, context, client, function, grant, finding, ceiling, and linkage evidence is in the JSON census (`PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS.json`, not committed).
