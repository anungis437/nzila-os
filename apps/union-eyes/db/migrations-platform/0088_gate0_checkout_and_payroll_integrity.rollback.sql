DROP TRIGGER IF EXISTS grievances_demo_seed_immutable ON public.grievances;
DROP TRIGGER IF EXISTS employers_demo_seed_immutable ON public.employers;
DROP FUNCTION IF EXISTS public.ue_demo_seed_provenance_immutable();
DROP INDEX IF EXISTS public.idx_grievances_demo_seed;
DROP INDEX IF EXISTS public.idx_employers_demo_seed;
ALTER TABLE public.grievances DROP CONSTRAINT IF EXISTS grievances_demo_seed_fk, DROP COLUMN IF EXISTS demo_seed_id;
ALTER TABLE public.employers DROP CONSTRAINT IF EXISTS employers_demo_seed_fk, DROP COLUMN IF EXISTS demo_seed_id;
DROP TABLE IF EXISTS public.survey_anonymous_participations;
DROP TABLE IF EXISTS public.equity_disclosure_grants;
DROP TABLE IF EXISTS public.equity_self_identification_records;
DROP TABLE IF EXISTS public.equity_purpose_consents;
DROP TABLE IF EXISTS public.equity_consent_notice_versions;
DROP TABLE IF EXISTS public.integration_config_versions;
ALTER TABLE public.integration_configs DROP COLUMN IF EXISTS active_version;
ALTER TABLE public.survey_responses DROP COLUMN IF EXISTS questionnaire_version_id;
DROP TABLE IF EXISTS public.survey_questionnaire_versions;
DROP INDEX IF EXISTS public.compliance_alerts_source_evaluator_type_uniq;
ALTER TABLE public.compliance_alerts
  DROP COLUMN IF EXISTS rule_version_id,
  DROP COLUMN IF EXISTS evaluator_version,
  DROP COLUMN IF EXISTS source_revision,
  DROP COLUMN IF EXISTS source_event_id,
  DROP COLUMN IF EXISTS source_event_type;
DROP INDEX IF EXISTS public.employer_reports_source_evaluator_uniq;
ALTER TABLE public.employer_reports
  DROP CONSTRAINT IF EXISTS employer_reports_evaluation_status_check,
  DROP COLUMN IF EXISTS evaluation_status,
  DROP COLUMN IF EXISTS rule_version_id,
  DROP COLUMN IF EXISTS evaluator_version,
  DROP COLUMN IF EXISTS source_revision,
  DROP COLUMN IF EXISTS source_event_id,
  DROP COLUMN IF EXISTS source_event_type;
DROP TABLE IF EXISTS public.pilot_evidence_assessments;
DROP TABLE IF EXISTS public.pilot_commercial_acceptances;
DROP TABLE IF EXISTS public.pilot_commercial_offers;
DROP TABLE IF EXISTS public.organizing_form_generation_receipts;
DROP TABLE IF EXISTS public.organizing_form_template_versions;
DROP TABLE IF EXISTS public.pilot_crm_disclosure_outbox;
DROP TABLE IF EXISTS public.pilot_contact_verifications;
DROP TABLE IF EXISTS public.employer_remittance_submissions;
ALTER TABLE public.employer_remittance_runs
  DROP CONSTRAINT IF EXISTS employer_remittance_runs_source_revision_hash_check,
  DROP COLUMN IF EXISTS evidence_manifest_hash,
  DROP COLUMN IF EXISTS source_revision_hash,
  DROP COLUMN IF EXISTS package_schema_version;
DROP TABLE IF EXISTS public.employer_replay_intents;
DROP TABLE IF EXISTS public.statutory_rule_versions;
DROP TABLE IF EXISTS public.shopify_webhook_secret_versions;
DROP TABLE IF EXISTS public.integration_credential_bindings;
DROP TABLE IF EXISTS public.pension_benefit_settlement_handoffs;
DROP TABLE IF EXISTS public.pension_benefit_claim_evidence;
DROP TABLE IF EXISTS public.pension_trustee_decisions;
DROP TABLE IF EXISTS public.pension_trustee_mandates;
DROP TABLE IF EXISTS public.report_disclosure_receipts;
DROP TABLE IF EXISTS public.report_field_grants;
DROP TABLE IF EXISTS public.reconciliation_resolution_postings;
DROP TABLE IF EXISTS public.reconciliation_resolution_decisions;
DROP TABLE IF EXISTS public.billing_automation_runs;
DROP TABLE IF EXISTS public.billing_automation_mandates;
DROP TABLE IF EXISTS public.campaign_delivery_outbox;
DROP TABLE IF EXISTS public.voice_usage_reservations;
DROP TABLE IF EXISTS public.document_upload_quarantines;
DROP TABLE IF EXISTS public.sso_oidc_attempts;
DROP TABLE IF EXISTS public.sso_provider_versions;
ALTER TABLE public.sso_providers
  DROP COLUMN IF EXISTS approval_reference,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS active_version;
DROP TABLE IF EXISTS public.dues_payment_disclosure_consents;
DROP TABLE IF EXISTS public.dues_payment_merchant_configs;
DROP INDEX IF EXISTS public.member_location_consent_scope_uniq;
ALTER TABLE public.member_location_consent
  DROP CONSTRAINT IF EXISTS member_location_consent_scope_kind_check,
  DROP COLUMN IF EXISTS scope_id,
  DROP COLUMN IF EXISTS scope_kind,
  DROP COLUMN IF EXISTS organization_id;
DROP INDEX IF EXISTS public.payroll_runs_official_source_uniq;
DROP TABLE IF EXISTS public.workbook_checkout_intents;
