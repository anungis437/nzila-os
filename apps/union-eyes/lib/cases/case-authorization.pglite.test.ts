import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { claims, claimUpdates } from '@/db/schema/claims-schema'

const m = vi.hoisted(() => ({ auth: vi.fn(), organization: vi.fn(), role: vi.fn(), audit: vi.fn() }))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.organization, getUserRoleInOrganization: m.role }))
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.audit, AuditEventType: {AUTH_FAILED:'AUTH_FAILED'}, AuditSeverity:{HIGH:'HIGH'} }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({currentStateContextEnabled:()=>true}))
import { caseHistoryVisibility, getCaseActor, type CaseActor } from './case-authorization'
import { casePolicyRole } from './case-permissions'

const org='11111111-1111-4111-8111-111111111111'
const foreign='22222222-2222-4222-8222-222222222222'
const actor:CaseActor={userId:'actor',organizationId:org,role:'member'}
const ids={ own:randomUUID(),other:randomUUID(),assigned:randomUUID(),foreign:randomUUID() }
let pg:PGlite
let db:ReturnType<typeof drizzle>
beforeAll(async()=>{
  pg=new PGlite()
  await pg.exec(fs.readFileSync(new URL('../../db/queries/__tests__/fixtures/canonical-claim-write.sql',import.meta.url),'utf8'))
  db=drizzle(pg)
  for(const [name,id] of Object.entries(ids)){
    await pg.query(`INSERT INTO claims(id,claim_id,claim_number,created_at,updated_at,organization_id,member_id,assigned_to,
      is_anonymous,previously_reported,witnesses_present,priority,progress,status)
      VALUES($1,$2,$3,now(),now(),$4,$5,$6,false,false,false,'medium',0,'submitted')`,
      [randomUUID(),id,'CASE-'+name,name==='foreign'?foreign:org,name==='own'?'actor':'other-member',name==='assigned'?'actor':null])
  }
  const parent=(await pg.query<{id:string}>('SELECT id FROM claims WHERE claim_id=$1',[ids.own])).rows[0].id
  for(const [message,internal,visibility] of [
    ['member',false,'member'],['staff',true,'staff'],['contradictory',true,'member'],
    ['admin',true,'admin'],['system',true,'system'],['null-visibility',false,null],['unknown',false,'unknown'],
  ]) await pg.query('INSERT INTO claim_updates(claim_id,created_at,updated_at,message,is_internal,visibility_scope) VALUES($1,now(),now(),$2,$3,$4)',[parent,message,internal,visibility])
})
afterAll(async()=>{await pg?.close()})
beforeEach(()=>{
  vi.clearAllMocks()
  m.auth.mockResolvedValue({userId:actor.userId})
  m.organization.mockResolvedValue(org)
  m.role.mockResolvedValue('member')
  m.audit.mockResolvedValue(undefined)
})
describe('case history visibility and the case actor against PostgreSQL',()=>{
  it.each([
    ['member_visible',['member']],
    ['internal',['contradictory','member','staff']],
  ] as const)('filters history for the %s view using both confidentiality and explicit visibility',async(visibility,expected)=>{
    const rows=await db.select({message:claimUpdates.message}).from(claimUpdates).where(caseHistoryVisibility(visibility))
    expect(rows.map(row=>row.message).sort()).toEqual(expected)
  })
  it('rejects missing identity, missing canonical role and unknown role without a member fallback',async()=>{
    m.auth.mockResolvedValueOnce({userId:null})
    await expect(getCaseActor()).rejects.toMatchObject({code:'AUTH_REQUIRED'})
    for(const role of [null,'unknown','support_agent']){
      m.role.mockResolvedValueOnce(role)
      await expect(getCaseActor()).rejects.toMatchObject({code:'FORBIDDEN'})
    }
    // Platform administration is not customer-organization case authority, even when stored as the membership role.
    for(const role of ['app_owner','system_admin','platform_lead','platform_admin']){
      m.role.mockResolvedValueOnce(role)
      await expect(getCaseActor(), role).rejects.toMatchObject({code:'FORBIDDEN'})
      expect(casePolicyRole(role), role).toBeNull()
    }
    expect(casePolicyRole('unknown')).toBeNull()
    expect(casePolicyRole('system_admin')).toBeNull()
  })
  it('uses only the resolved organization role',async()=>{
    expect(await getCaseActor()).toEqual(actor)
    expect(m.role).toHaveBeenCalledWith(actor.userId,org)
  })
})
