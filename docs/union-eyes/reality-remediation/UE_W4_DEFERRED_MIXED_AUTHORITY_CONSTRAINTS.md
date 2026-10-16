# W4C deferred mixed-authority constraint registry

## public.org_entitlements

- ID: `UE-W4C-DEFERRED-CONSTRAINT-687b0013df9b8c8a`
- UNIQUE ordered operands: `organization_id, feature_key`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `feature_key`
- Source W4 IDs: `UE-W4G-DEFINITION-1616d255367c341d`, `UE-W4G-DEFINITION-91539638ae3d477c`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.billing_periods

- ID: `UE-W4C-DEFERRED-CONSTRAINT-ab480be7d3ecbe76`
- UNIQUE ordered operands: `organization_id, label`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `label`
- Source W4 IDs: `UE-W4G-DEFINITION-77aa06833477f7cb`, `UE-W4G-DEFINITION-2f46bc9a15b4fe78`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.org_configurations

- ID: `UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5`
- UNIQUE ordered operands: `organization_id, category, key`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `category, key`
- Source W4 IDs: `UE-W4G-DEFINITION-55b4f73e9c33e4a9`, `UE-W4G-DEFINITION-c42b44506e916c09`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.pilot_checklist_items

- ID: `UE-W4C-DEFERRED-CONSTRAINT-22e544681ea09ae3`
- UNIQUE ordered operands: `organization_id, item_id`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `item_id`
- Source W4 IDs: `UE-W4G-DEFINITION-34cb89029be25de1`, `UE-W4G-DEFINITION-789de61afb7f456e`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.member_jurisdiction_preferences

- ID: `UE-W4C-DEFERRED-CONSTRAINT-921db4f0bc63e01d`
- UNIQUE ordered operands: `user_id, organization_id`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `user_id`
- Source W4 IDs: `UE-W4G-DEFINITION-991a59fe214af62f`, `UE-W4G-DEFINITION-1a482361bcea822b`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.contract_covered_orgs

- ID: `UE-W4C-DEFERRED-CONSTRAINT-097a8c58a7231680`
- UNIQUE ordered operands: `contract_id, organization_id`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `contract_id`
- Source W4 IDs: `UE-W4G-DEFINITION-7fb2822005b07979`, `UE-W4G-DEFINITION-b5be0303e59d6043`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.duplicate_group_members

- ID: `UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4`
- UNIQUE ordered operands: `group_id, record_type, record_id`
- W4 baseline operands: `group_id`
- Non-W4-baseline operands: `record_type, record_id`
- Source W4 IDs: `UE-W4G-DEFINITION-bac3a50d170191c0`, `UE-W4G-DEFINITION-cc4bc7b06e15bf5b`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

Full exact declaration/property provenance,operand authority evidence and linkage are retained in the [machine registry](./UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.json). See [closure report](./PHASE_1B_3C_A1I_W4C_CONSTRAINT_TIMING_CLOSURE.md). Metadata only;no SQL authoring or execution.
