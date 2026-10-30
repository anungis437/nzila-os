import { describe, it, expect } from 'vitest'
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
})
