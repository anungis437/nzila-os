import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Local record of a public contact-form submission (platform migration 0045). Written by the contact route under the system role
 * before the CRM sync; never read through a tenant session. Anonymous personal data: every column is bounded and retain_until
 * says when the row is due for deletion.
 */
export const contactSubmissions = pgTable('contact_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 254 }).notNull(),
  organization: varchar('organization', { length: 200 }),
  role: varchar('role', { length: 100 }),
  inquiryType: varchar('inquiry_type', { length: 100 }),
  message: varchar('message', { length: 2000 }),
  crmStatus: varchar('crm_status', { length: 20 }).notNull().default('pending'),
  crmContactId: varchar('crm_contact_id', { length: 100 }),
  crmDealId: varchar('crm_deal_id', { length: 100 }),
  crmSyncedAt: timestamp('crm_synced_at', { withTimezone: true }),
  retainUntil: timestamp('retain_until', { withTimezone: true }).notNull().default(sql`now() + interval '2 years'`),
}, (table) => ({
  receivedIdx: index('contact_submissions_received_idx').on(table.receivedAt),
  retentionIdx: index('contact_submissions_retention_idx').on(table.retainUntil),
}))

export type ContactSubmission = typeof contactSubmissions.$inferSelect