import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { organizationMembers } from '../schema-organizations'

// The canonical organization_members.exempt_from_per_capita column is NOT NULL with no database
// default, so every ORM insert path must supply a value.
describe('organization_members insert defaults', () => {
  it('supplies exempt_from_per_capita from the ORM when an insert omits it', () => {
    const column = getTableConfig(organizationMembers).columns.find(
      (c) => c.name === 'exempt_from_per_capita',
    )
    expect(column?.defaultFn?.()).toBe(false)
  })
})
