#!/usr/bin/env npx tsx
/**
 * Phase 1 + Phase 6 — Canonical Product Manifest Generator
 *
 * Reads:
 *   - governance/portfolio/product-catalog.json   (commercial truth)
 *   - platform/products/envelope.config.json      (platform-envelope truth)
 *
 * Emits (under platform/products/):
 *   - <slug>.json                  (per-product canonical manifest)
 *   - _index.json                  (registry of all slugs + classification)
 *   - _pricing-matrix.json         (Phase 1 — pricing matrix output)
 *   - _trust-listings.json         (Phase 1 — trust listings output)
 *   - _telemetry-requirements.json (Phase 3 — gate input)
 *   - _portfolio-classification.json (Phase 6 — flagship/growth/component/lab/sunset)
 *
 * Run:
 *   pnpm tsx scripts/generate-platform-products.ts
 *   pnpm tsx scripts/generate-platform-products.ts --check
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG_PATH = join(ROOT, 'governance', 'portfolio', 'product-catalog.json')
const ENVELOPE_PATH = join(ROOT, 'platform', 'products', 'envelope.config.json')
const OUT_DIR = join(ROOT, 'platform', 'products')

interface CatalogProduct {
  id: string
  name: string
  tier: 1 | 2 | 3 | 4 | 5
  status: string
  gtm_posture: string
  proof_level: string
  owner: string
  strategic_role: string
  primary_buyer?: string
  customers: number
  pilots: number
  monthly_revenue: number
  annual_recurring_revenue: number
  expected_12m_revenue: number
  last_reviewed: string
}

interface Catalog {
  products: CatalogProduct[]
}

interface Envelope {
  schema_version: string
  tier_label_map: Record<string, 'flagship' | 'growth' | 'component' | 'lab' | 'sunset'>
  products: Record<
    string,
    {
      pricingTier: 'enterprise' | 'growth' | 'consumer' | 'n/a'
      telemetryRequired: boolean
      finopsEnabled: boolean
      trustProfile: string
      launchStage: string
      publicVisible: boolean
    }
  >
}

interface ProductManifest {
  slug: string
  name: string
  tier: number
  tierLabel: 'flagship' | 'growth' | 'component' | 'lab' | 'sunset'
  status: string
  owner: string
  pricingTier: string
  telemetryRequired: boolean
  finopsEnabled: boolean
  trustProfile: string
  launchStage: string
  publicVisible: boolean
  gtmPosture: string
  proofLevel: string
  strategicRole: string
  generatedAt: string
  generatedFrom: string[]
}

function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf-8')) as T
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function tierLabelFor(envelope: Envelope, tier: number): ProductManifest['tierLabel'] {
  const label = envelope.tier_label_map[String(tier)]
  if (!label) throw new Error(`No tier_label_map entry for tier ${tier}`)
  return label
}

function buildManifests(catalog: Catalog, envelope: Envelope, generatedAt: string): ProductManifest[] {
  const manifests: ProductManifest[] = []
  for (const p of catalog.products) {
    const env = envelope.products[p.id]
    if (!env) {
      throw new Error(`Envelope missing entry for product '${p.id}' (add to platform/products/envelope.config.json)`)
    }
    manifests.push({
      slug: p.id,
      name: p.name,
      tier: p.tier,
      tierLabel: tierLabelFor(envelope, p.tier),
      status: p.status,
      owner: p.owner,
      pricingTier: env.pricingTier,
      telemetryRequired: env.telemetryRequired,
      finopsEnabled: env.finopsEnabled,
      trustProfile: env.trustProfile,
      launchStage: env.launchStage,
      publicVisible: env.publicVisible,
      gtmPosture: p.gtm_posture,
      proofLevel: p.proof_level,
      strategicRole: p.strategic_role,
      generatedAt,
      generatedFrom: ['governance/portfolio/product-catalog.json', 'platform/products/envelope.config.json'],
    })
  }
  return manifests.sort((a, b) => a.slug.localeCompare(b.slug))
}

function buildArtifacts(manifests: ProductManifest[], generatedAt: string): Map<string, string> {
  const out = new Map<string, string>()

  // Per-product files
  for (const m of manifests) {
    out.set(`${m.slug}.json`, stableJson(m))
  }

  // _index
  out.set(
    '_index.json',
    stableJson({
      generatedAt,
      count: manifests.length,
      products: manifests.map((m) => ({ slug: m.slug, tier: m.tier, tierLabel: m.tierLabel, publicVisible: m.publicVisible })),
    }),
  )

  // _pricing-matrix
  const byPricing: Record<string, string[]> = {}
  for (const m of manifests) {
    byPricing[m.pricingTier] ??= []
    byPricing[m.pricingTier].push(m.slug)
  }
  out.set('_pricing-matrix.json', stableJson({ generatedAt, byPricingTier: byPricing }))

  // _trust-listings
  out.set(
    '_trust-listings.json',
    stableJson({
      generatedAt,
      products: manifests
        .filter((m) => m.publicVisible)
        .map((m) => ({ slug: m.slug, name: m.name, trustProfile: m.trustProfile, launchStage: m.launchStage })),
    }),
  )

  // _telemetry-requirements (Phase 3 input)
  out.set(
    '_telemetry-requirements.json',
    stableJson({
      generatedAt,
      requiredApps: manifests.filter((m) => m.telemetryRequired).map((m) => m.slug),
      exemptApps: manifests.filter((m) => !m.telemetryRequired).map((m) => m.slug),
    }),
  )

  // _portfolio-classification (Phase 6)
  const byLabel: Record<string, string[]> = {}
  for (const m of manifests) {
    byLabel[m.tierLabel] ??= []
    byLabel[m.tierLabel].push(m.slug)
  }
  out.set(
    '_portfolio-classification.json',
    stableJson({
      generatedAt,
      flagship: byLabel.flagship ?? [],
      growth: byLabel.growth ?? [],
      component: byLabel.component ?? [],
      lab: byLabel.lab ?? [],
      sunset: byLabel.sunset ?? [],
    }),
  )

  return out
}

function existingArtifactPaths(): string[] {
  if (!existsSync(OUT_DIR)) return []
  return readdirSync(OUT_DIR).filter((f) => f.endsWith('.json') && f !== 'envelope.config.json' && f !== 'envelope.schema.json')
}

function main(): void {
  const checkOnly = process.argv.includes('--check')
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const catalog = readJson<Catalog>(CATALOG_PATH)
  const envelope = readJson<Envelope>(ENVELOPE_PATH)
  const generatedAt = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`

  // Cross-check: every catalog product must have an envelope entry.
  const missing = catalog.products.filter((p) => !envelope.products[p.id]).map((p) => p.id)
  if (missing.length > 0) {
    console.error(`[generate-platform-products] FAIL — envelope missing entries: ${missing.join(', ')}`)
    process.exit(1)
  }
  // And reverse — envelope entries must exist in catalog.
  const orphan = Object.keys(envelope.products).filter((id) => !catalog.products.find((p) => p.id === id))
  if (orphan.length > 0) {
    console.error(`[generate-platform-products] FAIL — envelope has orphan entries (not in catalog): ${orphan.join(', ')}`)
    process.exit(1)
  }

  const manifests = buildManifests(catalog, envelope, generatedAt)
  const artifacts = buildArtifacts(manifests, generatedAt)

  if (checkOnly) {
    let drift = false
    for (const [name, content] of artifacts) {
      const p = join(OUT_DIR, name)
      if (!existsSync(p) || readFileSync(p, 'utf-8') !== content) {
        console.error(`[generate-platform-products] drift: platform/products/${name}`)
        drift = true
      }
    }
    if (drift) process.exit(1)
    console.log(`[generate-platform-products] PASS — ${artifacts.size} artifacts in sync`)
    return
  }

  for (const [name, content] of artifacts) {
    writeFileSync(join(OUT_DIR, name), content)
  }
  // Cleanup: remove stale per-product files for products no longer present.
  const validNames = new Set(artifacts.keys())
  for (const f of existingArtifactPaths()) {
    if (!validNames.has(f)) {
      console.warn(`[generate-platform-products] stale artifact ignored (not removed): ${f}`)
    }
  }
  console.log(`[generate-platform-products] PASS — wrote ${artifacts.size} artifacts to platform/products/`)
}

main()
