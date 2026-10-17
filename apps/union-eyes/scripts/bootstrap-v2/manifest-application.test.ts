import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApplicationStartupProof } from './backend-application'
import { proveCurrentApplicationStartup } from './backend-application'
import { bindApplicationStartupSources, qualifyApplicationStartup } from './manifest-application'
import { currentBackendSourceDigests, type V2Plan } from './source'

vi.mock('./backend-application', () => ({ proveCurrentApplicationStartup: vi.fn() }))

const plan = (sourceCommitments: Record<string, string> = {}) => ({ sourceCommitments }) as V2Plan
const helper = 'apps/union-eyes/scripts/bootstrap-v2/backend-application.ts'
const proof: ApplicationStartupProof = {
  lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2',
  contractVersion: '2.0',
  djangoVersion: '5.2.18',
  startup: 'PASS',
  currentSettings: 'config.settings',
  modelChecks: 'PASS',
  urlChecks: 'PASS',
  rootUrlPatterns: 20,
  currentManagedModels: 542,
  databaseConnections: 0,
  runtimeDatabaseQualification: 'NOT_PROVEN',
  sourceDigests: {},
}

describe('current backend startup manifest wiring', () => {
  beforeEach(() => vi.resetAllMocks())

  it('binds helper bytes without rewriting earlier source commitments or mutating the input', () => {
    const original = plan({ [helper]: 'stale' })
    const bound = bindApplicationStartupSources(original)
    expect(bound.sourceCommitments[helper]).toBe('stale')
    expect(
      bound.sourceCommitments['apps/union-eyes/scripts/bootstrap-v2/current_application.py'],
    ).toMatch(/^[a-f0-9]{64}$/)
    expect(Object.keys(original.sourceCommitments)).toEqual([helper])
  })

  it('reports missing startup prerequisites honestly without running a collector', () => {
    expect(qualifyApplicationStartup(plan())).toEqual({
      startup: 'NOT_PROVEN',
      runtimeDatabaseQualification: 'NOT_PROVEN',
      reason: 'UE_V2_WHEELHOUSE_REQUIRED',
    })
    expect(proveCurrentApplicationStartup).not.toHaveBeenCalled()
  })

  it('binds the complete copied backend before execution and leaves generation bytes stable', () => {
    const bound = bindApplicationStartupSources(plan())
    const bytes = JSON.stringify(bound)
    for (const [file, digest] of Object.entries(currentBackendSourceDigests()))
      expect(bound.sourceCommitments[file]).toBe(digest)
    expect(Object.keys(bound.sourceCommitments)).not.toContain('apps/union-eyes/backend/.env')
    expect(JSON.stringify(bindApplicationStartupSources(bound))).toBe(bytes)
    vi.mocked(proveCurrentApplicationStartup).mockReturnValue({
      ...proof,
      sourceDigests: currentBackendSourceDigests(),
    })
    qualifyApplicationStartup(bound, 'synthetic-wheels')
    expect(JSON.stringify(bound)).toBe(bytes)
  })

  it('keeps successful backend startup separate from runtime database qualification', () => {
    vi.mocked(proveCurrentApplicationStartup).mockReturnValue(proof)
    const result = qualifyApplicationStartup(
      bindApplicationStartupSources(plan()),
      'synthetic-wheels',
    )
    expect(proveCurrentApplicationStartup).toHaveBeenCalledWith('synthetic-wheels')
    expect(result).toEqual(proof)
    expect(result.runtimeDatabaseQualification).toBe('NOT_PROVEN')
  })

  it('rejects changed source commitments rather than blessing new hashes', () => {
    vi.mocked(proveCurrentApplicationStartup).mockReturnValue(proof)
    expect(() =>
      qualifyApplicationStartup(
        bindApplicationStartupSources(plan({ [helper]: 'stale' })),
        'synthetic-wheels',
      ),
    ).toThrow('UE_V2_STARTUP_SOURCE_CHANGED_SINCE_PLAN')
  })

  it('rejects observed backend sources omitted from the plan rather than adding them after proof', () => {
    const bound = bindApplicationStartupSources(plan())
    const file = 'apps/union-eyes/backend/config/settings.py'
    vi.mocked(proveCurrentApplicationStartup).mockReturnValue({
      ...proof,
      sourceDigests: { [file]: bound.sourceCommitments[file] },
    })
    delete bound.sourceCommitments[file]
    expect(() => qualifyApplicationStartup(bound, 'synthetic-wheels')).toThrow(
      `UE_V2_STARTUP_SOURCE_NOT_BOUND:${file}`,
    )
    expect(bound.sourceCommitments[file]).toBeUndefined()
  })

  it('propagates collector failures instead of manufacturing startup success', () => {
    vi.mocked(proveCurrentApplicationStartup).mockImplementation(() => {
      throw new Error('STARTUP_FAILED')
    })
    expect(() =>
      qualifyApplicationStartup(bindApplicationStartupSources(plan()), 'synthetic-wheels'),
    ).toThrow('STARTUP_FAILED')
  })
})
