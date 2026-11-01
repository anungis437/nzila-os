import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }))
vi.mock('@/db/schema', () => ({ pilotChecklistItems: {}, pilotEvents: {} }))
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: {}, organizations: {} }))
vi.mock('@/db/schema/domains/claims/grievances', () => ({ grievances: {} }))
vi.mock('@/db/schema/domains/pilot/pilot-fixture-rows', () => ({ pilotFixtureRows: {} }))

import {
  FixtureUnavailableError,
  cupeFixtureSchema,
  fixtureSlug,
  grievancePriorityFor,
  grievanceStatusFor,
  grievanceTypeFor,
  loadCupeFixture,
} from '../fixture-bootstrap'

const valid = () => ({
  org: { name: 'CUPE Local', slug: 'cupe-local-123' },
  members: [{ id: 'u1', first_name: 'Ada', last_name: 'One', email: 'ada@example.org', role: 'member', member_number: 'M-1' }],
  cases: [{ number: 'G-1', case_type: 'wage_dispute', status: 'filed', title: 'Case', description: 'Description', filed_by: 'u1' }],
  worksites: [{ id: 'w1' }],
})

describe('the fixture file is validated before anything is written', () => {
  it('accepts the shipped CUPE fixture, found from the application directory or the repository root', async () => {
    const fixture = await loadCupeFixture()

    expect(fixtureSlug(fixture)).toBe('cupe-local-123')
    expect(fixture.members.length).toBeGreaterThan(0)
    expect(fixture.cases.length).toBeGreaterThan(0)
  })

  it('rejects a duplicated member id or case number, which would otherwise be seeded once and counted twice', () => {
    const duplicateMember = valid()
    duplicateMember.members.push({ ...duplicateMember.members[0] })
    const duplicateCase = valid()
    duplicateCase.cases.push({ ...duplicateCase.cases[0] })

    expect(cupeFixtureSchema.safeParse(duplicateMember).success).toBe(false)
    expect(cupeFixtureSchema.safeParse(duplicateCase).success).toBe(false)
  })

  it.each([
    ['an unusable slug', (f: ReturnType<typeof valid>) => ({ ...f, org: { ...f.org, slug: 'Has Spaces!' } })],
    ['an invalid e-mail address', (f: ReturnType<typeof valid>) => ({ ...f, members: [{ ...f.members[0], email: 'not-an-address' }] })],
    ['a case with no title', (f: ReturnType<typeof valid>) => ({ ...f, cases: [{ ...f.cases[0], title: '' }] })],
    ['a filing date that is not a date', (f: ReturnType<typeof valid>) => ({ ...f, cases: [{ ...f.cases[0], filed_at: 'soon' }] })],
    ['no organization name', (f: ReturnType<typeof valid>) => ({ ...f, org: { slug: f.org.slug } })],
  ])('rejects %s', (_label, mutate) => {
    expect(cupeFixtureSchema.safeParse(mutate(valid())).success).toBe(false)
  })

  it('falls back to the default slug when the file names none', () => {
    const parsed = cupeFixtureSchema.parse({ ...valid(), org: { name: 'CUPE Local' } })

    expect(fixtureSlug(parsed)).toBe('cupe-local-123')
  })
})

describe('loadCupeFixture', () => {
  const roots: string[] = []
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  })
  const rootWith = (content?: string) => {
    const root = mkdtempSync(join(tmpdir(), 'cupe-fixture-'))
    roots.push(root)
    if (content !== undefined) {
      mkdirSync(join(root, 'fixtures', 'cupe', 'pilot-org'), { recursive: true })
      writeFileSync(join(root, 'fixtures', 'cupe', 'pilot-org', 'cupe-pilot-setup.json'), content)
    }
    return root
  }

  it('says so when the file is absent, instead of seeding nothing', async () => {
    await expect(loadCupeFixture(rootWith())).rejects.toBeInstanceOf(FixtureUnavailableError)
  })

  it('says so when the file is not JSON', async () => {
    await expect(loadCupeFixture(rootWith('{ not json'))).rejects.toThrow('could not be read as JSON')
  })

  it('says why when the file is JSON but not a valid fixture, naming the first problem', async () => {
    await expect(loadCupeFixture(rootWith(JSON.stringify({ ...valid(), members: [{ id: 'u1' }] })))).rejects.toThrow('not valid')
  })

  it('loads a valid file from the directory it is given', async () => {
    const fixture = await loadCupeFixture(rootWith(JSON.stringify(valid())))

    expect(fixture.members).toHaveLength(1)
  })
})

describe('the fixture vocabulary maps onto the grievance enums, and anything unknown stays conservative', () => {
  it.each([
    ['wage_dispute', 'contract'],
    ['benefits_denial', 'contract'],
    ['harassment', 'harassment'],
    ['discipline', 'discipline'],
    ['something_new', 'other'],
  ])('case type %s becomes %s', (caseType, expected) => {
    expect(grievanceTypeFor(caseType)).toBe(expected)
  })

  it.each([
    ['settled', 'settled'],
    ['investigating', 'investigating'],
    ['acknowledged', 'acknowledged'],
    ['filed', 'filed'],
    ['anything_else', 'filed'],
  ])('status %s becomes %s', (status, expected) => {
    expect(grievanceStatusFor(status)).toBe(expected)
  })

  it.each([
    ['urgent', 'urgent'],
    ['low', 'low'],
    ['critical', 'medium'],
    [undefined, 'medium'],
  ])('priority %s becomes %s', (priority, expected) => {
    expect(grievancePriorityFor(priority)).toBe(expected)
  })
})
