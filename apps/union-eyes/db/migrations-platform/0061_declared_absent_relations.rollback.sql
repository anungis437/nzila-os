-- Platform migration rollback declared-absent-relations
--
-- Creates 23 relations that their Drizzle declarations name and the storage-authority manifest already classifies, but that
-- neither Django nor an earlier platform migration creates: anti_scab_violations, cnesst_filings, joint_hs_committees, pay_equity_exercises, preventive_withdrawals, right_of_refusal_events, wcb_claims, wcb_employer_assessments, member_dues_issues, payroll_deductions, customer_nps_surveys, customer_onboarding_milestones, cba_intel_sources, cba_intel_ingestion_jobs, cba_intel_documents, cba_intel_agreements, cba_intel_clauses, cba_intel_extraction_runs, cba_intel_findings, cba_intel_wage_adjustments, cba_intel_review_decisions, cba_intel_benchmark_snapshots, cba_intel_freshness_log.
-- Generated, not hand-written: scripts/generate-relation-create.ts --tables=anti_scab_violations,cnesst_filings,joint_hs_committees,pay_equity_exercises,preventive_withdrawals,right_of_refusal_events,wcb_claims,wcb_employer_assessments,member_dues_issues,payroll_deductions,customer_nps_surveys,customer_onboarding_milestones,cba_intel_sources,cba_intel_ingestion_jobs,cba_intel_documents,cba_intel_agreements,cba_intel_clauses,cba_intel_extraction_runs,cba_intel_findings,cba_intel_wage_adjustments,cba_intel_review_decisions,cba_intel_benchmark_snapshots,cba_intel_freshness_log --label=declared-absent-relations --rollback
-- from the declarations in db/schema, with the DDL produced by drizzle-kit.


DO $ue_rollback$
DECLARE
  t text;
  held boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['anti_scab_violations', 'cba_intel_benchmark_snapshots', 'cba_intel_clauses', 'cba_intel_freshness_log', 'cba_intel_ingestion_jobs', 'cba_intel_review_decisions', 'cba_intel_wage_adjustments', 'cnesst_filings', 'customer_nps_surveys', 'customer_onboarding_milestones', 'joint_hs_committees', 'member_dues_issues', 'pay_equity_exercises', 'payroll_deductions', 'preventive_withdrawals', 'right_of_refusal_events', 'wcb_claims', 'wcb_employer_assessments', 'cba_intel_agreements', 'cba_intel_findings', 'cba_intel_extraction_runs', 'cba_intel_documents', 'cba_intel_sources'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    IF obj_description(to_regclass('public.' || t), 'pg_class') IS DISTINCT FROM 'platform-migration:declared-absent-relations' THEN
      RAISE EXCEPTION 'rollback declared-absent-relations refuses: % was not created by this migration.', t;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', t) INTO held;
    IF held THEN
      RAISE EXCEPTION 'rollback declared-absent-relations refuses: % holds rows; export them before removing the relation.', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['anti_scab_violations', 'cba_intel_benchmark_snapshots', 'cba_intel_clauses', 'cba_intel_freshness_log', 'cba_intel_ingestion_jobs', 'cba_intel_review_decisions', 'cba_intel_wage_adjustments', 'cnesst_filings', 'customer_nps_surveys', 'customer_onboarding_milestones', 'joint_hs_committees', 'member_dues_issues', 'pay_equity_exercises', 'payroll_deductions', 'preventive_withdrawals', 'right_of_refusal_events', 'wcb_claims', 'wcb_employer_assessments', 'cba_intel_agreements', 'cba_intel_findings', 'cba_intel_extraction_runs', 'cba_intel_documents', 'cba_intel_sources'] LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['anti_scab_violation_type', 'cba_intel_clause_family', 'cba_intel_collection_method', 'cba_intel_doc_processing_status', 'cba_intel_doc_type', 'cba_intel_extraction_method', 'cba_intel_extraction_status', 'cba_intel_failure_class', 'cba_intel_freshness_status', 'cba_intel_ingestion_status', 'cba_intel_review_status', 'cba_intel_review_target_type', 'cba_intel_source_health', 'cba_intel_source_type', 'cba_intel_trust_tier', 'cnesst_filing_status', 'cnesst_filing_type', 'pay_equity_status', 'preventive_withdrawal_reason', 'right_of_refusal_outcome', 'wcb_claim_status', 'wcb_claim_type', 'wcb_jurisdiction', 'wcb_return_to_work_status'] LOOP
    IF to_regtype('public.' || t) IS NOT NULL AND obj_description(to_regtype('public.' || t), 'pg_type') IS NOT DISTINCT FROM 'platform-migration:declared-absent-relations' THEN
      EXECUTE format('DROP TYPE public.%I', t);
    END IF;
  END LOOP;
END $ue_rollback$;
