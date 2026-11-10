/**
 * The workbook pages (/workbook/[id] and /workbook/[id]/memory-holders) on real PostgreSQL, as the real roles.
 *
 * Both pages read through the module-level handle with no context. On the runtime role `workbooks` is visible only to the user who claimed it,
 * so the pages answered "not found" for every workbook, the memory-holders page included for its own claimant; and the hub page had no authority
 * check at all (any identifier named its tier and status). They now read on the transaction the claimed-workbook boundary opens for the
 * resolved authority (`authority.tx`: the claimant's own user context, or the bounded system context for a steward of the claiming organization
 * and for the bearer of an unclaimed workbook's capability). This runs the unmodified pages, the boundary and the audit, with only the request
 * (the signed-in user, the capability cookie, the audit sink of claimed workbooks) replaced, and proves that
 *   - the hub renders for the claimant, a steward of the claiming organization and the bearer of an unclaimed workbook's capability, and is
 *     "not found" for a plain member, another organization's steward, an anonymous caller, a wrong or missing capability and an identifier that is no uuid;
 *   - the memory-holders page serves the claimant the names and notes and everyone else the projection that withholds them, records every
 *     read before it serves it, and serves nothing when the record cannot be written;
 *   - the same selects with no context show the runtime role no workbook, which is why the old reads found nothing.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertMember, insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const request = vi.hoisted(() => ({ userId: null as string | null, capability: null as string | null }))

process.env.PUBLIC_INTAKE_AUDIT_KEY = 'native-test-public-intake-audit-key-0123456789abcdef'

vi.mock('@/db/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
// The claimant's callback takes the transaction its user context opened: inside a context the ambient handle is that transaction.
vi.mock('@/db/tenant-context-storage', async (importOriginal) => {
  const { ambientDb } = await import('./native-savepoint-harness')
  return { ...(await importOriginal<typeof import('@/db/tenant-context-storage')>()), getActiveTenantDb: () => ambientDb }
})
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-savepoint-harness')).contextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-savepoint-harness')).recordAudit }))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => ({ userId: request.userId }) }))
vi.mock('@/lib/workbook/workbook-capability', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/workbook/workbook-capability')>()),
  readWorkbookCapabilityCookie: async () => request.capability,
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
// The organization lookup of a steward reads the selected-organization cookie; this caller has none.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }))
vi.mock('@/app/[locale]/workbook/[id]/memory-holders/MemoryHoldersClient', () => ({ default: () => null }))

const { savepointHarness, ambientDb, RUNTIME_ROLE } = await import('./native-savepoint-harness')
const capabilities = URL ? await import('@/lib/workbook/workbook-capability') : null
const consent = URL ? await import('@/lib/workbook/consent') : null
const notice = URL ? await import('@/lib/workbook/holder-notice') : null
const hub = URL ? (await import('@/app/[locale]/workbook/[id]/page')).default : null
const memoryHolders = URL ? (await import('@/app/[locale]/workbook/[id]/memory-holders/page')).default : null
const schema = URL ? await import('@/db/schema/workbook-schema') : null

describe.skipIf(!URL)('the workbook pages on the combined schema, as the real roles', () => {
  const tag = `wb${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const user = (name: string) => `u-${name}-${tag}`
  const U = { claimant: user('claimant'), steward: user('stewardA'), member: user('memberA'), stewardB: user('stewardB'), stranger: user('stranger') }
  const WB = { open: randomUUID(), bare: randomUUID(), claimed: randomUUID(), unknown: randomUUID() }
  let admin: pg.Client
  let openToken = ''

  const as = (userId: string | null, capability: string | null = null) => {
    request.userId = userId
    request.capability = capability
  }
  const params = (id: string) => ({ params: Promise.resolve({ locale: 'en', id }) })
  const hubPage = (id: string) => hub!(params(id))
  const holdersPage = (id: string) => memoryHolders!(params(id))
  const html = async (id: string) => renderToStaticMarkup(await hubPage(id))
  const notFound = async (run: () => Promise<unknown>) => expect(await run().then(() => 'served', (error: Error) => error.message)).toBe('NEXT_NOT_FOUND')
  const readsOf = (workbookId: string) =>
    savepointHarness.audits.filter((audit) => audit.action === 'workbook.memory_holder.read' && audit.details?.workbookId === workbookId)
  const holdersOf = async (id: string) => ((await holdersPage(id)) as { props: { initialHolders: Array<Record<string, unknown>> } }).props.initialHolders

  beforeAll(async () => {
    admin = await savepointHarness.start(URL!)
    await insertOrganization(admin, tag, { id: ORG_A })
    await insertOrganization(admin, tag, { id: ORG_B })
    await insertMember(admin, ORG_A, { userId: U.claimant, role: 'member' })
    await insertMember(admin, ORG_A, { userId: U.steward, role: 'steward' })
    await insertMember(admin, ORG_A, { userId: U.member, role: 'member' })
    await insertMember(admin, ORG_B, { userId: U.stewardB, role: 'steward' })

    const issued = capabilities!.issueWorkbookCapability()
    openToken = issued.token
    const workbook = (id: string, tier: string | null, claimedBy: string | null, claimedOrg: string | null, hash: string | null, expires: Date | null) =>
      admin.query(
        `INSERT INTO workbooks (id, status, report_tier_id, claimed_by_user_id, claimed_org_id, claimed_at, capability_token_hash, capability_token_expires_at, consent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [id, claimedBy ? 'active' : 'draft', tier, claimedBy, claimedOrg, claimedBy ? new Date() : null, hash, expires, JSON.stringify(consent!.issueWorkbookConsent())],
      )
    await workbook(WB.open, 'workbook_self_guided', null, null, issued.tokenHash, issued.expiresAt)
    await workbook(WB.bare, null, null, null, null, null)
    await workbook(WB.claimed, null, U.claimant, ORG_A, null, null)

    const holder = (workbookId: string, role: string, displayName: string, notes: string) =>
      admin.query(
        `INSERT INTO workbook_memory_holders (workbook_id, role, display_name, responsibility, notes, criticality, tenure_band) VALUES ($1, $2, $3, 'Keeps the history', $4, 'important', '7_15y')`,
        [workbookId, role, displayName, notes],
      )
    await holder(WB.claimed, `Archivist ${tag}`, `Alex Holder ${tag}`, `private note ${tag}`)
    await holder(WB.open, `Treasurer ${tag}`, `Blake Holder ${tag}`, `another note ${tag}`)
  }, 180_000)

  afterAll(async () => {
    await admin?.end()
    await savepointHarness.stop()
  })

  describe('the hub page', () => {
    it('shows an unclaimed workbook to the bearer of its capability, with its export for the paid tier', async () => {
      as(null, openToken)

      const page = await html(WB.open)

      expect(page).toContain('Your mapping workbook')
      expect(page).toContain(`/en/workbook/${WB.open}/memory-holders`)
      expect(page).toContain(`/api/workbook/${WB.open}/export`)
    })

    it('shows a claimed workbook to the user who claimed it and to a steward of the claiming organization, without the export of an unpaid tier', async () => {
      for (const who of [U.claimant, U.steward]) {
        as(who)
        const page = await html(WB.claimed)
        expect(page, who).toContain('Your mapping workbook')
        expect(page, who).not.toContain('/export')
      }
    })

    it('is not found for a workbook whose capability is missing, wrong, or was never issued', async () => {
      as(null, null)
      await notFound(() => hubPage(WB.open))
      as(null, 'not-the-capability')
      await notFound(() => hubPage(WB.open))
      as(null, openToken)
      await notFound(() => hubPage(WB.bare))
    })

    it('is not found for a claimed workbook by a plain member, another organization steward or an anonymous caller', async () => {
      for (const who of [U.member, U.stewardB, U.stranger, null]) {
        as(who, openToken)
        await notFound(() => hubPage(WB.claimed))
      }
    })

    it('is not found for an identifier that is no uuid, and for a workbook that does not exist', async () => {
      as(U.claimant)
      await notFound(() => hubPage('not-a-uuid'))
      await notFound(() => hubPage(WB.unknown))
    })

    it('finds no workbook with no context set, which is why the old read answered not found for everyone', async () => {
      const bare = await savepointHarness.context(RUNTIME_ROLE, null, null, async (tx) => (await tx.select().from(schema!.workbooks)).length)

      expect(bare).toBe(0)
      expect(await ambientDb.select().from(schema!.workbooks)).toEqual([])
    })
  })

  describe('the memory holders page', () => {
    it('serves the claimant the people the workbook names, with their names and notes, and records the read first', async () => {
      as(U.claimant)

      const holders = await holdersOf(WB.claimed)

      expect(holders).toHaveLength(1)
      expect(holders[0]).toMatchObject({ role: `Archivist ${tag}`, displayName: `Alex Holder ${tag}`, notes: `private note ${tag}` })
      expect(readsOf(WB.claimed).at(-1)).toMatchObject({
        organizationId: ORG_A,
        userId: U.claimant,
        resourceType: 'workbook_memory_holders',
        details: { workbookId: WB.claimed, authority: 'claimant', surface: 'page' },
      })
    })

    it('serves a steward of the claiming organization the holders with the identifying detail withheld, and records the read as that steward', async () => {
      as(U.steward)

      const holders = await holdersOf(WB.claimed)
      const expected = notice!.projectHolder(
        { id: 'x', role: `Archivist ${tag}`, displayName: `Alex Holder ${tag}`, responsibility: 'Keeps the history', tenureBand: '7_15y', criticality: 'important', successorIdentified: false, notes: `private note ${tag}`, noticeState: 'not_recorded', noticeEvidence: 'none' } as never,
        'same_org',
      )

      expect(holders[0]).toMatchObject({ role: `Archivist ${tag}`, displayName: expected.displayName, notes: expected.notes })
      expect(holders[0].displayName).not.toBe(`Alex Holder ${tag}`)
      expect(JSON.stringify(holders)).not.toContain(`private note ${tag}`)
      expect(readsOf(WB.claimed).at(-1)).toMatchObject({ userId: U.steward, organizationId: ORG_A, details: { authority: 'same_org' } })
    })

    it('serves the bearer of an unclaimed workbook capability its holders, withheld, and records the read in the public-intake audit', async () => {
      const before = Number((await admin.query(`SELECT count(*)::int AS n FROM public_intake_audit_events WHERE subject_kind = 'unclaimed_workbook'`)).rows[0].n)
      as(null, openToken)

      const holders = await holdersOf(WB.open)

      expect(holders).toHaveLength(1)
      expect(holders[0].role).toBe(`Treasurer ${tag}`)
      expect(JSON.stringify(holders)).not.toContain(`another note ${tag}`)
      expect(Number((await admin.query(`SELECT count(*)::int AS n FROM public_intake_audit_events WHERE subject_kind = 'unclaimed_workbook'`)).rows[0].n)).toBe(before + 1)
    })

    it('serves nothing, and records nothing, to a plain member, another organization steward, an anonymous caller or a bearer with the wrong capability', async () => {
      const reads = readsOf(WB.claimed).length
      for (const who of [U.member, U.stewardB, U.stranger, null]) {
        as(who, openToken)
        await notFound(() => holdersPage(WB.claimed))
      }
      as(null, 'not-the-capability')
      await notFound(() => holdersPage(WB.open))
      await notFound(() => holdersPage('not-a-uuid'))

      expect(readsOf(WB.claimed)).toHaveLength(reads)
    })

    it('serves nothing when the record of the read cannot be written', async () => {
      as(U.claimant)
      savepointHarness.failNextAudit()

      const outcome = await holdersPage(WB.claimed).then(() => 'served', (error: Error) => error.message)

      expect(outcome).toBe('audit sink unavailable')
    })
  })
})
