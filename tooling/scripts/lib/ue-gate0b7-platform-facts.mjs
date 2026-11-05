/**
 * Gate 0B.7 facts for the platform routes: the enterprise integrations create, the SSO provider register, the
 * entitlement list, the three equity routes, the two calendar event item routes and the integration extension item.
 *
 * Every quote is read from the exact handler, an import it uses or the service and schema definition it reaches. Two
 * facts shape the module. The three equity routes and the two event routes are the generic CRUD factory over tables
 * that do not hold what their paths name: the equity paths serve the saved member search table and the occurrence path
 * serves the event row itself. And two domains have no earlier capability that can own them: the identity-provider
 * register (nothing in the application reads it at sign-in) and equity self-identification (no application table holds
 * a self-identification answer or an equity statistic). Both get a capability that names what the source does and what
 * it lacks, and an outstanding decision for the choice no source states. Nothing here adopts a decision, claims
 * delivery or approves a route.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'
import { APP, CRUD_FACTORY, CRUD_GOVERNANCE, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const GATE = 14
const API = `${APP}app/api/`
const SCHEMA = `${APP}db/schema/`

const PROVIDER_CAP = 'UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS'
const BILLING_CAP = 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING'
export const SSO_CAP = 'UE-OMIT-ENTERPRISE-SSO-IDENTITY-PROVIDERS'
export const EQUITY_CAP = 'UE-OMIT-EQUITY-SELF-IDENTIFICATION'
const CRUD_CAP = 'UE-CAP-K-007'

const D_EQUITY = 'UE-INST-EQUITY-DATA-STEWARD'
const D_IDENTITY = 'UE-INST-IDENTITY-FEDERATION-ADMINISTRATOR'

const SSO_ROUTE = `${API}enterprise/sso/providers/route.ts`
const EXT_ROUTE = `${API}extensions/[id]/route.ts`
const ENT_ROUTE = `${API}entitlements/route.ts`
const EVENT_ROUTE = `${API}events/[id]/route.ts`
const OCC_ROUTE = `${API}events/[id]/occurrences/route.ts`
const SSO_SCHEMA = `${SCHEMA}sso-scim-schema.ts`
const INTEGRATION_SCHEMA = `${SCHEMA}integration-schema.ts`
const CONTRACTS_SCHEMA = `${SCHEMA}domains/finance/contracts.ts`
const CALENDAR_SCHEMA = `${SCHEMA}domains/scheduling/calendar.ts`
const FINANCIAL_SCHEMA = `${APP}services/financial-service/src/db/schema.ts`
const RECURRING = `${APP}lib/recurring-events-service.ts`
const INTEGRATIONS_WORKERS = `${APP}db/rls-storage-authority/integrations-workers.ts`
const SELF_FORM = `${APP}components/equity/SelfIdentificationForm.tsx`
const DASHBOARD = `${APP}components/equity/EquityDashboard.tsx`
const REGISTRATION_PAGE = `${APP}components/public/event-registration-page.tsx`
const ENCRYPTION = `${APP}lib/encryption.ts`

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const ROUTES = new Set([
  'enterprise/integrations/route.ts', 'enterprise/sso/providers/route.ts', 'entitlements/route.ts', 'equity/monitoring/route.ts',
  'equity/self-identify/route.ts', 'equity/snapshots/route.ts', 'events/[id]/occurrences/route.ts', 'events/[id]/route.ts',
  'extensions/[id]/route.ts',
])

export const GROUPS = {
  PLATFORM_PROVIDER_ACCOUNT_LINK_WRITES: {
    capabilityId: PROVIDER_CAP,
    domain: 'PROVIDER_ACCOUNT_LINK_WRITES',
    actor: 'Administrator attempting to create an organization integration through the route that is the generic factory over the per-user provider token table',
    routes: ['enterprise/integrations/route.ts'],
    methods: ['POST'],
    evidence: [
      ev(`${SCHEMA}user-management-schema.ts`, 'export const oauthProviders = userManagementSchema.table("oauth_providers", {'),
      ev(`${SCHEMA}user-management-schema.ts`, 'accessToken: text("access_token"),'),
    ],
  },
  PLATFORM_INTEGRATION_CONFIGURATIONS: {
    capabilityId: PROVIDER_CAP,
    domain: 'ORGANIZATION_INTEGRATION_CONFIGURATIONS',
    actor: 'Member reading, steward changing and administrator removing the configuration of a third-party HR, payroll or accounting integration of the organization',
    routes: ['extensions/[id]/route.ts'],
    evidence: [
      ev(INTEGRATION_SCHEMA, 'export const apiIntegrations = pgTable("api_integrations", {'),
      ev(INTEGRATION_SCHEMA, 'credentials: jsonb("credentials"), // Encrypted credentials'),
      ev(EXT_ROUTE, ' * Integration extensions endpoint'),
    ],
  },
  PLATFORM_CALENDAR_EVENT_ITEMS: {
    capabilityId: PROVIDER_CAP,
    domain: 'CALENDAR_EVENT_ITEMS',
    actor: 'Member reading, and steward or administrator changing, one calendar event of the organization',
    routes: ['events/[id]/route.ts'],
    evidence: [
      ev(CALENDAR_SCHEMA, "export const calendarEvents = pgTable('calendar_events', {"),
      ev(EVENT_ROUTE, ' * CRUD item route for calendarEvents'),
      ev(REGISTRATION_PAGE, 'const response = await fetch(`/api/events/${eventSlug}`);'),
    ],
  },
  PLATFORM_CALENDAR_EVENT_OCCURRENCES: {
    capabilityId: PROVIDER_CAP,
    domain: 'CALENDAR_EVENT_OCCURRENCES',
    actor: 'Member reading, and steward or administrator changing, one occurrence of a recurring calendar event through a path that addresses the event row',
    routes: ['events/[id]/occurrences/route.ts'],
    evidence: [
      ev(CALENDAR_SCHEMA, "recurrenceRule: text('recurrence_rule'), // RRULE string"),
      ev(CALENDAR_SCHEMA, "recurrenceExceptions: jsonb('recurrence_exceptions').$type<string[]>(), // Dates to exclude"),
      ev(RECURRING, 'export async function addRecurrenceException('),
    ],
  },
  PLATFORM_ORGANIZATION_ENTITLEMENTS: {
    capabilityId: BILLING_CAP,
    domain: 'ORGANIZATION_ENTITLEMENT_LIST',
    actor: 'Member whose client gates premium features from the list of feature keys the organization holds',
    routes: ['entitlements/route.ts'],
    evidence: [
      ev(CONTRACTS_SCHEMA, "export const orgEntitlements = pgTable('org_entitlements', {"),
      ev(CONTRACTS_SCHEMA, '// ORG ENTITLEMENTS  (runtime access — derived from contracts)'),
      ev(ENT_ROUTE, ' * Used by client components (e.g. sidebar) to gate premium features.'),
    ],
  },
  PLATFORM_SSO_PROVIDER_CONFIGURATION: {
    capabilityId: SSO_CAP,
    domain: 'ENTERPRISE_IDENTITY_PROVIDER_REGISTER',
    actor: 'Member listing, and administrator registering, the SAML or OIDC identity providers of the organization',
    routes: ['enterprise/sso/providers/route.ts'],
    evidence: [
      ev(SSO_SCHEMA, 'export const ssoProviders = pgTable("sso_providers", {'),
      ev(SSO_SCHEMA, 'roleMapping: jsonb("role_mapping"),'),
      ev(SSO_ROUTE, ' * SSO Providers endpoint'),
    ],
  },
  PLATFORM_EQUITY_SELF_IDENTIFICATION: {
    capabilityId: EQUITY_CAP,
    domain: 'EQUITY_SELF_IDENTIFICATION',
    actor: 'Member voluntarily self-identifying equity-group membership after consent, and the union holding those answers',
    routes: ['equity/self-identify/route.ts'],
    evidence: [
      ev(SELF_FORM, "const response = await fetch('/api/equity/self-identify', {"),
      ev(SELF_FORM, '<li>Individual data is never shared - only aggregated statistics with 10+ member minimum</li>'),
      ev(FINANCIAL_SCHEMA, 'export const equitySnapshots = pgTable("equity_snapshots", {'),
    ],
  },
  PLATFORM_EQUITY_MONITORING_AND_SNAPSHOTS: {
    capabilityId: EQUITY_CAP,
    domain: 'EQUITY_MONITORING_AND_SNAPSHOTS',
    actor: 'Officer or steward reading aggregate equity statistics and generating a dated equity snapshot of the membership',
    routes: ['equity/monitoring/route.ts', 'equity/snapshots/route.ts'],
    evidence: [
      ev(DASHBOARD, 'const statsRes = await fetch(`/api/equity/monitoring?organizationId=${organizationId}`);'),
      ev(DASHBOARD, "const res = await fetch('/api/equity/snapshots', {"),
      ev(FINANCIAL_SCHEMA, 'export const equitySnapshots = pgTable("equity_snapshots", {'),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_EQUITY,
    status: 'OUTSTANDING',
    question: 'Which office of the union holds equity self-identification answers, who may read an individual answer and who only aggregates, what minimum group size suppresses a published count, how long an answer is kept and how Indigenous data governance (ownership, control, access, possession) is honoured?',
    sourceState: 'The self-identification form text promises encryption, aggregate-only reporting with a ten-member minimum, withdrawal and deletion at any time, seven-year retention and Indigenous data governance, but no adopted decision, schema table, service or route names the data steward, the readers, the minimum cell size or the retention rule. The only equity table, equity_snapshots, is declared in the financial-service schema, is revoked from the application runtime and system roles, and stores executive-board and steward counts by group and average pay by gender with no suppression rule.',
    softwareOwners: [EQUITY_CAP],
  },
  {
    id: D_IDENTITY,
    status: 'OUTSTANDING',
    question: 'Which office may register, change and remove an external SAML or OIDC identity provider for an organization, how is the organization shown to own the identity domain the provider asserts, and which provider groups may confer which tenant roles?',
    sourceState: 'The register route lets any administrator of the organization insert a provider with an unverified issuer or entity id, defaults autoProvision and enabled to true and limits the role mapping to the four tenant-assignable roles; no source names an identity-federation office, a domain ownership proof or a review by platform staff, and no sign-in path reads the table.',
    softwareOwners: [SSO_CAP],
  },
]

export const CAPABILITIES = [
  {
    id: SSO_CAP,
    parentRegisterId: 'UE-CONV-A-004',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'enterprise-sso-identity-providers',
    primaryGate: GATE,
    dependencyGates: [1, 13],
    actor: 'Member listing, and administrator registering, the SAML or OIDC identity providers of the organization',
    businessOutcome: 'An identity provider is registered only by the office the institution names, with an issuer or entity id the organization is shown to own and endpoints that are validated, credentials that are encrypted and never returned, provisioning that is off until reviewed, a role mapping limited to roles the registering office may assign, and every change committed with its audit record; the register can be changed, disabled and removed, and the configuration it holds is the one a sign-in path actually reads.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/enterprise/sso/providers',
    service: `${APP}app/api/enterprise/sso/providers/route.ts`,
    sourceFiles: [`${APP}app/api/enterprise/sso/providers/route.ts`, `${APP}db/schema/sso-scim-schema.ts`, `${APP}lib/encryption.ts`],
    proof: [{ type: 'path', ref: `${APP}app/api/enterprise/sso/providers/route.ts` }],
    auditEvidence: 'The create runs in withRLSContext and commits persistAtomicAudit (sso.provider.create, with provider type, provisioning flags and role mapping) with the row. The list is not audited. No update, disable or delete route exists.',
    privacyClassification: 'Identity-provider configuration of one organization: entity ids and endpoints, OIDC client id, encrypted client secret, IdP group to role mapping, provisioning flags and the creating administrator.',
    gap: 'No capability named enterprise identity providers before Gate 0B.7. UE-CAP-A-002 and UE-CAP-A-004 concern the kernel provider resolver and the session cookie, UE-CAP-K-005 and UE-CAP-K-006 concern audit and tenant predicates in general, and none owns the obligation of a tenant-registered identity provider. The register is the only code that touches sso_providers: no sign-in, token exchange, provisioning or SCIM path reads it, so a registered provider never takes effect; the list returns every column except the certificate and client secret to any member; the create stores the provider type, endpoints, certificate and mappings as supplied with no validation, no uniqueness and no ownership proof, and defaults provisioning and enabled to true; and no route can change, disable or delete a provider. The role mapping is validated against the tenant-assignable roles and the client secret is encrypted before it is stored, which this record keeps. It closes none of the defects and names no identity-federation office, which no source states.',
  },
  {
    id: EQUITY_CAP,
    parentRegisterId: 'UE-CONV-K-007',
    relatedRegisterIds: ['UE-CONV-K-005', 'UE-CONV-F-003'],
    obligationKey: 'equity-self-identification-and-monitoring',
    primaryGate: GATE,
    dependencyGates: [6, 13],
    actor: 'Member voluntarily self-identifying after consent; officer or steward reading aggregate equity statistics and snapshots',
    businessOutcome: 'A member answers voluntarily after a recorded consent that can be withdrawn, each answer is held in a table built for it, linked to the member only where the union has decided it must be and readable by no one but the office the union names, published counts are aggregates that suppress groups below a decided minimum size, a snapshot is computed from consented answers and retained for the decided period, and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/equity',
    service: `${APP}app/api/equity/self-identify/route.ts`,
    sourceFiles: [`${APP}app/api/equity/self-identify/route.ts`, `${APP}app/api/equity/monitoring/route.ts`, `${APP}app/api/equity/snapshots/route.ts`, `${APP}components/equity/SelfIdentificationForm.tsx`, `${APP}components/equity/EquityDashboard.tsx`],
    proof: [{ type: 'path', ref: `${APP}app/api/equity/self-identify/route.ts` }],
    auditEvidence: 'Writes through the generic CRUD factory over member_segments commit persistAtomicAudit with the row. Reads are not audited. No consent, withdrawal or deletion is recorded anywhere.',
    privacyClassification: 'Special-category personal data when built: gender identity, Indigenous identity and nation, visible minority, disability and accommodation, LGBTQ2+ and newcomer status, and group counts that can identify a person in a small cell. Today the routes hold none of it.',
    gap: 'No capability named equity before Gate 0B.7, and UE-OMIT-PRIVACY-RIGHTS (receiving and fulfilling access, correction and portability requests) does not own a collection and monitoring programme. The three equity routes are the generic CRUD factory over member_segments, the saved member-search table: no self-identification, consent, monitoring or snapshot table exists in the application schema, equity_snapshots is declared only in the financial-service schema and revoked from the application roles, and the form and dashboard components that call the routes are mounted by no page. The form shows a consent text promising encryption, aggregate-only reporting with a ten-member minimum, deletion at any time and seven-year retention, none of which any source implements; the consent flag is a literal in the client body; the write floor is steward, so the member the form is for receives 403; the insert needs a name and filters the form never sends; and the reads return every saved segment, private ones included, to any member. This record closes none of them and names no data steward, reader, minimum group size or retention rule, which no source states.',
  },
]

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, gate: GATE, severity, title, ownerCapabilityId, ...extra })

export const DEFECTS = [
  D('DEF-0B7-PLT-EXT-GET-RETURNS-WHOLE-INTEGRATION-ROW-WITH-CREDENTIALS', PROVIDER_CAP, 'HIGH', 'The extensions item read selects the whole api_integrations row and returns it as it is to any member of the organization: the credentials jsonb column (documented as encrypted, though no code in the application writes or encrypts it), the SFTP host, port and path and the API endpoint of an HR, payroll or accounting connection are returned with no projection and no redaction, unlike the sibling SSO list, which masks its secrets.', {
    releaseDisposition: {
      disposition: 'CONDITIONALLY_BLOCKING',
      actualExposure: 'Any active member of an organization (minRole member, no entitlement, no further check) who holds an integration uuid of their own organization receives the whole api_integrations row, including the credentials column, the SFTP location and the API endpoint; the organization predicate keeps the response inside the tenant, and the application has no route that creates the rows, so the response carries credentials only for a row that exists.',
      potentialImpact: {
        classes: ['SAME_TENANT_OVER_DISCLOSURE'],
        description: 'A member who is not an officer could read the stored credentials of the organization HR, payroll or accounting connections and use them against the external system, reaching employee and pay data that no member role grants.',
      },
      activationState: 'REACHABLE_ANY_AUTHENTICATED',
      activationEvidence: [
        { ref: 'apps/union-eyes/app/api/extensions/[id]/route.ts', quote: "auth: { required: true, minRole: 'member' }," },
        { ref: 'apps/union-eyes/app/api/extensions/[id]/route.ts', quote: 'const [integration] = await db' },
      ],
      existingContainment: {
        summary: 'The application exposes no route that creates or imports api_integrations rows, so a row, and therefore credentials, exists only if it was written outside the HTTP surface; the lookup is also bound to the caller organization.',
        evidence: [
          { ref: INTEGRATIONS_WORKERS, quote: 'No collection route exists, so INSERT is not HTTP-reachable.' },
          { ref: 'apps/union-eyes/app/api/extensions/[id]/route.ts', quote: 'eq(apiIntegrations.organizationId, organizationId),' },
        ],
      },
      blockingCondition: 'The defect blocks release as soon as any api_integrations row holding credentials exists in a production organization, whether written by an import, a migration or a future collection route, because from then on every member of that organization can read those credentials.',
      justification: 'The route returns stored credentials to the lowest role with no redaction, which would be release blocking on its own. It is held to a condition only because the application cannot create the rows, so the disclosure is empty until a row exists; the condition is concrete and the repair is a projection that omits the credentials.',
    },
  }),
  D('DEF-0B7-PLT-EXT-PATCH-STEWARD-FLOOR-REWRITES-ENDPOINT-AND-MAPPING', PROVIDER_CAP, 'MEDIUM', 'A steward can change the apiEndpoint, the fieldMapping that maps Union Eyes member fields to the external HR or payroll system, the enabled flag and the sync frequency of an organization integration, while removing the same integration needs an administrator; the endpoint is accepted as any URL up to 2000 characters, the mapping as any JSON object, and the audit record names only the fields changed.'),
  D('DEF-0B7-PLT-EXT-DELETE-HARD-DELETE-CASCADES-SYNC-LOG-HISTORY', PROVIDER_CAP, 'LOW', 'The extensions delete removes the api_integrations row outright, and integration_sync_logs references it with onDelete cascade, so deleting an integration silently erases its whole sync history (records processed, failed, errors, triggering user) while the audit record keeps only the integration id and name.'),
  D('DEF-0B7-PLT-EXT-CONFIGURATION-HAS-NO-CREATE-PATH-AND-NO-CONSUMER', PROVIDER_CAP, 'MEDIUM', 'The extensions route reads, changes and deletes api_integrations rows under the name of an extension registry, but no route creates a row and nothing outside the route and the schema reads the table or its apiEndpoint, so enabling an integration, setting a sync frequency or repointing an endpoint is audited as integration.update and returns the updated row while no synchronization exists that the change could affect.'),
  D('DEF-0B7-PLT-EVENT-ITEM-IGNORES-PRIVATE-VISIBILITY-AND-RETURNS-MEETING-PASSWORD', PROVIDER_CAP, 'MEDIUM', 'The event item read returns the whole calendar_events row to a steward or above, including meetingPassword, meetingUrl, agenda and attachments, whatever the row isPrivate and visibility columns say, because the generic factory and the route consult neither; below steward the only narrowing is memberId equal to the session user, so confidential events that name no member are unreachable to members and fully open to every steward.'),
  D('DEF-0B7-PLT-EVENT-ITEM-PUBLIC-REGISTRATION-CALLER-EXPECTS-PUBLIC-EVENT', PROVIDER_CAP, 'LOW', 'The public event registration component fetches /api/events/{slug} without credentials and renders ticket price and free status, but the route requires an authenticated session at the member floor, compares the path value to the uuid primary key of calendar_events, and calendar_events has no slug, ticket price or free flag, so the public page can never load an event through it and a slug that is not a uuid reaches the database as a uuid comparison.'),
  D('DEF-0B7-PLT-EVENT-OCCURRENCES-PATH-ADDRESSES-WHOLE-EVENT-ROW', PROVIDER_CAP, 'MEDIUM', 'The occurrences route file is byte-identical to the event item route: its path value is the event id, and it reads, updates and deletes the calendar_events row itself, so a call that advertises one occurrence of a recurring event changes or removes the whole series row; recurrenceExceptions and parentEventId are never consulted, and the recurrence service that can add an exception or delete future instances is imported by no route.'),
  D('DEF-0B7-PLT-ENT-LISTS-EXPIRED-AND-UNBACKED-ENTITLEMENTS-AS-ACTIVE', BILLING_CAP, 'LOW', 'The entitlement list returns every feature key whose org_entitlements status is active and ignores expiresAt and the backing contract, whereas the server-side entitlement check refuses an expired entitlement and verifies that the contract is active, so a client that gates premium features from this list shows a module as held after its entitlement has expired or its contract has ended.'),
  D('DEF-0B7-PLT-ENT-EMPTY-200-WITHOUT-ORGANIZATION-AND-SECOND-RESOLUTION', BILLING_CAP, 'LOW', 'The entitlement list answers 200 with an empty feature list for a caller whose organization cannot be resolved, which a client cannot tell from an organization that holds no entitlement, and it re-resolves the organization with getCurrentUser instead of using the organizationId its wrapper already placed in the context, reading org_entitlements through the shared db import with no tenant context.'),
  D('DEF-0B7-PLT-SSO-LIST-DISCLOSES-PROVIDER-CONFIGURATION-AT-MEMBER-FLOOR', SSO_CAP, 'MEDIUM', 'The SSO provider list is open to every member and returns every column except the certificate and client secret, so any member reads the identity-provider entity ids, endpoints, OIDC client ids, the attribute mapping, the role mapping that says which directory groups become administrator or steward, the required groups, the metadata and the user id of the administrator who created each provider.'),
  D('DEF-0B7-PLT-SSO-CREATE-STORES-UNVALIDATED-CONFIGURATION-ENABLED-BY-DEFAULT', SSO_CAP, 'MEDIUM', 'The SSO provider create casts the body to an interface and checks only that name, providerType and attributeMapping are present: providerType is any string although the schema comment allows saml and oidc, the entity id, SSO URL, issuer and certificate are not parsed or checked, the required fields of the chosen type are not required, there is no unique index on organization, entity id or issuer and no proof the organization owns the identity domain, requireGroups cannot be set, and autoProvision and enabled default to true.'),
  D('DEF-0B7-PLT-SSO-CONFIGURATION-NEVER-CONSUMED-BY-SIGN-IN', SSO_CAP, 'MEDIUM', 'No sign-in, token-exchange, provisioning or SCIM code reads sso_providers: the register route is the only reader and writer, so a provider an administrator registers with enabled and autoProvision true and an audit record of sso.provider.create never takes effect, and the decryption helper meant for the OIDC token exchange has no caller; the response reports a configured provider that nothing uses.'),
  D('DEF-0B7-PLT-SSO-NO-UPDATE-DISABLE-OR-DELETE-ROUTE', SSO_CAP, 'LOW', 'The register offers only a list and a create: no route changes, disables, rotates the secret of or deletes a provider, so a mistaken or compromised configuration can be corrected only by direct database work and the enabled flag set at creation cannot be turned off through the application.'),
  D('DEF-0B7-PLT-EQUITY-ROUTES-ARE-MEMBER-SEGMENT-CRUD-FACADE', EQUITY_CAP, 'MEDIUM', 'The equity monitoring, self-identification and snapshot routes advertise the collection and statistics of special-category equity data but are the generic CRUD factory over member_segments, the saved member-search table: no self-identification answer, consent, statistic or snapshot is read, computed or stored, the dashboard receives a page of segment rows where it expects statistics and snapshots, and a create from the form or the generate-snapshot button lacks the name and filters the table requires.'),
  D('DEF-0B7-PLT-EQUITY-READS-RETURN-PRIVATE-SEGMENTS-TO-ANY-MEMBER', EQUITY_CAP, 'MEDIUM', 'The member-floor reads behind the equity paths return every member_segments row of the organization, including segments whose isPublic is false, because the table has no user or member owner column and the factory adds only the organization predicate, so any member reads the saved filter criteria (status, role, employer, worksite, bargaining unit, seniority) that stewards built privately.'),
  D('DEF-0B7-PLT-EQUITY-CONSENT-AND-PRIVACY-PROMISES-NOT-BACKED-BY-SERVER', EQUITY_CAP, 'MEDIUM', 'The self-identification form puts a consent text before the member that promises encryption, aggregate-only reporting with a ten-member minimum, withdrawal and deletion at any time and seven-year retention, and then submits dataCollectionConsent true as a literal in the client body; the route stores no consent record, has no encryption, minimum cell size, withdrawal, deletion or retention behavior, and takes memberId and organizationId from the body that it ignores, so the assurances given at the point of consent are not implemented anywhere.'),
  D('DEF-0B7-PLT-EQUITY-SELF-IDENTIFY-WRITE-FLOOR-EXCLUDES-DATA-SUBJECT', EQUITY_CAP, 'LOW', 'The self-identification create requires a steward, so the member the form is addressed to receives 403 on submit, while a steward or above is allowed to post a row on the member behalf with any body; a voluntary self-report that the union says is the member own choice is therefore reachable only by staff.'),
  D('DEF-0B7-PLT-EQUITY-SNAPSHOT-SCHEMA-HAS-NO-SMALL-CELL-RULE', EQUITY_CAP, 'LOW', 'The only snapshot table, equity_snapshots in the financial-service schema, stores counts of Indigenous, visible-minority, disability and LGBTQ2+ members, executive-board and steward counts by group and average hourly pay by gender with no suppression flag, minimum group size or reader restriction, so a snapshot of a small board or worksite would publish counts that identify individuals; the table is revoked from the application roles today, which is why no route can reach it.'),
]

/* ------------------------------------------------------------------------------------------------------------ */
/* shared                                                                                                         */
/* ------------------------------------------------------------------------------------------------------------ */

const ORG_SCOPE_NO_OP = 'DEF-0B6-CMP-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN'
const withApiAuthn = (role) => `${SESSION} (withApi auth.required, minRole ${role}).`
const READ_NOTE = 'A read: the handler writes no row and records no audit event.'

const renameOrgScope = (record) => {
  record.defects = [...new Set(record.defects.map((id) => (id === 'DEF-0B4-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN' ? ORG_SCOPE_NO_OP : id)))]
  return record
}

/* ------------------------------------------------------------------------------------------------------------ */
/* enterprise/integrations POST: the generic factory over the denied per-user token table                          */
/* ------------------------------------------------------------------------------------------------------------ */

const integrationsPost = (a) => mk({
  persona: 'Administrator attempting to create an organization integration through the generic CRUD factory',
  service: `${CRUD_FACTORY} (crudRoutes over oauth_providers)`,
  authn: 'Authenticated session resolved by the generic CRUD factory (crudRoutes over withApi).',
  authz: "Generic CRUD role floor: POST declares an admin write floor; the factory then refuses the write because oauth_providers is DENIED in the CRUD governance table. A role title is not a kernel decision.",
  tenant: 'orgScoped: true is a no-op here: the table has no organization column, so the insert would carry no tenant predicate; the factory refuses before any row is written.',
  owner: 'oauth_providers rows, each belonging to one user: provider name, provider account id, provider data and the access and refresh tokens; the table has no organization column.',
  sens: 'Provider account ids, provider data and the OAuth access and refresh tokens of a user',
  priv: 'Nothing is written: the factory refuses every write to this denied table, so no token is stored; were the denial lifted, an administrator could insert any user provider tokens from the body into a table no organization predicate can scope.',
  mut: 'WRITE_REFUSED_BY_GOVERNANCE',
  auditDetail: 'oauth_providers is DENIED in the CRUD governance table, so assertCrudWrite refuses the write with 403 before any row or audit record is written; nothing is mutated and nothing is audited.',
  reqAudit: 'No audit record is required for a refused write; a dedicated route that creates an organization integration must commit its audit record in the same transaction as the row.',
  does: 'Refuses with 403 before any insert: oauth_providers is DENIED in the CRUD governance table, so no integration or provider link can be created through the route.',
  status: 'LATENT_NOT_OPERATIONAL',
  gate: GATE,
  deps: [1, 13],
  future: 'Decide whether organization integrations are created through a dedicated, organization-scoped route that never takes tokens from a body, and answer 501 until then.',
  ev: [
    a.h('authorization', "writeRole: 'admin',"),
    ...guardEv(a, 'crud'),
    a.h('tenantScope', 'orgScoped: true,'),
    a.tbl('tenantScope', 'oauthProviders', /pgTable\(|\.table\(/, { absentColumns: ['organizationId'] }),
    a.sch('scope', CRUD_GOVERNANCE, "'oauth_providers'"),
    a.tbl('privacy', 'oauthProviders', /accessToken: text\("access_token"\),/),
    a.imp('mutation', 'crudRoutes', 'assertCrudWrite(governance);'),
    a.sch('audit', CRUD_GOVERNANCE, 'export function assertCrudWrite'),
  ],
  inf: [{ claim: 'defect', statement: 'The route configuration names providerId as the primary key and declares no ownerColumn, so were the denial lifted the factory would insert provider rows from the body with no owner condition and no organization.' }],
  def: [ORG_SCOPE_NO_OP, 'DEF-0B6-CMP-INTEGRATIONS-ROUTE-OVER-USER-TOKEN-TABLE'],
  corr: [{ field: 'audit', manifest: 'audit CRUD_ATOMIC', actual: 'oauth_providers is DENIED in the CRUD governance table, so the write is refused before any row or audit record is written.' }],
  crudTable: 'oauth_providers',
  crudClass: 'DENIED',
})

/* ------------------------------------------------------------------------------------------------------------ */
/* enterprise/sso/providers                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

const ssoBase = {
  service: `${SSO_ROUTE} (withApi over sso_providers)`,
  owner: 'sso_providers rows of the organization: provider name and type, SAML entity id, SSO URL and certificate, OIDC issuer, client id and encrypted client secret, attribute and role mappings, provisioning flags and the creating user.',
  sens: 'Identity-provider configuration: entity ids and endpoints, OIDC client ids, the identity-provider group to tenant role mapping, provisioning flags and creator ids; the certificate and client secret are masked to booleans in every response',
  gate: GATE,
  deps: [1, 13],
  status: 'PARTIAL',
  dec: [D_IDENTITY],
}

const ssoNeverConsumed = {
  claim: 'defect',
  statement: 'sso_providers is referenced by this route file and its schema file only: no sign-in, token-exchange, provisioning or SCIM module of the application imports ssoProviders, and decryptSecret, the helper documented for the OIDC token exchange, is called by no route or service, so the stored configuration is never read at sign-in.',
}

const ssoGet = (a) => mk({
  ...ssoBase,
  persona: 'Member of the organization listing the SAML and OIDC identity providers of the organization',
  authn: withApiAuthn('member'),
  authz: 'withApi minRole member: any member of the organization may list the identity-provider configuration. A role floor of member is not an authority to read identity-federation settings, and the route calls no kernel decision.',
  cat: 'ROLE_FLOOR',
  tenant: 'The select carries an organization predicate on organizationId from the withApi session context and a missing organization is refused with 400; the read uses the shared db import with no withRLSContext, so that predicate is the only tenant control.',
  priv: 'The certificate and client secret are masked to true or null, but every other column reaches every member: entity id, SSO URL, issuer, client id, attribute and role mapping, required groups, metadata and the user id of the creating administrator.',
  mut: 'NOT_MUTATING',
  auditDetail: READ_NOTE,
  reqAudit: 'Restrict the read to the office that administers identity federation and audit each read once that office is named; the role mapping reveals which directory groups become administrator or steward.',
  does: 'Returns every sso_providers row of the session organization, unbounded and unordered, with samlCertificate and oidcClientSecret replaced by a boolean, to any member.',
  future: 'Read provider configuration only for the office that administers identity federation, return a purpose-built projection without role mapping and creator ids for other readers, and bound the list.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'if (!organizationId) throw ApiError.badRequest(\'Organization context required\');'),
    a.h('tenantScope', '.where(eq(ssoProviders.organizationId, organizationId));'),
    a.h('mutation', '.select()'),
    a.h('privacy', 'oidcClientSecret: oidcClientSecret ? true : null,'),
    a.h('privacy', '...safe,'),
    a.sch('privacy', SSO_SCHEMA, 'roleMapping: jsonb("role_mapping"),', { symbol: 'ssoProviders' }),
    a.sch('privacy', SSO_SCHEMA, 'createdBy: varchar("created_by", { length: 255 }).notNull(),', { symbol: 'ssoProviders' }),
  ],
  inf: [ssoNeverConsumed],
  def: ['DEF-0B7-PLT-SSO-LIST-DISCLOSES-PROVIDER-CONFIGURATION-AT-MEMBER-FLOOR', 'DEF-0B7-PLT-SSO-CONFIGURATION-NEVER-CONSUMED-BY-SIGN-IN'],
})

const ssoPost = (a) => mk({
  ...ssoBase,
  persona: 'Administrator of the organization registering a SAML or OIDC identity provider',
  authn: withApiAuthn('admin'),
  authz: 'withApi minRole admin: an administrator of the organization may register a provider, and a role mapping may name only the tenant-assignable roles. A role floor of admin is not a named identity-federation office or a kernel decision, and the route calls none.',
  cat: 'ROLE_FLOOR',
  tenant: 'organizationId and the creating user id come from the withApi session context and are written into the row by the route, never from the body; the insert runs in withRLSContext and a missing organization or user is refused with 400. The provider type, issuer and entity id the body names are not checked against any organization.',
  priv: 'The response returns the created row with samlCertificate and oidcClientSecret masked to booleans; the secret is encrypted with the Key Vault-backed service before it is stored, the certificate is stored as supplied, and the audit record carries the provider type, flags and role mapping but not the secret.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The sso_providers insert and persistAtomicAudit (sso.provider.create, with provider type, autoProvision, enabled and the role mapping) commit in one withRLSContext transaction.',
  reqAudit: 'Keep the in-transaction audit record, add the identity-federation authority that permitted the registration and the validated issuer to it, and audit the encryption of the secret.',
  does: 'Validates that name, providerType and attributeMapping are present and that every role in the role mapping is a tenant-assignable role, encrypts the OIDC client secret, inserts a provider row for the session organization with autoProvision and enabled defaulting to true, audits it in the same transaction and returns the row with the credentials masked.',
  future: 'Validate the provider type and the required fields of each type, parse and verify the endpoints and certificate, prove the organization owns the identity domain, default provisioning off until reviewed, enforce uniqueness, name the office that may register providers, and make a registered provider something a sign-in path reads.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'admin' },"),
    a.h('authorization', 'if (typeof role !== \'string\' || !assignable.includes(role)) {'),
    a.h('tenantScope', 'organizationId: organizationId!,'),
    a.h('tenantScope', 'if (!organizationId) throw ApiError.badRequest(\'Organization context required\');'),
    a.h('mutation', '.insert(ssoProviders)'),
    a.h('mutation', 'const created = await withRLSContext(async (tx) => {'),
    a.h('mutation', 'oidcClientSecret: encryptedOidcClientSecret,'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'sso.provider.create',"),
    a.h('defect', "if (!name || !providerType || !attributeMapping) {"),
    a.h('defect', 'autoProvision: autoProvision ?? true,'),
    a.h('defect', 'enabled: enabled ?? true,'),
    a.h('defect', 'samlCertificate,'),
    a.sch('defect', SSO_SCHEMA, 'providerType: varchar("provider_type", { length: 50 }).notNull(), // \'saml\' | \'oidc\'', { symbol: 'ssoProviders' }),
    a.sch('defect', SSO_SCHEMA, 'requireGroups: text("require_groups").array(), // Required IdP groups', { symbol: 'ssoProviders' }),
    a.svc('defect', ENCRYPTION, 'return encryptionService.encryptToString(plaintext);', 'encryptSecret'),
  ],
  inf: [
    { claim: 'defect', statement: 'The sso_providers table declaration has no index or unique constraint block, the route takes no domain, and the destructured body has no requireGroups, so two organizations may register the same issuer or entity id, the organization is never shown to own the identity domain the provider asserts, and a provider cannot be limited to directory groups through this route.' },
    ssoNeverConsumed,
    { claim: 'defect', statement: 'The route directory holds a list and a create and a test file only: there is no item route or other method on this path, so a provider cannot be updated, disabled, rotated or deleted through the application.' },
  ],
  def: [
    'DEF-0B7-PLT-SSO-CREATE-STORES-UNVALIDATED-CONFIGURATION-ENABLED-BY-DEFAULT',
    'DEF-0B7-PLT-SSO-CONFIGURATION-NEVER-CONSUMED-BY-SIGN-IN',
    'DEF-0B7-PLT-SSO-NO-UPDATE-DISABLE-OR-DELETE-ROUTE',
  ],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* entitlements                                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

const entitlementsGet = (a) => mk({
  persona: 'Member whose client reads the feature keys the organization holds to gate premium features in the sidebar',
  service: `${ENT_ROUTE} (withApiAuth over org_entitlements)`,
  authn: 'Authenticated session resolved by withApiAuth, which delegates to withApi when the current-state context is enabled.',
  authz: 'withApiAuth with no role floor and no entitlement: any authenticated caller receives the feature keys of the organization the handler resolves. The route calls no kernel decision.',
  cat: 'SESSION_ONLY',
  tenant: 'The select carries an organization predicate on the organization of getCurrentUser, resolved by the handler itself and not taken from the context the wrapper supplies; the read uses the shared db import with no withRLSContext; a caller with no organization receives 200 with an empty list.',
  owner: 'org_entitlements rows of the organization: feature key, status, expiry, usage limit and the backing contract line item; the route returns only the feature keys.',
  sens: 'The set of platform modules an organization holds, which discloses its commercial plan',
  priv: 'Only feature keys of the caller own organization are returned; no usage, contract or price is included, so the disclosure is the organization own module list to any of its members.',
  mut: 'NOT_MUTATING',
  auditDetail: READ_NOTE,
  reqAudit: 'Reads of the module list need no audit record; entitlement grants and revocations must commit their audit record with the row in the contract lifecycle that writes them.',
  does: 'Returns the feature keys of org_entitlements rows with status active for the organization of getCurrentUser, with no check of the expiry date or the backing contract, and an empty list when no organization resolves.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Return the entitlements the server-side check would allow (status, expiry and backing contract), use the organization of the wrapper context, and answer a clear error rather than an empty list when no organization resolves.',
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.imp('authorization', 'withApiAuth', 'const requireAuth = options.requireAuth !== false && !isPublic'),
    a.h('tenantScope', 'const orgId = user?.organizationId;'),
    a.h('tenantScope', 'eq(orgEntitlements.organizationId, orgId),'),
    a.h('tenantScope', 'return NextResponse.json({ featureKeys: [] });'),
    a.h('mutation', '.select({ featureKey: orgEntitlements.featureKey })'),
    a.h('defect', "eq(orgEntitlements.status, 'active'),"),
    a.tbl('defect', 'orgEntitlements', /expiresAt: timestamp\('expires_at', \{ withTimezone: true \}\),/),
    a.tbl('defect', 'orgEntitlements', /contractLineItemId: uuid\('contract_line_item_id'\)/),
  ],
  inf: [
    { claim: 'defect', statement: 'checkModuleEntitlement in services/platform-economics/entitlement-guard.ts selects the same active rows and then refuses an entitlement whose expiresAt is in the past and, through verifyBackingContract, one whose contract is not active or has expired; this route applies neither, so the two answers to the same question differ.' },
  ],
  def: ['DEF-0B7-PLT-ENT-LISTS-EXPIRED-AND-UNBACKED-ENTITLEMENTS-AS-ACTIVE', 'DEF-0B7-PLT-ENT-EMPTY-200-WITHOUT-ORGANIZATION-AND-SECOND-RESOLUTION'],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* extensions/[id]                                                                                                */
/* ------------------------------------------------------------------------------------------------------------ */

const extBase = {
  service: `${EXT_ROUTE} (withApi over api_integrations)`,
  owner: 'api_integrations rows of the organization: integration name and type, provider, connection type, API endpoint, credentials, SFTP host, port and path, field mapping, sync direction, schedule and status counters.',
  sens: 'Configuration of third-party HR, payroll and accounting connections, including the credentials column, the SFTP location, the API endpoint and the mapping of member fields to the external system',
  gate: GATE,
  deps: [1, 13],
  status: 'PARTIAL',
}

const extNoConsumer = {
  claim: 'defect',
  statement: 'Outside this route and the schema declaration, no module of the application imports apiIntegrations, and the app/api/extensions directory holds only the [id] item route, so no route creates a row and no synchronization code reads the table, its apiEndpoint, its schedule or its credentials.',
}

const extGet = (a) => mk({
  ...extBase,
  persona: 'Member of the organization reading the configuration of an integration of the organization',
  authn: withApiAuthn('member'),
  authz: 'withApi minRole member: any member may read an integration. A role floor of member is not an authority to read the credentials of the organization HR or payroll connections, and the route calls no kernel decision.',
  cat: 'ROLE_FLOOR',
  tenant: 'The select carries an organization predicate on organizationId from the withApi session context in the same where clause as the path id, so another organization integration answers 404; the read uses the shared db import with no withRLSContext, so that predicate is the only tenant control.',
  priv: 'The whole row is returned with no projection: the credentials jsonb column, the SFTP host, port and path, the API endpoint and the field mapping reach every member of the organization.',
  mut: 'NOT_MUTATING',
  auditDetail: READ_NOTE,
  reqAudit: 'Audit reads of an integration once the offices that may read its configuration are named, and never return the credentials column.',
  does: 'Returns the api_integrations row whose id is the path value and whose organization is the session organization, complete with every column, or 404.',
  future: 'Return a projection that omits the credentials and the connection secrets, restrict the read to the office that administers integrations, and validate the path id as a uuid.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'eq(apiIntegrations.organizationId, organizationId),'),
    a.h('tenantScope', "if (!organizationId) throw ApiError.badRequest('Organization context required');"),
    a.h('mutation', '.select()'),
    a.h('privacy', 'return integration;'),
    a.tbl('privacy', 'apiIntegrations', /credentials: jsonb\("credentials"\), \/\/ Encrypted credentials/),
    a.tbl('privacy', 'apiIntegrations', /sftpHost: varchar\("sftp_host", \{ length: 255 \}\),/),
  ],
  inf: [
    { claim: 'defect', statement: 'The credentials column comment says Encrypted, but no code in the application writes the column or calls an encryption helper for it, so what the row holds, and what this response returns, is whatever was written outside the application.' },
    extNoConsumer,
  ],
  def: ['DEF-0B7-PLT-EXT-GET-RETURNS-WHOLE-INTEGRATION-ROW-WITH-CREDENTIALS', 'DEF-0B7-PLT-EXT-CONFIGURATION-HAS-NO-CREATE-PATH-AND-NO-CONSUMER'],
})

const extPatch = (a) => mk({
  ...extBase,
  persona: 'Steward of the organization changing the name, endpoint, field mapping, sync frequency or enabled flag of an integration',
  authn: withApiAuthn('steward'),
  authz: 'withApi minRole steward: a steward may change an integration, while delete needs an administrator. A role floor of steward is not an authority to change what member data is sent to an external system, and the route calls no kernel decision.',
  cat: 'ROLE_FLOOR',
  tenant: 'The update runs in withRLSContext for the session organization and its where clause carries the path id and an organization predicate on organizationId from the session context, so another organization integration answers 404; the id and organization are never taken from the body.',
  priv: 'The response returns the whole updated row, including the credentials column, to the steward; the body is parsed against a zod schema that allows only five fields, so credentials, organization and status cannot be written.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The api_integrations update and persistAtomicAudit (integration.update, naming the fields changed and not their values) commit in one withRLSContext transaction.',
  reqAudit: 'Keep the in-transaction audit record and add the previous and new endpoint and mapping hashes and the authority that permitted the change to it.',
  does: 'Parses the body against a five-field schema (name, enabled, syncFrequency, fieldMapping, apiEndpoint), updates the integration of the session organization with updatedAt, audits the field names in the same transaction and returns the whole updated row.',
  future: 'Raise the write floor to the office that administers integrations, allow only endpoints on an approved list, record the previous and new values, stop returning the credentials column, and make the change take effect through a synchronization that exists.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('authorization', 'const { name, enabled, syncFrequency, fieldMapping, apiEndpoint } = updateIntegrationSchema.parse(raw);'),
    a.h('tenantScope', 'eq(apiIntegrations.organizationId, organizationId),'),
    a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.update(apiIntegrations)'),
    a.h('mutation', 'if (apiEndpoint !== undefined) updates.apiEndpoint = apiEndpoint;'),
    a.h('mutation', 'if (fieldMapping !== undefined) updates.fieldMapping = fieldMapping;'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'integration.update',"),
    a.h('defect', '.returning();'),
  ],
  inf: [
    { claim: 'defect', statement: 'The zod schema accepts any URL string up to 2000 characters for apiEndpoint and any JSON object for fieldMapping, with no allow-list, scheme restriction or host check, and the route that deletes the same row requires an administrator, so repointing the integration needs a lower role than removing it.' },
    extNoConsumer,
  ],
  def: ['DEF-0B7-PLT-EXT-PATCH-STEWARD-FLOOR-REWRITES-ENDPOINT-AND-MAPPING', 'DEF-0B7-PLT-EXT-GET-RETURNS-WHOLE-INTEGRATION-ROW-WITH-CREDENTIALS', 'DEF-0B7-PLT-EXT-CONFIGURATION-HAS-NO-CREATE-PATH-AND-NO-CONSUMER'],
})

const extDelete = (a) => mk({
  ...extBase,
  persona: 'Administrator of the organization removing an integration of the organization',
  authn: withApiAuthn('admin'),
  authz: 'withApi minRole admin: an administrator may remove an integration. A role floor of admin is not a named integration authority or a kernel decision, and the route calls none.',
  cat: 'ROLE_FLOOR',
  tenant: 'The delete runs in withRLSContext for the session organization and its where clause carries the path id and an organization predicate on organizationId from the session context, so another organization integration answers 404.',
  priv: 'The response returns only the id and the deleted flag; the audit record keeps the integration name and id and nothing of its configuration.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The api_integrations hard delete and persistAtomicAudit (integration.delete, with the integration name) commit in one withRLSContext transaction.',
  reqAudit: 'Keep the in-transaction audit record and extend it with the count of sync log rows the cascade removes and the authority that permitted the removal.',
  does: 'Hard-deletes the api_integrations row of the session organization whose id is the path value, which cascades to its integration_sync_logs rows, audits the removal in the same transaction and returns the id with deleted true.',
  future: 'Soft-retire the integration and keep its sync history, record what was removed, and name the office that may remove an integration.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'admin' },"),
    a.h('tenantScope', 'eq(apiIntegrations.organizationId, organizationId),'),
    a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.delete(apiIntegrations)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'integration.delete',"),
    a.h('defect', 'return { id: deleted.id, deleted: true };'),
    a.sch('defect', INTEGRATION_SCHEMA, 'integrationId: uuid("integration_id").notNull().references(() => apiIntegrations.id, { onDelete: "cascade" }),', { symbol: 'integrationSyncLogs' }),
  ],
  inf: [extNoConsumer],
  def: ['DEF-0B7-PLT-EXT-DELETE-HARD-DELETE-CASCADES-SYNC-LOG-HISTORY', 'DEF-0B7-PLT-EXT-CONFIGURATION-HAS-NO-CREATE-PATH-AND-NO-CONSUMER'],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* events/[id] and events/[id]/occurrences: generic CRUD over calendar_events                                     */
/* ------------------------------------------------------------------------------------------------------------ */

const EVENT_OWNER = 'calendar_events rows of the organization, each linked to a calendar by calendarId and carrying the organizer, optional claim, case number and member links, meeting URL and password, agenda, attachments, visibility flags and recurrence fields.'

const eventProfile = (a) => {
  const occurrences = a.route === 'events/[id]/occurrences/route.ts'
  const path = occurrences ? 'the occurrences path, whose value is the event id' : 'the event path'
  return {
    persona: occurrences
      ? 'Member, steward or administrator addressing one occurrence of a recurring event through a path that addresses the event row'
      : 'Member, steward or administrator reading or changing one calendar event of the organization',
    owner: EVENT_OWNER,
    sens: 'Event titles, descriptions, locations, meeting URLs and passwords, agendas, attachments, claim and case numbers, member identifiers and privacy flags; events can describe grievance meetings and member appointments',
    priv: (method) => ({
      GET: 'Callers below steward are held to rows whose memberId equals the session user id; a steward or above reads the whole row of any event of the organization, including meetingPassword, meetingUrl, agenda and attachments, whatever isPrivate and visibility say and whichever calendar, personal or shared, the event is on.',
      PATCH: 'Any body field except the primary key and organization is stored, including calendarId, memberId, claimId, caseNumber, organizerId, status, cancelledBy, isPrivate, visibility and the meeting password, and the whole updated row is returned.',
      DELETE: 'The delete sets status archived, a value the event status enum does not define, so the database refuses it and no event is removed or hidden; were the value accepted the row would stay readable.',
    })[method],
    does: (method, _model, floor) => ({
      GET: `Returns the calendar_events row whose id is the value in ${path} within the session organization at a role floor of ${floor}; below steward only when memberId equals the session user id.${occurrences ? ' It returns the event row, not an occurrence of it.' : ''}`,
      PATCH: `Updates the calendar_events row whose id is the value in ${path} with any body field at a role floor of ${floor}${occurrences ? '; it changes the whole event row, so a recurring series changes for every occurrence' : ''}.`,
      DELETE: `Attempts to set status archived on the calendar_events row whose id is the value in ${path} at the fixed administrator floor of the generic delete (${floor}); the status enum defines no archived value${occurrences ? ', and the row, not one occurrence, is the target' : ''}.`,
    })[method],
    future: occurrences
      ? 'Serve occurrences from the recurrence rule and its exceptions, address one occurrence by its date, add an exception rather than touching the series row, and resolve visibility through the calendar and the isPrivate and visibility columns.'
      : 'Resolve event visibility through the calendar the event belongs to and the isPrivate and visibility columns, never return the meeting password to a reader who is not the organizer or an attendee, verify calendarId against the organization and the caller, and stop writing status values the enum does not define.',
    gate: GATE,
    deps: [1, 13],
    status: () => 'PARTIAL',
    def: (method) => {
      const out = []
      if (method === 'GET') out.push('DEF-0B4-CALENDAR-EVENTS-PERSONAL-CALENDAR-LEAK', 'DEF-0B7-PLT-EVENT-ITEM-IGNORES-PRIVATE-VISIBILITY-AND-RETURNS-MEETING-PASSWORD')
      if (method === 'PATCH') out.push('DEF-0B4-CALENDAR-EVENT-CALENDAR-ID-UNVERIFIED')
      if (method === 'GET' && !occurrences) out.push('DEF-0B7-PLT-EVENT-ITEM-PUBLIC-REGISTRATION-CALLER-EXPECTS-PUBLIC-EVENT')
      if (occurrences) out.push('DEF-0B7-PLT-EVENT-OCCURRENCES-PATH-ADDRESSES-WHOLE-EVENT-ROW')
      return out
    },
    extraEv: () => {
      const out = [
        a.tbl('privacy', 'calendarEvents', /memberId: text\('member_id'\)/),
        a.tbl('privacy', 'calendarEvents', /meetingPassword: text\('meeting_password'\)/),
        a.tbl('privacy', 'calendarEvents', /visibility: varchar\('visibility', \{ length: 20 \}\)/),
        a.tbl('privacy', 'calendarEvents', /isPrivate: boolean\('is_private'\)/),
      ]
      if (a.method === 'PATCH') out.push(a.tbl('defect', 'calendarEvents', /calendarId: uuid\('calendar_id'\)\.notNull\(\)\.references\(\(\) => calendars\.id/))
      if (occurrences) {
        out.push(
          a.tbl('defect', 'calendarEvents', /recurrenceRule: text\('recurrence_rule'\)/),
          a.tbl('defect', 'calendarEvents', /recurrenceExceptions: jsonb\('recurrence_exceptions'\)/),
          a.tbl('defect', 'calendarEvents', /parentEventId: uuid\('parent_event_id'\)/),
        )
      }
      return out
    },
    inferences: (method) => {
      const out = []
      if (occurrences) {
        out.push({ claim: 'defect', statement: 'This route file is byte-identical to the event item route and to the calendar events item route, so its path value is the primary key of calendar_events; the rrule recurrence service exports addRecurrenceException, deleteFutureInstances and createRecurringInstances but is imported by no route, so nothing on this path reads recurrenceRule or writes recurrenceExceptions.' })
      } else if (method === 'GET') {
        out.push({ claim: 'defect', statement: 'The public event registration component fetches /api/events/{slug} with no credential and then reads isFree and ticketPrice from the response, none of which calendar_events defines; the route compares the path value to the uuid primary key and requires a session at the member floor.' })
      }
      return out
    },
  }
}

const eventFacts = (a, readText) => renameOrgScope(crudRecord(a, readText, eventProfile(a)))

/* ------------------------------------------------------------------------------------------------------------ */
/* equity/*: the generic factory over member_segments                                                             */
/* ------------------------------------------------------------------------------------------------------------ */

const EQUITY_OWNER = 'member_segments rows of the organization: saved member searches with a name, a description, a filters document over member attributes, the creating user id, an execution count and the isActive and isPublic flags; the table holds no self-identification answer, consent record, equity statistic or snapshot.'
const EQUITY_FACADE_INFERENCE = {
  claim: 'defect',
  statement: 'The route file holds only the crudRoutes configuration over memberSegments and imports no equity, consent or snapshot code; the application schema declares no self-identification or snapshot table (equity_snapshots is declared only in the financial-service schema and is revoked from the union_eyes_runtime and union_eyes_system roles by the round 58 migration), and no page of the application mounts the SelfIdentificationForm or EquityDashboard component that calls the path, so no equity record can be read or written through it.',
}

const equityDoes = {
  'equity/self-identify/route.ts|GET': (floor) => `Lists a page (default 50, at most 100) of member_segments rows of the organization, newest first, with a total count, at a role floor of ${floor}; it returns no self-identification answer and no consent record, and nothing is limited to the caller own row.`,
  'equity/self-identify/route.ts|POST': (floor) => `Inserts a member_segments row from the body at a role floor of ${floor} and returns it; the self-identification body of the form (consent flags, equity groups, gender identity, Indigenous identity, disability, LGBTQ2+ and newcomer answers) has no destination column, and the row requires a name and filters the form does not send, so the database refuses the insert and no answer is stored.`,
  'equity/monitoring/route.ts|GET': (floor) => `Lists a page of member_segments rows of the organization at a role floor of ${floor}; the dashboard reads data.insufficient_data and aggregate gender and equity-group percentages from this response and receives a list of segment rows and a pagination object instead, and the organizationId query parameter it sends is ignored because the organization comes from the session.`,
  'equity/monitoring/route.ts|POST': (floor) => `Inserts a member_segments row from the body at a role floor of ${floor} and returns it; no monitoring record, statistic or equity count is computed or stored.`,
  'equity/snapshots/route.ts|GET': (floor) => `Lists a page of member_segments rows of the organization at a role floor of ${floor}; the dashboard reads snapshot date, member total and percentage fields from each item and receives segment rows with none of them.`,
  'equity/snapshots/route.ts|POST': (floor) => `Inserts a member_segments row from the body at a role floor of ${floor}; the dashboard generate-snapshot button posts only organizationId, so the required name and filters are missing, the database refuses the insert, and no snapshot is computed from any member count.`,
}

const equityProfile = (a) => {
  const id = `${a.route}|${a.method}`
  return {
    persona: a.route === 'equity/self-identify/route.ts'
      ? 'Member completing the equity self-identification form, or a steward posting on their behalf'
      : 'Officer or steward using the equity dashboard, and any member reaching the same paths',
    owner: EQUITY_OWNER,
    sens: 'Saved member-search definitions: filter criteria over member status, role, employer, worksite, bargaining unit, employment and seniority attributes with the creating user id. No equity data is held, but the route names and the calling components concern special-category equity data',
    priv: (method) => (method === 'GET'
      ? 'Every member of the organization receives all member_segments rows of the organization, segments whose isPublic is false included, because the factory applies only the organization predicate to a table with no user or member owner column; the saved filter criteria of every steward are disclosed, and no equity answer or statistic is read.'
      : 'A body field of a member_segments column is stored, including isPublic, isActive, execution count and filters; equity answers in the body have no column and are not stored, and the insert is refused by the database when the form body omits the name and filters the table requires.'),
    does: (_method, _model, floor) => equityDoes[id](floor),
    future: 'Build equity self-identification as its own consented, audited, encrypted store with a named data steward, aggregate-only reads with a decided minimum group size and a retention rule, compute snapshots from consented answers only, and answer 501 on these paths until it exists.',
    gate: GATE,
    deps: [6, 13],
    status: () => 'FACADE_OVER_GENERIC_TABLE',
    decisions: [D_EQUITY],
    def: (method) => {
      const out = ['DEF-0B7-PLT-EQUITY-ROUTES-ARE-MEMBER-SEGMENT-CRUD-FACADE']
      if (method === 'GET') out.push('DEF-0B7-PLT-EQUITY-READS-RETURN-PRIVATE-SEGMENTS-TO-ANY-MEMBER')
      if (id === 'equity/self-identify/route.ts|POST') out.push('DEF-0B7-PLT-EQUITY-CONSENT-AND-PRIVACY-PROMISES-NOT-BACKED-BY-SERVER', 'DEF-0B7-PLT-EQUITY-SELF-IDENTIFY-WRITE-FLOOR-EXCLUDES-DATA-SUBJECT')
      if (id === 'equity/snapshots/route.ts|POST') out.push('DEF-0B7-PLT-EQUITY-SNAPSHOT-SCHEMA-HAS-NO-SMALL-CELL-RULE')
      return out
    },
    extraEv: () => {
      const out = [
        a.tbl('privacy', 'memberSegments', /filters: jsonb\("filters"\)\.notNull\(\)/),
        a.tbl('privacy', 'memberSegments', /isPublic: boolean\("is_public"\)\.default\(false\)\.notNull\(\)/),
      ]
      if (a.method === 'GET') out.push(a.tbl('privacy', 'memberSegments', /createdBy: text\("created_by"\)\.notNull\(\)/))
      if (a.method === 'POST') out.push(a.tbl('defect', 'memberSegments', /name: text\("name"\)\.notNull\(\)/))
      if (id === 'equity/snapshots/route.ts|POST') out.push(a.sch('defect', FINANCIAL_SCHEMA, 'executiveBoardIndigenous: integer("executive_board_indigenous").default(0),', { symbol: 'equitySnapshots' }), a.sch('defect', FINANCIAL_SCHEMA, 'avgHourlyRateWomen: numeric("avg_hourly_rate_women", { precision: 10, scale:  2 }),', { symbol: 'equitySnapshots' }))
      return out
    },
    inferences: () => {
      const out = [EQUITY_FACADE_INFERENCE]
      if (id === 'equity/self-identify/route.ts|POST') {
        out.push(
          { claim: 'privacy', statement: 'SelfIdentificationForm shows a consent text that says data is stored with encryption, individual data is never shared, only aggregates with a ten-member minimum are reported, the member may withdraw and delete at any time and data is kept seven years, then posts dataCollectionConsent true, consentType explicit and dataRetentionYears 7 as literals together with memberId and organizationId; none of the three route files reads, stores or enforces any of those values.' },
          { claim: 'defect', statement: 'The form body carries no name and no filters, which member_segments declares not null, and the route supplies neither, so the insert cannot succeed for the posted body; withApi answers an unexpected database error with a server error and the member sees the save fail.' },
        )
      }
      if (id === 'equity/snapshots/route.ts|POST') {
        out.push({ claim: 'defect', statement: 'The only table shaped like a snapshot, equity_snapshots, stores executive-board and steward counts by group and average hourly pay by gender with no suppression flag or minimum group size, and v_equity_statistics_anonymized exposes percentages of the same counts with none either; neither is reachable from the application roles today.' })
      }
      return out
    },
  }
}

const equityFacts = (a, readText) => renameOrgScope(crudRecord(a, readText, equityProfile(a)))

/* ------------------------------------------------------------------------------------------------------------ */

const FACTS = {
  'enterprise/integrations/route.ts|POST': integrationsPost,
  'enterprise/sso/providers/route.ts|GET': ssoGet,
  'enterprise/sso/providers/route.ts|POST': ssoPost,
  'entitlements/route.ts|GET': entitlementsGet,
  'extensions/[id]/route.ts|GET': extGet,
  'extensions/[id]/route.ts|PATCH': extPatch,
  'extensions/[id]/route.ts|DELETE': extDelete,
}

export function facts(a, readText) {
  const id = `${a.route}|${a.method}`
  if (FACTS[id]) return FACTS[id](a)
  if (a.route === 'events/[id]/route.ts' || a.route === 'events/[id]/occurrences/route.ts') return eventFacts(a, readText)
  if (a.route.startsWith('equity/')) return equityFacts(a, readText)
  throw new Error(`no Gate 0B.7 platform facts for ${id}`)
}
