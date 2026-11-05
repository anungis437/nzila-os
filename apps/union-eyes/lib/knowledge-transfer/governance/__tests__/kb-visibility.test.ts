import { describe, expect, it } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { knowledgeBaseOrganizationCondition } from '../kb-visibility'

const dialect = new PgDialect()
const render = (parent: string | undefined) => dialect.sqlToQuery(knowledgeBaseOrganizationCondition('org-own', parent))

describe('knowledgeBaseOrganizationCondition', () => {
  it('without a parent admits only the reader\'s own rows', () => {
    const { sql, params } = render(undefined)
    expect(sql).not.toContain('is_public')
    expect(params).toEqual(['org-own'])
  })

  it('admits a parent row only when it is public or names the reader', () => {
    const { sql, params } = render('org-parent')
    expect(sql).toContain('"is_public"')
    expect(sql).toContain('"allowed_organizations" @>')
    expect(params).toContain('org-parent')
    expect(params).toContain('["org-own"]')
  })
})
