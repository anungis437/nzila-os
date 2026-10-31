import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLAUSE_SHARING_LEVELS, assertMayPublish, parseClauseBody } from '../clause-body'
import { SHARING_LEVELS } from '../sharing-authority'

const valid = { clauseTitle: 'Overtime', clauseText: 'Overtime is paid at double time.', clauseType: 'wages' }

describe('B44/B45 clause body (DEF-0B4-CLAUSE-LIBRARY-BODY-FIELDS-UNVALIDATED)', () => {
  it('accepts a complete clause and drops fields the route does not own', () => {
    const parsed = parseClauseBody({ ...valid, province: 'ON', effectiveDate: '2024-01-31', sourceOrganizationId: 'attacker' }, 'create')
    expect(parsed).toMatchObject({ province: 'ON', effectiveDate: '2024-01-31' })
    expect(parsed).not.toHaveProperty('sourceOrganizationId')
  })

  it.each([
    ['missing title', { clauseText: 'x', clauseType: 'wages' }],
    ['text over 100000 characters', { ...valid, clauseText: 'x'.repeat(100_001) }],
    ['a date that is not a calendar day', { ...valid, effectiveDate: '2024-02-31x' }],
    ['a province that is not a code', { ...valid, province: 'Ontario' }],
    ['a source agreement that is not an id', { ...valid, sourceCbaId: 'cba-1' }],
    ['an original clause that is not an id', { ...valid, originalClauseId: 'not-an-id' }],
    ['an unknown sharing level', { ...valid, sharingLevel: 'everyone' }],
    ['a grant list over 200 organizations', { ...valid, sharedWithOrgIds: Array.from({ length: 201 }, () => '00000000-0000-4000-8000-000000000001') }],
    ['a body that is not an object', 'text'],
    ['no body', null],
  ])('refuses %s', (_name, body) => {
    expect(() => parseClauseBody(body, 'create')).toThrow(/Invalid clause/)
  })

  it('treats an update as partial and a share as only its four sharing fields', () => {
    expect(parseClauseBody({ clauseTitle: 'New' }, 'update')).toEqual({ clauseTitle: 'New' })
    expect(parseClauseBody({ sharingLevel: 'private', clauseText: 'ignored' }, 'share')).toEqual({ sharingLevel: 'private' })
  })

  it('keeps its sharing levels identical to the authority', () => {
    expect([...CLAUSE_SHARING_LEVELS]).toEqual([...SHARING_LEVELS])
  })
})

describe('B45 public publishing is an officer decision (DEF-0B4-CLAUSE-LIBRARY-PUBLISHING-ON-STEWARD-ROLE-TITLE)', () => {
  it('refuses a steward, an unresolved role and a member', () => {
    for (const role of ['steward', 'member', undefined, null]) expect(() => assertMayPublish(role, 'public')).toThrow(/officer/)
  })

  it('allows an officer, and does not apply to narrower sharing', () => {
    expect(() => assertMayPublish('officer', 'public')).not.toThrow()
    expect(() => assertMayPublish('steward', 'federation')).not.toThrow()
    expect(() => assertMayPublish(undefined, undefined)).not.toThrow()
  })
})

describe('B45 clause library routes', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('parses and gates the create, update and share bodies, and checks the cited original clause', () => {
    const create = read('app/api/clause-library/route.ts')
    expect(create).toContain("parseClauseBody(await request.json().catch(() => null), 'create')")
    expect(create).toContain('assertMayPublish(user?.role, body.sharingLevel)')
    expect(create).toContain('assertOriginalClauseOwned(tx, body.originalClauseId, organizationId)')
    expect(read('app/api/clause-library/[id]/route.ts')).toContain("parseClauseBody(await request.json().catch(() => null), 'update')")
    expect(read('app/api/clause-library/[id]/share/route.ts')).toContain("parseClauseBody(await request.json().catch(() => null), 'share')")
  })

  it('does not write usage counters on rows another organization owns', () => {
    const compare = read('app/api/clause-library/compare/route.ts')
    expect(compare).toContain('row.sourceOrganizationId === organizationId')
    expect(compare).not.toContain('for (const authorized of authorizedRows) {')
  })

  it('looks up the original clause through an agreement of the caller organization', () => {
    const source = read('lib/clause-library/original-clause.ts')
    expect(source).toContain('eq(collectiveAgreements.organizationId, organizationId)')
  })
})
