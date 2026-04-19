import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  buildGeneratedArtifacts,
  detectArtifactDrift,
  loadPortfolioContext,
  type PortfolioCatalog,
  validateCatalogData,
} from '../scripts/lib/portfolio-governance'

const tempRoots: string[] = []

function makeCatalog(products: PortfolioCatalog['products']): PortfolioCatalog {
  return {
    schema_version: '2026-04-18.0',
    authority: {
      editable_source: 'governance/portfolio/product-catalog.json',
      generated_by: 'scripts/generate-portfolio-artifacts.ts',
      generated_artifacts: [],
    },
    scoring: {
      weights: {
        revenue: 0.2,
        traction: 0.2,
        strategic_fit: 0.2,
        maintenance_burden: 0.1,
        readiness: 0.2,
        margin_potential: 0.1,
      },
    },
    products,
  }
}

function seedRepo(catalog: PortfolioCatalog): string {
  const root = mkdtempSync(join(tmpdir(), 'nzila-portfolio-'))
  tempRoots.push(root)

  mkdirSync(join(root, 'governance', 'portfolio'), { recursive: true })
  mkdirSync(join(root, 'apps', 'alpha'), { recursive: true })
  mkdirSync(join(root, 'apps', 'beta'), { recursive: true })

  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n')
  writeFileSync(join(root, 'governance', 'portfolio', 'product-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)
  writeFileSync(join(root, 'apps', 'alpha', 'package.json'), '{"name":"alpha","scripts":{"dev":"next dev --port 3100"}}\n')
  writeFileSync(join(root, 'apps', 'beta', 'package.json'), '{"name":"beta","scripts":{"dev":"next dev --port 3101"}}\n')
  writeFileSync(join(root, 'apps', 'alpha', 'maturity.json'), '{"status":"pilot","exposure":"internal","data_integrity":"partial","contracts_complete":false,"observability":"partial","last_validated":"2026-04-18"}\n')
  writeFileSync(join(root, 'apps', 'beta', 'maturity.json'), '{"status":"internal","exposure":"internal","data_integrity":"partial","contracts_complete":false,"observability":"partial","last_validated":"2026-04-18"}\n')
  writeFileSync(join(root, 'apps', 'alpha', 'catalog-info.yaml'), 'apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: alpha\nspec:\n  type: service\n  lifecycle: pilot\n')

  return root
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('portfolio governance', () => {
  it('fails when required canonical fields are missing', () => {
    const result = validateCatalogData(makeCatalog([
      {
        id: 'alpha',
        name: 'Alpha',
        tier: 1,
        status: 'pilot',
        deployment: 'internal',
        gtm_posture: 'sell-now',
        revenue_status: 'pilot-contracting',
        customers: 0,
        pilots: 1,
        proof_level: 'pilot-proof',
        owner: '',
        priority: 'high',
        strategic_role: '',
        last_reviewed: '2026-04-18',
      },
    ]), ['alpha'])

    expect(result.errors).toContain('alpha: missing owner')
    expect(result.errors).toContain('alpha: missing strategic_role')
  })

  it('fails when scoring weights do not sum to 1.0', () => {
    const catalog = makeCatalog([])
    catalog.scoring.weights.readiness = 0.25
    const result = validateCatalogData(catalog, [])

    expect(result.errors).toContain('Catalog scoring.weights must sum to 1.0 (received 1.05)')
  })

  it('fails impossible tier and GTM combinations', () => {
    const result = validateCatalogData(makeCatalog([
      {
        id: 'alpha',
        name: 'Alpha',
        tier: 1,
        status: 'pilot',
        deployment: 'internal',
        gtm_posture: 'hold',
        revenue_status: 'pre-revenue',
        customers: 0,
        pilots: 0,
        proof_level: 'none',
        owner: 'Nzila Ventures',
        priority: 'medium',
        strategic_role: 'Test product',
        last_reviewed: '2026-04-18',
      },
      {
        id: 'beta',
        name: 'Beta',
        tier: 5,
        status: 'production',
        deployment: 'external',
        gtm_posture: 'sell-now',
        revenue_status: 'revenue-active',
        customers: 1,
        pilots: 0,
        proof_level: 'market-proof',
        owner: 'Nzila Ventures',
        priority: 'low',
        strategic_role: 'Legacy product',
        last_reviewed: '2026-04-18',
      },
    ]), ['alpha', 'beta'])

    expect(result.errors).toContain('alpha: tier 1 products must use gtm_posture=sell-now')
    expect(result.errors).toContain('beta: tier 5 products must be frozen or sunset')
  })

  it('fails when generated artifacts are stale', () => {
    const root = seedRepo(makeCatalog([
      {
        id: 'alpha',
        name: 'Alpha',
        tier: 1,
        status: 'pilot',
        deployment: 'internal',
        gtm_posture: 'sell-now',
        revenue_status: 'pilot-contracting',
        customers: 0,
        pilots: 1,
        proof_level: 'pilot-proof',
        owner: 'Nzila Ventures',
        priority: 'high',
        strategic_role: 'Revenue wedge',
        last_reviewed: '2026-04-18',
      },
      {
        id: 'beta',
        name: 'Beta',
        tier: 3,
        status: 'internal',
        deployment: 'internal',
        gtm_posture: 'internal-only',
        revenue_status: 'internal-cost-center',
        customers: 0,
        pilots: 0,
        proof_level: 'internal-proof',
        owner: 'Nzila Ventures',
        priority: 'medium',
        strategic_role: 'Internal control surface',
        last_reviewed: '2026-04-18',
      },
    ]))

    const artifacts = buildGeneratedArtifacts(loadPortfolioContext(root))
    const target = artifacts.find((artifact) => artifact.path === 'reports/portfolio-status.json')
    expect(target).toBeDefined()
    mkdirSync(join(root, 'reports'), { recursive: true })
    writeFileSync(join(root, 'reports', 'portfolio-status.json'), '{"stale":true}\n')

    expect(detectArtifactDrift(root, artifacts)).toContain('reports/portfolio-status.json')
  })

  it('produces stable generated artifacts from the same canonical catalog', () => {
    const root = seedRepo(makeCatalog([
      {
        id: 'alpha',
        name: 'Alpha',
        tier: 1,
        status: 'pilot',
        deployment: 'internal',
        gtm_posture: 'sell-now',
        revenue_status: 'pilot-contracting',
        customers: 0,
        pilots: 1,
        proof_level: 'pilot-proof',
        owner: 'Nzila Ventures',
        priority: 'high',
        strategic_role: 'Revenue wedge',
        last_reviewed: '2026-04-18',
      },
      {
        id: 'beta',
        name: 'Beta',
        tier: 3,
        status: 'internal',
        deployment: 'internal',
        gtm_posture: 'internal-only',
        revenue_status: 'internal-cost-center',
        customers: 0,
        pilots: 0,
        proof_level: 'internal-proof',
        owner: 'Nzila Ventures',
        priority: 'medium',
        strategic_role: 'Internal control surface',
        last_reviewed: '2026-04-18',
      },
    ]))

    const first = buildGeneratedArtifacts(loadPortfolioContext(root))
    const second = buildGeneratedArtifacts(loadPortfolioContext(root))

    expect(second).toEqual(first)
  })
})
