/**
 * Contract tests — SLO Policy Present and Valid
 *
 * Enforces that:
 *   1. ops/slo-policy.yml exists with version + defaults + apps + gating.
 *   2. All known apps have SLO thresholds declared.
 *   3. Gating section declares enforced + warning environments.
 *   4. SLO gate script exists and is importable.
 *
 * @invariant SLO_POLICY_PRESENT_AND_VALID_004
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

/** Known apps that must have SLO thresholds */
const REQUIRED_APPS = [
  'abr',
  'nacp-exams',
  'console',
  'union-eyes',
  'web',
  'orchestrator-api',
  'cfo',
  'partners',
  'shop-quoter',
  'trade',
  'zonga',
  'pondu',
  'cora',
]

describe('SLO — Policy Present and Valid', () => {
  // ── Policy file exists ────────────────────────────────────────────────
  it('SLO_POLICY_PRESENT_AND_VALID_004: ops/slo-policy.yml exists', () => {
    const policyPath = join(ROOT, 'ops', 'slo-policy.yml')
    expect(existsSync(policyPath), 'ops/slo-policy.yml must exist').toBe(true)
  })

  // ── Structure validation ──────────────────────────────────────────────
  it('SLO_POLICY_PRESENT_AND_VALID_004: policy contains required top-level sections', () => {
    const policy = readContent('ops/slo-policy.yml')
    expect(policy).toBeTruthy()

    expect(policy.includes('version:'), 'SLO policy must declare version').toBe(true)
    expect(policy.includes('defaults:'), 'SLO policy must declare defaults section').toBe(true)
    expect(policy.includes('apps:'), 'SLO policy must declare apps section').toBe(true)
    expect(policy.includes('gating:'), 'SLO policy must declare gating section').toBe(true)
  })

  // ── Default thresholds ────────────────────────────────────────────────
  it('SLO_POLICY_PRESENT_AND_VALID_004: defaults include performance + integration + DLQ thresholds', () => {
    const policy = readContent('ops/slo-policy.yml')
    expect(policy).toBeTruthy()

    expect(policy.includes('p95_latency_ms'), 'defaults must specify p95_latency_ms').toBe(true)
    expect(policy.includes('p99_latency_ms'), 'defaults must specify p99_latency_ms').toBe(true)
    expect(policy.includes('error_rate_max_pct'), 'defaults must specify error_rate_max_pct').toBe(true)
    expect(policy.includes('success_rate_min_pct'), 'defaults must specify success_rate_min_pct').toBe(true)
    expect(policy.includes('backlog_max'), 'defaults must specify backlog_max for DLQ').toBe(true)
  })

  // ── All apps covered ─────────────────────────────────────────────────
  it('SLO_POLICY_PRESENT_AND_VALID_004: all known apps have SLO entries', () => {
    const policy = readContent('ops/slo-policy.yml')
    expect(policy).toBeTruthy()

    for (const app of REQUIRED_APPS) {
      expect(
        policy.includes(app),
        `SLO policy must include thresholds for app: ${app}`,
      ).toBe(true)
    }
  })

  // ── Gating section ───────────────────────────────────────────────────
  it('SLO_POLICY_PRESENT_AND_VALID_004: gating declares enforced and warning environments', () => {
    const policy = readContent('ops/slo-policy.yml')
    expect(policy).toBeTruthy()

    expect(policy.includes('enforced_environments'), 'gating must declare enforced_environments').toBe(true)
    expect(policy.includes('warning_environments'), 'gating must declare warning_environments').toBe(true)
    expect(policy.includes('pilot'), 'enforced environments must include pilot').toBe(true)
    expect(policy.includes('prod'), 'enforced environments must include prod').toBe(true)
  })

  // ── Gate script exists ────────────────────────────────────────────────
  it('SLO_POLICY_PRESENT_AND_VALID_004: SLO gate script exists', () => {
    const gatePath = join(ROOT, 'scripts', 'slo-gate.ts')
    expect(existsSync(gatePath), 'scripts/slo-gate.ts must exist').toBe(true)

    const gate = readContent('scripts/slo-gate.ts')
    expect(gate.includes('runSloGate'), 'slo-gate.ts must export runSloGate function').toBe(true)
    expect(gate.includes('loadSloPolicy'), 'slo-gate.ts must export loadSloPolicy function').toBe(true)
    expect(gate.includes('checkSloViolations'), 'slo-gate.ts must export checkSloViolations function').toBe(true)
  })
})
