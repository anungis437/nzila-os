/**
 * The board packet routes on real PostgreSQL, as the real roles (UE-CONV-H-017).
 *
 * The routes read board_packets through the ambient handle outside any tenant transaction, so under row-level security the list answered with nothing and
 * a single read with "not found" for every caller; the unit tests, which replace the database, could not see it. They also took the preparer, the status and
 * the PDF from the request, never stamped a finalization, never hashed the content, let a finalized or distributed packet be edited, and lost updates to a race.
 * This runs the unmodified routes and services against the combined Django + Drizzle schema, with only the request boundary replaced (see
 * native-route-harness.ts), and proves that
 *   - a packet is created as a draft prepared by the caller, in the caller's organization, whatever the body says, and is audited with it;
 *   - the list and a single read return the caller organization's packets, a handle with no organization sees none (why the routes open a tenant
 *     transaction), another organization's packet is "not found", and an archived packet is listed only when asked for;
 *   - finalizing records the time, the certifier and a hash that the stored row still matches; the content is then locked, and reopening clears the
 *     certification;
 *   - a finalize that races an edit never leaves a certification that does not match the stored content;
 *   - distribution goes only to active members of the organization, with the name and address on their membership record, renders from the certified content, refuses
 *     content that no longer matches its hash, commits with its audit, and a failed delivery is reported and audited without undoing it;
 *   - a distributed packet can only be archived, an archived packet is closed, and none of it is reachable from another organization.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const email = vi.hoisted(() => ({ sent: [] as Array<Record<string, unknown>>, failFor: new Set<string>() }))

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api/with-api', async () => ({ withApi: (await import('./native-route-harness')).emulatedWithApi }))
vi.mock('@/lib/services/messaging/email-service', () => ({
  getEmailService: () => ({
    send: async (message: { to: string } & Record<string, unknown>) => {
      if (email.failFor.has(message.to)) throw new Error('smtp down')
      email.sent.push(message)
      return { id: 'email-1' }
    },
  }),
}))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const list = URL ? await import('@/app/api/governance/board-packets/route') : null
const item = URL ? await import('@/app/api/governance/board-packets/[id]/route') : null
const distribution = URL ? await import('@/app/api/governance/board-packets/[id]/distribute/route') : null

type Row = Record<string, unknown>
type Handler = (ctx: unknown) => Promise<unknown>
const run = (handler: unknown, ctx: unknown) => (handler as Handler)(ctx)
const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as { code?: string; name?: string; message?: string })

describe.skipIf(!URL)('the board packet routes on the combined schema, as the real roles', () => {
  const tag = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const adminA = randomUUID()
  const officerA = randomUUID()
  const adminB = randomUUID()
  const member = { active: randomUUID(), second: randomUUID(), suspended: randomUUID(), removed: randomUUID(), otherOrg: randomUUID() }
  const asAdminA = { organizationId: ORG_A, userId: adminA }
  const asOfficerA = { organizationId: ORG_A, userId: officerA }
  const asAdminB = { organizationId: ORG_B, userId: adminB }
  let admin: pg.Client

  const sections = {
    financialSummary: { summary: `Dues revenue on plan ${tag}`, reservesCad: 125000 },
    membershipStats: { summary: 'Membership steady' },
    caseSummary: { summary: 'Twelve open grievances' },
    complianceStatus: { summary: 'Two filings outstanding' },
  }
  const packetBody = (overrides: Record<string, unknown> = {}) => ({
    title: `Q1 packet ${tag} ${randomUUID().slice(0, 6)}`,
    packetType: 'quarterly',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    fiscalYear: 2026,
    fiscalQuarter: 1,
    ...sections,
    actionItems: [{ item: 'File the T2 return', owner: 'Treasurer', deadline: '2026-04-30' }],
    recipientRoles: ['board_member'],
    ...overrides,
  })

  const create = (who: { organizationId: string; userId: string }, overrides: Record<string, unknown> = {}) => run(list!.POST, { ...who, body: packetBody(overrides) }) as Promise<Row>
  const read = (who: { organizationId: string; userId: string }, id: string) => run(item!.GET, { ...who, params: { id } }) as Promise<Row>
  const change = (who: { organizationId: string; userId: string }, id: string, body: unknown) => run(item!.PATCH, { ...who, params: { id }, body }) as Promise<Row>
  const archive = (who: { organizationId: string; userId: string }, id: string) => run(item!.DELETE, { ...who, params: { id } }) as Promise<Row>
  const distribute = async (who: { organizationId: string; userId: string }, id: string, recipients: Array<{ recipientId: string; recipientRole: string }>) => {
    const schema = (harness.configs.find((config) => 'body' in config) as unknown as { body: { parse: (value: unknown) => unknown } }).body
    const body = schema.parse({ recipients })
    const response = (await run(distribution!.POST, { ...who, params: { id }, body })) as Response
    return { status: response.status, body: (await response.json()) as Row }
  }
  const stored = async (id: string) => (await admin.query(`SELECT * FROM public.board_packets WHERE id = $1`, [id])).rows[0] as Row | undefined
  const distributions = async (id: string) => (await admin.query(`SELECT * FROM public.board_packet_distributions WHERE packet_id = $1 ORDER BY created_at, id`, [id])).rows as Row[]
  const auditsFor = (id: string) => harness.audits.filter((audit) => audit.resourceId === id).map((audit) => audit.action)
  const certificationIntact = async (id: string) => {
    const { boardPackets } = await import('@/db/schema/board-packet-schema')
    const { eq } = await import('drizzle-orm')
    const { boardPacketCertificationIntact } = await import('@/lib/governance/board-packet-lifecycle')
    const [row] = await harness.tenant(RUNTIME_ROLE, ORG_A, adminA, (tx) => tx.select().from(boardPackets).where(eq(boardPackets.id, id)))
    return boardPacketCertificationIntact(row)
  }
  const finalizedPacket = async (overrides: Record<string, unknown> = {}) => {
    const created = await create(asAdminA, overrides)
    await change(asAdminA, created.id as string, { status: 'finalized' })
    return created.id as string
  }

  const newOrganization = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, '-')}-${id}`],
    )
  const newMember = (userId: string, organizationId: string, name: string, address: string, status = 'active', deleted = false) =>
    admin.query(
      `INSERT INTO organization_members (user_id, organization_id, role, status, is_primary, name, email, joined_at, deleted_at, created_at, updated_at)
       VALUES ($1,$2,'member',$3,false,$4,$5,now(), ${deleted ? 'now()' : 'NULL'}, now(), now())`,
      [userId, organizationId, status, name, address],
    )

  beforeAll(async () => {
    admin = await harness.start(URL!)
    await newOrganization(ORG_A, `Packets A ${tag}`)
    await newOrganization(ORG_B, `Packets B ${tag}`)
    harness.setRole(adminA, ORG_A, 'admin')
    harness.setRole(officerA, ORG_A, 'officer')
    harness.setRole(adminB, ORG_B, 'admin')
    await newMember(member.active, ORG_A, 'Alice <Admin> Tremblay', `alice-${tag}@union.test`)
    await newMember(member.second, ORG_A, 'Bruno Gagnon', `bruno-${tag}@union.test`)
    await newMember(member.suspended, ORG_A, 'Suspended Member', `suspended-${tag}@union.test`, 'suspended')
    await newMember(member.removed, ORG_A, 'Removed Member', `removed-${tag}@union.test`, 'active', true)
    await newMember(member.otherOrg, ORG_B, 'Other Org Member', `other-${tag}@union.test`)
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('creating a packet', () => {
    it('stores a draft prepared by the caller in the caller organization, audits it with the packet, and keeps the sections as sent', async () => {
      const created = await create(asAdminA)
      const row = (await stored(created.id as string))!
      expect(row).toMatchObject({ organization_id: ORG_A, generated_by: adminA, status: 'draft', finalized_at: null, signed_by: null, signed_at: null, content_hash: null, pdf_url: null, distributed_at: null })
      expect(row.financial_summary).toEqual(sections.financialSummary)
      expect(row.action_items).toEqual([{ item: 'File the T2 return', owner: 'Treasurer', deadline: '2026-04-30' }])
      expect(row.period_start).toBeDefined()
      expect(auditsFor(created.id as string)).toEqual(['governance.board_packet.create'])
      expect(harness.audits.find((audit) => audit.resourceId === created.id)).toMatchObject({ organizationId: ORG_A, userId: adminA })
    })

    it('refuses a body that names the organization, the preparer, the status or the certification, and stores nothing', async () => {
      const title = `Forged ${tag}`
      for (const forged of [{ organizationId: ORG_B }, { generatedBy: officerA }, { status: 'distributed' }, { contentHash: 'a'.repeat(64) }, { pdfUrl: 'https://evil.test/a.pdf' }]) {
        expect(await rejection(create(asAdminA, { title, ...forged }))).toMatchObject({ name: 'ZodError' })
      }
      expect((await admin.query(`SELECT 1 FROM public.board_packets WHERE title = $1`, [title])).rowCount).toBe(0)
    })

    it('stores nothing when the audit cannot be written', async () => {
      const title = `Unaudited ${tag}`
      harness.failNextAudit()
      expect(await rejection(create(asAdminA, { title }))).toMatchObject({ message: 'audit sink unavailable' })
      expect((await admin.query(`SELECT 1 FROM public.board_packets WHERE title = $1`, [title])).rowCount).toBe(0)
    })

    it('needs an admin: an officer may read packets and may not create, change, archive or distribute one', async () => {
      const id = (await create(asAdminA)).id as string
      expect(await rejection(create(asOfficerA))).toMatchObject({ code: 'FORBIDDEN' })
      expect(await rejection(change(asOfficerA, id, { title: 'x' }))).toMatchObject({ code: 'FORBIDDEN' })
      expect(await rejection(archive(asOfficerA, id))).toMatchObject({ code: 'FORBIDDEN' })
      expect(await rejection(distribute(asOfficerA, id, [{ recipientId: member.active, recipientRole: 'board_member' }]))).toMatchObject({ code: 'FORBIDDEN' })
      expect((await read(asOfficerA, id)).id).toBe(id)
    })
  })

  describe('reading packets', () => {
    it('lists the caller organization\'s packets, newest first, with the real total and without sections or PDF', async () => {
      const listTag = `List ${randomUUID().slice(0, 6)}`
      const first = (await create(asAdminB, { title: `${listTag} one` })).id as string
      const second = (await create(asAdminB, { title: `${listTag} two` })).id as string
      const archived = (await create(asAdminB, { title: `${listTag} three` })).id as string
      await archive(asAdminB, archived)

      const page = (await run(list!.GET, { ...asAdminB, request: new Request('http://localhost/api/governance/board-packets') })) as { data: Row[]; pagination: Row }
      const mine = page.data.filter((row) => String(row.title).startsWith(listTag))
      expect(mine.map((row) => row.id)).toEqual([second, first])
      expect(page.pagination).toMatchObject({ page: 1, limit: 20 })
      expect(page.pagination.total).toBe(page.data.length)
      expect(Object.keys(mine[0])).not.toEqual(expect.arrayContaining(['financialSummary']))
      expect(mine[0]).toMatchObject({ status: 'draft', generatedBy: adminB })
      for (const heavy of ['financialSummary', 'caseSummary', 'actionItems', 'pdfUrl', 'distributionList']) expect(mine[0]).not.toHaveProperty(heavy)

      const archivedPage = (await run(list!.GET, { ...asAdminB, request: new Request('http://localhost/api/governance/board-packets?status=archived') })) as { data: Row[] }
      expect(archivedPage.data.map((row) => row.id)).toContain(archived)
      expect(page.data.map((row) => row.id)).not.toContain(archived)

      const paged = (await run(list!.GET, { ...asAdminB, request: new Request('http://localhost/api/governance/board-packets?limit=1&page=2') })) as { data: Row[]; pagination: Row }
      expect(paged.data).toHaveLength(1)
      expect(paged.pagination).toMatchObject({ page: 2, limit: 1 })
      expect(paged.pagination.totalPages).toBe(page.pagination.total)
    })

    it('does not show one organization another\'s packets, in the list or by id', async () => {
      const id = (await create(asAdminA, { title: `Private to A ${tag}` })).id as string
      const seenByB = (await run(list!.GET, { ...asAdminB, request: new Request('http://localhost/api/governance/board-packets?limit=100') })) as { data: Row[] }
      expect(seenByB.data.map((row) => row.id)).not.toContain(id)
      expect(await rejection(read(asAdminB, id))).toMatchObject({ code: 'NOT_FOUND' })
      expect((await read(asAdminA, id)).title).toBe(`Private to A ${tag}`)
    })

    it('answers not found, not a server fault, for an id that is not a uuid or names nothing', async () => {
      expect(await rejection(read(asAdminA, 'bp_1'))).toMatchObject({ code: 'NOT_FOUND' })
      expect(await rejection(read(asAdminA, randomUUID()))).toMatchObject({ code: 'NOT_FOUND' })
      expect(await rejection(change(asAdminA, 'bp_1', { title: 'x' }))).toMatchObject({ code: 'NOT_FOUND' })
      expect(await rejection(archive(asAdminA, randomUUID()))).toMatchObject({ code: 'NOT_FOUND' })
    })

    it('is why the routes open a tenant transaction: a handle with no organization sees no packet', async () => {
      const { boardPackets } = await import('@/db/schema/board-packet-schema')
      const unscoped = await harness.tenant(RUNTIME_ROLE, null, adminA, (tx) => tx.select().from(boardPackets))
      expect(unscoped).toEqual([])
      const scoped = await harness.tenant(RUNTIME_ROLE, ORG_A, adminA, (tx) => tx.select().from(boardPackets))
      expect(scoped.length).toBeGreaterThan(0)
      expect(scoped.every((row) => row.organizationId === ORG_A)).toBe(true)
    })
  })

  describe('the lifecycle', () => {
    it('edits a draft, audits the edit, and leaves everything else as it was', async () => {
      const created = await create(asAdminA)
      const id = created.id as string
      const before = (await stored(id))!
      const edited = await change(asAdminA, id, { title: `Renamed ${tag}`, caseSummary: { summary: 'Fourteen open grievances' } })
      expect(edited).toMatchObject({ id, title: `Renamed ${tag}`, status: 'draft' })
      const after = (await stored(id))!
      expect(after.title).toBe(`Renamed ${tag}`)
      expect(after.case_summary).toEqual({ summary: 'Fourteen open grievances' })
      expect(after.financial_summary).toEqual(before.financial_summary)
      expect(after.generated_by).toBe(adminA)
      expect(new Date(after.updated_at as string).getTime()).toBeGreaterThanOrEqual(new Date(before.updated_at as string).getTime())
      expect(auditsFor(id)).toEqual(['governance.board_packet.create', 'board_packet.update'])
    })

    it('finalizes with the time, the certifier and a hash the stored content still matches', async () => {
      const id = (await create(asAdminA)).id as string
      const finalized = await change(asAdminA, id, { status: 'finalized' })
      const row = (await stored(id))!
      expect(finalized).toMatchObject({ status: 'finalized', signedBy: adminA })
      expect(row).toMatchObject({ status: 'finalized', signed_by: adminA })
      expect(row.finalized_at).not.toBeNull()
      expect(row.signed_at).not.toBeNull()
      expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(await certificationIntact(id)).toBe(true)
      expect(harness.audits.find((audit) => audit.resourceId === id && audit.action === 'board_packet.finalize')?.details).toMatchObject({ contentHash: row.content_hash })
    })

    it('locks a finalized packet\'s content: an edit is a conflict and changes nothing', async () => {
      const id = await finalizedPacket()
      const before = (await stored(id))!
      expect(await rejection(change(asAdminA, id, { title: 'Edited after certification' }))).toMatchObject({ code: 'CONFLICT' })
      expect(await rejection(change(asAdminA, id, { financialSummary: { summary: 'Quietly revised' } }))).toMatchObject({ code: 'CONFLICT' })
      const after = (await stored(id))!
      expect(after.title).toBe(before.title)
      expect(after.financial_summary).toEqual(before.financial_summary)
      expect(after.content_hash).toBe(before.content_hash)
      expect(auditsFor(id).filter((action) => action === 'board_packet.update')).toEqual([])
    })

    it('reopens a finalized packet with its certification cleared, and certifies the corrected content afresh', async () => {
      const id = await finalizedPacket()
      const first = (await stored(id))!
      expect(await rejection(change(asAdminA, id, { status: 'draft', title: 'Corrected' }))).toMatchObject({ code: 'CONFLICT' })

      await change(asAdminA, id, { status: 'draft' })
      const reopened = (await stored(id))!
      expect(reopened).toMatchObject({ status: 'draft', finalized_at: null, signed_by: null, signed_at: null, content_hash: null })
      expect(harness.audits.find((audit) => audit.resourceId === id && audit.action === 'board_packet.reopen')?.details).toMatchObject({ previousContentHash: first.content_hash })

      await change(asAdminA, id, { title: 'Corrected title' })
      await change(asAdminA, id, { status: 'finalized' })
      const second = (await stored(id))!
      expect(second.status).toBe('finalized')
      expect(second.content_hash).not.toBe(first.content_hash)
      expect(await certificationIntact(id)).toBe(true)
    })

    it('never leaves a certification that does not match the stored content when a finalize races an edit', async () => {
      const outcomes = new Set<string>()
      for (let round = 0; round < 12; round += 1) {
        const id = (await create(asAdminA)).id as string
        const settled = await Promise.allSettled([change(asAdminA, id, { status: 'finalized' }), change(asAdminA, id, { title: `Raced edit ${round} ${tag}` })])
        const row = (await stored(id))!
        outcomes.add(`${row.status}/${settled.map((result) => result.status).join(',')}`)
        if (row.status === 'finalized') expect(await certificationIntact(id)).toBe(true)
        // An edit that lost the race was refused as a conflict, never silently applied after the hash was taken.
        for (const result of settled) if (result.status === 'rejected') expect((result.reason as { code?: string }).code).toBe('CONFLICT')
      }
      expect(outcomes.size).toBeGreaterThan(0)
    })

    it('rolls the update back with its audit: a finalize whose audit fails certifies nothing', async () => {
      const id = (await create(asAdminA)).id as string
      harness.failNextAudit()
      expect(await rejection(change(asAdminA, id, { status: 'finalized' }))).toMatchObject({ message: 'audit sink unavailable' })
      expect(await stored(id)).toMatchObject({ status: 'draft', content_hash: null, signed_by: null })
    })

    it('archives a packet without removing it, and an archived packet is closed', async () => {
      const id = (await create(asAdminA)).id as string
      const archived = await archive(asAdminA, id)
      expect(archived).toMatchObject({ id, status: 'archived' })
      expect(await stored(id)).toMatchObject({ status: 'archived' })
      expect(await rejection(change(asAdminA, id, { title: 'Reviving' }))).toMatchObject({ code: 'CONFLICT' })
      expect(await rejection(change(asAdminA, id, { status: 'draft' }))).toMatchObject({ code: 'CONFLICT' })

      const archivedAudits = auditsFor(id).filter((action) => action === 'board_packet.archive')
      expect(archivedAudits).toHaveLength(1)
      expect(await archive(asAdminA, id)).toMatchObject({ id, status: 'archived' })
      expect(auditsFor(id).filter((action) => action === 'board_packet.archive')).toHaveLength(1)
    })

    it('refuses a period that ends before it starts, and a status the routes do not set', async () => {
      const id = (await create(asAdminA)).id as string
      expect(await rejection(change(asAdminA, id, { periodEnd: '2025-12-31' }))).toMatchObject({ code: 'VALIDATION_ERROR' })
      expect(await rejection(change(asAdminA, id, { status: 'distributed' }))).toMatchObject({ name: 'ZodError' })
      expect(await rejection(change(asAdminA, id, {}))).toMatchObject({ name: 'ZodError' })
      expect(await stored(id)).toMatchObject({ status: 'draft' })
    })
  })

  describe('distribution', () => {
    it('sends a finalized packet to an active member with the name and address on the membership record, and commits it with its audit', async () => {
      const id = await finalizedPacket({ title: `Distribute <me> ${tag}` })
      email.sent.length = 0
      const { status, body } = await distribute(asAdminA, id, [
        { recipientId: member.active, recipientRole: 'board_member' },
        { recipientId: member.second, recipientRole: 'auditor' },
      ])

      expect(status).toBe(200)
      expect(body).toMatchObject({ message: 'Board packet distributed successfully', stats: { totalRecipients: 2, sent: 2, failed: 0 } })
      const rows = await distributions(id)
      expect(rows.map((row) => ({ recipient: row.recipient_id, name: row.recipient_name, email: row.recipient_email, role: row.recipient_role, method: row.delivery_method }))).toEqual(
        expect.arrayContaining([
          { recipient: member.active, name: 'Alice <Admin> Tremblay', email: `alice-${tag}@union.test`, role: 'board_member', method: 'email' },
          { recipient: member.second, name: 'Bruno Gagnon', email: `bruno-${tag}@union.test`, role: 'auditor', method: 'email' },
        ]),
      )

      const row = (await stored(id))!
      expect(row.status).toBe('distributed')
      expect(row.distributed_at).not.toBeNull()
      expect(String(row.pdf_url)).toMatch(/^data:application\/pdf;base64,/)
      expect(Buffer.from(String(row.pdf_url).split(',')[1], 'base64').subarray(0, 5).toString()).toBe('%PDF-')
      expect(row.distribution_list).toHaveLength(2)
      expect(harness.audits.find((audit) => audit.resourceId === id && audit.action === 'board_packet.distribute')?.details).toMatchObject({ recipientIds: [member.active, member.second], contentHash: row.content_hash })

      expect(email.sent.map((message) => message.to).sort()).toEqual([`alice-${tag}@union.test`, `bruno-${tag}@union.test`])
      const mail = email.sent.find((message) => message.to === `alice-${tag}@union.test`)!
      expect(String(mail.html)).toContain('Hello Alice &lt;Admin&gt; Tremblay,')
      expect(String(mail.html)).toContain(`Distribute &lt;me&gt; ${tag}`)
      expect(String(mail.html)).not.toContain('<me>')
    })

    it('refuses a draft, and distributes nothing', async () => {
      const id = (await create(asAdminA)).id as string
      email.sent.length = 0
      expect(await rejection(distribute(asAdminA, id, [{ recipientId: member.active, recipientRole: 'board_member' }]))).toMatchObject({ code: 'CONFLICT' })
      expect(await distributions(id)).toEqual([])
      expect(email.sent).toEqual([])
    })

    it('refuses a recipient who is suspended, removed, a member of another organization or no member at all, and distributes to nobody', async () => {
      const id = await finalizedPacket()
      email.sent.length = 0
      for (const recipientId of [member.suspended, member.removed, member.otherOrg, randomUUID()]) {
        expect(await rejection(distribute(asAdminA, id, [{ recipientId: member.active, recipientRole: 'board_member' }, { recipientId, recipientRole: 'board_member' }]))).toMatchObject({ code: 'VALIDATION_ERROR' })
      }
      expect(await distributions(id)).toEqual([])
      expect(await stored(id)).toMatchObject({ status: 'finalized' })
      expect(email.sent).toEqual([])
    })

    it('refuses a finalized packet whose content no longer matches its certification', async () => {
      const id = await finalizedPacket()
      await admin.query(`UPDATE public.board_packets SET title = 'Altered behind the application''s back' WHERE id = $1`, [id])
      expect(await certificationIntact(id)).toBe(false)
      email.sent.length = 0
      expect(await rejection(distribute(asAdminA, id, [{ recipientId: member.active, recipientRole: 'board_member' }]))).toMatchObject({ code: 'CONFLICT' })
      expect(await distributions(id)).toEqual([])
      expect(await stored(id)).toMatchObject({ status: 'finalized', pdf_url: null })
      expect(email.sent).toEqual([])
    })

    it('records nothing and sends nothing when the audit cannot be written', async () => {
      const id = await finalizedPacket()
      email.sent.length = 0
      harness.failNextAudit()
      expect(await rejection(distribute(asAdminA, id, [{ recipientId: member.active, recipientRole: 'board_member' }]))).toMatchObject({ message: 'audit sink unavailable' })
      expect(await distributions(id)).toEqual([])
      expect(await stored(id)).toMatchObject({ status: 'finalized', distributed_at: null, pdf_url: null })
      expect(email.sent).toEqual([])
    })

    it('reports a failed delivery and audits it, and keeps the distribution it recorded', async () => {
      const id = await finalizedPacket()
      email.sent.length = 0
      email.failFor.add(`bruno-${tag}@union.test`)
      try {
        const { body } = await distribute(asAdminA, id, [
          { recipientId: member.active, recipientRole: 'board_member' },
          { recipientId: member.second, recipientRole: 'board_member' },
        ])
        expect(body).toMatchObject({ message: 'Board packet distribution recorded; delivery failed for some recipients', stats: { totalRecipients: 2, sent: 1, failed: 1 } })
      } finally {
        email.failFor.clear()
      }
      expect(await distributions(id)).toHaveLength(2)
      expect(await stored(id)).toMatchObject({ status: 'distributed' })
      expect(harness.audits.find((audit) => audit.resourceId === id && audit.action === 'board_packet.distribute.delivery_failed')?.details).toEqual({ failedRecipientIds: [member.second] })
    })

    it('makes a distributed packet the record of what was sent: it can only be archived', async () => {
      const id = await finalizedPacket()
      await distribute(asAdminA, id, [{ recipientId: member.active, recipientRole: 'board_member' }])
      const sent = (await stored(id))!
      expect(await rejection(change(asAdminA, id, { title: 'Rewriting history' }))).toMatchObject({ code: 'CONFLICT' })
      expect(await rejection(change(asAdminA, id, { status: 'draft' }))).toMatchObject({ code: 'CONFLICT' })
      expect(await rejection(change(asAdminA, id, { status: 'finalized' }))).toMatchObject({ code: 'CONFLICT' })
      expect(await stored(id)).toMatchObject({ title: sent.title, status: 'distributed', content_hash: sent.content_hash })
      expect(await archive(asAdminA, id)).toMatchObject({ status: 'archived' })
      expect(await distributions(id)).toHaveLength(1)
    })

    it('is not reachable from another organization: nothing is read, changed, archived or sent', async () => {
      const id = await finalizedPacket()
      const before = (await stored(id))!
      email.sent.length = 0
      expect(await rejection(read(asAdminB, id))).toMatchObject({ code: 'NOT_FOUND' })
      expect(await rejection(change(asAdminB, id, { status: 'draft' }))).toMatchObject({ code: 'NOT_FOUND' })
      expect(await rejection(archive(asAdminB, id))).toMatchObject({ code: 'NOT_FOUND' })
      expect(await rejection(distribute(asAdminB, id, [{ recipientId: member.otherOrg, recipientRole: 'board_member' }]))).toMatchObject({ code: 'NOT_FOUND' })
      expect(await stored(id)).toEqual(before)
      expect(await distributions(id)).toEqual([])
      expect(email.sent).toEqual([])
    })
  })
})
