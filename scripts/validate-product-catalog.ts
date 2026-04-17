#!/usr/bin/env npx tsx

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

interface CatalogProduct {
  id: string
  name: string
  category: string
  owner: string
  product_tier: string
  deployment_status: string
  readiness_tier: string
  exposure: 'public' | 'internal'
  monetization_status: string
  target_customer: string
  value_prop: string
  commercial_priority: number
  code_presence: 'full' | 'partial' | 'scaffold' | 'none'
  evidence_status: 'complete' | 'partial' | 'none'
  docs_entrypoint: string
  internal_dependencies: string[]
  external_dependencies: string[]
  kpi_owner: string
  public_claim_permissions: Record<string, boolean>
}

interface ProductCatalog {
  schema_version: string
  authority: Record<string, string>
  products: CatalogProduct[]
}

interface TruthManifest {
  apps: Record<string, string>
  app_status: Record<string, {
    registry_tier: string
    deployment_status: string
    readiness_tier: string
    exposure: 'public' | 'internal'
  }>
}

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  throw new Error('Could not find repo root')
}

function loadRegistryTiers(root: string): Map<string, string> {
  const registryPath = join(root, 'packages', 'platform-contracts', 'src', 'registry.ts')
  const content = readFileSync(registryPath, 'utf8')
  const map = new Map<string, string>()

  const rx = /id:\s*'([^']+)'[\s\S]*?tier:\s*'([^']+)'/g
  let match: RegExpExecArray | null
  while ((match = rx.exec(content)) !== null) {
    map.set(match[1], match[2])
  }
  return map
}

function loadCatalog(root: string): ProductCatalog {
  const catalogPath = join(root, 'governance', 'portfolio', 'product-catalog.json')
  return JSON.parse(readFileSync(catalogPath, 'utf8')) as ProductCatalog
}

function loadTruth(root: string): TruthManifest {
  const truthPath = join(root, 'nzila-truth-manifest.json')
  return JSON.parse(readFileSync(truthPath, 'utf8')) as TruthManifest
}

function listApps(root: string): string[] {
  const appsDir = join(root, 'apps')
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

function main() {
  const root = findRepoRoot()
  const catalog = loadCatalog(root)
  const truth = loadTruth(root)
  const registryTiers = loadRegistryTiers(root)
  const apps = listApps(root)

  const issues: string[] = []

  const requiredFields: Array<keyof CatalogProduct> = [
    'id',
    'name',
    'category',
    'owner',
    'product_tier',
    'deployment_status',
    'readiness_tier',
    'exposure',
    'monetization_status',
    'target_customer',
    'value_prop',
    'commercial_priority',
    'code_presence',
    'evidence_status',
    'docs_entrypoint',
    'internal_dependencies',
    'external_dependencies',
    'kpi_owner',
    'public_claim_permissions',
  ]

  const names = new Set<string>()
  for (const product of catalog.products) {
    if (names.has(product.name)) {
      issues.push(`Duplicate product in catalog: ${product.name}`)
      continue
    }
    names.add(product.name)

    for (const field of requiredFields) {
      if ((product as Record<string, unknown>)[field] == null) {
        issues.push(`${product.name}: missing field ${field}`)
      }
    }

    if (product.exposure !== 'public' && product.exposure !== 'internal') {
      issues.push(`${product.name}: invalid exposure ${product.exposure}`)
    }

    const validCodePresence = ['full', 'partial', 'scaffold', 'none']
    if (!validCodePresence.includes(product.code_presence)) {
      issues.push(`${product.name}: invalid code_presence '${product.code_presence}' — must be one of ${validCodePresence.join(', ')}`)
    }

    const validEvidenceStatus = ['complete', 'partial', 'none']
    if (!validEvidenceStatus.includes(product.evidence_status)) {
      issues.push(`${product.name}: invalid evidence_status '${product.evidence_status}' — must be one of ${validEvidenceStatus.join(', ')}`)
    }

    if (typeof product.commercial_priority !== 'number' || product.commercial_priority < 1 || product.commercial_priority > 5) {
      issues.push(`${product.name}: commercial_priority must be a number between 1 and 5`)
    }

    if (!product.value_prop || product.value_prop.trim().length < 10) {
      issues.push(`${product.name}: value_prop must be a non-empty meaningful string`)
    }

    if (!product.docs_entrypoint || product.docs_entrypoint.trim().length === 0) {
      issues.push(`${product.name}: docs_entrypoint must be a non-empty path`)
    } else if (product.id && product.id === product.name) {
      // id must match name as the canonical slug
    }

    if (product.id !== product.name) {
      issues.push(`${product.name}: id must match name slug (id=${product.id})`)
    }

    if (!Array.isArray(product.internal_dependencies) || product.internal_dependencies.length === 0) {
      issues.push(`${product.name}: internal_dependencies must be a non-empty array`)
    }

    if (!Array.isArray(product.external_dependencies) || product.external_dependencies.length === 0) {
      issues.push(`${product.name}: external_dependencies must be a non-empty array`)
    }

    const claims = product.public_claim_permissions
    const claimKeys = [
      'can_claim_production_deployment',
      'can_claim_enterprise_ready',
      'can_claim_pilot_ready',
      'can_claim_audit_hardened',
    ]

    for (const key of claimKeys) {
      if (typeof claims[key] !== 'boolean') {
        issues.push(`${product.name}: public_claim_permissions missing boolean ${key}`)
      }
    }

    const registryTier = registryTiers.get(product.name)
    if (registryTier && registryTier !== product.product_tier) {
      issues.push(`${product.name}: product_tier mismatch (catalog=${product.product_tier}, registry=${registryTier})`)
    }

    const truthStatus = truth.apps[product.name]
    if (truthStatus && truthStatus !== product.deployment_status) {
      issues.push(`${product.name}: deployment_status mismatch (catalog=${product.deployment_status}, truth=${truthStatus})`)
    }

    const truthAppStatus = truth.app_status[product.name]
    if (truthAppStatus) {
      if (truthAppStatus.readiness_tier !== product.readiness_tier) {
        issues.push(`${product.name}: readiness_tier mismatch (catalog=${product.readiness_tier}, truth=${truthAppStatus.readiness_tier})`)
      }
      if (truthAppStatus.exposure !== product.exposure) {
        issues.push(`${product.name}: exposure mismatch (catalog=${product.exposure}, truth=${truthAppStatus.exposure})`)
      }
    }
  }

  for (const app of apps) {
    if (!names.has(app)) {
      issues.push(`App missing from catalog: ${app}`)
    }
  }

  for (const name of names) {
    if (!apps.includes(name)) {
      issues.push(`Catalog entry not present in apps/: ${name}`)
    }
  }

  if (issues.length > 0) {
    console.log('\n[validate:product-catalog] FAIL')
    for (const issue of issues) {
      console.log(` - ${issue}`)
    }
    process.exit(1)
  }

  console.log('\n[validate:product-catalog] PASS')
  console.log(`Validated ${catalog.products.length} catalog products against registry, truth manifest, and apps/`)
}

main()
