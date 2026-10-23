import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { readCanonicalCaseAudit } from './case-evidence-query'

const org='11111111-1111-4111-8111-111111111111'
const foreign='22222222-2222-4222-8222-222222222222'
const caseId=randomUUID()
let pg:PGlite
beforeAll(async()=>{
  pg=new PGlite()
  await pg.exec(`CREATE TABLE audit_logs(id uuid,audit_id uuid,created_at timestamptz,
    organization_id uuid,user_id text,action text,resource_type text,resource_id text,
    details jsonb,content_hash text,previous_hash text)`)
  const proof={organizationId:org,resourceId:caseId,decisionType:'union.grievance.intake.submitted'}
  const rows=[
    {id:'claim',organization:org,resource:caseId,type:'claims',action:'update',details:{}},
    {id:'intake',organization:org,resource:caseId,type:'grievance',action:'nar.decision.proof',details:{narRecord:proof}},
    {id:'foreign',organization:foreign,resource:caseId,type:'claims',action:'update',details:{}},
    {id:'other-case',organization:org,resource:randomUUID(),type:'claims',action:'update',details:{}},
    {id:'pending',organization:org,resource:'pending',type:'grievance',action:'nar.decision.proof',details:{narRecord:proof}},
    {id:'unrelated-grievance',organization:org,resource:caseId,type:'grievance',action:'update',details:{}},
    {id:'wrong-proof',organization:org,resource:caseId,type:'grievance',action:'nar.decision.proof',details:{narRecord:{...proof,resourceId:randomUUID()}}},
  ]
  for(const row of rows) await pg.query(`INSERT INTO audit_logs VALUES($1,$2,now(),$3,'actor',$4,$5,$6,$7,$8,'previous')`,
    [randomUUID(),randomUUID(),row.organization,row.action,row.type,row.resource,JSON.stringify(row.details),row.id])
})
afterAll(async()=>{await pg?.close()})
describe('canonical case audit export SQL',()=>{
  it('includes linked case records and the exact typed intake proof, excluding other scope and pending proofs',async()=>{
    const db=drizzle(pg)
    // Adapt only the driver's result envelope; the source SQL executes in PostgreSQL.
    const tx={execute:async(query:Parameters<typeof db.execute>[0])=>(await db.execute(query)).rows} as unknown as RLSTx
    const rows=await readCanonicalCaseAudit(tx,org,caseId)
    expect(rows.map(row=>row.contentHash).sort()).toEqual(['claim','intake'])
    expect(rows.every(row=>row.resourceId===caseId&&row.organizationId===org&&row.previousHash==='previous')).toBe(true)
  })
})
