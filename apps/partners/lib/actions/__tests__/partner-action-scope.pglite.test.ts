import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const facts = vi.hoisted(() => ({
  actorId: 'user:partner-a' as string | null, roles: new Set<string>(),
  execute: vi.fn<(statement: SQL) => Promise<unknown>>(), ai: vi.fn(), ml: vi.fn(), extraction: vi.fn(), evidence: vi.fn(),
  failWrite: false, revokeAtWrite: false,
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: async () => ({ userId: facts.actorId, has: ({ role }: { role: string }) => facts.roles.has(role) }),
  currentUser: async () => ({ id: facts.actorId, primaryEmailAddress: { emailAddress: 'unprivileged-fixture@example.invalid' } }),
}))
vi.mock('@nzila/db/platform', () => ({ platformDb: { execute: facts.execute } }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/ai-client', () => ({ runAICompletionDetailed: facts.ai, runAIExtractionDetailed: facts.extraction }))
vi.mock('@/lib/ml-client', () => ({ runPredictionDetailed: facts.ml }))
vi.mock('@/lib/evidence', () => ({ buildPartnerEvidencePack: facts.evidence }))

import { resolveOrgContext } from '../../resolve-org'
import { dealRootScope } from '../../partner-action-scope'
import { requirePartnerEntityAccess, resolvePartnerEntityIdForView } from '../../partner-auth'
import { createDeal, getDealStats, listDeals, updateDealStage } from '../deal-actions'
import { approveCommissionPayout, createCommission, getCommissionSummary, listCommissions } from '../commission-actions'
import { completeModule, getCertProgress } from '../certification-actions'
import { getPlatformAnalytics, updateAdminSettings } from '../admin-actions'
import { extractDealFromEmail, forecastCommissions, recommendCertification, scoreDeal } from '../ai-deal-actions'

const id = (group: number, n: number) => `${group}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const partnerA = id(1, 1), partnerB = id(1, 2), orgA = id(2, 1), orgB = id(2, 2)
const dealA = id(3, 1), dealB = id(3, 2), eventA = id(4, 1), eventB = id(4, 2), commissionA = id(5, 1)
let db: PGlite
const dialect = new PgDialect()
const telemetry = { modelUsed: 'fixture', provider: 'ai', engineVersion: 'fixture:1' }

async function operator(statement: string, params: unknown[] = []) {
  await db.exec('RESET ROLE')
  try { return await db.query(statement, params) } finally { await db.exec('SET ROLE partner_action_fixture') }
}
async function changes() {
  return (await db.query<{ action: string; actor_id: string; org_id: string | null; metadata: Record<string, unknown> }>(
    "SELECT action,actor_id,org_id,metadata FROM audit_log WHERE id NOT IN ($1,$2,$3) ORDER BY created_at,id", [eventA, eventB, commissionA])).rows
}

describe('Partners purpose, relationship and resource boundaries (restricted SQL-engine component)', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`CREATE ROLE partner_action_fixture NOLOGIN NOSUPERUSER NOBYPASSRLS;
      CREATE TABLE orgs(id uuid PRIMARY KEY,status text NOT NULL);
      CREATE TABLE partners(id uuid PRIMARY KEY,tier text,status text,company_name text,created_at timestamptz DEFAULT now());
      CREATE TABLE partner_users(partner_id uuid REFERENCES partners(id),user_id text);
      CREATE TABLE partner_entities(partner_id uuid REFERENCES partners(id),org_id text,allowed_views jsonb,expires_at timestamptz);
      CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),action text,actor_id text,entity_type text,
        org_id uuid,metadata jsonb,created_at timestamptz DEFAULT now());
      GRANT USAGE ON SCHEMA public TO partner_action_fixture;
      GRANT SELECT ON orgs,partners,partner_users,partner_entities,audit_log TO partner_action_fixture;
      GRANT INSERT ON audit_log TO partner_action_fixture;`)
    facts.execute.mockImplementation(async (statement: SQL) => {
      const { sql, params } = dialect.sqlToQuery(statement)
      if (facts.failWrite && /INSERT INTO (?:public\.)?audit_log/.test(sql)) throw new Error('fixture write unavailable')
      if (facts.revokeAtWrite && /INSERT INTO (?:public\.)?audit_log/.test(sql)) {
        facts.revokeAtWrite = false
        await operator('DELETE FROM partner_users WHERE user_id=$1', [facts.actorId])
      }
      return (await db.query(sql, params)).rows
    })
  })
  afterAll(async () => { await db?.close() })
  beforeEach(async () => {
    facts.actorId = 'user:partner-a'; facts.roles.clear(); facts.failWrite = false; facts.revokeAtWrite = false
    facts.ai.mockReset().mockResolvedValue({ content: JSON.stringify({ dealId: dealB, score: 73, forecasted: 7, partnerId: partnerB }), execution: telemetry })
    facts.ml.mockReset().mockResolvedValue({ data: null, execution: null })
    facts.extraction.mockReset().mockResolvedValue({ data: { accountName: 'Extracted' }, execution: telemetry })
    facts.evidence.mockReset().mockResolvedValue({})
    await db.exec('RESET ROLE; TRUNCATE audit_log,partner_entities,partner_users,partners,orgs CASCADE;')
    await db.query('INSERT INTO orgs VALUES ($1,$3),($2,$3)', [orgA, orgB, 'active'])
    await db.query("INSERT INTO partners(id,tier,status,company_name) VALUES ($1,'registered','active','Partner A'),($2,'elite','active','Partner B')", [partnerA, partnerB])
    await db.query('INSERT INTO partner_users VALUES ($1,$3),($2,$4)', [partnerA, partnerB, 'user:partner-a', 'user:partner-b'])
    await db.query(`INSERT INTO partner_entities VALUES ($1,$3,'["ml:summary"]',NULL),($2,$4,'["ml:summary"]',NULL)`, [partnerA, partnerB, orgA, orgB])
    for (const [event, deal, actor, account] of [[eventA, dealA, 'user:partner-a', 'Account A'], [eventB, dealB, 'user:partner-b', 'FOREIGN_SECRET']])
      await db.query("INSERT INTO audit_log(id,action,actor_id,entity_type,org_id,metadata) VALUES ($1,'deal.registered',$2,'deal',$3,$4::jsonb)",
        [event, actor, deal, JSON.stringify({ partnerId: actor, stage: 'submitted', accountName: account, estimatedArr: 100 })])
    await db.query("INSERT INTO audit_log(id,action,actor_id,entity_type,org_id,metadata) VALUES ($1,'commission.created','operator','commission',$1,$2::jsonb)",
      [commissionA, JSON.stringify({ partnerId: partnerA, dealId: dealA, accountName: 'Account A', baseAmount: 10, multiplier: 1, finalAmount: 10, status: 'pending' })])
    await db.exec('SET ROLE partner_action_fixture')
    facts.execute.mockClear()
  })

  it('uses a restricted SQL role and preserves distinct legacy event and resource identities', async () => {
    expect((await db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows).toEqual([{ rolsuper: false, rolbypassrls: false }])
    const context = await resolveOrgContext({ scope: 'partner' })
    expect(context).toMatchObject({ scope: 'partner', actorId: 'user:partner-a', orgId: null, partner: { id: partnerA } })
    expect(Object.isFrozen(context)).toBe(true)
    expect(Object.isFrozen(context.partner)).toBe(true)
    const result = await listDeals()
    expect(result.deals.map(deal => deal.id)).toEqual([dealA])
    expect(result.deals[0].id).not.toBe(eventA)
    expect(result.total).toBe(1)
    expect((await getDealStats()).submitted).toBe(1)
    expect((await listCommissions()).commissions.map(row => row.id)).toEqual([commissionA])
  })

  it('denies foreign partner IDs, child/root substitution and forged contexts before writes or providers', async () => {
    await expect(listCommissions({ partnerId: partnerB })).rejects.toThrow('Active partner membership')
    await expect(updateDealStage(dealB, 'won')).rejects.toThrow('Deal not found')
    await expect(scoreDeal(dealB)).rejects.toThrow('Deal not found')
    await expect(forecastCommissions(partnerB)).rejects.toThrow('Active partner membership')
    await expect(recommendCertification(partnerB)).rejects.toThrow('Active partner membership')
    expect(() => Reflect.apply(dealRootScope, null, [{ scope: 'platform', actorId: 'forged', orgId: null }])).toThrow('resolved partner action context')
    expect(await changes()).toEqual([])
    expect(facts.ml).not.toHaveBeenCalled(); expect(facts.ai).not.toHaveBeenCalled()
    const personal = await resolveOrgContext({ scope: 'personal' })
    expect(() => Reflect.apply(dealRootScope, null, [personal])).toThrow('actual resource purpose')
  })

  it('does not adopt another colleague\'s personal legacy roots through current company membership', async () => {
    await operator('INSERT INTO partner_users VALUES ($1,$2)', [partnerA, 'new:colleague'])
    facts.actorId = 'new:colleague'
    expect((await listDeals()).deals).toEqual([])
    expect((await listCommissions()).commissions).toEqual([])
  })

  it('does not grant a commissioned foreign deal because a child copies the caller partner ID', async () => {
    await operator("INSERT INTO audit_log(action,actor_id,entity_type,org_id,metadata) VALUES ('commission.created','operator','commission',$1,$2::jsonb)",
      [id(5, 2), JSON.stringify({ dealId: dealB, partnerId: partnerA, finalAmount: 999, status: 'pending' })])
    expect((await listCommissions()).total).toBe(1)
    expect((await getCommissionSummary()).totalEarned).toBe(10)
    await expect(getCommissionSummary('elite')).rejects.toThrow('current partner record')
  })

  it('uses immutable root identity for new writes and keeps historical rows untouched', async () => {
    const before = (await db.query('SELECT * FROM audit_log WHERE id=$1', [eventA])).rows
    const created = await createDeal({ accountName: 'New', contactName: 'Contact', contactEmail: 'contact@example.invalid', vertical: 'finance', estimatedArr: 50, expectedCloseDate: '2027-01-01' })
    expect(created.success).toBe(true)
    const [stored] = (await db.query<{ id: string; org_id: null; metadata: { dealId: string; partnerId: string } }>('SELECT id,org_id,metadata FROM audit_log WHERE id=$1', [created.dealId])).rows
    expect(stored.org_id).toBeNull(); expect(stored.metadata).toMatchObject({ dealId: stored.id, partnerId: partnerA })
    expect(await updateDealStage(dealA, 'won')).toEqual({ success: true })
    expect((await listDeals()).deals.find(deal => deal.id === dealA)?.stage).toBe('won')
    expect((await db.query('SELECT * FROM audit_log WHERE id=$1', [eventA])).rows).toEqual(before)
    expect(facts.evidence).not.toHaveBeenCalled()
  })

  it('denies ambiguous same-ID historical roots and ordinary approval/admin/payout authority', async () => {
    await operator("INSERT INTO audit_log(action,actor_id,entity_type,org_id,metadata) VALUES ('deal.registered','user:partner-b','deal',$1,$2::jsonb)",
      [dealA, JSON.stringify({ partnerId: 'user:partner-b' })])
    await expect(updateDealStage(dealA, 'won')).rejects.toThrow('Deal not found')
    await expect(updateDealStage(dealA, 'approved')).rejects.toThrow('platform admin')
    await expect(approveCommissionPayout(commissionA)).rejects.toThrow('platform admin')
    await expect(getPlatformAnalytics()).rejects.toThrow('platform admin')
    expect(facts.execute.mock.calls.every(([query]: [SQL]) => !dialect.sqlToQuery(query).sql.includes('INSERT'))).toBe(true)
  })

  it.each(['platform:admin', 'platform:ops', 'platform:finance'])('preserves established global privilege %s without making a fake organization', async role => {
    facts.roles.add(role)
    expect((await listDeals()).deals).toHaveLength(2)
    expect((await getPlatformAnalytics()).totalDeals).toBe(2)
    expect(await approveCommissionPayout(commissionA)).toEqual({ success: true })
    const [approval] = await changes()
    expect(approval.org_id).toBeNull()
    expect(approval.metadata).toMatchObject({ resourceId: commissionA, dealId: dealA, partnerId: partnerA, status: 'approved' })
    expect(approval.metadata).not.toHaveProperty('paidAt')
    expect(await approveCommissionPayout(commissionA)).toEqual({ success: true })
    expect(await changes()).toHaveLength(1)
  })

  it('checks exact commission parent/tier and writes only after actual platform authority', async () => {
    const input = { dealId: dealA, partnerId: partnerA, accountName: 'Account A', baseAmount: 10, partnerTier: 'registered' }
    await expect(createCommission(input)).rejects.toThrow('platform admin')
    facts.roles.add('platform:finance')
    await expect(createCommission({ ...input, partnerId: partnerB })).rejects.toThrow('parent and partner')
    await expect(createCommission({ ...input, partnerTier: 'elite' })).rejects.toThrow('parent and partner')
    expect(await createCommission(input)).toEqual({ success: true })
    expect((await changes()).map(row => ({ org: row.org_id, partner: row.metadata.partnerId, multiplier: row.metadata.multiplier })))
      .toEqual([{ org: null, partner: partnerA, multiplier: 1 }])
  })

  it('records personal learning progress with no tenant or institutional evidence claim', async () => {
    expect(await completeModule('fundamentals', 4)).toEqual({ success: true })
    const [stored] = await changes()
    expect(stored).toMatchObject({ actor_id: 'user:partner-a', org_id: null, metadata: { recordType: 'personal_course_progress', trackId: 'fundamentals' } })
    expect((await getCertProgress()).tracks[0].completedModules).toBe(5)
    facts.actorId = 'user:partner-b'
    expect((await getCertProgress()).tracks[0].completedModules).toBe(0)
    expect(facts.evidence).not.toHaveBeenCalled()
    expect(await completeModule('fundamentals', 999)).toEqual({ success: false })
  })

  it('requires actual active partners, current view/expiry and a real organization before provider use', async () => {
    await operator("UPDATE partners SET status='suspended' WHERE id=$1", [partnerA])
    await expect(extractDealFromEmail('private text')).rejects.toThrow('Active partner membership')
    await operator("UPDATE partners SET status='active' WHERE id=$1", [partnerA])
    for (const expiry of ["'2000-01-01'", "'infinity'"]) {
      await operator(`UPDATE partner_entities SET expires_at=${expiry} WHERE partner_id=$1`, [partnerA])
      await expect(extractDealFromEmail('private text')).rejects.toThrow('ml:summary')
    }
    await operator("UPDATE partner_entities SET expires_at=NULL,org_id='not-a-real-organization' WHERE partner_id=$1", [partnerA])
    await expect(extractDealFromEmail('private text')).rejects.toThrow('ml:summary')
    expect(facts.extraction).not.toHaveBeenCalled()
  })

  it('selects a valid later entity grant and binds provider/output/evidence to the real organization', async () => {
    await operator("INSERT INTO partner_entities VALUES ($1,$2,'[]',NULL)", [partnerA, orgB])
    expect(await resolvePartnerEntityIdForView('ml:summary')).toBe(orgA)
    expect(await requirePartnerEntityAccess(orgB, 'ml:summary')).toMatchObject({ ok: false, status: 403 })
    facts.ml.mockResolvedValue({ data: { dealId: dealB, score: 99 }, execution: telemetry })
    const score = await scoreDeal(dealA)
    expect(score).toMatchObject({ dealId: dealA, org_id: orgA, score: 73 })
    expect(facts.ml).toHaveBeenCalledWith(expect.objectContaining({ orgId: orgA, features: { dealId: dealA } }))
    expect(facts.ai.mock.calls[0][0]).toContain('Account A')
    expect(facts.ai.mock.calls[0][0]).not.toContain('FOREIGN_SECRET')
    expect(await extractDealFromEmail('owned draft')).toMatchObject({ org_id: orgA })
    expect(facts.evidence).toHaveBeenCalledWith(expect.objectContaining({ orgId: orgA, executedBy: 'user:partner-a' }))
  })

  it('does not discard a later current partner with the exact entity view', async () => {
    await operator("UPDATE partner_entities SET allowed_views='[]' WHERE partner_id=$1", [partnerA])
    await operator('INSERT INTO partner_users VALUES ($1,$2)', [partnerB, 'user:partner-a'])
    expect(await resolvePartnerEntityIdForView('ml:summary')).toBe(orgB)
    expect(await requirePartnerEntityAccess(orgB, 'ml:summary')).toMatchObject({ ok: true, partner: { id: partnerB }, orgId: orgB })
    const created = await createDeal({ partnerId: partnerB, accountName: 'Selected B', contactName: 'Contact', contactEmail: 'contact@example.invalid', vertical: 'finance', estimatedArr: 50, expectedCloseDate: '2027-01-01' })
    expect(created.success).toBe(true)
    expect((await listDeals({ partnerId: partnerB })).deals.map(deal => deal.id)).toContain(created.dealId)
    expect(await extractDealFromEmail('owned draft', { partnerId: partnerB, orgId: orgB })).toMatchObject({ org_id: orgB })
  })

  it('preserves a historical paid record instead of rewriting it as an approval', async () => {
    await operator("INSERT INTO audit_log(action,actor_id,entity_type,org_id,metadata) VALUES ('commission.updated','operator','commission',$1,$2::jsonb)",
      [commissionA, JSON.stringify({ status: 'paid', paidAt: '2020-01-01T00:00:00Z' })])
    facts.roles.add('platform:finance')
    const before = await changes()
    await expect(approveCommissionPayout(commissionA)).rejects.toThrow('Only a pending commission')
    expect(await changes()).toEqual(before)
  })

  it('does not report a successful primary write when persistence fails', async () => {
    facts.failWrite = true
    expect(await completeModule('fundamentals', 0)).toEqual({ success: false })
    expect(await changes()).toEqual([])
    expect(facts.evidence).not.toHaveBeenCalled()
  })

  it('rechecks current membership in the actual mutation statement after context resolution', async () => {
    facts.revokeAtWrite = true
    expect(await createDeal({ accountName: 'New', contactName: 'Contact', contactEmail: 'contact@example.invalid', vertical: 'finance', estimatedArr: 50, expectedCloseDate: '2027-01-01' })).toEqual({ success: false })
    expect(await changes()).toEqual([])
    await operator('INSERT INTO partner_users VALUES ($1,$2)', [partnerA, 'user:partner-a'])
    facts.revokeAtWrite = true
    expect(await updateDealStage(dealA, 'won')).toEqual({ success: false })
    expect(await changes()).toEqual([])
  })

  it('keeps entity data scoped to the selected partner for a genuine global operator', async () => {
    facts.roles.add('platform:finance')
    const score = await scoreDeal(dealB)
    expect(score).toMatchObject({ dealId: dealB, org_id: orgB })
    expect(facts.ai.mock.calls[0][0]).toContain('FOREIGN_SECRET')
    expect(facts.ai.mock.calls[0][0]).not.toContain('Account A')
  })

  it('honors a selected canonical partner for global listings and counts', async () => {
    facts.actorId = 'user:partner-b'
    const created = await createDeal({ accountName: 'Canonical B', contactName: 'Contact', contactEmail: 'contact@example.invalid', vertical: 'finance', estimatedArr: 50, expectedCloseDate: '2027-01-01' })
    facts.actorId = 'user:partner-a'; facts.roles.add('platform:finance')
    expect((await listDeals({ partnerId: partnerB })).deals.map(deal => deal.id)).toEqual([created.dealId])
    expect((await getDealStats(partnerB)).submitted).toBe(1)
  })

  it('refuses unauthenticated personal/platform/partner operations before SQL', async () => {
    facts.actorId = null
    for (const work of [() => getCertProgress(), () => listDeals(), () => getPlatformAnalytics(),
      () => updateAdminSettings({ defaultCommissionRate: 1, dealProtectionDays: 1, autoApproveDeals: false, requireCertForTierUp: true, notificationEmail: '' })])
      await expect(work()).rejects.toThrow(/Unauthenticated|Unauthorized/)
    expect(facts.execute).not.toHaveBeenCalled()
    expect(facts.ai).not.toHaveBeenCalled()
  })
})
