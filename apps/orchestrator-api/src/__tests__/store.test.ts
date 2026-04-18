/**
 * Orchestrator API — Store + Route Integration Tests
 *
 * Tests the command lifecycle (create → get → update → list)
 * using the in-memory fallback store (no DATABASE_URL).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createCommand, getCommand, updateCommandStatus, listCommands } from '../store.js'
import type { CommandRecord } from '../contract.js'

// Ensure in-memory fallback by not setting DATABASE_URL
delete process.env.DATABASE_URL

function makeCommand(
  overrides: Partial<Omit<CommandRecord, 'created_at' | 'updated_at'>> = {},
) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    org_id: overrides.org_id ?? '00000000-0000-0000-0000-000000000000',
    correlation_id: overrides.correlation_id ?? crypto.randomUUID(),
    idempotency_key: overrides.idempotency_key ?? overrides.correlation_id ?? crypto.randomUUID(),
    playbook: overrides.playbook ?? ('lint_check' as const),
    status: overrides.status ?? ('pending' as const),
    version: overrides.version ?? 1,
    attempt_count: overrides.attempt_count ?? 0,
    dry_run: overrides.dry_run ?? true,
    requested_by: overrides.requested_by ?? 'test-actor',
    args: overrides.args ?? {},
    run_id: overrides.run_id ?? null,
    run_url: overrides.run_url ?? null,
    error_message: overrides.error_message ?? null,
    execution_owner: overrides.execution_owner ?? null,
    lease_expires_at: overrides.lease_expires_at ?? null,
    last_heartbeat_at: overrides.last_heartbeat_at ?? null,
    started_at: overrides.started_at ?? null,
    completed_at: overrides.completed_at ?? null,
  }
}

describe('Orchestrator Store — in-memory mode', () => {
  it('creates and retrieves a command', async () => {
    const input = makeCommand()
    const record = await createCommand(input)

    expect(record.correlation_id).toBe(input.correlation_id)
    expect(record.status).toBe('pending')
    expect(record.created_at).toBeTruthy()
    expect(record.updated_at).toBeTruthy()

    const fetched = await getCommand(input.correlation_id)
    expect(fetched).toBeDefined()
    expect(fetched!.id).toBe(input.id)
  })

  it('returns undefined for unknown correlation_id', async () => {
    const fetched = await getCommand('does-not-exist')
    expect(fetched).toBeUndefined()
  })

  it('updates command status', async () => {
    const input = makeCommand()
    await createCommand(input)

    const updated = await updateCommandStatus(input.correlation_id, 'dispatched', {
      run_id: 'run-123',
      run_url: 'https://github.com/actions/runs/123',
    })

    expect(updated).toBeDefined()
    expect(updated!.status).toBe('dispatched')
    expect(updated!.run_id).toBe('run-123')
    expect(updated!.run_url).toBe('https://github.com/actions/runs/123')
  })

  it('returns undefined when updating non-existent command', async () => {
    const result = await updateCommandStatus('no-such-id', 'failed')
    expect(result).toBeUndefined()
  })

  it('lists all commands', async () => {
    const cmd1 = makeCommand()
    const cmd2 = makeCommand()
    await createCommand(cmd1)
    await createCommand(cmd2)

    const all = await listCommands()
    const ids = all.map((c) => c.correlation_id)
    expect(ids).toContain(cmd1.correlation_id)
    expect(ids).toContain(cmd2.correlation_id)
  })
})
