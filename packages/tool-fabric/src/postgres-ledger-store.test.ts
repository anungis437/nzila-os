import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { computeAuditHash } from '@nzila/audit'
import { PostgresAtomicTrustLedgerStore } from './postgres-ledger-store'
import { LedgerStoreUnavailableError, LedgerConflictError, LEDGER_GENESIS_HASH } from './ledger-store'

const ORG='platform:tool-fabric:trust'
function fake(opts: { revision?: number; hash?: string; entries?: unknown[]; initialized?: boolean } = {}) {
  let commits=0
  const query = {
    unsafe: async (sql: string, params?: unknown[]) => {
      if (sql.includes('FOR SHARE') || sql.includes('FOR UPDATE')) {
        return opts.initialized === false ? [] : [{
          revision: String(opts.revision ?? 0),
          head_hash: opts.hash ?? LEDGER_GENESIS_HASH,
        }]
      }
      if (sql.includes('ORDER BY seq ASC')) return (opts.entries ?? []).map((entry,i)=>({seq:i+1,entry}))
      throw new Error('Unexpected write attempt: '+sql)
    },
  }
  return {
    begin: async <T>(fn: (tx: typeof query)=>Promise<T>) => { const v=await fn(query);commits++;return v },
    unsafe: query.unsafe,
    get commits() { return commits },
  }
}
describe('P0 Postgres Trust Ledger CAS adapter',()=>{
  it('rejects missing authenticated transactional client',()=>{
    expect(()=>new PostgresAtomicTrustLedgerStore({} as never)).toThrow(LedgerStoreUnavailableError)
  })
  it('reads independently initialized empty canonical stream',async()=>{
    const db=fake()
    const s=new PostgresAtomicTrustLedgerStore(db)
    const out=await s.readSnapshot(ORG)
    expect(out).toEqual({revision:0,headHash:LEDGER_GENESIS_HASH,entries:[]})
    expect(db.commits).toBe(1)
  })
  it('does not invent a fresh ledger when migration or stream is missing',async()=>{
    const s=new PostgresAtomicTrustLedgerStore(fake({initialized:false}))
    await expect(s.readSnapshot(ORG)).rejects.toThrow('not initialized')
  })
  it('rejects missing events or false chain head',async()=>{
    const s=new PostgresAtomicTrustLedgerStore(fake({revision:1}))
    await expect(s.readSnapshot(ORG)).rejects.toThrow('missing or excess events')
  })
  it('rejects foreign tenant stream access before contacting database',async()=>{
    const s=new PostgresAtomicTrustLedgerStore(fake())
    await expect(s.readSnapshot('attacker-org')).rejects.toThrow('canonical platform stream')
  })
  it('rejects non-extending CAS requests without touching a transaction',async()=>{
    const db=fake()
    const s=new PostgresAtomicTrustLedgerStore(db)
    await expect(s.compareAndAppend(ORG,
      {revision:0,headHash:LEDGER_GENESIS_HASH},
      {orgId:ORG,prevHash:'wrong',payload:{seq:1}} as never,
    )).rejects.toBeInstanceOf(LedgerConflictError)
    expect(db.commits).toBe(0)
  })
  it('rejects a forged audit digest before touching PostgreSQL', async()=> {
    const db=fake()
    const store=new PostgresAtomicTrustLedgerStore(db)
    const hashable={
      id:randomUUID(), timestamp:'2026-10-30T15:00:00.000Z',
      actorId:'host-actor',orgId:ORG,action:'tool_fabric.ledger.tool_registered',
      resource:'tool-fabric-tool',resourceId:'sample-tool',
      payload:{seq:1,prevEventHash:LEDGER_GENESIS_HASH,eventHash:'a'.repeat(64)},
    }
    const validHash=computeAuditHash(LEDGER_GENESIS_HASH,hashable)
    const expected={revision:0,headHash:LEDGER_GENESIS_HASH}
    await expect(store.compareAndAppend(ORG,expected,{
      ...hashable,prevHash:LEDGER_GENESIS_HASH,hash:(validHash[0] === 'b' ? 'a' : 'b') + validHash.slice(1),hashVersion:2,
    })).rejects.toBeInstanceOf(LedgerConflictError)
    await expect(store.compareAndAppend(ORG,expected,{
      ...hashable,prevHash:LEDGER_GENESIS_HASH,hash:validHash,hashVersion:1,
    })).rejects.toBeInstanceOf(LedgerConflictError)
    expect(db.commits).toBe(0)
  })

})
