/**
 * Representation workflows (platform migration 0091, RLS scoped 0064). Drizzle mirror of the governed SQL; the SQL is the
 * authority (CHECKs, withdraw-only, append-only and same-organization triggers). See lib/representation-workflows.
 */
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const grievanceGroupParticipants = pgTable(
  'grievance_group_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    grievanceId: uuid('grievance_id').notNull(),
    memberUserId: text('member_user_id').notNull(),
    employerPortionRef: text('employer_portion_ref').notNull(),
    consentForm: text('consent_form').notNull(),
    consentEvidenceRef: text('consent_evidence_ref').notNull(),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull(),
    recordedBy: text('recorded_by').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnRecordedBy: text('withdrawn_recorded_by'),
    withdrawalReason: text('withdrawal_reason'),
    withdrawalEvidenceRef: text('withdrawal_evidence_ref'),
  },
  (t) => [
    uniqueIndex('ux_grievance_group_participants_active').on(t.grievanceId, t.memberUserId).where(sql`withdrawn_at IS NULL`),
    index('idx_grievance_group_participants_grievance').on(t.grievanceId),
  ],
);

export const grievanceRepresentationRecords = pgTable(
  'grievance_representation_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    grievanceId: uuid('grievance_id').notNull(),
    recordKind: text('record_kind').notNull(),
    parentRecordId: uuid('parent_record_id'),
    actorOffice: text('actor_office'),
    payload: jsonb('payload').notNull(),
    recordedBy: text('recorded_by').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_grievance_representation_records_grievance').on(t.grievanceId, t.recordKind),
    uniqueIndex('ux_grievance_representation_approval_once').on(t.parentRecordId, t.recordedBy).where(sql`record_kind = 'filing_approval'`),
  ],
);
