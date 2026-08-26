/**
 * Demo-local schema shim: `grievances` table stub.
 *
 * Wave 0 §2 remediation: replaces the operational
 * `@/db/schema/grievance-schema` import with a minimal placeholder
 * table definition. Only the columns the demo repo (`lib/demo/server/
 * cupe4373-cases-repo.ts`) references are declared.
 *
 * Combined with the inert `db` client in `db/db.ts`, queries against
 * this table always yield `[]`, driving the caller's fixture fallback.
 *
 * Do NOT expand this schema. The demo has no ownership of the
 * operational grievance data model.
 */

import { pgTable, text, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const grievances = pgTable('grievances', {
  id: uuid('id').primaryKey().defaultRandom(),
  grievanceNumber: varchar('grievance_number', { length: 50 }).unique().notNull(),
  type: text('type').notNull(),
  status: text('status').notNull().default('draft'),
  priority: text('priority'),
  step: text('step'),
  grievantName: varchar('grievant_name', { length: 255 }),
  employerName: varchar('employer_name', { length: 255 }),
  workplaceName: varchar('workplace_name', { length: 255 }),
  cbaArticle: varchar('cba_article', { length: 100 }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull(),
  background: text('background'),
  desiredOutcome: text('desired_outcome'),
  filedDate: timestamp('filed_date', { withTimezone: true }),
  responseDeadline: timestamp('response_deadline', { withTimezone: true }),
  timeline: jsonb('timeline').$type<unknown[]>(),
  attachments: jsonb('attachments').$type<unknown[]>(),
  organizationId: text('organization_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
