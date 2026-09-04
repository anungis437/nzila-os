# Union Eyes Storage Authority Census (round 38)

Generated: 2026-09-04T19:17:17.194Z

CANDIDATES ONLY — this report never rewrites the manifest. Every disposition below must be
independently reviewed and applied by hand to the relevant db/rls-storage-authority/*.ts domain file.

Total NEEDS_REVIEW entries scanned: 320

## Candidate classification counts

- LATENT_UNREACHABLE (Lane A — Dead, high confidence): 0
- CONTAINED_NO_AUTHORITY (Lane B — Contained, high confidence): 0
- Still NEEDS_REVIEW (requires deep review): 320

## Cohort counts

- COMPLEX:none:NORMAL: 73
- PARENT_OWNED:parent:NORMAL: 52
- COMPLEX:org:HIGH: 48
- COMPLEX:org:NORMAL: 42
- SIMPLE_TENANT:org:HIGH: 27
- SIMPLE_TENANT:org:NORMAL: 23
- PARENT_OWNED:parent:HIGH: 19
- COMPLEX:user:NORMAL: 16
- COMPLEX:none:HIGH: 8
- COMPLEX:user:HIGH: 6
- PARENT_OWNED:user:NORMAL: 4
- SYSTEM_WORKER:none:HIGH: 1
- SYSTEM_WORKER:org:NORMAL: 1

## High-confidence candidates (Lane A + Lane B)

| table | candidate | confidence | evidence |
|---|---|---|---|

## Remaining NEEDS_REVIEW, grouped by cohort lane (for batched deep review)

### SIMPLE_TENANT (50)

| table | blocker |
|---|---|
| ai_insight_reports | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| analytics_metrics | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| ml_predictions | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| model_metadata | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| external_insurance_claims | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| data_aggregation_consent | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| external_communication_channels | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| external_communication_users | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| document_folders | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| employer_execution_profiles | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| external_document_libraries | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| external_document_sites | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| ai_budgets | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| api_integrations | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| external_accounts | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| ingestion_batches | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| integration_configs | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| webhook_events | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| allocation_rules | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| break_policies | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| calendars | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| clause_comparisons | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| clc_per_capita_benchmarks | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| course_registrations | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| currency_exchange_rates | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| duplicate_groups | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| employer_contacts | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| exit_interviews | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| legal_holds | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| meeting_rooms | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| organizer_tasks | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| pay_equity_exercises | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| pci_dss_encryption_keys | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| pci_dss_quarterly_scans | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| pci_dss_requirements | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| pci_dss_saq_assessments | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| pilot_checklist_items | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| pilot_demo_seeds | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| pilot_enrollments | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| pilot_milestones | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| policy_rules | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| recognition_programs | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| reports | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| retention_policies | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| sso_providers | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| strategic_goals | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| support_tickets | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| training_courses | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| training_programs | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |
| trend_analyses | has real TS references — requires HTTP-reachability/auth-boundary trace before closing, not auto-closable |

### PARENT_OWNED (75)

| table | blocker |
|---|---|
| bargaining_team_members | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_contacts | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_footnotes | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_intel_agreements | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_intel_benchmark_snapshots | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_intel_clauses | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_intel_documents | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_intel_extraction_runs | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_intel_findings | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_intel_freshness_log | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_intel_ingestion_jobs | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_intel_wage_adjustments | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| cba_version_history | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| chat_messages | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| newsletter_engagement | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| newsletter_list_subscribers | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| newsletter_recipients | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| sms_campaign_recipients | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| voting_notifications | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| document_signers | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| pricing_template_modules | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| account_balance_reconciliation | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| budget_reservations | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| payment_routing_rules | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| separated_payment_transactions | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| ai_safety_filters | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| correspondence_audit_trail | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| signature_audit_log | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| signature_audit_trail | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| voting_audit_log | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| whiplash_prevention_audit | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| mobile_sync_queue | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| ingestion_records | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| compliance_alerts | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| ab_test_variants | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| access_justification_requests | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| address_change_history | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| alert_executions | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| alert_recipients | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| allocation_basis_snapshots | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| allocation_rule_versions | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| allocation_run_lines | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| award_history | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| benefit_comparisons | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| break_glass_activations | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| clause_embeddings | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| clause_library_tags | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| contract_line_items | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| correspondence_recipients | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| dispatch_assignments | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| dunning_steps | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| employer_access_attempts | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| employer_reports | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| firewall_access_rules | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| firewall_violations | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| negotiation_sessions | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| policy_evaluations | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| policy_exceptions | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| precedent_tags | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| pricing_discount_rules | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| pricing_regional_deployments | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| push_deliveries | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| signature_verification | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| signers | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| tentative_agreements | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| ticket_comments | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| ticket_history | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| voter_eligibility | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| votes | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| voting_options | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| wage_progressions | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| whiplash_violations | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| workbook_memory_holders | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| workbook_modules | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |
| workbook_purchases | has real TS references — requires verifying the parent relationship is itself org-scoped, not auto-closable |

### SYSTEM_WORKER (2)

| table | blocker |
|---|---|
| webhook_receipts | has real TS references, hints suggest system/worker-only invocation — requires confirming no tenant-facing path exists, not auto-closable |
| shopify_config | has real TS references, hints suggest system/worker-only invocation — requires confirming no tenant-facing path exists, not auto-closable |

### COMPLEX (193)

| table | blocker |
|---|---|
| ai_clause_reasonings | ambiguous shape — needs manual review |
| ai_copilot_sessions | ambiguous shape — needs manual review |
| ai_usage_metrics | ambiguous shape — needs manual review |
| customer_nps_surveys | ambiguous shape — needs manual review |
| employer_risk_scores | ambiguous shape — needs manual review |
| insight_recommendations | ambiguous shape — needs manual review |
| mobile_analytics | ambiguous shape — needs manual review |
| pilot_metrics | ambiguous shape — needs manual review |
| social_analytics | ambiguous shape — needs manual review |
| usage_aggregates | ambiguous shape — needs manual review |
| usage_events | ambiguous shape — needs manual review |
| usage_meters | ambiguous shape — needs manual review |
| fee_settlement_lines | ambiguous shape — needs manual review |
| grievance_timeline_events | ambiguous shape — needs manual review |
| signature_workflows | ambiguous shape — needs manual review |
| cba_intel_review_decisions | ambiguous shape — needs manual review |
| cba_intel_sources | ambiguous shape — needs manual review |
| clc_bargaining_trends | ambiguous shape — needs manual review |
| fee_settlement_batches | ambiguous shape — needs manual review |
| chat_sessions | ambiguous shape — needs manual review |
| communication_preferences_phase4 | Django route reachable without a proven unconditional deny-all — needs isolation proof or containment, not auto-closable |
| cookie_consents | ambiguous shape — needs manual review |
| donation_campaigns | ambiguous shape — needs manual review |
| employer_communications | ambiguous shape — needs manual review |
| external_communication_messages | ambiguous shape — needs manual review |
| newsletter_campaigns | ambiguous shape — needs manual review |
| newsletter_distribution_lists | ambiguous shape — needs manual review |
| organizing_campaigns | ambiguous shape — needs manual review |
| sms_campaigns | ambiguous shape — needs manual review |
| sms_conversations | ambiguous shape — needs manual review |
| sms_opt_outs | ambiguous shape — needs manual review |
| social_campaigns | ambiguous shape — needs manual review |
| user_consents | ambiguous shape — needs manual review |
| user_notification_preferences | ambiguous shape — needs manual review |
| band_council_consent | ambiguous shape — needs manual review |
| provincial_consent | ambiguous shape — needs manual review |
| award_templates | ambiguous shape — needs manual review |
| cms_media_library | ambiguous shape — needs manual review |
| external_communication_files | ambiguous shape — needs manual review |
| external_document_files | ambiguous shape — needs manual review |
| external_document_permissions | ambiguous shape — needs manual review |
| signature_documents | ambiguous shape — needs manual review |
| sms_templates | ambiguous shape — needs manual review |
| arbitrator_profiles | ambiguous shape — needs manual review |
| pending_profiles | ambiguous shape — needs manual review |
| pricing_templates | ambiguous shape — needs manual review |
| profiles | ambiguous shape — needs manual review |
| swiss_cold_storage | ambiguous shape — needs manual review |
| transfer_pricing_documentation | ambiguous shape — needs manual review |
| budget_pool | ambiguous shape — needs manual review |
| payments | ambiguous shape — needs manual review |
| federation_remittances | Django route reachable without a proven unconditional deny-all — needs isolation proof or containment, not auto-closable |
| rl1_tax_slips | ambiguous shape — needs manual review |
| strike_fund_disbursements | ambiguous shape — needs manual review |
| stripe_connect_accounts | ambiguous shape — needs manual review |
| t4a_tax_slips | ambiguous shape — needs manual review |
| tax_year_end_processing | ambiguous shape — needs manual review |
| deadline_audit_events | ambiguous shape — needs manual review |
| certification_audit_log | ambiguous shape — needs manual review |
| conflict_audit_log | ambiguous shape — needs manual review |
| currency_enforcement_audit | ambiguous shape — needs manual review |
| firewall_compliance_audit | ambiguous shape — needs manual review |
| fmv_audit_log | ambiguous shape — needs manual review |
| fx_rate_audit_log | ambiguous shape — needs manual review |
| location_tracking_audit | ambiguous shape — needs manual review |
| strike_fund_payment_audit | ambiguous shape — needs manual review |
| employer_timesheet_batches | ambiguous shape — needs manual review |
| external_calendar_connections | ambiguous shape — needs manual review |
| integration_api_keys | ambiguous shape — needs manual review |
| integration_partners | ambiguous shape — needs manual review |
| integration_sync_schedules | Django route reachable without a proven unconditional deny-all — needs isolation proof or containment, not auto-closable |
| integration_webhooks | ambiguous shape — needs manual review |
| sync_jobs | ambiguous shape — needs manual review |
| external_data_sync_log | ambiguous shape — needs manual review |
| foreign_workers | ambiguous shape — needs manual review |
| lrb_sync_log | ambiguous shape — needs manual review |
| ab_tests | ambiguous shape — needs manual review |
| alert_rules | ambiguous shape — needs manual review |
| allocation_runs | ambiguous shape — needs manual review |
| automation_rules | ambiguous shape — needs manual review |
| calendar_events | ambiguous shape — needs manual review |
| chargeback_statements | ambiguous shape — needs manual review |
| cms_pages | ambiguous shape — needs manual review |
| commercial_contracts | ambiguous shape — needs manual review |
| customer_onboarding_milestones | ambiguous shape — needs manual review |
| data_quality_warnings | ambiguous shape — needs manual review |
| dispatch_requests | ambiguous shape — needs manual review |
| dispatch_rules | ambiguous shape — needs manual review |
| dunning_cases | ambiguous shape — needs manual review |
| employer_execution_artifacts | ambiguous shape — needs manual review |
| employer_execution_compliance_events | ambiguous shape — needs manual review |
| employer_execution_replays | ambiguous shape — needs manual review |
| employer_timesheet_entries | ambiguous shape — needs manual review |
| event_attendees | ambiguous shape — needs manual review |
| exit_interview_events | ambiguous shape — needs manual review |
| fee_adjustments | ambiguous shape — needs manual review |
| gdpr_data_requests | ambiguous shape — needs manual review |
| holidays | ambiguous shape — needs manual review |
| international_addresses | ambiguous shape — needs manual review |
| knowledge_base | ambiguous shape — needs manual review |
| mobile_devices | ambiguous shape — needs manual review |
| pilot_events | ambiguous shape — needs manual review |
| pilot_feedback | ambiguous shape — needs manual review |
| poll_votes | ambiguous shape — needs manual review |
| polls | ambiguous shape — needs manual review |
| public_content | ambiguous shape — needs manual review |
| push_devices | ambiguous shape — needs manual review |
| recognition_award_types | ambiguous shape — needs manual review |
| recognition_awards | ambiguous shape — needs manual review |
| reward_redemptions | ambiguous shape — needs manual review |
| satisfaction_surveys | ambiguous shape — needs manual review |
| security_events | ambiguous shape — needs manual review |
| security_posture_checks | ambiguous shape — needs manual review |
| social_posts | ambiguous shape — needs manual review |
| stewards | ambiguous shape — needs manual review |
| survey_answers | ambiguous shape — needs manual review |
| survey_questions | ambiguous shape — needs manual review |
| survey_responses | ambiguous shape — needs manual review |
| surveys | ambiguous shape — needs manual review |
| transaction_fee_events | ambiguous shape — needs manual review |
| transaction_fee_rules | ambiguous shape — needs manual review |
| user_signatures | ambiguous shape — needs manual review |
| address_validation_cache | ambiguous shape — needs manual review |
| arms_length_verification | ambiguous shape — needs manual review |
| autopay_settings | ambiguous shape — needs manual review |
| band_councils | ambiguous shape — needs manual review |
| bank_of_canada_rates | ambiguous shape — needs manual review |
| blind_trust_registry | ambiguous shape — needs manual review |
| break_glass_system | ambiguous shape — needs manual review |
| certification_alerts | ambiguous shape — needs manual review |
| certification_compliance_reports | ambiguous shape — needs manual review |
| certification_types | ambiguous shape — needs manual review |
| clc_oauth_tokens | ambiguous shape — needs manual review |
| clc_union_density | ambiguous shape — needs manual review |
| conflict_disclosures | ambiguous shape — needs manual review |
| conflict_of_interest_policy | ambiguous shape — needs manual review |
| continuing_education | ambiguous shape — needs manual review |
| contribution_rates | ambiguous shape — needs manual review |
| cost_of_living_data | ambiguous shape — needs manual review |
| country_address_formats | ambiguous shape — needs manual review |
| cpi_adjusted_pricing | ambiguous shape — needs manual review |
| cpi_data | ambiguous shape — needs manual review |
| cross_border_transactions | ambiguous shape — needs manual review |
| currency_enforcement_policy | ambiguous shape — needs manual review |
| currency_enforcement_violations | ambiguous shape — needs manual review |
| data_classification_policy | ambiguous shape — needs manual review |
| data_classification_registry | ambiguous shape — needs manual review |
| data_subject_access_requests | ambiguous shape — needs manual review |
| disaster_recovery_drills | ambiguous shape — needs manual review |
| dunning_policies | ambiguous shape — needs manual review |
| emergency_declarations | ambiguous shape — needs manual review |
| exchange_rates | ambiguous shape — needs manual review |
| feature_flags | ambiguous shape — needs manual review |
| fmv_benchmarks | ambiguous shape — needs manual review |
| fmv_policy | ambiguous shape — needs manual review |
| fmv_violations | ambiguous shape — needs manual review |
| geofence_events | ambiguous shape — needs manual review |
| geofences | ambiguous shape — needs manual review |
| independent_appraisals | ambiguous shape — needs manual review |
| indigenous_data_access_log | ambiguous shape — needs manual review |
| indigenous_data_sharing_agreements | ambiguous shape — needs manual review |
| key_holder_registry | ambiguous shape — needs manual review |
| knowledge_base_articles | ambiguous shape — needs manual review |
| license_renewals | ambiguous shape — needs manual review |
| lmbp_compliance_alerts | ambiguous shape — needs manual review |
| lmbp_compliance_reports | ambiguous shape — needs manual review |
| lmbp_letters | ambiguous shape — needs manual review |
| location_deletion_log | ambiguous shape — needs manual review |
| location_tracking | ambiguous shape — needs manual review |
| location_tracking_config | ambiguous shape — needs manual review |
| lrb_agreements | ambiguous shape — needs manual review |
| mentorships | ambiguous shape — needs manual review |
| movement_trends | ambiguous shape — needs manual review |
| precedent_citations | ambiguous shape — needs manual review |
| privacy_breaches | ambiguous shape — needs manual review |
| procurement_bids | ambiguous shape — needs manual review |
| procurement_requests | ambiguous shape — needs manual review |
| provincial_data_handling | ambiguous shape — needs manual review |
| provincial_privacy_config | ambiguous shape — needs manual review |
| recovery_time_objectives | ambiguous shape — needs manual review |
| recusal_tracking | ambiguous shape — needs manual review |
| shared_clause_library | ambiguous shape — needs manual review |
| sla_policies | ambiguous shape — needs manual review |
| staff_certifications | ambiguous shape — needs manual review |
| t106_filing_tracking | ambiguous shape — needs manual review |
| traditional_knowledge_registry | ambiguous shape — needs manual review |
| transaction_currency_conversions | ambiguous shape — needs manual review |
| union_density | ambiguous shape — needs manual review |
| union_only_data_tags | ambiguous shape — needs manual review |
| user_uuid_mapping | ambiguous shape — needs manual review |
| wage_benchmarks | ambiguous shape — needs manual review |
| weekly_threshold_tracking | ambiguous shape — needs manual review |
| workbooks | ambiguous shape — needs manual review |
