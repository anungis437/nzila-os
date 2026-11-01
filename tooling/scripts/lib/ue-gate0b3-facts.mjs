/**
 * Gate 0B.3 source facts: the engineering gates of every capability the tranche cites, the institutional decisions
 * (the five Gate 0B.2 decisions, unchanged, plus the two this tranche adds), the defect register entries this tranche
 * found, and the per-operation fact lookup. Each defect names one responsible capability whose primary gate is the
 * gate that repairs it. No institutional decision recorded here is adopted, and none justifies access.
 */
import { INSTITUTIONAL_DECISIONS as DECISIONS_0B2 } from './ue-gate0b2-facts.mjs'
import { CAPABILITY_IDS_0B2 } from './ue-gate0b2-groups.mjs'
import { CAPABILITY_IDS_0B3 as IDS } from './ue-gate0b3-groups.mjs'
import { CRUD_ROUTES_0B3, crudFacts3 } from './ue-gate0b3-crud-facts.mjs'
import { BESPOKE_ROUTES, UNRESOLVED_0B3, bespokeFacts } from './ue-gate0b3-bespoke-facts.mjs'
import { APP_API } from './ue-gate0b3-fact-helpers.mjs'

export { UNRESOLVED_0B3 }

export const CAPABILITY_GATES_0B3 = {
  'UE-CAP-K-007': 13,
  'UE-CAP-K-010': 4,
  'UE-CAP-D-003': 5,
  'UE-CAP-K-006': 14,
  'UE-CAP-K-005': 14,
  [CAPABILITY_IDS_0B2.AUDIT_VISIBILITY]: 14,
  [CAPABILITY_IDS_0B2.AI]: 14,
  [IDS.BARGAINING]: 14,
  [IDS.PRECEDENT]: 14,
  [IDS.PLATFORM_BILLING]: 14,
  [IDS.ANALYTICS_REPORT]: 14,
  [IDS.OBSERVABILITY]: 14,
}

const SOFTWARE_OWNERS = {
  'UE-INST-PLATFORM-STAFF-MANDATE': [CAPABILITY_IDS_0B2.OPERATOR, CAPABILITY_IDS_0B2.ENUMERATION, IDS.PLATFORM_BILLING],
  'UE-INST-KNOWLEDGE-PUBLICATION': [CAPABILITY_IDS_0B2.AI, 'UE-CAP-I-001', IDS.PRECEDENT],
  'UE-INST-OBSERVABILITY-ALERT-OWNER': [IDS.OBSERVABILITY],
}

export const INSTITUTIONAL_DECISIONS_0B3 = [
  ...DECISIONS_0B2.map((decision) => ({ ...decision, softwareOwners: SOFTWARE_OWNERS[decision.id] ?? decision.softwareOwners })),
  {
    id: 'UE-INST-PLATFORM-CONTRACT-AUTHORITY',
    status: 'OUTSTANDING',
    question: 'Which organization office may read the commercial terms of, pause, resume or cancel the organization platform subscription, and which of those acts belong to the platform operator?',
    sourceState: 'Subscription reads sit at the member floor, pause and resume at the steward floor, and metadata update and cancel at the secretary_treasurer role title, a union finance role. The Financial Officer disposition labels the platform billing service as not union finance. No adopted decision names the contract-authority office.',
    softwareOwners: [IDS.PLATFORM_BILLING],
  },
  {
    id: 'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER',
    status: 'OUTSTANDING',
    question: 'Which capability and which organization office own newsletter campaigns, recipients and delivery status, and is campaign delivery status a billing or a communications obligation?',
    sourceState: 'The batch-status route lives under billing and is gated by a billing entitlement but reads newsletter_campaigns and newsletter_recipients. No capability, persona source or register entry names campaigns or newsletter delivery.',
    softwareOwners: [],
  },
]

const D = (id, gate, severity, ownerCapabilityId, title) => ({ id, gate, severity, ownerCapabilityId, title })
const K007 = 'UE-CAP-K-007'
const K006 = 'UE-CAP-K-006'
const K005 = 'UE-CAP-K-005'

export const DEFECTS_0B3 = [
  D('DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT', 13, 'HIGH', K007, 'The generic CRUD create copies the whole request body into the insert and the update strips only the primary key and organization column, so a caller can set status, author, approval, cost and provenance columns on every table whose route lists no blockedPatchFields; none of the Gate 0B.3 CRUD routes lists any.'),
  D('DEF-0B3-CRUD-SOFT-DELETE-ARCHIVED-NOT-IN-ENUM', 13, 'MEDIUM', K007, 'The generic CRUD delete sets status archived on any table with a status column, but the break_status, negotiation_status, proposal_status and arbitration_status enums contain no archived value, so deletion of those records cannot succeed as designed and the failure is not shown by any source.'),
  D('DEF-0B3-BREAKS-OWNER-IDENTITY-MISMATCH', 13, 'MEDIUM', K007, 'The break collection declares ownerColumn memberId, which references organization_members.id, and the factory compares it with the session user id for every caller; the item routes hold callers below steward to the same memberId comparison. The source does not show these are the same identifier, and on the collection staff are held to the same filter so no steward can review member breaks through it.'),
  D('DEF-0B3-BREAKS-CREATE-FOR-OTHER-MEMBER', 13, 'HIGH', K007, 'Break creation at the member floor does not force memberId from the session because the collection route declares an explicit ownerColumn, which sets the factory low-role mode to open, so a member can record a break, with its denial and compliance fields, for another member.'),
  D('DEF-0B3-KPI-ALERT-RECIPIENTS-MEMBER-READ', 13, 'MEDIUM', K007, 'The KPI configuration read returns alert thresholds and the alertRecipients column to every member at the read floor.'),
  D('DEF-0B3-CALENDAR-DISCONNECT-ADMIN-FLOOR-NO-REVOKE', 13, 'MEDIUM', K007, 'Disconnecting a calendar requires the fixed administrator floor of the generic delete, so a member who connected their own calendar cannot disconnect it, and the delete removes the local row holding provider tokens without revoking the provider grant.'),
  D('DEF-0B3-BULK-IMPORT-INERT', 13, 'HIGH', K007, 'The bulk-import route is the generic CRUD factory over organization_members, a READ_ONLY table: GET returns the member roster to staff and POST is refused, so nothing is imported.'),
  D('DEF-0B3-ARBITRATION-DECISION-SUBRESOURCES-FACADE', 14, 'MEDIUM', IDS.PRECEDENT, 'The precedent citations, documents and search routes are the generic CRUD factory over arbitration_decisions: they return and change decision rows and serve no citations, documents or search results.'),
  D('DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT', 14, 'HIGH', IDS.PRECEDENT, 'arbitration_decisions has no organization column, so the library routes return every decision row to every organization whatever isPublic or accessRestrictions say, and the row-level-security policy admits any tenant context.'),
  D('DEF-0B3-ARBITRATION-DECISIONS-ORG-ADMIN-DELETES-SHARED-ROW', 14, 'HIGH', IDS.PRECEDENT, 'The library delete uses the fixed administrator floor of the generic factory and hard-deletes the row, so an organization administrator can delete a decision that every organization reads.'),
  D('DEF-0B3-ANALYTICS-ROWS-FORGE-AI-PROVENANCE', 14, 'MEDIUM', CAPABILITY_IDS_0B2.AI, 'A steward can insert an insight_recommendations row through the generic factory with an aiReferenceId, confidence score and recommendations of their choosing, and the row is then served as an AI insight.'),
  D('DEF-0B3-WEEKLY-SUMMARY-FABRICATED-MODEL-CLAIM', 14, 'HIGH', CAPABILITY_IDS_0B2.AI, 'The weekly summary records an AI invocation naming model analytics-engine and stores confidenceScore 0.83 and fixed recommendation text for a computation that counts events and runs no model.'),
  D('DEF-0B3-EXTERNAL-INVOICES-MEMBER-FLOOR', 5, 'HIGH', 'UE-CAP-D-003', 'The synchronized accounting invoice read returns customer names, balances and amounts to every member at the read floor, ahead of any financial mandate.'),
  D('DEF-0B3-EXTERNAL-INVOICES-WRITE-ADVERTISED', 5, 'MEDIUM', 'UE-CAP-D-003', 'The invoice create route is the generic factory over external_invoices, a READ_ONLY table: every POST is refused, so the advertised invoice creation does not exist.'),
  D('DEF-0B3-ARBITRATION-RECORD-NO-CASE-AUTHORITY', 4, 'HIGH', 'UE-CAP-K-010', 'The arbitration collection and item routes read and write arbitration rows for any steward of the organization, accept any grievanceId in the body and do not check that the steward holds the case.'),
  D('DEF-0B3-BARGAINING-PROPOSALS-NO-TENANT-PREDICATE', 14, 'HIGH', K006, 'bargaining_proposals has no organization column, so the generic factory adds no tenant predicate to reads, updates or deletes and the create accepts any negotiationId; isolation rests only on a row-level-security policy this tranche cannot show is applied.'),
  D('DEF-0B3-BILLING-SEND-BATCH-CROSS-TENANT-MUTATION', 14, 'HIGH', K006, 'The batch invoicing route selects every active subscription across all organizations and generates an invoice for each at an organization administrator role title, returning every organization id.'),
  D('DEF-0B3-BILLING-REPLAY-INVOICE-CROSS-TENANT-READ', 14, 'HIGH', K006, 'The invoice replay route selects the invoice and its line items by id with no organization predicate at a steward role floor, so one organization can read another organization invoice.'),
  D('DEF-0B3-BILLING-AUDIT-NOT-ATOMIC', 14, 'MEDIUM', K005, 'Invoice generation, invoice replay and trial expiry declare an atomic service audit, but invoice generation records auditLog after its inserts outside a transaction, replay records a separate access event, and trial expiry writes no audit record.'),
  D('DEF-0B3-BILLING-VALIDATE-LOG-ONLY-MISLABELLED', 14, 'MEDIUM', K005, 'The billing validation route records only application log events and labels ordinary validation failures unauthorized_access or auth_failed, so security monitoring cannot tell an attack from a wrong currency.'),
  D('DEF-0B3-ALERT-SWEEP-AUDIT-ATOMICITY-UNPROVEN', 14, 'MEDIUM', K005, 'The observability sweep writes alert rules, executions and notifications through the module-level db handle and its audit record through the sweep transaction handle; the source shows no proof that they commit together.'),
  D('DEF-0B3-AUDITS-FABRICATED-ENGAGEMENT-FIELDS', 14, 'MEDIUM', CAPABILITY_IDS_0B2.AUDIT_VISIBILITY, 'The audits list presents audit-log rows as audit engagements and invents status, findings 0 and hasReport false for every row.'),
  D('DEF-0B3-AUDIT-ROW-FULL-DISCLOSURE', 14, 'HIGH', CAPABILITY_IDS_0B2.AUDIT_VISIBILITY, 'The audit item route returns the complete audit_logs row, with details and any recorded address and agent, to an officer role floor with no redaction by reader.'),
  D('DEF-0B3-AUDITS-LEGACY-TABLE-NOT-CANONICAL', 14, 'MEDIUM', CAPABILITY_IDS_0B2.AUDIT_VISIBILITY, 'The audits routes read the audit_security audit_logs table, while persistAtomicAudit writes the domains infrastructure audit_logs table, so the routes do not show the audit records the atomic writers produce.'),
  D('DEF-0B3-BARGAINING-NOTES-SUMMARY-MODES-IGNORE-CONFIDENTIALITY', 14, 'HIGH', IDS.BARGAINING, 'The bargaining-notes GET returns timeline, statistics and session-type results before the visibleToUserId confidentiality filter is applied, and the timeline returns the title of every note of an agreement whatever its confidentiality level.'),
  D('DEF-0B3-BARGAINING-NOTE-ITEM-ROUTE-BYPASSES-CONFIDENTIALITY', 14, 'HIGH', IDS.BARGAINING, 'The bargaining-note item GET and PATCH are the generic factory: a member reads any note by id, including restricted and confidential notes the collection route withholds, and an update skips the agreement check the collection create applies.'),
  D('DEF-0B3-TENTATIVE-AGREEMENT-REFERENCES-UNVERIFIED', 14, 'MEDIUM', IDS.BARGAINING, 'Tentative agreement creation verifies the parent negotiation but stores relatedProposalIds and relatedClauseId without verifying that the proposals or clause belong to that negotiation or organization.'),
  D('DEF-0B3-BARGAINING-NEGOTIATION-RECORDS-MEMBER-READ', 14, 'HIGH', IDS.BARGAINING, 'Negotiation and tentative-agreement reads sit at the member floor and ignore confidentialityLevel, so strike-vote results, cost ceilings and costed agreements reach every member.'),
  D('DEF-0B3-TRIAL-EXPIRY-PLACEHOLDER-PAYMENT-CHECK', 14, 'HIGH', IDS.PLATFORM_BILLING, 'The trial-expiry route passes a payment-method checker that always returns false, so every expired trial of the organization is cancelled whether or not a payment method exists, at a steward role floor.'),
  D('DEF-0B3-SEND-INVOICE-NOT-SENT', 14, 'MEDIUM', IDS.PLATFORM_BILLING, 'The send-invoice route generates and stores an invoice and returns it; nothing is delivered, whatever the route name advertises.'),
  D('DEF-0B3-SUBSCRIPTION-ROLE-TITLE-AND-MEMBER-READ', 14, 'HIGH', IDS.PLATFORM_BILLING, 'Subscription commercial terms are readable at the member floor, pause, resume, invoice generation and trial expiry sit at the steward floor, and update and cancel sit at the secretary_treasurer role title, a union finance role; no source names the office with contract authority.'),
  D('DEF-0B3-METRICS-CLAIM-IDS-IN-MEMBER-READ', 14, 'HIGH', IDS.ANALYTICS_REPORT, 'calculateMetrics stores claim identifiers in the metric metadata and the metrics GET returns that metadata to every member at the member floor.'),
  D('DEF-0B3-METRICS-ORG-RESOLVED-TWICE', 14, 'MEDIUM', IDS.ANALYTICS_REPORT, 'The metrics routes resolve the organization once in the route wrapper and again in the action through getOrganizationIdForUser, and the action ignores the first, so a user with more than one membership may write to an organization other than the session organization.'),
  D('DEF-0B3-DERIVED-CASE-METRICS-FROM-TELEMETRY', 14, 'MEDIUM', IDS.ANALYTICS_REPORT, 'The derived case metrics and the weekly summary count pilot telemetry events and present them as case figures; open cases are created minus closed events and overdue cases are breached minus closed events, with no case table read.'),
  D('DEF-0B3-BREAK-COMPLIANCE-STEWARD-PER-MEMBER', 14, 'MEDIUM', IDS.ANALYTICS_REPORT, 'The break compliance report returns per-member denied, missed and flagged counts to any steward while the generic break route holds a member to their own rows, so the report is authorized more broadly than the records it is computed from.'),
  D('DEF-0B3-ALERT-INBOX-MEMBER-FLOOR-NO-REDACTION', 14, 'MEDIUM', IDS.OBSERVABILITY, 'The realtime alerts route returns the raw triggerData of alert executions, with SLA-risk, ingestion-failure and payment-failure counts, to every member under a case-suite entitlement, with no redaction and no named reader.'),
]

export function factsFor(id, readSource) {
  const [route, method] = id.split('|')
  if (BESPOKE_ROUTES.has(id)) return bespokeFacts(id)
  if (CRUD_ROUTES_0B3.has(route)) return crudFacts3(route, method, readSource(`${APP_API}${route}`), readSource)
  throw new Error(`no Gate 0B.3 facts for ${id}`)
}
