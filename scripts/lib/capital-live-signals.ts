import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

import { findRepoRoot } from './portfolio-governance'
import type { CapitalProduct } from './capital-allocation'

export type CapitalMetricKey =
  | 'monthly_revenue_actual'
  | 'pipeline_actual'
  | 'collections_outstanding'
  | 'active_users'
  | 'engineering_velocity'

export type CapitalConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type CapitalMetricSourceType = 'live' | 'manual' | 'estimate' | 'unavailable'

export interface CapitalMetricObservation {
  key: CapitalMetricKey
  value: number | null
  source: string
  sourceType: CapitalMetricSourceType
  confidence: CapitalConfidence
  observedAt: string | null
  note?: string
}

export interface CapitalConnectorStatus {
  connector: string
  enabled: boolean
  status: 'available' | 'unavailable' | 'disabled'
  note: string
}

export interface ProductEngineeringSignals {
  commitCount30d: number
  bugLoad30d: number
  cycleTimeHours: number | null
  releaseCadencePerWeek: number | null
}

export interface ProductLiveSignals {
  productId: string
  metrics: Record<CapitalMetricKey, CapitalMetricObservation>
  connectors: CapitalConnectorStatus[]
  confidencePct: number
  engineeringSignals: ProductEngineeringSignals
}

type FlatRecord = Record<string, string>

const METRIC_KEYS: CapitalMetricKey[] = [
  'monthly_revenue_actual',
  'pipeline_actual',
  'collections_outstanding',
  'active_users',
  'engineering_velocity',
]

const METRIC_WEIGHTS: Record<CapitalMetricKey, number> = {
  monthly_revenue_actual: 0.3,
  pipeline_actual: 0.25,
  collections_outstanding: 0.15,
  active_users: 0.1,
  engineering_velocity: 0.2,
}

const MANUAL_SIGNALS_PATH = 'governance/foundations/capital/manual-live-signals.csv'

function safeJoinWithinRoot(root: string, ...segments: string[]): string | null {
  const resolvedRoot = resolve(root)
  const candidate = resolve(resolvedRoot, ...segments)
  if (candidate === resolvedRoot || candidate.startsWith(`${resolvedRoot}${sep}`)) {
    return candidate
  }
  return null
}

function envEnabled(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase())
}

function defaultObservation(key: CapitalMetricKey): CapitalMetricObservation {
  return {
    key,
    value: null,
    source: 'unavailable',
    sourceType: 'unavailable',
    confidence: 'LOW',
    observedAt: null,
    note: 'No live or manual signal available.',
  }
}

function confidenceWeight(confidence: CapitalConfidence, sourceType: CapitalMetricSourceType): number {
  if (sourceType === 'unavailable') return 0.1
  if (confidence === 'HIGH') return 1
  if (confidence === 'MEDIUM') return 0.65
  return 0.3
}

function computeConfidencePct(metrics: Record<CapitalMetricKey, CapitalMetricObservation>): number {
  const weighted = METRIC_KEYS.reduce((sum, key) => {
    const observation = metrics[key]
    return sum + (confidenceWeight(observation.confidence, observation.sourceType) * METRIC_WEIGHTS[key])
  }, 0)
  return Math.round(weighted * 1000) / 10
}

function parseCsv(content: string): FlatRecord[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(',')
    const record: FlatRecord = {}
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim()
    })
    return record
  })
}

function readStructuredRecords(safePath: string | null): FlatRecord[] {
  if (!safePath || !existsSync(safePath)) return []
  const content = readFileSync(safePath, 'utf8').trim()
  if (!content) return []
  if (safePath.endsWith('.json')) {
    const parsed = JSON.parse(content) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((value) => Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, String(inner ?? '')])))
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown[] }).rows)) {
      return ((parsed as { rows: unknown[] }).rows).map((value) => Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, String(inner ?? '')])))
    }
    return []
  }
  return parseCsv(content)
}

function findProductRecord(records: FlatRecord[], product: CapitalProduct): FlatRecord | undefined {
  const aliases = [product.id, product.name, product.name.toLowerCase(), product.id.toLowerCase()]
  return records.find((record) => {
    const candidate = (record.product_id ?? record.product ?? record.product_name ?? '').toLowerCase()
    return aliases.some((alias) => alias.toLowerCase() === candidate)
  })
}

function numeric(value: string | undefined): number | null {
  if (!value || value.length === 0) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseConfidence(value: string | undefined, fallback: CapitalConfidence): CapitalConfidence {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'HIGH' || normalized === 'MEDIUM' || normalized === 'LOW') return normalized
  return fallback
}

function parseSourceType(value: string | undefined, fallback: CapitalMetricSourceType): CapitalMetricSourceType {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'live' || normalized === 'manual' || normalized === 'estimate' || normalized === 'unavailable') return normalized
  return fallback
}

function observation(
  key: CapitalMetricKey,
  value: number | null,
  source: string,
  sourceType: CapitalMetricSourceType,
  confidence: CapitalConfidence,
  observedAt: string | null,
  note?: string,
): CapitalMetricObservation {
  return {
    key,
    value,
    source,
    sourceType,
    confidence,
    observedAt,
    note,
  }
}

function estimateMetric(product: CapitalProduct, key: CapitalMetricKey): CapitalMetricObservation {
  if (key === 'monthly_revenue_actual') {
    return observation(key, product.monthly_revenue, 'catalog estimate', 'estimate', 'LOW', product.last_reviewed ?? null, 'Derived from governance/portfolio/product-catalog.json.')
  }
  if (key === 'pipeline_actual') {
    return observation(key, product.pipeline_value, 'catalog estimate', 'estimate', 'LOW', product.last_reviewed ?? null, 'Derived from governance/portfolio/product-catalog.json.')
  }
  return defaultObservation(key)
}

function loadManualCsv(root: string, product: CapitalProduct): {
  metrics: Partial<Record<CapitalMetricKey, CapitalMetricObservation>>
  status: CapitalConnectorStatus
} {
  const filePath = safeJoinWithinRoot(root, MANUAL_SIGNALS_PATH)
  const records = readStructuredRecords(filePath)
  const record = findProductRecord(records, product)
  if (!record) {
    return {
      metrics: {},
      status: {
        connector: 'Manual CSV',
        enabled: true,
        status: 'unavailable',
        note: 'No manual row for product.',
      },
    }
  }

  const observedAt = record.as_of_date ?? null
  const source = record.source_name?.trim() || 'manual csv'
  const sourceType = parseSourceType(record.source_type, 'manual')
  const confidence = parseConfidence(record.confidence, sourceType === 'manual' ? 'MEDIUM' : sourceType === 'live' ? 'HIGH' : 'LOW')
  return {
    metrics: {
      monthly_revenue_actual: observation('monthly_revenue_actual', numeric(record.monthly_revenue_actual), source, sourceType, confidence, observedAt, record.note),
      pipeline_actual: observation('pipeline_actual', numeric(record.pipeline_actual), source, sourceType, confidence, observedAt, record.note),
      collections_outstanding: observation('collections_outstanding', numeric(record.collections_outstanding), source, sourceType, confidence, observedAt, record.note),
      active_users: observation('active_users', numeric(record.active_users), source, sourceType, confidence, observedAt, record.note),
      engineering_velocity: observation('engineering_velocity', numeric(record.engineering_velocity), source, sourceType, confidence, observedAt, record.note),
    },
    status: {
      connector: 'Manual CSV',
      enabled: true,
      status: 'available',
      note: 'Manual fallback row loaded.',
    },
  }
}

function loadExportConnector(
  root: string,
  product: CapitalProduct,
  connectorName: string,
  envToggleName: string,
  envPathName: string,
  fields: Partial<Record<CapitalMetricKey, string>>,
): {
  metrics: Partial<Record<CapitalMetricKey, CapitalMetricObservation>>
  status: CapitalConnectorStatus
} {
  const enabled = envEnabled(envToggleName)
  if (!enabled) {
    return {
      metrics: {},
      status: {
        connector: connectorName,
        enabled: false,
        status: 'disabled',
        note: `${envToggleName} is off.`,
      },
    }
  }

  const exportPath = process.env[envPathName]
  const filePath = exportPath ? safeJoinWithinRoot(root, exportPath) : null
  if (!filePath || !existsSync(filePath)) {
    return {
      metrics: {},
      status: {
        connector: connectorName,
        enabled: true,
        status: 'unavailable',
        note: `${envPathName} not configured or file missing.`,
      },
    }
  }

  const records = readStructuredRecords(filePath)
  const record = findProductRecord(records, product)
  if (!record) {
    return {
      metrics: {},
      status: {
        connector: connectorName,
        enabled: true,
        status: 'unavailable',
        note: 'Export present but no row matched this product.',
      },
    }
  }

  const metrics: Partial<Record<CapitalMetricKey, CapitalMetricObservation>> = {}
  const observedAt = record.as_of_date ?? null
  const source = record.source_name?.trim() || `${connectorName} export`
  const sourceType = parseSourceType(record.source_type, 'live')
  const confidence = parseConfidence(record.confidence, sourceType === 'live' ? 'HIGH' : sourceType === 'manual' ? 'MEDIUM' : 'LOW')
  for (const [key, fieldName] of Object.entries(fields) as Array<[CapitalMetricKey, string]>) {
    metrics[key] = observation(key, numeric(record[fieldName]), source, sourceType, confidence, observedAt, record.note)
  }

  return {
    metrics,
    status: {
      connector: connectorName,
      enabled: true,
      status: 'available',
      note: 'Export row loaded.',
    },
  }
}

function safeGit(root: string, args: string): string {
  try {
    return execSync(`git -C "${root}" ${args}`, { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function existingProductPath(root: string, product: CapitalProduct): string | null {
  const productId = product.id.replace(/[^a-z0-9-]/gi, '')
  const candidates = [
    safeJoinWithinRoot(root, 'apps', productId),
    safeJoinWithinRoot(root, 'packages', productId),
  ]
  const match = candidates.find((candidate) => candidate !== null && existsSync(candidate))
  return match ?? null
}

function loadDora(root: string): { cycleTimeHours: number | null; releaseCadencePerWeek: number | null } {
  const filePath = safeJoinWithinRoot(root, 'ops', 'outputs', 'dora-metrics.json')
  if (!existsSync(filePath)) {
    return { cycleTimeHours: null, releaseCadencePerWeek: null }
  }
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as {
    metrics?: {
      deployment_frequency?: { value?: number }
      lead_time_for_change?: { value?: number | null }
    }
  }
  return {
    cycleTimeHours: parsed.metrics?.lead_time_for_change?.value ?? null,
    releaseCadencePerWeek: parsed.metrics?.deployment_frequency?.value ?? null,
  }
}

function loadGitHubTelemetry(root: string, product: CapitalProduct): {
  metrics: Partial<Record<CapitalMetricKey, CapitalMetricObservation>>
  status: CapitalConnectorStatus
  engineeringSignals: ProductEngineeringSignals
} {
  const enabled = envEnabled('CAPITAL_ENABLE_GITHUB_ACTIVITY', true)
  const dora = loadDora(root)
  const emptySignals: ProductEngineeringSignals = {
    commitCount30d: 0,
    bugLoad30d: 0,
    cycleTimeHours: dora.cycleTimeHours,
    releaseCadencePerWeek: dora.releaseCadencePerWeek,
  }

  if (!enabled) {
    return {
      metrics: {},
      status: {
        connector: 'GitHub engineering activity',
        enabled: false,
        status: 'disabled',
        note: 'CAPITAL_ENABLE_GITHUB_ACTIVITY is off.',
      },
      engineeringSignals: emptySignals,
    }
  }

  const path = existingProductPath(root, product)
  const scope = path ? ` -- "${path}"` : ''
  const commitLog = safeGit(root, `log --since="30 days ago" --format="%s"${scope}`)
  const commitSubjects = commitLog.split(/\r?\n/).filter(Boolean)
  const commitCount30d = commitSubjects.length
  const bugLoad30d = commitSubjects.filter((subject) => /(fix|bug|hotfix|revert)/i.test(subject)).length
  const releaseCadencePerWeek = dora.releaseCadencePerWeek
  const cycleTimeHours = dora.cycleTimeHours
  const leadTimePenalty = cycleTimeHours === null ? 10 : Math.min(cycleTimeHours / 150, 20)
  const cadenceBonus = releaseCadencePerWeek === null ? 4 : Math.min(releaseCadencePerWeek * 1.5, 20)
  const engineeringVelocity = Math.max(0, Math.min(100, Math.round((commitCount30d * 6) + cadenceBonus - (bugLoad30d * 3) - leadTimePenalty)))

  const note = path
    ? `Derived from git activity in ${path.replace(`${root}\\`, '')} and ops/outputs/dora-metrics.json.`
    : 'Derived from repository-wide git activity and ops/outputs/dora-metrics.json.'

  return {
    metrics: {
      engineering_velocity: observation(
        'engineering_velocity',
        engineeringVelocity,
        'github repo telemetry',
        'live',
        'HIGH',
        null,
        `${note} Commits=${commitCount30d}, bug-like commits=${bugLoad30d}, cycleTimeHours=${cycleTimeHours ?? 'n/a'}, releaseCadencePerWeek=${releaseCadencePerWeek ?? 'n/a'}.`,
      ),
    },
    status: {
      connector: 'GitHub engineering activity',
      enabled: true,
      status: 'available',
      note,
    },
    engineeringSignals: {
      commitCount30d,
      bugLoad30d,
      cycleTimeHours,
      releaseCadencePerWeek,
    },
  }
}

export function loadCapitalLiveSignals(products: CapitalProduct[], root = findRepoRoot()): Map<string, ProductLiveSignals> {
  const signalMap = new Map<string, ProductLiveSignals>()

  for (const product of products) {
    const metrics: Record<CapitalMetricKey, CapitalMetricObservation> = {
      monthly_revenue_actual: defaultObservation('monthly_revenue_actual'),
      pipeline_actual: defaultObservation('pipeline_actual'),
      collections_outstanding: defaultObservation('collections_outstanding'),
      active_users: defaultObservation('active_users'),
      engineering_velocity: defaultObservation('engineering_velocity'),
    }

    const connectors: CapitalConnectorStatus[] = []
    const manual = loadManualCsv(root, product)
    connectors.push(manual.status)

    const stripe = loadExportConnector(root, product, 'Stripe', 'CAPITAL_ENABLE_STRIPE', 'CAPITAL_STRIPE_EXPORT_PATH', {
      monthly_revenue_actual: 'monthly_revenue_actual',
      collections_outstanding: 'collections_outstanding',
    })
    connectors.push(stripe.status)

    const hubspot = loadExportConnector(root, product, 'HubSpot', 'CAPITAL_ENABLE_HUBSPOT', 'CAPITAL_HUBSPOT_EXPORT_PATH', {
      pipeline_actual: 'pipeline_actual',
    })
    connectors.push(hubspot.status)

    const quickBooks = loadExportConnector(root, product, 'QuickBooks', 'CAPITAL_ENABLE_QUICKBOOKS', 'CAPITAL_QUICKBOOKS_EXPORT_PATH', {
      collections_outstanding: 'collections_outstanding',
    })
    connectors.push(quickBooks.status)

    const gmail = loadExportConnector(root, product, 'Gmail pipeline inbox', 'CAPITAL_ENABLE_GMAIL_PIPELINE', 'CAPITAL_GMAIL_PIPELINE_EXPORT_PATH', {
      pipeline_actual: 'pipeline_actual',
    })
    connectors.push(gmail.status)

    const supabase = loadExportConnector(root, product, 'Supabase analytics', 'CAPITAL_ENABLE_SUPABASE_ANALYTICS', 'CAPITAL_SUPABASE_EXPORT_PATH', {
      active_users: 'active_users',
    })
    connectors.push(supabase.status)

    const github = loadGitHubTelemetry(root, product)
    connectors.push(github.status)

    for (const source of [manual.metrics, stripe.metrics, hubspot.metrics, quickBooks.metrics, gmail.metrics, supabase.metrics, github.metrics]) {
      for (const [key, value] of Object.entries(source) as Array<[CapitalMetricKey, CapitalMetricObservation]>) {
        if (value && value.value !== null) {
          metrics[key] = value
        }
      }
    }

    for (const key of METRIC_KEYS) {
      if (metrics[key].value === null && (key === 'monthly_revenue_actual' || key === 'pipeline_actual')) {
        metrics[key] = estimateMetric(product, key)
      }
    }

    signalMap.set(product.id, {
      productId: product.id,
      metrics,
      connectors,
      confidencePct: computeConfidencePct(metrics),
      engineeringSignals: github.engineeringSignals,
    })
  }

  return signalMap
}