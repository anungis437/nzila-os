/**
 * @nzila/platform-lakehouse — Canadian Funding Radar
 *
 * Structured catalog of Canadian government and institutional funding programs
 * relevant to Nzila Ventures' portfolio. Each program includes eligibility
 * criteria, typical amounts, intake timing, and a Nzila-specific fit assessment.
 *
 * This is the machine-readable source of truth for:
 *   - Grant submission calendar
 *   - Deal-engine funding pipeline entries
 *   - AI grant writer assistant context
 *   - Executive funding radar dashboard
 */
import type { FundingProgram } from './types'

// ── Federal Programs ────────────────────────────────────────────────────────

const FEDERAL_PROGRAMS: FundingProgram[] = [
  {
    id: 'nrc-irap',
    name: 'NRC IRAP — Industrial Research Assistance Program',
    agency: 'National Research Council of Canada',
    government: 'federal',
    fundingType: 'non_repayable_contribution',
    description:
      'Flagship SME innovation program providing advisory services and funding for R&D and commercialization. ' +
      'Covers eligible labour costs, subcontractors, and some materials. ' +
      'Targets Canadian-controlled private corporations engaged in technological innovation.',
    typicalMinCad: 50_000,
    typicalMaxCad: 500_000,
    eligibilitySummary:
      'Canadian-controlled private corporation (CCPC), fewer than 500 employees, ' +
      'engaged in R&D or technology development with commercial potential.',
    nzilaFit:
      'Strong fit for Union Eyes AI grievance processing, FairCase workflow intelligence, ' +
      'Flow SMB AI features, and platform AI/ML infrastructure. ' +
      'Nzila qualifies as CCPC. R&D components of platform-reasoning-engine and ' +
      'platform-ai-governance are clearly eligible. Michel can lead the application ' +
      'with legal structuring of eligible activities.',
    url: 'https://nrc.canada.ca/en/support-technology-innovation/nrc-irap',
    relevantDomains: ['union-eyes', 'faircase', 'flow', 'platform'],
    isRecurring: true,
    intakeTiming: 'rolling — contact ITA (Industrial Technology Advisor) to initiate',
  },
  {
    id: 'sred',
    name: 'SR&ED — Scientific Research & Experimental Development Tax Incentive',
    agency: 'Canada Revenue Agency',
    government: 'federal',
    fundingType: 'tax_credit',
    description:
      'Federal tax incentive program for R&D performed in Canada. ' +
      'CCPCs receive a 35% refundable Investment Tax Credit (ITC) on first $3M of eligible expenditures. ' +
      'Non-refundable 15% ITC for other corporations. ' +
      'Covers salaries, materials, contractors, and overhead related to experimental development.',
    typicalMinCad: null,
    typicalMaxCad: null,
    eligibilitySummary:
      'Any corporation performing systematic investigation or search to advance scientific ' +
      'knowledge or achieve technological advancement. Must document work, uncertainty, and process.',
    nzilaFit:
      'Recurring annual lever. Nzila platform AI (reasoning engine, anomaly detection, ' +
      'governed AI, semantic search), Union Eyes claim intelligence, FairCase ' +
      'procedural AI, and Zonga recommendation engine all qualify. ' +
      'Michel can structure engineering time allocation and documentation to maximize claims. ' +
      'File annually — do not skip.',
    url: 'https://www.canada.ca/en/revenue-agency/services/scientific-research-experimental-development-tax-incentive-program.html',
    relevantDomains: ['union-eyes', 'faircase', 'flow', 'zonga', 'platform'],
    isRecurring: true,
    intakeTiming: 'annual — file with corporate tax return within 18 months of fiscal year end',
  },
  {
    id: 'canexport-sme',
    name: 'CanExport SMEs — International Market Development',
    agency: 'Trade Commissioner Service / Global Affairs Canada',
    government: 'federal',
    fundingType: 'non_repayable_contribution',
    description:
      'Supports Canadian SMEs pursuing international market development. ' +
      'Covers up to 75% of eligible export-related costs: market research, trade missions, ' +
      'certification, IP registration abroad, website localization, trade shows.',
    typicalMinCad: 20_000,
    typicalMaxCad: 99_999,
    eligibilitySummary:
      'Canadian SME, minimum $100K in annual revenue, seeking to expand into new export markets.',
    nzilaFit:
      'Applicable as Zonga expands to US, UK, Caribbean, and African diaspora markets. ' +
      'Also relevant if Union Eyes pursues US or UK labour market entry. ' +
      'Michel can structure market entry plans per export market for higher allocations.',
    url: 'https://www.tradecommissioner.gc.ca/funding-financement/canexport/sme-pme/index.aspx',
    relevantDomains: ['zonga', 'union-eyes', 'flow'],
    isRecurring: true,
    intakeTiming: 'rolling — apply before incurring costs',
  },
  {
    id: 'feddev-ontario-tis',
    name: 'FedDev Ontario — Technology and Innovation Support',
    agency: 'Federal Economic Development Agency for Southern Ontario',
    government: 'federal',
    fundingType: 'repayable_contribution',
    description:
      'Supports southern Ontario businesses developing and commercializing innovative technologies. ' +
      'Covers R&D, commercialization, talent, and export activities for tech SMEs.',
    typicalMinCad: 250_000,
    typicalMaxCad: 5_000_000,
    eligibilitySummary:
      'Southern Ontario business, incorporated, developing/commercializing technology, ' +
      'demonstrating growth potential and job creation.',
    nzilaFit:
      'Nzila is Ontario-based. Commercialization of Union Eyes, Flow, and platform stack ' +
      'aligns well. Repayable, but low-interest and patient. ' +
      'Best pursued once revenue baseline is established (Series A equivalent readiness).',
    url: 'https://sbs-spe.feddevontario.canada.ca/en/technology-and-innovation-financial-support',
    relevantDomains: ['union-eyes', 'flow', 'faircase', 'platform'],
    isRecurring: true,
    intakeTiming: 'rolling — submit expression of interest first',
  },
  {
    id: 'strategic-innovation-fund',
    name: 'Strategic Innovation Fund (SIF)',
    agency: 'Innovation, Science and Economic Development Canada (ISED)',
    government: 'federal',
    fundingType: 'repayable_contribution',
    description:
      'Large-scale federal fund for transformative innovation, R&D, talent, and clean economy projects. ' +
      'Multi-year, significant capital. Suited for scale-up or large collaboration projects.',
    typicalMinCad: 10_000_000,
    typicalMaxCad: null,
    eligibilitySummary:
      'No minimum revenue threshold, but projects typically $10M+. ' +
      'Must demonstrate significant economic and innovation impact, job creation, and Canadian benefit.',
    nzilaFit:
      'Longer-term target (3-5 year horizon) once platform revenue and team reach scale. ' +
      'Could be compelling for a Nzila "National Labour Intelligence Platform" framing ' +
      'combining Union Eyes, FairCase, and data partnerships with unions at national scale.',
    url: 'https://ised-isde.canada.ca/site/strategic-innovation-fund/en',
    relevantDomains: ['union-eyes', 'faircase', 'platform'],
    isRecurring: true,
    intakeTiming: 'rolling — requires extensive pre-application engagement with ISED',
  },
]

// ── Ontario Programs ────────────────────────────────────────────────────────

const ONTARIO_PROGRAMS: FundingProgram[] = [
  {
    id: 'oci-starter-company',
    name: 'Ontario Centre of Innovation (OCI) — Commercialization Programs',
    agency: 'Ontario Centre of Innovation',
    government: 'ontario',
    fundingType: 'non_repayable_contribution',
    description:
      'Suite of Ontario programs supporting technology commercialization including Market Readiness, ' +
      'Global Scaleup, and sector-specific funds. Matches industry funding to Ontario innovators.',
    typicalMinCad: 50_000,
    typicalMaxCad: 500_000,
    eligibilitySummary:
      'Ontario-based company commercializing innovative technology. ' +
      'Most programs require industry co-investment match.',
    nzilaFit:
      'Relevant for Flow, Union Eyes, and FairCase commercialization phases. ' +
      'OCI sector programs in digital economy and future of work align with Nzila portfolio. ' +
      'Michel should review current open calls at oc-innovation.ca/programs.',
    url: 'https://www.oc-innovation.ca/programs/',
    relevantDomains: ['flow', 'union-eyes', 'faircase', 'platform'],
    isRecurring: true,
    intakeTiming: 'intake windows vary by program — check portal quarterly',
  },
  {
    id: 'ontario-transfer-payment',
    name: 'Transfer Payment Ontario — Provincial Funding Portal',
    agency: 'Government of Ontario — Various Ministries',
    government: 'ontario',
    fundingType: 'grant',
    description:
      'Ontario government portal aggregating available funding opportunities from all provincial ministries. ' +
      'Covers labour, culture, digital, health, justice, and economic development streams.',
    typicalMinCad: null,
    typicalMaxCad: null,
    eligibilitySummary:
      'Varies by program. Ontario entities with relevant program alignment.',
    nzilaFit:
      'Must monitor quarterly. Relevant programs include: Ministry of Labour (workforce modernization), ' +
      'Ministry of Culture (Zonga/cultural platforms), Ministry of the Attorney General (FairCase/access to justice).',
    url: 'https://www.ontario.ca/page/available-funding-opportunities-ontario-government',
    relevantDomains: ['union-eyes', 'faircase', 'zonga', 'flow', 'platform'],
    isRecurring: true,
    intakeTiming: 'rolling — review portal monthly',
  },
  {
    id: 'ontario-cultural-media-fund',
    name: 'Ontario Creates — Ontario Media Development Corporation',
    agency: 'Ontario Creates / OMDC',
    government: 'ontario',
    fundingType: 'grant',
    description:
      'Ontario funding for digital media, music, film, publishing, and book sectors. ' +
      'Export, interactive digital media, music industry, and market development programs.',
    typicalMinCad: 10_000,
    typicalMaxCad: 200_000,
    eligibilitySummary:
      'Ontario-based companies in eligible cultural/media industries. Interactive digital media ' +
      'program specifically for digital products with cultural content.',
    nzilaFit:
      'Zonga qualifies for interactive digital media (music platform), music industry development, ' +
      'and export programs. Strong fit given Zonga\'s diaspora-focused cultural mission.',
    url: 'https://ontariocreates.ca/our-programs',
    relevantDomains: ['zonga'],
    isRecurring: true,
    intakeTiming: 'annual programs — review intake schedule in Q1',
  },
]

// ── Arts & Culture Federal Programs ─────────────────────────────────────────

const ARTS_CULTURE_FEDERAL: FundingProgram[] = [
  {
    id: 'factor-music',
    name: 'FACTOR — Foundation Assisting Canadian Talent on Recordings',
    agency: 'FACTOR (via Canadian Heritage)',
    government: 'federal',
    fundingType: 'non_repayable_contribution',
    description:
      'Primary federal music industry funding body. Programs cover recordings, touring, marketing, ' +
      'digital distribution, and emerging artists. Funded by Canadian Heritage and radio broadcasters.',
    typicalMinCad: 5_000,
    typicalMaxCad: 300_000,
    eligibilitySummary:
      'Canadian citizen or permanent resident artists and music industry companies. ' +
      'Various program tiers by career stage.',
    nzilaFit:
      'Zonga can apply as a music technology and promotion platform, and can facilitate ' +
      'FACTOR applications for creators on the platform — a key differentiator vs. Spotify/Apple. ' +
      'Also enables Zonga to become the grant-assisted distribution layer for diaspora artists.',
    url: 'https://www.factor.ca/programs/',
    relevantDomains: ['zonga'],
    isRecurring: true,
    intakeTiming: 'multiple intake periods per year — typically 3-4 windows annually',
  },
  {
    id: 'canada-council-digital',
    name: 'Canada Council for the Arts — Digital Strategy Fund',
    agency: 'Canada Council for the Arts',
    government: 'federal',
    fundingType: 'non_repayable_contribution',
    description:
      'Supports arts organizations using digital technology to innovate. ' +
      'Covers digital creation, distribution, audience engagement, and organizational transformation.',
    typicalMinCad: 25_000,
    typicalMaxCad: 250_000,
    eligibilitySummary:
      'Arts organizations and collectives. For-profit eligibility varies by stream.',
    nzilaFit:
      'Explore partnership/consortium model with a registered arts org to co-apply for Zonga ' +
      'digital distribution infrastructure. Also potential for Union Eyes cultural worker ' +
      'member service programs.',
    url: 'https://canadacouncil.ca/funding',
    relevantDomains: ['zonga', 'union-eyes'],
    isRecurring: true,
    intakeTiming: 'rolling and intake windows depending on stream',
  },
]

// ── Master Funding Radar ─────────────────────────────────────────────────────

export const CANADIAN_FUNDING_PROGRAMS: readonly FundingProgram[] = [
  ...FEDERAL_PROGRAMS,
  ...ONTARIO_PROGRAMS,
  ...ARTS_CULTURE_FEDERAL,
]

// ── Query Helpers ────────────────────────────────────────────────────────────

/**
 * Get funding programs relevant to a specific Nzila product domain.
 */
export function getFundingForDomain(
  domain: FundingProgram['relevantDomains'][number],
): FundingProgram[] {
  return CANADIAN_FUNDING_PROGRAMS.filter((p) => p.relevantDomains.includes(domain))
}

/**
 * Get all programs by funding type.
 */
export function getFundingByType(type: FundingProgram['fundingType']): FundingProgram[] {
  return CANADIAN_FUNDING_PROGRAMS.filter((p) => p.fundingType === type)
}

/**
 * Get rolling / always-open programs (highest immediate priority).
 */
export function getRollingPrograms(): FundingProgram[] {
  return CANADIAN_FUNDING_PROGRAMS.filter(
    (p) => p.isRecurring && p.intakeTiming.toLowerCase().startsWith('rolling'),
  )
}

/**
 * Get programs within a specific CAD budget range.
 */
export function getFundingByBudget(
  minCad: number,
  maxCad: number,
): FundingProgram[] {
  return CANADIAN_FUNDING_PROGRAMS.filter((p) => {
    const min = p.typicalMinCad ?? 0
    const max = p.typicalMaxCad ?? Infinity
    return min <= maxCad && max >= minCad
  })
}
