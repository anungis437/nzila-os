import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

function readSource(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8')
}

function fileExists(relPath: string): boolean {
  return existsSync(resolve(ROOT, relPath))
}

describe('Pilot Hardening - Playback Reliability', () => {
  it('player context emits playback telemetry and preloads next track', () => {
    const src = readSource('components/player/player-context.tsx')
    expect(src).toContain('emitPlaybackTelemetry')
    expect(src).toContain('/api/playback/telemetry')
    expect(src).toContain('prefetchAudioRef')
    expect(src).toContain('PLAYER_POSITION_PREFIX')
  })

  it('playback telemetry API route is protected and stores analytics events', () => {
    const src = readSource('app/api/playback/telemetry/route.ts')
    expect(src).toContain('withOrgScope')
    expect(src).toContain('playback_')
    expect(src).toContain('zonga_analytics_events')
  })

  it('playback health operations dashboard exists', () => {
    expect(fileExists('app/[locale]/dashboard/operations/playback-health/page.tsx')).toBe(true)
  })
})

describe('Pilot Hardening - Label and Commercial Trust', () => {
  it('label dashboard and export APIs exist', () => {
    expect(fileExists('app/[locale]/dashboard/analytics/label/page.tsx')).toBe(true)
    expect(fileExists('app/api/analytics/label-export/route.ts')).toBe(true)
  })

  it('rights terms panel and APIs exist', () => {
    expect(fileExists('components/dashboard/rights-terms-panel.tsx')).toBe(true)
    expect(fileExists('app/api/rights/terms/route.ts')).toBe(true)
    expect(fileExists('app/api/rights/terms/agreement/route.ts')).toBe(true)
  })

  it('pilot commercial model document exists for agreement download', () => {
    expect(fileExists('../../docs/zonga/pilot-commercial-model.md')).toBe(true)
  })
})

describe('Pilot Hardening - Pilot Mode and Partner Surface', () => {
  it('pilot mode utility supports ms_celebrations', () => {
    const src = readSource('lib/pilot-mode.ts')
    expect(src).toContain("'ms_celebrations'")
    expect(src).toContain('getZongaPilotMode')
  })

  it('MS Celebrations page exists and is pilot-mode guarded', () => {
    const src = readSource('app/(marketing)/ms-celebrations/page.tsx')
    expect(src).toContain('getZongaPilotMode()')
    expect(src).toContain('notFound()')
    expect(src).toContain('Founding Partner Preview')
  })

  it('for-labels partner landing page uses explicit pilot-facing title', () => {
    const src = readSource('app/(marketing)/for-labels/page.tsx')
    expect(src).toContain('Zonga for Labels & Creators')
    expect(src).toContain('Apply Now')
  })
})
