import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BEHAVIOURAL_TESTS, buildTrace, renderTrace, TRACE_FILE } from '../../../scripts/reality/step1-evidence-trace'

/** Step 1 S1-A02 / S1-A05 / S1-A06: every historical and required item has a reproducible disposition and evidence or an explicit gap. */
const trace = buildTrace()

describe('Step 1 evidence trace', () => {
  it('the committed trace matches the current sources exactly', () => {
    expect(readFileSync(TRACE_FILE, 'utf8')).toBe(renderTrace())
  })
  it('every historical capability has a disposition and a trace method (S1-A02)', () => {
    expect(trace.historicalTrace).toHaveLength(111)
    for (const row of trace.historicalTrace) {
      expect(row.disposition).toMatch(/^(EXCLUDED|DEFERRED|CONDITIONAL|REQUIRED_SUPERSEDED_BY_CURRENT_REGISTRY|REQUIRED_TRACED_TO_LIVE_IMPLEMENTATION|REQUIRED_IMPLEMENTATION_GAP)$/)
      expect(row.traceMethod).toBe('SHARED_BASE_ACTION')
    }
  })
  it('every REQUIRED row carries evidence or an explicit gap (S1-A05)', () => {
    for (const row of trace.requiredEvidence)
      expect(row.evidence.length > 0 || (typeof row.evidenceGap === 'string' && row.evidenceGap.length > 20), row.id).toBe(true)
  })
  it('every declared base-action route resolves to a census boundary and every behavioural test file exists (S1-A06)', () => {
    for (const action of trace.actionEvidence)
      for (const route of action.routes) expect(route.boundary, `${action.id} ${route.method} ${route.route}`).not.toBe('NOT_FOUND')
    for (const files of Object.values(BEHAVIOURAL_TESTS))
      for (const file of files) expect(existsSync(path.resolve(__dirname, '../../..', file)), file).toBe(true)
  })
  it('no base action mutation route is unguarded', () => {
    const boundaries = trace.actionEvidence.flatMap((a) => a.routes.map((r) => r.boundary))
    expect(boundaries.filter((b) => b === 'UNCLASSIFIED' || b === 'PUBLIC_REGISTRY')).toEqual([])
  })
})
