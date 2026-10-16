# Phase 1B.1 — Canonical Data Authority & Persistence Universe

**Gate: SOURCE_CEILING_ACCEPTED**

## Scope and non-proofs

- Phase 1A remains frozen at `SOURCE_CEILING_ACCEPTED`; this census does not modify its findings.
- Source-only analysis. No database connection, runtime inspection, migration execution, database write, repair, or Phase 1B.2+ work was performed.
- Migration/RLS entries show checked-in source artifacts only; they do not prove application or current runtime policy state.
- Access references are static candidates, not proof of runtime reachability or successful execution.

## Denominators

| Measure                                                              | Count |
| -------------------------------------------------------------------- | ----: |
| All TypeScript schema-call declarations                              |  1443 |
| Production exported relational declarations                          |  1438 |
| Production exported enum declarations                                |   695 |
| Qualified relational objects across source database scopes           |  1593 |
| Objects with a directly imported production Drizzle access candidate |    36 |
| Django model declarations                                            |   524 |
| Migration files scanned                                              |   212 |
| SQL migration files scanned                                          |   170 |
| Django Python migration files scanned                                |    42 |
| Migration DDL events                                                 |  8723 |
| Migration-only historical objects                                    |   609 |
| RLS policy artifacts                                                 |   353 |
| RLS enable/force/disable artifacts                                   |   411 |

## Migration source lineages

| Lineage           | Files |
| ----------------- | ----: |
| django            |    42 |
| frozen-historical |   135 |
| platform          |     7 |
| scoped-cache      |    23 |
| temporary-audit   |     5 |

## Authority classes

| Class                                         | Objects |
| --------------------------------------------- | ------: |
| ACTIVE_CANONICAL_AUTHORITY                    |      13 |
| ACTIVE_CANONICAL_AUTHORITY_WITH_LEGACY_MIRROR |     511 |
| CONFLICTING_OR_UNRESOLVED_AUTHORITY           |     163 |
| GENERATED_OR_DERIVED_REPRESENTATION           |      34 |
| MIGRATION_ONLY_HISTORICAL                     |     609 |
| PROVIDER_OR_EXTERNALLY_MANAGED                |       3 |
| UNKNOWN_SOURCE_CEILING                        |     260 |

## Phase 1B.1-R1 exact-five adjudication

**Fixed-five status: PASS**  
**Overall census gate remains: SOURCE_CEILING**

The R1 declaration parser uses each anchored declaration’s root Drizzle builder call to identify database column names; declarations outside the exact five retain the existing parsing behavior.

| Object                                          | Final disposition                   | Defect        | Confidence |
| ----------------------------------------------- | ----------------------------------- | ------------- | ---------- |
| financial-service::public.arrears               | KNOWN_DUPLICATE_AUTHORITY_CONFLICTS | UE-1B1-R1-001 | high       |
| financial-service::public.dues_rules            | KNOWN_DUPLICATE_AUTHORITY_CONFLICTS | UE-1B1-R1-002 | high       |
| financial-service::public.dues_transactions     | KNOWN_DUPLICATE_AUTHORITY_CONFLICTS | UE-1B1-R1-003 | high       |
| financial-service::public.stipend_disbursements | KNOWN_DUPLICATE_AUTHORITY_CONFLICTS | UE-1B1-R1-004 | high       |
| union-eyes::public.dues_transactions            | ACTIVE_CANONICAL_WITH_LEGACY_MIRROR | UE-1B1-R1-005 | high       |

| Exclusive R1 disposition                                        | Objects |
| --------------------------------------------------------------- | ------: |
| ACTIVE_CANONICAL_TABLES                                         |       0 |
| ACTIVE_CANONICAL_WITH_LEGACY_MIRROR                             |       1 |
| LEGACY_NON_AUTHORITATIVE_TABLES                                 |       0 |
| MIGRATION_ONLY_HISTORICAL_TABLES                                |       0 |
| GENERATED_OR_DERIVED_TABLE_REPRESENTATIONS                      |       0 |
| TEST_OR_FIXTURE_ONLY_TABLES                                     |       0 |
| KNOWN_DUPLICATE_AUTHORITY_CONFLICTS                             |       4 |
| UNKNOWN_AUTHORITY_TABLES                                        |       0 |
| Noncanonical Drizzle mirror declarations (representation count) |       2 |
| Declared column-shape conflicts (representation count)          |       5 |

The R1 fixed-five result remains unchanged. R2 changes are limited to the enumerated initial residual set.

Global residual: 7 active-access objects retain unknown authority across the full census; the full universe contains 260 unknown-source-ceiling objects. The R1 adjudication does not resolve or reclassify them.

## Phase 1A target reconciliation

The accepted Phase 1A normalization contains 394 effect records, of which 58 have a known database effect. 3 explicit target label(s) are present; 3 resolve uniquely, and 0 remain unresolved or ambiguous. 56 known database-effect records contain no explicit target label.

247 accepted `UNKNOWN_DATA_EFFECT` record(s) are carried forward without re-adjudication. This is an evidence boundary, not a claim that they do or do not persist data.

| Chain            | Effect          | Target label          | Resolution                    | Matched object(s)                          |
| ---------------- | --------------- | --------------------- | ----------------------------- | ------------------------------------------ |
| UE-B2-CHAIN-0384 | DATABASE_INSERT | recognitionAwardTypes | RESOLVED_TO_ONE_SOURCE_OBJECT | union-eyes::public.recognition_award_types |
| UE-B2-CHAIN-0384 | DATABASE_INSERT | recognitionAwards     | RESOLVED_TO_ONE_SOURCE_OBJECT | union-eyes::public.recognition_awards      |
| UE-B2-CHAIN-0386 | DATABASE_INSERT | recognitionPrograms   | RESOLVED_TO_ONE_SOURCE_OBJECT | union-eyes::public.recognition_programs    |

## Known limitations

- No live PostgreSQL catalog, deployed schema, migration ledger, or runtime database connection was queried.
- A checked-in migration or RLS statement proves only source presence, not that it ran or is currently effective.
- Authority is asserted only where checked-in authority registry/model doctrine or canonical schema map explicitly supports it; unregistered objects remain source-ceiling findings.
- Access references are source-level candidates, not proof of reachable behavior, successful queries, tenant isolation, or actual writes.
- Only direct relative named imports are linked to a declaration; unresolved aliases, re-export barrels, and external imports remain outside object-level access evidence.
- Declaration conflicts compare column names only and do not establish semantic incompatibility or compatibility.
- Dynamic SQL, generated identifiers, framework indirection, and external provider-side persistence may be incompletely represented.

## Detailed inventory

The JSON companion contains 1593 qualified object records, per-declaration columns and source paths, directly bound static access candidates, unresolved schema-like imports, lineage-tagged migration DDL evidence, RLS policy artifacts, explicit registry ownership, and Phase 1A target links.

Generated by `scripts/ue/census-data-authority.mjs`.

## Phase 1B.1-R2 global residual closeout

**R2 gate: SOURCE_CEILING**  
**Phase 1B.1: SOURCE_CEILING_ACCEPTED**

Frozen residual denominator: 1529 records (260 unknown-authority objects, 966 unresolved schema imports, 56 targetless accepted Phase 1A database-effect chains, and 247 frozen Phase 1A unknown-effect carry-forwards).

Disposition sum: 1529; 53 migration-only historical records and 1476 explicit source ceilings.

R1 reintroduced as unknown: 0. Non-residual objects changed: 0 (SHA-256 0f112e6f6a93b3857a6fc410f4a5d56b7cf6a746f8a86f8667a075e6d99f7416).

See [R2 residual closeout](./PHASE_1B_1_R2_RESIDUAL_AUTHORITY_CLOSEOUT.md) for the complete residual index and evidence boundaries.
