/**
 * Truth Classification Schema
 *
 * Every commercial metric in governance/portfolio/product-catalog.json
 * must carry one of these classifications so buyers, investors, and
 * operators know the epistemic status of each number.
 *
 * Canonical authority: governance/portfolio/product-catalog.json
 * Enforced by: tooling/contract-tests/metric-classification.test.ts
 */

/**
 * Classification of a specific metric value.
 *
 * | Class       | Meaning                                                          |
 * |-------------|------------------------------------------------------------------|
 * | actual      | Verified from invoices, bank statements, or signed contracts.    |
 * | estimated   | Derived from known proxies, conversations, or comparable data.   |
 * | forecast    | Forward projection modelled from estimated or actual inputs.     |
 * | scenario    | Planning assumption — represents one possible path, not a claim. |
 * | placeholder | Value held for schema completeness; treat as zero / unknown.     |
 */
export type MetricClassification =
  | 'actual'
  | 'estimated'
  | 'forecast'
  | 'scenario'
  | 'placeholder'

/**
 * Per-product metric classification block.
 *
 * Required for all Tier 1 and Tier 2 products.
 * At minimum must cover: monthly_revenue, pipeline_value.
 * All other commercial metrics are recommended.
 */
export interface ProductMetricClassifications {
  monthly_revenue: MetricClassification
  annual_recurring_revenue: MetricClassification
  pipeline_value: MetricClassification
  expected_12m_revenue: MetricClassification
  monthly_burn: MetricClassification
  gross_margin_pct: MetricClassification
  avg_deal_size: MetricClassification
  close_rate_pct: MetricClassification
  probability_of_close: MetricClassification
  [key: string]: MetricClassification
}

/** Minimum required keys that all Tier 1/2 products must classify */
export const REQUIRED_CLASSIFICATION_KEYS: (keyof ProductMetricClassifications)[] = [
  'monthly_revenue',
  'pipeline_value',
]
