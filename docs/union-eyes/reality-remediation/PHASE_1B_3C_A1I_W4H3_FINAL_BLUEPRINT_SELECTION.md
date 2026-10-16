# W4H3 - final human blueprint selection

W4H3 **PASS**; current W4H **PASS**; canonical definition governance **COMPLETE**. This is new human architecture authority, not repository evidence resolving the historical tie.

## public.consent_records

Selected **VARIANT_A**: [apps/union-eyes/db/schema/data-governance-schema.ts](../../../apps/union-eyes/db/schema/data-governance-schema.ts).
Declaration digest: `f52c62f1ea6ad04391cc425c2191e0bf853e7cd370ea13a943bbd520b64d15e5`.
Semantic scope: **GENERAL_CONSENT_GOVERNANCE**.

The shared consent_records relation is governed as the general consent lifecycle record rather than the campaign/channel-specific consent surface.

Exact ordered 22-column set:

```text
id
subject_type
subject_id
organization_id
purpose_type
purpose_description
legal_basis
consent_given
consent_method
consent_text
consent_version
consent_date
expiry_date
withdrawn
withdrawn_at
withdrawal_method
ip_address
user_agent
evidence_url
created_at
updated_at
metadata
```

organization_id present; accepted requirements preserved. Existing W4H property values and provenance remain authoritative. No rejected-only columns or blueprint expressions are selected.

## public.automation_rules

Selected **VARIANT_A**: [apps/union-eyes/db/schema/automation-rules-schema.ts](../../../apps/union-eyes/db/schema/automation-rules-schema.ts).
Declaration digest: `2040335880bf5bbc0ccdf2987daa801ce6f3ede3fcb4829b4b5f6d5e51e1080f`.
Semantic scope: **GENERAL_AUTOMATION_ENGINE**.

The shared automation_rules relation is governed as the general target-trigger-condition-action automation model, rather than the recognition/rewards-specific rule model.

Exact ordered 21-column set:

```text
id
name
description
status
priority
target_entity
target_filter
trigger_type
trigger_config
conditions
actions
max_executions
executions_count
last_executed_at
active_from
active_until
timezone
organization_id
created_at
updated_at
created_by
```

organization_id present; accepted requirements preserved. Existing W4H property values and provenance remain authoritative. No rejected-only columns or blueprint expressions are selected.

## public.clc_sync_log

Selected **VARIANT_B**: [apps/union-eyes/db/schema/clc-sync-schema.ts](../../../apps/union-eyes/db/schema/clc-sync-schema.ts).
Declaration digest: `8c93e4be71895aea8343f704ff1613d3427a5de0df85c9329686d881e2852c1d`.
Semantic scope: **GENERAL_CLC_SYNCHRONIZATION_LEDGER**.

The shared clc_sync_log relation is governed as the general synchronization lifecycle and verification record, rather than the narrower per-capita/affiliate sync event model.

Exact ordered 23-column set:

```text
id
organization_id
sync_type
status
direction
sync_start_date
sync_end_date
records_processed
records_succeeded
records_failed
records_skipped
error_message
error_details
data_hash
sync_data
verification_status
verification_notes
is_verified
verified_at
verified_by
created_at
updated_at
initiated_by
```

organization_id present; accepted requirements preserved. Existing W4H property values and provenance remain authoritative. No rejected-only columns or blueprint expressions are selected.

## Non-canonical alternatives

- public.consent_records: **VARIANT_B**, [apps/union-eyes/db/schema/domains/communications/campaigns.ts](../../../apps/union-eyes/db/schema/domains/communications/campaigns.ts), digest `ad13f730d28d8723386142e5da7fcc6f35d3d1140c0493d3eaa424d9c0e6e37e`: **NON_CANONICAL_CURRENT_DECLARATION**. All source aliases and exact evidence are retained in JSON; no source changes/deletion.
- public.automation_rules: **VARIANT_B**, [apps/union-eyes/db/schema/domains/infrastructure/rewards.ts](../../../apps/union-eyes/db/schema/domains/infrastructure/rewards.ts), digest `b5ba5e0ac52c52bfa361c27ff416fe2702cf2c5ad660339fc5b2abc4c31a324f`: **NON_CANONICAL_CURRENT_DECLARATION**. All source aliases and exact evidence are retained in JSON; no source changes/deletion.
- public.clc_sync_log: **VARIANT_A**, [apps/union-eyes/db/schema/clc-per-capita-schema.ts](../../../apps/union-eyes/db/schema/clc-per-capita-schema.ts), digest `f5d9d9877b7160a1c930666c4aec8cfc63999cbc5039c0ebba68c1f5bb282df5`: **NON_CANONICAL_CURRENT_DECLARATION**. All source aliases and exact evidence are retained in JSON; no source changes/deletion.

## Accounting and preservation

**126/126 groups closed;183/183 obligations governed;0 human decisions pending;0 hybrids.** All IDs and governed-property digests are enumerated in JSON. Prior 123 groups/180 obligations,case_documents resolution,all prior property/FK component/named-type provenance and historical W4H/W4H1/W4H2/W4F bytes remain unchanged. Fixed file hashes,upstream byte commitments and310/127/127/372/82/86/118/803/23 section commitments are preserved.

## Authorization and boundaries

Canonical contract **1.3.1**,unchanged;1.3.2 not published.
W4F regeneration: **AUTHORIZED_NOT_STARTED**. **No regeneration occurred.**
W4: **BLOCKED_DEFINITION_IMPLEMENTATION_PENDING**. W4P/W5: **NOT_AUTHORIZED**.

No SQL,inactive payloads,producer activation,migrations,database roles or runtime/security proof. READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO. Selected declarations are authoring design inputs only;symbolic references/callbacks do not override prior physical FK governance.

## Validation

Closeout checks **PASS**: **26 focused tests**,exact selection/source/digest/ordered22/21/23-column/accepted-requirement/no-hybrid and126/183 ID accounting assertions;deterministic generation/check;scoped TypeScript/ESLint (exit0;existing Next pages-directory diagnostic);formatting;documentation audit (**0 errors,1215 existing warnings**). Independent read-only assertions verified selected/rejected evidence,prior180 governed-property digests,historical/fixed/transitive upstream bytes,310/127/127/372/82/86/118/803/23 commitments and canonical1.3.1. Exact commands/results are in JSON. Governance PASS does not prove runtime readiness or start W4F regeneration.
