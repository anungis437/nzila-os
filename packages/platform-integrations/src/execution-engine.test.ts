import { describe, it, expect, vi } from 'vitest'
import { IntegrationExecutionEngine, type ExecutionEnginePorts, type ExecutionContext } from './execution-engine'
import type { ConnectorAdapter } from './connector-registry'
import type { IntegrationConnection, IntegrationRun } from '@nzila/platform-integrations-types'

const connection = { id: 'conn-1', orgId: 'org-1', name: 'synthetic', connectorType: 'webhook' } as IntegrationConnection
const context: ExecutionContext = { orgId: 'org-1', actorId: 'actor-1', actorType: 'service', traceId: 'trace-1', correlationId: 'corr-1', idempotencyKey: 'key-1' }
const run: IntegrationRun = { id: 'run-1', orgId: 'org-1', connectionId: 'conn-1', direction: 'inbound', eventType: 'inbound.payload', sourceSystem: 'synthetic', targetSystem: 'nzila', status: 'failed', traceId: 'trace-1', idempotencyKey: 'key-1', startedAt: '2026-11-28T00:00:00Z', finishedAt: '2026-11-28T00:00:01Z', errorSummary: 'synthetic failure', payloadSummary: null, recordsProcessed: 0, recordsFailed: 1 }
function setup() {
  const ports: ExecutionEnginePorts = {
    runStore: { create: vi.fn(), getById: vi.fn(async () => run), listByOrg: vi.fn(), listByConnection: vi.fn(), updateStatus: vi.fn() },
    auditHooks: { recordIntegrationAction: vi.fn() },
    eventEmitter: { emit: vi.fn() },
    idempotencyStore: { check: vi.fn(async () => ({ runId: run.id })), record: vi.fn(), remove: vi.fn() },
  }
  const adapter = { executeInbound: vi.fn(), executeOutbound: vi.fn() } as unknown as ConnectorAdapter
  return { ports, adapter, engine: new IntegrationExecutionEngine(ports) }
}
describe('integration execution receipt integrity', () => {
  it('refuses mismatched tenant before any execution, inbound and outbound', async () => {
    const { engine, ports, adapter } = setup()
    for (const execute of [engine.executeInbound.bind(engine), engine.executeOutbound.bind(engine)]) {
      await expect(execute(connection, adapter, {}, { ...context, orgId: 'foreign' })).rejects.toThrow('INTEGRATION_TENANT_MISMATCH')
    }
    expect(ports.runStore.create).not.toHaveBeenCalled()
    expect(ports.idempotencyStore.check).not.toHaveBeenCalled()
    expect(adapter.executeInbound).not.toHaveBeenCalled()
    expect(adapter.executeOutbound).not.toHaveBeenCalled()
  })
  it('replays the actual persisted failed receipt without a second adapter effect', async () => {
    const { engine, ports, adapter } = setup()
    expect(await engine.executeInbound(connection, adapter, {}, context)).toEqual(run)
    expect(ports.runStore.getById).toHaveBeenCalledWith(run.id)
    expect(adapter.executeInbound).not.toHaveBeenCalled()
    expect(ports.runStore.create).not.toHaveBeenCalled()
  })
  it('replays a completed receipt rather than a cache-shaped object', async () => {
    const { engine, ports, adapter } = setup()
    const completed: IntegrationRun = { ...run, status: 'completed', recordsProcessed: 1, recordsFailed: 0, errorSummary: null }
    vi.mocked(ports.runStore.getById).mockResolvedValueOnce(completed)
    expect(await engine.executeInbound(connection, adapter, {}, context)).toEqual(completed)
    expect(adapter.executeInbound).not.toHaveBeenCalled()
  })
  it('refuses missing, foreign, wrong connection or wrong key replay receipts', async () => {
    const { engine, ports, adapter } = setup()
    for (const persisted of [null, { ...run, orgId: 'foreign' }, { ...run, connectionId: 'other' }, { ...run, idempotencyKey: 'other' }, { ...run, direction: 'outbound' as const }]) {
      vi.mocked(ports.runStore.getById).mockResolvedValueOnce(persisted)
      await expect(engine.executeInbound(connection, adapter, {}, context)).rejects.toThrow('INTEGRATION_REPLAY_RECONCILIATION_REQUIRED')
    }
    expect(adapter.executeInbound).not.toHaveBeenCalled()
    expect(ports.runStore.create).not.toHaveBeenCalled()
  })
  it('refuses malformed cached receipt without fetching or executing', async () => {
    const { engine, ports, adapter } = setup()
    vi.mocked(ports.idempotencyStore.check).mockResolvedValueOnce({ status: 'completed' })
    await expect(engine.executeInbound(connection, adapter, {}, context)).rejects.toThrow('INTEGRATION_REPLAY_RECONCILIATION_REQUIRED')
    expect(ports.runStore.getById).not.toHaveBeenCalled()
    expect(adapter.executeInbound).not.toHaveBeenCalled()
  })
})
