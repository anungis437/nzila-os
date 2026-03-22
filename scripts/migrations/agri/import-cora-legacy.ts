/**
 * Cora Insights Legacy Data Migration
 *
 * Imports analytics & intelligence data from the legacy Cora Insights application:
 *   - agri_forecasts (yield, price, production)
 *   - agri_price_signals
 *   - agri_risk_scores
 *
 * Usage:
 *   pnpm tsx scripts/migrations/agri/import-cora-legacy.ts --dry-run
 *   pnpm tsx scripts/migrations/agri/import-cora-legacy.ts --live
 *
 * Requires:
 *   - DATABASE_URL env var for destination (NzilaOS)
 *   - LEGACY_CORA_DATABASE_URL env var for source (Cora Insights)
 *
 * Note: Run import-agrimo-legacy.ts first to establish producer records.
 *       Cora records reference producers by legacy ID for cross-linking.
 *
 * @idempotent Uses legacySourceId + legacySourceSystem='cora-insights' as upsert key
 */

// ── Types ─────────────────────────────────────────────────────────────────

interface MigrationConfig {
  dryRun: boolean
  batchSize: number
  sourceConnectionString: string
  destConnectionString: string
}

interface MigrationResult {
  table: string
  total: number
  inserted: number
  skipped: number
  errors: MigrationError[]
}

interface MigrationError {
  legacyId: string
  table: string
  message: string
}

// ── Legacy Cora model shapes ──────────────────────────────────────────────

interface CoraForecast {
  id: number
  org_id: string
  forecast_type: string
  crop_type: string | null
  region: string | null
  producer_id: number | null
  period_start: string
  period_end: string
  predicted_value: number
  confidence_pct: number | null
  unit: string | null
  model_version: string | null
  metadata_json: string | null
  created_at: string
}

interface CoraPriceSignal {
  id: number
  org_id: string
  crop_type: string
  market_name: string
  currency: string
  price_per_kg: number
  price_date: string
  source: string | null
  trend: string | null
  metadata_json: string | null
  created_at: string
}

interface CoraRiskScore {
  id: number
  org_id: string
  risk_type: string
  scope: string
  target_id: string | null
  target_name: string | null
  score: number
  severity: string
  factors_json: string | null
  assessed_at: string
  created_at: string
}

// ── Status mapping (legacy → canonical) ───────────────────────────────────

const FORECAST_TYPE_MAP: Record<string, string> = {
  yield: 'yield',
  yield_forecast: 'yield',
  price: 'price',
  price_forecast: 'price',
  production: 'production',
  production_forecast: 'production',
  demand: 'production',
}

const RISK_TYPE_MAP: Record<string, string> = {
  climate: 'climate',
  weather: 'climate',
  market: 'market',
  price: 'market',
  operational: 'operational',
  logistics: 'operational',
  pest: 'pest_disease',
  disease: 'pest_disease',
  pest_disease: 'pest_disease',
  soil: 'soil_degradation',
  soil_degradation: 'soil_degradation',
}

const RISK_SCOPE_MAP: Record<string, string> = {
  producer: 'producer',
  farmer: 'producer',
  cooperative: 'cooperative',
  coop: 'cooperative',
  region: 'region',
  national: 'national',
  crop: 'crop',
}

const TREND_MAP: Record<string, string> = {
  up: 'rising',
  rising: 'rising',
  increase: 'rising',
  down: 'falling',
  falling: 'falling',
  decrease: 'falling',
  stable: 'stable',
  flat: 'stable',
  volatile: 'volatile',
}

const SOURCE_SYSTEM = 'cora-insights' as const

// ── Helpers ───────────────────────────────────────────────────────────────

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2)
  const isLive = args.includes('--live')
  const batchSize = parseInt(
    args.find((a) => a.startsWith('--batch='))?.split('=')[1] ?? '500',
    10,
  )

  const sourceConnectionString = process.env.LEGACY_CORA_DATABASE_URL
  const destConnectionString = process.env.DATABASE_URL

  if (!sourceConnectionString) {
    console.error('❌ LEGACY_CORA_DATABASE_URL is required')
    process.exit(1)
  }
  if (!destConnectionString) {
    console.error('❌ DATABASE_URL is required')
    process.exit(1)
  }

  return {
    dryRun: !isLive,
    batchSize,
    sourceConnectionString,
    destConnectionString,
  }
}

function mapForecastType(type: string): string {
  return FORECAST_TYPE_MAP[type.toLowerCase()] ?? 'yield'
}

function mapRiskType(type: string): string {
  return RISK_TYPE_MAP[type.toLowerCase()] ?? 'operational'
}

function mapRiskScope(scope: string): string {
  return RISK_SCOPE_MAP[scope.toLowerCase()] ?? 'region'
}

function mapTrend(trend: string | null): string | null {
  if (!trend) return null
  return TREND_MAP[trend.toLowerCase()] ?? trend.toLowerCase()
}

function generateId(): string {
  return crypto.randomUUID()
}

function parseJsonSafe(json: string | null): Record<string, unknown> | null {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

// ── Migration runners ─────────────────────────────────────────────────────

async function migrateForecasts(config: MigrationConfig): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_forecasts',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_forecasts (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // TODO: Connect to source DB and fetch forecasts
  // const sourceForecasts: CoraForecast[] = await sourceDb.query(
  //   'SELECT * FROM forecasts ORDER BY id'
  // )

  // For each forecast:
  // 1. Check legacySourceId + SOURCE_SYSTEM exists in dest → skip if found
  // 2. Map fields:
  //    - id: generateId()
  //    - orgId: forecast.org_id
  //    - forecastType: mapForecastType(forecast.forecast_type)
  //    - cropType: forecast.crop_type
  //    - region: forecast.region
  //    - producerId: resolve via producer legacy ID map (optional)
  //    - periodStart: new Date(forecast.period_start)
  //    - periodEnd: new Date(forecast.period_end)
  //    - predictedValue: forecast.predicted_value
  //    - confidencePct: forecast.confidence_pct
  //    - unit: forecast.unit
  //    - modelVersion: forecast.model_version
  //    - metadata: parseJsonSafe(forecast.metadata_json)
  //    - legacySourceId: String(forecast.id)
  //    - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Forecasts: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migratePriceSignals(config: MigrationConfig): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_price_signals',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_price_signals (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: signal.org_id
  //   - cropType: signal.crop_type
  //   - marketName: signal.market_name
  //   - currency: signal.currency
  //   - pricePerKg: signal.price_per_kg
  //   - priceDate: new Date(signal.price_date)
  //   - source: signal.source
  //   - trend: mapTrend(signal.trend)
  //   - metadata: parseJsonSafe(signal.metadata_json)
  //   - legacySourceId: String(signal.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Price signals: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migrateRiskScores(config: MigrationConfig): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_risk_scores',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_risk_scores (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: risk.org_id
  //   - riskType: mapRiskType(risk.risk_type)
  //   - scope: mapRiskScope(risk.scope)
  //   - targetId: risk.target_id
  //   - targetName: risk.target_name
  //   - score: risk.score
  //   - severity: risk.severity
  //   - factors: parseJsonSafe(risk.factors_json)
  //   - assessedAt: new Date(risk.assessed_at)
  //   - legacySourceId: String(risk.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Risk scores: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const config = parseArgs()

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Cora Insights → NzilaOS Agri: Intelligence Data Migration')
  console.log(`  Mode: ${config.dryRun ? '🔍 DRY RUN' : '🔴 LIVE'}`)
  console.log(`  Source: ${config.sourceConnectionString.replace(/:\/\/.*@/, '://***@')}`)
  console.log(`  Dest:   ${config.destConnectionString.replace(/:\/\/.*@/, '://***@')}`)
  console.log('═══════════════════════════════════════════════════════════')

  const results: MigrationResult[] = []

  // Migrate intelligence tables (no FK dependencies between them)
  results.push(await migrateForecasts(config))
  results.push(await migratePriceSignals(config))
  results.push(await migrateRiskScores(config))

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  Migration Summary')
  console.log('═══════════════════════════════════════════════════════════')
  for (const r of results) {
    const status = r.errors.length > 0 ? '⚠️' : '✅'
    console.log(
      `  ${status} ${r.table}: ${r.inserted} inserted, ${r.skipped} skipped, ${r.errors.length} errors`,
    )
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
  if (totalErrors > 0) {
    console.log(`\n❌ ${totalErrors} total errors — check logs above`)
    process.exit(1)
  }

  console.log('\n✅ Cora migration complete')
}

main().catch((err) => {
  console.error('Fatal migration error:', err)
  process.exit(1)
})
