import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pilotApplications } from '../marketing';

export const pilotContactVerifications = pgTable('pilot_contact_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => pilotApplications.id, { onDelete: 'cascade' }),
  emailKey: varchar('email_key', { length: 320 }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  status: varchar('status', { length: 20 }).$type<'pending' | 'verified' | 'expired' | 'withdrawn'>().notNull().default('pending'),
  crmConsentStatus: varchar('crm_consent_status', { length: 20 }).$type<'granted' | 'denied' | 'withdrawn'>().notNull(),
  crmConsentVersion: varchar('crm_consent_version', { length: 100 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  deliveryStatus: varchar('delivery_status', { length: 20 }).$type<'pending' | 'sent' | 'failed' | 'ambiguous'>().notNull().default('pending'),
  providerMessageId: varchar('provider_message_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenUq: uniqueIndex('pilot_contact_verifications_token_uniq').on(table.tokenHash),
  applicationIdx: index('pilot_contact_verifications_application_idx').on(table.applicationId, table.status),
}));
export const pilotCrmDisclosureOutbox = pgTable('pilot_crm_disclosure_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => pilotApplications.id, { onDelete: 'cascade' }),
  verificationId: uuid('verification_id').notNull().references(() => pilotContactVerifications.id, { onDelete: 'restrict' }),
  provider: varchar('provider', { length: 50 }).notNull().default('hubspot'),
  purpose: varchar('purpose', { length: 100 }).notNull(),
  payload: jsonb('payload').$type<Record<string, string>>().notNull(),
  payloadDigest: varchar('payload_digest', { length: 64 }).notNull(),
  status: varchar('status', { length: 20 }).$type<'queued' | 'sending' | 'sent' | 'held' | 'cancelled'>().notNull().default('queued'),
  providerContactId: varchar('provider_contact_id', { length: 255 }),
  providerDealId: varchar('provider_deal_id', { length: 255 }),
  attemptCount: varchar('attempt_count', { length: 12 }).notNull().default('0'),
  lastError: varchar('last_error', { length: 500 }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  verificationUq: uniqueIndex('pilot_crm_disclosure_outbox_verification_uniq').on(table.verificationId),
  dispatchIdx: index('pilot_crm_disclosure_outbox_dispatch_idx').on(table.status, table.createdAt),
}));
