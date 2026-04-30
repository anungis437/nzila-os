import { createHmac } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type EvidenceEventType =
  | 'request'
  | 'error'
  | 'override'
  | 'policy_violation'
  | 'decision_correction'
  | 'admin_action'

export interface OperatingEvidenceEvent {
  id: string
  ts: string
  app: string
  domain: 'labour' | 'legal' | 'commerce' | 'media-rights' | 'platform'
  type: EvidenceEventType
  policyVersion?: string
  latencyMs?: number
  statusCode?: number
  severity?: 'low' | 'medium' | 'high' | 'critical'
  confidence?: number
  correctedByHuman?: boolean
  overrideReason?: string
  payload?: Record<string, unknown>
}

export interface DailyEvidenceSnapshot {
  day: string
  integrityScore: number
  complianceStatus: 'green' | 'amber' | 'red'
  driftDetected: boolean
  anomalyFlags: string[]
  sealedAt: string
  hmac: string
}

export interface OperatingEvidenceDashboard {
  windowDays: number
  latency: {
    p50: number
    p95: number
    p99: number
    trend: Array<{ day: string; p95: number }>
  }
  errorRate: {
    ratio: number
    trend: Array<{ day: string; ratio: number }>
  }
  overrideRatio: {
    ratio: number
    trend: Array<{ day: string; ratio: number }>
  }
  confidenceVsCorrection: Array<{ bucket: string; corrections: number; decisions: number }>
  failureClusters: Array<{ key: string; count: number }>
  integrityHistory: Array<DailyEvidenceSnapshot>
}

interface EvidenceStore {
  append(events: OperatingEvidenceEvent[]): Promise<void>
  list(fromIso: string, toIso: string): Promise<OperatingEvidenceEvent[]>
  saveSnapshot(snapshot: DailyEvidenceSnapshot): Promise<void>
  listSnapshots(limit: number): Promise<DailyEvidenceSnapshot[]>
}

class FileStore implements EvidenceStore {
  constructor(
    private readonly eventsPath = join(process.cwd(), 'data', 'operating-evidence-events.json'),
    private readonly snapshotsPath = join(process.cwd(), 'data', 'operating-evidence-snapshots.json'),
  ) {}

  async append(events: OperatingEvidenceEvent[]): Promise<void> {
    const existing = await this.readJson<OperatingEvidenceEvent[]>('events', [])
    await this.writeJson(this.eventsPath, [...existing, ...events])
  }

  async list(fromIso: string, toIso: string): Promise<OperatingEvidenceEvent[]> {
    const from = new Date(fromIso).getTime()
    const to = new Date(toIso).getTime()
    const all = await this.readJson<OperatingEvidenceEvent[]>('events', [])
    return all.filter((event) => {
      const ts = new Date(event.ts).getTime()
      return ts >= from && ts <= to
    })
  }

  async saveSnapshot(snapshot: DailyEvidenceSnapshot): Promise<void> {
    const existing = await this.readJson<DailyEvidenceSnapshot[]>('snapshots', [])
    const withoutDay = existing.filter((entry) => entry.day !== snapshot.day)
    withoutDay.push(snapshot)
    withoutDay.sort((a, b) => a.day.localeCompare(b.day))
    await this.writeJson(this.snapshotsPath, withoutDay)
  }

  async listSnapshots(limit: number): Promise<DailyEvidenceSnapshot[]> {
    const all = await this.readJson<DailyEvidenceSnapshot[]>('snapshots', [])
    return all.slice(-limit)
  }

  private async readJson<T>(kind: 'events' | 'snapshots', fallback: T): Promise<T> {
    const path = kind === 'events' ? this.eventsPath : this.snapshotsPath
    try {
      const raw = await readFile(path, 'utf-8')
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  }
}

class SupabaseStore implements EvidenceStore {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
    private readonly fallback: EvidenceStore,
  ) {}

  async append(events: OperatingEvidenceEvent[]): Promise<void> {
    const ok = await this.post('/rest/v1/operating_evidence_events', events)
    if (!ok) await this.fallback.append(events)
  }

  async list(fromIso: string, toIso: string): Promise<OperatingEvidenceEvent[]> {
    const url = `${this.baseUrl}/rest/v1/operating_evidence_events?select=*&ts=gte.${encodeURIComponent(fromIso)}&ts=lte.${encodeURIComponent(toIso)}&order=ts.asc`
    const response = await fetch(url, {
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
      },
      cache: 'no-store',
    }).catch(() => null)
    if (!response || !response.ok) return this.fallback.list(fromIso, toIso)
    return (await response.json()) as OperatingEvidenceEvent[]
  }

  async saveSnapshot(snapshot: DailyEvidenceSnapshot): Promise<void> {
    const ok = await this.post('/rest/v1/operating_evidence_snapshots', [snapshot])
    if (!ok) await this.fallback.saveSnapshot(snapshot)
  }

  async listSnapshots(limit: number): Promise<DailyEvidenceSnapshot[]> {
    const url = `${this.baseUrl}/rest/v1/operating_evidence_snapshots?select=*&order=day.desc&limit=${limit}`
    const response = await fetch(url, {
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
      },
      cache: 'no-store',
    }).catch(() => null)
    if (!response || !response.ok) return this.fallback.listSnapshots(limit)
    const rows = (await response.json()) as DailyEvidenceSnapshot[]
    return rows.reverse()
  }

  private async post(path: string, payload: unknown): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => null)
    return Boolean(response?.ok)
  }
}

class UpstashRedisStore implements EvidenceStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fallback: EvidenceStore,
  ) {}

  async append(events: OperatingEvidenceEvent[]): Promise<void> {
    for (const event of events) {
      const ok = await this.command(['RPUSH', 'operating:evidence:events', JSON.stringify(event)])
      if (!ok) {
        await this.fallback.append(events)
        return
      }
    }
  }

  async list(fromIso: string, toIso: string): Promise<OperatingEvidenceEvent[]> {
    const response = await this.command(['LRANGE', 'operating:evidence:events', '0', '-1'])
    if (!response.ok || !Array.isArray(response.result)) return this.fallback.list(fromIso, toIso)

    const from = new Date(fromIso).getTime()
    const to = new Date(toIso).getTime()
    return response.result
      .map((raw) => {
        try {
          return JSON.parse(String(raw)) as OperatingEvidenceEvent
        } catch {
          return null
        }
      })
      .filter((entry): entry is OperatingEvidenceEvent => entry !== null)
      .filter((entry) => {
        const ts = new Date(entry.ts).getTime()
        return ts >= from && ts <= to
      })
  }

  async saveSnapshot(snapshot: DailyEvidenceSnapshot): Promise<void> {
    const ok = await this.command(['HSET', 'operating:evidence:snapshots', snapshot.day, JSON.stringify(snapshot)])
    if (!ok.ok) await this.fallback.saveSnapshot(snapshot)
  }

  async listSnapshots(limit: number): Promise<DailyEvidenceSnapshot[]> {
    const response = await this.command(['HGETALL', 'operating:evidence:snapshots'])
    if (!response.ok || typeof response.result !== 'object' || !response.result) {
      return this.fallback.listSnapshots(limit)
    }

    const entries = Object.values(response.result as Record<string, string>)
      .map((raw) => {
        try {
          return JSON.parse(raw) as DailyEvidenceSnapshot
        } catch {
          return null
        }
      })
      .filter((entry): entry is DailyEvidenceSnapshot => entry !== null)
      .sort((a, b) => a.day.localeCompare(b.day))

    return entries.slice(-limit)
  }

  private async command(args: string[]): Promise<{ ok: boolean; result?: unknown }> {
    const response = await fetch(`${this.url}/${args.map((part) => encodeURIComponent(part)).join('/')}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: 'no-store',
    }).catch(() => null)

    if (!response || !response.ok) return { ok: false }
    const body = (await response.json()) as { result?: unknown }
    return { ok: true, result: body.result }
  }
}

function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(q * sortedValues.length)))
  return sortedValues[index] ?? 0
}

function getDayKey(iso: string): string {
  return iso.slice(0, 10)
}

function createStore(): EvidenceStore {
  const fileStore = new FileStore()
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, fileStore)
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRedisStore(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN, fileStore)
  }
  return fileStore
}

export class OperatingEvidenceService {
  private readonly store = createStore()

  constructor(private readonly sealSecret = process.env.OPERATING_EVIDENCE_SEAL_KEY ?? 'nzila-dev-seal-key') {}

  async record(event: Omit<OperatingEvidenceEvent, 'id' | 'ts'> & Partial<Pick<OperatingEvidenceEvent, 'id' | 'ts'>>): Promise<OperatingEvidenceEvent> {
    const normalized: OperatingEvidenceEvent = {
      id: event.id ?? crypto.randomUUID(),
      ts: event.ts ?? new Date().toISOString(),
      ...event,
    }
    await this.store.append([normalized])
    await this.pruneRetention(90)
    return normalized
  }

  async recordBatch(events: Array<Omit<OperatingEvidenceEvent, 'id' | 'ts'> & Partial<Pick<OperatingEvidenceEvent, 'id' | 'ts'>>>): Promise<number> {
    const normalized = events.map((event) => ({
      id: event.id ?? crypto.randomUUID(),
      ts: event.ts ?? new Date().toISOString(),
      ...event,
    }))
    await this.store.append(normalized)
    await this.pruneRetention(90)
    return normalized.length
  }

  async getDashboard(windowDays = 30): Promise<OperatingEvidenceDashboard> {
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - windowDays)

    const events = await this.store.list(start.toISOString(), end.toISOString())
    const latency = events.filter((e) => typeof e.latencyMs === 'number').map((e) => e.latencyMs as number).sort((a, b) => a - b)
    const requestEvents = events.filter((e) => e.type === 'request')
    const errorEvents = events.filter((e) => e.type === 'error' || (typeof e.statusCode === 'number' && e.statusCode >= 500))
    const overrides = events.filter((e) => e.type === 'override' || e.correctedByHuman)

    const byDay = new Map<string, OperatingEvidenceEvent[]>()
    for (const event of events) {
      const day = getDayKey(event.ts)
      const bucket = byDay.get(day) ?? []
      bucket.push(event)
      byDay.set(day, bucket)
    }

    const sortedDays = [...byDay.keys()].sort()
    const latencyTrend = sortedDays.map((day) => {
      const lat = (byDay.get(day) ?? []).filter((e) => typeof e.latencyMs === 'number').map((e) => e.latencyMs as number).sort((a, b) => a - b)
      return { day, p95: quantile(lat, 0.95) }
    })

    const errorTrend = sortedDays.map((day) => {
      const eventsForDay = byDay.get(day) ?? []
      const req = eventsForDay.filter((e) => e.type === 'request').length
      const err = eventsForDay.filter((e) => e.type === 'error' || (typeof e.statusCode === 'number' && e.statusCode >= 500)).length
      return { day, ratio: req > 0 ? Number((err / req).toFixed(4)) : 0 }
    })

    const overrideTrend = sortedDays.map((day) => {
      const eventsForDay = byDay.get(day) ?? []
      const decisions = eventsForDay.filter((e) => e.type === 'request' || e.type === 'decision_correction').length
      const corrected = eventsForDay.filter((e) => e.correctedByHuman || e.type === 'override').length
      return { day, ratio: decisions > 0 ? Number((corrected / decisions).toFixed(4)) : 0 }
    })

    const confidenceBuckets: Record<string, { corrections: number; decisions: number }> = {
      '0-0.5': { corrections: 0, decisions: 0 },
      '0.5-0.75': { corrections: 0, decisions: 0 },
      '0.75-0.9': { corrections: 0, decisions: 0 },
      '0.9-1.0': { corrections: 0, decisions: 0 },
    }

    for (const event of events.filter((e) => typeof e.confidence === 'number')) {
      const c = event.confidence as number
      const bucket = c < 0.5 ? '0-0.5' : c < 0.75 ? '0.5-0.75' : c < 0.9 ? '0.75-0.9' : '0.9-1.0'
      const currentBucket = confidenceBuckets[bucket]
      if (!currentBucket) continue
      currentBucket.decisions += 1
      if (event.correctedByHuman) currentBucket.corrections += 1
    }

    const failureClusterMap = new Map<string, number>()
    for (const event of errorEvents) {
      const key = `${event.app}:${event.payload?.['operation'] ?? 'unknown'}`
      failureClusterMap.set(key, (failureClusterMap.get(key) ?? 0) + 1)
    }

    const integrityHistory = await this.store.listSnapshots(90)

    return {
      windowDays,
      latency: {
        p50: quantile(latency, 0.5),
        p95: quantile(latency, 0.95),
        p99: quantile(latency, 0.99),
        trend: latencyTrend,
      },
      errorRate: {
        ratio: requestEvents.length > 0 ? Number((errorEvents.length / requestEvents.length).toFixed(4)) : 0,
        trend: errorTrend,
      },
      overrideRatio: {
        ratio: requestEvents.length > 0 ? Number((overrides.length / requestEvents.length).toFixed(4)) : 0,
        trend: overrideTrend,
      },
      confidenceVsCorrection: Object.entries(confidenceBuckets).map(([bucket, value]) => ({
        bucket,
        corrections: value.corrections,
        decisions: value.decisions,
      })),
      failureClusters: [...failureClusterMap.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      integrityHistory,
    }
  }

  async createDailySnapshot(day = getDayKey(new Date().toISOString())): Promise<DailyEvidenceSnapshot> {
    const end = new Date(`${day}T23:59:59.999Z`)
    const start = new Date(`${day}T00:00:00.000Z`)
    const events = await this.store.list(start.toISOString(), end.toISOString())

    const violations = events.filter((event) => event.type === 'policy_violation').length
    const errors = events.filter((event) => event.type === 'error').length
    const overrides = events.filter((event) => event.type === 'override').length

    const integrityScore = Math.max(0, Math.min(100, 100 - (violations * 4 + errors * 2 + overrides)))
    const complianceStatus: DailyEvidenceSnapshot['complianceStatus'] = integrityScore >= 90 ? 'green' : integrityScore >= 75 ? 'amber' : 'red'
    const driftDetected = violations > 0
    const anomalyFlags: string[] = []
    if (errors > 10) anomalyFlags.push('error_cluster')
    if (overrides > 5) anomalyFlags.push('high_override_ratio')
    if (violations > 0) anomalyFlags.push('policy_drift')

    const raw = {
      day,
      integrityScore,
      complianceStatus,
      driftDetected,
      anomalyFlags,
      sealedAt: new Date().toISOString(),
    }

    const hmac = createHmac('sha256', this.sealSecret)
      .update(JSON.stringify(raw))
      .digest('hex')

    const snapshot: DailyEvidenceSnapshot = { ...raw, hmac }
    await this.store.saveSnapshot(snapshot)
    return snapshot
  }

  async exportSealedAudit(windowDays = 30): Promise<{ json: OperatingEvidenceDashboard; seal: string; exportedAt: string }> {
    const json = await this.getDashboard(windowDays)
    const exportedAt = new Date().toISOString()
    const seal = createHmac('sha256', this.sealSecret)
      .update(JSON.stringify({ exportedAt, json }))
      .digest('hex')
    return { json, seal, exportedAt }
  }

  async pruneRetention(retentionDays: number): Promise<void> {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - retentionDays)

    const retained = await this.store.list(start.toISOString(), end.toISOString())
    const fileStore = new FileStore()
    await fileStore.append([])
    await (fileStore as unknown as { writeJson?: (path: string, value: unknown) => Promise<void> }).writeJson?.(
      join(process.cwd(), 'data', 'operating-evidence-events.json'),
      retained,
    )
  }
}

let singleton: OperatingEvidenceService | null = null

export function getOperatingEvidenceService(): OperatingEvidenceService {
  if (!singleton) singleton = new OperatingEvidenceService()
  return singleton
}
