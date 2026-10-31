import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { organizations } from '../../../schema-organizations'

/**
 * Platform-wide delivery suppression of an e-mail address (platform 0053, cache 0043). System-only: written by the provider webhook and
 * read by the single sending function, both under the system role. Holds the SHA-256 of the lower-cased address, never the address.
 * A delivery suppression, not consent.
 */
export const emailAddressSuppressions = pgTable('email_address_suppressions', {
  id: uuid('id').defaultRandom().primaryKey(),
  addressSha256: varchar('address_sha256', { length: 64 }).notNull().unique(),
  reason: varchar('reason', { length: 30 }).notNull(), // complaint | provider_suppressed
  sourceOrganizationId: uuid('source_organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  firstProviderEventId: varchar('first_provider_event_id', { length: 255 }),
  lastProviderEventId: varchar('last_provider_event_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  liftedAt: timestamp('lifted_at', { withTimezone: true }),
  liftedBy: varchar('lifted_by', { length: 255 }),
  liftReason: text('lift_reason'),
})