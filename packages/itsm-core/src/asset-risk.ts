/**
 * @nzila/itsm-core — Asset risk scorer
 *
 * Computes a 0–100 risk score for CMDB assets based on:
 *   - Warranty status
 *   - Lifecycle state
 *   - Staleness (age since purchase)
 *
 * Pure functions only — no I/O.
 */

export interface AssetRiskFactors {
  /** ISO date string or null */
  warrantyExpiry: string | null | undefined
  lifecycle: string
  /** ISO date string or null */
  purchaseDate: string | null | undefined
  /** Number of open incidents linked to this asset */
  openIncidentCount?: number
  /** Risk scores from vulnerability scan (0-100), if available */
  vulnerabilityScore?: number
}

/**
 * Compute a risk score (0-100) for an asset.
 * Higher = more risk.
 */
export function computeAssetRiskScore(
  factors: AssetRiskFactors,
  now: Date = new Date(),
): number {
  let score = 0

  // Lifecycle penalty
  if (factors.lifecycle === 'retired' || factors.lifecycle === 'disposed') {
    score += 40
  } else if (factors.lifecycle === 'under_repair') {
    score += 20
  }

  // Warranty status
  if (factors.warrantyExpiry) {
    const expiry = new Date(factors.warrantyExpiry)
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / 86_400_000
    if (daysUntilExpiry < 0) {
      score += 20 // expired
    } else if (daysUntilExpiry < 90) {
      score += 10 // expiring soon
    }
  } else {
    score += 5 // unknown warranty
  }

  // Age penalty (assets older than 4 years)
  if (factors.purchaseDate) {
    const purchase = new Date(factors.purchaseDate)
    const ageYears = (now.getTime() - purchase.getTime()) / (365.25 * 86_400_000)
    if (ageYears > 6) score += 20
    else if (ageYears > 4) score += 10
  }

  // Open incidents
  if (factors.openIncidentCount) {
    score += Math.min(factors.openIncidentCount * 5, 20)
  }

  // Vulnerability score (already 0-100, scale to 0-30 contribution)
  if (factors.vulnerabilityScore !== undefined) {
    score += Math.round((factors.vulnerabilityScore / 100) * 30)
  }

  return Math.min(score, 100)
}
