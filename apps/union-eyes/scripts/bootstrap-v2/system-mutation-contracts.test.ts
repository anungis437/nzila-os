import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { folder, hash, root, type V2Plan } from './source'
import { systemMutationContracts, systemMutationRules } from './system-mutation-contracts'

const plan: V2Plan = JSON.parse(
  readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
)
describe('current source-bound SYSTEM mutation contracts', () => {
  it.each([
    'lib/api-auth-guard.ts',
    'lib/api/with-api.ts',
    'lib/auth/canonical-context.ts',
    'app/api/admin/system/cache/route.ts',
    'app/api/admin/database/optimize/route.ts',
    'app/api/admin/users/[userId]/route.ts',
    'app/api/users/me/organizations/route.ts',
    'app/api/pilot/overview/route.ts',
    'services/platform-economics/transaction-fee-engine.ts',
    'services/platform-economics/fee-adjustment-insert.ts',
  ])('binds current API source %s without implying whole application qualification', (relative) => {
    const file = `apps/union-eyes/${relative}`
    expect(plan.sourceCommitments[file]).toBe(
      hash(readFileSync(path.join(root, ...file.split('/')), 'utf8')),
    )
  })
  it('keeps the frozen switch-route commitment while the current file has moved', () => {
    const file = 'apps/union-eyes/app/api/organizations/switch/route.ts'
    const frozen = 'be3455b601960375c1363ec51bcc9aac0f2b0470e7e1c594da9ca8a3ab3db767'
    const current = hash(readFileSync(path.join(root, ...file.split('/')), 'utf8'))
    expect(plan.sourceCommitments[file]).toBe(frozen)
    expect(current).not.toBe(frozen)
    expect(
      readFileSync(path.join(root, 'apps/union-eyes/scripts/bootstrap-v2/source.ts'), 'utf8'),
    ).toContain(frozen)
  })
  it('binds the exact 53 authorized relations, source callers and real selector columns', () => {
    const contracts = systemMutationContracts(plan)
    expect(contracts.map((contract) => contract.table)).toEqual(
      systemMutationRules(plan).map((rule) => rule.table),
    )
    expect(contracts).toHaveLength(53)
    for (const contract of contracts) expect(contract.callerDigest).toMatch(/^[a-f0-9]{64}$/)
  })
  it('fails closed on a changed mutation census instead of silently dropping tables', () => {
    const changed = structuredClone(plan)
    changed.tables.find(
      (table) => table.name === 'fee_adjustments',
    )!.authority!.requiredSystemPrivileges = []
    expect(() => systemMutationContracts(changed)).toThrow(
      'UE_V2_SYSTEM_MUTATION_EXACT_DENOMINATOR_REQUIRED',
    )
  })
  it('does not infer ownership or a caller when source authority changes', () => {
    const changed = structuredClone(plan)
    changed.tables.find(
      (table) => table.name === 'fee_adjustments',
    )!.authority!.supportingCapability = []
    expect(() => systemMutationContracts(changed)).toThrow(
      'UE_V2_SYSTEM_MUTATION_CALLER_AUTHORITY_REQUIRED',
    )
  })
  it('rejects a stale committed caller rather than claiming current source qualification', () => {
    const changed = structuredClone(plan)
    changed.sourceCommitments[
      'apps/union-eyes/services/platform-economics/transaction-fee-engine.ts'
    ] = '0'.repeat(64)
    expect(() => systemMutationContracts(changed)).toThrow(
      'UE_V2_SYSTEM_MUTATION_CALLER_SOURCE_DRIFT',
    )
  })
  it('rejects a changed or unbound production fee result helper', () => {
    const changed = structuredClone(plan)
    delete changed.sourceCommitments[
      'apps/union-eyes/services/platform-economics/fee-adjustment-insert.ts'
    ]
    expect(() => systemMutationContracts(changed)).toThrow(
      'UE_V2_SYSTEM_MUTATION_FEE_HELPER_SOURCE_DRIFT',
    )
  })
  it('requires the production write-owned complete fee result and real service update columns', () => {
    const contracts = systemMutationContracts(plan)
    expect(contracts.find((contract) => contract.table === 'fee_adjustments')).toMatchObject({
      insertReturning: [],
      writeOwnedFeeResult: true,
    })
    expect(contracts.find((contract) => contract.table === 'transaction_fee_events')).toMatchObject(
      {
        updateColumn: 'status',
        updateValue: 'reversed',
      },
    )
    expect(contracts.find((contract) => contract.table === 'external_data_sync_log')).toMatchObject(
      {
        selector: 'sync_id',
        updateColumn: 'status',
        updateValue: 'completed',
      },
    )
    expect(contracts.find((contract) => contract.table === 'alert_executions')).toMatchObject({
      insertReturning: [],
      preallocateInsertIdentity: true,
    })
  })
})
