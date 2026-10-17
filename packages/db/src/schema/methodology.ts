import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const platformMethodologyVersions = pgTable(
  'platform_methodology_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorityId: varchar('authority_id', { length: 160 }).notNull(),
    methodologyId: varchar('methodology_id', { length: 160 }).notNull(),
    version: varchar('version', { length: 80 }).notNull(),
    name: text('name').notNull(),
    definitionSha256: varchar('definition_sha256', { length: 64 }).notNull(),
    definitionRef: text('definition_ref'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    supersedesVersion: varchar('supersedes_version', { length: 80 }),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('platform_methodology_authority_version_uidx').on(
      table.authorityId,
      table.methodologyId,
      table.version,
    ),
    uniqueIndex('platform_methodology_version_identity_uidx').on(
      table.id,
      table.authorityId,
      table.methodologyId,
      table.version,
      table.definitionSha256,
    ),
    index('platform_methodology_authority_effective_idx').on(
      table.authorityId,
      table.methodologyId,
      table.effectiveFrom,
    ),
    foreignKey({
      name: 'platform_methodology_supersedes_version_fk',
      columns: [table.authorityId, table.methodologyId, table.supersedesVersion],
      foreignColumns: [table.authorityId, table.methodologyId, table.version],
    }).onDelete('restrict'),
    check(
      'platform_methodology_definition_sha256_ck',
      sql`${table.definitionSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      'platform_methodology_effective_period_ck',
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
  ],
)
