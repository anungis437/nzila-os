import { pgTable, foreignKey, uuid, boolean, text, numeric, varchar, jsonb, timestamp, integer, index, unique, inet, bigint, date, uniqueIndex, time, point, pgEnum, customType } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

// Define custom type for PostgreSQL tsvector
const tsvector = customType<{ data: string }>({ dataType() { return 'tsvector'; } });

export const alertSeverity = pgEnum("alert_severity", ['info', 'warning', 'urgent', 'critical'])
export const assignmentRole = pgEnum("assignment_role", ['primary_officer', 'secondary_officer', 'legal_counsel', 'external_arbitrator', 'management_rep', 'witness', 'observer'])
export const assignmentStatus = pgEnum("assignment_status", ['assigned', 'accepted', 'in_progress', 'completed', 'reassigned', 'declined'])
export const attendeeStatus = pgEnum("attendee_status", ['invited', 'accepted', 'declined', 'tentative', 'no_response'])
export const billStatus = pgEnum("bill_status", ['introduced', 'first_reading', 'second_reading', 'committee_review', 'third_reading', 'passed_house', 'senate_review', 'royal_assent', 'enacted', 'defeated', 'withdrawn'])
export const caJurisdiction = pgEnum("ca_jurisdiction", ['CA-FED', 'CA-ON', 'CA-QC', 'CA-BC', 'CA-AB', 'CA-SK', 'CA-MB', 'CA-NB', 'CA-NS', 'CA-PE', 'CA-NL', 'CA-YT', 'CA-NT', 'CA-NU', 'federal', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])
export const calendarPermission = pgEnum("calendar_permission", ['owner', 'editor', 'viewer', 'none'])
export const cbaJurisdiction = pgEnum("cba_jurisdiction", ['federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba', 'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei', 'newfoundland', 'northwest_territories', 'yukon', 'nunavut'])
export const cbaLanguage = pgEnum("cba_language", ['en', 'fr', 'bilingual'])
export const cbaStatus = pgEnum("cba_status", ['active', 'expired', 'under_negotiation', 'ratified_pending', 'archived'])
export const certificationApplicationStatus = pgEnum("certification_application_status", ['draft', 'filed', 'under_review', 'hearing_scheduled', 'vote_ordered', 'vote_completed', 'decision_pending', 'certified', 'dismissed', 'withdrawn'])
export const certificationMethod = pgEnum("certification_method", ['automatic', 'vote_required', 'mandatory_vote'])
export const certificationStatus = pgEnum("certification_status", ['active', 'expiring_soon', 'expired', 'revoked', 'suspended'])
export const claimPriority = pgEnum("claim_priority", ['low', 'medium', 'high', 'critical'])
export const claimStatus = pgEnum("claim_status", ['submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation', 'resolved', 'rejected', 'closed'])
export const claimType = pgEnum("claim_type", ['grievance_discipline', 'grievance_schedule', 'grievance_pay', 'workplace_safety', 'discrimination_age', 'discrimination_gender', 'discrimination_race', 'discrimination_disability', 'discrimination_other', 'harassment_sexual', 'harassment_workplace', 'wage_dispute', 'contract_dispute', 'retaliation', 'wrongful_termination', 'other', 'harassment_verbal', 'harassment_physical'])
export const clauseType = pgEnum("clause_type", ['wages_compensation', 'benefits_insurance', 'working_conditions', 'grievance_arbitration', 'seniority_promotion', 'health_safety', 'union_rights', 'management_rights', 'duration_renewal', 'vacation_leave', 'hours_scheduling', 'disciplinary_procedures', 'training_development', 'pension_retirement', 'overtime', 'job_security', 'technological_change', 'workplace_rights', 'other'])
export const communicationChannel = pgEnum("communication_channel", ['email', 'sms', 'push', 'newsletter', 'in_app'])
export const contactSupportLevel = pgEnum("contact_support_level", ['strong_supporter', 'supporter', 'undecided', 'soft_opposition', 'strong_opposition', 'unknown'])
export const courseCategory = pgEnum("course_category", ['steward_training', 'leadership_development', 'health_and_safety', 'collective_bargaining', 'grievance_handling', 'labor_law', 'political_action', 'organizing', 'equity_and_inclusion', 'financial_literacy', 'workplace_rights', 'public_speaking', 'conflict_resolution', 'meeting_facilitation', 'member_engagement', 'general'])
export const courseDeliveryMethod = pgEnum("course_delivery_method", ['in_person', 'virtual_live', 'self_paced_online', 'hybrid', 'webinar', 'workshop', 'conference_session'])
export const courseDifficulty = pgEnum("course_difficulty", ['beginner', 'intermediate', 'advanced', 'all_levels'])
export const deadlinePriority = pgEnum("deadline_priority", ['low', 'medium', 'high', 'critical'])
export const deadlineStatus = pgEnum("deadline_status", ['pending', 'completed', 'missed', 'extended', 'waived'])
export const decisionType = pgEnum("decision_type", ['grievance', 'unfair_practice', 'certification', 'judicial_review', 'interpretation', 'scope_bargaining', 'other'])
export const deliveryMethod = pgEnum("delivery_method", ['email', 'sms', 'push', 'in_app'])
export const deliveryStatus = pgEnum("delivery_status", ['pending', 'sent', 'delivered', 'failed', 'bounced'])
export const digestFrequency = pgEnum("digest_frequency", ['immediate', 'daily', 'weekly', 'never'])
export const documentVersionStatus = pgEnum("document_version_status", ['draft', 'pending_review', 'approved', 'rejected', 'superseded'])
export const entityType = pgEnum("entity_type", ['monetary_amount', 'percentage', 'date', 'time_period', 'job_position', 'location', 'person', 'organization', 'legal_reference', 'other'])
export const equityGroupType = pgEnum("equity_group_type", ['women', 'visible_minority', 'indigenous', 'persons_with_disabilities', 'lgbtq2plus', 'newcomer', 'youth', 'prefer_not_to_say'])
export const essentialServiceDesignation = pgEnum("essential_service_designation", ['prohibited', 'restricted', 'minimum_service'])
export const eventStatus = pgEnum("event_status", ['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled'])
export const eventType = pgEnum("event_type", ['meeting', 'appointment', 'deadline', 'reminder', 'task', 'hearing', 'mediation', 'negotiation', 'training', 'other'])
export const extensionStatus = pgEnum("extension_status", ['pending', 'approved', 'denied', 'cancelled'])
export const genderIdentityType = pgEnum("gender_identity_type", ['man', 'woman', 'non_binary', 'two_spirit', 'gender_fluid', 'agender', 'other', 'prefer_not_to_say'])
export const governmentLevel = pgEnum("government_level", ['federal', 'provincial_territorial', 'municipal', 'school_board', 'regional'])
export const grievanceStageType = pgEnum("grievance_stage_type", ['filed', 'intake', 'investigation', 'step_1', 'step_2', 'step_3', 'mediation', 'pre_arbitration', 'arbitration', 'resolved', 'withdrawn', 'denied', 'settled'])
export const grievanceStepType = pgEnum("grievance_step_type", ['informal', 'formal_written', 'mediation', 'arbitration'])
export const grievanceWorkflowStatus = pgEnum("grievance_workflow_status", ['active', 'draft', 'archived'])
export const hwClaimStatus = pgEnum("hw_claim_status", ['submitted', 'received', 'pending_review', 'under_investigation', 'approved', 'partially_approved', 'denied', 'paid', 'appealed', 'appeal_denied', 'appeal_approved'])
export const hwPlanType = pgEnum("hw_plan_type", ['health_medical', 'dental', 'vision', 'prescription', 'disability_short_term', 'disability_long_term', 'life_insurance', 'accidental_death', 'critical_illness', 'employee_assistance'])
export const indigenousIdentityType = pgEnum("indigenous_identity_type", ['first_nations_status', 'first_nations_non_status', 'inuit', 'metis', 'multiple_indigenous_identities', 'prefer_not_to_say'])
export const jurisdictionRuleType = pgEnum("jurisdiction_rule_type", ['certification', 'strike_vote', 'grievance_arbitration', 'essential_services', 'replacement_workers', 'collective_agreement', 'unfair_labour_practice', 'bargaining_rights', 'union_security', 'dues_checkoff'])
export const labourSector = pgEnum("labour_sector", ['healthcare', 'education', 'public_service', 'trades', 'manufacturing', 'transportation', 'retail', 'hospitality', 'technology', 'construction', 'utilities', 'telecommunications', 'financial_services', 'agriculture', 'arts_culture', 'other'])
export const memberRole = pgEnum("member_role", ['member', 'steward', 'officer', 'admin'])
export const memberStatus = pgEnum("member_status", ['active', 'inactive', 'on-leave'])
export const membership = pgEnum("membership", ['free', 'pro'])
export const messageStatus = pgEnum("message_status", ['sent', 'delivered', 'read'])
export const messageType = pgEnum("message_type", ['text', 'file', 'system'])
export const newsletterBounceType = pgEnum("newsletter_bounce_type", ['hard', 'soft', 'technical'])
export const newsletterCampaignStatus = pgEnum("newsletter_campaign_status", ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'])
export const newsletterEngagementEvent = pgEnum("newsletter_engagement_event", ['open', 'click', 'unsubscribe', 'spam_report'])
export const newsletterListType = pgEnum("newsletter_list_type", ['manual', 'dynamic', 'segment'])
export const newsletterRecipientStatus = pgEnum("newsletter_recipient_status", ['pending', 'sent', 'delivered', 'bounced', 'failed'])
export const newsletterSubscriberStatus = pgEnum("newsletter_subscriber_status", ['subscribed', 'unsubscribed', 'bounced'])
export const notificationChannel = pgEnum("notification_channel", ['email', 'sms', 'push', 'in_app', 'in-app', 'multi'])
export const notificationScheduleStatus = pgEnum("notification_schedule_status", ['scheduled', 'sent', 'cancelled', 'failed'])
export const notificationStatus = pgEnum("notification_status", ['pending', 'sent', 'failed', 'partial'])
export const notificationType = pgEnum("notification_type", ['payment_confirmation', 'payment_failed', 'payment_reminder', 'donation_received', 'stipend_approved', 'stipend_disbursed', 'low_balance_alert', 'arrears_warning', 'strike_announcement', 'picket_reminder'])
export const organizationRelationshipType = pgEnum("organization_relationship_type", ['affiliate', 'federation', 'local', 'chapter', 'region', 'district', 'joint_council', 'merged_from', 'split_from'])
export const organizationStatus = pgEnum("organization_status", ['active', 'inactive', 'suspended', 'archived'])
export const organizationType = pgEnum("organization_type", ['congress', 'federation', 'union', 'local', 'region', 'district'])
export const organizingActivityType = pgEnum("organizing_activity_type", ['house_visit', 'phone_call', 'text_message', 'workplace_conversation', 'organizing_meeting', 'blitz', 'workplace_action', 'card_signing_session', 'community_event', 'rally', 'picket', 'press_conference', 'social_media_campaign'])
export const organizingCampaignStatus = pgEnum("organizing_campaign_status", ['research', 'pre_campaign', 'active', 'card_check', 'certification_pending', 'certification_vote', 'won', 'lost', 'suspended', 'abandoned'])
export const organizingCampaignType = pgEnum("organizing_campaign_type", ['new_workplace', 'raid', 'expansion', 'decertification_defense', 'voluntary_recognition', 'card_check_majority'])
export const outcome = pgEnum("outcome", ['grievance_upheld', 'grievance_denied', 'partial_success', 'dismissed', 'withdrawn', 'settled'])
export const payEquityStatus = pgEnum("pay_equity_status", ['intake', 'under_review', 'investigation', 'mediation', 'arbitration', 'resolved', 'dismissed', 'withdrawn', 'appealed'])
export const paymentProvider = pgEnum("payment_provider", ['stripe', 'whop'])
export const pensionClaimType = pgEnum("pension_claim_type", ['retirement_pension', 'early_retirement', 'disability_pension', 'survivor_benefit', 'death_benefit', 'lump_sum_withdrawal', 'pension_transfer'])
export const pensionPlanStatus = pgEnum("pension_plan_status", ['active', 'frozen', 'closed', 'under_review'])
export const pensionPlanType = pgEnum("pension_plan_type", ['defined_benefit', 'defined_contribution', 'hybrid', 'target_benefit', 'multi_employer'])
export const politicalActivityType = pgEnum("political_activity_type", ['meeting_with_mp', 'meeting_with_staff', 'phone_call', 'letter_writing', 'email_campaign', 'petition_drive', 'lobby_day', 'town_hall', 'press_conference', 'rally', 'canvassing', 'phone_banking', 'door_knocking', 'social_media_campaign', 'committee_presentation', 'delegation'])
export const politicalCampaignStatus = pgEnum("political_campaign_status", ['planning', 'active', 'paused', 'completed', 'cancelled'])
export const politicalCampaignType = pgEnum("political_campaign_type", ['electoral', 'legislative', 'issue_advocacy', 'ballot_initiative', 'get_out_the_vote', 'voter_registration', 'political_education', 'coalition_building'])
export const politicalParty = pgEnum("political_party", ['liberal', 'conservative', 'ndp', 'green', 'bloc_quebecois', 'peoples_party', 'independent', 'other'])
export const precedentValue = pgEnum("precedent_value", ['high', 'medium', 'low'])
export const pushDeliveryStatus = pgEnum("push_delivery_status", ['pending', 'sent', 'delivered', 'failed', 'clicked', 'dismissed'])
export const pushNotificationStatus = pgEnum("push_notification_status", ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'])
export const pushPlatform = pgEnum("push_platform", ['ios', 'android', 'web'])
export const pushPriority = pgEnum("push_priority", ['low', 'normal', 'high', 'urgent'])
export const registrationStatus = pgEnum("registration_status", ['registered', 'waitlisted', 'confirmed', 'attended', 'completed', 'incomplete', 'no_show', 'cancelled', 'withdrawn'])
export const reportCategory = pgEnum("report_category", ['claims', 'members', 'financial', 'compliance', 'performance', 'custom'])
export const reportFormat = pgEnum("report_format", ['pdf', 'excel', 'csv', 'json', 'html'])
export const reportType = pgEnum("report_type", ['custom', 'template', 'system', 'scheduled'])
export const role = pgEnum("role", ['super_admin', 'org_admin', 'manager', 'member', 'free_user'])
export const roomStatus = pgEnum("room_status", ['available', 'booked', 'maintenance', 'unavailable'])
export const scheduleFrequency = pgEnum("schedule_frequency", ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
export const sessionStatus = pgEnum("session_status", ['scheduled', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled'])
export const settlementStatus = pgEnum("settlement_status", ['proposed', 'under_review', 'accepted', 'rejected', 'finalized'])
export const signatureStatus = pgEnum("signature_status", ['pending', 'signed', 'rejected', 'expired', 'revoked'])
export const signatureType = pgEnum("signature_type", ['financial_attestation', 'document_approval', 'meeting_minutes', 'contract_signing', 'policy_approval', 'election_certification', 'grievance_settlement', 'collective_agreement', 'pki_certificate', 'digital_signature'])
export const strikeVoteRequirement = pgEnum("strike_vote_requirement", ['simple_majority', 'secret_ballot', 'membership_quorum'])
export const syncStatus = pgEnum("sync_status", ['synced', 'pending', 'failed', 'disconnected'])
export const taxSlipType = pgEnum("tax_slip_type", ['t4a', 't4a_box_016', 't4a_box_018', 't4a_box_048', 'cope_receipt', 'rl_1', 'rl_24'])
export const templateCategory = pgEnum("template_category", ['general', 'announcement', 'event', 'update', 'custom'])
export const transitionTriggerType = pgEnum("transition_trigger_type", ['manual', 'automatic', 'deadline', 'approval', 'rejection'])
export const tribunalType = pgEnum("tribunal_type", ['fpslreb', 'provincial_labour_board', 'private_arbitrator', 'court_federal', 'court_provincial', 'other'])
export const unionPosition = pgEnum("union_position", ['strong_support', 'support', 'neutral', 'oppose', 'strong_oppose', 'monitoring'])



export const voterEligibility = pgTable("voter_eligibility", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	memberId: uuid("member_id").notNull(),
	isEligible: boolean("is_eligible").default(true),
	eligibilityReason: text("eligibility_reason"),
	votingWeight: numeric("voting_weight", { precision: 5, scale:  2 }).default('1.0'),
	canDelegate: boolean("can_delegate").default(false),
	delegatedTo: uuid("delegated_to"),
	restrictions: text("restrictions").array(),
	verificationStatus: varchar("verification_status", { length: 20 }).default('pending'),
	voterMetadata: jsonb("voter_metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		voterEligibilitySessionIdVotingSessionsIdFk: foreignKey({
			columns: [table.sessionId],
			foreignColumns: [votingSessions.id],
			name: "voter_eligibility_session_id_voting_sessions_id_fk"
		}).onDelete("cascade"),
	}
});

export const votingOptions = pgTable("voting_options", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	text: varchar("text", { length: 500 }).notNull(),
	description: text("description"),
	orderIndex: integer("order_index").default(0).notNull(),
	isDefault: boolean("is_default").default(false),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		votingOptionsSessionIdVotingSessionsIdFk: foreignKey({
			columns: [table.sessionId],
			foreignColumns: [votingSessions.id],
			name: "voting_options_session_id_voting_sessions_id_fk"
		}).onDelete("cascade"),
	}
});

export const votingNotifications = pgTable("voting_notifications", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	type: varchar("type", { length: 50 }).notNull(),
	title: varchar("title", { length: 200 }).notNull(),
	message: text("message").notNull(),
	recipientId: uuid("recipient_id").notNull(),
	priority: varchar("priority", { length: 20 }).default('medium'),
	deliveryMethod: text("delivery_method").array().default(["RAY['push'::tex"]),
	isRead: boolean("is_read").default(false),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxVotingNotificationsCreatedAt: index("idx_voting_notifications_created_at").using("btree", table.createdAt.asc().nullsLast()),
		idxVotingNotificationsUpdatedAt: index("idx_voting_notifications_updated_at").using("btree", table.updatedAt.asc().nullsLast()),
		votingNotificationsSessionIdVotingSessionsIdFk: foreignKey({
			columns: [table.sessionId],
			foreignColumns: [votingSessions.id],
			name: "voting_notifications_session_id_voting_sessions_id_fk"
		}).onDelete("cascade"),
	}
});

export const collectiveAgreements = pgTable("collective_agreements", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	cbaNumber: varchar("cba_number", { length: 100 }).notNull(),
	title: varchar("title", { length: 500 }).notNull(),
	jurisdiction: cbaJurisdiction("jurisdiction").notNull(),
	language: cbaLanguage("language").default('en').notNull(),
	employerName: varchar("employer_name", { length: 300 }).notNull(),
	employerId: varchar("employer_id", { length: 100 }),
	unionName: varchar("union_name", { length: 300 }).notNull(),
	unionLocal: varchar("union_local", { length: 100 }),
	unionId: varchar("union_id", { length: 100 }),
	effectiveDate: timestamp("effective_date", { withTimezone: true, mode: 'string' }).notNull(),
	expiryDate: timestamp("expiry_date", { withTimezone: true, mode: 'string' }).notNull(),
	signedDate: timestamp("signed_date", { withTimezone: true, mode: 'string' }),
	ratificationDate: timestamp("ratification_date", { withTimezone: true, mode: 'string' }),
	industrySector: varchar("industry_sector", { length: 200 }).notNull(),
	employeeCoverage: integer("employee_coverage"),
	bargainingUnitDescription: text("bargaining_unit_description"),
	documentUrl: text("document_url"),
	documentHash: varchar("document_hash", { length: 64 }),
	rawText: text("raw_text"),
	structuredData: jsonb("structured_data"),
	embedding: text("embedding"),
	summaryGenerated: text("summary_generated"),
	keyTerms: jsonb("key_terms"),
	status: cbaStatus("status").default('active').notNull(),
	isPublic: boolean("is_public").default(false),
	viewCount: integer("view_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	lastModifiedBy: uuid("last_modified_by"),
	version: integer("version").default(1).notNull(),
	supersededBy: uuid("superseded_by"),
	precedesId: uuid("precedes_id"),
},
(table) => {
	return {
		cbaEffectiveDateIdx: index("cba_effective_date_idx").using("btree", table.effectiveDate.asc().nullsLast()),
		cbaEmployerIdx: index("cba_employer_idx").using("btree", table.employerName.asc().nullsLast()),
		cbaExpiryIdx: index("cba_expiry_idx").using("btree", table.expiryDate.asc().nullsLast()),
		cbaJurisdictionIdx: index("cba_jurisdiction_idx").using("btree", table.jurisdiction.asc().nullsLast()),
		cbaSectorIdx: index("cba_sector_idx").using("btree", table.industrySector.asc().nullsLast()),
		cbaStatusIdx: index("cba_status_idx").using("btree", table.status.asc().nullsLast()),
		cbaTenantIdx: index("cba_tenant_idx").using("btree", table.tenantId.asc().nullsLast()),
		cbaUnionIdx: index("cba_union_idx").using("btree", table.unionName.asc().nullsLast()),
		collectiveAgreementsCbaNumberUnique: unique("collective_agreements_cba_number_unique").on(table.cbaNumber),
	}
});

export const cbaClauses = pgTable("cba_clauses", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	cbaId: uuid("cba_id").notNull(),
	clauseNumber: varchar("clause_number", { length: 50 }).notNull(),
	clauseType: clauseType("clause_type").notNull(),
	title: varchar("title", { length: 500 }).notNull(),
	content: text("content").notNull(),
	contentPlainText: text("content_plain_text"),
	pageNumber: integer("page_number"),
	articleNumber: varchar("article_number", { length: 50 }),
	sectionHierarchy: jsonb("section_hierarchy"),
	parentClauseId: uuid("parent_clause_id"),
	orderIndex: integer("order_index").default(0).notNull(),
	embedding: text("embedding"),
	confidenceScore: numeric("confidence_score", { precision: 5, scale:  4 }),
	orgs: jsonb("orgs"),
	keyTerms: jsonb("key_terms"),
	relatedClauseIds: jsonb("related_clause_ids"),
	interpretationNotes: text("interpretation_notes"),
	viewCount: integer("view_count").default(0),
	citationCount: integer("citation_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		cbaIdx: index("cba_clauses_cba_idx").using("btree", table.cbaId.asc().nullsLast()),
		confidenceIdx: index("cba_clauses_confidence_idx").using("btree", table.confidenceScore.asc().nullsLast()),
		numberIdx: index("cba_clauses_number_idx").using("btree", table.clauseNumber.asc().nullsLast()),
		parentIdx: index("cba_clauses_parent_idx").using("btree", table.parentClauseId.asc().nullsLast()),
		typeIdx: index("cba_clauses_type_idx").using("btree", table.clauseType.asc().nullsLast()),
		cbaClausesCbaIdCollectiveAgreementsIdFk: foreignKey({
			columns: [table.cbaId],
			foreignColumns: [collectiveAgreements.id],
			name: "cba_clauses_cba_id_collective_agreements_id_fk"
		}).onDelete("cascade"),
	}
});

export const cbaVersionHistory = pgTable("cba_version_history", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	cbaId: uuid("cba_id").notNull(),
	version: integer("version").notNull(),
	changeDescription: text("change_description").notNull(),
	changeType: varchar("change_type", { length: 50 }).notNull(),
	previousData: jsonb("previous_data"),
	newData: jsonb("new_data"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by").notNull(),
},
(table) => {
	return {
		cbaVersionCbaIdx: index("cba_version_cba_idx").using("btree", table.cbaId.asc().nullsLast()),
		cbaVersionNumberIdx: index("cba_version_number_idx").using("btree", table.version.asc().nullsLast()),
		cbaVersionHistoryCbaIdCollectiveAgreementsIdFk: foreignKey({
			columns: [table.cbaId],
			foreignColumns: [collectiveAgreements.id],
			name: "cba_version_history_cba_id_collective_agreements_id_fk"
		}).onDelete("cascade"),
	}
});

export const benefitComparisons = pgTable("benefit_comparisons", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	cbaId: uuid("cba_id").notNull(),
	clauseId: uuid("clause_id"),
	benefitType: varchar("benefit_type", { length: 100 }).notNull(),
	benefitName: varchar("benefit_name", { length: 200 }).notNull(),
	coverageDetails: jsonb("coverage_details"),
	monthlyPremium: numeric("monthly_premium", { precision: 10, scale:  2 }),
	annualCost: numeric("annual_cost", { precision: 12, scale:  2 }),
	industryBenchmark: varchar("industry_benchmark", { length: 50 }),
	effectiveDate: timestamp("effective_date", { withTimezone: true, mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		cbaIdx: index("benefit_comparisons_cba_idx").using("btree", table.cbaId.asc().nullsLast()),
		typeIdx: index("benefit_comparisons_type_idx").using("btree", table.benefitType.asc().nullsLast()),
		benefitComparisonsCbaIdCollectiveAgreementsIdFk: foreignKey({
			columns: [table.cbaId],
			foreignColumns: [collectiveAgreements.id],
			name: "benefit_comparisons_cba_id_collective_agreements_id_fk"
		}).onDelete("cascade"),
		benefitComparisonsClauseIdCbaClausesIdFk: foreignKey({
			columns: [table.clauseId],
			foreignColumns: [cbaClauses.id],
			name: "benefit_comparisons_clause_id_cba_clauses_id_fk"
		}).onDelete("set null"),
	}
});

export const clauseComparisons = pgTable("clause_comparisons", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	comparisonName: varchar("comparison_name", { length: 200 }).notNull(),
	clauseType: clauseType("clause_type").notNull(),
	tenantId: uuid("tenant_id").notNull(),
	clauseIds: jsonb("clause_ids").notNull(),
	analysisResults: jsonb("analysis_results"),
	industryAverage: jsonb("industry_average"),
	marketPosition: varchar("market_position", { length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by").notNull(),
},
(table) => {
	return {
		tenantIdx: index("clause_comparisons_tenant_idx").using("btree", table.tenantId.asc().nullsLast()),
		typeIdx: index("clause_comparisons_type_idx").using("btree", table.clauseType.asc().nullsLast()),
	}
});

export const arbitratorProfiles = pgTable("arbitrator_profiles", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: varchar("name", { length: 200 }).notNull(),
	totalDecisions: integer("total_decisions").default(0).notNull(),
	grievorSuccessRate: numeric("grievor_success_rate", { precision: 5, scale:  2 }),
	employerSuccessRate: numeric("employer_success_rate", { precision: 5, scale:  2 }),
	averageAwardAmount: numeric("average_award_amount", { precision: 12, scale:  2 }),
	medianAwardAmount: numeric("median_award_amount", { precision: 12, scale:  2 }),
	highestAwardAmount: numeric("highest_award_amount", { precision: 12, scale:  2 }),
	commonRemedies: jsonb("common_remedies"),
	specializations: jsonb("specializations"),
	primarySectors: jsonb("primary_sectors"),
	jurisdictions: jsonb("jurisdictions"),
	avgDecisionDays: integer("avg_decision_days"),
	medianDecisionDays: integer("median_decision_days"),
	decisionRangeMin: integer("decision_range_min"),
	decisionRangeMax: integer("decision_range_max"),
	decisionPatterns: jsonb("decision_patterns"),
	contactInfo: jsonb("contact_info"),
	biography: text("biography"),
	credentials: jsonb("credentials"),
	isActive: boolean("is_active").default(true),
	lastDecisionDate: timestamp("last_decision_date", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		activeIdx: index("arbitrator_profiles_active_idx").using("btree", table.isActive.asc().nullsLast()),
		nameIdx: index("arbitrator_profiles_name_idx").using("btree", table.name.asc().nullsLast()),
		arbitratorProfilesNameUnique: unique("arbitrator_profiles_name_unique").on(table.name),
	}
});

export const insightRecommendations = pgTable("insight_recommendations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	insightType: text("insight_type").notNull(),
	category: text("category").notNull(),
	priority: text("priority").notNull(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	dataSource: jsonb("data_source"),
	metrics: jsonb("metrics"),
	trend: text("trend"),
	impact: text("impact"),
	recommendations: jsonb("recommendations"),
	actionRequired: boolean("action_required").default(false),
	actionDeadline: timestamp("action_deadline", { mode: 'string' }),
	estimatedBenefit: text("estimated_benefit"),
	confidenceScore: numeric("confidence_score"),
	relatedEntities: jsonb("related_entities"),
	status: text("status").default('new'),
	acknowledgedBy: text("acknowledged_by"),
	acknowledgedAt: timestamp("acknowledged_at", { mode: 'string' }),
	dismissedBy: text("dismissed_by"),
	dismissedAt: timestamp("dismissed_at", { mode: 'string' }),
	dismissalReason: text("dismissal_reason"),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	notes: text("notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		categoryIdx: index("insight_recommendations_category_idx").using("btree", table.category.asc().nullsLast()),
		createdIdx: index("insight_recommendations_created_idx").using("btree", table.createdAt.asc().nullsLast()),
		orgIdx: index("insight_recommendations_org_idx").using("btree", table.organizationId.asc().nullsLast()),
		priorityIdx: index("insight_recommendations_priority_idx").using("btree", table.priority.asc().nullsLast()),
		statusIdx: index("insight_recommendations_status_idx").using("btree", table.status.asc().nullsLast()),
		insightRecommendationsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "insight_recommendations_organization_id_fkey"
		}).onDelete("cascade"),
	}
});

export const profiles = pgTable("profiles", {
	userId: text("user_id").primaryKey().notNull(),
	email: text("email"),
	membership: membership("membership").default('free').notNull(),
	paymentProvider: paymentProvider("payment_provider").default('whop'),
	stripeCustomerId: text("stripe_customer_id"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	whopUserId: text("whop_user_id"),
	whopMembershipId: text("whop_membership_id"),
	planDuration: text("plan_duration"),
	billingCycleStart: timestamp("billing_cycle_start", { mode: 'string' }),
	billingCycleEnd: timestamp("billing_cycle_end", { mode: 'string' }),
	nextCreditRenewal: timestamp("next_credit_renewal", { mode: 'string' }),
	usageCredits: integer("usage_credits").default(0),
	usedCredits: integer("used_credits").default(0),
	status: text("status").default('active'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	role: role("role").default('member'),
	isSystemAdmin: boolean("is_system_admin").default(false),
	organizationId: text("organization_id"),
	permissions: text("permissions").array(),
});

export const pendingProfiles = pgTable("pending_profiles", {
	id: text("id").primaryKey().notNull(),
	email: text("email").notNull(),
	token: text("token"),
	membership: membership("membership").default('pro').notNull(),
	paymentProvider: paymentProvider("payment_provider").default('whop'),
	whopUserId: text("whop_user_id"),
	whopMembershipId: text("whop_membership_id"),
	planDuration: text("plan_duration"),
	billingCycleStart: timestamp("billing_cycle_start", { mode: 'string' }),
	billingCycleEnd: timestamp("billing_cycle_end", { mode: 'string' }),
	nextCreditRenewal: timestamp("next_credit_renewal", { mode: 'string' }),
	usageCredits: integer("usage_credits").default(0),
	usedCredits: integer("used_credits").default(0),
	claimed: boolean("claimed").default(false),
	claimedByUserId: text("claimed_by_user_id"),
	claimedAt: timestamp("claimed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		pendingProfilesEmailUnique: unique("pending_profiles_email_unique").on(table.email),
	}
});

export const digitalSignatures = pgTable("digital_signatures", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	documentType: varchar("document_type", { length: 100 }).notNull(),
	documentId: uuid("document_id").notNull(),
	documentHash: varchar("document_hash", { length: 128 }).notNull(),
	documentUrl: text("document_url"),
	signatureType: signatureType("signature_type").notNull(),
	signatureStatus: signatureStatus("signature_status").default('pending'),
	signerUserId: uuid("signer_user_id").notNull(),
	signerName: varchar("signer_name", { length: 200 }).notNull(),
	signerTitle: varchar("signer_title", { length: 100 }),
	signerEmail: varchar("signer_email", { length: 255 }),
	certificateSubject: varchar("certificate_subject", { length: 500 }),
	certificateIssuer: varchar("certificate_issuer", { length: 500 }),
	certificateSerialNumber: varchar("certificate_serial_number", { length: 100 }),
	certificateThumbprint: varchar("certificate_thumbprint", { length: 128 }),
	certificateNotBefore: timestamp("certificate_not_before", { withTimezone: true, mode: 'string' }),
	certificateNotAfter: timestamp("certificate_not_after", { withTimezone: true, mode: 'string' }),
	signatureAlgorithm: varchar("signature_algorithm", { length: 50 }),
	signatureValue: text("signature_value"),
	publicKey: text("public_key"),
	timestampToken: text("timestamp_token"),
	timestampAuthority: varchar("timestamp_authority", { length: 200 }),
	timestampValue: timestamp("timestamp_value", { withTimezone: true, mode: 'string' }),
	isVerified: boolean("is_verified").default(false),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	verificationMethod: varchar("verification_method", { length: 100 }),
	signedAt: timestamp("signed_at", { withTimezone: true, mode: 'string' }),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	geolocation: jsonb("geolocation"),
	rejectionReason: text("rejection_reason"),
	rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revocationReason: text("revocation_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxDigitalSignaturesDocument: index("idx_digital_signatures_document").using("btree", table.documentType.asc().nullsLast(), table.documentId.asc().nullsLast()),
		idxDigitalSignaturesHash: index("idx_digital_signatures_hash").using("btree", table.documentHash.asc().nullsLast()),
		idxDigitalSignaturesOrg: index("idx_digital_signatures_org").using("btree", table.organizationId.asc().nullsLast()),
		idxDigitalSignaturesSignedAt: index("idx_digital_signatures_signed_at").using("btree", table.signedAt.asc().nullsLast()),
		idxDigitalSignaturesSigner: index("idx_digital_signatures_signer").using("btree", table.signerUserId.asc().nullsLast()),
		idxDigitalSignaturesStatus: index("idx_digital_signatures_status").using("btree", table.signatureStatus.asc().nullsLast()),
		idxDigitalSignaturesType: index("idx_digital_signatures_type").using("btree", table.signatureType.asc().nullsLast()),
		digitalSignaturesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "digital_signatures_organization_id_fkey"
		}),
		uniqueDocumentSigner: unique("unique_document_signer").on(table.documentType, table.documentId, table.signerUserId),
	}
});

export const signatureWorkflows = pgTable("signature_workflows", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	workflowName: varchar("workflow_name", { length: 200 }).notNull(),
	documentType: varchar("document_type", { length: 100 }).notNull(),
	signatureType: signatureType("signature_type").notNull(),
	requiredSignatures: integer("required_signatures").default(1),
	requiredRoles: jsonb("required_roles"),
	sequentialSigning: boolean("sequential_signing").default(false),
	expirationHours: integer("expiration_hours").default(168),
	approvalThreshold: integer("approval_threshold"),
	allowDelegation: boolean("allow_delegation").default(false),
	notifyOnPending: boolean("notify_on_pending").default(true),
	notifyOnSigned: boolean("notify_on_signed").default(true),
	reminderIntervalHours: integer("reminder_interval_hours").default(24),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxSignatureWorkflowsDocType: index("idx_signature_workflows_doc_type").using("btree", table.documentType.asc().nullsLast()),
		idxSignatureWorkflowsOrg: index("idx_signature_workflows_org").using("btree", table.organizationId.asc().nullsLast()),
		signatureWorkflowsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "signature_workflows_organization_id_fkey"
		}),
		uniqueWorkflowDocType: unique("unique_workflow_doc_type").on(table.organizationId, table.documentType, table.signatureType),
	}
});

export const wageProgressions = pgTable("wage_progressions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	cbaId: uuid("cba_id").notNull(),
	clauseId: uuid("clause_id"),
	classification: varchar("classification", { length: 200 }).notNull(),
	classificationCode: varchar("classification_code", { length: 50 }),
	step: integer("step").notNull(),
	hourlyRate: numeric("hourly_rate", { precision: 10, scale:  2 }),
	annualSalary: numeric("annual_salary", { precision: 12, scale:  2 }),
	effectiveDate: timestamp("effective_date", { withTimezone: true, mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
	premiums: jsonb("premiums"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		cbaIdx: index("wage_progressions_cba_idx").using("btree", table.cbaId.asc().nullsLast()),
		classificationIdx: index("wage_progressions_classification_idx").using("btree", table.classification.asc().nullsLast()),
		clauseIdx: index("wage_progressions_clause_idx").using("btree", table.clauseId.asc().nullsLast()),
		effectiveDateIdx: index("wage_progressions_effective_date_idx").using("btree", table.effectiveDate.asc().nullsLast()),
		wageProgressionsCbaIdCollectiveAgreementsIdFk: foreignKey({
			columns: [table.cbaId],
			foreignColumns: [collectiveAgreements.id],
			name: "wage_progressions_cba_id_collective_agreements_id_fk"
		}).onDelete("cascade"),
		wageProgressionsClauseIdCbaClausesIdFk: foreignKey({
			columns: [table.clauseId],
			foreignColumns: [cbaClauses.id],
			name: "wage_progressions_clause_id_cba_clauses_id_fk"
		}).onDelete("set null"),
	}
});

export const arbitrationDecisions = pgTable("arbitration_decisions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	caseNumber: varchar("case_number", { length: 100 }).notNull(),
	caseTitle: varchar("case_title", { length: 500 }).notNull(),
	tribunal: tribunalType("tribunal").notNull(),
	decisionType: decisionType("decision_type").notNull(),
	decisionDate: timestamp("decision_date", { withTimezone: true, mode: 'string' }).notNull(),
	filingDate: timestamp("filing_date", { withTimezone: true, mode: 'string' }),
	hearingDate: timestamp("hearing_date", { withTimezone: true, mode: 'string' }),
	arbitrator: varchar("arbitrator", { length: 200 }).notNull(),
	panelMembers: jsonb("panel_members"),
	grievor: varchar("grievor", { length: 300 }),
	union: varchar("union", { length: 300 }).notNull(),
	employer: varchar("employer", { length: 300 }).notNull(),
	outcome: outcome("outcome").notNull(),
	remedy: jsonb("remedy"),
	keyFindings: jsonb("key_findings"),
	issueTypes: jsonb("issue_types"),
	precedentValue: precedentValue("precedent_value").notNull(),
	legalCitations: jsonb("legal_citations"),
	relatedDecisions: jsonb("related_decisions"),
	cbaReferences: jsonb("cba_references"),
	fullText: text("full_text").notNull(),
	summary: text("summary"),
	headnote: text("headnote"),
	sector: varchar("sector", { length: 100 }),
	jurisdiction: varchar("jurisdiction", { length: 50 }),
	language: varchar("language", { length: 10 }).default('en').notNull(),
	citationCount: integer("citation_count").default(0),
	viewCount: integer("view_count").default(0),
	embedding: text("embedding"),
	isPublic: boolean("is_public").default(true),
	accessRestrictions: text("access_restrictions"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	importedFrom: varchar("imported_from", { length: 200 }),
},
(table) => {
	return {
		arbitrationArbitratorIdx: index("arbitration_arbitrator_idx").using("btree", table.arbitrator.asc().nullsLast()),
		arbitrationCaseNumberIdx: index("arbitration_case_number_idx").using("btree", table.caseNumber.asc().nullsLast()),
		arbitrationDecisionDateIdx: index("arbitration_decision_date_idx").using("btree", table.decisionDate.asc().nullsLast()),
		arbitrationJurisdictionIdx: index("arbitration_jurisdiction_idx").using("btree", table.jurisdiction.asc().nullsLast()),
		arbitrationOutcomeIdx: index("arbitration_outcome_idx").using("btree", table.outcome.asc().nullsLast()),
		arbitrationPrecedentIdx: index("arbitration_precedent_idx").using("btree", table.precedentValue.asc().nullsLast()),
		arbitrationTribunalIdx: index("arbitration_tribunal_idx").using("btree", table.tribunal.asc().nullsLast()),
		arbitrationDecisionsCaseNumberUnique: unique("arbitration_decisions_case_number_unique").on(table.caseNumber),
	}
});

export const bargainingNotes = pgTable("bargaining_notes", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	cbaId: uuid("cba_id"),
	tenantId: uuid("tenant_id").notNull(),
	sessionDate: timestamp("session_date", { withTimezone: true, mode: 'string' }).notNull(),
	sessionType: varchar("session_type", { length: 100 }).notNull(),
	sessionNumber: integer("session_number"),
	title: varchar("title", { length: 300 }).notNull(),
	content: text("content").notNull(),
	attendees: jsonb("attendees"),
	relatedClauseIds: jsonb("related_clause_ids"),
	relatedDecisionIds: jsonb("related_decision_ids"),
	tags: jsonb("tags"),
	confidentialityLevel: varchar("confidentiality_level", { length: 50 }).default('internal'),
	embedding: text("embedding"),
	keyInsights: jsonb("key_insights"),
	attachments: jsonb("attachments"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastModifiedBy: uuid("last_modified_by"),
},
(table) => {
	return {
		cbaIdx: index("bargaining_notes_cba_idx").using("btree", table.cbaId.asc().nullsLast()),
		sessionDateIdx: index("bargaining_notes_session_date_idx").using("btree", table.sessionDate.asc().nullsLast()),
		sessionTypeIdx: index("bargaining_notes_session_type_idx").using("btree", table.sessionType.asc().nullsLast()),
		tenantIdx: index("bargaining_notes_tenant_idx").using("btree", table.tenantId.asc().nullsLast()),
		bargainingNotesCbaIdCollectiveAgreementsIdFk: foreignKey({
			columns: [table.cbaId],
			foreignColumns: [collectiveAgreements.id],
			name: "bargaining_notes_cba_id_collective_agreements_id_fk"
		}).onDelete("cascade"),
	}
});

export const cbaFootnotes = pgTable("cba_footnotes", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	sourceClauseId: uuid("source_clause_id").notNull(),
	targetClauseId: uuid("target_clause_id"),
	targetDecisionId: uuid("target_decision_id"),
	footnoteNumber: integer("footnote_number").notNull(),
	footnoteText: text("footnote_text").notNull(),
	context: text("context"),
	linkType: varchar("link_type", { length: 50 }).notNull(),
	startOffset: integer("start_offset"),
	endOffset: integer("end_offset"),
	clickCount: integer("click_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by").notNull(),
},
(table) => {
	return {
		sourceIdx: index("cba_footnotes_source_idx").using("btree", table.sourceClauseId.asc().nullsLast()),
		targetClauseIdx: index("cba_footnotes_target_clause_idx").using("btree", table.targetClauseId.asc().nullsLast()),
		targetDecisionIdx: index("cba_footnotes_target_decision_idx").using("btree", table.targetDecisionId.asc().nullsLast()),
		cbaFootnotesSourceClauseIdCbaClausesIdFk: foreignKey({
			columns: [table.sourceClauseId],
			foreignColumns: [cbaClauses.id],
			name: "cba_footnotes_source_clause_id_cba_clauses_id_fk"
		}).onDelete("cascade"),
		cbaFootnotesTargetClauseIdCbaClausesIdFk: foreignKey({
			columns: [table.targetClauseId],
			foreignColumns: [cbaClauses.id],
			name: "cba_footnotes_target_clause_id_cba_clauses_id_fk"
		}).onDelete("cascade"),
		cbaFootnotesTargetDecisionIdArbitrationDecisionsIdFk: foreignKey({
			columns: [table.targetDecisionId],
			foreignColumns: [arbitrationDecisions.id],
			name: "cba_footnotes_target_decision_id_arbitration_decisions_id_fk"
		}).onDelete("cascade"),
	}
});

export const claimPrecedentAnalysis = pgTable("claim_precedent_analysis", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	claimId: uuid("claim_id").notNull(),
	precedentMatches: jsonb("precedent_matches"),
	successProbability: numeric("success_probability", { precision: 5, scale:  2 }),
	confidenceLevel: varchar("confidence_level", { length: 50 }),
	suggestedStrategy: text("suggested_strategy"),
	potentialRemedies: jsonb("potential_remedies"),
	arbitratorTendencies: jsonb("arbitrator_tendencies"),
	relevantCbaClauseIds: jsonb("relevant_cba_clause_ids"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	analyzedBy: varchar("analyzed_by", { length: 50 }).default('ai_system').notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		claimPrecedentClaimIdx: index("claim_precedent_claim_idx").using("btree", table.claimId.asc().nullsLast()),
		idxClaimPrecedentAnalysisCreatedAt: index("idx_claim_precedent_analysis_created_at").using("btree", table.createdAt.asc().nullsLast()),
		idxClaimPrecedentAnalysisUpdatedAt: index("idx_claim_precedent_analysis_updated_at").using("btree", table.updatedAt.asc().nullsLast()),
	}
});

export const cbaContacts = pgTable("cba_contacts", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	cbaId: uuid("cba_id").notNull(),
	contactType: varchar("contact_type", { length: 50 }).notNull(),
	name: varchar("name", { length: 200 }).notNull(),
	title: varchar("title", { length: 200 }),
	organization: varchar("organization", { length: 300 }),
	email: varchar("email", { length: 255 }),
	phone: varchar("phone", { length: 50 }),
	isPrimary: boolean("is_primary").default(false),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		cbaIdx: index("cba_contacts_cba_idx").using("btree", table.cbaId.asc().nullsLast()),
		typeIdx: index("cba_contacts_type_idx").using("btree", table.contactType.asc().nullsLast()),
		cbaContactsCbaIdCollectiveAgreementsIdFk: foreignKey({
			columns: [table.cbaId],
			foreignColumns: [collectiveAgreements.id],
			name: "cba_contacts_cba_id_collective_agreements_id_fk"
		}).onDelete("cascade"),
	}
});

export const aiDocuments = pgTable("ai_documents", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: text("tenant_id").notNull(),
	claimId: uuid("claim_id"),
	title: text("title").notNull(),
	content: text("content").notNull(),
	sourceType: text("source_type").notNull(),
	licenseNotes: text("license_notes"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxAiDocumentsClaim: index("idx_ai_documents_claim").using("btree", table.claimId.asc().nullsLast()),
		idxAiDocumentsMetadata: index("idx_ai_documents_metadata").using("gin", table.metadata.asc().nullsLast()),
		idxAiDocumentsSourceType: index("idx_ai_documents_source_type").using("btree", table.sourceType.asc().nullsLast()),
		idxAiDocumentsTenant: index("idx_ai_documents_tenant").using("btree", table.tenantId.asc().nullsLast()),
	}
});

export const aiChunks = pgTable("ai_chunks", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	tenantId: text("tenant_id").notNull(),
	content: text("content").notNull(),
	chunkIndex: integer("chunk_index").notNull(),
	embedding: text("embedding"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxAiChunksDocument: index("idx_ai_chunks_document").using("btree", table.documentId.asc().nullsLast()),
		idxAiChunksTenant: index("idx_ai_chunks_tenant").using("btree", table.tenantId.asc().nullsLast()),
		aiChunksDocumentIdFkey: foreignKey({
			columns: [table.documentId],
			foreignColumns: [aiDocuments.id],
			name: "ai_chunks_document_id_fkey"
		}).onDelete("cascade"),
		aiChunksDocumentIdChunkIndexKey: unique("ai_chunks_document_id_chunk_index_key").on(table.documentId, table.chunkIndex),
	}
});

export const aiQueries = pgTable("ai_queries", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: text("tenant_id").notNull(),
	userId: text("user_id").notNull(),
	queryText: text("query_text").notNull(),
	queryHash: text("query_hash").notNull(),
	answer: text("answer"),
	sources: jsonb("sources").default([]),
	status: text("status").notNull(),
	latencyMs: integer("latency_ms"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxAiQueriesCreated: index("idx_ai_queries_created").using("btree", table.createdAt.desc().nullsFirst()),
		idxAiQueriesHash: index("idx_ai_queries_hash").using("btree", table.queryHash.asc().nullsLast()),
		idxAiQueriesTenant: index("idx_ai_queries_tenant").using("btree", table.tenantId.asc().nullsLast()),
		idxAiQueriesUser: index("idx_ai_queries_user").using("btree", table.userId.asc().nullsLast()),
	}
});

export const aiQueryLogs = pgTable("ai_query_logs", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: text("tenant_id").notNull(),
	inputHash: text("input_hash").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	latencyMs: integer("latency_ms"),
	status: text("status").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxAiQueryLogsCreatedAt: index("idx_ai_query_logs_created_at").using("btree", table.createdAt.asc().nullsLast()),
		idxAiQueryLogsTenant: index("idx_ai_query_logs_tenant").using("btree", table.tenantId.asc().nullsLast()),
		idxAiQueryLogsTimestamp: index("idx_ai_query_logs_timestamp").using("btree", table.createdAt.desc().nullsFirst()),
		idxAiQueryLogsUpdatedAt: index("idx_ai_query_logs_updated_at").using("btree", table.updatedAt.asc().nullsLast()),
	}
});

export const aiFeedback = pgTable("ai_feedback", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	queryId: uuid("query_id").notNull(),
	tenantId: text("tenant_id").notNull(),
	userId: text("user_id").notNull(),
	rating: text("rating").notNull(),
	comment: text("comment"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxAiFeedbackQuery: index("idx_ai_feedback_query").using("btree", table.queryId.asc().nullsLast()),
		idxAiFeedbackTenant: index("idx_ai_feedback_tenant").using("btree", table.tenantId.asc().nullsLast()),
		aiFeedbackQueryIdFkey: foreignKey({
			columns: [table.queryId],
			foreignColumns: [aiQueries.id],
			name: "ai_feedback_query_id_fkey"
		}).onDelete("cascade"),
	}
});

export const aiUsageByTenant = pgTable("ai_usage_by_tenant", {
	tenantId: text("tenant_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalQueries: bigint("total_queries", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	successfulQueries: bigint("successful_queries", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	failedQueries: bigint("failed_queries", { mode: "number" }),
	avgLatencyMs: numeric("avg_latency_ms"),
	lastQueryAt: timestamp("last_query_at", { withTimezone: true, mode: 'string' }),
});

export const aiFeedbackSummary = pgTable("ai_feedback_summary", {
	tenantId: text("tenant_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalFeedback: bigint("total_feedback", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	positiveFeedback: bigint("positive_feedback", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	negativeFeedback: bigint("negative_feedback", { mode: "number" }),
	positiveRatePct: numeric("positive_rate_pct"),
});

export const organizationMembers = pgTable("organization_members", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	userId: text("user_id").notNull(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	phone: text("phone"),
	role: memberRole("role").default('member').notNull(),
	status: memberStatus("status").default('active').notNull(),
	department: text("department"),
	position: text("position"),
	hireDate: timestamp("hire_date", { withTimezone: true, mode: 'string' }),
	membershipNumber: text("membership_number"),
	seniority: integer("seniority").default(0),
	unionJoinDate: timestamp("union_join_date", { withTimezone: true, mode: 'string' }),
	preferredContactMethod: text("preferred_contact_method"),
	metadata: text("metadata"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	tenantId: uuid("tenant_id").notNull(),
	searchVector: tsvector("search_vector"),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isPrimary: boolean("is_primary").default(false),
},
(table) => {
	return {
		idxOrgMembersDeletedAt: index("idx_org_members_deleted_at").using("btree", table.deletedAt.asc().nullsLast()).where(sql`(deleted_at IS NULL)`),
		idxOrgMembersDepartment: index("idx_org_members_department").using("btree", table.department.asc().nullsLast()),
		idxOrgMembersEmail: index("idx_org_members_email").using("btree", table.email.asc().nullsLast()),
		idxOrgMembersOrgId: index("idx_org_members_org_id").using("btree", table.organizationId.asc().nullsLast()),
		idxOrgMembersRole: index("idx_org_members_role").using("btree", table.role.asc().nullsLast()),
		idxOrgMembersSearchVector: index("idx_org_members_search_vector").using("gin", table.searchVector.asc().nullsLast()),
		idxOrgMembersStatus: index("idx_org_members_status").using("btree", table.status.asc().nullsLast()),
		idxOrgMembersTenantId: index("idx_org_members_tenant_id").using("btree", table.tenantId.asc().nullsLast()),
		idxOrgMembersUserId: index("idx_org_members_user_id").using("btree", table.userId.asc().nullsLast()),
		idxOrganizationMembersIsPrimary: index("idx_organization_members_is_primary").using("btree", table.userId.asc().nullsLast(), table.isPrimary.asc().nullsLast()).where(sql`(is_primary = true)`),
		idxOrganizationMembersOrgId: index("idx_organization_members_org_id").using("btree", table.organizationId.asc().nullsLast()),
		organizationMembersTenantIdFkey: foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.tenantId],
			name: "organization_members_tenant_id_fkey"
		}).onDelete("cascade"),
		organizationMembersTenantUserUnique: unique("organization_members_tenant_user_unique").on(table.userId, table.tenantId),
		organizationMembersEmailKey: unique("organization_members_email_key").on(table.email),
	}
});

export const caseSummaries = pgTable("case_summaries", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	claimId: uuid("claim_id").notNull(),
	tenantId: text("tenant_id").notNull(),
	summaryText: text("summary_text").notNull(),
	createdBy: varchar("created_by", { length: 50 }).notNull(),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
},
(table) => {
	return {
		idxCaseSummariesClaim: index("idx_case_summaries_claim").using("btree", table.claimId.asc().nullsLast()),
		idxCaseSummariesCreatedAt: index("idx_case_summaries_created_at").using("btree", table.createdAt.desc().nullsFirst()),
		idxCaseSummariesCreatedBy: index("idx_case_summaries_created_by").using("btree", table.createdBy.asc().nullsLast()),
		idxCaseSummariesTenant: index("idx_case_summaries_tenant").using("btree", table.tenantId.asc().nullsLast()),
	}
});

export const claimUpdates = pgTable("claim_updates", {
	updateId: uuid("update_id").defaultRandom().primaryKey().notNull(),
	claimId: uuid("claim_id").notNull(),
	updateType: varchar("update_type", { length: 50 }).notNull(),
	message: text("message").notNull(),
	createdBy: uuid("created_by").notNull(),
	isInternal: boolean("is_internal").default(false),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
},
(table) => {
	return {
		idxClaimUpdatesClaimId: index("idx_claim_updates_claim_id").using("btree", table.claimId.asc().nullsLast()),
		idxClaimUpdatesCreatedAt: index("idx_claim_updates_created_at").using("btree", table.createdAt.desc().nullsFirst()),
		fkClaimUpdatesClaim: foreignKey({
			columns: [table.claimId],
			foreignColumns: [claims.claimId],
			name: "fk_claim_updates_claim"
		}).onDelete("cascade"),
		fkClaimUpdatesUser: foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.userId],
			name: "fk_claim_updates_user"
		}).onDelete("cascade"),
	}
});

export const memberDuesAssignments = pgTable("member_dues_assignments", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	memberId: uuid("member_id").notNull(),
	ruleId: uuid("rule_id").notNull(),
	effectiveDate: date("effective_date").default(sql`CURRENT_DATE`).notNull(),
	endDate: date("end_date"),
	isActive: boolean("is_active").default(true),
	overrideAmount: numeric("override_amount", { precision: 10, scale:  2 }),
	overrideReason: text("override_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxAssignmentsActive: index("idx_assignments_active").using("btree", table.organizationId.asc().nullsLast(), table.isActive.asc().nullsLast()),
		idxAssignmentsMember: index("idx_assignments_member").using("btree", table.memberId.asc().nullsLast()),
		idxAssignmentsOrganization: index("idx_assignments_organization").using("btree", table.organizationId.asc().nullsLast()),
		memberDuesAssignmentsRuleIdFkey: foreignKey({
			columns: [table.ruleId],
			foreignColumns: [duesRules.id],
			name: "member_dues_assignments_rule_id_fkey"
		}).onDelete("cascade"),
		memberDuesAssignmentsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "member_dues_assignments_organization_id_fkey"
		}).onDelete("cascade"),
		uniqueActiveAssignment: unique("unique_active_assignment").on(table.organizationId, table.memberId, table.ruleId, table.effectiveDate),
	}
});

export const employerRemittances = pgTable("employer_remittances", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employerName: varchar("employer_name", { length: 255 }).notNull(),
	employerId: varchar("employer_id", { length: 100 }),
	remittancePeriodStart: date("remittance_period_start").notNull(),
	remittancePeriodEnd: date("remittance_period_end").notNull(),
	remittanceDate: date("remittance_date").notNull(),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }).notNull(),
	memberCount: integer("member_count").notNull(),
	fileUrl: text("file_url"),
	fileHash: varchar("file_hash", { length: 64 }),
	status: varchar("status", { length: 50 }).default('pending').notNull(),
	reconciliationStatus: varchar("reconciliation_status", { length: 50 }),
	reconciliationDate: timestamp("reconciliation_date", { withTimezone: true, mode: 'string' }),
	reconciledBy: text("reconciled_by"),
	varianceAmount: numeric("variance_amount", { precision: 10, scale:  2 }).default('0.00'),
	varianceReason: text("variance_reason"),
	notes: text("notes"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxRemittancesPeriod: index("idx_remittances_period").using("btree", table.remittancePeriodStart.asc().nullsLast(), table.remittancePeriodEnd.asc().nullsLast()),
		idxRemittancesStatus: index("idx_remittances_status").using("btree", table.tenantId.asc().nullsLast(), table.status.asc().nullsLast()),
		idxRemittancesTenant: index("idx_remittances_tenant").using("btree", table.tenantId.asc().nullsLast()),
		employerRemittancesTenantIdFkey: foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.tenantId],
			name: "employer_remittances_tenant_id_fkey"
		}).onDelete("cascade"),
	}
});

export const duesRules = pgTable("dues_rules", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	ruleName: varchar("rule_name", { length: 255 }).notNull(),
	ruleCode: varchar("rule_code", { length: 50 }).notNull(),
	description: text("description"),
	calculationType: varchar("calculation_type", { length: 50 }).notNull(),
	percentageRate: numeric("percentage_rate", { precision: 5, scale:  2 }),
	baseField: varchar("base_field", { length: 100 }),
	flatAmount: numeric("flat_amount", { precision: 10, scale:  2 }),
	hourlyRate: numeric("hourly_rate", { precision: 10, scale:  2 }),
	hoursPerPeriod: integer("hours_per_period"),
	tierStructure: jsonb("tier_structure"),
	customFormula: text("custom_formula"),
	billingFrequency: varchar("billing_frequency", { length: 20 }).default('monthly').notNull(),
	isActive: boolean("is_active").default(true),
	effectiveDate: date("effective_date").default(sql`CURRENT_DATE`).notNull(),
	endDate: date("end_date"),
	createdBy: text("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxDuesRulesActive: index("idx_dues_rules_active").using("btree", table.organizationId.asc().nullsLast(), table.isActive.asc().nullsLast()),
		idxDuesRulesOrganization: index("idx_dues_rules_organization").using("btree", table.organizationId.asc().nullsLast()),
		duesRulesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "dues_rules_organization_id_fkey"
		}).onDelete("cascade"),
		uniqueRuleCode: unique("unique_rule_code").on(table.organizationId, table.ruleCode),
	}
});

export const strikeFunds = pgTable("strike_funds", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	fundName: varchar("fund_name", { length: 255 }).notNull(),
	fundCode: varchar("fund_code", { length: 50 }).notNull(),
	description: text("description"),
	fundType: varchar("fund_type", { length: 50 }).notNull(),
	currentBalance: numeric("current_balance", { precision: 12, scale:  2 }).default('0.00').notNull(),
	targetAmount: numeric("target_amount", { precision: 12, scale:  2 }),
	minimumThreshold: numeric("minimum_threshold", { precision: 12, scale:  2 }),
	contributionRate: numeric("contribution_rate", { precision: 10, scale:  2 }),
	contributionFrequency: varchar("contribution_frequency", { length: 20 }),
	strikeStatus: varchar("strike_status", { length: 50 }).default('inactive').notNull(),
	strikeStartDate: date("strike_start_date"),
	strikeEndDate: date("strike_end_date"),
	weeklyStipendAmount: numeric("weekly_stipend_amount", { precision: 10, scale:  2 }),
	dailyPicketBonus: numeric("daily_picket_bonus", { precision: 8, scale:  2 }),
	minimumAttendanceHours: numeric("minimum_attendance_hours", { precision: 4, scale:  2 }).default('4.0'),
	estimatedBurnRate: numeric("estimated_burn_rate", { precision: 10, scale:  2 }),
	estimatedDurationWeeks: integer("estimated_duration_weeks"),
	fundDepletionDate: date("fund_depletion_date"),
	lastPredictionUpdate: timestamp("last_prediction_update", { withTimezone: true, mode: 'string' }),
	acceptsPublicDonations: boolean("accepts_public_donations").default(false),
	donationPageUrl: text("donation_page_url"),
	fundraisingGoal: numeric("fundraising_goal", { precision: 12, scale:  2 }),
	status: varchar("status", { length: 20 }).default('active'),
	createdBy: text("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	organizationId: uuid("organization_id"),
},
(table) => {
	return {
		idxStrikeFundsActive: index("idx_strike_funds_active").using("btree", table.tenantId.asc().nullsLast()).where(sql`((strike_status)::text = 'active'::text)`),
		idxStrikeFundsOrganizationId: index("idx_strike_funds_organization_id").using("btree", table.organizationId.asc().nullsLast()),
		idxStrikeFundsStatus: index("idx_strike_funds_status").using("btree", table.tenantId.asc().nullsLast(), table.strikeStatus.asc().nullsLast()),
		idxStrikeFundsTenant: index("idx_strike_funds_tenant").using("btree", table.tenantId.asc().nullsLast()),
		strikeFundsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "strike_funds_organization_id_fkey"
		}),
		strikeFundsTenantIdFkey: foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.tenantId],
			name: "strike_funds_tenant_id_fkey"
		}).onDelete("cascade"),
		uniqueFundCode: unique("unique_fund_code").on(table.tenantId, table.fundCode),
	}
});

export const fundEligibility = pgTable("fund_eligibility", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	strikeFundId: uuid("strike_fund_id").notNull(),
	memberId: uuid("member_id").notNull(),
	isEligible: boolean("is_eligible").default(false),
	eligibilityReason: text("eligibility_reason"),
	monthsInGoodStanding: integer("months_in_good_standing"),
	hasPaidDues: boolean("has_paid_dues").default(false),
	noArrears: boolean("no_arrears").default(false),
	isInBargainingUnit: boolean("is_in_bargaining_unit").default(false),
	approvalStatus: varchar("approval_status", { length: 50 }).default('pending'),
	approvedBy: text("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxEligibilityFund: index("idx_eligibility_fund").using("btree", table.strikeFundId.asc().nullsLast()),
		idxEligibilityMember: index("idx_eligibility_member").using("btree", table.memberId.asc().nullsLast()),
		idxEligibilityTenant: index("idx_eligibility_tenant").using("btree", table.tenantId.asc().nullsLast()),
		fundEligibilityStrikeFundIdFkey: foreignKey({
			columns: [table.strikeFundId],
			foreignColumns: [strikeFunds.id],
			name: "fund_eligibility_strike_fund_id_fkey"
		}).onDelete("cascade"),
		fundEligibilityTenantIdFkey: foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.tenantId],
			name: "fund_eligibility_tenant_id_fkey"
		}).onDelete("cascade"),
		uniqueMemberFundEligibility: unique("unique_member_fund_eligibility").on(table.tenantId, table.strikeFundId, table.memberId),
	}
});

export const picketAttendance = pgTable("picket_attendance", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	strikeFundId: uuid("strike_fund_id").notNull(),
	memberId: uuid("member_id").notNull(),
	checkInTime: timestamp("check_in_time", { withTimezone: true, mode: 'string' }).notNull(),
	checkOutTime: timestamp("check_out_time", { withTimezone: true, mode: 'string' }),
	checkInLatitude: numeric("check_in_latitude", { precision: 10, scale:  8 }),
	checkInLongitude: numeric("check_in_longitude", { precision: 11, scale:  8 }),
	checkOutLatitude: numeric("check_out_latitude", { precision: 10, scale:  8 }),
	checkOutLongitude: numeric("check_out_longitude", { precision: 11, scale:  8 }),
	locationVerified: boolean("location_verified").default(false),
	checkInMethod: varchar("check_in_method", { length: 50 }),
	nfcTagUid: varchar("nfc_tag_uid", { length: 100 }),
	qrCodeData: varchar("qr_code_data", { length: 255 }),
	deviceId: text("device_id"),
	durationMinutes: integer("duration_minutes"),
	hoursWorked: numeric("hours_worked", { precision: 4, scale:  2 }),
	coordinatorOverride: boolean("coordinator_override").default(false),
	overrideReason: text("override_reason"),
	verifiedBy: text("verified_by"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxAttendanceDate: index("idx_attendance_date").using("btree", table.checkInTime.asc().nullsLast()),
		idxAttendanceFund: index("idx_attendance_fund").using("btree", table.strikeFundId.asc().nullsLast()),
		idxAttendanceMember: index("idx_attendance_member").using("btree", table.memberId.asc().nullsLast()),
		idxAttendanceMethod: index("idx_attendance_method").using("btree", table.checkInMethod.asc().nullsLast()),
		idxAttendanceTenant: index("idx_attendance_tenant").using("btree", table.tenantId.asc().nullsLast()),
		picketAttendanceStrikeFundIdFkey: foreignKey({
			columns: [table.strikeFundId],
			foreignColumns: [strikeFunds.id],
			name: "picket_attendance_strike_fund_id_fkey"
		}).onDelete("cascade"),
		picketAttendanceTenantIdFkey: foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.tenantId],
			name: "picket_attendance_tenant_id_fkey"
		}).onDelete("cascade"),
	}
});

export const stipendDisbursements = pgTable("stipend_disbursements", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	strikeFundId: uuid("strike_fund_id").notNull(),
	memberId: uuid("member_id").notNull(),
	weekStartDate: date("week_start_date").notNull(),
	weekEndDate: date("week_end_date").notNull(),
	daysWorked: integer("days_worked").default(0), // Number of days worked in the week
	hoursWorked: numeric("hours_worked", { precision: 6, scale:  2 }).notNull(),
	calculatedAmount: numeric("calculated_amount", { precision: 10, scale: 2 }), // Calculated amount before adjustments
	baseStipendAmount: numeric("base_stipend_amount", { precision: 10, scale:  2 }).notNull(),
	bonusAmount: numeric("bonus_amount", { precision: 10, scale:  2 }).default('0.00'),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	status: varchar("status", { length: 50 }).default('calculated').notNull(),
	paymentDate: timestamp("payment_date", { withTimezone: true, mode: 'string' }),
	paymentMethod: varchar("payment_method", { length: 50 }),
	paymentReference: varchar("payment_reference", { length: 255 }),
	approvedBy: text("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxStipendsFund: index("idx_stipends_fund").using("btree", table.strikeFundId.asc().nullsLast()),
		idxStipendsMember: index("idx_stipends_member").using("btree", table.memberId.asc().nullsLast()),
		idxStipendsStatus: index("idx_stipends_status").using("btree", table.status.asc().nullsLast()),
		idxStipendsTenant: index("idx_stipends_tenant").using("btree", table.tenantId.asc().nullsLast()),
		idxStipendsWeek: index("idx_stipends_week").using("btree", table.weekStartDate.asc().nullsLast()),
		stipendDisbursementsStrikeFundIdFkey: foreignKey({
			columns: [table.strikeFundId],
			foreignColumns: [strikeFunds.id],
			name: "stipend_disbursements_strike_fund_id_fkey"
		}).onDelete("cascade"),
		stipendDisbursementsTenantIdFkey: foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.tenantId],
			name: "stipend_disbursements_tenant_id_fkey"
		}).onDelete("cascade"),
		uniqueMemberWeekStipend: unique("unique_member_week_stipend").on(table.tenantId, table.strikeFundId, table.memberId, table.weekStartDate),
	}
});

export const publicDonations = pgTable("public_donations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	strikeFundId: uuid("strike_fund_id").notNull(),
	donorName: varchar("donor_name", { length: 255 }),
	donorEmail: varchar("donor_email", { length: 255 }),
	isAnonymous: boolean("is_anonymous").default(false),
	amount: numeric("amount", { precision: 10, scale:  2 }).notNull(),
	currency: varchar("currency", { length: 3 }).default('USD'),
	paymentProvider: varchar("payment_provider", { length: 50 }).default('stripe'),
	paymentIntentId: varchar("payment_intent_id", { length: 255 }),
	transactionId: varchar("transaction_id", { length: 255 }),
	status: varchar("status", { length: 50 }).default('pending').notNull(),
	message: text("message"),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	refundedAt: timestamp("refunded_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxDonationsCreated: index("idx_donations_created").using("btree", table.createdAt.desc().nullsFirst()),
		idxDonationsFund: index("idx_donations_fund").using("btree", table.strikeFundId.asc().nullsLast()),
		idxDonationsPaymentIntent: index("idx_donations_payment_intent").using("btree", table.paymentIntentId.asc().nullsLast()),
		idxDonationsStatus: index("idx_donations_status").using("btree", table.status.asc().nullsLast()),
		idxDonationsTenant: index("idx_donations_tenant").using("btree", table.tenantId.asc().nullsLast()),
		publicDonationsStrikeFundIdFkey: foreignKey({
			columns: [table.strikeFundId],
			foreignColumns: [strikeFunds.id],
			name: "public_donations_strike_fund_id_fkey"
		}).onDelete("cascade"),
		publicDonationsTenantIdFkey: foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.tenantId],
			name: "public_donations_tenant_id_fkey"
		}).onDelete("cascade"),
	}
});

export const hardshipApplications = pgTable("hardship_applications", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	strikeFundId: uuid("strike_fund_id").notNull(),
	memberId: uuid("member_id").notNull(),
	applicationDate: date("application_date").default(sql`CURRENT_DATE`).notNull(),
	hardshipType: varchar("hardship_type", { length: 50 }).notNull(),
	amountRequested: numeric("amount_requested", { precision: 10, scale:  2 }).notNull(),
	amountApproved: numeric("amount_approved", { precision: 10, scale:  2 }),
	description: text("description").notNull(),
	supportingDocuments: jsonb("supporting_documents").default([]),
	status: varchar("status", { length: 50 }).default('submitted').notNull(),
	reviewedBy: text("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewNotes: text("review_notes"),
	paidDate: timestamp("paid_date", { withTimezone: true, mode: 'string' }),
	paymentReference: varchar("payment_reference", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxHardshipFund: index("idx_hardship_fund").using("btree", table.strikeFundId.asc().nullsLast()),
		idxHardshipMember: index("idx_hardship_member").using("btree", table.memberId.asc().nullsLast()),
		idxHardshipStatus: index("idx_hardship_status").using("btree", table.status.asc().nullsLast()),
		idxHardshipTenant: index("idx_hardship_tenant").using("btree", table.tenantId.asc().nullsLast()),
		hardshipApplicationsStrikeFundIdFkey: foreignKey({
			columns: [table.strikeFundId],
			foreignColumns: [strikeFunds.id],
			name: "hardship_applications_strike_fund_id_fkey"
		}).onDelete("cascade"),
		hardshipApplicationsTenantIdFkey: foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.tenantId],
			name: "hardship_applications_tenant_id_fkey"
		}).onDelete("cascade"),
	}
});

export const arrearsCases = pgTable("arrears_cases", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	memberId: uuid("member_id").notNull(),
	caseNumber: varchar("case_number", { length: 100 }),
	totalOwed: numeric("total_owed", { precision: 10, scale:  2 }).notNull(),
	oldestDebtDate: date("oldest_debt_date"),
	status: varchar("status", { length: 50 }).default('open').notNull(),
	paymentPlanId: uuid("payment_plan_id"),
	paymentPlanAmount: numeric("payment_plan_amount", { precision: 10, scale:  2 }),
	paymentPlanFrequency: varchar("payment_plan_frequency", { length: 20 }),
	lastContactDate: timestamp("last_contact_date", { withTimezone: true, mode: 'string' }),
	lastContactMethod: varchar("last_contact_method", { length: 50 }),
	nextFollowupDate: date("next_followup_date"),
	escalationLevel: integer("escalation_level").default(0),
	escalationHistory: jsonb("escalation_history").default([]),
	resolutionDate: timestamp("resolution_date", { withTimezone: true, mode: 'string' }),
	resolutionType: varchar("resolution_type", { length: 50 }),
	resolutionNotes: text("resolution_notes"),
	notes: text("notes"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	transactionIds: uuid("transaction_ids").array().default([""]),
	remainingBalance: numeric("remaining_balance", { precision: 10, scale:  2 }),
	daysOverdue: integer("days_overdue"),
	contactHistory: jsonb("contact_history").default([]),
	paymentSchedule: jsonb("payment_schedule").default([]),
	paymentPlanActive: boolean("payment_plan_active").default(false),
	paymentPlanStartDate: date("payment_plan_start_date"),
	installmentAmount: numeric("installment_amount", { precision: 10, scale:  2 }),
	numberOfInstallments: integer("number_of_installments"),
	createdBy: text("created_by"),
	updatedBy: text("updated_by"),
},
(table) => {
	return {
		idxArrearsFollowup: index("idx_arrears_followup").using("btree", table.nextFollowupDate.asc().nullsLast()).where(sql`((status)::text = 'open'::text)`),
		idxArrearsMember: index("idx_arrears_member").using("btree", table.memberId.asc().nullsLast()),
		idxArrearsStatus: index("idx_arrears_status").using("btree", table.organizationId.asc().nullsLast(), table.status.asc().nullsLast()),
		idxArrearsOrganization: index("idx_arrears_organization").using("btree", table.organizationId.asc().nullsLast()),
		idxArrearsTransactionIds: index("idx_arrears_transaction_ids").using("gin", table.transactionIds.asc().nullsLast()),
		arrearsCasesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "arrears_cases_organization_id_fkey"
		}).onDelete("cascade"),
		arrearsCasesCaseNumberKey: unique("arrears_cases_case_number_key").on(table.caseNumber),
	}
});

export const notificationQueue = pgTable("notification_queue", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	userId: uuid("user_id").notNull(),
	type: text("type").notNull(),
	channels: text("channels").array().notNull(),
	priority: text("priority").default('normal').notNull(),
	data: text("data").notNull(),
	status: text("status").default('pending').notNull(),
	scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: 'string' }).notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	attempts: numeric("attempts", { precision: 2, scale:  0 }).default('0').notNull(),
	lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: 'string' }),
	error: text("error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		scheduledIdx: index("notification_queue_scheduled_idx").using("btree", table.scheduledFor.asc().nullsLast()),
		statusIdx: index("notification_queue_status_idx").using("btree", table.status.asc().nullsLast()),
		tenantIdx: index("notification_queue_tenant_idx").using("btree", table.tenantId.asc().nullsLast()),
		userIdx: index("notification_queue_user_idx").using("btree", table.userId.asc().nullsLast()),
	}
});

export const notificationTemplates = pgTable("notification_templates", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	type: text("type").notNull(),
	channel: text("channel").notNull(),
	subject: text("subject"),
	body: text("body").notNull(),
	variables: text("variables").default('[]').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		uniqueIdx: uniqueIndex("notification_templates_unique_idx").using("btree", table.tenantId.asc().nullsLast(), table.type.asc().nullsLast(), table.channel.asc().nullsLast()),
	}
});

export const notificationLog = pgTable("notification_log", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	notificationId: uuid("notification_id").notNull(),
	channel: text("channel").notNull(),
	status: text("status").notNull(),
	error: text("error"),
	deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		notificationIdx: index("notification_log_notification_idx").using("btree", table.notificationId.asc().nullsLast()),
		statusIdx: index("notification_log_status_idx").using("btree", table.status.asc().nullsLast()),
	}
});

export const userNotificationPreferences = pgTable("user_notification_preferences", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	userId: uuid("user_id").notNull(),
	preferences: text("preferences").default('{}').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		uniqueIdx: uniqueIndex("user_notification_preferences_unique_idx").using("btree", table.tenantId.asc().nullsLast(), table.userId.asc().nullsLast()),
	}
});

export const donations = pgTable("donations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	strikeFundId: uuid("strike_fund_id").notNull(),
	amount: numeric("amount", { precision: 10, scale:  2 }).notNull(),
	currency: varchar("currency", { length: 3 }).default('usd'),
	donorName: text("donor_name"),
	donorEmail: text("donor_email"),
	isAnonymous: boolean("is_anonymous").default(false),
	message: text("message"),
	status: text("status").default('pending').notNull(),
	stripePaymentIntentId: text("stripe_payment_intent_id"),
	paymentMethod: text("payment_method"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		fundIdx: index("donations_fund_idx").using("btree", table.strikeFundId.asc().nullsLast()),
		statusIdx: index("donations_status_idx").using("btree", table.status.asc().nullsLast()),
		stripeIdx: index("donations_stripe_idx").using("btree", table.stripePaymentIntentId.asc().nullsLast()),
		tenantIdx: index("donations_tenant_idx").using("btree", table.tenantId.asc().nullsLast()),
	}
});

export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	stripeEventId: text("stripe_event_id").notNull(),
	eventType: text("event_type").notNull(),
	organizationId: uuid("organization_id").notNull(),
	stripePaymentIntentId: text("stripe_payment_intent_id"),
	stripeCustomerId: text("stripe_customer_id"),
	eventData: jsonb("event_data").default(sql`'{}'::jsonb`).notNull(),
	processed: boolean("processed").default(false).notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	processingError: text("processing_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		eventIdUniqueIdx: uniqueIndex("stripe_webhook_events_event_id_unique_idx").using("btree", table.stripeEventId.asc().nullsLast()),
		paymentIntentIdx: index("stripe_webhook_events_payment_intent_idx").using("btree", table.stripePaymentIntentId.asc().nullsLast()),
		processedIdx: index("stripe_webhook_events_processed_idx").using("btree", table.processed.asc().nullsLast()),
		createdAtIdx: index("stripe_webhook_events_created_at_idx").using("btree", table.createdAt.asc().nullsLast()),
	}
});

export const picketTracking = pgTable("picket_tracking", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	strikeFundId: uuid("strike_fund_id").notNull(),
	memberId: uuid("member_id").notNull(),
	checkInTime: timestamp("check_in_time", { withTimezone: true, mode: 'string' }).notNull(),
	checkOutTime: timestamp("check_out_time", { withTimezone: true, mode: 'string' }),
	checkInLatitude: numeric("check_in_latitude", { precision: 10, scale:  8 }),
	checkInLongitude: numeric("check_in_longitude", { precision: 11, scale:  8 }),
	checkOutLatitude: numeric("check_out_latitude", { precision: 10, scale:  8 }),
	checkOutLongitude: numeric("check_out_longitude", { precision: 11, scale:  8 }),
	locationVerified: boolean("location_verified").default(false),
	checkInMethod: text("check_in_method"),
	nfcTagUid: text("nfc_tag_uid"),
	qrCodeData: text("qr_code_data"),
	deviceId: text("device_id"),
	durationMinutes: integer("duration_minutes"),
	hoursWorked: numeric("hours_worked", { precision: 4, scale:  2 }),
	coordinatorOverride: boolean("coordinator_override").default(false),
	overrideReason: text("override_reason"),
	verifiedBy: text("verified_by"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		dateIdx: index("picket_tracking_date_idx").using("btree", table.checkInTime.asc().nullsLast()),
		fundIdx: index("picket_tracking_fund_idx").using("btree", table.strikeFundId.asc().nullsLast()),
		memberIdx: index("picket_tracking_member_idx").using("btree", table.memberId.asc().nullsLast()),
		tenantIdx: index("picket_tracking_tenant_idx").using("btree", table.tenantId.asc().nullsLast()),
	}
});

export const jurisdictionTemplates = pgTable("jurisdiction_templates", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	jurisdiction: caJurisdiction("jurisdiction").notNull(),
	templateType: text("template_type").notNull(),
	templateName: text("template_name").notNull(),
	templateContent: text("template_content").notNull(),
	requiredFields: text("required_fields").array().default([""]).notNull(),
	optionalFields: text("optional_fields").array().default([""]).notNull(),
	legalReference: text("legal_reference"),
	formNumber: text("form_number"),
	version: integer("version").default(1).notNull(),
	active: boolean("active").default(true).notNull(),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxJurisdictionTemplatesActive: index("idx_jurisdiction_templates_active").using("btree", table.jurisdiction.asc().nullsLast(), table.templateType.asc().nullsLast()).where(sql`(active = true)`),
		idxJurisdictionTemplatesJurisdiction: index("idx_jurisdiction_templates_jurisdiction").using("btree", table.jurisdiction.asc().nullsLast()),
		idxJurisdictionTemplatesMetadata: index("idx_jurisdiction_templates_metadata").using("gin", table.metadata.asc().nullsLast()),
		idxJurisdictionTemplatesType: index("idx_jurisdiction_templates_type").using("btree", table.templateType.asc().nullsLast()),
		uniqueJurisdictionTemplate: unique("unique_jurisdiction_template").on(table.jurisdiction, table.templateType, table.version),
	}
});

export const jurisdictionRulesSummary = pgTable("jurisdiction_rules_summary", {
	jurisdiction: caJurisdiction("jurisdiction"),
	ruleType: jurisdictionRuleType("rule_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ruleCount: bigint("rule_count", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	categoryCount: bigint("category_count", { mode: "number" }),
	earliestEffective: date("earliest_effective"),
	latestEffective: date("latest_effective"),
});

export const arrears = pgTable("arrears", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	memberId: uuid("member_id").notNull(),
	totalOwed: numeric("total_owed", { precision: 10, scale:  2 }).default('0.00').notNull(),
	oldestDebtDate: date("oldest_debt_date"),
	monthsOverdue: integer("months_overdue").default(0),
	arrearsStatus: text("arrears_status").default('active').notNull(),
	notificationStage: text("notification_stage").default('none'), // none, reminder, warning, final, suspended
	paymentPlanActive: boolean("payment_plan_active").default(false),
	paymentPlanAmount: numeric("payment_plan_amount", { precision: 10, scale:  2 }),
	paymentPlanFrequency: text("payment_plan_frequency"),
	paymentPlanStartDate: date("payment_plan_start_date"),
	paymentPlanEndDate: date("payment_plan_end_date"),
	suspensionEffectiveDate: date("suspension_effective_date"),
	suspensionReason: text("suspension_reason"),
	collectionAgency: text("collection_agency"),
	legalActionDate: date("legal_action_date"),
	legalReference: text("legal_reference"),
	notes: text("notes"),
	lastContactDate: date("last_contact_date"),
	nextFollowUpDate: date("next_follow_up_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		memberIdx: index("arrears_member_idx").using("btree", table.memberId.asc().nullsLast()),
		statusIdx: index("arrears_status_idx").using("btree", table.arrearsStatus.asc().nullsLast()),
		tenantIdx: index("arrears_tenant_idx").using("btree", table.tenantId.asc().nullsLast()),
		uniqueMemberArrears: unique("unique_member_arrears").on(table.tenantId, table.memberId),
	}
});

export const clauseComparisonsHistory = pgTable("clause_comparisons_history", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	clauseIds: uuid("clause_ids").array().notNull(),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	organizationId: uuid("organization_id").notNull(),
},
(table) => {
	return {
		idxClauseComparisonsCreated: index("idx_clause_comparisons_created").using("btree", table.createdAt.asc().nullsLast()),
		idxClauseComparisonsOrg: index("idx_clause_comparisons_org").using("btree", table.organizationId.asc().nullsLast()),
		idxClauseComparisonsUser: index("idx_clause_comparisons_user").using("btree", table.userId.asc().nullsLast()),
		clauseComparisonsHistoryOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "clause_comparisons_history_organization_id_fkey"
		}),
	}
});

export const arbitrationPrecedents = pgTable("arbitration_precedents", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	sourceOrganizationId: uuid("source_organization_id").notNull(),
	sourceDecisionId: uuid("source_decision_id"),
	caseNumber: varchar("case_number", { length: 100 }),
	caseTitle: varchar("case_title", { length: 500 }).notNull(),
	decisionDate: date("decision_date").notNull(),
	isPartiesAnonymized: boolean("is_parties_anonymized").default(false),
	unionName: varchar("union_name", { length: 200 }),
	employerName: varchar("employer_name", { length: 200 }),
	arbitratorName: varchar("arbitrator_name", { length: 200 }).notNull(),
	tribunal: varchar("tribunal", { length: 200 }),
	jurisdiction: varchar("jurisdiction", { length: 50 }).notNull(),
	grievanceType: varchar("grievance_type", { length: 100 }).notNull(),
	issueSummary: text("issue_summary").notNull(),
	unionPosition: text("union_position"),
	employerPosition: text("employer_position"),
	outcome: varchar("outcome", { length: 50 }).notNull(),
	decisionSummary: text("decision_summary").notNull(),
	reasoning: text("reasoning"),
	precedentialValue: varchar("precedential_value", { length: 20 }).default('medium'),
	keyPrinciples: text("key_principles").array(),
	relatedLegislation: text("related_legislation"),
	documentUrl: varchar("document_url", { length: 500 }),
	documentPath: varchar("document_path", { length: 500 }),
	sharingLevel: varchar("sharing_level", { length: 50 }).default('private').notNull(),
	sharedWithOrgIds: uuid("shared_with_org_ids").array(),
	sector: varchar("sector", { length: 100 }),
	province: varchar("province", { length: 2 }),
	viewCount: integer("view_count").default(0),
	citationCount: integer("citation_count").default(0),
	downloadCount: integer("download_count").default(0),
	hasRedactedVersion: boolean("has_redacted_version").default(false),
	redactedDocumentUrl: varchar("redacted_document_url", { length: 500 }),
	redactedDocumentPath: varchar("redacted_document_path", { length: 500 }),
	citedCases: uuid("cited_cases").array(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxPrecedentsDate: index("idx_precedents_date").using("btree", table.decisionDate.asc().nullsLast()),
		idxPrecedentsJurisdiction: index("idx_precedents_jurisdiction").using("btree", table.jurisdiction.asc().nullsLast()),
		idxPrecedentsOrg: index("idx_precedents_org").using("btree", table.sourceOrganizationId.asc().nullsLast()),
		idxPrecedentsOutcome: index("idx_precedents_outcome").using("btree", table.outcome.asc().nullsLast()),
		idxPrecedentsProvince: index("idx_precedents_province").using("btree", table.province.asc().nullsLast()),
		idxPrecedentsSector: index("idx_precedents_sector").using("btree", table.sector.asc().nullsLast()),
		idxPrecedentsSharing: index("idx_precedents_sharing").using("btree", table.sharingLevel.asc().nullsLast()),
		idxPrecedentsType: index("idx_precedents_type").using("btree", table.grievanceType.asc().nullsLast()),
	}
});

export const sharedClauseLibrary = pgTable("shared_clause_library", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	sourceOrganizationId: uuid("source_organization_id").notNull(),
	sourceCbaId: uuid("source_cba_id"),
	originalClauseId: uuid("original_clause_id"),
	clauseNumber: varchar("clause_number", { length: 50 }),
	clauseTitle: varchar("clause_title", { length: 500 }).notNull(),
	clauseText: text("clause_text").notNull(),
	clauseType: varchar("clause_type", { length: 100 }).notNull(),
	isAnonymized: boolean("is_anonymized").default(false),
	originalEmployerName: varchar("original_employer_name", { length: 200 }),
	anonymizedEmployerName: varchar("anonymized_employer_name", { length: 200 }),
	sharingLevel: varchar("sharing_level", { length: 50 }).default('private').notNull(),
	sharedWithOrgIds: uuid("shared_with_org_ids").array(),
	effectiveDate: date("effective_date"),
	expiryDate: date("expiry_date"),
	sector: varchar("sector", { length: 100 }),
	province: varchar("province", { length: 2 }),
	viewCount: integer("view_count").default(0),
	citationCount: integer("citation_count").default(0),
	comparisonCount: integer("comparison_count").default(0),
	version: integer("version").default(1),
	previousVersionId: uuid("previous_version_id"),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxSharedClausesOrg: index("idx_shared_clauses_org").using("btree", table.sourceOrganizationId.asc().nullsLast()),
		idxSharedClausesProvince: index("idx_shared_clauses_province").using("btree", table.province.asc().nullsLast()),
		idxSharedClausesSector: index("idx_shared_clauses_sector").using("btree", table.sector.asc().nullsLast()),
		idxSharedClausesSharing: index("idx_shared_clauses_sharing").using("btree", table.sharingLevel.asc().nullsLast()),
		idxSharedClausesType: index("idx_shared_clauses_type").using("btree", table.clauseType.asc().nullsLast()),
		sharedClauseLibraryPreviousVersionIdSharedClauseLibrary: foreignKey({
			columns: [table.previousVersionId],
			foreignColumns: [table.id],
			name: "shared_clause_library_previous_version_id_shared_clause_library"
		}),
	}
});

export const precedentTags = pgTable("precedent_tags", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	precedentId: uuid("precedent_id").notNull(),
	tagName: varchar("tag_name", { length: 50 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxPrecedentTagsPrecedent: index("idx_precedent_tags_precedent").using("btree", table.precedentId.asc().nullsLast()),
		idxPrecedentTagsTag: index("idx_precedent_tags_tag").using("btree", table.tagName.asc().nullsLast()),
		precedentTagsPrecedentIdArbitrationPrecedentsIdFk: foreignKey({
			columns: [table.precedentId],
			foreignColumns: [arbitrationPrecedents.id],
			name: "precedent_tags_precedent_id_arbitration_precedents_id_fk"
		}).onDelete("cascade"),
	}
});

export const precedentCitations = pgTable("precedent_citations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	precedentId: uuid("precedent_id").notNull(),
	citedByPrecedentId: uuid("cited_by_precedent_id"),
	citingClaimId: uuid("citing_claim_id"),
	citationContext: text("citation_context"),
	citationWeight: varchar("citation_weight", { length: 20 }).default('supporting'),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxPrecedentCitationsCitedBy: index("idx_precedent_citations_cited_by").using("btree", table.citedByPrecedentId.asc().nullsLast()),
		idxPrecedentCitationsClaim: index("idx_precedent_citations_claim").using("btree", table.citingClaimId.asc().nullsLast()),
		idxPrecedentCitationsPrecedent: index("idx_precedent_citations_precedent").using("btree", table.precedentId.asc().nullsLast()),
		precedentCitationsCitedByPrecedentIdArbitrationPrecedent: foreignKey({
			columns: [table.citedByPrecedentId],
			foreignColumns: [arbitrationPrecedents.id],
			name: "precedent_citations_cited_by_precedent_id_arbitration_precedent"
		}).onDelete("cascade"),
		precedentCitationsPrecedentIdArbitrationPrecedentsIdFk: foreignKey({
			columns: [table.precedentId],
			foreignColumns: [arbitrationPrecedents.id],
			name: "precedent_citations_precedent_id_arbitration_precedents_id_fk"
		}).onDelete("cascade"),
	}
});

export const organizationSharingSettings = pgTable("organization_sharing_settings", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	allowFederationSharing: boolean("allow_federation_sharing").default(false),
	allowSectorSharing: boolean("allow_sector_sharing").default(false),
	allowProvinceSharing: boolean("allow_province_sharing").default(false),
	allowCongressSharing: boolean("allow_congress_sharing").default(false),
	autoShareClauses: boolean("auto_share_clauses").default(false),
	autoSharePrecedents: boolean("auto_share_precedents").default(false),
	requireAnonymization: boolean("require_anonymization").default(true),
	defaultSharingLevel: varchar("default_sharing_level", { length: 50 }).default('private'),
	allowedSharingLevels: varchar("allowed_sharing_levels", { length: 50 }).array(),
	sharingApprovalRequired: boolean("sharing_approval_required").default(true),
	sharingApproverRole: varchar("sharing_approver_role", { length: 50 }).default('admin'),
	maxSharedClauses: integer("max_shared_clauses"),
	maxSharedPrecedents: integer("max_shared_precedents"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxSharingSettingsOrg: index("idx_sharing_settings_org").using("btree", table.organizationId.asc().nullsLast()),
		organizationSharingSettingsOrganizationIdKey: unique("organization_sharing_settings_organization_id_key").on(table.organizationId),
	}
});

export const organizationSharingGrants = pgTable("organization_sharing_grants", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	granterOrgId: uuid("granter_org_id").notNull(),
	granteeOrgId: uuid("grantee_org_id").notNull(),
	resourceType: varchar("resource_type", { length: 50 }).notNull(),
	resourceId: uuid("resource_id").notNull(),
	accessLevel: varchar("access_level", { length: 50 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	canReshare: boolean("can_reshare").default(false),
	grantedBy: uuid("granted_by").notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedBy: uuid("revoked_by"),
	accessCount: integer("access_count").default(0),
	lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxSharingGrantsExpires: index("idx_sharing_grants_expires").using("btree", table.expiresAt.asc().nullsLast()),
		idxSharingGrantsGrantee: index("idx_sharing_grants_grantee").using("btree", table.granteeOrgId.asc().nullsLast()),
		idxSharingGrantsGranter: index("idx_sharing_grants_granter").using("btree", table.granterOrgId.asc().nullsLast()),
		idxSharingGrantsResource: index("idx_sharing_grants_resource").using("btree", table.resourceType.asc().nullsLast(), table.resourceId.asc().nullsLast()),
	}
});

export const crossOrgAccessLog = pgTable("cross_org_access_log", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	userOrganizationId: uuid("user_organization_id").notNull(),
	resourceType: varchar("resource_type", { length: 50 }).notNull(),
	resourceId: uuid("resource_id").notNull(),
	resourceOrganizationId: uuid("resource_organization_id").notNull(),
	accessType: varchar("access_type", { length: 50 }).notNull(),
	accessGrantedVia: varchar("access_granted_via", { length: 50 }),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxAccessLogCreated: index("idx_access_log_created").using("btree", table.createdAt.asc().nullsLast()),
		idxAccessLogResource: index("idx_access_log_resource").using("btree", table.resourceType.asc().nullsLast(), table.resourceId.asc().nullsLast()),
		idxAccessLogResourceOrg: index("idx_access_log_resource_org").using("btree", table.resourceOrganizationId.asc().nullsLast()),
		idxAccessLogUser: index("idx_access_log_user").using("btree", table.userId.asc().nullsLast()),
		idxAccessLogUserOrg: index("idx_access_log_user_org").using("btree", table.userOrganizationId.asc().nullsLast()),
	}
});

export const organizationRelationships = pgTable("organization_relationships", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	parentOrgId: uuid("parent_org_id").notNull(),
	childOrgId: uuid("child_org_id").notNull(),
	relationshipType: text("relationship_type").notNull(),
	effectiveDate: date("effective_date").default(sql`CURRENT_DATE`).notNull(),
	endDate: date("end_date"),
	notes: text("notes"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxOrgRelationshipsActive: index("idx_org_relationships_active").using("btree", table.effectiveDate.asc().nullsLast(), table.endDate.asc().nullsLast()).where(sql`(end_date IS NULL)`),
		idxOrgRelationshipsChild: index("idx_org_relationships_child").using("btree", table.childOrgId.asc().nullsLast()),
		idxOrgRelationshipsParent: index("idx_org_relationships_parent").using("btree", table.parentOrgId.asc().nullsLast()),
		idxOrgRelationshipsType: index("idx_org_relationships_type").using("btree", table.relationshipType.asc().nullsLast()),
		organizationRelationshipsChildOrgIdFkey: foreignKey({
			columns: [table.childOrgId],
			foreignColumns: [organizations.id],
			name: "organization_relationships_child_org_id_fkey"
		}).onDelete("cascade"),
		organizationRelationshipsParentOrgIdFkey: foreignKey({
			columns: [table.parentOrgId],
			foreignColumns: [organizations.id],
			name: "organization_relationships_parent_org_id_fkey"
		}).onDelete("cascade"),
		organizationRelationshipsParentOrgIdChildOrgIdRelatKey: unique("organization_relationships_parent_org_id_child_org_id_relat_key").on(table.parentOrgId, table.childOrgId, table.relationshipType, table.effectiveDate),
	}
});

export const congressMembershipStatus = pgEnum("congress_membership_status", [
	'active',
	'pending',
	'suspended',
	'terminated'
]);

export const congressMemberships = pgTable("congress_memberships", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	congressId: uuid("congress_id").notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: congressMembershipStatus("status").default('active').notNull(),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxCongressMembershipsOrgId: index("idx_congress_memberships_org_id").using("btree", table.organizationId.asc().nullsLast()),
		idxCongressMembershipsCongressId: index("idx_congress_memberships_congress_id").using("btree", table.congressId.asc().nullsLast()),
		idxCongressMembershipsStatus: index("idx_congress_memberships_status").using("btree", table.status.asc().nullsLast()).where(sql`(status = 'active')`),
		idxCongressMembershipsJoinedAt: index("idx_congress_memberships_joined_at").using("btree", table.joinedAt.desc().nullsLast()),
		idxCongressMembershipsCongressStatus: index("idx_congress_memberships_congress_status").using("btree", table.congressId.asc().nullsLast(), table.status.asc().nullsLast()).where(sql`(status = 'active')`),
		congressMembershipsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "congress_memberships_organization_id_fkey"
		}).onDelete("cascade"),
		congressMembershipsCongressIdFkey: foreignKey({
			columns: [table.congressId],
			foreignColumns: [organizations.id],
			name: "congress_memberships_congress_id_fkey"
		}).onDelete("cascade"),
		congressMembershipsOrgCongressUnique: unique("congress_memberships_org_congress_unique").on(table.organizationId, table.congressId),
	}
});

export const tenantManagementView = pgTable("tenant_management_view", {
	tenantId: uuid("tenant_id"),
	tenantSlug: text("tenant_slug"),
	tenantName: text("tenant_name"),
	tenantDisplayName: text("tenant_display_name"),
	tenantStatus: text("tenant_status"),
	tenantSettings: jsonb("tenant_settings"),
	tenantCreatedAt: timestamp("tenant_created_at", { withTimezone: true, mode: 'string' }),
	tenantUpdatedAt: timestamp("tenant_updated_at", { withTimezone: true, mode: 'string' }),
});

export const organizationTree = pgTable("organization_tree", {
	id: uuid("id"),
	parentId: uuid("parent_id"),
	name: text("name"),
	slug: text("slug"),
	organizationType: organizationType("organization_type"),
	hierarchyLevel: integer("hierarchy_level"),
	hierarchyPath: text("hierarchy_path"),
	displayPath: text("display_path"),
	fullPath: text("full_path"),
});

export const attestationTemplates = pgTable("attestation_templates", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	templateName: varchar("template_name", { length: 200 }).notNull(),
	templateType: varchar("template_type", { length: 100 }).notNull(),
	signatureType: signatureType("signature_type").notNull(),
	attestationText: text("attestation_text").notNull(),
	legalDisclaimer: text("legal_disclaimer"),
	jurisdictions: jsonb("jurisdictions"),
	clcRequired: boolean("clc_required").default(false),
	soxCompliance: boolean("sox_compliance").default(false),
	version: integer("version").default(1),
	effectiveDate: date("effective_date"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
});

export const clauseLibraryTags = pgTable("clause_library_tags", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	clauseId: uuid("clause_id").notNull(),
	tagName: varchar("tag_name", { length: 50 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by").defaultRandom().notNull(),
},
(table) => {
	return {
		idxClauseTagsClause: index("idx_clause_tags_clause").using("btree", table.clauseId.asc().nullsLast()),
		idxClauseTagsTag: index("idx_clause_tags_tag").using("btree", table.tagName.asc().nullsLast()),
		clauseLibraryTagsClauseIdSharedClauseLibraryIdFk: foreignKey({
			columns: [table.clauseId],
			foreignColumns: [sharedClauseLibrary.id],
			name: "clause_library_tags_clause_id_shared_clause_library_id_fk"
		}).onDelete("cascade"),
	}
});

export const userUuidMapping = pgTable("user_uuid_mapping", {
	userUuid: uuid("user_uuid").defaultRandom().primaryKey().notNull(),
	clerkUserId: text("clerk_user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxUserUuidMappingClerkId: index("idx_user_uuid_mapping_clerk_id").using("btree", table.clerkUserId.asc().nullsLast()),
		userUuidMappingClerkUserIdKey: unique("user_uuid_mapping_clerk_user_id_key").on(table.clerkUserId),
	}
});

export const votingSessions = pgTable("voting_sessions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	title: varchar("title", { length: 500 }).notNull(),
	description: text("description"),
	type: varchar("type", { length: 50 }).notNull(),
	status: varchar("status", { length: 50 }).default('draft').notNull(),
	meetingType: varchar("meeting_type", { length: 50 }).notNull(),
	organizationId: uuid("organization_id").notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
	endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
	scheduledEndTime: timestamp("scheduled_end_time", { withTimezone: true, mode: 'string' }),
	allowAnonymous: boolean("allow_anonymous").default(true),
	requiresQuorum: boolean("requires_quorum").default(true),
	quorumThreshold: integer("quorum_threshold").default(50),
	totalEligibleVoters: integer("total_eligible_voters").default(0),
	settings: jsonb("settings").default({}),
	metadata: jsonb("metadata").default({}),
	encryptionEnabled: boolean("encryption_enabled").default(false),
	encryptionAlgorithm: varchar("encryption_algorithm", { length: 50 }).default('AES-256-GCM'),
	publicKey: text("public_key"),
	keyFingerprint: varchar("key_fingerprint", { length: 128 }),
	escrowKeyShares: jsonb("escrow_key_shares"),
	auditHash: varchar("audit_hash", { length: 128 }),
	blockchainAnchorTx: varchar("blockchain_anchor_tx", { length: 200 }),
	blockchainNetwork: varchar("blockchain_network", { length: 50 }),
	thirdPartyAuditorId: uuid("third_party_auditor_id"),
},
(table) => {
	return {
		idxVotingSessionsAuditHash: index("idx_voting_sessions_audit_hash").using("btree", table.auditHash.asc().nullsLast()),
		idxVotingSessionsBlockchainTx: index("idx_voting_sessions_blockchain_tx").using("btree", table.blockchainAnchorTx.asc().nullsLast()),
	}
});

export const votes = pgTable("votes", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	optionId: uuid("option_id").notNull(),
	voterId: varchar("voter_id", { length: 100 }).notNull(),
	voterHash: varchar("voter_hash", { length: 100 }),
	castAt: timestamp("cast_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isAnonymous: boolean("is_anonymous").default(true),
	voterType: varchar("voter_type", { length: 20 }).default('member'),
	voterMetadata: jsonb("voter_metadata").default({}),
	encryptedBallot: text("encrypted_ballot"),
	encryptionIv: varchar("encryption_iv", { length: 64 }),
	encryptionTag: varchar("encryption_tag", { length: 64 }),
	ballotHash: varchar("ballot_hash", { length: 128 }),
	voteSequence: integer("vote_sequence"),
	merkleProof: jsonb("merkle_proof"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxVotesBallotHash: index("idx_votes_ballot_hash").using("btree", table.ballotHash.asc().nullsLast()),
		idxVotesCreatedAt: index("idx_votes_created_at").using("btree", table.createdAt.asc().nullsLast()),
		idxVotesSequence: index("idx_votes_sequence").using("btree", table.voteSequence.asc().nullsLast()),
		idxVotesUpdatedAt: index("idx_votes_updated_at").using("btree", table.updatedAt.asc().nullsLast()),
		votesOptionIdVotingOptionsIdFk: foreignKey({
			columns: [table.optionId],
			foreignColumns: [votingOptions.id],
			name: "votes_option_id_voting_options_id_fk"
		}).onDelete("cascade"),
		votesSessionIdVotingSessionsIdFk: foreignKey({
			columns: [table.sessionId],
			foreignColumns: [votingSessions.id],
			name: "votes_session_id_voting_sessions_id_fk"
		}).onDelete("cascade"),
	}
});

export const claims = pgTable("claims", {
	claimId: uuid("claim_id").defaultRandom().primaryKey().notNull(),
	claimNumber: varchar("claim_number", { length: 50 }).notNull(),
	memberId: uuid("member_id").notNull(),
	isAnonymous: boolean("is_anonymous").default(true),
	claimType: claimType("claim_type").notNull(),
	status: claimStatus("status").default('submitted'),
	priority: claimPriority("priority").default('medium'),
	incidentDate: date("incident_date").notNull(),
	location: varchar("location", { length: 500 }).notNull(),
	description: text("description").notNull(),
	desiredOutcome: text("desired_outcome").notNull(),
	witnessesPresent: boolean("witnesses_present").default(false),
	witnessDetails: text("witness_details"),
	previouslyReported: boolean("previously_reported").default(false),
	previousReportDetails: text("previous_report_details"),
	assignedTo: uuid("assigned_to"),
	assignedAt: timestamp("assigned_at", { withTimezone: true, mode: 'string' }),
	aiScore: integer("ai_score"),
	aiAnalysis: jsonb("ai_analysis"),
	meritConfidence: integer("merit_confidence"),
	precedentMatch: integer("precedent_match"),
	complexityScore: integer("complexity_score"),
	progress: integer("progress").default(0),
	attachments: jsonb("attachments").default([]),
	voiceTranscriptions: jsonb("voice_transcriptions").default([]),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	closedAt: timestamp("closed_at", { withTimezone: true, mode: 'string' }),
	organizationId: uuid("organization_id"),
	claimAmount: varchar("claim_amount", { length: 20 }),
	settlementAmount: varchar("settlement_amount", { length: 20 }),
	legalCosts: varchar("legal_costs", { length: 20 }),
	courtCosts: varchar("court_costs", { length: 20 }),
	resolutionOutcome: varchar("resolution_outcome", { length: 100 }),
	filedDate: timestamp("filed_date", { withTimezone: true, mode: 'string' }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		idxClaimsAssignedTo: index("idx_claims_assigned_to").using("btree", table.assignedTo.asc().nullsLast()),
		idxClaimsClaimAmount: index("idx_claims_claim_amount").using("btree", table.claimAmount.asc().nullsLast()).where(sql`(claim_amount IS NOT NULL)`),
		idxClaimsClaimNumber: index("idx_claims_claim_number").using("btree", table.claimNumber.asc().nullsLast()),
		idxClaimsCreatedAt: index("idx_claims_created_at").using("btree", table.createdAt.desc().nullsFirst()),
		idxClaimsFiledDate: index("idx_claims_filed_date").using("btree", table.filedDate.desc().nullsFirst()).where(sql`(filed_date IS NOT NULL)`),
		idxClaimsFinancialTracking: index("idx_claims_financial_tracking").using("btree", table.organizationId.asc().nullsLast(), table.status.asc().nullsLast(), table.claimAmount.asc().nullsLast()).where(sql`(claim_amount IS NOT NULL)`),
		idxClaimsIncidentDate: index("idx_claims_incident_date").using("btree", table.incidentDate.desc().nullsFirst()),
		idxClaimsMemberId: index("idx_claims_member_id").using("btree", table.memberId.asc().nullsLast()),
		idxClaimsOrganizationId: index("idx_claims_organization_id").using("btree", table.organizationId.asc().nullsLast()),
		idxClaimsPriority: index("idx_claims_priority").using("btree", table.priority.asc().nullsLast()),
		idxClaimsResolutionOutcome: index("idx_claims_resolution_outcome").using("btree", table.resolutionOutcome.asc().nullsLast()).where(sql`(resolution_outcome IS NOT NULL)`),
		idxClaimsResolvedAt: index("idx_claims_resolved_at").using("btree", table.resolvedAt.desc().nullsFirst()).where(sql`(resolved_at IS NOT NULL)`),
		idxClaimsSettlementAmount: index("idx_claims_settlement_amount").using("btree", table.settlementAmount.asc().nullsLast()).where(sql`(settlement_amount IS NOT NULL)`),
		idxClaimsStatus: index("idx_claims_status").using("btree", table.status.asc().nullsLast()),
		claimsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "claims_organization_id_fkey"
		}),
		fkClaimsAssignedTo: foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [profiles.userId],
			name: "fk_claims_assigned_to"
		}).onDelete("set null"),
		fkClaimsMember: foreignKey({
			columns: [table.memberId],
			foreignColumns: [profiles.userId],
			name: "fk_claims_member"
		}).onDelete("cascade"),
		claimsClaimNumberKey: unique("claims_claim_number_key").on(table.claimNumber),
	}
});

export const organizations = pgTable("organizations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	slug: text("slug").notNull(),
	displayName: text("display_name"),
	shortName: text("short_name"),
	organizationType: organizationType("organization_type").notNull(),
	parentId: uuid("parent_id"),
	hierarchyPath: text("hierarchy_path").array(),
	hierarchyLevel: integer("hierarchy_level").default(0).notNull(),
	provinceTerritory: text("province_territory"),
	sectors: labourSector("sectors").array().default([]),
	email: text("email"),
	phone: text("phone"),
	website: text("website"),
	address: jsonb("address"),
	clcAffiliated: boolean("clc_affiliated").default(false),
	affiliationDate: date("affiliation_date"),
	charterNumber: text("charter_number"),
	memberCount: integer("member_count").default(0),
	activeMemberCount: integer("active_member_count").default(0),
	lastMemberCountUpdate: timestamp("last_member_count_update", { withTimezone: true, mode: 'string' }),
	subscriptionTier: text("subscription_tier"),
	billingContactId: uuid("billing_contact_id"),
	settings: jsonb("settings").default({}),
	featuresEnabled: text("features_enabled").array().default([""]),
	status: text("status").default('active'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
	legacyTenantId: uuid("legacy_tenant_id"),
	clcAffiliateCode: varchar("clc_affiliate_code", { length: 20 }),
	perCapitaRate: numeric("per_capita_rate", { precision: 10, scale:  2 }),
	remittanceDay: integer("remittance_day").default(15),
	lastRemittanceDate: timestamp("last_remittance_date", { withTimezone: true, mode: 'string' }),
	fiscalYearEnd: date("fiscal_year_end").default('2024-12-31'),
	legalName: varchar("legal_name", { length: 255 }),
	businessNumber: text("business_number"),
},
(table) => {
	return {
		idxOrganizationsClcAffiliated: index("idx_organizations_clc_affiliated").using("btree", table.clcAffiliated.asc().nullsLast()).where(sql`(clc_affiliated = true)`),
		idxOrganizationsClcCode: index("idx_organizations_clc_code").using("btree", table.clcAffiliateCode.asc().nullsLast()).where(sql`(clc_affiliate_code IS NOT NULL)`),
		idxOrganizationsHierarchyLevel: index("idx_organizations_hierarchy_level").using("btree", table.hierarchyLevel.asc().nullsLast()),
		idxOrganizationsHierarchyPath: index("idx_organizations_hierarchy_path").using("gin", table.hierarchyPath.asc().nullsLast()),
		idxOrganizationsLegacyTenant: index("idx_organizations_legacy_tenant").using("btree", table.legacyTenantId.asc().nullsLast()).where(sql`(legacy_tenant_id IS NOT NULL)`),
		idxOrganizationsParent: index("idx_organizations_parent").using("btree", table.parentId.asc().nullsLast()).where(sql`(parent_id IS NOT NULL)`),
		idxOrganizationsSectors: index("idx_organizations_sectors").using("gin", table.sectors.asc().nullsLast()),
		idxOrganizationsSlug: index("idx_organizations_slug").using("btree", table.slug.asc().nullsLast()),
		idxOrganizationsStatus: index("idx_organizations_status").using("btree", table.status.asc().nullsLast()),
		idxOrganizationsType: index("idx_organizations_type").using("btree", table.organizationType.asc().nullsLast()),
		organizationsParentIdFkey: foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "organizations_parent_id_fkey"
		}).onDelete("restrict"),
		organizationsSlugKey: unique("organizations_slug_key").on(table.slug),
	}
});

export const comparativeAnalyses = pgTable("comparative_analyses", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	analysisName: text("analysis_name").notNull(),
	comparisonType: text("comparison_type").notNull(),
	organizationIds: jsonb("organization_ids"),
	metrics: jsonb("metrics").notNull(),
	timeRange: jsonb("time_range").notNull(),
	results: jsonb("results").notNull(),
	benchmarks: jsonb("benchmarks"),
	organizationRanking: jsonb("organization_ranking"),
	gaps: jsonb("gaps"),
	strengths: jsonb("strengths"),
	recommendations: jsonb("recommendations"),
	visualizationData: jsonb("visualization_data"),
	isPublic: boolean("is_public").default(false),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		createdByIdx: index("comparative_analyses_created_by_idx").using("btree", table.createdBy.asc().nullsLast()),
		createdIdx: index("comparative_analyses_created_idx").using("btree", table.createdAt.asc().nullsLast()),
		orgIdx: index("comparative_analyses_org_idx").using("btree", table.organizationId.asc().nullsLast()),
		typeIdx: index("comparative_analyses_type_idx").using("btree", table.comparisonType.asc().nullsLast()),
		comparativeAnalysesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "comparative_analyses_organization_id_fkey"
		}).onDelete("cascade"),
	}
});

export const perCapitaRemittances = pgTable("per_capita_remittances", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	fromOrganizationId: uuid("from_organization_id").notNull(),
	toOrganizationId: uuid("to_organization_id").notNull(),
	remittanceMonth: integer("remittance_month").notNull(),
	remittanceYear: integer("remittance_year").notNull(),
	dueDate: date("due_date").notNull(),
	totalMembers: integer("total_members").notNull(),
	goodStandingMembers: integer("good_standing_members").notNull(),
	remittableMembers: integer("remittable_members").notNull(),
	perCapitaRate: numeric("per_capita_rate", { precision: 10, scale:  2 }).notNull(),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }).notNull(),
	currency: varchar("currency", { length: 3 }).default('CAD'),
	clcAccountCode: varchar("clc_account_code", { length: 50 }),
	glAccount: varchar("gl_account", { length: 50 }),
	status: varchar("status", { length: 20 }).default('pending'),
	submittedDate: timestamp("submitted_date", { withTimezone: true, mode: 'string' }),
	paidDate: timestamp("paid_date", { withTimezone: true, mode: 'string' }),
	paymentMethod: varchar("payment_method", { length: 50 }),
	paymentReference: varchar("payment_reference", { length: 100 }),
	remittanceFileUrl: text("remittance_file_url"),
	receiptFileUrl: text("receipt_file_url"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxRemittancesDueDate: index("idx_remittances_due_date").using("btree", table.dueDate.asc().nullsLast()),
		idxRemittancesFromOrg: index("idx_remittances_from_org").using("btree", table.fromOrganizationId.asc().nullsLast()),
		idxRemittancesToOrg: index("idx_remittances_to_org").using("btree", table.toOrganizationId.asc().nullsLast()),
		perCapitaRemittancesFromOrganizationIdFkey: foreignKey({
			columns: [table.fromOrganizationId],
			foreignColumns: [organizations.id],
			name: "per_capita_remittances_from_organization_id_fkey"
		}),
		perCapitaRemittancesToOrganizationIdFkey: foreignKey({
			columns: [table.toOrganizationId],
			foreignColumns: [organizations.id],
			name: "per_capita_remittances_to_organization_id_fkey"
		}),
		uniqueOrgRemittancePeriod: unique("unique_org_remittance_period").on(table.fromOrganizationId, table.toOrganizationId, table.remittanceMonth, table.remittanceYear),
	}
});

export const clcChartOfAccounts = pgTable("clc_chart_of_accounts", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	accountCode: varchar("account_code", { length: 50 }).notNull(),
	accountName: varchar("account_name", { length: 255 }).notNull(),
	accountType: varchar("account_type", { length: 50 }).notNull(),
	parentAccountCode: varchar("parent_account_code", { length: 50 }),
	isActive: boolean("is_active").default(true),
	description: text("description"),
	financialStatementLine: varchar("financial_statement_line", { length: 100 }),
	statisticsCanadaCode: varchar("statistics_canada_code", { length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxClcAccountsCode: index("idx_clc_accounts_code").using("btree", table.accountCode.asc().nullsLast()),
		idxClcAccountsParent: index("idx_clc_accounts_parent").using("btree", table.parentAccountCode.asc().nullsLast()),
		idxClcAccountsType: index("idx_clc_accounts_type").using("btree", table.accountType.asc().nullsLast()),
		idxCoaCode: index("idx_coa_code").using("btree", table.accountCode.asc().nullsLast()),
		idxCoaParent: index("idx_coa_parent").using("btree", table.parentAccountCode.asc().nullsLast()),
		idxCoaType: index("idx_coa_type").using("btree", table.accountType.asc().nullsLast()),
		clcChartOfAccountsAccountCodeKey: unique("clc_chart_of_accounts_account_code_key").on(table.accountCode),
	}
});

export const transactionClcMappings = pgTable("transaction_clc_mappings", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	transactionType: varchar("transaction_type", { length: 50 }).notNull(),
	transactionId: uuid("transaction_id").notNull(),
	transactionDate: date("transaction_date").notNull(),
	clcAccountCode: varchar("clc_account_code", { length: 50 }).notNull(),
	glAccount: varchar("gl_account", { length: 50 }),
	amount: numeric("amount", { precision: 12, scale:  2 }).notNull(),
	currency: varchar("currency", { length: 3 }).default('CAD'),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxClcMappingsAccount: index("idx_clc_mappings_account").using("btree", table.clcAccountCode.asc().nullsLast()),
		idxClcMappingsDate: index("idx_clc_mappings_date").using("btree", table.transactionDate.asc().nullsLast()),
		idxClcMappingsOrg: index("idx_clc_mappings_org").using("btree", table.organizationId.asc().nullsLast()),
		idxClcMappingsTransaction: index("idx_clc_mappings_transaction").using("btree", table.transactionType.asc().nullsLast(), table.transactionId.asc().nullsLast()),
		idxMappingsAccount: index("idx_mappings_account").using("btree", table.clcAccountCode.asc().nullsLast()),
		idxMappingsTransaction: index("idx_mappings_transaction").using("btree", table.transactionId.asc().nullsLast()),
		transactionClcMappingsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "transaction_clc_mappings_organization_id_fkey"
		}),
		uniqueTransactionMapping: unique("unique_transaction_mapping").on(table.transactionType, table.transactionId, table.clcAccountCode),
	}
});

export const messageThreads = pgTable("message_threads", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	subject: text("subject").notNull(),
	memberId: text("member_id").notNull(),
	staffId: text("staff_id"),
	organizationId: uuid("organization_id").notNull(),
	status: text("status").default('open').notNull(),
	priority: text("priority").default('normal'),
	category: text("category"),
	isArchived: boolean("is_archived").default(false),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxMessageThreadsMemberId: index("idx_message_threads_member_id").using("btree", table.memberId.asc().nullsLast()),
		idxMessageThreadsOrganizationId: index("idx_message_threads_organization_id").using("btree", table.organizationId.asc().nullsLast()),
		idxMessageThreadsStaffId: index("idx_message_threads_staff_id").using("btree", table.staffId.asc().nullsLast()),
	}
});

export const votingAuditors = pgTable("voting_auditors", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	auditorName: varchar("auditor_name", { length: 200 }).notNull(),
	auditorType: varchar("auditor_type", { length: 50 }).notNull(),
	organizationName: varchar("organization_name", { length: 200 }),
	organizationWebsite: varchar("organization_website", { length: 500 }),
	registrationNumber: varchar("registration_number", { length: 100 }),
	contactPerson: varchar("contact_person", { length: 200 }),
	contactEmail: varchar("contact_email", { length: 255 }).notNull(),
	contactPhone: varchar("contact_phone", { length: 50 }),
	publicKey: text("public_key").notNull(),
	keyFingerprint: varchar("key_fingerprint", { length: 128 }).notNull(),
	certificate: text("certificate"),
	isClcCertified: boolean("is_clc_certified").default(false),
	isActive: boolean("is_active").default(true),
	certificationExpiresAt: date("certification_expires_at"),
	apiKeyHash: varchar("api_key_hash", { length: 128 }),
	apiRateLimit: integer("api_rate_limit").default(1000),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxVotingAuditorsActive: index("idx_voting_auditors_active").using("btree", table.isActive.asc().nullsLast()),
		idxVotingAuditorsClc: index("idx_voting_auditors_clc").using("btree", table.isClcCertified.asc().nullsLast()),
		votingAuditorsKeyFingerprintKey: unique("voting_auditors_key_fingerprint_key").on(table.keyFingerprint),
	}
});

export const trustedCertificateAuthorities = pgTable("trusted_certificate_authorities", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	caName: varchar("ca_name", { length: 200 }).notNull(),
	caType: varchar("ca_type", { length: 50 }).notNull(),
	issuerDn: varchar("issuer_dn", { length: 500 }).notNull(),
	rootCertificate: text("root_certificate").notNull(),
	rootCertificateThumbprint: varchar("root_certificate_thumbprint", { length: 128 }).notNull(),
	isTrusted: boolean("is_trusted").default(true),
	trustLevel: varchar("trust_level", { length: 50 }).default('high'),
	validFrom: timestamp("valid_from", { withTimezone: true, mode: 'string' }),
	validUntil: timestamp("valid_until", { withTimezone: true, mode: 'string' }),
	crlUrl: text("crl_url"),
	crlLastUpdated: timestamp("crl_last_updated", { withTimezone: true, mode: 'string' }),
	ocspUrl: text("ocsp_url"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxTrustedCasIssuer: index("idx_trusted_cas_issuer").using("btree", table.issuerDn.asc().nullsLast()),
		idxTrustedCasThumbprint: index("idx_trusted_cas_thumbprint").using("btree", table.rootCertificateThumbprint.asc().nullsLast()),
		trustedCertificateAuthoritiesIssuerDnKey: unique("trusted_certificate_authorities_issuer_dn_key").on(table.issuerDn),
		trustedCertificateAuthoritiesRootCertificateThumbprintKey: unique("trusted_certificate_authorities_root_certificate_thumbprint_key").on(table.rootCertificateThumbprint),
	}
});

export const signatureAuditLog = pgTable("signature_audit_log", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	signatureId: uuid("signature_id").notNull(),
	eventType: varchar("event_type", { length: 50 }).notNull(),
	eventTimestamp: timestamp("event_timestamp", { withTimezone: true, mode: 'string' }).defaultNow(),
	actorUserId: uuid("actor_user_id"),
	actorName: varchar("actor_name", { length: 200 }),
	actorRole: varchar("actor_role", { length: 100 }),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	eventData: jsonb("event_data"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxSignatureAuditLogCreatedAt: index("idx_signature_audit_log_created_at").using("btree", table.createdAt.asc().nullsLast()),
		idxSignatureAuditLogUpdatedAt: index("idx_signature_audit_log_updated_at").using("btree", table.updatedAt.asc().nullsLast()),
		idxSignatureAuditSignature: index("idx_signature_audit_signature").using("btree", table.signatureId.asc().nullsLast()),
		idxSignatureAuditTimestamp: index("idx_signature_audit_timestamp").using("btree", table.eventTimestamp.asc().nullsLast()),
	}
});

export const votingSessionAuditors = pgTable("voting_session_auditors", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	votingSessionId: uuid("voting_session_id").notNull(),
	auditorId: uuid("auditor_id").notNull(),
	assignedAt: timestamp("assigned_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	assignedBy: uuid("assigned_by"),
	auditorPublicKey: text("auditor_public_key").notNull(),
	accessLevel: varchar("access_level", { length: 50 }).default('observer'),
	verificationStatus: varchar("verification_status", { length: 50 }),
	verificationStartedAt: timestamp("verification_started_at", { withTimezone: true, mode: 'string' }),
	verificationCompletedAt: timestamp("verification_completed_at", { withTimezone: true, mode: 'string' }),
	verificationReportUrl: text("verification_report_url"),
	issuesFound: integer("issues_found").default(0),
	severity: varchar("severity", { length: 50 }),
	findingsSummary: text("findings_summary"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxSessionAuditorsAuditor: index("idx_session_auditors_auditor").using("btree", table.auditorId.asc().nullsLast()),
		idxSessionAuditorsSession: index("idx_session_auditors_session").using("btree", table.votingSessionId.asc().nullsLast()),
		idxSessionAuditorsStatus: index("idx_session_auditors_status").using("btree", table.verificationStatus.asc().nullsLast()),
		votingSessionAuditorsAuditorIdFkey: foreignKey({
			columns: [table.auditorId],
			foreignColumns: [votingAuditors.id],
			name: "voting_session_auditors_auditor_id_fkey"
		}),
		votingSessionAuditorsVotingSessionIdFkey: foreignKey({
			columns: [table.votingSessionId],
			foreignColumns: [votingSessions.id],
			name: "voting_session_auditors_voting_session_id_fkey"
		}).onDelete("cascade"),
		uniqueSessionAuditor: unique("unique_session_auditor").on(table.votingSessionId, table.auditorId),
	}
});

export const blockchainAuditAnchors = pgTable("blockchain_audit_anchors", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	votingSessionId: uuid("voting_session_id").notNull(),
	blockchainNetwork: varchar("blockchain_network", { length: 50 }).notNull(),
	networkType: varchar("network_type", { length: 50 }).default('mainnet'),
	transactionHash: varchar("transaction_hash", { length: 200 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	blockNumber: bigint("block_number", { mode: "number" }),
	blockHash: varchar("block_hash", { length: 200 }),
	blockTimestamp: timestamp("block_timestamp", { withTimezone: true, mode: 'string' }),
	merkleRootHash: varchar("merkle_root_hash", { length: 128 }).notNull(),
	metadataHash: varchar("metadata_hash", { length: 128 }),
	totalVotesCount: integer("total_votes_count"),
	contractAddress: varchar("contract_address", { length: 200 }),
	contractMethod: varchar("contract_method", { length: 100 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gasUsed: bigint("gas_used", { mode: "number" }),
	gasPriceGwei: numeric("gas_price_gwei", { precision: 20, scale:  9 }),
	transactionFeeEth: numeric("transaction_fee_eth", { precision: 20, scale:  18 }),
	transactionFeeUsd: numeric("transaction_fee_usd", { precision: 12, scale:  2 }),
	isConfirmed: boolean("is_confirmed").default(false),
	confirmationsRequired: integer("confirmations_required").default(6),
	currentConfirmations: integer("current_confirmations").default(0),
	explorerUrl: text("explorer_url"),
	proofUrl: text("proof_url"),
	status: varchar("status", { length: 50 }).default('pending'),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	anchoredBy: uuid("anchored_by"),
},
(table) => {
	return {
		idxBlockchainAnchorsBlock: index("idx_blockchain_anchors_block").using("btree", table.blockNumber.asc().nullsLast()),
		idxBlockchainAnchorsSession: index("idx_blockchain_anchors_session").using("btree", table.votingSessionId.asc().nullsLast()),
		idxBlockchainAnchorsStatus: index("idx_blockchain_anchors_status").using("btree", table.status.asc().nullsLast()),
		idxBlockchainAnchorsTx: index("idx_blockchain_anchors_tx").using("btree", table.transactionHash.asc().nullsLast()),
		blockchainAuditAnchorsVotingSessionIdFkey: foreignKey({
			columns: [table.votingSessionId],
			foreignColumns: [votingSessions.id],
			name: "blockchain_audit_anchors_voting_session_id_fkey"
		}),
		blockchainAuditAnchorsTransactionHashKey: unique("blockchain_audit_anchors_transaction_hash_key").on(table.transactionHash),
	}
});

export const voteMerkleTree = pgTable("vote_merkle_tree", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	votingSessionId: uuid("voting_session_id").notNull(),
	treeLevel: integer("tree_level").notNull(),
	nodeIndex: integer("node_index").notNull(),
	nodeHash: varchar("node_hash", { length: 128 }).notNull(),
	parentNodeId: uuid("parent_node_id"),
	leftChildId: uuid("left_child_id"),
	rightChildId: uuid("right_child_id"),
	voteId: uuid("vote_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxMerkleTreeLevel: index("idx_merkle_tree_level").using("btree", table.treeLevel.asc().nullsLast(), table.nodeIndex.asc().nullsLast()),
		idxMerkleTreeParent: index("idx_merkle_tree_parent").using("btree", table.parentNodeId.asc().nullsLast()),
		idxMerkleTreeSession: index("idx_merkle_tree_session").using("btree", table.votingSessionId.asc().nullsLast()),
		idxMerkleTreeVote: index("idx_merkle_tree_vote").using("btree", table.voteId.asc().nullsLast()),
		voteMerkleTreeLeftChildIdFkey: foreignKey({
			columns: [table.leftChildId],
			foreignColumns: [table.id],
			name: "vote_merkle_tree_left_child_id_fkey"
		}),
		voteMerkleTreeParentNodeIdFkey: foreignKey({
			columns: [table.parentNodeId],
			foreignColumns: [table.id],
			name: "vote_merkle_tree_parent_node_id_fkey"
		}),
		voteMerkleTreeRightChildIdFkey: foreignKey({
			columns: [table.rightChildId],
			foreignColumns: [table.id],
			name: "vote_merkle_tree_right_child_id_fkey"
		}),
		voteMerkleTreeVoteIdFkey: foreignKey({
			columns: [table.voteId],
			foreignColumns: [votes.id],
			name: "vote_merkle_tree_vote_id_fkey"
		}),
		voteMerkleTreeVotingSessionIdFkey: foreignKey({
			columns: [table.votingSessionId],
			foreignColumns: [votingSessions.id],
			name: "vote_merkle_tree_voting_session_id_fkey"
		}),
		uniqueTreePosition: unique("unique_tree_position").on(table.votingSessionId, table.treeLevel, table.nodeIndex),
	}
});

export const vPendingRemittances = pgTable("v_pending_remittances", {
	organizationId: uuid("organization_id"),
	organizationName: text("organization_name"),
	clcAffiliateCode: varchar("clc_affiliate_code", { length: 20 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pendingCount: bigint("pending_count", { mode: "number" }),
	totalPending: numeric("total_pending"),
	earliestDueDate: date("earliest_due_date"),
	latestDueDate: date("latest_due_date"),
});

export const vAnnualRemittanceSummary = pgTable("v_annual_remittance_summary", {
	organizationId: uuid("organization_id"),
	organizationName: text("organization_name"),
	clcAffiliateCode: varchar("clc_affiliate_code", { length: 20 }),
	hierarchyLevel: integer("hierarchy_level"),
	remittanceYear: integer("remittance_year"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	remittanceCount: bigint("remittance_count", { mode: "number" }),
	totalRemitted: numeric("total_remitted"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalMembers: bigint("total_members", { mode: "number" }),
	avgPerCapitaRate: numeric("avg_per_capita_rate"),
});

export const votingSessionKeys = pgTable("voting_session_keys", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	votingSessionId: uuid("voting_session_id").notNull(),
	publicKey: text("public_key").notNull(),
	privateKeyEncrypted: text("private_key_encrypted").notNull(),
	encryptionAlgorithm: varchar("encryption_algorithm", { length: 50 }).default('RSA-4096'),
	keyDerivationFunction: varchar("key_derivation_function", { length: 50 }).default('PBKDF2'),
	kdfIterations: integer("kdf_iterations").default(100000),
	kdfSalt: varchar("kdf_salt", { length: 64 }),
	secretSharesTotal: integer("secret_shares_total").default(5),
	secretSharesThreshold: integer("secret_shares_threshold").default(3),
	secretShare1Encrypted: text("secret_share_1_encrypted"),
	secretShare2Encrypted: text("secret_share_2_encrypted"),
	secretShare3Encrypted: text("secret_share_3_encrypted"),
	secretShare4Encrypted: text("secret_share_4_encrypted"),
	secretShare5Encrypted: text("secret_share_5_encrypted"),
	custodian1UserId: uuid("custodian_1_user_id"),
	custodian2UserId: uuid("custodian_2_user_id"),
	custodian3UserId: uuid("custodian_3_user_id"),
	custodian4UserId: uuid("custodian_4_user_id"),
	custodian5UserId: uuid("custodian_5_user_id"),
	generatedAt: timestamp("generated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true),
	encryptionCount: integer("encryption_count").default(0),
	decryptionCount: integer("decryption_count").default(0),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxSessionKeysActive: index("idx_session_keys_active").using("btree", table.isActive.asc().nullsLast()),
		idxSessionKeysSession: index("idx_session_keys_session").using("btree", table.votingSessionId.asc().nullsLast()),
		votingSessionKeysVotingSessionIdFkey: foreignKey({
			columns: [table.votingSessionId],
			foreignColumns: [votingSessions.id],
			name: "voting_session_keys_voting_session_id_fkey"
		}),
		votingSessionKeysVotingSessionIdKey: unique("voting_session_keys_voting_session_id_key").on(table.votingSessionId),
	}
});

export const messages = pgTable("messages", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	threadId: uuid("thread_id").notNull(),
	senderId: text("sender_id").notNull(),
	senderRole: text("sender_role").notNull(),
	messageType: messageType("message_type").default('text').notNull(),
	content: text("content"),
	fileUrl: text("file_url"),
	fileName: text("file_name"),
	fileSize: text("file_size"),
	status: messageStatus("status").default('sent').notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	isEdited: boolean("is_edited").default(false),
	editedAt: timestamp("edited_at", { mode: 'string' }),
	metadata: text("metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxMessagesCreatedAt: index("idx_messages_created_at").using("btree", table.createdAt.asc().nullsLast()),
		idxMessagesThreadId: index("idx_messages_thread_id").using("btree", table.threadId.asc().nullsLast()),
		messagesThreadIdMessageThreadsIdFk: foreignKey({
			columns: [table.threadId],
			foreignColumns: [messageThreads.id],
			name: "messages_thread_id_message_threads_id_fk"
		}).onDelete("cascade"),
	}
});

export const organizationHierarchyAudit = pgTable("organization_hierarchy_audit", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	changeType: varchar("change_type", { length: 50 }).notNull(),
	oldParentId: uuid("old_parent_id"),
	newParentId: uuid("new_parent_id"),
	oldHierarchyLevel: integer("old_hierarchy_level"),
	newHierarchyLevel: integer("new_hierarchy_level"),
	oldClcCode: varchar("old_clc_code", { length: 20 }),
	newClcCode: varchar("new_clc_code", { length: 20 }),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	changedBy: uuid("changed_by"),
	reason: text("reason"),
	oldHierarchyPath: uuid("old_hierarchy_path").array(),
	newHierarchyPath: uuid("new_hierarchy_path").array(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxAuditDate: index("idx_audit_date").using("btree", table.changedAt.asc().nullsLast()),
		idxAuditOrg: index("idx_audit_org").using("btree", table.organizationId.asc().nullsLast()),
		idxAuditType: index("idx_audit_type").using("btree", table.changeType.asc().nullsLast()),
		idxHierarchyAuditDate: index("idx_hierarchy_audit_date").using("btree", table.changedAt.asc().nullsLast()),
		idxHierarchyAuditOrg: index("idx_hierarchy_audit_org").using("btree", table.organizationId.asc().nullsLast()),
		idxHierarchyAuditType: index("idx_hierarchy_audit_type").using("btree", table.changeType.asc().nullsLast()),
		idxOrganizationHierarchyAuditCreatedAt: index("idx_organization_hierarchy_audit_created_at").using("btree", table.createdAt.asc().nullsLast()),
		idxOrganizationHierarchyAuditUpdatedAt: index("idx_organization_hierarchy_audit_updated_at").using("btree", table.updatedAt.asc().nullsLast()),
		organizationHierarchyAuditOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "organization_hierarchy_audit_organization_id_fkey"
		}),
	}
});

export const votingKeyAccessLog = pgTable("voting_key_access_log", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	sessionKeyId: uuid("session_key_id").notNull(),
	accessType: varchar("access_type", { length: 50 }).notNull(),
	accessedBy: uuid("accessed_by").notNull(),
	accessReason: text("access_reason"),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	success: boolean("success"),
	errorMessage: text("error_message"),
	accessedAt: timestamp("accessed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxKeyAccessLogKey: index("idx_key_access_log_key").using("btree", table.sessionKeyId.asc().nullsLast()),
		idxKeyAccessLogTime: index("idx_key_access_log_time").using("btree", table.accessedAt.asc().nullsLast()),
		idxKeyAccessLogUser: index("idx_key_access_log_user").using("btree", table.accessedBy.asc().nullsLast()),
		idxVotingKeyAccessLogCreatedAt: index("idx_voting_key_access_log_created_at").using("btree", table.createdAt.asc().nullsLast()),
		idxVotingKeyAccessLogUpdatedAt: index("idx_voting_key_access_log_updated_at").using("btree", table.updatedAt.asc().nullsLast()),
		votingKeyAccessLogSessionKeyIdFkey: foreignKey({
			columns: [table.sessionKeyId],
			foreignColumns: [votingSessionKeys.id],
			name: "voting_key_access_log_session_key_id_fkey"
		}),
	}
});

export const messageReadReceipts = pgTable("message_read_receipts", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	messageId: uuid("message_id").notNull(),
	userId: text("user_id").notNull(),
	readAt: timestamp("read_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		messageReadReceiptsMessageIdMessagesIdFk: foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_read_receipts_message_id_messages_id_fk"
		}).onDelete("cascade"),
	}
});

export const messageParticipants = pgTable("message_participants", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	threadId: uuid("thread_id").notNull(),
	userId: text("user_id").notNull(),
	role: text("role").notNull(),
	isActive: boolean("is_active").default(true),
	lastReadAt: timestamp("last_read_at", { mode: 'string' }),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow().notNull(),
	leftAt: timestamp("left_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		messageParticipantsThreadIdMessageThreadsIdFk: foreignKey({
			columns: [table.threadId],
			foreignColumns: [messageThreads.id],
			name: "message_participants_thread_id_message_threads_id_fk"
		}).onDelete("cascade"),
	}
});

export const jurisdictionRules = pgTable("jurisdiction_rules", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	jurisdiction: caJurisdiction("jurisdiction").notNull(),
	ruleType: jurisdictionRuleType("rule_type").notNull(),
	ruleCategory: text("rule_category").notNull(),
	ruleName: text("rule_name").notNull(),
	description: text("description"),
	legalReference: text("legal_reference").notNull(),
	ruleParameters: jsonb("rule_parameters").default({}).notNull(),
	appliesToSectors: text("applies_to_sectors").array(),
	version: integer("version").default(1).notNull(),
	effectiveDate: date("effective_date").default(sql`CURRENT_DATE`).notNull(),
	expiryDate: date("expiry_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	notes: text("notes"),
},
(table) => {
	return {
		idxJurisdictionRulesActive: index("idx_jurisdiction_rules_active").using("btree", table.jurisdiction.asc().nullsLast(), table.ruleCategory.asc().nullsLast(), table.version.asc().nullsLast()),
		idxJurisdictionRulesCategory: index("idx_jurisdiction_rules_category").using("btree", table.ruleCategory.asc().nullsLast()),
		idxJurisdictionRulesEffective: index("idx_jurisdiction_rules_effective").using("btree", table.effectiveDate.asc().nullsLast()),
		idxJurisdictionRulesJurisdiction: index("idx_jurisdiction_rules_jurisdiction").using("btree", table.jurisdiction.asc().nullsLast()),
		idxJurisdictionRulesParams: index("idx_jurisdiction_rules_params").using("gin", table.ruleParameters.asc().nullsLast()),
		idxJurisdictionRulesSectors: index("idx_jurisdiction_rules_sectors").using("gin", table.appliesToSectors.asc().nullsLast()).where(sql`(applies_to_sectors IS NOT NULL)`),
		idxJurisdictionRulesType: index("idx_jurisdiction_rules_type").using("btree", table.ruleType.asc().nullsLast()),
	}
});

export const statutoryHolidays = pgTable("statutory_holidays", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	jurisdiction: caJurisdiction("jurisdiction").notNull(),
	holidayDate: date("holiday_date").notNull(),
	holidayName: text("holiday_name").notNull(),
	holidayNameFr: text("holiday_name_fr"),
	affectsDeadlines: boolean("affects_deadlines").default(true).notNull(),
	isOptional: boolean("is_optional").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	notes: text("notes"),
},
(table) => {
	return {
		idxStatutoryHolidaysAffects: index("idx_statutory_holidays_affects").using("btree", table.jurisdiction.asc().nullsLast(), table.affectsDeadlines.asc().nullsLast()).where(sql`(affects_deadlines = true)`),
		idxStatutoryHolidaysDate: index("idx_statutory_holidays_date").using("btree", table.holidayDate.asc().nullsLast()),
		idxStatutoryHolidaysJurisdiction: index("idx_statutory_holidays_jurisdiction").using("btree", table.jurisdiction.asc().nullsLast()),
		idxStatutoryHolidaysYear: index("idx_statutory_holidays_year").using("btree", sql`EXTRACT(year FROM holiday_date)`),
		uniqueJurisdictionHoliday: unique("unique_jurisdiction_holiday").on(table.jurisdiction, table.holidayDate),
	}
});

export const complianceValidations = pgTable("compliance_validations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	referenceType: text("reference_type").notNull(),
	referenceId: uuid("reference_id").notNull(),
	ruleId: uuid("rule_id").notNull(),
	validationDate: timestamp("validation_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isCompliant: boolean("is_compliant").notNull(),
	validationMessage: text("validation_message"),
	requiresAction: boolean("requires_action").default(false).notNull(),
	actionDeadline: date("action_deadline"),
	actionTaken: text("action_taken"),
	validatedBy: uuid("validated_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxComplianceValidationsAction: index("idx_compliance_validations_action").using("btree", table.organizationId.asc().nullsLast(), table.requiresAction.asc().nullsLast()).where(sql`(requires_action = true)`),
		idxComplianceValidationsDate: index("idx_compliance_validations_date").using("btree", table.validationDate.asc().nullsLast()),
		idxComplianceValidationsOrg: index("idx_compliance_validations_org").using("btree", table.organizationId.asc().nullsLast()),
		idxComplianceValidationsReference: index("idx_compliance_validations_reference").using("btree", table.referenceType.asc().nullsLast(), table.referenceId.asc().nullsLast()),
		idxComplianceValidationsRule: index("idx_compliance_validations_rule").using("btree", table.ruleId.asc().nullsLast()),
		complianceValidationsRuleIdFkey: foreignKey({
			columns: [table.ruleId],
			foreignColumns: [jurisdictionRules.id],
			name: "compliance_validations_rule_id_fkey"
		}),
		fkRule: foreignKey({
			columns: [table.ruleId],
			foreignColumns: [jurisdictionRules.id],
			name: "fk_rule"
		}),
	}
});

export const messageNotifications = pgTable("message_notifications", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	messageId: uuid("message_id").notNull(),
	threadId: uuid("thread_id").notNull(),
	isRead: boolean("is_read").default(false),
	readAt: timestamp("read_at", { mode: 'string' }),
	notifiedAt: timestamp("notified_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxMessageNotificationsIsRead: index("idx_message_notifications_is_read").using("btree", table.isRead.asc().nullsLast()),
		idxMessageNotificationsUserId: index("idx_message_notifications_user_id").using("btree", table.userId.asc().nullsLast()),
		messageNotificationsMessageIdMessagesIdFk: foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "message_notifications_message_id_messages_id_fk"
		}).onDelete("cascade"),
		messageNotificationsThreadIdMessageThreadsIdFk: foreignKey({
			columns: [table.threadId],
			foreignColumns: [messageThreads.id],
			name: "message_notifications_thread_id_message_threads_id_fk"
		}).onDelete("cascade"),
	}
});

export const encryptionKeys = pgTable("encryption_keys", {
	keyId: uuid("key_id").defaultRandom().primaryKey().notNull(),
	keyName: varchar("key_name", { length: 100 }).notNull(),
	keyValue: text("key_value").notNull(), // bytea stored as base64 text
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	rotatedAt: timestamp("rotated_at", { mode: 'string' }),
	isActive: boolean("is_active").default(true),
	createdBy: text("created_by").notNull(),
},
(table) => {
	return {
		encryptionKeysKeyNameKey: unique("encryption_keys_key_name_key").on(table.keyName),
	}
});

export const members = pgTable("members", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	userId: uuid("user_id"),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	email: varchar("email", { length: 255 }),
	status: varchar("status", { length: 50 }).default('active'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	encryptedSin: text("encrypted_sin"),
	encryptedSsn: text("encrypted_ssn"),
	encryptedBankAccount: text("encrypted_bank_account"),
},
(table) => {
	return {
		idxMembersOrganization: index("idx_members_organization").using("btree", table.organizationId.asc().nullsLast()),
		idxMembersStatus: index("idx_members_status").using("btree", table.status.asc().nullsLast()),
		idxMembersUser: index("idx_members_user").using("btree", table.userId.asc().nullsLast()),
		membersOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "members_organization_id_fkey"
		}),
	}
});

export const membersWithPii = pgTable("members_with_pii", {
	id: uuid("id"),
	organizationId: uuid("organization_id"),
	userId: uuid("user_id"),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	email: varchar("email", { length: 255 }),
	status: varchar("status", { length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	encryptedSin: text("encrypted_sin"),
	encryptedSsn: text("encrypted_ssn"),
	encryptedBankAccount: text("encrypted_bank_account"),
	decryptedSin: text("decrypted_sin"),
	decryptedSsn: text("decrypted_ssn"),
	decryptedBankAccount: text("decrypted_bank_account"),
});

export const piiAccessLog = pgTable("pii_access_log", {
	logId: uuid("log_id").defaultRandom().primaryKey().notNull(),
	tableName: varchar("table_name", { length: 100 }).notNull(),
	recordId: uuid("record_id"),
	columnName: varchar("column_name", { length: 100 }).notNull(),
	accessedBy: text("accessed_by").notNull(),
	accessedAt: timestamp("accessed_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	accessType: varchar("access_type", { length: 20 }).notNull(),
	ipAddress: inet("ip_address"),
	application: varchar("application", { length: 100 }),
},
(table) => {
	return {
		idxPiiAccessLogAccessedAt: index("idx_pii_access_log_accessed_at").using("btree", table.accessedAt.desc().nullsFirst()),
		idxPiiAccessLogAccessedBy: index("idx_pii_access_log_accessed_by").using("btree", table.accessedBy.asc().nullsLast(), table.accessedAt.desc().nullsFirst()),
	}
});

export const reports = pgTable("reports", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 255 }).notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	description: text("description"),
	reportType: reportType("report_type").default('custom').notNull(),
	category: reportCategory("category").default('custom').notNull(),
	config: jsonb("config").notNull(),
	isPublic: boolean("is_public").default(false).notNull(),
	isTemplate: boolean("is_template").default(false).notNull(),
	templateId: uuid("template_id"),
	createdBy: uuid("created_by").notNull(),
	updatedBy: uuid("updated_by"),
	lastRunAt: timestamp("last_run_at", { mode: 'string' }),
	runCount: integer("run_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxReportsCreatedBy: index("idx_reports_created_by").using("btree", table.createdBy.asc().nullsLast()),
		idxReportsTenantId: index("idx_reports_tenant_id").using("btree", table.tenantId.asc().nullsLast()),
	}
});

export const reportTemplates = pgTable("report_templates", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 255 }),
	name: varchar("name", { length: 255 }).notNull(),
	description: text("description"),
	category: reportCategory("category").notNull(),
	config: jsonb("config").notNull(),
	isSystem: boolean("is_system").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	thumbnail: varchar("thumbnail", { length: 500 }),
	tags: jsonb("tags"),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const reportExecutions = pgTable("report_executions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	reportId: uuid("report_id").notNull(),
	tenantId: varchar("tenant_id", { length: 255 }).notNull(),
	executedBy: uuid("executed_by").notNull(),
	executedAt: timestamp("executed_at", { mode: 'string' }).defaultNow().notNull(),
	format: reportFormat("format").default('pdf').notNull(),
	parameters: jsonb("parameters"),
	resultCount: varchar("result_count", { length: 50 }),
	executionTimeMs: varchar("execution_time_ms", { length: 50 }),
	fileUrl: varchar("file_url", { length: 500 }),
	fileSize: varchar("file_size", { length: 50 }),
	status: varchar("status", { length: 50 }).default('completed').notNull(),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxReportExecutionsReportId: index("idx_report_executions_report_id").using("btree", table.reportId.asc().nullsLast()),
	}
});

export const scheduledReports = pgTable("scheduled_reports", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	reportId: uuid("report_id").notNull(),
	tenantId: varchar("tenant_id", { length: 255 }).notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	frequency: scheduleFrequency("frequency").notNull(),
	dayOfWeek: varchar("day_of_week", { length: 20 }),
	dayOfMonth: varchar("day_of_month", { length: 20 }),
	timeOfDay: varchar("time_of_day", { length: 10 }).notNull(),
	timezone: varchar("timezone", { length: 100 }).default('UTC').notNull(),
	format: reportFormat("format").default('pdf').notNull(),
	recipients: jsonb("recipients").notNull(),
	parameters: jsonb("parameters"),
	isActive: boolean("is_active").default(true).notNull(),
	lastExecutedAt: timestamp("last_executed_at", { mode: 'string' }),
	nextExecutionAt: timestamp("next_execution_at", { mode: 'string' }),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxScheduledReportsNextExecution: index("idx_scheduled_reports_next_execution").using("btree", table.nextExecutionAt.asc().nullsLast()).where(sql`(is_active = true)`),
	}
});

export const reportShares = pgTable("report_shares", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	reportId: uuid("report_id").notNull(),
	tenantId: varchar("tenant_id", { length: 255 }).notNull(),
	sharedBy: uuid("shared_by").notNull(),
	sharedWith: uuid("shared_with"),
	sharedWithEmail: varchar("shared_with_email", { length: 255 }),
	permission: varchar("permission", { length: 50 }).default('viewer').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const deadlineRules = pgTable("deadline_rules", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 255 }).notNull(),
	ruleName: varchar("rule_name", { length: 255 }).notNull(),
	ruleCode: varchar("rule_code", { length: 100 }).notNull(),
	description: text("description"),
	claimType: varchar("claim_type", { length: 100 }),
	priorityLevel: varchar("priority_level", { length: 50 }),
	stepNumber: integer("step_number"),
	daysFromEvent: integer("days_from_event").notNull(),
	eventType: varchar("event_type", { length: 100 }).default('claim_filed').notNull(),
	businessDaysOnly: boolean("business_days_only").default(true).notNull(),
	allowsExtension: boolean("allows_extension").default(true).notNull(),
	maxExtensionDays: integer("max_extension_days").default(30).notNull(),
	requiresApproval: boolean("requires_approval").default(true).notNull(),
	escalateToRole: varchar("escalate_to_role", { length: 100 }),
	escalationDelayDays: integer("escalation_delay_days").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	isSystemRule: boolean("is_system_rule").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxDeadlineRulesTenantId: index("idx_deadline_rules_tenant_id").using("btree", table.tenantId.asc().nullsLast()),
	}
});

export const claimDeadlines = pgTable("claim_deadlines", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	claimId: uuid("claim_id").notNull(),
	tenantId: varchar("tenant_id", { length: 255 }).notNull(),
	deadlineRuleId: uuid("deadline_rule_id"),
	deadlineName: varchar("deadline_name", { length: 255 }).notNull(),
	deadlineType: varchar("deadline_type", { length: 100 }).notNull(),
	eventDate: timestamp("event_date", { mode: 'string' }).notNull(),
	originalDeadline: timestamp("original_deadline", { mode: 'string' }).notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }).notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	status: deadlineStatus("status").default('pending').notNull(),
	priority: deadlinePriority("priority").default('medium').notNull(),
	extensionCount: integer("extension_count").default(0).notNull(),
	totalExtensionDays: integer("total_extension_days").default(0).notNull(),
	lastExtensionDate: timestamp("last_extension_date", { mode: 'string' }),
	lastExtensionReason: text("last_extension_reason"),
	completedBy: uuid("completed_by"),
	completionNotes: text("completion_notes"),
	isOverdue: boolean("is_overdue").default(false).notNull(),
	daysUntilDue: integer("days_until_due"),
	daysOverdue: integer("days_overdue").default(0).notNull(),
	escalatedAt: timestamp("escalated_at", { mode: 'string' }),
	escalatedTo: uuid("escalated_to"),
	alertCount: integer("alert_count").default(0).notNull(),
	lastAlertSent: timestamp("last_alert_sent", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxClaimDeadlinesClaimId: index("idx_claim_deadlines_claim_id").using("btree", table.claimId.asc().nullsLast()),
		idxClaimDeadlinesDueDate: index("idx_claim_deadlines_due_date").using("btree", table.dueDate.asc().nullsLast()),
		idxClaimDeadlinesStatus: index("idx_claim_deadlines_status").using("btree", table.status.asc().nullsLast()),
	}
});

export const deadlineExtensions = pgTable("deadline_extensions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	deadlineId: uuid("deadline_id").notNull(),
	tenantId: varchar("tenant_id", { length: 255 }).notNull(),
	requestedBy: uuid("requested_by").notNull(),
	requestedAt: timestamp("requested_at", { mode: 'string' }).defaultNow().notNull(),
	requestedDays: integer("requested_days").notNull(),
	requestReason: text("request_reason").notNull(),
	status: extensionStatus("status").default('pending').notNull(),
	requiresApproval: boolean("requires_approval").default(true).notNull(),
	approvedBy: uuid("approved_by"),
	approvalDecisionAt: timestamp("approval_decision_at", { mode: 'string' }),
	approvalNotes: text("approval_notes"),
	newDeadline: timestamp("new_deadline", { mode: 'string' }),
	daysGranted: integer("days_granted"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxDeadlineExtensionsDeadlineId: index("idx_deadline_extensions_deadline_id").using("btree", table.deadlineId.asc().nullsLast()),
	}
});

export const deadlineAlerts = pgTable("deadline_alerts", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	deadlineId: uuid("deadline_id").notNull(),
	tenantId: varchar("tenant_id", { length: 255 }).notNull(),
	alertType: varchar("alert_type", { length: 100 }).notNull(),
	alertSeverity: alertSeverity("alert_severity").notNull(),
	alertTrigger: varchar("alert_trigger", { length: 100 }).notNull(),
	recipientId: uuid("recipient_id").notNull(),
	recipientRole: varchar("recipient_role", { length: 100 }),
	deliveryMethod: deliveryMethod("delivery_method").notNull(),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow().notNull(),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	deliveryStatus: deliveryStatus("delivery_status").default('pending').notNull(),
	deliveryError: text("delivery_error"),
	viewedAt: timestamp("viewed_at", { mode: 'string' }),
	acknowledgedAt: timestamp("acknowledged_at", { mode: 'string' }),
	actionTaken: varchar("action_taken", { length: 255 }),
	actionTakenAt: timestamp("action_taken_at", { mode: 'string' }),
	subject: varchar("subject", { length: 500 }),
	message: text("message"),
	actionUrl: varchar("action_url", { length: 500 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxDeadlineAlertsDeadlineId: index("idx_deadline_alerts_deadline_id").using("btree", table.deadlineId.asc().nullsLast()),
	}
});

export const holidays = pgTable("holidays", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 255 }),
	holidayDate: timestamp("holiday_date", { mode: 'string' }).notNull(),
	holidayName: varchar("holiday_name", { length: 255 }).notNull(),
	holidayType: varchar("holiday_type", { length: 100 }).notNull(),
	isRecurring: boolean("is_recurring").default(false).notNull(),
	appliesTo: varchar("applies_to", { length: 100 }).default('all').notNull(),
	isObserved: boolean("is_observed").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const calendars = pgTable("calendars", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: text("tenant_id").notNull(),
	name: text("name").notNull(),
	description: text("description"),
	color: varchar("color", { length: 7 }).default('#3B82F6'),
	icon: varchar("icon", { length: 50 }),
	ownerId: text("owner_id").notNull(),
	isPersonal: boolean("is_personal").default(true),
	isShared: boolean("is_shared").default(false),
	isPublic: boolean("is_public").default(false),
	externalProvider: varchar("external_provider", { length: 50 }),
	externalCalendarId: text("external_calendar_id"),
	syncEnabled: boolean("sync_enabled").default(false),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	syncStatus: syncStatus("sync_status").default('disconnected'),
	syncToken: text("sync_token"),
	timezone: varchar("timezone", { length: 100 }).default('America/New_York'),
	defaultEventDuration: integer("default_event_duration").default(60),
	reminderDefaultMinutes: integer("reminder_default_minutes").default(15),
	allowOverlap: boolean("allow_overlap").default(true),
	requireApproval: boolean("require_approval").default(false),
	metadata: jsonb("metadata"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxCalendarsOwnerId: index("idx_calendars_owner_id").using("btree", table.ownerId.asc().nullsLast()),
	}
});

export const calendarEvents = pgTable("calendar_events", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	calendarId: uuid("calendar_id").notNull(),
	tenantId: text("tenant_id").notNull(),
	title: text("title").notNull(),
	description: text("description"),
	location: text("location"),
	locationUrl: text("location_url"),
	startTime: timestamp("start_time", { mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { mode: 'string' }).notNull(),
	timezone: varchar("timezone", { length: 100 }).default('America/New_York'),
	isAllDay: boolean("is_all_day").default(false),
	isRecurring: boolean("is_recurring").default(false),
	recurrenceRule: text("recurrence_rule"),
	recurrenceExceptions: jsonb("recurrence_exceptions"),
	parentEventId: uuid("parent_event_id"),
	eventType: eventType("event_type").default('meeting'),
	status: eventStatus("status").default('scheduled'),
	priority: varchar("priority", { length: 20 }).default('normal'),
	claimId: text("claim_id"),
	caseNumber: text("case_number"),
	memberId: text("member_id"),
	meetingRoomId: uuid("meeting_room_id"),
	meetingUrl: text("meeting_url"),
	meetingPassword: text("meeting_password"),
	agenda: text("agenda"),
	organizerId: text("organizer_id").notNull(),
	reminders: jsonb("reminders").default([15]),
	externalEventId: text("external_event_id"),
	externalProvider: varchar("external_provider", { length: 50 }),
	externalHtmlLink: text("external_html_link"),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	isPrivate: boolean("is_private").default(false),
	visibility: varchar("visibility", { length: 20 }).default('default'),
	metadata: jsonb("metadata"),
	attachments: jsonb("attachments"),
	createdBy: text("created_by").notNull(),
	cancelledAt: timestamp("cancelled_at", { mode: 'string' }),
	cancelledBy: text("cancelled_by"),
	cancellationReason: text("cancellation_reason"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxCalendarEventsCalendarId: index("idx_calendar_events_calendar_id").using("btree", table.calendarId.asc().nullsLast()),
		idxCalendarEventsOrganizerId: index("idx_calendar_events_organizer_id").using("btree", table.organizerId.asc().nullsLast()),
		idxCalendarEventsStartTime: index("idx_calendar_events_start_time").using("btree", table.startTime.asc().nullsLast()),
		calendarEventsCalendarIdFk: foreignKey({
			columns: [table.calendarId],
			foreignColumns: [calendars.id],
			name: "calendar_events_calendar_id_fk"
		}).onDelete("cascade"),
	}
});

export const eventAttendees = pgTable("event_attendees", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	eventId: uuid("event_id").notNull(),
	tenantId: text("tenant_id").notNull(),
	userId: text("user_id"),
	email: text("email").notNull(),
	name: text("name"),
	status: attendeeStatus("status").default('invited'),
	isOptional: boolean("is_optional").default(false),
	isOrganizer: boolean("is_organizer").default(false),
	respondedAt: timestamp("responded_at", { mode: 'string' }),
	responseComment: text("response_comment"),
	notificationSent: boolean("notification_sent").default(false),
	lastNotificationAt: timestamp("last_notification_at", { mode: 'string' }),
	externalAttendeeId: text("external_attendee_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxEventAttendeesEventId: index("idx_event_attendees_event_id").using("btree", table.eventId.asc().nullsLast()),
		idxEventAttendeesUserId: index("idx_event_attendees_user_id").using("btree", table.userId.asc().nullsLast()),
		eventAttendeesEventIdFk: foreignKey({
			columns: [table.eventId],
			foreignColumns: [calendarEvents.id],
			name: "event_attendees_event_id_fk"
		}).onDelete("cascade"),
	}
});

export const meetingRooms = pgTable("meeting_rooms", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: text("tenant_id").notNull(),
	name: text("name").notNull(),
	displayName: text("display_name"),
	description: text("description"),
	buildingName: varchar("building_name", { length: 200 }),
	floor: varchar("floor", { length: 50 }),
	roomNumber: varchar("room_number", { length: 50 }),
	address: text("address"),
	capacity: integer("capacity").default(10),
	features: jsonb("features"),
	equipment: jsonb("equipment"),
	status: roomStatus("status").default('available'),
	isActive: boolean("is_active").default(true),
	requiresApproval: boolean("requires_approval").default(false),
	minBookingDuration: integer("min_booking_duration").default(30),
	maxBookingDuration: integer("max_booking_duration").default(480),
	advanceBookingDays: integer("advance_booking_days").default(90),
	operatingHours: jsonb("operating_hours"),
	allowedUserRoles: jsonb("allowed_user_roles"),
	blockedDates: jsonb("blocked_dates"),
	contactPersonId: text("contact_person_id"),
	contactEmail: text("contact_email"),
	contactPhone: varchar("contact_phone", { length: 20 }),
	imageUrl: text("image_url"),
	floorPlanUrl: text("floor_plan_url"),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const roomBookings = pgTable("room_bookings", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	eventId: uuid("event_id"),
	tenantId: text("tenant_id").notNull(),
	bookedBy: text("booked_by").notNull(),
	bookedFor: text("booked_for"),
	purpose: text("purpose").notNull(),
	startTime: timestamp("start_time", { mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { mode: 'string' }).notNull(),
	setupRequired: boolean("setup_required").default(false),
	setupTime: integer("setup_time").default(0),
	cateringRequired: boolean("catering_required").default(false),
	cateringNotes: text("catering_notes"),
	specialRequests: text("special_requests"),
	status: eventStatus("status").default('scheduled'),
	requiresApproval: boolean("requires_approval").default(false),
	approvedBy: text("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	approvalNotes: text("approval_notes"),
	checkedInAt: timestamp("checked_in_at", { mode: 'string' }),
	checkedInBy: text("checked_in_by"),
	checkedOutAt: timestamp("checked_out_at", { mode: 'string' }),
	actualEndTime: timestamp("actual_end_time", { mode: 'string' }),
	cancelledAt: timestamp("cancelled_at", { mode: 'string' }),
	cancelledBy: text("cancelled_by"),
	cancellationReason: text("cancellation_reason"),
	attendeeCount: integer("attendee_count"),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxRoomBookingsRoomId: index("idx_room_bookings_room_id").using("btree", table.roomId.asc().nullsLast()),
		idxRoomBookingsStartTime: index("idx_room_bookings_start_time").using("btree", table.startTime.asc().nullsLast()),
		roomBookingsEventIdFk: foreignKey({
			columns: [table.eventId],
			foreignColumns: [calendarEvents.id],
			name: "room_bookings_event_id_fk"
		}).onDelete("set null"),
		roomBookingsRoomIdFk: foreignKey({
			columns: [table.roomId],
			foreignColumns: [meetingRooms.id],
			name: "room_bookings_room_id_fk"
		}).onDelete("cascade"),
	}
});

export const calendarSharing = pgTable("calendar_sharing", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	calendarId: uuid("calendar_id").notNull(),
	tenantId: text("tenant_id").notNull(),
	sharedWithUserId: text("shared_with_user_id"),
	sharedWithEmail: text("shared_with_email"),
	sharedWithRole: varchar("shared_with_role", { length: 50 }),
	permission: calendarPermission("permission").default('viewer'),
	canCreateEvents: boolean("can_create_events").default(false),
	canEditEvents: boolean("can_edit_events").default(false),
	canDeleteEvents: boolean("can_delete_events").default(false),
	canShare: boolean("can_share").default(false),
	invitedBy: text("invited_by").notNull(),
	invitedAt: timestamp("invited_at", { mode: 'string' }).defaultNow().notNull(),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		calendarSharingCalendarIdFk: foreignKey({
			columns: [table.calendarId],
			foreignColumns: [calendars.id],
			name: "calendar_sharing_calendar_id_fk"
		}).onDelete("cascade"),
	}
});

export const externalCalendarConnections = pgTable("external_calendar_connections", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	tenantId: text("tenant_id").notNull(),
	provider: varchar("provider", { length: 50 }).notNull(),
	providerAccountId: text("provider_account_id").notNull(),
	providerEmail: text("provider_email"),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token"),
	tokenExpiresAt: timestamp("token_expires_at", { mode: 'string' }),
	scope: text("scope"),
	syncEnabled: boolean("sync_enabled").default(true),
	syncDirection: varchar("sync_direction", { length: 20 }).default('both'),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	nextSyncAt: timestamp("next_sync_at", { mode: 'string' }),
	syncStatus: syncStatus("sync_status").default('synced'),
	syncError: text("sync_error"),
	syncPastDays: integer("sync_past_days").default(30),
	syncFutureDays: integer("sync_future_days").default(365),
	syncOnlyFreeTime: boolean("sync_only_free_time").default(false),
	calendarMappings: jsonb("calendar_mappings"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const eventReminders = pgTable("event_reminders", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	eventId: uuid("event_id").notNull(),
	userId: text("user_id").notNull(),
	tenantId: text("tenant_id").notNull(),
	reminderMinutes: integer("reminder_minutes").notNull(),
	reminderType: varchar("reminder_type", { length: 20 }).default('notification'),
	scheduledFor: timestamp("scheduled_for", { mode: 'string' }).notNull(),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	status: varchar("status", { length: 20 }).default('pending'),
	error: text("error"),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		eventRemindersEventIdFk: foreignKey({
			columns: [table.eventId],
			foreignColumns: [calendarEvents.id],
			name: "event_reminders_event_id_fk"
		}).onDelete("cascade"),
	}
});

export const notificationHistory = pgTable("notification_history", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	tenantId: text("tenant_id"),
	recipient: text("recipient").notNull(),
	channel: notificationChannel("channel").notNull(),
	subject: text("subject"),
	template: text("template"),
	status: notificationStatus("status").notNull(),
	error: text("error"),
	sentAt: timestamp("sent_at", { mode: 'string' }).notNull(),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	openedAt: timestamp("opened_at", { mode: 'string' }),
	clickedAt: timestamp("clicked_at", { mode: 'string' }),
	metadata: jsonb("metadata"),
},
(table) => {
	return {
		idxNotificationHistoryUserId: index("idx_notification_history_user_id").using("btree", table.userId.asc().nullsLast()),
	}
});

export const memberDocuments = pgTable("member_documents", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	fileName: text("file_name").notNull(),
	fileUrl: text("file_url").notNull(),
	fileSize: integer("file_size").notNull(),
	fileType: text("file_type").notNull(),
	category: text("category").default('General'),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxMemberDocumentsCategory: index("idx_member_documents_category").using("btree", table.category.asc().nullsLast()),
		idxMemberDocumentsUserId: index("idx_member_documents_user_id").using("btree", table.userId.asc().nullsLast()),
	}
});

export const memberPoliticalParticipation = pgTable("member_political_participation", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	memberId: uuid("member_id").notNull(),
	copeMember: boolean("cope_member").default(false),
	copeEnrollmentDate: date("cope_enrollment_date"),
	copeContributionsTotal: numeric("cope_contributions_total", { precision: 10, scale:  2 }).default('0.00'),
	engagementLevel: varchar("engagement_level", { length: 50 }),
	campaignsParticipated: jsonb("campaigns_participated"),
	activitiesCount: integer("activities_count").default(0),
	meetingsAttended: integer("meetings_attended").default(0),
	lettersWritten: integer("letters_written").default(0),
	callsMade: integer("calls_made").default(0),
	hoursVolunteered: integer("hours_volunteered").default(0),
	politicalSkills: jsonb("political_skills"),
	issueInterests: jsonb("issue_interests"),
	preferredEngagement: jsonb("preferred_engagement"),
	availableWeekdays: boolean("available_weekdays").default(false),
	availableEvenings: boolean("available_evenings").default(true),
	availableWeekends: boolean("available_weekends").default(true),
	federalRiding: varchar("federal_riding", { length: 200 }),
	provincialRiding: varchar("provincial_riding", { length: 200 }),
	municipalWard: varchar("municipal_ward", { length: 200 }),
	registeredToVote: boolean("registered_to_vote"),
	voterRegistrationVerifiedDate: date("voter_registration_verified_date"),
	politicalTrainingCompleted: boolean("political_training_completed").default(false),
	trainingCompletionDate: date("training_completion_date"),
	contactForCampaigns: boolean("contact_for_campaigns").default(true),
	contactMethodPreference: varchar("contact_method_preference", { length: 50 }),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxMemberPoliticalParticipationCope: index("idx_member_political_participation_cope").using("btree", table.copeMember.asc().nullsLast()),
		idxMemberPoliticalParticipationEngagement: index("idx_member_political_participation_engagement").using("btree", table.engagementLevel.asc().nullsLast()),
		idxMemberPoliticalParticipationMember: index("idx_member_political_participation_member").using("btree", table.memberId.asc().nullsLast()),
		idxMemberPoliticalParticipationOrg: index("idx_member_political_participation_org").using("btree", table.organizationId.asc().nullsLast()),
		memberPoliticalParticipationMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "member_political_participation_member_id_fkey"
		}),
		memberPoliticalParticipationOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "member_political_participation_organization_id_fkey"
		}),
	}
});

export const electedOfficials = pgTable("elected_officials", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	fullName: varchar("full_name", { length: 200 }),
	preferredName: varchar("preferred_name", { length: 200 }),
	honorific: varchar("honorific", { length: 50 }),
	officeTitle: varchar("office_title", { length: 200 }),
	governmentLevel: governmentLevel("government_level").notNull(),
	jurisdiction: varchar("jurisdiction", { length: 200 }),
	electoralDistrict: varchar("electoral_district", { length: 200 }),
	districtNumber: varchar("district_number", { length: 50 }),
	politicalParty: politicalParty("political_party"),
	partyCaucusRole: varchar("party_caucus_role", { length: 100 }),
	parliamentHillOfficePhone: varchar("parliament_hill_office_phone", { length: 50 }),
	parliamentHillOfficeAddress: text("parliament_hill_office_address"),
	constituencyOfficePhone: varchar("constituency_office_phone", { length: 50 }),
	constituencyOfficeAddress: text("constituency_office_address"),
	email: varchar("email", { length: 255 }),
	websiteUrl: text("website_url"),
	twitterHandle: varchar("twitter_handle", { length: 100 }),
	facebookUrl: text("facebook_url"),
	linkedinUrl: text("linkedin_url"),
	chiefOfStaffName: varchar("chief_of_staff_name", { length: 200 }),
	chiefOfStaffEmail: varchar("chief_of_staff_email", { length: 255 }),
	chiefOfStaffPhone: varchar("chief_of_staff_phone", { length: 50 }),
	legislativeAssistantName: varchar("legislative_assistant_name", { length: 200 }),
	legislativeAssistantEmail: varchar("legislative_assistant_email", { length: 255 }),
	committeeMemberships: jsonb("committee_memberships"),
	cabinetPosition: varchar("cabinet_position", { length: 200 }),
	criticPortfolios: jsonb("critic_portfolios"),
	firstElectedDate: date("first_elected_date"),
	currentTermStartDate: date("current_term_start_date"),
	currentTermEndDate: date("current_term_end_date"),
	previousTermsCount: integer("previous_terms_count").default(0),
	laborFriendlyRating: integer("labor_friendly_rating"),
	previousUnionMember: boolean("previous_union_member").default(false),
	previousUnionName: varchar("previous_union_name", { length: 200 }),
	votedForLaborBills: integer("voted_for_labor_bills").default(0),
	votedAgainstLaborBills: integer("voted_against_labor_bills").default(0),
	lastContactDate: date("last_contact_date"),
	totalMeetingsHeld: integer("total_meetings_held").default(0),
	totalLettersSent: integer("total_letters_sent").default(0),
	responsive: boolean("responsive"),
	responsivenessNotes: text("responsiveness_notes"),
	unionEndorsed: boolean("union_endorsed").default(false),
	unionContributionAmount: numeric("union_contribution_amount", { precision: 10, scale:  2 }),
	volunteersProvided: integer("volunteers_provided").default(0),
	isCurrent: boolean("is_current").default(true),
	defeatDate: date("defeat_date"),
	retirementDate: date("retirement_date"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxElectedOfficialsCurrent: index("idx_elected_officials_current").using("btree", table.isCurrent.asc().nullsLast()),
		idxElectedOfficialsDistrict: index("idx_elected_officials_district").using("btree", table.electoralDistrict.asc().nullsLast()),
		idxElectedOfficialsLevel: index("idx_elected_officials_level").using("btree", table.governmentLevel.asc().nullsLast()),
		idxElectedOfficialsOrg: index("idx_elected_officials_org").using("btree", table.organizationId.asc().nullsLast()),
		idxElectedOfficialsParty: index("idx_elected_officials_party").using("btree", table.politicalParty.asc().nullsLast()),
		electedOfficialsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "elected_officials_organization_id_fkey"
		}),
	}
});

export const legislationTracking = pgTable("legislation_tracking", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	billNumber: varchar("bill_number", { length: 50 }).notNull(),
	billTitle: varchar("bill_title", { length: 500 }).notNull(),
	shortTitle: varchar("short_title", { length: 200 }),
	governmentLevel: governmentLevel("government_level").notNull(),
	jurisdiction: varchar("jurisdiction", { length: 200 }),
	legislativeSession: varchar("legislative_session", { length: 100 }),
	billType: varchar("bill_type", { length: 50 }),
	sponsorName: varchar("sponsor_name", { length: 200 }),
	sponsorParty: politicalParty("sponsor_party"),
	sponsorOfficialId: uuid("sponsor_official_id"),
	billSummary: text("bill_summary"),
	impactOnLabor: text("impact_on_labor"),
	keyProvisions: text("key_provisions"),
	currentStatus: billStatus("current_status").default('introduced'),
	introductionDate: date("introduction_date"),
	firstReadingDate: date("first_reading_date"),
	secondReadingDate: date("second_reading_date"),
	committeeReferralDate: date("committee_referral_date"),
	committeeName: varchar("committee_name", { length: 200 }),
	thirdReadingDate: date("third_reading_date"),
	passedDate: date("passed_date"),
	royalAssentDate: date("royal_assent_date"),
	unionPosition: unionPosition("union_position").default('monitoring'),
	positionRationale: text("position_rationale"),
	activeCampaign: boolean("active_campaign").default(false),
	campaignId: uuid("campaign_id"),
	committeePresentationScheduled: boolean("committee_presentation_scheduled").default(false),
	committeePresentationDate: date("committee_presentation_date"),
	writtenSubmissionFiled: boolean("written_submission_filed").default(false),
	writtenSubmissionUrl: text("written_submission_url"),
	membersContactedMp: integer("members_contacted_mp").default(0),
	lettersSentToMps: integer("letters_sent_to_mps").default(0),
	petitionSignatures: integer("petition_signatures").default(0),
	amendmentsProposed: jsonb("amendments_proposed"),
	amendmentsAdopted: integer("amendments_adopted").default(0),
	coalitionPartners: jsonb("coalition_partners"),
	finalOutcome: varchar("final_outcome", { length: 100 }),
	outcomeDate: date("outcome_date"),
	outcomeImpactAssessment: text("outcome_impact_assessment"),
	billTextUrl: text("bill_text_url"),
	legislativeSummaryUrl: text("legislative_summary_url"),
	committeeReportUrl: text("committee_report_url"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxLegislationTrackingBill: index("idx_legislation_tracking_bill").using("btree", table.billNumber.asc().nullsLast()),
		idxLegislationTrackingCampaign: index("idx_legislation_tracking_campaign").using("btree", table.campaignId.asc().nullsLast()),
		idxLegislationTrackingOrg: index("idx_legislation_tracking_org").using("btree", table.organizationId.asc().nullsLast()),
		idxLegislationTrackingPosition: index("idx_legislation_tracking_position").using("btree", table.unionPosition.asc().nullsLast()),
		idxLegislationTrackingStatus: index("idx_legislation_tracking_status").using("btree", table.currentStatus.asc().nullsLast()),
		legislationTrackingCampaignIdFkey: foreignKey({
			columns: [table.campaignId],
			foreignColumns: [politicalCampaigns.id],
			name: "legislation_tracking_campaign_id_fkey"
		}),
		legislationTrackingOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "legislation_tracking_organization_id_fkey"
		}),
		legislationTrackingSponsorOfficialIdFkey: foreignKey({
			columns: [table.sponsorOfficialId],
			foreignColumns: [electedOfficials.id],
			name: "legislation_tracking_sponsor_official_id_fkey"
		}),
	}
});

export const politicalActivities = pgTable("political_activities", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	campaignId: uuid("campaign_id"),
	activityType: politicalActivityType("activity_type").notNull(),
	activityName: varchar("activity_name", { length: 200 }),
	activityDate: date("activity_date").notNull(),
	activityTime: time("activity_time"),
	electedOfficialId: uuid("elected_official_id"),
	electedOfficialName: varchar("elected_official_name", { length: 200 }),
	legislationId: uuid("legislation_id"),
	billNumber: varchar("bill_number", { length: 50 }),
	location: varchar("location", { length: 300 }),
	isVirtual: boolean("is_virtual").default(false),
	meetingLink: text("meeting_link"),
	membersParticipated: jsonb("members_participated"),
	membersCount: integer("members_count").default(0),
	volunteersCount: integer("volunteers_count").default(0),
	doorsKnocked: integer("doors_knocked").default(0),
	callsMade: integer("calls_made").default(0),
	contactsReached: integer("contacts_reached").default(0),
	petitionSignaturesCollected: integer("petition_signatures_collected").default(0),
	outcomeSummary: text("outcome_summary"),
	commitmentsReceived: text("commitments_received"),
	followUpRequired: boolean("follow_up_required").default(false),
	followUpDate: date("follow_up_date"),
	meetingNotesUrl: text("meeting_notes_url"),
	photosUrls: jsonb("photos_urls"),
	mediaCoverageUrls: jsonb("media_coverage_urls"),
	activityCost: numeric("activity_cost", { precision: 10, scale:  2 }).default('0.00'),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxPoliticalActivitiesCampaign: index("idx_political_activities_campaign").using("btree", table.campaignId.asc().nullsLast()),
		idxPoliticalActivitiesDate: index("idx_political_activities_date").using("btree", table.activityDate.asc().nullsLast()),
		idxPoliticalActivitiesLegislation: index("idx_political_activities_legislation").using("btree", table.legislationId.asc().nullsLast()),
		idxPoliticalActivitiesOfficial: index("idx_political_activities_official").using("btree", table.electedOfficialId.asc().nullsLast()),
		idxPoliticalActivitiesOrg: index("idx_political_activities_org").using("btree", table.organizationId.asc().nullsLast()),
		politicalActivitiesCampaignIdFkey: foreignKey({
			columns: [table.campaignId],
			foreignColumns: [politicalCampaigns.id],
			name: "political_activities_campaign_id_fkey"
		}),
		politicalActivitiesElectedOfficialIdFkey: foreignKey({
			columns: [table.electedOfficialId],
			foreignColumns: [electedOfficials.id],
			name: "political_activities_elected_official_id_fkey"
		}),
		politicalActivitiesLegislationIdFkey: foreignKey({
			columns: [table.legislationId],
			foreignColumns: [legislationTracking.id],
			name: "political_activities_legislation_id_fkey"
		}),
		politicalActivitiesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "political_activities_organization_id_fkey"
		}),
	}
});

export const vPoliticalCampaignDashboard = pgTable("v_political_campaign_dashboard", {
	campaignId: uuid("campaign_id"),
	organizationId: uuid("organization_id"),
	campaignName: varchar("campaign_name", { length: 300 }),
	campaignType: politicalCampaignType("campaign_type"),
	campaignStatus: politicalCampaignStatus("campaign_status"),
	jurisdictionLevel: varchar("jurisdiction_level", { length: 50 }),
	startDate: date("start_date"),
	endDate: date("end_date"),
	electionDate: date("election_date"),
	membersParticipated: integer("members_participated"),
	memberParticipationGoal: integer("member_participation_goal"),
	participationPercentage: numeric("participation_percentage"),
	doorsKnocked: integer("doors_knocked"),
	phoneCallsMade: integer("phone_calls_made"),
	petitionSignaturesCollected: integer("petition_signatures_collected"),
	budgetAllocated: numeric("budget_allocated", { precision: 12, scale:  2 }),
	expensesToDate: numeric("expenses_to_date", { precision: 12, scale:  2 }),
	budgetUsedPercentage: numeric("budget_used_percentage"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalActivities: bigint("total_activities", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activitiesLastWeek: bigint("activities_last_week", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalDoorsKnocked: bigint("total_doors_knocked", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCallsMade: bigint("total_calls_made", { mode: "number" }),
});

export const vElectedOfficialEngagement = pgTable("v_elected_official_engagement", {
	officialId: uuid("official_id"),
	organizationId: uuid("organization_id"),
	fullName: varchar("full_name", { length: 200 }),
	officeTitle: varchar("office_title", { length: 200 }),
	governmentLevel: governmentLevel("government_level"),
	electoralDistrict: varchar("electoral_district", { length: 200 }),
	politicalParty: politicalParty("political_party"),
	laborFriendlyRating: integer("labor_friendly_rating"),
	totalMeetingsHeld: integer("total_meetings_held"),
	lastContactDate: date("last_contact_date"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalActivities: bigint("total_activities", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activitiesLast90Days: bigint("activities_last_90_days", { mode: "number" }),
	votedForLaborBills: integer("voted_for_labor_bills"),
	votedAgainstLaborBills: integer("voted_against_labor_bills"),
	laborSupportPercentage: numeric("labor_support_percentage"),
});

export const vLegislativePriorities = pgTable("v_legislative_priorities", {
	legislationId: uuid("legislation_id"),
	organizationId: uuid("organization_id"),
	billNumber: varchar("bill_number", { length: 50 }),
	billTitle: varchar("bill_title", { length: 500 }),
	governmentLevel: governmentLevel("government_level"),
	currentStatus: billStatus("current_status"),
	unionPosition: unionPosition("union_position"),
	activeCampaign: boolean("active_campaign"),
	introductionDate: date("introduction_date"),
	membersContactedMp: integer("members_contacted_mp"),
	lettersSentToMps: integer("letters_sent_to_mps"),
	petitionSignatures: integer("petition_signatures"),
	campaignName: varchar("campaign_name", { length: 300 }),
	campaignStatus: politicalCampaignStatus("campaign_status"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalActivities: bigint("total_activities", { mode: "number" }),
	lastActivityDate: date("last_activity_date"),
});

export const trainingCourses = pgTable("training_courses", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	courseCode: varchar("course_code", { length: 50 }).notNull(),
	courseName: varchar("course_name", { length: 300 }).notNull(),
	courseDescription: text("course_description"),
	courseCategory: courseCategory("course_category").notNull(),
	deliveryMethod: courseDeliveryMethod("delivery_method").notNull(),
	courseDifficulty: courseDifficulty("course_difficulty").default('all_levels'),
	durationHours: numeric("duration_hours", { precision: 5, scale:  2 }),
	durationDays: integer("duration_days"),
	hasPrerequisites: boolean("has_prerequisites").default(false),
	prerequisiteCourses: jsonb("prerequisite_courses"),
	prerequisiteCertifications: jsonb("prerequisite_certifications"),
	learningObjectives: text("learning_objectives"),
	courseOutline: jsonb("course_outline"),
	courseMaterialsUrl: text("course_materials_url"),
	presentationSlidesUrl: text("presentation_slides_url"),
	workbookUrl: text("workbook_url"),
	additionalResources: jsonb("additional_resources"),
	primaryInstructorName: varchar("primary_instructor_name", { length: 200 }),
	instructorIds: jsonb("instructor_ids"),
	minEnrollment: integer("min_enrollment").default(5),
	maxEnrollment: integer("max_enrollment").default(30),
	providesCertification: boolean("provides_certification").default(false),
	certificationName: varchar("certification_name", { length: 200 }),
	certificationValidYears: integer("certification_valid_years"),
	clcApproved: boolean("clc_approved").default(false),
	clcApprovalDate: date("clc_approval_date"),
	clcCourseCode: varchar("clc_course_code", { length: 50 }),
	courseFee: numeric("course_fee", { precision: 10, scale:  2 }).default('0.00'),
	materialsFee: numeric("materials_fee", { precision: 10, scale:  2 }).default('0.00'),
	travelSubsidyAvailable: boolean("travel_subsidy_available").default(false),
	isActive: boolean("is_active").default(true),
	isMandatory: boolean("is_mandatory").default(false),
	mandatoryForRoles: jsonb("mandatory_for_roles"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxTrainingCoursesActive: index("idx_training_courses_active").using("btree", table.isActive.asc().nullsLast()),
		idxTrainingCoursesCategory: index("idx_training_courses_category").using("btree", table.courseCategory.asc().nullsLast()),
		idxTrainingCoursesClc: index("idx_training_courses_clc").using("btree", table.clcApproved.asc().nullsLast()),
		idxTrainingCoursesOrg: index("idx_training_courses_org").using("btree", table.organizationId.asc().nullsLast()),
		trainingCoursesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "training_courses_organization_id_fkey"
		}),
		trainingCoursesCourseCodeKey: unique("training_courses_course_code_key").on(table.courseCode),
	}
});

export const inAppNotifications = pgTable("in_app_notifications", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	tenantId: text("tenant_id").notNull(),
	title: text("title").notNull(),
	message: text("message").notNull(),
	type: text("type").default('info').notNull(),
	actionLabel: text("action_label"),
	actionUrl: text("action_url"),
	data: jsonb("data"),
	read: boolean("read").default(false).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
},
(table) => {
	return {
		idxInAppNotificationsRead: index("idx_in_app_notifications_read").using("btree", table.read.asc().nullsLast()),
		idxInAppNotificationsUserId: index("idx_in_app_notifications_user_id").using("btree", table.userId.asc().nullsLast()),
	}
});

export const courseSessions = pgTable("course_sessions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	courseId: uuid("course_id").notNull(),
	sessionCode: varchar("session_code", { length: 50 }).notNull(),
	sessionName: varchar("session_name", { length: 300 }),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	sessionTimes: jsonb("session_times"),
	deliveryMethod: courseDeliveryMethod("delivery_method").notNull(),
	venueName: varchar("venue_name", { length: 200 }),
	venueAddress: text("venue_address"),
	roomNumber: varchar("room_number", { length: 50 }),
	virtualMeetingUrl: text("virtual_meeting_url"),
	virtualMeetingAccessCode: varchar("virtual_meeting_access_code", { length: 50 }),
	leadInstructorId: uuid("lead_instructor_id"),
	leadInstructorName: varchar("lead_instructor_name", { length: 200 }),
	coInstructors: jsonb("co_instructors"),
	registrationOpenDate: date("registration_open_date"),
	registrationCloseDate: date("registration_close_date"),
	registrationCount: integer("registration_count").default(0),
	waitlistCount: integer("waitlist_count").default(0),
	maxEnrollment: integer("max_enrollment"),
	sessionStatus: sessionStatus("session_status").default('scheduled'),
	attendeesCount: integer("attendees_count").default(0),
	completionsCount: integer("completions_count").default(0),
	completionRate: numeric("completion_rate", { precision: 5, scale:  2 }),
	averageRating: numeric("average_rating", { precision: 3, scale:  2 }),
	evaluationResponsesCount: integer("evaluation_responses_count").default(0),
	sessionBudget: numeric("session_budget", { precision: 10, scale:  2 }),
	actualCost: numeric("actual_cost", { precision: 10, scale:  2 }),
	travelSubsidyOffered: boolean("travel_subsidy_offered").default(false),
	accommodationArranged: boolean("accommodation_arranged").default(false),
	accommodationHotel: varchar("accommodation_hotel", { length: 200 }),
	materialsPrepared: boolean("materials_prepared").default(false),
	materialsDistributedCount: integer("materials_distributed_count").default(0),
	cancellationReason: text("cancellation_reason"),
	cancelledDate: date("cancelled_date"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxCourseSessionsCourse: index("idx_course_sessions_course").using("btree", table.courseId.asc().nullsLast()),
		idxCourseSessionsDates: index("idx_course_sessions_dates").using("btree", table.startDate.asc().nullsLast(), table.endDate.asc().nullsLast()),
		idxCourseSessionsInstructor: index("idx_course_sessions_instructor").using("btree", table.leadInstructorId.asc().nullsLast()),
		idxCourseSessionsOrg: index("idx_course_sessions_org").using("btree", table.organizationId.asc().nullsLast()),
		idxCourseSessionsStatus: index("idx_course_sessions_status").using("btree", table.sessionStatus.asc().nullsLast()),
		courseSessionsCourseIdFkey: foreignKey({
			columns: [table.courseId],
			foreignColumns: [trainingCourses.id],
			name: "course_sessions_course_id_fkey"
		}),
		courseSessionsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "course_sessions_organization_id_fkey"
		}),
		courseSessionsSessionCodeKey: unique("course_sessions_session_code_key").on(table.sessionCode),
	}
});

export const courseRegistrations = pgTable("course_registrations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	memberId: uuid("member_id").notNull(),
	courseId: uuid("course_id").notNull(),
	sessionId: uuid("session_id").notNull(),
	registrationDate: timestamp("registration_date", { withTimezone: true, mode: 'string' }).defaultNow(),
	registrationStatus: registrationStatus("registration_status").default('registered'),
	requiresApproval: boolean("requires_approval").default(false),
	approvedBy: uuid("approved_by"),
	approvedDate: date("approved_date"),
	approvalNotes: text("approval_notes"),
	attended: boolean("attended").default(false),
	attendanceDates: jsonb("attendance_dates"),
	attendanceHours: numeric("attendance_hours", { precision: 5, scale:  2 }),
	completed: boolean("completed").default(false),
	completionDate: date("completion_date"),
	completionPercentage: numeric("completion_percentage", { precision: 5, scale:  2 }).default('0.00'),
	preTestScore: numeric("pre_test_score", { precision: 5, scale:  2 }),
	postTestScore: numeric("post_test_score", { precision: 5, scale:  2 }),
	finalGrade: varchar("final_grade", { length: 10 }),
	passed: boolean("passed"),
	certificateIssued: boolean("certificate_issued").default(false),
	certificateNumber: varchar("certificate_number", { length: 100 }),
	certificateIssueDate: date("certificate_issue_date"),
	certificateUrl: text("certificate_url"),
	evaluationCompleted: boolean("evaluation_completed").default(false),
	evaluationRating: numeric("evaluation_rating", { precision: 3, scale:  2 }),
	evaluationComments: text("evaluation_comments"),
	evaluationSubmittedDate: date("evaluation_submitted_date"),
	travelRequired: boolean("travel_required").default(false),
	travelSubsidyRequested: boolean("travel_subsidy_requested").default(false),
	travelSubsidyApproved: boolean("travel_subsidy_approved").default(false),
	travelSubsidyAmount: numeric("travel_subsidy_amount", { precision: 10, scale:  2 }),
	accommodationRequired: boolean("accommodation_required").default(false),
	courseFee: numeric("course_fee", { precision: 10, scale:  2 }).default('0.00'),
	feePaid: boolean("fee_paid").default(false),
	feePaymentDate: date("fee_payment_date"),
	feeWaived: boolean("fee_waived").default(false),
	feeWaiverReason: text("fee_waiver_reason"),
	cancellationDate: date("cancellation_date"),
	cancellationReason: text("cancellation_reason"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxCourseRegistrationsCompleted: index("idx_course_registrations_completed").using("btree", table.completed.asc().nullsLast()),
		idxCourseRegistrationsCourse: index("idx_course_registrations_course").using("btree", table.courseId.asc().nullsLast()),
		idxCourseRegistrationsMember: index("idx_course_registrations_member").using("btree", table.memberId.asc().nullsLast()),
		idxCourseRegistrationsOrg: index("idx_course_registrations_org").using("btree", table.organizationId.asc().nullsLast()),
		idxCourseRegistrationsSession: index("idx_course_registrations_session").using("btree", table.sessionId.asc().nullsLast()),
		idxCourseRegistrationsStatus: index("idx_course_registrations_status").using("btree", table.registrationStatus.asc().nullsLast()),
		courseRegistrationsCourseIdFkey: foreignKey({
			columns: [table.courseId],
			foreignColumns: [trainingCourses.id],
			name: "course_registrations_course_id_fkey"
		}),
		courseRegistrationsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "course_registrations_member_id_fkey"
		}),
		courseRegistrationsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "course_registrations_organization_id_fkey"
		}),
		courseRegistrationsSessionIdFkey: foreignKey({
			columns: [table.sessionId],
			foreignColumns: [courseSessions.id],
			name: "course_registrations_session_id_fkey"
		}),
	}
});

export const pensionPlans = pgTable("pension_plans", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	planName: varchar("plan_name", { length: 200 }).notNull(),
	planNumber: varchar("plan_number", { length: 50 }),
	planType: pensionPlanType("plan_type").notNull(),
	planStatus: pensionPlanStatus("plan_status").default('active'),
	isTaftHartley: boolean("is_taft_hartley").default(false),
	isMultiEmployer: boolean("is_multi_employer").default(false),
	participatingEmployersCount: integer("participating_employers_count"),
	craRegistrationNumber: varchar("cra_registration_number", { length: 50 }),
	irsEin: varchar("irs_ein", { length: 20 }),
	form5500Required: boolean("form_5500_required").default(false),
	t3FilingRequired: boolean("t3_filing_required").default(true),
	benefitFormula: text("benefit_formula"),
	contributionRate: numeric("contribution_rate", { precision: 5, scale:  2 }),
	normalRetirementAge: integer("normal_retirement_age").default(65),
	earlyRetirementAge: integer("early_retirement_age").default(55),
	vestingPeriodYears: integer("vesting_period_years").default(2),
	currentAssets: numeric("current_assets", { precision: 15, scale:  2 }),
	currentLiabilities: numeric("current_liabilities", { precision: 15, scale:  2 }),
	fundedRatio: numeric("funded_ratio", { precision: 5, scale:  2 }),
	solvencyRatio: numeric("solvency_ratio", { precision: 5, scale:  2 }),
	lastValuationDate: date("last_valuation_date"),
	nextValuationDate: date("next_valuation_date"),
	valuationFrequencyMonths: integer("valuation_frequency_months").default(36),
	actuaryFirm: varchar("actuary_firm", { length: 200 }),
	actuaryContact: varchar("actuary_contact", { length: 200 }),
	planEffectiveDate: date("plan_effective_date").notNull(),
	planYearEnd: date("plan_year_end").notNull(),
	fiscalYearEnd: date("fiscal_year_end"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxPensionPlansOrg: index("idx_pension_plans_org").using("btree", table.organizationId.asc().nullsLast()),
		idxPensionPlansRegistration: index("idx_pension_plans_registration").using("btree", table.craRegistrationNumber.asc().nullsLast()),
		idxPensionPlansStatus: index("idx_pension_plans_status").using("btree", table.planStatus.asc().nullsLast()),
		idxPensionPlansType: index("idx_pension_plans_type").using("btree", table.planType.asc().nullsLast()),
		pensionPlansOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "pension_plans_organization_id_fkey"
		}),
	}
});

export const pensionHoursBanks = pgTable("pension_hours_banks", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	pensionPlanId: uuid("pension_plan_id").notNull(),
	memberId: uuid("member_id").notNull(),
	reportingPeriodStart: date("reporting_period_start").notNull(),
	reportingPeriodEnd: date("reporting_period_end").notNull(),
	totalHoursWorked: numeric("total_hours_worked", { precision: 10, scale:  2 }).default('0').notNull(),
	pensionableHours: numeric("pensionable_hours", { precision: 10, scale:  2 }).default('0').notNull(),
	overtimeHours: numeric("overtime_hours", { precision: 10, scale:  2 }).default('0'),
	primaryEmployerId: uuid("primary_employer_id"),
	secondaryEmployerIds: jsonb("secondary_employer_ids"),
	reciprocalHours: numeric("reciprocal_hours", { precision: 10, scale:  2 }).default('0'),
	reciprocalPlanIds: jsonb("reciprocal_plan_ids"),
	contributionCredits: numeric("contribution_credits", { precision: 10, scale:  2 }),
	status: varchar("status", { length: 50 }).default('active'),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxHoursBanksEmployer: index("idx_hours_banks_employer").using("btree", table.primaryEmployerId.asc().nullsLast()),
		idxHoursBanksMember: index("idx_hours_banks_member").using("btree", table.memberId.asc().nullsLast()),
		idxHoursBanksPeriod: index("idx_hours_banks_period").using("btree", table.reportingPeriodStart.asc().nullsLast(), table.reportingPeriodEnd.asc().nullsLast()),
		idxHoursBanksPlan: index("idx_hours_banks_plan").using("btree", table.pensionPlanId.asc().nullsLast()),
		pensionHoursBanksMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "pension_hours_banks_member_id_fkey"
		}),
		pensionHoursBanksPensionPlanIdFkey: foreignKey({
			columns: [table.pensionPlanId],
			foreignColumns: [pensionPlans.id],
			name: "pension_hours_banks_pension_plan_id_fkey"
		}),
		uniqueMemberPeriod: unique("unique_member_period").on(table.pensionPlanId, table.memberId, table.reportingPeriodStart),
	}
});

export const mlPredictions = pgTable("ml_predictions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	predictionType: varchar("prediction_type", { length: 50 }).notNull(),
	predictionDate: date("prediction_date").notNull(),
	predictedValue: numeric("predicted_value").notNull(),
	lowerBound: numeric("lower_bound"),
	upperBound: numeric("upper_bound"),
	confidence: numeric("confidence"),
	horizon: integer("horizon"),
	granularity: varchar("granularity", { length: 20 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
},
(table) => {
	return {
		idxMlPredictionsDate: index("idx_ml_predictions_date").using("btree", table.predictionDate.asc().nullsLast()),
		idxMlPredictionsOrganization: index("idx_ml_predictions_organization").using("btree", table.organizationId.asc().nullsLast()),
		idxMlPredictionsType: index("idx_ml_predictions_type").using("btree", table.predictionType.asc().nullsLast()),
		orgIdx: index("ml_predictions_org_idx").using("btree", table.organizationId.asc().nullsLast()),
		typeIdx: index("ml_predictions_type_idx").using("btree", table.predictionType.asc().nullsLast()),
		uniquePrediction: unique("unique_prediction").on(table.organizationId, table.predictionType, table.predictionDate, table.horizon),
	}
});

export const pensionContributions = pgTable("pension_contributions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	pensionPlanId: uuid("pension_plan_id").notNull(),
	employerId: uuid("employer_id"),
	employerName: varchar("employer_name", { length: 200 }).notNull(),
	employerRegistrationNumber: varchar("employer_registration_number", { length: 50 }),
	contributionPeriodStart: date("contribution_period_start").notNull(),
	contributionPeriodEnd: date("contribution_period_end").notNull(),
	dueDate: date("due_date").notNull(),
	totalMembersCovered: integer("total_members_covered").notNull(),
	memberContributions: jsonb("member_contributions"),
	totalContributionAmount: numeric("total_contribution_amount", { precision: 12, scale:  2 }).notNull(),
	employerPortion: numeric("employer_portion", { precision: 12, scale:  2 }),
	employeePortion: numeric("employee_portion", { precision: 12, scale:  2 }),
	currency: varchar("currency", { length: 3 }).default('CAD'),
	expectedAmount: numeric("expected_amount", { precision: 12, scale:  2 }),
	varianceAmount: numeric("variance_amount", { precision: 12, scale:  2 }),
	variancePercentage: numeric("variance_percentage", { precision: 5, scale:  2 }),
	reconciliationStatus: varchar("reconciliation_status", { length: 50 }).default('pending'),
	paymentStatus: varchar("payment_status", { length: 50 }).default('pending'),
	paymentDate: date("payment_date"),
	paymentMethod: varchar("payment_method", { length: 50 }),
	paymentReference: varchar("payment_reference", { length: 100 }),
	isLate: boolean("is_late").default(false),
	daysLate: integer("days_late"),
	lateFeeAmount: numeric("late_fee_amount", { precision: 10, scale:  2 }),
	interestCharged: numeric("interest_charged", { precision: 10, scale:  2 }),
	remittanceFileUrl: text("remittance_file_url"),
	reconciliationReportUrl: text("reconciliation_report_url"),
	contributionHash: varchar("contribution_hash", { length: 128 }),
	blockchainTxHash: varchar("blockchain_tx_hash", { length: 200 }),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	processedBy: uuid("processed_by"),
},
(table) => {
	return {
		idxPensionContributionsDueDate: index("idx_pension_contributions_due_date").using("btree", table.dueDate.asc().nullsLast()),
		idxPensionContributionsEmployer: index("idx_pension_contributions_employer").using("btree", table.employerId.asc().nullsLast()),
		idxPensionContributionsHash: index("idx_pension_contributions_hash").using("btree", table.contributionHash.asc().nullsLast()),
		idxPensionContributionsPeriod: index("idx_pension_contributions_period").using("btree", table.contributionPeriodStart.asc().nullsLast(), table.contributionPeriodEnd.asc().nullsLast()),
		idxPensionContributionsPlan: index("idx_pension_contributions_plan").using("btree", table.pensionPlanId.asc().nullsLast()),
		idxPensionContributionsStatus: index("idx_pension_contributions_status").using("btree", table.paymentStatus.asc().nullsLast()),
		pensionContributionsPensionPlanIdFkey: foreignKey({
			columns: [table.pensionPlanId],
			foreignColumns: [pensionPlans.id],
			name: "pension_contributions_pension_plan_id_fkey"
		}),
	}
});

export const pensionTrusteeBoards = pgTable("pension_trustee_boards", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	pensionPlanId: uuid("pension_plan_id").notNull(),
	boardName: varchar("board_name", { length: 200 }).notNull(),
	isJointBoard: boolean("is_joint_board").default(true),
	totalTrustees: integer("total_trustees").notNull(),
	laborTrusteesRequired: integer("labor_trustees_required"),
	managementTrusteesRequired: integer("management_trustees_required"),
	independentTrusteesRequired: integer("independent_trustees_required").default(0),
	meetingFrequency: varchar("meeting_frequency", { length: 50 }),
	quorumRequirement: integer("quorum_requirement"),
	bylawsUrl: text("bylaws_url"),
	trustAgreementUrl: text("trust_agreement_url"),
	investmentPolicyUrl: text("investment_policy_url"),
	establishedDate: date("established_date"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxTrusteeBoardsPlan: index("idx_trustee_boards_plan").using("btree", table.pensionPlanId.asc().nullsLast()),
		pensionTrusteeBoardsPensionPlanIdFkey: foreignKey({
			columns: [table.pensionPlanId],
			foreignColumns: [pensionPlans.id],
			name: "pension_trustee_boards_pension_plan_id_fkey"
		}),
	}
});

export const modelMetadata = pgTable("model_metadata", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	modelType: varchar("model_type", { length: 50 }).notNull(),
	version: varchar("version", { length: 20 }).notNull(),
	accuracy: numeric("accuracy"),
	trainedAt: timestamp("trained_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	parameters: jsonb("parameters"),
},
(table) => {
	return {
		idxModelMetadataOrganization: index("idx_model_metadata_organization").using("btree", table.organizationId.asc().nullsLast()),
		idxModelMetadataType: index("idx_model_metadata_type").using("btree", table.modelType.asc().nullsLast()),
		uniqueModel: unique("unique_model").on(table.organizationId, table.modelType, table.version),
	}
});

export const pensionTrustees = pgTable("pension_trustees", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	trusteeBoardId: uuid("trustee_board_id").notNull(),
	userId: uuid("user_id"),
	trusteeName: varchar("trustee_name", { length: 200 }).notNull(),
	trusteeType: varchar("trustee_type", { length: 50 }).notNull(),
	position: varchar("position", { length: 100 }),
	isVotingMember: boolean("is_voting_member").default(true),
	termStartDate: date("term_start_date").notNull(),
	termEndDate: date("term_end_date"),
	termLengthYears: integer("term_length_years").default(3),
	isCurrent: boolean("is_current").default(true),
	representingOrganization: varchar("representing_organization", { length: 200 }),
	representingOrganizationId: uuid("representing_organization_id"),
	email: varchar("email", { length: 255 }),
	phone: varchar("phone", { length: 50 }),
	notes: text("notes"),
	appointedAt: timestamp("appointed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	appointedBy: uuid("appointed_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxTrusteesBoard: index("idx_trustees_board").using("btree", table.trusteeBoardId.asc().nullsLast()),
		idxTrusteesCurrent: index("idx_trustees_current").using("btree", table.isCurrent.asc().nullsLast()),
		idxTrusteesType: index("idx_trustees_type").using("btree", table.trusteeType.asc().nullsLast()),
		idxTrusteesUser: index("idx_trustees_user").using("btree", table.userId.asc().nullsLast()),
		pensionTrusteesTrusteeBoardIdFkey: foreignKey({
			columns: [table.trusteeBoardId],
			foreignColumns: [pensionTrusteeBoards.id],
			name: "pension_trustees_trustee_board_id_fkey"
		}),
	}
});

export const analyticsMetrics = pgTable("analytics_metrics", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	metricType: text("metric_type").notNull(),
	metricName: text("metric_name").notNull(),
	metricValue: numeric("metric_value").notNull(),
	metricUnit: text("metric_unit"),
	periodType: text("period_type").notNull(),
	periodStart: timestamp("period_start", { mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { mode: 'string' }).notNull(),
	metadata: jsonb("metadata"),
	comparisonValue: numeric("comparison_value"),
	trend: text("trend"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		orgIdx: index("analytics_metrics_org_idx").using("btree", table.organizationId.asc().nullsLast()),
		periodIdx: index("analytics_metrics_period_idx").using("btree", table.periodStart.asc().nullsLast(), table.periodEnd.asc().nullsLast()),
		typeIdx: index("analytics_metrics_type_idx").using("btree", table.metricType.asc().nullsLast()),
		analyticsMetricsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "analytics_metrics_organization_id_fkey"
		}).onDelete("cascade"),
	}
});

export const pensionTrusteeMeetings = pgTable("pension_trustee_meetings", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	trusteeBoardId: uuid("trustee_board_id").notNull(),
	meetingTitle: varchar("meeting_title", { length: 200 }).notNull(),
	meetingType: varchar("meeting_type", { length: 50 }).default('regular'),
	meetingDate: date("meeting_date").notNull(),
	meetingStartTime: time("meeting_start_time"),
	meetingEndTime: time("meeting_end_time"),
	meetingLocation: varchar("meeting_location", { length: 200 }),
	isVirtual: boolean("is_virtual").default(false),
	meetingLink: text("meeting_link"),
	trusteesPresent: jsonb("trustees_present"),
	trusteesAbsent: jsonb("trustees_absent"),
	guestsPresent: jsonb("guests_present"),
	quorumMet: boolean("quorum_met"),
	agendaUrl: text("agenda_url"),
	minutesUrl: text("minutes_url"),
	minutesApproved: boolean("minutes_approved").default(false),
	minutesApprovedDate: date("minutes_approved_date"),
	motions: jsonb("motions"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxTrusteeMeetingsBoard: index("idx_trustee_meetings_board").using("btree", table.trusteeBoardId.asc().nullsLast()),
		idxTrusteeMeetingsDate: index("idx_trustee_meetings_date").using("btree", table.meetingDate.asc().nullsLast()),
		idxTrusteeMeetingsType: index("idx_trustee_meetings_type").using("btree", table.meetingType.asc().nullsLast()),
		pensionTrusteeMeetingsTrusteeBoardIdFkey: foreignKey({
			columns: [table.trusteeBoardId],
			foreignColumns: [pensionTrusteeBoards.id],
			name: "pension_trustee_meetings_trustee_board_id_fkey"
		}),
	}
});

export const pensionBenefitClaims = pgTable("pension_benefit_claims", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	pensionPlanId: uuid("pension_plan_id").notNull(),
	memberId: uuid("member_id").notNull(),
	claimType: pensionClaimType("claim_type").notNull(),
	claimNumber: varchar("claim_number", { length: 50 }),
	claimStatus: varchar("claim_status", { length: 50 }).default('pending'),
	claimDate: date("claim_date").default(sql`CURRENT_DATE`).notNull(),
	benefitStartDate: date("benefit_start_date"),
	benefitEndDate: date("benefit_end_date"),
	monthlyBenefitAmount: numeric("monthly_benefit_amount", { precision: 10, scale:  2 }),
	annualBenefitAmount: numeric("annual_benefit_amount", { precision: 10, scale:  2 }),
	lumpSumAmount: numeric("lump_sum_amount", { precision: 12, scale:  2 }),
	yearsOfService: numeric("years_of_service", { precision: 8, scale:  2 }),
	finalAverageEarnings: numeric("final_average_earnings", { precision: 10, scale:  2 }),
	benefitFormulaUsed: text("benefit_formula_used"),
	reductionPercentage: numeric("reduction_percentage", { precision: 5, scale:  2 }),
	submittedBy: uuid("submitted_by"),
	reviewedBy: uuid("reviewed_by"),
	approvedBy: uuid("approved_by"),
	reviewDate: date("review_date"),
	approvalDate: date("approval_date"),
	denialReason: text("denial_reason"),
	paymentFrequency: varchar("payment_frequency", { length: 50 }),
	paymentMethod: varchar("payment_method", { length: 50 }),
	bankAccountInfoEncrypted: text("bank_account_info_encrypted"),
	taxWithholdingRate: numeric("tax_withholding_rate", { precision: 5, scale:  2 }),
	taxWithholdingAmount: numeric("tax_withholding_amount", { precision: 10, scale:  2 }),
	applicationFormUrl: text("application_form_url"),
	supportingDocumentsUrls: jsonb("supporting_documents_urls"),
	approvalLetterUrl: text("approval_letter_url"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxPensionClaimsMember: index("idx_pension_claims_member").using("btree", table.memberId.asc().nullsLast()),
		idxPensionClaimsPlan: index("idx_pension_claims_plan").using("btree", table.pensionPlanId.asc().nullsLast()),
		idxPensionClaimsStartDate: index("idx_pension_claims_start_date").using("btree", table.benefitStartDate.asc().nullsLast()),
		idxPensionClaimsStatus: index("idx_pension_claims_status").using("btree", table.claimStatus.asc().nullsLast()),
		idxPensionClaimsType: index("idx_pension_claims_type").using("btree", table.claimType.asc().nullsLast()),
		pensionBenefitClaimsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "pension_benefit_claims_member_id_fkey"
		}),
		pensionBenefitClaimsPensionPlanIdFkey: foreignKey({
			columns: [table.pensionPlanId],
			foreignColumns: [pensionPlans.id],
			name: "pension_benefit_claims_pension_plan_id_fkey"
		}),
		pensionBenefitClaimsClaimNumberKey: unique("pension_benefit_claims_claim_number_key").on(table.claimNumber),
	}
});

export const pensionActuarialValuations = pgTable("pension_actuarial_valuations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	pensionPlanId: uuid("pension_plan_id").notNull(),
	valuationDate: date("valuation_date").notNull(),
	valuationType: varchar("valuation_type", { length: 50 }).notNull(),
	actuaryFirm: varchar("actuary_firm", { length: 200 }).notNull(),
	actuaryName: varchar("actuary_name", { length: 200 }),
	actuaryDesignation: varchar("actuary_designation", { length: 50 }),
	marketValueAssets: numeric("market_value_assets", { precision: 15, scale:  2 }).notNull(),
	smoothedValueAssets: numeric("smoothed_value_assets", { precision: 15, scale:  2 }),
	goingConcernLiabilities: numeric("going_concern_liabilities", { precision: 15, scale:  2 }),
	solvencyLiabilities: numeric("solvency_liabilities", { precision: 15, scale:  2 }),
	windUpLiabilities: numeric("wind_up_liabilities", { precision: 15, scale:  2 }),
	goingConcernSurplusDeficit: numeric("going_concern_surplus_deficit", { precision: 15, scale:  2 }),
	goingConcernFundedRatio: numeric("going_concern_funded_ratio", { precision: 5, scale:  2 }),
	solvencySurplusDeficit: numeric("solvency_surplus_deficit", { precision: 15, scale:  2 }),
	solvencyFundedRatio: numeric("solvency_funded_ratio", { precision: 5, scale:  2 }),
	discountRate: numeric("discount_rate", { precision: 5, scale:  2 }),
	inflationRate: numeric("inflation_rate", { precision: 5, scale:  2 }),
	salaryIncreaseRate: numeric("salary_increase_rate", { precision: 5, scale:  2 }),
	mortalityTable: varchar("mortality_table", { length: 100 }),
	recommendedEmployerContribution: numeric("recommended_employer_contribution", { precision: 12, scale:  2 }),
	recommendedContributionRate: numeric("recommended_contribution_rate", { precision: 5, scale:  2 }),
	specialPaymentRequired: numeric("special_payment_required", { precision: 12, scale:  2 }),
	valuationReportUrl: text("valuation_report_url").notNull(),
	summaryReportUrl: text("summary_report_url"),
	filedWithRegulator: boolean("filed_with_regulator").default(false),
	filingDate: date("filing_date"),
	regulatorResponseUrl: text("regulator_response_url"),
	nextValuationRequiredDate: date("next_valuation_required_date"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxActuarialValuationsDate: index("idx_actuarial_valuations_date").using("btree", table.valuationDate.asc().nullsLast()),
		idxActuarialValuationsPlan: index("idx_actuarial_valuations_plan").using("btree", table.pensionPlanId.asc().nullsLast()),
		idxActuarialValuationsType: index("idx_actuarial_valuations_type").using("btree", table.valuationType.asc().nullsLast()),
		pensionActuarialValuationsPensionPlanIdFkey: foreignKey({
			columns: [table.pensionPlanId],
			foreignColumns: [pensionPlans.id],
			name: "pension_actuarial_valuations_pension_plan_id_fkey"
		}),
	}
});

export const hwBenefitPlans = pgTable("hw_benefit_plans", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	planName: varchar("plan_name", { length: 200 }).notNull(),
	planType: hwPlanType("plan_type").notNull(),
	planNumber: varchar("plan_number", { length: 50 }),
	carrierName: varchar("carrier_name", { length: 200 }),
	carrierPolicyNumber: varchar("carrier_policy_number", { length: 100 }),
	tpaName: varchar("tpa_name", { length: 200 }),
	tpaContact: varchar("tpa_contact", { length: 200 }),
	coverageType: varchar("coverage_type", { length: 50 }),
	coverageTierStructure: jsonb("coverage_tier_structure"),
	monthlyPremiumAmount: numeric("monthly_premium_amount", { precision: 10, scale:  2 }),
	employerContributionPercentage: numeric("employer_contribution_percentage", { precision: 5, scale:  2 }),
	employeeContributionPercentage: numeric("employee_contribution_percentage", { precision: 5, scale:  2 }),
	annualMaximum: numeric("annual_maximum", { precision: 10, scale:  2 }),
	lifetimeMaximum: numeric("lifetime_maximum", { precision: 12, scale:  2 }),
	deductible: numeric("deductible", { precision: 8, scale:  2 }),
	coinsurancePercentage: numeric("coinsurance_percentage", { precision: 5, scale:  2 }),
	outOfPocketMaximum: numeric("out_of_pocket_maximum", { precision: 10, scale:  2 }),
	waitingPeriodDays: integer("waiting_period_days").default(0),
	hoursRequiredPerMonth: integer("hours_required_per_month"),
	planYearStart: date("plan_year_start"),
	planYearEnd: date("plan_year_end"),
	renewalDate: date("renewal_date"),
	isActive: boolean("is_active").default(true),
	isSelfInsured: boolean("is_self_insured").default(false),
	planBookletUrl: text("plan_booklet_url"),
	summaryPlanDescriptionUrl: text("summary_plan_description_url"),
	benefitsAtAGlanceUrl: text("benefits_at_a_glance_url"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxHwPlansCarrier: index("idx_hw_plans_carrier").using("btree", table.carrierName.asc().nullsLast()),
		idxHwPlansOrg: index("idx_hw_plans_org").using("btree", table.organizationId.asc().nullsLast()),
		idxHwPlansType: index("idx_hw_plans_type").using("btree", table.planType.asc().nullsLast()),
		hwBenefitPlansOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "hw_benefit_plans_organization_id_fkey"
		}),
	}
});

export const hwBenefitEnrollments = pgTable("hw_benefit_enrollments", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	hwPlanId: uuid("hw_plan_id").notNull(),
	memberId: uuid("member_id").notNull(),
	enrollmentDate: date("enrollment_date").notNull(),
	effectiveDate: date("effective_date").notNull(),
	terminationDate: date("termination_date"),
	coverageTier: varchar("coverage_tier", { length: 50 }),
	dependents: jsonb("dependents"),
	totalDependents: integer("total_dependents").default(0),
	monthlyPremium: numeric("monthly_premium", { precision: 10, scale:  2 }),
	employerContribution: numeric("employer_contribution", { precision: 10, scale:  2 }),
	employeeContribution: numeric("employee_contribution", { precision: 10, scale:  2 }),
	enrollmentStatus: varchar("enrollment_status", { length: 50 }).default('active'),
	qualifyingEvent: varchar("qualifying_event", { length: 100 }),
	qualifyingEventDate: date("qualifying_event_date"),
	waivedCoverage: boolean("waived_coverage").default(false),
	waiverReason: text("waiver_reason"),
	enrollmentFormUrl: text("enrollment_form_url"),
	beneficiaryDesignationUrl: text("beneficiary_designation_url"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxHwEnrollmentsEffective: index("idx_hw_enrollments_effective").using("btree", table.effectiveDate.asc().nullsLast()),
		idxHwEnrollmentsMember: index("idx_hw_enrollments_member").using("btree", table.memberId.asc().nullsLast()),
		idxHwEnrollmentsPlan: index("idx_hw_enrollments_plan").using("btree", table.hwPlanId.asc().nullsLast()),
		idxHwEnrollmentsStatus: index("idx_hw_enrollments_status").using("btree", table.enrollmentStatus.asc().nullsLast()),
		hwBenefitEnrollmentsHwPlanIdFkey: foreignKey({
			columns: [table.hwPlanId],
			foreignColumns: [hwBenefitPlans.id],
			name: "hw_benefit_enrollments_hw_plan_id_fkey"
		}),
		hwBenefitEnrollmentsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "hw_benefit_enrollments_member_id_fkey"
		}),
		uniqueMemberPlanPeriod: unique("unique_member_plan_period").on(table.hwPlanId, table.memberId, table.effectiveDate),
	}
});

export const hwBenefitClaims = pgTable("hw_benefit_claims", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	hwPlanId: uuid("hw_plan_id").notNull(),
	enrollmentId: uuid("enrollment_id").notNull(),
	memberId: uuid("member_id").notNull(),
	claimNumber: varchar("claim_number", { length: 50 }).notNull(),
	carrierClaimNumber: varchar("carrier_claim_number", { length: 100 }),
	serviceDate: date("service_date").notNull(),
	serviceType: varchar("service_type", { length: 100 }),
	diagnosisCodes: jsonb("diagnosis_codes"),
	procedureCodes: jsonb("procedure_codes"),
	providerName: varchar("provider_name", { length: 200 }),
	providerNpi: varchar("provider_npi", { length: 20 }),
	providerType: varchar("provider_type", { length: 100 }),
	providerTaxId: varchar("provider_tax_id", { length: 20 }),
	patientName: varchar("patient_name", { length: 200 }),
	patientRelationship: varchar("patient_relationship", { length: 50 }),
	totalBilledAmount: numeric("total_billed_amount", { precision: 10, scale:  2 }).notNull(),
	eligibleAmount: numeric("eligible_amount", { precision: 10, scale:  2 }),
	deductibleApplied: numeric("deductible_applied", { precision: 10, scale:  2 }).default('0'),
	coinsuranceAmount: numeric("coinsurance_amount", { precision: 10, scale:  2 }).default('0'),
	copayAmount: numeric("copay_amount", { precision: 10, scale:  2 }).default('0'),
	planPaidAmount: numeric("plan_paid_amount", { precision: 10, scale:  2 }),
	memberResponsibility: numeric("member_responsibility", { precision: 10, scale:  2 }),
	isCob: boolean("is_cob").default(false),
	primaryPayer: varchar("primary_payer", { length: 200 }),
	primaryPayerAmount: numeric("primary_payer_amount", { precision: 10, scale:  2 }),
	claimStatus: hwClaimStatus("claim_status").default('submitted'),
	submissionDate: date("submission_date").default(sql`CURRENT_DATE`).notNull(),
	receivedDate: date("received_date"),
	processedDate: date("processed_date"),
	paidDate: date("paid_date"),
	denialReason: text("denial_reason"),
	denialCode: varchar("denial_code", { length: 50 }),
	appealDeadline: date("appeal_deadline"),
	appealSubmittedDate: date("appeal_submitted_date"),
	appealDecisionDate: date("appeal_decision_date"),
	appealNotes: text("appeal_notes"),
	edi837FileUrl: text("edi_837_file_url"),
	edi835FileUrl: text("edi_835_file_url"),
	edi277StatusUrl: text("edi_277_status_url"),
	paymentMethod: varchar("payment_method", { length: 50 }),
	paymentReference: varchar("payment_reference", { length: 100 }),
	eobUrl: text("eob_url"),
	flaggedForReview: boolean("flagged_for_review").default(false),
	fraudScore: integer("fraud_score"),
	fraudIndicators: jsonb("fraud_indicators"),
	claimFormUrl: text("claim_form_url"),
	supportingDocumentsUrls: jsonb("supporting_documents_urls"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	submittedBy: uuid("submitted_by"),
	processedBy: uuid("processed_by"),
},
(table) => {
	return {
		idxHwClaimsCarrierNumber: index("idx_hw_claims_carrier_number").using("btree", table.carrierClaimNumber.asc().nullsLast()),
		idxHwClaimsEnrollment: index("idx_hw_claims_enrollment").using("btree", table.enrollmentId.asc().nullsLast()),
		idxHwClaimsFraud: index("idx_hw_claims_fraud").using("btree", table.flaggedForReview.asc().nullsLast(), table.fraudScore.asc().nullsLast()),
		idxHwClaimsMember: index("idx_hw_claims_member").using("btree", table.memberId.asc().nullsLast()),
		idxHwClaimsPlan: index("idx_hw_claims_plan").using("btree", table.hwPlanId.asc().nullsLast()),
		idxHwClaimsServiceDate: index("idx_hw_claims_service_date").using("btree", table.serviceDate.asc().nullsLast()),
		idxHwClaimsStatus: index("idx_hw_claims_status").using("btree", table.claimStatus.asc().nullsLast()),
		hwBenefitClaimsEnrollmentIdFkey: foreignKey({
			columns: [table.enrollmentId],
			foreignColumns: [hwBenefitEnrollments.id],
			name: "hw_benefit_claims_enrollment_id_fkey"
		}),
		hwBenefitClaimsHwPlanIdFkey: foreignKey({
			columns: [table.hwPlanId],
			foreignColumns: [hwBenefitPlans.id],
			name: "hw_benefit_claims_hw_plan_id_fkey"
		}),
		hwBenefitClaimsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "hw_benefit_claims_member_id_fkey"
		}),
		hwBenefitClaimsClaimNumberKey: unique("hw_benefit_claims_claim_number_key").on(table.claimNumber),
	}
});

export const trustComplianceReports = pgTable("trust_compliance_reports", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	pensionPlanId: uuid("pension_plan_id"),
	hwPlanId: uuid("hw_plan_id"),
	organizationId: uuid("organization_id").notNull(),
	reportType: varchar("report_type", { length: 100 }).notNull(),
	reportYear: integer("report_year").notNull(),
	reportPeriodStart: date("report_period_start").notNull(),
	reportPeriodEnd: date("report_period_end").notNull(),
	dueDate: date("due_date").notNull(),
	filedDate: date("filed_date"),
	filingStatus: varchar("filing_status", { length: 50 }).default('pending'),
	regulator: varchar("regulator", { length: 100 }),
	filingConfirmationNumber: varchar("filing_confirmation_number", { length: 100 }),
	totalPlanAssets: numeric("total_plan_assets", { precision: 15, scale:  2 }),
	totalPlanLiabilities: numeric("total_plan_liabilities", { precision: 15, scale:  2 }),
	totalContributionsReceived: numeric("total_contributions_received", { precision: 12, scale:  2 }),
	totalBenefitsPaid: numeric("total_benefits_paid", { precision: 12, scale:  2 }),
	administrativeExpenses: numeric("administrative_expenses", { precision: 10, scale:  2 }),
	auditRequired: boolean("audit_required").default(false),
	auditorName: varchar("auditor_name", { length: 200 }),
	auditorOpinion: varchar("auditor_opinion", { length: 50 }),
	auditReportUrl: text("audit_report_url"),
	isLate: boolean("is_late").default(false),
	daysLate: integer("days_late"),
	lateFilingPenalty: numeric("late_filing_penalty", { precision: 10, scale:  2 }),
	penaltyPaid: boolean("penalty_paid").default(false),
	reportFileUrl: text("report_file_url").notNull(),
	schedulesUrls: jsonb("schedules_urls"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	preparedBy: uuid("prepared_by"),
	filedBy: uuid("filed_by"),
},
(table) => {
	return {
		idxComplianceReportsDueDate: index("idx_compliance_reports_due_date").using("btree", table.dueDate.asc().nullsLast()),
		idxComplianceReportsHw: index("idx_compliance_reports_hw").using("btree", table.hwPlanId.asc().nullsLast()),
		idxComplianceReportsOrg: index("idx_compliance_reports_org").using("btree", table.organizationId.asc().nullsLast()),
		idxComplianceReportsPension: index("idx_compliance_reports_pension").using("btree", table.pensionPlanId.asc().nullsLast()),
		idxComplianceReportsStatus: index("idx_compliance_reports_status").using("btree", table.filingStatus.asc().nullsLast()),
		idxComplianceReportsTypeYear: index("idx_compliance_reports_type_year").using("btree", table.reportType.asc().nullsLast(), table.reportYear.asc().nullsLast()),
		trustComplianceReportsHwPlanIdFkey: foreignKey({
			columns: [table.hwPlanId],
			foreignColumns: [hwBenefitPlans.id],
			name: "trust_compliance_reports_hw_plan_id_fkey"
		}),
		trustComplianceReportsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "trust_compliance_reports_organization_id_fkey"
		}),
		trustComplianceReportsPensionPlanIdFkey: foreignKey({
			columns: [table.pensionPlanId],
			foreignColumns: [pensionPlans.id],
			name: "trust_compliance_reports_pension_plan_id_fkey"
		}),
	}
});

export const vPensionFundingSummary = pgTable("v_pension_funding_summary", {
	planId: uuid("plan_id"),
	organizationId: uuid("organization_id"),
	planName: varchar("plan_name", { length: 200 }),
	planType: pensionPlanType("plan_type"),
	isMultiEmployer: boolean("is_multi_employer"),
	currentAssets: numeric("current_assets", { precision: 15, scale:  2 }),
	currentLiabilities: numeric("current_liabilities", { precision: 15, scale:  2 }),
	fundedRatio: numeric("funded_ratio", { precision: 5, scale:  2 }),
	latestGcFundedRatio: numeric("latest_gc_funded_ratio", { precision: 5, scale:  2 }),
	latestSolvencyFundedRatio: numeric("latest_solvency_funded_ratio", { precision: 5, scale:  2 }),
	latestValuationDate: date("latest_valuation_date"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalActiveMembers: bigint("total_active_members", { mode: "number" }),
	totalPensionableHours: numeric("total_pensionable_hours"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalBenefitClaims: bigint("total_benefit_claims", { mode: "number" }),
	totalAnnualBenefitsApproved: numeric("total_annual_benefits_approved"),
});

export const vHwClaimsAging = pgTable("v_hw_claims_aging", {
	planId: uuid("plan_id"),
	organizationId: uuid("organization_id"),
	planName: varchar("plan_name", { length: 200 }),
	planType: hwPlanType("plan_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalClaims: bigint("total_claims", { mode: "number" }),
	totalBilled: numeric("total_billed"),
	totalPaid: numeric("total_paid"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pendingCount: bigint("pending_count", { mode: "number" }),
	pendingAmount: numeric("pending_amount"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	aged30DaysCount: bigint("aged_30_days_count", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	aged60DaysCount: bigint("aged_60_days_count", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	aged90DaysCount: bigint("aged_90_days_count", { mode: "number" }),
	avgProcessingDays: numeric("avg_processing_days"),
});

export const vMemberBenefitEligibility = pgTable("v_member_benefit_eligibility", {
	memberId: uuid("member_id"),
	organizationId: uuid("organization_id"),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	membershipStatus: varchar("membership_status", { length: 50 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pensionPlansEnrolled: bigint("pension_plans_enrolled", { mode: "number" }),
	totalPensionHours: numeric("total_pension_hours"),
	lastPensionContributionDate: date("last_pension_contribution_date"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	hwPlansEnrolled: bigint("hw_plans_enrolled", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activeHwEnrollments: bigint("active_hw_enrollments", { mode: "number" }),
	latestHwEnrollmentDate: date("latest_hw_enrollment_date"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalPensionClaims: bigint("total_pension_claims", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalHwClaims: bigint("total_hw_claims", { mode: "number" }),
	totalPensionBenefitsClaimed: numeric("total_pension_benefits_claimed"),
	totalHwBenefitsPaid: numeric("total_hw_benefits_paid"),
});

export const taxYearConfigurations = pgTable("tax_year_configurations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	taxYear: integer("tax_year").notNull(),
	t4AFilingDeadline: date("t4a_filing_deadline").notNull(),
	copeReceiptDeadline: date("cope_receipt_deadline").notNull(),
	rl1FilingDeadline: date("rl_1_filing_deadline"),
	craTransmitterNumber: varchar("cra_transmitter_number", { length: 8 }),
	craWebAccessCode: varchar("cra_web_access_code", { length: 16 }),
	craBusinessNumber: varchar("cra_business_number", { length: 15 }),
	rqIdentificationNumber: varchar("rq_identification_number", { length: 10 }),
	rqFileNumber: varchar("rq_file_number", { length: 6 }),
	electionsCanadaAgentId: varchar("elections_canada_agent_id", { length: 50 }),
	electionsCanadaRecipientNumber: varchar("elections_canada_recipient_number", { length: 20 }),
	organizationContactName: varchar("organization_contact_name", { length: 200 }),
	organizationContactPhone: varchar("organization_contact_phone", { length: 50 }),
	organizationContactEmail: varchar("organization_contact_email", { length: 255 }),
	organizationMailingAddress: text("organization_mailing_address"),
	isFinalized: boolean("is_finalized").default(false),
	finalizedAt: timestamp("finalized_at", { withTimezone: true, mode: 'string' }),
	finalizedBy: uuid("finalized_by"),
	xmlFileGenerated: boolean("xml_file_generated").default(false),
	xmlGeneratedAt: timestamp("xml_generated_at", { withTimezone: true, mode: 'string' }),
	submittedToCra: boolean("submitted_to_cra").default(false),
	craSubmissionDate: date("cra_submission_date"),
	craConfirmationNumber: varchar("cra_confirmation_number", { length: 100 }),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxTaxYearConfigOrg: index("idx_tax_year_config_org").using("btree", table.organizationId.asc().nullsLast()),
		idxTaxYearConfigYear: index("idx_tax_year_config_year").using("btree", table.taxYear.asc().nullsLast()),
		taxYearConfigurationsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "tax_year_configurations_organization_id_fkey"
		}),
		uniqueOrgTaxYear: unique("unique_org_tax_year").on(table.organizationId, table.taxYear),
	}
});

export const trendAnalyses = pgTable("trend_analyses", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	analysisType: text("analysis_type").notNull(),
	dataSource: text("data_source").notNull(),
	timeRange: jsonb("time_range").notNull(),
	detectedTrend: text("detected_trend"),
	trendStrength: numeric("trend_strength"),
	anomaliesDetected: jsonb("anomalies_detected"),
	anomalyCount: integer("anomaly_count").default(0),
	seasonalPattern: jsonb("seasonal_pattern"),
	correlations: jsonb("correlations"),
	insights: text("insights"),
	recommendations: jsonb("recommendations"),
	statisticalTests: jsonb("statistical_tests"),
	visualizationData: jsonb("visualization_data"),
	confidence: numeric("confidence"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		createdIdx: index("trend_analyses_created_idx").using("btree", table.createdAt.asc().nullsLast()),
		dataSourceIdx: index("trend_analyses_data_source_idx").using("btree", table.dataSource.asc().nullsLast()),
		orgIdx: index("trend_analyses_org_idx").using("btree", table.organizationId.asc().nullsLast()),
		typeIdx: index("trend_analyses_type_idx").using("btree", table.analysisType.asc().nullsLast()),
		trendAnalysesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "trend_analyses_organization_id_fkey"
		}).onDelete("cascade"),
	}
});

export const taxSlips = pgTable("tax_slips", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	taxYearConfigId: uuid("tax_year_config_id").notNull(),
	memberId: uuid("member_id"),
	recipientName: varchar("recipient_name", { length: 200 }).notNull(),
	recipientSin: varchar("recipient_sin", { length: 11 }),
	recipientAddressLine1: varchar("recipient_address_line1", { length: 200 }),
	recipientAddressLine2: varchar("recipient_address_line2", { length: 200 }),
	recipientCity: varchar("recipient_city", { length: 100 }),
	recipientProvince: varchar("recipient_province", { length: 2 }),
	recipientPostalCode: varchar("recipient_postal_code", { length: 7 }),
	slipType: taxSlipType("slip_type").notNull(),
	taxYear: integer("tax_year").notNull(),
	slipNumber: varchar("slip_number", { length: 50 }).notNull(),
	box016PensionAmount: integer("box_016_pension_amount").default(0),
	box018LumpSumAmount: integer("box_018_lump_sum_amount").default(0),
	box020SelfEmployedCommissions: integer("box_020_self_employed_commissions").default(0),
	box022IncomeTaxDeducted: integer("box_022_income_tax_deducted").default(0),
	box024Annuities: integer("box_024_annuities").default(0),
	box048FeesForServices: integer("box_048_fees_for_services").default(0),
	box101RespAccumulatedIncome: integer("box_101_resp_accumulated_income").default(0),
	box102RespEducationalAssistance: integer("box_102_resp_educational_assistance").default(0),
	box105OtherIncome: integer("box_105_other_income").default(0),
	copeContributionAmount: integer("cope_contribution_amount").default(0),
	copeEligibleAmount: integer("cope_eligible_amount").default(0),
	copeIneligibleAmount: integer("cope_ineligible_amount").default(0),
	rl1BoxOPensionAmount: integer("rl_1_box_o_pension_amount").default(0),
	quebecProvincialTaxWithheld: integer("quebec_provincial_tax_withheld").default(0),
	sourceTransactionIds: jsonb("source_transaction_ids"),
	isAmended: boolean("is_amended").default(false),
	originalSlipId: uuid("original_slip_id"),
	amendmentNumber: integer("amendment_number").default(0),
	amendmentReason: text("amendment_reason"),
	slipStatus: varchar("slip_status", { length: 50 }).default('draft'),
	finalizedAt: timestamp("finalized_at", { withTimezone: true, mode: 'string' }),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }),
	deliveryMethod: varchar("delivery_method", { length: 50 }),
	emailSentAt: timestamp("email_sent_at", { withTimezone: true, mode: 'string' }),
	emailOpenedAt: timestamp("email_opened_at", { withTimezone: true, mode: 'string' }),
	downloadedAt: timestamp("downloaded_at", { withTimezone: true, mode: 'string' }),
	pdfUrl: text("pdf_url"),
	pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true, mode: 'string' }),
	includedInXmlBatch: boolean("included_in_xml_batch").default(false),
	xmlBatchId: uuid("xml_batch_id"),
	slipHash: varchar("slip_hash", { length: 128 }),
	digitalSignature: text("digital_signature"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxTaxSlipsConfig: index("idx_tax_slips_config").using("btree", table.taxYearConfigId.asc().nullsLast()),
		idxTaxSlipsHash: index("idx_tax_slips_hash").using("btree", table.slipHash.asc().nullsLast()),
		idxTaxSlipsMember: index("idx_tax_slips_member").using("btree", table.memberId.asc().nullsLast()),
		idxTaxSlipsOrg: index("idx_tax_slips_org").using("btree", table.organizationId.asc().nullsLast()),
		idxTaxSlipsSin: index("idx_tax_slips_sin").using("btree", table.recipientSin.asc().nullsLast()),
		idxTaxSlipsStatus: index("idx_tax_slips_status").using("btree", table.slipStatus.asc().nullsLast()),
		idxTaxSlipsType: index("idx_tax_slips_type").using("btree", table.slipType.asc().nullsLast()),
		idxTaxSlipsYear: index("idx_tax_slips_year").using("btree", table.taxYear.asc().nullsLast()),
		taxSlipsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "tax_slips_member_id_fkey"
		}),
		taxSlipsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "tax_slips_organization_id_fkey"
		}),
		taxSlipsOriginalSlipIdFkey: foreignKey({
			columns: [table.originalSlipId],
			foreignColumns: [table.id],
			name: "tax_slips_original_slip_id_fkey"
		}),
		taxSlipsTaxYearConfigIdFkey: foreignKey({
			columns: [table.taxYearConfigId],
			foreignColumns: [taxYearConfigurations.id],
			name: "tax_slips_tax_year_config_id_fkey"
		}),
		taxSlipsSlipNumberKey: unique("tax_slips_slip_number_key").on(table.slipNumber),
	}
});

export const craXmlBatches = pgTable("cra_xml_batches", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	taxYearConfigId: uuid("tax_year_config_id").notNull(),
	batchNumber: varchar("batch_number", { length: 50 }).notNull(),
	taxYear: integer("tax_year").notNull(),
	returnType: varchar("return_type", { length: 20 }).notNull(),
	transmitterNumber: varchar("transmitter_number", { length: 8 }).notNull(),
	transmitterName: varchar("transmitter_name", { length: 200 }),
	transmitterType: varchar("transmitter_type", { length: 10 }).default('E'),
	totalSlipsCount: integer("total_slips_count").notNull(),
	totalAmountReported: integer("total_amount_reported").notNull(),
	totalTaxWithheld: integer("total_tax_withheld").notNull(),
	xmlFilename: varchar("xml_filename", { length: 255 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	xmlFileSizeBytes: bigint("xml_file_size_bytes", { mode: "number" }),
	xmlSchemaVersion: varchar("xml_schema_version", { length: 20 }),
	xmlContent: text("xml_content"),
	xmlFileUrl: text("xml_file_url"),
	generatedAt: timestamp("generated_at", { withTimezone: true, mode: 'string' }),
	generatedBy: uuid("generated_by"),
	submissionMethod: varchar("submission_method", { length: 50 }),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	submittedBy: uuid("submitted_by"),
	craConfirmationNumber: varchar("cra_confirmation_number", { length: 100 }),
	craAccepted: boolean("cra_accepted"),
	craResponseDate: date("cra_response_date"),
	craResponseDetails: jsonb("cra_response_details"),
	craErrors: jsonb("cra_errors"),
	batchStatus: varchar("batch_status", { length: 50 }).default('draft'),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxCraBatchesConfig: index("idx_cra_batches_config").using("btree", table.taxYearConfigId.asc().nullsLast()),
		idxCraBatchesConfirmation: index("idx_cra_batches_confirmation").using("btree", table.craConfirmationNumber.asc().nullsLast()),
		idxCraBatchesOrg: index("idx_cra_batches_org").using("btree", table.organizationId.asc().nullsLast()),
		idxCraBatchesStatus: index("idx_cra_batches_status").using("btree", table.batchStatus.asc().nullsLast()),
		idxCraBatchesYear: index("idx_cra_batches_year").using("btree", table.taxYear.asc().nullsLast()),
		craXmlBatchesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "cra_xml_batches_organization_id_fkey"
		}),
		craXmlBatchesTaxYearConfigIdFkey: foreignKey({
			columns: [table.taxYearConfigId],
			foreignColumns: [taxYearConfigurations.id],
			name: "cra_xml_batches_tax_year_config_id_fkey"
		}),
		craXmlBatchesBatchNumberKey: unique("cra_xml_batches_batch_number_key").on(table.batchNumber),
	}
});

export const copeContributions = pgTable("cope_contributions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	memberId: uuid("member_id").notNull(),
	contributionDate: date("contribution_date").notNull(),
	contributionType: varchar("contribution_type", { length: 50 }).default('payroll_deduction'),
	totalAmount: integer("total_amount").notNull(),
	politicalPortion: integer("political_portion").notNull(),
	administrativePortion: integer("administrative_portion").notNull(),
	isEligibleForCredit: boolean("is_eligible_for_credit").default(true),
	ineligibleReason: text("ineligible_reason"),
	paymentMethod: varchar("payment_method", { length: 50 }),
	paymentReference: varchar("payment_reference", { length: 100 }),
	duesTransactionId: uuid("dues_transaction_id"),
	financialTransactionId: uuid("financial_transaction_id"),
	receiptIssued: boolean("receipt_issued").default(false),
	receiptIssuedDate: date("receipt_issued_date"),
	taxSlipId: uuid("tax_slip_id"),
	reportedToElectionsCanada: boolean("reported_to_elections_canada").default(false),
	electionsCanadaReportDate: date("elections_canada_report_date"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxCopeContributionsDate: index("idx_cope_contributions_date").using("btree", table.contributionDate.asc().nullsLast()),
		idxCopeContributionsDuesTxn: index("idx_cope_contributions_dues_txn").using("btree", table.duesTransactionId.asc().nullsLast()),
		idxCopeContributionsMember: index("idx_cope_contributions_member").using("btree", table.memberId.asc().nullsLast()),
		idxCopeContributionsOrg: index("idx_cope_contributions_org").using("btree", table.organizationId.asc().nullsLast()),
		idxCopeContributionsSlip: index("idx_cope_contributions_slip").using("btree", table.taxSlipId.asc().nullsLast()),
		copeContributionsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "cope_contributions_member_id_fkey"
		}),
		copeContributionsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "cope_contributions_organization_id_fkey"
		}),
		copeContributionsTaxSlipIdFkey: foreignKey({
			columns: [table.taxSlipId],
			foreignColumns: [taxSlips.id],
			name: "cope_contributions_tax_slip_id_fkey"
		}),
	}
});

export const vTaxSlipSummary = pgTable("v_tax_slip_summary", {
	organizationId: uuid("organization_id"),
	taxYear: integer("tax_year"),
	slipType: taxSlipType("slip_type"),
	slipStatus: varchar("slip_status", { length: 50 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalSlips: bigint("total_slips", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalAmountCents: bigint("total_amount_cents", { mode: "number" }),
	totalAmountDollars: numeric("total_amount_dollars"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalTaxWithheldCents: bigint("total_tax_withheld_cents", { mode: "number" }),
	totalTaxWithheldDollars: numeric("total_tax_withheld_dollars"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	slipsEmailed: bigint("slips_emailed", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	slipsDownloaded: bigint("slips_downloaded", { mode: "number" }),
});

export const vCopeMemberSummary = pgTable("v_cope_member_summary", {
	organizationId: uuid("organization_id"),
	memberId: uuid("member_id"),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	email: varchar("email", { length: 255 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalContributions: bigint("total_contributions", { mode: "number" }),
	firstContributionDate: date("first_contribution_date"),
	latestContributionDate: date("latest_contribution_date"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lifetimeTotalCents: bigint("lifetime_total_cents", { mode: "number" }),
	lifetimeTotalDollars: numeric("lifetime_total_dollars"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lifetimePoliticalCents: bigint("lifetime_political_cents", { mode: "number" }),
	lifetimePoliticalDollars: numeric("lifetime_political_dollars"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	receiptsIssued: bigint("receipts_issued", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	receiptsPending: bigint("receipts_pending", { mode: "number" }),
});

export const memberDemographics = pgTable("member_demographics", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	memberId: uuid("member_id").notNull(),
	organizationId: uuid("organization_id").notNull(),
	dataCollectionConsent: boolean("data_collection_consent").default(false).notNull(),
	consentDate: timestamp("consent_date", { withTimezone: true, mode: 'string' }),
	consentWithdrawnDate: timestamp("consent_withdrawn_date", { withTimezone: true, mode: 'string' }),
	consentType: varchar("consent_type", { length: 50 }),
	consentPurpose: text("consent_purpose"),
	dataRetentionYears: integer("data_retention_years").default(7),
	dataExpiryDate: date("data_expiry_date"),
	equityGroups: jsonb("equity_groups").default([]),
	genderIdentity: genderIdentityType("gender_identity"),
	genderIdentityOther: text("gender_identity_other"),
	isIndigenous: boolean("is_indigenous"),
	indigenousIdentity: indigenousIdentityType("indigenous_identity"),
	indigenousNation: varchar("indigenous_nation", { length: 200 }),
	indigenousTreatyNumber: varchar("indigenous_treaty_number", { length: 50 }),
	indigenousDataGovernanceConsent: boolean("indigenous_data_governance_consent").default(false),
	isVisibleMinority: boolean("is_visible_minority"),
	visibleMinorityGroups: jsonb("visible_minority_groups"),
	hasDisability: boolean("has_disability"),
	disabilityTypes: jsonb("disability_types"),
	requiresAccommodation: boolean("requires_accommodation"),
	accommodationDetailsEncrypted: text("accommodation_details_encrypted"),
	isLgbtq2Plus: boolean("is_lgbtq2plus"),
	lgbtq2PlusIdentity: jsonb("lgbtq2plus_identity"),
	dateOfBirth: date("date_of_birth"),
	ageRange: varchar("age_range", { length: 20 }),
	isNewcomer: boolean("is_newcomer"),
	immigrationYear: integer("immigration_year"),
	countryOfOrigin: varchar("country_of_origin", { length: 100 }),
	primaryLanguage: varchar("primary_language", { length: 50 }),
	speaksFrench: boolean("speaks_french"),
	speaksIndigenousLanguage: boolean("speaks_indigenous_language"),
	indigenousLanguageName: varchar("indigenous_language_name", { length: 100 }),
	intersectionalityCount: integer("intersectionality_count"),
	needsInterpretation: boolean("needs_interpretation").default(false),
	interpretationLanguage: varchar("interpretation_language", { length: 100 }),
	needsTranslation: boolean("needs_translation").default(false),
	translationLanguage: varchar("translation_language", { length: 100 }),
	needsMobilityAccommodation: boolean("needs_mobility_accommodation").default(false),
	allowAggregateReporting: boolean("allow_aggregate_reporting").default(true),
	allowResearchParticipation: boolean("allow_research_participation").default(false),
	allowExternalReporting: boolean("allow_external_reporting").default(false),
	dataAccessLog: jsonb("data_access_log").default([]),
	lastUpdatedBy: uuid("last_updated_by"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxDemographicsConsent: index("idx_demographics_consent").using("btree", table.dataCollectionConsent.asc().nullsLast()),
		idxDemographicsExpiry: index("idx_demographics_expiry").using("btree", table.dataExpiryDate.asc().nullsLast()),
		idxDemographicsIndigenous: index("idx_demographics_indigenous").using("btree", table.isIndigenous.asc().nullsLast()),
		idxDemographicsMember: index("idx_demographics_member").using("btree", table.memberId.asc().nullsLast()),
		idxDemographicsOrg: index("idx_demographics_org").using("btree", table.organizationId.asc().nullsLast()),
		memberDemographicsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "member_demographics_member_id_fkey"
		}),
		memberDemographicsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "member_demographics_organization_id_fkey"
		}),
		memberDemographicsMemberIdKey: unique("member_demographics_member_id_key").on(table.memberId),
	}
});

export const vCriticalDeadlines = pgTable("v_critical_deadlines", {
	id: uuid("id"),
	claimId: uuid("claim_id"),
	tenantId: varchar("tenant_id", { length: 255 }),
	deadlineRuleId: uuid("deadline_rule_id"),
	deadlineName: varchar("deadline_name", { length: 255 }),
	deadlineType: varchar("deadline_type", { length: 100 }),
	eventDate: timestamp("event_date", { mode: 'string' }),
	originalDeadline: timestamp("original_deadline", { mode: 'string' }),
	dueDate: timestamp("due_date", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	status: deadlineStatus("status"),
	priority: deadlinePriority("priority"),
	extensionCount: integer("extension_count"),
	totalExtensionDays: integer("total_extension_days"),
	lastExtensionDate: timestamp("last_extension_date", { mode: 'string' }),
	lastExtensionReason: text("last_extension_reason"),
	completedBy: uuid("completed_by"),
	completionNotes: text("completion_notes"),
	isOverdue: boolean("is_overdue"),
	daysUntilDue: integer("days_until_due"),
	daysOverdue: integer("days_overdue"),
	escalatedAt: timestamp("escalated_at", { mode: 'string' }),
	escalatedTo: uuid("escalated_to"),
	alertCount: integer("alert_count"),
	lastAlertSent: timestamp("last_alert_sent", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	isOverdueCalc: boolean("is_overdue_calc"),
	daysOverdueCalc: integer("days_overdue_calc"),
	daysUntilDueCalc: integer("days_until_due_calc"),
});

export const payEquityComplaints = pgTable("pay_equity_complaints", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	complainantMemberId: uuid("complainant_member_id"),
	complainantName: varchar("complainant_name", { length: 200 }),
	isAnonymous: boolean("is_anonymous").default(false),
	isGroupComplaint: boolean("is_group_complaint").default(false),
	groupMemberCount: integer("group_member_count"),
	groupMemberIds: jsonb("group_member_ids"),
	complaintNumber: varchar("complaint_number", { length: 50 }).notNull(),
	filedDate: date("filed_date").default(sql`CURRENT_DATE`).notNull(),
	jobClassComplainant: varchar("job_class_complainant", { length: 200 }).notNull(),
	jobClassComparator: varchar("job_class_comparator", { length: 200 }).notNull(),
	complainantHourlyRate: numeric("complainant_hourly_rate", { precision: 10, scale:  2 }),
	comparatorHourlyRate: numeric("comparator_hourly_rate", { precision: 10, scale:  2 }),
	estimatedPayGapPercentage: numeric("estimated_pay_gap_percentage", { precision: 5, scale:  2 }),
	estimatedAnnualLoss: numeric("estimated_annual_loss", { precision: 10, scale:  2 }),
	skillComparison: text("skill_comparison"),
	effortComparison: text("effort_comparison"),
	responsibilityComparison: text("responsibility_comparison"),
	workingConditionsComparison: text("working_conditions_comparison"),
	jurisdiction: varchar("jurisdiction", { length: 50 }),
	legislationCited: varchar("legislation_cited", { length: 200 }),
	complaintStatus: payEquityStatus("complaint_status").default('intake'),
	assignedInvestigator: uuid("assigned_investigator"),
	investigationStartDate: date("investigation_start_date"),
	investigationCompletionDate: date("investigation_completion_date"),
	employerResponseDate: date("employer_response_date"),
	employerPosition: text("employer_position"),
	employerSupportingDocumentsUrls: jsonb("employer_supporting_documents_urls"),
	unionRepresentativeId: uuid("union_representative_id"),
	unionPosition: text("union_position"),
	unionSupportingDocumentsUrls: jsonb("union_supporting_documents_urls"),
	mediationScheduledDate: date("mediation_scheduled_date"),
	mediatorName: varchar("mediator_name", { length: 200 }),
	mediationOutcome: varchar("mediation_outcome", { length: 50 }),
	resolutionDate: date("resolution_date"),
	resolutionType: varchar("resolution_type", { length: 50 }),
	settlementAmount: numeric("settlement_amount", { precision: 12, scale:  2 }),
	retroactivePaymentAmount: numeric("retroactive_payment_amount", { precision: 12, scale:  2 }),
	retroactivePeriodStart: date("retroactive_period_start"),
	retroactivePeriodEnd: date("retroactive_period_end"),
	ongoingPayAdjustment: numeric("ongoing_pay_adjustment", { precision: 10, scale:  2 }),
	appealFiled: boolean("appeal_filed").default(false),
	appealFiledDate: date("appeal_filed_date"),
	appealDecisionDate: date("appeal_decision_date"),
	appealOutcome: text("appeal_outcome"),
	reportedToStatcan: boolean("reported_to_statcan").default(false),
	statcanReportDate: date("statcan_report_date"),
	complaintFormUrl: text("complaint_form_url"),
	investigationReportUrl: text("investigation_report_url"),
	settlementAgreementUrl: text("settlement_agreement_url"),
	isConfidential: boolean("is_confidential").default(true),
	confidentialityRestrictions: text("confidentiality_restrictions"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxPayEquityComplaintsFiledDate: index("idx_pay_equity_complaints_filed_date").using("btree", table.filedDate.asc().nullsLast()),
		idxPayEquityComplaintsInvestigator: index("idx_pay_equity_complaints_investigator").using("btree", table.assignedInvestigator.asc().nullsLast()),
		idxPayEquityComplaintsMember: index("idx_pay_equity_complaints_member").using("btree", table.complainantMemberId.asc().nullsLast()),
		idxPayEquityComplaintsOrg: index("idx_pay_equity_complaints_org").using("btree", table.organizationId.asc().nullsLast()),
		idxPayEquityComplaintsStatus: index("idx_pay_equity_complaints_status").using("btree", table.complaintStatus.asc().nullsLast()),
		payEquityComplaintsComplainantMemberIdFkey: foreignKey({
			columns: [table.complainantMemberId],
			foreignColumns: [members.id],
			name: "pay_equity_complaints_complainant_member_id_fkey"
		}),
		payEquityComplaintsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "pay_equity_complaints_organization_id_fkey"
		}),
		payEquityComplaintsComplaintNumberKey: unique("pay_equity_complaints_complaint_number_key").on(table.complaintNumber),
	}
});

export const equitySnapshots = pgTable("equity_snapshots", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	snapshotDate: date("snapshot_date").default(sql`CURRENT_DATE`).notNull(),
	snapshotType: varchar("snapshot_type", { length: 50 }).default('annual'),
	totalMembers: integer("total_members").notNull(),
	totalActiveMembers: integer("total_active_members"),
	womenCount: integer("women_count").default(0),
	menCount: integer("men_count").default(0),
	nonBinaryCount: integer("non_binary_count").default(0),
	genderNotDisclosed: integer("gender_not_disclosed").default(0),
	visibleMinorityCount: integer("visible_minority_count").default(0),
	indigenousCount: integer("indigenous_count").default(0),
	personsWithDisabilitiesCount: integer("persons_with_disabilities_count").default(0),
	lgbtq2PlusCount: integer("lgbtq2plus_count").default(0),
	firstNationsCount: integer("first_nations_count").default(0),
	inuitCount: integer("inuit_count").default(0),
	metisCount: integer("metis_count").default(0),
	multipleEquityGroupsCount: integer("multiple_equity_groups_count").default(0),
	avgIntersectionalityScore: numeric("avg_intersectionality_score", { precision: 5, scale:  2 }),
	executiveBoardTotal: integer("executive_board_total"),
	executiveBoardWomen: integer("executive_board_women").default(0),
	executiveBoardVisibleMinority: integer("executive_board_visible_minority").default(0),
	executiveBoardIndigenous: integer("executive_board_indigenous").default(0),
	stewardsTotal: integer("stewards_total"),
	stewardsWomen: integer("stewards_women").default(0),
	stewardsVisibleMinority: integer("stewards_visible_minority").default(0),
	avgHourlyRateAll: numeric("avg_hourly_rate_all", { precision: 10, scale:  2 }),
	avgHourlyRateWomen: numeric("avg_hourly_rate_women", { precision: 10, scale:  2 }),
	avgHourlyRateMen: numeric("avg_hourly_rate_men", { precision: 10, scale:  2 }),
	genderPayGapPercentage: numeric("gender_pay_gap_percentage", { precision: 5, scale:  2 }),
	totalConsentGiven: integer("total_consent_given"),
	consentRatePercentage: numeric("consent_rate_percentage", { precision: 5, scale:  2 }),
	reportedToStatcan: boolean("reported_to_statcan").default(false),
	statcanReportDate: date("statcan_report_date"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxEquitySnapshotsDate: index("idx_equity_snapshots_date").using("btree", table.snapshotDate.asc().nullsLast()),
		idxEquitySnapshotsOrg: index("idx_equity_snapshots_org").using("btree", table.organizationId.asc().nullsLast()),
		equitySnapshotsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "equity_snapshots_organization_id_fkey"
		}),
		uniqueOrgSnapshotDate: unique("unique_org_snapshot_date").on(table.organizationId, table.snapshotDate),
	}
});

export const statcanSubmissions = pgTable("statcan_submissions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	surveyCode: varchar("survey_code", { length: 50 }).notNull(),
	surveyName: varchar("survey_name", { length: 200 }),
	referencePeriodStart: date("reference_period_start").notNull(),
	referencePeriodEnd: date("reference_period_end").notNull(),
	submissionDate: date("submission_date"),
	submittedBy: uuid("submitted_by"),
	dataPayload: jsonb("data_payload").notNull(),
	validationStatus: varchar("validation_status", { length: 50 }).default('pending'),
	validationErrors: jsonb("validation_errors"),
	statcanConfirmationNumber: varchar("statcan_confirmation_number", { length: 100 }),
	statcanAccepted: boolean("statcan_accepted"),
	statcanResponseDate: date("statcan_response_date"),
	statcanResponseDetails: jsonb("statcan_response_details"),
	exportFileUrl: text("export_file_url"),
	exportFileFormat: varchar("export_file_format", { length: 20 }),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxStatcanSubmissionsOrg: index("idx_statcan_submissions_org").using("btree", table.organizationId.asc().nullsLast()),
		idxStatcanSubmissionsPeriod: index("idx_statcan_submissions_period").using("btree", table.referencePeriodStart.asc().nullsLast(), table.referencePeriodEnd.asc().nullsLast()),
		idxStatcanSubmissionsSurvey: index("idx_statcan_submissions_survey").using("btree", table.surveyCode.asc().nullsLast()),
		statcanSubmissionsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "statcan_submissions_organization_id_fkey"
		}),
	}
});

export const vEquityStatisticsAnonymized = pgTable("v_equity_statistics_anonymized", {
	organizationId: uuid("organization_id"),
	snapshotDate: date("snapshot_date"),
	totalMembers: integer("total_members"),
	womenPercentage: numeric("women_percentage"),
	visibleMinorityPercentage: numeric("visible_minority_percentage"),
	indigenousPercentage: numeric("indigenous_percentage"),
	disabilityPercentage: numeric("disability_percentage"),
	lgbtq2PlusPercentage: numeric("lgbtq2plus_percentage"),
	genderPayGapPercentage: numeric("gender_pay_gap_percentage", { precision: 5, scale:  2 }),
	consentRatePercentage: numeric("consent_rate_percentage", { precision: 5, scale:  2 }),
});

export const vPayEquityPipeline = pgTable("v_pay_equity_pipeline", {
	organizationId: uuid("organization_id"),
	complaintStatus: payEquityStatus("complaint_status"),
	jurisdiction: varchar("jurisdiction", { length: 50 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalComplaints: bigint("total_complaints", { mode: "number" }),
	avgPayGapPercentage: numeric("avg_pay_gap_percentage"),
	totalSettlements: numeric("total_settlements"),
	avgDaysToResolution: numeric("avg_days_to_resolution"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	payAdjustmentsGranted: bigint("pay_adjustments_granted", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	appealsFiled: bigint("appeals_filed", { mode: "number" }),
});

export const organizingCampaigns = pgTable("organizing_campaigns", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	campaignName: varchar("campaign_name", { length: 200 }).notNull(),
	campaignCode: varchar("campaign_code", { length: 50 }).notNull(),
	campaignType: organizingCampaignType("campaign_type").notNull(),
	campaignStatus: organizingCampaignStatus("campaign_status").default('research'),
	targetEmployerName: varchar("target_employer_name", { length: 300 }).notNull(),
	targetEmployerAddress: text("target_employer_address"),
	targetIndustry: varchar("target_industry", { length: 200 }),
	targetNaicsCode: varchar("target_naics_code", { length: 10 }),
	proposedBargainingUnitName: varchar("proposed_bargaining_unit_name", { length: 300 }),
	proposedBargainingUnitDescription: text("proposed_bargaining_unit_description"),
	excludedPositions: text("excluded_positions"),
	estimatedEligibleWorkers: integer("estimated_eligible_workers"),
	estimatedTotalWorkforce: integer("estimated_total_workforce"),
	workplaceCity: varchar("workplace_city", { length: 100 }),
	workplaceProvince: varchar("workplace_province", { length: 2 }),
	workplacePostalCode: varchar("workplace_postal_code", { length: 7 }),
	workplaceCoordinates: point("workplace_coordinates"),
	isMultiLocation: boolean("is_multi_location").default(false),
	laborBoardJurisdiction: varchar("labor_board_jurisdiction", { length: 50 }),
	laborBoardName: varchar("labor_board_name", { length: 200 }),
	laborRelationsAct: varchar("labor_relations_act", { length: 200 }),
	researchStartDate: date("research_start_date"),
	campaignLaunchDate: date("campaign_launch_date"),
	cardCheckStartDate: date("card_check_start_date"),
	cardCheckDeadline: date("card_check_deadline"),
	certificationApplicationDate: date("certification_application_date"),
	certificationVoteDate: date("certification_vote_date"),
	certificationDecisionDate: date("certification_decision_date"),
	firstContractDeadline: date("first_contract_deadline"),
	cardSigningGoal: integer("card_signing_goal"),
	cardSigningThresholdPercentage: numeric("card_signing_threshold_percentage", { precision: 5, scale:  2 }).default('40.00'),
	superMajorityGoal: integer("super_majority_goal"),
	superMajorityThresholdPercentage: numeric("super_majority_threshold_percentage", { precision: 5, scale:  2 }).default('65.00'),
	cardsSignedCount: integer("cards_signed_count").default(0),
	cardsSignedPercentage: numeric("cards_signed_percentage", { precision: 5, scale:  2 }).default('0.00'),
	lastCardSignedDate: date("last_card_signed_date"),
	leadOrganizerId: uuid("lead_organizer_id"),
	leadOrganizerName: varchar("lead_organizer_name", { length: 200 }),
	organizingCommitteeSize: integer("organizing_committee_size").default(0),
	employerResistanceLevel: varchar("employer_resistance_level", { length: 50 }),
	antiUnionConsultantInvolved: boolean("anti_union_consultant_involved").default(false),
	antiUnionConsultantName: varchar("anti_union_consultant_name", { length: 200 }),
	captiveAudienceMeetingsCount: integer("captive_audience_meetings_count").default(0),
	incumbentUnionName: varchar("incumbent_union_name", { length: 200 }),
	incumbentContractExpiryDate: date("incumbent_contract_expiry_date"),
	outcomeType: varchar("outcome_type", { length: 50 }),
	certificationVoteYesCount: integer("certification_vote_yes_count"),
	certificationVoteNoCount: integer("certification_vote_no_count"),
	certificationVoteEligibleVoters: integer("certification_vote_eligible_voters"),
	certificationVoteTurnoutPercentage: numeric("certification_vote_turnout_percentage", { precision: 5, scale:  2 }),
	certificationNumber: varchar("certification_number", { length: 100 }),
	certificationDate: date("certification_date"),
	firstContractRatifiedDate: date("first_contract_ratified_date"),
	firstContractCampaignRequired: boolean("first_contract_campaign_required").default(false),
	campaignBudget: numeric("campaign_budget", { precision: 12, scale:  2 }),
	campaignExpensesToDate: numeric("campaign_expenses_to_date", { precision: 12, scale:  2 }).default('0.00'),
	fullTimeOrganizersAssigned: integer("full_time_organizers_assigned").default(0),
	volunteerOrganizersCount: integer("volunteer_organizers_count").default(0),
	campaignPlanUrl: text("campaign_plan_url"),
	workplaceMapUrl: text("workplace_map_url"),
	authorizationCardsTemplateUrl: text("authorization_cards_template_url"),
	certificationApplicationUrl: text("certification_application_url"),
	laborBoardDecisionUrl: text("labor_board_decision_url"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxOrganizingCampaignsDates: index("idx_organizing_campaigns_dates").using("btree", table.campaignLaunchDate.asc().nullsLast(), table.cardCheckDeadline.asc().nullsLast()),
		idxOrganizingCampaignsEmployer: index("idx_organizing_campaigns_employer").using("btree", table.targetEmployerName.asc().nullsLast()),
		idxOrganizingCampaignsJurisdiction: index("idx_organizing_campaigns_jurisdiction").using("btree", table.laborBoardJurisdiction.asc().nullsLast()),
		idxOrganizingCampaignsLeadOrganizer: index("idx_organizing_campaigns_lead_organizer").using("btree", table.leadOrganizerId.asc().nullsLast()),
		idxOrganizingCampaignsOrg: index("idx_organizing_campaigns_org").using("btree", table.organizationId.asc().nullsLast()),
		idxOrganizingCampaignsStatus: index("idx_organizing_campaigns_status").using("btree", table.campaignStatus.asc().nullsLast()),
		organizingCampaignsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "organizing_campaigns_organization_id_fkey"
		}),
		organizingCampaignsCampaignCodeKey: unique("organizing_campaigns_campaign_code_key").on(table.campaignCode),
	}
});

export const organizingContacts = pgTable("organizing_contacts", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	organizationId: uuid("organization_id").notNull(),
	contactNumber: varchar("contact_number", { length: 50 }).notNull(),
	firstNameEncrypted: text("first_name_encrypted"),
	lastNameEncrypted: text("last_name_encrypted"),
	personalEmailEncrypted: text("personal_email_encrypted"),
	personalPhoneEncrypted: text("personal_phone_encrypted"),
	workEmailEncrypted: text("work_email_encrypted"),
	workPhoneEncrypted: text("work_phone_encrypted"),
	jobTitle: varchar("job_title", { length: 200 }),
	department: varchar("department", { length: 200 }),
	shift: varchar("shift", { length: 50 }),
	hireDate: date("hire_date"),
	seniorityYears: numeric("seniority_years", { precision: 5, scale:  2 }),
	hourlyRate: numeric("hourly_rate", { precision: 10, scale:  2 }),
	ageRange: varchar("age_range", { length: 20 }),
	primaryLanguage: varchar("primary_language", { length: 50 }),
	requiresInterpretation: boolean("requires_interpretation").default(false),
	buildingLocation: varchar("building_location", { length: 100 }),
	floorNumber: integer("floor_number"),
	workstationArea: varchar("workstation_area", { length: 100 }),
	supportLevel: contactSupportLevel("support_level").default('unknown'),
	organizingCommitteeMember: boolean("organizing_committee_member").default(false),
	organizingCommitteeRole: varchar("organizing_committee_role", { length: 100 }),
	naturalLeader: boolean("natural_leader").default(false),
	cardSigned: boolean("card_signed").default(false),
	cardSignedDate: date("card_signed_date"),
	cardWitnessedBy: varchar("card_witnessed_by", { length: 200 }),
	cardRevoked: boolean("card_revoked").default(false),
	cardRevokedDate: date("card_revoked_date"),
	houseVisitAttempted: boolean("house_visit_attempted").default(false),
	houseVisitCompleted: boolean("house_visit_completed").default(false),
	houseVisitDate: date("house_visit_date"),
	houseVisitNotes: text("house_visit_notes"),
	lastContactDate: date("last_contact_date"),
	lastContactMethod: varchar("last_contact_method", { length: 50 }),
	contactAttemptsCount: integer("contact_attempts_count").default(0),
	primaryIssues: jsonb("primary_issues"),
	workplaceConcerns: text("workplace_concerns"),
	personalStory: text("personal_story"),
	closeCoworkers: jsonb("close_coworkers"),
	influencedBy: jsonb("influenced_by"),
	fearLevel: varchar("fear_level", { length: 50 }),
	barriersToSupport: text("barriers_to_support"),
	targetedByEmployer: boolean("targeted_by_employer").default(false),
	targetedDate: date("targeted_date"),
	targetedMethod: text("targeted_method"),
	votedInCertification: boolean("voted_in_certification"),
	becameMember: boolean("became_member").default(false),
	memberId: uuid("member_id"),
	dataRetentionDeadline: date("data_retention_deadline"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxOrganizingContactsCampaign: index("idx_organizing_contacts_campaign").using("btree", table.campaignId.asc().nullsLast()),
		idxOrganizingContactsCardSigned: index("idx_organizing_contacts_card_signed").using("btree", table.cardSigned.asc().nullsLast()),
		idxOrganizingContactsCommittee: index("idx_organizing_contacts_committee").using("btree", table.organizingCommitteeMember.asc().nullsLast()),
		idxOrganizingContactsDepartment: index("idx_organizing_contacts_department").using("btree", table.department.asc().nullsLast()),
		idxOrganizingContactsShift: index("idx_organizing_contacts_shift").using("btree", table.shift.asc().nullsLast()),
		idxOrganizingContactsSupportLevel: index("idx_organizing_contacts_support_level").using("btree", table.supportLevel.asc().nullsLast()),
		organizingContactsCampaignIdFkey: foreignKey({
			columns: [table.campaignId],
			foreignColumns: [organizingCampaigns.id],
			name: "organizing_contacts_campaign_id_fkey"
		}),
		organizingContactsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "organizing_contacts_member_id_fkey"
		}),
		organizingContactsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "organizing_contacts_organization_id_fkey"
		}),
		organizingContactsContactNumberKey: unique("organizing_contacts_contact_number_key").on(table.contactNumber),
	}
});

export const tenants = pgTable("tenants", {
	tenantId: uuid("tenant_id").primaryKey().notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const organizingActivities = pgTable("organizing_activities", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	organizationId: uuid("organization_id").notNull(),
	activityType: organizingActivityType("activity_type").notNull(),
	activityName: varchar("activity_name", { length: 200 }),
	activityDate: date("activity_date").notNull(),
	activityStartTime: time("activity_start_time"),
	activityEndTime: time("activity_end_time"),
	activityLocation: varchar("activity_location", { length: 300 }),
	locationAddress: text("location_address"),
	isVirtual: boolean("is_virtual").default(false),
	meetingLink: text("meeting_link"),
	contactsTargeted: jsonb("contacts_targeted"),
	contactsAttended: jsonb("contacts_attended"),
	contactsAttendedCount: integer("contacts_attended_count").default(0),
	organizersAssigned: jsonb("organizers_assigned"),
	volunteersAttended: integer("volunteers_attended").default(0),
	cardsSignedAtEvent: integer("cards_signed_at_event").default(0),
	outcomeSummary: text("outcome_summary"),
	contactsMovedToSupporter: integer("contacts_moved_to_supporter").default(0),
	newOrganizingCommitteeRecruits: integer("new_organizing_committee_recruits").default(0),
	followUpRequired: boolean("follow_up_required").default(false),
	followUpCompleted: boolean("follow_up_completed").default(false),
	followUpNotes: text("follow_up_notes"),
	activityCost: numeric("activity_cost", { precision: 10, scale:  2 }).default('0.00'),
	photosUrls: jsonb("photos_urls"),
	videosUrls: jsonb("videos_urls"),
	socialMediaPosts: jsonb("social_media_posts"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxOrganizingActivitiesCampaign: index("idx_organizing_activities_campaign").using("btree", table.campaignId.asc().nullsLast()),
		idxOrganizingActivitiesDate: index("idx_organizing_activities_date").using("btree", table.activityDate.asc().nullsLast()),
		idxOrganizingActivitiesType: index("idx_organizing_activities_type").using("btree", table.activityType.asc().nullsLast()),
		organizingActivitiesCampaignIdFkey: foreignKey({
			columns: [table.campaignId],
			foreignColumns: [organizingCampaigns.id],
			name: "organizing_activities_campaign_id_fkey"
		}),
		organizingActivitiesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "organizing_activities_organization_id_fkey"
		}),
	}
});

export const vOrganizingCampaignDashboard = pgTable("v_organizing_campaign_dashboard", {
	campaignId: uuid("campaign_id"),
	organizationId: uuid("organization_id"),
	campaignName: varchar("campaign_name", { length: 200 }),
	campaignCode: varchar("campaign_code", { length: 50 }),
	campaignType: organizingCampaignType("campaign_type"),
	campaignStatus: organizingCampaignStatus("campaign_status"),
	targetEmployerName: varchar("target_employer_name", { length: 300 }),
	laborBoardJurisdiction: varchar("labor_board_jurisdiction", { length: 50 }),
	estimatedEligibleWorkers: integer("estimated_eligible_workers"),
	cardsSignedCount: integer("cards_signed_count"),
	cardsSignedPercentage: numeric("cards_signed_percentage", { precision: 5, scale:  2 }),
	cardSigningGoal: integer("card_signing_goal"),
	cardSigningThresholdPercentage: numeric("card_signing_threshold_percentage", { precision: 5, scale:  2 }),
	organizingCommitteeSize: integer("organizing_committee_size"),
	campaignLaunchDate: date("campaign_launch_date"),
	cardCheckDeadline: date("card_check_deadline"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalContacts: bigint("total_contacts", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	supporters: bigint("supporters", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	committeeMembers: bigint("committee_members", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cardsSigned: bigint("cards_signed", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activitiesLast7Days: bigint("activities_last_7_days", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activitiesLast30Days: bigint("activities_last_30_days", { mode: "number" }),
	daysUntilDeadline: integer("days_until_deadline"),
	campaignStrength: text("campaign_strength"),
});

export const certificationApplications = pgTable("certification_applications", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	organizationId: uuid("organization_id").notNull(),
	applicationNumber: varchar("application_number", { length: 100 }).notNull(),
	applicationStatus: certificationApplicationStatus("application_status").default('draft'),
	laborBoardJurisdiction: varchar("labor_board_jurisdiction", { length: 50 }).notNull(),
	laborBoardName: varchar("labor_board_name", { length: 200 }),
	filedDate: date("filed_date"),
	filedByName: varchar("filed_by_name", { length: 200 }),
	proposedBargainingUnitDescription: text("proposed_bargaining_unit_description"),
	numberOfEmployeesClaimed: integer("number_of_employees_claimed"),
	authorizationCardsSubmitted: integer("authorization_cards_submitted"),
	authorizationCardsPercentage: numeric("authorization_cards_percentage", { precision: 5, scale:  2 }),
	employerResponseFiled: boolean("employer_response_filed").default(false),
	employerResponseDate: date("employer_response_date"),
	employerContested: boolean("employer_contested").default(false),
	employerObjections: text("employer_objections"),
	employerProposedUnitChanges: text("employer_proposed_unit_changes"),
	incumbentUnionResponseFiled: boolean("incumbent_union_response_filed").default(false),
	incumbentUnionResponseDate: date("incumbent_union_response_date"),
	incumbentUnionObjections: text("incumbent_union_objections"),
	preHearingScheduled: boolean("pre_hearing_scheduled").default(false),
	preHearingDate: date("pre_hearing_date"),
	hearingScheduled: boolean("hearing_scheduled").default(false),
	hearingDate: date("hearing_date"),
	hearingLocation: varchar("hearing_location", { length: 300 }),
	hearingOutcome: text("hearing_outcome"),
	voterListReceived: boolean("voter_list_received").default(false),
	voterListReceivedDate: date("voter_list_received_date"),
	voterListDisputeFiled: boolean("voter_list_dispute_filed").default(false),
	voterListDisputeOutcome: text("voter_list_dispute_outcome"),
	voteOrdered: boolean("vote_ordered").default(false),
	voteOrderedDate: date("vote_ordered_date"),
	voteMethod: varchar("vote_method", { length: 50 }),
	voteDate: date("vote_date"),
	voteLocation: varchar("vote_location", { length: 300 }),
	votesYes: integer("votes_yes"),
	votesNo: integer("votes_no"),
	votesSpoiled: integer("votes_spoiled"),
	votesChallenged: integer("votes_challenged"),
	eligibleVoters: integer("eligible_voters"),
	voterTurnoutPercentage: numeric("voter_turnout_percentage", { precision: 5, scale:  2 }),
	decisionDate: date("decision_date"),
	decisionOutcome: varchar("decision_outcome", { length: 50 }),
	decisionSummary: text("decision_summary"),
	decisionDocumentUrl: text("decision_document_url"),
	certificationOrderNumber: varchar("certification_order_number", { length: 100 }),
	certificationDate: date("certification_date"),
	certificationDocumentUrl: text("certification_document_url"),
	bargainingUnitCertifiedDescription: text("bargaining_unit_certified_description"),
	numberOfEmployeesCertified: integer("number_of_employees_certified"),
	appealFiled: boolean("appeal_filed").default(false),
	appealFiledBy: varchar("appeal_filed_by", { length: 100 }),
	appealFiledDate: date("appeal_filed_date"),
	appealOutcome: text("appeal_outcome"),
	firstContractArbitrationEligible: boolean("first_contract_arbitration_eligible").default(false),
	firstContractArbitrationApplied: boolean("first_contract_arbitration_applied").default(false),
	firstContractArbitrationDate: date("first_contract_arbitration_date"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxCertificationApplicationsCampaign: index("idx_certification_applications_campaign").using("btree", table.campaignId.asc().nullsLast()),
		idxCertificationApplicationsFiledDate: index("idx_certification_applications_filed_date").using("btree", table.filedDate.asc().nullsLast()),
		idxCertificationApplicationsJurisdiction: index("idx_certification_applications_jurisdiction").using("btree", table.laborBoardJurisdiction.asc().nullsLast()),
		idxCertificationApplicationsStatus: index("idx_certification_applications_status").using("btree", table.applicationStatus.asc().nullsLast()),
		certificationApplicationsCampaignIdFkey: foreignKey({
			columns: [table.campaignId],
			foreignColumns: [organizingCampaigns.id],
			name: "certification_applications_campaign_id_fkey"
		}),
		certificationApplicationsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "certification_applications_organization_id_fkey"
		}),
		certificationApplicationsApplicationNumberKey: unique("certification_applications_application_number_key").on(table.applicationNumber),
	}
});

export const organizingVolunteers = pgTable("organizing_volunteers", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	memberId: uuid("member_id"),
	volunteerName: varchar("volunteer_name", { length: 200 }),
	email: varchar("email", { length: 255 }),
	phone: varchar("phone", { length: 50 }),
	organizingExperienceLevel: varchar("organizing_experience_level", { length: 50 }),
	previousCampaignsCount: integer("previous_campaigns_count").default(0),
	specialSkills: jsonb("special_skills"),
	availableWeekdays: boolean("available_weekdays").default(true),
	availableEvenings: boolean("available_evenings").default(true),
	availableWeekends: boolean("available_weekends").default(true),
	hoursPerWeekAvailable: integer("hours_per_week_available"),
	organizingTrainingCompleted: boolean("organizing_training_completed").default(false),
	trainingCompletionDate: date("training_completion_date"),
	currentCampaigns: jsonb("current_campaigns"),
	totalHouseVisitsCompleted: integer("total_house_visits_completed").default(0),
	totalCardsSignedWitnessed: integer("total_cards_signed_witnessed").default(0),
	isActive: boolean("is_active").default(true),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxOrganizingVolunteersActive: index("idx_organizing_volunteers_active").using("btree", table.isActive.asc().nullsLast()),
		idxOrganizingVolunteersMember: index("idx_organizing_volunteers_member").using("btree", table.memberId.asc().nullsLast()),
		idxOrganizingVolunteersOrg: index("idx_organizing_volunteers_org").using("btree", table.organizationId.asc().nullsLast()),
		organizingVolunteersMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "organizing_volunteers_member_id_fkey"
		}),
		organizingVolunteersOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "organizing_volunteers_organization_id_fkey"
		}),
	}
});

export const vWorkplaceContactMap = pgTable("v_workplace_contact_map", {
	contactId: uuid("contact_id"),
	campaignId: uuid("campaign_id"),
	contactNumber: varchar("contact_number", { length: 50 }),
	department: varchar("department", { length: 200 }),
	shift: varchar("shift", { length: 50 }),
	supportLevel: contactSupportLevel("support_level"),
	organizingCommitteeMember: boolean("organizing_committee_member"),
	cardSigned: boolean("card_signed"),
	naturalLeader: boolean("natural_leader"),
	buildingLocation: varchar("building_location", { length: 100 }),
	floorNumber: integer("floor_number"),
	workstationArea: varchar("workstation_area", { length: 100 }),
	primaryIssues: jsonb("primary_issues"),
	campaignName: varchar("campaign_name", { length: 200 }),
	targetEmployerName: varchar("target_employer_name", { length: 300 }),
});

export const politicalCampaigns = pgTable("political_campaigns", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	campaignName: varchar("campaign_name", { length: 300 }).notNull(),
	campaignCode: varchar("campaign_code", { length: 50 }).notNull(),
	campaignType: politicalCampaignType("campaign_type").notNull(),
	campaignStatus: politicalCampaignStatus("campaign_status").default('planning'),
	campaignDescription: text("campaign_description"),
	campaignGoals: text("campaign_goals"),
	startDate: date("start_date"),
	endDate: date("end_date"),
	electionDate: date("election_date"),
	jurisdictionLevel: varchar("jurisdiction_level", { length: 50 }),
	jurisdictionName: varchar("jurisdiction_name", { length: 200 }),
	electoralDistrict: varchar("electoral_district", { length: 200 }),
	billNumber: varchar("bill_number", { length: 50 }),
	billName: varchar("bill_name", { length: 300 }),
	billStatus: varchar("bill_status", { length: 100 }),
	billUrl: text("bill_url"),
	primaryIssue: varchar("primary_issue", { length: 200 }),
	secondaryIssues: jsonb("secondary_issues"),
	memberParticipationGoal: integer("member_participation_goal"),
	volunteerHoursGoal: integer("volunteer_hours_goal"),
	doorsKnockedGoal: integer("doors_knocked_goal"),
	phoneCallsGoal: integer("phone_calls_goal"),
	petitionSignaturesGoal: integer("petition_signatures_goal"),
	membersParticipated: integer("members_participated").default(0),
	volunteerHoursLogged: integer("volunteer_hours_logged").default(0),
	doorsKnocked: integer("doors_knocked").default(0),
	phoneCallsMade: integer("phone_calls_made").default(0),
	petitionSignaturesCollected: integer("petition_signatures_collected").default(0),
	budgetAllocated: numeric("budget_allocated", { precision: 12, scale:  2 }),
	expensesToDate: numeric("expenses_to_date", { precision: 12, scale:  2 }).default('0.00'),
	fundedByCope: boolean("funded_by_cope").default(false),
	copeContributionAmount: numeric("cope_contribution_amount", { precision: 12, scale:  2 }),
	coalitionPartners: jsonb("coalition_partners"),
	outcomeType: varchar("outcome_type", { length: 100 }),
	outcomeDate: date("outcome_date"),
	outcomeNotes: text("outcome_notes"),
	campaignPlanUrl: text("campaign_plan_url"),
	campaignMaterialsUrls: jsonb("campaign_materials_urls"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxPoliticalCampaignsJurisdiction: index("idx_political_campaigns_jurisdiction").using("btree", table.jurisdictionLevel.asc().nullsLast(), table.jurisdictionName.asc().nullsLast()),
		idxPoliticalCampaignsOrg: index("idx_political_campaigns_org").using("btree", table.organizationId.asc().nullsLast()),
		idxPoliticalCampaignsStatus: index("idx_political_campaigns_status").using("btree", table.campaignStatus.asc().nullsLast()),
		idxPoliticalCampaignsType: index("idx_political_campaigns_type").using("btree", table.campaignType.asc().nullsLast()),
		politicalCampaignsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "political_campaigns_organization_id_fkey"
		}),
		politicalCampaignsCampaignCodeKey: unique("political_campaigns_campaign_code_key").on(table.campaignCode),
	}
});

export const memberCertifications = pgTable("member_certifications", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	memberId: uuid("member_id").notNull(),
	certificationName: varchar("certification_name", { length: 200 }).notNull(),
	certificationType: varchar("certification_type", { length: 100 }),
	issuedByOrganization: varchar("issued_by_organization", { length: 200 }),
	certificationNumber: varchar("certification_number", { length: 100 }),
	issueDate: date("issue_date").notNull(),
	expiryDate: date("expiry_date"),
	validYears: integer("valid_years"),
	certificationStatus: certificationStatus("certification_status").default('active'),
	courseId: uuid("course_id"),
	sessionId: uuid("session_id"),
	registrationId: uuid("registration_id"),
	renewalRequired: boolean("renewal_required").default(false),
	renewalDate: date("renewal_date"),
	renewalCourseId: uuid("renewal_course_id"),
	verified: boolean("verified").default(true),
	verificationDate: date("verification_date"),
	verifiedBy: uuid("verified_by"),
	certificateUrl: text("certificate_url"),
	digitalBadgeUrl: text("digital_badge_url"),
	clcRegistered: boolean("clc_registered").default(false),
	clcRegistrationNumber: varchar("clc_registration_number", { length: 100 }),
	clcRegistrationDate: date("clc_registration_date"),
	revoked: boolean("revoked").default(false),
	revocationDate: date("revocation_date"),
	revocationReason: text("revocation_reason"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxMemberCertificationsExpiry: index("idx_member_certifications_expiry").using("btree", table.expiryDate.asc().nullsLast()),
		idxMemberCertificationsMember: index("idx_member_certifications_member").using("btree", table.memberId.asc().nullsLast()),
		idxMemberCertificationsOrg: index("idx_member_certifications_org").using("btree", table.organizationId.asc().nullsLast()),
		idxMemberCertificationsStatus: index("idx_member_certifications_status").using("btree", table.certificationStatus.asc().nullsLast()),
		idxMemberCertificationsType: index("idx_member_certifications_type").using("btree", table.certificationType.asc().nullsLast()),
		memberCertificationsCourseIdFkey: foreignKey({
			columns: [table.courseId],
			foreignColumns: [trainingCourses.id],
			name: "member_certifications_course_id_fkey"
		}),
		memberCertificationsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "member_certifications_member_id_fkey"
		}),
		memberCertificationsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "member_certifications_organization_id_fkey"
		}),
		memberCertificationsRegistrationIdFkey: foreignKey({
			columns: [table.registrationId],
			foreignColumns: [courseRegistrations.id],
			name: "member_certifications_registration_id_fkey"
		}),
		memberCertificationsRenewalCourseIdFkey: foreignKey({
			columns: [table.renewalCourseId],
			foreignColumns: [trainingCourses.id],
			name: "member_certifications_renewal_course_id_fkey"
		}),
		memberCertificationsSessionIdFkey: foreignKey({
			columns: [table.sessionId],
			foreignColumns: [courseSessions.id],
			name: "member_certifications_session_id_fkey"
		}),
		memberCertificationsCertificationNumberKey: unique("member_certifications_certification_number_key").on(table.certificationNumber),
	}
});

export const trainingPrograms = pgTable("training_programs", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	programName: varchar("program_name", { length: 300 }).notNull(),
	programCode: varchar("program_code", { length: 50 }).notNull(),
	programDescription: text("program_description"),
	programCategory: varchar("program_category", { length: 100 }),
	requiredCourses: jsonb("required_courses"),
	electiveCourses: jsonb("elective_courses"),
	electivesRequiredCount: integer("electives_required_count").default(0),
	totalHoursRequired: numeric("total_hours_required", { precision: 6, scale:  2 }),
	programDurationMonths: integer("program_duration_months"),
	providesCertification: boolean("provides_certification").default(false),
	certificationName: varchar("certification_name", { length: 200 }),
	entryRequirements: text("entry_requirements"),
	timeCommitment: text("time_commitment"),
	clcApproved: boolean("clc_approved").default(false),
	clcApprovalDate: date("clc_approval_date"),
	isActive: boolean("is_active").default(true),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
},
(table) => {
	return {
		idxTrainingProgramsActive: index("idx_training_programs_active").using("btree", table.isActive.asc().nullsLast()),
		idxTrainingProgramsOrg: index("idx_training_programs_org").using("btree", table.organizationId.asc().nullsLast()),
		trainingProgramsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "training_programs_organization_id_fkey"
		}),
		trainingProgramsProgramCodeKey: unique("training_programs_program_code_key").on(table.programCode),
	}
});

export const duesTransactions = pgTable("dues_transactions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	memberId: uuid("member_id").notNull(),
	assignmentId: uuid("assignment_id"),
	ruleId: uuid("rule_id"),
	transactionType: varchar("transaction_type", { length: 50 }).notNull(),
	amount: numeric("amount", { precision: 10, scale:  2 }).notNull(),
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	dueDate: date("due_date").notNull(),
	status: varchar("status", { length: 50 }).default('pending').notNull(),
	paymentDate: timestamp("payment_date", { withTimezone: true, mode: 'string' }),
	paymentMethod: varchar("payment_method", { length: 50 }),
	paymentReference: varchar("payment_reference", { length: 255 }),
	notes: text("notes"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	duesAmount: numeric("dues_amount", { precision: 10, scale:  2 }).notNull(),
	copeAmount: numeric("cope_amount", { precision: 10, scale:  2 }).default('0.00'),
	pacAmount: numeric("pac_amount", { precision: 10, scale:  2 }).default('0.00'),
	strikeFundAmount: numeric("strike_fund_amount", { precision: 10, scale:  2 }).default('0.00'),
	lateFeeAmount: numeric("late_fee_amount", { precision: 10, scale:  2 }).default('0.00'),
	adjustmentAmount: numeric("adjustment_amount", { precision: 10, scale:  2 }).default('0.00'),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	paidDate: timestamp("paid_date", { withTimezone: true, mode: 'string' }),
	receiptUrl: text("receipt_url"),
},
(table) => {
	return {
		idxDuesTransAmounts: index("idx_dues_trans_amounts").using("btree", table.organizationId.asc().nullsLast(), table.totalAmount.asc().nullsLast()),
		idxDuesTransPaidDate: index("idx_dues_trans_paid_date").using("btree", table.paidDate.asc().nullsLast()).where(sql`(paid_date IS NOT NULL)`),
		idxTransactionsDueDate: index("idx_transactions_due_date").using("btree", table.dueDate.asc().nullsLast()),
		idxTransactionsMember: index("idx_transactions_member").using("btree", table.memberId.asc().nullsLast()),
		idxTransactionsPeriod: index("idx_transactions_period").using("btree", table.periodStart.asc().nullsLast(), table.periodEnd.asc().nullsLast()),
		idxTransactionsStatus: index("idx_transactions_status").using("btree", table.organizationId.asc().nullsLast(), table.status.asc().nullsLast()),
		idxTransactionsOrganization: index("idx_transactions_organization").using("btree", table.organizationId.asc().nullsLast()),
		duesTransactionsAssignmentIdFkey: foreignKey({
			columns: [table.assignmentId],
			foreignColumns: [memberDuesAssignments.id],
			name: "dues_transactions_assignment_id_fkey"
		}),
		duesTransactionsRuleIdFkey: foreignKey({
			columns: [table.ruleId],
			foreignColumns: [duesRules.id],
			name: "dues_transactions_rule_id_fkey"
		}),
		duesTransactionsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "dues_transactions_organization_id_fkey"
		}).onDelete("cascade"),
	}
});

/**
 * Payments Table
 * Central payment tracking for all financial transactions
 * Used by payment collection workflow to track payment status and reconciliation
 */
export const payments = pgTable("payments", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	memberId: uuid("member_id"), // Optional - can be system-wide
	relationType: varchar("relation_type", { length: 50 }), // 'dues', 'donation', 'strike_fund', 'expense', etc.
	relationId: uuid("relation_id"), // Links to duesTransactions, donations, etc.
	amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
	currency: varchar("currency", { length: 3 }).default('USD'),
	status: varchar("status", { length: 50 }).default('pending').notNull(), // pending, processing, completed, failed, refunded
	reconciliationStatus: varchar("reconciliation_status", { length: 50 }).default('unreconciled'), // unreconciled, reconciled, needs_review
	reconciliationDate: timestamp("reconciliation_date", { withTimezone: true, mode: 'string' }),
	reconciledBy: uuid("reconciled_by"),
	paymentMethod: varchar("payment_method", { length: 50 }),
	processorType: varchar("processor_type", { length: 50 }), // 'stripe', 'paypal', 'bank_transfer', 'check', 'cash'
	processorPaymentId: varchar("processor_payment_id", { length: 255 }), // Stripe payment intent ID, PayPal order ID, etc.
	failureReason: text("failure_reason"),
	failureCode: varchar("failure_code", { length: 50 }),
	paidDate: timestamp("paid_date", { withTimezone: true, mode: 'string' }),
	receiptUrl: text("receipt_url"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxPaymentsMember: index("idx_payments_member").using("btree", table.memberId.asc().nullsLast()),
		idxPaymentsStatus: index("idx_payments_status").using("btree", table.status.asc().nullsLast()),
		idxPaymentsReconciliation: index("idx_payments_reconciliation").using("btree", table.reconciliationStatus.asc().nullsLast()),
		idxPaymentsRelation: index("idx_payments_relation").using("btree", table.relationType.asc().nullsLast(), table.relationId.asc().nullsLast()),
		idxPaymentsTenant: index("idx_payments_tenant").using("btree", table.tenantId.asc().nullsLast()),
		paymentsTenantIdFkey: foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.tenantId],
			name: "payments_tenant_id_fkey"
		}).onDelete("cascade"),
	}
});

export const programEnrollments = pgTable("program_enrollments", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	memberId: uuid("member_id").notNull(),
	programId: uuid("program_id").notNull(),
	enrollmentDate: date("enrollment_date").default(sql`CURRENT_DATE`).notNull(),
	enrollmentStatus: varchar("enrollment_status", { length: 50 }).default('active'),
	coursesCompleted: integer("courses_completed").default(0),
	coursesRequired: integer("courses_required"),
	hoursCompleted: numeric("hours_completed", { precision: 6, scale:  2 }).default('0.00'),
	hoursRequired: numeric("hours_required", { precision: 6, scale:  2 }),
	progressPercentage: numeric("progress_percentage", { precision: 5, scale:  2 }).default('0.00'),
	completed: boolean("completed").default(false),
	completionDate: date("completion_date"),
	certificationIssued: boolean("certification_issued").default(false),
	certificationId: uuid("certification_id"),
	expectedCompletionDate: date("expected_completion_date"),
	extensionGranted: boolean("extension_granted").default(false),
	extendedCompletionDate: date("extended_completion_date"),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxProgramEnrollmentsMember: index("idx_program_enrollments_member").using("btree", table.memberId.asc().nullsLast()),
		idxProgramEnrollmentsOrg: index("idx_program_enrollments_org").using("btree", table.organizationId.asc().nullsLast()),
		idxProgramEnrollmentsProgram: index("idx_program_enrollments_program").using("btree", table.programId.asc().nullsLast()),
		idxProgramEnrollmentsStatus: index("idx_program_enrollments_status").using("btree", table.enrollmentStatus.asc().nullsLast()),
		programEnrollmentsCertificationIdFkey: foreignKey({
			columns: [table.certificationId],
			foreignColumns: [memberCertifications.id],
			name: "program_enrollments_certification_id_fkey"
		}),
		programEnrollmentsMemberIdFkey: foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "program_enrollments_member_id_fkey"
		}),
		programEnrollmentsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "program_enrollments_organization_id_fkey"
		}),
		programEnrollmentsProgramIdFkey: foreignKey({
			columns: [table.programId],
			foreignColumns: [trainingPrograms.id],
			name: "program_enrollments_program_id_fkey"
		}),
	}
});

export const vMemberTrainingTranscript = pgTable("v_member_training_transcript", {
	memberId: uuid("member_id"),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	organizationId: uuid("organization_id"),
	courseName: varchar("course_name", { length: 300 }),
	courseCategory: courseCategory("course_category"),
	sessionCode: varchar("session_code", { length: 50 }),
	startDate: date("start_date"),
	endDate: date("end_date"),
	registrationStatus: registrationStatus("registration_status"),
	attended: boolean("attended"),
	completed: boolean("completed"),
	completionDate: date("completion_date"),
	attendanceHours: numeric("attendance_hours", { precision: 5, scale:  2 }),
	finalGrade: varchar("final_grade", { length: 10 }),
	certificateIssued: boolean("certificate_issued"),
	certificateNumber: varchar("certificate_number", { length: 100 }),
	durationHours: numeric("duration_hours", { precision: 5, scale:  2 }),
	providesCertification: boolean("provides_certification"),
});

export const vCourseSessionDashboard = pgTable("v_course_session_dashboard", {
	sessionId: uuid("session_id"),
	organizationId: uuid("organization_id"),
	courseName: varchar("course_name", { length: 300 }),
	courseCategory: courseCategory("course_category"),
	sessionCode: varchar("session_code", { length: 50 }),
	startDate: date("start_date"),
	endDate: date("end_date"),
	sessionStatus: sessionStatus("session_status"),
	maxEnrollment: integer("max_enrollment"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalRegistrations: bigint("total_registrations", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	confirmedRegistrations: bigint("confirmed_registrations", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	waitlistCount: bigint("waitlist_count", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	attendees: bigint("attendees", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	noShows: bigint("no_shows", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	completions: bigint("completions", { mode: "number" }),
	completionRate: numeric("completion_rate"),
	avgRating: numeric("avg_rating"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	evaluationCount: bigint("evaluation_count", { mode: "number" }),
	enrollmentPercentage: numeric("enrollment_percentage"),
});

export const vCertificationExpiryTracking = pgTable("v_certification_expiry_tracking", {
	organizationId: uuid("organization_id"),
	memberId: uuid("member_id"),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	certificationName: varchar("certification_name", { length: 200 }),
	certificationType: varchar("certification_type", { length: 100 }),
	issueDate: date("issue_date"),
	expiryDate: date("expiry_date"),
	certificationStatus: certificationStatus("certification_status"),
	expiryAlert: text("expiry_alert"),
	daysUntilExpiry: integer("days_until_expiry"),
	renewalRequired: boolean("renewal_required"),
	renewalCourseId: uuid("renewal_course_id"),
});

export const vTrainingProgramProgress = pgTable("v_training_program_progress", {
	enrollmentId: uuid("enrollment_id"),
	organizationId: uuid("organization_id"),
	memberId: uuid("member_id"),
	firstName: varchar("first_name", { length: 255 }),
	lastName: varchar("last_name", { length: 255 }),
	programName: varchar("program_name", { length: 300 }),
	programCategory: varchar("program_category", { length: 100 }),
	enrollmentDate: date("enrollment_date"),
	enrollmentStatus: varchar("enrollment_status", { length: 50 }),
	coursesCompleted: integer("courses_completed"),
	coursesRequired: integer("courses_required"),
	hoursCompleted: numeric("hours_completed", { precision: 6, scale:  2 }),
	hoursRequired: numeric("hours_required", { precision: 6, scale:  2 }),
	progressPercentage: numeric("progress_percentage", { precision: 5, scale:  2 }),
	expectedCompletionDate: date("expected_completion_date"),
	completed: boolean("completed"),
	completionDate: date("completion_date"),
});

export const kpiConfigurations = pgTable("kpi_configurations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	createdBy: text("created_by").notNull(),
	name: text("name").notNull(),
	description: text("description"),
	metricType: text("metric_type").notNull(),
	dataSource: text("data_source").notNull(),
	calculation: jsonb("calculation").notNull(),
	visualizationType: text("visualization_type").notNull(),
	targetValue: numeric("target_value"),
	warningThreshold: numeric("warning_threshold"),
	criticalThreshold: numeric("critical_threshold"),
	alertEnabled: boolean("alert_enabled").default(false),
	alertRecipients: jsonb("alert_recipients"),
	refreshInterval: integer("refresh_interval").default(3600),
	isActive: boolean("is_active").default(true),
	displayOrder: integer("display_order"),
	dashboardLayout: jsonb("dashboard_layout"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		activeIdx: index("kpi_configurations_active_idx").using("btree", table.isActive.asc().nullsLast()),
		createdByIdx: index("kpi_configurations_created_by_idx").using("btree", table.createdBy.asc().nullsLast()),
		orgIdx: index("kpi_configurations_org_idx").using("btree", table.organizationId.asc().nullsLast()),
		kpiConfigurationsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "kpi_configurations_organization_id_fkey"
		}).onDelete("cascade"),
	}
});

// Export alias for backward compatibility
export { memberDuesAssignments as duesAssignments };

// =============================================================================
// OPERATIONAL FINANCE SCHEMA - Budget, Expense, Vendor Management
// =============================================================================

export const budgetStatus = pgEnum("budget_status", ['draft', 'approved', 'active', 'closed', 'revised'])
export const budgetPeriodType = pgEnum("budget_period_type", ['annual', 'quarterly', 'monthly', 'project'])
export const expenseStatus = pgEnum("expense_status", ['draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled'])
export const approvalStatus = pgEnum("approval_status", ['pending', 'approved', 'rejected', 'escalated'])
export const vendorStatus = pgEnum("vendor_status", ['active', 'inactive', 'suspended', 'archived'])
export const paymentTerms = pgEnum("payment_terms", ['net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'due_on_receipt', 'cod'])

/**
 * Budgets - Organizational budget planning and management
 */
export const budgets = pgTable("budgets", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	budgetName: varchar("budget_name", { length: 255 }).notNull(),
	fiscalYear: integer("fiscal_year").notNull(),
	periodType: budgetPeriodType("period_type").default('annual').notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	totalBudget: numeric("total_budget", { precision: 15, scale: 2 }).notNull(),
	totalAllocated: numeric("total_allocated", { precision: 15, scale: 2 }).default('0.00'),
	totalSpent: numeric("total_spent", { precision: 15, scale: 2 }).default('0.00'),
	totalCommitted: numeric("total_committed", { precision: 15, scale: 2 }).default('0.00'),
	status: budgetStatus("status").default('draft').notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	notes: text("notes"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by").notNull(),
},
(table) => {
	return {
		idxBudgetsOrg: index("idx_budgets_org").using("btree", table.organizationId.asc().nullsLast()),
		idxBudgetsFiscalYear: index("idx_budgets_fiscal_year").using("btree", table.fiscalYear.asc().nullsLast()),
		idxBudgetsStatus: index("idx_budgets_status").using("btree", table.status.asc().nullsLast()),
		idxBudgetsPeriod: index("idx_budgets_period").using("btree", table.startDate.asc().nullsLast(), table.endDate.asc().nullsLast()),
		budgetsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "budgets_organization_id_fkey"
		}).onDelete("cascade"),
		uniqueBudgetNameYear: unique("unique_budget_name_year").on(table.organizationId, table.budgetName, table.fiscalYear),
	}
});

/**
 * Budget Line Items - Detailed budget allocation by account/department
 */
export const budgetLineItems = pgTable("budget_line_items", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	budgetId: uuid("budget_id").notNull(),
	accountCode: varchar("account_code", { length: 50 }).notNull(),
	accountName: varchar("account_name", { length: 255 }).notNull(),
	departmentId: uuid("department_id"),
	categoryId: uuid("category_id"),
	allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 }).notNull(),
	spentAmount: numeric("spent_amount", { precision: 15, scale: 2 }).default('0.00'),
	committedAmount: numeric("committed_amount", { precision: 15, scale: 2 }).default('0.00'),
	remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 }).notNull(),
	notes: text("notes"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxBudgetLines: index("idx_budget_lines").using("btree", table.budgetId.asc().nullsLast()),
		idxBudgetLinesAccount: index("idx_budget_lines_account").using("btree", table.accountCode.asc().nullsLast()),
		idxBudgetLinesDept: index("idx_budget_lines_dept").using("btree", table.departmentId.asc().nullsLast()),
		budgetLineItemsBudgetIdFkey: foreignKey({
			columns: [table.budgetId],
			foreignColumns: [budgets.id],
			name: "budget_line_items_budget_id_fkey"
		}).onDelete("cascade"),
	}
});

/**
 * Expense Requests - Employee expense submission and tracking
 */
export const expenseRequests = pgTable("expense_requests", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	requestNumber: varchar("request_number", { length: 50 }).notNull(),
	requesterId: uuid("requester_id").notNull(),
	budgetId: uuid("budget_id"),
	budgetLineItemId: uuid("budget_line_item_id"),
	expenseDate: date("expense_date").notNull(),
	accountCode: varchar("account_code", { length: 50 }).notNull(),
	vendorId: uuid("vendor_id"),
	vendorName: varchar("vendor_name", { length: 255 }),
	description: text("description").notNull(),
	amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
	currency: varchar("currency", { length: 3 }).default('CAD'),
	taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default('0.00'),
	totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
	category: varchar("category", { length: 100 }),
	paymentMethod: varchar("payment_method", { length: 50 }), // personal_card, corporate_card, cash, check
	reimbursementRequired: boolean("reimbursement_required").default(true),
	receiptUrl: text("receipt_url"),
	attachments: jsonb("attachments").default([]),
	status: expenseStatus("status").default('draft').notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	paymentReference: varchar("payment_reference", { length: 255 }),
	notes: text("notes"),
	rejectionReason: text("rejection_reason"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxExpensesOrg: index("idx_expenses_org").using("btree", table.organizationId.asc().nullsLast()),
		idxExpensesRequester: index("idx_expenses_requester").using("btree", table.requesterId.asc().nullsLast()),
		idxExpensesStatus: index("idx_expenses_status").using("btree", table.status.asc().nullsLast()),
		idxExpensesDate: index("idx_expenses_date").using("btree", table.expenseDate.asc().nullsLast()),
		idxExpensesBudget: index("idx_expenses_budget").using("btree", table.budgetId.asc().nullsLast()),
		idxExpensesVendor: index("idx_expenses_vendor").using("btree", table.vendorId.asc().nullsLast()),
		idxExpensesAccount: index("idx_expenses_account").using("btree", table.accountCode.asc().nullsLast()),
		expenseRequestsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "expense_requests_organization_id_fkey"
		}).onDelete("cascade"),
		expenseRequestsBudgetIdFkey: foreignKey({
			columns: [table.budgetId],
			foreignColumns: [budgets.id],
			name: "expense_requests_budget_id_fkey"
		}),
		expenseRequestsBudgetLineItemIdFkey: foreignKey({
			columns: [table.budgetLineItemId],
			foreignColumns: [budgetLineItems.id],
			name: "expense_requests_budget_line_item_id_fkey"
		}),
		uniqueExpenseRequestNumber: unique("unique_expense_request_number").on(table.organizationId, table.requestNumber),
	}
});

/**
 * Expense Approvals - Approval workflow and chain
 */
export const expenseApprovals = pgTable("expense_approvals", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	expenseRequestId: uuid("expense_request_id").notNull(),
	approverId: uuid("approver_id").notNull(),
	approverLevel: integer("approver_level").notNull(), // 1 = supervisor, 2 = manager, 3 = executive
	status: approvalStatus("status").default('pending').notNull(),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	comments: text("comments"),
	delegatedTo: uuid("delegated_to"),
	isRequired: boolean("is_required").default(true),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxApprovalsExpense: index("idx_approvals_expense").using("btree", table.expenseRequestId.asc().nullsLast()),
		idxApprovalsApprover: index("idx_approvals_approver").using("btree", table.approverId.asc().nullsLast()),
		idxApprovalsStatus: index("idx_approvals_status").using("btree", table.status.asc().nullsLast()),
		expenseApprovalsExpenseRequestIdFkey: foreignKey({
			columns: [table.expenseRequestId],
			foreignColumns: [expenseRequests.id],
			name: "expense_approvals_expense_request_id_fkey"
		}).onDelete("cascade"),
	}
});

/**
 * Vendor Invoices - Operational invoices from vendors
 */
export const vendorInvoices = pgTable("vendor_invoices", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	vendorId: uuid("vendor_id").notNull(),
	invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
	invoiceDate: date("invoice_date").notNull(),
	dueDate: date("due_date").notNull(),
	budgetId: uuid("budget_id"),
	budgetLineItemId: uuid("budget_line_item_id"),
	accountCode: varchar("account_code", { length: 50 }).notNull(),
	description: text("description"),
	subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
	taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default('0.00'),
	totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
	currency: varchar("currency", { length: 3 }).default('CAD'),
	status: varchar("status", { length: 50 }).default('pending').notNull(), // pending, approved, paid, overdue, cancelled
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	paymentReference: varchar("payment_reference", { length: 255 }),
	invoiceUrl: text("invoice_url"),
	attachments: jsonb("attachments").default([]),
	notes: text("notes"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by").notNull(),
},
(table) => {
	return {
		idxVendorInvoicesOrg: index("idx_vendor_invoices_org").using("btree", table.organizationId.asc().nullsLast()),
		idxVendorInvoicesVendor: index("idx_vendor_invoices_vendor").using("btree", table.vendorId.asc().nullsLast()),
		idxVendorInvoicesStatus: index("idx_vendor_invoices_status").using("btree", table.status.asc().nullsLast()),
		idxVendorInvoicesDueDate: index("idx_vendor_invoices_due_date").using("btree", table.dueDate.asc().nullsLast()),
		idxVendorInvoicesBudget: index("idx_vendor_invoices_budget").using("btree", table.budgetId.asc().nullsLast()),
		idxVendorInvoicesAccount: index("idx_vendor_invoices_account").using("btree", table.accountCode.asc().nullsLast()),
		vendorInvoicesOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "vendor_invoices_organization_id_fkey"
		}).onDelete("cascade"),
		vendorInvoicesBudgetIdFkey: foreignKey({
			columns: [table.budgetId],
			foreignColumns: [budgets.id],
			name: "vendor_invoices_budget_id_fkey"
		}),
		vendorInvoicesBudgetLineItemIdFkey: foreignKey({
			columns: [table.budgetLineItemId],
			foreignColumns: [budgetLineItems.id],
			name: "vendor_invoices_budget_line_item_id_fkey"
		}),
		uniqueVendorInvoiceNumber: unique("unique_vendor_invoice_number").on(table.organizationId, table.vendorId, table.invoiceNumber),
	}
});

/**
 * Accounts Payable - AP tracking and aging
 */
export const accountsPayable = pgTable("accounts_payable", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	vendorId: uuid("vendor_id").notNull(),
	invoiceId: uuid("invoice_id"),
	expenseRequestId: uuid("expense_request_id"),
	referenceType: varchar("reference_type", { length: 50 }).notNull(), // vendor_invoice, expense_request, manual_entry
	referenceNumber: varchar("reference_number", { length: 100 }).notNull(),
	transactionDate: date("transaction_date").notNull(),
	dueDate: date("due_date").notNull(),
	amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
	paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).default('0.00'),
	balanceAmount: numeric("balance_amount", { precision: 15, scale: 2 }).notNull(),
	currency: varchar("currency", { length: 3 }).default('CAD'),
	status: varchar("status", { length: 50 }).default('open').notNull(), // open, partially_paid, paid, overdue, disputed, written_off
	daysOverdue: integer("days_overdue").default(0),
	agingBucket: varchar("aging_bucket", { length: 50 }), // current, 1-30, 31-60, 61-90, 90+
	lastPaymentDate: timestamp("last_payment_date", { withTimezone: true, mode: 'string' }),
	notes: text("notes"),
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxApOrg: index("idx_ap_org").using("btree", table.organizationId.asc().nullsLast()),
		idxApVendor: index("idx_ap_vendor").using("btree", table.vendorId.asc().nullsLast()),
		idxApStatus: index("idx_ap_status").using("btree", table.status.asc().nullsLast()),
		idxApDueDate: index("idx_ap_due_date").using("btree", table.dueDate.asc().nullsLast()),
		idxApAging: index("idx_ap_aging").using("btree", table.agingBucket.asc().nullsLast()),
		idxApOverdue: index("idx_ap_overdue").using("btree", table.daysOverdue.asc().nullsLast()).where(sql`(days_overdue > 0)`),
		accountsPayableOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "accounts_payable_organization_id_fkey"
		}).onDelete("cascade"),
		accountsPayableInvoiceIdFkey: foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [vendorInvoices.id],
			name: "accounts_payable_invoice_id_fkey"
		}),
		accountsPayableExpenseRequestIdFkey: foreignKey({
			columns: [table.expenseRequestId],
			foreignColumns: [expenseRequests.id],
			name: "accounts_payable_expense_request_id_fkey"
		}),
	}
});

/**
 * Vendors - Vendor/supplier directory
 */
export const vendors = pgTable("vendors", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	vendorNumber: varchar("vendor_number", { length: 50 }).notNull(),
	vendorName: varchar("vendor_name", { length: 255 }).notNull(),
	legalName: varchar("legal_name", { length: 255 }),
	vendorType: varchar("vendor_type", { length: 100 }), // supplier, contractor, professional_services, utilities, etc.
	taxId: varchar("tax_id", { length: 50 }), // Business number / EIN
	website: varchar("website", { length: 255 }),
	email: varchar("email", { length: 255 }),
	phone: varchar("phone", { length: 50 }),
	fax: varchar("fax", { length: 50 }),
	address: jsonb("address"),
	billingAddress: jsonb("billing_address"),
	primaryContactName: varchar("primary_contact_name", { length: 255 }),
	primaryContactEmail: varchar("primary_contact_email", { length: 255 }),
	primaryContactPhone: varchar("primary_contact_phone", { length: 50 }),
	paymentTerms: paymentTerms("payment_terms").default('net_30'),
	defaultAccountCode: varchar("default_account_code", { length: 50 }),
	currency: varchar("currency", { length: 3 }).default('CAD'),
	creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
	currentBalance: numeric("current_balance", { precision: 15, scale: 2 }).default('0.00'),
	ytdSpending: numeric("ytd_spending", { precision: 15, scale: 2 }).default('0.00'),
	status: vendorStatus("status").default('active').notNull(),
	notes: text("notes"),
	tags: text("tags").array().default([]),
	bankAccountInfo: jsonb("bank_account_info"), // Encrypted banking details for direct deposit
	taxInfo: jsonb("tax_info"), // W-9, 1099 info, GST/HST numbers
	insuranceInfo: jsonb("insurance_info"), // Liability insurance certificates
	contractInfo: jsonb("contract_info"), // Master service agreements
	metadata: jsonb("metadata").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by").notNull(),
	lastReviewDate: date("last_review_date"),
	nextReviewDate: date("next_review_date"),
},
(table) => {
	return {
		idxVendorsOrg: index("idx_vendors_org").using("btree", table.organizationId.asc().nullsLast()),
		idxVendorsStatus: index("idx_vendors_status").using("btree", table.status.asc().nullsLast()),
		idxVendorsType: index("idx_vendors_type").using("btree", table.vendorType.asc().nullsLast()),
		idxVendorsName: index("idx_vendors_name").using("btree", table.vendorName.asc().nullsLast()),
		vendorsOrganizationIdFkey: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "vendors_organization_id_fkey"
		}).onDelete("cascade"),
		uniqueVendorNumber: unique("unique_vendor_number").on(table.organizationId, table.vendorNumber),
		uniqueVendorName: unique("unique_vendor_name").on(table.organizationId, table.vendorName),
	}
});

// Re-export Gate 13 tables and relations from global schema for financial-service consumers
export {
	jobExecutionState,
	jobCancellationRequest,
	jobCancellationAuditEvent,
	jobReconciliationPass,
	jobExecutionStateRelations,
	jobCancellationRequestRelations,
	jobCancellationAuditEventRelations,
} from "@/db/schema";