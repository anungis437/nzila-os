import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AuditEngine } from '../../packages/audit/src/engine'
import { InMemoryAuditStore } from '../../packages/audit/src/store'
import { verifyChain } from '../../packages/audit/src/verify'
import { ROOT } from './governance-helpers'

describe('Evidence chain integrity', () => {
  it('builds a valid append-only audit chain', async () => {
    const store = new InMemoryAuditStore()
    const engine = new AuditEngine(store)

    await engine.record({ actorId: 'actor-1', orgId: 'org-1', action: 'seed', resource: 'evidence', payload: { seq: 1 } })
    await engine.record({ actorId: 'actor-1', orgId: 'org-1', action: 'seal', resource: 'evidence', payload: { seq: 2 } })
    await engine.record({ actorId: 'actor-2', orgId: 'org-1', action: 'verify', resource: 'evidence', payload: { seq: 3 } })

    const entries = await store.getEntries('org-1', { limit: 100 })
    const result = verifyChain(entries)
    expect(result.valid).toBe(true)
    expect(result.entriesChecked).toBe(3)
  })

  it('detects any tampering in the chain', async () => {
    const store = new InMemoryAuditStore()
    const engine = new AuditEngine(store)

    await engine.record({ actorId: 'actor-1', orgId: 'org-2', action: 'append', resource: 'evidence', payload: { seq: 1 } })
    await engine.record({ actorId: 'actor-1', orgId: 'org-2', action: 'append', resource: 'evidence', payload: { seq: 2 } })

    const entries = await store.getEntries('org-2', { limit: 100 })
    entries[1] = { ...entries[1], hash: '0'.repeat(64) }
    const result = verifyChain(entries)
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(entries[1].id)
  })

  it('keeps the canonical chain fields in the audit schema', () => {
    const schemaSource = readFileSync(join(ROOT, 'packages', 'audit', 'src', 'schema.ts'), 'utf8')
    expect(schemaSource).toContain('timestamp')
    expect(schemaSource).toContain('actorId')
    expect(schemaSource).toContain('action')
    expect(schemaSource).toContain('prevHash')
    expect(schemaSource).toContain('hash')
  })
})
