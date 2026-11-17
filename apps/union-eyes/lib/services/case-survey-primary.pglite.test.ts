/** Actual PostgreSQL/auth-fact proof for the former legacy-assignee survey defect family. */
import {drizzle} from 'drizzle-orm/pglite'
import type {PGlite} from '@electric-sql/pglite'
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest'
import {caseDomainFixture} from '@/db/__tests__/case-primary-domain-testkit'
import {compileAuthorityMembershipReaderSql} from '@/lib/authority/store/platform-identity'
import {resolveCaseSurveyPrimary} from './case-survey-primary'
let f:Awaited<ReturnType<typeof caseDomainFixture>>
beforeAll(async()=>{
 vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2','1');f=await caseDomainFixture()
 await f.db.exec(compileAuthorityMembershipReaderSql())
 await f.db.exec('ALTER TABLE public.claims ADD COLUMN assigned_to text')
 await f.seed(()=>f.db.query("UPDATE public.claims SET status='resolved',assigned_to='stale-legacy-person' WHERE claim_id=$1",[f.caseId]))
},60000)
afterAll(async()=>{await f?.db.close();vi.unstubAllEnvs()})
const resolve=(over:Partial<Parameters<typeof resolveCaseSurveyPrimary>[1]>={},actor=f.actor)=>f.tenant(actor,()=>resolveCaseSurveyPrimary(drizzle(f.db as PGlite) as never,{organizationId:f.org,claimId:f.internalId,memberId:f.member,...over}))
describe('new survey attribution uses the actual governed relationship',()=>{
 it('resolves the non-UUID primary principal and ignores the stale legacy assignedTo field',async()=>{
  expect(await resolve()).toEqual({primaryUserId:f.actor,memberId:f.member,claimId:f.internalId})
  await expect(resolve({lroId:'stale-legacy-person'})).rejects.toThrow('current governed primary')
 })
 it('preserves internal-vs-logical identity, tenant/member binding and resolved-state requirements',async()=>{
  await expect(resolve({claimId:f.caseId})).rejects.toThrow('unavailable')
  await expect(resolve({memberId:'another-member'})).rejects.toThrow('member of a resolved')
  await f.seed(()=>f.db.query("UPDATE public.claims SET status='investigation' WHERE claim_id=$1",[f.caseId]))
  await expect(resolve()).rejects.toThrow('member of a resolved')
  await f.seed(()=>f.db.query("UPDATE public.claims SET status='resolved' WHERE claim_id=$1",[f.caseId]))
 })
 it('does not allow a role-only caller to create a survey about an unrelated case',async()=>{
  await expect(resolve({},'unrelated')).rejects.toThrow('Current case authority')
 })
 it('never falls back to the legacy mirror when the governed primary is revoked or no longer eligible',async()=>{
  await f.seed(async()=>{
   const rule=(await f.db.query<{id:string}>("SELECT id FROM public.ue_authority_issuance_rules WHERE domain='case_assignment' LIMIT 1")).rows[0].id
   await f.db.query(`INSERT INTO public.ue_authority_resource_relationships(organization_id,principal_user_id,resource_type,resource_id,relation,origin,granted_by,issuance_rule_id,permissions,effective_at)
    VALUES($1,'collaborator','case',$2,'collaborator','explicit','assigner',$3,ARRAY['transition'],now()-interval '1 minute')`,[f.org,f.caseId,rule])
   await f.db.query("UPDATE public.ue_authority_resource_relationships SET status='revoked',revoked_at=now(),revoked_by='assigner' WHERE organization_id=$1 AND principal_user_id=$2",[f.org,f.actor])
  })
  await expect(resolve({},'collaborator')).rejects.toThrow('no single current governed primary')
  await f.seed(async()=>{await f.db.query("UPDATE public.ue_authority_resource_relationships SET status='active',revoked_at=NULL,revoked_by=NULL WHERE organization_id=$1 AND principal_user_id=$2",[f.org,f.actor]);await f.db.query("UPDATE user_management.organization_users SET is_active=false WHERE organization_id=$1 AND user_id=$2",[f.org,f.actor])})
  await expect(resolve({},'collaborator')).rejects.toThrow('no longer eligible')
 })
})
