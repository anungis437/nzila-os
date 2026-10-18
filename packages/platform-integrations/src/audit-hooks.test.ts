import { describe, expect, it } from 'vitest'
import { AuditEngine, InMemoryAuditStore, exportAuditLog, verifyChain } from '@nzila/audit'
import { DefaultIntegrationAuditHooks } from './audit-hooks'

describe('integration audit hash contract', () => {
  it('records v2 through the existing port and detects nested integration-payload tampering', async () => {
    const store = new InMemoryAuditStore()
    const hooks = new DefaultIntegrationAuditHooks(new AuditEngine(store))
    await hooks.recordIntegrationAction({
      actorId: 'synthetic-actor', orgId: 'synthetic-org', action: 'sync', resource: 'connector',
      payload: { result: { imported: 1, scopes: ['read'] } },
    })
    const [entry] = store.getAll()
    expect(entry.hashVersion).toBe(2)
    expect(entry.action).toBe('integration.sync')
    expect(verifyChain([entry], { requireFullCoverage: true })).toMatchObject({ valid: true, hashCoverage: 'FULL' })
    const tampered = { ...entry, payload: { ...entry.payload, result: { imported: 2, scopes: ['write'] } } }
    expect(verifyChain([tampered]).valid).toBe(false)
    const exported = await exportAuditLog(store, { orgId: entry.orgId })
    expect(verifyChain(JSON.parse(exported.data), { requireFullCoverage: true })).toMatchObject({
      valid: true, hashCoverage: 'FULL', legacyEntriesChecked: 0,
    })
    expect(verifyChain([{ ...entry, hashVersion: 1 }]).valid).toBe(false)
  })

  it('propagates serialization failures instead of silently producing an unverified audit', async () => {
    const store = new InMemoryAuditStore()
    const hooks = new DefaultIntegrationAuditHooks(new AuditEngine(store))
    await expect(hooks.recordIntegrationAction({
      actorId: 'synthetic-actor', orgId: 'synthetic-org', action: 'sync', resource: 'connector',
      payload: { result: { imported: 1n } },
    })).rejects.toThrow()
    expect(store.getAll()).toHaveLength(0)
  })
})
