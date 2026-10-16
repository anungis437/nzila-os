# W4D — physical ownership and definition adjudication

## Gate: BLOCKED; static adjudication complete

Exactly **310 decisions** adjudicated once: **269 relation/column** and **41 enum-type** decisions (no function decisions in this frozen universe). W4 remains BLOCKED; canonical **1.3** unchanged; no1.4 or W5 authorization.

Exact adjudication (`PHASE_1B_3C_A1I_W4D_PHYSICAL_OWNERSHIP_ADJUDICATION.json`, not committed) and [bounded human-decision packet](UE_W4_PHYSICAL_OWNERSHIP_HUMAN_DECISION_PACKET.json) contain every identity, candidate/source/hash, definition/precedence evidence, hold rationale and minimum human decision.

## Result arithmetic

| Partition       | Input | Approved/downstream/not-required | Held: insufficient preconsumer authority | Held: conflicting authority |
| --------------- | ----: | -------------------------------: | ---------------------------------------: | --------------------------: |
| Relation/column |   269 |                                0 |                                      269 |                           0 |
| Enum types      |    41 |                                0 |                                       41 |                           0 |
| Total           |   310 |                                0 |                                      310 |                           0 |

All nine permitted disposition counts are in JSON; SUM310, UNACCOUNTED0. No “NOT_DJANGO therefore PLATFORM” rule. No object is waived because its producer is missing.

## Positive evidence and holds

**127 decisions have exact later active definition evidence**; **183 have no active creation source**. The later definitions belong to accepted original frozen migrations, but none precedes the object's first required consumer. They are not preconsumer authority: moving/extracting them earlier requires an explicit ownership/definition/compatibility decision. Frozen SQL/order remains unchanged.

The41 types have exact source-backed CREATE TYPE/AS ENUM clauses; enum member text is recorded verbatim, not inferred from casts. Availability before consumer is still not established. Unqualified source declarations or duplicate-object suppression are not silently rewritten or promoted to new privileged W4 SQL.

Historical sources remain supporting evidence only. Drizzle/static declarations are DECLARATION_ONLY. Schema/query/RLS expressions cannot produce table definitions or owner approval. Fixed RLS helper evidence is retained only as corroboration; it is not active creation authority. No W3 roles/extensions/delegation/privilege or W7 financial ownership is reassigned.

Source reads are restricted to exact candidates referenced by the six inputs, including exact-identity candidates present in the lineage artifact but omitted from a particular candidate link. **146 referenced files** were hash-checked. Exact active CREATE clauses and required columns are checked against those bytes. ALTER TABLE/TYPE and index statements are recorded separately as alteration, not relation creation. Bounded line-oriented alteration evidence does not claim exhaustive dynamic SQL semantics.

## Producer/handoff state

Approved producer updates **0**; mutating SQL generated **0**. Existing blocked platform registry remains unchanged. Original372 Django mappings,82-node plan and four raw wrappers are hash-preserved. All768 W4 obligation records retain producer/downstream disposition and RUNTIME_PROVEN=NO.

All86 W5 handoffs are refreshed **in this supplemental W4D packet**, adding decision ID, final held authority, null approved producer ID plus the original blocked-producer reference and W5_ADJUDICATION_REQUIRED=YES. No W5 closure is asserted. All118 W6 handoffs remain unchanged with semantic binding required.

## Bounded next human decision

NO_FURTHER_W4_GENERIC_STATIC_DISCOVERY = **YES**. Each hold identifies the exact active/historical/declaration candidate options. Where a later active definition exists, the minimum decision is an explicit compatible preconsumer creation authority/definition while preserving later frozen semantics, or a separate architecture/manifest authorization. Where none exists, supply/approve an exact active canonical definition and ownership under Django or explicit platform authority. Neither option is implemented or approved here.

## Validation and proof

```powershell
pnpm exec tsx scripts\ue\adjudicate-w4-ownership.ts --self-test --check
pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\adjudicate-w4-ownership.test.ts scripts\ue\w4-physical-producers.test.ts apps\union-eyes\scripts\provisioning\governed-provisioning.test.ts
```

Closeout checks **PASS**: **138 offline tests** (41 W4D,38 W4,59 W3E), scoped TypeScript, root-scoped actual ESLint, formatting, deterministic self-test/check, unchanged W3E generator/check, and documentation audit (**0 errors,1215 existing warnings**). An independent read-only assertion run verified310/269/41 arithmetic,768/86/118 IDs,372/82/raw preservation hashes,803 prerequisites, all23 frozen migration hashes,146 candidate-source hashes, W3E code preservation and exact **1.3 ->1.2 ->1.1 ->1.0 byte reconstruction**. Exact commands/results are recorded in JSON.

No database connection, migration execution, SQL execution, producer/schema/role/extension/secret/deployment mutation or PR. Roles/extensions/memberships/Django schema/platform materialization/runtime proof remain **NO**; READY_FOR_RUNTIME_PROOF=**0**, PRODUCT_READY=**NO**.
