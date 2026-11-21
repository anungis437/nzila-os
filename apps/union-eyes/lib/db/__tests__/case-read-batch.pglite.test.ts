import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/pglite'
import {PgDialect} from 'drizzle-orm/pg-core'
import type {SQL} from 'drizzle-orm'
import type { PGlite } from '@electric-sql/pglite'
import { ORG, U, newUuid } from '@/db/__tests__/authority-kernel-harness'
import { freshDb, kit, minutesAgo } from '@/db/__tests__/authority-kernel-testkit'
import { assignCase,declareOwnRecusal } from '@/lib/authority/store/lifecycle'
import { decideCaseCapabilitiesBatch,drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { enforceCaseProjection } from '@/lib/authority/store/enforce'

let pg:PGlite,k:ReturnType<typeof kit>
const cases=Array.from({length:4},()=>newUuid())
const projection=(values:Awaited<ReturnType<typeof enforceCaseProjection>>)=>Object.fromEntries(
  Object.entries(values).map(([action,value])=>[action,{effect:value.effect,scope:value.scope,reasons:value.reasons.map(reason=>reason.code)}]),
)
beforeAll(async()=>{
  pg=await freshDb();k=kit(pg)
  await k.asAdmin(async()=>{
    for(const id of cases)await pg.query('INSERT INTO public.claims(claim_id,organization_id,member_id) VALUES($1,$2,$3)',[id,ORG,U.member])
  })
  await k.adoptDefaultRules()
  await k.grantMandate('supervisory',U.officer,['read','assign'],{scope:{resourceIds:cases}})
  for(const id of cases.slice(0,3))await k.as(U.officer)(tx=>assignCase(tx,k.deps,{organizationId:ORG,issuerUserId:U.officer,
    caseId:id,assigneeUserId:U.steward,permissions:['read','read_internal','comment','write_notes'],effectiveAt:minutesAgo()}))
})
afterAll(async()=>{await pg?.close()})

describe('batched case projections using the canonical PostgreSQL loaders and policy',()=>{
  it('matches every independently loaded action decision while reducing database round trips',async()=>{
    await k.as(U.steward)(async()=>{
      const database=drizzle(pg)
      let sequentialQueries=0,batchQueries=0
      const sequentialTx={execute:(query:Parameters<typeof database.execute>[0])=>{sequentialQueries++;return database.execute(query)}}
      const batchedTx={execute:(query:Parameters<typeof database.execute>[0])=>{batchQueries++;return database.execute(query)}}
      const before=[]
      for(const caseId of cases)before.push([caseId,projection(await enforceCaseProjection(drizzleExecutor(sequentialTx as never),k.deps,{principalUserId:U.steward,organizationId:ORG,caseId}))] as const)
      const after=await decideCaseCapabilitiesBatch(batchedTx as never,{userId:U.steward,organizationId:ORG,caseIds:[...cases,cases[0]]},k.deps)
      expect([...after].map(([id,actions])=>[id,projection(actions)])).toEqual(before)
      expect(after.size).toBe(cases.length)
      expect(after.get(cases[0])?.['case:read'].effect).toBe('allow')
      expect(after.get(cases[3])?.['case:read'].effect).toBe('deny')
      expect(batchQueries).toBeLessThan(sequentialQueries/2)
    })
  })
  it('keeps member visibility separate and never reuses the preceding staff result',async()=>{
    await k.as(U.member)(async()=>{
      const result=await decideCaseCapabilitiesBatch(drizzle(pg) as never,{userId:U.member,organizationId:ORG,caseIds:cases},k.deps)
      for(const actions of result.values())expect(actions['case:read']).toMatchObject({effect:'allow',scope:{visibility:'member_visible'}})
    })
  })
  it('observes a recusal in a later request without reusing an earlier authority result',async()=>{
    await k.as(U.steward)(tx=>declareOwnRecusal(tx,{organizationId:ORG,principalUserId:U.steward,resourceType:'case',resourceId:cases[0],reason:'case conflict'}))
    await k.as(U.steward)(async()=>{
      const result=await decideCaseCapabilitiesBatch(drizzle(pg) as never,{userId:U.steward,organizationId:ORG,caseIds:cases},k.deps)
      expect(result.get(cases[0])?.['case:read']).toMatchObject({effect:'deny'})
      expect(result.get(cases[1])?.['case:read'].effect).toBe('allow')
    })
  })
  it('reports unavailable facts when a canonical loader fails, rather than a successful empty list',async()=>{
    await k.as(U.steward)(async()=>{
      const database=drizzle(pg)
      const tx={execute:(query:Parameters<typeof database.execute>[0])=>{
        // Actual PostgreSQL denies this missing relation; the unchanged canonical loader catches it.
        const executor=drizzleExecutor(database as never)
        const text=typeof query==='string'?query:new PgDialect().sqlToQuery(query as SQL).sql
        return text.includes('ue_authority_delegations') ? executor.query('SELECT * FROM deliberately_missing_authority_relation') : database.execute(query)
      }}
      await expect(decideCaseCapabilitiesBatch(tx as never,{userId:U.steward,organizationId:ORG,caseIds:cases},k.deps)).rejects.toThrow('unavailable')
    })
  })
})
