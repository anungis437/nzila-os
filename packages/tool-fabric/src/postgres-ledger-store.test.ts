import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { computeAuditHash, type AuditEntry } from '@nzila/audit'
import { PostgresAtomicTrustLedgerStore } from './postgres-ledger-store'
import { LedgerStoreUnavailableError, LedgerConflictError, LEDGER_GENESIS_HASH } from './ledger-store'

const ORG='platform:tool-fabric:trust'
function fake(opts: { revision?: number; hash?: string; entries?: unknown[]; rows?: Record<string,unknown>[]; initialized?: boolean } = {}) {
  let commits=0
  const query = {
    unsafe: async (sql: string, params?: unknown[]) => {
      if (sql.includes('FOR SHARE') || sql.includes('FOR UPDATE')) {
        return opts.initialized === false ? [] : [{
          revision: String(opts.revision ?? 0),
          head_hash: opts.hash ?? LEDGER_GENESIS_HASH,
        }]
      }
      if (sql.includes('ORDER BY seq ASC')) return opts.rows ?? (opts.entries ?? []).map((entry,i)=>({
        seq:String(i+1), audit_id:(entry as AuditEntry).id, entry_hash:(entry as AuditEntry).hash, entry,
      }))
      throw new Error('Unexpected write attempt: '+sql)
    },
  }
  return {
    begin: async <T>(fn: (tx: typeof query)=>Promise<T>) => { const v=await fn(query);commits++;return v },
    unsafe: query.unsafe,
    get commits() { return commits },
  }
}
function auditRecord(prevHash: string, seq: number, orgId = ORG, id: string = randomUUID()): AuditEntry {
  const body = {
    id, timestamp: '2026-10-30T15:00:00.000Z', actorId: 'host-actor', orgId,
    action: 'tool_fabric.ledger.tool_registered', resource: 'tool-fabric-tool',
    resourceId: 'sample-tool',
    payload: { seq, prevEventHash: LEDGER_GENESIS_HASH, eventHash: 'a'.repeat(64) },
  }
  return { ...body, prevHash, hashVersion: 2, hash: computeAuditHash(prevHash, body) }
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
  it('fails closed on null, blank, noncanonical or unsafe PostgreSQL head revisions', async () => {
    // A SQL NULL would otherwise be coerced by Number(null) to genesis 0.
    for (const invalid of [null, undefined, '', ' ', '00', '01', '-0', '-1',
      '1.0', '1e0', '9007199254740992', 0, 1]) {
      const query = {
        unsafe: async (sql: string) => sql.includes('FOR SHARE')
          ? [{ revision: invalid, head_hash: LEDGER_GENESIS_HASH }]
          : [],
      }
      const db = { ...query, begin: async <T>(fn: (tx: typeof query) => Promise<T>) => fn(query) }
      await expect(new PostgresAtomicTrustLedgerStore(db).readSnapshot(ORG))
        .rejects.toThrow('Persistent trust stream head is invalid')
    }
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

  it('rejects unhashed metadata and unrecognized fields in durable trust receipts', async () => {
    const valid = auditRecord(LEDGER_GENESIS_HASH, 1)
    for (const altered of [
      { ...valid, traceId: 'unhashed-trace' },
      { ...valid, spanId: 'unhashed-span' },
      { ...valid, unrecognized: 'not-covered-by-audit-hash' },
    ]) {
      const persisted = new PostgresAtomicTrustLedgerStore(fake({
        revision: 1, hash: valid.hash, entries: [altered],
      }))
      await expect(persisted.readSnapshot(ORG)).rejects.toThrow('malformed')
      const db = fake()
      const store = new PostgresAtomicTrustLedgerStore(db)
      await expect(store.compareAndAppend(
        ORG, { revision: 0, headHash: LEDGER_GENESIS_HASH }, altered,
      )).rejects.toBeInstanceOf(LedgerConflictError)
      expect(db.commits).toBe(0)
    }
  })

  it('verifies every stored audit hash before returning a PostgreSQL snapshot', async () => {
    const entry = auditRecord(LEDGER_GENESIS_HASH, 1)
    const store = new PostgresAtomicTrustLedgerStore(fake({
      revision: 1, hash: entry.hash, entries: [entry],
    }))
    await expect(store.readSnapshot(ORG)).resolves.toEqual({
      revision: 1, headHash: entry.hash, entries: [entry],
    })
    const altered = { ...entry, payload: { ...entry.payload, seq: 999 } }
    const poisoned = new PostgresAtomicTrustLedgerStore(fake({
      revision: 1, hash: entry.hash, entries: [altered],
    }))
    await expect(poisoned.readSnapshot(ORG)).rejects.toThrow('audit chain failed integrity')
  })
  it('rejects coerced, noncanonical, or unsafe BIGINT receipt indexes', async () => {
    const entry = auditRecord(LEDGER_GENESIS_HASH, 1)
    const row = { seq:'1', audit_id:entry.id, entry_hash:entry.hash, entry }
    for (const invalid of [null, undefined, 1, true, '', ' ', '01', '1 ',
      '+1', '1.0', '1e0', '0', '-1', '9007199254740992']) {
      const store = new PostgresAtomicTrustLedgerStore(fake({
        revision:1, hash:entry.hash, rows:[{...row, seq:invalid}],
      }))
      await expect(store.readSnapshot(ORG)).rejects.toThrow('invalid sequence index')
    }
  })
  it('rejects tampered relational audit receipt indexes even when JSON chain is valid', async () => {
    const entry = auditRecord(LEDGER_GENESIS_HASH, 1)
    const row = { seq:'1', audit_id:entry.id, entry_hash:entry.hash, entry }
    const valid = { revision:1, hash:entry.hash }
    await expect(new PostgresAtomicTrustLedgerStore(fake({
      ...valid, rows:[{...row, audit_id:randomUUID()}],
    })).readSnapshot(ORG)).rejects.toThrow('audit receipt columns disagree')
    await expect(new PostgresAtomicTrustLedgerStore(fake({
      ...valid, rows:[{...row, entry_hash:'f'.repeat(64)}],
    })).readSnapshot(ORG)).rejects.toThrow('audit receipt columns disagree')
    await expect(new PostgresAtomicTrustLedgerStore(fake({
      ...valid, rows:[{...row, audit_id:null}],
    })).readSnapshot(ORG)).rejects.toThrow('audit receipt columns disagree')
  })
  it('refuses to extend a poisoned historical stream even when indexed head matches', async () => {
    const first = auditRecord(LEDGER_GENESIS_HASH, 1)
    const next = auditRecord(first.hash, 2)
    const poisoned = { ...first, payload: { ...first.payload, seq: 999 } }
    const db = fake({ revision: 1, hash: first.hash, entries: [poisoned] })
    const store = new PostgresAtomicTrustLedgerStore(db)
    await expect(store.compareAndAppend(ORG, { revision: 1, headHash: first.hash }, next))
      .rejects.toThrow('audit chain failed integrity')
    expect(db.commits).toBe(0)
  })
  it('refuses to extend a stream with missing durable audit records', async () => {
    const first = auditRecord(LEDGER_GENESIS_HASH, 1)
    const next = auditRecord(first.hash, 2)
    const db = fake({ revision: 1, hash: first.hash, entries: [] })
    await expect(new PostgresAtomicTrustLedgerStore(db).compareAndAppend(
      ORG, { revision: 1, headHash: first.hash }, next,
    )).rejects.toThrow('missing or excess events')
    expect(db.commits).toBe(0)
  })
  it('rejects foreign-stream, legacy-v1 and duplicated audit records on snapshot reads', async () => {
    const foreign = auditRecord(LEDGER_GENESIS_HASH, 1, 'foreign-org')
    await expect(new PostgresAtomicTrustLedgerStore(fake({
      revision: 1, hash: foreign.hash, entries: [foreign],
    })).readSnapshot(ORG)).rejects.toThrow('audit chain failed integrity')
    const first = auditRecord(LEDGER_GENESIS_HASH, 1)
    await expect(new PostgresAtomicTrustLedgerStore(fake({
      revision: 1, hash: first.hash, entries: [{ ...first, hashVersion: 1 }],
    })).readSnapshot(ORG)).rejects.toThrow('audit chain failed integrity')
    const duplicate = auditRecord(first.hash, 2, ORG, first.id)
    await expect(new PostgresAtomicTrustLedgerStore(fake({
      revision: 2, hash: duplicate.hash, entries: [first, duplicate],
    })).readSnapshot(ORG)).rejects.toThrow('audit chain failed integrity')
  })
})
