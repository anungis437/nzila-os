export const MARKETING_FACTS = {
  productPlatforms: 15,
  governedApplications: 17,
  verticalsLabel: '10+',
  flagshipPlatforms: 4,
  totalTamLabel: '$100B+',
  backboneName: 'Nzila OS',
} as const

export function platformCoverageLabel(): string {
  return `${MARKETING_FACTS.productPlatforms} continuity product lines across ${MARKETING_FACTS.verticalsLabel} trust-sensitive sectors`
}

export function governedCoverageLabel(): string {
  return `supported by ${MARKETING_FACTS.governedApplications} governed operational applications`
}

export function portfolioHeadlineLabel(): string {
  return `${MARKETING_FACTS.productPlatforms} / ${MARKETING_FACTS.governedApplications}`
}
