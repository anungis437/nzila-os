/** External reads have their own exact consent/provenance boundary. These rows
 * confer no organization membership and never reuse WorkAid/counsel consent. */
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const externalReadConsents = pgTable('ue_external_read_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  matterId: uuid('matter_id').notNull(),
  memberUserId: text('member_user_id').notNull(),
  recipientUserId: text('recipient_user_id').notNull(),
  representativeOrganizationId: uuid('representative_organization_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  consentText: text('consent_text').notNull(),
  consentTextSha256: text('consent_text_sha256').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: text('revoked_by'),
}, table => [index('ue_external_read_consent_matter').on(table.organizationId, table.matterId)])

export const externalReadQualifications = pgTable('ue_external_read_qualifications', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  matterId: uuid('matter_id').notNull(),
  memberUserId: text('member_user_id').notNull(),
  recipientUserId: text('recipient_user_id').notNull(),
  representativeOrganizationId: uuid('representative_organization_id').notNull(),
  consentId: uuid('consent_id').notNull().references(() => externalReadConsents.id),
  payloadHash: text('payload_hash').notNull(),
  payload: jsonb('payload').notNull(),
  qualifiedBy: text('qualified_by').notNull(),
  qualifiedAt: timestamp('qualified_at', { withTimezone: true }).notNull().defaultNow(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: text('revoked_by'),
}, table => [index('ue_external_read_qualification_resource').on(table.organizationId, table.matterId, table.recipientUserId)])
