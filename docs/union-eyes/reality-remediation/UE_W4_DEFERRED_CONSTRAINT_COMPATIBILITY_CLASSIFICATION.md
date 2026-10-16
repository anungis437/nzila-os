# W4LC supplemental constraint compatibility classification

Seven handoffs remain distinct from127 existing compatibility records. All7 require exact compatibility-phase binding;no producer or ordering boundary invented.

## public.org_entitlements

- ID: `UE-W4C-DEFERRED-CONSTRAINT-687b0013df9b8c8a`
- Ordered UNIQUE operands: `organization_id, feature_key`
- W4 baseline operands: `organization_id`;excluded operands: `feature_key`.
- Class: COMPATIBILITY_PHASE_BINDING_REQUIRED.
- Final producer: NONE RECORDED;W5 boundary: NONE RECORDED.
- Missing fact: Exact producer that introduces each excluded operand,or an exact frozen W5 boundary proving all operands exist;identify final-operand order before constraint materialization..
- Missing exact identities: `union-eyes::COLUMN::public.org_entitlements.feature_key`.
- Evidence ceiling: Fixed registries/late-definition records/W5 handoffs do not bind these context-only operands. W4FR4 creates only the included prerequisite column. Declaration design evidence and relation ownership are not physical producer/order proof..
- Constraint semantics PRESERVED;ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST required;DEFERRED_NOT_EXECUTED.

## public.billing_periods

- ID: `UE-W4C-DEFERRED-CONSTRAINT-ab480be7d3ecbe76`
- Ordered UNIQUE operands: `organization_id, label`
- W4 baseline operands: `organization_id`;excluded operands: `label`.
- Class: COMPATIBILITY_PHASE_BINDING_REQUIRED.
- Final producer: NONE RECORDED;W5 boundary: NONE RECORDED.
- Missing fact: Exact producer that introduces each excluded operand,or an exact frozen W5 boundary proving all operands exist;identify final-operand order before constraint materialization..
- Missing exact identities: `union-eyes::COLUMN::public.billing_periods.label`.
- Evidence ceiling: Fixed registries/late-definition records/W5 handoffs do not bind these context-only operands. W4FR4 creates only the included prerequisite column. Declaration design evidence and relation ownership are not physical producer/order proof..
- Constraint semantics PRESERVED;ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST required;DEFERRED_NOT_EXECUTED.

## public.org_configurations

- ID: `UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5`
- Ordered UNIQUE operands: `organization_id, category, key`
- W4 baseline operands: `organization_id`;excluded operands: `category, key`.
- Class: COMPATIBILITY_PHASE_BINDING_REQUIRED.
- Final producer: NONE RECORDED;W5 boundary: NONE RECORDED.
- Missing fact: Exact producer that introduces each excluded operand,or an exact frozen W5 boundary proving all operands exist;identify final-operand order before constraint materialization..
- Missing exact identities: `union-eyes::COLUMN::public.org_configurations.category`, `union-eyes::COLUMN::public.org_configurations.key`.
- Evidence ceiling: Fixed registries/late-definition records/W5 handoffs do not bind these context-only operands. W4FR4 creates only the included prerequisite column. Declaration design evidence and relation ownership are not physical producer/order proof..
- Constraint semantics PRESERVED;ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST required;DEFERRED_NOT_EXECUTED.

## public.pilot_checklist_items

- ID: `UE-W4C-DEFERRED-CONSTRAINT-22e544681ea09ae3`
- Ordered UNIQUE operands: `organization_id, item_id`
- W4 baseline operands: `organization_id`;excluded operands: `item_id`.
- Class: COMPATIBILITY_PHASE_BINDING_REQUIRED.
- Final producer: NONE RECORDED;W5 boundary: NONE RECORDED.
- Missing fact: Exact producer that introduces each excluded operand,or an exact frozen W5 boundary proving all operands exist;identify final-operand order before constraint materialization..
- Missing exact identities: `union-eyes::COLUMN::public.pilot_checklist_items.item_id`.
- Evidence ceiling: Fixed registries/late-definition records/W5 handoffs do not bind these context-only operands. W4FR4 creates only the included prerequisite column. Declaration design evidence and relation ownership are not physical producer/order proof..
- Constraint semantics PRESERVED;ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST required;DEFERRED_NOT_EXECUTED.

## public.member_jurisdiction_preferences

- ID: `UE-W4C-DEFERRED-CONSTRAINT-921db4f0bc63e01d`
- Ordered UNIQUE operands: `user_id, organization_id`
- W4 baseline operands: `organization_id`;excluded operands: `user_id`.
- Class: COMPATIBILITY_PHASE_BINDING_REQUIRED.
- Final producer: NONE RECORDED;W5 boundary: NONE RECORDED.
- Missing fact: Exact producer that introduces each excluded operand,or an exact frozen W5 boundary proving all operands exist;identify final-operand order before constraint materialization..
- Missing exact identities: `union-eyes::COLUMN::public.member_jurisdiction_preferences.user_id`.
- Evidence ceiling: Fixed registries/late-definition records/W5 handoffs do not bind these context-only operands. W4FR4 creates only the included prerequisite column. Declaration design evidence and relation ownership are not physical producer/order proof..
- Constraint semantics PRESERVED;ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST required;DEFERRED_NOT_EXECUTED.

## public.contract_covered_orgs

- ID: `UE-W4C-DEFERRED-CONSTRAINT-097a8c58a7231680`
- Ordered UNIQUE operands: `contract_id, organization_id`
- W4 baseline operands: `organization_id`;excluded operands: `contract_id`.
- Class: COMPATIBILITY_PHASE_BINDING_REQUIRED.
- Final producer: NONE RECORDED;W5 boundary: NONE RECORDED.
- Missing fact: Exact producer that introduces each excluded operand,or an exact frozen W5 boundary proving all operands exist;identify final-operand order before constraint materialization..
- Missing exact identities: `union-eyes::COLUMN::public.contract_covered_orgs.contract_id`.
- Evidence ceiling: Fixed registries/late-definition records/W5 handoffs do not bind these context-only operands. W4FR4 creates only the included prerequisite column. Declaration design evidence and relation ownership are not physical producer/order proof..
- Constraint semantics PRESERVED;ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST required;DEFERRED_NOT_EXECUTED.

## public.duplicate_group_members

- ID: `UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4`
- Ordered UNIQUE operands: `group_id, record_type, record_id`
- W4 baseline operands: `group_id`;excluded operands: `record_type, record_id`.
- Class: COMPATIBILITY_PHASE_BINDING_REQUIRED.
- Final producer: NONE RECORDED;W5 boundary: NONE RECORDED.
- Missing fact: Exact producer that introduces each excluded operand,or an exact frozen W5 boundary proving all operands exist;identify final-operand order before constraint materialization..
- Missing exact identities: `union-eyes::COLUMN::public.duplicate_group_members.record_type`, `union-eyes::COLUMN::public.duplicate_group_members.record_id`.
- Evidence ceiling: Fixed registries/late-definition records/W5 handoffs do not bind these context-only operands. W4FR4 creates only the included prerequisite column. Declaration design evidence and relation ownership are not physical producer/order proof..
- Constraint semantics PRESERVED;ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST required;DEFERRED_NOT_EXECUTED.

Full frozen semantics and exact negative linkage evidence are in the [machine registry](./UE_W4_DEFERRED_CONSTRAINT_COMPATIBILITY_CLASSIFICATION.json). W4LC BLOCKED;no materialization or execution.
