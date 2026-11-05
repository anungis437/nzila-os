/**
 * Gate 0B.10 facts: the organizing-campaign surface. Sixteen route files, 36 operations: fifteen organizing route files
 * (assignments, campaigns, card-check, committee, forms/generate, labour-board, nlrb-filings, notes, sequences with
 * enrolment, support-percentage, workplace-mapping) that are all the generic CRUD factory configured over the single
 * organizing_campaigns table, and the organizer/impact route, which is the same factory over organizer_tasks. Every
 * evidence item is produced by `opAuthoring` from the exact handler, the factory it calls or the resolved schema, and is
 * proved again by the validator. This tranche records the source; it repairs nothing and approves no route.
 */
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'
import { APP, API, LOW_ROLE } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const CAP = 'UE-OMIT-ORGANIZING-CAMPAIGNS'
const GATE = 14

const D_READERS = 'UE-INST-ORGANIZING-CAMPAIGN-DATA-READERS'
const D_FILING = 'UE-INST-ORGANIZING-REGULATORY-FILING-AUTHORITY'
const D_SUPPORT = 'UE-INST-ORGANIZING-SUPPORT-RECORD-AND-OUTREACH-CONSENT'

const CAMPAIGN_SCHEMA = `${APP}db/schema/domains/infrastructure/organizing.ts`
const TASK_SCHEMA = `${APP}db/schema/domains/communications/organizer-workflows.ts`

export const ROUTES = new Set([
  'organizer/impact/route.ts',
  'organizing/assignments/[id]/route.ts',
  'organizing/assignments/route.ts',
  'organizing/campaigns/route.ts',
  'organizing/card-check/route.ts',
  'organizing/committee/route.ts',
  'organizing/forms/generate/route.ts',
  'organizing/labour-board/route.ts',
  'organizing/nlrb-filings/route.ts',
  'organizing/notes/[id]/route.ts',
  'organizing/notes/route.ts',
  'organizing/sequences/[id]/enroll/route.ts',
  'organizing/sequences/[id]/route.ts',
  'organizing/sequences/route.ts',
  'organizing/support-percentage/route.ts',
  'organizing/workplace-mapping/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  ORG_CAMPAIGN_RECORDS: {
    capabilityId: CAP,
    domain: 'ORGANIZING_CAMPAIGN_RECORDS',
    actor: 'Steward or organizer opening, listing and keeping the organizing campaigns of the organization (target employer, workplace, strategy, timeline and outcome)',
    routes: ['organizing/campaigns/route.ts'],
    evidence: [
      ev(CAMPAIGN_SCHEMA, "campaignCode: varchar('campaign_code', { length: 50 }).notNull().unique(),"),
      ev(CAMPAIGN_SCHEMA, "organizingStrategy: text('organizing_strategy'),"),
      ev(CAMPAIGN_SCHEMA, "employerVulnerabilities: text('employer_vulnerabilities').array(),"),
    ],
  },
  ORG_CARD_CHECK_SUPPORT: {
    capabilityId: CAP,
    domain: 'ORGANIZING_CARD_CHECK_SUPPORT_AND_WORKPLACE_MAPPING',
    actor: 'Organizer or steward recording card signing, computing the support percentage, mapping support across the workplace and listing the organizing committee',
    routes: [
      'organizing/card-check/route.ts',
      'organizing/support-percentage/route.ts',
      'organizing/workplace-mapping/route.ts',
      'organizing/committee/route.ts',
    ],
    evidence: [
      ev(CAMPAIGN_SCHEMA, "cardsSigned: integer('cards_signed').default(0),"),
      ev(CAMPAIGN_SCHEMA, "cardSigningProgress: decimal('card_signing_progress', { precision: 5, scale: 2 }),"),
      ev(CAMPAIGN_SCHEMA, "organizingTeam: uuid('organizing_team').array(),"),
      ev(`${APP}components/organizing/WorkplaceMap.tsx`, 'const totalKnown = group.total_contacts - group.unknown;'),
    ],
  },
  ORG_REGULATORY_FILINGS: {
    capabilityId: CAP,
    domain: 'ORGANIZING_REGULATORY_FILINGS_AND_FORMS',
    actor: 'Organizer or steward preparing a certification application, a labour board or NLRB filing and the labour board form for an organizing campaign',
    routes: [
      'organizing/labour-board/route.ts',
      'organizing/nlrb-filings/route.ts',
      'organizing/forms/generate/route.ts',
    ],
    evidence: [
      ev(CAMPAIGN_SCHEMA, "filingDate: date('filing_date'),"),
      ev(CAMPAIGN_SCHEMA, "certificationDate: date('certification_date'),"),
      ev(`${APP}components/organizing/nlrb-filing-wizard.tsx`, "alert(`Failed to submit filing: ${error instanceof Error ? error.message : 'Unknown error'}`);"),
      ev(`${APP}components/organizing/LabourBoardFormGenerator.tsx`, "const response = await fetch('/api/organizing/forms/generate', {"),
    ],
  },
  ORG_NOTES_CONTACT_SEQUENCES: {
    capabilityId: CAP,
    domain: 'ORGANIZING_CONTACT_NOTES_AND_OUTREACH_SEQUENCES',
    actor: 'Organizer keeping notes on workplace contacts, building contact sequences and enrolling contacts in them',
    routes: [
      'organizing/notes/route.ts',
      'organizing/notes/[id]/route.ts',
      'organizing/sequences/route.ts',
      'organizing/sequences/[id]/route.ts',
      'organizing/sequences/[id]/enroll/route.ts',
    ],
    evidence: [
      ev(CAMPAIGN_SCHEMA, "contactsIdentified: integer('contacts_identified').default(0),"),
      ev(`${APP}app/[locale]/dashboard/organizing/notes/page.tsx`, "if (sentimentFilter !== 'all') params.append('sentiment', sentimentFilter);"),
    ],
  },
  ORG_ASSIGNMENTS: {
    capabilityId: CAP,
    domain: 'ORGANIZING_CAMPAIGN_ASSIGNMENTS',
    actor: 'Steward or officer assigning a lead organizer and an organizing team to an organizing campaign',
    routes: ['organizing/assignments/route.ts', 'organizing/assignments/[id]/route.ts'],
    evidence: [
      ev(CAMPAIGN_SCHEMA, "leadOrganizerId: text('lead_organizer_id').references(() => profiles.userId),"),
      ev(CAMPAIGN_SCHEMA, "organizingTeam: uuid('organizing_team').array(),"),
    ],
  },
  ORG_ORGANIZER_TASKS_IMPACT: {
    capabilityId: CAP,
    domain: 'ORGANIZER_TASKS_AND_IMPACT',
    actor: 'Steward or organizer reading and creating organizer tasks, and the organizer impact page that expects period impact figures',
    routes: ['organizer/impact/route.ts'],
    evidence: [
      ev(TASK_SCHEMA, "assignedTo: varchar('assigned_to', { length: 255 }).notNull(), // User ID of assigned organizer"),
      ev(TASK_SCHEMA, "relatedGrievanceId: uuid('related_grievance_id'), // Optional grievance reference"),
      ev(`${APP}app/[locale]/dashboard/organizer/impact/page.tsx`, 'setCurrentImpact(data.current);'),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_READERS,
    status: 'OUTSTANDING',
    question: 'Which offices of an organization may read an organizing campaign (target employer, workplace, strategy, employer vulnerabilities, organizing team, card and contact counts, election figures), may a member who is not on the organizing team or a steward read it, may a federation or a staff representative of another organization read it, and which fields of a campaign must stay restricted to the organizing team because disclosure to an employer exposes workers and organizers to retaliation?',
    sourceState: 'The campaign routes let any member of the organization read every campaign row at the member floor and let a steward write it; the table has no confidentiality, team-membership or classification column that a route reads, and no source names the office that may read a campaign or the fields that are restricted.',
    softwareOwners: [CAP],
  },
  {
    id: D_FILING,
    status: 'OUTSTANDING',
    question: 'Which office of a union may prepare, approve and sign a certification application or other filing with a labour board or the NLRB, who attests the unit description, the showing of interest and the card count that the filing states, who transmits the filing and records the receipt, and may a draft form carry legal text that the software, rather than counsel, supplies?',
    sourceState: 'The filing and form routes store a campaign row and transmit nothing; the filing wizard and the form generator expect a filing record and a PDF, and no source names the office that signs or files, the attestation of the card count, or the author of the legal content of a generated form.',
    softwareOwners: [CAP],
  },
  {
    id: D_SUPPORT,
    status: 'OUTSTANDING',
    question: 'Who holds the signed authorization cards and the identities of the workers who signed or lead the organizing committee, who may count them and state a support percentage, which consent a worker gives before being contacted or enrolled in an outreach sequence by email or text, and how is the count that a filing relies on proved?',
    sourceState: 'No route or table in the application stores a card, a signer, a committee member, a workplace contact, a note or a sequence enrolment: the cards signed and contact counters are integers on the campaign row that a steward writes, and no source names the holder of the cards, the counting office, or the consent and unsubscribe rule for organizing outreach.',
    softwareOwners: [CAP],
  },
]

export const CAPABILITIES = [
  {
    id: CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'organizing-campaign-records-card-check-and-filings',
    primaryGate: GATE,
    dependencyGates: [6, 11, 13],
    actor: 'Steward or organizer keeping organizing campaigns (target employer, workplace, strategy, card signing progress, filings and election outcome), organizer tasks and the campaign assignments; officer reading them',
    businessOutcome: 'An organizing campaign, its card and support figures, its committee, its filings and its outreach are read only by the offices the institution names, a card count and a support percentage are derived from recorded cards and not typed in, a filing with a labour board is prepared, approved and transmitted by the office the institution names and the transmission is recorded, an outreach message is sent only with consent, and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/organizing, app/api/organizer/impact',
    service: `${APP}app/api/organizing/campaigns/route.ts`,
    sourceFiles: [
      `${APP}app/api/organizing/campaigns/route.ts`,
      `${APP}app/api/organizing/card-check/route.ts`,
      `${APP}app/api/organizing/nlrb-filings/route.ts`,
      `${APP}app/api/organizing/labour-board/route.ts`,
      `${APP}app/api/organizing/forms/generate/route.ts`,
      `${APP}app/api/organizer/impact/route.ts`,
      `${APP}db/schema/domains/infrastructure/organizing.ts`,
      `${APP}components/organizing/nlrb-filing-wizard.tsx`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/organizing/campaigns/route.ts` }],
    auditEvidence: 'Every write through these routes commits the generic factory audit record (crud.organizing_campaigns.create, update or delete, or crud.organizer_tasks.create) in the same tenant transaction; the record lists the names of the fields written and none of their values. Reads are not audited.',
    privacyClassification: 'Organizing campaign strategy, target employer and workplace, employer vulnerabilities, lead organizer and organizing team identifiers, card signing and contact counts, filing and election figures; organizer tasks that carry member, case and grievance references and completion notes. Among the most sensitive union data: disclosure to an employer exposes workers and organizers to retaliation.',
    gap: 'No existing capability owns organizing campaigns. UE-OMIT-COMMITTEE-WORKSPACE concerns standing committees with meetings, minutes and action items, not a campaign committee; UE-OMIT-COMMUNICATIONS-CAMPAIGN-AUTHORING and UE-OMIT-COMMUNICATIONS-CAMPAIGN-DELIVERY own bulk message campaigns, and no organizing route sends a message; UE-OMIT-COPE-POLITICAL-ACTION owns political donation campaigns; UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION and UE-OMIT-COMPLIANCE-ASSURANCE own metrics and statutory findings that no organizing route computes; UE-CAP-K-007 owns the generic CRUD factory as a mechanism, not the domain meaning of a table it is configured over; and UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. The source has fifteen route files named for card check, support percentage, workplace mapping, committee, labour board and NLRB filings, form generation, notes, sequences, enrolment and assignments that all read and write the one organizing_campaigns table, plus an organizer impact route over organizer_tasks that serves the same steward and organizer persona and the same campaign workflow; no card, signer, committee member, note, sequence or filing table is read or written by any of them. This record closes none of the gaps and names no reader, filer or holder of cards, which no source states.',
  },
]

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE, severity, title, ...extra })

const CAMPAIGNS_ROUTE = `${API}organizing/campaigns/route.ts`
const FACTORY_TENANT = 'conditions.push(eq(orgCol, organizationId));'

const READ = 'DEF-0B10-ORG-CAMPAIGN-ROWS-READABLE-BY-ANY-MEMBER-WITH-STRATEGY-EMPLOYER-VULNERABILITIES-TEAM-AND-SUPPORT-COUNTS'
const FACADE = 'DEF-0B10-ORG-ROUTES-NAMED-FOR-CARD-CHECK-SUPPORT-NOTES-SEQUENCES-FILINGS-AND-FORMS-ARE-CAMPAIGN-ROW-CRUD'
const COUNTS = 'DEF-0B10-ORG-CARD-COUNTS-ELECTION-RESULT-AND-CAMPAIGN-STATUS-ARE-CALLER-ASSERTED-WITH-NO-CARD-RECORDS'
const FILINGS = 'DEF-0B10-ORG-NLRB-AND-LABOUR-BOARD-FILING-ROUTES-RECORD-NO-FILING-AND-TRANSMIT-NOTHING'
const FORMS = 'DEF-0B10-ORG-FORM-GENERATION-ROUTE-RETURNS-JSON-AND-THE-CLIENT-SAVES-IT-AS-THE-PDF'
const ITEM = 'DEF-0B10-ORG-ITEM-ROUTES-NAMED-FOR-NOTE-ENROLMENT-SEQUENCE-AND-ASSIGNMENT-REWRITE-OR-ARCHIVE-WHOLE-CAMPAIGN'
const CODE = 'DEF-0B10-ORG-CAMPAIGN-CODE-UNIQUE-ACROSS-ALL-ORGANIZATIONS-AND-REQUIRED-COLUMNS-FAIL-AS-500'
const ASSIGN = 'DEF-0B10-ORG-ASSIGNMENT-IS-LEAD-ORGANIZER-AND-TEAM-COLUMNS-WRITABLE-WITH-UNVERIFIED-USER-IDS'
const DEADREF = 'DEF-0B10-ORG-CLIENTS-CALL-CAMPAIGN-ITEM-AND-V2-ROUTES-THAT-ANSWER-NO-CAMPAIGN-DATA'
const IMPACT = 'DEF-0B10-ORG-ORGANIZER-IMPACT-ROUTE-IS-ORGANIZER-TASK-CRUD-NOT-IMPACT-METRICS'
const TASK_READ = 'DEF-0B10-ORG-ORGANIZER-TASKS-READABLE-BY-EVERY-STEWARD-WITH-MEMBER-CASE-AND-GRIEVANCE-REFERENCES'
const TASK_REFS = 'DEF-0B10-ORG-ORGANIZER-TASK-CREATE-STORES-UNVERIFIED-ASSIGNEE-MEMBER-CASE-AND-GRIEVANCE-REFERENCES'

export const DEFECTS = [
  D(READ, CAP, 'HIGH',
    'Every GET over organizing_campaigns (the campaigns, card-check, support-percentage, workplace-mapping, committee, labour-board, nlrb-filings, forms/generate, notes, sequences, enrolment and assignments routes, collection and item) is configured at readRole member, and the table has no user, member, email or phone column, so the low-role guard opens it: any member of the organization, not only the organizing team or a steward, receives the campaign rows with target employer, workplace location, organizing strategy, key issues, employer vulnerabilities, union advantages, lead organizer and organizing team identifiers, estimated unit size, cards signed, signing progress, contacts identified and committed, filing, election and certification dates and vote counts, with no confidentiality column, no team-membership check and no read audit.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any member of an organization, whatever their role, calls GET on any of the fifteen organizing route files: readRole is member, the generic factory scopes the rows to the session organization and applies no owner or team condition because organizing_campaigns has no user, member, email or phone column, and it returns 50 rows per page by default (100 at most) with strategy text, employer vulnerabilities, organizing team identifiers, card counts and election figures.',
        potentialImpact: {
          classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
          description: 'A member who is not on the organizing team, including one who reports to or sympathizes with the target employer, learns who leads and staffs a confidential campaign, how many cards are signed, which employer vulnerabilities the union plans to use and the planned filing and election dates; disclosure of organizing strategy and support to an employer exposes workers and organizers to retaliation and lets the employer mount a counter-campaign.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [{ ref: CAMPAIGNS_ROUTE, quote: "readRole: 'member'," }],
        existingContainment: {
          summary: 'The factory adds an organization predicate from the session organization, so the rows read are those of the caller own organization only; nothing narrows them to the organizing team, a steward or a classification, so the exposure is every campaign of the organization to every member.',
          evidence: [{ ref: `${APP}lib/api/crud-factory.ts`, quote: FACTORY_TENANT }],
        },
        justification: 'Campaign strategy, support counts and organizer identities are the data whose disclosure to an employer causes retaliation, and the routes serve them to every authenticated member of the organization at the lowest role floor with no team or classification condition; the tenant predicate keeps other organizations out but does not limit a same-organization reader, so the read blocks release until the institution names who may read a campaign.',
      },
    }),
  D(FACADE, CAP, 'MEDIUM',
    'The card-check, support-percentage, workplace-mapping, committee, labour-board, nlrb-filings, forms/generate, notes, sequences, sequences enrolment and assignments routes are all crudRoutes over the single organizing_campaigns table: none reads or writes a card, signer, committee member, workplace contact, note, sequence, enrolment, filing or form, none applies the campaignId, viewType, groupBy, noteType, sentiment or followUpPending parameters its clients send, and each answers 200 with campaign rows or creates a campaign row from the body, so a capability whose real state is not implemented is returned as a successful response under the name of card check, support percentage, mapping, committee, filings, notes, sequences and enrolment.'),
  D(COUNTS, CAP, 'MEDIUM',
    'POST and PATCH on organizing_campaigns copy the body into the row, so a steward sets cards_signed, card_signing_progress, target_card_count, contacts_identified, contacts_committed, filing_date, election_eligible_voters, votes_for_union, votes_against_union, challenged_ballots, election_result, certification_date and status to any value: no card, signer or ballot record exists to derive or verify them, the progress percentage is not computed from cards_signed and the estimated unit size, a count above the unit size is accepted, and cards_signed and card_signing_progress are the only support figures any of these routes stores or returns, so a typed-in number is what a reader receives as the card count and support level of the campaign.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(FILINGS, CAP, 'MEDIUM',
    'The labour-board and nlrb-filings routes record no filing: GET lists organizing_campaigns rows and POST inserts one from the body and answers success, no filing row, filing identifier, board, receipt or status is stored, nothing is transmitted to a labour board or the NLRB, and the filing wizard (which posts a filing shape with filingType, jurisdiction, unit description and card submission fields) carries none of the required campaign columns, so its post fails on the insert and its alert reports a failed submission, so a filing is neither drafted nor sent, while a campaign-shaped body is accepted as a success under the name of a filing.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(FORMS, CAP, 'MEDIUM',
    'The forms/generate route generates no form: GET lists organizing_campaigns rows and POST inserts a campaign row from the body or fails on its required columns (the form generator posts campaignId, templateId and formData, none of which is a campaign column), it returns JSON and never a PDF, no template or legal text exists on the server, and the form generator reads the response with blob() without checking the status and saves it as a PDF named for the form type and employer, so an error or JSON body is downloaded as a labour board form.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(ITEM, CAP, 'MEDIUM',
    'The item routes under notes/[id], sequences/[id], sequences/[id]/enroll and assignments/[id] take a campaign id as the path id: PATCH at the steward floor rewrites any column of the whole campaign (status, lead organizer, organizing team, outcome figures, archived_at), and DELETE at the admin floor sets the campaign status to archived, so a call to delete a note, a sequence or an enrolment archives the campaign with no reason or confirmation, archived_at is not set, and the archived campaign is still returned by every GET because the read filters no status.'),
  D(CODE, CAP, 'LOW',
    'campaign_code on organizing_campaigns is unique across all organizations and is a required column the body must supply, as are campaign_name, target_employer, workplace_location and estimated_unit_size: a code already used by another organization, a repeated code or a body missing a required column makes the insert fail and the route answers an unexplained 500 instead of a conflict or a validation error, and an otherwise complete body that fails because its code is already used by another organization reveals that the code exists outside the caller organization.'),
  D(ASSIGN, CAP, 'MEDIUM',
    'The assignments routes assign nobody: an assignment is the lead_organizer_id column (a foreign key to profiles) and the organizing_team uuid array on the campaign row, which POST and PATCH at the steward floor set to any value from the body, with no check that the user is a member or an organizer of the organization, that the organizing_team ids exist, or that the person accepted, and with no assignment history, so any steward can name or remove the lead and team of any campaign in the organization.'),
  D(DEADREF, CAP, 'LOW',
    'The labour board form generator calls /api/organizing/campaigns/<campaignId>, an item path that the repository has no route for (the campaigns route file has no item route), and the organizing console and campaign detail console call /api/v2/organizing/campaigns, which the v2 catch-all answers with a 200 deprecation notice and no campaign data, so those clients load no campaign through the route that exists and show an empty or unpopulated state.'),
  D(IMPACT, CAP, 'MEDIUM',
    'The organizer/impact route is crudRoutes over organizer_tasks: GET returns organizer task rows and POST inserts a task from the body, it reads no case, grievance or satisfaction data, applies no period parameter and returns no current or previous impact object, while the organizer impact page sends period and reads data.current and data.previous, so the page always shows its empty state and no impact figure is computed by any route.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(TASK_READ, CAP, 'MEDIUM',
    'GET /api/organizer/impact returns every organizer_tasks row of the organization to a steward or any role above: the low-role guard holds only callers below steward to their own member_id rows, so a steward reads the assignee, the member id, the related case and grievance ids, the blocked reason and the completion notes of every organizer task in the organization whatever case or grievance mandate the steward holds, and no read is audited.'),
  D(TASK_REFS, CAP, 'MEDIUM',
    'POST /api/organizer/impact stores assigned_to, assigned_by, member_id, related_case_id and related_grievance_id from the body with no check that the assignee or member belongs to the organization or that the case and grievance exist in it (related_case_id and related_grievance_id are uuid columns with no foreign key), and status, completed_at and completion_notes are writable on creation, so a task can name a person, case or grievance of another organization and be created already completed.'),
]

const CAMPAIGN_SENS = 'Campaign name and code, target employer and workplace location, industry, estimated unit size, cards signed and signing progress, contacts identified and committed, lead organizer and organizing team identifiers, organizing strategy, key issues, employer vulnerabilities and union advantages, filing, election and certification dates, vote counts and election result'

const FACADE_BY_ROUTE = {
  'organizing/campaigns/route.ts': null,
  'organizing/card-check/route.ts': 'Named card-check, it holds no card, signer, signature, witness or custody record and validates no card; the only card figure is the cards_signed integer of the campaign row.',
  'organizing/support-percentage/route.ts': 'Named support-percentage, it computes no percentage and reads no card: the figure is the card_signing_progress decimal that a steward writes on the campaign row.',
  'organizing/workplace-mapping/route.ts': 'Named workplace-mapping, it holds no department, shift, worksite or support-level row and returns no aggregation or summary; the map component reads aggregations and summary from the response data object, and the route returns data and pagination.',
  'organizing/committee/route.ts': 'Named committee, it holds no committee member row and returns no members; the committee map component reads members from the response data object, and the only team reference stored is the organizing_team uuid array of the campaign row.',
  'organizing/labour-board/route.ts': 'Named labour-board, it holds no filing, board, receipt or status row and transmits nothing to a labour board; the filing date is a date column of the campaign row.',
  'organizing/nlrb-filings/route.ts': 'Named nlrb-filings, it holds no filing, petition, receipt or status row and transmits nothing to the NLRB; the filing wizard posts a filing shape whose keys the campaign row does not read.',
  'organizing/forms/generate/route.ts': 'Named forms/generate, it holds no form template or legal text and returns JSON rows or a created campaign row, never a form or a PDF.',
  'organizing/notes/route.ts': 'Named notes, it holds no note row (no contact, sentiment, engagement level, follow-up date or content); the notes pages post note content and read data.notes, which the route does not return.',
  'organizing/notes/[id]/route.ts': 'Named notes/[id], the path id is a campaign id, not a note id; no note row exists to read, change or delete.',
  'organizing/sequences/route.ts': 'Named sequences, it holds no sequence, step, template or schedule row and sends no email or text message.',
  'organizing/sequences/[id]/route.ts': 'Named sequences/[id], the path id is a campaign id, not a sequence id; no sequence row exists and no message is sent.',
  'organizing/sequences/[id]/enroll/route.ts': 'Named sequences/[id]/enroll, it enrols no contact: the path id is a campaign id, no contact or enrolment row exists, and no email or text message is sent, so no consent or unsubscribe step is reached.',
  'organizing/assignments/route.ts': 'Named assignments, it holds no assignment row: an assignment is the lead_organizer_id and organizing_team columns of a campaign row.',
  'organizing/assignments/[id]/route.ts': 'Named assignments/[id], the path id is a campaign id, not an assignment id; no assignment row exists.',
}

const FACADE_NAME = {
  'organizing/campaigns/route.ts': 'organizing campaign',
  'organizing/card-check/route.ts': 'card check',
  'organizing/support-percentage/route.ts': 'support percentage',
  'organizing/workplace-mapping/route.ts': 'workplace map',
  'organizing/committee/route.ts': 'organizing committee',
  'organizing/labour-board/route.ts': 'labour board filing',
  'organizing/nlrb-filings/route.ts': 'NLRB filing',
  'organizing/forms/generate/route.ts': 'labour board form',
  'organizing/notes/route.ts': 'organizing note',
  'organizing/notes/[id]/route.ts': 'organizing note',
  'organizing/sequences/route.ts': 'contact sequence',
  'organizing/sequences/[id]/route.ts': 'contact sequence',
  'organizing/sequences/[id]/enroll/route.ts': 'sequence enrolment',
  'organizing/assignments/route.ts': 'organizing assignment',
  'organizing/assignments/[id]/route.ts': 'organizing assignment',
}

const ITEM_ROUTES = new Set([
  'organizing/assignments/[id]/route.ts',
  'organizing/notes/[id]/route.ts',
  'organizing/sequences/[id]/route.ts',
  'organizing/sequences/[id]/enroll/route.ts',
])

const FILING_ROUTES = new Set(['organizing/labour-board/route.ts', 'organizing/nlrb-filings/route.ts'])
const ASSIGN_ROUTES = new Set(['organizing/assignments/route.ts', 'organizing/assignments/[id]/route.ts'])
const SUPPORT_ROUTES = new Set([
  'organizing/card-check/route.ts', 'organizing/support-percentage/route.ts', 'organizing/workplace-mapping/route.ts', 'organizing/committee/route.ts',
])

const FUTURE = {
  campaign: 'Decide who may read a campaign and which fields stay with the organizing team, add a confidentiality and team-membership condition to every read, validate the body and block status, outcome, count and ownership fields from direct writes, scope campaign_code within the organization and answer conflicts as 409.',
  facade: 'Either build the card, committee, contact, note, sequence, enrolment and filing records behind their routes with their own authority checks, or answer 501 for each until they exist; do not return a campaign row under the name of a card check, support percentage, committee, filing, note or sequence.',
  filing: 'Decide the office that prepares, approves, signs and transmits a filing, store a filing record with its author, attestation and receipt, transmit only on that office decision and record the transmission, and keep draft legal text under counsel review.',
  support: 'Record cards and committee members in tables with custody and authority rules, derive the count and the support percentage from them with a minimum group size, restrict the reads to the organizing team and audit them.',
  sequences: 'Keep notes, sequences and enrolments in their own records, require a recorded consent and an unsubscribe path before any outbound message and send nothing from a route that has no delivery decision.',
}

function profile(a) {
  const { route, method } = a
  const isRead = method === 'GET'
  const isCampaignOnly = route === 'organizing/campaigns/route.ts'
  const isImpact = route === 'organizer/impact/route.ts'
  const isItem = ITEM_ROUTES.has(route)
  const name = FACADE_NAME[route]
  const facade = FACADE_BY_ROUTE[route]
  if (isImpact) return impactProfile(a)

  const def = []
  if (isRead) def.push(READ)
  if (!isCampaignOnly) def.push(FACADE)
  if (method === 'POST' || method === 'PATCH') def.push(COUNTS)
  if (FILING_ROUTES.has(route)) def.push(FILINGS)
  if (route === 'organizing/forms/generate/route.ts' && method === 'POST') def.push(FORMS)
  if (isItem && method !== 'GET') def.push(ITEM)
  if (ASSIGN_ROUTES.has(route) && method !== 'GET' && method !== 'DELETE') def.push(ASSIGN)
  if (method === 'POST') def.push(CODE)
  if ((isCampaignOnly && isRead) || (route === 'organizing/forms/generate/route.ts' && method === 'POST')) def.push(DEADREF)

  const decisions = []
  if (isRead || isCampaignOnly) decisions.push(D_READERS)
  if (FILING_ROUTES.has(route) || route === 'organizing/forms/generate/route.ts') decisions.push(D_FILING)
  if (SUPPORT_ROUTES.has(route) || route.includes('sequences') || route === 'organizing/notes/route.ts' || route === 'organizing/notes/[id]/route.ts') decisions.push(D_SUPPORT)
  if (!decisions.includes(D_READERS)) decisions.push(D_READERS)

  const future = FILING_ROUTES.has(route) || route === 'organizing/forms/generate/route.ts'
    ? FUTURE.filing
    : SUPPORT_ROUTES.has(route) ? FUTURE.support
      : route.includes('sequences') || route.startsWith('organizing/notes') ? FUTURE.sequences
        : isCampaignOnly ? FUTURE.campaign : FUTURE.facade

  const extraEv = (b) => {
    const out = [
      b.tbl('privacy', 'organizingCampaigns', /organizingStrategy: text\('organizing_strategy'\)/),
      b.tbl('privacy', 'organizingCampaigns', /organizingTeam: uuid\('organizing_team'\)\.array\(\)/),
    ]
    if (isRead) {
      out.push(
        b.tbl('privacy', 'organizingCampaigns', /employerVulnerabilities: text\('employer_vulnerabilities'\)\.array\(\)/),
        b.sch('privacy', LOW_ROLE, "return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }"),
        b.imp('defect', 'crudRoutes', 'const lowRole = await readScope(userId, organizationId);'),
      )
    } else {
      out.push(
        b.tbl('defect', 'organizingCampaigns', /cardsSigned: integer\('cards_signed'\)\.default\(0\)/),
        b.tbl('defect', 'organizingCampaigns', /electionResult: varchar\('election_result'/),
      )
      if (method === 'POST') out.push(b.tbl('defect', 'organizingCampaigns', /campaignCode: varchar\('campaign_code', \{ length: 50 \}\)\.notNull\(\)\.unique\(\)/))
      if (ASSIGN_ROUTES.has(route) && method === 'PATCH') out.push(b.tbl('defect', 'organizingCampaigns', /leadOrganizerId: text\('lead_organizer_id'\)/))
      if (method === 'DELETE') {
        out.push(
          b.tbl('defect', 'organizingCampaigns', /status: varchar\('status', \{ length: 50 \}\)\.notNull\(\)\.default\('planning'\)/),
          b.tbl('defect', 'organizingCampaigns', /archivedAt: timestamp\('archived_at'/),
        )
      }
    }
    return out
  }

  const inferences = () => {
    const out = []
    if (facade) out.push({ claim: 'defect', statement: `${facade} The route file configures crudRoutes over organizingCampaigns with orgScoped, readRole member and writeRole steward and nothing else.` })
    if (route === 'organizing/forms/generate/route.ts' && method === 'POST') {
      out.push({ claim: 'defect', statement: 'The form generator posts campaignId, templateId and formData, reads the reply with response.blob() without checking response.ok and downloads it as a PDF named from the form type and the employer; the route answers JSON, so the downloaded file is the JSON body or the error envelope, not a form.' })
    }
    if (FILING_ROUTES.has(route) && method === 'POST') {
      out.push({ claim: 'defect', statement: 'The filing wizard posts filingType, jurisdiction, filedDate, bargainingUnitDescription, unitSizeClaimed, showingOfInterestPercentage and cardsSubmittedCount, and calls the response a submitted filing; the campaign insert reads none of those keys (it has a filing_date column but no filedDate, filing type, unit description or card submission column) and lacks the required campaign columns the wizard does not send, and no source in the route or the factory transmits a filing.' })
    }
    if (isCampaignOnly && isRead) {
      out.push({ claim: 'defect', statement: 'The route file exports only GET and POST, so /api/organizing/campaigns/<id> resolves to no route; the organizing console reads /api/v2/organizing/campaigns, which the v2 catch-all answers with a deprecation notice.' })
    }
    if (isItem && method === 'DELETE') {
      out.push({ claim: 'defect', statement: 'The factory soft delete sets status to archived and updatedAt and leaves archived_at empty, and the item and collection reads add no status condition, so an archived campaign stays readable.' })
    }
    return out
  }

  const reqRead = 'Audit reads of organizing campaigns once the readers are named: a read reveals organizing strategy, team identities and support counts whose disclosure causes retaliation.'

  return {
    persona: isRead
      ? `Member of the organization (any role) calling the ${name} read; steward or organizer using the ${name} page`
      : `Steward or organizer (admin for delete) using the ${name} page`,
    owner: `organizing_campaigns rows of the organization (${name} is not a table of its own: ${facade ?? 'the campaign row is the record this route serves'})`,
    sens: CAMPAIGN_SENS,
    priv: (m) => {
      if (m === 'GET') {
        return `Any member of the organization reads the campaign row${isItem ? ' of the path id' : 's of the organization, 50 per page by default and 100 at most,'} with ${CAMPAIGN_SENS}; no row of the other organizations is reachable, nothing narrows the rows to the organizing team and no read is audited.`
      }
      return m === 'DELETE'
        ? 'The campaign row of the path id is archived and returned in full, including strategy, team identifiers and counts.'
        : `The row stored from the body is returned in full, including strategy, team identifiers and counts; any body column of organizing_campaigns can be set, including status, outcome figures, lead organizer and team${m === 'PATCH' ? ', and the path id is a campaign id' : ''}.`
    },
    does: (m, _model, floor) => {
      const base = facade ?? 'This is the organizing campaign route proper: the rows it serves are the campaigns.'
      if (m === 'GET') {
        return `${base} Returns the organizing_campaigns row${isItem ? ' of the path id' : 's'} of the session organization at a role floor of ${floor}${isItem ? '' : ', newest first and paginated,'} with no filter from the campaignId, organizationId, viewType, groupBy or status parameters its clients send and no status condition.`
      }
      if (m === 'POST') return `${base} Inserts an organizing_campaigns row from the whole body at a role floor of ${floor}, with the organization and creator taken from the session, and commits the factory audit record with it; no outbound message, filing or card record is created.`
      if (m === 'PATCH') return `${base} Updates the campaign row of the path id from the whole body (except the primary key and organization) at a role floor of ${floor} and commits the factory audit record with it; no outbound message is sent.`
      return `${base} Sets the status of the campaign row of the path id to archived at a role floor of ${floor} and commits the factory audit record with it.`
    },
    future,
    gate: GATE,
    deps: [6, 11, 13],
    decisions,
    def: () => def,
    extraEv,
    inferences,
    reqRead,
    status: () => (isCampaignOnly ? 'PARTIAL' : 'FACADE_OVER_GENERIC_TABLE'),
  }
}

function impactProfile(a) {
  const isRead = a.method === 'GET'
  const sens = 'Task title and description, assignee, assigner, member id, related case and grievance ids, priority, status, due date, completion notes, blocked reason, metadata and tags'
  return {
    persona: isRead
      ? 'Member reading the organizer tasks that name them, and steward or organizer reading every organizer task of the organization; the organizer impact page expecting period impact figures'
      : 'Steward or organizer creating an organizer task through the generic CRUD factory',
    owner: 'organizer_tasks rows of the organization; the route is named for impact but is not an impact computation.',
    sens,
    priv: (m) => (m === 'GET'
      ? 'A caller below steward receives only the organizer_tasks rows whose member_id equals their own user id; a steward or above receives every task row of the organization with assignee, member id, case and grievance ids and completion notes. No impact figure is returned.'
      : 'The task row stored from the body is returned in full, including assignee, member id, related case and grievance ids and completion notes.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns organizer_tasks rows of the session organization at a role floor of ${floor} (own member_id rows only below steward), newest first, ignoring the period parameter the impact page sends and returning no current or previous impact object.`
      : `Inserts an organizer_tasks row from the whole body at a role floor of ${floor}, with the organization and creator from the session, and commits the factory audit record with it; nothing is computed.`),
    future: 'Compute the impact figures in a route that reads the case, grievance and participation records under the mandate the institution names, keep the task list on its own route with an assignee and reference check, and name who may read tasks that reference a member or a grievance.',
    gate: GATE,
    deps: [6, 13],
    decisions: [D_READERS],
    def: () => (isRead ? [IMPACT, TASK_READ] : [IMPACT, TASK_REFS]),
    extraEv: (b) => [
      b.tbl('privacy', 'organizerTasks', /completionNotes: text\('completion_notes'\)/),
      b.tbl('privacy', 'organizerTasks', /relatedGrievanceId: uuid\('related_grievance_id'\)/),
      ...(isRead
        ? [b.sch('privacy', LOW_ROLE, "const OWNER_COLUMNS = ['userId', 'memberId'] as const"), b.sch('defect', LOW_ROLE, 'if (!(await isBelowStaff(userId, organizationId))) return {}')]
        : [
          b.tbl('defect', 'organizerTasks', /assignedTo: varchar\('assigned_to', \{ length: 255 \}\)\.notNull\(\)/),
          b.tbl('defect', 'organizerTasks', /relatedCaseId: uuid\('related_case_id'\)/),
        ]),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route file configures crudRoutes over organizerTasks with orgScoped, readRole member and writeRole steward and nothing else; the impact page sends period and reads data.current and data.previous, neither of which the route returns.' },
    ],
    reqRead: 'Audit reads of organizer tasks that reference a member, case or grievance once the readers are named.',
    status: () => 'FACADE_OVER_GENERIC_TABLE',
  }
}

export const RISK_SCREENS = {}

export function facts(a, readText) {
  const record = applyCrossTenantExposure(crudRecord(a, readText, profile(a)), DEFECTS)
  return record
}
