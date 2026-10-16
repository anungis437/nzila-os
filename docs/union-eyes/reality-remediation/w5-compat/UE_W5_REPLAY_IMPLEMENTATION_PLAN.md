# W5B-COMPAT prospective terminal static disposition

W5 = **BLOCKED_TERMINAL_STATIC**. W6 = **NOT_AUTHORIZED**. Canonical contract remains **1.3.3**.
This is the final authorized offline compatibility charter, not a runtime or product proof.

## Compatibility supersession accounting

Exactly one historical payload is prospectively superseded: UE-W4FR4-PAYLOAD-09ef3aefb86ca556.
Historical SQL SHA256: `86320b5ed5efccf878808112837aa2df58b7a46e151b5faf5c104f71f210d578`.
Lineage: `PROSPECTIVE_W5_COMPAT_V1`. Historical W4P and frozen W5 bytes are unchanged.
The UUID-backed Django FK is retained with its source-native NO ACTION update/delete,
DEFERRABLE INITIALLY DEFERRED semantics. The prospective unique invariant is
`unique_org_membership (organization_id, user_id)`; legacy duplicates, nulls, invalid UUIDs and
orphan FK values deny without deduplication or conversion. No source baseline answer is changed.

## 162-payload census and exact independent residuals

Before overlay: {"ABSENT":114,"PRESENT_MATCHING":37,"PRECONDITION_MISSING":7,"PRESENT_DRIFTED":4}.
After the authorized membership overlay, before remaining W4P:
{"ABSENT":114,"PRESENT_MATCHING":38,"PRECONDITION_MISSING":7,"PRESENT_DRIFTED":3}.
ABSENT is normal pre-W4P absence, not drift. The three independent nullability contradictions
are not authorized by the UUID/membership decision. Unchanged ADD COLUMN payloads cannot tighten
already-existing nullable columns. All seven missing-operand preconditions are individually bound
to exact payload bytes, source provenance and producer searches in the census; no assumed historical
CREATE context is promoted into Django-first producer authority.

| Payload                           | Relation            | Classification                 | Exact denial                                                                                                                                                      |
| --------------------------------- | ------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UE-W4FR4-PAYLOAD-910e4de8658e1ac1 | integration_configs | REAL_UNRESOLVED_PRECONDITION   | MATERIALIZED_CONSTRAINT_OPERAND_MISSING:provider                                                                                                                  |
| UE-W4FR4-PAYLOAD-81d9d4ff553f38f1 | social_accounts     | REAL_UNRESOLVED_PRECONDITION   | MATERIALIZED_CONSTRAINT_OPERAND_MISSING:platform, MATERIALIZED_CONSTRAINT_OPERAND_MISSING:platform_user_id                                                        |
| UE-W4FR4-PAYLOAD-77c77645b1c15c95 | claims              | INDEPENDENT_TRUE_CONTRADICTION | organization_id:NULLABILITY_DRIFT                                                                                                                                 |
| UE-W4FR4-PAYLOAD-a3706a0a965fa035 | security_events     | INDEPENDENT_TRUE_CONTRADICTION | organization_id:NULLABILITY_DRIFT                                                                                                                                 |
| UE-W4FR4-PAYLOAD-6b31483bbf5fbc3a | votes               | REAL_UNRESOLVED_PRECONDITION   | MATERIALIZED_CONSTRAINT_OPERAND_MISSING:voter_id                                                                                                                  |
| UE-W4FR4-PAYLOAD-31142c169a9dd3d9 | ml_predictions      | REAL_UNRESOLVED_PRECONDITION   | MATERIALIZED_CONSTRAINT_OPERAND_MISSING:prediction_type, MATERIALIZED_CONSTRAINT_OPERAND_MISSING:prediction_date, MATERIALIZED_CONSTRAINT_OPERAND_MISSING:horizon |
| UE-W4FR4-PAYLOAD-116714fb92f94f71 | cms_pages           | REAL_UNRESOLVED_PRECONDITION   | MATERIALIZED_CONSTRAINT_OPERAND_MISSING:slug                                                                                                                      |
| UE-W4FR4-PAYLOAD-c60ebc8408c112e2 | grievances          | INDEPENDENT_TRUE_CONTRADICTION | organization_id:NULLABILITY_DRIFT                                                                                                                                 |
| UE-W4FR4-PAYLOAD-ac42c3588bfcf034 | model_metadata      | REAL_UNRESOLVED_PRECONDITION   | MATERIALIZED_CONSTRAINT_OPERAND_MISSING:model_type, MATERIALIZED_CONSTRAINT_OPERAND_MISSING:version                                                               |
| UE-W4FR4-PAYLOAD-6d3e5e5b1404436e | donation_campaigns  | REAL_UNRESOLVED_PRECONDITION   | MATERIALIZED_CONSTRAINT_OPERAND_MISSING:slug                                                                                                                      |

## E048 exact-byte disposition

Effect `UE-W5A-MIGRATION-d264f77905daf432:E048`, SHA256
`32f8b632fb11db40437bd9d9f063e30a7ff54fe7ecdeb938736697e685d6775b`, is preserved without a cast or rewrite.
UUID to UUID assignment is type-compatible in the isolated native model. It is not a full
boundary postcondition or operational graph certificate. The canonical member-document column
also causes its guarded ADD COLUMN to skip inline FK creation; no FK is synthesized.

## Qualification, fresh/noop and rollback

No coherent Django-first W4P prerequisite was produced, so no W5 graph successor was attempted.
Operational qualification: **0/106 in this charter**; total: **0/107 in this charter**;
original boundaries: **0/23**; graph effects: **0/762**. Existing financial/component proofs remain
historical predecessor evidence, not full qualification. Full fresh replay, canonical noop,
whole-graph rollback, commit/receipt restoration are **NOT_PROVEN**.
The authorized overlay has independently tested uniqueness, FK guards and atomic component
rollback; that does not qualify any W5 boundary.

## Preservation and prospective successor location

The immutable same-named W5B-C packets remain at their original paths.
The six authoritative prospective plan/registry/gate packets are in
[w5-compat](PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.md).
The [supersession authority](../UE_W5_W4P_COMPATIBILITY_SUPERSESSION.json) and
[full census](../UE_W5_W4P_COMPATIBILITY_CENSUS.json) bind source origins, payload SQL and hashes.
All frozen inputs, 23 original migration boundaries, W5B-C packets, six W5B-PK assets and
G3 terminal disposition hashes are recorded. Nodes107/edges231/compatibility127/handoffs86;
seven deferred constraints and nine downstream operands remain untouched.

## Validation and proof boundaries

Deterministic source-bound generation supports `--plan --self-test` and `--check --self-test`.
Native overlay tests and predecessor suites must be reported with their actual runner results;
generated metadata is not a test success attestation. No excluded or skipped full qualification
is represented as PASS. No 1.3.4 or inverse reconstruction is issued.
DATABASE_CONNECTIONS=0; SQL_EXECUTED_AGAINST_DATABASE=0; LIVE_EXECUTION=0;
PRODUCTION_MUTATIONS=0; G3_REOPENED=NO; MERGE=NO; PR=NO; DEPLOY=NO.
W4P/overlay/supplement/W5 live execution remains unauthorized.
READY_FOR_RUNTIME_PROOF=0; PRODUCT_READY=NO.
Static W5 remediation is exhausted. No W5B-COMPAT-2 or further charter is requested.
