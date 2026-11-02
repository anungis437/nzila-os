/**
 * Regression contract for the QA-only external-counsel fixture.
 *
 * The real PostgreSQL 15/16 schema requires grievances.type; omitting it
 * prevents the external-counsel HTTP acceptance journey from starting.
 * This source contract is NOT a native/database or end-to-end pass.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { grievanceTypeEnum } from '@/db/schema/domains/claims/grievances'

const fixtureSource = readFileSync(new URL('../external-admin.ts', import.meta.url), 'utf8')

describe('external-counsel QA grievance fixture', () => {
  it('inserts an explicit, valid grievance type without inventing an authority or grant through HTTP', () => {
    const match = fixtureSource.match(/INSERT INTO grievances\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/)
    expect(match, 'grievance fixture INSERT must exist').not.toBeNull()
    const columns = match![1].split(',').map((value) => value.trim())
    const values = match![2].split(',').map((value) => value.trim())
    expect(columns).toHaveLength(values.length)
    const typeIndex = columns.indexOf('type')
    expect(typeIndex).toBeGreaterThanOrEqual(0)
    const type = values[typeIndex].replace(/^'|'$/g, '')
    expect(grievanceTypeEnum.enumValues).toContain(type)
    expect(type).toBe('individual')
    expect(fixtureSource).toContain("QA_TEST_ENV !== 'true'")
    expect(fixtureSource).toContain('synthetic runtime acceptance')
  })
})
