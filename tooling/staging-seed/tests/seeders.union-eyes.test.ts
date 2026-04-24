/**
 * Tests for the union-eyes per-app seeder.
 *
 * The seeder registers itself on import via a side effect. We do a single
 * static import at the top of the file so registration runs once, then call
 * seeder.seed() / seeder.reset() directly to exercise the synthetic plan.
 */
import { describe, expect, it } from 'vitest'

import {
  createReporter,
  createRng,
  createTime,
  getProfileTargets,
  type SeedAppReport,
  type SeedContext,
  type SeedProfile,
} from '../src/index'

// Side-effect import: this registers the union-eyes seeder.
import * as ueSeeder from '../src/seeders/union-eyes'

const { seeder, STAGING_LOCAL } = ueSeeder

function makeCtx(profile: SeedProfile): SeedContext {
  const targets = getProfileTargets(profile)
  const now = () => new Date('2026-04-23T00:00:00.000Z')
  const rng = createRng(20260423)
  const time = createTime(targets, now())
  const report = createReporter({
    app: 'union-eyes',
    profile,
    dryRun: true,
    now,
  })
  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }
  return {
    app: 'union-eyes',
    profile,
    seed: 20260423,
    targets,
    dryRun: true,
    rng,
    time,
    report,
    logger,
  }
}

describe('union-eyes seeder', () => {
  it('declares the union-eyes app and supports the demo-standard profile', () => {
    expect(seeder.app).toBe('union-eyes')
    expect(seeder.supportedProfiles).toContain('demo-standard')
  })

  it('exposes the well-known synthetic staging local org', () => {
    expect(STAGING_LOCAL.id).toBe('org-ue-staging-local-9999')
    expect(STAGING_LOCAL.name).toMatch(/staging/i)
  })

  it('reports all expected seed steps with db_write skipped in phase 2', async () => {
    const ctx = makeCtx('demo-standard')
    const report: SeedAppReport = await seeder.seed(ctx)
    const stepNames = report.steps.map((s) => s.step)
    for (const expected of [
      'organization',
      'members',
      'users',
      'stewards',
      'worksites',
      'grievances',
      'claims',
      'dues_invoices',
      'cba',
      'notifications',
      'activity_logs',
      'cba_intel_sources',
      'cba_intel_documents',
      'cba_intel_findings',
      'cba_intel_review_decisions',
      'db_write',
    ]) {
      expect(stepNames).toContain(expected)
    }
    const dbWrite = report.steps.find((s) => s.step === 'db_write')
    expect(dbWrite?.skipped).toBe(true)
  })

  it('scales totalRecords monotonically across profiles', async () => {
    const profiles: SeedProfile[] = [
      'demo-light',
      'demo-standard',
      'executive-showcase',
      'investor-showcase',
    ]
    const totals: number[] = []
    for (const p of profiles) {
      const r = await seeder.seed(makeCtx(p))
      totals.push(r.totalRecords)
    }
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i]).toBeGreaterThan(totals[i - 1]!)
    }
  })

  it('reset returns a single skipped step in dry-run', async () => {
    const ctx = makeCtx('demo-light')
    expect(seeder.reset).toBeDefined()
    const report = await seeder.reset!(ctx)
    expect(report.steps).toHaveLength(1)
    expect(report.steps[0]!.step).toBe('reset')
    expect(report.steps[0]!.skipped).toBe(true)
    expect(report.steps[0]!.note).toMatch(/dry-run/i)
  })

  it('is deterministic for the same (profile, seed)', async () => {
    const r1 = await seeder.seed(makeCtx('demo-standard'))
    const r2 = await seeder.seed(makeCtx('demo-standard'))
    expect(r1.totalRecords).toBe(r2.totalRecords)
    expect(r1.steps.map((s) => `${s.step}:${s.count}`)).toEqual(
      r2.steps.map((s) => `${s.step}:${s.count}`),
    )
  })

  it('CBA Intelligence parity matches CBA_INTELLIGENCE_VALIDATION_REPORT.md', async () => {
    // Locked counts: 4 sources / 3 documents / 3 findings / 1 review decision.
    // Changing this assertion requires updating the validation report in lockstep.
    for (const profile of [
      'demo-light',
      'demo-standard',
      'executive-showcase',
      'investor-showcase',
    ] as const) {
      const ctx = makeCtx(profile)
      const report = await seeder.seed(ctx)
      const counts = Object.fromEntries(
        report.steps
          .filter((s) => s.step.startsWith('cba_intel_'))
          .map((s) => [s.step, s.count]),
      )
      expect(counts).toEqual({
        cba_intel_sources: 4,
        cba_intel_documents: 3,
        cba_intel_findings: 3,
        cba_intel_review_decisions: 1,
      })
    }
  })

  it('exposes CBA_INTEL_PARITY constants for external lockstep checks', () => {
    expect(ueSeeder.CBA_INTEL_PARITY).toEqual({
      sources: 4,
      documents: 3,
      findings: 3,
      reviewDecisions: 1,
    })
  })
})
