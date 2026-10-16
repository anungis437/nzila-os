# W4T1 - final four named-type human definition selections

**W4T1=PASS;normalized W4T=PASS;COMPLETE_NOT_EXECUTED.**

Current product schema declaration is selected as the forward canonical named-type definition. Historical declarations remain compatibility evidence for predecessor states and do not constrain the current canonical enum to the older member set.

This is explicit human architecture authority,not a static-evidence tiebreaker. Ownership remains HUMAN_GOVERNANCE_W4T/PLATFORM_BASELINE for all36 types. The frozen blocked W4T evidence is unchanged.

## public.fee_adjustment_type

Human selection: **CURRENT**;definition authority **HUMAN_ARCHITECTURE_W4T1**.
Source: [apps/union-eyes/db/schema/domains/finance/transaction-fees.ts](../../../apps/union-eyes/db/schema/domains/finance/transaction-fees.ts),lines58-64.
Source SHA256: `e2f48c802f99e2b946610cbcc565b7049b66869a11a25b1985905d68f93102db`.
Definition digest: `a337b4b00db92bdf1e9b21b12164bd8b8aff9625ecf59c723aede9ba24854c91`.
Ordered member digest: `2b3928e2163632b9bfa497c8ecb8508832947bf2843e1553933ef3a55f084cb6`.

Exact ordered members copied from the frozen candidate:

```json
["reversal", "partial_reversal", "waiver", "correction", "dispute_credit"]
```

Historical [apps/union-eyes/db/migrations/0086_monetization_phase2.sql](../../../apps/union-eyes/db/migrations/0086_monetization_phase2.sql),digest `ae8565585299ce6500ca416e4f609112f0c821b27e408181b66d6432d3dbb90e`: **NON_CANONICAL_HISTORICAL_TYPE_DEFINITION**,PRESERVED=YES,COMPATIBILITY_EVIDENCE=YES.

## public.ledger_event_type

Human selection: **CURRENT**;definition authority **HUMAN_ARCHITECTURE_W4T1**.
Source: [apps/union-eyes/db/schema/domains/finance/platform-ledger.ts](../../../apps/union-eyes/db/schema/domains/finance/platform-ledger.ts),lines41-53.
Source SHA256: `b12c79c10cf7461b52d3ccace7869e455b0b42574119ef30a30c5bc952f247ac`.
Definition digest: `b98fa32da24b6057c6f3e53a1534cea530b36ae242cff3ea6dc9af954c2a18b2`.
Ordered member digest: `d46f352c3593765df52c6446981b6f1df6aa6c0fa2b88215a42e770108db70ec`.

Exact ordered members copied from the frozen candidate:

```json
[
  "invoice_generated",
  "payment_received",
  "allocation_run",
  "adjustment_posted",
  "credit_applied",
  "subsidy_applied",
  "writeoff_posted",
  "period_closed",
  "reversal",
  "fee_captured",
  "settlement_closed"
]
```

Historical [apps/union-eyes/db/migrations-audit/0000_familiar_silhouette.sql](../../../apps/union-eyes/db/migrations-audit/0000_familiar_silhouette.sql),digest `4139f1de83d4f10edfd4d28513427a655791768f761ebc4d042aaa031a9d5f37`: **NON_CANONICAL_HISTORICAL_TYPE_DEFINITION**,PRESERVED=YES,COMPATIBILITY_EVIDENCE=YES.

Historical [apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql](../../../apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql),digest `d7e0352e30dc79bdf0f26aa1158b7284e1e01febdf6e368562ce0fee66b0f8f4`: **NON_CANONICAL_HISTORICAL_TYPE_DEFINITION**,PRESERVED=YES,COMPATIBILITY_EVIDENCE=YES.

## public.ledger_source_type

Human selection: **CURRENT**;definition authority **HUMAN_ARCHITECTURE_W4T1**.
Source: [apps/union-eyes/db/schema/domains/finance/platform-ledger.ts](../../../apps/union-eyes/db/schema/domains/finance/platform-ledger.ts),lines55-65.
Source SHA256: `b12c79c10cf7461b52d3ccace7869e455b0b42574119ef30a30c5bc952f247ac`.
Definition digest: `d8d6be25d6aa292745e5a08c7276554f6e92551d4f21956d0002db3b22e6d66b`.
Ordered member digest: `c704a5e44bc391ab151c72e74cdf55b70535aac3f5f67a7b5a6a0bc4557c1501`.

Exact ordered members copied from the frozen candidate:

```json
[
  "subscription",
  "invoice",
  "payment",
  "adjustment",
  "allocation",
  "manual",
  "system",
  "transaction_fee",
  "settlement_batch"
]
```

Historical [apps/union-eyes/db/migrations-audit/0000_familiar_silhouette.sql](../../../apps/union-eyes/db/migrations-audit/0000_familiar_silhouette.sql),digest `10d88a66ae766dfb7a120fdf93629215dead0f22f6c8f53c04eb0db8a72fe636`: **NON_CANONICAL_HISTORICAL_TYPE_DEFINITION**,PRESERVED=YES,COMPATIBILITY_EVIDENCE=YES.

Historical [apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql](../../../apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql),digest `2c1c6c924de54a82e999367a111a40590137e3e7a68bdffe76b0890927226e9a`: **NON_CANONICAL_HISTORICAL_TYPE_DEFINITION**,PRESERVED=YES,COMPATIBILITY_EVIDENCE=YES.

## public.platform_cost_type

Human selection: **CURRENT**;definition authority **HUMAN_ARCHITECTURE_W4T1**.
Source: [apps/union-eyes/db/schema/domains/finance/platform-ledger.ts](../../../apps/union-eyes/db/schema/domains/finance/platform-ledger.ts),lines25-39.
Source SHA256: `b12c79c10cf7461b52d3ccace7869e455b0b42574119ef30a30c5bc952f247ac`.
Definition digest: `7f81f7eb340f05b9c7ca7f4461d6a40395e042553f5a8c91850264c980f545fb`.
Ordered member digest: `c60e561bf0554defd7092886dd99862f0f6f78878e5bf58359528be44f66255e`.

Exact ordered members copied from the frozen candidate:

```json
[
  "base_subscription",
  "local_fee",
  "seat_fee",
  "module_fee",
  "usage_fee",
  "onboarding_fee",
  "support_fee",
  "transaction_fee",
  "settlement",
  "adjustment",
  "credit",
  "subsidy",
  "writeoff"
]
```

Historical [apps/union-eyes/db/migrations-audit/0000_familiar_silhouette.sql](../../../apps/union-eyes/db/migrations-audit/0000_familiar_silhouette.sql),digest `3c60478f96d652a49b3bbd8e7b585f831d07e253fdf07239022d35c206db909a`: **NON_CANONICAL_HISTORICAL_TYPE_DEFINITION**,PRESERVED=YES,COMPATIBILITY_EVIDENCE=YES.

## Normalized accounting and inactive descriptors

Four exact CURRENT selections;MERGED_ENUM_DEFINITIONS=0;SELECTED_DEFINITIONS_MATCH_W4T_EVIDENCE=YES.
36/36 exact definitions,36 prospective platform authorities,0 authority/definition holds.
38/38 approved consumer references;0 held/unaccounted;exact consumer identities unchanged.
32 previously approved records are semantic-identical,including member lists and descriptors.
All36 inactive type descriptors have SQL_STATUS=DEFINITION_ONLY_NOT_EXECUTABLE,EXECUTION_ALLOWED=NO;none are wired to execution.

## Historical preservation

All current/historical candidate evidence remains. Historical alternatives are marked noncanonical compatibility evidence,not rewritten. Predecision registry is embedded in the [selection report](./PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.json) for exact repeated checks of the32 records and38 links. Historical W4T JSON/Markdown/held packet and W4FR artifacts remain unchanged;upstream section/byte commitments are retained. No discovery or compatibility normalization.

## Validation

- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\record-w4t1-human-type-selections.test.ts`: **PASS;26 tests;predecision and normalized persisted input modes**.
- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\close-w4t-named-types.test.ts scripts\ue\regenerate-w4fr-definitions.test.ts scripts\ue\verify-frozen-w4.test.ts apps\union-eyes\scripts\provisioning\governed-provisioning.test.ts`: **PASS;171 tests;historical blocked model preserved;no predecessor generator CLI run**.
- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\author-w4-canonical-definitions.test.ts`: **PASS;44 tests;frozen W4F behavior unchanged**.
- `pnpm exec tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --types node scripts\ue\record-w4t1-human-type-selections.ts scripts\ue\record-w4t1-human-type-selections.test.ts`: **PASS;exit0;negative ownership fixture corrected to preserve proper union types**.
- `pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 scripts\ue\record-w4t1-human-type-selections.ts scripts\ue\record-w4t1-human-type-selections.test.ts`: **PASS;exit0;existing Next pages-directory diagnostic**.
- `pnpm exec tsx scripts\ue\record-w4t1-human-type-selections.ts --self-test --check`: **PASS;exact-byte two-generation equality and persisted registry/report check**.
- `pnpm exec prettier --check scripts\ue\record-w4t1-human-type-selections.ts scripts\ue\record-w4t1-human-type-selections.test.ts docs\union-eyes\reality-remediation\PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.json docs\union-eyes\reality-remediation\PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.md docs\union-eyes\reality-remediation\UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json docs\union-eyes\reality-remediation\UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.md`: **PASS;repository formatting**.
- `pnpm validate:docs`: **PASS;0 errors;1215 existing warnings;2608 files scanned**.
- `Independent Node crypto hash-only verification of fixed upstream/history/candidate files;exact32 records/38 links/36 nonexecutable definitions`: **PASS;23 distinct frozen byte commitments;historical W4T remains BLOCKED**.

Total distinct test coverage:241 passed. The original W4T --check is not run against the intentionally normalized registry;W4T1 --check validates the overlay and embedded exact predecision registry. Historical generators/artifacts are not rewritten or retried.

## State and proof boundaries

W4FR_RETRY=AUTHORIZED_NOT_STARTED;W4FR_RETRY_STARTED=NO.
CANONICAL_CONTRACT_VERSION=1.3.1;no1.3.2.
W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;W4P/W5=NOT_AUTHORIZED.
NAMED_TYPES_MATERIALIZED=NO;TYPE_SQL_EXECUTED=NO;all historical no-runtime proof boundaries retained.
READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
