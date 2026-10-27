/**
 * Gate 0B.5 ownership groups. A group names the exact route files whose operations the tranche classified with source
 * evidence, the one capability whose obligation covers them, and the business domain. Routes are listed by exact file.
 * A route prefix or an HTTP method never decides ownership. The four carbon operations carried forward from Gate 0B.4
 * belong to no group: they stay SCOPE_UNDECIDED with an exact scope decision.
 */
import { CAPABILITY_IDS_0B5 as NEW, REUSED_CAPABILITY_IDS_0B5 as REUSED } from './ue-gate0b5-ids.mjs'

export {
  ANCHOR_COMMIT, CARRIED_OPERATIONS, CARRY_FORWARD_COUNT, CARRY_FORWARD_FROM, NEW_UNEXAMINED_COUNT, TRANCHE_ID, TRANCHE_SIZE,
} from './ue-gate0b5-ids.mjs'
export const CAPABILITY_IDS_0B5 = NEW

const APP = 'apps/union-eyes/'
const SCHEMA = `${APP}db/schema/`
const COMMS = `${SCHEMA}domains/communications/`
const CNESST = `${SCHEMA}domains/health-safety/cnesst-schema.ts`

const ev = (ref, quote) => ({ kind: 'file', ref, quote })
const api = (route, quote) => ev(`${APP}app/api/${route}`, quote)

export const METHOD_FILTERS = {}

export const DOMAIN_ROUTES = {
  OHS_PREVENTIVE_WITHDRAWALS: ['cnesst/preventive-withdrawals/[id]/route.ts', 'cnesst/preventive-withdrawals/route.ts'],
  OHS_RIGHT_OF_REFUSAL: ['cnesst/right-of-refusal/[id]/route.ts', 'cnesst/right-of-refusal/route.ts'],
  PAY_EQUITY_EXERCISES: ['cnesst/pay-equity/[id]/route.ts', 'cnesst/pay-equity/route.ts'],
  COGNITION_DERIVED_ANALYTICS: [
    'cognition/cases/[id]/risk/route.ts', 'cognition/engagement/route.ts', 'cognition/executive-summary/route.ts',
    'cognition/kpis/route.ts', 'cognition/precedents/route.ts', 'cognition/workload/route.ts',
  ],
  COGNITION_HEALTH: ['cognition/health/route.ts'],
  COMMITTEE_RECORDS: ['committees/[id]/route.ts', 'committees/route.ts'],
  COMMITTEE_MEETINGS_AND_MINUTES: [
    'committees/[id]/meetings/[meetingId]/attendance/route.ts', 'committees/[id]/meetings/[meetingId]/minutes/route.ts',
    'committees/[id]/meetings/[meetingId]/route.ts', 'committees/[id]/meetings/route.ts',
  ],
  COMMITTEE_ACTION_ITEMS: ['committees/[id]/action-items/[itemId]/route.ts', 'committees/[id]/action-items/route.ts'],
  COMMITTEE_DOCUMENTS: ['committees/[id]/documents/route.ts'],
  COMMITTEE_INTELLIGENCE: ['committees/[id]/intelligence/route.ts'],
  COMMUNICATIONS_CAMPAIGNS: ['communications/campaigns/[id]/route.ts', 'communications/campaigns/route.ts'],
  COMMUNICATIONS_CAMPAIGN_FACADES: [
    'communications/campaigns/[id]/analytics/route.ts', 'communications/campaigns/[id]/schedule/route.ts', 'communications/campaigns/[id]/send-test/route.ts',
  ],
  COMMUNICATIONS_TEMPLATES: ['communications/templates/[id]/route.ts', 'communications/templates/route.ts'],
  COMMUNICATIONS_TEMPLATE_DUPLICATE_FACADE: ['communications/templates/[id]/duplicate/route.ts'],
  COMMUNICATIONS_DISTRIBUTION_LISTS: ['communications/distribution-lists/[id]/route.ts', 'communications/distribution-lists/route.ts'],
  COMMUNICATIONS_LIST_SUBSCRIBERS: [
    'communications/distribution-lists/[id]/subscribers/[subscriberId]/route.ts', 'communications/distribution-lists/[id]/subscribers/route.ts',
  ],
  SMS_MESSAGES: ['communications/sms/route.ts'],
  SMS_CAMPAIGNS: ['communications/sms/campaigns/route.ts'],
  SMS_CONVERSATIONS: ['communications/sms/conversations/route.ts'],
  SMS_CONVERSATION_READ_FACADE: ['communications/sms/conversations/[conversationId]/read/route.ts'],
  COMMUNICATIONS_TRACKING_AND_UNSUBSCRIBE: [
    'communications/track/click/route.ts', 'communications/track/open/[campaignId]/[recipientId]/route.ts', 'communications/unsubscribe/[recipientId]/route.ts',
  ],
  MEMBER_POLLS: ['communications/polls/[pollId]/route.ts', 'communications/polls/[pollId]/vote/route.ts', 'communications/polls/route.ts'],
  MEMBER_SURVEYS: [
    'communications/surveys/[surveyId]/responses/route.ts', 'communications/surveys/[surveyId]/results/route.ts',
    'communications/surveys/[surveyId]/route.ts', 'communications/surveys/route.ts',
  ],
}

const GROUPS = {
  OHS_PREVENTIVE_WITHDRAWALS: {
    capabilityId: REUSED.OHS,
    domain: 'OHS_PREVENTIVE_WITHDRAWALS',
    actor: 'Steward recording the preventive withdrawal of a pregnant or breastfeeding member from hazardous work',
    evidence: [ev(CNESST, 'export const preventiveWithdrawals = pgTable("preventive_withdrawals", {'), api('cnesst/preventive-withdrawals/route.ts', "import { preventiveWithdrawals } from '@/db/schema';")],
  },
  OHS_RIGHT_OF_REFUSAL: {
    capabilityId: REUSED.OHS,
    domain: 'OHS_RIGHT_OF_REFUSAL',
    actor: 'Steward recording a member exercise of the right to refuse dangerous work',
    evidence: [ev(CNESST, 'export const rightOfRefusalEvents = pgTable("right_of_refusal_events", {'), api('cnesst/right-of-refusal/route.ts', "import { rightOfRefusalEvents } from '@/db/schema';")],
  },
  PAY_EQUITY_EXERCISES: {
    capabilityId: NEW.PAY_EQUITY,
    domain: 'PAY_EQUITY_EXERCISES',
    actor: 'Officer recording a pay equity exercise of the organization: committee, evaluation, results and maintenance',
    evidence: [ev(CNESST, 'export const payEquityExercises = pgTable("pay_equity_exercises", {'), api('cnesst/pay-equity/route.ts', "import { payEquityExercises } from '@/db/schema';")],
  },
  COGNITION_DERIVED_ANALYTICS: {
    capabilityId: REUSED.ANALYTICS,
    domain: 'COGNITION_DERIVED_ANALYTICS',
    actor: 'Steward and officer reading risk, engagement, workload, precedent and key-indicator figures computed by the organizational cognition package',
    evidence: [
      ev(`${APP}lib/cognition/ue-adapter.ts`, 'export'),
      api('cognition/kpis/route.ts', "import { withOrganizationAuth } from '@/lib/organization-middleware';"),
    ],
  },
  COGNITION_HEALTH: {
    capabilityId: REUSED.OPERATOR,
    domain: 'COGNITION_HEALTH',
    actor: 'Officer reading the posture of the organizational cognition subsystem',
    evidence: [api('cognition/health/route.ts', "import { withApi } from '@/lib/api/with-api';")],
  },
  COMMITTEE_RECORDS: {
    capabilityId: NEW.COMMITTEES,
    domain: 'COMMITTEE_RECORDS',
    actor: 'Member reading, and steward maintaining, the standing committees of the organization',
    evidence: [ev(`${SCHEMA}union-structure-schema.ts`, 'export const committees = pgTable('), api('committees/route.ts', "import { committees } from '@/db/schema';")],
  },
  COMMITTEE_MEETINGS_AND_MINUTES: {
    capabilityId: NEW.COMMITTEES,
    domain: 'COMMITTEE_MEETINGS_AND_MINUTES',
    actor: 'Steward scheduling committee meetings and attendance, and officer approving minutes',
    evidence: [ev(`${SCHEMA}committee-workspace-schema.ts`, 'export const committeeMeetings = pgTable('), ev(`${APP}lib/services/committee-workspace-service.ts`, 'export async function recordMinutes')],
  },
  COMMITTEE_ACTION_ITEMS: {
    capabilityId: NEW.COMMITTEES,
    domain: 'COMMITTEE_ACTION_ITEMS',
    actor: 'Steward assigning and updating committee action items',
    evidence: [ev(`${SCHEMA}committee-workspace-schema.ts`, 'export const committeeActionItems = pgTable('), ev(`${APP}lib/services/committee-workspace-service.ts`, 'export async function createActionItem')],
  },
  COMMITTEE_DOCUMENTS: {
    capabilityId: NEW.COMMITTEES,
    domain: 'COMMITTEE_DOCUMENTS',
    actor: 'Steward linking documents to a committee',
    evidence: [ev(`${SCHEMA}committee-workspace-schema.ts`, 'export const committeeDocuments = pgTable('), ev(`${APP}lib/services/committee-workspace-service.ts`, 'export async function linkDocument')],
  },
  COMMITTEE_INTELLIGENCE: {
    capabilityId: NEW.COMMITTEES,
    domain: 'COMMITTEE_INTELLIGENCE',
    actor: 'Officer requesting a cross-committee synthesis of minutes',
    evidence: [ev(`${APP}lib/services/committee-workspace-service.ts`, 'export async function createIntelligenceSnapshot'), ev(`${APP}lib/services/committee-workspace-service.ts`, 'export async function gatherCrossCommitteeMinutes')],
  },
  COMMUNICATIONS_CAMPAIGNS: {
    capabilityId: NEW.CAMPAIGN_AUTHORING,
    domain: 'COMMUNICATIONS_CAMPAIGNS',
    actor: 'Steward authoring and managing member communication campaigns',
    evidence: [ev(`${COMMS}campaigns.ts`, "export const campaigns = pgTable('campaigns', {"), api('communications/campaigns/route.ts', "import { campaigns } from '@/db/schema';")],
  },
  COMMUNICATIONS_CAMPAIGN_FACADES: {
    capabilityId: NEW.CAMPAIGN_AUTHORING,
    domain: 'COMMUNICATIONS_CAMPAIGNS',
    actor: 'Steward expecting campaign analytics, scheduling and test sends from routes that are the generic campaign configuration',
    evidence: [ev(`${COMMS}campaigns.ts`, "export const campaigns = pgTable('campaigns', {"), api('communications/campaigns/[id]/schedule/route.ts', "import { campaigns } from '@/db/schema';")],
  },
  COMMUNICATIONS_TEMPLATES: {
    capabilityId: NEW.CAMPAIGN_AUTHORING,
    domain: 'COMMUNICATIONS_TEMPLATES',
    actor: 'Steward maintaining reusable message templates of the organization',
    evidence: [ev(`${COMMS}campaigns.ts`, "export const messageTemplates = pgTable('message_templates', {"), api('communications/templates/route.ts', "import { messageTemplates } from '@/db/schema';")],
  },
  COMMUNICATIONS_TEMPLATE_DUPLICATE_FACADE: {
    capabilityId: NEW.CAMPAIGN_AUTHORING,
    domain: 'COMMUNICATIONS_TEMPLATES',
    actor: 'Steward expecting to duplicate a message template from a route that is the generic template configuration',
    evidence: [ev(`${COMMS}campaigns.ts`, "export const messageTemplates = pgTable('message_templates', {"), api('communications/templates/[id]/duplicate/route.ts', "import { messageTemplates } from '@/db/schema';")],
  },
  COMMUNICATIONS_DISTRIBUTION_LISTS: {
    capabilityId: NEW.CAMPAIGN_AUTHORING,
    domain: 'COMMUNICATIONS_DISTRIBUTION_LISTS',
    actor: 'Steward maintaining newsletter distribution lists',
    evidence: [ev(`${COMMS}newsletters.ts`, 'export const newsletterDistributionLists = pgTable('), api('communications/distribution-lists/route.ts', "import { newsletterDistributionLists } from '@/db/schema';")],
  },
  COMMUNICATIONS_LIST_SUBSCRIBERS: {
    capabilityId: NEW.CAMPAIGN_AUTHORING,
    domain: 'COMMUNICATIONS_DISTRIBUTION_LISTS',
    actor: 'Member reading, and steward unsubscribing, the subscribers of a distribution list',
    evidence: [ev(`${COMMS}newsletters.ts`, 'export const newsletterListSubscribers = pgTable('), api('communications/distribution-lists/[id]/subscribers/route.ts', 'newsletterListSubscribers')],
  },
  SMS_MESSAGES: {
    capabilityId: NEW.SMS,
    domain: 'SMS_MESSAGES',
    actor: 'Steward reading and recording member text messages',
    evidence: [ev(`${COMMS}sms.ts`, "export const smsMessages = pgTable('sms_messages', {"), api('communications/sms/route.ts', "import { smsMessages } from '@/db/schema';")],
  },
  SMS_CAMPAIGNS: {
    capabilityId: NEW.SMS,
    domain: 'SMS_CAMPAIGNS',
    actor: 'Steward maintaining text message campaigns',
    evidence: [ev(`${COMMS}sms.ts`, "export const smsCampaigns = pgTable('sms_campaigns', {"), api('communications/sms/campaigns/route.ts', "import { smsCampaigns } from '@/db/schema';")],
  },
  SMS_CONVERSATIONS: {
    capabilityId: NEW.SMS,
    domain: 'SMS_CONVERSATIONS',
    actor: 'Steward reading member text conversations',
    evidence: [ev(`${COMMS}sms.ts`, "export const smsConversations = pgTable('sms_conversations', {"), api('communications/sms/conversations/route.ts', "import { smsConversations } from '@/db/schema';")],
  },
  SMS_CONVERSATION_READ_FACADE: {
    capabilityId: NEW.SMS,
    domain: 'SMS_MESSAGES',
    actor: 'Steward expecting to mark a conversation read from a route that is the generic message configuration',
    evidence: [ev(`${COMMS}sms.ts`, "export const smsMessages = pgTable('sms_messages', {"), api('communications/sms/conversations/[conversationId]/read/route.ts', "import { smsMessages } from '@/db/schema';")],
  },
  COMMUNICATIONS_TRACKING_AND_UNSUBSCRIBE: {
    capabilityId: NEW.CONSENT,
    domain: 'COMMUNICATIONS_TRACKING_AND_UNSUBSCRIBE',
    actor: 'Message recipient following an open-tracking, click-tracking or unsubscribe link',
    evidence: [ev(`${APP}lib/communications/tracking-token.ts`, 'export function verifyTrackingToken'), api('communications/unsubscribe/[recipientId]/route.ts', "import { verifyTrackingToken } from '@/lib/communications/tracking-token';")],
  },
  MEMBER_POLLS: {
    capabilityId: NEW.POLLS_SURVEYS,
    domain: 'MEMBER_POLLS',
    actor: 'Member voting in, and steward reading, organization polls',
    evidence: [ev(`${COMMS}surveys.ts`, 'export const polls = pgTable('), ev(`${COMMS}surveys.ts`, 'export const pollVotes = pgTable(')],
  },
  MEMBER_SURVEYS: {
    capabilityId: NEW.POLLS_SURVEYS,
    domain: 'MEMBER_SURVEYS',
    actor: 'Member answering, and steward reading the results of, organization surveys',
    evidence: [ev(`${COMMS}surveys.ts`, 'export const surveys = pgTable('), ev(`${COMMS}surveys.ts`, 'export const surveyResponses = pgTable(')],
  },
}

export const OWNERSHIP_GROUPS = Object.entries(GROUPS).map(([domainKey, group]) => {
  const routes = DOMAIN_ROUTES[domainKey]
  const methods = routes.length === 1 ? METHOD_FILTERS[routes[0]] : undefined
  return {
    id: `RULE-0B5-${domainKey.replaceAll('_', '-')}`,
    domainKey,
    ...group,
    routes,
    ...(methods ? { methods } : {}),
  }
})

export function groupOfRoute(route, method) {
  return OWNERSHIP_GROUPS.find((group) => group.routes.includes(route) && (!group.methods || !method || group.methods.includes(method)))
}

export function ownershipRulesForTranche5() {
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
