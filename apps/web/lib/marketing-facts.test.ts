import { describe, expect, it } from 'vitest'
import {
  MARKETING_FACTS,
  governedCoverageLabel,
  platformCoverageLabel,
  portfolioHeadlineLabel,
} from './marketing-facts'

describe('marketing-facts', () => {
  it('keeps product and governed app counts coherent', () => {
    expect(MARKETING_FACTS.productPlatforms).toBeGreaterThan(0)
    expect(MARKETING_FACTS.governedApplications).toBeGreaterThanOrEqual(MARKETING_FACTS.productPlatforms)
  })

  it('renders copy-safe labels from one source of truth', () => {
    expect(platformCoverageLabel()).toContain(String(MARKETING_FACTS.productPlatforms))
    expect(governedCoverageLabel()).toContain(String(MARKETING_FACTS.governedApplications))
    expect(portfolioHeadlineLabel()).toBe(
      `${MARKETING_FACTS.productPlatforms} / ${MARKETING_FACTS.governedApplications}`,
    )
  })
})
