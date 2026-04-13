import { describe, expect, it, vi } from 'vitest'
import { runDailyRollupJob, type RollupJobPorts } from './rollup'
import * as platformCost from './index'

const DAY = '2026-03-01'
const ORG_A = '00000000-0000-0000-0000-000000000001'
const ORG_B = '00000000-0000-0000-0000-000000000002'

function makePorts(overrides?: Partial<RollupJobPorts>): RollupJobPorts {
  return {
    listOrgsWithCostActivity: vi.fn().mockResolvedValue([]),
    emitAudit: vi.fn().mockResolvedValue(undefined),
    insertCostEvent: vi.fn(),
    queryCostEvents: vi.fn().mockResolvedValue([]),
    upsertDailyRollup: vi.fn().mockResolvedValue(undefined),
    queryDailyRollups: vi.fn(),
    queryOrgTotalCost: vi.fn(),
    queryGlobalRollups: vi.fn(),
    ...overrides,
  } as RollupJobPorts
}

describe('runDailyRollupJob', () => {
  it('processes all orgs and emits an audit summary', async () => {
    const ports = makePorts({
      listOrgsWithCostActivity: vi.fn().mockResolvedValue([ORG_A, ORG_B]),
      queryCostEvents: vi.fn().mockImplementation(async ({ orgId }) => {
        if (orgId === ORG_A) {
          return [
            {
              orgId: ORG_A,
              appId: 'web',
              category: 'compute_ms',
              units: 100,
              estCostUsd: 0.02,
              ts: new Date(`${DAY}T02:00:00Z`),
            },
            {
              orgId: ORG_A,
              appId: 'web',
              category: 'compute_ms',
              units: 50,
              estCostUsd: 0.01,
              ts: new Date(`${DAY}T03:00:00Z`),
            },
          ]
        }

        return [
          {
            orgId: ORG_B,
            appId: 'console',
            category: 'integration_call',
            units: 2,
            estCostUsd: 0.5,
            ts: new Date(`${DAY}T04:00:00Z`),
          },
        ]
      }),
    })

    const result = await runDailyRollupJob(DAY, ports)

    expect(result.day).toBe(DAY)
    expect(result.orgsProcessed).toBe(2)
    expect(result.totalRollups).toBe(2)
    expect(result.errors).toEqual([])
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(ports.upsertDailyRollup).toHaveBeenCalledTimes(2)
    expect(ports.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cost.rollup.completed',
        metadata: expect.objectContaining({
          day: DAY,
          orgsProcessed: 2,
          totalRollups: 2,
          errorCount: 0,
        }),
      }),
    )
  })

  it('continues when an org rollup fails and records the error', async () => {
    const ports = makePorts({
      listOrgsWithCostActivity: vi.fn().mockResolvedValue([ORG_A, ORG_B]),
      queryCostEvents: vi.fn().mockImplementation(async ({ orgId }) => {
        if (orgId === ORG_B) {
          throw 'upstream timeout'
        }

        return [
          {
            orgId: ORG_A,
            appId: 'web',
            category: 'compute_ms',
            units: 10,
            estCostUsd: 0.01,
            ts: new Date(`${DAY}T01:00:00Z`),
          },
        ]
      }),
    })

    const result = await runDailyRollupJob(DAY, ports)

    expect(result.orgsProcessed).toBe(2)
    expect(result.totalRollups).toBe(1)
    expect(result.errors).toEqual([{ orgId: ORG_B, error: 'upstream timeout' }])
    expect(ports.upsertDailyRollup).toHaveBeenCalledTimes(1)
    expect(ports.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          errorCount: 1,
          totalRollups: 1,
        }),
      }),
    )
  })
})

describe('platform-cost barrel exports', () => {
  it('exposes the public API through index.ts', () => {
    expect(platformCost.recordCostEvent).toBeTypeOf('function')
    expect(platformCost.checkOrgBudget).toBeTypeOf('function')
    expect(platformCost.runDailyRollupJob).toBeTypeOf('function')
  })
})