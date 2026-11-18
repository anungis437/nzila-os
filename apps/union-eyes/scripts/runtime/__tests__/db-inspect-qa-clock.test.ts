import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRuntimeFixtureAuth, writeRuntimeFixtureAuth } from '../fixture-auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ connect: vi.fn(), query: vi.fn(), end: vi.fn() }))
vi.mock('pg', () => ({
  default: {
    Client: class {
      connect = m.connect
      query = m.query
      end = m.end
    },
  },
}))

import { ageQaCase } from '../db-inspect'

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  UE_RUNTIME_OPERATOR_DATABASE_URL: process.env.UE_RUNTIME_OPERATOR_DATABASE_URL,
  QA_TEST_ENV: process.env.QA_TEST_ENV,
  UE_CANONICAL_BOOTSTRAP_V2: process.env.UE_CANONICAL_BOOTSTRAP_V2,
  UE_RUNTIME_STATE_DIR: process.env.UE_RUNTIME_STATE_DIR,
}
const qaCase = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
let state: string

// What the database reports back for a case that really was aged: the clock, and the row the history is keyed by.
const agedRow = (hours = 72) => ({
  claim_id: qaCase,
  id: 'row-id',
  status_changed_at: new Date(Date.now() - hours * 60 * 60 * 1000),
})

describe('QA case status-duration fixture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state = mkdtempSync(path.join(tmpdir(), 'ue-clock-fixture-'))
    process.env.UE_RUNTIME_STATE_DIR = state
    process.env.QA_TEST_ENV = 'true'
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    process.env.UE_RUNTIME_OPERATOR_DATABASE_URL =
      'postgresql://uev2admin@127.0.0.1:55516/ue_runtime'
    writeRuntimeFixtureAuth(
      createRuntimeFixtureAuth(process.env.UE_RUNTIME_OPERATOR_DATABASE_URL, []),
      state,
    )
    m.query.mockImplementation(async (_sql: string, values?: unknown[]) => ({
      rowCount: 1,
      rows: [{ ...agedRow(), claim_id: values?.[0] ?? qaCase }],
    }))
  })
  afterEach(() => {
    rmSync(state, { recursive: true, force: true })
    for (const [key, value] of Object.entries(originalEnv))
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
  })

  it('ages the canonical status clock, with triggers off in one transaction, without falsifying last-edit time', async () => {
    await ageQaCase(qaCase, 72)
    const calls = m.query.mock.calls as Array<[string, unknown[]?]>
    // The claims trigger ignores a write to the clock that comes with no change of status, so the fixture writes it with triggers off, atomically.
    expect(calls[0][0]).toBe('BEGIN')
    expect(calls[1][0]).toBe('SET LOCAL session_replication_role = replica')
    const [sql, values] = calls[2] as [string, unknown[]]
    expect(sql).toContain('status_changed_at = now() - make_interval')
    expect(sql).not.toContain('SET updated_at')
    expect(sql).toContain("organization_id = '11111111-1111-4111-8111-111111111111'")
    expect(sql).toContain('RETURNING claim_id, id, status_changed_at')
    expect(values).toEqual([qaCase, 72])
    // The latest recorded transition moves with the clock, so the history and the clock agree.
    const [historySql, historyValues] = calls[3] as [string, unknown[]]
    expect(historySql).toContain(
      'UPDATE claim_status_transitions SET changed_at = now() - make_interval',
    )
    expect(historyValues).toEqual(['row-id', 72])
    expect(calls[4][0]).toBe('SET LOCAL session_replication_role = origin')
    expect(calls[5][0]).toBe('COMMIT')
    const receipt = JSON.parse(
      readFileSync(path.join(state, 'privileged-state-preparation.jsonl'), 'utf8').trim(),
    )
    expect(receipt).toMatchObject({
      scope: 'DATA_PREPARATION_ONLY',
      ordinaryClockImmutabilityProven: false,
      claimId: qaCase,
      hours: 72,
    })
  })

  it('ages a case the fixture member filed itself within the owned QA organization', async () => {
    await expect(ageQaCase('f3b1a1c2-0d4e-4f5a-9b6c-7d8e9f0a1b2c', 72)).resolves.toBeUndefined()
    expect((m.query.mock.calls[2] as [string, unknown[]])[1]).toEqual([
      'f3b1a1c2-0d4e-4f5a-9b6c-7d8e9f0a1b2c',
      72,
    ])
  })

  it.each([0, -1, 1.5, 8761, Number.NaN])(
    'rejects an invalid elapsed-hours value %s before database access',
    async (hours) => {
      await expect(ageQaCase(qaCase, hours)).rejects.toThrow('Invalid QA case age')
      expect(m.connect).not.toHaveBeenCalled()
    },
  )

  it('does not report a successful backdate when the persisted clock was left unchanged, and rolls the transaction back', async () => {
    m.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ claim_id: qaCase, id: 'row-id', status_changed_at: new Date() }],
    })
    await expect(ageQaCase(qaCase, 72)).rejects.toThrow('database trigger preserved')
    const sqls = (m.query.mock.calls as Array<[string]>).map(([sql]) => sql)
    expect(sqls).toContain('ROLLBACK')
    expect(sqls).not.toContain('COMMIT')
    expect(sqls.some((sql) => sql.includes('claim_status_transitions'))).toBe(false)
    expect(m.end).toHaveBeenCalledTimes(1)
  })

  it('does not report a successful backdate when the database returns no readable clock', async () => {
    m.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ claim_id: qaCase, id: 'row-id', status_changed_at: null }],
    })
    await expect(ageQaCase(qaCase, 72)).rejects.toThrow('QA status clock was not backdated')
  })

  it('refuses to claim that a missing or non-QA case was aged, and rolls the whole transaction back', async () => {
    m.query.mockResolvedValue({ rowCount: 0, rows: [] })
    await expect(ageQaCase(qaCase, 72)).rejects.toThrow('QA case not found')
    const sqls = (m.query.mock.calls as Array<[string]>).map(([sql]) => sql)
    expect(sqls).toContain('ROLLBACK')
    expect(sqls).not.toContain('COMMIT')
    // Nothing is written to the history for a case that was not aged.
    expect(sqls.some((sql) => sql.includes('claim_status_transitions'))).toBe(false)
    expect(m.end).toHaveBeenCalled()
  })
})
