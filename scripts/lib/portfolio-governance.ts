/* eslint-disable security/detect-non-literal-fs-filename */
import { mkdirSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, relative } from 'node:path'

import YAML from 'yaml'

import { APP_REGISTRY } from '../../packages/platform-contracts/src/registry'

export const PORTFOLIO_CATALOG_PATH = 'governance/portfolio/product-catalog.json'
export const PORTFOLIO_STATUS_JSON_PATH = 'reports/portfolio-status.json'
export const PORTFOLIO_STATUS_MD_PATH = 'reports/portfolio-status.md'
export const PORTFOLIO_INVESTOR_VIEW_PATH = 'reports/portfolio-investor-view.md'
export const PORTFOLIO_OPS_DASHBOARD_PATH = 'reports/portfolio-ops-dashboard.json'
export const PORTFOLIO_MATRIX_PATH = 'docs/platform/portfolio-matrix.md'
export const TRUTH_MANIFEST_PATH = 'nzila-truth-manifest.json'

export type PortfolioTier = 1 | 2 | 3 | 4 | 5
export type PortfolioStatus = 'production' | 'pilot' | 'incubating' | 'internal' | 'frozen' | 'sunset'
export type DeploymentMode = 'external' | 'internal' | 'none'
export type GtmPosture = 'sell-now' | 'hold' | 'maintain' | 'internal-only' | 'sunset'
export type ProofLevel = 'market-proof' | 'pilot-proof' | 'internal-proof' | 'none'
export type RevenueStatus = 'revenue-active' | 'pilot-contracting' | 'pre-revenue' | 'internal-cost-center' | 'sunsetting'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type MaturityStatus = PortfolioStatus
export type MaturityExposure = 'public' | 'internal'
export type DataIntegrity = 'enforced' | 'partial' | 'minimal'
export type ObservabilityLevel = 'complete' | 'partial' | 'minimal'
export type ScoreDimension = 'revenue' | 'traction' | 'strategic_fit' | 'maintenance_burden' | 'readiness' | 'margin_potential'
export type EngineStatus = 'incubating' | 'stable' | 'deprecated'

export interface ScoringWeights {
  revenue: number
  traction: number
  strategic_fit: number
  maintenance_burden: number
  readiness: number
  margin_potential: number
}

export interface CanonicalProduct {
  id: string
  name: string
  tier: PortfolioTier
  status: PortfolioStatus
  deployment: DeploymentMode
  gtm_posture: GtmPosture
  revenue_status: RevenueStatus
  customers: number
  pilots: number
  proof_level: ProofLevel
  owner: string
  priority: Priority
  strategic_role: string
  last_reviewed: string
}

export interface CanonicalEngine {
  id: string
  name: string
  status: EngineStatus
  owner: string
  strategic_role: string
  lifecycle_notes?: string[]
  capabilities: string[]
  consumers: string[]
}

export interface PortfolioCatalog {
  schema_version: string
  authority: {
    editable_source: string
    generated_by: string
    generated_artifacts: string[]
    notes?: string[]
  }
  scoring: {
    weights: ScoringWeights
  }
  engines?: CanonicalEngine[]
  products: CanonicalProduct[]
}

export interface ValidationFinding {
  level: 'error' | 'warning'
  message: string
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export interface GeneratedArtifact {
  path: string
  content: string
}

export interface RegistryMetadata {
  tier: string
  devPort: number
}

export interface PortfolioProductView extends CanonicalProduct {
  tier_label: string
  gtm_label: string
  proof_label: string
  exposure: MaturityExposure
  readiness_tier: string
  recommendation: 'DOUBLE DOWN' | 'KEEP' | 'HOLD' | 'SUNSET'
  weighted_score: number
  score_inputs: {
    revenue: number
    traction: number
    strategic_fit: number
    maintenance_burden: number
    readiness: number
    margin_potential: number
  }
  registry_tier: string
  dev_port: number | null
}

export interface PortfolioContext {
  root: string
  catalog: PortfolioCatalog
  appIds: string[]
  registryByApp: Map<string, RegistryMetadata>
  today: string
}

const STATUS_VALUES = new Set<PortfolioStatus>(['production', 'pilot', 'incubating', 'internal', 'frozen', 'sunset'])
const DEPLOYMENT_VALUES = new Set<DeploymentMode>(['external', 'internal', 'none'])
const GTM_VALUES = new Set<GtmPosture>(['sell-now', 'hold', 'maintain', 'internal-only', 'sunset'])
const PROOF_VALUES = new Set<ProofLevel>(['market-proof', 'pilot-proof', 'internal-proof', 'none'])
const REVENUE_VALUES = new Set<RevenueStatus>(['revenue-active', 'pilot-contracting', 'pre-revenue', 'internal-cost-center', 'sunsetting'])
const PRIORITY_VALUES = new Set<Priority>(['critical', 'high', 'medium', 'low'])
const DATA_INTEGRITY_VALUES = new Set<DataIntegrity>(['enforced', 'partial', 'minimal'])
const OBSERVABILITY_VALUES = new Set<ObservabilityLevel>(['complete', 'partial', 'minimal'])
const ENGINE_STATUS_VALUES = new Set<EngineStatus>(['incubating', 'stable', 'deprecated'])
const SCORE_DIMENSIONS: ScoreDimension[] = ['revenue', 'traction', 'strategic_fit', 'maintenance_burden', 'readiness', 'margin_potential']

const TIER_LABELS: Record<PortfolioTier, string> = {
  1: 'sell-now',
  2: 'strategic-growth',
  3: 'maintain',
  4: 'incubate',
  5: 'sunset',
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function canonicalPath(path: string): string {
  const normalized = normalizePath(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isWithinBase(base: string, candidate: string): boolean {
  const normalizedBase = canonicalPath(base)
  const normalizedCandidate = canonicalPath(candidate)
  return normalizedCandidate === normalizedBase || normalizedCandidate.startsWith(`${normalizedBase}/`)
}

function safeJoinUnder(base: string, ...parts: string[]): string | null {
  if (parts.some((part) => part.includes('\0') || /(^|[\\/])\.\.([\\/]|$)/.test(part))) return null
  const candidate = normalizePath([base, ...parts].join('/'))
  return isWithinBase(base, candidate) ? candidate : null
}

function safeResolveUnderRoot(root: string, ...segments: string[]): string {
  const candidate = safeJoinUnder(root, ...segments)
  if (!candidate) {
    throw new Error(`Unsafe path outside repository root: ${segments.join('/')}`)
  }
  return candidate
}

function assertSafeSlug(value: string, label: string): string {
  if (!/^[a-z0-9-]+$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return value
}

function assertSafeRelativePath(path: string): string {
  const normalized = normalizePath(path)
  if (!/^[a-zA-Z0-9._\-/]+$/.test(normalized) || normalized.includes('..')) {
    throw new Error(`Invalid artifact path: ${path}`)
  }
  return normalized
}

function readUtf8(path: string): string {
  return execFileSync(
    process.execPath,
    ['-e', 'const fs=require("node:fs");process.stdout.write(fs.readFileSync(process.argv[1],"utf8"));', path],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  )
}

export function findRepoRoot(startDir = process.cwd()): string {
  let dir = normalizePath(startDir)
  while (dir !== normalizePath(dirname(dir))) {
    const workspaceFile = safeJoinUnder(dir, 'pnpm-workspace.yaml')
    if (workspaceFile && existsSync(workspaceFile)) return dir
    dir = normalizePath(dirname(dir))
  }
  throw new Error('Unable to locate repo root')
}

export function listApps(root: string): string[] {
  const appsDir = safeResolveUnderRoot(root, 'apps')
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

export function loadCatalog(root: string): PortfolioCatalog {
  const target = safeResolveUnderRoot(root, PORTFOLIO_CATALOG_PATH)
  return JSON.parse(readUtf8(target)) as PortfolioCatalog
}

export function buildRegistryMetadata(): Map<string, RegistryMetadata> {
  return new Map(
    APP_REGISTRY.map((app) => [
      app.id,
      {
        tier: app.tier,
        devPort: app.devPort,
      },
    ]),
  )
}

export function loadPortfolioContext(root = findRepoRoot()): PortfolioContext {
  return {
    root,
    catalog: loadCatalog(root),
    appIds: listApps(root),
    registryByApp: buildRegistryMetadata(),
    today: formatDate(new Date()),
  }
}

function push(result: ValidationResult, level: 'error' | 'warning', message: string): void {
  result[level === 'error' ? 'errors' : 'warnings'].push(message)
}

export function validateEngines(catalog: PortfolioCatalog, appIds: string[]): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] }

  if (!catalog.engines) return result
  if (!Array.isArray(catalog.engines) || catalog.engines.length === 0) {
    push(result, 'error', 'Catalog engines must be a non-empty array when present')
    return result
  }

  const engineIds = new Set<string>()
  const productIds = new Set(catalog.products.map((product) => product.id))
  const capabilityOwners = new Map<string, string>()

  for (const engine of catalog.engines) {
    if (!engine.id?.trim()) {
      push(result, 'error', 'Engine missing id')
      continue
    }
    if (engineIds.has(engine.id)) push(result, 'error', `Duplicate engine id ${engine.id}`)
    engineIds.add(engine.id)

    if (!engine.name?.trim()) push(result, 'error', `${engine.id}: missing name`)
    if (!ENGINE_STATUS_VALUES.has(engine.status)) push(result, 'error', `${engine.id}: invalid status ${String(engine.status)}`)
    if (!engine.owner?.trim()) push(result, 'error', `${engine.id}: missing owner`)
    if (!engine.strategic_role?.trim()) push(result, 'error', `${engine.id}: missing strategic_role`)
    if (!Array.isArray(engine.capabilities) || engine.capabilities.length === 0) {
      push(result, 'error', `${engine.id}: capabilities must be a non-empty array`)
    }
    if (!Array.isArray(engine.consumers) || engine.consumers.length === 0) {
      push(result, 'error', `${engine.id}: consumers must be a non-empty array`)
    }

    for (const capability of engine.capabilities ?? []) {
      const normalized = capability.trim()
      if (!normalized) {
        push(result, 'error', `${engine.id}: capabilities cannot contain empty values`)
        continue
      }
      const existingOwner = capabilityOwners.get(normalized)
      if (existingOwner) {
        push(result, 'error', `Capability ${normalized} is assigned to both ${existingOwner} and ${engine.id}`)
        continue
      }
      capabilityOwners.set(normalized, engine.id)
    }

    for (const consumer of engine.consumers ?? []) {
      if (!productIds.has(consumer) && !appIds.includes(consumer)) {
        push(result, 'error', `${engine.id}: consumer ${consumer} is not a known product/app`)
      }
    }
  }

  for (const engineId of engineIds) {
    if (productIds.has(engineId)) {
      push(result, 'error', `Engine id ${engineId} collides with a product id`)
    }
  }

  return result
}

export function validateCatalogData(catalog: PortfolioCatalog, appIds: string[], now = new Date()): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] }

  if (!catalog.schema_version) {
    push(result, 'error', 'Catalog missing schema_version')
  }

  if (catalog.authority?.editable_source !== PORTFOLIO_CATALOG_PATH) {
    push(result, 'error', `Catalog editable_source must be ${PORTFOLIO_CATALOG_PATH}`)
  }

  const scoringWeights = catalog.scoring?.weights
  if (!scoringWeights) {
    push(result, 'error', 'Catalog missing scoring.weights')
  } else {
    let weightTotal = 0
    for (const dimension of SCORE_DIMENSIONS) {
      const weight = scoringWeights[dimension]
      if (typeof weight !== 'number' || Number.isNaN(weight)) {
        push(result, 'error', `Catalog scoring.weights.${dimension} must be a number`)
        continue
      }
      if (weight < 0 || weight > 1) {
        push(result, 'error', `Catalog scoring.weights.${dimension} must be between 0 and 1`)
      }
      weightTotal += weight
    }

    const roundedTotal = Math.round(weightTotal * 1000) / 1000
    if (Math.abs(weightTotal - 1) > 0.0001) {
      push(result, 'error', `Catalog scoring.weights must sum to 1.0 (received ${roundedTotal})`)
    }
  }

  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    push(result, 'error', 'Catalog must contain products[]')
    return result
  }

  const seen = new Set<string>()

  for (const product of catalog.products) {
    if (!product.id) push(result, 'error', 'Product missing id')
    if (!product.name) push(result, 'error', `${product.id || '<unknown>'}: missing name`)
    if (!Number.isInteger(product.tier) || product.tier < 1 || product.tier > 5) {
      push(result, 'error', `${product.id}: invalid tier ${String(product.tier)}`)
    }
    if (!STATUS_VALUES.has(product.status)) push(result, 'error', `${product.id}: invalid status ${product.status}`)
    if (!DEPLOYMENT_VALUES.has(product.deployment)) push(result, 'error', `${product.id}: invalid deployment ${product.deployment}`)
    if (!GTM_VALUES.has(product.gtm_posture)) push(result, 'error', `${product.id}: invalid gtm_posture ${product.gtm_posture}`)
    if (!REVENUE_VALUES.has(product.revenue_status)) push(result, 'error', `${product.id}: invalid revenue_status ${product.revenue_status}`)
    if (!PROOF_VALUES.has(product.proof_level)) push(result, 'error', `${product.id}: invalid proof_level ${product.proof_level}`)
    if (!PRIORITY_VALUES.has(product.priority)) push(result, 'error', `${product.id}: invalid priority ${product.priority}`)
    if (typeof product.customers !== 'number' || product.customers < 0) push(result, 'error', `${product.id}: customers must be a non-negative number`)
    if (typeof product.pilots !== 'number' || product.pilots < 0) push(result, 'error', `${product.id}: pilots must be a non-negative number`)
    if (!product.owner?.trim()) push(result, 'error', `${product.id}: missing owner`)
    if (!product.strategic_role?.trim()) push(result, 'error', `${product.id}: missing strategic_role`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(product.last_reviewed)) push(result, 'error', `${product.id}: invalid last_reviewed ${product.last_reviewed}`)

    if (seen.has(product.id)) push(result, 'error', `Duplicate product id ${product.id}`)
    seen.add(product.id)

    if (product.tier === 1 && product.gtm_posture !== 'sell-now') {
      push(result, 'error', `${product.id}: tier 1 products must use gtm_posture=sell-now`)
    }

    if (product.tier === 5 && !new Set<PortfolioStatus>(['frozen', 'sunset']).has(product.status)) {
      push(result, 'error', `${product.id}: tier 5 products must be frozen or sunset`)
    }

    if (product.tier === 5 && product.gtm_posture !== 'sunset') {
      push(result, 'error', `${product.id}: tier 5 products must use gtm_posture=sunset`)
    }

    if (product.status === 'sunset' && product.gtm_posture !== 'sunset') {
      push(result, 'error', `${product.id}: sunset products must use gtm_posture=sunset`)
    }

    if (product.status === 'production' && product.deployment === 'none') {
      push(result, 'error', `${product.id}: production products cannot use deployment=none`)
    }

    if (product.status === 'frozen' && product.gtm_posture === 'sell-now') {
      push(result, 'error', `${product.id}: frozen products cannot use gtm_posture=sell-now`)
    }

    if (product.gtm_posture === 'sell-now' && !new Set<PortfolioTier>([1, 2]).has(product.tier)) {
      push(result, 'error', `${product.id}: only tier 1 or tier 2 products can use gtm_posture=sell-now`)
    }

    if (product.revenue_status === 'revenue-active' && product.customers === 0) {
      push(result, 'warning', `${product.id}: revenue-active but customers=0`)
    }

    if (product.proof_level === 'market-proof' && product.customers === 0) {
      push(result, 'warning', `${product.id}: market-proof but customers=0`)
    }

    if (product.proof_level === 'pilot-proof' && product.pilots === 0) {
      push(result, 'warning', `${product.id}: pilot-proof but pilots=0`)
    }

    const daysSinceReview = Math.floor((now.getTime() - new Date(`${product.last_reviewed}T00:00:00Z`).getTime()) / 86400000)
    if (daysSinceReview > 90) {
      push(result, 'warning', `${product.id}: last reviewed ${daysSinceReview} days ago`)
    }
  }

  for (const appId of appIds) {
    if (!seen.has(appId)) push(result, 'error', `App missing from canonical catalog: ${appId}`)
  }

  for (const productId of seen) {
    if (!appIds.includes(productId)) push(result, 'error', `Catalog entry not present in apps/: ${productId}`)
  }

  const engineValidation = validateEngines(catalog, appIds)
  result.errors.push(...engineValidation.errors)
  result.warnings.push(...engineValidation.warnings)

  return result
}

function exposureFor(product: CanonicalProduct): MaturityExposure {
  return product.deployment === 'external' ? 'public' : 'internal'
}

function readinessFor(product: CanonicalProduct): string {
  if (product.status === 'sunset') return 'sunset-only'
  if (product.status === 'frozen') return 'internal-only'
  if (product.status === 'production' && product.deployment === 'external' && product.proof_level === 'market-proof') {
    return 'production-ready'
  }
  if (new Set<PortfolioStatus>(['production', 'pilot']).has(product.status) || product.proof_level === 'pilot-proof') {
    return 'pilot-safe'
  }
  return 'internal-only'
}

function tierHeading(tier: PortfolioTier): string {
  switch (tier) {
    case 1:
      return 'TIER 1 — Sell Now'
    case 2:
      return 'TIER 2 — Strategic Growth'
    case 3:
      return 'TIER 3 — Maintain'
    case 4:
      return 'TIER 4 — Incubate'
    case 5:
      return 'TIER 5 — Sunset'
  }
}

function tierSignal(product: CanonicalProduct): number {
  switch (product.tier) {
    case 1:
      return 5
    case 2:
      return 4
    case 3:
      return 3
    case 4:
      return 2
    case 5:
      return 1
  }
}

function prioritySignal(priority: Priority): number {
  switch (priority) {
    case 'critical':
      return 5
    case 'high':
      return 4
    case 'medium':
      return 3
    case 'low':
      return 2
  }
}

function revenueSignal(product: CanonicalProduct): number {
  if (product.revenue_status === 'revenue-active') return 5
  if (product.revenue_status === 'pilot-contracting') return 4
  if (product.revenue_status === 'internal-cost-center') return 2
  if (product.revenue_status === 'sunsetting') return 1
  return 2
}

function tractionSignal(product: CanonicalProduct): number {
  if (product.customers >= 3) return 5
  if (product.customers >= 1) return 4
  if (product.pilots >= 2) return 4
  if (product.pilots === 1) return 3
  if (product.proof_level === 'internal-proof') return 2
  return 1
}

function maintenanceSignal(product: CanonicalProduct): number {
  if (product.gtm_posture === 'sunset') return 1
  if (product.gtm_posture === 'internal-only') return 3
  if (product.tier === 1) return 4
  if (product.tier === 2) return 4
  return 2
}

function readinessSignal(product: CanonicalProduct): number {
  if (product.proof_level === 'market-proof' && product.status === 'production') return 5
  if (product.proof_level === 'pilot-proof') return 4
  if (product.proof_level === 'internal-proof') return 3
  if (product.status === 'frozen' || product.status === 'sunset') return 1
  return 2
}

function marginSignal(product: CanonicalProduct): number {
  if (product.gtm_posture === 'sell-now') return 4
  if (product.gtm_posture === 'maintain') return 3
  if (product.gtm_posture === 'internal-only') return 1
  if (product.gtm_posture === 'sunset') return 0
  return 2
}

function recommendationFor(score: number): 'DOUBLE DOWN' | 'KEEP' | 'HOLD' | 'SUNSET' {
  if (score >= 8.5) return 'DOUBLE DOWN'
  if (score >= 6) return 'KEEP'
  if (score >= 3.5) return 'HOLD'
  return 'SUNSET'
}

function enrichProduct(product: CanonicalProduct, registry: RegistryMetadata | undefined, weights: ScoringWeights): PortfolioProductView {
  const score_inputs = {
    revenue: revenueSignal(product),
    traction: tractionSignal(product),
    strategic_fit: Math.round(((tierSignal(product) + prioritySignal(product.priority)) / 2) * 10) / 10,
    maintenance_burden: maintenanceSignal(product),
    readiness: readinessSignal(product),
    margin_potential: marginSignal(product),
  }
  const weightedAverage = (score_inputs.revenue * weights.revenue)
    + (score_inputs.traction * weights.traction)
    + (score_inputs.strategic_fit * weights.strategic_fit)
    + (score_inputs.maintenance_burden * weights.maintenance_burden)
    + (score_inputs.readiness * weights.readiness)
    + (score_inputs.margin_potential * weights.margin_potential)
  const weighted_score = Math.round(((weightedAverage / 5) * 10) * 10) / 10

  return {
    ...product,
    tier_label: tierHeading(product.tier),
    gtm_label: product.gtm_posture,
    proof_label: product.proof_level,
    exposure: exposureFor(product),
    readiness_tier: readinessFor(product),
    recommendation: recommendationFor(weighted_score),
    weighted_score,
    score_inputs,
    registry_tier: registry?.tier ?? 'UNREGISTERED',
    dev_port: registry?.devPort ?? null,
  }
}

function classifyProducts(products: PortfolioProductView[]): Record<string, string[]> {
  return {
    sell_now: products.filter((product) => product.gtm_posture === 'sell-now').map((product) => product.id),
    strategic_growth: products.filter((product) => product.tier === 2).map((product) => product.id),
    maintain: products.filter((product) => product.tier === 3).map((product) => product.id),
    incubate: products.filter((product) => product.tier === 4).map((product) => product.id),
    sunset: products.filter((product) => product.tier === 5).map((product) => product.id),
    internal_only: products.filter((product) => product.gtm_posture === 'internal-only').map((product) => product.id),
  }
}

function buildEngineTopology(catalog: PortfolioCatalog): Record<string, unknown>[] {
  return (catalog.engines ?? []).map((engine) => ({
    id: engine.id,
    name: engine.name,
    status: engine.status,
    owner: engine.owner,
    strategic_role: engine.strategic_role,
    capabilities: engine.capabilities,
    consumers: engine.consumers,
    lifecycle_notes: engine.lifecycle_notes ?? [],
  }))
}

function buildTruthManifest(context: PortfolioContext, products: PortfolioProductView[]): Record<string, unknown> {
  const apps = Object.fromEntries(products.map((product) => [product.id, product.status]))
  const engines = buildEngineTopology(context.catalog)
  const app_status = Object.fromEntries(products.map((product) => [product.id, {
    registry_tier: product.registry_tier,
    deployment_status: product.status,
    readiness_tier: product.readiness_tier,
    exposure: product.exposure,
    portfolio_tier: product.tier,
    gtm_posture: product.gtm_posture,
    proof_level: product.proof_level,
    revenue_status: product.revenue_status,
    priority: product.priority,
  }]))
  const tier_assignments = Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [tierHeading(tier as PortfolioTier), products.filter((product) => product.tier === tier).map((product) => product.id)]))
  const platform_status = products.some((product) => product.status === 'production' && product.deployment === 'external' && product.proof_level === 'market-proof')
    ? 'revenue-live'
    : 'operator-safe'
  const blocking_gaps: string[] = []

  if (!products.some((product) => product.tier === 1 && product.proof_level === 'market-proof')) {
    blocking_gaps.push('No Tier 1 product has market-proof status yet.')
  }
  if (products.some((product) => product.gtm_posture === 'sell-now' && product.deployment !== 'external')) {
    blocking_gaps.push('One or more sell-now products are still internal deployment only.')
  }

  return {
    status_model_version: context.catalog.schema_version,
    platform_status,
    last_audit: context.today,
    authority: {
      editable_source: PORTFOLIO_CATALOG_PATH,
      generated_by: 'scripts/generate-portfolio-artifacts.ts',
      generated_surfaces: [
        TRUTH_MANIFEST_PATH,
        PORTFOLIO_STATUS_JSON_PATH,
        PORTFOLIO_STATUS_MD_PATH,
        PORTFOLIO_INVESTOR_VIEW_PATH,
        PORTFOLIO_OPS_DASHBOARD_PATH,
        PORTFOLIO_MATRIX_PATH,
        'apps/*/maturity.json',
        'apps/*/catalog-info.yaml',
      ],
      operational_registry_source: 'packages/platform-contracts/src/registry.ts',
    },
    engines,
    apps,
    app_status,
    blocking_gaps,
    portfolio_tier_model: {
      version: context.catalog.schema_version,
      authority: PORTFOLIO_CATALOG_PATH,
      tier_assignments,
    },
    portfolio_execution_model: {
      version: context.catalog.schema_version,
      classifications: classifyProducts(products),
    },
  }
}

function buildStatusJson(context: PortfolioContext, products: PortfolioProductView[]): Record<string, unknown> {
  const byTier = Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [tierHeading(tier as PortfolioTier), products.filter((product) => product.tier === tier).length]))
  const byStatus = Object.fromEntries(Array.from(STATUS_VALUES.values()).map((status) => [status, products.filter((product) => product.status === status).length]))
  const byGtm = Object.fromEntries(Array.from(GTM_VALUES.values()).map((gtm) => [gtm, products.filter((product) => product.gtm_posture === gtm).length]))
  const engines = buildEngineTopology(context.catalog)

  return {
    generated_at: context.today,
    authority: PORTFOLIO_CATALOG_PATH,
    summary: {
      total_products: products.length,
      total_engines: engines.length,
      by_tier: byTier,
      by_status: byStatus,
      by_gtm_posture: byGtm,
      sell_now: products.filter((product) => product.gtm_posture === 'sell-now').map((product) => product.id),
      frozen_assets: products.filter((product) => product.gtm_posture === 'sunset').map((product) => product.id),
    },
    engines,
    scoring: {
      weights: context.catalog.scoring.weights,
    },
    matrix: products,
  }
}

function markdownTable(products: PortfolioProductView[]): string[] {
  return [
    '| Product | Tier | Status | GTM | Revenue | Proof | Priority |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...products.map((product) => `| ${product.name} | ${product.tier} | ${product.status} | ${product.gtm_posture} | ${product.revenue_status} | ${product.proof_level} | ${product.priority} |`),
  ]
}

function buildStatusMarkdown(context: PortfolioContext, products: PortfolioProductView[]): string {
  const scoringWeights = context.catalog.scoring.weights
  const engines = context.catalog.engines ?? []
  const lines = [
    '# Portfolio Status',
    '',
    `Generated: ${context.today}`,
    `Authority: ${PORTFOLIO_CATALOG_PATH}`,
    '',
    '## Executive Matrix',
    '',
    ...markdownTable(products),
    '',
    '## Allocation Summary',
    '',
    `- Sell now: ${products.filter((product) => product.gtm_posture === 'sell-now').map((product) => product.id).join(', ') || 'none'}`,
    `- Strategic growth: ${products.filter((product) => product.tier === 2).map((product) => product.id).join(', ') || 'none'}`,
    `- Internal only: ${products.filter((product) => product.gtm_posture === 'internal-only').map((product) => product.id).join(', ') || 'none'}`,
    `- Frozen / sunset: ${products.filter((product) => product.gtm_posture === 'sunset').map((product) => product.id).join(', ') || 'none'}`,
    '',
    '## Engine Topology',
    '',
    '| Engine | Status | Consumers |',
    '| --- | --- | --- |',
    ...engines.map((engine) => `| ${engine.name} | ${engine.status} | ${engine.consumers.join(', ')} |`),
    ...(engines.length === 0 ? ['| _None_ | _n/a_ | _n/a_ |'] : []),
    '',
    '## Score Engine',
    '',
    `Weights: revenue=${scoringWeights.revenue}, traction=${scoringWeights.traction}, strategic_fit=${scoringWeights.strategic_fit}, maintenance_burden=${scoringWeights.maintenance_burden}, readiness=${scoringWeights.readiness}, margin_potential=${scoringWeights.margin_potential}`,
    '',
    '| Product | Weighted Score | Recommendation | Operational Tier | Readiness |',
    '| --- | ---: | --- | --- | --- |',
    ...products.map((product) => `| ${product.name} | ${product.weighted_score.toFixed(1)} | ${product.recommendation} | ${product.registry_tier} | ${product.readiness_tier} |`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

function buildInvestorView(context: PortfolioContext, products: PortfolioProductView[]): string {
  const activeRevenue = products.filter((product) => product.gtm_posture === 'sell-now')
  const futureOptions = products.filter((product) => product.tier === 2 || product.tier === 4)
  const internalRd = products.filter((product) => product.gtm_posture === 'internal-only')
  const frozenAssets = products.filter((product) => product.gtm_posture === 'sunset')

  const section = (title: string, rows: PortfolioProductView[]) => [
    `## ${title}`,
    '',
    rows.length === 0
      ? '_None_' : '| Product | Status | Strategic Role | Proof | Recommendation |',
    rows.length === 0
      ? '' : '| --- | --- | --- | --- | --- |',
    ...rows.map((product) => `| ${product.name} | ${product.status} | ${product.strategic_role} | ${product.proof_level} | ${product.recommendation} |`),
    '',
  ]

  return [
    '# Portfolio Investor View',
    '',
    `Generated: ${context.today}`,
    `Authority: ${PORTFOLIO_CATALOG_PATH}`,
    '',
    ...section('Active Revenue Wedges', activeRevenue),
    ...section('Future Options', futureOptions),
    ...section('Internal R&D', internalRd),
    ...section('Frozen Assets', frozenAssets),
  ].join('\n').concat('\n')
}

function buildOpsDashboard(context: PortfolioContext, products: PortfolioProductView[]): Record<string, unknown> {
  const engines = buildEngineTopology(context.catalog)
  return {
    generated_at: context.today,
    authority: PORTFOLIO_CATALOG_PATH,
    kpis: {
      total_products: products.length,
      total_engines: engines.length,
      sell_now_count: products.filter((product) => product.gtm_posture === 'sell-now').length,
      internal_only_count: products.filter((product) => product.gtm_posture === 'internal-only').length,
      frozen_count: products.filter((product) => product.gtm_posture === 'sunset').length,
    },
    engines,
    charts: {
      by_tier: [1, 2, 3, 4, 5].map((tier) => ({ tier, count: products.filter((product) => product.tier === tier).length })),
      by_status: Array.from(STATUS_VALUES.values()).map((status) => ({ status, count: products.filter((product) => product.status === status).length })),
    },
    scoring: {
      weights: context.catalog.scoring.weights,
    },
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      tier: product.tier,
      status: product.status,
      gtm_posture: product.gtm_posture,
      recommendation: product.recommendation,
      weighted_score: product.weighted_score,
      readiness_tier: product.readiness_tier,
      registry_tier: product.registry_tier,
      dev_port: product.dev_port,
    })),
  }
}

function buildPortfolioMatrix(context: PortfolioContext, products: PortfolioProductView[]): string {
  return [
    '# Nzila OS Portfolio Matrix',
    '',
    '> GENERATED FILE. Do not edit directly.',
    `> Authority: ${PORTFOLIO_CATALOG_PATH}`,
    `> Generated: ${context.today}`,
    '',
    ...markdownTable(products),
    '',
    '## Operational Overlay',
    '',
    '| Product | Registry Tier | Readiness | Deployment | Recommendation |',
    '| --- | --- | --- | --- | --- |',
    ...products.map((product) => `| ${product.name} | ${product.registry_tier} | ${product.readiness_tier} | ${product.deployment} | ${product.recommendation} |`),
    '',
  ].join('\n').concat('\n')
}

function normalizeGeneratedMaturity(existing: Record<string, unknown>, product: PortfolioProductView, today: string): Record<string, unknown> {
  const data_integrity = DATA_INTEGRITY_VALUES.has(existing.data_integrity as DataIntegrity)
    ? existing.data_integrity as DataIntegrity
    : 'partial'
  const observability = OBSERVABILITY_VALUES.has(existing.observability as ObservabilityLevel)
    ? existing.observability as ObservabilityLevel
    : 'partial'

  return {
    generated_from: PORTFOLIO_CATALOG_PATH,
    generated_at: today,
    status: product.status,
    exposure: product.exposure,
    data_integrity,
    contracts_complete: Boolean(existing.contracts_complete ?? false),
    observability,
    portfolio_tier: `TIER ${product.tier}`,
    gtm_posture: product.gtm_posture,
    proof_level: product.proof_level,
    revenue_status: product.revenue_status,
    last_validated: today,
    ...Object.fromEntries(
      Object.entries(existing).filter(([key]) => !new Set([
        'generated_from',
        'generated_at',
        'status',
        'exposure',
        'data_integrity',
        'contracts_complete',
        'observability',
        'portfolio_tier',
        'gtm_posture',
        'proof_level',
        'revenue_status',
        'last_validated',
      ]).has(key)),
    ),
  }
}

function updateCatalogInfoYaml(existingText: string | null, product: PortfolioProductView): string {
  const documents = existingText ? YAML.parseAllDocuments(existingText) : []
  const primary = documents[0]?.toJS() as Record<string, any> | undefined
  const parsed = primary ?? {}
  const metadata = parsed.metadata ?? {}
  const annotations = metadata.annotations ?? {}
  const spec = parsed.spec ?? {}

  metadata.name = metadata.name ?? product.id
  metadata.annotations = {
    ...annotations,
    'nzila.app/generated-from': PORTFOLIO_CATALOG_PATH,
    'nzila.app/portfolio-tier': String(product.tier),
    'nzila.app/portfolio-status': product.status,
    'nzila.app/deployment': product.deployment,
    'nzila.app/gtm-posture': product.gtm_posture,
    'nzila.app/proof-level': product.proof_level,
    'nzila.app/revenue-status': product.revenue_status,
  }

  parsed.metadata = metadata
  parsed.spec = {
    ...spec,
    lifecycle: product.status,
  }

  const rendered = [YAML.stringify(parsed, { indent: 2 }).trimEnd()]

  for (const document of documents.slice(1)) {
    const source = String(document).replace(/^---\s*\n?/, '')
    if (source.trim().length > 0) rendered.push(source.trimEnd())
  }

  return `${rendered.join('\n---\n')}\n`
}

export function buildGeneratedArtifacts(context: PortfolioContext): GeneratedArtifact[] {
  const weights = context.catalog.scoring.weights
  const products = context.catalog.products
    .map((product) => enrichProduct(product, context.registryByApp.get(product.id), weights))
    .sort((left, right) => left.tier - right.tier || left.name.localeCompare(right.name))

  const artifacts: GeneratedArtifact[] = [
    { path: TRUTH_MANIFEST_PATH, content: stableJson(buildTruthManifest(context, products)) },
    { path: PORTFOLIO_STATUS_JSON_PATH, content: stableJson(buildStatusJson(context, products)) },
    { path: PORTFOLIO_STATUS_MD_PATH, content: buildStatusMarkdown(context, products) },
    { path: PORTFOLIO_INVESTOR_VIEW_PATH, content: buildInvestorView(context, products) },
    { path: PORTFOLIO_OPS_DASHBOARD_PATH, content: stableJson(buildOpsDashboard(context, products)) },
    { path: PORTFOLIO_MATRIX_PATH, content: buildPortfolioMatrix(context, products) },
  ]

  for (const product of products) {
    const productId = assertSafeSlug(product.id, 'product id')
    const maturityPath = safeResolveUnderRoot(context.root, 'apps', productId, 'maturity.json')
    const existing = existsSync(maturityPath) ? JSON.parse(readUtf8(maturityPath)) as Record<string, unknown> : {}
    artifacts.push({
      path: relative(context.root, maturityPath).replace(/\\/g, '/'),
      content: stableJson(normalizeGeneratedMaturity(existing, product, context.today)),
    })

    const catalogInfoPath = safeResolveUnderRoot(context.root, 'apps', productId, 'catalog-info.yaml')
    if (existsSync(catalogInfoPath)) {
      const nextContent = updateCatalogInfoYaml(readUtf8(catalogInfoPath), product)
      artifacts.push({
        path: relative(context.root, catalogInfoPath).replace(/\\/g, '/'),
        content: nextContent.endsWith('\n') ? nextContent : `${nextContent}\n`,
      })
    }
  }

  return artifacts.sort((left, right) => left.path.localeCompare(right.path))
}

export function detectArtifactDrift(
  root: string,
  artifacts: GeneratedArtifact[],
  options: { ignoreDailyStamps?: boolean } = {},
): string[] {
  const { ignoreDailyStamps } = options
  const drift: string[] = []

  for (const artifact of artifacts) {
    const artifactPath = assertSafeRelativePath(artifact.path)
    const absolutePath = safeResolveUnderRoot(root, artifactPath)

    if (!existsSync(absolutePath)) {
      drift.push(artifactPath)
      continue
    }

    const expected = ignoreDailyStamps
      ? artifact.content
          .replace(/"(generated_at|last_validated|last_audit)"\s*:\s*"\d{4}-\d{2}-\d{2}"/g, '"$1":"<TODAY>"')
          .replace(/(Generated:\s*)\d{4}-\d{2}-\d{2}/g, '$1<TODAY>')
      : artifact.content

    const actualSize = statSync(absolutePath).size
    const expectedSize = Buffer.byteLength(expected, 'utf8')
    if (actualSize !== expectedSize) drift.push(artifactPath)
  }

  return drift
}

export function writeArtifacts(root: string, artifacts: GeneratedArtifact[]): void {
  for (const artifact of artifacts) {
    const artifactPath = assertSafeRelativePath(artifact.path)
    const absolutePath = safeResolveUnderRoot(root, artifactPath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, artifact.content)
  }
}

export function validatePortfolioGovernance(root = findRepoRoot()): ValidationResult {
  const context = loadPortfolioContext(root)
  const validation = validateCatalogData(context.catalog, context.appIds)
  const drift = detectArtifactDrift(root, buildGeneratedArtifacts(context))
  for (const item of drift) {
    validation.errors.push(`Generated artifact drift detected: ${item}`)
  }
  return validation
}
