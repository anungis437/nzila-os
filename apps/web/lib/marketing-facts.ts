export const MARKETING_FACTS = {
  productPlatforms: 15,
  governedApplications: 17,
  verticalsLabel: '10+',
  flagshipPlatforms: 4,
  totalTamLabel: '$100B+',
  backboneName: 'Nzila Backbone',
} as const

export function platformCoverageLabel(): string {
  return `${MARKETING_FACTS.productPlatforms} product platforms across ${MARKETING_FACTS.verticalsLabel} verticals`
}

export function governedCoverageLabel(): string {
  return `delivered through ${MARKETING_FACTS.governedApplications} governed applications`
}

export function portfolioHeadlineLabel(): string {
  return `${MARKETING_FACTS.productPlatforms} / ${MARKETING_FACTS.governedApplications}`
}
