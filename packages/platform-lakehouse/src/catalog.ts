/**
 * @nzila/platform-lakehouse — Public Data Source Catalog
 *
 * Canonical catalog of external data sources Nzila should ingest.
 * Covers Canadian open government, procurement, labour, legal, corporate,
 * and cultural datasets as identified in the Nzila Knowledge Lakehouse strategy.
 *
 * Sources are organized by category and tagged to the Nzila product domains
 * they enable intelligence for.
 */
import type { DataSourceDescriptor } from './types'

// ── Open Government ─────────────────────────────────────────────────────────

const OPEN_GOVERNMENT_SOURCES: DataSourceDescriptor[] = [
  {
    id: 'ca-open-gov-grants',
    name: 'Canada Open Government — Grants & Contributions',
    description:
      'Federal grants and contributions awarded by Government of Canada departments. Includes recipient, amount, purpose, fiscal year.',
    category: 'open_government',
    format: 'api',
    cadence: 'monthly',
    url: 'https://search.open.canada.ca/grants/',
    licenseNote: 'Open Government Licence – Canada',
    relevantDomains: ['union-eyes', 'flow', 'zonga', 'faircase', 'platform'],
    intelligenceUse: [
      'identify which competitors received grants',
      'benchmark grant amounts by sector',
      'map government funding flow to labour / cultural / tech sectors',
    ],
    requiresAuth: false,
    isPublic: true,
  },
  {
    id: 'ca-open-gov-contracts',
    name: 'Canada Open Government — Proactive Disclosure (Contracts > $10K)',
    description:
      'Federal government contracts over $10,000 disclosed proactively. Identifies procurement winners, vendors, scopes, amounts.',
    category: 'procurement',
    format: 'csv',
    cadence: 'quarterly',
    url: 'https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b',
    licenseNote: 'Open Government Licence – Canada',
    relevantDomains: ['flow', 'platform', 'faircase'],
    intelligenceUse: [
      'identify procurement winners in tech/software space',
      'track government spend on HR, labour, case management tools',
      'calibrate Nzila pricing and proposal strategy',
    ],
    requiresAuth: false,
    isPublic: true,
  },
  {
    id: 'ca-open-gov-datasets',
    name: 'Canada Open Government — Datasets Portal',
    description:
      'General federal open data portal covering demographics, industries, employment, geography, and sector statistics.',
    category: 'open_government',
    format: 'api',
    cadence: 'monthly',
    url: 'https://open.canada.ca/data/en/dataset',
    licenseNote: 'Open Government Licence – Canada',
    relevantDomains: ['union-eyes', 'flow', 'zonga', 'faircase', 'agrimo', 'mobility', 'platform'],
    intelligenceUse: [
      'demographic segmentation',
      'industry employment benchmarks',
      'regional market sizing',
    ],
    requiresAuth: false,
    isPublic: true,
  },
]

// ── Procurement ─────────────────────────────────────────────────────────────

const PROCUREMENT_SOURCES: DataSourceDescriptor[] = [
  {
    id: 'buyandsell-gc-ca',
    name: 'Canada Buyandsell.gc.ca — Federal Tender Feed',
    description:
      'Real-time federal government tender and procurement opportunities. Includes RFPs, RFQs, SOIs across all departments.',
    category: 'procurement',
    format: 'api',
    cadence: 'daily',
    url: 'https://buyandsell.gc.ca/procurement-data/tender-notice',
    licenseNote: 'Open Government Licence – Canada',
    relevantDomains: ['flow', 'platform', 'faircase', 'union-eyes'],
    intelligenceUse: [
      'procurement scanner — identify tenders matching Nzila product capability',
      'alert on upcoming RFPs in legaltech, labourtech, casetech',
      'build proposal pipeline',
    ],
    requiresAuth: false,
    isPublic: true,
  },
  {
    id: 'ontario-gets',
    name: 'Ontario Government — GETS Tender Feed',
    description:
      'Ontario provincial government procurement opportunities via Government Electronic Tendering Service.',
    category: 'procurement',
    format: 'rss',
    cadence: 'daily',
    url: 'https://www.ontario.ca/page/get-bids-and-proposals',
    licenseNote: 'Open Government Licence – Ontario',
    relevantDomains: ['flow', 'platform', 'faircase', 'union-eyes'],
    intelligenceUse: [
      'provincial procurement pipeline',
      'identify union/labour service tenders',
    ],
    requiresAuth: false,
    isPublic: true,
  },
]

// ── Labour ──────────────────────────────────────────────────────────────────

const LABOUR_SOURCES: DataSourceDescriptor[] = [
  {
    id: 'esdc-labour-standards',
    name: 'ESDC — Labour Program Open Data',
    description:
      'Employment and Social Development Canada (ESDC) labour program datasets. Covers compliance, workplace standards, work stoppages, occupational health.',
    category: 'labour',
    format: 'csv',
    cadence: 'quarterly',
    url: 'https://www.canada.ca/en/employment-social-development/services/labour/labour-program/open-data.html',
    licenseNote: 'Open Government Licence – Canada',
    relevantDomains: ['union-eyes', 'faircase'],
    intelligenceUse: [
      'workplace dispute benchmarks by sector',
      'grievance frequency trends',
      'compliance gap analysis for Union Eyes prospects',
    ],
    requiresAuth: false,
    isPublic: true,
  },
  {
    id: 'canlii-arbitration',
    name: 'CanLII — Labour Arbitration Decisions',
    description:
      'Canadian Legal Information Institute database of publicly available labour arbitration decisions. Covers grievances, discipline, collective agreement interpretation.',
    category: 'labour',
    format: 'html',
    cadence: 'weekly',
    url: 'https://www.canlii.org/en/#search/type=decision&text=labour+arbitration',
    licenseNote: 'CanLII Terms of Use — non-commercial research use permitted',
    relevantDomains: ['union-eyes', 'faircase'],
    intelligenceUse: [
      'grievance outcome benchmarks',
      'clause interpretation clustering',
      'employer trend analysis (repeat offenders)',
      'AI training corpus for FairCase decision-assist',
    ],
    requiresAuth: false,
    isPublic: true,
  },
  {
    id: 'esdc-collective-agreements',
    name: 'ESDC — Collective Agreement Database',
    description:
      'Federal and provincial collective bargaining agreements filed with ESDC. Covers wages, benefits, hours, grievance procedures.',
    category: 'labour',
    format: 'pdf',
    cadence: 'monthly',
    url: 'https://www.canada.ca/en/employment-social-development/services/collective-bargaining-data/agreements.html',
    licenseNote: 'Open Government Licence – Canada',
    relevantDomains: ['union-eyes'],
    intelligenceUse: [
      'CBA clause extraction and benchmarking',
      'wage trend analysis',
      'grievance procedure pattern analysis',
    ],
    requiresAuth: false,
    isPublic: true,
  },
]

// ── Legal ───────────────────────────────────────────────────────────────────

const LEGAL_SOURCES: DataSourceDescriptor[] = [
  {
    id: 'a2aj-canadian-legal-corpus',
    name: 'A2AJ Canadian Legal Data — Open-Source Legal Corpus',
    description:
      'Open-source alternative to CanLII for computational law. Structured Canadian legal decisions for AI training and legal analytics.',
    category: 'legal',
    format: 'parquet',
    cadence: 'quarterly',
    url: 'https://arxiv.org/abs/2509.13032',
    licenseNote: 'Open access academic corpus — see publication terms',
    relevantDomains: ['faircase', 'union-eyes'],
    intelligenceUse: [
      'AI training for FairCase decision-assist',
      'legal clause extractor model training',
      'case duration benchmarks',
      'issue clustering from jurisprudence',
    ],
    requiresAuth: false,
    isPublic: true,
  },
  {
    id: 'justice-canada-consolidated-acts',
    name: 'Justice Canada — Consolidated Acts & Regulations',
    description:
      'Full text of federal statutes and regulations. Employment standards, human rights, labour relations, privacy law.',
    category: 'legal',
    format: 'html',
    cadence: 'monthly',
    url: 'https://laws-lois.justice.gc.ca/eng/acts/',
    licenseNote: 'Justice Laws Website — reproduction permitted with attribution',
    relevantDomains: ['faircase', 'union-eyes', 'mobility'],
    intelligenceUse: [
      'regulatory compliance checking',
      'employment law context injection for AI',
      'jurisdiction-specific compliance module training',
    ],
    requiresAuth: false,
    isPublic: true,
  },
]

// ── Corporate ───────────────────────────────────────────────────────────────

const CORPORATE_SOURCES: DataSourceDescriptor[] = [
  {
    id: 'ised-corporations-canada',
    name: 'ISED — Corporations Canada Registry',
    description:
      'Federal corporation search and registration data. Includes incorporations, directors, filings, status.',
    category: 'corporate',
    format: 'api',
    cadence: 'on_demand',
    url: 'https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/fdrlCrpSrch.html',
    licenseNote: 'Open Government Licence – Canada',
    relevantDomains: ['flow', 'faircase', 'platform'],
    intelligenceUse: [
      'prospect research and enrichment',
      'corporate due diligence for deal-engine',
      'partner onboarding validation',
    ],
    requiresAuth: false,
    isPublic: true,
  },
  {
    id: 'ised-innovation-funding-history',
    name: 'ISED — Innovation Funding Recipients',
    description:
      'History of federally funded innovation projects through ISED programs. Identifies funded companies, amounts, sectors.',
    category: 'open_government',
    format: 'csv',
    cadence: 'quarterly',
    url: 'https://www.ic.gc.ca/eic/site/093.nsf/eng/home',
    licenseNote: 'Open Government Licence – Canada',
    relevantDomains: ['platform', 'flow', 'union-eyes'],
    intelligenceUse: [
      'competitive intelligence on funded peers',
      'benchmark grant success by sector/stage',
      'identify co-applicant or partner candidates',
    ],
    requiresAuth: false,
    isPublic: true,
  },
]

// ── Cultural ────────────────────────────────────────────────────────────────

const CULTURAL_SOURCES: DataSourceDescriptor[] = [
  {
    id: 'factor-funding-history',
    name: 'FACTOR — Music Funding Recipients',
    description:
      'Foundation Assisting Canadian Talent on Recordings (FACTOR) grant recipient history. Music projects, artists, funding amounts.',
    category: 'cultural',
    format: 'html',
    cadence: 'quarterly',
    url: 'https://www.factor.ca/programs/',
    licenseNote: 'Public disclosure — see FACTOR terms',
    relevantDomains: ['zonga'],
    intelligenceUse: [
      'identify Canadian artists active in funding ecosystem',
      'map music sector investment trends',
      'prospect pipeline for Zonga creator outreach',
    ],
    requiresAuth: false,
    isPublic: true,
  },
  {
    id: 'canada-council-arts-grants',
    name: 'Canada Council for the Arts — Grants Database',
    description:
      'Cultural grants awarded by Canada Council across disciplines including music, digital arts, indigenous arts.',
    category: 'cultural',
    format: 'api',
    cadence: 'quarterly',
    url: 'https://canadacouncil.ca/funding',
    licenseNote: 'Open Government Licence – Canada',
    relevantDomains: ['zonga'],
    intelligenceUse: [
      'music and digital arts funding benchmarks',
      'creator economy investment intelligence',
      'Zonga grant eligibility research',
    ],
    requiresAuth: false,
    isPublic: true,
  },
  {
    id: 'statistics-canada-cultural',
    name: 'Statistics Canada — Culture and Creative Economy Data',
    description:
      'StatsCan datasets on cultural industries, music streaming, arts employment, and creative economy metrics.',
    category: 'cultural',
    format: 'csv',
    cadence: 'quarterly',
    url: 'https://www.statcan.gc.ca/en/subjects-start/culture_and_leisure',
    licenseNote: 'Statistics Canada Open Licence',
    relevantDomains: ['zonga'],
    intelligenceUse: [
      'diaspora audience sizing by city',
      'music consumption trend analysis',
      'creator conversion benchmarks',
    ],
    requiresAuth: false,
    isPublic: true,
  },
]

// ── Master Catalog ──────────────────────────────────────────────────────────

export const PUBLIC_DATA_SOURCES: readonly DataSourceDescriptor[] = [
  ...OPEN_GOVERNMENT_SOURCES,
  ...PROCUREMENT_SOURCES,
  ...LABOUR_SOURCES,
  ...LEGAL_SOURCES,
  ...CORPORATE_SOURCES,
  ...CULTURAL_SOURCES,
]

/**
 * Retrieve data sources relevant to a specific Nzila product domain.
 */
export function getSourcesForDomain(
  domain: DataSourceDescriptor['relevantDomains'][number],
): DataSourceDescriptor[] {
  return PUBLIC_DATA_SOURCES.filter((s) => s.relevantDomains.includes(domain))
}

/**
 * Retrieve data sources by category.
 */
export function getSourcesByCategory(
  category: DataSourceDescriptor['category'],
): DataSourceDescriptor[] {
  return PUBLIC_DATA_SOURCES.filter((s) => s.category === category)
}

/**
 * Retrieve all public (no-auth) sources suitable for automated ingestion.
 */
export function getIngestableSources(): DataSourceDescriptor[] {
  return PUBLIC_DATA_SOURCES.filter((s) => s.isPublic && !s.requiresAuth)
}
