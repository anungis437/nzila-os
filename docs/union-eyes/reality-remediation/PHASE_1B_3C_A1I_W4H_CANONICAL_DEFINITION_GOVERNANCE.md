# W4H - canonical definition governance closure

## Gate: BLOCKED - decisions only

New human doctrine: **MINIMUM_SEMANTIC_COMMITMENT + NO_DATA_LOSS_BY_DEFAULT + NO_UNPROVEN_INTEGRITY_CONSTRAINT + EXACT_DECLARATION_WHERE_AVAILABLE**. Frozen W4F report,registry,original decision packet,W4G and canonical1.3.1 bytes remain unchanged.

| Group disposition                |   Count |
| -------------------------------- | ------: |
| APPROVED                         |     121 |
| RESIDUAL_HUMAN_DECISION_REQUIRED |       5 |
| CONFLICT                         |       0 |
| SUM / UNACCOUNTED                | 126 / 0 |

| Obligation coverage        | Count |
| -------------------------- | ----: |
| ALL_PROPERTIES_GOVERNED    |   178 |
| RESIDUAL_DECISION_REQUIRED |     5 |
| CONFLICTED                 |     0 |
| SUM                        |   183 |

All125 relation groups and every183 obligation appear exactly once in their governance partition. All selected properties carry EXACT_DECLARATION,EXACT_HISTORICAL_EVIDENCE,W4H_GOVERNANCE_DEFAULT or W4H_CONFLICT_RESOLUTION provenance.

## Applied doctrine

Preserve exact current types/defaults/key/nullability first,then exact historical evidence where current evidence does not settle a fact. Missing nullability becomes NULLABLE; default NO_DEFAULT (not DEFAULT NULL); generation NONE; no unproven PK/unique/check/FK/index. Exact unparameterized numeric evidence may be adopted as numeric without invented precision. Generic timestamp/JSON/type factories remain residual,not platform-normalized.

Physical FK requires exact qualified source/target/column evidence. Missing actions on such a target adopt NO_ACTION under new doctrine; symbolic targets alone do not invent physical identity. Logical relationship expressions remain carried for W6. Exact relation constraint/index declaration expressions are preserved as governance input for later authoring,not generated SQL or query-derived indexes.

## case_documents: conflict closed

Current text selected for linked_by and link_type. Historical varchar(255)/varchar(20) remains compatibility evidence; no accepted current business invariant requires those narrower limits. Provenance **W4H_CONFLICT_RESOLUTION**; no truncation semantics introduced.

## Residual packet

[Governance report](PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json) contains126 group dispositions,183 obligation selections,property provenance and exact evidence references. [Residual decisions](UE_W4H_RESIDUAL_DEFINITION_DECISION_PACKET.json) contains only **5** groups with undecided properties and exact affected IDs; approved choices are not reasked.

NO_FURTHER_W4H_DOCTRINE_PASS = **YES**. No generic source discovery. W4F regeneration = **NOT_AUTHORIZED**, unstarted. W4 = **BLOCKED_DEFINITION_DECISIONS_PENDING**; W4P/W5 **NOT_AUTHORIZED**.

## Validation and proof boundaries

```powershell
pnpm exec tsx scripts\ue\govern-w4-definition-doctrine.ts --self-test --check
pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\govern-w4-definition-doctrine.test.ts
pnpm validate:docs
```

Closeout **PASS**: **35 tests** covering exact126/183 coverage,property/component provenance,doctrine/default/case_documents/consumer-contradiction,named enum precedence and no-hybrid-schema rules;two-run deterministic self-test/check;scoped TypeScript;actual root-scoped ESLint;formatting;documentation audit (**0 errors,1215 existing warnings**). Independent assertions verified exact126/183/125 IDs and groups,121 approved/5 residual,178 governed/5 residual,the2 case_documents text resolutions,5 exact residual alternatives,immutable fixed upstream bytes,310/127/127/372/82/raw/W3/86/118/803/23 preservation and exact canonical1.3.1 hash. Exact commands/results are recorded in JSON.

No SQL authored,payloads created,database access,migration creation,producer activation,contract mutation,W4F regeneration,W4P/W5/W6-W10 execution or PR. Runtime proof remains NO; READY_FOR_RUNTIME_PROOF0,PRODUCT_READY NO.
