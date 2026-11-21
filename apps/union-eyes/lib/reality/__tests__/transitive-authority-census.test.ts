import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { backendCensus, buildCensus, CENSUS_FILE, renderCensus, REVIEWED_UNCLASSIFIED } from '../../../scripts/reality/transitive-authority-census'

/** Step 1 S1-A03: every mutation-capable API export passes an identified authority boundary. */
const rows = buildCensus()

describe('transitive authority census (S1-A03)', () => {
  it('the committed census matches the current source exactly', () => {
    expect(readFileSync(CENSUS_FILE, 'utf8')).toBe(renderCensus(rows))
  })

  it('no mutation export is unclassified unless it is reviewed with a reason', () => {
    const unreviewed = rows.filter((r) => r.class === 'UNCLASSIFIED' && !REVIEWED_UNCLASSIFIED[`${r.method} ${r.route}`])
    expect(unreviewed.map((r) => `${r.method} ${r.route}`)).toEqual([])
  })

  it('every reviewed entry still exists and still needs review (the list can only shrink)', () => {
    const unclassified = new Set(rows.filter((r) => r.class === 'UNCLASSIFIED').map((r) => `${r.method} ${r.route}`))
    for (const [key, reason] of Object.entries(REVIEWED_UNCLASSIFIED)) {
      expect(unclassified.has(key), key).toBe(true)
      expect(reason.length).toBeGreaterThan(40)
    }
  })

  it('guarded mutation exports without a route test may only decrease (ratchet)', () => {
    const untested = rows.filter((r) => r.class === 'GUARDED_SESSION' && r.testFiles === 0).length
    expect(untested).toBeLessThanOrEqual(303)
  })

  it('classifies every mutation export into exactly one boundary class', () => {
    const classes = new Set(['GUARDED_SESSION', 'SIGNED_OR_SECRET', 'CAPABILITY_TOKEN', 'PUBLIC_INTAKE_GUARDED', 'PUBLIC_REGISTRY', 'REFUSAL_STUB', 'UNCLASSIFIED'])
    expect(rows.length).toBeGreaterThan(900)
    expect(rows.every((r) => classes.has(r.class))).toBe(true)
  })

  it('every Django REST view declares its permission classes and none allows anonymous access', () => {
    const backend = backendCensus()
    expect(backend.drfViews).toBeGreaterThan(500)
    expect(backend.drfViewsWithoutExplicitPermissionClasses).toEqual([])
    expect(backend.drfViewsAllowAny).toEqual([])
    expect(backend.drfDefaultPermission).toBe('rest_framework.permissions.IsAuthenticatedOrReadOnly')
  })
})
