# W4H2 - three human blueprint decisions

Evidence-packet gate: **PASS**. Blueprint selection: **pending human decision for all three**. Labels A/B follow frozen evidence order, not preference. Common/only/excluded lists are comparisons, not a proposed merged schema.

## consent_records

Identity: `union-eyes::COLUMN::public.consent_records.organization_id`. Decision ID: `UE-W4F-DESIGN-71fba14faea517bb`.

**Common:** `consent_text`, `created_at`, `id`, `ip_address`, `metadata`, `organization_id`, `user_agent`.

**Variant A adds** (22 total): `consent_date`, `consent_given`, `consent_method`, `consent_version`, `evidence_url`, `expiry_date`, `legal_basis`, `purpose_description`, `purpose_type`, `subject_id`, `subject_type`, `updated_at`, `withdrawal_method`, `withdrawn`, `withdrawn_at`.
Source: [apps/union-eyes/db/schema/data-governance-schema.ts](../../../apps/union-eyes/db/schema/data-governance-schema.ts).

**Variant B adds** (13 total): `channel`, `consent_type`, `expires_at`, `method`, `status`, `user_id`.
Source: [apps/union-eyes/db/schema/domains/communications/campaigns.ts](../../../apps/union-eyes/db/schema/domains/communications/campaigns.ts).

**Physical-property differences (shared columns):**

- `created_at.NULLABILITY`: A=UNRESOLVED:unspecified; B=EXPLICIT:NOT_NULL.
- `ip_address.POSTGRES_TYPE`: A=EXPLICIT:character varying(50); B=EXPLICIT:character varying(45).

**Constraint differences:**

- PRIMARY_KEYS: **NO_DIFFERENCE**.
- UNIQUE_CONSTRAINTS: **NO_DIFFERENCE**.
- FOREIGN_KEYS: **DIFFERENCE**. A: `organization_id: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" })` | B: `organization_id: uuid('organization_id') .notNull() .references(() => organizations.id, { onDelete: 'cascade' })`. Design evidence only; governed physical FK remains unchanged.
- CHECK_CONSTRAINTS: **NO_DIFFERENCE**.
- INDEXES: **DIFFERENCE**. A: none recorded | B: `index('idx_consent_records_org').on(table.organizationId)`; `index('idx_consent_records_user').on(table.userId)`; `index('idx_consent_records_channel').on(table.channel)`; `index('idx_consent_records_status').on(table.status)`; `index('idx_consent_records_created').on(table.createdAt)`
- Exact callback/constraint source: **DIFFERENCE**; full expressions and column-level restriction differences are in the machine card.

**Accepted requirements:** both pass. Required columns: `organization_id`. Explicit consumer property requirements: none recorded. Every candidate contains organization_id; already-governed organization_id type/nullability/default/generation/FK values and provenance are unchanged.

**Governed organization_id (both options):** `POSTGRES_TYPE=uuid; NULLABILITY=NOT_NULL; DEFAULT=NO_DEFAULT; IDENTITY_OR_GENERATED=NONE; FOREIGN_KEY=NONE`.

Candidate-only columns are CURRENT_DECLARATION_ONLY; no accepted column-specific downstream semantic requirement is established by the fixed tie evidence. No business meaning is inferred from their names.

**Decision:** A: adopt exact current variant a / B: adopt exact current variant b. Each includes common columns plus its listed additions and excludes the other variant's additions. Accepted requirements preserved: YES; hybrid schema: NO. **No option is selected or recommended.**

## automation_rules

Identity: `union-eyes::COLUMN::public.automation_rules.organization_id`. Decision ID: `UE-W4F-DESIGN-3fa69b01260f33dc`.

**Common:** `conditions`, `created_at`, `created_by`, `description`, `id`, `name`, `organization_id`, `trigger_type`, `updated_at`.

**Variant A adds** (21 total): `actions`, `active_from`, `active_until`, `executions_count`, `last_executed_at`, `max_executions`, `priority`, `status`, `target_entity`, `target_filter`, `timezone`, `trigger_config`.
Source aliases: [apps/union-eyes/db/schema/automation-rules-schema.ts](../../../apps/union-eyes/db/schema/automation-rules-schema.ts); [apps/union-eyes/db/schema/domains/infrastructure/automation.ts](../../../apps/union-eyes/db/schema/domains/infrastructure/automation.ts).

**Variant B adds** (15 total): `award_type_id`, `credit_amount`, `is_active`, `last_triggered_at`, `schedule`, `trigger_count`.
Source aliases: [apps/union-eyes/db/schema/domains/infrastructure/rewards.ts](../../../apps/union-eyes/db/schema/domains/infrastructure/rewards.ts); [apps/union-eyes/db/schema/recognition-rewards-schema.ts](../../../apps/union-eyes/db/schema/recognition-rewards-schema.ts).

**Physical-property differences (shared columns):**

- `created_at.POSTGRES_TYPE`: A=EXPLICIT:timestamp with time zone; B=UNRESOLVED:unspecified.
- `updated_at.POSTGRES_TYPE`: A=EXPLICIT:timestamp with time zone; B=UNRESOLVED:unspecified.

**Constraint differences:**

- PRIMARY_KEYS: **NO_DIFFERENCE**.
- UNIQUE_CONSTRAINTS: **NO_DIFFERENCE**.
- FOREIGN_KEYS: **DIFFERENCE**. A: none recorded | B: `award_type_id: uuid('award_type_id') .notNull() .references(() => recognitionAwardTypes.id, { onDelete: 'cascade' })`. Design evidence only; governed physical FK remains unchanged.
- CHECK_CONSTRAINTS: **NO_DIFFERENCE**.
- INDEXES: **DIFFERENCE**. A: `index("idx_automation_rules_status").on(table.status)`; `index("idx_automation_rules_target").on(table.targetEntity)`; `index("idx_automation_rules_org").on(table.organizationId)`; `index("idx_automation_rules_priority").on(table.priority)` | B: `index('idx_automation_rules_org').on(t.orgId)`; `index('automation_rules_trigger_idx').on(t.triggerType)`; `index('automation_rules_active_idx').on(t.isActive)`; `index('automation_rules_award_type_idx').on(t.awardTypeId)`
- Exact callback/constraint source: **DIFFERENCE**; full expressions and column-level restriction differences are in the machine card.

**Accepted requirements:** both pass. Required columns: `organization_id`. Explicit consumer property requirements: none recorded. Every candidate contains organization_id; already-governed organization_id type/nullability/default/generation/FK values and provenance are unchanged.

**Governed organization_id (both options):** `POSTGRES_TYPE=character varying(255); NULLABILITY=NOT_NULL; DEFAULT=NO_DEFAULT; IDENTITY_OR_GENERATED=NONE; FOREIGN_KEY=NONE`.

Candidate-only columns are CURRENT_DECLARATION_ONLY; no accepted column-specific downstream semantic requirement is established by the fixed tie evidence. No business meaning is inferred from their names.

**Decision:** A: adopt exact current variant a / B: adopt exact current variant b. Each includes common columns plus its listed additions and excludes the other variant's additions. Accepted requirements preserved: YES; hybrid schema: NO. **No option is selected or recommended.**

## clc_sync_log

Identity: `union-eyes::COLUMN::public.clc_sync_log.organization_id`. Decision ID: `UE-W4F-DESIGN-da0568d4d7d7857e`.

**Common:** `id`, `organization_id`.

**Variant A adds** (9 total): `action`, `affiliate_code`, `changes`, `conflicts`, `duration`, `error`, `synced_at`.
Source aliases: [apps/union-eyes/db/schema/clc-per-capita-schema.ts](../../../apps/union-eyes/db/schema/clc-per-capita-schema.ts); [apps/union-eyes/db/schema/domains/infrastructure/clc-per-capita.ts](../../../apps/union-eyes/db/schema/domains/infrastructure/clc-per-capita.ts).

**Variant B adds** (23 total): `created_at`, `data_hash`, `direction`, `error_details`, `error_message`, `initiated_by`, `is_verified`, `records_failed`, `records_processed`, `records_skipped`, `records_succeeded`, `status`, `sync_data`, `sync_end_date`, `sync_start_date`, `sync_type`, `updated_at`, `verification_notes`, `verification_status`, `verified_at`, `verified_by`.
Source aliases: [apps/union-eyes/db/schema/clc-sync-schema.ts](../../../apps/union-eyes/db/schema/clc-sync-schema.ts); [apps/union-eyes/db/schema/domains/infrastructure/clc-sync.ts](../../../apps/union-eyes/db/schema/domains/infrastructure/clc-sync.ts).

**Physical-property differences (shared columns):**

- `organization_id.NULLABILITY`: A=UNRESOLVED:unspecified; B=EXPLICIT:NOT_NULL.

**Constraint differences:**

- PRIMARY_KEYS: **NO_DIFFERENCE**.
- UNIQUE_CONSTRAINTS: **NO_DIFFERENCE**.
- FOREIGN_KEYS: **DIFFERENCE**. A: `foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: 'clc_sync_log_organization_id_fkey', })` | B: `organization_id: uuid("organization_id") .notNull() .references(() => organizations.id, { onDelete: "cascade" })`. Design evidence only; governed physical FK remains unchanged.
- CHECK_CONSTRAINTS: **NO_DIFFERENCE**.
- INDEXES: **DIFFERENCE**. A: `index('idx_sync_log_org').on(table.organizationId)`; `index('idx_sync_log_affiliate').on(table.affiliateCode)`; `index('idx_sync_log_synced_at').on(table.syncedAt)` | B: `index("clc_sync_log_org_idx").on(t.organizationId)`; `index("clc_sync_log_status_idx").on(t.status)`; `index("clc_sync_log_type_idx").on(t.syncType)`; `index("clc_sync_log_date_idx").on(t.createdAt)`
- Exact callback/constraint source: **DIFFERENCE**; full expressions and column-level restriction differences are in the machine card.

**Accepted requirements:** both pass. Required columns: `organization_id`. Explicit consumer property requirements: none recorded. Every candidate contains organization_id; already-governed organization_id type/nullability/default/generation/FK values and provenance are unchanged.

**Governed organization_id (both options):** `POSTGRES_TYPE=uuid; NULLABILITY=NOT_NULL; DEFAULT=NO_DEFAULT; IDENTITY_OR_GENERATED=NONE; FOREIGN_KEY=NONE`.

Candidate-only columns are CURRENT_DECLARATION_ONLY; no accepted column-specific downstream semantic requirement is established by the fixed tie evidence. No business meaning is inferred from their names.

**Decision:** A: adopt exact current variant a / B: adopt exact current variant b. Each includes common columns plus its listed additions and excludes the other variant's additions. Accepted requirements preserved: YES; hybrid schema: NO. **No option is selected or recommended.**

## Evidence and validation

The [machine decision packet](./UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.json) contains exact column sets/definitions, source and declaration digests, aliases, property values, callback sources, constraint comparisons, accepted prerequisite/consumer IDs and mechanically supported option consequences.

Canonical **1.3.1** unchanged; W4H **BLOCKED_HUMAN_BLUEPRINT_SELECTION**; 123/126 groups and 180/183 obligations remain governed. W4F regeneration/W4P/W5 **NOT_AUTHORIZED**. No SQL, producer activation, runtime proof, or schema mutation.

Validation **PASS**: **33 focused tests**, deterministic generation/check, scoped TypeScript/ESLint, formatting and docs (**0 errors,1215 existing warnings**). Independent assertions verified exact cards/sources/column and shared-property differences, accepted coverage, all fixed/transitive upstream byte commitments and preserved governance sections. The [phase report](./PHASE_1B_3C_A1I_W4H2_TRUE_BLUEPRINT_DECISION_PACKET.json) records exact commands, results and preservation evidence. Evidence-packet PASS does not select any blueprint.
