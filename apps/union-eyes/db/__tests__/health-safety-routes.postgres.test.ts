/**
 * The CNESST and WCB generic routes on real PostgreSQL, as the real roles.
 *
 * Platform 0061 and cache 0052 gave the seven tables behind /api/cnesst/* and /api/wcb/assessments* a physical relation; until then every one of
 * these routes answered with an undefined-relation fault. This runs the unmodified collection and item routes (the CRUD factory over the Drizzle
 * declarations) against the combined Django + Drizzle schema, so what they send is what PostgreSQL receives. Only the request boundary is replaced
 * (see native-route-harness.ts): each statement runs as union_eyes_runtime inside a tenant transaction, as it does for a signed-in caller.
 *
 * Over two organizations it proves, for every route family, that
 *   - a create is owned by the caller's organization and attributed to the caller, and a body cannot assign the organization or the creator;
 *   - a list, a read, an update and a delete reach the caller's organization's rows and nobody else's, and another organization's row is not found
 *     and is left unchanged;
 *   - a delete follows the table's governance (retained, governed lifecycle, archive or removal) and writes nothing it should not;
 *   - each write is audited by field name, never by value, and an audit that fails takes the write with it;
 *   - what a client can get wrong (a missing required field, a value outside an enum, a malformed uuid, date or timestamp) is a client error, and a
 *     well-formed ISO date and timestamp are stored as sent.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api/with-api', async () => ({ withApi: (await import('./native-route-harness')).emulatedWithApi }))
vi.mock('@/lib/organization-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/organization-utils')>()),
  getUserRoleInOrganization: (await import('./native-route-harness')).roleInOrganization,
}))

const { harness } = await import('./native-route-harness')
const schema = URL ? await import('@/db/schema') : null
const { supportsGenericArchive } = await import('@/lib/api/crud-governance')
const { ApiError, ErrorCode } = await import('@/lib/api/errors')

type Row = Record<string, unknown>
type One = (ctx: unknown) => Promise<{ data: Row }>
type Many = (ctx: unknown) => Promise<{ data: Row[]; pagination?: { total: number } }>
type Collection = { GET: Many; POST: One }
type Item = { GET: One; PATCH: One; DELETE: One }

const routes = URL
  ? {
      filings: [await import('@/app/api/cnesst/filings/route'), await import('@/app/api/cnesst/filings/[id]/route')],
      refusals: [await import('@/app/api/cnesst/right-of-refusal/route'), await import('@/app/api/cnesst/right-of-refusal/[id]/route')],
      withdrawals: [await import('@/app/api/cnesst/preventive-withdrawals/route'), await import('@/app/api/cnesst/preventive-withdrawals/[id]/route')],
      committees: [await import('@/app/api/cnesst/hs-committees/route'), await import('@/app/api/cnesst/hs-committees/[id]/route')],
      payEquity: [await import('@/app/api/cnesst/pay-equity/route'), await import('@/app/api/cnesst/pay-equity/[id]/route')],
      antiScab: [await import('@/app/api/cnesst/anti-scab/route'), await import('@/app/api/cnesst/anti-scab/[id]/route')],
      assessments: [await import('@/app/api/wcb/assessments/route'), await import('@/app/api/wcb/assessments/[id]/route')],
    }
  : null

interface Family {
  key: keyof NonNullable<typeof routes>
  label: string
  table: string
  tableRef: () => { status?: { enumValues?: readonly string[] } }
  retained: boolean
  /** The role that writes (a create or an update); a delete needs an administrator. */
  writer: 'steward' | 'officer'
  create: () => Record<string, unknown>
  patch: { field: string; column: string; value: string }
  required: string
  enumField?: { field: string; value: string }
  uuidField?: string
  dateField: string
  timestampField?: string
  hasCreatedBy: boolean
}

const first = (column: { enumValues?: readonly string[] | string[] }, index = 0) => (column.enumValues as readonly string[])[index]

describe.skipIf(!URL)('the CNESST and WCB routes on the combined schema, as the real roles', () => {
  const tag = `hs${randomUUID().slice(0, 8)}`
  const person = (organizationId: string, role: string) => ({ id: randomUUID(), organizationId, role })
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const A = { steward: person(ORG_A, 'steward'), officer: person(ORG_A, 'officer'), admin: person(ORG_A, 'admin') }
  const B = { steward: person(ORG_B, 'steward'), officer: person(ORG_B, 'officer'), admin: person(ORG_B, 'admin') }
  let admin: pg.Client

  const call = <T,>(handler: (ctx: unknown) => Promise<T>, who: { id: string; organizationId: string }, options: { body?: unknown; id?: string; query?: string } = {}) =>
    handler({
      request: new Request(`http://localhost/api/test${options.query ?? ''}`),
      organizationId: who.organizationId,
      userId: who.id,
      body: options.body,
      params: options.id ? { id: options.id } : {},
    })

  const rowOf = async (table: string, id: string) => (await admin.query(`SELECT * FROM public.${table} WHERE id = $1`, [id])).rows[0] as Row | undefined
  const idsOf = (rows: Row[]) => rows.map((row) => row.id as string)
  const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error)

  const families: Family[] = URL
    ? [
        {
          key: 'filings', label: 'CNESST filings', table: 'cnesst_filings', tableRef: () => schema!.cneesstFilings as never, retained: false, writer: 'steward',
          create: () => ({ filingType: first(schema!.cneesstFilings.filingType), legalBasis: 'LATMP art. 271', title: `Fall from a ladder ${tag}`, description: 'A worker fell from a ladder at the loading dock.', filedDate: '2026-01-15' }),
          patch: { field: 'title', column: 'title', value: `Fall from a ladder, revised ${tag}` },
          required: 'legalBasis', enumField: { field: 'filingType', value: 'not_a_filing_type' }, uuidField: 'incidentId', dateField: 'filedDate', hasCreatedBy: true,
        },
        {
          key: 'refusals', label: 'right-of-refusal events', table: 'right_of_refusal_events', tableRef: () => schema!.rightOfRefusalEvents as never, retained: true, writer: 'steward',
          create: () => ({ memberId: randomUUID(), memberName: `Worker ${tag}`, refusalDate: '2026-01-15T10:30:00.000Z', taskRefused: 'Operate the press', dangerDescription: 'The guard is removed.' }),
          patch: { field: 'outcomeNotes', column: 'outcome_notes', value: `Supervisor notified ${tag}` },
          required: 'taskRefused', enumField: { field: 'outcome', value: 'not_an_outcome' }, uuidField: 'memberId', dateField: 'inspectorDecisionDate', timestampField: 'refusalDate', hasCreatedBy: false,
        },
        {
          key: 'withdrawals', label: 'preventive withdrawals', table: 'preventive_withdrawals', tableRef: () => schema!.preventiveWithdrawals as never, retained: false, writer: 'steward',
          create: () => ({ memberId: randomUUID(), memberName: `Worker ${tag}`, reason: first(schema!.preventiveWithdrawals.reason), requestDate: '2026-02-01' }),
          patch: { field: 'notes', column: 'notes', value: `Certificate received ${tag}` },
          required: 'memberName', enumField: { field: 'reason', value: 'not_a_reason' }, uuidField: 'memberId', dateField: 'requestDate', hasCreatedBy: false,
        },
        {
          key: 'committees', label: 'joint H&S committees', table: 'joint_hs_committees', tableRef: () => schema!.jointHsCommittees as never, retained: true, writer: 'officer',
          create: () => ({ workplaceName: `Plant ${tag}`, committeeName: `Committee ${tag}`, establishedDate: '2024-03-01' }),
          patch: { field: 'committeeName', column: 'committee_name', value: `Renamed ${tag}` },
          required: 'committeeName', uuidField: 'workplaceId', dateField: 'establishedDate', hasCreatedBy: false,
        },
        {
          key: 'payEquity', label: 'pay equity exercises', table: 'pay_equity_exercises', tableRef: () => schema!.payEquityExercises as never, retained: false, writer: 'officer',
          create: () => ({ exerciseType: 'initial', notes: `Exercise ${tag}` }),
          patch: { field: 'notes', column: 'notes', value: `Revised ${tag}` },
          required: 'exerciseType', enumField: { field: 'status', value: 'not_a_status' }, dateField: 'resultsPostedDate', hasCreatedBy: false,
        },
        {
          key: 'antiScab', label: 'anti-scab violations', table: 'anti_scab_violations', tableRef: () => schema!.antiScabViolations as never, retained: true, writer: 'steward',
          create: () => ({ strikeOrLockoutStartDate: '2026-03-01', isStrike: true, violationType: first(schema!.antiScabViolations.violationType), violationDate: '2026-03-05', description: `Replacement worker seen ${tag}` }),
          patch: { field: 'description', column: 'description', value: `Replacement worker seen, confirmed ${tag}` },
          required: 'description', enumField: { field: 'violationType', value: 'not_a_violation' }, dateField: 'violationDate', hasCreatedBy: true,
        },
        {
          key: 'assessments', label: 'WCB employer assessments', table: 'wcb_employer_assessments', tableRef: () => schema!.wcbEmployerAssessments as never, retained: false, writer: 'officer',
          create: () => ({ jurisdiction: first(schema!.wcbEmployerAssessments.jurisdiction), assessmentYear: 2026, rateGroup: `Group ${tag}` }),
          patch: { field: 'rateGroup', column: 'rate_group', value: `Group revised ${tag}` },
          required: 'assessmentYear', enumField: { field: 'jurisdiction', value: 'not_a_jurisdiction' }, dateField: 'dueDate', hasCreatedBy: true,
        },
      ]
    : []

  const collectionOf = (family: Family) => routes![family.key][0] as unknown as Collection
  const itemOf = (family: Family) => routes![family.key][1] as unknown as Item
  const writerOf = (family: Family, org: 'A' | 'B') => (org === 'A' ? A : B)[family.writer]
  const adminOf = (org: 'A' | 'B') => (org === 'A' ? A : B).admin

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const who of [...Object.values(A), ...Object.values(B)]) harness.setRole(who.id, who.organizationId, who.role)
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  for (const family of families) describe(family.label, () => {
    const created = { a: '', b: '' }

    it('creates a row owned by the caller\'s organization and attributed to the caller', async () => {
      const result = await call(collectionOf(family).POST, writerOf(family, 'A'), { body: family.create() })
      created.a = result.data.id as string
      const stored = (await rowOf(family.table, created.a))!
      expect(stored.organization_id).toBe(ORG_A)
      if (family.hasCreatedBy) expect(stored.created_by).toBe(writerOf(family, 'A').id)
      const other = await call(collectionOf(family).POST, writerOf(family, 'B'), { body: family.create() })
      created.b = other.data.id as string
      expect((await rowOf(family.table, created.b))!.organization_id).toBe(ORG_B)
    })

    it('refuses a body that assigns the organization, the creator or a column the table does not have', async () => {
      for (const extra of [{ organizationId: ORG_B }, { createdBy: 'someone-else' }, { id: randomUUID() }, { noSuchColumn: 'x' }]) {
        const error = await rejection(call(collectionOf(family).POST, writerOf(family, 'A'), { body: { ...family.create(), ...extra } }))
        expect(error, JSON.stringify(extra)).toBeInstanceOf(ApiError)
        expect((error as InstanceType<typeof ApiError>).code).toBe(ErrorCode.VALIDATION_ERROR)
      }
    })

    it('lists only the caller\'s organization, and reads only its rows', async () => {
      const listA = await call(collectionOf(family).GET, writerOf(family, 'A'), { query: '?limit=100' })
      expect(idsOf(listA.data)).toContain(created.a)
      expect(idsOf(listA.data)).not.toContain(created.b)
      const listB = await call(collectionOf(family).GET, writerOf(family, 'B'), { query: '?limit=100' })
      expect(idsOf(listB.data)).toContain(created.b)
      expect(idsOf(listB.data)).not.toContain(created.a)
      expect((await call(itemOf(family).GET, writerOf(family, 'A'), { id: created.a })).data.id).toBe(created.a)
      const foreign = await rejection(call(itemOf(family).GET, writerOf(family, 'A'), { id: created.b }))
      expect(foreign).toBeInstanceOf(ApiError)
      expect((foreign as InstanceType<typeof ApiError>).code).toBe(ErrorCode.NOT_FOUND)
    })

    it('updates its own row, and reports another organization\'s row as not found and leaves it unchanged', async () => {
      const updated = await call(itemOf(family).PATCH, writerOf(family, 'A'), { id: created.a, body: { [family.patch.field]: family.patch.value } })
      expect(updated.data[family.patch.field]).toBe(family.patch.value)
      expect((await rowOf(family.table, created.a))![family.patch.column]).toBe(family.patch.value)
      const before = (await rowOf(family.table, created.b))![family.patch.column]
      const foreign = await rejection(call(itemOf(family).PATCH, writerOf(family, 'A'), { id: created.b, body: { [family.patch.field]: 'taken over' } }))
      expect((foreign as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.NOT_FOUND)
      expect((await rowOf(family.table, created.b))![family.patch.column]).toBe(before)
      for (const extra of [{ organizationId: ORG_B }, { createdBy: 'someone-else' }]) {
        const error = await rejection(call(itemOf(family).PATCH, writerOf(family, 'A'), { id: created.a, body: extra }))
        expect((error as InstanceType<typeof ApiError>)?.code, JSON.stringify(extra)).toBe(ErrorCode.VALIDATION_ERROR)
      }
      expect((await rowOf(family.table, created.a))!.organization_id).toBe(ORG_A)
    })

    it('deletes according to the table\'s governance, and never another organization\'s row', async () => {
      const status = family.tableRef().status
      const governed = Boolean(status) && !supportsGenericArchive(status)
      const target = (await call(collectionOf(family).POST, writerOf(family, 'A'), { body: family.create() })).data.id as string
      const attempt = await rejection(call(itemOf(family).DELETE, adminOf('A'), { id: target }))
      if (family.retained) {
        expect((attempt as InstanceType<typeof ApiError>).code).toBe(ErrorCode.CONFLICT)
        expect(await rowOf(family.table, target)).toBeDefined()
      } else if (governed) {
        expect((attempt as InstanceType<typeof ApiError>).code).toBe(ErrorCode.FORBIDDEN)
        expect(await rowOf(family.table, target)).toBeDefined()
      } else {
        expect(attempt).toBeNull()
        const after = await rowOf(family.table, target)
        if (status) expect(after?.status).toBe('archived')
        else expect(after).toBeUndefined()
      }
      const foreign = await rejection(call(itemOf(family).DELETE, adminOf('B'), { id: target }))
      expect(foreign).toBeInstanceOf(ApiError)
      expect(['NOT_FOUND', 'CONFLICT', 'FORBIDDEN']).toContain((foreign as InstanceType<typeof ApiError>).code)
      if (!family.retained && !governed && !status) expect(await rowOf(family.table, target)).toBeUndefined()
      else expect((await rowOf(family.table, target))!.organization_id).toBe(ORG_A)
    })

    it('audits a write by field name and never by value', async () => {
      const marker = `${tag}-audit-${family.key}`
      const body = family.create()
      const before = harness.audits.length
      const result = await call(collectionOf(family).POST, writerOf(family, 'A'), { body: { ...body, [family.patch.field]: marker } })
      const entries = harness.audits.slice(before).filter((entry) => entry.resourceId === result.data.id)
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({ action: `crud.${family.table}.create`, resourceType: family.table, organizationId: ORG_A, userId: writerOf(family, 'A').id })
      expect(JSON.stringify(entries[0])).not.toContain(marker)
      expect((entries[0].details as { fields: string[] }).fields).toEqual(expect.arrayContaining(Object.keys(body)))
    })

    it('answers a missing required field, a value outside an enum, a malformed uuid or date as a client error', async () => {
      const faults: Array<[string, Record<string, unknown>, string[]]> = []
      const body = family.create()
      const { [family.required]: _dropped, ...missing } = body
      void _dropped
      faults.push(['a missing required field', missing, [family.required]])
      if (family.enumField) faults.push(['a value outside the enum', { ...body, [family.enumField.field]: family.enumField.value }, [family.enumField.field]])
      if (family.uuidField) faults.push(['a malformed uuid', { ...body, [family.uuidField]: 'not-a-uuid' }, [family.uuidField]])
      faults.push(['a malformed date', { ...body, [family.dateField]: 'not-a-date' }, [family.dateField]])
      faults.push(['an impossible date', { ...body, [family.dateField]: '2026-02-31' }, [family.dateField]])
      for (const [label, payload, fields] of faults) {
        const error = await rejection(call(collectionOf(family).POST, writerOf(family, 'A'), { body: payload }))
        expect(error, label).toBeInstanceOf(ApiError)
        expect((error as InstanceType<typeof ApiError>).code, label).toBe(ErrorCode.VALIDATION_ERROR)
        for (const field of fields) expect((error as Error).message, label).toContain(field)
      }
      const patchFault = await rejection(call(itemOf(family).PATCH, writerOf(family, 'A'), { id: created.a, body: { [family.dateField]: 'not-a-date' } }))
      expect((patchFault as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.VALIDATION_ERROR)
    })

    it('stores a well-formed ISO date and timestamp as sent', async () => {
      const body = { ...family.create(), [family.dateField]: '2026-04-02' }
      const result = await call(collectionOf(family).POST, writerOf(family, 'A'), { body })
      const stored = (await admin.query(`SELECT ${snake(family.dateField)}::text AS value FROM public.${family.table} WHERE id = $1`, [result.data.id])).rows[0]
      expect(stored.value).toBe('2026-04-02')
      if (family.timestampField) {
        const timestamp = (await admin.query(`SELECT extract(epoch FROM ${snake(family.timestampField)})::float8 AS epoch FROM public.${family.table} WHERE id = $1`, [result.data.id])).rows[0]
        expect(timestamp.epoch * 1000).toBe(Date.parse(String((body as Record<string, unknown>)[family.timestampField])))
      }
    })
  })

  it('rolls a write back with its audit: an audit that fails leaves no row behind', async () => {
    const title = `unaudited ${tag}`
    harness.failNextAudit()
    const family = families[0]
    const error = await rejection(call(collectionOf(family).POST, A.steward, { body: { ...family.create(), title } }))
    expect((error as Error).message).toBe('audit sink unavailable')
    expect((await admin.query(`SELECT count(*)::int AS n FROM public.cnesst_filings WHERE title = $1`, [title])).rows[0].n).toBe(0)
  })

  it('lets a steward file on behalf of a member, and shows the organization\'s filings to its staff', async () => {
    const family = families[0]
    const member = randomUUID()
    const result = await call(collectionOf(family).POST, A.steward, { body: { ...family.create(), memberId: member, title: `On behalf of a member ${tag}` } })
    expect((await rowOf('cnesst_filings', result.data.id as string))!.member_id).toBe(member)
    const listed = await call(collectionOf(family).GET, A.officer, { query: '?limit=100' })
    expect(idsOf(listed.data)).toContain(result.data.id)
  })

  it('refuses a caller below the role floor before any statement runs', async () => {
    const member = person(ORG_A, 'member')
    harness.setRole(member.id, ORG_A, 'member')
    for (const family of families) {
      const error = await rejection(call(collectionOf(family).GET, member, { query: '?limit=1' }))
      expect(error, family.label).toBeInstanceOf(ApiError)
      expect((error as InstanceType<typeof ApiError>).code, family.label).toBe(ErrorCode.FORBIDDEN)
    }
    const steward = A.steward
    const officerOnly = families.filter((family) => family.writer === 'officer')
    for (const family of officerOnly) {
      const error = await rejection(call(collectionOf(family).POST, steward, { body: family.create() }))
      expect((error as InstanceType<typeof ApiError>)?.code, family.label).toBe(ErrorCode.FORBIDDEN)
    }
  })
})

function snake(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}
