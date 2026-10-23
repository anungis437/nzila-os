import fs from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { RLSTx } from '@/lib/db/with-rls-context'

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async () => { throw new Error('EXPLICIT_TEST_TRANSACTION_REQUIRED') },
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { createClaim } from '../claims-queries'
import { claimUpdates } from '../../schema/claims-schema'

const org='11111111-1111-4111-8111-111111111111'
const member='22222222-2222-4222-8222-222222222222'
let pg: PGlite
let db: ReturnType<typeof drizzle>
beforeAll(async () => {
  pg=new PGlite()
  await pg.exec(fs.readFileSync(new URL('./fixtures/canonical-claim-write.sql',import.meta.url),'utf8'))
  db=drizzle(pg)
})
beforeEach(async () => { await pg.exec('TRUNCATE claims, claim_updates') })
afterAll(async () => { await pg?.close() })

describe('claim writes against canonical Django column defaults', () => {
  it('creates a claim when required UUID, timestamp, boolean and state columns have no SQL defaults', async () => {
    const required=(await pg.query<{ column_name: string; column_default: string | null }>(
      "SELECT column_name,column_default FROM information_schema.columns WHERE table_name='claims' AND column_name IN ('id','claim_id','created_at','updated_at','is_anonymous','previously_reported','progress','status','priority','witnesses_present')")).rows
    expect(required).toHaveLength(10)
    expect(required.every(column=>column.column_default===null)).toBe(true)
    const created=await db.transaction(tx=>createClaim({ organizationId:org, memberId:member },tx as unknown as RLSTx))
    expect(created.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(created.claimId).toMatch(/^[a-f0-9-]{36}$/)
    expect(created.createdAt).toBeInstanceOf(Date)
    expect(created.updatedAt).toBeInstanceOf(Date)
    expect(created).toMatchObject({organizationId:org,memberId:member,isAnonymous:true,previouslyReported:false,witnessesPresent:false,progress:0,status:'submitted',priority:'medium'})
  })

  it('preserves explicit caller values and generates fresh identifiers for subsequent claims', async () => {
    const [first,second]=await db.transaction(async tx=>{
      const a=await createClaim({ organizationId:org,memberId:member,isAnonymous:false,priority:'high',previouslyReported:true,progress:7 },tx as unknown as RLSTx)
      const b=await createClaim({ organizationId:org,memberId:member },tx as unknown as RLSTx)
      return [a,b]
    })
    expect(first).toMatchObject({isAnonymous:false,priority:'high',previouslyReported:true,progress:7})
    expect(second.id).not.toBe(first.id)
    expect(second.claimId).not.toBe(first.claimId)
    expect(second.claimNumber).not.toBe(first.claimNumber)
  })

  it('supplies history timestamps when Django owns the required timestamp defaults', async () => {
    const history=await db.transaction(async tx=>{
      const created=await createClaim({organizationId:org,memberId:member},tx as unknown as RLSTx)
      return tx.insert(claimUpdates).values({claimId:created.id,message:'Synthetic timestamp regression',createdBy:member}).returning()
    })
    expect(history).toHaveLength(1)
    expect(history[0].createdAt).toBeInstanceOf(Date)
    expect(history[0].updatedAt).toBeInstanceOf(Date)
  })
})
