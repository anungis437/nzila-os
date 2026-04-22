/**
 * Metric Classification Contract
 *
 * Enforces that every Tier 1 and Tier 2 product in
 * governance/portfolio/product-catalog.json carries explicit
 * truth classifications on its key commercial metrics.
 *
 * This prevents unclassified numbers from reaching buyers or investors
 * without a declared epistemic status (actual / estimated / forecast /
 * scenario / placeholder).
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { ROOT, relPath } from './governance-helpers'
import { readJsonFile } from './hardening-helpers'
import type { MetricClassification } from '../../tooling/truth/metric-schema'
import { REQUIRED_CLASSIFICATION_KEYS } from '../../tooling/truth/metric-schema'

type AllowedClassification = MetricClassification

const ALLOWED_CLASSIFICATIONS: AllowedClassification[] = [
  'actual',
  'estimated',
  'forecast',
  'scenario',
  'placeholder',
]

interface ProductCatalog {
  products: Array<{
    id: string
    tier: number
    data_quality?: string
    metric_classifications?: Record<string, string>
  }>
}

const COMMERCIAL_TIERS = [1, 2] as const

describe('Metric classification contract', () => {
  const catalogPath = join(ROOT, 'governance', 'portfolio', 'product-catalog.json')
  const catalog = readJsonFile<ProductCatalog>(catalogPath)
  const commercialProducts = catalog.products.filter((p) => COMMERCIAL_TIERS.includes(p.tier as 1 | 2))

  it('all Tier 1/2 products declare metric_classifications', () => {
    const missing = commercialProducts
      .filter((p) => !p.metric_classifications || Object.keys(p.metric_classifications).length === 0)
      .map((p) => `${p.id} (Tier ${p.tier})`)

    expect(missing, `Missing metric_classifications on: ${missing.join(', ')}`).toEqual([])
  })

  it('all Tier 1/2 products classify the minimum required keys', () => {
    const violations: string[] = []

    for (const product of commercialProducts) {
      const missing = REQUIRED_CLASSIFICATION_KEYS.filter(
        (key) => !product.metric_classifications?.[key as string],
      )
      if (missing.length > 0) {
        violations.push(`${product.id}: missing ${missing.join(', ')}`)
      }
    }

    expect(violations, `Required metric keys not classified:\n${violations.join('\n')}`).toEqual([])
  })

  it('all classification values are valid enum members', () => {
    const violations: string[] = []

    for (const product of commercialProducts) {
      if (!product.metric_classifications) continue
      for (const [key, value] of Object.entries(product.metric_classifications)) {
        if (!ALLOWED_CLASSIFICATIONS.includes(value as AllowedClassification)) {
          violations.push(
            `${product.id}.metric_classifications.${key}: "${value}" is not a valid MetricClassification`,
          )
        }
      }
    }

    expect(violations, `Invalid classification values:\n${violations.join('\n')}`).toEqual([])
  })
})
