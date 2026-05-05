/**
 * Nzila OS — TrustCore Law 25 Schema
 *
 * Privacy compliance and governance tables for the TrustCore module.
 * All tables are org-scoped. Compliant with Law 25 (Quebec).
 *
 * Tables:
 *   trustcorePrivacyPrograms   — Org-level Law 25 program profile
 *   trustcoreDataAssets        — PII / data inventory
 *   trustcorePias              — Privacy Impact Assessments
 *   trustcoreIncidents         — Confidentiality incident register
 *   trustcoreDsrRequests       — Data Subject Rights requests
 *   trustcoreConsentRecords    — Consent and withdrawal tracking
 *   trustcoreVendors           — Vendor / subprocessor register
 *   trustcoreEvidenceEvents    — Append-oriented compliance evidence log
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

// ── Enums ──────────────────────────────────────────────────────────────────

export const tcProgramStatusEnum = pgEnum('tc_program_status', [
  'draft',
  'active',
  'needs_review',
])

export const tcDataCategoryEnum = pgEnum('tc_data_category', [
  'identity',
  'contact',
  'financial',
  'health',
  'employment',
  'children',
  'sensitive',
  'other',
])

export const tcSensitivityLevelEnum = pgEnum('tc_sensitivity_level', [
  'low',
  'medium',
  'high',
  'critical',
])

export const tcAssetStatusEnum = pgEnum('tc_asset_status', [
  'active',
  'archived',
  'needs_review',
])

export const tcPiaTriggerEnum = pgEnum('tc_pia_trigger', [
  'new_system',
  'sensitive_data',
  'cross_border',
  'ai_or_automated_decision',
  'vendor_change',
  'major_change',
  'other',
])

export const tcPiaStatusEnum = pgEnum('tc_pia_status', [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'mitigation_required',
])

export const tcIncidentTypeEnum = pgEnum('tc_incident_type', [
  'unauthorized_access',
  'unauthorized_use',
  'unauthorized_disclosure',
  'loss',
  'other',
])

export const tcSeverityEnum = pgEnum('tc_severity', [
  'low',
  'medium',
  'high',
  'critical',
])

export const tcResolutionStatusEnum = pgEnum('tc_resolution_status', [
  'open',
  'contained',
  'resolved',
  'closed',
])

export const tcDsrRequestTypeEnum = pgEnum('tc_dsr_request_type', [
  'access',
  'rectification',
  'deletion',
  'portability',
  'consent_withdrawal',
  'other',
])

export const tcDsrStatusEnum = pgEnum('tc_dsr_status', [
  'received',
  'verifying_identity',
  'in_progress',
  'completed',
  'denied',
  'overdue',
])

export const tcConsentMethodEnum = pgEnum('tc_consent_method', [
  'web_form',
  'paper',
  'email',
  'verbal',
  'imported',
  'other',
])

export const tcVendorRiskEnum = pgEnum('tc_vendor_risk', [
  'low',
  'medium',
  'high',
  'critical',
])

export const tcVendorStatusEnum = pgEnum('tc_vendor_status', [
  'active',
  'pending_review',
  'suspended',
  'archived',
])

// ── A) trustcorePrivacyPrograms ────────────────────────────────────────────

export const trustcorePrivacyPrograms = pgTable(
  'trustcore_privacy_programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    framework: text('framework').notNull().default('law25'),
    privacyOfficerName: text('privacy_officer_name'),
    privacyOfficerEmail: text('privacy_officer_email'),
    privacyOfficerRole: text('privacy_officer_role'),
    publicContactEmail: text('public_contact_email'),
    status: tcProgramStatusEnum('status').notNull().default('draft'),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tc_privacy_programs_org_idx').on(t.orgId),
    index('tc_privacy_programs_org_status_idx').on(t.orgId, t.status),
  ],
)

// ── B) trustcoreDataAssets ─────────────────────────────────────────────────

export const trustcoreDataAssets = pgTable(
  'trustcore_data_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    name: text('name').notNull(),
    description: text('description'),
    dataCategory: tcDataCategoryEnum('data_category').notNull(),
    sensitivityLevel: tcSensitivityLevelEnum('sensitivity_level').notNull(),
    processingPurpose: text('processing_purpose'),
    lawfulBasisOrConsentBasis: text('lawful_basis_or_consent_basis'),
    storageLocation: text('storage_location'),
    systemOwner: text('system_owner'),
    retentionPeriod: text('retention_period'),
    crossBorderTransfer: boolean('cross_border_transfer').notNull().default(false),
    destinationCountry: text('destination_country'),
    vendorId: uuid('vendor_id'),
    status: tcAssetStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tc_data_assets_org_idx').on(t.orgId),
    index('tc_data_assets_org_status_idx').on(t.orgId, t.status),
    index('tc_data_assets_org_sensitivity_idx').on(t.orgId, t.sensitivityLevel),
  ],
)

// ── C) trustcorePias ───────────────────────────────────────────────────────

export const trustcorePias = pgTable(
  'trustcore_pias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    title: text('title').notNull(),
    triggerType: tcPiaTriggerEnum('trigger_type').notNull(),
    description: text('description'),
    riskScore: integer('risk_score'),
    status: tcPiaStatusEnum('status').notNull().default('draft'),
    reviewerName: text('reviewer_name'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    mitigationPlan: text('mitigation_plan'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tc_pias_org_idx').on(t.orgId),
    index('tc_pias_org_status_idx').on(t.orgId, t.status),
  ],
)

// ── D) trustcoreIncidents ──────────────────────────────────────────────────

export const trustcoreIncidents = pgTable(
  'trustcore_incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    title: text('title').notNull(),
    description: text('description'),
    incidentType: tcIncidentTypeEnum('incident_type').notNull(),
    severity: tcSeverityEnum('severity').notNull(),
    dateDetected: timestamp('date_detected', { withTimezone: true }).notNull(),
    dateOccurred: timestamp('date_occurred', { withTimezone: true }),
    harmAssessment: text('harm_assessment'),
    seriousHarmLikely: boolean('serious_harm_likely').notNull().default(false),
    reportedToCai: boolean('reported_to_cai').notNull().default(false),
    caiReportedAt: timestamp('cai_reported_at', { withTimezone: true }),
    affectedIndividualsNotified: boolean('affected_individuals_notified').notNull().default(false),
    individualNotificationAt: timestamp('individual_notification_at', { withTimezone: true }),
    containmentActions: text('containment_actions'),
    resolutionStatus: tcResolutionStatusEnum('resolution_status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tc_incidents_org_idx').on(t.orgId),
    index('tc_incidents_org_status_idx').on(t.orgId, t.resolutionStatus),
    index('tc_incidents_org_severity_idx').on(t.orgId, t.severity),
  ],
)

// ── E) trustcoreDsrRequests ────────────────────────────────────────────────

export const trustcoreDsrRequests = pgTable(
  'trustcore_dsr_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    requesterName: text('requester_name').notNull(),
    requesterEmail: text('requester_email').notNull(),
    requestType: tcDsrRequestTypeEnum('request_type').notNull(),
    identityVerified: boolean('identity_verified').notNull().default(false),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: tcDsrStatusEnum('status').notNull().default('received'),
    responseSummary: text('response_summary'),
    denialReason: text('denial_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tc_dsr_requests_org_idx').on(t.orgId),
    index('tc_dsr_requests_org_status_idx').on(t.orgId, t.status),
    index('tc_dsr_requests_org_due_idx').on(t.orgId, t.dueAt),
  ],
)

// ── F) trustcoreConsentRecords ─────────────────────────────────────────────

export const trustcoreConsentRecords = pgTable(
  'trustcore_consent_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    subjectName: text('subject_name'),
    subjectEmail: text('subject_email'),
    purpose: text('purpose').notNull(),
    consentMethod: tcConsentMethodEnum('consent_method').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    consentTextVersion: text('consent_text_version').notNull(),
    evidenceRef: text('evidence_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tc_consent_records_org_idx').on(t.orgId),
    index('tc_consent_records_org_created_idx').on(t.orgId, t.createdAt),
  ],
)

// ── G) trustcoreVendors ────────────────────────────────────────────────────

export const trustcoreVendors = pgTable(
  'trustcore_vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    name: text('name').notNull(),
    serviceDescription: text('service_description'),
    country: text('country'),
    dataSharedDescription: text('data_shared_description'),
    riskLevel: tcVendorRiskEnum('risk_level').notNull().default('low'),
    crossBorderTransfer: boolean('cross_border_transfer').notNull().default(false),
    piaRequired: boolean('pia_required').notNull().default(false),
    contractReviewed: boolean('contract_reviewed').notNull().default(false),
    status: tcVendorStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tc_vendors_org_idx').on(t.orgId),
    index('tc_vendors_org_status_idx').on(t.orgId, t.status),
    index('tc_vendors_org_risk_idx').on(t.orgId, t.riskLevel),
  ],
)

// ── H) trustcoreEvidenceEvents ─────────────────────────────────────────────

export const trustcoreEvidenceEvents = pgTable(
  'trustcore_evidence_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    actorId: text('actor_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    summary: text('summary'),
    metadata: jsonb('metadata'),
    eventHash: text('event_hash'),
    previousEventHash: text('previous_event_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tc_evidence_events_org_idx').on(t.orgId),
    index('tc_evidence_events_org_created_idx').on(t.orgId, t.createdAt),
    index('tc_evidence_events_org_entity_idx').on(t.orgId, t.entityType, t.entityId),
  ],
)
