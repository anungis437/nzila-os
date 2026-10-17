import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { proveCurrentApplicationStartup } from './backend-application'
import { hash, root, runCurrentSourcePython } from './source'

vi.mock('./source', async (original) => ({
  ...(await original<typeof import('./source')>()),
  runCurrentSourcePython: vi.fn(),
}))

function startup() {
  return {
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
    sourceDigests: Object.fromEntries(
      ['settings.py', 'wsgi.py', 'urls.py'].map((name) => {
        const file = `apps/union-eyes/backend/config/${name}`
        return [file, hash(readFileSync(path.join(root, ...file.split('/')), 'utf8'))]
      }),
    ),
  }
}

describe('current application startup proof boundaries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('binds actual settings, WSGI and URL source without inferring database proof', () => {
    vi.mocked(runCurrentSourcePython).mockReturnValue(JSON.stringify(startup()))
    const proof = proveCurrentApplicationStartup('offline-wheelhouse')
    expect(runCurrentSourcePython).toHaveBeenCalledWith(
      'offline-wheelhouse',
      'current_application.py',
    )
    expect(proof.startup).toBe('PASS')
    expect(proof.runtimeDatabaseQualification).toBe('NOT_PROVEN')
  })

  it.each([
    { startup: 'FAIL' },
    { currentSettings: 'isolated.settings' },
    { databaseConnections: 1 },
    { runtimeDatabaseQualification: 'PASS' },
    { modelChecks: 'FAIL' },
    { urlChecks: 'FAIL' },
    { rootUrlPatterns: 0 },
    { currentManagedModels: 0 },
    { sourceDigests: {} },
  ])('rejects an invalid startup boundary %j', (change) => {
    vi.mocked(runCurrentSourcePython).mockReturnValue(JSON.stringify({ ...startup(), ...change }))
    expect(() => proveCurrentApplicationStartup('offline-wheelhouse')).toThrow(
      'UE_V2_CURRENT_APPLICATION_STARTUP_BOUNDARY',
    )
  })

  it('rejects current source drift', () => {
    const proof = startup()
    proof.sourceDigests['apps/union-eyes/backend/config/settings.py'] = hash('drift')
    vi.mocked(runCurrentSourcePython).mockReturnValue(JSON.stringify(proof))
    expect(() => proveCurrentApplicationStartup('offline-wheelhouse')).toThrow(
      'UE_V2_APPLICATION_SOURCE_CHANGED',
    )
  })

  it('rejects paths outside the copied backend source', () => {
    const proof = startup()
    proof.sourceDigests['apps/union-eyes/backend/../../pnpm-lock.yaml'] = hash('outside')
    vi.mocked(runCurrentSourcePython).mockReturnValue(JSON.stringify(proof))
    expect(() => proveCurrentApplicationStartup('offline-wheelhouse')).toThrow(
      'UE_V2_APPLICATION_SOURCE_PATH_REQUIRED',
    )
  })
})
