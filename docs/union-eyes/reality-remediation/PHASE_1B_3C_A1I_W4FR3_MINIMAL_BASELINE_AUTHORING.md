# W4FR3 - minimal baseline authoring

**W4FR3=BLOCKED.** Only exact W4-owned constraint records block;the108 inherited parent representation gaps remain out-of-scope/nonblocking.

## Exact owned-obligation blocker

Seven included W4 columns retain approved multi-column UNIQUE/uniqueIndex participation. Their required additional columns are not explicit W4 column prerequisites and are not authorized for the57 minimal relation-create payloads under W4S. PostgreSQL cannot declare those UNIQUE keys without those columns. Omitting the governed uniqueness would override W4H;creating excluded columns would override W4S.

| Included W4 column obligation      | Physical identity                                                          | Exact uniqueness columns         | Required columns excluded from materialization |
| ---------------------------------- | -------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| UE-W4G-DEFINITION-1616d255367c341d | union-eyes::COLUMN::public.org_entitlements.organization_id                | organization_id, feature_key     | feature_key                                    |
| UE-W4G-DEFINITION-77aa06833477f7cb | union-eyes::COLUMN::public.billing_periods.organization_id                 | organization_id, label           | label                                          |
| UE-W4G-DEFINITION-55b4f73e9c33e4a9 | union-eyes::COLUMN::public.org_configurations.organization_id              | organization_id, category, key   | category, key                                  |
| UE-W4G-DEFINITION-34cb89029be25de1 | union-eyes::COLUMN::public.pilot_checklist_items.organization_id           | organization_id, item_id         | item_id                                        |
| UE-W4G-DEFINITION-991a59fe214af62f | union-eyes::COLUMN::public.member_jurisdiction_preferences.organization_id | user_id, organization_id         | user_id                                        |
| UE-W4G-DEFINITION-7fb2822005b07979 | union-eyes::COLUMN::public.contract_covered_orgs.organization_id           | contract_id, organization_id     | contract_id                                    |
| UE-W4G-DEFINITION-bac3a50d170191c0 | union-eyes::COLUMN::public.duplicate_group_members.group_id                | group_id, record_type, record_id | record_type, record_id                         |

The seven associated W4 relation-create obligation IDs are also blocked. Exact14 W4 IDs:

```text
UE-W4G-DEFINITION-1616d255367c341d
UE-W4G-DEFINITION-1a482361bcea822b
UE-W4G-DEFINITION-2f46bc9a15b4fe78
UE-W4G-DEFINITION-34cb89029be25de1
UE-W4G-DEFINITION-55b4f73e9c33e4a9
UE-W4G-DEFINITION-77aa06833477f7cb
UE-W4G-DEFINITION-789de61afb7f456e
UE-W4G-DEFINITION-7fb2822005b07979
UE-W4G-DEFINITION-91539638ae3d477c
UE-W4G-DEFINITION-991a59fe214af62f
UE-W4G-DEFINITION-b5be0303e59d6043
UE-W4G-DEFINITION-bac3a50d170191c0
UE-W4G-DEFINITION-c42b44506e916c09
UE-W4G-DEFINITION-cc4bc7b06e15bf5b
```

Full approved property/provenance,exact frozen declaration,key-to-column mapping and W4S classifications are retained in the [machine report](./PHASE_1B_3C_A1I_W4FR3_MINIMAL_BASELINE_AUTHORING.json). No new generic source/schema/type discovery was performed. No accepted constraint was dropped or weakened;no context column was created.

## Accounting

183 frozen obligations preserved:57 relation +126 column;57/57/69 responsibilities. All183 SQL definitions withheld at the owned-constraint preflight;0 authored,0 unaccounted. This is not physical-completeness PASS.
36 exact types retained/generated as36 inactive qualified enum payloads;38 reference identities retained. Consumer payload edges remain withheld,not38 completed edges. W4S's126 explicit materialized columns do not themselves include those38 named-type consumer columns;their exact application-context identities are retained without inventing creation.
125 contexts/2121 column classifications/1299 parent columns retained;0 parent reauthoring;108 parent gaps neither reopened nor resolved.
No producer metadata integration;no contract amendment;no SQL execution. Historical W4FR/W4FR2/W4S and governance/type records preserved.

## Validation and state

316 distinct tests passed:19 focused,253 predecessor/preservation,44 frozen W4F. Independent verification passed for42 byte commitments. Documentation validation:0 errors,1215 existing warnings.

- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\author-w4fr3-minimal-baseline.test.ts` - PASS:19 tests
- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\normalize-w4s-authoring-scope.test.ts scripts\ue\record-w4t1-human-type-selections.test.ts scripts\ue\regenerate-w4fr2-definitions.test.ts scripts\ue\regenerate-w4fr-definitions.test.ts scripts\ue\close-w4t-named-types.test.ts scripts\ue\verify-frozen-w4.test.ts apps\union-eyes\scripts\provisioning\governed-provisioning.test.ts` - PASS:253 tests
- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\author-w4-canonical-definitions.test.ts` - PASS:44 tests
- `pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\ue\author-w4fr3-minimal-baseline.ts scripts\ue\author-w4fr3-minimal-baseline.test.ts` - PASS
- `pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 scripts\ue\author-w4fr3-minimal-baseline.ts scripts\ue\author-w4fr3-minimal-baseline.test.ts` - PASS:existing Next pages-directory diagnostic;exit0
- `pnpm exec prettier --check scripts\ue\author-w4fr3-minimal-baseline.ts scripts\ue\author-w4fr3-minimal-baseline.test.ts` - PASS
- `pnpm exec tsx scripts\ue\author-w4fr3-minimal-baseline.ts --self-test --check` - PASS:two-generation exact-byte equality and persisted artifact equality
- `pnpm validate:docs` - PASS:0 errors;1215 existing warnings

W4FR3=BLOCKED;canonical1.3.1;no1.3.2;version-chain reconstruction NOT_APPLICABLE.
W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;127 compatibility records remain but are not yet the sole blocker.
W4_COMPATIBILITY_GATE_NORMALIZATION=NOT_AUTHORIZED;W4P/W5=NOT_AUTHORIZED.
All payloads DEFINITION_ONLY_NOT_EXECUTABLE/EXECUTION_ALLOWED=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
