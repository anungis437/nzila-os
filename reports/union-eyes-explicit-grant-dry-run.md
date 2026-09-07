# Union Eyes — Explicit Grant Dry-Run Plan

Generated: 2026-09-07T21:51:23.693Z

Deterministic dry-run only — does not emit or apply SQL. readyForExplicitGrant lists tables whose CLOSED classification and privilege sets are fully resolved and internally consistent; pendingReview lists NEEDS_REVIEW tables excluded from the plan. The real explicit-GRANT migration must still refuse to run while pendingReview.length > 0. riskSignals are REVIEW flags, not automatic failures — a mixed-principal table or a tenant DELETE grant can be entirely legitimate; no invariant here forbids them.

- Total manifest entries: 700
- Ready for explicit GRANT (CLOSED, fully resolved): 467
- Pending review (NEEDS_REVIEW, excluded from plan): 233
- Tenant-granted tables (union_eyes_runtime): 220
- System-granted tables (union_eyes_system): 30

## Operation totals (ready set)

| principal | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| tenant (union_eyes_runtime) | 212 | 188 | 139 | 82 |
| system (union_eyes_system) | 28 | 14 | 10 | 0 |

## Risk signals (review flags, not automatic failures)

- Tenant DELETE grants (82): anti_scab_violations, api_integrations, arbitration_decisions, arbitration_precedents, arbitrations, bank_accounts, bank_reconciliation, bank_reconciliations, bargaining_notes, bargaining_proposals, bargaining_units, break_policies, campaigns, case_studies, cba_clauses, chart_of_accounts, claim_deadlines, claims, clc_remittance_mapping, cnesst_filings, collective_agreements, committee_documents, committees, communication_preferences, correspondence, cost_centers, course_sessions, deadline_reminders, documents, dues_rates, dues_transactions, employer_remittances, employers, erp_invoices, federations, financial_periods, gl_account_mappings, gl_transaction_log, gl_trial_balance, grievance_case_access_assignments, grievance_deadlines, grievance_documents, grievance_transitions, grievances, hazard_reports, in_app_notifications, joint_hs_committees, kpi_configurations, member_arrears, member_breaks, member_employment, member_history_events, member_segments, message_log, message_templates, negotiations, newsletter_distribution_lists, notification_queue, notifications, org_configurations, organization_members, pay_equity_exercises, payment_cycles, payment_disputes, payment_methods, payment_plans, pilot_demo_seeds, preventive_withdrawals, push_notifications, remittance_exceptions, remittance_line_items, right_of_refusal_events, safety_inspections, sms_messages, social_accounts, steward_assignments, testimonials, voting_sessions, wcb_claims, wcb_employer_assessments, workplace_incidents, worksites
- Mixed-principal tables (18): alert_rules, billing_accounts, campaigns, collective_agreements, communication_preferences, consent_records, deadline_reminders, dues_assignments, grievance_deadlines, message_log, notification_delivery_log, notification_queue, organization_members, organizations, per_capita_remittances, pilot_applications, platform_payments, policy_evaluations
- SYSTEM_ONLY tables with broad system DML (>=3 ops) (3): council_elections, reserved_matter_votes, union_density
- GLOBAL_REFERENCE_DATA with tenant mutations (10): case_studies, cba_intel_agreements, cba_intel_benchmark_snapshots, cba_intel_clauses, cba_intel_documents, cba_intel_extraction_runs, cba_intel_findings, cba_intel_ingestion_jobs, cba_intel_wage_adjustments, testimonials

## Ready for explicit GRANT

| table | classification | tenant (union_eyes_runtime) | system (union_eyes_system) |
| --- | --- | --- | --- |
| ab_test_assignments | LATENT_UNREACHABLE | NONE | NONE |
| ab_test_events | LATENT_UNREACHABLE | NONE | NONE |
| accessibility_audits | LATENT_UNREACHABLE | NONE | NONE |
| accessibility_issues | LATENT_UNREACHABLE | NONE | NONE |
| accessibility_test_suites | LATENT_UNREACHABLE | NONE | NONE |
| accessibility_user_testing | LATENT_UNREACHABLE | NONE | NONE |
| account_balance_reconciliation | CONTAINED_NO_AUTHORITY | NONE | NONE |
| account_mappings | MIXED_GLOBAL_TENANT_RLS_REQUIRED | SELECT | NONE |
| ai_grievance_triages | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| ai_insight_reports | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| ai_rate_limits | LATENT_UNREACHABLE | NONE | NONE |
| alert_actions | LATENT_UNREACHABLE | NONE | NONE |
| alert_conditions | LATENT_UNREACHABLE | NONE | NONE |
| alert_escalations | LATENT_UNREACHABLE | NONE | NONE |
| alert_recipients | CONTAINED_NO_AUTHORITY | NONE | NONE |
| alert_rules | TENANT_RLS_REQUIRED | SELECT | SELECT, INSERT |
| allocation_rules | LATENT_UNREACHABLE | NONE | NONE |
| analytics_scheduled_reports | LATENT_UNREACHABLE | NONE | NONE |
| anti_scab_violations | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| api_access_tokens | LATENT_UNREACHABLE | NONE | NONE |
| api_integrations | TENANT_RLS_REQUIRED | SELECT, UPDATE, DELETE | NONE |
| applications | LATENT_UNREACHABLE | NONE | NONE |
| arbitration_decisions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| arbitration_precedents | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| arbitrations | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| automation_execution_log | LATENT_UNREACHABLE | NONE | NONE |
| automation_schedules | LATENT_UNREACHABLE | NONE | NONE |
| bank_accounts | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| bank_reconciliation | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| bank_reconciliations | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| bank_transactions | LATENT_UNREACHABLE | NONE | NONE |
| bargaining_notes | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| bargaining_proposals | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| bargaining_team_members | CONTAINED_NO_AUTHORITY | NONE | NONE |
| bargaining_units | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| benchmark_categories | LATENT_UNREACHABLE | NONE | NONE |
| benchmark_data | LATENT_UNREACHABLE | NONE | NONE |
| benefit_comparisons | CONTAINED_NO_AUTHORITY | NONE | NONE |
| billing_accounts | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | SELECT |
| billing_adjustments | LATENT_UNREACHABLE | NONE | NONE |
| billing_invoices | LATENT_UNREACHABLE | NONE | NONE |
| billing_payments | LATENT_UNREACHABLE | NONE | NONE |
| billing_periods | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| billing_subscriptions | TENANT_RLS_REQUIRED | SELECT | NONE |
| billing_terms | LATENT_UNREACHABLE | NONE | NONE |
| board_packet_distributions | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| board_packet_sections | LATENT_UNREACHABLE | NONE | NONE |
| board_packet_templates | LATENT_UNREACHABLE | NONE | NONE |
| board_packets | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| break_policies | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| budget_reservations | CONTAINED_NO_AUTHORITY | NONE | NONE |
| calendar_sharing | LATENT_UNREACHABLE | NONE | NONE |
| campaigns | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | SELECT, UPDATE |
| card_signing_events | LATENT_UNREACHABLE | NONE | NONE |
| case_documents | TENANT_RLS_REQUIRED | SELECT | NONE |
| case_studies | GLOBAL_REFERENCE_DATA | SELECT, INSERT, UPDATE, DELETE | NONE |
| cba_clauses | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| cba_contacts | CONTAINED_NO_AUTHORITY | NONE | NONE |
| cba_footnotes | CONTAINED_NO_AUTHORITY | NONE | NONE |
| cba_intel_agreements | GLOBAL_REFERENCE_DATA | SELECT, INSERT, UPDATE | NONE |
| cba_intel_benchmark_snapshots | GLOBAL_REFERENCE_DATA | SELECT, INSERT | NONE |
| cba_intel_clauses | GLOBAL_REFERENCE_DATA | SELECT, INSERT, UPDATE | NONE |
| cba_intel_documents | GLOBAL_REFERENCE_DATA | SELECT, INSERT, UPDATE | NONE |
| cba_intel_extraction_runs | GLOBAL_REFERENCE_DATA | SELECT, INSERT, UPDATE | NONE |
| cba_intel_findings | GLOBAL_REFERENCE_DATA | SELECT, INSERT, UPDATE | NONE |
| cba_intel_freshness_log | LATENT_UNREACHABLE | NONE | NONE |
| cba_intel_ingestion_jobs | GLOBAL_REFERENCE_DATA | SELECT, INSERT, UPDATE | NONE |
| cba_intel_wage_adjustments | GLOBAL_REFERENCE_DATA | SELECT, INSERT, UPDATE | NONE |
| cba_rule_set_items | TENANT_RLS_REQUIRED | SELECT | NONE |
| cba_rule_versions | TENANT_RLS_REQUIRED | SELECT | NONE |
| cba_version_history | CONTAINED_NO_AUTHORITY | NONE | NONE |
| chart_of_accounts | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| chat_messages | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT | NONE |
| chat_sessions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| chatbot_analytics | LATENT_UNREACHABLE | NONE | NONE |
| chatbot_suggestions | LATENT_UNREACHABLE | NONE | NONE |
| claim_deadlines | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| claim_precedent_analysis | LATENT_UNREACHABLE | NONE | NONE |
| claim_updates | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| claims | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| clause_comparisons | TENANT_RLS_REQUIRED | INSERT | NONE |
| clause_comparisons_history | LATENT_UNREACHABLE | NONE | NONE |
| clause_embeddings | PARENT_OWNED_RLS_REQUIRED | SELECT | NONE |
| clc_api_config | LATENT_UNREACHABLE | NONE | NONE |
| clc_chart_of_accounts | SEPARATE_DATABASE_BOUNDARY | NONE | NONE |
| clc_organization_sync_log | SYSTEM_ONLY | NONE | SELECT |
| clc_per_capita_benchmarks | CONTAINED_NO_AUTHORITY | NONE | NONE |
| clc_remittance_mapping | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| clc_sync_log | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| clc_webhook_log | LATENT_UNREACHABLE | NONE | NONE |
| cms_blocks | LATENT_UNREACHABLE | NONE | NONE |
| cms_navigation_menus | LATENT_UNREACHABLE | NONE | NONE |
| cms_templates | LATENT_UNREACHABLE | NONE | NONE |
| cnesst_filings | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| collective_agreements | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | SELECT |
| committee_action_items | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| committee_documents | TENANT_RLS_REQUIRED | SELECT, INSERT, DELETE | NONE |
| committee_intelligence_snapshots | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| committee_meeting_attendees | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| committee_meetings | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| committee_memberships | LATENT_UNREACHABLE | NONE | NONE |
| committees | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| communication_analytics | LATENT_UNREACHABLE | NONE | NONE |
| communication_channels | LATENT_UNREACHABLE | NONE | NONE |
| communication_preferences | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE |
| communication_templates | LATENT_UNREACHABLE | NONE | NONE |
| comparative_analyses | LATENT_UNREACHABLE | NONE | NONE |
| compliance_alerts | TENANT_RLS_REQUIRED | SELECT | NONE |
| conflict_review_committee | LATENT_UNREACHABLE | NONE | NONE |
| conflict_training | LATENT_UNREACHABLE | NONE | NONE |
| congress_memberships | LATENT_UNREACHABLE | NONE | NONE |
| consent_records | TENANT_RLS_REQUIRED | SELECT, INSERT | INSERT |
| contract_amendments | LATENT_UNREACHABLE | NONE | NONE |
| contract_covered_orgs | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| contract_rate_cards | LATENT_UNREACHABLE | NONE | NONE |
| corrective_actions | LATENT_UNREACHABLE | NONE | NONE |
| correspondence | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| correspondence_recipients | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT | NONE |
| cost_centers | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| council_elections | SYSTEM_ONLY | NONE | SELECT, INSERT, UPDATE |
| course_sessions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| cross_org_access_log | SYSTEM_ONLY | NONE | NONE |
| currency_exchange_rates | CONTAINED_NO_AUTHORITY | NONE | NONE |
| data_aggregation_consent | TENANT_RLS_REQUIRED | SELECT | NONE |
| data_anonymization_log | LATENT_UNREACHABLE | NONE | NONE |
| data_processing_records | LATENT_UNREACHABLE | NONE | NONE |
| data_residency_configs | LATENT_UNREACHABLE | NONE | NONE |
| data_retention_policies | LATENT_UNREACHABLE | NONE | NONE |
| deadline_alerts | LATENT_UNREACHABLE | NONE | NONE |
| deadline_extensions | LATENT_UNREACHABLE | NONE | NONE |
| deadline_reassignment_convergence | LATENT_UNREACHABLE | NONE | NONE |
| deadline_reminder_executions | LATENT_UNREACHABLE | NONE | NONE |
| deadline_reminders | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | SELECT |
| deadline_rules | LATENT_UNREACHABLE | NONE | NONE |
| defensibility_packs | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| document_access_grants | TENANT_RLS_REQUIRED | SELECT | NONE |
| document_folders | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| document_links | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| document_search_index | LATENT_UNREACHABLE | NONE | NONE |
| document_versions | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| documents | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| donation_receipts | CONTAINED_NO_AUTHORITY | NONE | NONE |
| donations | SEPARATE_DATABASE_BOUNDARY | NONE | NONE |
| dsr_activity_log | LATENT_UNREACHABLE | NONE | NONE |
| dsr_requests | LATENT_UNREACHABLE | NONE | NONE |
| dues_assignments | TENANT_RLS_REQUIRED | SELECT | SELECT |
| dues_policies | LATENT_UNREACHABLE | NONE | NONE |
| dues_rates | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| dues_transactions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| duplicate_group_members | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT | NONE |
| duplicate_groups | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| employer_contacts | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| employer_execution_evidence_links | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| employer_execution_profiles | TENANT_RLS_REQUIRED | SELECT | NONE |
| employer_payroll_adjustments | LATENT_UNREACHABLE | NONE | NONE |
| employer_payroll_run_items | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| employer_payroll_runs | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| employer_remittance_run_items | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| employer_remittance_runs | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| employer_remittances | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| employer_reports | PARENT_OWNED_RLS_REQUIRED | SELECT | NONE |
| employer_responses | LATENT_UNREACHABLE | NONE | NONE |
| employers | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| employment_history | LATENT_UNREACHABLE | NONE | NONE |
| entitlement_usage_log | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| erp_connectors | LATENT_UNREACHABLE | NONE | NONE |
| erp_invoices | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| event_check_ins | LATENT_UNREACHABLE | NONE | NONE |
| event_registrations | LATENT_UNREACHABLE | NONE | NONE |
| event_reminders | LATENT_UNREACHABLE | NONE | NONE |
| exit_interview_documents | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| exit_interview_sessions | LATENT_UNREACHABLE | NONE | NONE |
| exit_interviews | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_accounts | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_benefit_coverage | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_benefit_dependents | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_benefit_enrollments | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_benefit_plans | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_benefit_utilization | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_calendar_attendees | LATENT_UNREACHABLE | NONE | NONE |
| external_calendar_events | LATENT_UNREACHABLE | NONE | NONE |
| external_calendar_recurring_patterns | LATENT_UNREACHABLE | NONE | NONE |
| external_calendars | LATENT_UNREACHABLE | NONE | NONE |
| external_communication_channels | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_communication_files | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_communication_messages | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_communication_users | TENANT_RLS_REQUIRED | INSERT, UPDATE | NONE |
| external_customers | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_departments | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_document_files | CONTAINED_NO_AUTHORITY | NONE | NONE |
| external_document_libraries | CONTAINED_NO_AUTHORITY | NONE | NONE |
| external_document_permissions | CONTAINED_NO_AUTHORITY | NONE | NONE |
| external_document_sites | CONTAINED_NO_AUTHORITY | NONE | NONE |
| external_employees | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_insurance_beneficiaries | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_insurance_claims | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_insurance_policies | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_invoices | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| external_lms_completions | TENANT_RLS_REQUIRED | INSERT, UPDATE | NONE |
| external_lms_courses | TENANT_RLS_REQUIRED | INSERT, UPDATE | NONE |
| external_lms_enrollments | TENANT_RLS_REQUIRED | INSERT, UPDATE | NONE |
| external_lms_learners | TENANT_RLS_REQUIRED | INSERT, UPDATE | NONE |
| external_lms_progress | TENANT_RLS_REQUIRED | INSERT, UPDATE | NONE |
| external_payments | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| external_pension_beneficiaries | LATENT_UNREACHABLE | NONE | NONE |
| external_pension_contributions | LATENT_UNREACHABLE | NONE | NONE |
| external_pension_estimates | LATENT_UNREACHABLE | NONE | NONE |
| external_pension_members | LATENT_UNREACHABLE | NONE | NONE |
| external_pension_plans | LATENT_UNREACHABLE | NONE | NONE |
| external_pension_service_credits | LATENT_UNREACHABLE | NONE | NONE |
| external_positions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| federation_campaigns | LATENT_UNREACHABLE | NONE | NONE |
| federation_communications | LATENT_UNREACHABLE | NONE | NONE |
| federation_executives | LATENT_UNREACHABLE | NONE | NONE |
| federation_meetings | LATENT_UNREACHABLE | NONE | NONE |
| federation_memberships | LATENT_UNREACHABLE | NONE | NONE |
| federation_resources | LATENT_UNREACHABLE | NONE | NONE |
| federations | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| field_notes | LATENT_UNREACHABLE | NONE | NONE |
| field_organizer_activities | LATENT_UNREACHABLE | NONE | NONE |
| financial_audit_log | LATENT_UNREACHABLE | NONE | NONE |
| financial_periods | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| gl_account_mappings | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| gl_transaction_log | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| gl_trial_balance | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| golden_shares | SYSTEM_ONLY | NONE | SELECT, INSERT |
| governance_bylaws | LATENT_UNREACHABLE | NONE | NONE |
| governance_events | SYSTEM_ONLY | NONE | SELECT |
| governance_policies | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| governance_signatories | LATENT_UNREACHABLE | NONE | NONE |
| grievance_approvals | LATENT_UNREACHABLE | NONE | NONE |
| grievance_assignments | LATENT_UNREACHABLE | NONE | NONE |
| grievance_case_access_assignments | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| grievance_communications | LATENT_UNREACHABLE | NONE | NONE |
| grievance_deadlines | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | SELECT |
| grievance_documents | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| grievance_events | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| grievance_responses | LATENT_UNREACHABLE | NONE | NONE |
| grievance_settlements | TENANT_RLS_REQUIRED | SELECT | NONE |
| grievance_stages | LATENT_UNREACHABLE | NONE | NONE |
| grievance_timeline | TENANT_RLS_REQUIRED | SELECT | NONE |
| grievance_transitions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| grievance_workflows | LATENT_UNREACHABLE | NONE | NONE |
| grievances | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| gss_applications | LATENT_UNREACHABLE | NONE | NONE |
| hazard_reports | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| icra_anonymized_metrics | LATENT_UNREACHABLE | NONE | NONE |
| icra_assessment_answers | SYSTEM_ONLY | NONE | NONE |
| icra_assessments | SYSTEM_ONLY | NONE | NONE |
| icra_benchmark_groups | LATENT_UNREACHABLE | NONE | NONE |
| icra_continuity_scores | SYSTEM_ONLY | NONE | NONE |
| icra_followup_recommendations | SYSTEM_ONLY | NONE | NONE |
| icra_governance_flags | SYSTEM_ONLY | NONE | NONE |
| icra_maturity_profiles | SYSTEM_ONLY | NONE | NONE |
| icra_operational_indicators | LATENT_UNREACHABLE | NONE | NONE |
| icra_organizations | SYSTEM_ONLY | NONE | NONE |
| impact_metrics | LATENT_UNREACHABLE | NONE | NONE |
| in_app_notifications | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| indigenous_member_data | LATENT_UNREACHABLE | NONE | NONE |
| ingestion_batches | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| ingestion_records | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| injury_logs | LATENT_UNREACHABLE | NONE | NONE |
| integration_configs | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| integration_sync_log | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| integration_sync_logs | LATENT_UNREACHABLE | NONE | NONE |
| job_applications | LATENT_UNREACHABLE | NONE | NONE |
| job_classifications | LATENT_UNREACHABLE | NONE | NONE |
| job_postings | LATENT_UNREACHABLE | NONE | NONE |
| job_saved | LATENT_UNREACHABLE | NONE | NONE |
| joint_hs_committees | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| journal_entries | LATENT_UNREACHABLE | NONE | NONE |
| journal_entry_lines | LATENT_UNREACHABLE | NONE | NONE |
| kpi_configurations | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| legal_holds | CONTAINED_NO_AUTHORITY | NONE | NONE |
| lrb_employers | LATENT_UNREACHABLE | NONE | NONE |
| lrb_unions | LATENT_UNREACHABLE | NONE | NONE |
| member_addresses | LATENT_UNREACHABLE | NONE | NONE |
| member_arrears | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| member_breaks | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| member_certifications | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| member_consents | LATENT_UNREACHABLE | NONE | NONE |
| member_contact_preferences | LATENT_UNREACHABLE | NONE | NONE |
| member_documents | LATENT_UNREACHABLE | NONE | NONE |
| member_dues_issues | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| member_dues_ledger | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| member_employment | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| member_employment_details | LATENT_UNREACHABLE | NONE | NONE |
| member_history_events | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| member_jurisdiction_preferences | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| member_leaves | LATENT_UNREACHABLE | NONE | NONE |
| member_location_consent | USER_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| member_relationship_scores | LATENT_UNREACHABLE | NONE | NONE |
| member_segments | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| message_log | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | SELECT, UPDATE |
| message_notifications | LATENT_UNREACHABLE | NONE | NONE |
| message_participants | LATENT_UNREACHABLE | NONE | NONE |
| message_read_receipts | PARENT_OWNED_RLS_REQUIRED | SELECT | NONE |
| message_templates | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| message_threads | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| messages | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT | NONE |
| mfa_configurations | LATENT_UNREACHABLE | NONE | NONE |
| mission_audits | SYSTEM_ONLY | NONE | SELECT, INSERT |
| mobile_app_config | LATENT_UNREACHABLE | NONE | NONE |
| mobile_notifications | LATENT_UNREACHABLE | NONE | NONE |
| negotiation_sessions | CONTAINED_NO_AUTHORITY | NONE | NONE |
| negotiations | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| newsletter_campaigns | TENANT_RLS_REQUIRED | SELECT | NONE |
| newsletter_distribution_lists | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| newsletter_recipients | PARENT_OWNED_RLS_REQUIRED | SELECT | NONE |
| newsletter_templates | LATENT_UNREACHABLE | NONE | NONE |
| nlrb_clrb_filings | LATENT_UNREACHABLE | NONE | NONE |
| notification_bounces | LATENT_UNREACHABLE | NONE | NONE |
| notification_delivery_log | TENANT_RLS_REQUIRED | SELECT, INSERT | INSERT |
| notification_history | LATENT_UNREACHABLE | NONE | NONE |
| notification_log | LATENT_UNREACHABLE | NONE | NONE |
| notification_queue | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | SELECT, INSERT, UPDATE |
| notification_templates | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| notification_tracking | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| notifications | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| org_configurations | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| org_entitlements | TENANT_RLS_REQUIRED | SELECT | NONE |
| org_subscriptions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| org_usage | LATENT_UNREACHABLE | NONE | NONE |
| organization_benchmark_snapshots | LATENT_UNREACHABLE | NONE | NONE |
| organization_billing_config | SYSTEM_ONLY | NONE | SELECT |
| organization_contacts | LATENT_UNREACHABLE | NONE | NONE |
| organization_members | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | SELECT, UPDATE |
| organization_relationships | SYSTEM_ONLY | NONE | SELECT |
| organization_sharing_grants | LATENT_UNREACHABLE | NONE | NONE |
| organization_sharing_settings | LATENT_UNREACHABLE | NONE | NONE |
| organizations | TENANT_RLS_REQUIRED | SELECT, UPDATE | SELECT, INSERT |
| organizer_impacts | LATENT_UNREACHABLE | NONE | NONE |
| organizer_tasks | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| organizing_campaign_milestones | LATENT_UNREACHABLE | NONE | NONE |
| organizing_contacts | LATENT_UNREACHABLE | NONE | NONE |
| outreach_enrollments | LATENT_UNREACHABLE | NONE | NONE |
| outreach_sequences | LATENT_UNREACHABLE | NONE | NONE |
| outreach_steps_log | LATENT_UNREACHABLE | NONE | NONE |
| pack_download_log | LATENT_UNREACHABLE | NONE | NONE |
| pack_verification_log | LATENT_UNREACHABLE | NONE | NONE |
| page_analytics | LATENT_UNREACHABLE | NONE | NONE |
| pay_equity_exercises | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| payment_allocations | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT | NONE |
| payment_classification_policy | CONTAINED_NO_AUTHORITY | NONE | NONE |
| payment_cycles | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| payment_disputes | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| payment_methods | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| payment_plans | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| payment_routing_rules | CONTAINED_NO_AUTHORITY | NONE | NONE |
| payroll_deductions | TENANT_RLS_REQUIRED | SELECT | NONE |
| pci_dss_cardholder_data_flow | LATENT_UNREACHABLE | NONE | NONE |
| pci_dss_encryption_keys | CONTAINED_NO_AUTHORITY | NONE | NONE |
| pci_dss_quarterly_scans | CONTAINED_NO_AUTHORITY | NONE | NONE |
| pci_dss_requirements | CONTAINED_NO_AUTHORITY | NONE | NONE |
| pci_dss_saq_assessments | CONTAINED_NO_AUTHORITY | NONE | NONE |
| pension_benefit_claims | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| pension_contributions | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| pension_members | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| pension_plans | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| pension_t4a_records | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| pension_trustee_meetings | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| pension_trustees | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| per_capita_remittances | MULTI_PARTY_RLS_REQUIRED | SELECT | SELECT, INSERT, UPDATE |
| pilot_applications | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | SELECT, UPDATE |
| pilot_demo_seeds | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| platform_cost_ledger_entries | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| platform_invoice_line_items | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT | NONE |
| platform_invoices | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| platform_payments | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | SELECT, INSERT |
| policy_evaluations | PARENT_OWNED_RLS_REQUIRED | INSERT | SELECT |
| policy_exceptions | PARENT_OWNED_RLS_REQUIRED | SELECT | NONE |
| policy_rules | TENANT_RLS_REQUIRED | SELECT | NONE |
| ppe_equipment | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| precedent_tags | CONTAINED_NO_AUTHORITY | NONE | NONE |
| preventive_withdrawals | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| program_enrollments | LATENT_UNREACHABLE | NONE | NONE |
| public_events | LATENT_UNREACHABLE | NONE | NONE |
| push_devices | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| push_notification_templates | LATENT_UNREACHABLE | NONE | NONE |
| push_notifications | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| recognition_programs | TENANT_RLS_REQUIRED | SELECT | NONE |
| reconciliation_exceptions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| reconciliation_matches | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| reconciliation_runs | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| remittance_approvals | SYSTEM_ONLY | NONE | SELECT |
| remittance_exceptions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| remittance_line_items | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| report_delivery_history | LATENT_UNREACHABLE | NONE | NONE |
| report_executions | LATENT_UNREACHABLE | NONE | NONE |
| report_shares | LATENT_UNREACHABLE | NONE | NONE |
| report_templates | LATENT_UNREACHABLE | NONE | NONE |
| reserved_matter_votes | SYSTEM_ONLY | NONE | SELECT, INSERT, UPDATE |
| retention_policies | CONTAINED_NO_AUTHORITY | NONE | NONE |
| reward_budget_envelopes | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| reward_wallet_ledger | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| right_of_refusal_events | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| role_tenure_history | LATENT_UNREACHABLE | NONE | NONE |
| room_bookings | LATENT_UNREACHABLE | NONE | NONE |
| safety_audits | LATENT_UNREACHABLE | NONE | NONE |
| safety_certifications | LATENT_UNREACHABLE | NONE | NONE |
| safety_committee_meetings | LATENT_UNREACHABLE | NONE | NONE |
| safety_inspections | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| safety_policies | LATENT_UNREACHABLE | NONE | NONE |
| safety_training_records | TENANT_RLS_REQUIRED | SELECT | NONE |
| scheduled_reports | LATENT_UNREACHABLE | NONE | NONE |
| scim_configurations | LATENT_UNREACHABLE | NONE | NONE |
| scim_events_log | LATENT_UNREACHABLE | NONE | NONE |
| segment_executions | LATENT_UNREACHABLE | NONE | NONE |
| segment_exports | LATENT_UNREACHABLE | NONE | NONE |
| separated_payment_transactions | CONTAINED_NO_AUTHORITY | NONE | NONE |
| settlements | TENANT_RLS_REQUIRED | SELECT | NONE |
| shopify_config | CONTAINED_NO_AUTHORITY | NONE | NONE |
| signature_documents | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE | NONE |
| signature_templates | LATENT_UNREACHABLE | NONE | NONE |
| signature_webhooks_log | LATENT_UNREACHABLE | NONE | NONE |
| sms_messages | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| sms_rate_limits | LATENT_UNREACHABLE | NONE | NONE |
| social_accounts | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| social_engagement | LATENT_UNREACHABLE | NONE | NONE |
| social_feeds | LATENT_UNREACHABLE | NONE | NONE |
| sso_sessions | LATENT_UNREACHABLE | NONE | NONE |
| steward_assignments | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| strategic_goals | TENANT_RLS_REQUIRED | SELECT | NONE |
| stripe_webhook_events | LATENT_UNREACHABLE | NONE | NONE |
| subscription_events_log | TENANT_RLS_REQUIRED | SELECT, INSERT | NONE |
| subscription_plans | GLOBAL_REFERENCE_DATA | SELECT | NONE |
| support_tickets | SYSTEM_ONLY | NONE | SELECT |
| task_comments | LATENT_UNREACHABLE | NONE | NONE |
| tentative_agreements | PARENT_OWNED_RLS_REQUIRED | SELECT, INSERT | NONE |
| testimonials | GLOBAL_REFERENCE_DATA | SELECT, INSERT, UPDATE, DELETE | NONE |
| ticket_comments | CONTAINED_NO_AUTHORITY | NONE | NONE |
| ticket_history | CONTAINED_NO_AUTHORITY | NONE | NONE |
| ue_governance_job_cancellation_audit_event | LATENT_UNREACHABLE | NONE | NONE |
| ue_governance_job_cancellation_request | LATENT_UNREACHABLE | NONE | NONE |
| ue_governance_job_execution_state | LATENT_UNREACHABLE | NONE | NONE |
| ue_governance_job_reconciliation_pass | LATENT_UNREACHABLE | NONE | NONE |
| ue_policy_bindings | LATENT_UNREACHABLE | NONE | NONE |
| union_density | SYSTEM_ONLY | NONE | SELECT, INSERT, UPDATE |
| union_dues_receipts | LATENT_UNREACHABLE | NONE | NONE |
| union_dues_year_end | LATENT_UNREACHABLE | NONE | NONE |
| union_representation_votes | LATENT_UNREACHABLE | NONE | NONE |
| user_engagement_scores | LATENT_UNREACHABLE | NONE | NONE |
| user_sessions | LATENT_UNREACHABLE | NONE | NONE |
| voter_eligibility | PARENT_OWNED_RLS_REQUIRED | SELECT | NONE |
| voting_audit_log | CONTAINED_NO_AUTHORITY | NONE | NONE |
| voting_notifications | CONTAINED_NO_AUTHORITY | NONE | NONE |
| voting_sessions | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| wage_progressions | CONTAINED_NO_AUTHORITY | NONE | NONE |
| wcag_success_criteria | LATENT_UNREACHABLE | NONE | NONE |
| wcb_claims | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| wcb_employer_assessments | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| webhook_deliveries | LATENT_UNREACHABLE | NONE | NONE |
| webhook_events | CONTAINED_NO_AUTHORITY | NONE | NONE |
| webhook_receipts | SYSTEM_ONLY | NONE | SELECT, INSERT |
| webhook_subscriptions | LATENT_UNREACHABLE | NONE | NONE |
| website_settings | LATENT_UNREACHABLE | NONE | NONE |
| whiplash_prevention_audit | CONTAINED_NO_AUTHORITY | NONE | NONE |
| whiplash_violations | CONTAINED_NO_AUTHORITY | NONE | NONE |
| workbook_continuity_breakpoints | LATENT_UNREACHABLE | NONE | NONE |
| workbook_governance_lineage_entries | PARENT_OWNED_RLS_REQUIRED | SELECT | NONE |
| workbook_modernization_alignment | LATENT_UNREACHABLE | NONE | NONE |
| workbook_stewardship_signals | LATENT_UNREACHABLE | NONE | NONE |
| workbook_transformation_roadmap | LATENT_UNREACHABLE | NONE | NONE |
| workflow_definitions | LATENT_UNREACHABLE | NONE | NONE |
| workflow_executions | LATENT_UNREACHABLE | NONE | NONE |
| workplace_incidents | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
| worksites | TENANT_RLS_REQUIRED | SELECT, INSERT, UPDATE, DELETE | NONE |
