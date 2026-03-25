CREATE SCHEMA "user_management";
--> statement-breakpoint
CREATE SCHEMA "audit_security";
--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense', 'cost_of_goods_sold', 'other_income', 'other_expense');--> statement-breakpoint
CREATE TYPE "public"."audit_type" AS ENUM('internal', 'external', 'certification', 'compliance', 'management_system', 'contractor', 'other');--> statement-breakpoint
CREATE TYPE "public"."body_part" AS ENUM('head', 'eyes', 'face', 'neck', 'shoulder', 'arm', 'elbow', 'wrist', 'hand', 'fingers', 'chest', 'back', 'abdomen', 'hip', 'leg', 'knee', 'ankle', 'foot', 'toes', 'multiple', 'internal', 'other');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."certification_status" AS ENUM('active', 'expired', 'suspended', 'revoked', 'pending_renewal');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('granted', 'denied', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."corrective_action_priority" AS ENUM('immediate', 'urgent', 'high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."corrective_action_status" AS ENUM('open', 'assigned', 'in_progress', 'pending_verification', 'verified', 'closed', 'deferred', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('active', 'on_leave', 'layoff', 'suspended', 'terminated', 'retired', 'deceased');--> statement-breakpoint
CREATE TYPE "public"."hazard_category" AS ENUM('biological', 'chemical', 'ergonomic', 'physical', 'psychosocial', 'safety', 'environmental', 'electrical', 'fire', 'confined_space', 'working_at_heights', 'machinery', 'other');--> statement-breakpoint
CREATE TYPE "public"."hazard_level" AS ENUM('low', 'moderate', 'high', 'critical', 'extreme');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('near_miss', 'minor', 'moderate', 'serious', 'critical', 'fatal');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('injury', 'near_miss', 'property_damage', 'environmental', 'vehicle', 'ergonomic', 'exposure', 'occupational_illness', 'fire', 'electrical', 'fall', 'other');--> statement-breakpoint
CREATE TYPE "public"."injury_nature" AS ENUM('cut', 'laceration', 'puncture', 'bruise', 'contusion', 'fracture', 'sprain', 'strain', 'dislocation', 'amputation', 'burn', 'chemical_burn', 'concussion', 'crushing', 'electric_shock', 'exposure', 'hearing_loss', 'infection', 'inflammation', 'poisoning', 'respiratory', 'multiple', 'other');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('scheduled', 'in_progress', 'completed', 'requires_followup', 'followup_complete', 'cancelled', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."inspection_type" AS ENUM('routine', 'comprehensive', 'targeted', 'post_incident', 'regulatory', 'pre_operational', 'contractor', 'joint_committee', 'other');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('regular', 'special', 'inspection', 'incident_review', 'training', 'other');--> statement-breakpoint
CREATE TYPE "public"."ppe_status" AS ENUM('in_stock', 'issued', 'in_use', 'returned', 'damaged', 'expired', 'disposed', 'under_inspection');--> statement-breakpoint
CREATE TYPE "public"."ppe_type" AS ENUM('hard_hat', 'safety_glasses', 'face_shield', 'hearing_protection', 'respirator', 'dust_mask', 'safety_gloves', 'chemical_gloves', 'safety_boots', 'high_vis_vest', 'fall_protection', 'welding_helmet', 'protective_clothing', 'coveralls', 'apron', 'other');--> statement-breakpoint
CREATE TYPE "public"."safety_certification_type" AS ENUM('health_safety_rep', 'first_aid', 'confined_space', 'fall_protection', 'forklift', 'whmis', 'lockout_tagout', 'fire_safety', 'emergency_response', 'scaffolding', 'crane_rigging', 'hazmat', 'radiation_safety', 'asbestos_awareness', 'silica_awareness', 'workplace_violence', 'accident_investigation', 'safety_auditor', 'ergonomics', 'occupational_hygiene', 'other');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'in_progress', 'success', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."training_status" AS ENUM('scheduled', 'in_progress', 'completed', 'failed', 'expired', 'renewed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."membership" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'whop');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'casual', 'seasonal', 'temporary', 'contract', 'probationary');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('vacation', 'sick', 'maternity', 'paternity', 'parental', 'bereavement', 'medical', 'disability', 'union_business', 'unpaid', 'lwop', 'other');--> statement-breakpoint
CREATE TYPE "public"."pay_frequency" AS ENUM('hourly', 'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'annual', 'per_diem');--> statement-breakpoint
CREATE TYPE "public"."shift_type" AS ENUM('day', 'evening', 'night', 'rotating', 'split', 'on_call');--> statement-breakpoint
CREATE TYPE "public"."steward_assignment_status" AS ENUM('pending', 'accepted', 'active', 'completed', 'declined', 'reassigned');--> statement-breakpoint
CREATE TYPE "public"."claim_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation', 'resolved', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('grievance_discipline', 'grievance_schedule', 'grievance_pay', 'workplace_safety', 'discrimination_age', 'discrimination_gender', 'discrimination_race', 'discrimination_disability', 'discrimination_other', 'harassment_sexual', 'harassment_workplace', 'wage_dispute', 'contract_dispute', 'retaliation', 'wrongful_termination', 'other', 'harassment_verbal', 'harassment_physical');--> statement-breakpoint
CREATE TYPE "public"."visibility_scope" AS ENUM('member', 'staff', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."arbitration_status" AS ENUM('pending', 'scheduled', 'in_progress', 'adjourned', 'reserved', 'award_rendered', 'settled', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."grievance_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."grievance_status" AS ENUM('draft', 'filed', 'acknowledged', 'investigating', 'response_due', 'response_received', 'escalated', 'mediation', 'arbitration', 'settled', 'withdrawn', 'denied', 'closed');--> statement-breakpoint
CREATE TYPE "public"."grievance_step" AS ENUM('step_1', 'step_2', 'step_3', 'final', 'arbitration');--> statement-breakpoint
CREATE TYPE "public"."grievance_type" AS ENUM('individual', 'group', 'policy', 'contract', 'harassment', 'discrimination', 'safety', 'seniority', 'discipline', 'termination', 'other');--> statement-breakpoint
CREATE TYPE "public"."settlement_type" AS ENUM('monetary', 'non_monetary', 'policy_change', ' reinstatement', 'apology', 'training', 'other');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."deadline_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."deadline_status" AS ENUM('pending', 'completed', 'missed', 'extended', 'waived');--> statement-breakpoint
CREATE TYPE "public"."delivery_method" AS ENUM('email', 'sms', 'push', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."extension_status" AS ENUM('pending', 'approved', 'denied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."assignment_role" AS ENUM('primary_officer', 'secondary_officer', 'legal_counsel', 'external_arbitrator', 'management_rep', 'witness', 'observer');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('assigned', 'accepted', 'in_progress', 'completed', 'reassigned', 'declined');--> statement-breakpoint
CREATE TYPE "public"."document_version_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."grievance_stage_type" AS ENUM('filed', 'intake', 'investigation', 'step_1', 'step_2', 'step_3', 'mediation', 'pre_arbitration', 'arbitration', 'resolved', 'withdrawn', 'denied', 'settled');--> statement-breakpoint
CREATE TYPE "public"."grievance_workflow_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('proposed', 'under_review', 'accepted', 'rejected', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."transition_trigger_type" AS ENUM('manual', 'automatic', 'deadline', 'approval', 'rejection');--> statement-breakpoint
CREATE TYPE "public"."grievance_document_type" AS ENUM('intake_form', 'evidence', 'witness_statement', 'employer_response', 'union_brief', 'arbitration_submission', 'settlement_agreement', 'correspondence', 'photo', 'other');--> statement-breakpoint
CREATE TYPE "public"."grievance_event_type" AS ENUM('created', 'status_changed', 'assigned', 'reassigned', 'note_added', 'document_uploaded', 'escalated', 'deadline_set', 'deadline_extended', 'meeting_scheduled', 'response_received', 'closed');--> statement-breakpoint
CREATE TYPE "public"."grievance_lifecycle_status" AS ENUM('new', 'triage', 'investigation', 'negotiation', 'arbitration', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."cba_language" AS ENUM('en', 'fr', 'bilingual');--> statement-breakpoint
CREATE TYPE "public"."cba_status" AS ENUM('active', 'expired', 'under_negotiation', 'ratified_pending', 'archived');--> statement-breakpoint
CREATE TYPE "public"."cba_jurisdiction" AS ENUM('federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba', 'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei', 'newfoundland', 'northwest_territories', 'yukon', 'nunavut');--> statement-breakpoint
CREATE TYPE "public"."clause_type" AS ENUM('wages_compensation', 'benefits_insurance', 'working_conditions', 'grievance_arbitration', 'seniority_promotion', 'health_safety', 'union_rights', 'management_rights', 'duration_renewal', 'vacation_leave', 'hours_scheduling', 'disciplinary_procedures', 'training_development', 'pension_retirement', 'overtime', 'job_security', 'technological_change', 'workplace_rights', 'other');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('monetary_amount', 'percentage', 'date', 'time_period', 'job_position', 'location', 'person', 'organization', 'legal_reference', 'other');--> statement-breakpoint
CREATE TYPE "public"."decision_type" AS ENUM('grievance', 'unfair_practice', 'certification', 'judicial_review', 'interpretation', 'scope_bargaining', 'other');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('grievance_upheld', 'grievance_denied', 'partial_success', 'dismissed', 'withdrawn', 'settled');--> statement-breakpoint
CREATE TYPE "public"."precedent_value" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."tribunal_type" AS ENUM('fpslreb', 'provincial_labour_board', 'private_arbitrator', 'court_federal', 'court_provincial', 'other');--> statement-breakpoint
CREATE TYPE "public"."negotiation_session_type" AS ENUM('opening', 'negotiation', 'caucus', 'conciliation', 'information', 'closing', 'ratification');--> statement-breakpoint
CREATE TYPE "public"."negotiation_status" AS ENUM('scheduled', 'active', 'impasse', 'conciliation', 'tentative', 'ratified', 'rejected', 'strike_lockout', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'submitted', 'under_review', 'accepted', 'rejected', 'counter_offered', 'withdrawn', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."proposal_type" AS ENUM('union_demand', 'management_offer', 'joint_proposal', 'mediator_proposal');--> statement-breakpoint
CREATE TYPE "public"."bargaining_team_role" AS ENUM('chief_negotiator', 'committee_member', 'researcher', 'note_taker', 'subject_expert', 'observer', 'legal_counsel', 'financial_advisor');--> statement-breakpoint
CREATE TYPE "public"."payment_processor" AS ENUM('stripe', 'whop', 'paypal', 'square', 'manual');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'paid', 'partial', 'overdue', 'waived', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('charge', 'payment', 'adjustment', 'refund', 'waiver', 'late_fee');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('stripe', 'bank_transfer', 'check', 'cash', 'direct_debit', 'payroll_deduction', 'ewallet');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'disputed', 'unmatched', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('dues', 'strike_fund', 'subscription', 'stipend', 'honorarium', 'rebate', 'other');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('unreconciled', 'pending_review', 'reconciled', 'orphaned', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'inactive', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."cost_center_type" AS ENUM('department', 'project', 'location', 'program', 'fund', 'grant', 'other');--> statement-breakpoint
CREATE TYPE "public"."benefit_claim_status" AS ENUM('pending', 'under_review', 'approved', 'denied', 'paid');--> statement-breakpoint
CREATE TYPE "public"."contribution_payment_status" AS ENUM('pending', 'received', 'overdue', 'partial');--> statement-breakpoint
CREATE TYPE "public"."pension_membership_status" AS ENUM('active', 'inactive', 'retired', 'deferred', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."pension_plan_status" AS ENUM('active', 'frozen', 'terminated', 'pending_approval');--> statement-breakpoint
CREATE TYPE "public"."pension_plan_type" AS ENUM('defined_benefit', 'defined_contribution', 'hybrid', 'target_benefit', 'multi_employer');--> statement-breakpoint
CREATE TYPE "public"."t4a_status" AS ENUM('draft', 'generated', 'filed', 'amended');--> statement-breakpoint
CREATE TYPE "public"."vesting_status" AS ENUM('not_vested', 'partially_vested', 'fully_vested');--> statement-breakpoint
CREATE TYPE "public"."billing_adjustment_type" AS ENUM('credit', 'debit', 'write_off', 'subsidy', 'discount', 'refund');--> statement-breakpoint
CREATE TYPE "public"."billing_account_status" AS ENUM('active', 'suspended', 'closed', 'pending');--> statement-breakpoint
CREATE TYPE "public"."platform_invoice_status" AS ENUM('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."platform_payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('flat', 'per_local', 'per_seat', 'per_module', 'tiered', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'cancelled', 'paused');--> statement-breakpoint
CREATE TYPE "public"."allocation_status" AS ENUM('unallocated', 'pending', 'allocated', 'partially_allocated', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."platform_cost_type" AS ENUM('base_subscription', 'local_fee', 'seat_fee', 'module_fee', 'usage_fee', 'onboarding_fee', 'support_fee', 'adjustment', 'credit', 'subsidy', 'writeoff');--> statement-breakpoint
CREATE TYPE "public"."ledger_event_type" AS ENUM('invoice_generated', 'payment_received', 'allocation_run', 'adjustment_posted', 'credit_applied', 'subsidy_applied', 'writeoff_posted', 'period_closed', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."ledger_source_type" AS ENUM('subscription', 'invoice', 'payment', 'adjustment', 'allocation', 'manual', 'system');--> statement-breakpoint
CREATE TYPE "public"."allocation_method" AS ENUM('per_member_count', 'per_active_user', 'per_case_volume', 'per_local_flat', 'weighted_hybrid', 'manual_override', 'subsidized');--> statement-breakpoint
CREATE TYPE "public"."allocation_run_status" AS ENUM('draft', 'simulated', 'pending_approval', 'approved', 'posted', 'reversed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."chargeback_status" AS ENUM('draft', 'issued', 'acknowledged', 'disputed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."strategic_goal_category" AS ENUM('membership', 'financial', 'advocacy', 'operations', 'education', 'organizing');--> statement-breakpoint
CREATE TYPE "public"."strategic_goal_status" AS ENUM('on-track', 'at-risk', 'delayed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."template_category" AS ENUM('general', 'announcement', 'event', 'update', 'custom');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('sent', 'delivered', 'read');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'file', 'system');--> statement-breakpoint
CREATE TYPE "public"."digest_frequency" AS ENUM('immediate', 'daily', 'weekly', 'never');--> statement-breakpoint
CREATE TYPE "public"."notification_bounce_type" AS ENUM('permanent', 'temporary', 'complaint', 'manual');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'push', 'in-app', 'multi');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."notification_queue_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."notification_schedule_status" AS ENUM('scheduled', 'sent', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed', 'partial', 'pending');--> statement-breakpoint
CREATE TYPE "public"."notification_template_status" AS ENUM('active', 'inactive', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."notification_template_type" AS ENUM('payment', 'dues', 'strike', 'voting', 'certification', 'general', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('payment_confirmation', 'payment_failed', 'payment_reminder', 'donation_received', 'stipend_approved', 'stipend_disbursed', 'low_balance_alert', 'arrears_warning', 'strike_announcement', 'picket_reminder', 'claim_update', 'document_update', 'deadline_alert', 'system_announcement', 'security_alert', 'general');--> statement-breakpoint
CREATE TYPE "public"."newsletter_bounce_type" AS ENUM('hard', 'soft', 'technical');--> statement-breakpoint
CREATE TYPE "public"."newsletter_engagement_event" AS ENUM('open', 'click', 'unsubscribe', 'spam_report');--> statement-breakpoint
CREATE TYPE "public"."newsletter_list_type" AS ENUM('manual', 'dynamic', 'segment');--> statement-breakpoint
CREATE TYPE "public"."newsletter_recipient_status" AS ENUM('pending', 'sent', 'delivered', 'bounced', 'failed');--> statement-breakpoint
CREATE TYPE "public"."newsletter_subscriber_status" AS ENUM('subscribed', 'unsubscribed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."push_delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'clicked', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."push_notification_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."push_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."campaign_channel" AS ENUM('email', 'sms', 'push', 'multi_channel');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('broadcast', 'sequence', 'triggered', 'transactional');--> statement-breakpoint
CREATE TYPE "public"."consent_channel" AS ENUM('email', 'sms', 'push', 'phone', 'mail');--> statement-breakpoint
CREATE TYPE "public"."message_delivery_status" AS ENUM('queued', 'sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked', 'unsubscribed', 'complained');--> statement-breakpoint
CREATE TYPE "public"."field_note_type" AS ENUM('contact', 'grievance', 'organizing', 'meeting', 'personal', 'workplace', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."outreach_sequence_status" AS ENUM('active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."outreach_step_status" AS ENUM('pending', 'scheduled', 'sent', 'delivered', 'completed', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'neutral', 'negative', 'concerned', 'engaged', 'disengaged');--> statement-breakpoint
CREATE TYPE "public"."steward_assignment_type" AS ENUM('primary', 'backup', 'temporary', 'training');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."employer_communication_status" AS ENUM('draft', 'sent', 'received', 'acknowledged');--> statement-breakpoint
CREATE TYPE "public"."employer_communication_type" AS ENUM('email', 'phone', 'meeting', 'letter', 'other');--> statement-breakpoint
CREATE TYPE "public"."employer_contact_role" AS ENUM('main', 'hr', 'labour_relations', 'legal', 'supervisor', 'other');--> statement-breakpoint
CREATE TYPE "public"."signature_provider" AS ENUM('docusign', 'hellosign', 'adobe_sign', 'pandadoc', 'internal');--> statement-breakpoint
CREATE TYPE "public"."signer_status" AS ENUM('pending', 'sent', 'delivered', 'viewed', 'signed', 'declined', 'authentication_failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."authentication_method" AS ENUM('email', 'sms', 'phone_call', 'knowledge_based', 'id_verification', 'multi_factor', 'none');--> statement-breakpoint
CREATE TYPE "public"."signature_document_status" AS ENUM('draft', 'sent', 'delivered', 'viewed', 'signed', 'completed', 'declined', 'voided', 'expired');--> statement-breakpoint
CREATE TYPE "public"."signature_type" AS ENUM('electronic', 'digital', 'wet', 'clickwrap');--> statement-breakpoint
CREATE TYPE "public"."signature_workflow_status" AS ENUM('draft', 'sent', 'in_progress', 'completed', 'declined', 'cancelled', 'expired', 'voided');--> statement-breakpoint
CREATE TYPE "public"."attendee_status" AS ENUM('invited', 'accepted', 'declined', 'tentative', 'no_response');--> statement-breakpoint
CREATE TYPE "public"."calendar_permission" AS ENUM('owner', 'editor', 'viewer', 'none');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('meeting', 'appointment', 'deadline', 'reminder', 'task', 'hearing', 'mediation', 'negotiation', 'training', 'other');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('available', 'booked', 'maintenance', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('essential', 'functional', 'analytics', 'marketing', 'personalization', 'third_party');--> statement-breakpoint
CREATE TYPE "public"."gdpr_request_status" AS ENUM('pending', 'in_progress', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."gdpr_request_type" AS ENUM('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection');--> statement-breakpoint
CREATE TYPE "public"."processing_purpose" AS ENUM('service_delivery', 'legal_compliance', 'contract_performance', 'legitimate_interest', 'consent', 'vital_interest');--> statement-breakpoint
CREATE TYPE "public"."pci_assessment_status" AS ENUM('in_progress', 'completed', 'requires_remediation');--> statement-breakpoint
CREATE TYPE "public"."pci_requirement_status" AS ENUM('compliant', 'not_applicable', 'requires_remediation');--> statement-breakpoint
CREATE TYPE "public"."pci_scan_status" AS ENUM('pass', 'fail', 'pending');--> statement-breakpoint
CREATE TYPE "public"."compliance_alert_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."compliance_alert_type" AS ENUM('contract_violation', 'safety_violation', 'dispatch_non_compliance', 'reporting_overdue', 'grievance_spike', 'dues_non_remittance');--> statement-breakpoint
CREATE TYPE "public"."compliance_report_type" AS ENUM('quarterly_review', 'annual_audit', 'incident_report', 'dispatch_fulfillment', 'grievance_summary', 'safety_inspection');--> statement-breakpoint
CREATE TYPE "public"."congress_membership_status" AS ENUM('active', 'suspended', 'expired', 'pending');--> statement-breakpoint
CREATE TYPE "public"."external_hris_provider" AS ENUM('WORKDAY', 'BAMBOOHR', 'ADP', 'CERIDIAN', 'UKG');--> statement-breakpoint
CREATE TYPE "public"."pension_contribution_type" AS ENUM('employee_regular', 'employer_regular', 'employee_voluntary', 'employee_buyback', 'transfer_in', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."pension_member_status" AS ENUM('active', 'deferred', 'retired', 'disabled', 'terminated', 'deceased', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."pension_provider" AS ENUM('OTPP', 'CPP_QPP', 'OMERS', 'HOOPP', 'LAPP', 'PSPP', 'BCMPP', 'SHEPP', 'CSSB', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."attendee_response" AS ENUM('accepted', 'declined', 'tentative', 'needs_action', 'delegated');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_status" AS ENUM('confirmed', 'tentative', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('OUTLOOK', 'GOOGLE', 'APPLE', 'CALDAV', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_type" AS ENUM('meeting', 'bargaining_session', 'grievance_hearing', 'arbitration', 'steward_training', 'membership_meeting', 'strike_vote', 'ratification_vote', 'executive_board', 'committee', 'social_event', 'deadline', 'other');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'anthropic', 'google', 'internal');--> statement-breakpoint
CREATE TYPE "public"."chat_session_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."knowledge_document_type" AS ENUM('collective_agreement', 'union_policy', 'labor_law', 'precedent', 'faq', 'guide', 'other');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system', 'function');--> statement-breakpoint
CREATE TYPE "public"."ai_complexity" AS ENUM('routine', 'moderate', 'complex', 'unprecedented');--> statement-breakpoint
CREATE TYPE "public"."ai_triage_status" AS ENUM('pending', 'accepted', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."clause_reasoning_status" AS ENUM('suggested', 'accepted', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."employer_risk_band" AS ENUM('low', 'moderate', 'elevated', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."copilot_action_type" AS ENUM('timeline_summary', 'suggest_action', 'draft_response', 'explain_clause', 'risk_brief', 'custom_query');--> statement-breakpoint
CREATE TYPE "public"."copilot_outcome" AS ENUM('accepted', 'edited', 'rejected', 'pending');--> statement-breakpoint
CREATE TYPE "public"."insight_report_type" AS ENUM('trend_forecast', 'employer_hotspots', 'steward_capacity', 'arbitration_escalation', 'executive_summary');--> statement-breakpoint
CREATE TYPE "public"."insight_timeframe" AS ENUM('30d', '60d', '90d', '6m', '12m');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('claims', 'members', 'financial', 'compliance', 'performance', 'custom');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('pdf', 'excel', 'csv', 'json', 'html');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('custom', 'template', 'system', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."schedule_frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."alert_action_type" AS ENUM('send_email', 'send_sms', 'send_push_notification', 'create_task', 'update_record', 'trigger_webhook', 'escalate', 'run_script', 'send_slack_message');--> statement-breakpoint
CREATE TYPE "public"."alert_condition_operator" AS ENUM('equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in', 'is_null', 'is_not_null', 'between', 'regex_match');--> statement-breakpoint
CREATE TYPE "public"."alert_execution_status" AS ENUM('pending', 'running', 'success', 'failed', 'skipped', 'rate_limited');--> statement-breakpoint
CREATE TYPE "public"."alert_frequency" AS ENUM('once', 'every_occurrence', 'daily_digest', 'hourly_digest', 'rate_limited');--> statement-breakpoint
CREATE TYPE "public"."alert_trigger_type" AS ENUM('schedule', 'event', 'threshold', 'manual');--> statement-breakpoint
CREATE TYPE "public"."escalation_status" AS ENUM('pending', 'in_progress', 'escalated', 'resolved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."workflow_action_type" AS ENUM('send_notification', 'update_field', 'create_record', 'delete_record', 'call_api', 'run_query', 'wait_for_duration', 'wait_for_condition', 'branch_condition', 'loop', 'send_webhook');--> statement-breakpoint
CREATE TYPE "public"."workflow_execution_status" AS ENUM('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."workflow_trigger_type" AS ENUM('manual', 'schedule', 'record_created', 'record_updated', 'record_deleted', 'field_changed', 'status_changed', 'deadline_approaching', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."award_kind" AS ENUM('milestone', 'peer', 'admin', 'automated');--> statement-breakpoint
CREATE TYPE "public"."budget_period" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."budget_scope_type" AS ENUM('org', 'local', 'department', 'manager');--> statement-breakpoint
CREATE TYPE "public"."program_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."redemption_provider" AS ENUM('shopify');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('initiated', 'pending_payment', 'ordered', 'fulfilled', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."wallet_event_type" AS ENUM('earn', 'spend', 'expire', 'revoke', 'adjust', 'refund');--> statement-breakpoint
CREATE TYPE "public"."wallet_source_type" AS ENUM('award', 'redemption', 'admin_adjustment', 'system');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('shopify');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'sync', 'approve', 'reject', 'void', 'reverse');--> statement-breakpoint
CREATE TYPE "public"."erp_system" AS ENUM('quickbooks_online', 'sage_intacct', 'xero', 'sap_business_one', 'microsoft_dynamics', 'oracle_netsuite', 'custom');--> statement-breakpoint
CREATE TYPE "public"."sync_direction" AS ENUM('push', 'pull', 'bidirectional');--> statement-breakpoint
CREATE TYPE "public"."clc_sync_type" AS ENUM('full_sync', 'incremental_sync', 'remittance_sync', 'member_update', 'wage_update', 'dispute_update');--> statement-breakpoint
CREATE TYPE "public"."clc_webhook_status" AS ENUM('received', 'processing', 'processed', 'failed', 'skipped', 'manual_review');--> statement-breakpoint
CREATE TYPE "public"."address_status" AS ENUM('active', 'inactive', 'unverified', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."address_type" AS ENUM('mailing', 'residential', 'business', 'billing', 'shipping', 'temporary');--> statement-breakpoint
CREATE TYPE "public"."engagement_type" AS ENUM('like', 'comment', 'share', 'retweet', 'reply', 'reaction', 'mention', 'tag');--> statement-breakpoint
CREATE TYPE "public"."social_account_status" AS ENUM('active', 'expired', 'disconnected', 'rate_limited', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."social_post_status" AS ENUM('draft', 'scheduled', 'published', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."social_post_type" AS ENUM('text', 'image', 'video', 'link', 'carousel', 'story', 'reel');--> statement-breakpoint
CREATE TYPE "public"."a11y_issue_severity" AS ENUM('critical', 'serious', 'moderate', 'minor');--> statement-breakpoint
CREATE TYPE "public"."a11y_issue_status" AS ENUM('open', 'in_progress', 'resolved', 'wont_fix', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."audit_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wcag_level" AS ENUM('A', 'AA', 'AAA');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('bug_report', 'feature_request', 'technical_support', 'account_issue', 'billing_question', 'data_issue', 'performance', 'security_concern', 'training_request', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."ticket_source" AS ENUM('email', 'web_form', 'phone', 'chat', 'internal', 'api');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('workday', 'bamboohr', 'adp', 'ceridian_dayforce', 'ukg_pro', 'quickbooks', 'xero', 'sage_intacct', 'freshbooks', 'wave', 'sunlife', 'manulife', 'blue_cross', 'green_shield', 'canada_life', 'otpp', 'cpp_qpp', 'provincial_pension', 'linkedin_learning', 'udemy', 'coursera', 'slack', 'microsoft_teams', 'sharepoint', 'google_drive', 'dropbox', 'custom');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('hris', 'accounting', 'insurance', 'pension', 'lms', 'communication', 'document_management', 'calendar', 'social_media', 'payment');--> statement-breakpoint
CREATE TYPE "public"."sync_type" AS ENUM('full', 'incremental', 'real_time');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processing', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."federation_campaign_type" AS ENUM('organizing', 'political', 'legislative', 'public_awareness', 'solidarity', 'strike_support', 'health_safety', 'equity');--> statement-breakpoint
CREATE TYPE "public"."federation_communication_type" AS ENUM('announcement', 'alert', 'newsletter', 'bulletin', 'press_release', 'internal_memo', 'survey', 'event_notice');--> statement-breakpoint
CREATE TYPE "public"."federation_meeting_type" AS ENUM('convention', 'executive_meeting', 'general_meeting', 'committee_meeting', 'emergency_meeting', 'workshop', 'conference', 'webinar');--> statement-breakpoint
CREATE TYPE "public"."federation_membership_status" AS ENUM('active', 'pending', 'suspended', 'withdrawn', 'expelled', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."federation_resource_type" AS ENUM('template', 'toolkit', 'policy', 'training', 'research', 'best_practice', 'legal', 'organizing');--> statement-breakpoint
CREATE TYPE "public"."federation_type" AS ENUM('provincial', 'regional', 'sectoral', 'international');--> statement-breakpoint
CREATE TYPE "public"."ca_jurisdiction" AS ENUM('federal', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT');--> statement-breakpoint
CREATE TYPE "public"."labour_sector" AS ENUM('healthcare', 'education', 'public_service', 'trades', 'manufacturing', 'transportation', 'retail', 'hospitality', 'technology', 'construction', 'utilities', 'telecommunications', 'financial_services', 'agriculture', 'arts_culture', 'other');--> statement-breakpoint
CREATE TYPE "public"."organization_relationship_type" AS ENUM('affiliate', 'federation', 'local', 'chapter', 'region', 'district', 'joint_council', 'merged_from', 'split_from');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'inactive', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('platform', 'congress', 'federation', 'union', 'local', 'region', 'district');--> statement-breakpoint
CREATE TYPE "public"."committee_member_role" AS ENUM('chair', 'vice_chair', 'secretary', 'treasurer', 'member', 'alternate', 'advisor', 'ex_officio');--> statement-breakpoint
CREATE TYPE "public"."committee_type" AS ENUM('bargaining', 'grievance', 'health_safety', 'political_action', 'equity', 'education', 'organizing', 'steward', 'executive', 'finance', 'communications', 'social', 'pension_benefits', 'other');--> statement-breakpoint
CREATE TYPE "public"."employer_status" AS ENUM('active', 'inactive', 'contract_expired', 'in_bargaining', 'dispute', 'archived');--> statement-breakpoint
CREATE TYPE "public"."employer_type" AS ENUM('private', 'public', 'non_profit', 'crown_corporation', 'municipal', 'provincial', 'federal', 'educational', 'healthcare');--> statement-breakpoint
CREATE TYPE "public"."steward_type" AS ENUM('chief_steward', 'steward', 'alternate_steward', 'health_safety_rep');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('active', 'under_certification', 'decertified', 'merged', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('full_time', 'part_time', 'casual', 'mixed', 'craft', 'industrial', 'professional');--> statement-breakpoint
CREATE TYPE "public"."worksite_status" AS ENUM('active', 'temporarily_closed', 'permanently_closed', 'seasonal', 'archived');--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"description" text,
	"type" "account_type" NOT NULL,
	"sub_type" varchar(100),
	"parent_account_id" uuid,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"normal_balance" varchar(10),
	"is_sub_account" boolean DEFAULT false,
	"allow_transactions" boolean DEFAULT true,
	"require_cost_center" boolean DEFAULT false,
	"require_department" boolean DEFAULT false,
	"require_approval" boolean DEFAULT false,
	"require_invoice" boolean DEFAULT false,
	"is_reconciled_daily" boolean DEFAULT false,
	"last_reconciled_at" timestamp,
	"last_reconciled_balance" numeric(19, 2),
	"gl_code" varchar(50),
	"sap_code" varchar(50),
	"quickbooks_code" varchar(50),
	"opening_balance" numeric(19, 2) DEFAULT '0',
	"opening_balance_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "corrective_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"action_number" varchar(50) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" uuid,
	"source_reference" varchar(100),
	"action_type" varchar(50) NOT NULL,
	"priority" "corrective_action_priority" DEFAULT 'normal' NOT NULL,
	"status" "corrective_action_status" DEFAULT 'open' NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"root_cause" text,
	"problem_statement" text,
	"immediate_actions" text,
	"proposed_action" text NOT NULL,
	"implementation_plan" text,
	"required_resources" text,
	"estimated_cost" numeric(12, 2),
	"actual_cost" numeric(12, 2),
	"assigned_to_id" uuid,
	"assigned_to_name" varchar(255),
	"assigned_date" timestamp with time zone,
	"responsible_person_id" uuid,
	"responsible_person_name" varchar(255),
	"identified_date" date NOT NULL,
	"due_date" date NOT NULL,
	"target_completion_date" date,
	"actual_completion_date" date,
	"verification_date" date,
	"closed_date" date,
	"progress_percentage" integer DEFAULT 0,
	"progress_notes" text,
	"milestones_updates" jsonb,
	"completion_notes" text,
	"completion_evidence" text,
	"verified_by_id" uuid,
	"verified_by_name" varchar(255),
	"verification_method" varchar(255),
	"verification_notes" text,
	"verification_passed" boolean,
	"effectiveness_review_required" boolean DEFAULT false,
	"effectiveness_review_date" date,
	"effectiveness_reviewed_by" varchar(255),
	"effectiveness_rating" varchar(50),
	"effectiveness_notes" text,
	"preventive_measures" text,
	"system_changes_required" boolean DEFAULT false,
	"system_changes_description" text,
	"document_ids" jsonb,
	"notifications_sent" jsonb,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_date" timestamp with time zone,
	"metadata" jsonb,
	"tags" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "corrective_actions_action_number_unique" UNIQUE("action_number")
);
--> statement-breakpoint
CREATE TABLE "employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"industry" varchar(255),
	"contact_email" varchar(320),
	"contact_phone" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_account_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"chart_of_accounts_id" uuid NOT NULL,
	"local_account_type" varchar(100) NOT NULL,
	"local_transaction_type" varchar(100) NOT NULL,
	"gl_account_number" varchar(50) NOT NULL,
	"gl_department" varchar(50),
	"gl_cost_center" varchar(50),
	"erp_system_code" varchar(50),
	"erp_account_code" varchar(100),
	"debit_account" varchar(50),
	"credit_account" varchar(50),
	"is_active" boolean DEFAULT true,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "hazard_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_number" varchar(50) NOT NULL,
	"hazard_category" "hazard_category" NOT NULL,
	"hazard_level" "hazard_level" NOT NULL,
	"reported_date" timestamp with time zone DEFAULT now() NOT NULL,
	"hazard_date" timestamp with time zone,
	"workplace_id" uuid,
	"workplace_name" varchar(255),
	"department" varchar(255),
	"specific_location" text NOT NULL,
	"reported_by_id" uuid,
	"reported_by_name" varchar(255),
	"is_anonymous" boolean DEFAULT false,
	"reporter_contact_info" varchar(255),
	"hazard_description" text NOT NULL,
	"who_is_at_risk" text,
	"potential_consequences" text,
	"existing_controls" text,
	"suggested_corrections" text,
	"risk_assessment_completed" boolean DEFAULT false,
	"risk_assessment_date" timestamp with time zone,
	"risk_assessor_id" uuid,
	"risk_assessor_name" varchar(255),
	"likelihood_score" integer,
	"severity_score" integer,
	"risk_score" integer,
	"status" varchar(50) DEFAULT 'reported' NOT NULL,
	"assigned_to_id" uuid,
	"assigned_to_name" varchar(255),
	"assigned_date" timestamp with time zone,
	"resolution_date" timestamp with time zone,
	"resolution_description" text,
	"resolution_cost" numeric(12, 2),
	"verified_by_id" uuid,
	"verified_by_name" varchar(255),
	"verified_date" timestamp with time zone,
	"verification_notes" text,
	"closed_date" timestamp with time zone,
	"corrective_action_required" boolean DEFAULT true,
	"corrective_action_ids" jsonb,
	"document_ids" jsonb,
	"photo_urls" jsonb,
	"metadata" jsonb,
	"tags" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "hazard_reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
CREATE TABLE "injury_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"log_number" varchar(50) NOT NULL,
	"incident_id" uuid,
	"claim_id" uuid,
	"worker_id" uuid NOT NULL,
	"worker_name" varchar(255) NOT NULL,
	"worker_employee_id" varchar(100),
	"worker_date_of_birth" date,
	"worker_job_title" varchar(255),
	"worker_department" varchar(255),
	"worker_hire_date" date,
	"injury_date" date NOT NULL,
	"injury_time" varchar(20),
	"reported_date" date NOT NULL,
	"body_parts_affected" jsonb,
	"injury_types" jsonb,
	"injury_severity" "incident_severity" NOT NULL,
	"first_aid_provided" boolean DEFAULT false,
	"first_aid_description" text,
	"medical_attention_required" boolean DEFAULT false,
	"treated_at_location" varchar(255),
	"treating_physician" varchar(255),
	"hospital_name" varchar(255),
	"hospitalized" boolean DEFAULT false,
	"hospitalization_days" integer,
	"lost_time_injury" boolean DEFAULT false,
	"first_day_missed" date,
	"return_to_work_date" date,
	"days_away" integer,
	"days_restricted" integer,
	"days_transferred" integer,
	"modified_duties_assigned" boolean DEFAULT false,
	"modified_duties_description" text,
	"permanent_impairment" boolean DEFAULT false,
	"impairment_description" text,
	"impairment_rating_percentage" numeric(5, 2),
	"wsib_claim_filed" boolean DEFAULT false,
	"wsib_claim_number" varchar(100),
	"wsib_claim_date" date,
	"wsib_claim_status" varchar(100),
	"wsib_decision" varchar(255),
	"wsib_decision_date" date,
	"benefits_approved" boolean DEFAULT false,
	"benefit_start_date" date,
	"benefit_amount" numeric(12, 2),
	"medical_costs" numeric(12, 2),
	"wage_loss_costs" numeric(12, 2),
	"rehabilitation_costs" numeric(12, 2),
	"total_costs" numeric(12, 2),
	"osha_recordable" boolean DEFAULT false,
	"osha_form_number" varchar(50),
	"osha_classification" varchar(100),
	"provincial_report_required" boolean DEFAULT false,
	"provincial_report_filed" boolean DEFAULT false,
	"provincial_report_number" varchar(100),
	"document_ids" jsonb,
	"medical_records" jsonb,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"closed_date" date,
	"closure_notes" text,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "injury_logs_log_number_unique" UNIQUE("log_number")
);
--> statement-breakpoint
CREATE TABLE "ml_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prediction_type" varchar(50) NOT NULL,
	"prediction_date" timestamp NOT NULL,
	"predicted_value" numeric NOT NULL,
	"lower_bound" numeric,
	"upper_bound" numeric,
	"confidence" numeric,
	"horizon" integer,
	"granularity" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_prediction" UNIQUE("organization_id","prediction_type","prediction_date","horizon")
);
--> statement-breakpoint
CREATE TABLE "ppe_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_number" varchar(50) NOT NULL,
	"serial_number" varchar(100),
	"ppe_type" "ppe_type" NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"description" text,
	"manufacturer" varchar(255),
	"model" varchar(255),
	"size" varchar(50),
	"status" "ppe_status" DEFAULT 'in_stock' NOT NULL,
	"storage_location" varchar(255),
	"quantity_in_stock" integer DEFAULT 0,
	"quantity_issued" integer DEFAULT 0,
	"reorder_level" integer,
	"reorder_quantity" integer,
	"issued_to_id" uuid,
	"issued_to_name" varchar(255),
	"issued_date" date,
	"issued_by_id" uuid,
	"issued_by_name" varchar(255),
	"returned_date" date,
	"return_condition" varchar(100),
	"purchase_date" date,
	"purchase_cost" numeric(10, 2),
	"supplier" varchar(255),
	"purchase_order_number" varchar(100),
	"expiry_date" date,
	"inspection_required" boolean DEFAULT false,
	"last_inspection_date" date,
	"next_inspection_date" date,
	"inspection_frequency_days" integer,
	"maintenance_required" boolean DEFAULT false,
	"last_maintenance_date" date,
	"next_maintenance_date" date,
	"maintenance_notes" text,
	"certification_standard" varchar(255),
	"certification_number" varchar(100),
	"csa_approved" boolean DEFAULT false,
	"ansi_approved" boolean DEFAULT false,
	"disposal_date" date,
	"disposal_reason" varchar(255),
	"disposal_method" varchar(255),
	"document_ids" jsonb,
	"manual_url" text,
	"certification_url" text,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "ppe_equipment_item_number_unique" UNIQUE("item_number")
);
--> statement-breakpoint
CREATE TABLE "safety_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"audit_number" varchar(50) NOT NULL,
	"audit_type" "audit_type" NOT NULL,
	"status" "audit_status" DEFAULT 'planned' NOT NULL,
	"planned_date" date,
	"scheduled_start_date" date NOT NULL,
	"scheduled_end_date" date,
	"actual_start_date" date,
	"actual_end_date" date,
	"audit_scope" text NOT NULL,
	"audit_objectives" text,
	"standards_referenced" jsonb,
	"workplace_ids" jsonb,
	"workplace_names" jsonb,
	"departments_audited" jsonb,
	"lead_auditor_id" uuid,
	"lead_auditor_name" varchar(255),
	"lead_auditor_certification" varchar(255),
	"auditor_ids" jsonb,
	"auditor_names" jsonb,
	"is_external_audit" boolean DEFAULT false,
	"auditing_organization" varchar(255),
	"audit_plan" text,
	"documents_reviewed" jsonb,
	"areas_inspected" jsonb,
	"staff_interviewed" jsonb,
	"total_findings" integer DEFAULT 0,
	"critical_findings" integer DEFAULT 0,
	"major_findings" integer DEFAULT 0,
	"minor_findings" integer DEFAULT 0,
	"observations" integer DEFAULT 0,
	"findings_detail" jsonb,
	"overall_compliance_rating" varchar(50),
	"compliance_percentage" numeric(5, 2),
	"strengths" text,
	"weaknesses" text,
	"opportunities_for_improvement" text,
	"executive_summary" text,
	"audit_report" text,
	"report_url" text,
	"report_issue_date" date,
	"corrective_actions_required" boolean DEFAULT false,
	"corrective_action_plan" text,
	"corrective_action_ids" jsonb,
	"follow_up_audit_required" boolean DEFAULT false,
	"follow_up_audit_date" date,
	"follow_up_completed" boolean DEFAULT false,
	"certification_awarded" boolean DEFAULT false,
	"certification_type" varchar(255),
	"certificate_number" varchar(100),
	"certification_valid_from" date,
	"certification_valid_until" date,
	"document_ids" jsonb,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "safety_audits_audit_number_unique" UNIQUE("audit_number")
);
--> statement-breakpoint
CREATE TABLE "safety_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"certification_number" varchar(50) NOT NULL,
	"holder_id" uuid NOT NULL,
	"holder_name" varchar(255) NOT NULL,
	"holder_employee_id" varchar(100),
	"holder_job_title" varchar(255),
	"holder_department" varchar(255),
	"certification_type" "safety_certification_type" NOT NULL,
	"certification_name" varchar(300) NOT NULL,
	"certification_level" varchar(100),
	"issuing_organization" varchar(255) NOT NULL,
	"issuing_body" varchar(255),
	"certification_standard" varchar(255),
	"certificate_number" varchar(100),
	"issue_date" date NOT NULL,
	"expiry_date" date,
	"validity_period_years" integer,
	"status" "certification_status" DEFAULT 'active' NOT NULL,
	"renewal_required" boolean DEFAULT false,
	"renewal_date" date,
	"renewal_in_progress" boolean DEFAULT false,
	"renewal_application_date" date,
	"reminder_sent_date" date,
	"reminder_frequency_days" integer DEFAULT 30,
	"training_record_id" uuid,
	"course_id" uuid,
	"training_completed_date" date,
	"examination_required" boolean DEFAULT false,
	"examination_date" date,
	"examination_score" numeric(5, 2),
	"examination_passed" boolean,
	"competency_assessed" boolean DEFAULT false,
	"competency_level" varchar(50),
	"competency_assessment_date" date,
	"authorized_activities" jsonb,
	"restrictions" text,
	"regulatory_requirement" boolean DEFAULT false,
	"legislation_reference" varchar(500),
	"compliance_notes" text,
	"suspended_date" date,
	"suspension_reason" text,
	"revoked_date" date,
	"revocation_reason" text,
	"reinstatement_date" date,
	"reinstatement_conditions" text,
	"document_ids" jsonb,
	"certificate_url" text,
	"continuing_education_required" boolean DEFAULT false,
	"continuing_education_hours_required" integer,
	"continuing_education_hours_completed" integer,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "safety_certifications_certification_number_unique" UNIQUE("certification_number")
);
--> statement-breakpoint
CREATE TABLE "safety_committee_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"meeting_number" varchar(50) NOT NULL,
	"meeting_type" "meeting_type" DEFAULT 'regular' NOT NULL,
	"meeting_date" timestamp with time zone NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"duration_minutes" integer,
	"location" varchar(255),
	"is_virtual" boolean DEFAULT false,
	"meeting_link" text,
	"committee_name" varchar(255),
	"chairperson_id" uuid,
	"chairperson_name" varchar(255),
	"secretary_id" uuid,
	"secretary_name" varchar(255),
	"member_ids" jsonb,
	"member_names" jsonb,
	"attendee_ids" jsonb,
	"attendee_names" jsonb,
	"absent_ids" jsonb,
	"absent_names" jsonb,
	"guest_ids" jsonb,
	"guest_names" jsonb,
	"quorum_met" boolean DEFAULT true,
	"attendance_count" integer,
	"agenda" text,
	"agenda_items" jsonb,
	"minutes" text,
	"discussion_summary" text,
	"key_points" jsonb,
	"previous_minutes_approved" boolean,
	"action_items_reviewed" boolean,
	"action_items_from_previous" jsonb,
	"incidents_reviewed" jsonb,
	"hazards_reviewed" jsonb,
	"inspections_reviewed" jsonb,
	"action_items_created" jsonb,
	"recommendations" text,
	"training_needs" text,
	"policy_reviews" text,
	"next_meeting_date" timestamp with time zone,
	"next_meeting_agenda" text,
	"document_ids" jsonb,
	"minutes_document_id" uuid,
	"recording_url" text,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"minutes_approved" boolean DEFAULT false,
	"minutes_approved_date" timestamp with time zone,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "safety_committee_meetings_meeting_number_unique" UNIQUE("meeting_number")
);
--> statement-breakpoint
CREATE TABLE "safety_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inspection_number" varchar(50) NOT NULL,
	"inspection_type" "inspection_type" NOT NULL,
	"status" "inspection_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"started_date" timestamp with time zone,
	"completed_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"workplace_id" uuid,
	"workplace_name" varchar(255),
	"areas_inspected" jsonb,
	"specific_location" text,
	"lead_inspector_id" uuid,
	"lead_inspector_name" varchar(255),
	"inspector_ids" jsonb,
	"inspector_names" jsonb,
	"inspection_scope" text,
	"checklist_used" varchar(255),
	"checklist_items" jsonb,
	"total_items_checked" integer,
	"items_passed" integer,
	"items_failed" integer,
	"items_requiring_attention" integer,
	"hazards_identified" integer DEFAULT 0,
	"critical_hazards" integer DEFAULT 0,
	"overall_rating" varchar(50),
	"score_percentage" numeric(5, 2),
	"findings" text,
	"observations" text,
	"positive_findings" text,
	"areas_of_concern" text,
	"recommendations" text,
	"immediate_action_required" boolean DEFAULT false,
	"corrective_actions_required" boolean DEFAULT false,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp with time zone,
	"follow_up_completed" boolean DEFAULT false,
	"follow_up_notes" text,
	"document_ids" jsonb,
	"photo_urls" jsonb,
	"report_url" text,
	"regulatory_requirement" boolean DEFAULT false,
	"regulatory_agency" varchar(255),
	"regulatory_reference" varchar(255),
	"metadata" jsonb,
	"tags" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "safety_inspections_inspection_number_unique" UNIQUE("inspection_number")
);
--> statement-breakpoint
CREATE TABLE "safety_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"policy_number" varchar(50) NOT NULL,
	"policy_title" varchar(500) NOT NULL,
	"policy_category" varchar(100) NOT NULL,
	"policy_type" varchar(100),
	"policy_description" text,
	"purpose" text,
	"scope" text,
	"applicability" text,
	"responsibilities" text,
	"procedures" text,
	"definitions" jsonb,
	"references" text,
	"document_id" uuid,
	"document_url" text,
	"version" varchar(20) DEFAULT '1.0' NOT NULL,
	"revision_history" jsonb,
	"effective_date" date NOT NULL,
	"review_date" date,
	"next_review_date" date,
	"expiry_date" date,
	"review_frequency_months" integer DEFAULT 12,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"drafted_by_id" uuid,
	"drafted_by_name" varchar(255),
	"drafted_date" date,
	"reviewed_by_id" uuid,
	"reviewed_by_name" varchar(255),
	"reviewed_date" date,
	"review_comments" text,
	"approved_by_id" uuid,
	"approved_by_name" varchar(255),
	"approval_date" date,
	"approval_comments" text,
	"regulatory_requirement" boolean DEFAULT false,
	"regulatory_reference" varchar(500),
	"legislation_citation" text,
	"training_required" boolean DEFAULT false,
	"training_course_ids" jsonb,
	"communication_plan" text,
	"affected_employees" jsonb,
	"affected_departments" jsonb,
	"acknowledgement_required" boolean DEFAULT false,
	"acknowledged_by" jsonb,
	"related_policy_ids" jsonb,
	"superseded_policy_ids" jsonb,
	"metadata" jsonb,
	"tags" jsonb,
	"keywords" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "safety_policies_policy_number_unique" UNIQUE("policy_number")
);
--> statement-breakpoint
CREATE TABLE "safety_training_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"record_number" varchar(50) NOT NULL,
	"course_id" uuid,
	"course_name" varchar(300) NOT NULL,
	"course_code" varchar(50),
	"course_category" varchar(100),
	"training_provider" varchar(255),
	"trainee_id" uuid NOT NULL,
	"trainee_name" varchar(255) NOT NULL,
	"trainee_employee_id" varchar(100),
	"trainee_job_title" varchar(255),
	"trainee_department" varchar(255),
	"training_date" date NOT NULL,
	"completion_date" date,
	"expiry_date" date,
	"validity_period_months" integer,
	"status" "training_status" DEFAULT 'scheduled' NOT NULL,
	"instructor_id" uuid,
	"instructor_name" varchar(255),
	"instructor_certification" varchar(255),
	"delivery_method" varchar(50),
	"training_location" varchar(255),
	"duration_hours" numeric(5, 2),
	"assessment_required" boolean DEFAULT false,
	"assessment_score" numeric(5, 2),
	"passing_score" numeric(5, 2),
	"passed" boolean,
	"certificate_issued" boolean DEFAULT false,
	"certificate_number" varchar(100),
	"certificate_url" text,
	"regulatory_requirement" boolean DEFAULT false,
	"regulatory_body" varchar(255),
	"compliance_reference" varchar(255),
	"is_mandatory" boolean DEFAULT false,
	"renewal_required" boolean DEFAULT false,
	"renewal_date" date,
	"renewal_reminder_sent" boolean DEFAULT false,
	"document_ids" jsonb,
	"training_cost" numeric(10, 2),
	"cost_covered_by_employer" boolean,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "safety_training_records_record_number_unique" UNIQUE("record_number")
);
--> statement-breakpoint
CREATE TABLE "steward_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"steward_id" text NOT NULL,
	"steward_type" "steward_type" NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"unit_id" uuid,
	"worksite_id" uuid,
	"department" varchar(255),
	"shift" varchar(100),
	"floor" varchar(100),
	"area" varchar(255),
	"start_date" date NOT NULL,
	"end_date" date,
	"is_interim" boolean DEFAULT false,
	"appointed_by" text,
	"elected_date" date,
	"certification_date" date,
	"responsibility_areas" jsonb,
	"members_covered" integer,
	"training_completed" boolean DEFAULT false,
	"training_completion_date" date,
	"certification_expiry" date,
	"work_phone" varchar(50),
	"personal_phone" varchar(50),
	"preferred_contact_method" varchar(50),
	"availability_notes" text,
	"notes" text,
	"grievance_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "workplace_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"incident_number" varchar(50) NOT NULL,
	"claim_id" uuid,
	"incident_type" "incident_type" NOT NULL,
	"severity" "incident_severity" NOT NULL,
	"incident_date" timestamp with time zone NOT NULL,
	"reported_date" timestamp with time zone NOT NULL,
	"location_description" text NOT NULL,
	"workplace_id" uuid,
	"workplace_name" varchar(255),
	"department_name" varchar(255),
	"injured_person_id" uuid,
	"injured_person_name" varchar(255),
	"injured_person_job_title" varchar(255),
	"injured_person_employee_id" varchar(100),
	"body_part_affected" "body_part",
	"injury_nature" "injury_nature",
	"treatment_provided" text,
	"treatment_location" varchar(255),
	"hospitalized_days" integer,
	"lost_time_days" integer,
	"restricted_work_days" integer,
	"description" text NOT NULL,
	"what_happened" text,
	"task_being_performed" text,
	"equipment_involved" text,
	"materials_involved" text,
	"lighting_condition" varchar(100),
	"weather_condition" varchar(100),
	"temperature_condition" varchar(100),
	"witnesses_present" boolean DEFAULT false,
	"witness_names" jsonb,
	"witness_statements" jsonb,
	"reported_by_id" uuid,
	"reported_by_name" varchar(255),
	"reported_by_job_title" varchar(255),
	"supervisor_notified_id" uuid,
	"supervisor_notified_name" varchar(255),
	"supervisor_notified_date" timestamp with time zone,
	"investigation_required" boolean DEFAULT true,
	"investigation_start_date" timestamp with time zone,
	"investigation_completed_date" timestamp with time zone,
	"investigator_id" uuid,
	"investigator_name" varchar(255),
	"investigation_report" text,
	"root_cause_analysis" text,
	"contributing_factors" jsonb,
	"immediate_actions_taken" text,
	"corrective_actions_required" boolean DEFAULT false,
	"corrective_actions_summary" text,
	"reportable_to_authority" boolean DEFAULT false,
	"authority_notified" boolean DEFAULT false,
	"authority_name" varchar(255),
	"authority_report_number" varchar(100),
	"authority_report_date" timestamp with time zone,
	"wsib_claim_number" varchar(100),
	"wsib_claim_status" varchar(50),
	"wsib_claim_amount" numeric(12, 2),
	"document_ids" jsonb,
	"photo_urls" jsonb,
	"video_urls" jsonb,
	"status" varchar(50) DEFAULT 'reported' NOT NULL,
	"closed_date" timestamp with time zone,
	"closure_notes" text,
	"preventability_assessment" text,
	"lessons_learned" text,
	"training_recommended" boolean DEFAULT false,
	"training_recommendations" text,
	"metadata" jsonb,
	"tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "workplace_incidents_incident_number_unique" UNIQUE("incident_number")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email" text,
	"membership" "membership" DEFAULT 'free' NOT NULL,
	"payment_provider" "payment_provider" DEFAULT 'whop',
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"whop_user_id" text,
	"whop_membership_id" text,
	"plan_duration" text,
	"billing_cycle_start" timestamp,
	"billing_cycle_end" timestamp,
	"next_credit_renewal" timestamp,
	"usage_credits" integer DEFAULT 0,
	"used_credits" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pending_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text,
	"membership" "membership" DEFAULT 'pro' NOT NULL,
	"payment_provider" "payment_provider" DEFAULT 'whop',
	"whop_user_id" text,
	"whop_membership_id" text,
	"plan_duration" text,
	"billing_cycle_start" timestamp,
	"billing_cycle_end" timestamp,
	"next_credit_renewal" timestamp,
	"usage_credits" integer DEFAULT 0,
	"used_credits" integer DEFAULT 0,
	"claimed" boolean DEFAULT false,
	"claimed_by_user_id" text,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_management"."oauth_providers" (
	"provider_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"provider_name" varchar(50) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"provider_data" jsonb DEFAULT '{}'::jsonb,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_management"."organization_users" (
	"organization_user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"invited_by" varchar(255),
	"invited_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"last_access_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_management"."user_sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"organization_id" uuid,
	"session_token" text NOT NULL,
	"refresh_token" text,
	"device_info" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_used_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token"),
	CONSTRAINT "user_sessions_refresh_token_unique" UNIQUE("refresh_token"),
	CONSTRAINT "valid_expiry" CHECK ("user_management"."user_sessions"."expires_at" > "user_management"."user_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "user_management"."users" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"display_name" varchar(200),
	"avatar_url" text,
	"phone" varchar(20),
	"phone_verified" boolean DEFAULT false,
	"phone_verified_at" timestamp with time zone,
	"timezone" varchar(50) DEFAULT 'UTC',
	"locale" varchar(10) DEFAULT 'en-US',
	"is_active" boolean DEFAULT true,
	"is_system_admin" boolean DEFAULT false,
	"last_login_at" timestamp with time zone,
	"last_login_ip" varchar(45),
	"password_changed_at" timestamp with time zone,
	"failed_login_attempts" integer DEFAULT 0,
	"account_locked_until" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_secret" text,
	"two_factor_backup_codes" text[],
	"encrypted_sin" text,
	"encrypted_ssn" text,
	"encrypted_bank_account" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "valid_email" CHECK ("user_management"."users"."email" ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
	CONSTRAINT "valid_phone" CHECK ("user_management"."users"."phone" IS NULL OR "user_management"."users"."phone" ~ '^\+?[1-9]\d{1,14}$')
);
--> statement-breakpoint
CREATE TABLE "employment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_employment_id" uuid,
	"change_type" varchar(100) NOT NULL,
	"effective_date" date NOT NULL,
	"previous_values" jsonb,
	"new_values" jsonb,
	"reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "job_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bargaining_unit_id" uuid,
	"job_code" varchar(100) NOT NULL,
	"job_title" varchar(255) NOT NULL,
	"job_family" varchar(255),
	"job_level" integer,
	"minimum_rate" numeric(10, 2),
	"maximum_rate" numeric(10, 2),
	"standard_rate" numeric(10, 2),
	"description" text,
	"requirements" jsonb,
	"is_active" boolean DEFAULT true,
	"effective_date" date,
	"expiry_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "member_employment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"employer_id" uuid,
	"worksite_id" uuid,
	"bargaining_unit_id" uuid,
	"employment_status" "employment_status" DEFAULT 'active' NOT NULL,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"hire_date" date NOT NULL,
	"seniority_date" date NOT NULL,
	"termination_date" date,
	"expected_return_date" date,
	"seniority_years" numeric(10, 2),
	"adjusted_seniority_date" date,
	"seniority_adjustment_reason" text,
	"job_title" varchar(255) NOT NULL,
	"job_code" varchar(100),
	"job_classification" varchar(255),
	"job_level" integer,
	"department" varchar(255),
	"division" varchar(255),
	"pay_frequency" "pay_frequency" DEFAULT 'hourly' NOT NULL,
	"hourly_rate" numeric(10, 2),
	"base_salary" numeric(12, 2),
	"gross_wages" numeric(12, 2),
	"regular_hours_per_week" numeric(5, 2) DEFAULT '40.00',
	"regular_hours_per_period" numeric(7, 2),
	"shift_type" "shift_type",
	"shift_start_time" varchar(10),
	"shift_end_time" varchar(10),
	"operates_weekends" boolean DEFAULT false,
	"operates_24_hours" boolean DEFAULT false,
	"supervisor_name" varchar(255),
	"supervisor_id" uuid,
	"is_probationary" boolean DEFAULT false,
	"probation_end_date" date,
	"checkoff_authorized" boolean DEFAULT true,
	"checkoff_date" date,
	"rand_exempt" boolean DEFAULT false,
	"custom_fields" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "member_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_employment_id" uuid,
	"leave_type" "leave_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"expected_return_date" date,
	"actual_return_date" date,
	"is_approved" boolean DEFAULT false,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"affects_seniority" boolean DEFAULT false,
	"seniority_adjustment_days" integer,
	"affects_dues" boolean DEFAULT true,
	"dues_waiver_approved" boolean DEFAULT false,
	"reason" text,
	"notes" text,
	"documents" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "member_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"filters" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_executed_at" timestamp,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"executed_by" text NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"result_count" integer NOT NULL,
	"execution_time_ms" integer,
	"filters_snapshot" jsonb
);
--> statement-breakpoint
CREATE TABLE "segment_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"segment_id" uuid,
	"exported_by" text NOT NULL,
	"exported_at" timestamp DEFAULT now() NOT NULL,
	"format" text NOT NULL,
	"include_fields" jsonb,
	"member_count" integer NOT NULL,
	"filters_used" jsonb,
	"watermark" text,
	"export_hash" text,
	"purpose" text,
	"approved_by" text,
	"file_url" text,
	"file_size" integer,
	"data_retention_days" integer DEFAULT 90,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "member_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"address_type" varchar(20) DEFAULT 'mailing' NOT NULL,
	"street_address" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"province" varchar(2) NOT NULL,
	"postal_code" varchar(10) NOT NULL,
	"country" varchar(2) DEFAULT 'CA' NOT NULL,
	"is_primary" boolean DEFAULT false,
	"effective_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"region" varchar(255),
	"specialization" varchar(255),
	"active" boolean DEFAULT true NOT NULL,
	"max_caseload" integer DEFAULT 10 NOT NULL,
	"current_caseload" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"deadline_type" varchar(100) NOT NULL,
	"description" varchar(500),
	"due_date" timestamp with time zone NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"extension_granted" boolean DEFAULT false,
	"new_deadline" timestamp with time zone,
	"reminder_days" integer[],
	"reminders_sent" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"document_name" varchar(255) NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"file_path" text NOT NULL,
	"file_size" bigint,
	"mime_type" varchar(100),
	"version" integer DEFAULT 1,
	"parent_document_id" uuid,
	"is_latest_version" boolean DEFAULT true,
	"version_status" "document_version_status" DEFAULT 'draft',
	"description" text,
	"tags" text[],
	"category" varchar(100),
	"is_confidential" boolean DEFAULT false,
	"access_level" varchar(50) DEFAULT 'standard',
	"requires_signature" boolean DEFAULT false,
	"signature_status" varchar(50),
	"signed_by" varchar(255),
	"signed_at" timestamp with time zone,
	"signature_data" jsonb,
	"ocr_text" text,
	"indexed" boolean DEFAULT false,
	"uploaded_by" varchar(255) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now(),
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp with time zone,
	"retention_period_days" integer,
	"archived_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "claim_updates" (
	"update_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"update_type" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"is_internal" boolean DEFAULT false,
	"visibility_scope" "visibility_scope" DEFAULT 'member' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"claim_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_number" varchar(50) NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"is_anonymous" boolean DEFAULT true,
	"claim_type" "claim_type" NOT NULL,
	"status" "claim_status" DEFAULT 'submitted' NOT NULL,
	"priority" "claim_priority" DEFAULT 'medium' NOT NULL,
	"incident_date" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"desired_outcome" text NOT NULL,
	"witnesses_present" boolean DEFAULT false,
	"witness_details" text,
	"previously_reported" boolean DEFAULT false,
	"previous_report_details" text,
	"assigned_to" varchar(255),
	"assigned_at" timestamp with time zone,
	"ai_score" integer,
	"ai_analysis" jsonb,
	"merit_confidence" integer,
	"precedent_match" integer,
	"complexity_score" integer,
	"progress" integer DEFAULT 0,
	"claim_amount" varchar(20),
	"settlement_amount" varchar(20),
	"legal_costs" varchar(20),
	"court_costs" varchar(20),
	"resolution_outcome" varchar(100),
	"filed_date" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"voice_transcriptions" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"closed_at" timestamp with time zone,
	CONSTRAINT "claims_claim_number_unique" UNIQUE("claim_number")
);
--> statement-breakpoint
CREATE TABLE "arbitrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"arbitration_number" varchar(50) NOT NULL,
	"board_name" varchar(255) NOT NULL,
	"board_type" varchar(100) NOT NULL,
	"arbitrator_ids" uuid[],
	"arbitrator_names" varchar(255)[],
	"union_appointee" varchar(255),
	"employer_appointee" varchar(255),
	"chair_appointee" varchar(255),
	"status" "arbitration_status" DEFAULT 'pending' NOT NULL,
	"scheduled_date" timestamp with time zone,
	"location" varchar(500),
	"virtual_meeting_url" varchar(500),
	"submission_deadline" timestamp with time zone,
	"evidence_deadline" timestamp with time zone,
	"reply_deadline" timestamp with time zone,
	"hearing_days" integer[],
	"hearing_dates" timestamp with time zone[],
	"adjourned_to" timestamp with time zone,
	"award_deadline" timestamp with time zone,
	"award_date" timestamp with time zone,
	"award" text,
	"award_summary" text,
	"union_cost_share" integer,
	"employer_cost_share" integer,
	"estimated_cost" integer,
	"actual_cost" integer,
	"submissions" jsonb,
	"exhibits" jsonb,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arbitrations_arbitration_number_unique" UNIQUE("arbitration_number")
);
--> statement-breakpoint
CREATE TABLE "grievance_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"response_number" integer NOT NULL,
	"responding_party" varchar(100) NOT NULL,
	"responder_name" varchar(255),
	"responder_title" varchar(255),
	"response" text NOT NULL,
	"position" text,
	"response_date" timestamp with time zone NOT NULL,
	"received_date" timestamp with time zone,
	"accepted_by_grievant" boolean,
	"accepted_by_employer" boolean,
	"next_deadline" timestamp with time zone,
	"next_step" varchar(100),
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"actor" varchar(255),
	"actor_role" varchar(100),
	"description" text NOT NULL,
	"notes" text,
	"attachments" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_number" varchar(50) NOT NULL,
	"type" "grievance_type" NOT NULL,
	"status" "grievance_status" DEFAULT 'draft' NOT NULL,
	"priority" "grievance_priority" DEFAULT 'medium',
	"step" "grievance_step",
	"grievant_id" uuid,
	"grievant_name" varchar(255),
	"grievant_email" varchar(255),
	"union_rep_id" uuid,
	"employer_rep_id" varchar(255),
	"employer_id" uuid,
	"employer_name" varchar(255),
	"workplace_id" uuid,
	"workplace_name" varchar(255),
	"cba_id" uuid,
	"cba_article" varchar(100),
	"cba_section" varchar(100),
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"background" text,
	"desired_outcome" text,
	"incident_date" timestamp with time zone,
	"filed_date" timestamp with time zone,
	"response_deadline" timestamp with time zone,
	"meeting_date" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"timeline" jsonb,
	"group_grievance_id" uuid,
	"related_grievance_ids" uuid[],
	"attachments" jsonb,
	"is_group_grievance" boolean DEFAULT false,
	"is_arbitration_eligible" boolean DEFAULT false,
	"has_legal_implications" boolean DEFAULT false,
	"is_confidential" boolean DEFAULT false,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"last_updated_by" uuid,
	CONSTRAINT "grievances_grievance_number_unique" UNIQUE("grievance_number")
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"arbitration_id" uuid,
	"settlement_type" "settlement_type" NOT NULL,
	"status" varchar(50) DEFAULT 'proposed' NOT NULL,
	"monetary_amount" integer,
	"monetary_details" text,
	"non_monetary_terms" jsonb,
	"implemented_at" timestamp with time zone,
	"implementation_notes" text,
	"compliance_deadline" timestamp with time zone,
	"compliance_status" varchar(50),
	"compliance_notes" text,
	"approved_by_grievant" boolean,
	"approved_by_employer" boolean,
	"approved_by_union" boolean,
	"approval_dates" timestamp with time zone[],
	"agreement_url" varchar(500),
	"confidentiality" boolean DEFAULT false,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadline_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deadline_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"alert_type" varchar(100) NOT NULL,
	"alert_severity" "alert_severity" NOT NULL,
	"alert_trigger" varchar(100) NOT NULL,
	"recipient_id" varchar(255) NOT NULL,
	"recipient_role" varchar(100),
	"delivery_method" "delivery_method" NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"delivery_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"delivery_error" text,
	"viewed_at" timestamp,
	"acknowledged_at" timestamp,
	"action_taken" varchar(255),
	"action_taken_at" timestamp,
	"subject" varchar(500),
	"message" text,
	"action_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadline_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deadline_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"requested_by" varchar(255) NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"requested_days" integer NOT NULL,
	"request_reason" text NOT NULL,
	"status" "extension_status" DEFAULT 'pending' NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"approved_by" varchar(255),
	"approval_decision_at" timestamp,
	"approval_notes" text,
	"new_deadline" timestamp,
	"days_granted" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadline_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"rule_code" varchar(100) NOT NULL,
	"description" text,
	"claim_type" varchar(100),
	"priority_level" varchar(50),
	"step_number" integer,
	"days_from_event" integer NOT NULL,
	"event_type" varchar(100) DEFAULT 'claim_filed' NOT NULL,
	"business_days_only" boolean DEFAULT true NOT NULL,
	"allows_extension" boolean DEFAULT true NOT NULL,
	"max_extension_days" integer DEFAULT 30 NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"escalate_to_role" varchar(100),
	"escalation_delay_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system_rule" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"deadline_rule_id" uuid,
	"deadline_name" varchar(255) NOT NULL,
	"deadline_type" varchar(100) NOT NULL,
	"event_date" timestamp NOT NULL,
	"original_deadline" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"completed_at" timestamp,
	"status" "deadline_status" DEFAULT 'pending' NOT NULL,
	"priority" "deadline_priority" DEFAULT 'medium' NOT NULL,
	"extension_count" integer DEFAULT 0 NOT NULL,
	"total_extension_days" integer DEFAULT 0 NOT NULL,
	"last_extension_date" timestamp,
	"last_extension_reason" text,
	"completed_by" varchar(255),
	"completion_notes" text,
	"is_overdue" boolean DEFAULT false NOT NULL,
	"days_until_due" integer,
	"days_overdue" integer DEFAULT 0 NOT NULL,
	"escalated_at" timestamp,
	"escalated_to" varchar(255),
	"alert_count" integer DEFAULT 0 NOT NULL,
	"last_alert_sent" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"holiday_date" timestamp NOT NULL,
	"holiday_name" varchar(255) NOT NULL,
	"holiday_type" varchar(100) NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"applies_to" varchar(100) DEFAULT 'all' NOT NULL,
	"is_observed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"transition_id" uuid NOT NULL,
	"approver_user_id" varchar(255) NOT NULL,
	"approver_role" varchar(50),
	"action" varchar(20) NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now(),
	"comment" text,
	"rejection_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "grievance_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"assigned_to" varchar(255) NOT NULL,
	"role" "assignment_role" NOT NULL,
	"status" "assignment_status" DEFAULT 'assigned',
	"assigned_by" varchar(255) NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now(),
	"accepted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"estimated_hours" numeric(10, 2),
	"actual_hours" numeric(10, 2),
	"assignment_reason" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "grievance_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"communication_type" varchar(100) NOT NULL,
	"direction" varchar(20) NOT NULL,
	"from_user_id" varchar(255),
	"from_external" varchar(255),
	"to_user_ids" varchar(255)[],
	"to_external" varchar(255)[],
	"subject" varchar(500),
	"body" text,
	"summary" text,
	"communication_date" timestamp with time zone DEFAULT now(),
	"duration_minutes" integer,
	"attachment_ids" uuid[],
	"email_message_id" varchar(255),
	"sms_message_id" uuid,
	"calendar_event_id" uuid,
	"is_important" boolean DEFAULT false,
	"requires_followup" boolean DEFAULT false,
	"followup_date" date,
	"followup_completed" boolean DEFAULT false,
	"recorded_by" varchar(255) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "grievance_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"settlement_type" varchar(100) NOT NULL,
	"status" "settlement_status" DEFAULT 'proposed',
	"monetary_amount" numeric(15, 2),
	"currency" varchar(3) DEFAULT 'CAD',
	"payment_schedule" jsonb,
	"terms_description" text NOT NULL,
	"terms_structured" jsonb,
	"proposed_by" varchar(50) NOT NULL,
	"proposed_by_user" varchar(255),
	"proposed_at" timestamp with time zone DEFAULT now(),
	"responded_by" varchar(50),
	"responded_by_user" varchar(255),
	"responded_at" timestamp with time zone,
	"response_notes" text,
	"requires_member_approval" boolean DEFAULT true,
	"member_approved" boolean,
	"member_approved_at" timestamp with time zone,
	"requires_union_approval" boolean DEFAULT true,
	"union_approved" boolean,
	"union_approved_by" varchar(255),
	"union_approved_at" timestamp with time zone,
	"requires_management_approval" boolean DEFAULT true,
	"management_approved" boolean,
	"management_approved_by" varchar(255),
	"management_approved_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"finalized_by" varchar(255),
	"settlement_document_id" uuid,
	"signed_agreement_id" uuid,
	"set_precedent" boolean DEFAULT false,
	"precedent_description" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "grievance_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workflow_id" uuid,
	"name" varchar(255) NOT NULL,
	"stage_type" "grievance_stage_type" NOT NULL,
	"description" text,
	"order_index" integer NOT NULL,
	"is_required" boolean DEFAULT true,
	"sla_days" integer,
	"auto_transition" boolean DEFAULT false,
	"require_approval" boolean DEFAULT false,
	"next_stage_id" uuid,
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"entry_actions" jsonb DEFAULT '[]'::jsonb,
	"exit_actions" jsonb DEFAULT '[]'::jsonb,
	"notify_on_entry" boolean DEFAULT true,
	"notify_on_deadline" boolean DEFAULT true,
	"notification_template_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "grievance_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"trigger_type" "transition_trigger_type" NOT NULL,
	"reason" text,
	"notes" text,
	"transitioned_by" varchar(255) NOT NULL,
	"transitioned_at" timestamp with time zone DEFAULT now(),
	"requires_approval" boolean DEFAULT false,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"stage_duration_days" integer,
	"visibility_scope" "visibility_scope" DEFAULT 'staff' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "grievance_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"grievance_type" varchar(100),
	"contract_id" uuid,
	"is_default" boolean DEFAULT false,
	"status" "grievance_workflow_status" DEFAULT 'active',
	"auto_assign" boolean DEFAULT false,
	"require_approval" boolean DEFAULT false,
	"sla_days" integer,
	"stages" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "grievance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"event_type" "grievance_event_type" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cba_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cba_id" uuid NOT NULL,
	"contact_type" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"title" varchar(200),
	"organization" varchar(300),
	"email" varchar(255),
	"phone" varchar(50),
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cba_version_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cba_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"change_description" text NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"previous_data" jsonb,
	"new_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collective_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cba_number" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"jurisdiction" "cba_jurisdiction" NOT NULL,
	"language" "cba_language" DEFAULT 'en' NOT NULL,
	"employer_name" varchar(300) NOT NULL,
	"employer_id" varchar(100),
	"union_name" varchar(300) NOT NULL,
	"union_local" varchar(100),
	"union_id" varchar(100),
	"effective_date" timestamp with time zone NOT NULL,
	"expiry_date" timestamp with time zone NOT NULL,
	"signed_date" timestamp with time zone,
	"ratification_date" timestamp with time zone,
	"industry_sector" varchar(200) NOT NULL,
	"sector" varchar(200),
	"employee_coverage" integer,
	"bargaining_unit_description" text,
	"document_url" text,
	"document_hash" varchar(64),
	"raw_text" text,
	"structured_data" jsonb,
	"embedding" text,
	"summary_generated" text,
	"key_terms" jsonb,
	"ai_processed" boolean DEFAULT false,
	"status" "cba_status" DEFAULT 'active' NOT NULL,
	"is_public" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"last_modified_by" varchar(255),
	"version" integer DEFAULT 1 NOT NULL,
	"superseded_by" uuid,
	"precedes_id" uuid,
	CONSTRAINT "collective_agreements_cba_number_unique" UNIQUE("cba_number")
);
--> statement-breakpoint
CREATE TABLE "benefit_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cba_id" uuid NOT NULL,
	"clause_id" uuid,
	"benefit_type" varchar(100) NOT NULL,
	"benefit_name" varchar(200) NOT NULL,
	"coverage_details" jsonb,
	"monthly_premium" numeric(10, 2),
	"annual_cost" numeric(12, 2),
	"industry_benchmark" varchar(50),
	"effective_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cba_clauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cba_id" uuid NOT NULL,
	"clause_number" varchar(50) NOT NULL,
	"clause_type" "clause_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"content_plain_text" text,
	"page_number" integer,
	"article_number" varchar(50),
	"section_hierarchy" jsonb,
	"parent_clause_id" uuid,
	"order_index" integer DEFAULT 0 NOT NULL,
	"embedding" text,
	"confidence_score" numeric(5, 4),
	"orgs" jsonb,
	"key_terms" jsonb,
	"related_clause_ids" jsonb,
	"interpretation_notes" text,
	"view_count" integer DEFAULT 0,
	"citation_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clause_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comparison_name" varchar(200) NOT NULL,
	"clause_type" "clause_type" NOT NULL,
	"organization_id" uuid NOT NULL,
	"clause_ids" jsonb NOT NULL,
	"analysis_results" jsonb,
	"industry_average" jsonb,
	"market_position" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wage_progressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cba_id" uuid NOT NULL,
	"clause_id" uuid,
	"classification" varchar(200) NOT NULL,
	"classification_code" varchar(50),
	"step" integer NOT NULL,
	"hourly_rate" numeric(10, 2),
	"annual_salary" numeric(12, 2),
	"effective_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"premiums" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arbitration_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_number" varchar(100) NOT NULL,
	"case_title" varchar(500) NOT NULL,
	"tribunal" "tribunal_type" NOT NULL,
	"decision_type" "decision_type" NOT NULL,
	"decision_date" timestamp with time zone NOT NULL,
	"filing_date" timestamp with time zone,
	"hearing_date" timestamp with time zone,
	"arbitrator" varchar(200) NOT NULL,
	"panel_members" jsonb,
	"grievor" varchar(300),
	"union" varchar(300) NOT NULL,
	"employer" varchar(300) NOT NULL,
	"outcome" "outcome" NOT NULL,
	"remedy" jsonb,
	"key_findings" jsonb,
	"issue_types" jsonb,
	"precedent_value" "precedent_value" NOT NULL,
	"legal_citations" jsonb,
	"related_decisions" jsonb,
	"cba_references" jsonb,
	"full_text" text NOT NULL,
	"summary" text,
	"headnote" text,
	"precedent_summary" text,
	"reasoning" text,
	"key_facts" text,
	"sector" varchar(100),
	"jurisdiction" varchar(50),
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"citation_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"embedding" text,
	"is_public" boolean DEFAULT true,
	"access_restrictions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_from" varchar(200),
	CONSTRAINT "arbitration_decisions_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "arbitrator_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"total_decisions" integer DEFAULT 0 NOT NULL,
	"grievor_success_rate" numeric(5, 2),
	"employer_success_rate" numeric(5, 2),
	"average_award_amount" numeric(12, 2),
	"median_award_amount" numeric(12, 2),
	"highest_award_amount" numeric(12, 2),
	"common_remedies" jsonb,
	"specializations" jsonb,
	"primary_sectors" jsonb,
	"jurisdictions" jsonb,
	"avg_decision_days" integer,
	"median_decision_days" integer,
	"decision_range_min" integer,
	"decision_range_max" integer,
	"decision_patterns" jsonb,
	"contact_info" jsonb,
	"biography" text,
	"credentials" jsonb,
	"is_active" boolean DEFAULT true,
	"last_decision_date" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arbitrator_profiles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bargaining_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cba_id" uuid,
	"organization_id" uuid NOT NULL,
	"session_date" timestamp with time zone NOT NULL,
	"session_type" varchar(100) NOT NULL,
	"session_number" integer,
	"title" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"attendees" jsonb,
	"related_clause_ids" jsonb,
	"related_decision_ids" jsonb,
	"tags" jsonb,
	"confidentiality_level" varchar(50) DEFAULT 'internal',
	"embedding" text,
	"key_insights" jsonb,
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "cba_footnotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_clause_id" uuid NOT NULL,
	"target_clause_id" uuid,
	"target_decision_id" uuid,
	"footnote_number" integer NOT NULL,
	"footnote_text" text NOT NULL,
	"context" text,
	"link_type" varchar(50) NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"click_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_precedent_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"precedent_matches" jsonb,
	"success_probability" numeric(5, 2),
	"confidence_level" varchar(50),
	"suggested_strategy" text,
	"potential_remedies" jsonb,
	"arbitrator_tendencies" jsonb,
	"relevant_cba_clause_ids" jsonb,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"analyzed_by" varchar(50) DEFAULT 'ai_system' NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clause_comparisons_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"clause_ids" uuid[] NOT NULL,
	"comparison_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clause_library_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clause_id" uuid NOT NULL,
	"tag_name" varchar(100) NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_clause_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_organization_id" uuid NOT NULL,
	"source_cba_id" uuid,
	"original_clause_id" uuid,
	"clause_number" varchar(50),
	"clause_title" varchar(500) NOT NULL,
	"clause_text" text NOT NULL,
	"clause_type" varchar(100) NOT NULL,
	"is_anonymized" boolean DEFAULT false,
	"original_employer_name" varchar(200),
	"anonymized_employer_name" varchar(200),
	"sharing_level" varchar(50) DEFAULT 'private' NOT NULL,
	"shared_with_org_ids" uuid[],
	"effective_date" date,
	"expiry_date" date,
	"sector" varchar(100),
	"province" varchar(2),
	"view_count" integer DEFAULT 0,
	"citation_count" integer DEFAULT 0,
	"comparison_count" integer DEFAULT 0,
	"version" integer DEFAULT 1,
	"previous_version_id" uuid,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bargaining_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"proposal_number" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"proposal_type" "proposal_type" NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"related_clause_id" uuid,
	"clause_category" varchar(100),
	"current_language" text,
	"proposed_language" text NOT NULL,
	"rationale" text,
	"estimated_cost" numeric(15, 2),
	"costing_notes" text,
	"union_position" varchar(50),
	"management_position" varchar(50),
	"submitted_date" timestamp with time zone,
	"response_deadline" timestamp with time zone,
	"resolved_date" timestamp with time zone,
	"parent_proposal_id" uuid,
	"superseded_by_id" uuid,
	"attachments" jsonb,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "bargaining_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"member_id" uuid,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"role" "bargaining_team_role" NOT NULL,
	"is_chief" boolean DEFAULT false,
	"organization" varchar(300),
	"title" varchar(200),
	"worksite" varchar(200),
	"is_active" boolean DEFAULT true,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"expertise" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negotiation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"session_number" integer NOT NULL,
	"session_type" "negotiation_session_type" NOT NULL,
	"title" varchar(300) NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"scheduled_end_date" timestamp with time zone,
	"actual_start_date" timestamp with time zone,
	"actual_end_date" timestamp with time zone,
	"location" varchar(300),
	"is_virtual" boolean DEFAULT false,
	"meeting_link" text,
	"union_attendees" jsonb,
	"employer_attendees" jsonb,
	"agenda" jsonb,
	"outcomes" jsonb,
	"summary" text,
	"next_steps" text,
	"proposals_discussed" jsonb,
	"bargaining_note_id" uuid,
	"status" varchar(50) DEFAULT 'scheduled',
	"cancelled" boolean DEFAULT false,
	"cancellation_reason" text,
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "negotiations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"expiring_cba_id" uuid,
	"resulting_cba_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"union_name" varchar(300) NOT NULL,
	"union_local" varchar(100),
	"employer_name" varchar(300) NOT NULL,
	"bargaining_unit_size" integer,
	"notice_given_date" timestamp with time zone,
	"first_session_date" timestamp with time zone,
	"target_completion_date" timestamp with time zone,
	"tentative_agreement_date" timestamp with time zone,
	"ratification_date" timestamp with time zone,
	"completion_date" timestamp with time zone,
	"status" "negotiation_status" DEFAULT 'scheduled' NOT NULL,
	"current_round" integer DEFAULT 1,
	"total_sessions" integer DEFAULT 0,
	"key_issues" jsonb,
	"strike_vote_passed" boolean DEFAULT false,
	"strike_vote_date" timestamp with time zone,
	"strike_vote_yes_percent" numeric(5, 2),
	"mandate_expiry" timestamp with time zone,
	"estimated_cost" numeric(15, 2),
	"maximum_cost" numeric(15, 2),
	"progress_summary" text,
	"last_activity_date" timestamp with time zone,
	"tags" jsonb,
	"confidentiality_level" varchar(50) DEFAULT 'restricted',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "tentative_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"agreement_number" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"clause_category" varchar(100) NOT NULL,
	"agreed_language" text NOT NULL,
	"previous_language" text,
	"related_proposal_ids" jsonb,
	"related_clause_id" uuid,
	"requires_ratification" boolean DEFAULT true,
	"ratified" boolean DEFAULT false,
	"ratification_date" timestamp with time zone,
	"ratification_vote_yes" integer,
	"ratification_vote_no" integer,
	"ratification_notes" text,
	"annual_cost" numeric(15, 2),
	"implementation_cost" numeric(15, 2),
	"costing_approved" boolean DEFAULT false,
	"agreed_date" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_date" timestamp with time zone,
	"union_signed_by" varchar(255),
	"union_signed_date" timestamp with time zone,
	"employer_signed_by" varchar(255),
	"employer_signed_date" timestamp with time zone,
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_modified_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "clause_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clause_id" uuid NOT NULL,
	"embedding_vector" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dues_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"assignment_id" uuid,
	"rule_id" uuid,
	"transaction_type" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"due_date" date NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payment_date" timestamp with time zone,
	"payment_method" varchar(50),
	"payment_reference" varchar(255),
	"processor_type" "payment_processor",
	"processor_payment_id" varchar(255),
	"processor_customer_id" varchar(255),
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"dues_amount" numeric(10, 2) NOT NULL,
	"cope_amount" numeric(10, 2) DEFAULT '0.00',
	"pac_amount" numeric(10, 2) DEFAULT '0.00',
	"strike_fund_amount" numeric(10, 2) DEFAULT '0.00',
	"late_fee_amount" numeric(10, 2) DEFAULT '0.00',
	"adjustment_amount" numeric(10, 2) DEFAULT '0.00',
	"total_amount" numeric(10, 2) NOT NULL,
	"paid_date" timestamp with time zone,
	"receipt_url" text
);
--> statement-breakpoint
CREATE TABLE "autopay_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_payment_method_id" varchar(255),
	"payment_method_last4" varchar(4),
	"payment_method_brand" varchar(50),
	"payment_method_type" varchar(50) DEFAULT 'card',
	"max_amount" numeric(10, 2),
	"frequency" varchar(50) DEFAULT 'monthly',
	"day_of_month" varchar(2) DEFAULT '1',
	"last_payment_date" timestamp,
	"last_payment_amount" numeric(10, 2),
	"last_payment_status" varchar(50),
	"next_payment_date" timestamp,
	"failure_count" varchar(255) DEFAULT '0',
	"last_failure_reason" text,
	"notify_before_payment" boolean DEFAULT true,
	"notify_days_before" varchar(255) DEFAULT '3',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "bank_reconciliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bank_statement_date" timestamp NOT NULL,
	"bank_deposit_id" varchar NOT NULL,
	"deposit_amount" numeric(19, 2) NOT NULL,
	"deposit_currency" varchar(3) DEFAULT 'CAD',
	"status" "reconciliation_status" DEFAULT 'unreconciled',
	"reconciled_amount" numeric(19, 2),
	"unmatched_amount" numeric(19, 2),
	"matched_payment_ids" uuid[],
	"unmatched_payment_ids" uuid[],
	"notes" text,
	"reconciliation_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"reconciled_by" varchar(255),
	"reconciled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"cycle_type" varchar(50),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_closed" boolean DEFAULT false,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"status" varchar(50) NOT NULL,
	"resolved_amount" numeric(19, 2),
	"resolution_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"filed_by" varchar(255),
	"resolved_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"type" "payment_method" NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"stripe_payment_method_id" varchar,
	"stripe_billing_details" jsonb,
	"processor_type" "payment_processor",
	"processor_method_id" varchar(255),
	"bank_account_token" varchar,
	"bank_account_last_4" varchar(4),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" varchar(255),
	"amount" numeric(19, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD',
	"type" "payment_type" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"method" "payment_method" NOT NULL,
	"stripe_payment_intent_id" varchar,
	"stripe_price_id" varchar,
	"stripe_invoice_id" varchar,
	"bank_deposit_id" varchar,
	"check_number" varchar,
	"reference_number" varchar,
	"processor_type" "payment_processor",
	"processor_customer_id" varchar(255),
	"payment_cycle_id" uuid,
	"due_date" timestamp,
	"paid_date" timestamp,
	"reconciliation_status" "reconciliation_status" DEFAULT 'unreconciled',
	"reconciliation_date" timestamp,
	"notes" text,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_event_id" varchar NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"stripe_payment_intent_id" varchar,
	"stripe_customer_id" varchar,
	"event_data" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"processing_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "cost_center_type" NOT NULL,
	"parent_cost_center_id" uuid,
	"manager" varchar(255),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"budget_amount" numeric(19, 2),
	"budget_period" varchar(50),
	"budget_start_date" timestamp,
	"budget_end_date" timestamp,
	"warning_threshold" integer DEFAULT 80,
	"external_code" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "gl_transaction_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"chart_of_accounts_id" uuid NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"transaction_number" varchar(50) NOT NULL,
	"description" text,
	"debit_amount" numeric(19, 2) DEFAULT '0',
	"credit_amount" numeric(19, 2) DEFAULT '0',
	"cost_center_id" uuid,
	"invoice_number" varchar(100),
	"receipt_number" varchar(100),
	"purchase_order_number" varchar(100),
	"source_system" varchar(100),
	"source_record_id" varchar(100),
	"is_posted" boolean DEFAULT false,
	"posted_at" timestamp,
	"posted_by" varchar(255),
	"is_reconciled" boolean DEFAULT false,
	"reconciled_at" timestamp,
	"reconciled_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "gl_transaction_log_transaction_number_unique" UNIQUE("transaction_number")
);
--> statement-breakpoint
CREATE TABLE "gl_trial_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"chart_of_accounts_id" uuid NOT NULL,
	"period_end_date" timestamp NOT NULL,
	"opening_balance" numeric(19, 2) DEFAULT '0',
	"debit_total" numeric(19, 2) DEFAULT '0',
	"credit_total" numeric(19, 2) DEFAULT '0',
	"closing_balance" numeric(19, 2) DEFAULT '0',
	"is_finalized" boolean DEFAULT false,
	"finalized_at" timestamp,
	"finalized_by" varchar(255),
	"is_balanced" boolean DEFAULT false,
	"balance" numeric(19, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "rl1_tax_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tax_year" varchar(4) NOT NULL,
	"payer_name" text NOT NULL,
	"payer_quebec_enterprise_number" varchar(10) NOT NULL,
	"payer_address" text NOT NULL,
	"payer_city" varchar(100) NOT NULL,
	"payer_postal_code" varchar(10) NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_sin" varchar(11),
	"recipient_address" text NOT NULL,
	"recipient_city" varchar(100) NOT NULL,
	"recipient_postal_code" varchar(10) NOT NULL,
	"box_o_other_income" numeric(10, 2) NOT NULL,
	"box_e_quebec_income_tax_deducted" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"generated_by" varchar(255) NOT NULL,
	"filed_with_revenu_quebec" boolean DEFAULT false NOT NULL,
	"revenu_quebec_filing_date" timestamp,
	"revenu_quebec_confirmation_number" varchar(50),
	"delivered_to_member" boolean DEFAULT false NOT NULL,
	"delivery_method" varchar(50),
	"delivered_at" timestamp,
	"pdf_url" text,
	"xml_url" text,
	"is_amendment" boolean DEFAULT false NOT NULL,
	"original_slip_id" uuid,
	"amendment_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strike_fund_disbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"strike_id" uuid,
	"strike_name" text,
	"strike_start_date" timestamp,
	"strike_end_date" timestamp,
	"payment_date" timestamp NOT NULL,
	"payment_amount" numeric(10, 2) NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"payment_reference" varchar(100),
	"tax_year" varchar(4) NOT NULL,
	"tax_month" varchar(2) NOT NULL,
	"week_number" varchar(10) NOT NULL,
	"weekly_total" numeric(10, 2) NOT NULL,
	"exceeds_threshold" boolean DEFAULT false NOT NULL,
	"requires_tax_slip" boolean DEFAULT false NOT NULL,
	"t4a_generated" boolean DEFAULT false NOT NULL,
	"t4a_generated_at" timestamp,
	"rl1_generated" boolean DEFAULT false NOT NULL,
	"rl1_generated_at" timestamp,
	"province" varchar(2) NOT NULL,
	"is_quebec_resident" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t4a_tax_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tax_year" varchar(4) NOT NULL,
	"payer_name" text NOT NULL,
	"payer_business_number" varchar(15) NOT NULL,
	"payer_address" text NOT NULL,
	"payer_city" varchar(100) NOT NULL,
	"payer_province" varchar(2) NOT NULL,
	"payer_postal_code" varchar(10) NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_sin" varchar(11),
	"recipient_address" text NOT NULL,
	"recipient_city" varchar(100) NOT NULL,
	"recipient_province" varchar(2) NOT NULL,
	"recipient_postal_code" varchar(10) NOT NULL,
	"box_028_other_income" numeric(10, 2) NOT NULL,
	"box_022_income_tax_deducted" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"generated_by" varchar(255) NOT NULL,
	"filed_with_cra" boolean DEFAULT false NOT NULL,
	"cra_filing_date" timestamp,
	"cra_confirmation_number" varchar(50),
	"delivered_to_member" boolean DEFAULT false NOT NULL,
	"delivery_method" varchar(50),
	"delivered_at" timestamp,
	"pdf_url" text,
	"xml_url" text,
	"is_amendment" boolean DEFAULT false NOT NULL,
	"original_slip_id" uuid,
	"amendment_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_year_end_processing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_year" varchar(4) NOT NULL,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"t4a_slips_generated" varchar(10) DEFAULT '0' NOT NULL,
	"t4a_total_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"t4a_filing_deadline" timestamp NOT NULL,
	"t4a_filed_at" timestamp,
	"t4a_filing_confirmed" boolean DEFAULT false NOT NULL,
	"rl1_slips_generated" varchar(10) DEFAULT '0' NOT NULL,
	"rl1_total_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"rl1_filing_deadline" timestamp NOT NULL,
	"rl1_filed_at" timestamp,
	"rl1_filing_confirmed" boolean DEFAULT false NOT NULL,
	"member_delivery_started_at" timestamp,
	"member_delivery_completed_at" timestamp,
	"slips_delivered_to_members" varchar(10) DEFAULT '0' NOT NULL,
	"compliance_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"deadline_missed" boolean DEFAULT false NOT NULL,
	"processed_by" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tax_year_end_processing_tax_year_unique" UNIQUE("tax_year")
);
--> statement-breakpoint
CREATE TABLE "union_dues_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_year" varchar(4) NOT NULL,
	"member_name" text NOT NULL,
	"member_sin" varchar(11),
	"member_address" text,
	"member_city" varchar(100),
	"member_province" varchar(2) NOT NULL,
	"member_postal_code" varchar(10),
	"union_name" text NOT NULL,
	"union_business_number" varchar(15) NOT NULL,
	"union_address" text NOT NULL,
	"union_city" varchar(100) NOT NULL,
	"union_province" varchar(2) NOT NULL,
	"union_postal_code" varchar(10) NOT NULL,
	"total_union_dues" numeric(10, 2) NOT NULL,
	"regular_dues" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"special_assessments" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"initiation_fees" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"non_deductible_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"non_deductible_description" text,
	"cope_contributions" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"collection_method" varchar(30) NOT NULL,
	"employer_deducted" boolean DEFAULT false NOT NULL,
	"employer_name" text,
	"employer_business_number" varchar(15),
	"is_quebec_resident" boolean DEFAULT false NOT NULL,
	"rl1_box_f_amount" numeric(10, 2),
	"receipt_number" varchar(50) NOT NULL,
	"generated_at" timestamp,
	"generated_by" varchar(255),
	"delivered_to_member" boolean DEFAULT false NOT NULL,
	"delivery_method" varchar(50),
	"delivered_at" timestamp,
	"pdf_url" text,
	"is_amendment" boolean DEFAULT false NOT NULL,
	"original_receipt_id" uuid,
	"amendment_reason" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "union_dues_year_end" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tax_year" varchar(4) NOT NULL,
	"total_members" varchar(10) DEFAULT '0' NOT NULL,
	"receipts_generated" varchar(10) DEFAULT '0' NOT NULL,
	"receipts_delivered" varchar(10) DEFAULT '0' NOT NULL,
	"total_dues_collected" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_deductible_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_non_deductible_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"delivery_deadline" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"processed_by" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_threshold_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tax_year" varchar(4) NOT NULL,
	"week_number" varchar(10) NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"week_end_date" timestamp NOT NULL,
	"payment_count" varchar(10) DEFAULT '0' NOT NULL,
	"weekly_total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"exceeds_threshold" boolean DEFAULT false NOT NULL,
	"threshold_amount" numeric(10, 2) DEFAULT '500.00' NOT NULL,
	"requires_t4a" boolean DEFAULT false NOT NULL,
	"requires_rl1" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_of_canada_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_date" timestamp NOT NULL,
	"currency" varchar(3) NOT NULL,
	"noon_rate" numeric(15, 8) NOT NULL,
	"buy_rate" numeric(15, 8),
	"sell_rate" numeric(15, 8),
	"source" varchar(50) DEFAULT 'bank_of_canada_api' NOT NULL,
	"data_quality" varchar(20) DEFAULT 'official' NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"imported_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_border_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"amount_cents" integer NOT NULL,
	"original_currency" varchar(3) DEFAULT 'CAD',
	"cad_equivalent_cents" integer NOT NULL,
	"from_country_code" varchar(2) DEFAULT 'CA' NOT NULL,
	"to_country_code" varchar(2) NOT NULL,
	"from_party_type" varchar(50) NOT NULL,
	"to_party_type" varchar(50) NOT NULL,
	"cra_reporting_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"requires_t106" boolean DEFAULT false NOT NULL,
	"t106_filed" boolean DEFAULT false NOT NULL,
	"t106_filing_date" timestamp,
	"transaction_type" varchar(50),
	"counterparty_name" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_enforcement_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_description" text NOT NULL,
	"transaction_id" uuid,
	"affected_currency" varchar(3),
	"affected_amount" numeric(15, 2),
	"performed_by" varchar(255) NOT NULL,
	"performed_by_role" varchar(50),
	"compliance_impact" varchar(20),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_enforcement_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enforcement_enabled" boolean DEFAULT true NOT NULL,
	"mandatory_currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"allow_foreign_currency" boolean DEFAULT false NOT NULL,
	"foreign_currency_reason" text,
	"fx_rate_source" varchar(50) DEFAULT 'bank_of_canada' NOT NULL,
	"fx_rate_update_frequency" varchar(20) DEFAULT 'daily' NOT NULL,
	"t106_filing_required" boolean DEFAULT true NOT NULL,
	"t106_threshold_cad" numeric(15, 2) DEFAULT '1000000.00' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "currency_enforcement_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"violation_type" varchar(50) NOT NULL,
	"violation_description" text NOT NULL,
	"transaction_id" uuid,
	"attempted_currency" varchar(3),
	"attempted_amount" numeric(15, 2),
	"attempted_by" varchar(255) NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"resolved_by" varchar(255),
	"resolved_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" varchar(3) NOT NULL,
	"to_currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"exchange_rate" varchar(20) NOT NULL,
	"rate_source" varchar(50) NOT NULL,
	"effective_date" timestamp NOT NULL,
	"rate_timestamp" timestamp NOT NULL,
	"provider" varchar(100),
	"data_quality" varchar(20) DEFAULT 'official',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rate_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_description" text,
	"currency" varchar(3),
	"rate_date" timestamp,
	"old_rate" numeric(15, 8),
	"new_rate" numeric(15, 8),
	"performed_by" varchar(255),
	"performed_by_role" varchar(50),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t106_filing_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year" varchar(4) NOT NULL,
	"total_foreign_transactions" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"total_cad_equivalent" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"t106_threshold_exceeded" boolean DEFAULT false NOT NULL,
	"t106_filing_required" boolean DEFAULT false NOT NULL,
	"reportable_transaction_count" varchar(10) DEFAULT '0' NOT NULL,
	"reportable_transaction_ids" jsonb,
	"filing_status" varchar(20) DEFAULT 'not_required' NOT NULL,
	"filing_due_date" timestamp,
	"filed_date" timestamp,
	"confirmation_number" varchar(50),
	"prepared_by" varchar(255),
	"reviewed_by" varchar(255),
	"filed_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_currency_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"original_currency" varchar(3) NOT NULL,
	"original_amount" numeric(15, 2) NOT NULL,
	"cad_amount" numeric(15, 2) NOT NULL,
	"fx_rate_used" numeric(15, 8) NOT NULL,
	"fx_rate_date" timestamp NOT NULL,
	"fx_rate_source" varchar(50) DEFAULT 'bank_of_canada' NOT NULL,
	"exception_approved" boolean DEFAULT false NOT NULL,
	"exception_reason" text,
	"approved_by" varchar(255),
	"approved_at" timestamp,
	"conversion_method" varchar(50) DEFAULT 'noon_rate' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_currency_conversions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "transfer_pricing_documentation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"from_party" uuid NOT NULL,
	"to_party" uuid NOT NULL,
	"arms_length_required" boolean DEFAULT true NOT NULL,
	"arms_length_confirmed" boolean DEFAULT false NOT NULL,
	"arms_length_method" varchar(50),
	"cad_amount" numeric(15, 2) NOT NULL,
	"pricing_justification" text NOT NULL,
	"comparable_transactions" jsonb,
	"supporting_documents" jsonb,
	"documented_by" varchar(255) NOT NULL,
	"documented_at" timestamp DEFAULT now() NOT NULL,
	"review_required" boolean DEFAULT true NOT NULL,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_billing_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"billing_frequency" varchar(20) DEFAULT 'monthly' NOT NULL,
	"billing_day_of_month" integer,
	"timezone" varchar(50) DEFAULT 'America/Toronto',
	"enabled" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pension_benefit_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name" varchar(255) NOT NULL,
	"claim_type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"submitted_date" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_date" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pension_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name" varchar(255) NOT NULL,
	"period" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payment_date" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pension_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"plan_name" varchar(255) NOT NULL,
	"enrollment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"membership_status" varchar(50) DEFAULT 'active' NOT NULL,
	"years_of_service" numeric(5, 1) DEFAULT '0' NOT NULL,
	"vesting_status" varchar(50) DEFAULT 'not_vested' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pension_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_name" varchar(255) NOT NULL,
	"plan_type" varchar(50) DEFAULT 'defined_benefit' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"active_members" integer DEFAULT 0 NOT NULL,
	"total_assets" numeric(15, 2) DEFAULT '0' NOT NULL,
	"funding_status" numeric(5, 2) DEFAULT '100' NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pension_t4a_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name" varchar(255) NOT NULL,
	"tax_year" integer NOT NULL,
	"pension_income" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"generated_date" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pension_trustee_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"location" varchar(255),
	"agenda" text,
	"minutes" text,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pension_trustees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"role" varchar(100) DEFAULT 'trustee' NOT NULL,
	"appointed_date" timestamp with time zone DEFAULT now() NOT NULL,
	"term_end_date" timestamp with time zone,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"billing_email" varchar(320) NOT NULL,
	"billing_contact_name" varchar(255),
	"billing_phone" varchar(30),
	"billing_address" jsonb,
	"tax_id" varchar(50),
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "billing_account_status" DEFAULT 'active' NOT NULL,
	"net_terms_days" integer DEFAULT 30 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "billing_accounts_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "billing_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid,
	"type" "billing_adjustment_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"reason" text NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"approved_by" varchar(255),
	"ledger_entry_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "billing_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"label" varchar(50) NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"due_days" integer NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"discount_days" integer DEFAULT 0,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_terms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "org_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"trial_end_date" timestamp with time zone,
	"local_count" integer DEFAULT 0,
	"seat_count" integer DEFAULT 0,
	"module_list" jsonb DEFAULT '[]'::jsonb,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"subsidy_amount" numeric(12, 2) DEFAULT '0',
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "platform_invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"cost_type" varchar(50) NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"ledger_entry_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"billing_period_id" uuid,
	"invoice_number" varchar(50) NOT NULL,
	"issue_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"amount_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "platform_invoice_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "platform_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "platform_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "platform_payment_status" DEFAULT 'pending' NOT NULL,
	"method" varchar(50) NOT NULL,
	"external_reference" varchar(255),
	"paid_at" timestamp with time zone,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"pricing_model" "pricing_model" NOT NULL,
	"base_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"per_local_fee" numeric(10, 2) DEFAULT '0',
	"per_seat_fee" numeric(10, 2) DEFAULT '0',
	"per_module_fee" numeric(10, 2) DEFAULT '0',
	"onboarding_fee" numeric(10, 2) DEFAULT '0',
	"support_fee" numeric(10, 2) DEFAULT '0',
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"billing_interval" varchar(20) DEFAULT 'monthly' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "platform_cost_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_organization_id" uuid,
	"local_id" uuid,
	"employer_id" uuid,
	"region_id" uuid,
	"bargaining_unit_id" uuid,
	"billing_period_id" uuid,
	"cost_type" "platform_cost_type" NOT NULL,
	"event_type" "ledger_event_type" NOT NULL,
	"source_type" "ledger_source_type" NOT NULL,
	"source_id" uuid,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price_cad" numeric(12, 2) NOT NULL,
	"amount_cad" numeric(14, 2) NOT NULL,
	"cost_center_id" uuid,
	"allocation_status" "allocation_status" DEFAULT 'unallocated' NOT NULL,
	"allocation_run_id" uuid,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"audit_reference" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "allocation_basis_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"active_user_count" integer DEFAULT 0 NOT NULL,
	"case_volume" integer DEFAULT 0 NOT NULL,
	"remittance_summary" numeric(14, 2) DEFAULT '0',
	"metadata" jsonb,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocation_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"method" "allocation_method" NOT NULL,
	"weights" jsonb,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "allocation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "allocation_run_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"local_name" varchar(255),
	"method" "allocation_method" NOT NULL,
	"basis_value" numeric(14, 4) NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"allocated_amount" numeric(14, 2) NOT NULL,
	"cost_type" varchar(50) NOT NULL,
	"ledger_entry_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"status" "allocation_run_status" DEFAULT 'draft' NOT NULL,
	"is_simulation" boolean DEFAULT false NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"line_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "chargeback_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"allocation_run_id" uuid NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" chargeback_status DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" varchar(255),
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "council_elections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_year" integer NOT NULL,
	"election_date" date NOT NULL,
	"positions_available" integer NOT NULL,
	"candidates" jsonb NOT NULL,
	"winners" jsonb NOT NULL,
	"total_votes" integer NOT NULL,
	"participation_rate" integer,
	"verified_by" text,
	"verification_date" date,
	"contested_results" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "golden_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_class" text DEFAULT 'B' NOT NULL,
	"certificate_number" text NOT NULL,
	"issue_date" date NOT NULL,
	"holder_type" text DEFAULT 'council' NOT NULL,
	"council_members" jsonb NOT NULL,
	"voting_power_reserved_matters" integer DEFAULT 51 NOT NULL,
	"voting_power_ordinary_matters" integer DEFAULT 1 NOT NULL,
	"redemption_value" integer DEFAULT 1 NOT NULL,
	"dividend_rights" boolean DEFAULT false NOT NULL,
	"sunset_clause_active" boolean DEFAULT true NOT NULL,
	"sunset_clause_duration" integer DEFAULT 5 NOT NULL,
	"consecutive_compliance_years" integer DEFAULT 0 NOT NULL,
	"sunset_triggered_date" date,
	"conversion_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"transferable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "golden_shares_certificate_number_unique" UNIQUE("certificate_number")
);
--> statement-breakpoint
CREATE TABLE "governance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"event_date" timestamp NOT NULL,
	"golden_share_id" uuid,
	"reserved_matter_vote_id" uuid,
	"mission_audit_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"impact" text,
	"impact_description" text,
	"stakeholders" jsonb,
	"notifications_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "mission_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_year" integer NOT NULL,
	"audit_period_start" date NOT NULL,
	"audit_period_end" date NOT NULL,
	"auditor_firm" text NOT NULL,
	"auditor_name" text NOT NULL,
	"auditor_certification" text,
	"audit_date" date NOT NULL,
	"union_revenue_percent" integer NOT NULL,
	"member_satisfaction_percent" integer NOT NULL,
	"data_violations" integer DEFAULT 0 NOT NULL,
	"union_revenue_threshold" integer DEFAULT 90 NOT NULL,
	"member_satisfaction_threshold" integer DEFAULT 80 NOT NULL,
	"data_violations_threshold" integer DEFAULT 0 NOT NULL,
	"union_revenue_pass" boolean NOT NULL,
	"member_satisfaction_pass" boolean NOT NULL,
	"data_violations_pass" boolean NOT NULL,
	"overall_pass" boolean NOT NULL,
	"total_revenue" integer,
	"union_revenue" integer,
	"member_survey_sample_size" integer,
	"member_survey_responses" integer,
	"data_violation_details" jsonb,
	"auditor_opinion" text NOT NULL,
	"auditor_notes" text,
	"corrective_actions" jsonb,
	"impacts_consecutive_compliance" boolean NOT NULL,
	"consecutive_years_after_audit" integer,
	"audit_report_pdf_url" text,
	"supporting_documents_urls" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserved_matter_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"proposed_by" varchar(255) NOT NULL,
	"proposed_date" timestamp NOT NULL,
	"voting_deadline" timestamp NOT NULL,
	"matter_details" jsonb NOT NULL,
	"class_a_votes_for" integer DEFAULT 0,
	"class_a_votes_against" integer DEFAULT 0,
	"class_a_abstain" integer DEFAULT 0,
	"class_a_total_votes" integer NOT NULL,
	"class_a_percent_for" integer DEFAULT 0,
	"class_b_vote" text,
	"class_b_vote_date" timestamp,
	"class_b_vote_rationale" text,
	"class_b_council_members_voting" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"final_decision" text,
	"decision_date" timestamp,
	"implemented" boolean DEFAULT false,
	"implementation_date" timestamp,
	"implementation_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arms_length_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"transaction_amount" numeric(15, 2) NOT NULL,
	"from_party" uuid NOT NULL,
	"to_party" uuid NOT NULL,
	"relationship_exists" boolean DEFAULT false NOT NULL,
	"relationship_type" varchar(50),
	"relationship_description" text,
	"arms_length_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"arms_length_justification" text,
	"verification_method" varchar(50),
	"comparable_transactions" jsonb,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"review_decision" varchar(20),
	"review_notes" text,
	"compliant" boolean DEFAULT false NOT NULL,
	"compliance_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "arms_length_verification_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "blind_trust_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"full_name" text NOT NULL,
	"role" varchar(50) NOT NULL,
	"trust_status" varchar(20) DEFAULT 'required' NOT NULL,
	"trust_established_date" timestamp,
	"trustee_name" text,
	"trustee_contact" text,
	"trustee_relationship" varchar(50),
	"trust_type" varchar(50),
	"trust_document" text,
	"trust_account_number" varchar(100),
	"assets_transferred" jsonb,
	"estimated_value" numeric(15, 2),
	"verified_by" varchar(255),
	"verified_at" timestamp,
	"verification_notes" text,
	"last_review_date" timestamp,
	"next_review_due" timestamp,
	"compliant" boolean DEFAULT false NOT NULL,
	"compliance_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blind_trust_registry_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "conflict_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_description" text NOT NULL,
	"subject_user_id" varchar(255),
	"related_disclosure_id" uuid,
	"related_transaction_id" uuid,
	"performed_by" varchar(255) NOT NULL,
	"performed_by_role" varchar(50),
	"compliance_impact" varchar(20),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflict_disclosures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"full_name" text NOT NULL,
	"role" varchar(50) NOT NULL,
	"disclosure_type" varchar(50) NOT NULL,
	"disclosure_year" varchar(4),
	"conflict_type" varchar(50) NOT NULL,
	"conflict_description" text NOT NULL,
	"related_parties" jsonb,
	"related_transaction_ids" jsonb,
	"financial_interest_amount" numeric(15, 2),
	"ownership_percentage" numeric(5, 2),
	"mitigation_plan" text,
	"recusal_required" boolean DEFAULT false NOT NULL,
	"recusal_documented" boolean DEFAULT false NOT NULL,
	"review_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"reviewed_by" jsonb,
	"review_completed_at" timestamp,
	"disclosure_deadline" timestamp,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"overdue" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflict_of_interest_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_enabled" boolean DEFAULT true NOT NULL,
	"blind_trust_required" boolean DEFAULT true NOT NULL,
	"annual_disclosure_required" boolean DEFAULT true NOT NULL,
	"disclosure_deadline" varchar(10) DEFAULT '01-31' NOT NULL,
	"significant_interest_threshold" numeric(15, 2) DEFAULT '5000.00' NOT NULL,
	"arms_length_verification_required" boolean DEFAULT true NOT NULL,
	"covered_roles" jsonb DEFAULT '["founder","president","vice_president","treasurer","secretary","executive_director","board_member"]'::jsonb NOT NULL,
	"review_committee_required" boolean DEFAULT true NOT NULL,
	"minimum_reviewers" varchar(2) DEFAULT '2' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "conflict_review_committee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"full_name" text NOT NULL,
	"role" varchar(50) NOT NULL,
	"committee_role" varchar(50) NOT NULL,
	"appointed_by" varchar(255),
	"appointed_at" timestamp DEFAULT now() NOT NULL,
	"term_start_date" timestamp NOT NULL,
	"term_end_date" timestamp,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflict_training" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"full_name" text NOT NULL,
	"role" varchar(50) NOT NULL,
	"training_type" varchar(50) NOT NULL,
	"training_date" timestamp NOT NULL,
	"training_provider" text,
	"completion_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"certificate_url" text,
	"next_training_due" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recusal_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"full_name" text NOT NULL,
	"role" varchar(50) NOT NULL,
	"recusal_type" varchar(50) NOT NULL,
	"recusal_reason" text NOT NULL,
	"related_matter" text,
	"related_meeting_id" uuid,
	"related_vote_id" uuid,
	"related_transaction_id" uuid,
	"recusal_documented" boolean DEFAULT false NOT NULL,
	"documentation_url" text,
	"documented_by" varchar(255),
	"documented_at" timestamp,
	"recusal_start_date" timestamp NOT NULL,
	"recusal_end_date" timestamp,
	"verified_by" varchar(255),
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voter_eligibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"is_eligible" boolean DEFAULT true,
	"eligibility_reason" text,
	"voting_weight" numeric(5, 2) DEFAULT '1.0',
	"can_delegate" boolean DEFAULT false,
	"delegated_to" uuid,
	"restrictions" text[],
	"verification_status" varchar(20) DEFAULT 'pending',
	"voter_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "valid_verification_status" CHECK ("voter_eligibility"."verification_status" IN ('pending', 'verified', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"voter_id" varchar(100) NOT NULL,
	"voter_hash" varchar(100),
	"signature" text,
	"receipt_id" varchar(255),
	"verification_code" varchar(100),
	"audit_hash" varchar(255),
	"cast_at" timestamp with time zone DEFAULT now(),
	"is_anonymous" boolean DEFAULT true,
	"voter_type" varchar(20) DEFAULT 'member',
	"voter_metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "valid_voter_type" CHECK ("votes"."voter_type" IN ('member', 'delegate', 'officer', 'guest'))
);
--> statement-breakpoint
CREATE TABLE "voting_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"receipt_id" varchar(255) NOT NULL,
	"vote_hash" varchar(255) NOT NULL,
	"signature" text NOT NULL,
	"audit_hash" varchar(255) NOT NULL,
	"previous_audit_hash" varchar(255),
	"voted_at" timestamp with time zone NOT NULL,
	"verification_code" varchar(100),
	"is_anonymous" boolean DEFAULT true,
	"chain_valid" boolean DEFAULT true,
	"tampered_indicators" text[],
	"audit_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "voting_audit_log_receipt_id_unique" UNIQUE("receipt_id")
);
--> statement-breakpoint
CREATE TABLE "voting_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"recipient_id" uuid NOT NULL,
	"priority" varchar(20) DEFAULT 'medium',
	"delivery_method" text[] DEFAULT ARRAY['push'],
	"is_read" boolean DEFAULT false,
	"sent_at" timestamp with time zone DEFAULT now(),
	"read_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "valid_notification_type" CHECK ("voting_notifications"."type" IN ('session_started', 'session_ending', 'results_available', 'quorum_reached', 'vote_reminder')),
	CONSTRAINT "valid_priority" CHECK ("voting_notifications"."priority" IN ('low', 'medium', 'high', 'urgent'))
);
--> statement-breakpoint
CREATE TABLE "voting_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"text" varchar(500) NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voting_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"meeting_type" varchar(50) NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"scheduled_end_time" timestamp with time zone,
	"allow_anonymous" boolean DEFAULT true,
	"requires_quorum" boolean DEFAULT true,
	"quorum_threshold" integer DEFAULT 50,
	"total_eligible_voters" integer DEFAULT 0,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "valid_type" CHECK ("voting_sessions"."type" IN ('convention', 'ratification', 'special_vote')),
	CONSTRAINT "valid_status" CHECK ("voting_sessions"."status" IN ('draft', 'active', 'paused', 'closed', 'cancelled')),
	CONSTRAINT "valid_meeting_type" CHECK ("voting_sessions"."meeting_type" IN ('convention', 'ratification', 'emergency', 'special')),
	CONSTRAINT "valid_time_range" CHECK ("voting_sessions"."end_time" IS NULL OR "voting_sessions"."start_time" IS NULL OR "voting_sessions"."end_time" > "voting_sessions"."start_time"),
	CONSTRAINT "valid_scheduled_end" CHECK ("voting_sessions"."scheduled_end_time" IS NULL OR "voting_sessions"."scheduled_end_time" > "voting_sessions"."created_at"),
	CONSTRAINT "valid_quorum" CHECK ("voting_sessions"."quorum_threshold" >= 0 AND "voting_sessions"."quorum_threshold" <= 100)
);
--> statement-breakpoint
CREATE TABLE "strategic_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "strategic_goal_category" DEFAULT 'operations' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone,
	"owner" varchar(255),
	"status" "strategic_goal_status" DEFAULT 'on-track' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_bylaws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"article" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_signatories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"authority" varchar(50) DEFAULT 'limited' NOT NULL,
	"active_from" timestamp with time zone NOT NULL,
	"active_to" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"category" varchar(50) DEFAULT 'hr' NOT NULL,
	"description" text,
	"content" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"updated_by" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"message_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"notified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_read_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_read_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"member_id" text NOT NULL,
	"staff_id" text,
	"organization_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal',
	"category" text,
	"is_archived" boolean DEFAULT false,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"message_type" "message_type" DEFAULT 'text' NOT NULL,
	"content" text,
	"file_url" text,
	"file_name" text,
	"file_size" text,
	"status" "message_status" DEFAULT 'sent' NOT NULL,
	"read_at" timestamp,
	"is_edited" boolean DEFAULT false,
	"edited_at" timestamp,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "in_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"action_label" text,
	"action_url" text,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification_bounces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"bounce_type" "notification_bounce_type" NOT NULL,
	"bounce_sub_type" text,
	"first_bounced_at" timestamp NOT NULL,
	"last_bounced_at" timestamp NOT NULL,
	"bounce_count" text DEFAULT '1' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"suppress_until" timestamp,
	"suppression_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"notification_id" uuid NOT NULL,
	"event" text NOT NULL,
	"event_timestamp" timestamp NOT NULL,
	"provider_id" text,
	"external_event_id" text,
	"details" jsonb,
	"status_code" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"organization_id" uuid,
	"recipient" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"subject" text,
	"template" text,
	"status" "notification_status" NOT NULL,
	"error" text,
	"sent_at" timestamp NOT NULL,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "notification_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "notification_queue_status" DEFAULT 'pending' NOT NULL,
	"priority" "notification_priority" DEFAULT 'normal' NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt_count" text DEFAULT '0' NOT NULL,
	"max_attempts" text DEFAULT '3' NOT NULL,
	"next_retry_at" timestamp,
	"processed_at" timestamp,
	"completed_at" timestamp,
	"result_notification_id" uuid,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "notification_template_type" NOT NULL,
	"subject" text,
	"title" text,
	"body_template" text NOT NULL,
	"html_body_template" text,
	"variables" jsonb,
	"default_variables" jsonb,
	"channels" "notification_channel"[],
	"status" "notification_template_status" DEFAULT 'active' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"max_retries" text DEFAULT '3',
	"retry_delay_seconds" text DEFAULT '300',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "notification_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
CREATE TABLE "notification_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipient_id" uuid,
	"type" "notification_type" NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"priority" "notification_priority" DEFAULT 'normal' NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"html_body" text,
	"template_id" text,
	"template_data" jsonb,
	"provider_id" text,
	"external_message_id" text,
	"action_url" text,
	"action_label" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failure_reason" text,
	"failure_count" integer DEFAULT 0,
	"last_failure_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"priority" text DEFAULT 'medium',
	"related_entity_type" text,
	"related_entity_id" text,
	"scheduled_for" timestamp,
	"status" "notification_schedule_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"digest_frequency" "digest_frequency" DEFAULT 'daily' NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"claim_updates" boolean DEFAULT true NOT NULL,
	"document_updates" boolean DEFAULT true NOT NULL,
	"deadline_alerts" boolean DEFAULT true NOT NULL,
	"system_announcements" boolean DEFAULT true NOT NULL,
	"security_alerts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "newsletter_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid,
	"name" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"preview_text" varchar(500),
	"from_name" varchar(255) NOT NULL,
	"from_email" varchar(255) NOT NULL,
	"reply_to_email" varchar(255),
	"html_content" text NOT NULL,
	"json_structure" jsonb,
	"status" varchar(50) DEFAULT 'draft',
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"timezone" varchar(100) DEFAULT 'UTC',
	"distribution_list_ids" uuid[] DEFAULT '{}',
	"recipient_count" integer DEFAULT 0,
	"total_sent" integer DEFAULT 0,
	"total_delivered" integer DEFAULT 0,
	"total_bounced" integer DEFAULT 0,
	"total_opened" integer DEFAULT 0,
	"total_clicked" integer DEFAULT 0,
	"total_unsubscribed" integer DEFAULT 0,
	"total_spam_reports" integer DEFAULT 0,
	"tags" varchar(100)[],
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "newsletter_distribution_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"list_type" varchar(50) DEFAULT 'manual',
	"filter_criteria" jsonb,
	"subscriber_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "newsletter_engagement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"profile_id" text,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"occurred_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "newsletter_list_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"profile_id" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'subscribed',
	"subscribed_at" timestamp with time zone DEFAULT now(),
	"unsubscribed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "newsletter_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"profile_id" text,
	"email" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"bounce_type" varchar(50),
	"bounce_reason" text,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "newsletter_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"thumbnail_url" text,
	"html_content" text NOT NULL,
	"json_structure" jsonb,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"is_system" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" text,
	"phone_number" text NOT NULL,
	"message_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_campaign_recipients_campaign_id_phone_number_unique" UNIQUE("campaign_id","phone_number")
);
--> statement-breakpoint
CREATE TABLE "sms_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"message" text NOT NULL,
	"template_id" uuid,
	"recipient_filter" jsonb,
	"recipient_count" integer DEFAULT 0,
	"sent_count" integer DEFAULT 0,
	"delivered_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"total_cost" numeric(10, 2) DEFAULT '0.00',
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text,
	"phone_number" text NOT NULL,
	"direction" text NOT NULL,
	"message" text NOT NULL,
	"twilio_sid" text,
	"status" text DEFAULT 'received',
	"replied_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text,
	"phone_number" text NOT NULL,
	"message" text NOT NULL,
	"template_id" uuid,
	"campaign_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"twilio_sid" text,
	"error_code" text,
	"error_message" text,
	"segments" integer DEFAULT 1,
	"price_amount" numeric(10, 4),
	"price_currency" text DEFAULT 'USD',
	"direction" text DEFAULT 'outbound',
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text,
	"phone_number" text NOT NULL,
	"opted_out_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opted_out_via" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_opt_outs_organization_id_phone_number_unique" UNIQUE("organization_id","phone_number")
);
--> statement-breakpoint
CREATE TABLE "sms_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"messages_sent" integer DEFAULT 0,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"window_end" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_rate_limits_organization_id_window_start_unique" UNIQUE("organization_id","window_start")
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"message_template" text NOT NULL,
	"variables" text[] DEFAULT '{}',
	"category" text,
	"is_active" boolean DEFAULT true,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_templates_organization_id_name_unique" UNIQUE("organization_id","name"),
	CONSTRAINT "sms_template_message_length" CHECK (char_length(message_template) <= 1600)
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"poll_id" uuid NOT NULL,
	"user_id" text,
	"voter_email" varchar(255),
	"option_id" varchar(50) NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"voted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_user_poll_unique" UNIQUE("poll_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"question" text NOT NULL,
	"description" text,
	"options" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"allow_multiple_votes" boolean DEFAULT false NOT NULL,
	"require_authentication" boolean DEFAULT true NOT NULL,
	"show_results_before_vote" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closes_at" timestamp with time zone,
	"total_votes" integer DEFAULT 0 NOT NULL,
	"unique_voters" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_text" text,
	"answer_number" numeric(10, 2),
	"answer_choices" jsonb,
	"answer_other" text,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_answers_response_question_unique" UNIQUE("response_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"question_type" varchar(50) NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"section" varchar(255),
	"required" boolean DEFAULT false NOT NULL,
	"choices" jsonb,
	"allow_other" boolean DEFAULT false NOT NULL,
	"min_choices" integer,
	"max_choices" integer,
	"rating_min" integer DEFAULT 1,
	"rating_max" integer DEFAULT 10,
	"rating_min_label" varchar(100),
	"rating_max_label" varchar(100),
	"min_length" integer,
	"max_length" integer,
	"placeholder" text,
	"show_if" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"user_id" text,
	"respondent_email" varchar(255),
	"respondent_name" varchar(255),
	"status" varchar(50) DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"time_spent_seconds" integer,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"survey_type" varchar(50) DEFAULT 'general' NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"allow_anonymous" boolean DEFAULT false NOT NULL,
	"allow_multiple_responses" boolean DEFAULT false NOT NULL,
	"require_authentication" boolean DEFAULT true NOT NULL,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"show_results" boolean DEFAULT false NOT NULL,
	"welcome_message" text,
	"thank_you_message" text,
	"response_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"completion_rate" numeric(5, 2),
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"metric_type" text NOT NULL,
	"metric_name" text NOT NULL,
	"metric_value" numeric NOT NULL,
	"metric_unit" text,
	"period_type" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"metadata" jsonb,
	"comparison_value" numeric,
	"trend" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comparative_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_name" text NOT NULL,
	"comparison_type" text NOT NULL,
	"organization_ids" jsonb,
	"metrics" jsonb NOT NULL,
	"time_range" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"benchmarks" jsonb,
	"organization_ranking" jsonb,
	"gaps" jsonb,
	"strengths" jsonb,
	"recommendations" jsonb,
	"visualization_data" jsonb,
	"is_public" boolean DEFAULT false,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"insight_type" text NOT NULL,
	"category" text NOT NULL,
	"priority" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"data_source" jsonb,
	"metrics" jsonb,
	"trend" text,
	"impact" text,
	"recommendations" jsonb,
	"action_required" boolean DEFAULT false,
	"action_deadline" timestamp,
	"estimated_benefit" text,
	"confidence_score" numeric,
	"related_entities" jsonb,
	"status" text DEFAULT 'new',
	"acknowledged_by" varchar(255),
	"acknowledged_at" timestamp,
	"dismissed_by" varchar(255),
	"dismissed_at" timestamp,
	"dismissal_reason" text,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"metric_type" text NOT NULL,
	"data_source" text NOT NULL,
	"calculation" jsonb NOT NULL,
	"visualization_type" text NOT NULL,
	"target_value" numeric,
	"warning_threshold" numeric,
	"critical_threshold" numeric,
	"alert_enabled" boolean DEFAULT false,
	"alert_recipients" jsonb,
	"refresh_interval" integer DEFAULT 3600,
	"is_active" boolean DEFAULT true,
	"display_order" integer,
	"dashboard_layout" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"analysis_type" text NOT NULL,
	"data_source" text NOT NULL,
	"time_range" jsonb NOT NULL,
	"detected_trend" text,
	"trend_strength" numeric,
	"anomalies_detected" jsonb,
	"anomaly_count" integer DEFAULT 0,
	"seasonal_pattern" jsonb,
	"correlations" jsonb,
	"insights" text,
	"recommendations" jsonb,
	"statistical_tests" jsonb,
	"visualization_data" jsonb,
	"confidence" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"status" "push_delivery_status" DEFAULT 'pending' NOT NULL,
	"fcm_message_id" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"event_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_delivery" UNIQUE("notification_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "push_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"device_token" text NOT NULL,
	"platform" "push_platform" NOT NULL,
	"device_name" text,
	"device_model" text,
	"os_version" text,
	"app_version" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"timezone" text DEFAULT 'UTC',
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_devices_device_token_unique" UNIQUE("device_token"),
	CONSTRAINT "unique_device_per_profile" UNIQUE("profile_id","device_token")
);
--> statement-breakpoint
CREATE TABLE "push_notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"icon_url" text,
	"image_url" text,
	"badge_count" integer,
	"sound" text DEFAULT 'default',
	"click_action" text,
	"action_buttons" jsonb,
	"variables" jsonb,
	"priority" "push_priority" DEFAULT 'normal',
	"ttl" integer DEFAULT 86400,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"icon_url" text,
	"image_url" text,
	"badge_count" integer,
	"sound" text DEFAULT 'default',
	"click_action" text,
	"action_buttons" jsonb,
	"target_type" text NOT NULL,
	"target_criteria" jsonb,
	"device_ids" uuid[],
	"topics" text[],
	"status" "push_notification_status" DEFAULT 'draft' NOT NULL,
	"priority" "push_priority" DEFAULT 'normal',
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"timezone" text DEFAULT 'UTC',
	"ttl" integer DEFAULT 86400,
	"total_targeted" integer DEFAULT 0,
	"total_sent" integer DEFAULT 0,
	"total_delivered" integer DEFAULT 0,
	"total_failed" integer DEFAULT 0,
	"total_clicked" integer DEFAULT 0,
	"total_dismissed" integer DEFAULT 0,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"slug" varchar(200) NOT NULL,
	"title" varchar(500) NOT NULL,
	"excerpt" text,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" text[],
	"is_published" boolean DEFAULT false,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_content_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "campaign_type" NOT NULL,
	"channel" "campaign_channel" NOT NULL,
	"template_id" uuid,
	"segment_id" uuid,
	"segment_query" jsonb,
	"audience_count" integer DEFAULT 0,
	"subject" varchar(500),
	"body" text,
	"variables" jsonb DEFAULT '{}'::jsonb,
	"scheduled_at" timestamp with time zone,
	"send_immediately" boolean DEFAULT false,
	"timezone" varchar(50) DEFAULT 'America/Toronto',
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{"queued":0,"sent":0,"delivered":0,"bounced":0,"failed":0,"opened":0,"clicked":0,"unsubscribed":0}'::jsonb,
	"settings" jsonb DEFAULT '{"trackOpens":true,"trackClicks":true,"respectQuietHours":true,"quietHoursStart":"22:00","quietHoursEnd":"08:00","maxRetriesOnFail":3,"batchSize":100}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" text[],
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "campaign_channel" NOT NULL,
	"provider" varchar(50) NOT NULL,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"daily_limit" integer,
	"monthly_limit" integer,
	"current_daily_count" integer DEFAULT 0,
	"current_monthly_count" integer DEFAULT 0,
	"last_health_check" timestamp with time zone,
	"health_status" varchar(50) DEFAULT 'unknown',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"email_enabled" boolean DEFAULT true,
	"sms_enabled" boolean DEFAULT false,
	"push_enabled" boolean DEFAULT true,
	"phone_enabled" boolean DEFAULT false,
	"mail_enabled" boolean DEFAULT false,
	"categories" jsonb DEFAULT '{"campaign":true,"transactional":true,"alerts":true,"newsletters":true,"social":true}'::jsonb,
	"frequency" varchar(50) DEFAULT 'real_time',
	"quiet_hours" jsonb DEFAULT '{"enabled":false,"start":"22:00","end":"08:00","timezone":"America/Toronto"}'::jsonb,
	"globally_unsubscribed" boolean DEFAULT false,
	"unsubscribed_at" timestamp with time zone,
	"unsubscribe_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"consent_type" varchar(100) NOT NULL,
	"channel" "consent_channel" NOT NULL,
	"status" "consent_status" NOT NULL,
	"method" varchar(50),
	"consent_text" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid,
	"recipient_id" varchar(255) NOT NULL,
	"recipient_email" varchar(255),
	"recipient_phone" varchar(50),
	"recipient_name" varchar(255),
	"channel_type" "campaign_channel" NOT NULL,
	"provider" varchar(50),
	"provider_message_id" varchar(255),
	"subject" varchar(500),
	"body_snippet" text,
	"status" "message_delivery_status" DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"error_code" varchar(50),
	"retry_count" integer DEFAULT 0,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "campaign_channel" NOT NULL,
	"category" varchar(100),
	"subject" varchar(500),
	"body" text NOT NULL,
	"preheader" text,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"html_content" text,
	"plain_text_content" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" text[],
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"note_type" "field_note_type" NOT NULL,
	"subject" varchar(255),
	"content" text NOT NULL,
	"sentiment" "sentiment",
	"engagement_level" integer,
	"follow_up_date" date,
	"follow_up_completed" boolean DEFAULT false,
	"follow_up_completed_at" timestamp with time zone,
	"related_case_id" uuid,
	"related_grievance_id" uuid,
	"interaction_date" date,
	"tags" text[],
	"is_private" boolean DEFAULT false,
	"is_confidential" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_relationship_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"overall_score" integer DEFAULT 50,
	"engagement_score" integer DEFAULT 50,
	"relationship_score" integer DEFAULT 50,
	"activity_score" integer DEFAULT 50,
	"last_contact_date" date,
	"total_interactions" integer DEFAULT 0,
	"interactions_last_30_days" integer DEFAULT 0,
	"field_notes_count" integer DEFAULT 0,
	"positive_notes_count" integer DEFAULT 0,
	"negative_notes_count" integer DEFAULT 0,
	"average_sentiment" varchar(50),
	"current_sentiment" "sentiment",
	"is_at_risk" boolean DEFAULT false,
	"at_risk_reason" text,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_relationship_scores_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "organizer_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"assigned_to" varchar(255) NOT NULL,
	"assigned_by" varchar(255),
	"member_id" varchar(255),
	"related_case_id" uuid,
	"related_grievance_id" uuid,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"due_date" date,
	"estimated_minutes" integer,
	"actual_minutes" integer,
	"completed_at" timestamp with time zone,
	"completion_notes" text,
	"blocked_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" text[],
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"enrolled_by" varchar(255),
	"current_step" integer DEFAULT 1,
	"total_steps" integer NOT NULL,
	"completed_steps" integer DEFAULT 0,
	"status" "outreach_sequence_status" DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"next_step_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"trigger_type" varchar(50) NOT NULL,
	"trigger_conditions" jsonb DEFAULT '{}'::jsonb,
	"steps" jsonb NOT NULL,
	"status" "outreach_sequence_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true,
	"stats" jsonb DEFAULT '{"enrolled":0,"completed":0,"active":0,"cancelled":0}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" text[],
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_steps_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"status" "outreach_step_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"message_log_id" uuid,
	"task_id" uuid,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "communication_template_category" NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "employer_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"grievance_id" uuid,
	"type" "employer_communication_type" NOT NULL,
	"status" "employer_communication_status" DEFAULT 'draft' NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"summary" text,
	"sender_name" varchar(255) NOT NULL,
	"sender_user_id" uuid,
	"recipient_name" varchar(255) NOT NULL,
	"recipient_contact_id" uuid,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"attachments" jsonb,
	"template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "employer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "employer_contact_role" DEFAULT 'main' NOT NULL,
	"title" varchar(255),
	"email" varchar(320),
	"phone" varchar(30),
	"preferred_method" "employer_communication_type" DEFAULT 'email',
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "document_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_folder_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"folder_id" uuid,
	"name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"file_type" text NOT NULL,
	"mime_type" text,
	"description" text,
	"tags" text[],
	"category" text,
	"content_text" text,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"is_confidential" boolean DEFAULT false,
	"access_level" text DEFAULT 'standard',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "member_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text NOT NULL,
	"category" text DEFAULT 'General',
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"signing_order" integer DEFAULT 1 NOT NULL,
	"status" "signer_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"signature_type" "signature_type",
	"signature_image_url" text,
	"authentication_method" "authentication_method",
	"authenticated_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"reassigned_to" text,
	"reassigned_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"geolocation" jsonb,
	"provider_signer_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"signer_id" uuid,
	"event_type" text NOT NULL,
	"event_description" text NOT NULL,
	"actor_user_id" text,
	"actor_email" text,
	"actor_role" text,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"geolocation" jsonb,
	"metadata" jsonb,
	"hash_chain" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"document_type" text NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"file_hash" text NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"provider_document_id" text,
	"provider_envelope_id" text,
	"status" "signature_document_status" DEFAULT 'draft' NOT NULL,
	"sent_by" text NOT NULL,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"voided_at" timestamp,
	"voided_by" text,
	"void_reason" text,
	"expires_at" timestamp,
	"reminder_schedule" jsonb,
	"require_authentication" boolean DEFAULT false NOT NULL,
	"authentication_method" "authentication_method",
	"access_code" text,
	"sequential_signing" boolean DEFAULT false NOT NULL,
	"allow_decline" boolean DEFAULT true NOT NULL,
	"allow_reassign" boolean DEFAULT false NOT NULL,
	"template_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"template_file_url" text NOT NULL,
	"template_file_name" text NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"provider_template_id" text,
	"signature_fields" jsonb NOT NULL,
	"default_settings" jsonb,
	"signer_roles" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_webhooks_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"event_type" text NOT NULL,
	"document_id" uuid,
	"provider_document_id" text,
	"payload" jsonb NOT NULL,
	"headers" jsonb,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"signature" text,
	"signature_verified" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"signer_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"event_description" text,
	"ip_address" varchar,
	"user_agent" text,
	"location" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"external_event_id" varchar(255),
	"provider_data" jsonb,
	"signature_id" varchar(255),
	"certificate_info" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"signer_id" uuid NOT NULL,
	"signature_hash" varchar(255) NOT NULL,
	"certificate_hash" varchar(255),
	"is_verified" boolean DEFAULT false,
	"verification_method" varchar(100),
	"verification_result" jsonb,
	"certificate_chain" jsonb,
	"certificate_valid_from" timestamp,
	"certificate_valid_to" timestamp,
	"certificate_issuer" text,
	"tamper_detected" boolean DEFAULT false,
	"tamper_details" text,
	"signature_file" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"verified_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "signature_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "signature_workflow_status" DEFAULT 'draft' NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"external_envelope_id" varchar(255) NOT NULL,
	"external_workflow_id" varchar(255),
	"total_signers" integer NOT NULL,
	"completed_signatures" integer DEFAULT 0,
	"sent_at" timestamp,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"reminder_frequency_days" integer DEFAULT 3,
	"last_reminder_sent_at" timestamp,
	"auto_reminders_enabled" boolean DEFAULT true,
	"workflow_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"voided_at" timestamp,
	"voided_by" varchar(255),
	"void_reason" text,
	CONSTRAINT "signature_workflows_external_envelope_id_unique" UNIQUE("external_envelope_id")
);
--> statement-breakpoint
CREATE TABLE "signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"member_id" varchar(255),
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"signer_order" integer NOT NULL,
	"status" "signer_status" DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"external_signer_id" varchar(255),
	"signing_url" varchar(500),
	"signature_image" text,
	"ip_address" varchar,
	"user_agent" text,
	"last_reminder_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"location_url" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"timezone" varchar(100) DEFAULT 'America/New_York',
	"is_all_day" boolean DEFAULT false,
	"is_recurring" boolean DEFAULT false,
	"recurrence_rule" text,
	"recurrence_exceptions" jsonb,
	"parent_event_id" uuid,
	"event_type" "event_type" DEFAULT 'meeting',
	"status" "event_status" DEFAULT 'scheduled',
	"priority" varchar(20) DEFAULT 'normal',
	"claim_id" text,
	"case_number" text,
	"member_id" text,
	"meeting_room_id" uuid,
	"meeting_url" text,
	"meeting_password" text,
	"agenda" text,
	"organizer_id" text NOT NULL,
	"reminders" jsonb DEFAULT '[15]'::jsonb,
	"external_event_id" text,
	"external_provider" varchar(50),
	"external_html_link" text,
	"last_sync_at" timestamp,
	"is_private" boolean DEFAULT false,
	"visibility" varchar(20) DEFAULT 'default',
	"metadata" jsonb,
	"attachments" jsonb,
	"created_by" text NOT NULL,
	"cancelled_at" timestamp,
	"cancelled_by" text,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sharing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"shared_with_user_id" text,
	"shared_with_email" text,
	"shared_with_role" varchar(50),
	"permission" "calendar_permission" DEFAULT 'viewer',
	"can_create_events" boolean DEFAULT false,
	"can_edit_events" boolean DEFAULT false,
	"can_delete_events" boolean DEFAULT false,
	"can_share" boolean DEFAULT false,
	"invited_by" text NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#3B82F6',
	"icon" varchar(50),
	"owner_id" text NOT NULL,
	"is_personal" boolean DEFAULT true,
	"is_shared" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"external_provider" varchar(50),
	"external_calendar_id" text,
	"sync_enabled" boolean DEFAULT false,
	"last_sync_at" timestamp,
	"sync_status" "sync_status" DEFAULT 'disconnected',
	"sync_token" text,
	"timezone" varchar(100) DEFAULT 'America/New_York',
	"default_event_duration" integer DEFAULT 60,
	"reminder_default_minutes" integer DEFAULT 15,
	"allow_overlap" boolean DEFAULT true,
	"require_approval" boolean DEFAULT false,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text,
	"status" "attendee_status" DEFAULT 'invited',
	"is_optional" boolean DEFAULT false,
	"is_organizer" boolean DEFAULT false,
	"responded_at" timestamp,
	"response_comment" text,
	"notification_sent" boolean DEFAULT false,
	"last_notification_at" timestamp,
	"external_attendee_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"reminder_minutes" integer NOT NULL,
	"reminder_type" varchar(20) DEFAULT 'notification',
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" varchar(20) DEFAULT 'pending',
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_email" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"scope" text,
	"sync_enabled" boolean DEFAULT true,
	"sync_direction" varchar(20) DEFAULT 'both',
	"last_sync_at" timestamp,
	"next_sync_at" timestamp,
	"sync_status" "sync_status" DEFAULT 'synced',
	"sync_error" text,
	"sync_past_days" integer DEFAULT 30,
	"sync_future_days" integer DEFAULT 365,
	"sync_only_free_time" boolean DEFAULT false,
	"calendar_mappings" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"description" text,
	"building_name" varchar(200),
	"floor" varchar(50),
	"room_number" varchar(50),
	"address" text,
	"capacity" integer DEFAULT 10,
	"features" jsonb,
	"equipment" jsonb,
	"status" "room_status" DEFAULT 'available',
	"is_active" boolean DEFAULT true,
	"requires_approval" boolean DEFAULT false,
	"min_booking_duration" integer DEFAULT 30,
	"max_booking_duration" integer DEFAULT 480,
	"advance_booking_days" integer DEFAULT 90,
	"operating_hours" jsonb,
	"allowed_user_roles" jsonb,
	"blocked_dates" jsonb,
	"contact_person_id" text,
	"contact_email" text,
	"contact_phone" varchar(20),
	"image_url" text,
	"floor_plan_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"event_id" uuid,
	"organization_id" uuid NOT NULL,
	"booked_by" text NOT NULL,
	"booked_for" text,
	"purpose" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"setup_required" boolean DEFAULT false,
	"setup_time" integer DEFAULT 0,
	"catering_required" boolean DEFAULT false,
	"catering_notes" text,
	"special_requests" text,
	"status" "event_status" DEFAULT 'scheduled',
	"requires_approval" boolean DEFAULT false,
	"approved_by" text,
	"approved_at" timestamp,
	"approval_notes" text,
	"checked_in_at" timestamp,
	"checked_in_by" text,
	"checked_out_at" timestamp,
	"actual_end_time" timestamp,
	"cancelled_at" timestamp,
	"cancelled_by" text,
	"cancellation_reason" text,
	"attendee_count" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"course_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"registration_date" timestamp with time zone DEFAULT now(),
	"registration_status" varchar(50) DEFAULT 'registered',
	"requires_approval" boolean DEFAULT false,
	"approved_by" varchar(255),
	"approved_date" date,
	"approval_notes" text,
	"attended" boolean DEFAULT false,
	"attendance_dates" jsonb,
	"attendance_hours" numeric(5, 2),
	"completed" boolean DEFAULT false,
	"completion_date" date,
	"completion_percentage" numeric(5, 2) DEFAULT '0.00',
	"pre_test_score" numeric(5, 2),
	"post_test_score" numeric(5, 2),
	"final_grade" varchar(10),
	"passed" boolean,
	"certificate_issued" boolean DEFAULT false,
	"certificate_number" varchar(100),
	"certificate_issue_date" date,
	"certificate_url" text,
	"evaluation_completed" boolean DEFAULT false,
	"evaluation_rating" numeric(3, 2),
	"evaluation_comments" text,
	"evaluation_submitted_date" date,
	"travel_required" boolean DEFAULT false,
	"travel_subsidy_requested" boolean DEFAULT false,
	"travel_subsidy_approved" boolean DEFAULT false,
	"travel_subsidy_amount" numeric(10, 2),
	"accommodation_required" boolean DEFAULT false,
	"course_fee" numeric(10, 2) DEFAULT '0.00',
	"fee_paid" boolean DEFAULT false,
	"fee_payment_date" date,
	"fee_waived" boolean DEFAULT false,
	"fee_waiver_reason" text,
	"cancellation_date" date,
	"cancellation_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"session_code" varchar(50) NOT NULL,
	"session_name" varchar(300),
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"session_times" jsonb,
	"delivery_method" varchar(50) NOT NULL,
	"venue_name" varchar(200),
	"venue_address" text,
	"room_number" varchar(50),
	"virtual_meeting_url" text,
	"virtual_meeting_access_code" varchar(50),
	"lead_instructor_id" varchar(255),
	"lead_instructor_name" varchar(200),
	"co_instructors" jsonb,
	"registration_open_date" date,
	"registration_close_date" date,
	"registration_count" integer DEFAULT 0,
	"waitlist_count" integer DEFAULT 0,
	"max_enrollment" integer,
	"session_status" varchar(50) DEFAULT 'scheduled',
	"attendees_count" integer DEFAULT 0,
	"completions_count" integer DEFAULT 0,
	"completion_rate" numeric(5, 2),
	"average_rating" numeric(3, 2),
	"evaluation_responses_count" integer DEFAULT 0,
	"session_budget" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"travel_subsidy_offered" boolean DEFAULT false,
	"accommodation_arranged" boolean DEFAULT false,
	"accommodation_hotel" varchar(200),
	"materials_prepared" boolean DEFAULT false,
	"materials_distributed_count" integer DEFAULT 0,
	"cancellation_reason" text,
	"cancelled_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(255),
	CONSTRAINT "course_sessions_session_code_key" UNIQUE("session_code")
);
--> statement-breakpoint
CREATE TABLE "member_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"certification_name" varchar(200) NOT NULL,
	"certification_type" varchar(100),
	"issued_by_organization" varchar(200),
	"certification_number" varchar(100),
	"issue_date" date NOT NULL,
	"expiry_date" date,
	"valid_years" integer,
	"certification_status" varchar(50) DEFAULT 'active',
	"course_id" uuid,
	"session_id" uuid,
	"registration_id" uuid,
	"renewal_required" boolean DEFAULT false,
	"renewal_date" date,
	"renewal_course_id" uuid,
	"verified" boolean DEFAULT true,
	"verification_date" date,
	"verified_by" varchar(255),
	"certificate_url" text,
	"digital_badge_url" text,
	"clc_registered" boolean DEFAULT false,
	"clc_registration_number" varchar(100),
	"clc_registration_date" date,
	"revoked" boolean DEFAULT false,
	"revocation_date" date,
	"revocation_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "member_certifications_certification_number_key" UNIQUE("certification_number")
);
--> statement-breakpoint
CREATE TABLE "program_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"program_id" uuid NOT NULL,
	"enrollment_date" date NOT NULL,
	"enrollment_status" varchar(50) DEFAULT 'enrolled',
	"courses_completed" jsonb,
	"courses_completed_count" integer DEFAULT 0,
	"electives_completed_count" integer DEFAULT 0,
	"progress_percentage" numeric(5, 2) DEFAULT '0.00',
	"completed" boolean DEFAULT false,
	"completion_date" date,
	"certification_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"course_code" varchar(50) NOT NULL,
	"course_name" varchar(300) NOT NULL,
	"course_description" text,
	"course_category" varchar(50) NOT NULL,
	"delivery_method" varchar(50) NOT NULL,
	"course_difficulty" varchar(20) DEFAULT 'all_levels',
	"duration_hours" numeric(5, 2),
	"duration_days" integer,
	"has_prerequisites" boolean DEFAULT false,
	"prerequisite_courses" jsonb,
	"prerequisite_certifications" jsonb,
	"learning_objectives" text,
	"course_outline" jsonb,
	"course_materials_url" text,
	"presentation_slides_url" text,
	"workbook_url" text,
	"additional_resources" jsonb,
	"primary_instructor_name" varchar(200),
	"instructor_ids" jsonb,
	"min_enrollment" integer DEFAULT 5,
	"max_enrollment" integer DEFAULT 30,
	"provides_certification" boolean DEFAULT false,
	"certification_name" varchar(200),
	"certification_valid_years" integer,
	"clc_approved" boolean DEFAULT false,
	"clc_approval_date" date,
	"clc_course_code" varchar(50),
	"course_fee" numeric(10, 2) DEFAULT '0.00',
	"materials_fee" numeric(10, 2) DEFAULT '0.00',
	"travel_subsidy_available" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"is_mandatory" boolean DEFAULT false,
	"mandatory_for_roles" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(255),
	CONSTRAINT "training_courses_course_code_key" UNIQUE("course_code")
);
--> statement-breakpoint
CREATE TABLE "training_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"program_name" varchar(200) NOT NULL,
	"program_description" text,
	"program_duration" varchar(100),
	"required_courses" jsonb,
	"elective_courses" jsonb,
	"minimum_required_courses" integer,
	"minimum_elective_courses" integer,
	"provides_certification" boolean DEFAULT false,
	"certification_name" varchar(200),
	"clc_approved" boolean DEFAULT false,
	"clc_approval_date" date,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "data_subject_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"request_type" varchar(50) NOT NULL,
	"province" varchar(2) NOT NULL,
	"request_description" text,
	"requested_data_types" jsonb,
	"identity_verified" boolean DEFAULT false NOT NULL,
	"verification_method" varchar(50),
	"verified_at" timestamp,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar(255),
	"response_deadline" timestamp NOT NULL,
	"responded_at" timestamp,
	"deadline_met" boolean DEFAULT false NOT NULL,
	"denial_reason" text,
	"denial_legal_basis" text,
	"response_method" varchar(50),
	"response_delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_breaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"breach_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"affected_province" varchar(2),
	"affected_user_count" varchar(20) DEFAULT '0' NOT NULL,
	"data_types" jsonb NOT NULL,
	"breach_description" text NOT NULL,
	"discovered_at" timestamp NOT NULL,
	"contained_at" timestamp,
	"user_notification_required" boolean DEFAULT true NOT NULL,
	"regulator_notification_required" boolean DEFAULT true NOT NULL,
	"users_notified_at" timestamp,
	"regulator_notified_at" timestamp,
	"notification_deadline" timestamp NOT NULL,
	"deadline_met" boolean DEFAULT false NOT NULL,
	"mitigation_steps" jsonb,
	"mitigation_completed_at" timestamp,
	"incident_report" text,
	"reported_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provincial_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"province" varchar(2) NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"consent_given" boolean NOT NULL,
	"consent_method" varchar(50) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"consent_text" text NOT NULL,
	"consent_language" varchar(2) DEFAULT 'en' NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provincial_data_handling" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"province" varchar(2) NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"data_category" varchar(50) NOT NULL,
	"purpose" text NOT NULL,
	"legal_basis" varchar(50) NOT NULL,
	"shared_with" text,
	"sharing_agreement_id" uuid,
	"performed_by" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provincial_privacy_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"province" varchar(2) NOT NULL,
	"law_name" text NOT NULL,
	"consent_required" boolean DEFAULT true NOT NULL,
	"explicit_opt_in" boolean DEFAULT false NOT NULL,
	"data_retention_days" varchar(10) DEFAULT '365' NOT NULL,
	"breach_notification_hours" varchar(10) DEFAULT '72' NOT NULL,
	"right_to_erasure" boolean DEFAULT true NOT NULL,
	"right_to_portability" boolean DEFAULT true NOT NULL,
	"dpo_required" boolean DEFAULT false NOT NULL,
	"pia_required" boolean DEFAULT false NOT NULL,
	"custom_rules" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cookie_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"organization_id" uuid NOT NULL,
	"essential" boolean DEFAULT true NOT NULL,
	"functional" boolean DEFAULT false NOT NULL,
	"analytics" boolean DEFAULT false NOT NULL,
	"marketing" boolean DEFAULT false NOT NULL,
	"consent_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cookie_consents_consent_id_unique" UNIQUE("consent_id")
);
--> statement-breakpoint
CREATE TABLE "data_anonymization_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"operation_type" text NOT NULL,
	"reason" text NOT NULL,
	"request_id" uuid,
	"tables_affected" jsonb NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"executed_by" text NOT NULL,
	"verified_at" timestamp,
	"verified_by" text,
	"can_reverse" boolean DEFAULT false NOT NULL,
	"backup_location" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_processing_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"activity_name" text NOT NULL,
	"processing_purpose" "processing_purpose" NOT NULL,
	"legal_basis" text NOT NULL,
	"data_categories" jsonb NOT NULL,
	"data_subjects" jsonb NOT NULL,
	"recipients" jsonb,
	"retention_period" text NOT NULL,
	"deletion_procedure" text,
	"security_measures" jsonb,
	"dpo_contact" text,
	"last_reviewed" timestamp DEFAULT now() NOT NULL,
	"next_review_due" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"policy_name" text NOT NULL,
	"data_type" text NOT NULL,
	"retention_period_days" text NOT NULL,
	"conditions" jsonb,
	"action_on_expiry" text NOT NULL,
	"archive_location" text,
	"legal_requirement" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_executed" timestamp,
	"next_execution" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gdpr_data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_type" "gdpr_request_type" NOT NULL,
	"status" "gdpr_request_status" DEFAULT 'pending' NOT NULL,
	"request_details" jsonb,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"completed_at" timestamp,
	"verification_method" text,
	"verified_at" timestamp,
	"verified_by" text,
	"response_data" jsonb,
	"deadline" timestamp NOT NULL,
	"rejection_reason" text,
	"processed_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"status" "consent_status" DEFAULT 'granted' NOT NULL,
	"legal_basis" text NOT NULL,
	"processing_purpose" "processing_purpose" NOT NULL,
	"consent_version" text NOT NULL,
	"consent_text" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"withdrawn_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofence_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"geofence_id" uuid NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"event_time" timestamp DEFAULT now() NOT NULL,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"expires_at" timestamp NOT NULL,
	"purpose" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"geofence_type" varchar(50) NOT NULL,
	"center_latitude" numeric(10, 8) NOT NULL,
	"center_longitude" numeric(11, 8) NOT NULL,
	"radius_meters" numeric(10, 2) NOT NULL,
	"strike_id" uuid,
	"union_local_id" uuid,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"active_from" timestamp,
	"active_to" timestamp,
	"notify_on_entry" boolean DEFAULT false NOT NULL,
	"notify_on_exit" boolean DEFAULT false NOT NULL,
	"requires_explicit_consent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_deletion_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deletion_type" varchar(50) NOT NULL,
	"deletion_reason" text,
	"record_count" varchar(20) NOT NULL,
	"oldest_record_date" timestamp,
	"newest_record_date" timestamp,
	"initiated_by" varchar(255),
	"initiator_role" varchar(50),
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"accuracy" numeric(10, 2),
	"altitude" numeric(10, 2),
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"auto_delete_scheduled" boolean DEFAULT true NOT NULL,
	"tracking_type" varchar(50) DEFAULT 'foreground_only' NOT NULL,
	"purpose" text NOT NULL,
	"activity_type" varchar(50),
	"strike_id" uuid,
	"event_id" uuid,
	"shared_with_union" boolean DEFAULT false NOT NULL,
	"aggregated_only" boolean DEFAULT true NOT NULL,
	"device_type" varchar(50),
	"app_version" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_tracking_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_description" text,
	"performed_by" varchar(255),
	"performed_by_role" varchar(50),
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_tracking_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_tracking_enabled" boolean DEFAULT true NOT NULL,
	"max_retention_hours" varchar(10) DEFAULT '24' NOT NULL,
	"background_tracking_allowed" boolean DEFAULT false NOT NULL,
	"background_tracking_reason" text,
	"explicit_opt_in_required" boolean DEFAULT true NOT NULL,
	"consent_renewal_months" varchar(10) DEFAULT '6' NOT NULL,
	"auto_deletion_enabled" boolean DEFAULT true NOT NULL,
	"auto_deletion_schedule" varchar(50) DEFAULT 'hourly' NOT NULL,
	"compliance_review_required" boolean DEFAULT true NOT NULL,
	"last_compliance_review" timestamp,
	"next_compliance_review_due" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "member_location_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"consent_status" varchar(20) DEFAULT 'never_asked' NOT NULL,
	"opted_in_at" timestamp,
	"opted_out_at" timestamp,
	"consent_purpose" text NOT NULL,
	"purpose_description" text,
	"foreground_only" boolean DEFAULT true NOT NULL,
	"allowed_during_strike" boolean DEFAULT false NOT NULL,
	"allowed_during_events" boolean DEFAULT false NOT NULL,
	"can_revoke_anytime" boolean DEFAULT true NOT NULL,
	"data_retention_hours" varchar(10) DEFAULT '24' NOT NULL,
	"auto_delete_enabled" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"renewal_required" boolean DEFAULT true NOT NULL,
	"last_renewal_reminder" timestamp,
	"consent_text" text NOT NULL,
	"consent_version" varchar(10) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "member_location_consent_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "band_council_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_council_id" uuid NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"consent_given" boolean NOT NULL,
	"bcr_number" varchar(50),
	"bcr_date" timestamp,
	"bcr_document" text,
	"purpose_of_collection" text NOT NULL,
	"data_categories" jsonb NOT NULL,
	"intended_use" text NOT NULL,
	"expires_at" timestamp,
	"restricted_to_members" boolean DEFAULT true NOT NULL,
	"anonymization_required" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"revocation_reason" text,
	"approved_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "band_councils" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_name" text NOT NULL,
	"band_number" varchar(10) NOT NULL,
	"province" varchar(2) NOT NULL,
	"region" varchar(50) NOT NULL,
	"chief_name" text,
	"admin_contact_name" text,
	"admin_contact_email" varchar(255),
	"admin_contact_phone" varchar(20),
	"on_reserve_storage_enabled" boolean DEFAULT false NOT NULL,
	"storage_location" text,
	"data_residency_required" boolean DEFAULT true NOT NULL,
	"third_party_access_allowed" boolean DEFAULT false NOT NULL,
	"aggregation_allowed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "band_councils_band_number_unique" UNIQUE("band_number")
);
--> statement-breakpoint
CREATE TABLE "indigenous_data_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"accessed_by" varchar(255) NOT NULL,
	"band_council_id" uuid,
	"access_type" varchar(50) NOT NULL,
	"access_purpose" text NOT NULL,
	"data_categories" jsonb NOT NULL,
	"authorized_by" varchar(50) NOT NULL,
	"authorization_reference" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indigenous_data_sharing_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_council_id" uuid NOT NULL,
	"partner_name" text NOT NULL,
	"partner_type" varchar(50) NOT NULL,
	"agreement_title" text NOT NULL,
	"agreement_description" text NOT NULL,
	"agreement_document" text,
	"signed_date" timestamp,
	"data_sharing_scope" jsonb NOT NULL,
	"purpose_limitation" text NOT NULL,
	"anonymization_required" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_until" timestamp,
	"auto_renewal" boolean DEFAULT false NOT NULL,
	"approved_by" varchar(255) NOT NULL,
	"bcr_number" varchar(50),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"terminated_at" timestamp,
	"termination_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indigenous_member_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"indigenous_status" varchar(50) NOT NULL,
	"band_council_id" uuid,
	"treaty_number" varchar(20),
	"cultural_data_sensitivity" varchar(20) DEFAULT 'standard' NOT NULL,
	"traditional_knowledge_holder" boolean DEFAULT false NOT NULL,
	"elder_status" boolean DEFAULT false NOT NULL,
	"data_control_preference" varchar(50) DEFAULT 'band_council' NOT NULL,
	"allow_aggregation" boolean DEFAULT false NOT NULL,
	"allow_third_party_access" boolean DEFAULT false NOT NULL,
	"on_reserve_data_only" boolean DEFAULT false NOT NULL,
	"preferred_storage_location" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "indigenous_member_data_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "traditional_knowledge_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_council_id" uuid NOT NULL,
	"knowledge_type" varchar(50) NOT NULL,
	"knowledge_title" text NOT NULL,
	"knowledge_description" text,
	"sensitivity_level" varchar(20) NOT NULL,
	"gender_restricted" boolean DEFAULT false NOT NULL,
	"age_restricted" boolean DEFAULT false NOT NULL,
	"primary_keeper_user_id" varchar(255),
	"secondary_keepers" jsonb,
	"public_access" boolean DEFAULT false NOT NULL,
	"member_only_access" boolean DEFAULT true NOT NULL,
	"elder_approval_required" boolean DEFAULT false NOT NULL,
	"documentation_url" text,
	"video_url" text,
	"audio_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foreign_workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone_number" text,
	"work_permit_number" text NOT NULL,
	"work_permit_expiry" timestamp NOT NULL,
	"country_of_origin" text NOT NULL,
	"employer_id" uuid NOT NULL,
	"position_title" text NOT NULL,
	"noc_code" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"immigration_pathway" text NOT NULL,
	"lmia_number" text,
	"gss_category" text,
	"requires_lmbp" boolean DEFAULT false,
	"lmbp_letter_generated" boolean DEFAULT false,
	"lmbp_letter_date" timestamp,
	"skills_transfer_plan" jsonb,
	"mentorship_start_date" timestamp,
	"mentorship_end_date" timestamp,
	"compliance_status" text DEFAULT 'pending' NOT NULL,
	"last_compliance_check" timestamp,
	"compliance_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "foreign_workers_email_unique" UNIQUE("email"),
	CONSTRAINT "foreign_workers_work_permit_number_unique" UNIQUE("work_permit_number")
);
--> statement-breakpoint
CREATE TABLE "gss_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"foreign_worker_id" uuid NOT NULL,
	"application_number" text NOT NULL,
	"submission_date" timestamp NOT NULL,
	"gss_category" text NOT NULL,
	"expected_decision_date" timestamp NOT NULL,
	"actual_decision_date" timestamp,
	"processing_days" integer,
	"met_2_week_target" boolean,
	"status" text DEFAULT 'submitted' NOT NULL,
	"decision_details" jsonb,
	"documents" jsonb,
	"employer_id" uuid NOT NULL,
	"position_details" jsonb,
	"compliance_flags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "gss_applications_application_number_unique" UNIQUE("application_number")
);
--> statement-breakpoint
CREATE TABLE "lmbp_compliance_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"foreign_worker_id" uuid,
	"employer_id" uuid,
	"lmbp_letter_id" uuid,
	"gss_application_id" uuid,
	"mentorship_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recommended_action" text,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"resolved_at" timestamp,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" varchar(255),
	"email_sent" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"dashboard_notified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lmbp_compliance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lmbp_letter_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"reporting_period_start" timestamp NOT NULL,
	"reporting_period_end" timestamp NOT NULL,
	"submitted_to_ircc" boolean DEFAULT false,
	"submission_date" timestamp,
	"ircc_confirmation_number" text,
	"commitment_progress" jsonb NOT NULL,
	"total_foreign_workers" integer NOT NULL,
	"total_mentorships" integer NOT NULL,
	"mentorships_completed" integer NOT NULL,
	"canadian_workers_hired" integer NOT NULL,
	"training_investment" numeric(10, 2),
	"compliance_rating" text,
	"ircc_feedback" text,
	"corrective_actions_required" jsonb,
	"report_pdf_url" text,
	"supporting_documents_urls" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "lmbp_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"employer_name" text NOT NULL,
	"letter_number" text NOT NULL,
	"generated_date" timestamp NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_until" timestamp NOT NULL,
	"commitments" jsonb NOT NULL,
	"foreign_worker_ids" jsonb NOT NULL,
	"compliance_report_due" timestamp,
	"last_compliance_report" timestamp,
	"compliance_status" text DEFAULT 'active',
	"letter_pdf_url" text,
	"letter_pdf_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "lmbp_letters_letter_number_unique" UNIQUE("letter_number")
);
--> statement-breakpoint
CREATE TABLE "mentorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentee_id" uuid NOT NULL,
	"mentee_name" text NOT NULL,
	"mentor_id" uuid NOT NULL,
	"mentor_name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"actual_end_date" timestamp,
	"skills_to_transfer" jsonb NOT NULL,
	"learning_objectives" jsonb,
	"meeting_frequency" text,
	"total_meetings" integer DEFAULT 0,
	"last_meeting_date" timestamp,
	"completion_percentage" integer DEFAULT 0,
	"canadian_worker_trained" boolean DEFAULT false,
	"knowledge_transfer_documented" boolean DEFAULT false,
	"status" text DEFAULT 'active' NOT NULL,
	"status_reason" text,
	"employer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "break_glass_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"emergency_id" uuid NOT NULL,
	"activation_initiated_at" timestamp NOT NULL,
	"activation_approved_at" timestamp,
	"activation_reason" text NOT NULL,
	"key_holder_ids" jsonb,
	"secret_shares" jsonb,
	"required_signatures" integer DEFAULT 3 NOT NULL,
	"signatures_received" integer DEFAULT 0 NOT NULL,
	"signature_1_user_id" varchar(255),
	"signature_1_timestamp" timestamp,
	"signature_1_ip_address" varchar(45),
	"signature_2_user_id" varchar(255),
	"signature_2_timestamp" timestamp,
	"signature_2_ip_address" varchar(45),
	"signature_3_user_id" varchar(255),
	"signature_3_timestamp" timestamp,
	"signature_3_ip_address" varchar(45),
	"recovery_actions_log" jsonb,
	"swiss_cold_storage_accessed" boolean DEFAULT false NOT NULL,
	"cold_storage_accessed_at" timestamp,
	"incident_report_url" text,
	"lessons_learned_url" text,
	"system_updates_required" jsonb,
	"audited_at" timestamp,
	"audited_by" varchar(255),
	"audit_report" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "break_glass_system" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_type" varchar(50) NOT NULL,
	"scenario_description" text NOT NULL,
	"recovery_plan_document" text,
	"estimated_recovery_time" varchar(50) NOT NULL,
	"shamir_threshold" integer DEFAULT 3 NOT NULL,
	"shamir_total_shares" integer DEFAULT 5 NOT NULL,
	"key_holder_id_1" varchar(255),
	"key_holder_id_2" varchar(255),
	"key_holder_id_3" varchar(255),
	"key_holder_id_4" varchar(255),
	"key_holder_id_5" varchar(255),
	"emergency_contact_1_name" text,
	"emergency_contact_1_phone" varchar(20),
	"emergency_contact_1_email" varchar(255),
	"emergency_contact_2_name" text,
	"emergency_contact_2_phone" varchar(20),
	"emergency_contact_2_email" varchar(255),
	"last_tested_at" timestamp,
	"testing_frequency" varchar(50) DEFAULT 'quarterly' NOT NULL,
	"next_test_due" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disaster_recovery_drills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drill_name" text NOT NULL,
	"drill_type" varchar(50) NOT NULL,
	"scenario_type" varchar(50) NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"actual_start_time" timestamp,
	"actual_end_time" timestamp,
	"duration" varchar(50),
	"participants" jsonb NOT NULL,
	"participant_count" integer NOT NULL,
	"objectives" jsonb NOT NULL,
	"objectives_met" jsonb,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"overall_score" integer,
	"target_recovery_time" varchar(50) NOT NULL,
	"actual_recovery_time" varchar(50),
	"recovery_time_objective_met" boolean DEFAULT false NOT NULL,
	"issues_identified" jsonb,
	"remediation_actions" jsonb,
	"remediation_deadline" timestamp,
	"drill_report_url" text,
	"video_recording_url" text,
	"conducted_by" varchar(255) NOT NULL,
	"approved_by" varchar(255),
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"emergency_type" varchar(50) NOT NULL,
	"severity_level" varchar(20) DEFAULT 'medium' NOT NULL,
	"declared_by_user_id" varchar(255) NOT NULL,
	"declared_at" timestamp NOT NULL,
	"notes" text,
	"affected_locations" jsonb,
	"affected_member_count" integer DEFAULT 0,
	"resolved_at" timestamp,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"break_glass_activated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_holder_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"key_holder_number" integer NOT NULL,
	"shamir_share_encrypted" text NOT NULL,
	"shamir_share_fingerprint" varchar(64) NOT NULL,
	"key_issued_at" timestamp NOT NULL,
	"key_expires_at" timestamp,
	"key_rotation_due" timestamp NOT NULL,
	"break_glass_training_completed" boolean DEFAULT false NOT NULL,
	"training_completed_at" timestamp,
	"training_expires_at" timestamp,
	"emergency_phone" varchar(20) NOT NULL,
	"emergency_email" varchar(255) NOT NULL,
	"backup_contact_name" text,
	"backup_contact_phone" varchar(20),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_verified_at" timestamp,
	"next_verification_due" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "key_holder_registry_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "recovery_time_objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_component" varchar(100) NOT NULL,
	"component_description" text,
	"rto_hours" integer NOT NULL,
	"rpo_hours" integer NOT NULL,
	"depends_on" jsonb,
	"criticality_level" varchar(20) NOT NULL,
	"last_tested_at" timestamp,
	"last_test_result" varchar(20),
	"actual_recovery_time" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swiss_cold_storage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_provider" varchar(100) NOT NULL,
	"vault_location" text NOT NULL,
	"vault_account_number" varchar(100),
	"storage_type" varchar(50) NOT NULL,
	"data_category" varchar(50) NOT NULL,
	"last_updated" timestamp NOT NULL,
	"encryption_algorithm" varchar(50) DEFAULT 'AES-256-GCM' NOT NULL,
	"encrypted_by" varchar(255) NOT NULL,
	"access_requires_multi_sig" boolean DEFAULT true NOT NULL,
	"minimum_signatures" integer DEFAULT 3 NOT NULL,
	"total_key_holders" integer DEFAULT 5 NOT NULL,
	"last_accessed_at" timestamp,
	"last_accessed_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_justification_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"request_date" timestamp DEFAULT now() NOT NULL,
	"requested_by" text NOT NULL,
	"requested_by_email" text NOT NULL,
	"requested_by_role" text NOT NULL,
	"data_type_requested" text NOT NULL,
	"data_type_id" text,
	"justification" text NOT NULL,
	"business_purpose" text,
	"request_status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_decision" text,
	"review_notes" text,
	"approval_expiry_date" timestamp,
	"access_granted_at" timestamp,
	"access_revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_classification_policy" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_name" text NOT NULL,
	"policy_description" text,
	"effective_date" timestamp NOT NULL,
	"expiry_date" timestamp,
	"enforce_strict_separation" boolean DEFAULT true NOT NULL,
	"allow_bargaining_unit_roster" boolean DEFAULT true,
	"allow_grievance_participation" boolean DEFAULT true,
	"block_strike_plans" boolean DEFAULT true NOT NULL,
	"block_membership_lists" boolean DEFAULT true NOT NULL,
	"block_internal_discussions" boolean DEFAULT true NOT NULL,
	"approved_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_classification_registry" (
	"id" text PRIMARY KEY NOT NULL,
	"data_type" text NOT NULL,
	"classification_level" text NOT NULL,
	"accessible_by_employer" boolean DEFAULT false NOT NULL,
	"accessible_by_union" boolean DEFAULT true NOT NULL,
	"requires_justification" boolean DEFAULT false,
	"data_description" text,
	"legal_basis" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employer_access_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"attempt_timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text NOT NULL,
	"user_role" text NOT NULL,
	"data_type_requested" text NOT NULL,
	"data_type_id" text,
	"access_granted" boolean DEFAULT false NOT NULL,
	"denial_reason" text,
	"justification_provided" text,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"flagged_for_review" boolean DEFAULT false,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_notes" text
);
--> statement-breakpoint
CREATE TABLE "firewall_access_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_name" text NOT NULL,
	"data_type_id" text NOT NULL,
	"user_role" text NOT NULL,
	"access_permitted" boolean DEFAULT false NOT NULL,
	"access_level" text,
	"justification_required" boolean DEFAULT false,
	"requires_approval" boolean DEFAULT false,
	"approver_role" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firewall_compliance_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_date" timestamp DEFAULT now() NOT NULL,
	"audit_period" text NOT NULL,
	"total_access_attempts" text NOT NULL,
	"total_employer_attempts" text NOT NULL,
	"total_denied_access" text NOT NULL,
	"total_violations" text NOT NULL,
	"critical_violations" text NOT NULL,
	"compliance_rate" text NOT NULL,
	"top_violated_data_types" jsonb,
	"recommended_actions" text,
	"audited_by" text NOT NULL,
	"audit_report" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firewall_violations" (
	"id" text PRIMARY KEY NOT NULL,
	"violation_date" timestamp DEFAULT now() NOT NULL,
	"violation_type" text NOT NULL,
	"severity" text NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text NOT NULL,
	"user_role" text NOT NULL,
	"data_type_accessed" text,
	"data_type_id" text,
	"violation_description" text NOT NULL,
	"system_detected" boolean DEFAULT true NOT NULL,
	"detected_by" text,
	"incident_status" text DEFAULT 'open' NOT NULL,
	"investigated_by" text,
	"investigation_notes" text,
	"resolution_action" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "union_only_data_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"resource_name" text,
	"union_only_flag" boolean DEFAULT true NOT NULL,
	"employer_access_blocked" boolean DEFAULT true NOT NULL,
	"classification_level" text DEFAULT 'union_only' NOT NULL,
	"tagged_by" text NOT NULL,
	"tagged_at" timestamp DEFAULT now() NOT NULL,
	"tag_reason" text,
	"review_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_balance_reconciliation" (
	"id" text PRIMARY KEY NOT NULL,
	"reconciliation_date" timestamp DEFAULT now() NOT NULL,
	"account_id" text NOT NULL,
	"account_type" text NOT NULL,
	"stripe_reported_balance" text NOT NULL,
	"system_calculated_balance" text NOT NULL,
	"balance_match" boolean NOT NULL,
	"discrepancy_amount" text,
	"discrepancy_reason" text,
	"reconciliation_status" text DEFAULT 'pending' NOT NULL,
	"reconciled_by" text,
	"reconciliation_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_classification_policy" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_name" text NOT NULL,
	"policy_description" text,
	"effective_date" timestamp NOT NULL,
	"expiry_date" timestamp,
	"enforce_strict_separation" boolean DEFAULT true NOT NULL,
	"allow_operational_fallback" boolean DEFAULT false NOT NULL,
	"require_trust_account" boolean DEFAULT true NOT NULL,
	"automatic_classification" boolean DEFAULT true NOT NULL,
	"approved_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_routing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_type" text NOT NULL,
	"payment_category" text NOT NULL,
	"destination_account_id" text NOT NULL,
	"destination_account_type" text NOT NULL,
	"routing_mandatory" boolean DEFAULT true NOT NULL,
	"fallback_account_id" text,
	"allow_fallback" boolean DEFAULT false NOT NULL,
	"routing_priority" text DEFAULT '1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "separated_payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	"payment_type" text NOT NULL,
	"payment_category" text NOT NULL,
	"payment_amount" text NOT NULL,
	"payment_currency" text DEFAULT 'CAD' NOT NULL,
	"payer_id" text NOT NULL,
	"payer_email" text NOT NULL,
	"payee_id" text,
	"payee_name" text,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"routed_to_account_id" text NOT NULL,
	"routed_to_account_type" text NOT NULL,
	"routing_rule_id" text,
	"separation_enforced" boolean DEFAULT true NOT NULL,
	"correct_account_used" boolean DEFAULT true NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strike_fund_payment_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_date" timestamp DEFAULT now() NOT NULL,
	"audit_period" text NOT NULL,
	"total_strike_payments" text NOT NULL,
	"total_strike_amount" text NOT NULL,
	"strike_payments_to_correct_account" text NOT NULL,
	"strike_payments_to_wrong_account" text NOT NULL,
	"total_operational_payments" text NOT NULL,
	"total_operational_amount" text NOT NULL,
	"separation_compliance_rate" text NOT NULL,
	"total_violations" text NOT NULL,
	"critical_violations" text NOT NULL,
	"amount_misrouted" text,
	"recommended_actions" text,
	"audited_by" text NOT NULL,
	"audit_report" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_connect_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_type" text NOT NULL,
	"account_purpose" text NOT NULL,
	"stripe_account_id" text NOT NULL,
	"account_status" text DEFAULT 'active' NOT NULL,
	"account_email" text NOT NULL,
	"account_name" text NOT NULL,
	"country" text DEFAULT 'CA' NOT NULL,
	"currency" text DEFAULT 'CAD' NOT NULL,
	"separate_account" boolean DEFAULT true NOT NULL,
	"trust_account_designation" boolean DEFAULT false,
	"bank_account_last4" text,
	"bank_name" text,
	"account_verified" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_connect_accounts_stripe_account_id_unique" UNIQUE("stripe_account_id")
);
--> statement-breakpoint
CREATE TABLE "whiplash_prevention_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_date" timestamp DEFAULT now() NOT NULL,
	"action_type" text NOT NULL,
	"action_description" text NOT NULL,
	"account_id" text,
	"transaction_id" text,
	"performed_by" text NOT NULL,
	"compliance_impact" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "whiplash_violations" (
	"id" text PRIMARY KEY NOT NULL,
	"violation_date" timestamp DEFAULT now() NOT NULL,
	"violation_type" text NOT NULL,
	"severity" text NOT NULL,
	"transaction_id" text,
	"payment_type" text NOT NULL,
	"expected_account_id" text,
	"actual_account_id" text,
	"violation_description" text NOT NULL,
	"amount_involved" text,
	"correction_required" boolean DEFAULT true NOT NULL,
	"correction_action" text,
	"violation_status" text DEFAULT 'open' NOT NULL,
	"detected_by" text,
	"resolved_by" text,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certification_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certification_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"alert_date" timestamp DEFAULT now() NOT NULL,
	"expiry_date" date,
	"days_until_expiry" varchar(10),
	"notification_sent" boolean DEFAULT false NOT NULL,
	"notification_sent_at" timestamp,
	"notification_method" varchar(20),
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar(255),
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certification_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_description" text NOT NULL,
	"certification_id" uuid,
	"user_id" varchar(255),
	"performed_by" varchar(255) NOT NULL,
	"performed_by_role" varchar(50),
	"compliance_impact" varchar(20),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certification_compliance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"report_period" varchar(20) NOT NULL,
	"total_staff" varchar(10) NOT NULL,
	"total_certifications_required" varchar(10) NOT NULL,
	"total_certifications_current" varchar(10) NOT NULL,
	"total_certifications_expired" varchar(10) NOT NULL,
	"total_certifications_pending_renewal" varchar(10) NOT NULL,
	"total_ce_hours_required" varchar(10),
	"total_ce_hours_completed" varchar(10),
	"compliance_rate" varchar(10),
	"expired_certifications" jsonb,
	"upcoming_renewals" jsonb,
	"generated_by" varchar(255),
	"report_format" varchar(20) DEFAULT 'pdf',
	"report_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certification_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certification_name" text NOT NULL,
	"certification_code" varchar(50) NOT NULL,
	"issuing_authority" text NOT NULL,
	"requires_renewal" boolean DEFAULT true NOT NULL,
	"renewal_frequency_months" varchar(10),
	"continuing_education_required" boolean DEFAULT false NOT NULL,
	"ce_hours_required" varchar(10),
	"required_for_roles" jsonb,
	"mandatory" boolean DEFAULT false NOT NULL,
	"description" text,
	"application_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certification_types_certification_code_unique" UNIQUE("certification_code")
);
--> statement-breakpoint
CREATE TABLE "continuing_education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"certification_id" uuid NOT NULL,
	"course_title" text NOT NULL,
	"course_provider" text NOT NULL,
	"course_date" date NOT NULL,
	"ce_hours_earned" varchar(10) NOT NULL,
	"ce_category" varchar(50),
	"certificate_of_completion" text,
	"verified_by" varchar(255),
	"verified_at" timestamp,
	"applicable_period_start" date,
	"applicable_period_end" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "license_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certification_id" uuid NOT NULL,
	"renewal_year" varchar(4) NOT NULL,
	"renewal_due_date" date NOT NULL,
	"renewal_submitted_date" date,
	"renewal_approved_date" date,
	"renewal_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"ce_requirements_met" boolean DEFAULT false NOT NULL,
	"fee_paid" boolean DEFAULT false NOT NULL,
	"application_complete" boolean DEFAULT false NOT NULL,
	"renewal_application" text,
	"payment_receipt" text,
	"approval_letter" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"full_name" text NOT NULL,
	"role" varchar(100) NOT NULL,
	"certification_type_id" uuid NOT NULL,
	"certification_number" varchar(100),
	"issued_date" date NOT NULL,
	"expiry_date" date,
	"last_renewal_date" date,
	"next_renewal_due" date,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"certificate_document" text,
	"verification_document" text,
	"verified_by" varchar(255),
	"verified_at" timestamp,
	"verification_notes" text,
	"compliant" boolean DEFAULT true NOT NULL,
	"compliance_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pci_dss_cardholder_data_flow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"system_name" varchar(255) NOT NULL,
	"data_flow_description" text,
	"storage_location" text,
	"encryption_method" varchar(100),
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pci_dss_encryption_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key_type" varchar(50) NOT NULL,
	"key_identifier" varchar(255) NOT NULL,
	"rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"rotation_reason" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pci_dss_quarterly_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"scan_date" timestamp with time zone DEFAULT now() NOT NULL,
	"vendor_name" varchar(255) NOT NULL,
	"scan_status" "pci_scan_status" DEFAULT 'pending' NOT NULL,
	"vulnerabilities_found" integer DEFAULT 0 NOT NULL,
	"critical_issues" integer DEFAULT 0 NOT NULL,
	"report_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pci_dss_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"requirement_number" varchar(50) NOT NULL,
	"requirement_description" text NOT NULL,
	"compliance_status" "pci_requirement_status" DEFAULT 'requires_remediation' NOT NULL,
	"evidence" text,
	"remediation_notes" text,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pci_dss_saq_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"assessment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"sqa_level" varchar(20) DEFAULT 'SAQ-A' NOT NULL,
	"overall_status" "pci_assessment_status" DEFAULT 'in_progress' NOT NULL,
	"attestation_of_compliance" text,
	"attestation_date" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"alert_type" "compliance_alert_type" NOT NULL,
	"severity" "compliance_alert_severity" NOT NULL,
	"message" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employer_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"report_type" "compliance_report_type" NOT NULL,
	"data_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_type" varchar(50) NOT NULL,
	"rate_type_name" varchar(100),
	"rate" numeric(5, 4) NOT NULL,
	"max_insurable_earnings" numeric(12, 2),
	"exemption_limit" numeric(12, 2),
	"maximum_contribution" numeric(12, 2),
	"year" integer NOT NULL,
	"effective_date" varchar(20),
	"source" varchar(100) DEFAULT 'Canada Revenue Agency' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "cost_of_living_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"geography_code" varchar(10) NOT NULL,
	"geography_name" varchar(255) NOT NULL,
	"cpi_value" numeric(10, 2) NOT NULL,
	"cpi_vector" varchar(50),
	"inflation_rate" numeric(5, 2) NOT NULL,
	"year" integer NOT NULL,
	"ref_date" varchar(20) NOT NULL,
	"source" varchar(100) DEFAULT 'Statistics Canada' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "external_data_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(100) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"sync_id" varchar(100) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_inserted" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"error_message" text,
	"error_details" text,
	"initiated_by" varchar(100),
	"sync_type" varchar(50) DEFAULT 'manual' NOT NULL,
	"parameters" text,
	CONSTRAINT "external_data_sync_log_sync_id_unique" UNIQUE("sync_id")
);
--> statement-breakpoint
CREATE TABLE "union_density" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"geography_code" varchar(10) NOT NULL,
	"geography_name" varchar(255) NOT NULL,
	"naics_code" varchar(10),
	"naics_name" varchar(255),
	"noc_code" varchar(10),
	"noc_name" varchar(255),
	"sex" varchar(1) DEFAULT 'B' NOT NULL,
	"age_group" varchar(50),
	"age_group_name" varchar(100),
	"citizenship" varchar(50),
	"citizenship_name" varchar(100),
	"union_status" varchar(50) NOT NULL,
	"union_status_name" varchar(100) NOT NULL,
	"density_value" numeric(5, 2) NOT NULL,
	"ref_date" varchar(20) NOT NULL,
	"survey_year" integer NOT NULL,
	"source" varchar(100) DEFAULT 'Statistics Canada' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "wage_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"noc_code" varchar(10) NOT NULL,
	"noc_name" varchar(255) NOT NULL,
	"noc_category" varchar(100),
	"geography_code" varchar(10) NOT NULL,
	"geography_name" varchar(255) NOT NULL,
	"geography_type" varchar(20) DEFAULT 'national' NOT NULL,
	"naics_code" varchar(10),
	"naics_name" varchar(255),
	"wage_value" numeric(12, 2) NOT NULL,
	"wage_unit" varchar(20) DEFAULT 'hourly' NOT NULL,
	"wage_type" varchar(50) NOT NULL,
	"sex" varchar(1) DEFAULT 'B' NOT NULL,
	"age_group" varchar(50),
	"age_group_name" varchar(100),
	"education_level" varchar(50),
	"statistics_type" varchar(100),
	"data_type" varchar(100),
	"ref_date" varchar(20) NOT NULL,
	"survey_year" integer NOT NULL,
	"source" varchar(100) DEFAULT 'Statistics Canada' NOT NULL,
	"data_quality_symbol" varchar(10),
	"is_terminated" boolean DEFAULT false,
	"decimals" integer DEFAULT 2,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "lrb_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(100) NOT NULL,
	"employer_name" varchar(500) NOT NULL,
	"employer_address" text,
	"union_name" varchar(500) NOT NULL,
	"union_code" varchar(50),
	"bargaining_unit" varchar(500),
	"bargaining_unit_size" integer,
	"agreement_date" varchar(20),
	"effective_date" timestamp with time zone,
	"expiry_date" timestamp with time zone,
	"ratification_date" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"sector" varchar(50),
	"industry_code" varchar(20),
	"industry_name" varchar(255),
	"geographic_scope" varchar(100),
	"jurisdiction" varchar(10) NOT NULL,
	"hourly_wage_range" varchar(100),
	"annual_salary_range" varchar(100),
	"pdf_url" varchar(1000),
	"html_url" varchar(1000),
	"json_url" varchar(1000),
	"extracted_content" text,
	"key_terms" jsonb,
	"search_keywords" text,
	"noc_codes" text,
	"occupation_category" varchar(100),
	"embedding_vector" text,
	"ai_summary" text,
	"sentiment_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "lrb_employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_name" varchar(500) NOT NULL,
	"employer_name_alt" varchar(500),
	"jurisdiction" varchar(10) NOT NULL,
	"city" varchar(100),
	"province" varchar(100),
	"industry_code" varchar(20),
	"industry_name" varchar(255),
	"total_agreements" integer DEFAULT 0,
	"active_agreements" integer DEFAULT 0,
	"last_agreement_date" varchar(20),
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lrb_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"sync_id" varchar(100) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"pages_processed" integer DEFAULT 0,
	"agreements_found" integer DEFAULT 0,
	"agreements_inserted" integer DEFAULT 0,
	"agreements_updated" integer DEFAULT 0,
	"agreements_failed" integer DEFAULT 0,
	"error_message" text,
	"error_details" text,
	"sync_type" varchar(50) DEFAULT 'full' NOT NULL,
	"parameters" text,
	"initiated_by" varchar(100),
	CONSTRAINT "lrb_sync_log_sync_id_unique" UNIQUE("sync_id")
);
--> statement-breakpoint
CREATE TABLE "lrb_unions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"union_name" varchar(500) NOT NULL,
	"union_code" varchar(50),
	"acronym" varchar(20),
	"parent_organization" varchar(500),
	"affiliation_level" varchar(50),
	"primary_jurisdiction" varchar(10),
	"total_agreements" integer DEFAULT 0,
	"active_agreements" integer DEFAULT 0,
	"total_members" integer,
	"last_agreement_date" varchar(20),
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "arbitration_precedents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_organization_id" uuid NOT NULL,
	"source_decision_id" uuid,
	"case_number" varchar(100),
	"case_title" varchar(500) NOT NULL,
	"decision_date" date NOT NULL,
	"is_parties_anonymized" boolean DEFAULT false,
	"union_name" varchar(200),
	"employer_name" varchar(200),
	"arbitrator_name" varchar(200) NOT NULL,
	"jurisdiction" varchar(50) NOT NULL,
	"grievance_type" varchar(100) NOT NULL,
	"issue_summary" text NOT NULL,
	"union_position" text,
	"employer_position" text,
	"outcome" varchar(50) NOT NULL,
	"decision_summary" text NOT NULL,
	"reasoning" text,
	"precedential_value" varchar(20) DEFAULT 'medium',
	"key_principles" text[],
	"related_legislation" text,
	"cited_cases" uuid[],
	"citation_count" integer DEFAULT 0,
	"document_url" varchar(500),
	"document_path" varchar(500),
	"redacted_document_url" varchar(500),
	"redacted_document_path" varchar(500),
	"has_redacted_version" boolean DEFAULT false,
	"sharing_level" varchar(50) DEFAULT 'federation' NOT NULL,
	"shared_with_org_ids" uuid[],
	"sector" varchar(100),
	"province" varchar(2),
	"view_count" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precedent_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"precedent_id" uuid NOT NULL,
	"citing_claim_id" uuid,
	"citing_precedent_id" uuid,
	"citing_organization_id" uuid NOT NULL,
	"citation_context" text,
	"citation_type" varchar(50),
	"cited_by" varchar(255) NOT NULL,
	"cited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precedent_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"precedent_id" uuid NOT NULL,
	"tag_name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "congress_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"congress_id" uuid NOT NULL,
	"status" "congress_membership_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "external_hris_provider" NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(100),
	"manager_id" varchar(255),
	"manager_name" varchar(255),
	"parent_department_id" varchar(255),
	"last_synced_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"raw_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "external_hris_provider" NOT NULL,
	"employee_id" varchar(100),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(50),
	"position" varchar(255),
	"department" varchar(255),
	"location" varchar(255),
	"hire_date" timestamp with time zone,
	"employment_status" "employment_status",
	"work_schedule" varchar(100),
	"supervisor_id" varchar(255),
	"supervisor_name" varchar(255),
	"last_synced_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"raw_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "external_hris_provider" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"department" varchar(255),
	"job_profile" varchar(255),
	"effective_date" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"raw_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"account_name" varchar(500) NOT NULL,
	"account_type" varchar(100) NOT NULL,
	"account_sub_type" varchar(100),
	"classification" varchar(100),
	"current_balance" numeric(15, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_external_account" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"name" varchar(500) NOT NULL,
	"company_name" varchar(500),
	"email" varchar(255),
	"phone" varchar(50),
	"balance" numeric(12, 2),
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_external_customer" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"invoice_number" varchar(255) NOT NULL,
	"customer_id" varchar(255) NOT NULL,
	"customer_name" varchar(500) NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"total_amount" numeric(12, 2) NOT NULL,
	"balance_amount" numeric(12, 2),
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_external_invoice" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"customer_id" varchar(255) NOT NULL,
	"customer_name" varchar(500) NOT NULL,
	"payment_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_external_payment" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_benefit_coverage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"enrollment_id" varchar(255),
	"employee_id" varchar(255) NOT NULL,
	"plan_id" varchar(255) NOT NULL,
	"plan_type" varchar(100),
	"coverage_amount" numeric(15, 2),
	"deductible" numeric(12, 2),
	"effective_date" date NOT NULL,
	"termination_date" date,
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_benefit_coverage_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_benefit_dependents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"date_of_birth" date,
	"relationship" varchar(100),
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_benefit_dependents_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_benefit_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"employee_name" varchar(500),
	"plan_id" varchar(255) NOT NULL,
	"plan_name" varchar(500),
	"coverage_level" varchar(100),
	"enrollment_date" date NOT NULL,
	"effective_date" date NOT NULL,
	"termination_date" date,
	"status" varchar(50) NOT NULL,
	"premium" numeric(12, 2),
	"employee_contribution" numeric(12, 2),
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_benefit_enrollments_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_benefit_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"plan_name" varchar(500) NOT NULL,
	"plan_type" varchar(100) NOT NULL,
	"coverage_level" varchar(100),
	"effective_date" date NOT NULL,
	"termination_date" date,
	"premium" numeric(12, 2),
	"employer_contribution" numeric(12, 2),
	"employee_contribution" numeric(12, 2),
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_benefit_plans_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_benefit_utilization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"policy_id" varchar(255),
	"benefit_type" varchar(100),
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"maximum_benefit" numeric(12, 2),
	"utilized" numeric(12, 2),
	"remaining" numeric(12, 2),
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_benefit_utilization_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_insurance_beneficiaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"policy_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"relationship" varchar(100),
	"percentage" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_insurance_beneficiaries_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_insurance_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"claim_number" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"employee_name" varchar(500),
	"policy_number" varchar(255),
	"claim_type" varchar(100),
	"service_date" date,
	"submission_date" date NOT NULL,
	"processed_date" date,
	"claim_amount" numeric(12, 2) NOT NULL,
	"approved_amount" numeric(12, 2),
	"paid_amount" numeric(12, 2),
	"denied_amount" numeric(12, 2),
	"status" varchar(50) NOT NULL,
	"denial_reason" text,
	"provider_id" varchar(255),
	"provider_name" varchar(500),
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_insurance_claims_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_insurance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"policy_number" varchar(255) NOT NULL,
	"policy_type" varchar(100),
	"employee_id" varchar(255) NOT NULL,
	"effective_date" date NOT NULL,
	"termination_date" date,
	"coverage_amount" numeric(15, 2),
	"premium" numeric(12, 2),
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_insurance_policies_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_communication_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"channel_name" varchar(255) NOT NULL,
	"channel_type" varchar(50),
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp NOT NULL,
	"creator_id" varchar(255),
	"member_count" integer DEFAULT 0,
	"topic" text,
	"description" text,
	"parent_channel_id" varchar(255),
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_comm_channel" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_communication_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"channel_id" uuid,
	"user_id" varchar(255),
	"file_name" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"mime_type" varchar(100),
	"file_size" integer,
	"file_url" text,
	"download_url" text,
	"created_at" timestamp NOT NULL,
	"comment_count" integer DEFAULT 0,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_comm_file" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_communication_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"channel_id" uuid,
	"user_id" varchar(255),
	"message_text" text,
	"message_type" varchar(50),
	"timestamp" timestamp NOT NULL,
	"thread_id" varchar(255),
	"reply_count" integer DEFAULT 0,
	"reaction_count" integer DEFAULT 0,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_comm_message" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_communication_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"username" varchar(255),
	"display_name" varchar(255),
	"email" varchar(255),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"title" varchar(255),
	"avatar_url" text,
	"is_bot" boolean DEFAULT false,
	"is_admin" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"status_text" varchar(255),
	"status_emoji" varchar(50),
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_comm_user" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_lms_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"course_id" varchar(255) NOT NULL,
	"learner_id" varchar(255) NOT NULL,
	"completed_at" timestamp NOT NULL,
	"certificate_id" varchar(255),
	"grade" numeric(5, 2),
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lms_completion" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_lms_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"course_name" varchar(500) NOT NULL,
	"description" text,
	"difficulty_level" varchar(50),
	"duration_minutes" integer,
	"published_at" timestamp,
	"last_updated_at" timestamp,
	"provider" varchar(255),
	"category_id" varchar(255),
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lms_course" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_lms_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"course_id" varchar(255) NOT NULL,
	"learner_id" varchar(255) NOT NULL,
	"enrolled_at" timestamp NOT NULL,
	"status" varchar(50) NOT NULL,
	"progress_percentage" integer DEFAULT 0,
	"last_accessed_at" timestamp,
	"completed_at" timestamp,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lms_enrollment" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_lms_learners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"email" varchar(255),
	"profile_url" text,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lms_learner" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_lms_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"course_id" varchar(255) NOT NULL,
	"learner_id" varchar(255) NOT NULL,
	"content_id" varchar(255),
	"progress_percentage" integer DEFAULT 0,
	"time_spent_seconds" integer DEFAULT 0,
	"completed_at" timestamp,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lms_progress" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_document_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"library_id" uuid,
	"file_name" varchar(500) NOT NULL,
	"file_url" text,
	"file_size" integer,
	"mime_type" varchar(100),
	"is_folder" boolean DEFAULT false,
	"folder_child_count" integer,
	"created_at" timestamp,
	"created_by" varchar(255),
	"created_by_email" varchar(255),
	"last_modified_at" timestamp,
	"last_modified_by" varchar(255),
	"parent_path" text,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_doc_file" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_document_libraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"site_id" varchar(255),
	"library_name" varchar(255) NOT NULL,
	"library_url" text,
	"description" text,
	"drive_type" varchar(50),
	"created_at" timestamp,
	"created_by" varchar(255),
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_doc_library" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_document_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"file_id" uuid,
	"user_id" varchar(255),
	"group_id" varchar(255),
	"roles" varchar(255),
	"permission_type" varchar(50),
	"scope" varchar(50),
	"granted_to" varchar(255),
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_doc_permission" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_document_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"site_name" varchar(255) NOT NULL,
	"site_url" text,
	"description" text,
	"created_at" timestamp,
	"last_modified_at" timestamp,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_doc_site" UNIQUE("org_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_pension_beneficiaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "pension_provider" NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"relationship" varchar(100) NOT NULL,
	"allocation_percent" numeric(5, 2) NOT NULL,
	"date_of_birth" date,
	"beneficiary_type" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"effective_date" date,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_pension_ben_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_pension_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "pension_provider" NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"plan_id" varchar(255) NOT NULL,
	"contribution_type" "pension_contribution_type" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"employee_amount" numeric(12, 2),
	"employer_amount" numeric(12, 2),
	"pensionable_earnings" numeric(14, 2),
	"service_credit" numeric(6, 4),
	"pay_period" varchar(50),
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_pension_contrib_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_pension_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "pension_provider" NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"plan_id" varchar(255) NOT NULL,
	"estimate_date" date NOT NULL,
	"retirement_age" integer NOT NULL,
	"expected_retirement_date" date NOT NULL,
	"credited_service_at_retirement" numeric(8, 4),
	"annual_pension" numeric(14, 2),
	"monthly_pension" numeric(14, 2),
	"bridge_benefit" numeric(14, 2),
	"survivor_benefit" numeric(14, 2),
	"commuted_value" numeric(18, 2),
	"inflation_adjusted" boolean,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_pension_est_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_pension_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "pension_provider" NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"employee_name" varchar(500),
	"plan_id" varchar(255) NOT NULL,
	"membership_number" varchar(100),
	"member_status" "pension_member_status" NOT NULL,
	"enrollment_date" date NOT NULL,
	"vesting_date" date,
	"termination_date" date,
	"credited_service" numeric(8, 4),
	"eligible_service" numeric(8, 4),
	"pensionable_salary" numeric(14, 2),
	"date_of_birth" date,
	"expected_retirement_date" date,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_pension_members_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_pension_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "pension_provider" NOT NULL,
	"plan_name" varchar(500) NOT NULL,
	"plan_type" "pension_plan_type" NOT NULL,
	"plan_number" varchar(100),
	"jurisdiction" varchar(100),
	"regulatory_body" varchar(255),
	"effective_date" date NOT NULL,
	"termination_date" date,
	"employee_contribution_rate" numeric(6, 4),
	"employer_contribution_rate" numeric(6, 4),
	"vesting_period_months" integer,
	"normal_retirement_age" integer,
	"early_retirement_age" integer,
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_pension_plans_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_pension_service_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "pension_provider" NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"plan_id" varchar(255) NOT NULL,
	"credit_type" varchar(100) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"credited_years" numeric(8, 4) NOT NULL,
	"cost_of_buyback" numeric(14, 2),
	"approved" boolean,
	"approval_date" date,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_pension_svc_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_calendar_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "calendar_provider" NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"response_status" "attendee_response" NOT NULL,
	"is_organizer" boolean DEFAULT false,
	"is_optional" boolean DEFAULT false,
	"comment" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_cal_att_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "calendar_provider" NOT NULL,
	"calendar_id" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"location" varchar(500),
	"meeting_url" text,
	"event_type" "calendar_event_type",
	"status" "calendar_event_status" NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false,
	"is_recurring" boolean DEFAULT false,
	"recurring_event_id" varchar(255),
	"organizer_email" varchar(255),
	"organizer_name" varchar(255),
	"visibility" varchar(20) DEFAULT 'default',
	"importance" varchar(20) DEFAULT 'normal',
	"attendee_count" integer DEFAULT 0,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_cal_events_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_calendar_recurring_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "calendar_provider" NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"interval_count" integer DEFAULT 1,
	"days_of_week" varchar(100),
	"day_of_month" integer,
	"month_of_year" integer,
	"count" integer,
	"until_date" timestamp with time zone,
	"exceptions" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_cal_recur_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" "calendar_provider" NOT NULL,
	"calendar_name" varchar(500) NOT NULL,
	"description" text,
	"color" varchar(20),
	"timezone" varchar(100),
	"owner_email" varchar(255),
	"is_shared" boolean DEFAULT false,
	"can_edit" boolean DEFAULT false,
	"sync_enabled" boolean DEFAULT true,
	"sync_direction" varchar(20) DEFAULT 'inbound',
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ext_calendars_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "model_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"model_type" varchar(50) NOT NULL,
	"version" varchar(20) NOT NULL,
	"accuracy" numeric,
	"trained_at" timestamp DEFAULT now() NOT NULL,
	"parameters" jsonb,
	CONSTRAINT "unique_model" UNIQUE("organization_id","model_type","version")
);
--> statement-breakpoint
CREATE TABLE "ai_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"monthly_limit_usd" numeric(10, 2) NOT NULL,
	"current_spend_usd" numeric(10, 2) DEFAULT '0',
	"alert_threshold" numeric(3, 2) DEFAULT '0.80',
	"hard_limit" boolean DEFAULT true,
	"billing_period_start" date NOT NULL,
	"billing_period_end" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"limit_type" text NOT NULL,
	"limit_value" integer NOT NULL,
	"current_value" integer DEFAULT 0,
	"window_start" timestamp DEFAULT now(),
	"window_duration" interval NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_safety_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input" text NOT NULL,
	"output" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"flagged_categories" jsonb,
	"confidence_scores" jsonb,
	"action" text NOT NULL,
	"reason" text,
	"session_id" uuid,
	"message_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"operation" text NOT NULL,
	"tokens_input" integer DEFAULT 0 NOT NULL,
	"tokens_output" integer DEFAULT 0 NOT NULL,
	"tokens_total" integer DEFAULT 0 NOT NULL,
	"estimated_cost" numeric(10, 6) DEFAULT '0' NOT NULL,
	"request_id" text,
	"user_id" text,
	"session_id" uuid,
	"latency_ms" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"model_used" text,
	"tokens_used" integer,
	"response_time_ms" integer,
	"retrieved_documents" jsonb,
	"citations" jsonb,
	"function_calls" jsonb,
	"helpful" boolean,
	"feedback_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "chat_session_status" DEFAULT 'active' NOT NULL,
	"ai_provider" "ai_provider" DEFAULT 'openai' NOT NULL,
	"model" text DEFAULT 'gpt-4' NOT NULL,
	"temperature" text DEFAULT '0.7',
	"context_tags" jsonb,
	"related_entity_type" text,
	"related_entity_id" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp,
	"helpful" boolean,
	"feedback_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"unique_users" integer DEFAULT 0 NOT NULL,
	"avg_response_time_ms" integer,
	"avg_tokens_per_message" integer,
	"avg_messages_per_session" integer,
	"helpful_responses" integer DEFAULT 0 NOT NULL,
	"unhelpful_responses" integer DEFAULT 0 NOT NULL,
	"satisfaction_rate" text,
	"total_tokens_used" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" text,
	"top_categories" jsonb,
	"top_questions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"description" text,
	"icon" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"show_in_contexts" jsonb,
	"required_tags" jsonb,
	"use_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"document_type" "knowledge_document_type" NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"source_type" text NOT NULL,
	"source_id" text,
	"source_url" text,
	"embedding" vector(1536),
	"embedding_model" text DEFAULT 'text-embedding-ada-002',
	"tags" jsonb,
	"keywords" jsonb,
	"language" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_version_id" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"allowed_organizations" jsonb,
	"view_count" integer DEFAULT 0 NOT NULL,
	"citation_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_grievance_triages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"grievance_id" uuid NOT NULL,
	"suggested_priority" varchar(20) NOT NULL,
	"suggested_category" varchar(50) NOT NULL,
	"complexity" "ai_complexity" NOT NULL,
	"estimated_days_to_resolve" numeric,
	"suggested_step" varchar(30),
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"factors_json" jsonb,
	"similar_grievance_ids" jsonb,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"status" "ai_triage_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"human_approved" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_clause_reasonings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"grievance_id" uuid NOT NULL,
	"cba_id" uuid,
	"clause_article" varchar(100) NOT NULL,
	"clause_section" varchar(100),
	"clause_title" varchar(500),
	"clause_snippet" text,
	"relevance_score" numeric(5, 4) NOT NULL,
	"reasoning" text NOT NULL,
	"application_notes" text,
	"precedent_refs" jsonb,
	"strength_assessment" varchar(20),
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"factors_json" jsonb,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"status" "clause_reasoning_status" DEFAULT 'suggested' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"human_approved" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employer_risk_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"overall_score" numeric(5, 4) NOT NULL,
	"risk_band" "employer_risk_band" NOT NULL,
	"trend_direction" varchar(15) NOT NULL,
	"signals_json" jsonb NOT NULL,
	"grievance_count_30d" integer DEFAULT 0,
	"compliance_alert_count_30d" integer DEFAULT 0,
	"arbitration_count_12m" integer DEFAULT 0,
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_copilot_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_role" varchar(50) NOT NULL,
	"action_type" "copilot_action_type" NOT NULL,
	"related_entity_type" varchar(50),
	"related_entity_id" uuid,
	"query" text,
	"response_text" text NOT NULL,
	"structured_output" jsonb,
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"sources_used" jsonb,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"outcome" "copilot_outcome" DEFAULT 'pending' NOT NULL,
	"edited_response" text,
	"feedback_rating" numeric(3, 2),
	"feedback_notes" text,
	"human_approved" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_insight_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_type" "insight_report_type" NOT NULL,
	"timeframe" "insight_timeframe" NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text NOT NULL,
	"insights_json" jsonb NOT NULL,
	"predictions_json" jsonb,
	"recommendations_json" jsonb,
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"data_sources_used" jsonb,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_scheduled_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_name" text NOT NULL,
	"report_type" text NOT NULL,
	"report_description" text,
	"report_parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schedule_type" text DEFAULT 'cron' NOT NULL,
	"cron_expression" text,
	"timezone" text DEFAULT 'America/Toronto',
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delivery_format" text DEFAULT 'pdf' NOT NULL,
	"include_attachments" boolean DEFAULT true,
	"email_subject" text,
	"email_body" text,
	"is_active" boolean DEFAULT true,
	"run_count" integer DEFAULT 0,
	"last_run_status" text,
	"last_run_error" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "benchmark_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"category_group" text NOT NULL,
	"unit_type" text NOT NULL,
	"calculation_method" text,
	"higher_is_better" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"icon" text,
	"color" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "benchmark_categories_category_name_unique" UNIQUE("category_name")
);
--> statement-breakpoint
CREATE TABLE "benchmark_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benchmark_category_id" uuid NOT NULL,
	"union_type" text NOT NULL,
	"union_size_bracket" text NOT NULL,
	"region" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"period_type" text DEFAULT 'monthly' NOT NULL,
	"metric_value" numeric(15, 2) NOT NULL,
	"sample_size" integer NOT NULL,
	"min_value" numeric(15, 2),
	"max_value" numeric(15, 2),
	"percentile_25" numeric(15, 2),
	"percentile_50" numeric(15, 2),
	"percentile_75" numeric(15, 2),
	"standard_deviation" numeric(15, 2),
	"data_quality_score" integer DEFAULT 100,
	"is_projected" boolean DEFAULT false,
	"confidence_level" text DEFAULT 'high',
	"data_source" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_benchmark_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"benchmark_category_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"period_type" text DEFAULT 'monthly' NOT NULL,
	"metric_value" numeric(15, 2) NOT NULL,
	"benchmark_value" numeric(15, 2),
	"variance_from_benchmark" numeric(15, 2),
	"variance_percentage" numeric(8, 2),
	"percentile_rank" integer,
	"performance_indicator" text,
	"previous_period_value" numeric(15, 2),
	"period_over_period_change" numeric(15, 2),
	"period_over_period_percentage" numeric(8, 2),
	"trend_direction" text,
	"data_completeness_percentage" integer DEFAULT 100,
	"calculation_notes" text,
	"calculated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_delivery_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"scheduled_report_id" uuid,
	"report_name" text NOT NULL,
	"report_type" text NOT NULL,
	"delivery_method" text DEFAULT 'email' NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delivery_format" text NOT NULL,
	"file_url" text,
	"file_size_bytes" bigint,
	"file_hash" text,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"email_subject" text,
	"email_opened" boolean DEFAULT false,
	"email_opened_at" timestamp with time zone,
	"email_clicked" boolean DEFAULT false,
	"email_clicked_at" timestamp with time zone,
	"generation_time_ms" integer,
	"delivery_time_ms" integer,
	"triggered_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"executed_by" varchar(255) NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"format" "report_format" DEFAULT 'pdf' NOT NULL,
	"parameters" jsonb,
	"result_count" varchar(50),
	"execution_time_ms" varchar(50),
	"file_url" varchar(500),
	"file_size" varchar(50),
	"status" varchar(50) DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"shared_by" varchar(255) NOT NULL,
	"shared_with" varchar(255),
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_execute" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "report_category" NOT NULL,
	"config" jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"thumbnail" varchar(500),
	"tags" jsonb,
	"created_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"report_type" "report_type" DEFAULT 'custom' NOT NULL,
	"category" "report_category" DEFAULT 'custom' NOT NULL,
	"config" jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"template_id" uuid,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255),
	"last_run_at" timestamp,
	"run_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"frequency" "schedule_frequency" NOT NULL,
	"day_of_week" varchar(20),
	"day_of_month" varchar(20),
	"time_of_day" varchar(10) NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"format" "report_format" DEFAULT 'pdf' NOT NULL,
	"recipients" jsonb NOT NULL,
	"parameters" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_executed_at" timestamp,
	"next_execution_at" timestamp,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"priority" integer DEFAULT 100,
	"target_entity" varchar(50) NOT NULL,
	"target_filter" jsonb,
	"trigger_type" varchar(50) NOT NULL,
	"trigger_config" jsonb,
	"conditions" jsonb,
	"actions" jsonb,
	"max_executions" integer,
	"executions_count" integer DEFAULT 0,
	"last_executed_at" timestamp with time zone,
	"active_from" timestamp with time zone,
	"active_until" timestamp with time zone,
	"timezone" varchar(50) DEFAULT 'UTC',
	"organization_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "clc_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_type" varchar(50) NOT NULL,
	"sync_id" varchar(100) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_inserted" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"access_token_used" varchar(50),
	"token_refreshed" boolean DEFAULT false,
	"error_message" text,
	"error_details" text,
	"parameters" text,
	"initiated_by" varchar(100),
	CONSTRAINT "clc_sync_log_sync_id_unique" UNIQUE("sync_id")
);
--> statement-breakpoint
CREATE TABLE "clc_webhook_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"affiliate_code" varchar(50) NOT NULL,
	"payload" json NOT NULL,
	"status" varchar(20) NOT NULL,
	"message" text,
	"processing_duration" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "clc_webhook_log_webhook_id_unique" UNIQUE("webhook_id")
);
--> statement-breakpoint
CREATE TABLE "reward_wallet_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"points_change" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"award_id" uuid,
	"reference_type" varchar(50),
	"reference_id" varchar(255),
	"expires_at" timestamp with time zone,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_security"."audit_logs" (
	"audit_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" varchar(255),
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" uuid,
	"correlation_id" uuid,
	"severity" varchar(20) DEFAULT 'info',
	"outcome" varchar(20) DEFAULT 'success',
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_path" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "valid_action" CHECK ("audit_security"."audit_logs"."action" != ''),
	CONSTRAINT "valid_severity" CHECK ("audit_security"."audit_logs"."severity" IN ('debug', 'info', 'warning', 'error', 'critical')),
	CONSTRAINT "valid_outcome" CHECK ("audit_security"."audit_logs"."outcome" IN ('success', 'failure', 'error'))
);
--> statement-breakpoint
CREATE TABLE "audit_security"."failed_login_attempts" (
	"attempt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"failure_reason" varchar(100) NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "recent_attempts" CHECK ("audit_security"."failed_login_attempts"."attempted_at" > NOW() - INTERVAL '30 days')
);
--> statement-breakpoint
CREATE TABLE "audit_security"."rate_limit_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"identifier_type" varchar(20) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"request_count" integer NOT NULL,
	"limit_exceeded" boolean DEFAULT false,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "valid_identifier_type" CHECK ("audit_security"."rate_limit_events"."identifier_type" IN ('ip', 'user', 'api_key'))
);
--> statement-breakpoint
CREATE TABLE "audit_security"."security_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" varchar(255),
	"event_type" varchar(50) NOT NULL,
	"event_category" varchar(30) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"source_ip" varchar(45),
	"user_agent" text,
	"additional_data" jsonb DEFAULT '{}'::jsonb,
	"risk_score" integer DEFAULT 0,
	"is_resolved" boolean DEFAULT false,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(255),
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "valid_event_category" CHECK ("audit_security"."security_events"."event_category" IN ('authentication', 'authorization', 'data_access', 'configuration', 'suspicious')),
	CONSTRAINT "valid_severity" CHECK ("audit_security"."security_events"."severity" IN ('low', 'medium', 'high', 'critical')),
	CONSTRAINT "valid_risk_score" CHECK ("audit_security"."security_events"."risk_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'boolean' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"percentage" integer,
	"allowed_organizations" json,
	"allowed_users" json,
	"description" text,
	"tags" json DEFAULT '[]'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"last_modified_by" text,
	CONSTRAINT "feature_flags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_uuid_mapping" (
	"user_uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_uuid_mapping_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "alert_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"action_type" "alert_action_type" NOT NULL,
	"action_config" jsonb NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"execute_if_condition" jsonb,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"retry_delay_seconds" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"field_path" varchar(255) NOT NULL,
	"operator" "alert_condition_operator" NOT NULL,
	"value" jsonb,
	"condition_group" integer DEFAULT 1 NOT NULL,
	"is_or_condition" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"escalation_levels" jsonb NOT NULL,
	"current_level" integer DEFAULT 1 NOT NULL,
	"status" "escalation_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_escalation_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"triggered_by" "alert_trigger_type" NOT NULL,
	"trigger_data" jsonb,
	"status" "alert_execution_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"conditions_met" boolean,
	"conditions_evaluated" jsonb,
	"actions_executed" jsonb,
	"error_message" text,
	"error_details" jsonb,
	"execution_time_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"recipient_type" varchar(50) NOT NULL,
	"recipient_id" uuid,
	"recipient_value" varchar(255),
	"delivery_methods" varchar(50)[] DEFAULT '{"email"}' NOT NULL,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"trigger_type" "alert_trigger_type" NOT NULL,
	"trigger_config" jsonb NOT NULL,
	"severity" "alert_severity" DEFAULT 'medium' NOT NULL,
	"frequency" "alert_frequency" DEFAULT 'every_occurrence' NOT NULL,
	"rate_limit_minutes" integer,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"last_executed_at" timestamp with time zone,
	"last_execution_status" "alert_execution_status",
	"execution_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"trigger_type" "workflow_trigger_type" NOT NULL,
	"trigger_config" jsonb NOT NULL,
	"workflow_steps" jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_executed_at" timestamp with time zone,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_definition_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"triggered_by" "workflow_trigger_type" NOT NULL,
	"trigger_data" jsonb,
	"status" "workflow_execution_status" DEFAULT 'pending' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"resumed_at" timestamp with time zone,
	"step_results" jsonb,
	"variables" jsonb,
	"error_message" text,
	"error_details" jsonb,
	"failed_step" integer,
	"total_execution_time_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_execution_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"triggered_by" varchar(255) NOT NULL,
	"trigger_type" varchar(50) NOT NULL,
	"target_entity_type" varchar(50) NOT NULL,
	"target_entity_id" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"error_details" jsonb,
	"actions_executed" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "automation_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"schedule_type" varchar(50) NOT NULL,
	"schedule_config" jsonb,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recognition_award_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"kind" "award_kind" NOT NULL,
	"default_credit_amount" integer NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"rules_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_type_credit_amount_positive" CHECK ("recognition_award_types"."default_credit_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "recognition_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"award_type_id" uuid NOT NULL,
	"recipient_user_id" varchar(255) NOT NULL,
	"issuer_user_id" varchar(255),
	"reason" text NOT NULL,
	"status" "award_status" DEFAULT 'pending' NOT NULL,
	"approved_by_user_id" varchar(255),
	"approved_at" timestamp with time zone,
	"issued_at" timestamp with time zone,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recognition_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "program_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_budget_envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"scope_type" "budget_scope_type" NOT NULL,
	"scope_ref_id" varchar(255),
	"period" "budget_period" NOT NULL,
	"amount_limit" integer NOT NULL,
	"amount_used" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_limit_positive" CHECK ("reward_budget_envelopes"."amount_limit" > 0),
	CONSTRAINT "budget_used_valid" CHECK ("reward_budget_envelopes"."amount_used" >= 0 AND "reward_budget_envelopes"."amount_used" <= "reward_budget_envelopes"."amount_limit"),
	CONSTRAINT "budget_dates_valid" CHECK ("reward_budget_envelopes"."ends_at" > "reward_budget_envelopes"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "reward_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"program_id" uuid NOT NULL,
	"credits_spent" integer NOT NULL,
	"status" "redemption_status" DEFAULT 'initiated' NOT NULL,
	"provider" "redemption_provider" NOT NULL,
	"provider_order_id" varchar(255),
	"provider_checkout_id" varchar(255),
	"provider_payload_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemption_credits_positive" CHECK ("reward_redemptions"."credits_spent" > 0)
);
--> statement-breakpoint
CREATE TABLE "shopify_config" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"shop_domain" varchar(255) NOT NULL,
	"storefront_token_secret_ref" varchar(255) NOT NULL,
	"admin_token_secret_ref" varchar(255),
	"allowed_collections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"webhook_secret_ref" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"webhook_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload_json" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_receipts_webhook_id_unique" UNIQUE("webhook_id")
);
--> statement-breakpoint
CREATE TABLE "award_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"recipient_id" varchar(255) NOT NULL,
	"recipient_name" varchar(255) NOT NULL,
	"recipient_email" varchar(255),
	"points_awarded" integer DEFAULT 0,
	"monetary_value" integer DEFAULT 0,
	"badge_awarded" boolean DEFAULT false,
	"giver_id" varchar(255) NOT NULL,
	"giver_name" varchar(255) NOT NULL,
	"reason" text,
	"visibility" varchar(20) DEFAULT 'public',
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"redemption_notes" text,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"message" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"points_value" integer DEFAULT 0,
	"monetary_value" integer DEFAULT 0,
	"currency" varchar(3) DEFAULT 'CAD',
	"badge_name" varchar(100),
	"badge_icon" varchar(500),
	"badge_color" varchar(20),
	"tags" jsonb,
	"use_count" integer DEFAULT 0,
	"max_uses" integer,
	"per_user_limit" integer,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"organization_id" varchar(255),
	"requires_approval" boolean DEFAULT false,
	"approver_roles" jsonb,
	"total_awarded" integer DEFAULT 0,
	"total_value_awarded" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "budget_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"organization_id" varchar(255) NOT NULL,
	"total_budget" integer NOT NULL,
	"allocated_budget" integer DEFAULT 0 NOT NULL,
	"spent_budget" integer DEFAULT 0 NOT NULL,
	"fiscal_year" integer NOT NULL,
	"quarter" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"manager_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"reserved_amount" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reference_type" varchar(50) NOT NULL,
	"reference_id" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_signing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"signed_date" date DEFAULT now() NOT NULL,
	"signed_time" time,
	"signing_location" varchar(255),
	"witnessed_by" text,
	"witness_signature_data" jsonb,
	"card_photo_url" text,
	"card_type" varchar(50) DEFAULT 'authorization',
	"card_status" varchar(50) DEFAULT 'valid' NOT NULL,
	"invalidation_reason" text,
	"voluntary_signature" boolean DEFAULT true NOT NULL,
	"signature_obtained_properly" boolean DEFAULT true NOT NULL,
	"date_accurate" boolean DEFAULT true NOT NULL,
	"meets_legal_requirements" boolean,
	"submitted_to_nlrb_clrb" boolean DEFAULT false,
	"submission_date" date,
	"submission_batch_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "employer_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"response_date" date DEFAULT now() NOT NULL,
	"response_type" varchar(50) NOT NULL,
	"response_summary" text NOT NULL,
	"response_severity" varchar(20) DEFAULT 'moderate',
	"meeting_attendance_mandatory" boolean,
	"meeting_location" text,
	"meeting_date_time" timestamp,
	"speakers" text[],
	"talking_points" text[],
	"materials_distributed" text[],
	"material_urls" text[],
	"material_content_summary" text,
	"anti_union_consultant_name" varchar(255),
	"consultant_firm" varchar(255),
	"consultant_tactics" text[],
	"employee_disciplined" boolean DEFAULT false,
	"employee_terminated" boolean DEFAULT false,
	"affected_contact_id" uuid,
	"alleged_reason" text,
	"suspected_retaliation" boolean DEFAULT false,
	"surveillance_reported" boolean DEFAULT false,
	"surveillance_description" text,
	"intimidation_tactics" text[],
	"potential_ulp" boolean DEFAULT false,
	"ulp_filed" boolean DEFAULT false,
	"ulp_case_number" varchar(100),
	"nlrb_clrb_complaint_filed" boolean DEFAULT false,
	"union_counter_strategy" text,
	"union_action_taken" text[],
	"organizers_assigned_response" uuid[],
	"impact_on_campaign" varchar(20),
	"contacts_influenced" integer,
	"estimated_support_lost" numeric(5, 2),
	"evidence_documents" text[],
	"witness_statements" text[],
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "field_organizer_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"organizer_id" text NOT NULL,
	"contact_id" uuid,
	"activity_date" date DEFAULT now() NOT NULL,
	"activity_type" varchar(50) NOT NULL,
	"activity_duration_minutes" integer,
	"activity_location" text,
	"gps_latitude" numeric(10, 8),
	"gps_longitude" numeric(11, 8),
	"offline_mode_used" boolean DEFAULT false,
	"contact_made" boolean DEFAULT false NOT NULL,
	"commitment_level_before" varchar(50),
	"commitment_level_after" varchar(50),
	"card_signed" boolean DEFAULT false,
	"follow_up_needed" boolean DEFAULT false,
	"follow_up_date" date,
	"issues_discussed" text[],
	"concerns_raised" text[],
	"questions_asked" text[],
	"materials_distributed" text[],
	"interaction_quality" varchar(20),
	"likely_to_vote_yes" boolean,
	"willing_to_help_organize" boolean DEFAULT false,
	"potential_leader" boolean DEFAULT false,
	"detailed_notes" text,
	"organizer_observations" text,
	"next_steps" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"synced_at" timestamp with time zone,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "nlrb_clrb_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"filing_type" varchar(50) NOT NULL,
	"filing_number" varchar(100),
	"jurisdiction" varchar(50) NOT NULL,
	"filed_date" date NOT NULL,
	"filed_by" varchar(255),
	"employer_notified_date" date,
	"bargaining_unit_description" text NOT NULL,
	"unit_size_claimed" integer NOT NULL,
	"unit_job_classifications" text[],
	"excluded_positions" text[],
	"showing_of_interest_percentage" numeric(5, 2),
	"cards_submitted_count" integer,
	"card_submission_batch_ids" uuid[],
	"status" varchar(50) DEFAULT 'filed' NOT NULL,
	"hearing_date" date,
	"hearing_location" text,
	"hearing_outcome" varchar(50),
	"election_scheduled_date" date,
	"election_location" text,
	"election_type" varchar(50),
	"election_conducted" boolean DEFAULT false,
	"petition_document_url" text,
	"showing_of_interest_document_url" text,
	"hearing_transcripts_url" text,
	"decision_document_url" text,
	"employer_contested" boolean DEFAULT false,
	"employer_objections" text[],
	"employer_counter_arguments" text,
	"employer_representation" varchar(255),
	"decision_date" date,
	"decision_summary" text,
	"unit_approved" boolean,
	"approved_unit_size" integer,
	"approved_job_classifications" text[],
	"appeal_filed" boolean DEFAULT false,
	"appeal_status" varchar(50),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "nlrb_clrb_filings_filing_number_unique" UNIQUE("filing_number")
);
--> statement-breakpoint
CREATE TABLE "organizing_campaign_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"milestone_name" varchar(255) NOT NULL,
	"milestone_type" varchar(50) NOT NULL,
	"target_date" date NOT NULL,
	"completed" boolean DEFAULT false,
	"completed_date" date,
	"target_metric" varchar(50),
	"target_value" integer,
	"current_value" integer,
	"progress_percentage" numeric(5, 2),
	"status" varchar(50) DEFAULT 'pending',
	"days_until_deadline" integer,
	"reminder_sent" boolean DEFAULT false,
	"reminder_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "organizing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_name" varchar(255) NOT NULL,
	"campaign_code" varchar(50) NOT NULL,
	"target_employer" varchar(255) NOT NULL,
	"workplace_location" text NOT NULL,
	"industry" varchar(100),
	"campaign_type" varchar(50) DEFAULT 'voluntary_recognition' NOT NULL,
	"status" varchar(50) DEFAULT 'planning' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium',
	"estimated_unit_size" integer NOT NULL,
	"target_card_count" integer,
	"cards_signed" integer DEFAULT 0,
	"card_signing_progress" numeric(5, 2),
	"lead_organizer_id" text,
	"organizing_team" uuid[],
	"campaign_start_date" date,
	"target_card_deadline" date,
	"filing_date" date,
	"election_date" date,
	"certification_date" date,
	"campaign_end_date" date,
	"organizing_strategy" text,
	"key_issues" text[],
	"employer_vulnerabilities" text[],
	"union_advantages" text[],
	"contacts_identified" integer DEFAULT 0,
	"contacts_committed" integer DEFAULT 0,
	"house_visits_completed" integer DEFAULT 0,
	"workplace_meetings_held" integer DEFAULT 0,
	"election_eligible_voters" integer,
	"votes_for_union" integer,
	"votes_against_union" integer,
	"challenged_ballots" integer,
	"election_result" varchar(50),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "organizing_campaigns_campaign_code_unique" UNIQUE("campaign_code")
);
--> statement-breakpoint
CREATE TABLE "organizing_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"preferred_contact_method" varchar(20) DEFAULT 'phone',
	"job_title" varchar(100),
	"department" varchar(100),
	"shift" varchar(50),
	"hire_date" date,
	"seniority_years" numeric(4, 1),
	"work_location" varchar(255),
	"supervisor" varchar(100),
	"immediate_coworkers" text[],
	"influence_level" varchar(20) DEFAULT 'low',
	"commitment_level" varchar(50) DEFAULT 'unknown' NOT NULL,
	"union_sentiment" varchar(20),
	"card_signed" boolean DEFAULT false,
	"card_signed_date" date,
	"willing_to_organize" boolean DEFAULT false,
	"issues_concerned_about" text[],
	"first_contact_date" date,
	"last_contact_date" date,
	"total_contacts" integer DEFAULT 0,
	"house_visit_completed" boolean DEFAULT false,
	"house_visit_date" date,
	"likely_to_vote_yes" boolean,
	"employer_loyalist" boolean DEFAULT false,
	"potential_risks" text,
	"notes" text,
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "union_representation_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"filing_id" uuid,
	"vote_date" date NOT NULL,
	"vote_type" varchar(50) NOT NULL,
	"voting_method" varchar(50),
	"eligible_voters" integer NOT NULL,
	"ballots_cast" integer NOT NULL,
	"voter_turnout_percentage" numeric(5, 2),
	"votes_for_union" integer DEFAULT 0 NOT NULL,
	"votes_against_union" integer DEFAULT 0 NOT NULL,
	"challenged_ballots" integer DEFAULT 0,
	"void_ballots" integer DEFAULT 0,
	"union_vote_percentage" numeric(5, 2),
	"result" varchar(50) NOT NULL,
	"certification_issued" boolean DEFAULT false,
	"certification_date" date,
	"vote_breakdown_by_department" jsonb,
	"vote_breakdown_by_shift" jsonb,
	"union_filed_objections" boolean DEFAULT false,
	"employer_filed_objections" boolean DEFAULT false,
	"objections_summary" text,
	"objections_resolved" boolean,
	"objections_resolution" text,
	"recount_requested" boolean DEFAULT false,
	"recount_date" date,
	"recount_result" varchar(50),
	"certification_number" varchar(100),
	"bargaining_unit_certified" text,
	"union_representative_name" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "cross_org_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_organization_id" uuid NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid NOT NULL,
	"resource_organization_id" uuid NOT NULL,
	"access_type" varchar(50) NOT NULL,
	"access_granted_via" varchar(50),
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_sharing_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grantor_org_id" uuid NOT NULL,
	"grantee_org_id" uuid NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"all_resources" boolean DEFAULT false,
	"specific_resource_ids" uuid[],
	"grant_reason" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" varchar(255),
	"revoke_reason" text,
	"granted_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_sharing_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"allow_federation_sharing" boolean DEFAULT false,
	"allow_sector_sharing" boolean DEFAULT false,
	"allow_province_sharing" boolean DEFAULT false,
	"allow_congress_sharing" boolean DEFAULT false,
	"auto_share_clauses" boolean DEFAULT false,
	"auto_share_precedents" boolean DEFAULT false,
	"require_anonymization" boolean DEFAULT true,
	"default_sharing_level" varchar(50) DEFAULT 'private',
	"allowed_sharing_levels" varchar(50)[],
	"sharing_approval_required" boolean DEFAULT true,
	"sharing_approver_role" varchar(50) DEFAULT 'admin',
	"max_shared_clauses" integer,
	"max_shared_precedents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_sharing_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "cms_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"block_type" text NOT NULL,
	"category" text,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"styles" jsonb DEFAULT '{}'::jsonb,
	"is_reusable" boolean DEFAULT false,
	"thumbnail_url" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cms_media_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt_text" text,
	"caption" text,
	"tags" text[],
	"folder" text DEFAULT '/',
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cms_navigation_menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cms_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"meta_description" text,
	"meta_keywords" text[],
	"og_image" text,
	"parent_page_id" uuid,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"view_count" integer DEFAULT 0,
	"is_homepage" boolean DEFAULT false,
	"requires_auth" boolean DEFAULT false,
	"allowed_roles" text[],
	"seo_config" jsonb DEFAULT '{}'::jsonb,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cms_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"template_type" text NOT NULL,
	"category" text,
	"thumbnail_url" text,
	"layout_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false,
	"is_published" boolean DEFAULT true,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "donation_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"campaign_type" text NOT NULL,
	"goal_amount" numeric(10, 2),
	"current_amount" numeric(10, 2) DEFAULT '0',
	"currency" text DEFAULT 'CAD',
	"featured_image" text,
	"video_url" text,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"allow_recurring" boolean DEFAULT true,
	"suggested_amounts" integer[],
	"custom_fields" jsonb DEFAULT '[]'::jsonb,
	"thank_you_message" text,
	"email_template_id" uuid,
	"page_content" jsonb DEFAULT '[]'::jsonb,
	"seo_config" jsonb DEFAULT '{}'::jsonb,
	"stripe_product_id" text,
	"stripe_price_ids" jsonb DEFAULT '{}'::jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "donation_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"donation_id" uuid NOT NULL,
	"receipt_number" text NOT NULL,
	"receipt_type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"issue_date" date NOT NULL,
	"pdf_url" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "donation_receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid,
	"donor_name" text,
	"donor_email" text,
	"donor_phone" text,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'CAD',
	"is_recurring" boolean DEFAULT false,
	"recurring_interval" text,
	"is_anonymous" boolean DEFAULT false,
	"message" text,
	"custom_data" jsonb DEFAULT '{}'::jsonb,
	"stripe_payment_intent_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"receipt_sent" boolean DEFAULT false,
	"receipt_url" text,
	"tax_receipt_number" text,
	"tax_receipt_issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"check_in_method" text NOT NULL,
	"checked_in_by" text,
	"check_in_location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"profile_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"member_number" text,
	"ticket_type" text,
	"ticket_price" numeric(10, 2),
	"number_of_guests" integer DEFAULT 0,
	"guest_names" text[],
	"custom_data" jsonb DEFAULT '{}'::jsonb,
	"registration_status" text DEFAULT 'confirmed' NOT NULL,
	"payment_status" text DEFAULT 'pending',
	"stripe_payment_intent_id" text,
	"payment_method" text,
	"confirmation_sent" boolean DEFAULT false,
	"reminder_sent" boolean DEFAULT false,
	"checked_in" boolean DEFAULT false,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" text,
	"qr_code" text,
	"registration_source" text,
	"registered_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"profile_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"resume_url" text,
	"cover_letter_url" text,
	"cover_letter_text" text,
	"linkedin_url" text,
	"portfolio_url" text,
	"years_experience" integer,
	"current_employer" text,
	"current_position" text,
	"availability_date" date,
	"salary_expectation" numeric(10, 2),
	"willing_to_relocate" boolean DEFAULT false,
	"is_union_member" boolean DEFAULT false,
	"union_local" text,
	"custom_responses" jsonb DEFAULT '{}'::jsonb,
	"application_status" text DEFAULT 'new' NOT NULL,
	"status_notes" text,
	"viewed_by" text,
	"viewed_at" timestamp with time zone,
	"interview_scheduled_for" timestamp with time zone,
	"rejection_reason" text,
	"source" text,
	"applied_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"employer_name" text NOT NULL,
	"employer_logo" text,
	"employer_website" text,
	"job_type" text NOT NULL,
	"category" text,
	"description" text NOT NULL,
	"responsibilities" text,
	"qualifications" text,
	"benefits" text,
	"salary_min" numeric(10, 2),
	"salary_max" numeric(10, 2),
	"salary_currency" text DEFAULT 'CAD',
	"salary_period" text,
	"salary_display" text,
	"location_type" text NOT NULL,
	"city" text,
	"province" text,
	"country" text DEFAULT 'Canada',
	"remote_allowed" boolean DEFAULT false,
	"experience_level" text,
	"education_required" text,
	"union_affiliation_required" boolean DEFAULT false,
	"union_name" text,
	"contact_name" text,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"application_method" text NOT NULL,
	"application_email" text,
	"application_url" text,
	"application_instructions" text,
	"requires_resume" boolean DEFAULT true,
	"requires_cover_letter" boolean DEFAULT false,
	"custom_questions" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"featured" boolean DEFAULT false,
	"views_count" integer DEFAULT 0,
	"applications_count" integer DEFAULT 0,
	"posted_date" date DEFAULT now() NOT NULL,
	"closing_date" date,
	"filled_date" date,
	"seo_config" jsonb DEFAULT '{}'::jsonb,
	"tags" text[],
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_saved" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"profile_id" text NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "page_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"page_id" uuid,
	"event_id" uuid,
	"job_id" uuid,
	"campaign_id" uuid,
	"metric_date" date DEFAULT now() NOT NULL,
	"page_views" integer DEFAULT 0,
	"unique_visitors" integer DEFAULT 0,
	"avg_time_on_page" integer DEFAULT 0,
	"bounce_rate" numeric(5, 2) DEFAULT '0',
	"traffic_sources" jsonb DEFAULT '{}'::jsonb,
	"device_breakdown" jsonb DEFAULT '{}'::jsonb,
	"conversion_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"event_type" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"timezone" text DEFAULT 'America/Toronto',
	"location_type" text NOT NULL,
	"venue_name" text,
	"venue_address" text,
	"venue_city" text,
	"venue_state" text,
	"venue_postal_code" text,
	"venue_country" text DEFAULT 'Canada',
	"virtual_link" text,
	"virtual_platform" text,
	"featured_image" text,
	"capacity" integer,
	"registered_count" integer DEFAULT 0,
	"waitlist_enabled" boolean DEFAULT true,
	"registration_opens" timestamp with time zone,
	"registration_closes" timestamp with time zone,
	"registration_status" text DEFAULT 'open' NOT NULL,
	"is_free" boolean DEFAULT true,
	"ticket_price" numeric(10, 2),
	"member_price" numeric(10, 2),
	"currency" text DEFAULT 'CAD',
	"custom_fields" jsonb DEFAULT '[]'::jsonb,
	"confirmation_email_template" text,
	"reminder_email_template" text,
	"page_content" jsonb DEFAULT '[]'::jsonb,
	"seo_config" jsonb DEFAULT '{}'::jsonb,
	"tags" text[],
	"organizer_name" text,
	"organizer_email" text,
	"organizer_phone" text,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "website_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_name" text NOT NULL,
	"site_tagline" text,
	"site_description" text,
	"logo_url" text,
	"favicon_url" text,
	"primary_color" text DEFAULT '#1E40AF',
	"secondary_color" text DEFAULT '#F59E0B',
	"font_family" text DEFAULT 'Inter',
	"footer_text" text,
	"footer_links" jsonb DEFAULT '[]'::jsonb,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"contact_email" text,
	"contact_phone" text,
	"contact_address" text,
	"google_analytics_id" text,
	"facebook_pixel_id" text,
	"custom_css" text,
	"custom_js" text,
	"maintenance_mode" boolean DEFAULT false,
	"maintenance_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "website_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"connector_id" uuid,
	"external_id" varchar(255),
	"bank_name" varchar(255) NOT NULL,
	"account_number" varchar(255) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"current_balance" numeric(19, 4) DEFAULT '0' NOT NULL,
	"available_balance" numeric(19, 4) DEFAULT '0' NOT NULL,
	"gl_account_id" uuid,
	"bank_feed_provider" varchar(50),
	"bank_feed_enabled" boolean DEFAULT false NOT NULL,
	"encrypted_bank_credentials" text,
	"last_sync_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"statement_date" timestamp with time zone NOT NULL,
	"statement_balance" numeric(19, 4) NOT NULL,
	"gl_balance" numeric(19, 4) NOT NULL,
	"difference" numeric(19, 4) NOT NULL,
	"status" varchar(50) DEFAULT 'in_progress' NOT NULL,
	"reconciled_by" varchar(255),
	"reconciled_at" timestamp with time zone,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"posting_date" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"type" varchar(10) NOT NULL,
	"balance" numeric(19, 4),
	"reference" varchar(255),
	"payee" varchar(255),
	"category" varchar(255),
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"reconciled_at" timestamp with time zone,
	"matched_transaction_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"base_currency" varchar(3) NOT NULL,
	"target_currency" varchar(3) NOT NULL,
	"rate" numeric(19, 8) NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"source" varchar(100) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"system_type" "erp_system" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"config" jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "erp_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"connector_id" uuid,
	"external_id" varchar(255),
	"invoice_number" varchar(100) NOT NULL,
	"invoice_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"customer_id" varchar(255) NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_email" varchar(255),
	"billing_address" jsonb,
	"shipping_address" jsonb,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"subtotal" numeric(19, 4) NOT NULL,
	"tax_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"total_amount" numeric(19, 4) NOT NULL,
	"amount_paid" numeric(19, 4) DEFAULT '0' NOT NULL,
	"amount_due" numeric(19, 4) NOT NULL,
	"status" varchar(50) NOT NULL,
	"terms" text,
	"memo" text,
	"pdf_url" text,
	"metadata" jsonb,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"org_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_name" varchar(255) NOT NULL,
	"changes" jsonb,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"connector_id" uuid,
	"external_id" varchar(255),
	"entry_number" varchar(100) NOT NULL,
	"entry_date" timestamp with time zone NOT NULL,
	"posting_date" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"reference" varchar(255),
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"total_debit" numeric(19, 4) NOT NULL,
	"total_credit" numeric(19, 4) NOT NULL,
	"is_posted" boolean DEFAULT false NOT NULL,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversal_entry_id" uuid,
	"created_by" varchar(255) NOT NULL,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"metadata" jsonb,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"debit_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"description" text,
	"member_id" uuid,
	"bargaining_unit_id" uuid,
	"department_id" varchar(255),
	"location_id" varchar(255),
	"project_id" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"connector_id" uuid NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"direction" "sync_direction" NOT NULL,
	"status" "sync_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_succeeded" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"errors" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clc_bargaining_trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector" varchar(100) NOT NULL,
	"sub_sector" varchar(100),
	"bargaining_unit_size" varchar(50),
	"year" integer NOT NULL,
	"quarter" integer,
	"total_agreements" integer,
	"settled_agreements" integer,
	"unsettled_agreements" integer,
	"strikes_lockouts" integer,
	"average_wage_increase" numeric(5, 2),
	"median_wage_increase" numeric(5, 2),
	"range_low" numeric(5, 2),
	"range_high" numeric(5, 2),
	"average_duration_months" integer,
	"cola_settlements" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_id" varchar(100),
	"source" varchar(50) DEFAULT 'clc_partnership'
);
--> statement-breakpoint
CREATE TABLE "clc_oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" varchar(50) DEFAULT 'Bearer',
	"scopes" text,
	"expires_at" timestamp with time zone,
	"refresh_expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clc_per_capita_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"organization_name" varchar(500) NOT NULL,
	"organization_type" varchar(100),
	"fiscal_year" integer NOT NULL,
	"quarter" integer,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"total_members" integer NOT NULL,
	"dues_paying_members" integer,
	"active_members" integer,
	"per_capita_rate" numeric(10, 4),
	"total_remittance" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'CAD',
	"national_average_rate" numeric(10, 4),
	"provincial_average_rate" numeric(10, 4),
	"percentile_rank" integer,
	"size_category_comparison" varchar(50),
	"sector_comparison" varchar(50),
	"is_verified" boolean DEFAULT false,
	"verification_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_id" varchar(100),
	"source" varchar(50) DEFAULT 'clc_partnership'
);
--> statement-breakpoint
CREATE TABLE "clc_union_density" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector" varchar(100) NOT NULL,
	"sub_sector" varchar(100),
	"industry_code" varchar(20),
	"jurisdiction" varchar(10) NOT NULL,
	"region_name" varchar(255),
	"year" integer NOT NULL,
	"month" integer,
	"total_workforce" integer,
	"union_members" integer,
	"union_covered" integer,
	"density_percent" numeric(5, 2),
	"coverage_percent" numeric(5, 2),
	"year_over_year_change" numeric(5, 2),
	"month_over_month_change" numeric(5, 2),
	"national_density" numeric(5, 2),
	"provincial_density" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_id" varchar(100),
	"source" varchar(50) DEFAULT 'clc_partnership'
);
--> statement-breakpoint
CREATE TABLE "clc_api_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"api_url" varchar(500) NOT NULL,
	"api_key_encrypted" varchar,
	"api_secret" varchar,
	"is_enabled" boolean DEFAULT true,
	"sync_frequency" varchar(50),
	"last_sync_at" timestamp,
	"next_sync_at" timestamp,
	"webhook_url_local" varchar(500),
	"webhook_secret_encrypted" varchar,
	"is_webhook_verified" boolean DEFAULT false,
	"sync_members_enabled" boolean DEFAULT true,
	"sync_remittances_enabled" boolean DEFAULT true,
	"sync_disputes_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"configured_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "clc_remittance_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"local_remittance_id" uuid,
	"external_remittance_id" varchar(100) NOT NULL,
	"local_data" jsonb,
	"external_data" jsonb,
	"reconciliation_status" varchar(50),
	"is_verified" boolean DEFAULT false,
	"verification_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"verified_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "clc_chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_code" varchar(50) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"parent_account_code" varchar(50),
	"is_active" boolean DEFAULT true,
	"description" text,
	"financial_statement_line" varchar(100),
	"statistics_canada_code" varchar(50),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "clc_chart_of_accounts_account_code_key" UNIQUE("account_code")
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remittance_id" uuid,
	"organization_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"priority" varchar(20) NOT NULL,
	"channel" varchar(255),
	"recipients" text,
	"success_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"message_ids" text,
	"errors" text,
	"sent_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255),
	"role" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"is_primary" boolean DEFAULT false,
	"receive_reminders" boolean DEFAULT true,
	"receive_reports" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "per_capita_remittances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_organization_id" uuid NOT NULL,
	"to_organization_id" uuid NOT NULL,
	"remittance_month" integer NOT NULL,
	"remittance_year" integer NOT NULL,
	"due_date" date NOT NULL,
	"total_members" integer NOT NULL,
	"good_standing_members" integer NOT NULL,
	"remittable_members" integer NOT NULL,
	"per_capita_rate" numeric(10, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD',
	"clc_account_code" varchar(50),
	"gl_account" varchar(50),
	"status" varchar(20) DEFAULT 'pending',
	"approval_status" varchar(20) DEFAULT 'draft',
	"submitted_date" timestamp with time zone,
	"approved_date" timestamp with time zone,
	"approved_by" varchar(255),
	"rejected_date" timestamp with time zone,
	"rejected_by" varchar(255),
	"rejection_reason" text,
	"paid_date" timestamp with time zone,
	"payment_method" varchar(50),
	"payment_reference" varchar(100),
	"remittance_file_url" text,
	"receipt_file_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(255),
	CONSTRAINT "unique_org_remittance_period" UNIQUE("from_organization_id","to_organization_id","remittance_month","remittance_year")
);
--> statement-breakpoint
CREATE TABLE "remittance_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remittance_id" uuid NOT NULL,
	"approver_user_id" varchar(255) NOT NULL,
	"approver_role" varchar(50),
	"approval_level" varchar(20),
	"action" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"reviewed_at" timestamp with time zone,
	"comment" text,
	"rejection_reason" text,
	"flagged_issues" text,
	"requested_changes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clc_organization_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"affiliate_code" varchar(50) NOT NULL,
	"action" varchar(20) NOT NULL,
	"changes" text,
	"conflicts" json,
	"duration" integer NOT NULL,
	"error" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "address_change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_id" uuid NOT NULL,
	"change_type" text NOT NULL,
	"changed_by" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"change_reason" text,
	"change_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address_validation_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input_hash" text NOT NULL,
	"country_code" text NOT NULL,
	"address_line_1" text NOT NULL,
	"locality" text NOT NULL,
	"administrative_area" text,
	"postal_code" text,
	"is_valid" boolean NOT NULL,
	"validated_by" text NOT NULL,
	"confidence" text,
	"corrected_address" jsonb,
	"latitude" text,
	"longitude" text,
	"metadata" jsonb,
	"expires_at" timestamp NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"last_hit_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "address_validation_cache_input_hash_unique" UNIQUE("input_hash")
);
--> statement-breakpoint
CREATE TABLE "country_address_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"iso3_code" text,
	"locality_label" text DEFAULT 'City' NOT NULL,
	"administrative_area_label" text DEFAULT 'State',
	"postal_code_label" text DEFAULT 'Postal Code',
	"sub_administrative_area_label" text,
	"required_fields" jsonb,
	"optional_fields" jsonb,
	"address_format" text NOT NULL,
	"display_order" jsonb,
	"postal_code_required" boolean DEFAULT true NOT NULL,
	"postal_code_pattern" text,
	"postal_code_example" text,
	"postal_code_length" integer,
	"administrative_areas" jsonb,
	"has_subdivisions" boolean DEFAULT false NOT NULL,
	"validation_rules" jsonb,
	"geocoding_supported" boolean DEFAULT true NOT NULL,
	"preferred_geocoder" text,
	"standardization_provider" text,
	"standardization_available" boolean DEFAULT false NOT NULL,
	"example_addresses" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "country_address_formats_country_code_unique" UNIQUE("country_code")
);
--> statement-breakpoint
CREATE TABLE "international_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text,
	"address_type" "address_type" DEFAULT 'mailing' NOT NULL,
	"status" "address_status" DEFAULT 'unverified' NOT NULL,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"address_line_3" text,
	"locality" text NOT NULL,
	"locality_type" text,
	"administrative_area" text,
	"administrative_area_type" text,
	"postal_code" text,
	"postal_code_type" text,
	"sub_administrative_area" text,
	"dependent_locality" text,
	"sorting_code" text,
	"formatted_address" text,
	"local_format" text,
	"latitude" text,
	"longitude" text,
	"geocoded_at" timestamp,
	"geocode_provider" text,
	"geocode_accuracy" text,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validated_by" text,
	"validated_at" timestamp,
	"validation_result" jsonb,
	"is_standardized" boolean DEFAULT false NOT NULL,
	"standardized_by" text,
	"standardized_at" timestamp,
	"standardized_data" jsonb,
	"deliverability" text,
	"delivery_point" text,
	"carrier_route" text,
	"metadata" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"platform_user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"profile_image_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text[],
	"status" "social_account_status" DEFAULT 'active' NOT NULL,
	"is_primary" boolean DEFAULT false,
	"is_verified" boolean DEFAULT false,
	"rate_limit_remaining" integer,
	"rate_limit_reset_at" timestamp with time zone,
	"follower_count" integer DEFAULT 0,
	"following_count" integer DEFAULT 0,
	"post_count" integer DEFAULT 0,
	"engagement_rate" numeric(5, 2),
	"account_metadata" jsonb DEFAULT '{}'::jsonb,
	"connected_by" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_organization_id_platform_platform_user_id_unique" UNIQUE("organization_id","platform","platform_user_id")
);
--> statement-breakpoint
CREATE TABLE "social_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"analytics_date" date NOT NULL,
	"follower_count" integer DEFAULT 0,
	"follower_change" integer DEFAULT 0,
	"following_count" integer DEFAULT 0,
	"posts_published" integer DEFAULT 0,
	"total_impressions" integer DEFAULT 0,
	"total_reach" integer DEFAULT 0,
	"total_likes" integer DEFAULT 0,
	"total_comments" integer DEFAULT 0,
	"total_shares" integer DEFAULT 0,
	"total_engagements" integer DEFAULT 0,
	"engagement_rate" numeric(5, 2),
	"profile_visits" integer DEFAULT 0,
	"link_clicks" integer DEFAULT 0,
	"analytics_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_analytics_account_id_analytics_date_unique" UNIQUE("account_id","analytics_date")
);
--> statement-breakpoint
CREATE TABLE "social_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"campaign_code" text,
	"platforms" text[],
	"target_audience" text,
	"campaign_hashtags" text[],
	"status" "campaign_status" DEFAULT 'planning' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"goal_impressions" integer,
	"goal_engagement_rate" numeric(5, 2),
	"goal_conversions" integer,
	"campaign_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_engagement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"engagement_type" "engagement_type" NOT NULL,
	"platform_engagement_id" text,
	"platform_user_id" text,
	"username" text,
	"display_name" text,
	"profile_image_url" text,
	"content" text,
	"sentiment" text,
	"sentiment_score" numeric(5, 2),
	"engaged_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"engagement_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"platform_item_id" text NOT NULL,
	"item_type" text NOT NULL,
	"content" text,
	"media_urls" text[],
	"author_id" text,
	"author_name" text,
	"author_username" text,
	"author_image_url" text,
	"likes_count" integer DEFAULT 0,
	"comments_count" integer DEFAULT 0,
	"shares_count" integer DEFAULT 0,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feed_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_feeds_account_id_platform_item_id_unique" UNIQUE("account_id","platform_item_id")
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"campaign_id" uuid,
	"post_type" "social_post_type" DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"media_urls" text[],
	"link_url" text,
	"link_preview_image" text,
	"hashtags" text[],
	"mentions" text[],
	"status" "social_post_status" DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"platform_post_id" text,
	"platform_url" text,
	"likes_count" integer DEFAULT 0,
	"comments_count" integer DEFAULT 0,
	"shares_count" integer DEFAULT 0,
	"impressions_count" integer DEFAULT 0,
	"reach_count" integer DEFAULT 0,
	"engagement_rate" numeric(5, 2),
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"last_retry_at" timestamp with time zone,
	"post_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cpi_adjusted_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"item_description" text NOT NULL,
	"contract_id" uuid,
	"original_price" numeric(15, 2) NOT NULL,
	"original_price_date" timestamp NOT NULL,
	"original_cpi" numeric(10, 4) NOT NULL,
	"adjusted_price" numeric(15, 2) NOT NULL,
	"adjustment_date" timestamp NOT NULL,
	"current_cpi" numeric(10, 4) NOT NULL,
	"cpi_change_percentage" numeric(6, 4) NOT NULL,
	"adjustment_amount" numeric(15, 2) NOT NULL,
	"adjustment_approved" boolean DEFAULT false NOT NULL,
	"approved_by" varchar(255),
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpi_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_year" varchar(4) NOT NULL,
	"period_month" varchar(2) NOT NULL,
	"period_date" timestamp NOT NULL,
	"cpi_value" numeric(10, 4) NOT NULL,
	"cpi_change" numeric(6, 4),
	"cpi_year_over_year" numeric(6, 4),
	"base_year" varchar(4) DEFAULT '2002' NOT NULL,
	"source" varchar(50) DEFAULT 'statistics_canada' NOT NULL,
	"data_quality" varchar(20) DEFAULT 'official' NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"imported_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fmv_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_description" text NOT NULL,
	"procurement_request_id" uuid,
	"bid_id" uuid,
	"appraisal_id" uuid,
	"performed_by" varchar(255) NOT NULL,
	"performed_by_role" varchar(50),
	"compliance_impact" varchar(20),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fmv_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_category" varchar(50) NOT NULL,
	"item_description" text NOT NULL,
	"item_specifications" jsonb,
	"fmv_low" numeric(15, 2) NOT NULL,
	"fmv_high" numeric(15, 2) NOT NULL,
	"fmv_median" numeric(15, 2) NOT NULL,
	"region" varchar(50) NOT NULL,
	"city" varchar(100),
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"data_sources" jsonb,
	"comparable_transactions" jsonb,
	"cpi_adjusted" boolean DEFAULT false NOT NULL,
	"original_fmv" numeric(15, 2),
	"cpi_adjustment_factor" numeric(10, 6),
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fmv_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_enabled" boolean DEFAULT true NOT NULL,
	"fmv_verification_required" boolean DEFAULT true NOT NULL,
	"competitive_bidding_threshold" numeric(15, 2) DEFAULT '10000.00' NOT NULL,
	"minimum_bids_required" varchar(2) DEFAULT '3' NOT NULL,
	"cpi_escalator_enabled" boolean DEFAULT true NOT NULL,
	"cpi_update_frequency" varchar(20) DEFAULT 'monthly' NOT NULL,
	"cpi_base_year" varchar(4) DEFAULT '2002' NOT NULL,
	"appraisal_required" boolean DEFAULT true NOT NULL,
	"appraisal_threshold" numeric(15, 2) DEFAULT '50000.00' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "fmv_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"violation_type" varchar(50) NOT NULL,
	"violation_description" text NOT NULL,
	"procurement_request_id" uuid,
	"transaction_id" uuid,
	"severity" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"resolved_by" varchar(255),
	"resolved_at" timestamp,
	"detected_by" varchar(255),
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "independent_appraisals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_type" varchar(50) NOT NULL,
	"item_description" text NOT NULL,
	"item_specifications" jsonb,
	"procurement_request_id" uuid,
	"appraiser_name" text NOT NULL,
	"appraiser_company" text,
	"appraiser_credentials" text,
	"appraiser_contact" text,
	"appraised_value" numeric(15, 2) NOT NULL,
	"appraisal_method" varchar(50) NOT NULL,
	"appraisal_date" timestamp NOT NULL,
	"appraisal_valid_until" timestamp,
	"appraisal_report" text,
	"appraisal_notes" text,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"procurement_request_id" uuid NOT NULL,
	"bidder_name" text NOT NULL,
	"bidder_contact" text NOT NULL,
	"bidder_email" varchar(255),
	"bidder_phone" varchar(20),
	"bid_amount" numeric(15, 2) NOT NULL,
	"bid_documents" jsonb,
	"bid_notes" text,
	"bid_valid_until" timestamp,
	"fmv_benchmark_id" uuid,
	"within_fmv_range" boolean DEFAULT false NOT NULL,
	"fmv_variance_percentage" numeric(6, 2),
	"evaluation_score" numeric(5, 2),
	"evaluation_notes" text,
	"evaluated_by" varchar(255),
	"evaluated_at" timestamp,
	"bid_status" varchar(20) DEFAULT 'submitted' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" varchar(50) NOT NULL,
	"request_title" text NOT NULL,
	"request_description" text NOT NULL,
	"requested_by" varchar(255) NOT NULL,
	"requested_by_department" varchar(100),
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"estimated_value" numeric(15, 2) NOT NULL,
	"budget_approved" boolean DEFAULT false NOT NULL,
	"approved_by" varchar(255),
	"approved_at" timestamp,
	"procurement_type" varchar(50) NOT NULL,
	"procurement_method" varchar(50) DEFAULT 'competitive_bidding' NOT NULL,
	"minimum_bids_required" varchar(2) DEFAULT '3' NOT NULL,
	"bids_received" varchar(2) DEFAULT '0' NOT NULL,
	"bidding_deadline" timestamp,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"awarded_to" varchar(255),
	"awarded_amount" numeric(15, 2),
	"awarded_at" timestamp,
	"award_justification" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "procurement_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "defensibility_packs" (
	"pack_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"case_number" varchar(50) NOT NULL,
	"organization_id" uuid NOT NULL,
	"pack_version" varchar(10) DEFAULT '1.0.0' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" varchar(255) NOT NULL,
	"export_format" varchar(10) NOT NULL,
	"export_purpose" varchar(50) NOT NULL,
	"requested_by" varchar(255),
	"pack_data" jsonb NOT NULL,
	"integrity_hash" varchar(64) NOT NULL,
	"timeline_hash" varchar(64) NOT NULL,
	"audit_hash" varchar(64) NOT NULL,
	"state_transition_hash" varchar(64) NOT NULL,
	"verification_status" varchar(20) DEFAULT 'verified' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"verification_attempts" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"last_downloaded_at" timestamp with time zone,
	"last_downloaded_by" varchar(255),
	"file_size_bytes" integer,
	"storage_location" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	"deletion_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_download_log" (
	"log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"case_number" varchar(50) NOT NULL,
	"organization_id" uuid NOT NULL,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"downloaded_by" varchar(255) NOT NULL,
	"downloaded_by_role" varchar(50),
	"download_purpose" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"export_format" varchar(10) NOT NULL,
	"file_size_bytes" integer,
	"integrity_verified" boolean DEFAULT true,
	"download_success" boolean DEFAULT true,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "pack_verification_log" (
	"verification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"case_number" varchar(50) NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_by" varchar(255),
	"verification_passed" boolean NOT NULL,
	"expected_hash" varchar(64) NOT NULL,
	"actual_hash" varchar(64),
	"failure_reason" text,
	"tampered_fields" jsonb,
	"verification_trigger" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "accessibility_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"audit_name" text NOT NULL,
	"audit_type" text NOT NULL,
	"target_url" text NOT NULL,
	"target_environment" text NOT NULL,
	"wcag_version" text DEFAULT '2.2' NOT NULL,
	"conformance_level" "wcag_level" DEFAULT 'AA' NOT NULL,
	"status" "audit_status" DEFAULT 'pending' NOT NULL,
	"tools_used" jsonb,
	"total_issues" integer DEFAULT 0 NOT NULL,
	"critical_issues" integer DEFAULT 0 NOT NULL,
	"serious_issues" integer DEFAULT 0 NOT NULL,
	"moderate_issues" integer DEFAULT 0 NOT NULL,
	"minor_issues" integer DEFAULT 0 NOT NULL,
	"accessibility_score" integer,
	"pages_scanned" integer DEFAULT 0 NOT NULL,
	"elements_scanned" integer DEFAULT 0 NOT NULL,
	"scan_duration_ms" integer,
	"report_url" text,
	"report_data" jsonb,
	"triggered_by" text,
	"scheduled_by" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accessibility_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"issue_title" text NOT NULL,
	"issue_description" text NOT NULL,
	"severity" "a11y_issue_severity" NOT NULL,
	"wcag_criteria" text NOT NULL,
	"wcag_level" "wcag_level" NOT NULL,
	"wcag_title" text NOT NULL,
	"wcag_url" text,
	"page_url" text NOT NULL,
	"element_selector" text,
	"element_html" text,
	"element_xpath" text,
	"context" jsonb,
	"fix_suggestion" text,
	"code_example" text,
	"impacted_users" text,
	"affects_screen_readers" boolean DEFAULT false NOT NULL,
	"affects_keyboard_nav" boolean DEFAULT false NOT NULL,
	"affects_color_blindness" boolean DEFAULT false NOT NULL,
	"status" "a11y_issue_status" DEFAULT 'open' NOT NULL,
	"assigned_to" text,
	"priority" integer DEFAULT 3 NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_notes" text,
	"verified_at" timestamp,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accessibility_test_suites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"suite_name" text NOT NULL,
	"suite_description" text,
	"suite_type" text NOT NULL,
	"url_patterns" jsonb,
	"exclude_patterns" jsonb,
	"enabled_rules" jsonb,
	"disabled_rules" jsonb,
	"custom_rules" jsonb,
	"is_scheduled" boolean DEFAULT false NOT NULL,
	"schedule_expression" text,
	"notify_on_failure" boolean DEFAULT true NOT NULL,
	"notify_emails" jsonb,
	"notify_slack_channel" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"last_run_status" "audit_status",
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accessibility_user_testing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_name" text NOT NULL,
	"session_date" timestamp NOT NULL,
	"participant_name" text NOT NULL,
	"participant_email" text,
	"assistive_technology" text,
	"assistive_tech_version" text,
	"disability" text,
	"features_tested" jsonb,
	"task_list" jsonb,
	"overall_rating" integer,
	"issues_found" jsonb,
	"positive_findings" jsonb,
	"recording_url" text,
	"transcript_url" text,
	"notes" text,
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"follow_up_notes" text,
	"conducted_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wcag_success_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criteria_number" text NOT NULL,
	"criteria_title" text NOT NULL,
	"criteria_description" text NOT NULL,
	"level" "wcag_level" NOT NULL,
	"wcag_version" text DEFAULT '2.2' NOT NULL,
	"principle" text NOT NULL,
	"guideline" text NOT NULL,
	"understanding_url" text,
	"how_to_meet_url" text,
	"testing_procedure" text,
	"common_failures" jsonb,
	"sufficient_techniques" jsonb,
	"keywords" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wcag_success_criteria_criteria_number_unique" UNIQUE("criteria_number")
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"subcategory" varchar(100),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"visibility" varchar(50) DEFAULT 'public' NOT NULL,
	"view_count" integer DEFAULT 0,
	"helpful_count" integer DEFAULT 0,
	"not_helpful_count" integer DEFAULT 0,
	"meta_description" text,
	"meta_keywords" jsonb DEFAULT '[]'::jsonb,
	"version" integer DEFAULT 1,
	"published_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"author_user_id" text,
	"author_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "knowledge_base_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"priority" "ticket_priority",
	"category" "ticket_category",
	"organization_tier" varchar(50),
	"response_time_minutes" integer NOT NULL,
	"resolution_time_minutes" integer NOT NULL,
	"business_hours_only" boolean DEFAULT true,
	"timezone" varchar(100) DEFAULT 'UTC',
	"escalation_enabled" boolean DEFAULT false,
	"escalation_threshold_minutes" integer,
	"escalation_to_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar(50) NOT NULL,
	"organization_id" uuid NOT NULL,
	"organization_name" varchar(255),
	"requestor_user_id" text,
	"requestor_email" varchar(255) NOT NULL,
	"requestor_name" varchar(255),
	"subject" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"category" "ticket_category" NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"source" "ticket_source" NOT NULL,
	"assigned_to_user_id" text,
	"assigned_to_name" varchar(255),
	"assigned_at" timestamp with time zone,
	"sla_response_by" timestamp with time zone,
	"sla_resolve_by" timestamp with time zone,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"response_sla_breach" boolean DEFAULT false,
	"resolution_sla_breach" boolean DEFAULT false,
	"response_time_minutes" integer,
	"resolution_time_minutes" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"satisfaction_rating" integer,
	"satisfaction_comment" text,
	"satisfaction_responded_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "support_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"is_automated" boolean DEFAULT false,
	"author_user_id" text,
	"author_email" varchar(255),
	"author_name" varchar(255),
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"field" varchar(100),
	"old_value" text,
	"new_value" text,
	"changed_by_user_id" text,
	"changed_by_name" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(10) NOT NULL,
	"scopes" text[] NOT NULL,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"revoked_at" timestamp,
	"revoked_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "integration_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "integration_type" NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"credentials" jsonb NOT NULL,
	"settings" jsonb,
	"webhook_url" text,
	"enabled" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"sync_type" "sync_type" NOT NULL,
	"orgs" text[],
	"status" "sync_status" NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_created" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"cursor" text,
	"error" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "integration_sync_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"sync_type" "sync_type" NOT NULL,
	"orgs" text[],
	"schedule" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"url" text NOT NULL,
	"description" text,
	"events" text[] NOT NULL,
	"secret" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"delivery_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"last_triggered_at" timestamp,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status_code" integer,
	"response_body" text,
	"error" text,
	"attempt_number" integer DEFAULT 1,
	"delivered_at" timestamp DEFAULT now(),
	"duration" integer
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" text,
	"verified" boolean DEFAULT false,
	"status" "webhook_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"received_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pilot_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" varchar(100) NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilot_demo_seeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"seeded_by" varchar(255),
	"seeded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purged_at" timestamp with time zone,
	"member_count" integer DEFAULT 0 NOT NULL,
	"employer_count" integer DEFAULT 0 NOT NULL,
	"grievance_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilot_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pilot_id" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrolled_by" varchar(255),
	"organizer_adoption_rate" real DEFAULT 0 NOT NULL,
	"member_engagement_rate" real DEFAULT 0 NOT NULL,
	"cases_managed" integer DEFAULT 0 NOT NULL,
	"avg_time_to_resolution" real DEFAULT 0 NOT NULL,
	"health_score" real DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilot_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"target_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federation_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federation_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"campaign_type" "federation_campaign_type" NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"target_completion_date" date,
	"target_sector" varchar(100),
	"target_employer" varchar(255),
	"target_region" varchar(100),
	"target_workers" integer,
	"goal_description" text,
	"workers_reached" integer DEFAULT 0,
	"workers_organized" integer DEFAULT 0,
	"cards_signed_count" integer DEFAULT 0,
	"events_held" integer DEFAULT 0,
	"volunteers_involved" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'planned',
	"progress_percentage" integer DEFAULT 0,
	"lead_organizer_id" varchar(255),
	"lead_organizer_name" varchar(255),
	"coordinating_union_id" uuid,
	"participating_union_count" integer DEFAULT 0,
	"budget" numeric(12, 2),
	"actual_spend" numeric(12, 2) DEFAULT '0',
	"currency" varchar(3) DEFAULT 'CAD',
	"is_public" boolean DEFAULT false,
	"public_page_url" text,
	"social_media_hashtags" text,
	"success_level" varchar(20),
	"outcome_description" text,
	"lessons_learned" text,
	"resources_url" text,
	"report_url" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "federation_campaigns_slug_key" UNIQUE("federation_id","slug")
);
--> statement-breakpoint
CREATE TABLE "federation_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federation_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"communication_type" "federation_communication_type" NOT NULL,
	"subject" varchar(500),
	"content" text NOT NULL,
	"summary" text,
	"author_user_id" varchar(255),
	"author_name" varchar(255),
	"author_title" varchar(255),
	"status" varchar(20) DEFAULT 'draft',
	"published_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"send_to_all_members" boolean DEFAULT true,
	"target_audience" varchar(100),
	"sent_count" integer DEFAULT 0,
	"delivered_count" integer DEFAULT 0,
	"opened_count" integer DEFAULT 0,
	"click_count" integer DEFAULT 0,
	"priority" varchar(20) DEFAULT 'normal',
	"is_pinned" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"featured_image" text,
	"related_campaign_id" uuid,
	"related_meeting_id" uuid,
	"related_event_id" uuid,
	"attachments" jsonb,
	"call_to_action" varchar(255),
	"action_url" text,
	"action_button_text" varchar(100),
	"tags" text[],
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "federation_communications_slug_key" UNIQUE("federation_id","slug")
);
--> statement-breakpoint
CREATE TABLE "federation_executives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federation_id" uuid NOT NULL,
	"profile_user_id" varchar(255) NOT NULL,
	"union_organization_id" uuid,
	"position" varchar(100) NOT NULL,
	"position_type" varchar(50) NOT NULL,
	"portfolio_area" varchar(100),
	"term_start" date NOT NULL,
	"term_end" date,
	"current_term" boolean DEFAULT true,
	"term_number" integer DEFAULT 1,
	"elected_date" date,
	"election_type" varchar(50),
	"votes_received" integer,
	"executive_email" varchar(255),
	"executive_phone" varchar(50),
	"office_location" varchar(255),
	"signing_authority" boolean DEFAULT false,
	"budget_authority" boolean DEFAULT false,
	"can_approve_remittances" boolean DEFAULT false,
	"can_manage_campaigns" boolean DEFAULT false,
	"compensation_type" varchar(50),
	"compensation_amount" numeric(10, 2),
	"status" varchar(20) DEFAULT 'active',
	"is_active" boolean DEFAULT true,
	"biography" text,
	"photo" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "federation_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federation_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"meeting_type" "federation_meeting_type" NOT NULL,
	"description" text,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"timezone" varchar(50) DEFAULT 'America/Toronto',
	"location_type" varchar(20) DEFAULT 'in_person',
	"venue_name" varchar(255),
	"venue_address" text,
	"virtual_meeting_url" text,
	"virtual_meeting_platform" varchar(50),
	"expected_attendees" integer,
	"actual_attendees" integer,
	"quorum_required" integer,
	"quorum_met" boolean,
	"status" varchar(20) DEFAULT 'scheduled',
	"minutes_url" text,
	"recording_url" text,
	"resolutions_passed" integer DEFAULT 0,
	"decisions_url" text,
	"registration_required" boolean DEFAULT false,
	"registration_deadline" timestamp with time zone,
	"registration_url" text,
	"max_capacity" integer,
	"agenda_url" text,
	"materials_url" text,
	"organizer_user_id" varchar(255),
	"organizer_name" varchar(255),
	"organizer_email" varchar(255),
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "federation_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federation_id" uuid NOT NULL,
	"union_organization_id" uuid NOT NULL,
	"status" "federation_membership_status" DEFAULT 'active' NOT NULL,
	"membership_number" varchar(100),
	"joined_date" date NOT NULL,
	"effective_date" date,
	"suspended_date" date,
	"terminated_date" date,
	"last_renewal_date" date,
	"next_renewal_date" date,
	"membership_type" varchar(50) DEFAULT 'full',
	"voting_rights" boolean DEFAULT true,
	"executive_eligibility" boolean DEFAULT true,
	"per_capita_rate" numeric(10, 4),
	"monthly_dues" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'CAD',
	"dues_in_arrears" boolean DEFAULT false,
	"arrears_amount" numeric(12, 2) DEFAULT '0',
	"last_payment_date" date,
	"delegate_count" integer DEFAULT 1,
	"executive_seats" integer DEFAULT 0,
	"primary_contact_user_id" varchar(255),
	"primary_contact_name" varchar(255),
	"primary_contact_email" varchar(255),
	"primary_contact_phone" varchar(50),
	"suspension_reason" text,
	"termination_reason" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "federation_memberships_federation_union_key" UNIQUE("federation_id","union_organization_id")
);
--> statement-breakpoint
CREATE TABLE "federation_remittances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federation_id" uuid NOT NULL,
	"from_organization_id" uuid NOT NULL,
	"to_organization_id" uuid NOT NULL,
	"membership_id" uuid,
	"per_capita_remittance_id" uuid,
	"remittance_month" integer NOT NULL,
	"remittance_year" integer NOT NULL,
	"period_start" date,
	"period_end" date,
	"due_date" date NOT NULL,
	"total_members" integer NOT NULL,
	"remittable_members" integer NOT NULL,
	"per_capita_rate" numeric(10, 4) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD',
	"status" varchar(20) DEFAULT 'pending',
	"payment_status" varchar(20) DEFAULT 'unpaid',
	"amount_paid" numeric(12, 2) DEFAULT '0',
	"amount_outstanding" numeric(12, 2),
	"paid_date" timestamp with time zone,
	"payment_method" varchar(50),
	"payment_reference" varchar(100),
	"cheque_number" varchar(50),
	"approval_status" varchar(20) DEFAULT 'draft',
	"submitted_date" timestamp with time zone,
	"submitted_by" varchar(255),
	"approved_date" timestamp with time zone,
	"approved_by" varchar(255),
	"rejected_date" timestamp with time zone,
	"rejected_by" varchar(255),
	"rejection_reason" text,
	"invoice_url" text,
	"receipt_url" text,
	"remittance_file_url" text,
	"gl_account" varchar(50),
	"fiscal_period" varchar(20),
	"late_fee_amount" numeric(10, 2) DEFAULT '0',
	"adjustment_amount" numeric(10, 2) DEFAULT '0',
	"adjustment_reason" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "federation_remittances_unique_period" UNIQUE("federation_id","from_organization_id","remittance_year","remittance_month")
);
--> statement-breakpoint
CREATE TABLE "federation_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federation_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"resource_type" "federation_resource_type" NOT NULL,
	"description" text,
	"category" varchar(100),
	"sub_category" varchar(100),
	"topics" text[],
	"target_audience" varchar(100),
	"skill_level" varchar(20),
	"file_url" text,
	"file_type" varchar(50),
	"file_size" integer,
	"thumbnail_url" text,
	"preview_url" text,
	"additional_files" jsonb,
	"version" varchar(20) DEFAULT '1.0',
	"previous_version_id" uuid,
	"is_current_version" boolean DEFAULT true,
	"status" varchar(20) DEFAULT 'draft',
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"author_user_id" varchar(255),
	"author_name" varchar(255),
	"author_organization" varchar(255),
	"contributors" text[],
	"is_public" boolean DEFAULT false,
	"access_level" varchar(50) DEFAULT 'members_only',
	"download_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"rating" numeric(3, 2),
	"rating_count" integer DEFAULT 0,
	"language" varchar(10) DEFAULT 'en',
	"available_languages" text[],
	"license" varchar(100) DEFAULT 'internal_use',
	"license_url" text,
	"related_resource_ids" uuid[],
	"related_campaign_id" uuid,
	"tags" text[],
	"search_keywords" text,
	"notes" text,
	"usage_instructions" text,
	"credits" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "federation_resources_slug_key" UNIQUE("federation_id","slug")
);
--> statement-breakpoint
CREATE TABLE "federations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"short_name" varchar(100),
	"slug" varchar(255) NOT NULL,
	"federation_type" "federation_type" DEFAULT 'provincial' NOT NULL,
	"province" varchar(2),
	"region" varchar(100),
	"jurisdiction" varchar(100),
	"email" varchar(255),
	"phone" varchar(50),
	"website" text,
	"address" jsonb,
	"founded_date" date,
	"affiliated_with_clc" boolean DEFAULT true,
	"clc_affiliate_code" varchar(50),
	"total_member_unions" integer DEFAULT 0,
	"total_represented_workers" integer DEFAULT 0,
	"per_capita_rate" numeric(10, 4),
	"currency" varchar(3) DEFAULT 'CAD',
	"fiscal_year_end" varchar(5),
	"status" varchar(20) DEFAULT 'active',
	"is_active" boolean DEFAULT true,
	"description" text,
	"mission" text,
	"constitution" text,
	"bylaws" text,
	"strategic_plan" text,
	"settings" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "federations_slug_key" UNIQUE("slug"),
	CONSTRAINT "federations_organization_id_key" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "org_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "org_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"storage_used_bytes" integer DEFAULT 0 NOT NULL,
	"document_count" integer DEFAULT 0 NOT NULL,
	"api_call_count" integer DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp with time zone DEFAULT now(),
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"tenant_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_primary" boolean DEFAULT false,
	"department" text,
	"position" text,
	"hire_date" timestamp with time zone,
	"membership_number" text,
	"seniority" integer,
	"union_join_date" timestamp with time zone,
	"preferred_contact_method" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organization_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_org_id" uuid NOT NULL,
	"child_org_id" uuid NOT NULL,
	"relationship_type" "organization_relationship_type" NOT NULL,
	"effective_date" date DEFAULT now() NOT NULL,
	"end_date" date,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text,
	"short_name" text,
	"description" text,
	"organization_type" "organization_type" NOT NULL,
	"parent_id" uuid,
	"hierarchy_path" text[] NOT NULL,
	"hierarchy_level" integer DEFAULT 0 NOT NULL,
	"province_territory" text,
	"sectors" "labour_sector"[] DEFAULT '{}',
	"email" text,
	"phone" text,
	"website" text,
	"address" jsonb,
	"clc_affiliated" boolean DEFAULT false,
	"affiliation_date" date,
	"charter_number" text,
	"member_count" integer DEFAULT 0,
	"active_member_count" integer DEFAULT 0,
	"last_member_count_update" timestamp with time zone,
	"subscription_tier" text,
	"billing_contact_id" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"features_enabled" text[] DEFAULT '{}',
	"status" text DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" uuid,
	"clerk_organization_id" text,
	"legacy_tenant_id" uuid,
	"clc_affiliate_code" varchar(20),
	"per_capita_rate" numeric(10, 2),
	"remittance_day" integer DEFAULT 15,
	"last_remittance_date" timestamp with time zone,
	"fiscal_year_end" date DEFAULT '2024-12-31',
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bargaining_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"worksite_id" uuid,
	"name" varchar(255) NOT NULL,
	"unit_number" varchar(50),
	"unit_type" "unit_type" NOT NULL,
	"status" "unit_status" DEFAULT 'active' NOT NULL,
	"certification_number" varchar(100),
	"certification_date" date,
	"certification_body" varchar(100),
	"certification_expiry_date" date,
	"current_collective_agreement_id" uuid,
	"contract_expiry_date" date,
	"next_bargaining_date" date,
	"member_count" integer DEFAULT 0,
	"classifications" jsonb,
	"chief_steward_id" text,
	"bargaining_chair_id" text,
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "committee_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"role" "committee_member_role" DEFAULT 'member' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"term_number" integer DEFAULT 1,
	"appointment_method" varchar(50),
	"appointed_by" text,
	"election_date" date,
	"votes_received" integer,
	"meetings_attended" integer DEFAULT 0,
	"meetings_total" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"committee_type" "committee_type" NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"unit_id" uuid,
	"worksite_id" uuid,
	"is_organization_wide" boolean DEFAULT false,
	"mandate" text,
	"meeting_frequency" varchar(100),
	"meeting_day" varchar(50),
	"meeting_time" varchar(50),
	"meeting_location" text,
	"max_members" integer,
	"current_member_count" integer DEFAULT 0,
	"requires_appointment" boolean DEFAULT false,
	"requires_election" boolean DEFAULT false,
	"term_length" integer,
	"chair_id" text,
	"secretary_id" text,
	"contact_email" varchar(255),
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_tenure_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"role_type" varchar(100) NOT NULL,
	"role_title" varchar(255) NOT NULL,
	"role_level" varchar(50),
	"related_entity_type" varchar(50),
	"related_entity_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current_role" boolean DEFAULT true,
	"appointment_method" varchar(50),
	"election_date" date,
	"votes_received" integer,
	"vote_total" integer,
	"term_length" integer,
	"term_number" integer DEFAULT 1,
	"end_reason" varchar(100),
	"ended_by" text,
	"notes" text,
	"achievements" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "worksites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"status" "worksite_status" DEFAULT 'active' NOT NULL,
	"address" jsonb,
	"employee_count" integer,
	"shift_count" integer,
	"operates_weekends" boolean DEFAULT false,
	"operates_24_hours" boolean DEFAULT false,
	"site_manager_name" varchar(255),
	"site_manager_email" varchar(255),
	"site_manager_phone" varchar(50),
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_account_mappings" ADD CONSTRAINT "gl_account_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_account_mappings" ADD CONSTRAINT "gl_account_mappings_chart_of_accounts_id_chart_of_accounts_id_fk" FOREIGN KEY ("chart_of_accounts_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_steward_id_profiles_user_id_fk" FOREIGN KEY ("steward_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_unit_id_bargaining_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."bargaining_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_appointed_by_profiles_user_id_fk" FOREIGN KEY ("appointed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_management"."oauth_providers" ADD CONSTRAINT "oauth_providers_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_management"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_management"."organization_users" ADD CONSTRAINT "organization_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_management"."organization_users" ADD CONSTRAINT "organization_users_invited_by_users_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "user_management"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_management"."user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_management"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_management"."user_sessions" ADD CONSTRAINT "user_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_member_employment_id_member_employment_id_fk" FOREIGN KEY ("member_employment_id") REFERENCES "public"."member_employment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_classifications" ADD CONSTRAINT "job_classifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_classifications" ADD CONSTRAINT "job_classifications_bargaining_unit_id_bargaining_units_id_fk" FOREIGN KEY ("bargaining_unit_id") REFERENCES "public"."bargaining_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_employment" ADD CONSTRAINT "member_employment_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_employment" ADD CONSTRAINT "member_employment_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_employment" ADD CONSTRAINT "member_employment_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_employment" ADD CONSTRAINT "member_employment_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_employment" ADD CONSTRAINT "member_employment_bargaining_unit_id_bargaining_units_id_fk" FOREIGN KEY ("bargaining_unit_id") REFERENCES "public"."bargaining_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_leaves" ADD CONSTRAINT "member_leaves_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_leaves" ADD CONSTRAINT "member_leaves_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_leaves" ADD CONSTRAINT "member_leaves_member_employment_id_member_employment_id_fk" FOREIGN KEY ("member_employment_id") REFERENCES "public"."member_employment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_executions" ADD CONSTRAINT "segment_executions_segment_id_member_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."member_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_exports" ADD CONSTRAINT "segment_exports_segment_id_member_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."member_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_addresses" ADD CONSTRAINT "member_addresses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_deadlines" ADD CONSTRAINT "grievance_deadlines_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_documents" ADD CONSTRAINT "grievance_documents_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_updates" ADD CONSTRAINT "claim_updates_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arbitrations" ADD CONSTRAINT "arbitrations_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_responses" ADD CONSTRAINT "grievance_responses_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_timeline" ADD CONSTRAINT "grievance_timeline_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_arbitration_id_arbitrations_id_fk" FOREIGN KEY ("arbitration_id") REFERENCES "public"."arbitrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_alerts" ADD CONSTRAINT "deadline_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_extensions" ADD CONSTRAINT "deadline_extensions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_rules" ADD CONSTRAINT "deadline_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_deadlines" ADD CONSTRAINT "claim_deadlines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_approvals" ADD CONSTRAINT "grievance_approvals_transition_id_grievance_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."grievance_transitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_assignments" ADD CONSTRAINT "grievance_assignments_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_communications" ADD CONSTRAINT "grievance_communications_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_settlements" ADD CONSTRAINT "grievance_settlements_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_stages" ADD CONSTRAINT "grievance_stages_workflow_id_grievance_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."grievance_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_transitions" ADD CONSTRAINT "grievance_transitions_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_transitions" ADD CONSTRAINT "grievance_transitions_from_stage_id_grievance_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."grievance_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_transitions" ADD CONSTRAINT "grievance_transitions_to_stage_id_grievance_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."grievance_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_events" ADD CONSTRAINT "grievance_events_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cba_contacts" ADD CONSTRAINT "cba_contacts_cba_id_collective_agreements_id_fk" FOREIGN KEY ("cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cba_version_history" ADD CONSTRAINT "cba_version_history_cba_id_collective_agreements_id_fk" FOREIGN KEY ("cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_comparisons" ADD CONSTRAINT "benefit_comparisons_cba_id_collective_agreements_id_fk" FOREIGN KEY ("cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_comparisons" ADD CONSTRAINT "benefit_comparisons_clause_id_cba_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."cba_clauses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cba_clauses" ADD CONSTRAINT "cba_clauses_cba_id_collective_agreements_id_fk" FOREIGN KEY ("cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_progressions" ADD CONSTRAINT "wage_progressions_cba_id_collective_agreements_id_fk" FOREIGN KEY ("cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_progressions" ADD CONSTRAINT "wage_progressions_clause_id_cba_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."cba_clauses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_notes" ADD CONSTRAINT "bargaining_notes_cba_id_collective_agreements_id_fk" FOREIGN KEY ("cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cba_footnotes" ADD CONSTRAINT "cba_footnotes_source_clause_id_cba_clauses_id_fk" FOREIGN KEY ("source_clause_id") REFERENCES "public"."cba_clauses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cba_footnotes" ADD CONSTRAINT "cba_footnotes_target_clause_id_cba_clauses_id_fk" FOREIGN KEY ("target_clause_id") REFERENCES "public"."cba_clauses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cba_footnotes" ADD CONSTRAINT "cba_footnotes_target_decision_id_arbitration_decisions_id_fk" FOREIGN KEY ("target_decision_id") REFERENCES "public"."arbitration_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clause_comparisons_history" ADD CONSTRAINT "clause_comparisons_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clause_library_tags" ADD CONSTRAINT "clause_library_tags_clause_id_shared_clause_library_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."shared_clause_library"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_clause_library" ADD CONSTRAINT "shared_clause_library_source_organization_id_organizations_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_clause_library" ADD CONSTRAINT "shared_clause_library_source_cba_id_collective_agreements_id_fk" FOREIGN KEY ("source_cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_clause_library" ADD CONSTRAINT "shared_clause_library_previous_version_id_shared_clause_library_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."shared_clause_library"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_proposals" ADD CONSTRAINT "bargaining_proposals_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_proposals" ADD CONSTRAINT "bargaining_proposals_parent_proposal_id_bargaining_proposals_id_fk" FOREIGN KEY ("parent_proposal_id") REFERENCES "public"."bargaining_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_proposals" ADD CONSTRAINT "bargaining_proposals_superseded_by_id_bargaining_proposals_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."bargaining_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_team_members" ADD CONSTRAINT "bargaining_team_members_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_sessions" ADD CONSTRAINT "negotiation_sessions_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_expiring_cba_id_collective_agreements_id_fk" FOREIGN KEY ("expiring_cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_resulting_cba_id_collective_agreements_id_fk" FOREIGN KEY ("resulting_cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentative_agreements" ADD CONSTRAINT "tentative_agreements_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clause_embeddings" ADD CONSTRAINT "clause_embeddings_clause_id_cba_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."cba_clauses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliation" ADD CONSTRAINT "bank_reconciliation_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_cycles" ADD CONSTRAINT "payment_cycles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_member_id_profiles_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_profiles_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_cycle_id_payment_cycles_id_fk" FOREIGN KEY ("payment_cycle_id") REFERENCES "public"."payment_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_parent_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("parent_cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transaction_log" ADD CONSTRAINT "gl_transaction_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transaction_log" ADD CONSTRAINT "gl_transaction_log_chart_of_accounts_id_chart_of_accounts_id_fk" FOREIGN KEY ("chart_of_accounts_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_transaction_log" ADD CONSTRAINT "gl_transaction_log_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_trial_balance" ADD CONSTRAINT "gl_trial_balance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_trial_balance" ADD CONSTRAINT "gl_trial_balance_chart_of_accounts_id_chart_of_accounts_id_fk" FOREIGN KEY ("chart_of_accounts_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_billing_config" ADD CONSTRAINT "organization_billing_config_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_adjustments" ADD CONSTRAINT "billing_adjustments_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_adjustments" ADD CONSTRAINT "billing_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_adjustments" ADD CONSTRAINT "billing_adjustments_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_platform_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."platform_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoice_line_items" ADD CONSTRAINT "platform_invoice_line_items_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_basis_snapshots" ADD CONSTRAINT "allocation_basis_snapshots_run_id_allocation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."allocation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_rule_versions" ADD CONSTRAINT "allocation_rule_versions_rule_id_allocation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."allocation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_run_lines" ADD CONSTRAINT "allocation_run_lines_run_id_allocation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."allocation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_rule_version_id_allocation_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."allocation_rule_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chargeback_statements" ADD CONSTRAINT "chargeback_statements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chargeback_statements" ADD CONSTRAINT "chargeback_statements_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chargeback_statements" ADD CONSTRAINT "chargeback_statements_allocation_run_id_allocation_runs_id_fk" FOREIGN KEY ("allocation_run_id") REFERENCES "public"."allocation_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_eligibility" ADD CONSTRAINT "voter_eligibility_session_id_voting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_eligibility" ADD CONSTRAINT "voter_eligibility_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_session_id_voting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_option_id_voting_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."voting_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_audit_log" ADD CONSTRAINT "voting_audit_log_session_id_voting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_notifications" ADD CONSTRAINT "voting_notifications_session_id_voting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_options" ADD CONSTRAINT "voting_options_session_id_voting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_notifications" ADD CONSTRAINT "message_notifications_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_notifications" ADD CONSTRAINT "message_notifications_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_participants" ADD CONSTRAINT "message_participants_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_bounces" ADD CONSTRAINT "notification_bounces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_log" ADD CONSTRAINT "notification_delivery_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_campaigns" ADD CONSTRAINT "newsletter_campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_campaigns" ADD CONSTRAINT "newsletter_campaigns_template_id_newsletter_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."newsletter_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_campaigns" ADD CONSTRAINT "newsletter_campaigns_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_distribution_lists" ADD CONSTRAINT "newsletter_distribution_lists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_distribution_lists" ADD CONSTRAINT "newsletter_distribution_lists_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_engagement" ADD CONSTRAINT "newsletter_engagement_campaign_id_newsletter_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."newsletter_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_engagement" ADD CONSTRAINT "newsletter_engagement_recipient_id_newsletter_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."newsletter_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_engagement" ADD CONSTRAINT "newsletter_engagement_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_list_subscribers" ADD CONSTRAINT "newsletter_list_subscribers_list_id_newsletter_distribution_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."newsletter_distribution_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_list_subscribers" ADD CONSTRAINT "newsletter_list_subscribers_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_recipients" ADD CONSTRAINT "newsletter_recipients_campaign_id_newsletter_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."newsletter_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_recipients" ADD CONSTRAINT "newsletter_recipients_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_templates" ADD CONSTRAINT "newsletter_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_templates" ADD CONSTRAINT "newsletter_templates_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaign_recipients" ADD CONSTRAINT "sms_campaign_recipients_campaign_id_sms_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sms_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaign_recipients" ADD CONSTRAINT "sms_campaign_recipients_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaign_recipients" ADD CONSTRAINT "sms_campaign_recipients_message_id_sms_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."sms_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_template_id_sms_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sms_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_conversations" ADD CONSTRAINT "sms_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_conversations" ADD CONSTRAINT "sms_conversations_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_template_id_sms_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sms_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_campaign_id_sms_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sms_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_opt_outs" ADD CONSTRAINT "sms_opt_outs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_opt_outs" ADD CONSTRAINT "sms_opt_outs_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_rate_limits" ADD CONSTRAINT "sms_rate_limits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_metrics" ADD CONSTRAINT "analytics_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparative_analyses" ADD CONSTRAINT "comparative_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparative_analyses" ADD CONSTRAINT "comparative_analyses_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user_management"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_recommendations" ADD CONSTRAINT "insight_recommendations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_recommendations" ADD CONSTRAINT "insight_recommendations_acknowledged_by_users_user_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "user_management"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_recommendations" ADD CONSTRAINT "insight_recommendations_dismissed_by_users_user_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "user_management"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_configurations" ADD CONSTRAINT "kpi_configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_configurations" ADD CONSTRAINT "kpi_configurations_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user_management"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_analyses" ADD CONSTRAINT "trend_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_notification_id_push_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."push_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_device_id_push_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."push_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_notification_templates" ADD CONSTRAINT "push_notification_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_notification_templates" ADD CONSTRAINT "push_notification_templates_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_template_id_push_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."push_notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_content" ADD CONSTRAINT "public_content_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_message_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_channels" ADD CONSTRAINT "communication_channels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_notes" ADD CONSTRAINT "field_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_relationship_scores" ADD CONSTRAINT "member_relationship_scores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_tasks" ADD CONSTRAINT "organizer_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_enrollments" ADD CONSTRAINT "outreach_enrollments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_enrollments" ADD CONSTRAINT "outreach_enrollments_sequence_id_outreach_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."outreach_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_sequences" ADD CONSTRAINT "outreach_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_steps_log" ADD CONSTRAINT "outreach_steps_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_steps_log" ADD CONSTRAINT "outreach_steps_log_enrollment_id_outreach_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."outreach_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_organizer_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."organizer_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_communications" ADD CONSTRAINT "employer_communications_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_communications" ADD CONSTRAINT "employer_communications_recipient_contact_id_employer_contacts_id_fk" FOREIGN KEY ("recipient_contact_id") REFERENCES "public"."employer_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."document_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signers" ADD CONSTRAINT "document_signers_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signers" ADD CONSTRAINT "document_signers_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_audit_trail" ADD CONSTRAINT "signature_audit_trail_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_audit_trail" ADD CONSTRAINT "signature_audit_trail_signer_id_document_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."document_signers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_documents" ADD CONSTRAINT "signature_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_documents" ADD CONSTRAINT "signature_documents_sent_by_profiles_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_documents" ADD CONSTRAINT "signature_documents_template_id_signature_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."signature_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_templates" ADD CONSTRAINT "signature_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_templates" ADD CONSTRAINT "signature_templates_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_webhooks_log" ADD CONSTRAINT "signature_webhooks_log_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_audit_log" ADD CONSTRAINT "signature_audit_log_workflow_id_signature_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."signature_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_audit_log" ADD CONSTRAINT "signature_audit_log_signer_id_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."signers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_verification" ADD CONSTRAINT "signature_verification_workflow_id_signature_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."signature_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_verification" ADD CONSTRAINT "signature_verification_signer_id_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."signers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_workflows" ADD CONSTRAINT "signature_workflows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_workflows" ADD CONSTRAINT "signature_workflows_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signers" ADD CONSTRAINT "signers_workflow_id_signature_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."signature_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signers" ADD CONSTRAINT "signers_member_id_profiles_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sharing" ADD CONSTRAINT "calendar_sharing_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sharing" ADD CONSTRAINT "calendar_sharing_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_connections" ADD CONSTRAINT "external_calendar_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_rooms" ADD CONSTRAINT "meeting_rooms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_room_id_meeting_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."meeting_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_registrations" ADD CONSTRAINT "course_registrations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_registrations" ADD CONSTRAINT "course_registrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_registrations" ADD CONSTRAINT "course_registrations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."course_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sessions" ADD CONSTRAINT "course_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sessions" ADD CONSTRAINT "course_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_certifications" ADD CONSTRAINT "member_certifications_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_certifications" ADD CONSTRAINT "member_certifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_certifications" ADD CONSTRAINT "member_certifications_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_certifications" ADD CONSTRAINT "member_certifications_renewal_course_id_fkey" FOREIGN KEY ("renewal_course_id") REFERENCES "public"."training_courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_certifications" ADD CONSTRAINT "member_certifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."course_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "public"."member_certifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookie_consents" ADD CONSTRAINT "cookie_consents_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookie_consents" ADD CONSTRAINT "cookie_consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_anonymization_log" ADD CONSTRAINT "data_anonymization_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_anonymization_log" ADD CONSTRAINT "data_anonymization_log_request_id_gdpr_data_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."gdpr_data_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_processing_records" ADD CONSTRAINT "data_processing_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_data_requests" ADD CONSTRAINT "gdpr_data_requests_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_data_requests" ADD CONSTRAINT "gdpr_data_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "break_glass_activations" ADD CONSTRAINT "break_glass_activations_emergency_id_emergency_declarations_id_fk" FOREIGN KEY ("emergency_id") REFERENCES "public"."emergency_declarations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_justification_requests" ADD CONSTRAINT "access_justification_requests_data_type_id_data_classification_registry_id_fk" FOREIGN KEY ("data_type_id") REFERENCES "public"."data_classification_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_access_attempts" ADD CONSTRAINT "employer_access_attempts_data_type_id_data_classification_registry_id_fk" FOREIGN KEY ("data_type_id") REFERENCES "public"."data_classification_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firewall_access_rules" ADD CONSTRAINT "firewall_access_rules_data_type_id_data_classification_registry_id_fk" FOREIGN KEY ("data_type_id") REFERENCES "public"."data_classification_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firewall_violations" ADD CONSTRAINT "firewall_violations_data_type_id_data_classification_registry_id_fk" FOREIGN KEY ("data_type_id") REFERENCES "public"."data_classification_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_balance_reconciliation" ADD CONSTRAINT "account_balance_reconciliation_account_id_stripe_connect_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."stripe_connect_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_routing_rules" ADD CONSTRAINT "payment_routing_rules_destination_account_id_stripe_connect_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."stripe_connect_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_routing_rules" ADD CONSTRAINT "payment_routing_rules_fallback_account_id_stripe_connect_accounts_id_fk" FOREIGN KEY ("fallback_account_id") REFERENCES "public"."stripe_connect_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "separated_payment_transactions" ADD CONSTRAINT "separated_payment_transactions_routed_to_account_id_stripe_connect_accounts_id_fk" FOREIGN KEY ("routed_to_account_id") REFERENCES "public"."stripe_connect_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "separated_payment_transactions" ADD CONSTRAINT "separated_payment_transactions_routing_rule_id_payment_routing_rules_id_fk" FOREIGN KEY ("routing_rule_id") REFERENCES "public"."payment_routing_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whiplash_prevention_audit" ADD CONSTRAINT "whiplash_prevention_audit_account_id_stripe_connect_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."stripe_connect_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whiplash_prevention_audit" ADD CONSTRAINT "whiplash_prevention_audit_transaction_id_separated_payment_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."separated_payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whiplash_violations" ADD CONSTRAINT "whiplash_violations_transaction_id_separated_payment_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."separated_payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whiplash_violations" ADD CONSTRAINT "whiplash_violations_expected_account_id_stripe_connect_accounts_id_fk" FOREIGN KEY ("expected_account_id") REFERENCES "public"."stripe_connect_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whiplash_violations" ADD CONSTRAINT "whiplash_violations_actual_account_id_stripe_connect_accounts_id_fk" FOREIGN KEY ("actual_account_id") REFERENCES "public"."stripe_connect_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pci_dss_cardholder_data_flow" ADD CONSTRAINT "pci_dss_cardholder_data_flow_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pci_dss_encryption_keys" ADD CONSTRAINT "pci_dss_encryption_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pci_dss_quarterly_scans" ADD CONSTRAINT "pci_dss_quarterly_scans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pci_dss_requirements" ADD CONSTRAINT "pci_dss_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pci_dss_saq_assessments" ADD CONSTRAINT "pci_dss_saq_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_alerts" ADD CONSTRAINT "compliance_alerts_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_reports" ADD CONSTRAINT "employer_reports_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arbitration_precedents" ADD CONSTRAINT "arbitration_precedents_source_organization_id_organizations_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arbitration_precedents" ADD CONSTRAINT "arbitration_precedents_source_decision_id_arbitration_decisions_id_fk" FOREIGN KEY ("source_decision_id") REFERENCES "public"."arbitration_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precedent_citations" ADD CONSTRAINT "precedent_citations_precedent_id_arbitration_precedents_id_fk" FOREIGN KEY ("precedent_id") REFERENCES "public"."arbitration_precedents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precedent_citations" ADD CONSTRAINT "precedent_citations_citing_precedent_id_arbitration_precedents_id_fk" FOREIGN KEY ("citing_precedent_id") REFERENCES "public"."arbitration_precedents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precedent_citations" ADD CONSTRAINT "precedent_citations_citing_organization_id_organizations_id_fk" FOREIGN KEY ("citing_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precedent_tags" ADD CONSTRAINT "precedent_tags_precedent_id_arbitration_precedents_id_fk" FOREIGN KEY ("precedent_id") REFERENCES "public"."arbitration_precedents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "congress_memberships" ADD CONSTRAINT "congress_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "congress_memberships" ADD CONSTRAINT "congress_memberships_congress_id_organizations_id_fk" FOREIGN KEY ("congress_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_departments" ADD CONSTRAINT "external_departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_employees" ADD CONSTRAINT "external_employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_positions" ADD CONSTRAINT "external_positions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_accounts" ADD CONSTRAINT "external_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_customers" ADD CONSTRAINT "external_customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_invoices" ADD CONSTRAINT "external_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_payments" ADD CONSTRAINT "external_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_benefit_coverage" ADD CONSTRAINT "external_benefit_coverage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_benefit_dependents" ADD CONSTRAINT "external_benefit_dependents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_benefit_enrollments" ADD CONSTRAINT "external_benefit_enrollments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_benefit_plans" ADD CONSTRAINT "external_benefit_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_benefit_utilization" ADD CONSTRAINT "external_benefit_utilization_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_insurance_beneficiaries" ADD CONSTRAINT "external_insurance_beneficiaries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_insurance_claims" ADD CONSTRAINT "external_insurance_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_insurance_policies" ADD CONSTRAINT "external_insurance_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_communication_channels" ADD CONSTRAINT "external_communication_channels_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_communication_files" ADD CONSTRAINT "external_communication_files_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_communication_files" ADD CONSTRAINT "external_communication_files_channel_id_external_communication_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."external_communication_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_communication_messages" ADD CONSTRAINT "external_communication_messages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_communication_messages" ADD CONSTRAINT "external_communication_messages_channel_id_external_communication_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."external_communication_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_communication_users" ADD CONSTRAINT "external_communication_users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lms_completions" ADD CONSTRAINT "external_lms_completions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lms_courses" ADD CONSTRAINT "external_lms_courses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lms_enrollments" ADD CONSTRAINT "external_lms_enrollments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lms_learners" ADD CONSTRAINT "external_lms_learners_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_lms_progress" ADD CONSTRAINT "external_lms_progress_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_files" ADD CONSTRAINT "external_document_files_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_files" ADD CONSTRAINT "external_document_files_library_id_external_document_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."external_document_libraries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_libraries" ADD CONSTRAINT "external_document_libraries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_permissions" ADD CONSTRAINT "external_document_permissions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_permissions" ADD CONSTRAINT "external_document_permissions_file_id_external_document_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."external_document_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_document_sites" ADD CONSTRAINT "external_document_sites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_pension_beneficiaries" ADD CONSTRAINT "external_pension_beneficiaries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_pension_contributions" ADD CONSTRAINT "external_pension_contributions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_pension_estimates" ADD CONSTRAINT "external_pension_estimates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_pension_members" ADD CONSTRAINT "external_pension_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_pension_plans" ADD CONSTRAINT "external_pension_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_pension_service_credits" ADD CONSTRAINT "external_pension_service_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_attendees" ADD CONSTRAINT "external_calendar_attendees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_events" ADD CONSTRAINT "external_calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_recurring_patterns" ADD CONSTRAINT "external_calendar_recurring_patterns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendars" ADD CONSTRAINT "external_calendars_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_metadata" ADD CONSTRAINT "model_metadata_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_budgets" ADD CONSTRAINT "ai_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_rate_limits" ADD CONSTRAINT "ai_rate_limits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_safety_filters" ADD CONSTRAINT "ai_safety_filters_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_safety_filters" ADD CONSTRAINT "ai_safety_filters_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_metrics" ADD CONSTRAINT "ai_usage_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_metrics" ADD CONSTRAINT "ai_usage_metrics_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_management"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_analytics" ADD CONSTRAINT "chatbot_analytics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_suggestions" ADD CONSTRAINT "chatbot_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_grievance_triages" ADD CONSTRAINT "ai_grievance_triages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_grievance_triages" ADD CONSTRAINT "ai_grievance_triages_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_clause_reasonings" ADD CONSTRAINT "ai_clause_reasonings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_clause_reasonings" ADD CONSTRAINT "ai_clause_reasonings_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_risk_scores" ADD CONSTRAINT "employer_risk_scores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_risk_scores" ADD CONSTRAINT "employer_risk_scores_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_copilot_sessions" ADD CONSTRAINT "ai_copilot_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insight_reports" ADD CONSTRAINT "ai_insight_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_scheduled_reports" ADD CONSTRAINT "analytics_scheduled_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_data" ADD CONSTRAINT "benchmark_data_benchmark_category_id_benchmark_categories_id_fk" FOREIGN KEY ("benchmark_category_id") REFERENCES "public"."benchmark_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_benchmark_snapshots" ADD CONSTRAINT "organization_benchmark_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_benchmark_snapshots" ADD CONSTRAINT "organization_benchmark_snapshots_benchmark_category_id_benchmark_categories_id_fk" FOREIGN KEY ("benchmark_category_id") REFERENCES "public"."benchmark_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_delivery_history" ADD CONSTRAINT "report_delivery_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_delivery_history" ADD CONSTRAINT "report_delivery_history_scheduled_report_id_analytics_scheduled_reports_id_fk" FOREIGN KEY ("scheduled_report_id") REFERENCES "public"."analytics_scheduled_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_security"."audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_security"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_management"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_security"."security_events" ADD CONSTRAINT "security_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_security"."security_events" ADD CONSTRAINT "security_events_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_management"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_security"."security_events" ADD CONSTRAINT "security_events_resolved_by_users_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "user_management"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_actions" ADD CONSTRAINT "alert_actions_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_conditions" ADD CONSTRAINT "alert_conditions_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_escalations" ADD CONSTRAINT "alert_escalations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_escalations" ADD CONSTRAINT "alert_escalations_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_escalations" ADD CONSTRAINT "alert_escalations_resolved_by_profiles_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_executions" ADD CONSTRAINT "alert_executions_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_recipients" ADD CONSTRAINT "alert_recipients_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_execution_log" ADD CONSTRAINT "automation_execution_log_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_schedules" ADD CONSTRAINT "automation_schedules_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_award_types" ADD CONSTRAINT "recognition_award_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_award_types" ADD CONSTRAINT "recognition_award_types_program_id_recognition_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."recognition_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_awards" ADD CONSTRAINT "recognition_awards_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_awards" ADD CONSTRAINT "recognition_awards_program_id_recognition_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."recognition_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_awards" ADD CONSTRAINT "recognition_awards_award_type_id_recognition_award_types_id_fk" FOREIGN KEY ("award_type_id") REFERENCES "public"."recognition_award_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_programs" ADD CONSTRAINT "recognition_programs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_budget_envelopes" ADD CONSTRAINT "reward_budget_envelopes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_budget_envelopes" ADD CONSTRAINT "reward_budget_envelopes_program_id_recognition_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."recognition_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_program_id_recognition_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."recognition_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_config" ADD CONSTRAINT "shopify_config_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_history" ADD CONSTRAINT "award_history_template_id_award_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."award_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_reservations" ADD CONSTRAINT "budget_reservations_pool_id_budget_pool_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."budget_pool"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_signing_events" ADD CONSTRAINT "card_signing_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_signing_events" ADD CONSTRAINT "card_signing_events_campaign_id_organizing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."organizing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_signing_events" ADD CONSTRAINT "card_signing_events_contact_id_organizing_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."organizing_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_signing_events" ADD CONSTRAINT "card_signing_events_witnessed_by_profiles_user_id_fk" FOREIGN KEY ("witnessed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_signing_events" ADD CONSTRAINT "card_signing_events_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_responses" ADD CONSTRAINT "employer_responses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_responses" ADD CONSTRAINT "employer_responses_campaign_id_organizing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."organizing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_responses" ADD CONSTRAINT "employer_responses_affected_contact_id_organizing_contacts_id_fk" FOREIGN KEY ("affected_contact_id") REFERENCES "public"."organizing_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_responses" ADD CONSTRAINT "employer_responses_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_responses" ADD CONSTRAINT "employer_responses_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_organizer_activities" ADD CONSTRAINT "field_organizer_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_organizer_activities" ADD CONSTRAINT "field_organizer_activities_campaign_id_organizing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."organizing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_organizer_activities" ADD CONSTRAINT "field_organizer_activities_organizer_id_profiles_user_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_organizer_activities" ADD CONSTRAINT "field_organizer_activities_contact_id_organizing_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."organizing_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_organizer_activities" ADD CONSTRAINT "field_organizer_activities_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nlrb_clrb_filings" ADD CONSTRAINT "nlrb_clrb_filings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nlrb_clrb_filings" ADD CONSTRAINT "nlrb_clrb_filings_campaign_id_organizing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."organizing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nlrb_clrb_filings" ADD CONSTRAINT "nlrb_clrb_filings_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nlrb_clrb_filings" ADD CONSTRAINT "nlrb_clrb_filings_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_campaign_milestones" ADD CONSTRAINT "organizing_campaign_milestones_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_campaign_milestones" ADD CONSTRAINT "organizing_campaign_milestones_campaign_id_organizing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."organizing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_campaign_milestones" ADD CONSTRAINT "organizing_campaign_milestones_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_campaigns" ADD CONSTRAINT "organizing_campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_campaigns" ADD CONSTRAINT "organizing_campaigns_lead_organizer_id_profiles_user_id_fk" FOREIGN KEY ("lead_organizer_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_campaigns" ADD CONSTRAINT "organizing_campaigns_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_campaigns" ADD CONSTRAINT "organizing_campaigns_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_contacts" ADD CONSTRAINT "organizing_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_contacts" ADD CONSTRAINT "organizing_contacts_campaign_id_organizing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."organizing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_contacts" ADD CONSTRAINT "organizing_contacts_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizing_contacts" ADD CONSTRAINT "organizing_contacts_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "union_representation_votes" ADD CONSTRAINT "union_representation_votes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "union_representation_votes" ADD CONSTRAINT "union_representation_votes_campaign_id_organizing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."organizing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "union_representation_votes" ADD CONSTRAINT "union_representation_votes_filing_id_nlrb_clrb_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."nlrb_clrb_filings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "union_representation_votes" ADD CONSTRAINT "union_representation_votes_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_org_access_log" ADD CONSTRAINT "cross_org_access_log_user_organization_id_organizations_id_fk" FOREIGN KEY ("user_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_sharing_grants" ADD CONSTRAINT "organization_sharing_grants_grantor_org_id_organizations_id_fk" FOREIGN KEY ("grantor_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_sharing_grants" ADD CONSTRAINT "organization_sharing_grants_grantee_org_id_organizations_id_fk" FOREIGN KEY ("grantee_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_sharing_settings" ADD CONSTRAINT "organization_sharing_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_blocks" ADD CONSTRAINT "cms_blocks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_blocks" ADD CONSTRAINT "cms_blocks_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_media_library" ADD CONSTRAINT "cms_media_library_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_media_library" ADD CONSTRAINT "cms_media_library_uploaded_by_profiles_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_navigation_menus" ADD CONSTRAINT "cms_navigation_menus_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_template_id_cms_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."cms_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_parent_page_id_cms_pages_id_fk" FOREIGN KEY ("parent_page_id") REFERENCES "public"."cms_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_templates" ADD CONSTRAINT "cms_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_templates" ADD CONSTRAINT "cms_templates_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_campaigns" ADD CONSTRAINT "donation_campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_campaigns" ADD CONSTRAINT "donation_campaigns_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_receipts" ADD CONSTRAINT "donation_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_receipts" ADD CONSTRAINT "donation_receipts_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_donation_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."donation_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_checked_in_by_profiles_user_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_checked_in_by_profiles_user_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_viewed_by_profiles_user_id_fk" FOREIGN KEY ("viewed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_saved" ADD CONSTRAINT "job_saved_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_saved" ADD CONSTRAINT "job_saved_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_saved" ADD CONSTRAINT "job_saved_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_analytics" ADD CONSTRAINT "page_analytics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_analytics" ADD CONSTRAINT "page_analytics_page_id_cms_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."cms_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_analytics" ADD CONSTRAINT "page_analytics_event_id_public_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."public_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_analytics" ADD CONSTRAINT "page_analytics_job_id_job_postings_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_analytics" ADD CONSTRAINT "page_analytics_campaign_id_donation_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."donation_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_events" ADD CONSTRAINT "public_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_events" ADD CONSTRAINT "public_events_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_settings" ADD CONSTRAINT "website_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_connector_id_erp_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."erp_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currency_exchange_rates" ADD CONSTRAINT "currency_exchange_rates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_connectors" ADD CONSTRAINT "erp_connectors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_invoices" ADD CONSTRAINT "erp_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_invoices" ADD CONSTRAINT "erp_invoices_connector_id_erp_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."erp_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_audit_log" ADD CONSTRAINT "financial_audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_connector_id_erp_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."erp_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_connector_id_erp_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."erp_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clc_api_config" ADD CONSTRAINT "clc_api_config_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clc_remittance_mapping" ADD CONSTRAINT "clc_remittance_mapping_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_remittance_id_fkey" FOREIGN KEY ("remittance_id") REFERENCES "public"."per_capita_remittances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_contacts" ADD CONSTRAINT "organization_contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "per_capita_remittances" ADD CONSTRAINT "per_capita_remittances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "per_capita_remittances" ADD CONSTRAINT "per_capita_remittances_from_organization_id_fkey" FOREIGN KEY ("from_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "per_capita_remittances" ADD CONSTRAINT "per_capita_remittances_to_organization_id_fkey" FOREIGN KEY ("to_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remittance_approvals" ADD CONSTRAINT "remittance_approvals_remittance_id_fkey" FOREIGN KEY ("remittance_id") REFERENCES "public"."per_capita_remittances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clc_organization_sync_log" ADD CONSTRAINT "clc_organization_sync_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_change_history" ADD CONSTRAINT "address_change_history_address_id_international_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."international_addresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_change_history" ADD CONSTRAINT "address_change_history_changed_by_profiles_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_addresses" ADD CONSTRAINT "international_addresses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_addresses" ADD CONSTRAINT "international_addresses_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_connected_by_profiles_user_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_analytics" ADD CONSTRAINT "social_analytics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_analytics" ADD CONSTRAINT "social_analytics_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_campaigns" ADD CONSTRAINT "social_campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_campaigns" ADD CONSTRAINT "social_campaigns_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_engagement" ADD CONSTRAINT "social_engagement_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_engagement" ADD CONSTRAINT "social_engagement_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_feeds" ADD CONSTRAINT "social_feeds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_feeds" ADD CONSTRAINT "social_feeds_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_campaign_id_social_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."social_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_audits" ADD CONSTRAINT "accessibility_audits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_audits" ADD CONSTRAINT "accessibility_audits_scheduled_by_profiles_user_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_issues" ADD CONSTRAINT "accessibility_issues_audit_id_accessibility_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."accessibility_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_issues" ADD CONSTRAINT "accessibility_issues_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_issues" ADD CONSTRAINT "accessibility_issues_assigned_to_profiles_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_issues" ADD CONSTRAINT "accessibility_issues_resolved_by_profiles_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_test_suites" ADD CONSTRAINT "accessibility_test_suites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_test_suites" ADD CONSTRAINT "accessibility_test_suites_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_user_testing" ADD CONSTRAINT "accessibility_user_testing_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_user_testing" ADD CONSTRAINT "accessibility_user_testing_conducted_by_profiles_user_id_fk" FOREIGN KEY ("conducted_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_api_keys" ADD CONSTRAINT "integration_api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_log" ADD CONSTRAINT "integration_sync_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_schedules" ADD CONSTRAINT "integration_sync_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhooks" ADD CONSTRAINT "integration_webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_integration_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."integration_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_campaigns" ADD CONSTRAINT "federation_campaigns_federation_id_fkey" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_campaigns" ADD CONSTRAINT "federation_campaigns_coordinating_union_id_fkey" FOREIGN KEY ("coordinating_union_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_communications" ADD CONSTRAINT "federation_communications_federation_id_fkey" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_communications" ADD CONSTRAINT "federation_communications_related_campaign_id_fkey" FOREIGN KEY ("related_campaign_id") REFERENCES "public"."federation_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_communications" ADD CONSTRAINT "federation_communications_related_meeting_id_fkey" FOREIGN KEY ("related_meeting_id") REFERENCES "public"."federation_meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_executives" ADD CONSTRAINT "federation_executives_federation_id_fkey" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_executives" ADD CONSTRAINT "federation_executives_union_organization_id_fkey" FOREIGN KEY ("union_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_meetings" ADD CONSTRAINT "federation_meetings_federation_id_fkey" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_memberships" ADD CONSTRAINT "federation_memberships_federation_id_fkey" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_memberships" ADD CONSTRAINT "federation_memberships_union_organization_id_fkey" FOREIGN KEY ("union_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_remittances" ADD CONSTRAINT "federation_remittances_federation_id_fkey" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_remittances" ADD CONSTRAINT "federation_remittances_from_organization_id_fkey" FOREIGN KEY ("from_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_remittances" ADD CONSTRAINT "federation_remittances_to_organization_id_fkey" FOREIGN KEY ("to_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_remittances" ADD CONSTRAINT "federation_remittances_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."federation_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_remittances" ADD CONSTRAINT "federation_remittances_per_capita_remittance_id_fkey" FOREIGN KEY ("per_capita_remittance_id") REFERENCES "public"."per_capita_remittances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_resources" ADD CONSTRAINT "federation_resources_federation_id_fkey" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_resources" ADD CONSTRAINT "federation_resources_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "public"."federation_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federation_resources" ADD CONSTRAINT "federation_resources_related_campaign_id_fkey" FOREIGN KEY ("related_campaign_id") REFERENCES "public"."federation_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federations" ADD CONSTRAINT "federations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_configurations" ADD CONSTRAINT "org_configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_usage" ADD CONSTRAINT "org_usage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_parent_org_id_organizations_id_fk" FOREIGN KEY ("parent_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_child_org_id_organizations_id_fk" FOREIGN KEY ("child_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_id_organizations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_chief_steward_id_profiles_user_id_fk" FOREIGN KEY ("chief_steward_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_bargaining_chair_id_profiles_user_id_fk" FOREIGN KEY ("bargaining_chair_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_member_id_profiles_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_appointed_by_profiles_user_id_fk" FOREIGN KEY ("appointed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_unit_id_bargaining_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."bargaining_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_chair_id_profiles_user_id_fk" FOREIGN KEY ("chair_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_secretary_id_profiles_user_id_fk" FOREIGN KEY ("secretary_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_member_id_profiles_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_ended_by_profiles_user_id_fk" FOREIGN KEY ("ended_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksites" ADD CONSTRAINT "worksites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksites" ADD CONSTRAINT "worksites_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksites" ADD CONSTRAINT "worksites_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksites" ADD CONSTRAINT "worksites_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chart_of_accounts_org_idx" ON "chart_of_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_number_idx" ON "chart_of_accounts" USING btree ("account_number","organization_id");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_type_idx" ON "chart_of_accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_status_idx" ON "chart_of_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_parent_idx" ON "chart_of_accounts" USING btree ("parent_account_id");--> statement-breakpoint
CREATE INDEX "idx_corrective_actions_org" ON "corrective_actions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_corrective_actions_status" ON "corrective_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_corrective_actions_priority" ON "corrective_actions" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_corrective_actions_due_date" ON "corrective_actions" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_corrective_actions_assigned" ON "corrective_actions" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "idx_corrective_actions_source" ON "corrective_actions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_employers_org" ON "employers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_employers_name" ON "employers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_employers_industry" ON "employers" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "gl_account_mappings_org_idx" ON "gl_account_mappings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "gl_account_mappings_chart_idx" ON "gl_account_mappings" USING btree ("chart_of_accounts_id");--> statement-breakpoint
CREATE INDEX "gl_account_mappings_local_type_idx" ON "gl_account_mappings" USING btree ("local_account_type");--> statement-breakpoint
CREATE INDEX "gl_account_mappings_gl_idx" ON "gl_account_mappings" USING btree ("gl_account_number");--> statement-breakpoint
CREATE INDEX "idx_hazards_org" ON "hazard_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_hazards_status" ON "hazard_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_hazards_level" ON "hazard_reports" USING btree ("hazard_level");--> statement-breakpoint
CREATE INDEX "idx_hazards_category" ON "hazard_reports" USING btree ("hazard_category");--> statement-breakpoint
CREATE INDEX "idx_hazards_workplace" ON "hazard_reports" USING btree ("workplace_id");--> statement-breakpoint
CREATE INDEX "idx_hazards_date" ON "hazard_reports" USING btree ("reported_date");--> statement-breakpoint
CREATE INDEX "idx_hazards_risk_score" ON "hazard_reports" USING btree ("risk_score");--> statement-breakpoint
CREATE INDEX "idx_injury_logs_org" ON "injury_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_injury_logs_worker" ON "injury_logs" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "idx_injury_logs_date" ON "injury_logs" USING btree ("injury_date");--> statement-breakpoint
CREATE INDEX "idx_injury_logs_status" ON "injury_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_injury_logs_incident" ON "injury_logs" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_injury_logs_wsib" ON "injury_logs" USING btree ("wsib_claim_number");--> statement-breakpoint
CREATE INDEX "idx_ml_predictions_organization" ON "ml_predictions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ml_predictions_type" ON "ml_predictions" USING btree ("prediction_type");--> statement-breakpoint
CREATE INDEX "idx_ml_predictions_date" ON "ml_predictions" USING btree ("prediction_date");--> statement-breakpoint
CREATE INDEX "idx_ppe_org" ON "ppe_equipment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ppe_status" ON "ppe_equipment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ppe_type" ON "ppe_equipment" USING btree ("ppe_type");--> statement-breakpoint
CREATE INDEX "idx_ppe_issued_to" ON "ppe_equipment" USING btree ("issued_to_id");--> statement-breakpoint
CREATE INDEX "idx_ppe_expiry" ON "ppe_equipment" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_ppe_inspection" ON "ppe_equipment" USING btree ("next_inspection_date");--> statement-breakpoint
CREATE INDEX "idx_audits_org" ON "safety_audits" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_audits_status" ON "safety_audits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_audits_type" ON "safety_audits" USING btree ("audit_type");--> statement-breakpoint
CREATE INDEX "idx_audits_date" ON "safety_audits" USING btree ("scheduled_start_date");--> statement-breakpoint
CREATE INDEX "idx_certifications_org" ON "safety_certifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_certifications_holder" ON "safety_certifications" USING btree ("holder_id");--> statement-breakpoint
CREATE INDEX "idx_certifications_status" ON "safety_certifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_certifications_type" ON "safety_certifications" USING btree ("certification_type");--> statement-breakpoint
CREATE INDEX "idx_certifications_expiry" ON "safety_certifications" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_certifications_training" ON "safety_certifications" USING btree ("training_record_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_org" ON "safety_committee_meetings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_date" ON "safety_committee_meetings" USING btree ("meeting_date");--> statement-breakpoint
CREATE INDEX "idx_meetings_status" ON "safety_committee_meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_meetings_type" ON "safety_committee_meetings" USING btree ("meeting_type");--> statement-breakpoint
CREATE INDEX "idx_inspections_org" ON "safety_inspections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inspections_status" ON "safety_inspections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inspections_date" ON "safety_inspections" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_inspections_type" ON "safety_inspections" USING btree ("inspection_type");--> statement-breakpoint
CREATE INDEX "idx_inspections_workplace" ON "safety_inspections" USING btree ("workplace_id");--> statement-breakpoint
CREATE INDEX "idx_inspections_followup" ON "safety_inspections" USING btree ("follow_up_required","follow_up_completed");--> statement-breakpoint
CREATE INDEX "idx_policies_org" ON "safety_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_policies_status" ON "safety_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_policies_category" ON "safety_policies" USING btree ("policy_category");--> statement-breakpoint
CREATE INDEX "idx_policies_review" ON "safety_policies" USING btree ("next_review_date");--> statement-breakpoint
CREATE INDEX "idx_policies_effective" ON "safety_policies" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_training_org" ON "safety_training_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_training_trainee" ON "safety_training_records" USING btree ("trainee_id");--> statement-breakpoint
CREATE INDEX "idx_training_status" ON "safety_training_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_training_expiry" ON "safety_training_records" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_training_date" ON "safety_training_records" USING btree ("training_date");--> statement-breakpoint
CREATE INDEX "idx_training_course" ON "safety_training_records" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_organization" ON "steward_assignments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_steward" ON "steward_assignments" USING btree ("steward_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_unit" ON "steward_assignments" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_worksite" ON "steward_assignments" USING btree ("worksite_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_status" ON "steward_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_type" ON "steward_assignments" USING btree ("steward_type");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_tenure" ON "steward_assignments" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_incidents_org" ON "workplace_incidents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_incidents_date" ON "workplace_incidents" USING btree ("incident_date");--> statement-breakpoint
CREATE INDEX "idx_incidents_severity" ON "workplace_incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_incidents_status" ON "workplace_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_incidents_type" ON "workplace_incidents" USING btree ("incident_type");--> statement-breakpoint
CREATE INDEX "idx_incidents_workplace" ON "workplace_incidents" USING btree ("workplace_id");--> statement-breakpoint
CREATE INDEX "idx_incidents_injured_person" ON "workplace_incidents" USING btree ("injured_person_id");--> statement-breakpoint
CREATE INDEX "idx_incidents_claim" ON "workplace_incidents" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_incidents_org_date" ON "workplace_incidents" USING btree ("organization_id","incident_date");--> statement-breakpoint
CREATE INDEX "idx_employment_history_member" ON "employment_history" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_employment_history_effective_date" ON "employment_history" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_employment_history_change_type" ON "employment_history" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "idx_job_classifications_code" ON "job_classifications" USING btree ("job_code");--> statement-breakpoint
CREATE INDEX "idx_job_classifications_unit" ON "job_classifications" USING btree ("bargaining_unit_id");--> statement-breakpoint
CREATE INDEX "idx_job_classifications_active" ON "job_classifications" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_member_employment_member" ON "member_employment" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_employment_employer" ON "member_employment" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_member_employment_worksite" ON "member_employment" USING btree ("worksite_id");--> statement-breakpoint
CREATE INDEX "idx_member_employment_bargaining_unit" ON "member_employment" USING btree ("bargaining_unit_id");--> statement-breakpoint
CREATE INDEX "idx_member_employment_status" ON "member_employment" USING btree ("employment_status");--> statement-breakpoint
CREATE INDEX "idx_member_employment_seniority_date" ON "member_employment" USING btree ("seniority_date");--> statement-breakpoint
CREATE INDEX "idx_member_employment_job_code" ON "member_employment" USING btree ("job_code");--> statement-breakpoint
CREATE INDEX "idx_member_leaves_member" ON "member_leaves" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_leaves_type" ON "member_leaves" USING btree ("leave_type");--> statement-breakpoint
CREATE INDEX "idx_member_leaves_start_date" ON "member_leaves" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_member_leaves_approved" ON "member_leaves" USING btree ("is_approved");--> statement-breakpoint
CREATE INDEX "idx_stewards_org" ON "stewards" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_stewards_user" ON "stewards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stewards_region" ON "stewards" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_stewards_specialization" ON "stewards" USING btree ("specialization");--> statement-breakpoint
CREATE INDEX "idx_stewards_active" ON "stewards" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_grievance_deadlines_grievance" ON "grievance_deadlines" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_deadlines_due" ON "grievance_deadlines" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_grievance_deadlines_status" ON "grievance_deadlines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_grievance_documents_organization" ON "grievance_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_documents_claim" ON "grievance_documents" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_documents_type" ON "grievance_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_grievance_documents_version" ON "grievance_documents" USING btree ("parent_document_id","version");--> statement-breakpoint
CREATE INDEX "idx_grievance_documents_latest" ON "grievance_documents" USING btree ("claim_id","is_latest_version");--> statement-breakpoint
CREATE INDEX "idx_grievance_documents_signature" ON "grievance_documents" USING btree ("requires_signature","signature_status");--> statement-breakpoint
CREATE INDEX "idx_arbitrations_number" ON "arbitrations" USING btree ("arbitration_number");--> statement-breakpoint
CREATE INDEX "idx_arbitrations_grievance" ON "arbitrations" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "idx_arbitrations_status" ON "arbitrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_arbitrations_board" ON "arbitrations" USING btree ("board_name");--> statement-breakpoint
CREATE INDEX "idx_arbitrations_date" ON "arbitrations" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_arbitrations_org" ON "arbitrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_responses_grievance" ON "grievance_responses" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_responses_date" ON "grievance_responses" USING btree ("response_date");--> statement-breakpoint
CREATE INDEX "idx_grievance_timeline_grievance" ON "grievance_timeline" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_timeline_date" ON "grievance_timeline" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "idx_grievance_timeline_type" ON "grievance_timeline" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_grievances_number" ON "grievances" USING btree ("grievance_number");--> statement-breakpoint
CREATE INDEX "idx_grievances_status" ON "grievances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_grievances_type" ON "grievances" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_grievances_priority" ON "grievances" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_grievances_step" ON "grievances" USING btree ("step");--> statement-breakpoint
CREATE INDEX "idx_grievances_grievant" ON "grievances" USING btree ("grievant_id");--> statement-breakpoint
CREATE INDEX "idx_grievances_union_rep" ON "grievances" USING btree ("union_rep_id");--> statement-breakpoint
CREATE INDEX "idx_grievances_employer" ON "grievances" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_grievances_cba" ON "grievances" USING btree ("cba_id");--> statement-breakpoint
CREATE INDEX "idx_grievances_org" ON "grievances" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievances_deadline" ON "grievances" USING btree ("response_deadline");--> statement-breakpoint
CREATE INDEX "idx_settlements_grievance" ON "settlements" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "idx_settlements_arbitration" ON "settlements" USING btree ("arbitration_id");--> statement-breakpoint
CREATE INDEX "idx_settlements_status" ON "settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_settlements_org" ON "settlements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_approvals_organization" ON "grievance_approvals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_approvals_transition" ON "grievance_approvals" USING btree ("transition_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_approvals_approver" ON "grievance_approvals" USING btree ("approver_user_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_approvals_action" ON "grievance_approvals" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_grievance_approvals_reviewed_at" ON "grievance_approvals" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "idx_grievance_assignments_organization" ON "grievance_assignments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_assignments_claim" ON "grievance_assignments" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_assignments_assigned_to" ON "grievance_assignments" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_grievance_assignments_status" ON "grievance_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_grievance_assignments_role" ON "grievance_assignments" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_grievance_communications_organization" ON "grievance_communications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_communications_claim" ON "grievance_communications" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_communications_type" ON "grievance_communications" USING btree ("communication_type");--> statement-breakpoint
CREATE INDEX "idx_grievance_communications_date" ON "grievance_communications" USING btree ("communication_date");--> statement-breakpoint
CREATE INDEX "idx_grievance_communications_followup" ON "grievance_communications" USING btree ("requires_followup","followup_completed");--> statement-breakpoint
CREATE INDEX "idx_grievance_settlements_organization" ON "grievance_settlements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_settlements_claim" ON "grievance_settlements" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_settlements_status" ON "grievance_settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_grievance_settlements_type" ON "grievance_settlements" USING btree ("settlement_type");--> statement-breakpoint
CREATE INDEX "idx_grievance_settlements_proposed_at" ON "grievance_settlements" USING btree ("proposed_at");--> statement-breakpoint
CREATE INDEX "idx_grievance_stages_organization" ON "grievance_stages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_stages_workflow" ON "grievance_stages" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_stages_type" ON "grievance_stages" USING btree ("stage_type");--> statement-breakpoint
CREATE INDEX "idx_grievance_stages_order" ON "grievance_stages" USING btree ("workflow_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_grievance_transitions_organization" ON "grievance_transitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_transitions_claim" ON "grievance_transitions" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_transitions_from_stage" ON "grievance_transitions" USING btree ("from_stage_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_transitions_to_stage" ON "grievance_transitions" USING btree ("to_stage_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_transitions_date" ON "grievance_transitions" USING btree ("transitioned_at");--> statement-breakpoint
CREATE INDEX "idx_grievance_workflows_organization" ON "grievance_workflows" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_workflows_type" ON "grievance_workflows" USING btree ("grievance_type");--> statement-breakpoint
CREATE INDEX "idx_grievance_workflows_status" ON "grievance_workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_grievance_events_grievance" ON "grievance_events" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_events_type" ON "grievance_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_grievance_events_actor" ON "grievance_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_grievance_events_created" ON "grievance_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cba_contacts_cba_idx" ON "cba_contacts" USING btree ("cba_id");--> statement-breakpoint
CREATE INDEX "cba_contacts_type_idx" ON "cba_contacts" USING btree ("contact_type");--> statement-breakpoint
CREATE INDEX "cba_version_cba_idx" ON "cba_version_history" USING btree ("cba_id");--> statement-breakpoint
CREATE INDEX "cba_version_number_idx" ON "cba_version_history" USING btree ("version");--> statement-breakpoint
CREATE INDEX "cba_organization_idx" ON "collective_agreements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cba_jurisdiction_idx" ON "collective_agreements" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "cba_employer_idx" ON "collective_agreements" USING btree ("employer_name");--> statement-breakpoint
CREATE INDEX "cba_union_idx" ON "collective_agreements" USING btree ("union_name");--> statement-breakpoint
CREATE INDEX "cba_expiry_idx" ON "collective_agreements" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "cba_status_idx" ON "collective_agreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cba_effective_date_idx" ON "collective_agreements" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "cba_sector_idx" ON "collective_agreements" USING btree ("industry_sector");--> statement-breakpoint
CREATE INDEX "benefit_comparisons_cba_idx" ON "benefit_comparisons" USING btree ("cba_id");--> statement-breakpoint
CREATE INDEX "benefit_comparisons_type_idx" ON "benefit_comparisons" USING btree ("benefit_type");--> statement-breakpoint
CREATE INDEX "cba_clauses_cba_idx" ON "cba_clauses" USING btree ("cba_id");--> statement-breakpoint
CREATE INDEX "cba_clauses_type_idx" ON "cba_clauses" USING btree ("clause_type");--> statement-breakpoint
CREATE INDEX "cba_clauses_number_idx" ON "cba_clauses" USING btree ("clause_number");--> statement-breakpoint
CREATE INDEX "cba_clauses_parent_idx" ON "cba_clauses" USING btree ("parent_clause_id");--> statement-breakpoint
CREATE INDEX "cba_clauses_confidence_idx" ON "cba_clauses" USING btree ("confidence_score");--> statement-breakpoint
CREATE INDEX "clause_comparisons_organization_idx" ON "clause_comparisons" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clause_comparisons_type_idx" ON "clause_comparisons" USING btree ("clause_type");--> statement-breakpoint
CREATE INDEX "wage_progressions_cba_idx" ON "wage_progressions" USING btree ("cba_id");--> statement-breakpoint
CREATE INDEX "wage_progressions_clause_idx" ON "wage_progressions" USING btree ("clause_id");--> statement-breakpoint
CREATE INDEX "wage_progressions_classification_idx" ON "wage_progressions" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "wage_progressions_effective_date_idx" ON "wage_progressions" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "arbitration_tribunal_idx" ON "arbitration_decisions" USING btree ("tribunal");--> statement-breakpoint
CREATE INDEX "arbitration_decision_date_idx" ON "arbitration_decisions" USING btree ("decision_date");--> statement-breakpoint
CREATE INDEX "arbitration_arbitrator_idx" ON "arbitration_decisions" USING btree ("arbitrator");--> statement-breakpoint
CREATE INDEX "arbitration_outcome_idx" ON "arbitration_decisions" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "arbitration_precedent_idx" ON "arbitration_decisions" USING btree ("precedent_value");--> statement-breakpoint
CREATE INDEX "arbitration_jurisdiction_idx" ON "arbitration_decisions" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "arbitration_case_number_idx" ON "arbitration_decisions" USING btree ("case_number");--> statement-breakpoint
CREATE INDEX "arbitrator_profiles_name_idx" ON "arbitrator_profiles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "arbitrator_profiles_active_idx" ON "arbitrator_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "bargaining_notes_cba_idx" ON "bargaining_notes" USING btree ("cba_id");--> statement-breakpoint
CREATE INDEX "bargaining_notes_organization_idx" ON "bargaining_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bargaining_notes_session_date_idx" ON "bargaining_notes" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX "bargaining_notes_session_type_idx" ON "bargaining_notes" USING btree ("session_type");--> statement-breakpoint
CREATE INDEX "cba_footnotes_source_idx" ON "cba_footnotes" USING btree ("source_clause_id");--> statement-breakpoint
CREATE INDEX "cba_footnotes_target_clause_idx" ON "cba_footnotes" USING btree ("target_clause_id");--> statement-breakpoint
CREATE INDEX "cba_footnotes_target_decision_idx" ON "cba_footnotes" USING btree ("target_decision_id");--> statement-breakpoint
CREATE INDEX "claim_precedent_claim_idx" ON "claim_precedent_analysis" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_clause_comparisons_user" ON "clause_comparisons_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_clause_comparisons_org" ON "clause_comparisons_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_clause_tags_clause" ON "clause_library_tags" USING btree ("clause_id");--> statement-breakpoint
CREATE INDEX "idx_clause_tags_name" ON "clause_library_tags" USING btree ("tag_name");--> statement-breakpoint
CREATE INDEX "idx_shared_clauses_org" ON "shared_clause_library" USING btree ("source_organization_id");--> statement-breakpoint
CREATE INDEX "idx_shared_clauses_type" ON "shared_clause_library" USING btree ("clause_type");--> statement-breakpoint
CREATE INDEX "idx_shared_clauses_sharing" ON "shared_clause_library" USING btree ("sharing_level");--> statement-breakpoint
CREATE INDEX "idx_shared_clauses_sector" ON "shared_clause_library" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_shared_clauses_province" ON "shared_clause_library" USING btree ("province");--> statement-breakpoint
CREATE INDEX "bargaining_proposals_negotiation_idx" ON "bargaining_proposals" USING btree ("negotiation_id");--> statement-breakpoint
CREATE INDEX "bargaining_proposals_status_idx" ON "bargaining_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bargaining_proposals_type_idx" ON "bargaining_proposals" USING btree ("proposal_type");--> statement-breakpoint
CREATE INDEX "bargaining_proposals_category_idx" ON "bargaining_proposals" USING btree ("clause_category");--> statement-breakpoint
CREATE INDEX "bargaining_proposals_number_idx" ON "bargaining_proposals" USING btree ("proposal_number");--> statement-breakpoint
CREATE INDEX "bargaining_team_negotiation_idx" ON "bargaining_team_members" USING btree ("negotiation_id");--> statement-breakpoint
CREATE INDEX "bargaining_team_member_idx" ON "bargaining_team_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "bargaining_team_role_idx" ON "bargaining_team_members" USING btree ("role");--> statement-breakpoint
CREATE INDEX "bargaining_team_active_idx" ON "bargaining_team_members" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "negotiation_sessions_negotiation_idx" ON "negotiation_sessions" USING btree ("negotiation_id");--> statement-breakpoint
CREATE INDEX "negotiation_sessions_scheduled_idx" ON "negotiation_sessions" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "negotiation_sessions_number_idx" ON "negotiation_sessions" USING btree ("session_number");--> statement-breakpoint
CREATE INDEX "negotiation_sessions_status_idx" ON "negotiation_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "negotiations_organization_idx" ON "negotiations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "negotiations_status_idx" ON "negotiations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "negotiations_expiring_cba_idx" ON "negotiations" USING btree ("expiring_cba_id");--> statement-breakpoint
CREATE INDEX "negotiations_first_session_idx" ON "negotiations" USING btree ("first_session_date");--> statement-breakpoint
CREATE INDEX "tentative_agreements_negotiation_idx" ON "tentative_agreements" USING btree ("negotiation_id");--> statement-breakpoint
CREATE INDEX "tentative_agreements_category_idx" ON "tentative_agreements" USING btree ("clause_category");--> statement-breakpoint
CREATE INDEX "tentative_agreements_ratified_idx" ON "tentative_agreements" USING btree ("ratified");--> statement-breakpoint
CREATE INDEX "idx_clause_embeddings_clause" ON "clause_embeddings" USING btree ("clause_id");--> statement-breakpoint
CREATE INDEX "bank_reconciliation_org_idx" ON "bank_reconciliation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bank_reconciliation_status_idx" ON "bank_reconciliation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bank_reconciliation_deposit_idx" ON "bank_reconciliation" USING btree ("bank_deposit_id");--> statement-breakpoint
CREATE INDEX "payment_cycles_org_idx" ON "payment_cycles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_cycles_status_idx" ON "payment_cycles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "payment_disputes_org_idx" ON "payment_disputes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_disputes_payment_idx" ON "payment_disputes" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_disputes_status_idx" ON "payment_disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_methods_org_member_idx" ON "payment_methods" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX "payment_methods_stripe_idx" ON "payment_methods" USING btree ("stripe_payment_method_id");--> statement-breakpoint
CREATE INDEX "payments_org_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_member_idx" ON "payments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_method_idx" ON "payments" USING btree ("method");--> statement-breakpoint
CREATE INDEX "payments_stripe_idx" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payments_reconciliation_idx" ON "payments" USING btree ("reconciliation_status");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_org_idx" ON "stripe_webhook_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_stripe_idx" ON "stripe_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_processed_idx" ON "stripe_webhook_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "cost_centers_org_idx" ON "cost_centers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cost_centers_code_idx" ON "cost_centers" USING btree ("code","organization_id");--> statement-breakpoint
CREATE INDEX "cost_centers_type_idx" ON "cost_centers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "cost_centers_status_idx" ON "cost_centers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gl_transaction_log_org_idx" ON "gl_transaction_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "gl_transaction_log_chart_idx" ON "gl_transaction_log" USING btree ("chart_of_accounts_id");--> statement-breakpoint
CREATE INDEX "gl_transaction_log_date_idx" ON "gl_transaction_log" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "gl_transaction_log_number_idx" ON "gl_transaction_log" USING btree ("transaction_number");--> statement-breakpoint
CREATE INDEX "gl_transaction_log_posted_idx" ON "gl_transaction_log" USING btree ("is_posted");--> statement-breakpoint
CREATE INDEX "gl_transaction_log_reconciled_idx" ON "gl_transaction_log" USING btree ("is_reconciled");--> statement-breakpoint
CREATE INDEX "gl_trial_balance_org_idx" ON "gl_trial_balance" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "gl_trial_balance_chart_idx" ON "gl_trial_balance" USING btree ("chart_of_accounts_id");--> statement-breakpoint
CREATE INDEX "gl_trial_balance_date_idx" ON "gl_trial_balance" USING btree ("period_end_date");--> statement-breakpoint
CREATE INDEX "gl_trial_balance_finalized_idx" ON "gl_trial_balance" USING btree ("is_finalized");--> statement-breakpoint
CREATE INDEX "idx_org_billing_config_org" ON "organization_billing_config" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_accounts_org_idx" ON "billing_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_accounts_status_idx" ON "billing_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_adjustments_org_idx" ON "billing_adjustments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_adjustments_billing_acct_idx" ON "billing_adjustments" USING btree ("billing_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_periods_org_label_idx" ON "billing_periods" USING btree ("organization_id","label");--> statement-breakpoint
CREATE INDEX "org_subscriptions_billing_idx" ON "org_subscriptions" USING btree ("billing_account_id");--> statement-breakpoint
CREATE INDEX "org_subscriptions_org_idx" ON "org_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_subscriptions_status_idx" ON "org_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_invoice_idx" ON "payment_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "platform_line_items_invoice_idx" ON "platform_invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "platform_invoices_org_idx" ON "platform_invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "platform_invoices_billing_acct_idx" ON "platform_invoices" USING btree ("billing_account_id");--> statement-breakpoint
CREATE INDEX "platform_invoices_status_idx" ON "platform_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_invoices_period_idx" ON "platform_invoices" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "platform_payments_org_idx" ON "platform_payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "platform_payments_billing_acct_idx" ON "platform_payments" USING btree ("billing_account_id");--> statement-breakpoint
CREATE INDEX "platform_payments_status_idx" ON "platform_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pcle_org_idx" ON "platform_cost_ledger_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pcle_period_idx" ON "platform_cost_ledger_entries" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "pcle_cost_type_idx" ON "platform_cost_ledger_entries" USING btree ("cost_type");--> statement-breakpoint
CREATE INDEX "pcle_event_type_idx" ON "platform_cost_ledger_entries" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "pcle_source_idx" ON "platform_cost_ledger_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "pcle_allocation_idx" ON "platform_cost_ledger_entries" USING btree ("allocation_status");--> statement-breakpoint
CREATE INDEX "pcle_created_idx" ON "platform_cost_ledger_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pcle_local_idx" ON "platform_cost_ledger_entries" USING btree ("local_id");--> statement-breakpoint
CREATE INDEX "abs_run_idx" ON "allocation_basis_snapshots" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "abs_local_idx" ON "allocation_basis_snapshots" USING btree ("local_id");--> statement-breakpoint
CREATE INDEX "arv_rule_idx" ON "allocation_rule_versions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "arv_effective_idx" ON "allocation_rule_versions" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "allocation_rules_org_idx" ON "allocation_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "arl_run_idx" ON "allocation_run_lines" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "arl_local_idx" ON "allocation_run_lines" USING btree ("local_id");--> statement-breakpoint
CREATE INDEX "allocation_runs_org_idx" ON "allocation_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "allocation_runs_period_idx" ON "allocation_runs" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "allocation_runs_status_idx" ON "allocation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chargeback_org_idx" ON "chargeback_statements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chargeback_local_idx" ON "chargeback_statements" USING btree ("local_id");--> statement-breakpoint
CREATE INDEX "chargeback_period_idx" ON "chargeback_statements" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_organization" ON "poll_votes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_poll" ON "poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_user" ON "poll_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_option" ON "poll_votes" USING btree ("poll_id","option_id");--> statement-breakpoint
CREATE INDEX "idx_polls_organization" ON "polls" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_polls_status" ON "polls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_polls_published" ON "polls" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_polls_closes" ON "polls" USING btree ("closes_at");--> statement-breakpoint
CREATE INDEX "idx_survey_answers_organization" ON "survey_answers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_survey_answers_response" ON "survey_answers" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "idx_survey_answers_question" ON "survey_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_survey_questions_organization" ON "survey_questions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_survey_questions_survey" ON "survey_questions" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "idx_survey_questions_order" ON "survey_questions" USING btree ("survey_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_survey_questions_type" ON "survey_questions" USING btree ("question_type");--> statement-breakpoint
CREATE INDEX "idx_survey_responses_organization" ON "survey_responses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_survey_responses_survey" ON "survey_responses" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "idx_survey_responses_user" ON "survey_responses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_survey_responses_status" ON "survey_responses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_survey_responses_completed" ON "survey_responses" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "idx_surveys_organization" ON "surveys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_surveys_status" ON "surveys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_surveys_published" ON "surveys" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_surveys_closes" ON "surveys" USING btree ("closes_at");--> statement-breakpoint
CREATE INDEX "analytics_metrics_org_idx" ON "analytics_metrics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "analytics_metrics_type_idx" ON "analytics_metrics" USING btree ("metric_type");--> statement-breakpoint
CREATE INDEX "analytics_metrics_period_idx" ON "analytics_metrics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "comparative_analyses_org_idx" ON "comparative_analyses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "comparative_analyses_created_idx" ON "comparative_analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "insight_recommendations_org_idx" ON "insight_recommendations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "insight_recommendations_status_idx" ON "insight_recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "insight_recommendations_priority_idx" ON "insight_recommendations" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "insight_recommendations_created_idx" ON "insight_recommendations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "kpi_configurations_org_idx" ON "kpi_configurations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kpi_configurations_active_idx" ON "kpi_configurations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "trend_analyses_org_idx" ON "trend_analyses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "trend_analyses_type_idx" ON "trend_analyses" USING btree ("analysis_type");--> statement-breakpoint
CREATE INDEX "trend_analyses_created_idx" ON "trend_analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_push_deliveries_notification" ON "push_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "idx_push_deliveries_device" ON "push_deliveries" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_push_deliveries_status" ON "push_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_push_deliveries_sent" ON "push_deliveries" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_push_deliveries_clicked" ON "push_deliveries" USING btree ("clicked_at");--> statement-breakpoint
CREATE INDEX "idx_push_devices_organization" ON "push_devices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_push_devices_profile" ON "push_devices" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_push_devices_token" ON "push_devices" USING btree ("device_token");--> statement-breakpoint
CREATE INDEX "idx_push_devices_platform" ON "push_devices" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_push_devices_enabled" ON "push_devices" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_push_devices_last_active" ON "push_devices" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "idx_push_templates_organization" ON "push_notification_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_push_templates_category" ON "push_notification_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_push_templates_system" ON "push_notification_templates" USING btree ("is_system");--> statement-breakpoint
CREATE INDEX "idx_push_templates_created" ON "push_notification_templates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_push_notifications_organization" ON "push_notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_push_notifications_template" ON "push_notifications" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_push_notifications_status" ON "push_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_push_notifications_scheduled" ON "push_notifications" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_push_notifications_target_type" ON "push_notifications" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "idx_push_notifications_created" ON "push_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_public_content_slug" ON "public_content" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_public_content_published" ON "public_content" USING btree ("is_published","published_at");--> statement-breakpoint
CREATE INDEX "idx_campaigns_org" ON "campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaigns_channel" ON "campaigns" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_campaigns_type" ON "campaigns" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_campaigns_scheduled" ON "campaigns" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_campaigns_created" ON "campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_comm_channels_org" ON "communication_channels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_comm_channels_type" ON "communication_channels" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_comm_channels_active" ON "communication_channels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_comm_channels_primary" ON "communication_channels" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "idx_comm_prefs_org_user" ON "communication_preferences" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_comm_prefs_email" ON "communication_preferences" USING btree ("email_enabled");--> statement-breakpoint
CREATE INDEX "idx_comm_prefs_sms" ON "communication_preferences" USING btree ("sms_enabled");--> statement-breakpoint
CREATE INDEX "idx_comm_prefs_unsubscribed" ON "communication_preferences" USING btree ("globally_unsubscribed");--> statement-breakpoint
CREATE INDEX "idx_consent_records_org" ON "consent_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_consent_records_user" ON "consent_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_consent_records_channel" ON "consent_records" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_consent_records_status" ON "consent_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_consent_records_created" ON "consent_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_message_log_org" ON "message_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_message_log_campaign" ON "message_log" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_message_log_recipient" ON "message_log" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_message_log_status" ON "message_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_message_log_sent" ON "message_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_message_log_created" ON "message_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_message_templates_org" ON "message_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_message_templates_type" ON "message_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_message_templates_category" ON "message_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_message_templates_active" ON "message_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_field_notes_org" ON "field_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_field_notes_member" ON "field_notes" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_field_notes_author" ON "field_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_field_notes_type" ON "field_notes" USING btree ("note_type");--> statement-breakpoint
CREATE INDEX "idx_field_notes_sentiment" ON "field_notes" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "idx_field_notes_follow_up" ON "field_notes" USING btree ("follow_up_date");--> statement-breakpoint
CREATE INDEX "idx_field_notes_interaction_date" ON "field_notes" USING btree ("interaction_date");--> statement-breakpoint
CREATE INDEX "idx_member_relationship_scores_org" ON "member_relationship_scores" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_member_relationship_scores_member" ON "member_relationship_scores" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_relationship_scores_overall" ON "member_relationship_scores" USING btree ("overall_score");--> statement-breakpoint
CREATE INDEX "idx_member_relationship_scores_at_risk" ON "member_relationship_scores" USING btree ("is_at_risk");--> statement-breakpoint
CREATE INDEX "idx_member_relationship_scores_last_contact" ON "member_relationship_scores" USING btree ("last_contact_date");--> statement-breakpoint
CREATE INDEX "idx_organizer_tasks_org" ON "organizer_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organizer_tasks_assigned" ON "organizer_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_organizer_tasks_member" ON "organizer_tasks" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_organizer_tasks_status" ON "organizer_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_organizer_tasks_priority" ON "organizer_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_organizer_tasks_due_date" ON "organizer_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_outreach_enrollments_org" ON "outreach_enrollments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_enrollments_sequence" ON "outreach_enrollments" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_enrollments_member" ON "outreach_enrollments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_enrollments_status" ON "outreach_enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_outreach_enrollments_next_step" ON "outreach_enrollments" USING btree ("next_step_at");--> statement-breakpoint
CREATE INDEX "idx_outreach_sequences_org" ON "outreach_sequences" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_sequences_status" ON "outreach_sequences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_outreach_sequences_active" ON "outreach_sequences" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_outreach_sequences_trigger" ON "outreach_sequences" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_outreach_steps_log_org" ON "outreach_steps_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_steps_log_enrollment" ON "outreach_steps_log" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_steps_log_status" ON "outreach_steps_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_outreach_steps_log_scheduled" ON "outreach_steps_log" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_task_comments_org" ON "task_comments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_task_comments_task" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_comments_author" ON "task_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_comm_templates_org" ON "communication_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_comm_templates_category" ON "communication_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_employer_comms_org" ON "employer_communications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_employer_comms_employer" ON "employer_communications" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_employer_comms_grievance" ON "employer_communications" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "idx_employer_comms_status" ON "employer_communications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_employer_comms_type" ON "employer_communications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_employer_contacts_org" ON "employer_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_employer_contacts_employer" ON "employer_contacts" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_employer_contacts_role" ON "employer_contacts" USING btree ("role");--> statement-breakpoint
CREATE INDEX "document_signers_document_id_idx" ON "document_signers" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_signers_user_id_idx" ON "document_signers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_signers_email_idx" ON "document_signers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "document_signers_status_idx" ON "document_signers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_signers_signing_order_idx" ON "document_signers" USING btree ("signing_order");--> statement-breakpoint
CREATE INDEX "signature_audit_document_id_idx" ON "signature_audit_trail" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signature_audit_signer_id_idx" ON "signature_audit_trail" USING btree ("signer_id");--> statement-breakpoint
CREATE INDEX "signature_audit_timestamp_idx" ON "signature_audit_trail" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "signature_audit_event_type_idx" ON "signature_audit_trail" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "signature_documents_organization_id_idx" ON "signature_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "signature_documents_status_idx" ON "signature_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signature_documents_sent_by_idx" ON "signature_documents" USING btree ("sent_by");--> statement-breakpoint
CREATE INDEX "signature_documents_provider_doc_id_idx" ON "signature_documents" USING btree ("provider_document_id");--> statement-breakpoint
CREATE INDEX "signature_templates_organization_id_idx" ON "signature_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "signature_templates_category_idx" ON "signature_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "signature_templates_is_active_idx" ON "signature_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "signature_webhooks_provider_idx" ON "signature_webhooks_log" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "signature_webhooks_document_id_idx" ON "signature_webhooks_log" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signature_webhooks_processing_status_idx" ON "signature_webhooks_log" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "signature_audit_log_workflow_idx" ON "signature_audit_log" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "signature_audit_log_signer_idx" ON "signature_audit_log" USING btree ("signer_id");--> statement-breakpoint
CREATE INDEX "signature_audit_log_event_type_idx" ON "signature_audit_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "signature_verification_workflow_idx" ON "signature_verification" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "signature_verification_signer_idx" ON "signature_verification" USING btree ("signer_id");--> statement-breakpoint
CREATE INDEX "signature_verification_verified_idx" ON "signature_verification" USING btree ("is_verified");--> statement-breakpoint
CREATE INDEX "signature_workflows_org_idx" ON "signature_workflows" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "signature_workflows_doc_idx" ON "signature_workflows" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signature_workflows_status_idx" ON "signature_workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signature_workflows_envelope_idx" ON "signature_workflows" USING btree ("external_envelope_id");--> statement-breakpoint
CREATE INDEX "signers_workflow_idx" ON "signers" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "signers_member_idx" ON "signers" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "signers_email_idx" ON "signers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "signers_status_idx" ON "signers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_course_registrations_completed" ON "course_registrations" USING btree ("completed");--> statement-breakpoint
CREATE INDEX "idx_course_registrations_course" ON "course_registrations" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_course_registrations_member" ON "course_registrations" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_course_registrations_org" ON "course_registrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_course_registrations_session" ON "course_registrations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_course_registrations_status" ON "course_registrations" USING btree ("registration_status");--> statement-breakpoint
CREATE INDEX "idx_course_sessions_course" ON "course_sessions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_course_sessions_dates" ON "course_sessions" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_course_sessions_instructor" ON "course_sessions" USING btree ("lead_instructor_id");--> statement-breakpoint
CREATE INDEX "idx_course_sessions_org" ON "course_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_course_sessions_status" ON "course_sessions" USING btree ("session_status");--> statement-breakpoint
CREATE INDEX "idx_member_certifications_expiry" ON "member_certifications" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_member_certifications_member" ON "member_certifications" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_certifications_org" ON "member_certifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_member_certifications_status" ON "member_certifications" USING btree ("certification_status");--> statement-breakpoint
CREATE INDEX "idx_member_certifications_type" ON "member_certifications" USING btree ("certification_type");--> statement-breakpoint
CREATE INDEX "idx_program_enrollments_member" ON "program_enrollments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_program_enrollments_org" ON "program_enrollments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_program_enrollments_program" ON "program_enrollments" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_program_enrollments_status" ON "program_enrollments" USING btree ("enrollment_status");--> statement-breakpoint
CREATE INDEX "idx_training_courses_active" ON "training_courses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_training_courses_category" ON "training_courses" USING btree ("course_category");--> statement-breakpoint
CREATE INDEX "idx_training_courses_clc" ON "training_courses" USING btree ("clc_approved");--> statement-breakpoint
CREATE INDEX "idx_training_courses_org" ON "training_courses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_training_programs_active" ON "training_programs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_training_programs_org" ON "training_programs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cookie_consents_user_id_idx" ON "cookie_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cookie_consents_consent_id_idx" ON "cookie_consents" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "cookie_consents_organization_id_idx" ON "cookie_consents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "anonymization_log_user_id_idx" ON "data_anonymization_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "anonymization_log_organization_id_idx" ON "data_anonymization_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "anonymization_log_request_id_idx" ON "data_anonymization_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "data_processing_organization_id_idx" ON "data_processing_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "data_processing_next_review_idx" ON "data_processing_records" USING btree ("next_review_due");--> statement-breakpoint
CREATE INDEX "retention_policies_organization_id_idx" ON "data_retention_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "retention_policies_next_execution_idx" ON "data_retention_policies" USING btree ("next_execution");--> statement-breakpoint
CREATE INDEX "gdpr_requests_user_id_idx" ON "gdpr_data_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gdpr_requests_status_idx" ON "gdpr_data_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gdpr_requests_type_idx" ON "gdpr_data_requests" USING btree ("request_type");--> statement-breakpoint
CREATE INDEX "gdpr_requests_deadline_idx" ON "gdpr_data_requests" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "gdpr_requests_organization_id_idx" ON "gdpr_data_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_consents_user_id_idx" ON "user_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_consents_organization_id_idx" ON "user_consents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_consents_status_idx" ON "user_consents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_consents_type_idx" ON "user_consents" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "idx_compliance_alerts_org" ON "compliance_alerts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_alerts_employer" ON "compliance_alerts" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_alerts_severity" ON "compliance_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_compliance_alerts_type" ON "compliance_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_compliance_alerts_created" ON "compliance_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_employer_reports_employer" ON "employer_reports" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_employer_reports_type" ON "employer_reports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_employer_reports_created" ON "employer_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_contribution_rates_type" ON "contribution_rates" USING btree ("rate_type");--> statement-breakpoint
CREATE INDEX "idx_contribution_rates_year" ON "contribution_rates" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_col_data_geo" ON "cost_of_living_data" USING btree ("geography_code");--> statement-breakpoint
CREATE INDEX "idx_col_data_year" ON "cost_of_living_data" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_sync_log_source" ON "external_data_sync_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_sync_log_status" ON "external_data_sync_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sync_log_started" ON "external_data_sync_log" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_union_density_noc" ON "union_density" USING btree ("noc_code");--> statement-breakpoint
CREATE INDEX "idx_union_density_naics" ON "union_density" USING btree ("naics_code");--> statement-breakpoint
CREATE INDEX "idx_union_density_geo" ON "union_density" USING btree ("geography_code");--> statement-breakpoint
CREATE INDEX "idx_union_density_ref" ON "union_density" USING btree ("ref_date");--> statement-breakpoint
CREATE INDEX "idx_wage_benchmarks_noc" ON "wage_benchmarks" USING btree ("noc_code");--> statement-breakpoint
CREATE INDEX "idx_wage_benchmarks_geography" ON "wage_benchmarks" USING btree ("geography_code");--> statement-breakpoint
CREATE INDEX "idx_wage_benchmarks_noc_geo" ON "wage_benchmarks" USING btree ("noc_code","geography_code");--> statement-breakpoint
CREATE INDEX "idx_wage_benchmarks_ref_date" ON "wage_benchmarks" USING btree ("ref_date");--> statement-breakpoint
CREATE INDEX "idx_wage_benchmarks_sync" ON "wage_benchmarks" USING btree ("sync_id");--> statement-breakpoint
CREATE INDEX "idx_wage_benchmarks_composite" ON "wage_benchmarks" USING btree ("noc_code","geography_code","sex","ref_date");--> statement-breakpoint
CREATE INDEX "idx_precedents_org" ON "arbitration_precedents" USING btree ("source_organization_id");--> statement-breakpoint
CREATE INDEX "idx_precedents_type" ON "arbitration_precedents" USING btree ("grievance_type");--> statement-breakpoint
CREATE INDEX "idx_precedents_outcome" ON "arbitration_precedents" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "idx_precedents_arbitrator" ON "arbitration_precedents" USING btree ("arbitrator_name");--> statement-breakpoint
CREATE INDEX "idx_precedents_jurisdiction" ON "arbitration_precedents" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "idx_precedents_sharing" ON "arbitration_precedents" USING btree ("sharing_level");--> statement-breakpoint
CREATE INDEX "idx_precedents_level" ON "arbitration_precedents" USING btree ("precedential_value");--> statement-breakpoint
CREATE INDEX "idx_precedents_sector" ON "arbitration_precedents" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_citations_precedent" ON "precedent_citations" USING btree ("precedent_id");--> statement-breakpoint
CREATE INDEX "idx_citations_claim" ON "precedent_citations" USING btree ("citing_claim_id");--> statement-breakpoint
CREATE INDEX "idx_citations_org" ON "precedent_citations" USING btree ("citing_organization_id");--> statement-breakpoint
CREATE INDEX "idx_precedent_tags_precedent" ON "precedent_tags" USING btree ("precedent_id");--> statement-breakpoint
CREATE INDEX "idx_precedent_tags_name" ON "precedent_tags" USING btree ("tag_name");--> statement-breakpoint
CREATE INDEX "idx_congress_memberships_org_id" ON "congress_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_congress_memberships_congress_id" ON "congress_memberships" USING btree ("congress_id");--> statement-breakpoint
CREATE INDEX "idx_congress_memberships_status" ON "congress_memberships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_congress_memberships_joined_at" ON "congress_memberships" USING btree ("joined_at");--> statement-breakpoint
CREATE UNIQUE INDEX "congress_memberships_org_congress_unique" ON "congress_memberships" USING btree ("organization_id","congress_id");--> statement-breakpoint
CREATE INDEX "external_accounts_org_provider_idx" ON "external_accounts" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_accounts_external_id_idx" ON "external_accounts" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "external_accounts_type_idx" ON "external_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "external_accounts_classification_idx" ON "external_accounts" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "external_accounts_active_idx" ON "external_accounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "external_customers_org_provider_idx" ON "external_customers" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_customers_external_id_idx" ON "external_customers" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "external_customers_name_idx" ON "external_customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "external_customers_email_idx" ON "external_customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "external_invoices_org_provider_idx" ON "external_invoices" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_invoices_external_id_idx" ON "external_invoices" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "external_invoices_invoice_number_idx" ON "external_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "external_invoices_customer_idx" ON "external_invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "external_invoices_status_idx" ON "external_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_invoices_date_idx" ON "external_invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "external_payments_org_provider_idx" ON "external_payments" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_payments_external_id_idx" ON "external_payments" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "external_payments_customer_idx" ON "external_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "external_payments_date_idx" ON "external_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "external_benefit_coverage_org_provider_idx" ON "external_benefit_coverage" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_benefit_coverage_employee_idx" ON "external_benefit_coverage" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "external_benefit_coverage_plan_idx" ON "external_benefit_coverage" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "external_benefit_coverage_status_idx" ON "external_benefit_coverage" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_benefit_dependents_org_provider_idx" ON "external_benefit_dependents" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_benefit_dependents_employee_idx" ON "external_benefit_dependents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "external_benefit_dependents_status_idx" ON "external_benefit_dependents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_benefit_enrollments_org_provider_idx" ON "external_benefit_enrollments" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_benefit_enrollments_employee_idx" ON "external_benefit_enrollments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "external_benefit_enrollments_plan_idx" ON "external_benefit_enrollments" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "external_benefit_enrollments_status_idx" ON "external_benefit_enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_benefit_enrollments_effective_date_idx" ON "external_benefit_enrollments" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "external_benefit_plans_org_provider_idx" ON "external_benefit_plans" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_benefit_plans_external_id_idx" ON "external_benefit_plans" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "external_benefit_plans_status_idx" ON "external_benefit_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_benefit_plans_plan_type_idx" ON "external_benefit_plans" USING btree ("plan_type");--> statement-breakpoint
CREATE INDEX "external_benefit_plans_effective_date_idx" ON "external_benefit_plans" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "external_benefit_utilization_org_provider_idx" ON "external_benefit_utilization" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_benefit_utilization_employee_idx" ON "external_benefit_utilization" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "external_benefit_utilization_policy_idx" ON "external_benefit_utilization" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "external_benefit_utilization_period_idx" ON "external_benefit_utilization" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "external_insurance_beneficiaries_org_provider_idx" ON "external_insurance_beneficiaries" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_insurance_beneficiaries_policy_idx" ON "external_insurance_beneficiaries" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "external_insurance_beneficiaries_employee_idx" ON "external_insurance_beneficiaries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "external_insurance_beneficiaries_status_idx" ON "external_insurance_beneficiaries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_insurance_claims_org_provider_idx" ON "external_insurance_claims" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_insurance_claims_claim_number_idx" ON "external_insurance_claims" USING btree ("claim_number");--> statement-breakpoint
CREATE INDEX "external_insurance_claims_employee_idx" ON "external_insurance_claims" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "external_insurance_claims_status_idx" ON "external_insurance_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_insurance_claims_submission_date_idx" ON "external_insurance_claims" USING btree ("submission_date");--> statement-breakpoint
CREATE INDEX "external_insurance_claims_claim_type_idx" ON "external_insurance_claims" USING btree ("claim_type");--> statement-breakpoint
CREATE INDEX "external_insurance_policies_org_provider_idx" ON "external_insurance_policies" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "external_insurance_policies_policy_number_idx" ON "external_insurance_policies" USING btree ("policy_number");--> statement-breakpoint
CREATE INDEX "external_insurance_policies_employee_idx" ON "external_insurance_policies" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "external_insurance_policies_status_idx" ON "external_insurance_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "comm_channels_org_id_idx" ON "external_communication_channels" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "comm_channels_provider_idx" ON "external_communication_channels" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "comm_channels_external_id_idx" ON "external_communication_channels" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "comm_channels_type_idx" ON "external_communication_channels" USING btree ("channel_type");--> statement-breakpoint
CREATE INDEX "comm_channels_archived_idx" ON "external_communication_channels" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "comm_channels_last_sync_idx" ON "external_communication_channels" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "comm_files_org_id_idx" ON "external_communication_files" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "comm_files_provider_idx" ON "external_communication_files" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "comm_files_channel_id_idx" ON "external_communication_files" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "comm_files_user_id_idx" ON "external_communication_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comm_files_file_type_idx" ON "external_communication_files" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "comm_files_created_at_idx" ON "external_communication_files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "comm_files_last_sync_idx" ON "external_communication_files" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "comm_messages_org_id_idx" ON "external_communication_messages" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "comm_messages_provider_idx" ON "external_communication_messages" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "comm_messages_channel_id_idx" ON "external_communication_messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "comm_messages_user_id_idx" ON "external_communication_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comm_messages_timestamp_idx" ON "external_communication_messages" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "comm_messages_thread_id_idx" ON "external_communication_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "comm_messages_last_sync_idx" ON "external_communication_messages" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "comm_users_org_id_idx" ON "external_communication_users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "comm_users_provider_idx" ON "external_communication_users" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "comm_users_external_id_idx" ON "external_communication_users" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "comm_users_email_idx" ON "external_communication_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "comm_users_username_idx" ON "external_communication_users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "comm_users_is_bot_idx" ON "external_communication_users" USING btree ("is_bot");--> statement-breakpoint
CREATE INDEX "comm_users_last_sync_idx" ON "external_communication_users" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "lms_completions_org_id_idx" ON "external_lms_completions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "lms_completions_provider_idx" ON "external_lms_completions" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "lms_completions_course_id_idx" ON "external_lms_completions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "lms_completions_learner_id_idx" ON "external_lms_completions" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "lms_completions_completed_at_idx" ON "external_lms_completions" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "lms_completions_last_sync_idx" ON "external_lms_completions" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "lms_courses_org_id_idx" ON "external_lms_courses" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "lms_courses_provider_idx" ON "external_lms_courses" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "lms_courses_external_id_idx" ON "external_lms_courses" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "lms_courses_difficulty_idx" ON "external_lms_courses" USING btree ("difficulty_level");--> statement-breakpoint
CREATE INDEX "lms_courses_last_sync_idx" ON "external_lms_courses" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "lms_enrollments_org_id_idx" ON "external_lms_enrollments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "lms_enrollments_provider_idx" ON "external_lms_enrollments" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "lms_enrollments_course_id_idx" ON "external_lms_enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "lms_enrollments_learner_id_idx" ON "external_lms_enrollments" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "lms_enrollments_status_idx" ON "external_lms_enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lms_enrollments_last_sync_idx" ON "external_lms_enrollments" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "lms_learners_org_id_idx" ON "external_lms_learners" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "lms_learners_provider_idx" ON "external_lms_learners" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "lms_learners_external_id_idx" ON "external_lms_learners" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "lms_learners_email_idx" ON "external_lms_learners" USING btree ("email");--> statement-breakpoint
CREATE INDEX "lms_learners_last_sync_idx" ON "external_lms_learners" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "lms_progress_org_id_idx" ON "external_lms_progress" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "lms_progress_provider_idx" ON "external_lms_progress" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "lms_progress_course_id_idx" ON "external_lms_progress" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "lms_progress_learner_id_idx" ON "external_lms_progress" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "lms_progress_last_sync_idx" ON "external_lms_progress" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "doc_files_org_id_idx" ON "external_document_files" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "doc_files_provider_idx" ON "external_document_files" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "doc_files_library_id_idx" ON "external_document_files" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "doc_files_is_folder_idx" ON "external_document_files" USING btree ("is_folder");--> statement-breakpoint
CREATE INDEX "doc_files_created_by_email_idx" ON "external_document_files" USING btree ("created_by_email");--> statement-breakpoint
CREATE INDEX "doc_files_last_modified_at_idx" ON "external_document_files" USING btree ("last_modified_at");--> statement-breakpoint
CREATE INDEX "doc_files_last_sync_idx" ON "external_document_files" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "doc_libraries_org_id_idx" ON "external_document_libraries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "doc_libraries_provider_idx" ON "external_document_libraries" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "doc_libraries_external_id_idx" ON "external_document_libraries" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "doc_libraries_site_id_idx" ON "external_document_libraries" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "doc_libraries_last_sync_idx" ON "external_document_libraries" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "doc_permissions_org_id_idx" ON "external_document_permissions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "doc_permissions_provider_idx" ON "external_document_permissions" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "doc_permissions_file_id_idx" ON "external_document_permissions" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "doc_permissions_user_id_idx" ON "external_document_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "doc_permissions_group_id_idx" ON "external_document_permissions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "doc_permissions_last_sync_idx" ON "external_document_permissions" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "doc_sites_org_id_idx" ON "external_document_sites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "doc_sites_provider_idx" ON "external_document_sites" USING btree ("external_provider");--> statement-breakpoint
CREATE INDEX "doc_sites_external_id_idx" ON "external_document_sites" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "doc_sites_last_sync_idx" ON "external_document_sites" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "ext_pension_ben_org_provider_idx" ON "external_pension_beneficiaries" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_pension_ben_member_idx" ON "external_pension_beneficiaries" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "ext_pension_ben_status_idx" ON "external_pension_beneficiaries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ext_pension_contrib_org_provider_idx" ON "external_pension_contributions" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_pension_contrib_member_idx" ON "external_pension_contributions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "ext_pension_contrib_plan_idx" ON "external_pension_contributions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "ext_pension_contrib_period_idx" ON "external_pension_contributions" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "ext_pension_contrib_type_idx" ON "external_pension_contributions" USING btree ("contribution_type");--> statement-breakpoint
CREATE INDEX "ext_pension_est_org_provider_idx" ON "external_pension_estimates" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_pension_est_member_idx" ON "external_pension_estimates" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "ext_pension_est_plan_idx" ON "external_pension_estimates" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "ext_pension_est_ret_age_idx" ON "external_pension_estimates" USING btree ("retirement_age");--> statement-breakpoint
CREATE INDEX "ext_pension_members_org_provider_idx" ON "external_pension_members" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_pension_members_employee_idx" ON "external_pension_members" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "ext_pension_members_plan_idx" ON "external_pension_members" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "ext_pension_members_status_idx" ON "external_pension_members" USING btree ("member_status");--> statement-breakpoint
CREATE INDEX "ext_pension_plans_org_provider_idx" ON "external_pension_plans" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_pension_plans_number_idx" ON "external_pension_plans" USING btree ("plan_number");--> statement-breakpoint
CREATE INDEX "ext_pension_plans_status_idx" ON "external_pension_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ext_pension_plans_jurisdiction_idx" ON "external_pension_plans" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "ext_pension_svc_org_provider_idx" ON "external_pension_service_credits" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_pension_svc_member_idx" ON "external_pension_service_credits" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "ext_pension_svc_plan_idx" ON "external_pension_service_credits" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "ext_pension_svc_type_idx" ON "external_pension_service_credits" USING btree ("credit_type");--> statement-breakpoint
CREATE INDEX "ext_cal_att_org_provider_idx" ON "external_calendar_attendees" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_cal_att_event_idx" ON "external_calendar_attendees" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ext_cal_att_email_idx" ON "external_calendar_attendees" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ext_cal_att_response_idx" ON "external_calendar_attendees" USING btree ("response_status");--> statement-breakpoint
CREATE INDEX "ext_cal_events_org_provider_idx" ON "external_calendar_events" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_cal_events_calendar_idx" ON "external_calendar_events" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "ext_cal_events_time_range_idx" ON "external_calendar_events" USING btree ("start_time","end_time");--> statement-breakpoint
CREATE INDEX "ext_cal_events_status_idx" ON "external_calendar_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ext_cal_events_type_idx" ON "external_calendar_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "ext_cal_events_organizer_idx" ON "external_calendar_events" USING btree ("organizer_email");--> statement-breakpoint
CREATE INDEX "ext_cal_recur_org_provider_idx" ON "external_calendar_recurring_patterns" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_cal_recur_event_idx" ON "external_calendar_recurring_patterns" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ext_calendars_org_provider_idx" ON "external_calendars" USING btree ("organization_id","external_provider");--> statement-breakpoint
CREATE INDEX "ext_calendars_owner_idx" ON "external_calendars" USING btree ("owner_email");--> statement-breakpoint
CREATE INDEX "idx_model_metadata_organization" ON "model_metadata" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_model_metadata_type" ON "model_metadata" USING btree ("model_type");--> statement-breakpoint
CREATE INDEX "idx_budgets_org_period" ON "ai_budgets" USING btree ("organization_id","billing_period_end");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_org" ON "ai_rate_limits" USING btree ("organization_id","limit_type");--> statement-breakpoint
CREATE INDEX "ai_safety_filters_flagged_idx" ON "ai_safety_filters" USING btree ("flagged");--> statement-breakpoint
CREATE INDEX "ai_safety_filters_action_idx" ON "ai_safety_filters" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_usage_org_time" ON "ai_usage_metrics" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_provider_time" ON "ai_usage_metrics" USING btree ("provider","created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_model" ON "ai_usage_metrics" USING btree ("model");--> statement-breakpoint
CREATE INDEX "idx_usage_user" ON "ai_usage_metrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_messages_role_idx" ON "chat_messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_organization_id_idx" ON "chat_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_status_idx" ON "chat_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chat_sessions_created_at_idx" ON "chat_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chatbot_analytics_organization_id_idx" ON "chatbot_analytics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chatbot_analytics_period_idx" ON "chatbot_analytics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "chatbot_suggestions_organization_id_idx" ON "chatbot_suggestions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chatbot_suggestions_category_idx" ON "chatbot_suggestions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "chatbot_suggestions_is_active_idx" ON "chatbot_suggestions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "knowledge_base_organization_id_idx" ON "knowledge_base" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_base_document_type_idx" ON "knowledge_base" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "knowledge_base_embedding_idx" ON "knowledge_base" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "knowledge_base_is_active_idx" ON "knowledge_base" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_ai_grievance_triages_org" ON "ai_grievance_triages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ai_grievance_triages_grievance" ON "ai_grievance_triages" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "idx_ai_grievance_triages_status" ON "ai_grievance_triages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_clause_reasonings_org" ON "ai_clause_reasonings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ai_clause_reasonings_grievance" ON "ai_clause_reasonings" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "idx_ai_clause_reasonings_status" ON "ai_clause_reasonings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_clause_reasonings_relevance" ON "ai_clause_reasonings" USING btree ("relevance_score");--> statement-breakpoint
CREATE INDEX "idx_employer_risk_scores_org" ON "employer_risk_scores" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_employer_risk_scores_employer" ON "employer_risk_scores" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_employer_risk_scores_band" ON "employer_risk_scores" USING btree ("risk_band");--> statement-breakpoint
CREATE INDEX "idx_employer_risk_scores_score" ON "employer_risk_scores" USING btree ("overall_score");--> statement-breakpoint
CREATE INDEX "idx_ai_copilot_sessions_org" ON "ai_copilot_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ai_copilot_sessions_user" ON "ai_copilot_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_copilot_sessions_action" ON "ai_copilot_sessions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_ai_copilot_sessions_outcome" ON "ai_copilot_sessions" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "idx_ai_insight_reports_org" ON "ai_insight_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ai_insight_reports_type" ON "ai_insight_reports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_ai_insight_reports_timeframe" ON "ai_insight_reports" USING btree ("timeframe");--> statement-breakpoint
CREATE INDEX "idx_ai_insight_reports_generated" ON "ai_insight_reports" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_automation_rules_status" ON "automation_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_automation_rules_target" ON "automation_rules" USING btree ("target_entity");--> statement-breakpoint
CREATE INDEX "idx_automation_rules_org" ON "automation_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_automation_rules_priority" ON "automation_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_webhook_log_type" ON "clc_webhook_log" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_webhook_log_affiliate" ON "clc_webhook_log" USING btree ("affiliate_code");--> statement-breakpoint
CREATE INDEX "idx_webhook_log_status" ON "clc_webhook_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_log_received" ON "clc_webhook_log" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_wallet_ledger_user" ON "reward_wallet_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_wallet_ledger_type" ON "reward_wallet_ledger" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_wallet_ledger_expires" ON "reward_wallet_ledger" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_uuid_mapping_clerk_id" ON "user_uuid_mapping" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "idx_alert_actions_rule" ON "alert_actions" USING btree ("alert_rule_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_alert_conditions_rule" ON "alert_conditions" USING btree ("alert_rule_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_alert_escalations_organization" ON "alert_escalations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_alert_escalations_rule" ON "alert_escalations" USING btree ("alert_rule_id");--> statement-breakpoint
CREATE INDEX "idx_alert_escalations_status" ON "alert_escalations" USING btree ("status","next_escalation_at");--> statement-breakpoint
CREATE INDEX "idx_alert_executions_rule" ON "alert_executions" USING btree ("alert_rule_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_alert_executions_status" ON "alert_executions" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "idx_alert_executions_created" ON "alert_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_alert_recipients_rule" ON "alert_recipients" USING btree ("alert_rule_id");--> statement-breakpoint
CREATE INDEX "idx_alert_recipients_type" ON "alert_recipients" USING btree ("recipient_type","recipient_id");--> statement-breakpoint
CREATE INDEX "idx_alert_rules_organization" ON "alert_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_alert_rules_category" ON "alert_rules" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_alert_rules_trigger" ON "alert_rules" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_alert_rules_next_execution" ON "alert_rules" USING btree ("last_executed_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_definitions_organization" ON "workflow_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_definitions_trigger" ON "workflow_definitions" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_workflow_definitions_category" ON "workflow_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_workflow_executions_workflow" ON "workflow_executions" USING btree ("workflow_definition_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_executions_organization" ON "workflow_executions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_workflow_executions_status" ON "workflow_executions" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "idx_automation_log_rule" ON "automation_execution_log" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_automation_log_target" ON "automation_execution_log" USING btree ("target_entity_id");--> statement-breakpoint
CREATE INDEX "idx_automation_log_status" ON "automation_execution_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_automation_log_started" ON "automation_execution_log" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_automation_schedule_rule" ON "automation_schedules" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_automation_schedule_next" ON "automation_schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "recognition_award_types_org_id_idx" ON "recognition_award_types" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "recognition_award_types_program_id_idx" ON "recognition_award_types" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "recognition_awards_org_id_idx" ON "recognition_awards" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "recognition_awards_program_id_idx" ON "recognition_awards" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "recognition_awards_recipient_user_id_idx" ON "recognition_awards" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "recognition_awards_status_idx" ON "recognition_awards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recognition_programs_org_id_idx" ON "recognition_programs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "reward_budget_envelopes_org_id_idx" ON "reward_budget_envelopes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "reward_budget_envelopes_program_id_idx" ON "reward_budget_envelopes" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "reward_redemptions_org_id_idx" ON "reward_redemptions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "reward_redemptions_user_id_idx" ON "reward_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reward_redemptions_provider_order_idx" ON "reward_redemptions" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX "webhook_receipts_provider_webhook_idx" ON "webhook_receipts" USING btree ("provider","webhook_id");--> statement-breakpoint
CREATE INDEX "idx_award_history_recipient" ON "award_history" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_award_history_giver" ON "award_history" USING btree ("giver_id");--> statement-breakpoint
CREATE INDEX "idx_award_history_template" ON "award_history" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_award_template_category" ON "award_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_award_template_status" ON "award_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_award_template_org" ON "award_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_budget_pool_org" ON "budget_pool" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_budget_pool_fiscal" ON "budget_pool" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_budget_res_pool" ON "budget_reservations" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_budget_res_status" ON "budget_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_card_signing_organization" ON "card_signing_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_card_signing_campaign" ON "card_signing_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_card_signing_contact" ON "card_signing_events" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_card_signing_date" ON "card_signing_events" USING btree ("signed_date");--> statement-breakpoint
CREATE INDEX "idx_card_signing_status" ON "card_signing_events" USING btree ("card_status");--> statement-breakpoint
CREATE INDEX "idx_card_signing_submitted" ON "card_signing_events" USING btree ("submitted_to_nlrb_clrb");--> statement-breakpoint
CREATE INDEX "idx_employer_responses_organization" ON "employer_responses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_employer_responses_campaign" ON "employer_responses" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_employer_responses_date" ON "employer_responses" USING btree ("response_date");--> statement-breakpoint
CREATE INDEX "idx_employer_responses_type" ON "employer_responses" USING btree ("response_type");--> statement-breakpoint
CREATE INDEX "idx_employer_responses_severity" ON "employer_responses" USING btree ("response_severity");--> statement-breakpoint
CREATE INDEX "idx_field_activities_organization" ON "field_organizer_activities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_field_activities_campaign" ON "field_organizer_activities" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_field_activities_organizer" ON "field_organizer_activities" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "idx_field_activities_contact" ON "field_organizer_activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_field_activities_date" ON "field_organizer_activities" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "idx_field_activities_type" ON "field_organizer_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_nlrb_clrb_organization" ON "nlrb_clrb_filings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_nlrb_clrb_campaign" ON "nlrb_clrb_filings" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_nlrb_clrb_status" ON "nlrb_clrb_filings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_nlrb_clrb_filing_number" ON "nlrb_clrb_filings" USING btree ("filing_number");--> statement-breakpoint
CREATE INDEX "idx_nlrb_clrb_jurisdiction" ON "nlrb_clrb_filings" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "idx_nlrb_clrb_election_date" ON "nlrb_clrb_filings" USING btree ("election_scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_campaign_milestones_organization" ON "organizing_campaign_milestones" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_milestones_campaign" ON "organizing_campaign_milestones" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_milestones_target_date" ON "organizing_campaign_milestones" USING btree ("target_date");--> statement-breakpoint
CREATE INDEX "idx_campaign_milestones_status" ON "organizing_campaign_milestones" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_organizing_campaigns_organization" ON "organizing_campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organizing_campaigns_status" ON "organizing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_organizing_campaigns_lead" ON "organizing_campaigns" USING btree ("lead_organizer_id");--> statement-breakpoint
CREATE INDEX "idx_organizing_campaigns_employer" ON "organizing_campaigns" USING btree ("target_employer");--> statement-breakpoint
CREATE INDEX "idx_organizing_campaigns_progress" ON "organizing_campaigns" USING btree ("card_signing_progress");--> statement-breakpoint
CREATE INDEX "idx_organizing_contacts_organization" ON "organizing_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organizing_contacts_campaign" ON "organizing_contacts" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_organizing_contacts_commitment" ON "organizing_contacts" USING btree ("commitment_level");--> statement-breakpoint
CREATE INDEX "idx_organizing_contacts_card_signed" ON "organizing_contacts" USING btree ("card_signed");--> statement-breakpoint
CREATE INDEX "idx_organizing_contacts_name" ON "organizing_contacts" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "idx_organizing_contacts_department" ON "organizing_contacts" USING btree ("campaign_id","department");--> statement-breakpoint
CREATE INDEX "idx_organizing_contacts_influence" ON "organizing_contacts" USING btree ("campaign_id","influence_level");--> statement-breakpoint
CREATE INDEX "idx_union_votes_organization" ON "union_representation_votes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_union_votes_campaign" ON "union_representation_votes" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_union_votes_filing" ON "union_representation_votes" USING btree ("filing_id");--> statement-breakpoint
CREATE INDEX "idx_union_votes_date" ON "union_representation_votes" USING btree ("vote_date");--> statement-breakpoint
CREATE INDEX "idx_union_votes_result" ON "union_representation_votes" USING btree ("result");--> statement-breakpoint
CREATE INDEX "idx_access_log_user" ON "cross_org_access_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_user_org" ON "cross_org_access_log" USING btree ("user_organization_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_resource" ON "cross_org_access_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_owner" ON "cross_org_access_log" USING btree ("resource_organization_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_date" ON "cross_org_access_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sharing_grants_grantor" ON "organization_sharing_grants" USING btree ("grantor_org_id");--> statement-breakpoint
CREATE INDEX "idx_sharing_grants_grantee" ON "organization_sharing_grants" USING btree ("grantee_org_id");--> statement-breakpoint
CREATE INDEX "idx_sharing_grants_resource" ON "organization_sharing_grants" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "idx_sharing_grants_expires" ON "organization_sharing_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_sharing_settings_org" ON "organization_sharing_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_cms_media_organization" ON "cms_media_library" USING btree ("organization_id","file_type");--> statement-breakpoint
CREATE INDEX "idx_cms_media_tags" ON "cms_media_library" USING btree ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_navigation_organization_location_unique" ON "cms_navigation_menus" USING btree ("organization_id","location");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_pages_organization_slug_unique" ON "cms_pages" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_cms_pages_organization_status" ON "cms_pages" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_cms_pages_slug" ON "cms_pages" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_cms_pages_published" ON "cms_pages" USING btree ("organization_id","published_at");--> statement-breakpoint
CREATE INDEX "idx_cms_templates_organization" ON "cms_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donation_campaigns_organization_slug_unique" ON "donation_campaigns" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_donation_campaigns_slug" ON "donation_campaigns" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_donation_campaigns_status" ON "donation_campaigns" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "donation_receipts_organization_number_unique" ON "donation_receipts" USING btree ("organization_id","receipt_number");--> statement-breakpoint
CREATE INDEX "idx_donations_organization" ON "donations" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_donations_campaign" ON "donations" USING btree ("campaign_id","payment_status");--> statement-breakpoint
CREATE INDEX "idx_donations_email" ON "donations" USING btree ("donor_email");--> statement-breakpoint
CREATE INDEX "idx_event_registrations_event" ON "event_registrations" USING btree ("event_id","registration_status");--> statement-breakpoint
CREATE INDEX "idx_event_registrations_email" ON "event_registrations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_job_applications_job" ON "job_applications" USING btree ("job_posting_id","application_status");--> statement-breakpoint
CREATE INDEX "idx_job_applications_email" ON "job_applications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "job_postings_organization_slug_unique" ON "job_postings" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_jobs_organization" ON "job_postings" USING btree ("organization_id","status","posted_date");--> statement-breakpoint
CREATE INDEX "idx_jobs_slug" ON "job_postings" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_jobs_category" ON "job_postings" USING btree ("category","status");--> statement-breakpoint
CREATE INDEX "idx_jobs_location" ON "job_postings" USING btree ("city","province","status");--> statement-breakpoint
CREATE INDEX "idx_jobs_featured" ON "job_postings" USING btree ("featured","status","posted_date");--> statement-breakpoint
CREATE UNIQUE INDEX "job_saved_profile_job_unique" ON "job_saved" USING btree ("profile_id","job_posting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_analytics_organization_page_date_unique" ON "page_analytics" USING btree ("organization_id","page_id","metric_date");--> statement-breakpoint
CREATE UNIQUE INDEX "public_events_organization_slug_unique" ON "public_events" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_events_organization" ON "public_events" USING btree ("organization_id","start_date");--> statement-breakpoint
CREATE INDEX "idx_events_slug" ON "public_events" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "public_events" USING btree ("organization_id","registration_status");--> statement-breakpoint
CREATE INDEX "idx_events_dates" ON "public_events" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "bank_accounts_organization_idx" ON "bank_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bank_recon_organization_idx" ON "bank_reconciliations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bank_recon_account_idx" ON "bank_reconciliations" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_recon_date_idx" ON "bank_reconciliations" USING btree ("statement_date");--> statement-breakpoint
CREATE INDEX "bank_txns_account_idx" ON "bank_transactions" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_txns_date_idx" ON "bank_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "bank_txns_reconciled_idx" ON "bank_transactions" USING btree ("is_reconciled");--> statement-breakpoint
CREATE INDEX "fx_rates_organization_idx" ON "currency_exchange_rates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "fx_rates_currency_idx" ON "currency_exchange_rates" USING btree ("base_currency","target_currency");--> statement-breakpoint
CREATE INDEX "fx_rates_date_idx" ON "currency_exchange_rates" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "erp_connectors_organization_idx" ON "erp_connectors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "erp_connectors_system_type_idx" ON "erp_connectors" USING btree ("system_type");--> statement-breakpoint
CREATE INDEX "invoices_organization_idx" ON "erp_invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invoices_number_idx" ON "erp_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "erp_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "erp_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "audit_organization_idx" ON "financial_audit_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "financial_audit_log" USING btree ("entity_type","org_id");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "financial_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_timestamp_idx" ON "financial_audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "je_organization_idx" ON "journal_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "je_entry_number_idx" ON "journal_entries" USING btree ("entry_number");--> statement-breakpoint
CREATE INDEX "je_entry_date_idx" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "je_external_id_idx" ON "journal_entries" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "jel_entry_idx" ON "journal_entry_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "jel_account_idx" ON "journal_entry_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "jel_member_idx" ON "journal_entry_lines" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_organization_idx" ON "sync_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_connector_idx" ON "sync_jobs" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_jobs_started_at_idx" ON "sync_jobs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "clc_api_config_org_idx" ON "clc_api_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clc_remittance_mapping_org_idx" ON "clc_remittance_mapping" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clc_remittance_mapping_external_idx" ON "clc_remittance_mapping" USING btree ("external_remittance_id");--> statement-breakpoint
CREATE INDEX "idx_clc_accounts_code" ON "clc_chart_of_accounts" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "idx_clc_accounts_parent" ON "clc_chart_of_accounts" USING btree ("parent_account_code");--> statement-breakpoint
CREATE INDEX "idx_clc_accounts_type" ON "clc_chart_of_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "idx_notification_log_remittance" ON "notification_log" USING btree ("remittance_id");--> statement-breakpoint
CREATE INDEX "idx_notification_log_org" ON "notification_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_notification_log_sent_at" ON "notification_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_contacts_org" ON "organization_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_email" ON "organization_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_contacts_user" ON "organization_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_remittances_due_date" ON "per_capita_remittances" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_remittances_org" ON "per_capita_remittances" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_remittances_from_org" ON "per_capita_remittances" USING btree ("from_organization_id");--> statement-breakpoint
CREATE INDEX "idx_remittances_to_org" ON "per_capita_remittances" USING btree ("to_organization_id");--> statement-breakpoint
CREATE INDEX "idx_approvals_remittance" ON "remittance_approvals" USING btree ("remittance_id");--> statement-breakpoint
CREATE INDEX "idx_approvals_approver" ON "remittance_approvals" USING btree ("approver_user_id");--> statement-breakpoint
CREATE INDEX "idx_approvals_status" ON "remittance_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_org_sync_log_org" ON "clc_organization_sync_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_sync_log_affiliate" ON "clc_organization_sync_log" USING btree ("affiliate_code");--> statement-breakpoint
CREATE INDEX "idx_org_sync_log_date" ON "clc_organization_sync_log" USING btree ("synced_at");--> statement-breakpoint
CREATE INDEX "idx_org_sync_log_action" ON "clc_organization_sync_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "address_change_history_address_id_idx" ON "address_change_history" USING btree ("address_id");--> statement-breakpoint
CREATE INDEX "address_change_history_created_at_idx" ON "address_change_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "address_validation_cache_input_hash_idx" ON "address_validation_cache" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "address_validation_cache_expires_at_idx" ON "address_validation_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "country_address_formats_country_code_idx" ON "country_address_formats" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "international_addresses_organization_id_idx" ON "international_addresses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "international_addresses_user_id_idx" ON "international_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "international_addresses_country_code_idx" ON "international_addresses" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "international_addresses_status_idx" ON "international_addresses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "international_addresses_is_primary_idx" ON "international_addresses" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "international_addresses_postal_code_idx" ON "international_addresses" USING btree ("postal_code");--> statement-breakpoint
CREATE INDEX "idx_social_accounts_organization" ON "social_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_social_accounts_platform" ON "social_accounts" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_social_accounts_status" ON "social_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_social_accounts_primary" ON "social_accounts" USING btree ("organization_id","platform","is_primary");--> statement-breakpoint
CREATE INDEX "idx_social_analytics_organization" ON "social_analytics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_social_analytics_account" ON "social_analytics" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_social_analytics_date" ON "social_analytics" USING btree ("analytics_date");--> statement-breakpoint
CREATE INDEX "idx_social_analytics_account_date" ON "social_analytics" USING btree ("account_id","analytics_date");--> statement-breakpoint
CREATE INDEX "idx_social_campaigns_organization" ON "social_campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_social_campaigns_status" ON "social_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_social_campaigns_dates" ON "social_campaigns" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_social_engagement_organization" ON "social_engagement" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_social_engagement_post" ON "social_engagement" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_social_engagement_type" ON "social_engagement" USING btree ("engagement_type");--> statement-breakpoint
CREATE INDEX "idx_social_engagement_engaged_at" ON "social_engagement" USING btree ("engaged_at");--> statement-breakpoint
CREATE INDEX "idx_social_engagement_sentiment" ON "social_engagement" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "idx_social_feeds_organization" ON "social_feeds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_social_feeds_account" ON "social_feeds" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_social_feeds_published" ON "social_feeds" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_social_posts_organization" ON "social_posts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_social_posts_account" ON "social_posts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_social_posts_campaign" ON "social_posts" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_social_posts_status" ON "social_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_social_posts_scheduled" ON "social_posts" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_social_posts_published" ON "social_posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "accessibility_audits_organization_id_idx" ON "accessibility_audits" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "accessibility_audits_status_idx" ON "accessibility_audits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accessibility_audits_created_at_idx" ON "accessibility_audits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "accessibility_issues_audit_id_idx" ON "accessibility_issues" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "accessibility_issues_organization_id_idx" ON "accessibility_issues" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "accessibility_issues_status_idx" ON "accessibility_issues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accessibility_issues_severity_idx" ON "accessibility_issues" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "accessibility_issues_wcag_criteria_idx" ON "accessibility_issues" USING btree ("wcag_criteria");--> statement-breakpoint
CREATE INDEX "accessibility_test_suites_organization_id_idx" ON "accessibility_test_suites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "accessibility_test_suites_is_active_idx" ON "accessibility_test_suites" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "accessibility_user_testing_organization_id_idx" ON "accessibility_user_testing" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "accessibility_user_testing_session_date_idx" ON "accessibility_user_testing" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX "wcag_criteria_number_idx" ON "wcag_success_criteria" USING btree ("criteria_number");--> statement-breakpoint
CREATE INDEX "wcag_criteria_level_idx" ON "wcag_success_criteria" USING btree ("level");--> statement-breakpoint
CREATE INDEX "wcag_criteria_principle_idx" ON "wcag_success_criteria" USING btree ("principle");--> statement-breakpoint
CREATE INDEX "idx_kb_articles_slug" ON "knowledge_base_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_kb_articles_category" ON "knowledge_base_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_kb_articles_status" ON "knowledge_base_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kb_articles_published" ON "knowledge_base_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_sla_policies_name" ON "sla_policies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_sla_policies_priority" ON "sla_policies" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_sla_policies_active" ON "sla_policies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_number" ON "support_tickets" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_org" ON "support_tickets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_status" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_priority" ON "support_tickets" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_assigned" ON "support_tickets" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_category" ON "support_tickets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_created" ON "support_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_sla_response" ON "support_tickets" USING btree ("sla_response_by");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_sla_resolve" ON "support_tickets" USING btree ("sla_resolve_by");--> statement-breakpoint
CREATE INDEX "idx_ticket_comments_ticket" ON "ticket_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_comments_created" ON "ticket_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ticket_history_ticket" ON "ticket_history" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_history_created" ON "ticket_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ticket_history_action" ON "ticket_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "integration_api_keys_org_idx" ON "integration_api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_api_keys_hash_idx" ON "integration_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "integration_api_keys_active_idx" ON "integration_api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "integration_webhooks_org_idx" ON "integration_webhooks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_webhooks_active_idx" ON "integration_webhooks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_delivered_at_idx" ON "webhook_deliveries" USING btree ("delivered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pilot_checklist_org_item" ON "pilot_checklist_items" USING btree ("organization_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_pilot_checklist_org" ON "pilot_checklist_items" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pilot_demo_seeds_org" ON "pilot_demo_seeds" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pilot_enrollments_org" ON "pilot_enrollments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_pilot_milestones_org" ON "pilot_milestones" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_federation_campaigns_federation_id" ON "federation_campaigns" USING btree ("federation_id");--> statement-breakpoint
CREATE INDEX "idx_federation_campaigns_slug" ON "federation_campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_federation_campaigns_type" ON "federation_campaigns" USING btree ("campaign_type");--> statement-breakpoint
CREATE INDEX "idx_federation_campaigns_status" ON "federation_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_federation_campaigns_start_date" ON "federation_campaigns" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_federation_campaigns_lead_organizer_id" ON "federation_campaigns" USING btree ("lead_organizer_id");--> statement-breakpoint
CREATE INDEX "idx_federation_campaigns_coordinating_union_id" ON "federation_campaigns" USING btree ("coordinating_union_id");--> statement-breakpoint
CREATE INDEX "idx_federation_communications_federation_id" ON "federation_communications" USING btree ("federation_id");--> statement-breakpoint
CREATE INDEX "idx_federation_communications_slug" ON "federation_communications" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_federation_communications_type" ON "federation_communications" USING btree ("communication_type");--> statement-breakpoint
CREATE INDEX "idx_federation_communications_status" ON "federation_communications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_federation_communications_published_at" ON "federation_communications" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_federation_communications_author_user_id" ON "federation_communications" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "idx_federation_communications_priority" ON "federation_communications" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_federation_executives_federation_id" ON "federation_executives" USING btree ("federation_id");--> statement-breakpoint
CREATE INDEX "idx_federation_executives_profile_user_id" ON "federation_executives" USING btree ("profile_user_id");--> statement-breakpoint
CREATE INDEX "idx_federation_executives_union_organization_id" ON "federation_executives" USING btree ("union_organization_id");--> statement-breakpoint
CREATE INDEX "idx_federation_executives_position" ON "federation_executives" USING btree ("position");--> statement-breakpoint
CREATE INDEX "idx_federation_executives_current_term" ON "federation_executives" USING btree ("current_term");--> statement-breakpoint
CREATE INDEX "idx_federation_executives_status" ON "federation_executives" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_federation_meetings_federation_id" ON "federation_meetings" USING btree ("federation_id");--> statement-breakpoint
CREATE INDEX "idx_federation_meetings_start_date" ON "federation_meetings" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_federation_meetings_type" ON "federation_meetings" USING btree ("meeting_type");--> statement-breakpoint
CREATE INDEX "idx_federation_meetings_status" ON "federation_meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_federation_meetings_organizer_user_id" ON "federation_meetings" USING btree ("organizer_user_id");--> statement-breakpoint
CREATE INDEX "idx_federation_memberships_federation_id" ON "federation_memberships" USING btree ("federation_id");--> statement-breakpoint
CREATE INDEX "idx_federation_memberships_union_organization_id" ON "federation_memberships" USING btree ("union_organization_id");--> statement-breakpoint
CREATE INDEX "idx_federation_memberships_status" ON "federation_memberships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_federation_memberships_joined_date" ON "federation_memberships" USING btree ("joined_date");--> statement-breakpoint
CREATE INDEX "idx_federation_memberships_primary_contact_user_id" ON "federation_memberships" USING btree ("primary_contact_user_id");--> statement-breakpoint
CREATE INDEX "idx_federation_remittances_federation_id" ON "federation_remittances" USING btree ("federation_id");--> statement-breakpoint
CREATE INDEX "idx_federation_remittances_from_organization_id" ON "federation_remittances" USING btree ("from_organization_id");--> statement-breakpoint
CREATE INDEX "idx_federation_remittances_to_organization_id" ON "federation_remittances" USING btree ("to_organization_id");--> statement-breakpoint
CREATE INDEX "idx_federation_remittances_due_date" ON "federation_remittances" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_federation_remittances_status" ON "federation_remittances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_federation_remittances_period" ON "federation_remittances" USING btree ("remittance_year","remittance_month");--> statement-breakpoint
CREATE INDEX "idx_federation_remittances_per_capita_remittance_id" ON "federation_remittances" USING btree ("per_capita_remittance_id");--> statement-breakpoint
CREATE INDEX "idx_federation_resources_federation_id" ON "federation_resources" USING btree ("federation_id");--> statement-breakpoint
CREATE INDEX "idx_federation_resources_slug" ON "federation_resources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_federation_resources_type" ON "federation_resources" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "idx_federation_resources_category" ON "federation_resources" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_federation_resources_status" ON "federation_resources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_federation_resources_published_at" ON "federation_resources" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_federation_resources_author_user_id" ON "federation_resources" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "idx_federation_resources_access_level" ON "federation_resources" USING btree ("access_level");--> statement-breakpoint
CREATE INDEX "idx_federations_organization_id" ON "federations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_federations_slug" ON "federations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_federations_province" ON "federations" USING btree ("province");--> statement-breakpoint
CREATE INDEX "idx_federations_type" ON "federations" USING btree ("federation_type");--> statement-breakpoint
CREATE INDEX "idx_federations_status" ON "federations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_federations_clc_affiliate_code" ON "federations" USING btree ("clc_affiliate_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_configurations_org_cat_key" ON "org_configurations" USING btree ("organization_id","category","key");--> statement-breakpoint
CREATE INDEX "idx_org_configurations_org" ON "org_configurations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_usage_org_period" ON "org_usage" USING btree ("organization_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_org_usage_org" ON "org_usage" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organization_members_org_id" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organization_members_user_id" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_org_membership" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_org_relationships_parent" ON "organization_relationships" USING btree ("parent_org_id");--> statement-breakpoint
CREATE INDEX "idx_org_relationships_child" ON "organization_relationships" USING btree ("child_org_id");--> statement-breakpoint
CREATE INDEX "idx_org_relationships_type" ON "organization_relationships" USING btree ("relationship_type");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_org_relationship" ON "organization_relationships" USING btree ("parent_org_id","child_org_id","relationship_type","effective_date");--> statement-breakpoint
CREATE INDEX "idx_organizations_parent" ON "organizations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_type" ON "organizations" USING btree ("organization_type");--> statement-breakpoint
CREATE INDEX "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_organizations_hierarchy_level" ON "organizations" USING btree ("hierarchy_level");--> statement-breakpoint
CREATE INDEX "idx_organizations_status" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_organizations_clc_affiliated" ON "organizations" USING btree ("clc_affiliated");--> statement-breakpoint
CREATE INDEX "idx_organizations_legacy_tenant" ON "organizations" USING btree ("legacy_tenant_id");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_organization" ON "bargaining_units" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_employer" ON "bargaining_units" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_worksite" ON "bargaining_units" USING btree ("worksite_id");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_status" ON "bargaining_units" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_unit_number" ON "bargaining_units" USING btree ("unit_number");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_contract_expiry" ON "bargaining_units" USING btree ("contract_expiry_date");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_committee" ON "committee_memberships" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_member" ON "committee_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_status" ON "committee_memberships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_role" ON "committee_memberships" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_tenure" ON "committee_memberships" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_committee_memberships_unique" ON "committee_memberships" USING btree ("committee_id","member_id","start_date");--> statement-breakpoint
CREATE INDEX "idx_committees_organization" ON "committees" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_committees_type" ON "committees" USING btree ("committee_type");--> statement-breakpoint
CREATE INDEX "idx_committees_status" ON "committees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_committees_unit" ON "committees" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_committees_worksite" ON "committees" USING btree ("worksite_id");--> statement-breakpoint
CREATE INDEX "idx_committees_chair" ON "committees" USING btree ("chair_id");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_organization" ON "role_tenure_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_member" ON "role_tenure_history" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_role_type" ON "role_tenure_history" USING btree ("role_type");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_current" ON "role_tenure_history" USING btree ("is_current_role");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_dates" ON "role_tenure_history" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_entity" ON "role_tenure_history" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "idx_worksites_organization" ON "worksites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_worksites_employer" ON "worksites" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_worksites_status" ON "worksites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_worksites_code" ON "worksites" USING btree ("code");