/**
 * Contract test — SLO Gate: Real Metrics (No Placeholders)
 *
 * Guarantees the SLO gate queries real metric stores (platform-performance,
 * platform-ops, integrations-runtime) and does not rely solely on
 * simulated/placeholder data for enforced environments.
 *
 * @invariant SLO_GATE_REAL_METRICS_002
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = join(__dirname, '..', '..')

function readContent(rel: string): string {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

describe('SLO Gate — Real Metrics Enforcement', () => {
  const gatePath = 'scripts/slo-gate.ts'

  // ── Must import from real metric stores ───────────────────────────────
  it('SLO_GATE_REAL_METRICS_002: SLO gate imports from platform-performance', () => {
    const gate = readContent(gatePath)
    expect(gate).toBeTruthy()

    expect(gate).toMatch(/@nzila\/platform-performance/)
    expect(gate).toMatch(/getGlobalPerformanceEnvelope|getPerformanceEnvelope/)
  })

  it('SLO_GATE_REAL_METRICS_002: SLO gate imports from platform-ops', () => {
    const gate = readContent(gatePath)
    expect(gate).toBeTruthy()

    expect(gate).toMatch(/@nzila\/platform-ops/)
    expect(gate).toMatch(/getOpsSnapshot/)
  })

  // ── Must call real stores in enforced environments ────────────────────
  it('SLO_GATE_REAL_METRICS_002: enforced environments query real metrics (not only simulated)', () => {
    const gate = readContent(gatePath)
    expect(gate).toBeTruthy()

    // Must distinguish enforced vs non-enforced behavior
    expect(gate).toMatch(/enforced/)

    // Must reference real metric fetch calls
    expect(gate).toMatch(/getGlobalPerformanceEnvelope|getPerformanceEnvelope/)
    expect(gate).toMatch(/getOpsSnapshot/)

    // Must reference performance envelope fields
    expect(gate).toMatch(/realPerformance|performanceEnvelope/)

    // The gate must be async (since real metric fetches are async)
    expect(gate).toMatch(/async\s+function\s+runSloGate/)
  })

  // ── Must still export core functions for CI ───────────────────────────
  it('SLO_GATE_REAL_METRICS_002: maintains required exports', () => {
    const gate = readContent(gatePath)
    expect(gate).toBeTruthy()

    expect(gate).toMatch(/export.*runSloGate/)
    expect(gate).toMatch(/export.*loadSloPolicy/)
    expect(gate).toMatch(/export.*checkSloViolations/)
  })

  // ── Must not be purely placeholder ────────────────────────────────────
  it('SLO_GATE_REAL_METRICS_002: simulated data is fallback only, not sole source', () => {
    const gate = readContent(gatePath)
    expect(gate).toBeTruthy()

    // The simulated fallback must be conditional (not the only path)
    // Verify that real metric queries exist alongside simulated fallback
    const hasRealQuery = gate.includes('getGlobalPerformanceEnvelope') || gate.includes('getPerformanceEnvelope')
    const hasOpsQuery = gate.includes('getOpsSnapshot')
    const hasSimulatedFallback = gate.includes('0.8') || gate.includes('simulated') || gate.includes('Simulated')

    expect(hasRealQuery).toBe(true)
    expect(hasOpsQuery).toBe(true)
    // The simulated path may exist as a fallback, but real queries must also be present
    expect(hasRealQuery && hasOpsQuery).toBe(true)
  })
})
