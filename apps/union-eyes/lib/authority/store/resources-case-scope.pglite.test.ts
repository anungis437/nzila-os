/** Persisted scope/party and canonical-parent fact consumers; adoption and physical mutation proofs are separate. */
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { CASE_SCOPE_FACTS_FIXTURE_SQL } from '../../../db/__tests__/case-scope-facts-fixture'
import { loadCase } from './resources'
import { decide } from '../kernel'
import { facts, mandate, NOW, ORG, ORG_B, ref, relationship, request, U } from '../__tests__/fixtures'
import type { SqlExecutor } from './executor'

async function fixture(){
  const pg=new PGlite(),id=randomUUID(),scopeId=randomUUID(),member='canonical-non-uuid-member'
  await pg.exec(`CREATE TABLE public.claims(claim_id uuid PRIMARY KEY,organization_id uuid,member_id text,created_at timestamptz);
    CREATE TABLE public.grievances(id uuid PRIMARY KEY,organization_id uuid,created_by text,grievant_id uuid,
      represented_member_user_id text,created_at timestamptz,is_confidential boolean,has_legal_implications boolean);
    CREATE TABLE public.ue_authority_workaid_matters(organization_id uuid,case_id uuid,counsel_accepted_at timestamptz,withdrawn_at timestamptz);`)
  await pg.exec(CASE_SCOPE_FACTS_FIXTURE_SQL)
  await pg.query('INSERT INTO public.claims VALUES($1,$2,$3,$4)',[id,ORG,member,new Date(NOW.getTime()-1000)])
  const exec={query:async(text:string,params:unknown[]=[])=>pg.query(text,params)} as SqlExecutor
  const req=request(U.chief,'case:read',ref('case',id))
  const bind=()=>pg.query('INSERT INTO public.case_authority_scopes(id,organization_id,case_id,claim_id) VALUES($1,$2,$3,$3)',[scopeId,ORG,id])
  return{pg,id,scopeId,member,exec,req,bind,load:()=>loadCase(exec,req,NOW)}
}

describe('governed case scope and adverse-party fact loading',()=>{
  it('never infers unit or territory scope from the owning organization',async()=>{
    const f=await fixture();try{
      const loaded=await f.load()
      expect(loaded!.resource).toMatchObject({unitId:null,territoryId:null,adverseUserIds:[]})
      expect(decide(f.req,facts(U.chief,['chief_steward'],{mandates:[mandate({scope:{unitIds:[ORG]}})]}),loaded!.resource,NOW).effect).toBe('deny')
    }finally{await f.pg.close()}
  })
  it('uses only active same-organization adopted jurisdiction facts and rejects a foreign reference',async()=>{
    const f=await fixture();try{
      const unit=randomUUID(),territory=randomUUID()
      await f.bind()
      await f.pg.query("INSERT INTO public.bargaining_units VALUES($1,$2,'active',NULL)",[unit,ORG])
      await f.pg.query("INSERT INTO public.case_territories VALUES($1,$2,NULL,'Synthetic adopted territory')",[territory,ORG])
      await f.pg.query('UPDATE public.case_authority_scopes SET unit_id=$1,territory_id=$2 WHERE id=$3',[unit,territory,f.scopeId])
      const loaded=await f.load()
      expect(loaded!.resource).toMatchObject({unitId:unit,territoryId:territory})
      expect(decide(f.req,facts(U.chief,['chief_steward'],{mandates:[mandate({scope:{unitIds:[unit]}})]}),loaded!.resource,NOW).effect).toBe('allow')
      await f.pg.query("UPDATE public.bargaining_units SET status='inactive' WHERE id=$1",[unit])
      expect((await f.load())!.resource).toMatchObject({unitId:null,territoryId:territory})
      await f.pg.query('UPDATE public.case_territories SET organization_id=$1 WHERE id=$2',[ORG_B,territory])
      await expect(f.load()).rejects.toThrow('territory belongs to another organization')
    }finally{await f.pg.close()}
  })
  it('denies an actual adverse principal across relationship and mandate sources until a coherent revocation',async()=>{
    const f=await fixture();try{
      await f.bind()
      await f.pg.query('INSERT INTO public.case_respondents(organization_id,scope_id,respondent_user_id,recorded_at,recorded_by) VALUES($1,$2,$3,$4,$5)',[ORG,f.scopeId,U.chief,new Date(NOW.getTime()-1000),U.president])
      const authority=facts(U.chief,['chief_steward'],{relationships:[relationship({principalUserId:U.chief,resource:ref('case',f.id)})],mandates:[mandate({scope:{resourceIds:[f.id]}})]})
      expect(decide(f.req,authority,(await f.load())!.resource,NOW).reasons).toEqual(expect.arrayContaining([expect.objectContaining({code:'ADVERSE_PARTY'})]))
      await f.pg.query('UPDATE public.case_respondents SET revoked_at=$1,revoked_by=$2',[new Date(NOW.getTime()+1000),U.president])
      expect(decide(f.req,authority,(await f.load())!.resource,NOW).effect).toBe('deny')
      await f.pg.query('UPDATE public.case_respondents SET revoked_at=$1',[NOW])
      expect(decide(f.req,authority,(await f.load())!.resource,NOW).effect).toBe('allow')
    }finally{await f.pg.close()}
  })
  it('refuses an unrelated same-id model and retains canonical member identity under a protected stricter mirror',async()=>{
    const f=await fixture();try{
      await f.pg.query('INSERT INTO public.grievances VALUES($1,$2,$3,NULL,$4,$5,true,true)',[f.id,ORG,'converting-staff',f.member,NOW])
      await expect(f.load()).rejects.toThrow('ambiguous same-id')
      await f.bind()
      await expect(f.load()).rejects.toThrow('no coherent governed mirror provenance')
      await f.pg.query('UPDATE public.case_authority_scopes SET grievance_mirror_id=$1,mirror_recorded_at=$2,mirror_recorded_by=$3 WHERE id=$4',[f.id,NOW,U.officer,f.scopeId])
      const loaded=await f.load()
      expect(loaded!.resource).toMatchObject({classification:'privileged',confidential:true})
      expect(loaded!.relationships).toEqual([expect.objectContaining({relation:'creator',principalUserId:f.member})])
      await f.pg.query("UPDATE public.grievances SET represented_member_user_id='substituted-member' WHERE id=$1",[f.id])
      await expect(f.load()).rejects.toThrow('no coherent governed mirror provenance')
    }finally{await f.pg.close()}
  })
})
