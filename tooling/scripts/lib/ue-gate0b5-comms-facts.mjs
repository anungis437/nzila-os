/**
 * Gate 0B.5 facts for the communications routes: campaigns and their action facades, templates, distribution lists and
 * subscribers, SMS, open and click tracking, unsubscribe, polls and surveys. Most operations are the generic CRUD
 * factory over a table; the table, the governance class and the factory behaviour are read from source by the CRUD
 * helper. The hand-written routes cite their own handler.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'
import { APP, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { CAPABILITY_IDS_0B5 as CAPS } from './ue-gate0b5-ids.mjs'

const DELIVERY_GATE = 11
const SURVEY_GATE = 14
const COMMS = `${APP}db/schema/domains/communications/`
const TRACK_TOKEN = `${APP}lib/communications/tracking-token.ts`

const group = (routes) => new Set(routes)
export const CAMPAIGN_ROUTES = group(['communications/campaigns/[id]/route.ts', 'communications/campaigns/route.ts'])
export const CAMPAIGN_FACADE_ROUTES = group(['communications/campaigns/[id]/analytics/route.ts', 'communications/campaigns/[id]/schedule/route.ts', 'communications/campaigns/[id]/send-test/route.ts'])
export const TEMPLATE_ROUTES = group(['communications/templates/[id]/route.ts', 'communications/templates/route.ts'])
export const TEMPLATE_FACADE_ROUTES = group(['communications/templates/[id]/duplicate/route.ts'])
export const LIST_ROUTES = group(['communications/distribution-lists/[id]/route.ts', 'communications/distribution-lists/route.ts'])
export const SUBSCRIBER_ROUTES = group(['communications/distribution-lists/[id]/subscribers/[subscriberId]/route.ts', 'communications/distribution-lists/[id]/subscribers/route.ts'])
export const SMS_ROUTES = group(['communications/sms/route.ts', 'communications/sms/campaigns/route.ts', 'communications/sms/conversations/route.ts', 'communications/sms/conversations/[conversationId]/read/route.ts'])
export const TRACKING_ROUTES = group(['communications/track/click/route.ts', 'communications/track/open/[campaignId]/[recipientId]/route.ts', 'communications/unsubscribe/[recipientId]/route.ts'])
export const POLL_ROUTES = group(['communications/polls/[pollId]/route.ts', 'communications/polls/[pollId]/vote/route.ts', 'communications/polls/route.ts'])
export const SURVEY_ROUTES = group(['communications/surveys/[surveyId]/responses/route.ts', 'communications/surveys/[surveyId]/results/route.ts', 'communications/surveys/[surveyId]/route.ts', 'communications/surveys/route.ts'])
export const COMMS_ROUTES = new Set([...CAMPAIGN_ROUTES, ...CAMPAIGN_FACADE_ROUTES, ...TEMPLATE_ROUTES, ...TEMPLATE_FACADE_ROUTES, ...LIST_ROUTES, ...SUBSCRIBER_ROUTES, ...SMS_ROUTES, ...TRACKING_ROUTES, ...POLL_ROUTES, ...SURVEY_ROUTES])

const D = (owner, gate, id, severity, title) => ({ id, gate, severity, title, ownerCapabilityId: owner })
const CA = CAPS.CAMPAIGN_AUTHORING
const SM = CAPS.SMS
const CO = CAPS.CONSENT
const PS = CAPS.POLLS_SURVEYS

export const COMMS_DEFECTS = [
  D(CA, DELIVERY_GATE, 'DEF-0B5-COMMS-CAMPAIGN-STATUS-AND-STATS-WRITABLE', 'MEDIUM', 'The generic campaign create and update accept any body field, including status, sentAt, completedAt and the stats counters, so a steward can record a campaign as sent or completed and set its delivery and open figures by hand; no state machine or delivery process owns those fields.'),
  D(CA, DELIVERY_GATE, 'DEF-0B5-COMMS-CAMPAIGN-DETACHED-FROM-CONSENT-AND-DELIVERY', 'MEDIUM', 'A campaign row stores a segment id, a free-form segment query and an audience count, and no route in the campaign group evaluates the audience, checks the communication preferences or consent of a recipient, or sends; authoring is detached from the consent and delivery rules the platform keeps elsewhere.'),
  D(CA, DELIVERY_GATE, 'DEF-0B5-COMMS-ACTION-ROUTE-IS-GENERIC-CAMPAIGN-CRUD', 'MEDIUM', 'The campaign analytics, schedule and send-test paths are the generic campaign item route: analytics returns the campaign row and no analytics, schedule is an unvalidated update of the same row, send-test sends nothing, and a DELETE of any of the three archives the campaign.'),
  D(CA, DELIVERY_GATE, 'DEF-0B5-COMMS-TEMPLATE-HARD-DELETE', 'LOW', 'message_templates has no status column, so the fixed administrator delete removes a template permanently; campaigns that referenced it lose the link (set null) and no source names a retention rule.'),
  D(CA, DELIVERY_GATE, 'DEF-0B5-COMMS-TEMPLATE-DUPLICATE-IS-GENERIC-CRUD', 'LOW', 'The template duplicate path is the generic template item route: GET returns the template, PATCH rewrites it and DELETE removes it, and nothing duplicates a template.'),
  D(CA, DELIVERY_GATE, 'DEF-0B5-COMMS-LIST-DELETE-ERASES-SUBSCRIBER-CONSENT-TRAIL', 'MEDIUM', 'newsletter_distribution_lists has no status column, so the fixed administrator delete removes the list permanently, and newsletter_list_subscribers deletes with it (on delete cascade), erasing the subscribed, unsubscribed and unsubscribedAt rows that are the suppression and consent trail of the list.'),
  D(CA, DELIVERY_GATE, 'DEF-0B5-COMMS-SUBSCRIBER-EMAILS-READ-BY-ANY-MEMBER', 'MEDIUM', 'The subscriber list route returns the whole subscriber row, with e-mail address and profile id, of an organization list to any member of the organization, and records no audit of the disclosure.'),
  D(SM, DELIVERY_GATE, 'DEF-0B5-SMS-ROWS-WRITTEN-WITHOUT-SENDING', 'MEDIUM', 'The SMS message, campaign and conversation creates insert the body as a row, including status, twilioSid, price, sent and delivered times and counts, and send nothing: the Twilio send lives in a service that no route of the group imports, so a steward records messages as sent and delivered that were never sent.'),
  D(SM, DELIVERY_GATE, 'DEF-0B5-SMS-STEWARD-READS-ALL-MEMBER-MESSAGES', 'MEDIUM', 'Callers below steward are held to their own rows by the low-role guard, but any steward reads the phone number and message text of every member conversation of the organization, without holding the member case.'),
  D(SM, DELIVERY_GATE, 'DEF-0B5-SMS-CAMPAIGN-READ-BY-ANY-MEMBER', 'LOW', 'sms_campaigns has no owner or personal column, so the low-role guard leaves it open: any member of the organization reads every SMS campaign with its message text, recipient filter and total cost.'),
  D(SM, DELIVERY_GATE, 'DEF-0B5-SMS-READ-ROUTE-IS-GENERIC-MESSAGE-CRUD', 'MEDIUM', 'The conversation read path is the generic SMS message collection route: it ignores the conversation id, GET lists every message of the organization, and POST inserts a message row; nothing marks a conversation read.'),
  D(CO, DELIVERY_GATE, 'DEF-0B5-TRACKING-STATS-READ-MODIFY-WRITE-UNAUDITED', 'LOW', 'Open and click tracking read the campaign stats object, add one in the handler and write the whole object back as separate statements under the system role, so concurrent events lose counts and the system-role writes leave no audit record.'),
  D(CO, DELIVERY_GATE, 'DEF-0B5-UNSUBSCRIBE-WRITES-NOT-ATOMIC', 'MEDIUM', 'The unsubscribe route updates the message log, the campaign stats, the communication preference and the consent record as separate statements with no transaction, so a failure part-way leaves a recipient marked unsubscribed in one table and subscribed in another.'),
  D(CO, DELIVERY_GATE, 'DEF-0B5-UNSUBSCRIBE-NO-CONSENT-RECORD-WITHOUT-CAMPAIGN', 'MEDIUM', 'A link without a campaign id updates the recipient communication preferences of every organization but writes no consent_records row, so the revocation has no evidentiary record and no organization attribution.'),
  D(CO, DELIVERY_GATE, 'DEF-0B5-UNSUBSCRIBE-LEAVES-LIST-SUBSCRIPTIONS-ACTIVE', 'MEDIUM', 'The unsubscribe route changes the campaign message log, the preference and the consent record and never touches newsletter_list_subscribers, so a member who unsubscribes from a campaign link stays subscribed on the distribution lists.'),
  D(PS, SURVEY_GATE, 'DEF-0B5-POLLS-NO-CREATE-OR-VOTE-PATH', 'MEDIUM', 'polls is READ_ONLY and poll_votes is DENIED in the CRUD governance table, so no route of the group can create a poll or record or read a vote; the member poll capability exists in schema and URL shape and cannot run through any of these routes.'),
  D(PS, SURVEY_GATE, 'DEF-0B5-POLLS-ITEM-ROUTE-IS-COLLECTION', 'LOW', 'The poll item path is configured as a collection route, so GET ignores the poll id and lists every poll of the organization.'),
  D(PS, SURVEY_GATE, 'DEF-0B5-SURVEY-LIFECYCLE-WRITABLE-DIRECTLY', 'MEDIUM', 'The generic survey create and update accept any body field, including status, publishedAt, closesAt, responseCount, viewCount and completionRate, so the published state and the response counters are set by hand and not derived from the responses.'),
  D(PS, SURVEY_GATE, 'DEF-0B5-SURVEY-DRAFTS-READABLE-BY-MEMBERS', 'LOW', 'The survey list and item reads sit at the member floor and apply no status or publication filter, so a draft survey is readable by every member of the organization.'),
  D(PS, SURVEY_GATE, 'DEF-0B5-SURVEY-RESPONSES-IDENTIFY-RESPONDENTS-TO-STEWARDS', 'HIGH', 'The survey response read returns respondent name, e-mail, user id, IP address and user agent of every response to any steward, whatever the survey allowAnonymous setting says; an anonymous survey is not anonymous.'),
  D(PS, SURVEY_GATE, 'DEF-0B5-SURVEY-RESPONSES-ROUTE-IGNORES-SURVEY-ID', 'MEDIUM', 'The responses route ignores the survey id of its path: GET lists the responses of every survey of the organization, and POST takes surveyId from the body and checks nothing about the survey, so a response is accepted for a draft or closed survey, a second response is accepted when allowMultipleResponses is false, and authentication is not required when the survey says it is.'),
  D(PS, SURVEY_GATE, 'DEF-0B5-SURVEY-ANSWERS-HAVE-NO-ROUTE', 'MEDIUM', 'No route under app/api writes survey_answers, and the results route is the only one that reads the table, so a response can be created and no answer can be recorded; the survey capability cannot be completed through these routes.'),
  D(PS, SURVEY_GATE, 'DEF-0B5-SURVEY-RESULTS-NO-ORG-PREDICATE-LOADS-ALL-ANSWERS', 'HIGH', 'The survey results route filters responses and questions by the survey id of the path and applies no organization predicate, does not request a tenant context, and also selects every row of survey_answers of every organization into memory and discards it; the isolation of the count and the question list rests on an ambient database policy the route does not set, and the full-table read is a cross-tenant read of answer text.'),
]

const owner = (text) => text

const sensCampaign = 'Campaign name, channel, subject and body, audience query, schedule, send state and delivery statistics'
const profile = (p) => ({
  gate: DELIVERY_GATE,
  deps: [9, 13],
  status: () => 'PARTIAL',
  ...p,
})

const doesFor = (table, noun) => (method, _model, floor) => ({
  GET: `Returns ${table} rows of the organization at a role floor of ${floor}.`,
  POST: `Inserts a ${table} row from the body at a role floor of ${floor}.`,
  PATCH: `Updates a ${table} row with any body field except the primary key and organization at a role floor of ${floor}.`,
  DELETE: `${noun} at the fixed administrator floor of the generic delete (${floor}).`,
})[method]

const privFor = (readText, writeText, archive) => (method) => (method === 'GET' ? readText : method === 'DELETE' ? archive : writeText)

const campaignBase = {
  owner: 'campaigns rows of the organization; the row records its creator and updater.',
  sens: sensCampaign,
  future: 'Drive the campaign status from a send process, derive the statistics from the delivery log, evaluate the audience against communication preferences and consent, and name who may send.',
  decisions: ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'],
  reqRead: 'Audit reads of campaign audiences once the readers are named.',
}

const campaignProfile = profile({
  ...campaignBase,
  persona: 'Member reading, and steward authoring, the campaigns of the organization through the generic CRUD factory',
  priv: privFor('Any member of the organization reads every campaign, including drafts, the audience query and the delivery statistics.', 'Any body field is stored, including status, sentAt, stats and the audience query.', 'The row is archived (status archived) by the fixed administrator delete; only the audit record of the delete remains.'),
  does: doesFor('campaigns', 'Sets status archived on a campaigns row'),
  def: (method) => (method === 'POST' ? ['DEF-0B5-COMMS-CAMPAIGN-STATUS-AND-STATS-WRITABLE', 'DEF-0B5-COMMS-CAMPAIGN-DETACHED-FROM-CONSENT-AND-DELIVERY'] : method === 'PATCH' ? ['DEF-0B5-COMMS-CAMPAIGN-STATUS-AND-STATS-WRITABLE'] : []),
  extraEv: (a) => [
    a.tbl('defect', 'campaigns', /stats: jsonb\('stats'\)/),
    a.tbl('defect', 'campaigns', /segmentQuery: jsonb\('segment_query'\)/),
  ],
})

const facadeName = (route) => (route.includes('/analytics/') ? 'analytics' : route.includes('/schedule/') ? 'schedule' : 'send-test')
const campaignFacadeProfile = profile({
  ...campaignBase,
  persona: undefined,
  priv: privFor('Any member of the organization reads the whole campaign row, with the audience query and statistics, from a path that promises analytics, a schedule or a test send.', 'Any body field of the campaign is stored, including status and stats, from a path named for an action.', 'The campaign is archived from a path named for an action; only the audit record of the delete remains.'),
  does: (method, _model, floor) => ({
    GET: `Returns the campaigns row named by the path id at a role floor of ${floor}; it computes no analytics, schedule or test send.`,
    POST: `Inserts a campaigns row at a role floor of ${floor}.`,
    PATCH: `Updates the campaigns row named by the path id with any body field at a role floor of ${floor}; it validates no schedule and sends nothing.`,
    DELETE: `Sets status archived on the campaigns row named by the path id at the fixed administrator floor (${floor}); it deletes no analytics, schedule or test send.`,
  })[method],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  def: (method) => ['DEF-0B5-COMMS-ACTION-ROUTE-IS-GENERIC-CAMPAIGN-CRUD', ...(method === 'PATCH' ? ['DEF-0B5-COMMS-CAMPAIGN-STATUS-AND-STATS-WRITABLE'] : [])],
  extraEv: (a) => [a.h('behavior', 'itemRoute: true,'), a.tbl('defect', 'campaigns', /stats: jsonb\('stats'\)/)],
  inferences: () => [{ claim: 'defect', statement: 'The route configuration names the campaigns table and itemRoute only; no handler code of the path analytics, schedule or send-test exists, so the path segment decides nothing.' }],
})

const templateBase = {
  owner: 'message_templates rows of the organization; the row records its creator and updater.',
  sens: 'Template name, type, subject, body, HTML content, variables and default flag',
  future: 'Name who may change a default template, version template edits and keep a template referenced by a sent campaign.',
  decisions: ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'],
  reqRead: 'Template reads need no audit record.',
}
const templateProfile = profile({
  ...templateBase,
  persona: 'Member reading, and steward maintaining, reusable message templates of the organization through the generic CRUD factory',
  priv: privFor('Any member of the organization reads every template, including inactive ones.', 'Any body field is stored, including isDefault and the HTML content.', 'The row is removed permanently; only the audit record of the delete remains.'),
  does: doesFor('message_templates', 'Permanently removes a message_templates row'),
  def: (method) => (method === 'DELETE' ? ['DEF-0B5-COMMS-TEMPLATE-HARD-DELETE'] : []),
  extraEv: () => [],
})
const templateFacadeProfile = profile({
  ...templateBase,
  persona: 'Steward expecting to duplicate a message template from a route that is the generic template item route',
  priv: privFor('Any member of the organization reads the template named by the path id.', 'Any body field of the template is stored from a path named for duplication.', 'The template is removed permanently from a path named for duplication.'),
  does: (method, _model, floor) => ({
    GET: `Returns the message_templates row named by the path id at a role floor of ${floor}; it duplicates nothing.`,
    PATCH: `Updates the message_templates row named by the path id at a role floor of ${floor}; it creates no copy.`,
    DELETE: `Permanently removes the message_templates row named by the path id at the fixed administrator floor (${floor}); it deletes no copy.`,
  })[method],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  def: (method) => ['DEF-0B5-COMMS-TEMPLATE-DUPLICATE-IS-GENERIC-CRUD', ...(method === 'DELETE' ? ['DEF-0B5-COMMS-TEMPLATE-HARD-DELETE'] : [])],
  extraEv: (a) => [a.h('behavior', 'itemRoute: true,')],
  inferences: () => [{ claim: 'defect', statement: 'The route configuration names the message_templates table and itemRoute only; no handler code of the path duplicate exists.' }],
})

const listProfile = profile({
  persona: 'Member reading, and steward maintaining, newsletter distribution lists through the generic CRUD factory',
  owner: 'newsletter_distribution_lists rows of the organization; the subscribers of a list are a separate table that deletes with it.',
  sens: 'List name, type, filter criteria and subscriber count',
  priv: privFor('Any member of the organization reads every distribution list and its filter criteria.', 'Any body field is stored, including filterCriteria and subscriberCount.', 'The list is removed permanently and its subscriber rows cascade with it; only the audit record of the delete remains.'),
  does: doesFor('newsletter_distribution_lists', 'Permanently removes a newsletter_distribution_lists row'),
  future: 'Derive the subscriber count from the subscriber rows, retire a list instead of deleting it, and keep the suppression trail of a list that is retired.',
  decisions: ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'],
  def: (method) => (method === 'DELETE' ? ['DEF-0B5-COMMS-LIST-DELETE-ERASES-SUBSCRIBER-CONSENT-TRAIL'] : []),
  extraEv: (a) => (a.method === 'DELETE' ? [a.sch('defect', `${COMMS}newsletters.ts`, /onDelete: 'cascade'/, { symbol: 'newsletterListSubscribers' })] : []),
  reqRead: 'Audit reads of lists once the readers are named.',
})

const smsOwnerText = (table) => `${table} rows of the organization; userId names the member the message concerns and the row records no author.`
const smsPersonalPriv = (readText, writeText) => privFor(readText, writeText, '')
const smsMessagesProfile = (table, label) => profile({
  persona: `Steward and above recording and reading member ${label} through the generic CRUD factory`,
  owner: smsOwnerText(table),
  sens: 'Member phone numbers, message text, delivery state, provider message id and price',
  priv: smsPersonalPriv('Any steward reads the phone number and message text of every member of the organization; a member is held to their own rows by the low-role guard.', 'Any body field is stored, including userId, phoneNumber, status, twilioSid and the price.'),
  does: doesFor(table, `Sets status archived on a ${table} row`),
  future: 'Send only through the SMS delivery service after a consent check, derive status from the provider callbacks, and restrict a conversation to the stewards who hold the member case.',
  decisions: ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'],
  def: (method) => (method === 'GET' ? ['DEF-0B5-SMS-STEWARD-READS-ALL-MEMBER-MESSAGES'] : method === 'POST' ? ['DEF-0B5-SMS-ROWS-WRITTEN-WITHOUT-SENDING'] : ['DEF-0B5-SMS-ROWS-WRITTEN-WITHOUT-SENDING']),
  extraEv: (a) => [a.tbl('privacy', table === 'sms_conversations' ? 'smsConversations' : 'smsMessages', /phoneNumber: text\('phone_number'\)\.notNull\(\)/)],
  inferences: () => [{ claim: 'defect', statement: 'The route file imports only the CRUD factory and the table; services/twilio-sms-service.ts, which holds the provider send, is imported by no route of the SMS group.' }],
  reqRead: 'Audit reads of member text messages once the readers are named; they hold phone numbers and message content.',
})
const smsCampaignsProfile = profile({
  persona: 'Member reading, and steward maintaining, text message campaigns through the generic CRUD factory',
  owner: smsOwnerText('sms_campaigns').replace('userId names the member the message concerns and ', ''),
  sens: 'SMS campaign name, message text, recipient filter, counts, cost and schedule',
  priv: privFor('Any member of the organization reads every SMS campaign with its message text, recipient filter and total cost.', 'Any body field is stored, including status, the sent, delivered and failed counts and the cost.', 'The row is archived (status archived) by the fixed administrator delete.'),
  does: doesFor('sms_campaigns', 'Sets status archived on a sms_campaigns row'),
  future: 'Drive status and counts from the SMS delivery service, evaluate recipients against consent, and restrict campaign reads to the officers who send.',
  decisions: ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'],
  def: (method) => (method === 'GET' ? ['DEF-0B5-SMS-CAMPAIGN-READ-BY-ANY-MEMBER'] : ['DEF-0B5-SMS-ROWS-WRITTEN-WITHOUT-SENDING']),
  extraEv: (a) => [a.tbl('defect', 'smsCampaigns', /recipientFilter: jsonb\('recipient_filter'\)/)],
  inferences: () => [{ claim: 'defect', statement: 'The route file imports only the CRUD factory and the table; services/twilio-sms-service.ts, which holds the provider send, is imported by no route of the SMS group.' }],
  reqRead: 'Audit reads of SMS campaigns once the readers are named.',
})
const smsReadFacadeProfile = (() => {
  const base = smsMessagesProfile('sms_messages', 'text messages')
  return {
    ...base,
    persona: 'Steward expecting to mark a conversation read from a route that is the generic SMS message collection route',
    does: (method, _model, floor) => ({
      GET: `Returns sms_messages rows of the organization at a role floor of ${floor}; the conversation id of the path is ignored and nothing is marked read.`,
      POST: `Inserts a sms_messages row from the body at a role floor of ${floor}; it marks no conversation read and sends nothing.`,
    })[method],
    status: () => 'FACADE_OVER_GENERIC_TABLE',
    def: (method) => ['DEF-0B5-SMS-READ-ROUTE-IS-GENERIC-MESSAGE-CRUD', ...(method === 'GET' ? ['DEF-0B5-SMS-STEWARD-READS-ALL-MEMBER-MESSAGES'] : ['DEF-0B5-SMS-ROWS-WRITTEN-WITHOUT-SENDING'])],
    extraEv: (a) => [...base.extraEv(a), a.h('behavior', 'orgScoped: true,')],
  }
})()

const pollsProfile = profile({
  persona: 'Member reading the polls of the organization through the generic CRUD factory; polls are refused for every write',
  owner: 'polls rows of the organization; the row records its creator.',
  sens: 'Poll question, options, status, timing and vote totals',
  priv: privFor('Any member of the organization reads every poll with its option list and vote totals.', 'No row is written: the governance table refuses the write.', ''),
  does: (method, _model, floor) => ({
    GET: `Returns polls rows of the organization at a role floor of ${floor}${''}.`,
    POST: `Would insert a polls row at a role floor of ${floor}; the generic factory refuses the write with 403 before any row is written.`,
  })[method],
  gate: SURVEY_GATE,
  future: 'Decide which office may open a poll, add a poll create and a vote route that check eligibility, and keep one vote per member.',
  decisions: [],
  status: (method) => (method === 'GET' ? 'PARTIAL' : 'LATENT_NOT_OPERATIONAL'),
  def: (method) => (method === 'POST' ? ['DEF-0B5-POLLS-NO-CREATE-OR-VOTE-PATH'] : []),
  extraEv: () => [],
  reqRead: 'Poll reads need no audit record.',
})
const pollItemProfile = {
  ...pollsProfile,
  does: (method, _model, floor) => ({
    GET: `Returns polls rows of the organization at a role floor of ${floor}; the poll id of the path is ignored because the route is configured as a collection.`,
    POST: `Would insert a polls row at a role floor of ${floor}; the generic factory refuses the write with 403 before any row is written.`,
  })[method],
  def: (method) => (method === 'POST' ? ['DEF-0B5-POLLS-NO-CREATE-OR-VOTE-PATH', 'DEF-0B5-POLLS-ITEM-ROUTE-IS-COLLECTION'] : ['DEF-0B5-POLLS-ITEM-ROUTE-IS-COLLECTION']),
  extraEv: (a) => [a.h('behavior', 'orgScoped: true,')],
}
const pollVotesProfile = profile({
  persona: 'Member voting in a poll through the generic CRUD factory; poll votes are refused for every read and write',
  owner: 'poll_votes rows of the organization; userId names the voter and the row holds the chosen option, e-mail and IP address.',
  sens: 'Voter user id, voter e-mail, chosen option, IP address and user agent',
  priv: (method) => `No row is ${method === 'GET' ? 'read' : 'written'}: the governance table refuses ${method === 'GET' ? 'the read' : 'the write'} and the response is 403.`,
  does: (method, _model, floor) => ({
    GET: `Would return poll_votes rows at a role floor of ${floor}; the generic factory refuses the read with 403 before any query.`,
    POST: `Would insert a poll_votes row at a role floor of ${floor}; the generic factory refuses the write with 403 before any row is written.`,
  })[method],
  gate: SURVEY_GATE,
  future: 'Add a dedicated vote route that checks eligibility, enforces one vote per member and keeps a secret ballot where the poll says so.',
  decisions: [],
  status: () => 'LATENT_NOT_OPERATIONAL',
  def: () => ['DEF-0B5-POLLS-NO-CREATE-OR-VOTE-PATH'],
  extraEv: (a) => [a.tbl('privacy', 'pollVotes', /voterEmail: varchar\('voter_email'/)],
  reqRead: 'No audit record is needed for a refused read.',
})

const surveyProfile = profile({
  persona: 'Member reading, and steward maintaining, organization surveys through the generic CRUD factory',
  owner: 'surveys rows of the organization; the row records its creator.',
  sens: 'Survey title, description, settings (anonymity, authentication, multiple responses), publication state and counters',
  gate: SURVEY_GATE,
  priv: privFor('Any member of the organization reads every survey, including drafts.', 'Any body field is stored, including status, publishedAt, responseCount and viewCount.', 'The row is archived (status archived) by the fixed administrator delete.'),
  does: doesFor('surveys', 'Sets status archived on a surveys row'),
  future: 'Publish and close a survey through a lifecycle that derives the counters from the responses, and serve only published surveys to members.',
  decisions: [],
  def: (method) => (method === 'GET' ? ['DEF-0B5-SURVEY-DRAFTS-READABLE-BY-MEMBERS'] : method === 'DELETE' ? [] : ['DEF-0B5-SURVEY-LIFECYCLE-WRITABLE-DIRECTLY']),
  extraEv: (a) => [a.tbl('defect', 'surveys', /status: varchar\('status', \{ length: 50 \}\)\.notNull\(\)\.default\('draft'\)/), a.tbl('defect', 'surveys', /responseCount: integer\('response_count'\)/)],
  reqRead: 'Survey reads need no audit record once only published surveys are served.',
})
const surveyResponsesProfile = profile({
  persona: 'Steward reading, and member submitting, survey responses through the generic CRUD factory',
  owner: 'survey_responses rows of the organization; userId names the respondent and the row holds name, e-mail, IP address and user agent whatever the survey allowAnonymous setting says.',
  sens: 'Respondent name, e-mail, user id, IP address and user agent, with the survey and the completion state',
  gate: SURVEY_GATE,
  priv: privFor('Any steward reads the identity, e-mail, IP address and user agent of every respondent to every survey of the organization.', 'The body is stored, including respondentEmail, respondentName, ipAddress, status and surveyId; a member is held to their own user id by the low-role guard.', ''),
  does: (method, _model, floor) => ({
    GET: `Returns survey_responses rows of the organization at a role floor of ${floor}; the survey id of the path is ignored.`,
    POST: `Inserts a survey_responses row from the body at a role floor of ${floor}; the survey id of the path is ignored and the survey is not checked.`,
  })[method],
  future: 'Record a response only for a published, open survey, honor the anonymity setting by not storing identity, require authentication when the survey says so, and write the answers in the same transaction.',
  decisions: [],
  def: (method) => (method === 'GET' ? ['DEF-0B5-SURVEY-RESPONSES-IDENTIFY-RESPONDENTS-TO-STEWARDS', 'DEF-0B5-SURVEY-RESPONSES-ROUTE-IGNORES-SURVEY-ID'] : ['DEF-0B5-SURVEY-RESPONSES-ROUTE-IGNORES-SURVEY-ID', 'DEF-0B5-SURVEY-ANSWERS-HAVE-NO-ROUTE']),
  extraEv: (a) => [
    a.tbl('privacy', 'surveyResponses', /respondentEmail: varchar\('respondent_email'/),
    a.tbl('privacy', 'surveyResponses', /ipAddress: inet\('ip_address'\)/),
    a.h('behavior', 'orgScoped: true,'),
  ],
  reqRead: 'Audit reads of respondent identity once the readers are named.',
})

const CRUD_PROFILES = [
  [CAMPAIGN_ROUTES, campaignProfile],
  [CAMPAIGN_FACADE_ROUTES, null],
  [TEMPLATE_ROUTES, templateProfile],
  [TEMPLATE_FACADE_ROUTES, templateFacadeProfile],
  [LIST_ROUTES, listProfile],
]

function crudProfileFor(a) {
  const { route } = a
  if (CAMPAIGN_ROUTES.has(route)) return campaignProfile
  if (CAMPAIGN_FACADE_ROUTES.has(route)) {
    const name = facadeName(route)
    return { ...campaignFacadeProfile, persona: `Steward expecting campaign ${name === 'send-test' ? 'test sends' : name} from a route that is the generic campaign item route` }
  }
  if (TEMPLATE_ROUTES.has(route)) return templateProfile
  if (TEMPLATE_FACADE_ROUTES.has(route)) return templateFacadeProfile
  if (LIST_ROUTES.has(route)) return listProfile
  if (route === 'communications/sms/route.ts') return smsMessagesProfile('sms_messages', 'text messages')
  if (route === 'communications/sms/campaigns/route.ts') return smsCampaignsProfile
  if (route === 'communications/sms/conversations/route.ts') return smsMessagesProfile('sms_conversations', 'text conversations')
  if (route === 'communications/sms/conversations/[conversationId]/read/route.ts') return smsReadFacadeProfile
  if (route === 'communications/polls/route.ts') return pollsProfile
  if (route === 'communications/polls/[pollId]/route.ts') return pollItemProfile
  if (route === 'communications/polls/[pollId]/vote/route.ts') return pollVotesProfile
  if (route === 'communications/surveys/route.ts' || route === 'communications/surveys/[surveyId]/route.ts') return surveyProfile
  if (route === 'communications/surveys/[surveyId]/responses/route.ts') return surveyResponsesProfile
  return null
}

const FACADE_ROUTE_NAMES = CRUD_PROFILES.length

const subscribersGet = (a) => mk({
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withApi.',
  persona: 'Member of the organization reading the subscribers of a distribution list',
  authz: "withApi with minRole member: a role floor of member for the session organization. A role title is not a kernel decision.",
  tenant: 'The list is read with an organization predicate on the session organization; the subscriber query then filters on the verified list id.',
  owner: 'newsletter_list_subscribers rows of a list the organization owns; the subscriber table has no organization column and is owned through the list.',
  sens: 'Subscriber e-mail addresses, profile ids, subscription state and metadata',
  priv: 'Any member of the organization reads the e-mail address and profile id of every active subscriber of any list of the organization; the read is not audited.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read of subscriber rows; nothing is written and the disclosure of e-mail addresses is not audited.',
  reqAudit: 'Audit reads of subscriber e-mail addresses once the readers are named.',
  does: 'Returns the subscribed members of one distribution list of the session organization, newest first, as whole rows; an unknown or foreign list is reported as not found.',
  status: 'PARTIAL',
  gate: DELIVERY_GATE,
  deps: [9, 13],
  future: 'Restrict subscriber reads to the stewards who run the list, return only the fields a list manager needs, and audit the disclosure.',
  dec: ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'eq(newsletterDistributionLists.organizationId, organizationId!)'),
    a.h('mutation', '.from(newsletterListSubscribers)'),
    a.h('privacy', 'return { subscribers };'),
    a.sch('privacy', `${COMMS}newsletters.ts`, /email: varchar\('email', \{ length: 255 \}\)\.notNull\(\)/, { symbol: 'newsletterListSubscribers' }),
  ],
  def: ['DEF-0B5-COMMS-SUBSCRIBER-EMAILS-READ-BY-ANY-MEMBER'],
})

const subscribersDelete = (a) => mk({
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withApi.',
  persona: 'Steward unsubscribing a member from a distribution list',
  authz: "withApi with minRole steward: a role floor of steward for the session organization. A role title is not a kernel decision.",
  tenant: 'The list is proven to belong to the session organization inside the transaction, and the update statement requires the subscriber to belong to that list and the list to belong to the organization.',
  owner: 'The status and unsubscribedAt columns of one newsletter_list_subscribers row of a list the organization owns.',
  sens: 'Subscriber state and the time the subscription ended',
  priv: 'No personal data is returned beyond the updated subscriber row.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The row update and the persistAtomicAudit record commit in one tenant transaction (communications.list_subscriber.unsubscribe).',
  reqAudit: 'Keep the in-transaction audit record and add the authorization decision to it.',
  does: "Marks one subscriber of one list of the session organization as unsubscribed (a soft change that keeps the row) and audits it atomically; a subscriber already unsubscribed is reported as not found.",
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: DELIVERY_GATE,
  deps: [9, 13],
  future: 'Name which office may end a member subscription and record the member-visible reason.',
  dec: ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('tenantScope', 'eq(newsletterDistributionLists.organizationId, organizationId)'),
    a.h('mutation', ".set({ status: 'unsubscribed', unsubscribedAt: new Date() })"),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
  ],
  def: [],
})

const trackBase = (a) => ({
  service: `${APP}app/api/${a.route}`,
  authn: 'None: the route has no session. A signed tracking token checked by verifyTrackingToken is the only credential.',
  cat: 'EXTERNAL_TRUST',
  persona: 'Message recipient, or the mail client or link scanner acting for them',
  gate: DELIVERY_GATE,
  deps: [9, 13],
  mut: 'NONE',
  status: 'PARTIAL',
  dec: ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'],
  corr: [{ field: 'mutating', manifest: 'read-only GET, audit NOT_APPLICABLE:READ', actual: 'This GET updates message log, campaign and preference rows under the system role and writes no audit record.' }],
})

const authEv = (a) => [
  a.h('authentication', 'const verification = verifyTrackingToken(token, tokenCandidates);'),
  a.imp('authentication', 'verifyTrackingToken', 'crypto.timingSafeEqual(tokenBuffer, expectedBuffer)'),
  a.h('authorization', "if (verification !== 'valid') {"),
  a.imp('tenantScope', 'withSystemContext', 'SET LOCAL ROLE union_eyes_system'),
]

const TRACKING = {
  'communications/track/click/route.ts|GET': (a) => mk({
    ...trackBase(a),
    authz: 'HMAC-SHA256 tracking token bound to the campaign, recipient and destination (and message id when given), compared with timingSafeEqual; a missing signing secret fails closed. This is an external trust mechanism, not a kernel decision, and it identifies no user.',
    tenant: 'The log row is found by campaign id, recipient id and message id under the system role, and every later update and the campaign update carry the organization read from that row.',
    owner: 'messageLog and campaigns rows of the organization the log row names; the recipient has no row of their own here.',
    sens: 'Recipient click event, campaign click and open counters, and the destination URL',
    priv: 'No personal data is returned: the response is a redirect to the destination the token was signed for.',
    auditDetail: 'The handler marks the log row clicked and rewrites the campaign stats, with no audit record; the only trace is a warning log for a rejected token.',
    reqAudit: 'Record click events through an append-only event table inside the transaction that updates the counters.',
    does: 'Verifies the token for the destination, marks the message log row clicked and opened, increments the campaign clicked and opened counters, and redirects to the signed destination with 302; an unverifiable link returns 400 and writes nothing.',
    future: 'Record engagement as events in one transaction and keep counters derived; do not change state on a GET that a link scanner can trigger.',
    ev: [
      ...authEv(a),
      a.h('mutation', '.set(updatePayload)'),
      a.h('audit', 'status: \'clicked\','),
      a.h('defect', 'stats: nextStats,'),
    ],
    def: ['DEF-0B1-COMMS-TRACKING-GET-MUTATES', 'DEF-0B5-TRACKING-STATS-READ-MODIFY-WRITE-UNAUDITED'],
  }),
  'communications/track/open/[campaignId]/[recipientId]/route.ts|GET': (a) => mk({
    ...trackBase(a),
    authz: 'HMAC-SHA256 tracking token bound to the campaign and recipient (and message id when given), compared with timingSafeEqual; a missing signing secret serves the pixel without recording. This is an external trust mechanism, not a kernel decision, and it identifies no user.',
    tenant: 'The log row is found by campaign id, recipient id and message id under the system role, and every later update and the campaign update carry the organization read from that row.',
    owner: 'messageLog and campaigns rows of the organization the log row names; the recipient has no row of their own here.',
    sens: 'Recipient open event and the campaign opened counter',
    priv: 'No personal data is returned: the response is a one-pixel GIF.',
    auditDetail: 'The handler marks the log row opened and rewrites the campaign stats, with no audit record; the only trace is a warning log for a rejected token.',
    reqAudit: 'Record open events through an append-only event table inside the transaction that updates the counters.',
    does: 'Verifies the token, marks the first open of the message log row, increments the campaign opened counter and always returns the tracking pixel.',
    future: 'Record opens as events in one transaction and keep counters derived; treat a mail-client prefetch as a non-event.',
    ev: [
      ...authEv(a),
      a.h('mutation', 'status: nextStatus,'),
      a.h('audit', 'openedAt: new Date(),'),
      a.h('defect', 'stats: incrementStat(campaign.stats, \'opened\'),'),
    ],
    def: ['DEF-0B1-COMMS-TRACKING-GET-MUTATES', 'DEF-0B5-TRACKING-STATS-READ-MODIFY-WRITE-UNAUDITED'],
  }),
  'communications/unsubscribe/[recipientId]/route.ts|GET': (a) => mk({
    ...trackBase(a),
    authz: 'HMAC-SHA256 token bound to the recipient, the campaign when given, and the unsubscribe action, compared with timingSafeEqual; a missing signing secret or an invalid token returns 401 and writes nothing. This is an external trust mechanism, not a kernel decision.',
    tenant: 'With a campaign id the organization is read from the campaign row and every update carries it; without one the recipient preference rows of every organization are read by user id and each is updated under its own organization.',
    owner: 'messageLog, campaigns, communicationPreferences and consentRecords rows of the organization the campaign names, or of every organization that holds a preference row for the recipient.',
    sens: 'Recipient communication preference, consent revocation and the reason given in the link',
    priv: 'No personal data is returned: the response is a static confirmation page in English or French.',
    auditDetail: 'The handler updates four tables with separate statements and inserts a consent_records revocation only when a campaign id is given; no audit_logs record is written and no statement shares a transaction.',
    reqAudit: 'Record the revocation as a consent record and an audit record in one transaction for every organization affected.',
    does: 'Verifies the unsubscribe token, marks the campaign message log row unsubscribed, upserts the recipient preference as globally unsubscribed, inserts a revoked email_marketing consent record when a campaign is named, and returns a confirmation page.',
    future: 'Accept the unsubscribe through a POST that a scanner cannot trigger, apply it in one transaction to the preference, consent and list subscriptions of each affected organization, and record it for every organization.',
    ev: [
      ...authEv(a),
      a.h('mutation', '.set({'),
      a.h('audit', "status: 'revoked',"),
      a.h('defect', 'const ownPreferences = await db'),
    ],
    inf: [{ claim: 'defect', statement: 'The route file imports campaigns, communicationPreferences, consentRecords and messageLog only; it never reads or writes newsletter_list_subscribers.' }],
    def: ['DEF-0B1-COMMS-TRACKING-GET-MUTATES', 'DEF-0B5-UNSUBSCRIBE-WRITES-NOT-ATOMIC', 'DEF-0B5-UNSUBSCRIBE-NO-CONSENT-RECORD-WITHOUT-CAMPAIGN', 'DEF-0B5-UNSUBSCRIBE-LEAVES-LIST-SUBSCRIPTIONS-ACTIVE'],
  }),
}

const surveyResults = (a) => mk({
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withApi.',
  persona: 'Steward reading the aggregate results of a survey',
  authz: "withApi with minRole steward: a role floor of steward. The route requests no tenant context and applies no organization predicate. A role title is not a kernel decision.",
  tenant: 'None in the handler: the response count and the question list filter on the survey id of the path only, and the answers are selected without any filter, so isolation rests on an ambient database policy the route does not set.',
  owner: 'survey_responses, survey_questions and survey_answers rows; each table has an organization column the handler ignores.',
  sens: 'Response count and question count of a survey; every answer row of every organization is loaded into memory and discarded',
  priv: 'A steward of any organization who supplies a survey id reads that survey response and question counts, and the handler reads all answers of all organizations.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read of aggregate counts; nothing is written and the read is not audited.',
  reqAudit: 'Audit reads of survey results once the readers are named.',
  does: 'Returns the survey id, the number of responses and the number of questions for the survey id of the path; it computes no per-question result although it selects every answer row.',
  status: 'PARTIAL',
  gate: SURVEY_GATE,
  deps: [9, 13],
  future: 'Scope every query to the session organization, compute per-question results from the survey answers only, and withhold results until the survey allows them.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('tenantScope', 'db.select({ count: count() }).from(surveyResponses).where(eq(surveyResponses.surveyId, surveyId)),'),
    a.tbl('tenantScope', 'surveyResponses', /organizationId: uuid\('organization_id'\)/),
    a.h('mutation', 'db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, surveyId)),'),
    a.h('defect', 'db.select().from(surveyAnswers),'),
  ],
  def: ['DEF-0B5-SURVEY-RESULTS-NO-ORG-PREDICATE-LOADS-ALL-ANSWERS', 'DEF-0B5-SURVEY-ANSWERS-HAVE-NO-ROUTE'],
})

export function commsFacts(a, readText) {
  const id = `${a.route}|${a.method}`
  if (a.route === 'communications/distribution-lists/[id]/subscribers/route.ts') return subscribersGet(a)
  if (a.route === 'communications/distribution-lists/[id]/subscribers/[subscriberId]/route.ts') return subscribersDelete(a)
  if (TRACKING[id]) return TRACKING[id](a)
  if (id === 'communications/surveys/[surveyId]/results/route.ts|GET') return surveyResults(a)
  const crudProfile = crudProfileFor(a)
  if (!crudProfile) throw new Error(`no Gate 0B.5 communications facts for ${id}`)
  return crudRecord(a, readText, crudProfile)
}

export { FACADE_ROUTE_NAMES, TRACK_TOKEN, owner }
