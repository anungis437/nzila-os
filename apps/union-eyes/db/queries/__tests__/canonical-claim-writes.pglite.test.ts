import fs from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async () => { throw new Error('EXPLICIT_TEST_TRANSACTION_REQUIRED') },
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))
const mode=vi.hoisted(()=>({canonical:true}))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => mode.canonical }))

import { createClaim, addClaimUpdate, getRecentClaimUpdates, updateClaimStatus, assignClaim } from '../claims-queries'
import { claimUpdates } from '../../schema/claims-schema'

const org='11111111-1111-4111-8111-111111111111'
const member='22222222-2222-4222-8222-222222222222'
let pg: PGlite
let db: ReturnType<typeof drizzle>
beforeAll(async () => {
  pg=new PGlite()
  await pg.exec(fs.readFileSync(new URL('./fixtures/canonical-claim-write.sql',import.meta.url),'utf8'))
  await pg.exec(`CREATE ROLE claim_test_runtime;
    GRANT SELECT, INSERT, UPDATE ON claims, claim_updates TO claim_test_runtime;
    ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
    ALTER TABLE claim_updates ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant ON claims USING
      (organization_id::text=current_setting('test.org',true))
      WITH CHECK (organization_id::text=current_setting('test.org',true));
    CREATE POLICY parent_tenant ON claim_updates USING
      (EXISTS(SELECT 1 FROM claims WHERE claims.id=claim_updates.claim_id))
      WITH CHECK (EXISTS(SELECT 1 FROM claims WHERE claims.id=claim_updates.claim_id));`)
  db=drizzle(pg)
})
beforeEach(async () => { mode.canonical=true; await pg.exec('TRUNCATE claims, claim_updates') })
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

  it('writes and reads notes, transitions and assignment history with distinct internal and public IDs', async () => {
    const result=await db.transaction(async tx=>{
      const typed=tx as unknown as RLSTx
      const created=await createClaim({organizationId:org,memberId:member},typed)
      expect(created.id).not.toBe(created.claimId)
      const note=await addClaimUpdate(created.claimId,'Synthetic mapped note',member,'note',typed)
      expect(note.claimId).toBe(created.claimId)
      await updateClaimStatus(created.claimId,'under_review',member,org,undefined,typed)
      await assignClaim(created.claimId,member,member,org,typed)
      return {created,history:await getRecentClaimUpdates(created.claimId,typed)}
    })
    expect(result.history).toHaveLength(3)
    expect(result.history.every(row=>row.claimId===result.created.claimId)).toBe(true)
    const persisted=(await pg.query<{claim_id:string}>('SELECT claim_id FROM claim_updates')).rows
    expect(persisted.every(row=>row.claim_id===result.created.id)).toBe(true)
  })

  it('cannot resolve or attach history to an RLS-hidden foreign public case ID', async () => {
    const foreignOrg='33333333-3333-4333-8333-333333333333'
    const [own,foreign]=await db.transaction(async tx=>{
      const typed=tx as unknown as RLSTx
      const own=await createClaim({organizationId:org,memberId:member},typed)
      const foreign=await createClaim({organizationId:foreignOrg,memberId:member},typed)
      await addClaimUpdate(own.claimId,'Owned note',member,'note',typed)
      return [own,foreign]
    })
    const visible=await db.transaction(async tx=>{
      await tx.execute(sql`SET LOCAL ROLE claim_test_runtime`)
      await tx.execute(sql`SELECT set_config('test.org', ${org}, true)`)
      return {own:await getRecentClaimUpdates(own.claimId,tx as unknown as RLSTx),foreign:await getRecentClaimUpdates(foreign.claimId,tx as unknown as RLSTx)}
    })
    expect(visible.own).toHaveLength(1)
    expect(visible.foreign).toEqual([])
    await expect(db.transaction(async tx=>{
      await tx.execute(sql`SET LOCAL ROLE claim_test_runtime`)
      await tx.execute(sql`SELECT set_config('test.org', ${org}, true)`)
      await addClaimUpdate(foreign.claimId,'Forbidden note',member,'note',tx as unknown as RLSTx)
    })).rejects.toThrow('Failed to add update')
    expect((await pg.query('SELECT * FROM claim_updates')).rows).toHaveLength(1)
  })

  it('keeps public-ID history behavior when canonical mode is disabled', async () => {
    mode.canonical=false
    await pg.exec('ALTER TABLE claim_updates DROP CONSTRAINT claim_updates_claim_id_fkey; ALTER TABLE claim_updates ADD FOREIGN KEY (claim_id) REFERENCES claims(claim_id) DEFERRABLE INITIALLY DEFERRED')
    try {
      const result=await db.transaction(async tx=>{
        const typed=tx as unknown as RLSTx
        const created=await createClaim({organizationId:org,memberId:member},typed)
        const note=await addClaimUpdate(created.claimId,'Legacy synthetic note',member,'note',typed)
        return {created,note,history:await getRecentClaimUpdates(created.claimId,typed)}
      })
      expect(result.created.id).not.toBe(result.created.claimId)
      expect(result.note.claimId).toBe(result.created.claimId)
      expect(result.history).toHaveLength(1)
      const stored=(await pg.query<{claim_id:string}>('SELECT claim_id FROM claim_updates')).rows[0]
      expect(stored.claim_id).toBe(result.created.claimId)
    } finally {
      await pg.exec('TRUNCATE claims,claim_updates; ALTER TABLE claim_updates DROP CONSTRAINT claim_updates_claim_id_fkey; ALTER TABLE claim_updates ADD FOREIGN KEY (claim_id) REFERENCES claims(id) DEFERRABLE INITIALLY DEFERRED')
      mode.canonical=true
    }
  })
})
