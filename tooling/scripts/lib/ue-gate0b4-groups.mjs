/**
 * Gate 0B.4 ownership groups. A group names the exact route files whose operations the tranche classified with
 * source evidence, the one capability whose obligation covers them, and the business domain. Routes are listed by
 * exact file. A route prefix or an HTTP method never decides ownership. The four carbon operations belong to no group:
 * no table, service, persona source or register entry names the domain, so they stay SCOPE_UNDECIDED.
 */
import { CAPABILITY_IDS_0B2 } from './ue-gate0b2-groups.mjs'
import { CAPABILITY_IDS_0B4 as IDS } from './ue-gate0b4-ids.mjs'

export { ANCHOR_COMMIT, CARRIED_OPERATION, CARRY_FORWARD_COUNT, CARRY_FORWARD_FROM, NEW_UNEXAMINED_COUNT, TRANCHE_ID, TRANCHE_SIZE } from './ue-gate0b4-ids.mjs'
export const CAPABILITY_IDS_0B4 = IDS

const APP = 'apps/union-eyes/'
const SCHEMA = `${APP}db/schema/`
const CRUD_FACTORY = `${APP}lib/api/crud-factory.ts`
const CRUD_GOVERNANCE = `${APP}lib/api/crud-governance.ts`
const DOCTRINE = 'Generic CRUD routes authorise by organization and role floor only'
const CBA_SERVICES = `${APP}lib/services/cba-intelligence/`

const ev = (ref, quote) => ({ kind: 'file', ref, quote })
const api = (route, quote) => ev(`${APP}app/api/${route}`, quote)

/** A file only partly inside the tranche: only the listed methods are classified; the others stay SCOPE_UNDECIDED. */
export const METHOD_FILTERS = {
  'calendar-sync/connections/[id]/route.ts': ['GET', 'PATCH'],
}

export const DOMAIN_ROUTES = {
  COMMUNICATIONS_CAMPAIGN_DELIVERY_STATUS: ['billing/batch-status/[jobId]/route.ts'],
  CALENDAR_PROVIDER_CONNECTION_ITEM: ['calendar-sync/connections/[id]/route.ts'],
  CALENDAR_PROVIDER_CONNECTIONS: ['calendar-sync/connections/[id]/sync/route.ts', 'calendar-sync/connections/route.ts'],
  CALENDAR_PROVIDER_OAUTH: [
    'calendar-sync/google/auth/route.ts',
    'calendar-sync/google/callback/route.ts',
    'calendar-sync/microsoft/auth/route.ts',
    'calendar-sync/microsoft/callback/route.ts',
  ],
  CALENDAR_RECORDS: ['calendar/events/[id]/route.ts', 'calendar/events/route.ts', 'calendars/[id]/events/route.ts', 'calendars/[id]/route.ts', 'calendars/route.ts'],
  CBA_DATASET_READS: [
    'cba-intelligence/agreements/[id]/route.ts',
    'cba-intelligence/agreements/export/route.ts',
    'cba-intelligence/agreements/route.ts',
    'cba-intelligence/benchmark/[id]/route.ts',
    'cba-intelligence/documents/route.ts',
    'cba-intelligence/freshness/route.ts',
    'cba-intelligence/health/route.ts',
  ],
  CBA_DATASET_SOURCES_AND_INGESTION: [
    'cba-intelligence/extraction/route.ts',
    'cba-intelligence/ingestion/route.ts',
    'cba-intelligence/ingestion/run/route.ts',
    'cba-intelligence/ingestion/seed/route.ts',
    'cba-intelligence/sources/[id]/route.ts',
    'cba-intelligence/sources/route.ts',
  ],
  CBA_DATASET_REVIEW: ['cba-intelligence/review/route.ts'],
  CBA_AGREEMENT_RECORDS: ['cbas/[id]/route.ts', 'cbas/route.ts'],
  CBA_CLAUSE_RECORDS: ['clauses/[id]/route.ts', 'clauses/compare/route.ts', 'clauses/route.ts', 'clauses/search/route.ts'],
  CLAUSE_LIBRARY_ENTRIES: ['clause-library/[id]/route.ts', 'clause-library/route.ts'],
  CLAUSE_LIBRARY_SHARING_AND_TAGS: ['clause-library/[id]/share/route.ts', 'clause-library/[id]/tags/route.ts'],
  CLAUSE_LIBRARY_SEARCH_AND_COMPARE: ['clause-library/compare/route.ts', 'clause-library/search/route.ts'],
  CHATBOT_ADVISORY: ['chatbot/messages/route.ts', 'chatbot/sessions/[sessionId]/messages/route.ts', 'chatbot/sessions/route.ts'],
  GENERIC_CRUD_CLC_SYNC_LOG: ['clc/dashboard/route.ts', 'clc/remittances/route.ts', 'clc/sync/route.ts'],
  OHS_ANTI_SCAB: ['cnesst/anti-scab/[id]/route.ts', 'cnesst/anti-scab/route.ts'],
  OHS_CNESST_FILINGS: ['cnesst/filings/[id]/route.ts', 'cnesst/filings/route.ts'],
  OHS_JOINT_COMMITTEES: ['cnesst/hs-committees/[id]/route.ts', 'cnesst/hs-committees/route.ts'],
  PLATFORM_MARKETING_CONTENT: ['case-studies/[slug]/route.ts', 'case-studies/route.ts'],
}

const GROUPS = {
  COMMUNICATIONS_CAMPAIGN_DELIVERY_STATUS: {
    capabilityId: IDS.COMMS_DELIVERY,
    domain: 'COMMUNICATIONS_CAMPAIGN_DELIVERY_STATUS',
    actor: 'Steward reading the delivery progress of a newsletter campaign of the organization',
    evidence: [
      ev(`${SCHEMA}domains/communications/newsletters.ts`, "export const newsletterCampaigns = pgTable('newsletter_campaigns', {"),
      api('billing/batch-status/[jobId]/route.ts', 'const { newsletterCampaigns, newsletterRecipients } = await import'),
    ],
  },
  CALENDAR_PROVIDER_CONNECTION_ITEM: {
    capabilityId: IDS.CALENDAR,
    domain: 'CALENDAR_PROVIDER_CONNECTIONS',
    actor: 'Member reading and changing the connection of a personal calendar to an external calendar provider',
    evidence: [
      ev(`${SCHEMA}domains/scheduling/calendar.ts`, "export const externalCalendarConnections = pgTable('external_calendar_connections', {"),
      api('calendar-sync/connections/[id]/route.ts', "import { externalCalendarConnections } from '@/db/schema';"),
      ev(`${APP}components/calendar/CalendarSyncManager.tsx`, '/api/calendar-sync/connections'),
    ],
  },
  CALENDAR_PROVIDER_CONNECTIONS: {
    capabilityId: IDS.CALENDAR,
    domain: 'CALENDAR_PROVIDER_CONNECTIONS',
    actor: 'Member listing external calendar connections and synchronizing a local calendar with the provider',
    evidence: [
      ev(`${SCHEMA}domains/scheduling/calendar.ts`, "export const externalCalendarConnections = pgTable('external_calendar_connections', {"),
      api('calendar-sync/connections/route.ts', "import { externalCalendarConnections } from '@/db/schema';"),
      ev(`${APP}components/calendar/CalendarSyncManager.tsx`, '/api/calendar-sync/connections'),
    ],
  },
  CALENDAR_PROVIDER_OAUTH: {
    capabilityId: IDS.CALENDAR,
    domain: 'CALENDAR_PROVIDER_OAUTH',
    actor: 'Member authorizing the platform to read and write a personal calendar at Google or Microsoft',
    evidence: [
      ev(`${APP}lib/external-calendar-sync/google-calendar-service.ts`, 'export function getAuthorizationUrl'),
      ev(`${APP}lib/external-calendar-sync/microsoft-calendar-service.ts`, 'export async function getAuthorizationUrl'),
      api('calendar-sync/google/callback/route.ts', "import { encryptCalendarToken } from '@/lib/external-calendar-sync/token-crypto'"),
    ],
  },
  CALENDAR_RECORDS: {
    capabilityId: IDS.CALENDAR,
    domain: 'CALENDAR_RECORDS',
    actor: 'Member and steward reading and maintaining organization and personal calendars and their events',
    evidence: [
      ev(`${SCHEMA}domains/scheduling/calendar.ts`, "export const calendars = pgTable('calendars', {"),
      ev(`${SCHEMA}domains/scheduling/calendar.ts`, "export const calendarEvents = pgTable('calendar_events', {"),
      ev(`${APP}app/[locale]/calendar/page.tsx`, '/api/calendar'),
    ],
  },
  CBA_DATASET_READS: {
    capabilityId: IDS.CBA_DATASET,
    domain: 'CBA_DATASET_READS',
    actor: 'Steward and member reading the shared collective-agreement intelligence dataset: agreements, documents, benchmarks and freshness',
    evidence: [
      ev(`${SCHEMA}domains/cba-intelligence/extraction.ts`, 'export const cbaIntelAgreements = pgTable('),
      ev(`${SCHEMA}domains/cba-intelligence/documents.ts`, 'export const cbaIntelDocuments = pgTable('),
      ev(`${CBA_SERVICES}extraction-service.ts`, 'export async function listAgreements'),
    ],
  },
  CBA_DATASET_SOURCES_AND_INGESTION: {
    capabilityId: IDS.CBA_DATASET,
    domain: 'CBA_DATASET_SOURCES_AND_INGESTION',
    actor: 'Organization administrator registering sources and running ingestion and extraction into the shared collective-agreement intelligence dataset',
    evidence: [
      ev(`${SCHEMA}domains/cba-intelligence/source-registry.ts`, 'export const cbaIntelSources = pgTable('),
      ev(`${SCHEMA}domains/cba-intelligence/ingestion.ts`, 'export const cbaIntelIngestionJobs = pgTable('),
      ev(`${CBA_SERVICES}seed-sources.ts`, 'export async function seedSources'),
    ],
  },
  CBA_DATASET_REVIEW: {
    capabilityId: IDS.CBA_DATASET,
    domain: 'CBA_DATASET_REVIEW',
    actor: 'Steward reviewing extracted collective-agreement records before they are treated as verified',
    evidence: [
      ev(`${SCHEMA}domains/cba-intelligence/review.ts`, 'export const cbaIntelReviewDecisions = pgTable('),
      ev(`${CBA_SERVICES}review-service.ts`, 'export async function'),
    ],
  },
  CBA_AGREEMENT_RECORDS: {
    capabilityId: IDS.CBA_REGISTER,
    domain: 'CBA_AGREEMENT_RECORDS',
    actor: 'Member reading, and officer maintaining, the collective agreements of the organization',
    evidence: [
      ev(`${SCHEMA}domains/agreements/collective-agreements.ts`, 'export const collectiveAgreements = pgTable("collective_agreements", {'),
      api('cbas/route.ts', "import { listCBAs, type CBAFilters } from '@/lib/services/cba-service';"),
    ],
  },
  CBA_CLAUSE_RECORDS: {
    capabilityId: IDS.CBA_REGISTER,
    domain: 'CBA_CLAUSE_RECORDS',
    actor: 'Member reading, and steward maintaining, the clauses of the collective agreements of the organization',
    evidence: [
      ev(`${SCHEMA}domains/agreements/clauses.ts`, 'export const cbaClause = pgTable("cba_clauses", {'),
      api('clauses/route.ts', "import { cbaClause } from '@/db/schema';"),
    ],
  },
  CLAUSE_LIBRARY_ENTRIES: {
    capabilityId: IDS.CLAUSE_LIBRARY,
    domain: 'CLAUSE_LIBRARY_ENTRIES',
    actor: 'Steward publishing and member reading clauses of the clause library shared across organizations',
    evidence: [
      ev(`${SCHEMA}domains/agreements/shared-library.ts`, 'export const sharedClauseLibrary = pgTable("shared_clause_library", {'),
      api('clause-library/route.ts', "import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';"),
    ],
  },
  CLAUSE_LIBRARY_SHARING_AND_TAGS: {
    capabilityId: IDS.CLAUSE_LIBRARY,
    domain: 'CLAUSE_LIBRARY_SHARING_AND_TAGS',
    actor: 'Steward changing the sharing level of, and tagging, a shared library clause',
    evidence: [
      ev(`${SCHEMA}domains/agreements/shared-library.ts`, 'export const clauseLibraryTags = pgTable("clause_library_tags", {'),
      api('clause-library/[id]/share/route.ts', "import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';"),
    ],
  },
  CLAUSE_LIBRARY_SEARCH_AND_COMPARE: {
    capabilityId: IDS.CLAUSE_LIBRARY,
    domain: 'CLAUSE_LIBRARY_SEARCH_AND_COMPARE',
    actor: 'Member searching and comparing clauses of the shared clause library',
    evidence: [
      ev(`${SCHEMA}domains/agreements/shared-library.ts`, 'export const sharedClauseLibrary = pgTable("shared_clause_library", {'),
      api('clause-library/search/route.ts', "import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';"),
    ],
  },
  CHATBOT_ADVISORY: {
    capabilityId: CAPABILITY_IDS_0B2.AI,
    domain: 'CHATBOT_ADVISORY',
    actor: 'Member holding an advisory conversation with the member assistant',
    evidence: [
      ev(`${SCHEMA}domains/ml/chatbot.ts`, 'export const chatSessions = pgTable('),
      ev(`${SCHEMA}domains/ml/chatbot.ts`, 'export const chatMessages = pgTable('),
      api('chatbot/messages/route.ts', "import { ChatbotService } from '@/lib/ai/chatbot-service';"),
    ],
  },
  GENERIC_CRUD_CLC_SYNC_LOG: {
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Member and staff through the generic CRUD factory over the Canadian Labour Congress synchronization log',
    evidence: [ev(CRUD_FACTORY, 'export function crudRoutes'), ev(CRUD_GOVERNANCE, DOCTRINE), ev(CRUD_GOVERNANCE, "'clc_sync_log'")],
  },
  OHS_ANTI_SCAB: {
    capabilityId: IDS.OHS,
    domain: 'OHS_ANTI_SCAB',
    actor: 'Steward recording anti-scab violation reports under the Quebec labour code',
    evidence: [
      ev(`${SCHEMA}domains/health-safety/cnesst-schema.ts`, 'export const antiScabViolations = pgTable("anti_scab_violations", {'),
      api('cnesst/anti-scab/route.ts', "import { antiScabViolations } from '@/db/schema';"),
    ],
  },
  OHS_CNESST_FILINGS: {
    capabilityId: IDS.OHS,
    domain: 'OHS_CNESST_FILINGS',
    actor: 'Steward recording and reading workplace-injury and illness filings with the CNESST',
    evidence: [
      ev(`${SCHEMA}domains/health-safety/cnesst-schema.ts`, 'export const cneesstFilings = pgTable("cnesst_filings", {'),
      api('cnesst/filings/route.ts', "import { cneesstFilings } from '@/db/schema';"),
    ],
  },
  OHS_JOINT_COMMITTEES: {
    capabilityId: IDS.OHS,
    domain: 'OHS_JOINT_COMMITTEES',
    actor: 'Member reading, and steward maintaining, the joint health and safety committees of the organization',
    evidence: [
      ev(`${SCHEMA}domains/health-safety/cnesst-schema.ts`, 'export const jointHsCommittees = pgTable("joint_hs_committees", {'),
      api('cnesst/hs-committees/route.ts', "import { jointHsCommittees } from '@/db/schema';"),
    ],
  },
  PLATFORM_MARKETING_CONTENT: {
    capabilityId: CAPABILITY_IDS_0B2.OPERATOR,
    domain: 'PLATFORM_MARKETING_CONTENT',
    actor: 'Public visitor and member reading platform case studies; platform staff maintaining them',
    evidence: [
      ev(`${SCHEMA}domains/marketing.ts`, 'export const caseStudies = pgTable('),
      api('case-studies/[slug]/route.ts', "import { caseStudies } from '@/db/schema';"),
    ],
  },
}

export const OWNERSHIP_GROUPS = Object.entries(GROUPS).map(([domainKey, group]) => {
  const routes = DOMAIN_ROUTES[domainKey]
  const methods = routes.length === 1 ? METHOD_FILTERS[routes[0]] : undefined
  return {
    id: `RULE-0B4-${domainKey.replaceAll('_', '-')}`,
    domainKey,
    ...group,
    routes,
    ...(methods ? { methods } : {}),
  }
})

export function groupOfRoute(route, method) {
  return OWNERSHIP_GROUPS.find((group) => group.routes.includes(route) && (!group.methods || !method || group.methods.includes(method)))
}

export function ownershipRulesForTranche4() {
  return OWNERSHIP_GROUPS.map((group) => {
    const rule = {
      id: group.id,
      precedence: 40,
      prefixes: group.routes,
      capabilityId: group.capabilityId,
      disposition: 'OWNED',
      actor: group.actor,
      privacy: 'CAPABILITY',
      evidence: group.evidence,
    }
    if (group.methods) rule.methods = group.methods
    return rule
  })
}

const domainsOf = (capabilityId) => [...new Set(OWNERSHIP_GROUPS.filter((group) => group.capabilityId === capabilityId).map((group) => group.domain))]

export const CAPABILITY_DOMAINS = Object.fromEntries([...new Set(OWNERSHIP_GROUPS.map((group) => group.capabilityId))].map((id) => [id, domainsOf(id)]))
