# W4F - bounded canonical definition authoring

## Gate: BLOCKED - explicit physical design decisions remain

Exactly **183 obligations**:57 relations and126 columns, grouped into **125 relations**. Ownership remains PLATFORM_BASELINE / HUMAN_GOVERNANCE_W4G. No late127 objects enter this authoring denominator.

| Definition disposition        | Count |
| ----------------------------- | ----: |
| CANONICAL_DEFINITION_AUTHORED |     0 |
| DESIGN_DECISION_REQUIRED      |   182 |
| DEFINITION_CONFLICT           |     1 |
| SUM                           |   183 |
| UNACCOUNTED                   |     0 |

| Evidence class                            | Count |
| ----------------------------------------- | ----: |
| EXACT_EXISTING_DECLARATION                |     0 |
| CONSISTENT_MULTI_SOURCE_DEFINITION        |     0 |
| PARTIAL_EVIDENCE_REQUIRES_DESIGN_DECISION |   182 |
| CONTRADICTORY_DEFINITION_EVIDENCE         |     1 |
| SUM                                       |   183 |

Relations: fully defined **0**, partially defined **124**, conflicted **1**, sum **125**.

[Canonical definition registry](UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.json) retains exact source declarations/ranges/digests, all governed column properties and their explicit/unresolved state, callback constraint/index expressions and contradictory known values. [W4F report](PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json) includes preservation/historical/source evidence. [Bounded design packet](UE_W4F_CANONICAL_DEFINITION_DECISION_PACKET.json) contains **126** unresolved decision groups, enumerating every183 obligation ID.

## Why definition completeness is blocked

Declaration evidence is now legitimate design input, not prior creation authority. Exact imported PostgreSQL builders establish known type/length/precision/timezone where explicit. Literal defaults, explicit NOT NULL/key/unique and referenced expressions are retained. No nullable/no-default/no-identity/no-constraint value is silently adopted from omission. Missing timestamp timezone, unresolved enum/imported factories, SQL default lowering, FK physical targets/actions and relation callback constraints remain explicit pending properties.

Absent FK ON_DELETE/ON_UPDATE is not silently replaced with PostgreSQL defaults. No UUID generator is inferred from extension availability. JSON/text, timestamp timezone, numeric precision and application-only builder methods are not normalized or discarded. Declaration variants with different explicit known values are conflicts, not chronology-based selections.

All historical candidates are hash/creation-line checked; exact referenced CREATE TABLE clauses contribute explicit type/default/key facts and reveal contradictions with current declarations. They are **design evidence only**, not promoted to creation/execution authority or complete canonical semantics. Equivalent typed numeric/JSON literal forms are normalized only for conflict comparison, with original bytes retained. Final design decisions must explicitly reconcile the evidence. Two obligations have only historical evidence: audit_logs.organization_id and organization_users.organization_id.

All definition SQL payloads are **empty** because no physically complete canonical definition was established. SQL_STATUS = DEFINITION_ONLY_NOT_EXECUTABLE; no fake final DDL, no active migration or execution adapter. Producer metadata updates **0**; existing execution flags remain NO.

## Preservation and phase boundaries

Current canonical **1.3.1 remains unchanged**; no1.3.2 or1.4. W4G310 ownership decisions,127 late definition records,127 compatibility obligations,372 Django mappings,82-node plan,raw wrappers,W3,86 W5 handoffs,118 W6 handoffs,803 prerequisites,23 frozen manifest hashes and extensions/vector remain unchanged. Collision checks for Django/late/financial scope return0. Opaque semantics remain required/unstarted.

W4 = **BLOCKED_DEFINITION_DECISIONS_PENDING** in this supplemental current phase packet; the accepted canonical/W4G historical states are not rewritten. W4P/W5 **NOT_AUTHORIZED**. NO_FURTHER_W4F_GENERIC_DISCOVERY = **YES**. No ordering compatibility decision or gated sequencing exemption is made here.

## Validation

```powershell
pnpm exec tsx scripts\ue\author-w4-canonical-definitions.ts --self-test --check
pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\author-w4-canonical-definitions.test.ts
pnpm validate:docs
```

Closeout **PASS**: **141 tests** (44 W4F,38 preserved W4,59 preserved W3E),exact183/grouping/type/nullability/default/constraint/collision/SQL safety coverage,two-run determinism/check,scoped TypeScript,actual root-scoped ESLint,formatting and documentation audit (**0 errors,1215 existing warnings**). Independent assertions verified183 IDs,182 design/1 conflict,125 relations,126 decision groups,117 referenced-source hashes/exact clause digests,310 ownership/127 late definitions/127 compatibility records,372/82/raw/W3/86/118/803/23/4/22 preservation,zero collisions/SQL/activation and exact **1.3.1 ->1.3 ->1.2 ->1.1 ->1.0 byte reconstruction**. Exact commands/results are recorded in JSON.

Preserved W4 tests run against their exact accepted1.3 canonical input reconstructed **in memory** from W4G inverse patches by verify-frozen-w4.test.ts. Only that file read is substituted inside that isolated test file; current1.3.1 bytes,W4 test bytes and sources remain untouched. W4F tests use real current inputs.

No PostgreSQL,SQL/migration execution,producer activation,role/extension mutation,secrets,W4P/W5/W6-W10 execution or PR. All runtime proof **NO**, READY_FOR_RUNTIME_PROOF **0**, PRODUCT_READY **NO**.
