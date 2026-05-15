import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getOperatingEvidenceService } from '@nzila/operating-evidence'
import { getMetricsCommercialService } from '@nzila/metrics-commercial'
import type { DomainName } from '@nzila/policies'

export interface SyntheticSimulationOptions {
  requestCount: number
  days: number
  orgCount: number
}

export interface SyntheticSimulationResult {
  generatedAt: string
  requests: number
  orgCount: number
  events: {
    requests: number
    errors: number
    policyViolations: number
    overrides: number
  }
  economics: {
    acquisitionEvents: number
    activationEvents: number
    retentionEvents: number
    conversionSignals: number
  }
}

const domains: DomainName[] = ['labour', 'legal', 'commerce', 'media-rights']
const features = ['dashboard', 'policy-center', 'automation', 'alerts', 'insights', 'exports']

// codeql[js/insecure-randomness] - used only for simulation/demo data, not security-sensitive
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(values: T[]): T {
  return values[randomInt(0, values.length - 1)] as T
}

function latencyMs(): number {
  const base = 80 + Math.pow(Math.random(), 1.8) * 800
  const jitter = Math.random() < 0.02 ? randomInt(900, 2500) : randomInt(-20, 40)
  return Math.max(20, Math.round(base + jitter))
}

function weightedDomain(): DomainName {
  const roll = Math.random()
  if (roll < 0.34) return 'commerce'
  if (roll < 0.57) return 'labour'
  if (roll < 0.81) return 'legal'
  return 'media-rights'
}

function randomTimestamp(days: number): string {
  const now = Date.now()
  const offsetMs = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000)
  return new Date(now - offsetMs).toISOString()
}

export async function runSyntheticProductionSimulation(input: Partial<SyntheticSimulationOptions> = {}): Promise<SyntheticSimulationResult> {
  const requestCount = Math.max(10_000, Math.min(input.requestCount ?? 20_000, 100_000))
  const days = Math.max(7, Math.min(input.days ?? 90, 180))
  const orgCount = Math.max(100, Math.min(input.orgCount ?? 100, 300))

  const evidence = getOperatingEvidenceService()
  const commercial = getMetricsCommercialService()

  const evidenceEvents: Parameters<typeof evidence.recordBatch>[0] = []
  const commercialEvents: Parameters<typeof commercial.recordBatch>[0] = []

  let errorCount = 0
  let violationCount = 0
  let overrideCount = 0

  for (let i = 0; i < requestCount; i += 1) {
    const domain = weightedDomain()
    const orgId = `org-${String(i % orgCount).padStart(3, '0')}`
    const ts = randomTimestamp(days)
    const failed = Math.random() < 0.028
    const policyViolation = Math.random() < 0.017
    const override = !policyViolation && Math.random() < 0.031
    const confidence = Number((0.45 + Math.random() * 0.54).toFixed(3))

    evidenceEvents.push({
      ts,
      app: pick(['orchestrator-api', 'control-plane', 'union-eyes']),
      domain,
      type: 'request',
      latencyMs: latencyMs(),
      statusCode: failed ? pick([500, 502, 503, 504]) : pick([200, 200, 200, 201]),
      confidence,
      correctedByHuman: override,
      severity: failed ? 'high' : 'low',
      payload: {
        orgId,
        operation: pick(['evaluate', 'execute', 'approve', 'ingest', 'sync']),
      },
    })

    if (failed) {
      errorCount += 1
      evidenceEvents.push({
        ts,
        app: 'orchestrator-api',
        domain,
        type: 'error',
        severity: 'high',
        payload: {
          orgId,
          operation: 'execute',
          code: pick(['TIMEOUT', 'UPSTREAM', 'BACKPRESSURE']),
        },
      })
    }

    if (policyViolation) {
      violationCount += 1
      evidenceEvents.push({
        ts,
        app: 'control-plane',
        domain,
        type: 'policy_violation',
        severity: 'critical',
        correctedByHuman: Math.random() < 0.4,
        payload: {
          orgId,
          rule: `POL-${randomInt(100, 999)}`,
        },
      })
    }

    if (override) {
      overrideCount += 1
      evidenceEvents.push({
        ts,
        app: 'control-plane',
        domain,
        type: 'override',
        severity: 'medium',
        correctedByHuman: true,
        overrideReason: 'Urgent customer operation continuity',
        payload: {
          orgId,
          ticketRef: `SIM-${randomInt(100000, 999999)}`,
        },
      })
    }

    if (Math.random() < 0.09) {
      commercialEvents.push({
        ts,
        userId: `user-${randomInt(1, 20000)}`,
        app: pick(['control-plane', 'union-eyes', 'zonga', 'web']),
        type: 'feature_usage',
        feature: pick(features),
        metadata: {
          orgId,
          expansionIntent: Math.random() < 0.08,
        },
      })
    }
  }

  let acquisitionEvents = 0
  let activationEvents = 0
  let retentionEvents = 0
  let conversionSignals = 0

  for (let org = 0; org < orgCount; org += 1) {
    const orgId = `org-${String(org).padStart(3, '0')}`
    const users = randomInt(80, 520)
    const activated = Math.floor(users * (0.45 + Math.random() * 0.35))
    const converted = Math.floor(activated * (0.2 + Math.random() * 0.25))

    for (let i = 0; i < users; i += 1) {
      acquisitionEvents += 1
      const userId = `${orgId}-u-${i}`
      commercialEvents.push({
        ts: randomTimestamp(days),
        userId,
        app: 'web',
        type: 'acquisition',
        metadata: {
          orgId,
          acquisitionCost: Number((30 + Math.random() * 190).toFixed(2)),
          channel: pick(['organic', 'partner', 'field', 'ads']),
        },
      })

      if (i < activated) {
        activationEvents += 1
        commercialEvents.push({
          ts: randomTimestamp(days),
          userId,
          app: 'control-plane',
          type: 'activation',
          metadata: { orgId },
        })

        if (Math.random() < 0.72) {
          retentionEvents += 1
          commercialEvents.push({
            ts: randomTimestamp(days),
            userId,
            app: 'control-plane',
            type: 'retention',
            metadata: { orgId, day: 1 },
          })
        }
        if (Math.random() < 0.48) {
          retentionEvents += 1
          commercialEvents.push({
            ts: randomTimestamp(days),
            userId,
            app: 'control-plane',
            type: 'retention',
            metadata: { orgId, day: 7 },
          })
        }
        if (Math.random() < 0.31) {
          retentionEvents += 1
          commercialEvents.push({
            ts: randomTimestamp(days),
            userId,
            app: 'control-plane',
            type: 'retention',
            metadata: { orgId, day: 30 },
          })
        }
      }

      if (i < converted) {
        conversionSignals += 1
        commercialEvents.push({
          ts: randomTimestamp(days),
          userId,
          app: 'control-plane',
          type: 'conversion_signal',
          metadata: {
            orgId,
            mrr: Number((100 + Math.random() * 900).toFixed(2)),
            lifetimeMonths: randomInt(10, 30),
            expansion: Math.random() < 0.16,
          },
        })
      }
    }
  }

  await evidence.recordBatch(evidenceEvents)

  const today = new Date()
  for (let i = 0; i < 90; i += 1) {
    const day = new Date(today)
    day.setDate(today.getDate() - i)
    await evidence.createDailySnapshot(day.toISOString().slice(0, 10))
  }

  await commercial.recordBatch(commercialEvents)

  const economics = await commercial.getSimulatedEconomics(120)
  const economicsPath = join(process.cwd(), 'data', 'simulated-economics.json')
  await writeFile(economicsPath, `${JSON.stringify(economics, null, 2)}\n`, 'utf-8')

  return {
    generatedAt: new Date().toISOString(),
    requests: requestCount,
    orgCount,
    events: {
      requests: requestCount,
      errors: errorCount,
      policyViolations: violationCount,
      overrides: overrideCount,
    },
    economics: {
      acquisitionEvents,
      activationEvents,
      retentionEvents,
      conversionSignals,
    },
  }
}
