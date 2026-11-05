/**
 * The exit interview page's read (lib/knowledge-transfer/governance/read-interview.ts) on real PostgreSQL, as the real roles.
 *
 * The page read the row through the module-level handle with no organization set, so the runtime role saw nothing (every interview "not found"),
 * and, had it seen the row, it showed every field of every interview to anyone signed in. This runs the unmodified function, with only the context
 * boundary replaced by the harness's (a tenant transaction with app.current_org_id set), and proves that
 *   - an interview is read only inside its own organization, and an id from another organization or one that is not a uuid is "not found";
 *   - the interview's sensitivity floor, its consent flag and its workflow state decide who reads it, exactly as the API route decides;
 *   - a reader below steward receives the content and not the workflow fields (the retiring employee's name, who created it), the author and a steward receive the row;
 *   - the same select with no organization set (the old page behaviour) finds nothing.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const reading = URL ? await import('@/lib/knowledge-transfer/governance/read-interview') : null
const schema = URL ? await import('@/db/schema')  : null

const RANK: Record<string, number> = { member: 20, steward: 50, officer: 80, admin: 140 }

describe.skipIf(!URL)('the exit interview page read on the combined schema, as the real roles', () => {
  const tag = `ei${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const owner = `owner-${tag}`
  const reader = `reader-${tag}`
  const ids = { shared: '', notShared: '', draft: '', legal: '', other: '' }
  let admin: pg.Client

  const interview = async (organizationId: string, name: string, extra: { status: string; consent: boolean; level: string; createdBy: string }) =>
    (
      await admin.query(
        `INSERT INTO exit_interviews (organization_id, retiring_employee_name, role_in_union, title, key_lessons, summary, created_by, status, consent_granted, sensitivity_level, years_of_service)
         VALUES ($1, $2, 'steward', $3, 'lessons', 'summary', $4, $5, $6, $7, 12) RETURNING id::text AS id`,
        [organizationId, `Retiree ${name} ${tag}`, `Title ${name}`, extra.createdBy, extra.status, extra.consent, extra.level],
      )
    ).rows[0].id as string

  const read = (role: keyof typeof RANK, userId: string, organizationId: string, interviewId: string) =>
    reading!.readExitInterview({
      organizationId,
      userId,
      interviewId,
      stewardPlus: RANK[role] >= RANK.steward,
      hasMinRole: async (minimum) => RANK[role] >= RANK[minimum],
    })

  beforeAll(async () => {
    admin = await harness.start(URL!)
    await insertOrganization(admin, tag, { id: ORG_A })
    await insertOrganization(admin, tag, { id: ORG_B })
    ids.shared = await interview(ORG_A, 'shared', { status: 'published', consent: true, level: 'public_internal', createdBy: owner })
    ids.notShared = await interview(ORG_A, 'not-shared', { status: 'published', consent: false, level: 'public_internal', createdBy: owner })
    ids.draft = await interview(ORG_A, 'draft', { status: 'draft', consent: false, level: 'public_internal', createdBy: owner })
    ids.legal = await interview(ORG_A, 'legal', { status: 'published', consent: true, level: 'legal_sensitive', createdBy: owner })
    ids.other = await interview(ORG_B, 'other', { status: 'published', consent: true, level: 'public_internal', createdBy: owner })
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  it('gives a member the content of a shared published interview and not the workflow around it', async () => {
    const seen = await read('member', reader, ORG_A, ids.shared)
    expect(seen).toMatchObject({ id: ids.shared, title: 'Title shared', summary: 'summary', keyLessons: 'lessons', roleInUnion: 'steward', yearsOfService: 12 })
    expect(seen).not.toHaveProperty('retiringEmployeeName')
    expect(seen).not.toHaveProperty('createdBy')
  })

  it('gives a steward and the author the whole row', async () => {
    expect(await read('steward', reader, ORG_A, ids.shared)).toMatchObject({ retiringEmployeeName: `Retiree shared ${tag}`, createdBy: owner })
    expect(await read('member', owner, ORG_A, ids.draft)).toMatchObject({ retiringEmployeeName: `Retiree draft ${tag}`, status: 'draft' })
  })

  it('does not find, for a member, an interview that was not shared, a draft they did not write, or one above their office', async () => {
    expect(await read('member', reader, ORG_A, ids.notShared)).toBeNull()
    expect(await read('member', reader, ORG_A, ids.draft)).toBeNull()
    expect(await read('member', reader, ORG_A, ids.legal)).toBeNull()
  })

  it('lets a steward read what was not shared and a draft, but not what needs an administrator, which an administrator reads', async () => {
    expect(await read('steward', reader, ORG_A, ids.notShared)).toMatchObject({ id: ids.notShared })
    expect(await read('steward', reader, ORG_A, ids.draft)).toMatchObject({ id: ids.draft })
    expect(await read('steward', reader, ORG_A, ids.legal)).toBeNull()
    expect(await read('admin', reader, ORG_A, ids.legal)).toMatchObject({ id: ids.legal })
  })

  it('does not find another organization\'s interview, an unknown one, or an id that is not a uuid', async () => {
    expect(await read('admin', reader, ORG_A, ids.other)).toBeNull()
    expect(await read('admin', reader, ORG_B, ids.shared)).toBeNull()
    expect(await read('admin', reader, ORG_B, ids.other)).toMatchObject({ id: ids.other })
    expect(await read('admin', reader, ORG_A, randomUUID())).toBeNull()
    expect(await read('admin', reader, ORG_A, 'not-a-uuid')).toBeNull()
  })

  it('control: the same table read with no organization set shows the runtime role nothing, which is why the page read needs its context', async () => {
    expect(await harness.tenant(RUNTIME_ROLE, null, reader, (tx) => tx.select().from(schema!.exitInterviews))).toEqual([])
  })
})
