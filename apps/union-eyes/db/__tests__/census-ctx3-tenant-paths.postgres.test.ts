/**
 * The tenant-role paths the tenant-context census (CTX-3) corrected or promoted, as the real runtime role.
 *
 * Each statement below ran in a tenant transaction (`union_eyes_runtime`) while the storage-authority manifest granted that role less than the statement does (a table
 * classified LATENT with no privilege, an UPDATE or a SELECT that the declaration omitted), so on a real deployment it was refused ("permission denied") or, for a table with no
 * row-level security, was never isolated. The unit tests replace the database and CI connects as a superuser, so neither noticed. This runs the unmodified functions and route
 * handlers over the combined Django + Drizzle schema, with only the request boundary, the authorization grant and the audit sink replaced, and proves that
 *   - job_classifications (promoted from LATENT: the administrator members page creates, lists and updates classifications) works as the runtime role, is isolated per
 *     organization by its row-level security, and no role can delete a row;
 *   - committee_memberships (promoted: the committee workspace reads the caller's own active membership to let a member read a committee) is visible only through its
 *     committee's organization, and the runtime role can read it and nothing else;
 *   - integration_sync_logs remains tenant-readable for legacy synchronization history, while the compatibility delete surface delegates to the canonical, versioned
 *     integration control plane and deactivates a configuration without erasing either its configuration or version history;
 *   - the steward routes that complete a training registration and record attendance (course_registrations UPDATE, and the SELECT ... FOR UPDATE before it) run as the
 *     runtime role, inside the caller's organization only;
 *   - a signature profile is replaced (user_signatures UPDATE of the previous default, then the insert) and a clause comparison is stored with its RETURNING read
 *     (clause_comparisons SELECT), and an employer's previous primary contact is demoted (employer_contacts UPDATE), each in the caller's organization;
 *   - the revocation report counts a member's live case relationships in the organization's tenant transaction, a read the system role is refused.
 *
 * Needs UE_AUTHORITY_COMBINED_URL (an ADMIN connection to a disposable, fully bootstrapped database); it fails, it does not skip, without it.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertMember, insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const audits = vi.hoisted(() => ({ employment: [] as Array<Record<string, any>> }))

vi.mock('@/db/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
// The marker module throws outside a server bundle: nothing here is a server bundle.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-savepoint-harness')).contextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-savepoint-harness')).recordAudit }))
// The wrapper's observable contract for a handler: it runs with the context the request resolved; a route here opens its own tenant transaction.
vi.mock('@/lib/api/with-api', () => ({
  withApi: (_config: unknown, handler: (ctx: unknown) => Promise<unknown>) => async (ctx: unknown) => handler(ctx),
}))
// The employment grant is issued from the session (auth()), and its durable audit is the hash-chain writer: both are boundaries here.
vi.mock('@/lib/member-employment/authorize-employment-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/member-employment/authorize-employment-access')>()),
  assertRegisteredEmploymentGrant: () => undefined,
}))
vi.mock('@/lib/member-employment/durable-employment-audit', () => ({
  persistDurableEmploymentAudit: async (_tx: unknown, entry: Record<string, any>) => {
    audits.employment.push(entry)
  },
}))

const { savepointHarness, RUNTIME_ROLE, SYSTEM_ROLE } = await import('./native-savepoint-harness')
const employment = await import('@/db/queries/member-employment-queries')
const committeeAccess = await import('@/lib/services/committee-read-access')
const extensions = await import('@/app/api/extensions/[id]/route')
const completions = await import('@/app/api/education/completions/route')
const attendance = await import('@/app/api/education/sessions/[id]/attendance/route')
const correspondence = await import('@/lib/services/correspondence-service')
const clauses = await import('@/lib/services/clause-service')
const { employerContacts } = await import('@/db/schema/domains/communications/employer-communications')

type Row = Record<string, any>
type Handler = (ctx: unknown) => Promise<unknown>

describe.skipIf(!URL)('the promoted and corrected tenant paths, as the real runtime role', () => {
  const tag = `tp${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const ADMIN_A = `admin-a-${tag}`
  const ADMIN_B = `admin-b-${tag}`
  let admin: pg.Client

  const rows = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows as Row[]
  const inRuntime = <T>(organizationId: string, userId: string, work: (tx: { execute: (query: unknown) => Promise<unknown> }) => Promise<T>) =>
    savepointHarness.context(RUNTIME_ROLE, organizationId, userId, work as never) as Promise<T>
  const count = async (organizationId: string, table: string) =>
    Number(((await inRuntime(organizationId, ADMIN_A, (tx) => tx.execute(sql.raw(`SELECT count(*)::int AS n FROM ${table}`)))) as Row[])[0].n)
  const codeOf = async (work: Promise<unknown>) => {
    const failure = await work.then(() => null, (error: unknown) => error as { code?: string; cause?: { code?: string } })
    return failure?.cause?.code ?? failure?.code ?? null
  }
  const privilege = async (role: string, table: string) =>
    Object.fromEntries(
      await Promise.all(['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map(async (operation) => [operation, (await rows(`SELECT has_table_privilege($1, $2, $3) AS held`, [role, `public.${table}`, operation]))[0].held])),
    )

  beforeAll(async () => {
    if (!URL) throw new Error('UE_AUTHORITY_COMBINED_URL is required: this proof runs on a native PostgreSQL database')
    admin = await savepointHarness.start(URL)
    await insertOrganization(admin, tag, { id: ORG_A, name: `Alpha Union ${tag}` })
    await insertOrganization(admin, tag, { id: ORG_B, name: `Beta Union ${tag}` })
  }, 180_000)

  afterAll(async () => {
    await admin?.end()
    await savepointHarness.stop()
  })

  describe('job_classifications (the administrator members page)', () => {
    const scope = (organizationId: string, userId: string) => ({ organizationId, userId, capability: 'administer' }) as never
    let created: Row

    it('creates, lists and updates a classification in the organization, with RETURNING, as the runtime role', async () => {
      created = (await employment.createJobClassification(scope(ORG_A, ADMIN_A), { organizationId: ORG_A, jobTitle: 'Welder', jobCode: `W-${tag}` } as never)) as unknown as Row

      expect(created).toMatchObject({ organizationId: ORG_A, jobTitle: 'Welder', jobCode: `W-${tag}`, createdBy: ADMIN_A })
      expect((await employment.getJobClassificationsByOrganization(scope(ORG_A, ADMIN_A))).map((entry) => entry.id)).toEqual([created.id])
      const updated = await employment.updateJobClassification(scope(ORG_A, ADMIN_A), created.id, { jobTitle: 'Lead welder' } as never)
      expect(updated).toMatchObject({ id: created.id, jobTitle: 'Lead welder', organizationId: ORG_A })
      expect(audits.employment.map((entry) => entry.operation)).toEqual(['classification_create', 'classification_update'])
    })

    it('shows another organization none of it and lets it change none of it', async () => {
      expect(await employment.getJobClassificationsByOrganization(scope(ORG_B, ADMIN_B), false)).toEqual([])
      await expect(employment.updateJobClassification(scope(ORG_B, ADMIN_B), created.id, { jobTitle: 'Stolen' } as never)).rejects.toThrow(/not found/i)
      expect((await rows(`SELECT job_title FROM job_classifications WHERE id = $1`, [created.id]))[0].job_title).toBe('Lead welder')
      expect(await count(ORG_B, 'job_classifications')).toBe(0)
    })

    it('grants the runtime role select, insert and update and no delete, and the system role nothing', async () => {
      expect(await privilege(RUNTIME_ROLE, 'job_classifications')).toEqual({ SELECT: true, INSERT: true, UPDATE: true, DELETE: false })
      expect(await privilege(SYSTEM_ROLE, 'job_classifications')).toEqual({ SELECT: false, INSERT: false, UPDATE: false, DELETE: false })
    })
  })

  describe('committee_memberships (the committee workspace)', () => {
    const MEMBER = `committee-member-${tag}`
    const OUTSIDER = `committee-outsider-${tag}`
    const STEWARD = `committee-steward-${tag}`
    let committee: string
    let otherCommittee: string

    beforeAll(async () => {
      for (const [user, role] of [[MEMBER, 'member'], [OUTSIDER, 'member'], [STEWARD, 'steward']] as const) await insertMember(admin, ORG_A, { userId: user, role })
      await insertMember(admin, ORG_B, { userId: ADMIN_B, role: 'admin' })
      const make = async (org: string, name: string) =>
        (await rows(`INSERT INTO committees (organization_id, name, committee_type) VALUES ($1, $2, 'bargaining') RETURNING id::text AS id`, [org, name]))[0].id as string
      committee = await make(ORG_A, `Committee A ${tag}`)
      otherCommittee = await make(ORG_B, `Committee B ${tag}`)
      await admin.query(`INSERT INTO committee_memberships (committee_id, member_id, start_date) VALUES ($1, $2, current_date), ($3, $4, current_date)`, [committee, MEMBER, otherCommittee, ADMIN_B])
    })

    const read = (organizationId: string, committeeId: string, userId: string) =>
      inRuntime(organizationId, userId, () => committeeAccess.requireCommitteeReader(organizationId, committeeId, userId))

    it('lets an active member of the committee read it, as the runtime role', async () => {
      await expect(read(ORG_A, committee, MEMBER)).resolves.toBeUndefined()
    })

    it('answers a member who is not on the committee as for a committee that does not exist, and lets staff read it without a membership', async () => {
      await expect(read(ORG_A, committee, OUTSIDER)).rejects.toMatchObject({ message: expect.stringMatching(/committee/i) })
      await expect(read(ORG_A, committee, STEWARD)).resolves.toBeUndefined()
    })

    it('shows a membership only through its committee\'s organization', async () => {
      expect(await count(ORG_A, 'committee_memberships')).toBe(1)
      expect(await count(ORG_B, 'committee_memberships')).toBe(1)
      // The organization of the context decides: the other organization's membership row is not there to match, whoever asks.
      await expect(read(ORG_B, committee, MEMBER)).rejects.toMatchObject({ message: expect.stringMatching(/committee/i) })
    })

    it('grants the runtime role a read and nothing else, and the system role nothing', async () => {
      expect(await privilege(RUNTIME_ROLE, 'committee_memberships')).toEqual({ SELECT: true, INSERT: false, UPDATE: false, DELETE: false })
      expect(await privilege(SYSTEM_ROLE, 'committee_memberships')).toEqual({ SELECT: false, INSERT: false, UPDATE: false, DELETE: false })
      expect(await codeOf(inRuntime(ORG_A, MEMBER, (tx) => tx.execute(sql.raw(`DELETE FROM committee_memberships`))))).toBe('42501')
    })
  })

  describe('the canonical integration compatibility delete and legacy sync-history read', () => {
    let first: string
    let second: string
    let legacyHistory: string

    beforeAll(async () => {
      const integration = async (org: string) => {
        const id = (await rows(`INSERT INTO integration_configs (organization_id, type, provider, credentials, settings, enabled, active_version) VALUES ($1, 'hris', 'bamboohr', '{}'::jsonb, '{}'::jsonb, true, 1) RETURNING id::text AS id`, [org]))[0].id as string
        await admin.query(`INSERT INTO integration_config_versions (integration_id, organization_id, version, type, provider, settings, enabled, created_by) VALUES ($1,$2,1,'hris','bamboohr','{}'::jsonb,true,'seed')`, [id, org])
        return id
      }
      first = await integration(ORG_A)
      second = await integration(ORG_A)
      legacyHistory = (await rows(`INSERT INTO api_integrations (organization_id, name, integration_type, connection_type, created_by, field_mapping) VALUES ($1, $2, 'hris', 'api', 'seed', '{}'::jsonb) RETURNING id::text AS id`, [ORG_A, `Legacy history ${tag}`]))[0].id as string
      await admin.query(`INSERT INTO integration_sync_logs (integration_id, sync_type, direction, status) VALUES ($1, 'manual', 'inbound', 'success')`, [legacyHistory])
    })

    const remove = (organizationId: string, userId: string, id: string) => (extensions.DELETE as unknown as Handler)({ params: { id }, organizationId, userId })

    it('deactivates rather than erases a canonical integration and preserves its version history', async () => {
      await remove(ORG_A, ADMIN_A, first)

      expect(await rows(`SELECT enabled, active_version FROM integration_configs WHERE id = $1`, [first])).toEqual([{ enabled: false, active_version: 2 }])
      expect(await rows(`SELECT version, enabled FROM integration_config_versions WHERE integration_id = $1 ORDER BY version`, [first])).toEqual([{ version: 1, enabled: true }, { version: 2, enabled: false }])
    })

    it('applies the same non-destructive compatibility behavior to another configuration', async () => {
      await remove(ORG_A, ADMIN_A, second)

      expect(await rows(`SELECT enabled FROM integration_configs WHERE id = $1`, [second])).toEqual([{ enabled: false }])
    })

    it('shows legacy history only through its integration\'s organization, and another organization cannot deactivate the canonical integration', async () => {
      expect(await count(ORG_A, 'integration_sync_logs')).toBe(1)
      expect(await count(ORG_B, 'integration_sync_logs')).toBe(0)
      await expect(remove(ORG_B, ADMIN_B, first)).rejects.toMatchObject({ message: expect.stringMatching(/integration/i) })
    })

    it('grants the runtime role a read and nothing else, and the system role nothing', async () => {
      expect(await privilege(RUNTIME_ROLE, 'integration_sync_logs')).toEqual({ SELECT: true, INSERT: false, UPDATE: false, DELETE: false })
      expect(await privilege(SYSTEM_ROLE, 'integration_sync_logs')).toEqual({ SELECT: false, INSERT: false, UPDATE: false, DELETE: false })
    })
  })

  describe('the steward education routes (course_registrations UPDATE)', () => {
    const STEWARD = `edu-steward-${tag}`
    let session: string
    const registration = async (organizationId: string, member: string, flags: { attended: boolean; passed: boolean | null }) => {
      const course = (await rows(`INSERT INTO training_courses (organization_id, course_code, course_name, course_category, delivery_method, is_active, is_mandatory, duration_hours) VALUES ($1, $2, $3, 'safety', 'online', true, false, 4) RETURNING id::text AS id`, [organizationId, `C-${randomUUID().slice(0, 6)}`, `Course ${tag}`]))[0].id
      const sessionId = (await rows(`INSERT INTO course_sessions (organization_id, course_id, session_code, start_date, end_date, delivery_method) VALUES ($1, $2, $3, current_date, current_date, 'online') RETURNING id::text AS id`, [organizationId, course, `S-${randomUUID().slice(0, 6)}`]))[0].id
      const id = (await rows(`INSERT INTO course_registrations (organization_id, member_id, course_id, session_id, attended, passed) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text AS id`, [organizationId, member, course, sessionId, flags.attended, flags.passed]))[0].id
      return { id: id as string, session: sessionId as string }
    }

    it('completes an attended, passed registration as the runtime role, with the SELECT ... FOR UPDATE before the UPDATE', async () => {
      const passed = await registration(ORG_A, `learner-1-${tag}`, { attended: true, passed: true })

      const result = (await (completions.POST as unknown as Handler)({ organizationId: ORG_A, userId: STEWARD, body: { registrationId: passed.id } })) as { data: Row }

      expect(result.data).toEqual({ id: passed.id, completed: true })
      expect(await rows(`SELECT completed, registration_status, completion_percentage::text AS pct FROM course_registrations WHERE id = $1`, [passed.id])).toEqual([{ completed: true, registration_status: 'completed', pct: '100.00' }])
    })

    it('refuses a registration without the evidence, and a registration of another organization', async () => {
      const failed = await registration(ORG_A, `learner-2-${tag}`, { attended: true, passed: false })
      await expect((completions.POST as unknown as Handler)({ organizationId: ORG_A, userId: STEWARD, body: { registrationId: failed.id } })).rejects.toMatchObject({ message: expect.stringMatching(/evidence/i) })
      await expect((completions.POST as unknown as Handler)({ organizationId: ORG_B, userId: ADMIN_B, body: { registrationId: failed.id } })).rejects.toMatchObject({ message: expect.stringMatching(/not found/i) })
      expect(await rows(`SELECT completed FROM course_registrations WHERE id = $1`, [failed.id])).toEqual([{ completed: false }])
    })

    it('records the attendance of a registration in its session, and nothing in another organization', async () => {
      const open = await registration(ORG_A, `learner-3-${tag}`, { attended: false, passed: null })
      session = open.session

      const result = (await (attendance.PATCH as unknown as Handler)({ organizationId: ORG_A, userId: STEWARD, params: { id: session }, body: { registrationId: open.id, attended: true, attendanceHours: 3 } })) as { data: Row }

      expect(result.data).toEqual({ id: open.id, attended: true })
      expect(await rows(`SELECT attended, attendance_hours::text AS hours FROM course_registrations WHERE id = $1`, [open.id])).toEqual([{ attended: true, hours: '3.00' }])
      await expect((attendance.PATCH as unknown as Handler)({ organizationId: ORG_B, userId: ADMIN_B, params: { id: session }, body: { registrationId: open.id, attended: false } })).rejects.toMatchObject({ message: expect.stringMatching(/not found/i) })
    })

    it('grants the runtime role select, insert and update and no delete', async () => {
      expect(await privilege(RUNTIME_ROLE, 'course_registrations')).toEqual({ SELECT: true, INSERT: true, UPDATE: true, DELETE: false })
    })
  })

  describe('the statements the declarations omitted a privilege for', () => {
    it('counts the live case relationships of a member in the organization\'s tenant transaction, which the system role cannot read (the revocation report)', async () => {
      const count = (role: string) =>
        savepointHarness.context(role, ORG_A, ADMIN_A, (tx) =>
          tx.execute(sql`
            SELECT count(*)::int AS n FROM ue_authority_resource_relationships
             WHERE organization_id = ${ORG_A}::uuid AND principal_user_id = ${ADMIN_A}
               AND resource_type = 'case' AND status = 'active' AND revoked_at IS NULL
               AND (expires_at IS NULL OR expires_at > now())`),
        ) as Promise<Row[]>

      expect(await count(RUNTIME_ROLE)).toEqual([{ n: 0 }])
      expect(await codeOf(count(SYSTEM_ROLE))).toBe('42501')
    })

    it('replaces a signature profile: the previous default is deactivated (user_signatures UPDATE) and the new one is returned', async () => {
      // user_signatures.user_id references the person's profile.
      await admin.query(`INSERT INTO profiles (user_id) VALUES ($1)`, [ADMIN_A])
      const save = (displayName: string) =>
        correspondence.saveUserSignature({ organizationId: ORG_A, userId: ADMIN_A, displayName, source: 'typed', imageUrl: 'https://example.test/s.png', imageHash: `hash-${displayName}` } as never)

      await save('First')
      const second = (await save('Second')) as unknown as Row

      expect(second).toMatchObject({ displayName: 'Second', isDefault: true })
      expect(await rows(`SELECT display_name, is_default FROM user_signatures WHERE user_id = $1 ORDER BY display_name`, [ADMIN_A])).toEqual([
        { display_name: 'First', is_default: false },
        { display_name: 'Second', is_default: true },
      ])
      expect(await privilege(RUNTIME_ROLE, 'user_signatures')).toMatchObject({ SELECT: true, INSERT: true, UPDATE: true })
    })

    it('stores a clause comparison and reads it back with RETURNING (clause_comparisons SELECT) in the caller\'s organization', async () => {
      const stored = (await inRuntime(ORG_A, ADMIN_A, () => clauses.saveClauseComparison(`Wages ${tag}`, 'wages_compensation', [randomUUID(), randomUUID()], ORG_A, ADMIN_A))) as unknown as Row

      expect(stored).toMatchObject({ comparisonName: `Wages ${tag}`, organizationId: ORG_A, createdBy: ADMIN_A })
      expect(await count(ORG_B, 'clause_comparisons')).toBe(0)
      expect(await privilege(RUNTIME_ROLE, 'clause_comparisons')).toMatchObject({ SELECT: true, INSERT: true })
    })

    it('demotes the previous primary contact of an employer before naming a new one (employer_contacts UPDATE)', async () => {
      const EMPLOYER = randomUUID()

      await inRuntime(ORG_A, ADMIN_A, async () => {
        const { db } = await import('@/db/db')
        await db.insert(employerContacts).values({ organizationId: ORG_A, employerId: EMPLOYER, name: 'First primary', role: 'main', isPrimary: true, createdBy: ADMIN_A })
        await db.update(employerContacts).set({ isPrimary: false, updatedAt: new Date() }).where(and(eq(employerContacts.organizationId, ORG_A), eq(employerContacts.employerId, EMPLOYER), eq(employerContacts.isPrimary, true)))
        await db.insert(employerContacts).values({ organizationId: ORG_A, employerId: EMPLOYER, name: 'Second primary', role: 'hr', isPrimary: true, createdBy: ADMIN_A })
      })

      expect(await rows(`SELECT name, is_primary FROM employer_contacts WHERE employer_id = $1 ORDER BY name`, [EMPLOYER])).toEqual([
        { name: 'First primary', is_primary: false },
        { name: 'Second primary', is_primary: true },
      ])
      expect(await count(ORG_B, 'employer_contacts')).toBe(0)
      expect(await privilege(RUNTIME_ROLE, 'employer_contacts')).toMatchObject({ SELECT: true, INSERT: true, UPDATE: true })
    })
  })
})
