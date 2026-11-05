-- Platform migration rollback declared-absent-relations-2
--
-- Creates 14 relations that their Drizzle declarations name and the storage-authority manifest already classifies, but that
-- neither Django nor an earlier platform migration creates: usage_aggregates, usage_events, usage_meters, dunning_cases, dunning_policies, dunning_steps, fee_settlement_lines, pricing_discount_rules, pricing_regional_deployments, pricing_template_modules, pricing_templates, audit_security.failed_login_attempts, audit_security.rate_limit_events, user_management.oauth_providers.
-- Generated, not hand-written: scripts/generate-relation-create.ts --tables=usage_aggregates,usage_events,usage_meters,dunning_cases,dunning_policies,dunning_steps,fee_settlement_lines,pricing_discount_rules,pricing_regional_deployments,pricing_template_modules,pricing_templates,audit_security.failed_login_attempts,audit_security.rate_limit_events,user_management.oauth_providers --label=declared-absent-relations-2 --rollback
-- from the declarations in db/schema, with the DDL produced by drizzle-kit.


DO $ue_rollback$
DECLARE
  t text;
  held boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_security.failed_login_attempts', 'audit_security.rate_limit_events', 'dunning_cases', 'dunning_steps', 'fee_settlement_lines', 'pricing_discount_rules', 'pricing_regional_deployments', 'pricing_template_modules', 'usage_aggregates', 'usage_events', 'user_management.oauth_providers', 'dunning_policies', 'pricing_templates', 'usage_meters'] LOOP
    IF to_regclass(CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END) IS NULL THEN CONTINUE; END IF;
    IF obj_description(to_regclass(CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END), 'pg_class') IS DISTINCT FROM 'platform-migration:declared-absent-relations-2' THEN
      RAISE EXCEPTION 'rollback declared-absent-relations-2 refuses: % was not created by this migration.', t;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s)', CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END) INTO held;
    IF held THEN
      RAISE EXCEPTION 'rollback declared-absent-relations-2 refuses: % holds rows; export them before removing the relation.', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['audit_security.failed_login_attempts', 'audit_security.rate_limit_events', 'dunning_cases', 'dunning_steps', 'fee_settlement_lines', 'pricing_discount_rules', 'pricing_regional_deployments', 'pricing_template_modules', 'usage_aggregates', 'usage_events', 'user_management.oauth_providers', 'dunning_policies', 'pricing_templates', 'usage_meters'] LOOP
    EXECUTE format('DROP TABLE IF EXISTS %s', CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['billing_cadence', 'discount_type', 'dunning_case_status', 'dunning_step_action', 'gtm_tier', 'pricing_template_status', 'template_tier', 'usage_aggregate_status', 'usage_meter_type'] LOOP
    IF to_regtype('public.' || t) IS NOT NULL AND obj_description(to_regtype('public.' || t), 'pg_type') IS NOT DISTINCT FROM 'platform-migration:declared-absent-relations-2' THEN
      EXECUTE format('DROP TYPE public.%I', t);
    END IF;
  END LOOP;
END $ue_rollback$;
