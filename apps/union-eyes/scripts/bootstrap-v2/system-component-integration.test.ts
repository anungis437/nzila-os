import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { folder, type V2Plan } from './source'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  prove: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('./native-runtime-fixture', () => ({ openNativeRuntimeFixture: mocks.open }))
vi.mock('./runtime-security', () => ({ proveRuntimeSecurity: mocks.prove }))

import { proveIntegratedSystemMutations } from './clean-room'
import { systemMutationContracts } from './system-mutation-contracts'

describe('integrated SYSTEM component ownership and cleanup', () => {
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  const fixture = {
    seed: {},
    runtime: {},
    system: {},
    systemWriter: {},
    dispose: mocks.dispose,
  }
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.open.mockResolvedValue(fixture)
    mocks.dispose.mockResolvedValue(undefined)
  })

  it('uses the exact source census and production writer in a separate owned fixture', async () => {
    const result = { status: 'PASS_COMPONENT_MATRIX', qualified: 39, denominator: 39 }
    mocks.prove.mockResolvedValue(result)
    expect(await proveIntegratedSystemMutations(plan)).toBe(result)
    expect(mocks.open).toHaveBeenCalledWith(plan)
    expect(mocks.prove).toHaveBeenCalledWith(
      fixture.seed,
      fixture.runtime,
      fixture.system,
      plan,
      expect.any(Array),
      undefined,
      systemMutationContracts(plan),
      fixture.systemWriter,
    )
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })

  it('preserves a failed matrix rather than converting it to success', async () => {
    const result = { status: 'FAIL', qualified: 38, denominator: 39, failed: 1 }
    mocks.prove.mockResolvedValue(result)
    expect(await proveIntegratedSystemMutations(plan)).toBe(result)
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })

  it('cleans its fixture and propagates a proof exception', async () => {
    const failure = new Error('SYSTEM qualification failed')
    mocks.prove.mockRejectedValue(failure)
    await expect(proveIntegratedSystemMutations(plan)).rejects.toBe(failure)
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })

  it('does not hide cleanup failure behind a successful proof', async () => {
    mocks.prove.mockResolvedValue({ status: 'PASS_COMPONENT_MATRIX' })
    const failure = new Error('SYSTEM fixture cleanup failed')
    mocks.dispose.mockRejectedValue(failure)
    await expect(proveIntegratedSystemMutations(plan)).rejects.toBe(failure)
  })

  it('preserves both proof and cleanup failures', async () => {
    const proof = new Error('SYSTEM qualification failed')
    const cleanup = new Error('SYSTEM fixture cleanup failed')
    mocks.prove.mockRejectedValue(proof)
    mocks.dispose.mockRejectedValue(cleanup)
    await expect(proveIntegratedSystemMutations(plan)).rejects.toMatchObject({
      errors: [proof, cleanup],
      cause: proof,
    })
  })

  it('does not run qualification when fixture creation fails', async () => {
    const failure = new Error('SYSTEM fixture allocation failed')
    mocks.open.mockRejectedValue(failure)
    await expect(proveIntegratedSystemMutations(plan)).rejects.toBe(failure)
    expect(mocks.prove).not.toHaveBeenCalled()
    expect(mocks.dispose).not.toHaveBeenCalled()
  })

  it.each([
    'clean-room.ts',
    'runtime-security.ts',
    'native-runtime-fixture.ts',
    'system-mutation-contracts.ts',
    'fee-adjustment-native-proof.ts',
  ])('rejects stale %s producer bytes before allocating a fixture', async (file) => {
    const source = `apps/union-eyes/scripts/bootstrap-v2/${file}`
    const stale = {
      ...plan,
      sourceCommitments: { ...plan.sourceCommitments, [source]: 'unbound-bytes' },
    }
    await expect(proveIntegratedSystemMutations(stale)).rejects.toThrow(
      `UE_V2_SYSTEM_PRODUCER_SOURCE_NOT_BOUND:${source}`,
    )
    expect(mocks.open).not.toHaveBeenCalled()
    expect(mocks.prove).not.toHaveBeenCalled()
  })
})
