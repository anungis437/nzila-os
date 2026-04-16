import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { ROOT, readContent, relPath, walkSync } from './governance-helpers'

const UE_ROOT = join(ROOT, 'apps', 'union-eyes')

describe('Union Eyes demo mode surfaces', () => {
  it('root layout mounts the demo mode overlay', () => {
    const source = readContent(join(UE_ROOT, 'app', 'layout.tsx'))
    expect(source).toContain('DemoModeOverlay')
  })

  it('overlay uses explicit DEMO MODE language and telemetry tagging', () => {
    const source = readContent(join(UE_ROOT, 'components', 'pilot', 'demo-mode-overlay.tsx'))
    expect(source).toContain('Demo Mode')
    expect(source).toContain('data-telemetry-tag')
    expect(source).toContain('/api/pilot/events')
  })

  it('pilot onboarding API returns demo state explicitly', () => {
    const source = readContent(join(UE_ROOT, 'app', 'api', 'pilot', 'onboarding', 'route.ts'))
    expect(source).toContain('demo:')
    expect(source).toContain('telemetryTag')
    expect(source).toContain('pilotDemoSeeds')
  })

  it('pilot demo-data mutation route is fail-closed behind NZILA_MODE', () => {
    const source = readContent(join(UE_ROOT, 'app', 'api', 'pilot', 'demo-data', 'route.ts'))
    expect(source).toContain('NZILA_MODE')
    expect(source).toContain('assertPilotDemoMutationRuntime')
  })

  it('instrumentation validates pilot demo runtime configuration at startup', () => {
    const source = readContent(join(UE_ROOT, 'instrumentation.ts'))
    expect(source).toContain('getPilotDemoRuntimeValidation')
    expect(source).toContain('Pilot demo runtime mode is invalid')
  })

  it('pilot data generators are only imported from pilot-specific surfaces', () => {
    const files = walkSync(UE_ROOT, ['.ts', '.tsx'])
      .filter((filePath) => !filePath.endsWith('.test.ts'))
      .filter((filePath) => !filePath.endsWith('lib/pilot/cape-demo-data.ts'))

    const violations = files
      .filter((filePath) => readContent(filePath).includes("@/lib/pilot/cape-demo-data"))
      .map((filePath) => relPath(filePath))
      .filter((filePath) => !filePath.startsWith('apps/union-eyes/app/api/pilot/'))

    expect(violations).toEqual([])
  })
})