# W4H1 - residual organization-scoped blueprint closure

Gate: **BLOCKED_TRUE_BLUEPRINT_TIE**. Human governance applies only to the five frozen residuals; this is not another doctrine pass.

## Accounting

- Residual groups/obligations input: **5/5**.
- Approved blueprints: **2**.
- True blueprint ties: **3**.
- Sum: **5**; unaccounted: **0**; hybrid blueprints: **0**.
- Combined W4H/W4H1 governed groups: **123/126**; obligations: **180/183**.

| Relation                       | Decision                   | Selected current source                                  | Rule                                                     |
| ------------------------------ | -------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| public.consent_records         | BLOCKED_TRUE_BLUEPRINT_TIE | No selection; true tie                                   | EQUAL_RECORDED_CURRENT_AUTHORITY_INCOMPARABLE_BLUEPRINTS |
| public.ml_predictions          | APPROVED                   | apps/union-eyes/db/schema/domains/ml/predictions.ts      | ONLY_ELIGIBLE_CURRENT_VARIANT                            |
| public.automation_rules        | BLOCKED_TRUE_BLUEPRINT_TIE | No selection; true tie                                   | EQUAL_RECORDED_CURRENT_AUTHORITY_INCOMPARABLE_BLUEPRINTS |
| public.insight_recommendations | APPROVED                   | apps/union-eyes/db/schema/domains/analytics/analytics.ts | STRICT_SUBSET_ACCEPTED_REQUIREMENTS                      |
| public.clc_sync_log            | BLOCKED_TRUE_BLUEPRINT_TIE | No selection; true tie                                   | EQUAL_RECORDED_CURRENT_AUTHORITY_INCOMPARABLE_BLUEPRINTS |

Every recorded current candidate already contains organization_id. Org-scope alone therefore cannot pick one. Equivalent declaration aliases are grouped by exact embedded declaration facts/text and constraints, never by filename. An approved multi-column unique restriction must exist in the selected variant. A strict subset wins only after accepted requirement filtering. Remaining incomparable variants have the same recorded DECLARATION_DESIGN_EVIDENCE classification; no stronger current authority is recorded.

## public.consent_records

Physical identity: `union-eyes::COLUMN::public.consent_records.organization_id`. Scope: **ORGANIZATION_SCOPED**.

Accepted required columns: organization_id.
All already-approved property values and provenance remain unchanged; positive approved restrictions must be supported by the chosen variant.

- [apps/union-eyes/db/schema/data-governance-schema.ts](../../../apps/union-eyes/db/schema/data-governance-schema.ts), declaration digest `f52c62f1ea6ad04391cc425c2191e0bf853e7cd370ea13a943bbd520b64d15e5`: id, subject_type, subject_id, organization_id, purpose_type, purpose_description, legal_basis, consent_given, consent_method, consent_text, consent_version, consent_date, expiry_date, withdrawn, withdrawn_at, withdrawal_method, ip_address, user_agent, evidence_url, created_at, updated_at, metadata. Eligible current organization-scoped blueprint.
- [apps/union-eyes/db/schema/domains/communications/campaigns.ts](../../../apps/union-eyes/db/schema/domains/communications/campaigns.ts), declaration digest `ad13f730d28d8723386142e5da7fcc6f35d3d1140c0493d3eaa424d9c0e6e37e`: id, organization_id, user_id, consent_type, channel, status, method, consent_text, ip_address, user_agent, expires_at, metadata, created_at. Eligible current organization-scoped blueprint.

Selected column set: **UNSELECTED**; incomparable eligible variants with equal recorded current authority. No cardinality, filename or age tiebreaker is authorized.

## public.ml_predictions

Physical identity: `union-eyes::COLUMN::public.ml_predictions.organization_id`. Scope: **ORGANIZATION_SCOPED**.

Accepted required columns: horizon, organization_id, prediction_date, prediction_type.
All already-approved property values and provenance remain unchanged; positive approved restrictions must be supported by the chosen variant.

- [apps/union-eyes/db/schema/analytics.ts](../../../apps/union-eyes/db/schema/analytics.ts), declaration digest `26146e05cccba9d8de8c9a349685c75873ed2f61c931f045ec603e0be8eced37`: id, organization_id, prediction_type, model_name, model_version, target_date, predicted_value, confidence_interval, confidence_score, features, actual_value, accuracy, metadata, created_at, validated_at. Rejected: DROPS_ACCEPTED_COLUMN:horizon; DROPS_ACCEPTED_COLUMN:prediction_date; DROPS_APPROVED_CONSTRAINT_COLUMN:prediction_date; DROPS_APPROVED_CONSTRAINT_COLUMN:horizon; CONTRADICTS_APPROVED_W4H_PROPERTY:organization_id.UNIQUE_PARTICIPATION
- [apps/union-eyes/db/schema/domains/analytics/analytics.ts](../../../apps/union-eyes/db/schema/domains/analytics/analytics.ts), declaration digest `26146e05cccba9d8de8c9a349685c75873ed2f61c931f045ec603e0be8eced37`: id, organization_id, prediction_type, model_name, model_version, target_date, predicted_value, confidence_interval, confidence_score, features, actual_value, accuracy, metadata, created_at, validated_at. Rejected: DROPS_ACCEPTED_COLUMN:horizon; DROPS_ACCEPTED_COLUMN:prediction_date; DROPS_APPROVED_CONSTRAINT_COLUMN:prediction_date; DROPS_APPROVED_CONSTRAINT_COLUMN:horizon; CONTRADICTS_APPROVED_W4H_PROPERTY:organization_id.UNIQUE_PARTICIPATION
- [apps/union-eyes/db/schema/domains/ml/predictions.ts](../../../apps/union-eyes/db/schema/domains/ml/predictions.ts), declaration digest `489bfd41236215cecac47ab147f71150a9873784b82b3a7e2a15fad0d372d7d1`: id, organization_id, prediction_type, prediction_date, predicted_value, lower_bound, upper_bound, confidence, horizon, granularity, created_at. Eligible current organization-scoped blueprint.
- [apps/union-eyes/db/schema/ml-predictions-schema.ts](../../../apps/union-eyes/db/schema/ml-predictions-schema.ts), declaration digest `489bfd41236215cecac47ab147f71150a9873784b82b3a7e2a15fad0d372d7d1`: id, organization_id, prediction_type, prediction_date, predicted_value, lower_bound, upper_bound, confidence, horizon, granularity, created_at. Eligible current organization-scoped blueprint.

Selected column set: id, organization_id, prediction_type, prediction_date, predicted_value, lower_bound, upper_bound, confidence, horizon, granularity, created_at

## public.automation_rules

Physical identity: `union-eyes::COLUMN::public.automation_rules.organization_id`. Scope: **ORGANIZATION_SCOPED**.

Accepted required columns: organization_id.
All already-approved property values and provenance remain unchanged; positive approved restrictions must be supported by the chosen variant.

- [apps/union-eyes/db/schema/automation-rules-schema.ts](../../../apps/union-eyes/db/schema/automation-rules-schema.ts), declaration digest `2040335880bf5bbc0ccdf2987daa801ce6f3ede3fcb4829b4b5f6d5e51e1080f`: id, name, description, status, priority, target_entity, target_filter, trigger_type, trigger_config, conditions, actions, max_executions, executions_count, last_executed_at, active_from, active_until, timezone, organization_id, created_at, updated_at, created_by. Eligible current organization-scoped blueprint.
- [apps/union-eyes/db/schema/domains/infrastructure/automation.ts](../../../apps/union-eyes/db/schema/domains/infrastructure/automation.ts), declaration digest `2040335880bf5bbc0ccdf2987daa801ce6f3ede3fcb4829b4b5f6d5e51e1080f`: id, name, description, status, priority, target_entity, target_filter, trigger_type, trigger_config, conditions, actions, max_executions, executions_count, last_executed_at, active_from, active_until, timezone, organization_id, created_at, updated_at, created_by. Eligible current organization-scoped blueprint.
- [apps/union-eyes/db/schema/domains/infrastructure/rewards.ts](../../../apps/union-eyes/db/schema/domains/infrastructure/rewards.ts), declaration digest `b5ba5e0ac52c52bfa361c27ff416fe2702cf2c5ad660339fc5b2abc4c31a324f`: id, organization_id, name, description, trigger_type, conditions, award_type_id, credit_amount, schedule, is_active, last_triggered_at, trigger_count, created_at, updated_at, created_by. Eligible current organization-scoped blueprint.
- [apps/union-eyes/db/schema/recognition-rewards-schema.ts](../../../apps/union-eyes/db/schema/recognition-rewards-schema.ts), declaration digest `b5ba5e0ac52c52bfa361c27ff416fe2702cf2c5ad660339fc5b2abc4c31a324f`: id, organization_id, name, description, trigger_type, conditions, award_type_id, credit_amount, schedule, is_active, last_triggered_at, trigger_count, created_at, updated_at, created_by. Eligible current organization-scoped blueprint.

Selected column set: **UNSELECTED**; incomparable eligible variants with equal recorded current authority. No cardinality, filename or age tiebreaker is authorized.

## public.insight_recommendations

Physical identity: `union-eyes::COLUMN::public.insight_recommendations.organization_id`. Scope: **ORGANIZATION_SCOPED**.

Accepted required columns: organization_id.
All already-approved property values and provenance remain unchanged; positive approved restrictions must be supported by the chosen variant.

- [apps/union-eyes/db/schema/analytics.ts](../../../apps/union-eyes/db/schema/analytics.ts), declaration digest `48eb8be945af951a7529ffaf21330d2d09c2652c660eacbb99596519d1f001f4`: id, organization_id, insight_type, category, priority, title, description, data_source, metrics, trend, impact, recommendations, action_required, action_deadline, estimated_benefit, confidence_score, ai_reference_id, related_entities, status, acknowledged_by, acknowledged_at, dismissed_by, dismissed_at, dismissal_reason, completed_at, notes, created_at, updated_at. Eligible current organization-scoped blueprint.
- [apps/union-eyes/db/schema/domains/analytics/analytics.ts](../../../apps/union-eyes/db/schema/domains/analytics/analytics.ts), declaration digest `22526dd513bdd7363d629b5b23c7b04bc0dc0c1ebe3b33436ad7818bc1fd73af`: id, organization_id, insight_type, category, priority, title, description, data_source, metrics, trend, impact, recommendations, action_required, action_deadline, estimated_benefit, confidence_score, related_entities, status, acknowledged_by, acknowledged_at, dismissed_by, dismissed_at, dismissal_reason, completed_at, notes, created_at, updated_at. Eligible current organization-scoped blueprint.

Selected column set: id, organization_id, insight_type, category, priority, title, description, data_source, metrics, trend, impact, recommendations, action_required, action_deadline, estimated_benefit, confidence_score, related_entities, status, acknowledged_by, acknowledged_at, dismissed_by, dismissed_at, dismissal_reason, completed_at, notes, created_at, updated_at

## public.clc_sync_log

Physical identity: `union-eyes::COLUMN::public.clc_sync_log.organization_id`. Scope: **ORGANIZATION_SCOPED**.

Accepted required columns: organization_id.
All already-approved property values and provenance remain unchanged; positive approved restrictions must be supported by the chosen variant.

- [apps/union-eyes/db/schema/clc-per-capita-schema.ts](../../../apps/union-eyes/db/schema/clc-per-capita-schema.ts), declaration digest `f5d9d9877b7160a1c930666c4aec8cfc63999cbc5039c0ebba68c1f5bb282df5`: id, organization_id, affiliate_code, action, changes, conflicts, duration, error, synced_at. Eligible current organization-scoped blueprint.
- [apps/union-eyes/db/schema/clc-sync-schema.ts](../../../apps/union-eyes/db/schema/clc-sync-schema.ts), declaration digest `8c93e4be71895aea8343f704ff1613d3427a5de0df85c9329686d881e2852c1d`: id, organization_id, sync_type, status, direction, sync_start_date, sync_end_date, records_processed, records_succeeded, records_failed, records_skipped, error_message, error_details, data_hash, sync_data, verification_status, verification_notes, is_verified, verified_at, verified_by, created_at, updated_at, initiated_by. Eligible current organization-scoped blueprint.
- [apps/union-eyes/db/schema/domains/infrastructure/clc-per-capita.ts](../../../apps/union-eyes/db/schema/domains/infrastructure/clc-per-capita.ts), declaration digest `f5d9d9877b7160a1c930666c4aec8cfc63999cbc5039c0ebba68c1f5bb282df5`: id, organization_id, affiliate_code, action, changes, conflicts, duration, error, synced_at. Eligible current organization-scoped blueprint.
- [apps/union-eyes/db/schema/domains/infrastructure/clc-sync.ts](../../../apps/union-eyes/db/schema/domains/infrastructure/clc-sync.ts), declaration digest `8c93e4be71895aea8343f704ff1613d3427a5de0df85c9329686d881e2852c1d`: id, organization_id, sync_type, status, direction, sync_start_date, sync_end_date, records_processed, records_succeeded, records_failed, records_skipped, error_message, error_details, data_hash, sync_data, verification_status, verification_notes, is_verified, verified_at, verified_by, created_at, updated_at, initiated_by. Eligible current organization-scoped blueprint.

Selected column set: **UNSELECTED**; incomparable eligible variants with equal recorded current authority. No cardinality, filename or age tiebreaker is authorized.

## Preservation and boundaries

The historical W4H report and residual packet are unchanged. The 121 approved groups, 178 governed obligations, case_documents text resolution, all approved property/FK-component provenance and named-enum precedence are preserved by section digests and full input hashes. Only five fixed inputs are read; no source discovery or W4H recomputation.

Canonical contract: **1.3.1**. W4H current overlay: **BLOCKED**. W4F regeneration: **NOT_AUTHORIZED**, not started. W4: **BLOCKED_DEFINITION_DECISIONS_PENDING**. W4P/W5: **NOT_AUTHORIZED**.

No SQL, inactive payloads, producer activation, database access, migrations, runtime/security proof, W4F regeneration or downstream execution. READY_FOR_RUNTIME_PROOF=0; PRODUCT_READY=NO.

## Validation

Closeout checks **PASS**: **68 tests** (33 W4H1 plus 35 unchanged W4H), scoped TypeScript and ESLint (exit0; existing Next pages-directory diagnostic), two-run deterministic self-test/check, formatting and documentation audit (**0 errors,1215 existing warnings**).

Independent read-only assertions verified exact five-group/obligation/identity coverage, organization_id and accepted columns, one exact current variant/no hybrid sets, all approved residual property values and provenance, fixed upstream file hashes and the 121-group/178-obligation/case_documents/all-approved-provenance section digests. Subset, authority, accepted constraint-column coverage and alias-equivalence rules are covered by tests. Exact commands and results are recorded in JSON. Passing validation does not override the three genuine blueprint ties or authorize W4F regeneration.
