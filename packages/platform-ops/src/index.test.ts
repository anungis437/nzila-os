import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    execute: vi.fn(),
  },
}))

import { platformDb } from '@nzila/db/platform'
import {
  computeDeltas,
  getOutboxBacklogs,
  getWorkerMetrics,
  getOpsSnapshot,
} from './index'

describe('platform-ops index runtime paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports re-exported modules through index', () => {
    expect(typeof computeDeltas).toBe('function')
  })

  it('builds outbox backlog statuses and handles missing tables', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([{ domain: 'zonga', pendingCount: 130, oldestAgeSec: 90 }])
      .mockRejectedValueOnce(new Error('relation does not exist'))

    const backlogs = await getOutboxBacklogs()

    expect(backlogs).toEqual([
      {
        domain: 'zonga',
        pendingCount: 130,
        oldestAgeSec: 90,
        status: 'critical',
      },
      {
        domain: 'nacp',
        pendingCount: 0,
        oldestAgeSec: null,
        status: 'healthy',
      },
    ])
  })

  it('maps worker metrics status branches and returns empty on query failure', async () => {
    vi.mocked(platformDb.execute).mockResolvedValueOnce([
      { queueName: 'idle-q', pendingCount: 0, runningCount: 0 },
      { queueName: 'active-q', pendingCount: 2, runningCount: 1 },
      { queueName: 'busy-q', pendingCount: 2, runningCount: 3 },
      { queueName: 'sat-q', pendingCount: 1, runningCount: 20 },
    ])

    const metrics = await getWorkerMetrics()

    expect(metrics).toEqual([
      {
        queueName: 'idle-q',
        pendingCount: 0,
        runningCount: 0,
        saturationPct: 0,
        status: 'idle',
      },
      {
        queueName: 'active-q',
        pendingCount: 2,
        runningCount: 1,
        saturationPct: 33,
        status: 'active',
      },
      {
        queueName: 'busy-q',
        pendingCount: 2,
        runningCount: 3,
        saturationPct: 60,
        status: 'busy',
      },
      {
        queueName: 'sat-q',
        pendingCount: 1,
        runningCount: 20,
        saturationPct: 95,
        status: 'saturated',
      },
    ])

    vi.mocked(platformDb.execute).mockRejectedValueOnce(new Error('db down'))
    const emptyMetrics = await getWorkerMetrics()
    expect(emptyMetrics).toEqual([])
  })

  it('returns combined ops snapshot with deterministic timestamp', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'))

    vi.mocked(platformDb.execute).mockResolvedValue([
      {
        queueName: 'q',
        pendingCount: 1,
        runningCount: 1,
        domain: 'x',
        oldestAgeSec: 10,
      },
    ])

    const snapshot = await getOpsSnapshot()

    expect(snapshot).toEqual({
      outboxBacklogs: [
        {
          domain: 'zonga',
          pendingCount: 1,
          oldestAgeSec: 10,
          status: 'healthy',
        },
        {
          domain: 'nacp',
          pendingCount: 1,
          oldestAgeSec: 10,
          status: 'healthy',
        },
      ],
      workerMetrics: [
        {
          queueName: 'q',
          pendingCount: 1,
          runningCount: 1,
          saturationPct: 50,
          status: 'active',
        },
      ],
      timestamp: '2026-04-12T00:00:00.000Z',
    })

    vi.useRealTimers()
  })
})
