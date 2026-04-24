import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runSeed } from '../src/core/runner'
import {
  __resetRegistryForTests,
  registerSeeder,
} from '../src/core/registry'
import type { SeedAppReport, SeederModule } from '../src/core/types'

const NOW = new Date('2026-04-23T00:00:00.000Z')
const now = (): Date => NOW

function makeSeeder(overrides: Partial<SeederModule> = {}): SeederModule {
  return {
    app: 'union-eyes',
    description: 'test',
    supportedProfiles: ['demo-light', 'demo-standard'],
    async seed(ctx): Promise<SeedAppReport> {
      ctx.report.step({ step: 'people', entity: 'person', count: 5 })
      return ctx.report.finish()
    },
    async reset(ctx): Promise<SeedAppReport> {
      ctx.report.step({ step: 'reset', entity: 'person', count: 5 })
      return ctx.report.finish()
    },
    ...overrides,
  }
}

beforeEach(() => __resetRegistryForTests())
afterEach(() => __resetRegistryForTests())

describe('runner', () => {
  it('runs registered seeders and aggregates the report', async () => {
    registerSeeder(makeSeeder())
    const report = await runSeed({
      command: 'seed',
      options: { profile: 'demo-light', now },
    })
    expect(report.apps).toHaveLength(1)
    expect(report.apps[0]!.app).toBe('union-eyes')
    expect(report.apps[0]!.totalRecords).toBe(5)
    expect(report.skippedApps).toHaveLength(0)
  })

  it('skips seeders that do not support the profile', async () => {
    registerSeeder(makeSeeder({ supportedProfiles: ['demo-light'] }))
    const report = await runSeed({
      command: 'seed',
      options: { profile: 'investor-showcase', now },
    })
    expect(report.apps).toHaveLength(0)
    expect(report.skippedApps[0]?.reason).toMatch(/not supported/)
  })

  it('records a skip when the requested app has no seeder', async () => {
    const report = await runSeed({
      command: 'seed',
      options: { profile: 'demo-standard', app: 'flow', now },
    })
    expect(report.apps).toHaveLength(0)
    expect(report.skippedApps[0]?.app).toBe('flow')
  })

  it('reset command refuses to run when seeder has no reset()', async () => {
    registerSeeder(makeSeeder({ reset: undefined }))
    const report = await runSeed({
      command: 'reset',
      options: { profile: 'demo-light', now },
    })
    expect(report.apps).toHaveLength(0)
    expect(report.skippedApps[0]?.reason).toMatch(/does not implement reset/)
  })

  it('reseed runs reset then seed', async () => {
    let resets = 0
    let seeds = 0
    registerSeeder(
      makeSeeder({
        async reset(ctx) {
          resets += 1
          ctx.report.step({ step: 'reset', count: 1 })
          return ctx.report.finish()
        },
        async seed(ctx) {
          seeds += 1
          ctx.report.step({ step: 'seed', count: 3 })
          return ctx.report.finish()
        },
      }),
    )
    await runSeed({ command: 'reseed', options: { profile: 'demo-light', now } })
    expect(resets).toBe(1)
    expect(seeds).toBe(1)
  })

  it('forbids duplicate registration', () => {
    registerSeeder(makeSeeder())
    expect(() => registerSeeder(makeSeeder())).toThrow(/duplicate/)
  })

  it('runs are deterministic for the same seed', async () => {
    let captured: number[] = []
    const seeder = makeSeeder({
      async seed(ctx) {
        const samples = Array.from({ length: 5 }, () => ctx.rng.intBetween(0, 1_000_000))
        captured.push(...samples)
        ctx.report.step({ step: 'rng', count: samples.length })
        return ctx.report.finish()
      },
    })
    registerSeeder(seeder)
    await runSeed({
      command: 'seed',
      options: { profile: 'demo-light', seed: 12345, now },
    })
    const first = captured.slice()
    captured = []
    __resetRegistryForTests()
    registerSeeder(seeder)
    await runSeed({
      command: 'seed',
      options: { profile: 'demo-light', seed: 12345, now },
    })
    expect(captured).toEqual(first)
  })
})
