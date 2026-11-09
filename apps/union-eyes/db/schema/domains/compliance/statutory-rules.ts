import { check, index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const statutoryRuleVersions = pgTable('statutory_rule_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  jurisdiction: varchar('jurisdiction', { length: 16 }).notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  ruleKey: varchar('rule_key', { length: 128 }).notNull(),
  version: integer('version').notNull(),
  status: varchar('status', { length: 20 }).$type<'draft' | 'reviewed' | 'withdrawn'>().notNull().default('draft'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  sourceUri: varchar('source_uri', { length: 1000 }).notNull(),
  sourceDigest: varchar('source_digest', { length: 64 }).notNull(),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveUntil: timestamp('effective_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  versionUq: uniqueIndex('statutory_rule_versions_key_version_uniq').on(table.jurisdiction, table.ruleKey, table.version),
  effectiveIdx: index('statutory_rule_versions_effective_idx').on(table.jurisdiction, table.category, table.status, table.effectiveFrom, table.effectiveUntil),
  digestCheck: check('statutory_rule_versions_digest_check', sql`${table.sourceDigest} ~ '^[a-f0-9]{64}$'`),
  intervalCheck: check('statutory_rule_versions_interval_check', sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`),
  reviewCheck: check('statutory_rule_versions_review_check', sql`${table.status} <> 'reviewed' OR (${table.reviewedBy} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL)`),
}));
