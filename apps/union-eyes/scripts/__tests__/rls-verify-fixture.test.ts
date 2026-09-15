import { describe, expect, it } from 'vitest'
import { organizations } from '../../db/schema-organizations'
import {
  buildRlsVerifyOrganizationFixture,
  RLS_VERIFY_ORGANIZATION_FIXTURE_COLUMNS,
} from '../rls-verify'

function organizationColumns(): Record<string, { name: string; notNull: boolean; hasDefault: boolean }> {
  return (organizations as unknown as Record<symbol, unknown>)[Symbol.for('drizzle:Columns')] as Record<
    string,
    { name: string; notNull: boolean; hasDefault: boolean }
  >
}

describe('RLS verifier organization fixture', () => {
  it('covers every required organizations column without a database default', () => {
    const requiredColumns = Object.values(organizationColumns())
      .filter((column) => column.notNull && !column.hasDefault)
      .map((column) => column.name)
      .sort()

    expect([...RLS_VERIFY_ORGANIZATION_FIXTURE_COLUMNS].sort()).toEqual(
      expect.arrayContaining(requiredColumns),
    )
  })

  it('builds a synthetic organization compatible with current required schema fields', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const fixture = buildRlsVerifyOrganizationFixture({
      id,
      name: 'UE_RA_TEST Org A',
      slug: 'ue-ra-test-org-a',
      runId: 'UE_RA_TEST',
    })

    expect(fixture).toMatchObject({
      id,
      name: 'UE_RA_TEST Org A',
      slug: 'ue-ra-test-org-a',
      organizationType: 'union',
      hierarchyPath: [id],
      hierarchyLevel: 0,
      status: 'active',
      settings: { rls_verify_fixture: true, run_id: 'UE_RA_TEST' },
    })
  })
})
