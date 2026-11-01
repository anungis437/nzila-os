/**
 * Pilot fixture origin ledger (platform 0058, RLS cache 0046).
 *
 * One row records that the CUPE pilot bootstrap created a row (or the organization itself) from a fixture. A reset deletes exactly the rows
 * named here: a row that is not in the ledger is not fixture data, whatever it is called. The ledger holds identifiers only.
 */
import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core'

export const PILOT_FIXTURE_RESOURCE_TYPES = ['organization', 'organization_member', 'grievance'] as const
export type PilotFixtureResourceType = (typeof PILOT_FIXTURE_RESOURCE_TYPES)[number]

export const pilotFixtureRows = pgTable(
  'pilot_fixture_rows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    fixtureSource: varchar('fixture_source', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 40 }).$type<PilotFixtureResourceType>().notNull(),
    resourceId: uuid('resource_id').notNull(),
    seededBy: varchar('seeded_by', { length: 255 }).notNull(),
    seededAt: timestamp('seeded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('pilot_fixture_rows_resource_uq').on(table.organizationId, table.resourceType, table.resourceId)],
)
