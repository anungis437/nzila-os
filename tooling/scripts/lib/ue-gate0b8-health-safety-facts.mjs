/**
 * Gate 0B.8 facts: the health and safety workplace routes (/api/health-safety). Incidents, hazards, inspections and
 * PPE are the generic CRUD factory over OPERATIONAL tables (incident and hazard create run a route-local beforeCreate
 * normalizer); the dashboard, the five statistics routes, the incident trend and the inspection findings are raw SQL
 * aggregates behind withApi. Every evidence item is produced by `opAuthoring` from the exact handler, the helper or
 * service it calls, or the resolved schema, and is proved again by the validator. This tranche records the source; it
 * repairs nothing and approves no route.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, LOW_ROLE, CRUD_FACTORY, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const OHS_CAP = 'UE-OMIT-OHS-REGULATORY-RECORDS'
const GATE = 6

const HS_SCHEMA = `${APP}db/schema/domains/health-safety/health-safety-schema.ts`
const CNESST_SCHEMA = `${APP}db/schema/domains/health-safety/cnesst-schema.ts`
const RLS_0108 = `${APP}db/migrations/0108_rls_tenant_isolation_foundation.sql`
const RLS_ROUND58 = `${APP}db/migrations/20260910_rls_enforcement_expansion_round58.sql`
const WITH_RLS = `${APP}lib/db/with-rls-context.ts`
const API_DIR = `${APP}app/api/health-safety`
const HS_COMPONENTS = `${APP}components/health-safety`

const D_READERS = 'UE-INST-OHS-INCIDENT-RECORD-READERS'
const D_ANONYMOUS = 'UE-INST-OHS-ANONYMOUS-REPORT-IDENTITY'

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const ROUTES = new Set([
  'health-safety/dashboard/route.ts',
  'health-safety/hazards/[id]/route.ts',
  'health-safety/hazards/route.ts',
  'health-safety/hazards/stats/route.ts',
  'health-safety/incidents/[id]/route.ts',
  'health-safety/incidents/route.ts',
  'health-safety/incidents/stats/route.ts',
  'health-safety/incidents/trends/route.ts',
  'health-safety/inspections/[id]/route.ts',
  'health-safety/inspections/findings/route.ts',
  'health-safety/inspections/route.ts',
  'health-safety/inspections/stats/route.ts',
  'health-safety/ppe/route.ts',
  'health-safety/stats/route.ts',
])

export const GROUPS = {
  HS_INCIDENT_RECORDS: {
    capabilityId: OHS_CAP,
    domain: 'WORKPLACE_INCIDENT_RECORDS',
    actor: 'Health and safety representative reporting and reading, and administrator changing, workplace incident records of the organization; any member reading an incident by id',
    routes: ['health-safety/incidents/route.ts', 'health-safety/incidents/[id]/route.ts'],
    evidence: [
      ev(HS_SCHEMA, 'export const workplaceIncidents = pgTable("workplace_incidents", {'),
      ev(HS_SCHEMA, 'wsibClaimNumber: varchar("wsib_claim_number", { length: 100 }),'),
      ev(CNESST_SCHEMA, 'incidentId: uuid("incident_id"), // link to workplaceIncidents'),
    ],
  },
  HS_HAZARD_REPORTS: {
    capabilityId: OHS_CAP,
    domain: 'WORKPLACE_HAZARD_REPORTS',
    actor: 'Health and safety representative reporting and reading, and administrator changing, hazard reports of the organization; any member reading a hazard report by id',
    routes: ['health-safety/hazards/route.ts', 'health-safety/hazards/[id]/route.ts'],
    evidence: [
      ev(HS_SCHEMA, 'export const hazardReports = pgTable("hazard_reports", {'),
      ev(HS_SCHEMA, '// Reporter (can be anonymous)'),
    ],
  },
  HS_INSPECTION_RECORDS: {
    capabilityId: OHS_CAP,
    domain: 'WORKPLACE_SAFETY_INSPECTIONS',
    actor: 'Member reading, and administrator maintaining, workplace safety inspection records, and any member reading the recent inspection findings summary',
    routes: ['health-safety/inspections/route.ts', 'health-safety/inspections/[id]/route.ts', 'health-safety/inspections/findings/route.ts'],
    evidence: [
      ev(HS_SCHEMA, 'export const safetyInspections = pgTable("safety_inspections", {'),
      ev(HS_SCHEMA, 'export const inspectionStatusEnum = pgEnum("inspection_status", ['),
    ],
  },
  HS_PPE_EQUIPMENT: {
    capabilityId: OHS_CAP,
    domain: 'WORKPLACE_PPE_EQUIPMENT',
    actor: 'Member reading, and administrator adding, personal protective equipment inventory and issuance records of the organization',
    routes: ['health-safety/ppe/route.ts'],
    evidence: [
      ev(HS_SCHEMA, 'export const ppeEquipment = pgTable("ppe_equipment", {'),
      ev(HS_SCHEMA, 'issuedToName: varchar("issued_to_name", { length: 255 }),'),
    ],
  },
  HS_DASHBOARD_AND_STATISTICS: {
    capabilityId: OHS_CAP,
    domain: 'WORKPLACE_SAFETY_METRICS',
    actor: 'Member viewing the health and safety dashboard, incident, hazard, inspection and training statistics and the incident trend chart of the organization',
    routes: [
      'health-safety/dashboard/route.ts', 'health-safety/hazards/stats/route.ts', 'health-safety/incidents/stats/route.ts',
      'health-safety/incidents/trends/route.ts', 'health-safety/inspections/stats/route.ts', 'health-safety/stats/route.ts',
    ],
    evidence: [
      ev(`${API_DIR}/dashboard/route.ts`, ' * Dashboard aggregation for the HealthSafetyDashboard component.'),
      ev(`${API_DIR}/incidents/trends/route.ts`, ' * Returns incident trend data grouped by date with severity breakdown.'),
      ev(`${API_DIR}/stats/route.ts`, ' * Cross-domain health & safety summary statistics (currently used by the'),
    ],
  },
}

const D = (id, severity, title, extra = {}) => ({ id, ownerCapabilityId: OHS_CAP, gate: GATE, severity, title, ...extra })

const IDS = {
  INCIDENT_ITEM_READ: 'DEF-0B8-HS-INCIDENT-ITEM-READ-MEMBER-FLOOR-WHOLE-ROW',
  HAZARD_ITEM_READ: 'DEF-0B8-HS-HAZARD-ITEM-READ-MEMBER-FLOOR-WHOLE-ROW',
  ANONYMOUS: 'DEF-0B8-HS-ANONYMOUS-REPORTER-STAMPED-IN-CREATED-BY',
  INCIDENT_NORMALISE: 'DEF-0B8-HS-INCIDENT-CREATE-SILENTLY-NORMALISES-SEVERITY-TYPE-AND-DATE',
  INCIDENT_METADATA: 'DEF-0B8-HS-INCIDENT-INJURY-WITNESS-AND-REPORTER-DATA-IN-UNTYPED-METADATA',
  HAZARD_DEFAULTS: 'DEF-0B8-HS-HAZARD-CREATE-DEFAULTS-LEVEL-AND-CATEGORY-SILENTLY',
  NUMBERS: 'DEF-0B8-HS-RECORD-NUMBERS-CALLER-SUPPLIED-AND-UNIQUE-ACROSS-ORGANIZATIONS',
  OUTCOMES: 'DEF-0B8-HS-STATUS-AND-OUTCOME-FIELDS-WRITABLE-WITHOUT-WORKFLOW',
  ARCHIVED: 'DEF-0B8-HS-ARCHIVED-ROWS-STILL-READABLE-AND-COUNTED',
  FILTERS: 'DEF-0B8-HS-LIST-ROUTES-IGNORE-FILTERS-THE-FORMS-SEND',
  PPE_ISSUEE: 'DEF-0B8-HS-PPE-ISSUEE-NAMES-READABLE-AT-MEMBER-FLOOR',
  DASH_ERROR: 'DEF-0B8-HS-DASHBOARD-ERROR-RETURNS-SUCCESS-WITH-CLEAN-METRICS',
  DASH_TRAINING: 'DEF-0B8-HS-DASHBOARD-TRAINING-COMPLIANCE-IS-A-CONSTANT',
  DASH_DERIVED: 'DEF-0B8-HS-DASHBOARD-METRICS-DERIVED-FROM-RECORD-CREATION-AND-DEFAULTS',
  TRAINING_NO_WRITER: 'DEF-0B8-HS-TRAINING-FIGURES-READ-A-TABLE-NO-ROUTE-WRITES',
  ZERO: 'DEF-0B8-HS-UNMEASURED-VALUES-COERCED-TO-ZERO',
  RESOLUTION: 'DEF-0B8-HS-RESOLUTION-TIME-NEEDS-DATES-NO-ROUTE-SETS',
  FALLBACK: 'DEF-0B8-HS-STATS-ORGANIZATION-FILTER-FALLS-BACK-TO-ALWAYS-TRUE',
  TRENDS_ORG: 'DEF-0B8-HS-TRENDS-ORGANIZATION-FROM-QUERY-AND-NO-PREDICATE-WHEN-ABSENT',
}

export const DEFECTS = [
  D(IDS.INCIDENT_ITEM_READ, 'HIGH',
    'The incident item route reads at the member floor (readRole member) while the incident collection requires health_safety_rep, and the factory returns the whole workplace_incidents row: workplace_incidents has no userId, memberId, email or other column the low-role guard treats as personal (injuredPersonId and injuredPersonName are not on its list), so the guard stays open and any member of the organization who holds an incident id receives the injured person name, job title and employee id, body part, nature of injury, treatment, witness statements, investigation report, WSIB claim number and amount, photo and video links and the metadata JSON, with no audit of the read.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any authenticated member of the organization who holds an incident id (the incident detail view requests it by id) receives the complete incident row including injury, treatment, witness and compensation fields from GET /api/health-safety/incidents/[id]; the list that would let a member discover ids is held to health_safety_rep, the by-id read is not.',
        potentialImpact: {
          classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
          description: 'Health information about a named injured worker, witness statements and compensation claim details are disclosed to members who are neither the injured person, a health and safety representative nor an officer, with no read audit to show who saw them.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/health-safety/incidents/[id]/route.ts', quote: "readRole: 'member'," },
          { ref: 'apps/union-eyes/components/health-safety/IncidentDetailView.tsx', quote: 'const response = await fetch(`/api/health-safety/incidents/${incidentId}`);' },
        ],
        existingContainment: {
          summary: 'The read is tenant scoped (the factory adds the organization predicate to the path-id lookup) and the incident id is a random uuid that the list, held to health_safety_rep, would otherwise expose; this limits the readers to members of the same organization who hold an id, not to the offices that should see injury data.',
          evidence: [
            { ref: 'apps/union-eyes/app/api/health-safety/incidents/route.ts', quote: "readRole: 'health_safety_rep'," },
            { ref: 'apps/union-eyes/db/schema/domains/health-safety/health-safety-schema.ts', quote: 'id: uuid("id").primaryKey().defaultRandom(),' },
          ],
        },
        justification: 'The route answers 200 with the whole row to the lowest organization role, nothing in the handler or the table narrows the columns or the readers, and the harm is disclosure of health and compensation data of a named worker inside the organization; knowing an id is a weak barrier because ids travel in links and views, so the release is blocked until the by-id read is held to the same readers as the list and narrowed to the fields those readers need.',
      },
    }),
  D(IDS.HAZARD_ITEM_READ, 'MEDIUM',
    'The hazard item route reads at the member floor (readRole member) while the hazard collection requires health_safety_rep, and the factory returns the whole hazard_reports row, including reportedByName and reporterContactInfo of a non-anonymous reporter, the assigned person, the risk assessor and verifier names, resolution cost, notes and the createdBy user id, to any member who holds the hazard id; the table has no personal column the low-role guard recognises, so the guard stays open.'),
  D(IDS.ANONYMOUS, 'HIGH',
    'A report filed as anonymous is still attributed to the session user: the factory sets createdBy to the authenticated user id on every create and re-asserts it after the beforeCreate hook, the hazard and incident create hooks blank only the reporter name and contact (and the incident hook never writes the isAnonymous column, which stays false; the flag is stored only inside metadata), and every read returns the whole row, so the collection reader (health_safety_rep) and, on the item routes, any member holding the id receive the user id of the person who reported anonymously; the audit record of the create also names the user.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'The incident and hazard report forms offer a Report anonymously option; a report submitted that way is stored with createdBy equal to the reporter user id and returned by the list (health_safety_rep and above) and by the by-id reads (any member holding the id), so the reporter is identifiable from the API response.',
        potentialImpact: {
          classes: ['PRIVACY_OR_CONSENT', 'SAME_TENANT_OVER_DISCLOSURE'],
          description: 'A worker who reports a hazard or an incident on the promise of anonymity can be identified by representatives and, through the by-id reads, by other members, which exposes the reporter to reprisal and defeats the purpose of anonymous reporting.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/components/health-safety/IncidentReportForm.tsx', quote: 'Report anonymously' },
          { ref: 'apps/union-eyes/app/api/health-safety/hazards/[id]/route.ts', quote: "readRole: 'member'," },
        ],
        existingContainment: 'NONE',
        justification: 'The anonymous option is offered in the live report forms and the identity of the reporter is written and returned by routes whose readers include the lowest organization role on the item reads; no code path withholds createdBy, so the promise made to the reporter is not kept and the release is blocked until the reporter identity is not stored with, or not returned for, an anonymous report.',
      },
    }),
  D(IDS.INCIDENT_NORMALISE, 'HIGH',
    'The incident create hook maps severity through a three-entry table (minor, major to serious, critical) and incidentType through a seven-entry table, and every other value is replaced without error by minor and other: a client that sends near_miss, moderate, serious or fatal as the severity is stored as minor and answered with success, a vehicle, fall, electrical, exposure or occupational_illness type is stored as other, and an unparseable or missing incidentDate is replaced by the time of the report, although the same hook rejects a blank description; the dashboard critical-alert count and the trend buckets read the severity that was substituted.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'A health_safety_rep or higher caller who posts an incident with a severity or type outside the three-value form scale gets a 200 response and a stored row with severity minor and type other, or with the report time as the incident date; the incident form in the product sends only minor, major or critical.',
        potentialImpact: {
          classes: ['DATA_QUALITY', 'FALSE_ATTESTATION_OR_OUTCOME'],
          description: 'A fatal or serious incident recorded through an integration, import or a revised form is stored as minor, so reportability, critical alerts and trend counts understate it and the record the union relies on in a regulatory or compensation matter is wrong.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/health-safety/incidents/route.ts', quote: "writeRole: 'health_safety_rep'," },
          { ref: 'apps/union-eyes/app/api/health-safety/incidents/route.ts', quote: "severity: severity && SEVERITY_MAP[severity] ? SEVERITY_MAP[severity] : 'minor'," },
        ],
        existingContainment: {
          summary: 'The only caller found, the incident report form, restricts severity to minor, major and critical, so the substitution is not reached by the form for those three values, and creation is held to health_safety_rep.',
          evidence: [
            { ref: 'apps/union-eyes/components/health-safety/IncidentReportForm.tsx', quote: 'severity: z.enum(["minor", "major", "critical"], {' },
            { ref: 'apps/union-eyes/app/api/health-safety/incidents/route.ts', quote: "writeRole: 'health_safety_rep'," },
          ],
        },
        blockingCondition: 'Any client other than the three-value incident form (an integration, a bulk import, a mobile client or a form revision that offers near_miss, moderate, serious or fatal) is allowed to post incidents, or the organization depends on the stored severity for reportability or critical alerts.',
        justification: 'The substitution is silent and answers success, but it is reached only by callers that send values outside the form scale and only by representatives and above, so it does not block the form as shipped; it blocks as soon as another client or a richer form sends the severities the schema defines, which is why the release depends on that condition.',
      },
    }),
  D(IDS.INCIDENT_METADATA, 'MEDIUM',
    'The incident create hook never writes the structured injury, witness and reporter columns (injuredPersonName, bodyPartAffected, injuryNature, treatmentProvided, witnessNames, witnessStatements, reportedByName, isAnonymous): it copies injuryDetails, witnessNames, witnessContacts, reporter name and reporter contact, and the anonymous flag, into the free-form metadata JSON, which every incident read returns whole, so injury, witness and contact data cannot be classified, redacted or reported per field and the columns the schema defines for them stay empty for rows created through the API.'),
  D(IDS.HAZARD_DEFAULTS, 'LOW',
    'The hazard create hook sets hazardLevel to moderate when the body names neither hazardLevel nor a known priority, and hazardCategory to other when it names neither hazardCategory nor a known hazardType, and answers success; a hazard submitted without a priority is recorded at moderate rather than refused, and a priority or type outside the maps is replaced silently.'),
  D(IDS.NUMBERS, 'LOW',
    'incident_number, report_number, inspection_number and item_number are unique across the whole table, not per organization, and the incident and hazard create hooks take incidentNumber and reportNumber from the body when present (the inspection and PPE creates take every column from the body), so a caller can choose a number another organization already holds, which the database refuses, or pre-empt a number, and a unique violation is the only signal; the generated numbers embed a random uuid rather than a per-organization sequence.'),
  D(IDS.OUTCOMES, 'MEDIUM',
    'The incident and hazard update routes and the inspection create and update routes store any body column the factory does not strip (only the primary key and organizationId are removed, blockedPatchFields is not set), so an administrator can set status, closedDate, resolutionDate, verification fields, riskScore, authorityNotified, reportableToAuthority, authorityReportNumber, wsibClaimStatus, wsibClaimAmount, scorePercentage, itemsPassed, itemsFailed, criticalHazards, createdBy and incidentNumber directly, with no state machine and no check that the investigation, resolution, verification, authority notification or inspection that the field asserts happened; the statistics routes compute compliance and resolution figures from those caller-stated columns.'),
  D(IDS.ARCHIVED, 'MEDIUM',
    'The administrator delete of an incident or hazard sets status archived, and nothing treats archived as removed: the list and item reads add no status condition, so an archived row is still returned and readable by id, hazards/stats and the dashboard count a hazard as open unless its status is resolved or closed (archived counts as open), the dashboard critical-alert count excludes only closed incidents, and incident totals include archived rows.'),
  D(IDS.FILTERS, 'LOW',
    'The incident and hazard list routes read only page and limit; the incident list table sends status, severity and search and the hazard list sends status, priority and search, and the generic collection handler ignores every one of them, so the screens show unfiltered pages while the filter controls appear to work.'),
  D(IDS.PPE_ISSUEE, 'LOW',
    'The PPE list reads at the member floor and returns the whole ppe_equipment row, including issuedToId, issuedToName, issuedDate and issuedByName, to every member of the organization; the table has no column the low-role guard treats as personal, so the guard stays open.'),
  D(IDS.DASH_ERROR, 'HIGH',
    'The dashboard wraps every query in a catch that logs the failure and returns success true with fixed clean metrics (totalIncidents 0, criticalAlerts 0, openHazards 0, inspectionComplianceRate 100, daysWithoutIncident 90, trainingCompliance 100, all trends stable), so a database, row-level-security or schema error is shown to the member as a safe workplace with no incidents and full compliance instead of an error.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any authenticated member who opens the health and safety dashboard while any of the nine queries fails (connection error, missing organization context for row-level security, a column absent in the deployed schema) receives HTTP 200 with zero incidents, no critical alerts, 100 percent inspection compliance and 90 days without incident, and the component renders those values.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'DATA_QUALITY'],
          description: 'A representative or officer reading the dashboard during an outage or a schema fault is told the workplace is safe and compliant, which can delay action on real critical incidents and open hazards and is indistinguishable from a true clean record.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/health-safety/dashboard/route.ts', quote: "auth: { required: true, minRole: 'member' }," },
          { ref: 'apps/union-eyes/components/health-safety/HealthSafetyDashboard.tsx', quote: '`/api/health-safety/dashboard?organizationId=${organizationId}&period=${selectedPeriod}`' },
        ],
        existingContainment: 'NONE',
        blockingCondition: 'Any query of the dashboard can fail in a deployed environment (a database or row-level-security fault, an unapplied migration or a column that the deployed schema lacks) while members or representatives use the dashboard card as the status of workplace safety.',
        justification: 'The fabricated clean result is produced only when a query throws, so it is conditional on a fault, but the route has no containment: it logs and answers success to the lowest organization role, so the release is blocked wherever a fault is possible and the dashboard is used as the safety status.',
      },
    }),
  D(IDS.DASH_TRAINING, 'HIGH',
    'The dashboard computes trainingCompliance as the constant 92 when the organization has any safety_training_records row and the constant 100 when it has none, from a count and no compliance calculation, and the component renders it as a percentage with a progress bar and a badge that changes at 90, so a canned training compliance figure is presented as a measured one.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Every member who opens the dashboard receives a trainingCompliance of 100 (no application route writes safety_training_records, so an organization has no rows unless they are inserted outside the application) or 92 where such rows exist, shown as a training compliance percentage; the value does not depend on completed, expired or overdue training.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME'],
          description: 'A union or employer reading the dashboard is shown a compliance percentage for health and safety training that is not measured, which can be relied on as evidence that mandatory safety training is current when it has not been checked.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/health-safety/dashboard/route.ts', quote: "auth: { required: true, minRole: 'member' }," },
          { ref: 'apps/union-eyes/components/health-safety/HealthSafetyDashboard.tsx', quote: '<Badge variant={metrics.trainingCompliance >= 90 ? "default" : "secondary"}>' },
        ],
        existingContainment: 'NONE',
        justification: 'The figure is a literal selected by whether any row exists, it is returned to the lowest organization role and rendered as a compliance percentage with a pass threshold, and nothing in the route, the component or the table measures training currency, so the release is blocked until the figure is computed from training records or removed.',
      },
    }),
  D(IDS.DASH_DERIVED, 'MEDIUM',
    'The dashboard metrics are labelled as workplace measures but computed from record creation and defaults: inspectionsDue is the count of inspections created in the window (not inspections that are due), inspectionComplianceRate is completed over created, daysWithoutIncident is measured from the latest created_at of any incident row (including archived rows and not the incident date) and is 90 when the organization has no incident row, hazardTrend is up when more than three hazards are open and down only at zero, and incidentChange is 0 when the previous window has no incidents.'),
  D(IDS.TRAINING_NO_WRITER, 'MEDIUM',
    'health-safety/stats and the dashboard read safety_training_records, and no route, service or job of the application inserts or updates that table (the runtime role is granted SELECT only on it and the only code that names it is these two routes), so trainingDue and the training compliance figure are computed over a table that application code cannot populate and read as 0 and 100 for every organization.'),
  D(IDS.ZERO, 'MEDIUM',
    'The statistics and findings routes turn missing measurements into zero: avgResolutionTime is 0 when no incident or hazard has a closing date, complianceRate and avgScore are 0 when no inspection has item counts or a score, and each inspection finding with no score_percentage returns complianceRate 0, so an unmeasured inspection is shown as 0 percent compliant and a not-yet-resolved set as a zero-day resolution time.'),
  D(IDS.RESOLUTION, 'MEDIUM',
    'avgResolutionTime of the incident and hazard statistics is computed from closed_date and resolution_date, which no route sets when a status changes (create stores neither, and update stores only what the body states), and the incident statistics count a status of resolved although the schema defines only reported, investigating and closed for incidents, so an incident or hazard closed by a status update has no resolution time and the figures omit it.'),
  D(IDS.FALLBACK, 'LOW',
    'Each aggregate route builds its organization filter as organizationId ? organization_id = id : 1=1: the filter falls back to an always-true predicate, so the organization boundary of the aggregates depends on withApi having refused a request with no organization (requireOrg defaults to true) and on row-level security, and not on the route itself.'),
  D(IDS.TRENDS_ORG, 'HIGH',
    'The incident trend route ignores the organization of the session: it takes organizationId from the query string, uses it as the only organization predicate, and when the parameter is absent runs the aggregate over workplace_incidents with no organization predicate at all, so which rows are counted depends only on row-level security applied to the connection; the route never compares the supplied id with the caller organization and no handler code limits the query to it.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any authenticated member can call GET /api/health-safety/incidents/trends with any organizationId, or none; the incident counts by day or month and severity come back for whatever organization the supplied id names or, without an id, for every row the connection can see, limited only by the workplace_incidents row-level-security policy on app.current_org_id set from the session.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE'],
          description: 'If the row-level-security policy is not in force for the runtime role, a member reads incident counts by date and severity for other organizations, or for all organizations at once, which discloses the safety record of other unions.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/health-safety/incidents/trends/route.ts', quote: "auth: { required: true, minRole: 'member' }," },
          { ref: 'apps/union-eyes/components/health-safety/IncidentTrendChart.tsx', quote: '`/api/health-safety/incidents/trends?organizationId=${organizationId}&period=${period}`' },
        ],
        existingContainment: {
          summary: 'The 0108 migration enables and forces row-level security on workplace_incidents with a runtime-role policy comparing organization_id to app.current_org_id, and withRLSContext sets that setting from the session, so a foreign organizationId or an absent one is limited to the session organization when the policy is applied.',
          evidence: [
            { ref: 'apps/union-eyes/db/migrations/0108_rls_tenant_isolation_foundation.sql', quote: "SELECT ue_create_direct_org_rls_policy('workplace_incidents');" },
            { ref: 'apps/union-eyes/db/migrations/0108_rls_tenant_isolation_foundation.sql', quote: "EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);" },
          ],
        },
        blockingCondition: 'The workplace_incidents row-level-security policy is not applied to, or is bypassed by, the connection role that serves the route (migration not applied, table owner or bypass role, or app.current_org_id not set to the session organization), which no source here proves either way.',
        justification: 'The route itself carries no organization control and trusts the query string, so the only barrier is the database policy that the source defines but whose application to the live runtime connection is not shown here; the harm is cross-organization disclosure of aggregate incident data, so the release blocks wherever that policy cannot be shown to apply.',
      },
    }),
]

export const DECISIONS = [
  {
    id: D_READERS,
    status: 'OUTSTANDING',
    question: 'Which offices of the union may read the injured-person, injury, treatment, witness, investigation and compensation-claim fields of a workplace incident, the reporter and assignee fields of a hazard report and the issuance records of PPE, and does any member below the health and safety representative floor read an incident or a hazard report by id?',
    sourceState: 'The incident and hazard collection routes require health_safety_rep while the by-id routes of the same tables require member, no source names the offices that may read an incident row, the table carries injured person name, treatment, witness statements and WSIB claim fields, and the application records no audit of any read.',
    softwareOwners: [OHS_CAP],
  },
  {
    id: D_ANONYMOUS,
    status: 'OUTSTANDING',
    question: 'Does the union offer anonymous reporting of incidents and hazards, which offices may learn the identity of an anonymous reporter, and where is that identity kept (the record, the audit trail or neither)?',
    sourceState: 'The incident and hazard report forms offer a Report anonymously option and the create hooks blank the reporter name and contact, but the factory stamps createdBy with the session user and the audit record names the user; no source states a policy on who may learn an anonymous reporter identity.',
    softwareOwners: [OHS_CAP],
  },
]

const AUDIT_READS = 'Audit reads of these records once the readers are named: they hold injury, treatment, witness and compensation data of named workers, and the generic factory records no read.'
const NO_WRITE = 'A read: the handler runs select queries and writes no row and no audit record.'

/* ---------- generic CRUD profiles ---------- */

const incidentExtra = (a) => [
  a.tbl('privacy', 'workplaceIncidents', /injuredPersonName: varchar\("injured_person_name"/),
  a.tbl('privacy', 'workplaceIncidents', /treatmentProvided: text\("treatment_provided"\)/),
  a.tbl('privacy', 'workplaceIncidents', /witnessStatements: jsonb\("witness_statements"\)/),
  a.tbl('privacy', 'workplaceIncidents', /wsibClaimAmount: numeric\("wsib_claim_amount"/),
  a.tbl('privacy', 'workplaceIncidents', /createdBy: text\("created_by"\)/),
]

const incidentProfile = (a) => {
  const item = a.route.includes('[id]')
  const reads = {
    persona: item
      ? 'Any organization member holding an incident id (read), and administrator (update and delete), through the generic CRUD factory'
      : 'Health and safety representative or above reporting and listing workplace incidents through the generic CRUD factory with a route-local create normalizer',
    owner: 'workplace_incidents rows of the organization; the reporter is recorded as createdBy (the session user, also for an anonymous report), the injured person as injuredPersonId and name where the columns are written, and the investigation, regulatory and WSIB fields as columns of the same row.',
    sens: 'Injury and illness incident records: injured person name, job title and employee id, body part and nature of injury, treatment, witness statements, investigation report, root cause, regulatory reporting status, WSIB claim number, status and amount, photo and video links and the metadata JSON',
    priv: (method) => ({
      GET: item
        ? 'Any member of the organization who holds the incident id receives the whole incident row (injured person, injury, treatment, witnesses, investigation, WSIB claim, metadata and createdBy); the low-role guard stays open because the table has no personal column it recognises.'
        : 'Health and safety representatives and above receive pages of whole incident rows (injury, treatment, witness, investigation, WSIB and metadata fields and createdBy) for the whole organization.',
      POST: 'The response returns the stored incident row; injury details, witness names and contacts and reporter contact are stored in the metadata JSON, an anonymous report keeps the session user in createdBy, and the audit record lists the field names and no values.',
      PATCH: 'The response returns the whole updated incident row; any column except the primary key and organization can be written, including status, closedDate, regulatory and WSIB fields.',
      DELETE: 'The row is returned with status archived; archived rows stay readable and countable, and the audit record lists the field status and no values.',
    })[method],
    does: (method, _model, floor) => ({
      GET: item
        ? `Returns the whole workplace_incidents row for a path id within the session organization at a role floor of ${floor}; archived rows are returned too.`
        : `Returns a page (default 50, at most 100) of workplace_incidents rows of the session organization at a role floor of ${floor}, newest first; status, severity and search parameters are not read. Archived rows are included.`,
      POST: `Normalizes the body in buildIncidentCreateValues (required location and description, severity mapped to minor, serious or critical with every other value minor, type mapped with every other value other, incident date defaulted to now, generated incident number, injury and witness data in metadata), then inserts the row with organizationId and createdBy from the session at a role floor of ${floor}.`,
      PATCH: `Updates a workplace_incidents row with any body field except the primary key and organization at a role floor of ${floor}; no state machine or field block applies.`,
      DELETE: `Sets status archived on the workplace_incidents row at the fixed administrator floor of the generic delete (${floor}); the row stays in every read.`,
    })[method],
    future: 'Hold the by-id read to the same readers as the list, return the columns each reader needs and redact injured-person, witness and claim fields by office, write the structured injury and witness columns instead of free-form metadata, refuse unknown severity and type values, keep the identity of an anonymous reporter out of the record and the audit trail, drive status, closure and authority-notification fields from the investigation workflow, exclude archived rows from reads and counts, and audit reads of injury data.',
    gate: GATE,
    deps: [2, 13],
    status: () => 'PARTIAL',
    decisions: [D_READERS, D_ANONYMOUS],
    def: (method) => {
      const defs = []
      if (method === 'GET') {
        defs.push(IDS.ANONYMOUS, IDS.ARCHIVED)
        if (item) defs.push(IDS.INCIDENT_ITEM_READ)
        else defs.push(IDS.FILTERS)
        defs.push(IDS.INCIDENT_METADATA)
      }
      if (method === 'POST') defs.push(IDS.ANONYMOUS, IDS.INCIDENT_NORMALISE, IDS.INCIDENT_METADATA, IDS.NUMBERS)
      if (method === 'PATCH') defs.push(IDS.OUTCOMES)
      if (method === 'DELETE') defs.push(IDS.ARCHIVED)
      return defs
    },
    extraEv: (x) => {
      const out = [...incidentExtra(x)]
      if (x.method === 'GET') {
        out.push(
          x.sch('privacy', LOW_ROLE, 'const PERSONAL_COLUMNS = ['),
          x.tbl('defect', 'workplaceIncidents', /pgTable\(/, { absentColumns: ['userId', 'memberId', 'email', 'phone', 'phoneNumber', 'mobile', 'address', 'dateOfBirth', 'senderId', 'recipientId', 'employeeId'] }),
          x.tbl('defect', 'workplaceIncidents', /status: varchar\("status", \{ length: 50 \}\)\.notNull\(\)\.default\("reported"\)/),
        )
        if (!item) out.push(x.imp('defect', 'crudRoutes', "const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));"))
        else out.push(x.sch('defect', LOW_ROLE, 'if (mode.kind === \'open\') return {}', { symbol: 'resolveLowRoleScope' }))
      }
      if (x.method === 'POST') {
        out.push(
          x.h('defect', 'beforeCreate: (values) => buildIncidentCreateValues(values),'),
          x.local('defect', 'buildIncidentCreateValues', "severity: severity && SEVERITY_MAP[severity] ? SEVERITY_MAP[severity] : 'minor',"),
          x.local('defect', 'buildIncidentCreateValues', 'incidentType: incidentType && INCIDENT_TYPE_MAP[incidentType]'),
          x.local('defect', 'buildIncidentCreateValues', 'incidentDate: resolveIncidentDate(raw),'),
          x.local('defect', 'buildIncidentCreateValues', 'incidentNumber: raw.incidentNumber ?? generateIncidentNumber(),'),
          x.local('defect', 'buildIncidentCreateValues', 'createdBy: raw.createdBy,'),
          x.local('defect', 'buildIncidentCreateValues', 'injuryDetails: raw.injuryDetails,'),
          x.local('defect', 'buildIncidentCreateValues', 'witnessContacts: raw.witnessContacts,'),
          x.local('defect', 'buildIncidentCreateValues', 'isAnonymous: raw.isAnonymous,'),
          x.local('defect', 'buildIncidentCreateValues', 'reporterContact: raw.isAnonymous ? undefined : raw.reporterContact,'),
          x.imp('defect', 'crudRoutes', 'values.createdBy = userId;'),
          x.svc('defect', CRUD_FACTORY, 'finalValues.createdBy = guard.userId;', 'enforceCreateSecurityInvariants'),
          x.tbl('defect', 'workplaceIncidents', /incidentNumber: varchar\("incident_number", \{ length: 50 \}\)\.unique\(\)\.notNull\(\)/),
          x.tbl('defect', 'workplaceIncidents', /isAnonymous: boolean\("is_anonymous"\)\.default\(false\)/),
          x.tbl('defect', 'workplaceIncidents', /severity: incidentSeverityEnum\("severity"\)\.notNull\(\)/),
          x.sch('defect', HS_SCHEMA, '"fatal",               // Death occurred', { symbol: 'incidentSeverityEnum' }),
        )
      }
      if (x.method === 'PATCH') {
        out.push(
          x.tbl('defect', 'workplaceIncidents', /authorityNotified: boolean\("authority_notified"\)/),
          x.tbl('defect', 'workplaceIncidents', /closedDate: timestamp\("closed_date"/),
          x.tbl('defect', 'workplaceIncidents', /wsibClaimStatus: varchar\("wsib_claim_status"/),
        )
      }
      if (x.method === 'DELETE') out.push(x.tbl('defect', 'workplaceIncidents', /status: varchar\("status", \{ length: 50 \}\)\.notNull\(\)\.default\("reported"\)/))
      return out
    },
    reqRead: AUDIT_READS,
    inferences: (method) => {
      const out = []
      if (method === 'POST') {
        out.push(
          { claim: 'defect', statement: 'buildIncidentCreateValues returns an object whose keys are a fixed list; none of injuredPersonName, bodyPartAffected, injuryNature, treatmentProvided, witnessNames, witnessStatements, reportedByName or isAnonymous is a top-level key, so those columns are never written by this route, and resolveIncidentDate returns the current time when incidentDate is missing or not a valid date.' },
          { claim: 'defect', statement: 'The factory spreads the request body into values, sets createdBy to the session user, calls beforeCreate and then re-asserts createdBy from the session user, so the hook can neither remove nor replace it; the hook blanks reportedBy and reporterContact in metadata for an anonymous report and leaves createdBy untouched.' },
        )
      }
      if (method === 'GET') out.push({ claim: 'defect', statement: 'The factory GET selects every column of the table (db.select().from(table)) with the organization condition and, for the item route, the path id; no status condition is added, so a row whose status is archived by the delete is returned like any other.' })
      return out
    },
    corr: () => [],
  }
  return reads
}

const hazardExtra = (a) => [
  a.tbl('privacy', 'hazardReports', /reportedByName: varchar\("reported_by_name"/),
  a.tbl('privacy', 'hazardReports', /reporterContactInfo: varchar\("reporter_contact_info"/),
  a.tbl('privacy', 'hazardReports', /createdBy: text\("created_by"\)/),
]

const hazardProfile = (a) => {
  const item = a.route.includes('[id]')
  return {
    persona: item
      ? 'Any organization member holding a hazard report id (read), and administrator (update and delete), through the generic CRUD factory'
      : 'Health and safety representative or above reporting and listing hazard reports through the generic CRUD factory with a route-local create normalizer',
    owner: 'hazard_reports rows of the organization; the reporter is recorded as createdBy (the session user, also for an anonymous report) and, for a non-anonymous report, by name and contact on the row.',
    sens: 'Workplace hazard reports: location, hazard description, who is at risk, consequences, controls, risk scores, reporter name and contact (non-anonymous), assignee, assessor and verifier names, resolution cost and notes',
    priv: (method) => ({
      GET: item
        ? 'Any member of the organization who holds the hazard id receives the whole hazard row, including reporter name and contact of a non-anonymous report, assignee, assessor and verifier names, resolution cost, notes and createdBy.'
        : 'Health and safety representatives and above receive pages of whole hazard rows including reporter fields and createdBy for the whole organization.',
      POST: 'The response returns the stored hazard row; an anonymous report keeps the session user in createdBy, and the audit record lists the field names and no values.',
      PATCH: 'The response returns the whole updated hazard row; any column except the primary key and organization can be written, including status, resolution, verification and risk score.',
      DELETE: 'The row is returned with status archived; archived rows stay readable and are counted as open by the statistics.',
    })[method],
    does: (method, _model, floor) => ({
      GET: item
        ? `Returns the whole hazard_reports row for a path id within the session organization at a role floor of ${floor}; archived rows are returned too.`
        : `Returns a page (default 50, at most 100) of hazard_reports rows of the session organization at a role floor of ${floor}; filter parameters are not read and archived rows are included.`,
      POST: `Normalizes the body in buildHazardCreateValues (required location and description, level from hazardLevel or the priority map defaulting to moderate, category from hazardCategory or the type map defaulting to other, generated report number, reporter name and contact blanked when anonymous), then inserts the row with organizationId and createdBy from the session at a role floor of ${floor}.`,
      PATCH: `Updates a hazard_reports row with any body field except the primary key and organization at a role floor of ${floor}; no state machine or field block applies.`,
      DELETE: `Sets status archived on the hazard_reports row at the fixed administrator floor of the generic delete (${floor}); the row stays in every read and is counted as open by the statistics.`,
    })[method],
    future: 'Hold the by-id read to the same readers as the list and redact reporter, assignee and cost fields by office, keep the identity of an anonymous reporter out of the record and the audit trail, require an explicit hazard level and category, drive status, resolution and verification from the remediation workflow, and exclude archived rows from reads and counts.',
    gate: GATE,
    deps: [2, 13],
    status: () => 'PARTIAL',
    decisions: [D_READERS, D_ANONYMOUS],
    def: (method) => {
      const defs = []
      if (method === 'GET') {
        defs.push(IDS.ANONYMOUS, IDS.ARCHIVED)
        defs.push(item ? IDS.HAZARD_ITEM_READ : IDS.FILTERS)
      }
      if (method === 'POST') defs.push(IDS.ANONYMOUS, IDS.HAZARD_DEFAULTS, IDS.NUMBERS)
      if (method === 'PATCH') defs.push(IDS.OUTCOMES)
      if (method === 'DELETE') defs.push(IDS.ARCHIVED)
      return defs
    },
    extraEv: (x) => {
      const out = [...hazardExtra(x)]
      if (x.method === 'GET') {
        out.push(
          x.sch('privacy', LOW_ROLE, 'const PERSONAL_COLUMNS = ['),
          x.tbl('defect', 'hazardReports', /pgTable\(/, { absentColumns: ['userId', 'memberId', 'email', 'phone', 'phoneNumber', 'mobile', 'address', 'dateOfBirth', 'senderId', 'recipientId', 'employeeId'] }),
          x.tbl('defect', 'hazardReports', /status: varchar\("status", \{ length: 50 \}\)\.notNull\(\)\.default\("reported"\)/),
        )
        if (!x.route.includes('[id]')) out.push(x.imp('defect', 'crudRoutes', "const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));"))
      }
      if (x.method === 'POST') {
        out.push(
          x.h('defect', 'beforeCreate: (values) => buildHazardCreateValues(values),'),
          x.local('defect', 'buildHazardCreateValues', "hazardLevel: raw.hazardLevel ?? (priority && PRIORITY_TO_HAZARD_LEVEL[priority]) ?? 'moderate',"),
          x.local('defect', 'buildHazardCreateValues', "hazardCategory: raw.hazardCategory ?? (hazardType && HAZARD_TYPE_TO_CATEGORY[hazardType]) ?? 'other',"),
          x.local('defect', 'buildHazardCreateValues', 'reportNumber: raw.reportNumber ?? generateReportNumber(),'),
          x.local('defect', 'buildHazardCreateValues', 'reportedByName: raw.isAnonymous ? undefined : (raw.reportedByName ?? raw.reporterName),'),
          x.local('defect', 'buildHazardCreateValues', 'createdBy: raw.createdBy,'),
          x.imp('defect', 'crudRoutes', 'values.createdBy = userId;'),
          x.svc('defect', CRUD_FACTORY, 'finalValues.createdBy = guard.userId;', 'enforceCreateSecurityInvariants'),
          x.tbl('defect', 'hazardReports', /reportNumber: varchar\("report_number", \{ length: 50 \}\)\.unique\(\)\.notNull\(\)/),
        )
      }
      if (x.method === 'PATCH') {
        out.push(
          x.tbl('defect', 'hazardReports', /resolutionDate: timestamp\("resolution_date"/),
          x.tbl('defect', 'hazardReports', /verifiedById: uuid\("verified_by_id"\)/),
          x.tbl('defect', 'hazardReports', /riskScore: integer\("risk_score"\)/),
        )
      }
      if (x.method === 'DELETE') out.push(x.tbl('defect', 'hazardReports', /status: varchar\("status", \{ length: 50 \}\)\.notNull\(\)\.default\("reported"\)/))
      return out
    },
    reqRead: AUDIT_READS,
    inferences: (method) => {
      const out = []
      if (method === 'POST') out.push({ claim: 'defect', statement: 'The factory sets createdBy to the session user and re-asserts it after buildHazardCreateValues, which blanks only reportedByName and reporterContactInfo for an anonymous report, so an anonymous hazard report keeps the user id in createdBy; with no priority and no hazardLevel the level is moderate.' })
      if (method === 'GET') out.push({ claim: 'defect', statement: 'The factory GET selects every column of the table with the organization condition and, for the item route, the path id; no status condition is added, so a hazard archived by the delete is returned like any other.' })
      return out
    },
    corr: () => [],
  }
}

const inspectionProfile = (a) => ({
  persona: 'Member reading, and administrator creating, changing and deleting, workplace safety inspection records through the generic CRUD factory',
  owner: 'safety_inspections rows of the organization: schedule, location, inspectors, checklist items, findings, scores, follow-up and report links.',
  sens: 'Workplace safety inspection records: location, lead inspector and inspector names, checklist results, findings, observations, areas of concern, recommendations, scores, photo and report links',
  priv: (method) => ({
    GET: 'Any member of the organization receives whole inspection rows (inspector names, checklist results, findings, areas of concern, scores and report links); the table has no personal column the low-role guard recognises, so the guard stays open.',
    POST: 'The response returns the stored inspection row; every body column is stored, including status, scores and item counts, and the audit record lists the field names and no values.',
    PATCH: 'The response returns the whole updated row; every body column except the primary key and organization can be written, including status, scores and item counts.',
    DELETE: 'The generic delete tries to set status archived, which the inspection_status enum does not contain, so no row is archived and nothing is returned.',
  })[method],
  does: (method, _model, floor) => ({
    GET: `Returns ${a.route.includes('[id]') ? 'the whole safety_inspections row for a path id' : 'a page (default 50, at most 100) of safety_inspections rows'} of the session organization at a role floor of ${floor}.`,
    POST: `Inserts a safety_inspections row from the body (inspection number, type, schedule, status, scores and item counts as the caller states them) at a role floor of ${floor}; no hook validates or derives any field.`,
    PATCH: `Updates a safety_inspections row with any body field except the primary key and organization at a role floor of ${floor}; status, scores and item counts are caller-stated.`,
    DELETE: `Attempts to set status archived on the safety_inspections row at the fixed administrator floor of the generic delete (${floor}); archived is not a value of inspection_status.`,
  })[method],
  future: 'Derive inspection status, item counts and scores from the checklist results, validate the body, name the offices that read inspection findings and areas of concern, and replace the unsupported archived status with a value the enum defines.',
  gate: GATE,
  deps: [2, 13],
  status: () => 'PARTIAL',
  decisions: [D_READERS],
  def: (method) => {
    if (method === 'POST' || method === 'PATCH') return [IDS.OUTCOMES, ...(method === 'POST' ? [IDS.NUMBERS] : [])]
    return []
  },
  extraEv: (x) => {
    const out = [
      x.tbl('privacy', 'safetyInspections', /leadInspectorName: varchar\("lead_inspector_name"/),
      x.tbl('privacy', 'safetyInspections', /areasOfConcern: text\("areas_of_concern"\)/),
    ]
    if (x.method === 'GET') out.push(x.tbl('defect', 'safetyInspections', /pgTable\(/, { absentColumns: ['userId', 'memberId', 'email', 'phone', 'phoneNumber', 'mobile', 'address', 'dateOfBirth', 'senderId', 'recipientId', 'employeeId'] }))
    if (x.method === 'POST' || x.method === 'PATCH') {
      out.push(
        x.tbl('defect', 'safetyInspections', /scorePercentage: numeric\("score_percentage"/),
        x.tbl('defect', 'safetyInspections', /itemsPassed: integer\("items_passed"\)/),
      )
    }
    if (x.method === 'POST') out.push(x.tbl('defect', 'safetyInspections', /inspectionNumber: varchar\("inspection_number", \{ length: 50 \}\)\.unique\(\)\.notNull\(\)/))
    return out
  },
  reqRead: 'Audit reads of inspection findings once the readers are named; the findings may name workers and conditions the union is entitled to know and the employer is not.',
  inferences: () => [],
  corr: () => [],
})

const ppeProfile = {
  persona: 'Member reading, and administrator adding, personal protective equipment records through the generic CRUD factory',
  owner: 'ppe_equipment rows of the organization: inventory counts, issuance to a named person, lifecycle, inspection and certification fields.',
  sens: 'PPE inventory and issuance records: item and serial numbers, quantities, the person each item was issued to (id and name), the issuer, purchase cost and supplier, inspection and certification references',
  priv: (method) => (method === 'GET'
    ? 'Every member of the organization receives whole PPE rows, including who each item was issued to and by whom; the table has no personal column the low-role guard recognises, so the guard stays open.'
    : 'The response returns the stored row; every body column is stored, including issuance, quantities and status, and the audit record lists the field names and no values.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Returns a page (default 50, at most 100) of ppe_equipment rows of the session organization at a role floor of ${floor}.`
    : `Inserts a ppe_equipment row from the body at a role floor of ${floor}; no hook validates the item number, quantities or issuance, and no update or delete route exists (the runtime role is granted SELECT and INSERT on the table).`),
  future: 'Decide who may read PPE issuance by person, validate quantities and issuance on write, and provide an update path so inventory can be corrected without a second row.',
  gate: GATE,
  deps: [2, 13],
  status: () => 'PARTIAL',
  decisions: [D_READERS],
  def: (method) => (method === 'GET' ? [IDS.PPE_ISSUEE] : [IDS.NUMBERS]),
  extraEv: (x) => {
    const out = [
      x.tbl('privacy', 'ppeEquipment', /issuedToName: varchar\("issued_to_name"/),
      x.sch('defect', RLS_ROUND58, "EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'ppe_equipment');"),
    ]
    if (x.method === 'GET') out.push(x.tbl('defect', 'ppeEquipment', /pgTable\(/, { absentColumns: ['userId', 'memberId', 'email', 'phone', 'phoneNumber', 'mobile', 'address', 'dateOfBirth', 'senderId', 'recipientId', 'employeeId'] }))
    if (x.method === 'POST') out.push(x.tbl('defect', 'ppeEquipment', /itemNumber: varchar\("item_number", \{ length: 50 \}\)\.unique\(\)\.notNull\(\)/))
    return out
  },
  reqRead: 'Audit reads of PPE issuance once the readers are named.',
  inferences: () => [],
  corr: () => [],
}

/* ---------- raw SQL aggregate routes ---------- */

const aggregateTenantEv = (a, tableSql) => [
  ...guardEv(a, 'withApi'),
  a.h('authorization', "auth: { required: true, minRole: 'member' },"),
  a.svc('tenantScope', WITH_RLS, "await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`)", 'withRLSContext'),
  a.sch('tenantScope', RLS_0108, `SELECT ue_create_direct_org_rls_policy('${tableSql}');`),
]

const orgFilterEv = (a) => a.h('tenantScope', 'const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;')

const AGG_SESSION_TENANT = 'The organization predicate is organization_id = the organizationId that withApi resolved from the session (the query string organizationId the screens send is not read); the filter falls back to the always-true 1=1 when the organization is null, which withApi prevents by refusing an authenticated request with no organization (requireOrg defaults to true); the query also runs inside withRLSContext, whose transaction sets app.current_org_id from the session, so row-level security is a second control the route does not itself prove.'

const aggregateRecord = (a, cfg) => mk({
  persona: cfg.persona,
  service: `${API_DIR}/${a.route.replace('health-safety/', '')} (withApi, raw SQL aggregate)`,
  authn: `${SESSION}: withApi requires an authenticated user and a resolved organization.`,
  authz: 'withApi role floor: minRole member, the lowest organization role; any member of the organization can call the route. A role floor is not a kernel decision and the route names no office that may read workplace safety figures.',
  tenant: cfg.tenant ?? AGG_SESSION_TENANT,
  owner: cfg.owner,
  sens: cfg.sens,
  priv: cfg.priv,
  mut: 'NOT_MUTATING',
  auditDetail: NO_WRITE,
  reqAudit: 'No audit record is needed for an aggregate read of counts; if a figure is later used as evidence of workplace safety or training compliance, record who read it.',
  does: cfg.does,
  status: cfg.status ?? 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [2, 13],
  future: cfg.future,
  dec: cfg.dec ?? [D_READERS],
  ev: cfg.ev,
  inf: cfg.inf ?? [],
  def: cfg.def ?? [],
  corr: [],
})

function dashboardFacts(a) {
  return aggregateRecord(a, {
    persona: 'Any member of the organization opening the health and safety dashboard',
    owner: 'A computed set of twelve metrics over workplace_incidents, hazard_reports, safety_inspections, safety_training_records and ppe_equipment rows of the organization; nothing is stored.',
    sens: 'Counts of incidents, critical incidents, open hazards, inspections and PPE items below reorder level, a days-without-incident figure and a training compliance percentage of the organization',
    priv: 'Every member receives organization-wide counts and derived percentages; no row, name or narrative is returned, but a count of one critical incident or of days since the last incident reveals that an incident occurred. On any query failure the same 200 response carries fixed clean values.',
    does: 'Runs nine count and max queries inside withRLSContext, derives trends and percentages (compliance as completed over created inspections, training compliance as the constant 92 or 100, days without incident from the latest incident row creation time with 90 when there is none) and returns success true with the metrics; if any query throws, logs the error and returns success true with zero incidents, no alerts, 100 percent compliance and 90 days.',
    status: 'PARTIAL',
    future: 'Return an error when a query fails, compute training compliance from training records and drop it where none can exist, measure inspections due from due dates and days without incident from incident dates, exclude archived rows, and name the offices that read organization safety metrics.',
    def: [IDS.DASH_ERROR, IDS.DASH_TRAINING, IDS.DASH_DERIVED, IDS.TRAINING_NO_WRITER, IDS.ARCHIVED, IDS.FALLBACK],
    ev: [
      ...aggregateTenantEv(a, 'workplace_incidents'),
      orgFilterEv(a),
      a.h('mutation', "await db.execute(sql`SELECT count(*)::int AS cnt FROM workplace_incidents WHERE ${orgFilter} AND ${dateFilter}`)"),
      a.h('defect', "} catch (error) {"),
      a.h('defect', "log.error('Health-safety dashboard query failed', { error: error instanceof Error ? error.message : 'Unknown' });"),
      a.h('defect', 'success: true,'),
      a.h('defect', 'inspectionComplianceRate: 100,'),
      a.h('defect', 'daysWithoutIncident: 90,'),
      a.h('defect', 'trainingCompliance: 100,'),
      a.h('defect', "const trainingCompliance = Number((trainRows[0] as Record<string, unknown>)?.cnt ?? 0) > 0 ? 92 : 100;"),
      a.h('defect', "SELECT count(*)::int AS cnt FROM safety_training_records WHERE ${orgFilter}"),
      a.h('defect', "SELECT count(*)::int AS cnt FROM safety_inspections WHERE ${orgFilter} AND ${dateFilter}"),
      a.h('defect', "SELECT max(created_at)::text AS last_dt FROM workplace_incidents WHERE ${orgFilter}"),
      a.h('defect', 'const daysWithoutIncident = lastDt'),
      a.h('defect', "const hazardTrend = openHazards > 3 ? 'up' : openHazards === 0 ? 'down' : 'stable';"),
      a.h('defect', "FROM hazard_reports WHERE ${orgFilter} AND (status IS NULL OR status NOT IN ('resolved','closed'))"),
      a.h('defect', "severity = 'critical' AND status != 'closed'"),
      a.sch('defect', RLS_ROUND58, "EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'safety_training_records');"),
    ],
    inf: [
      { claim: 'defect', statement: 'The try block encloses every query and the whole response, and the catch returns the same shape as the success path with success true and fixed values, so a failed query is indistinguishable from a clean record in the response; the only trace is a server log line.' },
      { claim: 'defect', statement: 'A search of the tracked application source for the safetyTrainingRecords export and the safety_training_records table name finds code that reads it only in this route and health-safety/stats, so no route, service or job writes it, and the runtime role holds SELECT only; the training compliance figure is therefore 100 unless a row is inserted outside the application, and is then 92.' },
    ],
  })
}

function hazardStatsFacts(a) {
  return aggregateRecord(a, {
    persona: 'Any member of the organization reading hazard report statistics',
    owner: 'A computed summary over hazard_reports rows of the organization; nothing is stored.',
    sens: 'Counts of hazard reports by status and critical level and the average days from reported to resolution date',
    priv: 'Every member receives organization-wide counts and an average resolution time; no row or narrative is returned.',
    does: 'Selects counts of all hazard reports, those not resolved or closed (archived counts as open), assigned, resolved and critical or extreme and still open, and the average days between resolution_date and reported_date, and returns them with the average as 0 when no hazard has a resolution date.',
    future: 'Exclude archived rows, derive resolution dates when status changes, report an unmeasured average as absent rather than 0, and name the offices that read hazard statistics.',
    def: [IDS.ARCHIVED, IDS.ZERO, IDS.RESOLUTION, IDS.FALLBACK],
    ev: [
      ...aggregateTenantEv(a, 'hazard_reports'),
      orgFilterEv(a),
      a.h('mutation', "count(*) FILTER (WHERE status NOT IN ('resolved', 'closed'))::int AS open,"),
      a.h('defect', 'avg(EXTRACT(EPOCH FROM (resolution_date - reported_date)) / 86400.0)'),
      a.h('defect', 'avgResolutionTime: row.avg_resolution_days != null'),
      a.sch('defect', HS_SCHEMA, /resolutionDate: timestamp\("resolution_date"/, { symbol: 'hazardReports' }),
    ],
    inf: [{ claim: 'defect', statement: 'The status filter excludes only resolved and closed, so a hazard archived by the generic delete counts as open, and resolution_date is written by no route except an update that states it.' }],
  })
}

function incidentStatsFacts(a) {
  return aggregateRecord(a, {
    persona: 'Any member of the organization reading workplace incident statistics for a rolling period',
    owner: 'A computed summary over workplace_incidents rows of the organization; nothing is stored.',
    sens: 'Counts of incidents by status in the period and the average days from reported to closed date',
    priv: 'Every member receives organization-wide incident counts by status for the period; no row, name or narrative is returned, but a count of one reveals that an incident occurred.',
    does: 'Selects the count of incidents with an incident_date in the period (7d, 30d, 90d or 12m, default 30d) and the counts with status reported, investigating, resolved and closed and the average days between closed_date and reported_date (0 when none is closed), and returns them.',
    future: 'Exclude archived rows from the total, use the status values the schema defines, derive closed_date when an incident is closed, report an unmeasured average as absent rather than 0, and name the offices that read incident statistics.',
    def: [IDS.ARCHIVED, IDS.ZERO, IDS.RESOLUTION, IDS.FALLBACK],
    ev: [
      ...aggregateTenantEv(a, 'workplace_incidents'),
      orgFilterEv(a),
      a.h('mutation', "count(*) FILTER (WHERE status = 'investigating')::int AS investigating,"),
      a.h('defect', "count(*) FILTER (WHERE status = 'resolved')::int AS resolved,"),
      a.h('defect', 'avg(EXTRACT(EPOCH FROM (closed_date - reported_date)) / 86400.0)'),
      a.h('defect', 'avgResolutionTime: row.avg_resolution_days != null'),
      a.sch('defect', HS_SCHEMA, /status: varchar\("status", \{ length: 50 \}\)\.notNull\(\)\.default\("reported"\)/, { symbol: 'workplaceIncidents' }),
      a.sch('defect', HS_SCHEMA, /closedDate: timestamp\("closed_date"/, { symbol: 'workplaceIncidents' }),
    ],
    inf: [{ claim: 'defect', statement: 'The schema comment on status lists reported, investigating and closed for incidents while the statistics count a resolved status; no route sets closed_date when a status is changed, so the average covers only rows whose closed_date a body stated.' }],
  })
}

function trendsFacts(a) {
  return aggregateRecord(a, {
    persona: 'Any member of the organization (or a caller naming another organization) reading incident counts by day or month and severity',
    tenant: 'The handler takes organizationId from the query string and uses it as the only organization predicate (organization_id = the query value); when the parameter is absent the aggregate has no organization predicate. The session organization that withApi resolved is not read (the handler destructures only the request), and the supplied id is not compared with it. Row-level security applied inside withRLSContext (app.current_org_id from the session) is the only control that limits the rows, and nothing in the route proves it.',
    owner: 'A computed series over workplace_incidents rows of the organization the query names; nothing is stored.',
    sens: 'Counts of incidents per day or month split into minor, major and critical severity buckets, for the named organization or, without a parameter, for every row the connection can read',
    priv: 'Every member receives incident counts by date and severity bucket; the organization is chosen by the caller, so the data returned is for the organization the policy allows, which is the caller organization only if row-level security is applied to the connection.',
    does: 'Reads organizationId and period from the query string, runs one of four grouped count queries over workplace_incidents (by day or by month, with or without an organization predicate), groups severity into minor (near_miss, minor), major (moderate, serious) and critical (critical, fatal) and returns the series.',
    future: 'Derive the organization from the session, ignore or reject a query organizationId that differs from it, always apply the organization predicate in the query, and name the offices that read incident trends.',
    def: [IDS.TRENDS_ORG, IDS.ARCHIVED],
    ev: [
      ...aggregateTenantEv(a, 'workplace_incidents'),
      a.h('tenantScope', "const organizationId = url.searchParams.get('organizationId');"),
      a.h('tenantScope', 'WHERE organization_id = ${organizationId}'),
      a.h('mutation', 'FROM workplace_incidents'),
      a.h('defect', 'async ({ request }) => {'),
      a.h('defect', 'if (organizationId) {'),
      a.h('defect', '} else {'),
      a.h('defect', 'WHERE incident_date >= ${startISO}::timestamptz'),
      a.sch('tenantScope', RLS_0108, "EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);"),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler signature is async ({ request }) with no organizationId from the wrapper, the query string value is the only organization input, and the two branches without it contain no organization_id condition, so row-level security is the sole limit on the rows aggregated.' },
      { claim: 'defect', statement: 'No archived filter exists: the trend counts every incident row with an incident_date in the period, including rows the generic delete archived.' },
    ],
  })
}

function inspectionStatsFacts(a) {
  return aggregateRecord(a, {
    persona: 'Any member of the organization reading safety inspection statistics',
    owner: 'A computed summary over safety_inspections rows of the organization; nothing is stored.',
    sens: 'Counts of inspections by status and a compliance rate and average score computed from caller-stated item counts and scores',
    priv: 'Every member receives organization-wide inspection counts, a compliance rate and an average score; no row or finding is returned.',
    does: 'Selects counts of inspections and of those scheduled, completed and overdue, a compliance rate as the sum of items_passed over the sum of total_items_checked, and the average score_percentage, and returns the rates rounded to one decimal with 0 when nothing is measured.',
    future: 'Derive item counts and scores from checklist results, report an unmeasured rate as absent rather than 0, and name the offices that read inspection statistics.',
    def: [IDS.ZERO, IDS.OUTCOMES, IDS.FALLBACK],
    ev: [
      ...aggregateTenantEv(a, 'safety_inspections'),
      orgFilterEv(a),
      a.h('mutation', "count(*) FILTER (WHERE status = 'overdue')::int AS overdue,"),
      a.h('defect', '(100.0 * sum(items_passed) / NULLIF(sum(total_items_checked), 0)) AS compliance_rate,'),
      a.h('defect', 'avg(score_percentage) FILTER (WHERE score_percentage IS NOT NULL) AS avg_score'),
      a.h('defect', 'complianceRate: row.compliance_rate != null'),
      a.sch('defect', HS_SCHEMA, /itemsPassed: integer\("items_passed"\)/, { symbol: 'safetyInspections' }),
    ],
    inf: [{ claim: 'defect', statement: 'items_passed, total_items_checked and score_percentage are columns the inspection create and update store from the request body, and no code computes them from checklist results, so the compliance rate and average score are computed over caller-stated values.' }],
  })
}

function findingsFacts(a) {
  return aggregateRecord(a, {
    persona: 'Any member of the organization reading the most recent completed inspection findings',
    owner: 'A computed list over the twenty most recent completed or follow-up safety_inspections rows of the organization; nothing is stored.',
    sens: 'Per inspection: id, scope or checklist title, date, location, lead inspector name, compliance rate, pass, fail and n/a counts, critical hazard count and a derived status',
    priv: 'Every member receives the lead inspector name, location and results of the twenty latest completed inspections of the organization; no findings narrative is returned.',
    does: 'Selects the twenty most recent safety_inspections with status completed, requires_followup or followup_complete, maps each to a finding (n/a count as total minus passed minus failed, compliance rate from score_percentage with 0 when null, status mapped to completed, pending_review or approved) and returns them.',
    future: 'Report an unscored inspection as unscored rather than 0 percent, derive counts from checklist results, and name the offices that read inspection findings.',
    def: [IDS.ZERO, IDS.FALLBACK],
    ev: [
      ...aggregateTenantEv(a, 'safety_inspections'),
      orgFilterEv(a),
      a.h('mutation', "AND status IN ('completed', 'requires_followup', 'followup_complete')"),
      a.h('defect', 'complianceRate: row.score_percentage != null ? Number(row.score_percentage) : 0,'),
      a.h('privacy', 'lead_inspector_name,'),
      a.h('defect', 'LIMIT 20'),
      a.sch('privacy', HS_SCHEMA, /leadInspectorName: varchar\("lead_inspector_name"/, { symbol: 'safetyInspections' }),
    ],
    inf: [{ claim: 'defect', statement: 'complianceRate is Number(score_percentage) when the score is not null and 0 otherwise, so an inspection with no score is returned as 0 percent compliant with status completed.' }],
  })
}

function trainingStatsFacts(a) {
  return aggregateRecord(a, {
    persona: 'Any member of the organization reading the safety training due count on the training overview',
    owner: 'A computed count over safety_training_records rows of the organization; nothing is stored.',
    sens: 'The number of safety training records of the organization whose expiry date falls within thirty days (or is past)',
    priv: 'Every member receives one organization-wide count; no trainee or course is returned.',
    does: 'Counts safety_training_records of the session organization with an expiry date on or before thirty days from today (already expired records included) and returns the count as trainingDue.',
    future: 'Populate safety training records through a route that owns them, separate expired from due soon, and name the offices that read training currency.',
    status: 'PARTIAL',
    dec: [D_READERS],
    def: [IDS.TRAINING_NO_WRITER, IDS.FALLBACK],
    ev: [
      ...aggregateTenantEv(a, 'safety_training_records'),
      orgFilterEv(a),
      a.h('mutation', 'SELECT count(*)::int AS training_due'),
      a.h('defect', 'FROM safety_training_records'),
      a.h('defect', "AND expiry_date <= (CURRENT_DATE + INTERVAL '30 days')"),
      a.sch('defect', RLS_ROUND58, "EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'safety_training_records');"),
    ],
    inf: [{ claim: 'defect', statement: 'A search of the tracked application source for the safetyTrainingRecords export and the safety_training_records table name finds code that reads it only in this route and the dashboard route, so no route, service or job writes it and trainingDue is computed over a table that application code does not populate.' }],
  })
}

const MASS_ASSIGNMENT = 'DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'

/** The create hooks of incidents and hazards return a fixed key list, so the generic body-spread defect does not hold for their POST. */
function withoutBodySpread(record, a) {
  if (a.method !== 'POST') return record
  return {
    ...record,
    defects: record.defects.filter((id) => id !== MASS_ASSIGNMENT),
    evidence: record.evidence.filter((item) => !(item.claim === 'defect' && item.quote === '? { ...(body as Record<string, unknown>) }')),
  }
}

export function facts(a, readText) {
  const { route } = a
  if (route === 'health-safety/incidents/route.ts' || route === 'health-safety/incidents/[id]/route.ts') return withoutBodySpread(crudRecord(a, readText, incidentProfile(a)), a)
  if (route === 'health-safety/hazards/route.ts' || route === 'health-safety/hazards/[id]/route.ts') return withoutBodySpread(crudRecord(a, readText, hazardProfile(a)), a)
  if (route === 'health-safety/inspections/route.ts' || route === 'health-safety/inspections/[id]/route.ts') return crudRecord(a, readText, inspectionProfile(a))
  if (route === 'health-safety/ppe/route.ts') return crudRecord(a, readText, ppeProfile)
  if (route === 'health-safety/dashboard/route.ts') return dashboardFacts(a)
  if (route === 'health-safety/hazards/stats/route.ts') return hazardStatsFacts(a)
  if (route === 'health-safety/incidents/stats/route.ts') return incidentStatsFacts(a)
  if (route === 'health-safety/incidents/trends/route.ts') return trendsFacts(a)
  if (route === 'health-safety/inspections/stats/route.ts') return inspectionStatsFacts(a)
  if (route === 'health-safety/inspections/findings/route.ts') return findingsFacts(a)
  if (route === 'health-safety/stats/route.ts') return trainingStatsFacts(a)
  throw new Error(`no health-safety facts for ${a.route}`)
}
