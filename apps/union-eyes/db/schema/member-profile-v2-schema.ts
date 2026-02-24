/**
 * Member Profile v2 Schema
 * 
 * Enhanced member profile with contact preferences, employment details,
 * consent tracking, and document storage
 */

import { pgTable, uuid, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Contact Preferences
export const memberContactPreferences = pgTable('member_contact_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Member Reference
  userId: uuid('user_id').notNull().unique(),
  organizationId: uuid('organization_id').notNull(),
  
  // Communication Preferences
  preferredContactMethod: text('preferred_contact_method').notNull().default('email'), // email, phone, sms, mail, in_person
  preferredLanguage: text('preferred_language').default('en'),
  
  // Channel Opt-ins
  emailOptIn: boolean('email_opt_in').default(true),
  smsOptIn: boolean('sms_opt_in').default(false),
  phoneOptIn: boolean('phone_opt_in').default(true),
  mailOptIn: boolean('mail_opt_in').default(true),
  
  // Notification Preferences
  notificationPreferences: jsonb('notification_preferences').$type<{
    caseUpdates: boolean;
    duesReminders: boolean;
    eventInvitations: boolean;
    newsletter: boolean;
    urgentOnly: boolean;
  }>(),
  
  // Best Contact Times
  bestContactTimes: jsonb('best_contact_times').$type<{
    monday?: string[];
    tuesday?: string[];
    wednesday?: string[];
    thursday?: string[];
    friday?: string[];
    saturday?: string[];
    sunday?: string[];
  }>(),
  
  // Alternative Contacts
  alternativeEmail: text('alternative_email'),
  alternativePhone: text('alternative_phone'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  emergencyContactRelation: text('emergency_contact_relation'),
  
  // Accessibility
  accessibilityNeeds: text('accessibility_needs'),
  interpreterRequired: boolean('interpreter_required').default(false),
  interpreterLanguage: text('interpreter_language'),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastModifiedBy: text('last_modified_by'),
});

// Employment Attributes
export const memberEmploymentDetails = pgTable('member_employment_details', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Member Reference
  userId: uuid('user_id').notNull().unique(),
  organizationId: uuid('organization_id').notNull(),
  
  // Employment Classification
  classification: text('classification').notNull(), // full_time, part_time, casual, contract, seasonal
  jobTitle: text('job_title'),
  jobCode: text('job_code'),
  payGrade: text('pay_grade'),
  
  // Work Location
  workLocationId: uuid('work_location_id'), // References worksites
  department: text('department'),
  division: text('division'),
  costCenter: text('cost_center'),
  
  // Seniority
  seniorityDate: timestamp('seniority_date'),
  seniorityYears: integer('seniority_years'),
  seniorityPoints: integer('seniority_points'),
  
  // Schedule
  shiftType: text('shift_type'), // day, evening, night, rotating, on_call
  shiftStart: text('shift_start'), // HH:MM
  shiftEnd: text('shift_end'), // HH:MM
  workDays: jsonb('work_days').$type<string[]>(), // ['monday', 'tuesday', ...]
  hoursPerWeek: integer('hours_per_week'),
  
  // Supervisor
  supervisorName: text('supervisor_name'),
  supervisorId: uuid('supervisor_id'),
  supervisorContact: text('supervisor_contact'),
  
  // Employment Status
  employmentStatus: text('employment_status').notNull().default('active'), // active, leave, layoff, suspended, terminated
  statusEffectiveDate: timestamp('status_effective_date'),
  statusReason: text('status_reason'),
  expectedReturnDate: timestamp('expected_return_date'),
  
  // Benefits Eligibility
  benefitsEligible: boolean('benefits_eligible').default(true),
  benefitsEnrollmentDate: timestamp('benefits_enrollment_date'),
  pensionPlanEnrolled: boolean('pension_plan_enrolled').default(false),
  
  // Probation
  probationEndDate: timestamp('probation_end_date'),
  isProbationary: boolean('is_probationary').default(false),
  
  // Special Designations
  steward: boolean('steward').default(false),
  officer: boolean('officer').default(false),
  committeeMember: boolean('committee_member').default(false),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastModifiedBy: text('last_modified_by'),
});

// Consent Tracking
export const memberConsents = pgTable('member_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Member Reference
  userId: uuid('user_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  
  // Consent Type
  consentType: text('consent_type').notNull(), // privacy_policy, data_collection, communications, photo_video, third_party_sharing
  consentCategory: text('consent_category').notNull(), // legal, marketing, research, operational
  
  // Consent Status
  granted: boolean('granted').notNull(),
  grantedAt: timestamp('granted_at'),
  revokedAt: timestamp('revoked_at'),
  
  // Consent Details
  consentVersion: text('consent_version'), // Version of policy/terms consented to
  consentText: text('consent_text'), // Full text at time of consent
  consentMethod: text('consent_method'), // online, paper, verbal, implied
  
  // Verification
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  witnessedBy: text('witnessed_by'),
  
  // Expiry
  expiresAt: timestamp('expires_at'),
  requiresRenewal: boolean('requires_renewal').default(false),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: text('created_by'),
});

// Member Documents
export const memberDocuments = pgTable('member_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Member Reference
  userId: uuid('user_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  
  // Document Details
  documentType: text('document_type').notNull(), // certification, license, medical, identification, training, contract
  documentName: text('document_name').notNull(),
  documentNumber: text('document_number'),
  
  // File Information
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  fileHash: text('file_hash'), // SHA-256
  
  // Validity
  issueDate: timestamp('issue_date'),
  expiryDate: timestamp('expiry_date'),
  isExpired: boolean('is_expired').default(false),
  
  // Verification
  verified: boolean('verified').default(false),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at'),
  verificationNotes: text('verification_notes'),
  
  // Classification
  confidentialityLevel: text('confidentiality_level').default('internal'), // public, internal, confidential, restricted
  tags: jsonb('tags').$type<string[]>(),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  uploadedBy: text('uploaded_by'),
});

// Member History Timeline
export const memberHistoryEvents = pgTable('member_history_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Member Reference
  userId: uuid('user_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  
  // Event Details
  eventType: text('event_type').notNull(), // status_change, profile_update, case_filed, document_added, payment, election
  eventCategory: text('event_category').notNull(), // employment, membership, engagement, administrative
  eventDate: timestamp('event_date').notNull(),
  
  // Event Data
  eventTitle: text('event_title').notNull(),
  eventDescription: text('event_description'),
  eventData: jsonb('event_data').$type<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    previousValue?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newValue?: any;
    relatedId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>(),
  
  // Actor
  actorId: text('actor_id'),
  actorName: text('actor_name'),
  
  // Visibility
  isPublic: boolean('is_public').default(false),
  visibleToMember: boolean('visible_to_member').default(true),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: text('created_by'),
});

// Relations
export const memberContactPreferencesRelations = relations(memberContactPreferences, ({ _one }) => ({
  // user: one(users, { fields: [memberContactPreferences.userId], references: [users.id] }),
}));

export const memberEmploymentDetailsRelations = relations(memberEmploymentDetails, ({ _one }) => ({
  // user: one(users, { fields: [memberEmploymentDetails.userId], references: [users.id] }),
}));

export const memberConsentsRelations = relations(memberConsents, ({ _one }) => ({
  // user: one(users, { fields: [memberConsents.userId], references: [users.id] }),
}));

export const memberDocumentsRelations = relations(memberDocuments, ({ _one }) => ({
  // user: one(users, { fields: [memberDocuments.userId], references: [users.id] }),
}));

export const memberHistoryEventsRelations = relations(memberHistoryEvents, ({ _one }) => ({
  // user: one(users, { fields: [memberHistoryEvents.userId], references: [users.id] }),
}));
