import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { RLSTx } from '@/lib/db/with-rls-context'

const state = vi.hoisted(() => ({ permissions: new Set<string>(), handlers: new Set<string>(), failAudit: false, failSchedule: false }))
vi.mock('@/lib/cases/case-authorization', () => ({
  findReadableCase: async (tx: RLSTx, actor: { userId: string; organizationId: string }, id: string) => {
    const { sql } = await import('drizzle-orm')
    const result = await tx.execute(sql`SELECT id::text, claim_id::text AS "claimId" FROM claims WHERE claim_id=${id}::uuid AND organization_id=${actor.organizationId}::uuid`)
    return state.permissions.has(actor.userId+':'+id+':case:read') ? result[0] ?? null : null
  },
  requireCaseFilingCapacity: async (_tx: unknown, actor: { userId: string }) => {
    if (!state.handlers.has(actor.userId)) { const { ApiError } = await import('@/lib/api/errors'); throw ApiError.forbidden() }
  },
}))
vi.mock('@/lib/authority/store/route-adapter', () => ({ decideCase: async (_tx: unknown, request: { userId: string; caseId: string; action: string }) => ({ effect: state.permissions.has(request.userId+':'+request.caseId+':'+request.action) ? 'allow' : 'deny' }) }))
vi.mock('@/lib/authority/store/executor', () => ({ isUuid: (value: string) => /^[a-f0-9-]{36}$/.test(value) }))
vi.mock('@/lib/deadline-engine/organization-time-zone', () => ({ loadOrganizationTimeZone: async () => ({ timeZone: 'America/Toronto' }) }))
vi.mock('@/lib/deadline-engine/audit', () => ({ writeDeadlineAuditEvent: async (value: unknown, tx: RLSTx) => {
  if (state.failAudit) throw new Error('audit unavailable')
  const { sql } = await import('drizzle-orm'); await tx.execute(sql`INSERT INTO audit_log(payload) VALUES(${JSON.stringify(value)}::jsonb)`)
} }))
vi.mock('@/lib/deadline-engine/reminder-scheduler', () => ({ scheduleGrievanceDeadlineReminders: vi.fn(async () => { if (state.failSchedule) throw new Error('scheduler unavailable') }) }))
import { CreateCaseDeadline, ChangeCaseDeadline } from './case-deadline-contract'
import { createCaseDeadline, changeCaseDeadline, listCaseDeadlines } from './case-deadlines'
import { scheduleGrievanceDeadlineReminders } from '@/lib/deadline-engine/reminder-scheduler'

const org='11111111-1111-4111-8111-111111111111', foreign='22222222-2222-4222-8222-222222222222'
const claim='33333333-3333-4333-8333-333333333333', grievance='44444444-4444-4444-8444-444444444444'
const deadline='55555555-5555-4555-8555-555555555555', other='66666666-6666-4666-8666-666666666666'
const actor = { userId: 'handler', organizationId: org, role: 'steward' as const }
let pg: PGlite
const dialect = new PgDialect()
function adapter(connection: { query: PGlite['query'] }): RLSTx {
  return { execute: async (query: Parameters<PgDialect['sqlToQuery']>[0]) => { const q = dialect.sqlToQuery(query); return (await connection.query(q.sql, q.params)).rows } } as unknown as RLSTx
}
const transaction = <T>(fn: (tx: RLSTx) => Promise<T>) => pg.transaction(connection => fn(adapter(connection)))
function allow(user: string, caseId = claim, manage = true) {
  for (const action of manage ? ['case:read', 'case:read_internal', 'case:draft_action'] : ['case:read']) state.permissions.add(user+':'+caseId+':'+action)
  if (manage) state.handlers.add(user)
}
const create = () => transaction(tx => createCaseDeadline(tx, actor, claim, { id: deadline, title: 'Staff entered date', dueDay: '2027-03-14' }))
const list = () => transaction(tx => listCaseDeadlines(tx, actor, claim))
const mutate = (version: string, action: 'complete' | 'cancel' | 'reschedule', dueDay = '2027-03-15') => transaction(tx => changeCaseDeadline(tx, actor, claim, action === 'reschedule' ? { id: deadline, version, action, dueDay } : { id: deadline, version, action }))
beforeEach(async () => {
  state.permissions.clear(); state.handlers.clear(); state.failAudit=false; state.failSchedule=false; vi.clearAllMocks()
  pg = new PGlite()
  await pg.exec(`CREATE TABLE claims(id uuid,claim_id uuid PRIMARY KEY,organization_id uuid);
    CREATE TABLE grievances(id uuid PRIMARY KEY,organization_id uuid);
    CREATE TABLE claim_deadlines(id uuid PRIMARY KEY,claim_id uuid NOT NULL,organization_id uuid NOT NULL,deadline_name text NOT NULL,deadline_type text,event_date timestamptz,original_deadline timestamptz,due_date timestamptz,status text DEFAULT 'pending',completed_at timestamptz,completed_by text,updated_at timestamptz DEFAULT now());
    CREATE TABLE grievance_deadlines(id uuid PRIMARY KEY,grievance_id uuid NOT NULL,deadline_type text,description text,due_date timestamptz,status text DEFAULT 'pending',completed_at timestamptz,updated_at timestamptz DEFAULT now(),confirmation_status text,confirmed_at timestamptz,confirmed_by text,reminder_days int[],override_due_date timestamptz,CHECK(override_due_date IS NULL OR override_due_date=due_date));
    CREATE TABLE deadline_reminders(id uuid PRIMARY KEY,organization_id uuid,source_table text,source_deadline_id uuid,status text,cancelled_reason text,lease_owner text,lease_expires_at timestamptz);
    CREATE TABLE audit_log(payload jsonb);`)
  await pg.query('INSERT INTO claims VALUES($1,$1,$2),($3,$3,$4)',[claim,org,other,foreign])
  await pg.query('INSERT INTO grievances VALUES($1,$2)',[grievance,org]); allow('handler')
})
afterEach(async () => { await pg.close() })

describe('authorized manual case deadlines with real PostgreSQL transactions', () => {
  it('creates a persisted day in the organization zone across DST and makes the exact create retry idempotent', async () => {
    const result=await create(); expect(result.created).toBe(true); expect(result.deadline.dueAt).toBe('2027-03-15T03:59:00.000Z'); expect(result.deadline.dueDay).toBe('2027-03-14')
    expect((await create()).created).toBe(false)
    expect((await pg.query('SELECT * FROM claim_deadlines')).rows).toHaveLength(1)
    expect((await pg.query('SELECT * FROM audit_log')).rows).toHaveLength(1)
    expect(scheduleGrievanceDeadlineReminders).not.toHaveBeenCalled()
    expect((await list()).remindersAvailable).toBe(false)
  })
  it('rejects a reused create id with different content instead of silently replacing the deadline', async () => {
    await create()
    await expect(transaction(tx=>createCaseDeadline(tx,actor,claim,{id:deadline,title:'Different',dueDay:'2027-03-14'}))).rejects.toMatchObject({code:'CONFLICT'})
    expect((await list()).deadlines[0].title).toBe('Staff entered date')
  })
  it('requires explicit draft-action and internal access as well as handler eligibility', async () => {
    allow('read-only',claim,false)
    expect((await transaction(tx=>listCaseDeadlines(tx,{...actor,userId:'read-only'},claim))).canManage).toBe(false)
    for(const who of ['read-only','title-only','missing-internal']) {
      if(who==='title-only')state.handlers.add(who)
      if(who==='missing-internal'){allow(who);state.permissions.delete(who+':'+claim+':case:read_internal')}
      await expect(transaction(tx=>createCaseDeadline(tx,{...actor,userId:who},claim,{id:deadline,title:'Refused',dueDay:'2027-01-01'}))).rejects.toMatchObject({code:who==='title-only'?'NOT_FOUND':'FORBIDDEN'})
    }
    expect((await pg.query('SELECT * FROM claim_deadlines')).rows).toHaveLength(0)
  })
  it('does not expose or change another organization case even when a forged permission flag exists', async () => {
    allow('handler',other)
    await expect(transaction(tx=>createCaseDeadline(tx,actor,other,{id:deadline,title:'Foreign',dueDay:'2027-01-01'}))).rejects.toMatchObject({code:'NOT_FOUND'})
    expect((await pg.query('SELECT * FROM claim_deadlines')).rows).toHaveLength(0)
  })
  it('reschedules only the named case deadline and refuses a stale version without side effects', async () => {
    const first=await create(); await mutate(first.deadline.version,'reschedule')
    const after=(await list()).deadlines[0];expect(after.dueDay).toBe('2027-03-15')
    await expect(mutate(first.deadline.version,'complete')).rejects.toMatchObject({code:'CONFLICT'})
    expect((await list()).deadlines[0].status).toBe('pending');expect((await pg.query('SELECT * FROM audit_log')).rows).toHaveLength(2)
  })
  it.each(['complete','cancel'] as const)('retains a %s record, retires pending/claimed reminders and cannot reopen it',async action=>{
    const first=await create()
    await pg.query("INSERT INTO deadline_reminders(id,organization_id,source_table,source_deadline_id,status) VALUES($1,$2,'claim_deadlines',$3,'pending'),($4,$2,'claim_deadlines',$3,'claimed')",[claim,org,deadline,other])
    const result=await mutate(first.deadline.version,action);expect(result.deadline.status).toBe(action==='complete'?'completed':'cancelled')
    expect((await pg.query('SELECT status FROM deadline_reminders')).rows).toEqual([{status:'cancelled'},{status:'cancelled'}])
    await expect(mutate(result.deadline.version,'reschedule')).rejects.toMatchObject({code:'CONFLICT'})
    expect((await pg.query('SELECT * FROM claim_deadlines')).rows).toHaveLength(1)
  })
  it('rolls back the deadline when its mandatory audit fails',async()=>{
    state.failAudit=true;await expect(create()).rejects.toThrow('audit unavailable')
    expect((await pg.query('SELECT * FROM claim_deadlines')).rows).toHaveLength(0)
  })
  it('a deadline from a different case cannot be changed through an otherwise authorized parent',async()=>{
    await create()
    await pg.query('UPDATE claim_deadlines SET claim_id=$1 WHERE id=$2',[other,deadline])
    await expect(mutate('unknown','cancel')).rejects.toMatchObject({code:'NOT_FOUND'})
    expect((await pg.query('SELECT status FROM claim_deadlines')).rows).toEqual([{status:'pending'}])
  })
  it('uses the existing formal grievance scheduler and preserves override-date consistency',async()=>{
    allow('handler',grievance)
    const first=await transaction(tx=>createCaseDeadline(tx,actor,grievance,{id:deadline,title:'Formal date',dueDay:'2027-03-14'}))
    expect(scheduleGrievanceDeadlineReminders).toHaveBeenCalledWith(expect.objectContaining({grievanceId:grievance,sourceDeadlineId:deadline}))
    await pg.query('UPDATE grievance_deadlines SET override_due_date=due_date WHERE id=$1',[deadline])
    const version=(await transaction(tx=>listCaseDeadlines(tx,actor,grievance))).deadlines[0].version
    await transaction(tx=>changeCaseDeadline(tx,actor,grievance,{id:deadline,version,action:'reschedule',dueDay:'2027-03-16'}))
    const row=(await pg.query<{due_date:Date;override_due_date:Date;confirmation_status:string}>('SELECT due_date,override_due_date,confirmation_status FROM grievance_deadlines')).rows[0]
    expect(row.override_due_date).toEqual(row.due_date);expect(row.confirmation_status).toBe('HUMAN_CONFIRMED');expect(first.created).toBe(true)
  })
  it('rolls back formal creation and its audit if scheduling fails',async()=>{
    allow('handler',grievance);state.failSchedule=true
    await expect(transaction(tx=>createCaseDeadline(tx,actor,grievance,{id:deadline,title:'Formal date',dueDay:'2027-03-14'}))).rejects.toThrow('scheduler unavailable')
    expect((await pg.query('SELECT * FROM grievance_deadlines')).rows).toHaveLength(0)
    expect((await pg.query('SELECT * FROM audit_log')).rows).toHaveLength(0)
  })
  it('rejects invalid dates and mass assignment before accepting a mutation',()=>{
    expect(CreateCaseDeadline.safeParse({id:deadline,title:'Date',dueDay:'2027-02-30'}).success).toBe(false)
    expect(CreateCaseDeadline.safeParse({id:deadline,title:'Date',dueDay:'2027-02-28',organizationId:foreign}).success).toBe(false)
    expect(ChangeCaseDeadline.safeParse({id:deadline,version:'v',action:'complete',status:'pending'}).success).toBe(false)
  })
})
