import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { allocateOrganizationRecordNumber, issueOrganizationRecordNumber, RECORD_NUMBER_SERIES, type RecordNumberSeries } from '../organization-record-number'

// DEF-0B8-HS-RECORD-NUMBERS-CALLER-SUPPLIED-AND-UNIQUE-ACROSS-ORGANIZATIONS
// DEF-0B10-ORG-CAMPAIGN-CODE-UNIQUE-ACROSS-ALL-ORGANIZATIONS-AND-REQUIRED-COLUMNS-FAIL-AS-500
// The allocator against real PostgreSQL semantics (PGlite): one sequence per organization and series, the per-organization
// unique index platform 0042 installs, and values of another shape never read as part of the sequence.

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const NOW = new Date('2026-11-05T12:00:00Z')

describe('allocateOrganizationRecordNumber on PGlite', () => {
  let pg: PGlite
  let db: ReturnType<typeof drizzle>

  beforeEach(async () => {
    pg = new PGlite()
    db = drizzle(pg)
    for (const { table, column } of Object.values(RECORD_NUMBER_SERIES)) {
      await pg.exec(`CREATE TABLE ${table} (id uuid primary key default gen_random_uuid(), organization_id uuid not null, ${column} varchar(50) not null);
        CREATE UNIQUE INDEX uq_${table}_org_${column} ON ${table} (organization_id, ${column});`)
    }
  })
  afterEach(async () => {
    await pg.close()
  })

  const insert = (series: RecordNumberSeries, org: string, value: string) => {
    const { table, column } = RECORD_NUMBER_SERIES[series]
    return pg.query(`INSERT INTO ${table} (organization_id, ${column}) VALUES ($1::uuid, $2)`, [org, value])
  }
  const next = (series: RecordNumberSeries, org: string) => allocateOrganizationRecordNumber(db as never, series, org, NOW)

  it('starts each organization at 0001 and continues its own sequence, unaffected by another organization', async () => {
    expect(await next('incident', A)).toBe('INC-2026-0001')
    await insert('incident', A, 'INC-2026-0001')
    await insert('incident', A, 'INC-2026-0002')
    for (let i = 1; i <= 7; i += 1) await insert('incident', B, `INC-2026-${String(i).padStart(4, '0')}`)
    expect(await next('incident', A)).toBe('INC-2026-0003')
    expect(await next('incident', B)).toBe('INC-2026-0008')
    // B already holds INC-2026-0003; A is issued and stores the same number, because the unique index is per organization.
    await insert('incident', A, await next('incident', A))
    await expect(insert('incident', A, 'INC-2026-0003')).rejects.toThrow(/duplicate key/)
  })

  it('ignores older random numbers and values of another shape, and steps over a hand-chosen number of the server shape', async () => {
    await insert('hazard', A, 'HAZ-2026-6f1d2c3e-0000-4000-8000-000000000000')
    await insert('hazard', A, 'HAZ-2025-0099')
    await insert('hazard', A, 'free text')
    expect(await next('hazard', A)).toBe('HAZ-2026-0001')
    await insert('hazard', A, 'HAZ-2026-0500')
    expect(await next('hazard', A)).toBe('HAZ-2026-0501')
  })

  it('grows past four digits and keeps one series apart from another', async () => {
    await insert('inspection', A, 'INS-2026-9999')
    expect(await next('inspection', A)).toBe('INS-2026-10000')
    expect(await next('ppe', A)).toBe('PPE-0001')
    await insert('ppe', A, 'PPE-0001')
    expect(await next('ppe', A)).toBe('PPE-0002')
    expect(await next('organizingCampaign', A)).toBe('CMP-2026-0001')
  })

  it('refuses to issue a number without an organization or outside the organization transaction', async () => {
    await expect(allocateOrganizationRecordNumber(db as never, 'incident', 'not-an-org', NOW)).rejects.toThrow(/organization/)
    await expect(issueOrganizationRecordNumber('incident', A, NOW)).rejects.toThrow(/organization transaction/)
    await expect(issueOrganizationRecordNumber('incident', null, NOW)).rejects.toThrow(/organization transaction/)
  })
})
