/**
 * Gate 0B.11 facts: the reports surface. Twelve route files, 27 operations. Ten of the route files are the generic CRUD
 * factory configured over the single reports table (the collection, the item, the item paths named execute, run and
 * share, builder, templates, datasources/sample, scheduled and scheduled/[id]); none of them runs a report, shares one,
 * schedules one or samples a source. Two route files are hand written: the ad-hoc report execution engine
 * (reports/execute, which builds SQL from a caller-supplied configuration) and the data source registry
 * (reports/datasources). Every evidence item is produced by `opAuthoring` from the exact handler, the helper or service it
 * reaches, or the resolved schema, and is proved again by the validator. This tranche records the source; it repairs
 * nothing and approves no route.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, LOW_ROLE, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'

const CAP = 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION'
const GATE = 14

const D_DEFINITION_READERS = 'UE-INST-REPORT-DEFINITION-READERS-AND-SHARING'
const D_SOURCE_READERS = 'UE-INST-REPORT-SOURCE-DATA-READERS'
const D_SCHEDULED_DELIVERY = 'UE-INST-SCHEDULED-REPORT-RECIPIENTS-AND-DELIVERY'

const REPORT_SCHEMA = `${APP}db/schema/domains/analytics/reports.ts`
const REPORT_EXECUTOR = `${APP}lib/report-executor.ts`
const API_SECURITY = `${APP}lib/middleware/api-security.ts`
const EXECUTE_ROUTE = `${API}reports/execute/route.ts`
const DATASOURCES_ROUTE = `${API}reports/datasources/route.ts`
const WITH_RLS = `${APP}lib/db/with-rls-context.ts`
const MIGRATION_0108 = `${APP}db/migrations/0108_rls_tenant_isolation_foundation.sql`
const MIGRATION_ROUND58 = `${APP}db/migrations/20260910_rls_enforcement_expansion_round58.sql`
const MEMBERS_SCHEMA = `${APP}db/schema-organizations.ts`
const CLAIMS_SCHEMA = `${APP}db/schema/claims-schema.ts`
const DEADLINES_SCHEMA = `${APP}db/schema/deadlines-schema.ts`

export const ROUTES = new Set([
  'reports/[id]/execute/route.ts',
  'reports/[id]/route.ts',
  'reports/[id]/run/route.ts',
  'reports/[id]/share/route.ts',
  'reports/builder/route.ts',
  'reports/datasources/route.ts',
  'reports/datasources/sample/route.ts',
  'reports/execute/route.ts',
  'reports/route.ts',
  'reports/scheduled/[id]/route.ts',
  'reports/scheduled/route.ts',
  'reports/templates/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  RPT_REPORT_DEFINITIONS: {
    capabilityId: CAP,
    domain: 'REPORT_DEFINITIONS',
    actor: 'Steward keeping, and member reading, the saved report definitions of the organization (name, category, configuration JSON, public and template flags)',
    routes: ['reports/route.ts', 'reports/[id]/route.ts'],
    evidence: [
      ev(REPORT_SCHEMA, "export const reports = pgTable('reports', {"),
      ev(REPORT_SCHEMA, "config: jsonb('config').notNull(), // Report configuration (data sources, fields, filters, etc.)"),
      ev(`${API}reports/route.ts`, ' * CRUD collection route for reports'),
    ],
  },
  RPT_REPORT_LABELLED_PATH_COPIES: {
    capabilityId: CAP,
    domain: 'REPORT_RUN_SHARE_BUILDER_TEMPLATE_PATHS',
    actor: 'Steward or officer using a report page that expects a run, a share, the builder, the template list or a data source sample, and any caller of those path names',
    routes: [
      'reports/[id]/execute/route.ts',
      'reports/[id]/run/route.ts',
      'reports/[id]/share/route.ts',
      'reports/builder/route.ts',
      'reports/templates/route.ts',
      'reports/datasources/sample/route.ts',
    ],
    evidence: [
      ev(REPORT_SCHEMA, "export const reports = pgTable('reports', {"),
      ev(REPORT_SCHEMA, "isPublic: boolean('is_public').notNull().default(false),"),
      ev(REPORT_SCHEMA, "isTemplate: boolean('is_template').notNull().default(false),"),
      ev(`${API}reports/[id]/share/route.ts`, ' * CRUD item route for reports'),
    ],
  },
  RPT_SCHEDULED_REPORTS: {
    capabilityId: CAP,
    domain: 'SCHEDULED_REPORT_DELIVERY',
    actor: 'Administrator or steward scheduling a report for recurring delivery to named recipients, and the member reading the schedule list',
    routes: ['reports/scheduled/route.ts', 'reports/scheduled/[id]/route.ts'],
    evidence: [
      ev(`${APP}components/admin/ScheduledReportForm.tsx`, 'deliveryMethod: formData.deliveryMethod,'),
      ev(`${APP}components/admin/ScheduledReportForm.tsx`, 'recipients,'),
      ev(`${APP}lib/reality/capability-registry.ts`, "id: 'UE-CRON-SCHEDULED-REPORTS',"),
    ],
  },
  RPT_ADHOC_EXECUTION: {
    capabilityId: CAP,
    domain: 'ADHOC_REPORT_EXECUTION',
    actor: 'Officer building and running an ad-hoc report over claims or members whose rows are returned as the report result',
    routes: ['reports/execute/route.ts'],
    evidence: [
      ev(EXECUTE_ROUTE, ' * Dynamically builds and executes SQL queries based on report config'),
      ev(REPORT_EXECUTOR, ' * Executes report configurations by generating and running SQL queries dynamically.'),
    ],
  },
  RPT_DATA_SOURCE_REGISTRY: {
    capabilityId: CAP,
    domain: 'REPORT_DATA_SOURCE_REGISTRY',
    actor: 'Signed-in user opening the report builder to see which data sources and fields a report can be built from',
    routes: ['reports/datasources/route.ts'],
    evidence: [
      ev(DATASOURCES_ROUTE, ' * Returns metadata for building reports dynamically'),
      ev(REPORT_EXECUTOR, ' * Registry of available data sources with metadata'),
    ],
  },
}

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE, severity, title, ...extra })

const DEF_READ = 'DEF-0B11-RPT-DEFINITION-READS-RETURN-EVERY-REPORT-OF-THE-ORGANIZATION-TO-ANY-MEMBER-AND-NO-ROUTE-READS-IS-PUBLIC'
const DEF_CONFIG = 'DEF-0B11-RPT-STORED-CONFIG-IS-UNVALIDATED-UNBOUNDED-JSON-THAT-NO-SAVE-APPLIES-THE-EXECUTOR-CONTRACT-TO'
const DEF_RUN_PATHS = 'DEF-0B11-RPT-RUN-AND-EXECUTE-ITEM-PATHS-ARE-REPORT-DEFINITION-CRUD-AND-THEIR-DELETE-REMOVES-THE-REPORT'
const DEF_SHARE_PATH = 'DEF-0B11-RPT-SHARE-ITEM-PATH-SHARES-NOTHING-AND-ITS-DELETE-REMOVES-THE-REPORT'
const DEF_TEMPLATES = 'DEF-0B11-RPT-TEMPLATES-ROUTE-LISTS-EVERY-REPORT-DEFINITION-AND-STORES-A-NON-TEMPLATE-BY-DEFAULT'
const DEF_BUILDER_SAMPLE = 'DEF-0B11-RPT-BUILDER-AND-DATA-SOURCE-SAMPLE-PATHS-ARE-REPORT-DEFINITION-CRUD-AND-SAMPLE-NO-SOURCE'
const DEF_SCHEDULED = 'DEF-0B11-RPT-SCHEDULED-PATHS-ARE-REPORT-DEFINITION-CRUD-NO-SCHEDULE-RECIPIENT-OR-DELIVERY-EXISTS-AND-PAUSE-RESUME-REPORT-SUCCESS'
const DEF_JOIN_XT = 'DEF-0B11-RPT-EXECUTE-JOINED-TABLES-CARRY-NO-ORGANIZATION-PREDICATE-SO-A-CALLER-CONFIGURED-JOIN-SELECTS-ROWS-OF-OTHER-ORGANIZATIONS'
const DEF_FILTER_BYPASS = 'DEF-0B11-RPT-EXECUTE-ROUTE-ALLOWLIST-CHECKS-FILTER-FIELD-ID-BUT-THE-EXECUTOR-EVALUATES-FIELD-NAME-AND-JOINS-HAVING-LIMIT-AND-TABLE-QUALIFIER-ARE-NOT-CHECKED'
const DEF_FILTERS_DROPPED = 'DEF-0B11-RPT-EXECUTE-OPERATORS-THE-ROUTE-ACCEPTS-ARE-SKIPPED-BY-THE-EXECUTOR-SO-THE-FILTER-IS-DROPPED-AND-ALL-ROWS-RETURN'
const DEF_FAILURE_200 = 'DEF-0B11-RPT-EXECUTE-FAILURE-IS-ANSWERED-200-WITH-NO-MESSAGE-AND-AUDITED-AS-SUCCESS-OR-AUTH-FAILED'
const DEF_SOURCE_READS = 'DEF-0B11-RPT-EXECUTE-RETURNS-MEMBER-EMAIL-AND-CLAIM-ROWS-AT-AN-OFFICER-ROLE-TITLE-WITH-NO-FIELD-AUTHORITY-AND-NO-DURABLE-RECORD-OF-WHAT-WAS-RETURNED'
const DEF_REGISTRY_MISMATCH = 'DEF-0B11-RPT-DATA-SOURCE-REGISTRY-ADVERTISES-SOURCES-AND-COLUMNS-THE-EXECUTE-ROUTE-REFUSES-OR-THE-TABLES-DO-NOT-HAVE'
const DEF_REGISTRY_SESSION_ONLY = 'DEF-0B11-RPT-DATA-SOURCE-REGISTRY-IS-SERVED-TO-ANY-SIGNED-IN-USER-WHILE-EXECUTION-NEEDS-AN-OFFICER'

const REPORT_FACADE_PATH = {
  'reports/[id]/execute/route.ts': 'execute',
  'reports/[id]/run/route.ts': 'run',
  'reports/[id]/share/route.ts': 'share',
  'reports/builder/route.ts': 'builder',
  'reports/templates/route.ts': 'templates',
  'reports/datasources/sample/route.ts': 'sample',
}

export const DEFECTS = [
  D(DEF_READ, CAP, 'MEDIUM',
    'The report definition reads (the collection, the item and every path that is a copy of them) are the generic factory read at a member floor over the reports table: the table has no owner column the factory uses and the routes declare no ownerColumn, so any member of the organization receives every report definition of the organization, including definitions written by other users and definitions whose is_public flag is false, each with its whole config JSON that names data sources, fields and filter values, and no route under /api/reports reads is_public, so the flag restricts nothing.'),
  D(DEF_CONFIG, CAP, 'LOW',
    'The report definition writes store the config JSON from the request body as written: the column is an untyped notNull jsonb, no schema bounds its size or depth, and nothing at save time applies the contract of the report executor (a data source id of its registry, registry field ids, its filter operators, its allowed joins) or the allowlist of the execute route, so a definition that names an unknown source, a refused operator or a join to any table is stored and returned as a success that a later run would refuse or misread.'),
  D(DEF_RUN_PATHS, CAP, 'MEDIUM',
    'The /api/reports/[id]/execute and /api/reports/[id]/run routes are the same generic crudRoutes configuration over the reports table as the item route: neither imports ReportExecutor, reads a source table or loads the config of the report into an engine, so a GET answers the stored definition row (not a result), a PATCH rewrites the definition (including run_count and last_run_at, which no route ever advances) and answers success, and a DELETE at the administrator floor hard-deletes the report itself, so a caller or client that believes it is running or removing a run removes the report definition.'),
  D(DEF_SHARE_PATH, CAP, 'MEDIUM',
    'The /api/reports/[id]/share route is the same generic crudRoutes configuration over the reports table as the item route: it has no recipient, link, grant or share column, sends nothing and checks nothing, a PATCH that sets is_public true or false only stores a flag that no route reads, and a DELETE at the administrator floor, the natural verb to revoke a share, hard-deletes the whole report, so a share request is answered with success while nothing is shared, and a revocation destroys the report.'),
  D(DEF_TEMPLATES, CAP, 'MEDIUM',
    'The /api/reports/templates route is the generic collection over the reports table with no template filter: a GET returns every report definition of the organization to any member, including custom, scheduled and private definitions that are not templates (the table has is_template and a template value of report_type and the route reads neither), and a POST stores a definition with is_template false unless the body sets it, so the list that the admin page labels templates is the whole definition table.'),
  D(DEF_BUILDER_SAMPLE, CAP, 'MEDIUM',
    'The /api/reports/builder and /api/reports/datasources/sample routes are the generic collection over the reports table: the builder answers a GET with the definition rows and a POST stores the posted body as a definition without applying the data source registry or the execute allowlist to it, and the data source sample route, which the data source explorer calls with sourceId and fieldId to preview values, ignores both parameters, reads no data source and returns a page of report definitions under a data key where the explorer reads a samples array, so a field preview is always empty and a POST to the sample route creates a report row.'),
  D(DEF_SCHEDULED, CAP, 'MEDIUM',
    'The /api/reports/scheduled and /api/reports/scheduled/[id] routes are the generic CRUD configuration over the reports table, which has no schedule, recipient, delivery method, export format, next run or active column, while the scheduled report form posts reportId, scheduleType, scheduleConfig, deliveryMethod, recipients, exportFormat and isActive: none of those keys is a column, a create carries neither the notNull name nor the notNull config so it cannot insert a row, a pause or resume PATCH with an action key writes only updated_at and is answered with success, the list answers data and pagination where the page reads schedules, a DELETE hard-deletes a report row, and the scheduled reports cron answers 501, so no schedule, recipient list or delivery exists and the pause, resume and delete the page confirms change nothing about delivery.'),
  D(DEF_JOIN_XT, CAP, 'HIGH',
    'POST /api/reports/execute validates the caller-supplied report configuration only for the fields, filters, grouping and sort (the joins are not read by the route) and the executor then builds the join from the caller: any registry table (claims, organization_members, claim_deadlines, dues_assignments) with any registry columns and an operator of =, !=, >, <, >= or <=, the select list qualifies a column with the caller-supplied field.table, and the only organization predicate of the statement is organization_id = the session organization on the base table, so a join such as claims INNER JOIN organization_members ON claims.id != organization_members.id selects id, status and created_at of the member rows of every organization, and claims.id != dues_assignments.id or claim_deadlines does the same for dues assignments and deadlines, up to the executor default limit of 1000 and to any limit the caller names, with whether the rows of other organizations are filtered resting wholly on database row-level security that the route does not set (a tenant transaction and the union_eyes_runtime role exist only when UE_CANONICAL_BOOTSTRAP_V2 is 1).',
    {
      riskCategories: ['ANALYTICS_CROSSES_BOUNDARY', 'RLS_ASSUMED_FROM_DB_CLIENT', 'SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'],
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'An officer of any organization posts a report configuration to /api/reports/execute with a join to another registry table on a non-equality operator and a select field qualified with the joined table: the executor adds organization_id equal to the session organization to the base table only and returns the joined-table rows of every organization (member ids, statuses and creation dates, dues assignment ids and statuses, claim deadline ids and statuses), subject only to whatever row-level security the connection role applies.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE', 'SAME_TENANT_OVER_DISCLOSURE'],
          description: 'An officer can read identifiers, statuses and dates of member, dues and deadline rows that belong to other organizations through a report join, and can use filters on joined columns to test values held by other organizations, because the organization predicate is attached to one table of a multi-table statement.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          { ref: EXECUTE_ROUTE, quote: "export const POST = withRoleAuth('officer', async (request: NextRequest, context) => {" },
          { ref: REPORT_EXECUTOR, quote: 'result = sql`${result} ${sql.raw(joinType)} JOIN ${safeTableName(join.table)} ON ${safeColumnName(join.on.leftField)} ${sql.raw(operator)} ${safeColumnName(join.on.rightField)}`;' },
          { ref: REPORT_EXECUTOR, quote: 'whereConditions.push(sql`${safeTableName(baseTable)}.organization_id = ${this.organizationId}`);' },
        ],
        existingContainment: {
          summary: 'When UE_CANONICAL_BOOTSTRAP_V2 is 1 the wrapper runs the handler inside withRLSContext, which switches the transaction to the union_eyes_runtime role, and the migrations create direct organization policies for claims, organization_members and claim_deadlines, so the joined rows of other organizations would be hidden by the database; with the flag unset or 0 the statement runs on the pooled connection with no tenant context and nothing in the route or the executor limits the joined tables.',
          evidence: [
            { ref: WITH_RLS, quote: 'await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)' },
            { ref: MIGRATION_0108, quote: "SELECT ue_create_direct_org_rls_policy('claims');" },
            { ref: MIGRATION_ROUND58, quote: "PERFORM ue_create_direct_org_rls_policy('claim_deadlines', 'organization_id', FALSE);" },
          ],
        },
        justification: 'The statement itself carries no organization predicate for any joined table and the join, the operator and the qualifying table come from the caller, so correctness of tenant isolation is delegated to row-level security that is active only in the canonical mode and that the route does not assert; a reachable path that returns rows outside the caller organization when the connection is not bound by the policy is not contained by a flag the source does not force, so the route blocks release until every table of the statement is held to the session organization in the query.',
      },
    }),
  D(DEF_FILTER_BYPASS, CAP, 'MEDIUM',
    'POST /api/reports/execute checks each filter against the route allowlist by filter.fieldId while the executor evaluates filter.fieldName when it is present (a registry column of any registry table, qualified or not), so a filter can name columns the route refuses as fields (claims.member_id, claims.assigned_to, organization_members.role, dues_assignments.amount) with the operators in and between that both layers accept, and use the row count and the selected rows as a test of what those columns hold; the route also never reads joins, having, limit, offset or the table qualifier of a selected field, and the executor accepts limit and offset from the caller (default 1000, no maximum), so one request can ask for an unbounded read and the rate limit of 30 per hour is the only bound.'),
  D(DEF_FILTERS_DROPPED, CAP, 'MEDIUM',
    'POST /api/reports/execute accepts the filter operators equals, not_equals, contains, greater_than, less_than, between and in, while the executor implements eq, ne, gt, lt, gte, lte, like, ilike, in, not_in, is_null, is_not_null and between and skips any other operator without an error: a filter with equals, not_equals, contains, greater_than or less_than passes the route, is dropped by the executor, and the report is returned with its other conditions and no restriction from that filter, so a report configured for one status, type or period returns every claim or member row of the organization (up to the limit) with success true.'),
  D(DEF_FAILURE_200, CAP, 'MEDIUM',
    'POST /api/reports/execute answers 200 with success false, no data and no row count when the executor fails (an unknown data source of the executor registry, a field or column the table does not have, a join the executor refuses or a database error), because the executor returns the failure as a value and the route copies only success, data, rowCount and executionTime, dropping the error text; the audit event of that run is logged with the event type success and the success flag in its details, an exception is logged as auth_failed with severity high, and a data source the route allowlist accepts but the executor registry does not (members, deadlines, grievances) fails this way for every caller.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_SOURCE_READS, CAP, 'MEDIUM',
    'POST /api/reports/execute returns the rows of the executed configuration to any caller whose role title is officer or above: the allowlist lets the caller select the email and status of every member of the organization (and claim numbers, types, statuses and dates of every claim), with no per-field authority, no classification or consent check, no row cap smaller than the caller limit and no suppression of small groups, and the only records are a logger line by logApiAuditEvent (user, data source, counts, no rows, no field list) and the generic wrapper record of the path, so what an officer extracted is not durably recorded and no institutional decision names the offices that may reproduce member or claim columns in a report.',
    { riskCategories: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'] }),
  D(DEF_REGISTRY_MISMATCH, CAP, 'MEDIUM',
    'GET /api/reports/datasources advertises four sources (claims, organization_members, claim_deadlines, dues_assignments) with fields that the execute route does not match: the route allowlist refuses claim_deadlines and dues_assignments (400) and accepts members, deadlines and grievances that the executor registry does not have, and the registry names columns that the tables do not define (organization_members first_name and last_name where the table has name, claims outcome where the table has resolution_outcome, claim_deadlines current_deadline where the table has due_date and original_deadline), so a report built from the registry as advertised is refused by the route or fails in the database and is answered 200 with success false.'),
  D(DEF_REGISTRY_SESSION_ONLY, CAP, 'LOW',
    'GET /api/reports/datasources is wrapped in withApiAuth only and applies no role floor: any signed-in user with an organization receives the whole registry (table names, column names, types and the joinable tables, including member email, member id and dues amount columns) although running a report needs the officer role, and the organization it checks is the one on the user object, not one resolved for the query; the response contains no rows.'),
]

export const DECISIONS = [
  {
    id: D_DEFINITION_READERS,
    status: 'OUTSTANDING',
    question: 'Who may read, edit, publish or share a saved report definition of an organization (its author only, offices the institution names, every member), what does the is_public flag mean, and may a definition that embeds filter values about members be visible to every member?',
    sourceState: 'The report routes are generic CRUD over the reports table: every member reads every definition of the organization, a steward writes any definition with any field including is_public, is_template and report_type, an administrator deletes it, and no route reads is_public, shares a report or records a recipient. No adopted decision names the readers, the sharers or the meaning of the flag.',
    softwareOwners: [CAP],
  },
  {
    id: D_SOURCE_READERS,
    status: 'OUTSTANDING',
    question: 'Which offices may reproduce member and claim columns (member email, claimant and assignee identifiers, claim status and dates, dues amounts) in a free-form report, which columns are releasable at all, and what must be recorded and suppressed when a report returns them?',
    sourceState: 'The execute route lets any caller whose role title is officer or above select the email and status of every member and the claim columns of its allowlist and join other registry tables, and records only a logger line; the role floor is a role title and no adopted decision names the offices, the releasable columns or the record to keep.',
    softwareOwners: [CAP],
  },
  {
    id: D_SCHEDULED_DELIVERY,
    status: 'OUTSTANDING',
    question: 'Who may schedule a report for recurring delivery, which recipients (members, officers, addresses outside the union) and formats are allowed, who approves delivery of member or claim data outside the application, and what is the stop and audit rule for a schedule?',
    sourceState: 'The scheduled report page collects recipients, a delivery method and an export format and posts them to routes that are generic CRUD over the reports table, which stores none of them, and the scheduled reports cron answers 501, so no delivery occurs and no adopted decision names the recipients, the approver or the audit rule that a real delivery would need.',
    softwareOwners: [CAP],
  },
]

export const CAPABILITIES = []

/* ------------------------------------------------------------------------------------------------------------ */
/* the CRUD copies over the reports table                                                                          */
/* ------------------------------------------------------------------------------------------------------------ */

const SENS_DEFINITION = 'Report names, descriptions, category (claims, members, financial, compliance, performance, custom), report type, the config JSON that names data sources, fields and filter values, the public and template flags, and the creator and updater user ids; no result rows are stored in the row'

const FUTURE_DEFINITIONS = 'Name the offices that may read, edit, publish and share a report definition and hold reads of private definitions to the author or those offices (an owner condition on created_by and a real meaning for is_public), validate config against the executor contract on save, and record deletions with the removed definition.'
const FUTURE_RUN = 'Replace the path with a run operation that loads the saved definition of the organization, applies the same column authority and organization predicate on every table as the ad-hoc engine, bounds and audits the result, records run_count and last_run_at, and leave definition edits and deletes to the definition route.'
const FUTURE_SHARE = 'Replace the path with a share operation that names the recipients or audience, the permitted columns and an approver, stores and audits the grant and its revocation, and keep deletion of the report out of the share path.'
const FUTURE_TEMPLATES = 'Serve templates from a filter on is_template or report_type template (or a template table), restrict who may publish a template, and keep private definitions out of the template list.'
const FUTURE_BUILDER = 'Validate a definition against the data source registry and the execute allowlist when the builder saves it, and serve data source samples from a dedicated route that applies column authority and the organization predicate and returns a bounded, masked sample.'
const FUTURE_SCHEDULED = 'Decide the recipients and approver, store a schedule in a table that has the schedule, recipients, format and next run (or reuse the analytics scheduled reports table), deliver through a cron that applies the same column authority and organization predicate as the ad-hoc engine, and make pause, resume and delete change and audit the schedule.'

function crudProfile(a) {
  const route = a.route
  const kind = REPORT_FACADE_PATH[route] ?? (route.startsWith('reports/scheduled') ? 'scheduled' : 'definitions')
  const isItem = route.includes('[id]')
  const isRead = a.method === 'GET'
  const unit = kind === 'scheduled' ? (isItem ? 'schedule' : 'schedules') : isItem ? 'definition' : 'definitions'

  const pathText = {
    definitions: isItem ? 'the saved report definition of the path id' : 'the saved report definitions of the organization',
    execute: 'the report definition of the path id under a path named execute',
    run: 'the report definition of the path id under a path named run',
    share: 'the report definition of the path id under a path named share',
    builder: 'the report definitions of the organization under the builder path',
    templates: 'the report definitions of the organization under the templates path',
    sample: 'the report definitions of the organization under the data source sample path',
    scheduled: isItem ? 'the report definition of the path id under the scheduled path' : 'the report definitions of the organization under the scheduled path',
  }[kind]

  const future = {
    definitions: FUTURE_DEFINITIONS,
    execute: FUTURE_RUN,
    run: FUTURE_RUN,
    share: FUTURE_SHARE,
    builder: FUTURE_BUILDER,
    templates: FUTURE_TEMPLATES,
    sample: FUTURE_BUILDER,
    scheduled: FUTURE_SCHEDULED,
  }[kind]

  const decisions = (kind === 'scheduled' ? [D_SCHEDULED_DELIVERY] : [D_DEFINITION_READERS])

  const def = (method) => {
    const out = []
    if (method === 'GET') out.push(DEF_READ)
    if (method === 'POST' || method === 'PATCH') {
      out.push('DEF-0B7-EXP-REPORT-WRITES-ANY-STEWARD-ANY-FIELD')
      if (kind === 'definitions' || kind === 'builder' || kind === 'templates' || kind === 'sample' || kind === 'scheduled') out.push(DEF_CONFIG)
    }
    if (method === 'DELETE') out.push('DEF-0B7-EXP-REPORT-HARD-DELETE-AUDIT-NAMES-NO-FIELDS')
    if (kind === 'execute' || kind === 'run') out.push(DEF_RUN_PATHS)
    if (kind === 'share') out.push(DEF_SHARE_PATH)
    if (kind === 'templates') out.push(DEF_TEMPLATES)
    if (kind === 'builder' || kind === 'sample') out.push(DEF_BUILDER_SAMPLE)
    if (kind === 'scheduled') out.push(DEF_SCHEDULED)
    return out
  }

  return {
    persona: isRead
      ? `Member reading, and steward or officer using, the ${kind === 'definitions' ? 'report list and report page' : `${kind} page of reports`}; any member of the organization receives the rows`
      : `Steward (administrator for delete) using the ${kind === 'definitions' ? 'report editor' : `${kind} page of reports`}; no caller receives a report result, a share, a template or a schedule from this route`,
    owner: `reports rows of the organization (${route.replace('/route.ts', '')} has no table of its own: it serves ${pathText}); created_by holds the creating user id, set by the factory on create and rewritable by an update; config holds the report configuration JSON.`,
    sens: SENS_DEFINITION,
    priv: (method) => ({
      GET: `Any member of the organization receives ${isItem ? 'the row' : 'rows, 50 per page by default and 100 at most,'} of ${pathText} with name, description, category, config JSON, public and template flags and creator; the rows of other organizations are not selected, nothing narrows them to the author or to public definitions and no read is audited.`,
      POST: 'The row stored from the body is returned in full; the audit record lists the field names written and no values, and the body may set report type, public and template flags, creator-adjacent counters and the config.',
      PATCH: 'The updated row is returned in full; the audit record lists the field names written and no values, and any body column except the id and organization can be changed, including config, flags, counters and the updater.',
      DELETE: 'The deleted row is returned in full, so the definition is in the response, and the audit record lists no field, so the removed definition is not kept.',
    })[method],
    does: (method, _model, floor) => {
      const base = {
        definitions: isItem
          ? 'This is the report definition item route proper'
          : 'This is the report definition collection route proper',
        execute: 'Despite the execute path segment, this is a copy of the report item route',
        run: 'Despite the run path segment, this is a copy of the report item route',
        share: 'Despite the share path segment, this is a copy of the report item route',
        builder: 'Despite the builder path segment, this is a copy of the report collection route',
        templates: 'Despite the templates path segment, this is a copy of the report collection route with no template filter',
        sample: 'Despite the datasources/sample path segment, this is a copy of the report collection route',
        scheduled: isItem
          ? 'Despite the scheduled path segment, this is a copy of the report item route'
          : 'Despite the scheduled path segment, this is a copy of the report collection route',
      }[kind]
      const noEngine = kind === 'definitions' ? '' : ` No ReportExecutor call, source table read, ${kind === 'share' ? 'recipient, link or grant' : kind === 'scheduled' ? 'schedule, recipient or delivery' : kind === 'templates' ? 'template filter' : kind === 'sample' ? 'data source sample' : kind === 'builder' ? 'definition validation' : 'run or result'} exists in the route.`
      if (method === 'GET') return `${base}. Returns ${isItem ? 'the reports row of the path id' : 'a page of reports rows'} of the session organization at a role floor of ${floor}, newest first${isItem ? '' : ' and paginated'}, ignoring the query parameters its clients send.${noEngine}`
      if (method === 'POST') return `${base}. Inserts a reports row from the whole body at a role floor of ${floor}, with the organization and creator taken from the session, and commits the factory audit record with it; a missing name or config surfaces as a database error.${noEngine}`
      if (method === 'PATCH') return `${base}. Updates the reports row of the path id from the whole body (except the primary key and organization) at a role floor of ${floor} and commits the factory audit record with it; body keys that are not columns are ignored and the answer is success.${noEngine}`
      return `${base}. Hard-deletes the reports row of the path id at the fixed administrator floor (${floor}) and commits the factory audit record with it (the table has no status column).${noEngine}`
    },
    future,
    gate: GATE,
    deps: [10, 13],
    decisions,
    status: () => 'FACADE_OVER_GENERIC_TABLE',
    def,
    reqRead: 'Audit reads of report definitions once the offices that may read them are named; the config JSON names data sources, fields and filter values of reports over claims, members and finances.',
    extraEv: (b) => {
      const out = [
        b.tbl('defect', 'reports', /config: jsonb\('config'\)\.notNull\(\)/),
        b.tbl('defect', 'reports', /isPublic: boolean\('is_public'\)/),
        b.tbl('defect', 'reports', /createdBy: varchar\('created_by'/),
      ]
      if (isRead) out.push(b.sch('privacy', LOW_ROLE, "return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }"))
      if (a.method === 'POST' || a.method === 'PATCH') out.push(b.tbl('defect', 'reports', /reportType: reportTypeEnum\('report_type'\)\.notNull\(\)\.default\('custom'\)/))
      if (kind === 'templates') out.push(b.tbl('defect', 'reports', /isTemplate: boolean\('is_template'\)/))
      if (kind === 'scheduled') {
        out.push(
          b.tbl('defect', 'reports', /name: varchar\('name', \{ length: 255 \}\)\.notNull\(\)/, {
            absentColumns: ['is_active', 'recipients', 'schedule_type', 'schedule_config', 'delivery_method', 'export_format', 'next_run_at', 'reportId'],
          }),
        )
      }
      if (a.method === 'DELETE') out.push(b.imp('defect', 'crudRoutes', 'const deleted = await audited(organizationId, userId, \'delete\', [],'))
      return out
    },
    inferences: () => {
      const out = []
      if (kind !== 'definitions') {
        out.push({ claim: 'defect', statement: `The route file imports only crudRoutes and the reports table and configures them with orgScoped, readRole member and writeRole steward; it imports no ReportExecutor, scheduler, sender or sampler, so the ${kind} path name selects no behaviour.` })
      }
      if (kind === 'scheduled') {
        out.push({ claim: 'defect', statement: 'The scheduled reports page reads data.schedules from a GET and posts reportId, scheduleType, scheduleConfig, deliveryMethod, recipients, exportFormat and isActive from the schedule form (and an action key of pause or resume from the toggle); the factory answers data and pagination and the table has none of those columns, and app/api/cron/scheduled-reports/route.ts answers 501 NOT_IMPLEMENTED, so the page shows an empty list and its create, pause and resume are not delivery changes.' })
      }
      if (kind === 'sample') {
        out.push({ claim: 'defect', statement: 'The data source explorer calls /api/reports/datasources/sample with sourceId and fieldId and reads result.samples as an array; the route returns data and pagination, so the explorer falls to its empty preview.' })
      }
      if (kind === 'share' || kind === 'definitions') {
        out.push({ claim: 'defect', statement: 'A search of apps/union-eyes/app/api/reports finds no read of the isPublic column, and the db/rls-storage-authority reference-latent record of the reports table states the same.' })
      }
      return out
    },
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* reports/execute                                                                                                 */
/* ------------------------------------------------------------------------------------------------------------ */

function executeFacts(a) {
  return mk({
    persona: 'Officer (or above) building an ad-hoc report over claims or members and receiving the resulting rows',
    service: `${API}reports/execute/route.ts (POST) building SQL in ReportExecutor (${REPORT_EXECUTOR})`,
    authn: `${SESSION}: withRoleAuth loads the current user (401 when absent) and resolves the organization of that user.`,
    cat: 'ROLE_FLOOR',
    authz: "withRoleAuth('officer'): hasRole('officer') on the role title, a per-user rate limit of 30 per hour (rejected when no Redis is configured), then a route allowlist of tables and columns and an executor registry check; none is a kernel decision about the member and claim columns the report may return, and no office, consent or column classification is consulted.",
    tenant: 'The organization comes from the session (getOrganizationIdForUser) and is attached as organization_id = $1 to the BASE table of the statement only; joined tables, join conditions and qualified select columns come from the caller and carry no organization predicate, and the statement runs through the shared db handle (a tenant transaction only when UE_CANONICAL_BOOTSTRAP_V2 is 1).',
    owner: 'No stored resource: the caller-supplied configuration is turned into SELECT ... FROM <base table> [JOIN <registry table> ...] over claims or organization_members rows and the rows are returned; a saved reports row is never loaded.',
    sens: 'Member email and status, claim number, type, status and dates, and through a join the ids, statuses and dates of dues assignments, deadlines and members; with the join defect, rows of other organizations',
    priv: 'The caller receives up to the requested limit of rows selected by its own configuration (1000 by default), including every member email of the organization and every claim row it selects, and through a join rows of other organizations; filters the route accepts as equals, not_equals, contains, greater_than or less_than are dropped.',
    mut: 'LOG_ONLY',
    auditDetail: 'logApiAuditEvent writes a logger.info line (user, endpoint, data source, field and filter counts, row count) after the run; the withRoleAuth wrapper records a generic data access event for the path; no record names the fields, filters, joins or rows returned, and no audit row is committed with the read.',
    reqAudit: 'Persist an audit record of each execution with the actor, the data source, the fields, filters and joins and the row count, once the offices that may extract member and claim columns are decided.',
    does: 'Rate limits the user, validates the body (config is z.unknown), checks the data source and fields against a route allowlist, builds SELECT SQL in ReportExecutor with the base-table organization predicate, caller filters, grouping, sort, joins and a default limit of 1000, runs it with db.execute and returns success, data, rowCount and executionTime; an executor failure is returned as 200 with success false and no message.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [10, 13],
    future: 'Resolve every table of the statement to the session organization in the query itself (a predicate or a scoped subquery per joined table, or no joins), run the statement inside the tenant transaction, apply one column authority at the route and the executor with one operator vocabulary, cap limit and offset, return executor errors as errors, and persist an audit record of what each execution returned.',
    dec: [D_SOURCE_READERS],
    corr: [{ field: 'audit', manifest: 'NOT_APPLICABLE:COMPUTE_ONLY', actual: 'The route returns rows of claims and member tables and records only a logger line and the generic wrapper event, so the compute-only classification understates a read of member and claim columns.' }],
    ev: [
      a.h('authorization', "export const POST = withRoleAuth('officer', async (request: NextRequest, context) => {"),
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', 'const rateLimitResult = await checkRateLimit('),
      a.h('tenantScope', 'const { userId, organizationId } = context as { userId: string; organizationId: string };'),
      a.svc('tenantScope', REPORT_EXECUTOR, '.organization_id = ${this.organizationId}', 'ReportExecutor.buildQuery'),
      a.h('mutation', 'const result = await executor.execute(config);'),
      a.h('audit', 'logApiAuditEvent({'),
      a.svc('audit', API_SECURITY, "logger.info('API_SECURITY_AUDIT', {", 'logApiAuditEvent'),
      a.imp('audit', 'withRoleAuth', 'const _emission = auditLog({'),
      a.h('behavior', 'const validationError = validateReportConfig(config);'),
      a.svc('behavior', REPORT_EXECUTOR, 'const results = await db.execute(query);', 'ReportExecutor.execute'),
      a.h('privacy', 'data: result.data,'),
      a.local('privacy', 'validateReportConfig', 'const allowedColumns = ALLOWED_TABLES[config.dataSourceId];'),
      a.svc('privacy', REPORT_EXECUTOR, "{ id: 'email', name: 'Email', column: 'email'"),
      a.svc('defect', REPORT_EXECUTOR, "const ALLOWED_OPERATORS = ['=', '!=', '>', '<', '>=', '<='];", 'ReportExecutor.buildJoinClause'),
      a.svc('defect', REPORT_EXECUTOR, 'JOIN ${safeTableName(join.table)} ON', 'ReportExecutor.buildJoinClause'),
      a.svc('defect', REPORT_EXECUTOR, '? `${field.table}.${fieldMeta.column}`', 'ReportExecutor.buildSelectClause'),
      a.svc('defect', REPORT_EXECUTOR, 'const ref = filter.fieldName || filter.fieldId;', 'ReportExecutor.validateConfig'),
      a.local('defect', 'validateReportConfig', 'if (!allowedColumns.includes(filter.fieldId)) {'),
      a.local('defect', 'validateReportConfig', 'if (!ALLOWED_OPERATORS.includes(filter.operator)) {'),
      a.svc('defect', REPORT_EXECUTOR, "case 'eq':", 'ReportExecutor.buildFilterClause'),
      a.svc('defect', REPORT_EXECUTOR, /^default:$/, 'ReportExecutor.buildFilterClause'),
      a.svc('defect', REPORT_EXECUTOR, 'const limit = config.limit || 1000; // Default limit', 'ReportExecutor.buildQuery'),
      a.svc('defect', REPORT_EXECUTOR, "error: error.message || 'Report execution failed',"),
      a.h('defect', "eventType: 'success',"),
      a.h('defect', 'success: result.success,'),
      a.h('defect', "severity: 'high',"),
      a.sch('defect', MEMBERS_SCHEMA, /email: text\('email'\)\.notNull\(\)/, { symbol: 'organizationMembers' }),
    ],
    inf: [
      { claim: 'defect', statement: 'ALLOWED_TABLES lists the keys claims, members, organization_members, deadlines and grievances, and DATA_SOURCES lists claims, organization_members, claim_deadlines and dues_assignments; the sources the two lists share are claims and organization_members, and a configuration reaches the joins of the executor with any registry table whatever the route allowlist says, because the route never reads config.joins.' },
      { claim: 'defect', statement: 'No source in the repository loads a saved reports row into ReportExecutor (a search for ReportExecutor under apps/union-eyes finds the execute route, the registry module and tests), so the engine runs only on a configuration posted in the request.' },
    ],
    def: [DEF_JOIN_XT, DEF_FILTER_BYPASS, DEF_FILTERS_DROPPED, DEF_FAILURE_200, DEF_SOURCE_READS],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* reports/datasources                                                                                             */
/* ------------------------------------------------------------------------------------------------------------ */

function datasourcesFacts(a) {
  return mk({
    persona: 'Signed-in user opening the report builder, which lists the data sources and fields a report can be built from',
    service: `${API}reports/datasources/route.ts (GET) over the registry of ${REPORT_EXECUTOR}`,
    authn: `${SESSION}: withApiAuth requires a session and the handler then loads the current user; 401 or an authentication error otherwise.`,
    cat: 'SESSION_ONLY',
    authz: 'None beyond a signed-in user that carries an organization id: withApiAuth applies no role floor, no entitlement and no kernel decision; the handler only refuses a user without an organization.',
    tenant: 'No table is read. The organization on the user object is read into an unused variable; the response is the same static registry for every organization.',
    owner: 'No stored rows: the response is the in-code DATA_SOURCES registry (claims, organization_members, claim_deadlines, dues_assignments with their fields) shaped for the builder.',
    sens: 'Table names, column names, field types and the joinable tables of the report model, including member email, member id, claim and dues amount columns; no row of any table',
    priv: 'The structure of the report model is disclosed to any signed-in user of an organization, with an icon name and a generated description per source; no member, claim or dues row is returned.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the handler writes no row and no audit record.',
    reqAudit: 'Reads of the registry need no audit record; the executions it enables must be audited by the execute route.',
    does: 'Checks that a user with an organization exists, maps the four registry sources and their fields to the builder shape and returns them with a count; the response is the same for every caller and reads no table.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [10, 13],
    future: 'Serve only the sources and columns that the execute route and the executor both accept and the caller role may select, derive them from one registry, and add a role floor that matches execution.',
    dec: [D_SOURCE_READERS],
    ev: [
      ...guardEv(a, 'withApiAuth'),
      a.local('authorization', 'getHandler', 'if (!user || !user.organizationId) {'),
      a.local('tenantScope', 'getHandler', 'const _organizationId = user.organizationId;'),
      a.local('mutation', 'getHandler', 'const dataSources = getAllDataSources();'),
      a.svc('behavior', REPORT_EXECUTOR, 'return DATA_SOURCES;', 'getAllDataSources'),
      a.local('privacy', 'getHandler', 'fields: ds.fields.map(field => ({'),
      a.local('privacy', 'getHandler', 'column: field.column,'),
      a.svc('privacy', REPORT_EXECUTOR, "{ id: 'email', name: 'Email', column: 'email'"),
      a.svc('defect', REPORT_EXECUTOR, "{ id: 'first_name', name: 'First Name', column: 'first_name'"),
      a.svc('defect', REPORT_EXECUTOR, "{ id: 'outcome', name: 'Outcome', column: 'outcome'"),
      a.svc('defect', REPORT_EXECUTOR, "{ id: 'current_deadline', name: 'Deadline Date', column: 'current_deadline'"),
      a.sch('defect', MEMBERS_SCHEMA, /email: text\('email'\)\.notNull\(\)/, { symbol: 'organizationMembers', absentColumns: ['first_name', 'last_name', 'firstName', 'lastName'] }),
      a.sch('defect', CLAIMS_SCHEMA, /resolutionOutcome: varchar\("resolution_outcome"/, { symbol: 'claims', absentColumns: ['outcome'] }),
      a.sch('defect', DEADLINES_SCHEMA, /dueDate: timestamp\('due_date'\)\.notNull\(\)/, { symbol: 'deadlines', absentColumns: ['current_deadline'] }),
    ],
    inf: [
      { claim: 'defect', statement: 'The registry module is the single source of the response and of the executor; the route allowlist of the execute route is a second, separate list, so the builder offers claim_deadlines and dues_assignments that the execute route refuses with 400, and the execute route accepts members, deadlines and grievances that the registry does not define.' },
    ],
    def: [DEF_REGISTRY_MISMATCH, DEF_REGISTRY_SESSION_ONLY],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* risk screens                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const CRUD_SENSITIVE_SCREEN = {
  reason: 'The route serves rows of the reports table, which stores the report definition (name, flags, config JSON) and no result: it reads no claims, member, dues or finance table, so no source column is copied into the response.',
  evidence: [{ ref: `${APP}db/schema/domains/analytics/reports.ts`, quote: "config: jsonb('config').notNull(), // Report configuration (data sources, fields, filters, etc.)" }],
}

const SHARE_SCREEN = {
  reason: 'The share path publishes nothing: it is the generic factory over the reports table, whose is_public column is only stored, and no route under /api/reports reads it or sends a report to any audience.',
  evidence: [{ ref: `${APP}db/schema/domains/analytics/reports.ts`, quote: "isPublic: boolean('is_public').notNull().default(false)," }],
}

const DATASOURCES_SCREEN = {
  reason: 'The handler returns the static registry of table, column and field names and reads no table, so no member, claim or dues value is copied into the response.',
  evidence: [{ ref: DATASOURCES_ROUTE, quote: 'const dataSources = getAllDataSources();' }],
}

export const RISK_SCREENS = {
  'reports/datasources/route.ts|GET': { SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: DATASOURCES_SCREEN },
}
for (const route of ROUTES) {
  if (route === 'reports/execute/route.ts' || route === 'reports/datasources/route.ts') continue
  const methods = route.includes('[id]') ? ['GET', 'PATCH', 'DELETE'] : route === 'reports/route.ts' ? ['GET', 'POST'] : ['GET', 'POST']
  for (const method of methods) {
    const key = `${route}|${method}`
    const entry = { SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: CRUD_SENSITIVE_SCREEN }
    if (route === 'reports/[id]/share/route.ts') entry.PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT = SHARE_SCREEN
    RISK_SCREENS[key] = entry
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* dispatch                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

function build(a, readText) {
  if (a.route === 'reports/execute/route.ts') return executeFacts(a)
  if (a.route === 'reports/datasources/route.ts') return datasourcesFacts(a)
  return crudRecord(a, readText, crudProfile(a))
}

export function facts(a, readText) {
  const record = applyCrossTenantExposure(build(a, readText), DEFECTS)
  return record
}
