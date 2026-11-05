/**
 * The grievance routes on real PostgreSQL, as the real roles (UE-CONV-H-019): GET/PATCH/POST under /api/grievances/[id] and /api/grievances/import.
 *
 * These routes were wrapped by withOrganizationAuth, a wrapper the tenant-context census does not know, and read and wrote tenant tables through the ambient
 * handle: on the runtime role, with no organization set, row-level security shows every one of those tables as empty. The unit tests replace the database, so
 * they could not tell. This runs the unmodified routes and services against the combined Django + Drizzle schema, with only the request boundary replaced (see
 * native-route-harness.ts) and the decisions that are not the database's mocked at their own boundary: who holds which relationship to a case (the authority
 * kernel's answer, covered by its own native tests), the capacity to import in bulk and the evidence pack. It proves that
 *   - the routes that read through the ambient handle ask the wrapper for a tenant transaction, and a handle with no organization sees no grievance row;
 *   - a grievance, its events and its governed documents are returned to the organization that owns them and are "not found" to every other organization;
 *   - a status change, a conversion, a priority override, a document upload and a clause link store what they should in the caller's organization, are audited
 *     with it, are not stored when the audit fails, and cannot be made on another organization's grievance;
 *   - an assignment commits before the system role converges the reminders for it (a single transaction around the handler would hide the task from the
 *     system connection), stores the assignment in the caller's organization, bumps the caseload in one statement, and is refused for another organization;
 *   - clause suggestions and steward recommendations come from the caller's organization only;
 *   - an import commits row by row: a row that cannot be audited does not undo the session or the rows before it, the session is closed as failed, and an
 *     organization sees only its own sessions and records.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const state = vi.hoisted(() => ({
  caller: { userId: '', organizationId: '' },
  // `${userId}|${grievanceId}` -> the case-relationship decision the authority kernel would give; absent means no relationship.
  caseAccess: new Map<string, Record<string, unknown>>(),
  kernelAllows: true,
  assigned: [] as Array<{ tx: unknown; params: Record<string, unknown> }>,
  evidence: [] as Array<Record<string, unknown>>,
  logged: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api/with-api', async () => ({ withApi: (await import('./native-route-harness')).emulatedWithApi }))
vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>()
  const { roleInOrganization } = await import('./native-route-harness')
  const level = (role: string | null) => (role ? (actual.ROLE_HIERARCHY as Record<string, number>)[role] ?? 0 : 0)
  return {
    ...actual,
    hasMinRole: async (minimum: string) => level(await roleInOrganization(state.caller.userId, state.caller.organizationId)) >= level(minimum),
  }
})
vi.mock('@/lib/services/case-access-service', () => {
  const none = { isPrimaryOwner: false, isSecondaryCollaborator: false, accessRole: null, canViewCase: false, canUploadDocuments: false, canDraftActions: false, canViewPrivateDocuments: false, canManageAssignments: false }
  return {
    getEffectiveCaseAccess: async ({ userId, grievanceId }: { userId: string; grievanceId: string }) => ({ ...none, ...(state.caseAccess.get(`${userId}|${grievanceId}`) ?? {}) }),
    listCaseCollaborators: async () => [],
    assignPrimaryRepresentative: async (tx: unknown, params: Record<string, unknown>) => {
      state.assigned.push({ tx, params })
      return { previousUserId: null }
    },
  }
})
vi.mock('@/lib/cases/case-authorization', async () => {
  const { ApiError } = await import('@/lib/api/errors')
  return {
    requireKernelCaseAction: async () => {
      if (!state.kernelAllows) throw ApiError.forbidden()
    },
    hasCaseFilingCapacity: async () => true,
  }
})
vi.mock('@/lib/audit-logger', () => ({
  auditLog: async (entry: Record<string, unknown>) => void state.logged.push(entry),
  auditDataAccess: async (entry: Record<string, unknown>) => void state.logged.push(entry),
  auditDataMutation: async (entry: Record<string, unknown>) => void state.logged.push(entry),
  AuditEventType: { AUTHORITY_VIOLATION: 'AUTHORITY_VIOLATION' },
  AuditSeverity: { HIGH: 'HIGH' },
}))
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: async (input: Record<string, unknown>) => void state.evidence.push(input) }))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const detail = URL ? await import('@/app/api/grievances/[id]/route') : null
const status = URL ? await import('@/app/api/grievances/[id]/status/route') : null
const convert = URL ? await import('@/app/api/grievances/[id]/convert/route') : null
const priority = URL ? await import('@/app/api/grievances/[id]/priority-override/route') : null
const upload = URL ? await import('@/app/api/grievances/[id]/documents/route') : null
const suggest = URL ? await import('@/app/api/grievances/[id]/suggest-clauses/route') : null
const recommend = URL ? await import('@/app/api/grievances/[id]/recommend-steward/route') : null
const assign = URL ? await import('@/app/api/grievances/[id]/assign/route') : null
const imports = URL ? await import('@/app/api/grievances/import/route') : null

type Row = Record<string, unknown>
type Who = { organizationId: string; userId: string }
type Handler = (ctx: unknown) => Promise<Response>

describe.skipIf(!URL)('the grievance routes on the combined schema, as the real roles', () => {
  const tag = `gv${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const memberA = `member-a-${tag}`
  const stewardA = `steward-a-${tag}`
  const officerA = `officer-a-${tag}`
  const strangerA = `stranger-a-${tag}`
  const officerB = `officer-b-${tag}`
  const asMemberA: Who = { organizationId: ORG_A, userId: memberA }
  const asStewardA: Who = { organizationId: ORG_A, userId: stewardA }
  const asOfficerA: Who = { organizationId: ORG_A, userId: officerA }
  const asStrangerA: Who = { organizationId: ORG_A, userId: strangerA }
  const asOfficerB: Who = { organizationId: ORG_B, userId: officerB }
  let admin: pg.Client

  const run = (handler: unknown, who: Who, extra: Record<string, unknown> = {}) => {
    state.caller = who
    return (handler as Handler)({ ...who, ...extra })
  }
  const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as { code?: string; message?: string })
  const json = async (response: Response) => (await response.json()) as { success?: boolean; data?: Row & { importedRows?: number }; code?: string }
  const request = (url: string, method: string, body?: unknown) =>
    new Request(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

  const newOrganization = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, '-')}-${id}`],
    )
  const newGrievance = async (organizationId: string, createdBy: string, overrides: { status?: string; priority?: string; title?: string; description?: string; unionRepId?: string } = {}) => {
    const { rows } = await admin.query(
      `INSERT INTO grievances (grievance_number, description, organization_id, title, type, status, priority, created_by, union_rep_id)
       VALUES ($1,$2,$3,$4,'individual',$5,$6,$7,$8) RETURNING id::text AS id`,
      [`GRV-${tag}-${randomUUID().slice(0, 6)}`, overrides.description ?? 'Overtime was not paid for three consecutive weeks', organizationId, overrides.title ?? `Unpaid overtime ${tag}`, overrides.status ?? 'filed', overrides.priority ?? 'medium', createdBy, overrides.unionRepId ?? null],
    )
    return rows[0].id as string
  }
  const newDocument = async (organizationId: string, grievanceId: string, title: string) => {
    const { rows } = await admin.query(
      `INSERT INTO documents (organization_id, name, title, filename, file_url, file_type, document_type, uploaded_by, privacy_label)
       VALUES ($1,$2,$2,$2,$3,'evidence','evidence','someone','public_internal') RETURNING id::text AS id`,
      [organizationId, title, `https://storage.test/${organizationId}/${title}`],
    )
    await admin.query(
      `INSERT INTO document_links (organization_id, document_id, linked_entity_type, linked_entity_id, linked_by) VALUES ($1,$2,'grievance',$3,'someone')`,
      [organizationId, rows[0].id, grievanceId],
    )
    return rows[0].id as string
  }
  const grievanceRow = async (id: string) => (await admin.query(`SELECT * FROM grievances WHERE id = $1`, [id])).rows[0] as Row | undefined
  const eventsOf = async (id: string) => (await admin.query(`SELECT event_type FROM grievance_events WHERE grievance_id = $1 ORDER BY created_at, id`, [id])).rows.map((row) => row.event_type as string)
  const allowCase = (userId: string, grievanceId: string, access: Row) => state.caseAccess.set(`${userId}|${grievanceId}`, access)

  beforeAll(async () => {
    admin = await harness.start(URL!)
    await newOrganization(ORG_A, `Grievances A ${tag}`)
    await newOrganization(ORG_B, `Grievances B ${tag}`)
    harness.setRole(memberA, ORG_A, 'member')
    harness.setRole(stewardA, ORG_A, 'steward')
    harness.setRole(officerA, ORG_A, 'officer')
    harness.setRole(strangerA, ORG_A, 'member')
    harness.setRole(officerB, ORG_B, 'officer')
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('what the routes ask of the wrapper', () => {
    it('opens a tenant transaction for every route that reads or writes through the ambient handle', () => {
      const wanted = [
        'Fetch a grievance with its events and governed documents',
        'Convert an intake into an official case',
        'Override the generated priority of a grievance',
        'Advance a grievance through the lifecycle',
        'Attach a document to a grievance',
        'Suggest or link collective-agreement clauses for a grievance',
        'Recommend stewards for a grievance',
        'List import sessions or read one with its records',
      ]
      for (const summary of wanted) expect(harness.configs.find((entry) => entry.openapi?.summary === summary)?.rlsOrgContext, summary).toBe(true)
    })

    it('leaves the transaction to the handler where the work must commit in steps (the assignment, the import)', () => {
      for (const summary of ['Assign a steward to a grievance', 'Import grievances from CSV or JSON']) {
        const config = harness.configs.find((entry) => entry.openapi?.summary === summary) as { rlsOrgContext?: boolean; requireOrg?: boolean } | undefined
        expect(config?.rlsOrgContext, summary).toBeUndefined()
        expect(config?.requireOrg, summary).toBe(false)
      }
    })

    it('shows a handle with no organization no grievance, event, document or import row (why the routes open a transaction)', async () => {
      const { grievances } = await import('@/db/schema/domains/claims/grievances')
      const { grievanceEvents } = await import('@/db/schema/domains/claims/grievance-lifecycle')
      const { ingestionBatches } = await import('@/db/schema/ingestion-schema')
      const id = await newGrievance(ORG_A, memberA)
      await admin.query(`INSERT INTO grievance_events (grievance_id, event_type, actor_user_id) VALUES ($1,'created',$2)`, [id, memberA])
      await admin.query(`INSERT INTO ingestion_batches (organization_id, source_system) VALUES ($1,$2)`, [ORG_A, `probe-${tag}`])
      const seen = await harness.tenant(RUNTIME_ROLE, null, memberA, async (tx) => ({
        grievances: await tx.select().from(grievances),
        events: await tx.select().from(grievanceEvents),
        batches: await tx.select().from(ingestionBatches),
      }))
      expect(seen.grievances).toEqual([])
      expect(seen.events).toEqual([])
      expect(seen.batches).toEqual([])
      const seenByOwner = await harness.tenant(RUNTIME_ROLE, ORG_A, memberA, (tx) => tx.select().from(grievances))
      expect(seenByOwner.map((row) => row.id)).toContain(id)
    })
  })

  describe('GET /api/grievances/[id]', () => {
    it('returns the grievance, its events and its governed documents to the organization that owns them, and nothing of another organization', async () => {
      const grievance = await newGrievance(ORG_A, memberA)
      await admin.query(`INSERT INTO grievance_events (grievance_id, event_type, actor_user_id, notes) VALUES ($1,'created',$2,'filed')`, [grievance, memberA])
      const mine = await newDocument(ORG_A, grievance, `Pay stubs ${tag}`)
      const otherGrievance = await newGrievance(ORG_B, officerB)
      await newDocument(ORG_B, otherGrievance, `Foreign ${tag}`)

      const response = await run(detail!.GET, asMemberA, { params: { id: grievance } })
      expect(response.status).toBe(200)
      const body = await json(response)
      expect(body.data).toMatchObject({ id: grievance, organizationId: ORG_A, createdBy: memberA })
      expect((body.data?.events as Row[]).map((event) => event.eventType)).toEqual(['created'])
      expect((body.data?.governedDocuments as Row[]).map((doc) => doc.id)).toEqual([mine])
      expect(JSON.stringify(body)).not.toContain(`Foreign ${tag}`)
    })

    it('answers "not found" for another organization\'s grievance, and 400 for an id that is not a uuid', async () => {
      const grievance = await newGrievance(ORG_A, memberA)
      allowCase(officerB, grievance, { canViewCase: true })
      expect((await run(detail!.GET, asOfficerB, { params: { id: grievance } })).status).toBe(404)
      expect((await run(detail!.GET, asMemberA, { params: { id: 'not-a-uuid' } })).status).toBe(400)
    })

    it('withholds the grievance from an organization member who has no relationship to it', async () => {
      const grievance = await newGrievance(ORG_A, memberA)
      expect((await run(detail!.GET, asStrangerA, { params: { id: grievance } })).status).toBe(403)
    })
  })

  describe('PATCH /api/grievances/[id]/status', () => {
    it('stores the new status in the caller\'s organization with its event, audited, and stamps closure', async () => {
      const grievance = await newGrievance(ORG_A, officerA, { status: 'filed', unionRepId: undefined })
      allowCase(officerA, grievance, { isPrimaryOwner: true, canViewCase: true })
      const before = harness.audits.length
      const response = await run(status!.PATCH, asOfficerA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/status`, 'PATCH', { status: 'acknowledged', notes: 'Started' }) })
      expect(response.status).toBe(200)
      expect(await grievanceRow(grievance)).toMatchObject({ status: 'acknowledged', organization_id: ORG_A })
      expect(await eventsOf(grievance)).toEqual(['status_changed'])
      expect(harness.audits.slice(before).filter((entry) => entry.resourceId === grievance)).toEqual([
        expect.objectContaining({ action: 'grievance.status_change', organizationId: ORG_A, userId: officerA }),
      ])
    })

    it('does not move another organization\'s grievance, and stores nothing when the audit fails', async () => {
      const grievance = await newGrievance(ORG_A, officerA, { status: 'filed' })
      allowCase(officerB, grievance, { isPrimaryOwner: true, canViewCase: true })
      const foreign = await run(status!.PATCH, asOfficerB, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/status`, 'PATCH', { status: 'acknowledged' }) })
      expect(foreign.status).toBe(404)
      expect((await grievanceRow(grievance))?.status).toBe('filed')

      allowCase(officerA, grievance, { isPrimaryOwner: true, canViewCase: true })
      harness.failNextAudit()
      const error = await rejection(run(status!.PATCH, asOfficerA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/status`, 'PATCH', { status: 'acknowledged' }) }))
      expect((error as Error).message).toBe('audit sink unavailable')
      expect((await grievanceRow(grievance))?.status).toBe('filed')
      expect(await eventsOf(grievance)).toEqual([])
    })

    it('refuses a caller without authority over the matter, whatever their role', async () => {
      const grievance = await newGrievance(ORG_A, officerA, { status: 'filed' })
      const response = await run(status!.PATCH, asStewardA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/status`, 'PATCH', { status: 'acknowledged' }) })
      expect(response.status).toBe(403)
      expect((await grievanceRow(grievance))?.status).toBe('filed')
    })
  })

  describe('POST /api/grievances/[id]/convert and /priority-override', () => {
    it('converts an intake into an official case of the same organization, linked back, with both events and both audits', async () => {
      const intake = await newGrievance(ORG_A, memberA, { status: 'draft', title: `Intake ${tag}` })
      state.kernelAllows = true
      const before = harness.audits.length
      const response = await run(convert!.POST, asOfficerA, { params: { id: intake }, request: request(`/api/grievances/${intake}/convert`, 'POST', { priority: 'high', notes: 'Convert now' }) })
      expect(response.status).toBe(200)
      const official = (await json(response)).data as Row
      expect(official).toMatchObject({ organizationId: ORG_A, createdBy: officerA, priority: 'high', status: 'filed' })
      expect(await grievanceRow(intake)).toMatchObject({ status: 'converted' })
      expect((await grievanceRow(official.id as string))?.related_grievance_ids).toEqual([intake])
      expect(await eventsOf(intake)).toEqual(['converted_to_case'])
      expect(await eventsOf(official.id as string)).toEqual(['created'])
      expect(harness.audits.slice(before).map((entry) => entry.action).sort()).toEqual(['grievance.convert_intake', 'grievance.create_official_case'])
    })

    it('does not convert another organization\'s intake, or one the kernel refuses (and records the refusal)', async () => {
      const intake = await newGrievance(ORG_A, memberA, { status: 'draft' })
      expect((await run(convert!.POST, asOfficerB, { params: { id: intake }, request: request(`/api/grievances/${intake}/convert`, 'POST', {}) })).status).toBe(404)
      state.kernelAllows = false
      state.logged.length = 0
      expect((await run(convert!.POST, asOfficerA, { params: { id: intake }, request: request(`/api/grievances/${intake}/convert`, 'POST', {}) })).status).toBe(403)
      state.kernelAllows = true
      expect(state.logged).toEqual([expect.objectContaining({ eventType: 'AUTHORITY_VIOLATION', action: 'convert_intake', organizationId: ORG_A })])
      expect((await grievanceRow(intake))?.status).toBe('draft')
    })

    it('overrides the priority in the caller\'s organization with its event and audit, and not on another organization\'s grievance', async () => {
      const grievance = await newGrievance(ORG_A, memberA, { priority: 'medium' })
      const before = harness.audits.length
      const body = { newPriority: 'urgent', reason: 'The employer has set a hearing for Friday' }
      expect((await run(priority!.POST, asOfficerB, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/priority-override`, 'POST', body) })).status).toBe(404)
      expect((await grievanceRow(grievance))?.priority).toBe('medium')

      expect((await run(priority!.POST, asOfficerA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/priority-override`, 'POST', body) })).status).toBe(200)
      expect((await grievanceRow(grievance))?.priority).toBe('urgent')
      expect(await eventsOf(grievance)).toEqual(['priority_overridden'])
      expect(harness.audits.slice(before).filter((entry) => entry.resourceId === grievance)).toEqual([expect.objectContaining({ action: 'grievance.priority_override', organizationId: ORG_A, userId: officerA })])
    })
  })

  describe('POST /api/grievances/[id]/documents', () => {
    const body = { fileUrl: `https://storage.test/a/evidence.pdf`, title: 'Schedule', filename: 'schedule.pdf', mimeType: 'application/pdf', documentType: 'evidence', privacyLabel: 'team_confidential' }

    it('stores the document, its first version and its link in the caller\'s organization, with the case event and audit', async () => {
      const grievance = await newGrievance(ORG_A, memberA)
      const before = harness.audits.length
      const response = await run(upload!.POST, asMemberA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/documents`, 'POST', body) })
      expect(response.status).toBe(200)
      const created = (await json(response)).data as Row
      expect(created).toMatchObject({ organizationId: ORG_A, uploadedBy: memberA, privacyLabel: 'team_confidential' })
      const links = (await admin.query(`SELECT organization_id::text, linked_entity_id::text FROM document_links WHERE document_id = $1`, [created.id])).rows
      expect(links).toEqual([{ organization_id: ORG_A, linked_entity_id: grievance }])
      expect((await admin.query(`SELECT organization_id::text, version_no FROM document_versions WHERE document_id = $1`, [created.id])).rows).toEqual([{ organization_id: ORG_A, version_no: 1 }])
      expect(await eventsOf(grievance)).toEqual(['document_uploaded'])
      expect(harness.audits.slice(before).filter((entry) => entry.resourceId === created.id)).toEqual([expect.objectContaining({ action: 'grievance.document_upload', organizationId: ORG_A, userId: memberA })])
      expect(state.evidence.at(-1)).toMatchObject({ actionType: 'GRIEVANCE_DOCUMENT_UPLOADED', orgId: ORG_A })
    })

    it('stores nothing for another organization\'s grievance, for a caller with no right to upload, or when the audit fails', async () => {
      const grievance = await newGrievance(ORG_A, memberA)
      const count = async () => Number((await admin.query(`SELECT count(*)::int AS n FROM documents WHERE organization_id = $1 AND name = $2`, [ORG_A, 'Schedule'])).rows[0].n)
      const before = await count()
      expect((await run(upload!.POST, asOfficerB, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/documents`, 'POST', body) })).status).toBe(404)
      expect((await run(upload!.POST, asStrangerA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/documents`, 'POST', body) })).status).toBe(403)
      harness.failNextAudit()
      const error = await rejection(run(upload!.POST, asMemberA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/documents`, 'POST', body) }))
      expect((error as Error).message).toBe('audit sink unavailable')
      expect(await count()).toBe(before)
    })
  })

  describe('POST /api/grievances/[id]/suggest-clauses', () => {
    const clause = async (organizationId: string, number: string, title: string, content: string) => {
      const agreement = await admin.query(
        `INSERT INTO collective_agreements (organization_id, cba_number, title, jurisdiction, employer_name, union_name, effective_date, expiry_date, industry_sector)
         VALUES ($1,$2,$3,'ontario','Employer','Union',now(),now() + interval '1 year','retail') RETURNING id::text AS id`,
        [organizationId, `CBA-${randomUUID().slice(0, 6)}`, `Agreement ${tag}`],
      )
      const { rows } = await admin.query(
        `INSERT INTO cba_clauses (organization_id, cba_id, clause_number, clause_type, title, content) VALUES ($1,$2,$3,'overtime',$4,$5) RETURNING id::text AS id`,
        [organizationId, agreement.rows[0].id, number, title, content],
      )
      return rows[0].id as string
    }

    it('suggests clauses of the caller\'s agreements only, and links one with its audit', async () => {
      const grievance = await newGrievance(ORG_A, stewardA, { description: 'Overtime premium unpaid after the schedule change' })
      allowCase(stewardA, grievance, { canViewCase: true, isPrimaryOwner: true, canDraftActions: true })
      const mine = await clause(ORG_A, '14.2', `Overtime premium ${tag}`, 'Overtime is paid at double time after the schedule change.')
      await clause(ORG_B, '9.9', `Overtime premium ${tag}`, 'Overtime is paid at double time after the schedule change.')

      const suggestions = await run(suggest!.POST, asStewardA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/suggest-clauses`, 'POST') })
      expect(suggestions.status).toBe(200)
      const found = (await json(suggestions)).data as unknown as Array<{ clauseId: string }>
      expect(found.map((entry) => entry.clauseId)).toEqual([mine])

      const before = harness.audits.length
      const linked = await run(suggest!.POST, asStewardA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/suggest-clauses`, 'POST', { clauseId: mine }) })
      expect(linked.status).toBe(200)
      expect(await grievanceRow(grievance)).toMatchObject({ cba_article: '14.2', cba_section: '14.2' })
      expect(harness.audits.slice(before).filter((entry) => entry.resourceId === grievance)).toEqual([expect.objectContaining({ action: 'grievance.link_clause', organizationId: ORG_A })])
    })

    it('does not link a clause of another organization (not found) and answers nothing for another organization\'s grievance', async () => {
      const grievance = await newGrievance(ORG_A, stewardA)
      allowCase(stewardA, grievance, { canViewCase: true, isPrimaryOwner: true, canDraftActions: true })
      const foreign = await clause(ORG_B, '1.1', `Foreign clause ${tag}`, 'Foreign content')
      // The emulated wrapper does not answer for a handler: a refusal the handler throws is what the real wrapper would turn into the 404.
      const refusal = await rejection(run(suggest!.POST, asStewardA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/suggest-clauses`, 'POST', { clauseId: foreign }) }))
      expect(refusal).toMatchObject({ code: 'NOT_FOUND', message: 'Clause not found' })
      expect((await grievanceRow(grievance))?.cba_article).toBeNull()
      expect((await run(suggest!.POST, { organizationId: ORG_B, userId: officerB }, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/suggest-clauses`, 'POST') })).status).toBe(404)
    })
  })

  describe('POST /api/grievances/[id]/recommend-steward and PATCH /api/grievances/[id]/assign', () => {
    const steward = async (organizationId: string, region: string) => {
      const { rows } = await admin.query(`INSERT INTO stewards (org_id, user_id, region, max_caseload, current_caseload) VALUES ($1,$2,$3,10,0) RETURNING id::text AS id`, [organizationId, randomUUID(), region])
      return rows[0].id as string
    }

    it('recommends the caller\'s organization\'s stewards only', async () => {
      const grievance = await newGrievance(ORG_A, memberA)
      const mine = await steward(ORG_A, 'Ontario')
      await steward(ORG_B, 'Ontario')
      const response = await run(recommend!.POST, asOfficerA, { params: { id: grievance } })
      expect(response.status).toBe(200)
      const candidates = (await json(response)).data as unknown as Array<{ stewardId: string }>
      expect(candidates.map((candidate) => candidate.stewardId)).toContain(mine)
      const known = (await admin.query(`SELECT id::text FROM stewards WHERE org_id = $1`, [ORG_A])).rows.map((row) => row.id)
      expect(known).toContain(mine)
      expect(candidates.every((candidate) => known.includes(candidate.stewardId))).toBe(true)
      // The wrapper turns a refusal the handler throws into the 404; here it is the thrown refusal.
      expect(await rejection(run(recommend!.POST, asOfficerB, { params: { id: grievance } }))).toMatchObject({ code: 'NOT_FOUND', message: 'Grievance not found' })
    })

    it('assigns in the caller\'s organization, commits before the system role converges the reminders, and bumps the caseload in one statement', async () => {
      const grievance = await newGrievance(ORG_A, memberA)
      const stewardId = await steward(ORG_A, 'Quebec')
      const before = harness.audits.length
      const response = await run(assign!.PATCH, asOfficerA, { params: { id: grievance }, request: request(`/api/grievances/${grievance}/assign`, 'PATCH', { stewardId }) })
      expect(response.status).toBe(200)

      expect(await grievanceRow(grievance)).toMatchObject({ union_rep_id: stewardId })
      expect(await eventsOf(grievance)).toEqual(['assigned'])
      expect((await admin.query(`SELECT organization_id::text, steward_id FROM steward_assignments WHERE grievance_id = $1`, [grievance])).rows).toEqual([{ organization_id: ORG_A, steward_id: stewardId }])
      expect((await admin.query(`SELECT current_caseload FROM stewards WHERE id = $1`, [stewardId])).rows[0].current_caseload).toBe(1)
      // The convergence task was recorded in the assignment transaction and processed by the system role afterwards: it can only have been
      // processed if the system connection could see it, that is, if the assignment had committed.
      const tasks = (await admin.query(`SELECT organization_id::text, status FROM deadline_reassignment_convergence WHERE grievance_id = $1`, [grievance])).rows
      expect(tasks).toEqual([{ organization_id: ORG_A, status: 'converged' }])
      expect(state.assigned.at(-1)?.params).toMatchObject({ organizationId: ORG_A, grievanceId: grievance, issuerUserId: officerA, assigneeUserId: stewardId })
      expect(harness.audits.slice(before).filter((entry) => entry.resourceId === grievance)).toEqual([expect.objectContaining({ action: 'grievance.assign_steward', organizationId: ORG_A, userId: officerA })])
    })

    it('assigns nothing on another organization\'s grievance, below the officer role, or when the audit fails', async () => {
      const grievance = await newGrievance(ORG_A, memberA)
      const stewardId = await steward(ORG_A, 'Quebec')
      const assignRequest = () => request(`/api/grievances/${grievance}/assign`, 'PATCH', { stewardId })
      expect((await run(assign!.PATCH, asOfficerB, { params: { id: grievance }, request: assignRequest() })).status).toBe(404)
      expect((await rejection(run(assign!.PATCH, asStewardA, { params: { id: grievance }, request: assignRequest() }))) as { code?: string }).toMatchObject({ code: 'FORBIDDEN' })
      harness.failNextAudit()
      expect(((await rejection(run(assign!.PATCH, asOfficerA, { params: { id: grievance }, request: assignRequest() }))) as Error).message).toBe('audit sink unavailable')
      expect((await admin.query(`SELECT count(*)::int AS n FROM steward_assignments WHERE grievance_id = $1`, [grievance])).rows[0].n).toBe(0)
      expect((await admin.query(`SELECT current_caseload FROM stewards WHERE id = $1`, [stewardId])).rows[0].current_caseload).toBe(0)
      expect((await grievanceRow(grievance))?.union_rep_id).toBeNull()
    })
  })

  describe('POST and GET /api/grievances/import', () => {
    const rows = (suffix: string) => [
      { type: 'individual', title: `Imported ${suffix} one`, description: 'The schedule change was not posted in time', createOfficialCase: true },
      { type: 'individual', title: 'Bad', description: 'short' },
    ]
    const importRequest = (payload: unknown, extra: Record<string, unknown> = {}) =>
      request('/api/grievances/import', 'POST', { format: 'json', payload, sourceSystem: `native-${tag}`, ...extra })

    it('imports row by row in the caller\'s organization: the session, the records, the cases and their audits, with the failing row reported', async () => {
      const before = harness.audits.length
      const response = await run(imports!.POST, asOfficerA, { request: importRequest(rows('A')) })
      expect(response.status).toBe(200)
      const summary = (await json(response)).data as Row
      expect(summary).toMatchObject({ status: 'partial', totalRows: 2, importedRows: 1, failedRows: 1, skippedRows: 0 })

      const session = summary.importSessionId as string
      expect((await admin.query(`SELECT organization_id::text, status, succeeded, failed FROM ingestion_batches WHERE id = $1`, [session])).rows).toEqual([{ organization_id: ORG_A, status: 'partial', succeeded: 1, failed: 1 }])
      expect((await admin.query(`SELECT record_index, status FROM ingestion_records WHERE batch_id = $1 ORDER BY record_index`, [session])).rows).toEqual([{ record_index: 0, status: 'succeeded' }, { record_index: 1, status: 'failed' }])
      const imported = (summary.imported as Array<{ grievanceId: string }>)[0].grievanceId
      expect(await grievanceRow(imported)).toMatchObject({ organization_id: ORG_A, created_by: officerA, status: 'filed' })
      const actions = harness.audits.slice(before).map((entry) => entry.action)
      expect(actions).toContain('grievance.import_row')
      expect(actions).toContain('grievance.import_batch')
    })

    it('skips a duplicate of a row already imported, and resumes a session without repeating what succeeded', async () => {
      const first = (await json(await run(imports!.POST, asOfficerA, { request: importRequest([rows('dup')[0]]) }))).data as Row
      const again = (await json(await run(imports!.POST, asOfficerA, { request: importRequest([rows('dup')[0]]) }))).data as Row
      expect(again).toMatchObject({ importedRows: 0, skippedRows: 1 })
      const resumed = (await json(await run(imports!.POST, asOfficerA, { request: importRequest([rows('dup')[0]], { importSessionId: first.importSessionId, resumeFailedOnly: true }) }))).data as Row
      expect(resumed).toMatchObject({ importSessionId: first.importSessionId, importedRows: 0, skippedRows: 1 })
    })

    it('keeps the session and closes it as failed when a row cannot be audited, and imports nothing of that row', async () => {
      const title = `Unaudited ${tag}`
      harness.failNextAudit()
      const error = await rejection(run(imports!.POST, asOfficerA, { request: importRequest([{ type: 'individual', title, description: 'The grievance cannot be audited', createOfficialCase: true }]) }))
      expect((error as Error).message).toBe('audit sink unavailable')
      expect((await admin.query(`SELECT count(*)::int AS n FROM grievances WHERE organization_id = $1 AND title = $2`, [ORG_A, title])).rows[0].n).toBe(0)
      const sessions = (await admin.query(`SELECT status FROM ingestion_batches WHERE organization_id = $1 AND source_system = $2 AND status = 'failed'`, [ORG_A, `native-${tag}`])).rows
      expect(sessions.length).toBeGreaterThan(0)
    })

    it('lists and reads only the caller\'s organization\'s sessions and records', async () => {
      const mine = (await json(await run(imports!.POST, asOfficerA, { request: importRequest([rows('list')[0]], { sourceSystem: `native-list-${tag}` }) }))).data as Row
      const theirs = (await json(await run(imports!.POST, asOfficerB, { request: importRequest([rows('other')[0]], { sourceSystem: `native-other-${tag}` }) }))).data as Row

      const listA = (await json(await run(imports!.GET, asOfficerA, { request: request('/api/grievances/import', 'GET') }))).data as unknown as { sessions: Array<{ id: string }> }
      expect(listA.sessions.map((session) => session.id)).toContain(mine.importSessionId)
      expect(listA.sessions.map((session) => session.id)).not.toContain(theirs.importSessionId)

      const read = await run(imports!.GET, asOfficerA, { request: request(`/api/grievances/import?importSessionId=${mine.importSessionId}`, 'GET') })
      expect(read.status).toBe(200)
      expect(((await json(read)).data as unknown as { records: unknown[] }).records).toHaveLength(1)
      expect((await run(imports!.GET, asOfficerA, { request: request(`/api/grievances/import?importSessionId=${theirs.importSessionId}`, 'GET') })).status).toBe(404)
      expect((await run(imports!.GET, asOfficerA, { request: request('/api/grievances/import?importSessionId=not-a-uuid', 'GET') })).status).toBe(400)
      expect((await run(imports!.POST, asOfficerA, { request: importRequest([rows('x')[0]], { importSessionId: theirs.importSessionId }) })).status).toBe(404)
    })
  })
})
