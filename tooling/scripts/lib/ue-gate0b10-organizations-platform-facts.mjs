/**
 * Gate 0B.10 facts: the organization collection, directory, tree, selection and platform-identifier routes, and the platform
 * statistics and revenue-metric routes. Nine route files, ten operations: the organization list and create, the organization
 * search, the organization tree, the organization switch, the platform organization id, the platform statistics read and the
 * three platform metric routes (churn, mrr, unit-economics). Every evidence item is produced by `opAuthoring` from the exact
 * handler, the helper or service it calls, or the resolved schema, and is proved again by the validator. This tranche records
 * the source; it repairs nothing and approves no route.
 */
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const ORG_CAP = 'UE-OMIT-ORGANIZATION-ADMINISTRATION'
const BILLING_CAP = 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING'
const ENUMERATION_CAP = 'UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION'
const GATE = 14

const D_ORG_RECORD = 'UE-INST-ORGANIZATION-RECORD-AUTHORITY'
const D_ORG_ROSTER = 'UE-INST-ORGANIZATION-ROSTER-AND-ROLE-GRANT-AUTHORITY'
const D_FEDERATION = 'UE-INST-FEDERATION-AFFILIATE-DATA-SHARING'
const D_ONBOARDING_DISCLOSURE = 'UE-INST-ONBOARDING-CROSS-ORGANIZATION-DISCLOSURE'
const D_ONBOARDING_EVENT = 'UE-INST-ONBOARDING-EVENT-AUTHORITY'
const D_PLATFORM = 'UE-INST-PLATFORM-STAFF-MANDATE'
const D_CONTRACT = 'UE-INST-PLATFORM-CONTRACT-AUTHORITY'
const D_CONTEXT = 'UE-INST-ORGANIZATION-CONTEXT-SELECTION-AUTHORITY'
const D_REVENUE = 'UE-INST-PLATFORM-REVENUE-METRICS-AUTHORITY'

const ORG_SCHEMA = `${APP}db/schema-organizations.ts`
const RLS_0108 = `${APP}db/migrations/0108_rls_tenant_isolation_foundation.sql`
const RLS_CONTEXT = `${APP}lib/db/with-rls-context.ts`
const AUTH_GUARD = `${APP}lib/api-auth-guard.ts`
const BOOTSTRAP = `${APP}lib/auth/canonical-bootstrap.ts`
const SELECTION = `${APP}lib/auth/canonical-organization-selection.ts`
const ORG_UTILS = `${APP}lib/organization-utils.ts`
const PLATFORM_STATS = `${APP}lib/queries/platform-stats.ts`
const GRIEVANCE_SCHEMA = `${APP}db/schema/grievance-schema.ts`
const ECONOMICS_SCHEMA = `${APP}services/financial-service/src/db/schema-platform-economics.ts`

const LIST_ROUTE = `${API}organizations/route.ts`
const SEARCH_ROUTE = `${API}organizations/search/route.ts`
const TREE_ROUTE = `${API}organizations/tree/route.ts`
const SWITCH_ROUTE = `${API}organizations/switch/route.ts`
const PLATFORM_ID_ROUTE = `${API}organizations/platform-id/route.ts`
const STATS_ROUTE = `${API}platform/stats/route.ts`
const MRR_ROUTE = `${API}platform/metrics/mrr/route.ts`
const CHURN_ROUTE = `${API}platform/metrics/churn/route.ts`
const UNIT_ROUTE = `${API}platform/metrics/unit-economics/route.ts`

export const ROUTES = new Set([
  'organizations/platform-id/route.ts',
  'organizations/route.ts',
  'organizations/search/route.ts',
  'organizations/switch/route.ts',
  'organizations/tree/route.ts',
  'platform/metrics/churn/route.ts',
  'platform/metrics/mrr/route.ts',
  'platform/metrics/unit-economics/route.ts',
  'platform/stats/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  OPL_ORGANIZATION_COLLECTION: {
    capabilityId: ORG_CAP,
    domain: 'ORGANIZATION_COLLECTION_LIST_AND_CREATE',
    actor: 'Any signed-in user reading the organizations the session can see, and a system administrator creating an organization with its place in the parent and child hierarchy',
    routes: ['organizations/route.ts'],
    evidence: [
      ev(ORG_SCHEMA, "parentId: uuid('parent_id').references((): AnyPgColumn => organizations.id, { onDelete: 'restrict' }),"),
      ev(ORG_SCHEMA, "billingContactId: uuid('billing_contact_id'),"),
      ev(LIST_ROUTE, '/** POST /api/organizations — create a new organization (system-admin only) */'),
    ],
  },
  OPL_ORGANIZATION_DIRECTORY_SEARCH: {
    capabilityId: ORG_CAP,
    domain: 'ORGANIZATION_DIRECTORY_SEARCH',
    actor: 'Signed-in user looking an organization up by name or slug',
    routes: ['organizations/search/route.ts'],
    evidence: [
      ev(ORG_SCHEMA, "slug: text('slug').notNull().unique(),"),
      ev(SEARCH_ROUTE, '/** GET /api/organizations/search?q=...  Search organizations by name/slug */'),
    ],
  },
  OPL_ORGANIZATION_CONTEXT_SELECTION: {
    capabilityId: ORG_CAP,
    domain: 'ORGANIZATION_TREE_SELECTION_AND_PLATFORM_IDENTIFIER',
    actor: 'Signed-in user who belongs to several organizations choosing the organization the session works in, the client that draws the organization tree, and the client that asks which organization is the platform organization',
    routes: ['organizations/tree/route.ts', 'organizations/switch/route.ts', 'organizations/platform-id/route.ts'],
    evidence: [
      ev(ORG_SCHEMA, "hierarchyPath: text('hierarchy_path').array().notNull(),"),
      ev(ORG_SCHEMA, "uniqueMembership: uniqueIndex('unique_org_membership').on("),
      ev(SWITCH_ROUTE, ' * V2 rotates a password session or validates a provider selection hint using private memberships.'),
    ],
  },
  OPL_PLATFORM_REVENUE_METRICS: {
    capabilityId: BILLING_CAP,
    domain: 'PLATFORM_REVENUE_CHURN_AND_UNIT_ECONOMICS_METRICS',
    actor: 'Platform operator reading monthly recurring revenue, subscription churn and unit economics of the platform subscriptions',
    routes: ['platform/metrics/churn/route.ts', 'platform/metrics/mrr/route.ts', 'platform/metrics/unit-economics/route.ts'],
    evidence: [
      ev(ECONOMICS_SCHEMA, "export const mrrSnapshots = pgTable('mrr_snapshots', {"),
      ev(ECONOMICS_SCHEMA, "churnMrr: numeric('churn_mrr', { precision: 12, scale: 2 }).default('0'), // From cancellations"),
      ev(MRR_ROUTE, " * Metrics endpoint"),
    ],
  },
  OPL_PLATFORM_STATISTICS: {
    capabilityId: ENUMERATION_CAP,
    domain: 'PLATFORM_WIDE_STATISTICS',
    actor: 'Platform operator reading organization, member, grievance, agreement and settlement statistics across every organization for the operations dashboard',
    routes: ['platform/stats/route.ts'],
    evidence: [
      ev(PLATFORM_STATS, ' * Shared database queries for platform-wide statistics.'),
      ev(`${APP}components/dashboards/nzila-ops-dashboard.tsx`, "fetch('/api/platform/stats')"),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_CONTEXT,
    status: 'OUTSTANDING',
    question: 'Which memberships (active, suspended, removed), which organization states (active, inactive, suspended, archived) and which platform authority permit a user to select an organization as the working context of a session, and is each selection an audited event?',
    sourceState: 'The legacy switch validates a membership row without reading its status or removal flag and lets an identifier on an environment list select any organization; the canonical switch limits the choice to active private memberships of active organizations and issues a new session bound to the choice; neither writes an audit record. No source names who may select an organization or whether a selection is recorded.',
    softwareOwners: [ORG_CAP],
  },
  {
    id: D_REVENUE,
    status: 'OUTSTANDING',
    question: 'Which platform office owns the monthly recurring revenue, churn and unit-economics figures of the platform subscriptions, which stored source (the subscription event log or the monthly snapshot table) is authoritative for each figure, and who may read them?',
    sourceState: 'The mrr, churn and unit-economics routes return the same fixed object of three zeros and read no table; the subscription event, monthly recurring revenue snapshot and customer acquisition tables exist in the financial service schema and no route under app/api reads them. No source names the owner, the authoritative source or the readers.',
    softwareOwners: [BILLING_CAP],
  },
]

export const CAPABILITIES = []

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE, severity, title, ...extra })

const UNAUTH = "if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });"
const RUNTIME_ROLE = 'await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)'
const POLICY_COMMENT = "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row"

export const DEFECTS = [
  D('DEF-0B10-OPL-01', ORG_CAP, 'HIGH',
    'GET /api/organizations checks only that a session user id exists, applies no role floor and no organization predicate of its own (the only filters are the optional parent and status query parameters), and selects every organizations row visible to the connection inside withRLSContext: in the legacy mode that transaction only sets app.current_org_id and never switches to the union_eyes_runtime role, so whether the list is confined to the caller organization depends on the database role of the connection, and where it is not, any signed-in user receives every organization with its contact email, phone, website, address, charter number, subscription tier, billing contact id, settings JSON, enabled features, member counts, creator id and legacy id, and with include_stats the active grievance count of each listed organization.',
    {
      riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any signed-in user calls /api/organizations (optionally with parent, status and include_stats): the handler authenticates the session user, opens withRLSContext and returns every organizations row the connection role lets the 0108 policy show, mapped with billing contact id, settings, enabled features, contact fields and member counts, and the per-organization active grievance counts when include_stats is true.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE', 'SAME_TENANT_OVER_DISCLOSURE'],
          description: 'A member of one organization can read the commercial, billing-contact and configuration data of other organizations, and the number of open grievances each has, when the connection role is not confined by the organizations row-level-security policy; an ordinary member of the own organization receives the billing contact and settings JSON in every case.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [{ ref: LIST_ROUTE, quote: UNAUTH }],
        existingContainment: {
          summary: 'In the canonical mode (UE_CANONICAL_BOOTSTRAP_V2 set to 1) withRLSContext switches the transaction to the union_eyes_runtime role so the 0108 policy (a tenant sees only its own organization row) confines the list to the caller organization; the legacy transaction has no such switch.',
          evidence: [
            { ref: RLS_CONTEXT, quote: RUNTIME_ROLE },
            { ref: RLS_0108, quote: POLICY_COMMENT },
          ],
        },
        blockingCondition: 'The deployment runs with UE_CANONICAL_BOOTSTRAP_V2 unset or 0 and the DATABASE_URL role used by the shared db client is not confined by the 0108 organizations policy, so the list returns organizations other than the caller own.',
        justification: 'The canonical mode confines the read to the caller organization row, so the cross-tenant exposure exists only in the legacy mode and only if the connection role is not bound by the policy; both are runtime facts the route does not state. Where both hold, any signed-in user receives the commercial and configuration data of every organization, so the route blocks release under that condition, and the own-organization over-disclosure is recorded separately by the earlier current-organization defect.',
      },
    }),
  D('DEF-0B10-OPL-02', ORG_CAP, 'MEDIUM',
    'GET /api/organizations returns whatever the tenant context lets the policy show while three administration pages (the new organization page, the edit organization page and the members console) treat the answer as the list of organizations of the union for choosing a parent or an organization: under a connection confined by the 0108 policy the list is the caller own row only, so the parent picker is empty of any other organization and the parent query parameter finds no children, and under an unconfined connection it is every organization (the exposure of DEF-0B10-OPL-01); the route also applies no limit, passes the parent query string to a uuid column unvalidated so that a malformed value raises an unhandled database error and a 500, and lets withRLSContext throw an unhandled error (500) for a user with no selected organization.'),
  D('DEF-0B10-OPL-03', ORG_CAP, 'MEDIUM',
    'POST /api/organizations is limited to a system administrator and commits the organization row and its organization.create audit row in one system transaction, but it reads the body with no schema and no guard on the JSON parse (a malformed body raises an unhandled error and a 500) and writes whatever the body states: name and slug are not checked (a missing name or a duplicate slug surfaces as an unhandled database error), the cached member_count and active_member_count counters, status, settings JSON, enabled features and CLC affiliation are taken from the body, and the parent may be any organization (the parent is only checked to exist, not for its status or its type, and the administrators of the parent have no say in a new child attached to it), so one request can create an organization with invented member counts under any parent of the hierarchy.'),
  D('DEF-0B10-OPL-04', ORG_CAP, 'LOW',
    'POST /api/organizations inserts only name, slug, display_name, type, parent, sectors, email, phone, website, status, CLC affiliation, member counters, settings and features: the description that the new organization page sends is dropped and the sector and jurisdiction that the page sends are stored only inside the settings JSON (the sectors and province_territory columns stay empty), the organization hierarchy admin component sends the type local_union, which the handler refuses with 400, and then tests data.success, a field the handler never returns, so a created organization is not shown and a refused one is not reported; the handler answers 201 with the stored row while the data the caller entered is partly absent from it.'),
  D('DEF-0B10-OPL-05', ORG_CAP, 'HIGH',
    'GET /api/organizations/search checks only that a session user id exists and then runs the search inside withSystemContext (the union_eyes_system role that the 0108 policy for the organizations table exempts) with no membership, role or mandate check: any signed-in user can match organizations of every tenant by name or slug (a search with no q returns up to 50 organizations other than the platform type) and receives the id, name, slug, type, parent id, member count, status and sectors of each, so the directory discloses the size, lifecycle status and place in the parent and child hierarchy of organizations the caller has no relationship with.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any signed-in user calls /api/organizations/search?q=<text> (or with no q): the handler checks only the session user id, reads the organizations table with the system role and returns the id, name, slug, type, parent id, member count, status and sectors of up to 50 organizations of any tenant.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE'],
          description: 'A member of one organization can enumerate other organizations, learn their member counts, lifecycle status and parent affiliation, and walk the hierarchy by parent id, which the 0108 row-level-security policy states a tenant must not see and which the directory-visibility decision has not authorized.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [{ ref: SEARCH_ROUTE, quote: "if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })" }],
        existingContainment: 'NONE',
        justification: 'The only check is a session user id; the read deliberately runs with the system role that bypasses the tenant policy and returns size, status and parent fields beyond a name directory, so a signed-in user of any organization reaches directory data of every other organization and the route blocks release until the visible fields and the readers are decided.',
      },
    }),
  D('DEF-0B10-OPL-06', ORG_CAP, 'MEDIUM',
    'GET /api/organizations/search excludes the platform organization type only when no q is given: with a q the filter is an ILIKE on name or slug that returns organizations of every type and every lifecycle status (platform, archived, suspended and inactive organizations included), the q is placed unescaped inside the pattern (a percent sign or underscore matches every row) with no minimum length, the result is limited to 50 with no ordering, no paging and no signal that it was cut, and the statement selects every column of the organizations row (billing contact, settings, contacts) although the mapper returns eight of them.'),
  D('DEF-0B10-OPL-07', ORG_CAP, 'HIGH',
    'When the canonical bootstrap flag is not 1, GET /api/organizations/tree checks only that a session user exists and then reads every organization, with no limit and no filter on type or status (platform, archived, suspended and inactive organizations included), through the shared db client with no withRLSContext, no withSystemContext, no membership check and no comparison with the caller organization, and returns the id, name, slug, type, parent id, sector, jurisdiction, description, hierarchy level, member count, status and timestamps of each: the whole parent and child hierarchy of the union is treated as visible to every signed-in user, and whether the result is confined to the caller depends entirely on the row-level-security role of the connection (a confined connection with no organization context returns an empty tree for everyone); only the canonical branch limits the tree to the active private memberships of the caller.',
    {
      riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any signed-in user loads the organization context in the legacy mode: the client calls /api/organizations/tree, the handler authenticates the session user and returns every organization the shared db client can read, with parent id, hierarchy level, member count, sector, jurisdiction and description, with no membership check.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE'],
          description: 'A member of one organization can read the identity, size, jurisdiction, description and parent affiliation of every organization of the union whenever the connection role is not confined by the organizations row-level-security policy, and a tree of the whole hierarchy is treated as visible because the organizations are related by parent and child, which is not an authorization to read them.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [{ ref: TREE_ROUTE, quote: 'if (!userId) {' }],
        existingContainment: {
          summary: 'In the canonical mode (UE_CANONICAL_BOOTSTRAP_V2 set to 1) the route returns getCanonicalOrganizationTree, which lists only the active organizations of the private memberships of the caller; the legacy branch has no such limit.',
          evidence: [
            { ref: TREE_ROUTE, quote: 'return NextResponse.json(await getCanonicalOrganizationTree())' },
            { ref: BOOTSTRAP, quote: "return flag === '1'" },
          ],
        },
        blockingCondition: 'The deployment runs with UE_CANONICAL_BOOTSTRAP_V2 unset or 0 and the DATABASE_URL role used by the shared db client is not confined by the 0108 organizations policy, so the legacy branch returns organizations other than the caller own.',
        justification: 'The canonical branch is membership scoped, so the exposure exists only in the legacy mode and only if the connection role is not bound by the policy; both are runtime facts the route does not state. Where both hold the route discloses every tenant organization to any signed-in user, so it blocks release under that condition.',
      },
    }),
  D('DEF-0B10-OPL-08', ORG_CAP, 'LOW',
    'The legacy branches of GET /api/organizations/tree and POST /api/organizations/switch fill missing values with invented ones: in both a null created_at or updated_at is replaced by the time of the request and a null type becomes union, and the tree also turns a null status into active, a null hierarchy level into 0 and a null member count into 0, so the caller reads a creation date, a type, a lifecycle status and a size that the organization record does not hold.'),
  D('DEF-0B10-OPL-09', ORG_CAP, 'MEDIUM',
    'In the legacy mode POST /api/organizations/switch accepts any organization_members row of the user and the organization as the membership (it reads neither the status nor the removal flag of the row, and does not check that the organization is active), so a suspended, inactive or removed member and a member of an archived organization receive success true together with the organization name, slug, type, parent id, sector, jurisdiction and description, although the organization resolver that later reads the selection cookie requires an active, non-removed membership; an identifier on the PLATFORM_ADMIN_USER_IDS environment list switches to any organization without any membership; and the route stores nothing server side (the client then writes the selection into cookies it controls), so success true reports a validation and not a switch.'),
  D('DEF-0B10-OPL-10', ORG_CAP, 'MEDIUM',
    'POST /api/organizations/switch changes the organization a session works in (the canonical mode revokes the active session and issues a new session row bound to the chosen organization, or writes a provider preference cookie) and neither the route, the canonical selection handler nor rebindSessionOrganization writes an audit record of who selected which organization from which, so the selection of an organization, including a platform administrator selecting an organization they hold no membership of in the legacy mode, leaves no audit trail and the mutation of the session store is not atomic with any audit record.'),
  D('DEF-0B10-OPL-11', ORG_CAP, 'LOW',
    'GET /api/organizations/platform-id returns the constant DEFAULT_ORGANIZATION_ID of the source file as platformOrgId without reading the organizations table: the constant is documented in organization-utils as the Default Organization where all users start (the organization that the non-production fallback assigns to a user with no membership), not as the organization of type platform, so a client that distinguishes viewing the platform from viewing a tenant (the sidebar compares the organization id with this same constant) treats the default tenant organization as the platform, and every signed-in user receives the internal identifier of that organization.'),
  D('DEF-0B10-OPL-12', BILLING_CAP, 'HIGH',
    'GET /api/platform/metrics/mrr, GET /api/platform/metrics/churn and GET /api/platform/metrics/unit-economics are three copies of one handler that ignores the request, reads no table and returns the fixed object activeUsers 0, requestsToday 0, errorRate 0 under the OpenAPI summary System metrics: a caller that asks for monthly recurring revenue, churn or unit economics receives zeros for three system-usage keys that are none of those figures (no mrr, churn or unit-economics key exists), presented with HTTP 200 as aggregated system metrics, although the subscription event, MRR snapshot and customer acquisition tables exist in the financial service schema and no route under app/api reads them.',
    {
      riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'An administrator of any organization calls /api/platform/metrics/mrr, /churn or /unit-economics and receives 200 with activeUsers 0, requestsToday 0 and errorRate 0; no figure is read from any table, so the response reads as zero users, zero requests and a zero error rate for the platform whatever the subscriptions are.',
        potentialImpact: {
          classes: ['FINANCIAL_INTEGRITY', 'FALSE_ATTESTATION_OR_OUTCOME'],
          description: 'A dashboard, report or investor or board summary that reads these paths as revenue, churn or unit-economics figures would record zero recurring revenue, zero churn and no cost per customer as measured facts of the platform, and an operator would read an absent measurement as a healthy or an empty business.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [{ ref: MRR_ROUTE, quote: "auth: { required: true, minRole: 'admin' }," }],
        existingContainment: 'NONE',
        blockingCondition: 'Any client, report, dashboard or integration reads one of the three paths as a revenue, churn or unit-economics figure (the application source has no caller today), or the paths are advertised as the platform revenue metrics.',
        justification: 'The route returns a fixed object of zeros with a success status under a path that names a financial measure, with no containment that marks the figure as unmeasured; it harms only when a consumer reads it as a measurement, which the source does not show today, so it blocks release once the paths are consumed or advertised.',
      },
    }),
  D('DEF-0B10-OPL-13', BILLING_CAP, 'MEDIUM',
    'The three platform metric routes under /api/platform/metrics are gated at the admin role floor (the organization administrator level of ROLE_HIERARCHY, 140) while the other platform-wide reads (the platform statistics and the platform operator routes) use the platform_lead floor (270): a route of the platform namespace that is wired to the platform revenue tables (mrr_snapshots has no organization column and subscription_events holds the events of every organization) would hand platform-wide revenue and churn aggregates to the administrator of every organization, and the route is a role-title check with no platform-staff mandate.',
    { riskCategories: ['ANALYTICS_CROSSES_BOUNDARY'] }),
  D('DEF-0B10-OPL-14', ENUMERATION_CAP, 'HIGH',
    'GET /api/platform/stats admits any caller whose role title is platform_lead or above (a role-title floor, not an issued platform-staff mandate) and returns, for every organization other than the platform type, an organization list with name, type, status, member and active member counts, sectors, CLC affiliation, subscription tier and per-capita rate, together with registered and active user counts, role distribution, grievance, collective agreement and settlement counts, the total monetary value of all settlements and the sector breakdown: the statements run on the shared db client with no organization predicate, no withSystemContext and no withRLSContext (so whether they see every tenant depends on the connection role) and the read is not audited.',
    {
      riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT', 'ANALYTICS_CROSSES_BOUNDARY'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'A caller holding the platform_lead role title or above (the operations dashboard calls the route) receives platform-wide figures: per-organization subscription tier, per-capita rate, member counts and lifecycle status, grievance and settlement totals over all organizations, and the distribution of roles of all members; no platform-staff mandate is checked and no audit record is written for the read.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE', 'SAME_TENANT_OVER_DISCLOSURE'],
          description: 'Commercial and operational data of every organization is read by whoever holds the platform_lead role title, with no recorded mandate, scope, expiry or read audit, and the settlement and grievance totals aggregate the records of all tenants; if a role of that title is held outside the platform staff or the connection is unconfined, one account reads the commercial position of every union.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [{ ref: STATS_ROUTE, quote: "auth: { required: true, minRole: 'platform_lead' }," }],
        existingContainment: {
          summary: 'The route requires the platform_lead role floor (level 270, above the organization administrator level), which limits the actor set to platform operations roles, but the title is not a mandate and the read is neither scoped nor audited.',
          evidence: [
            { ref: STATS_ROUTE, quote: "auth: { required: true, minRole: 'platform_lead' }," },
            { ref: AUTH_GUARD, quote: 'platform_lead: 270,' },
          ],
        },
        blockingCondition: 'A platform_lead (or higher) role is held by any person the institution has not issued a platform-staff mandate to, which the open decision on the platform-staff mandate leaves undetermined for every operator account, or the route is exposed to a customer-facing client.',
        justification: 'The role floor limits the actors to platform operations roles, so the read is not open to tenant members, but the institution has not decided who may read across organizations and the read has no mandate, scope or audit; the disclosure of every organization commercial and operational data to a role title blocks release as soon as any operator account holds that title without a mandate.',
      },
    }),
  D('DEF-0B10-OPL-15', ENUMERATION_CAP, 'MEDIUM',
    'The figures of GET /api/platform/stats are named for something other than what is computed: registeredUsers is the count of organization_members rows (one person with several memberships counts several times and removed members are not excluded) and activeUsers is the count of rows whose status is active, totalMonetaryValue is the sum of the integer monetary_amount of every settlement in every status (proposed and rejected settlements included, in no stated currency), and resolved grievances are only those with status settled; the dashboard shows these under labels of users, settlement value and resolved cases, so a count of rows and a sum of unaccepted amounts read as measured facts.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
]

const PLATFORM_ROLE_TITLE = 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'
const CURRENT_ROW = 'DEF-0B9-ORG-CURRENT-ROW-READ-AT-ANY-MEMBER-FLOOR-RETURNS-SETTINGS-AND-BILLING-CONTACT'

const future = {
  list: 'Decide with the institution which fields of an organization a user of another organization may see and which office may list organizations, derive the visible set from the caller membership or a platform mandate on the server, return a member-safe projection, bound and validate the query, and state the tenant context explicitly.',
  create: 'Create organizations only through the office the institution names, validate the body against a schema, derive the counters and hierarchy on the server, require the authority of the parent for a new child, make the create idempotent and keep the audit row in the same transaction.',
  directory: 'Decide the directory fields and the readers, return only those fields to a caller with a relationship to the organization, escape and bound the search, exclude platform and archived organizations from the directory and order and page the result.',
  selection: 'Scope the tree to the memberships of the caller in every mode, validate membership status and organization status on the switch, record each selection in the audit trail, and return only values the organization record holds.',
  platformId: 'Read the organization of type platform from the organizations table, or remove the route and have the client derive the platform context from the session.',
  metrics: 'Either read the revenue, churn and unit-economics figures from the stored subscription events and snapshots under a platform mandate, or answer 501 and remove the paths until they exist; never return a fixed object as a measurement.',
  stats: 'Authorize the platform-wide read by a platform-staff mandate with scope and expiry, run it in an explicit system context, audit the read, compute each figure from the source its label names and show settlements by status and currency.',
}

function listFacts(a) {
  return mk({
    persona: 'Any signed-in user, including an administrator on the administration pages, listing organizations',
    service: `${LIST_ROUTE} (GET: auth, withRLSContext read of organizations and raw grievance and child counts)`,
    authn: `${SESSION} (auth() in the handler; 401 when no user id; withRLSContext throws when no organization is selected).`,
    cat: 'SESSION_ONLY',
    authz: 'The handler requires a session user id and nothing more: no role floor, no membership check and no mandate. authorizeAction is not called.',
    tenant: 'The route applies no organization predicate of its own: the filters are the optional parent and status query parameters, and the rows returned are whatever the transaction of withRLSContext (the session organization context) lets the 0108 policy show; the legacy transaction sets app.current_org_id without switching role, so confinement to the caller depends on the database role of the connection.',
    owner: 'organizations rows visible to the connection; the grievance counts derive from grievances rows of the listed organizations.',
    sens: 'Organization name, contact email, phone, website and address, charter number, subscription tier, billing contact id, settings JSON, enabled features, member counts, creator id, legacy id and, with include_stats, active grievance and child counts',
    priv: 'The caller receives the whole mapped record of every organization the context shows, with billing contact id and settings; an ordinary member receives the billing contact and settings of the own organization in every case.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of another organization record need a mandate and a read audit once the offices that may read it are named.',
    does: 'Returns 401 without a user id, builds optional parent and status filters from the query, reads the organizations rows inside withRLSContext, when include_stats is true counts active grievances and child organizations of the listed ids with raw statements, maps each row to snake case with billing contact, settings and features, and returns {data}.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.list,
    dec: [D_ORG_RECORD, D_FEDERATION],
    ev: [
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', UNAUTH),
      a.h('tenantScope', 'const mapped = await withRLSContext(async () => {'),
      a.h('tenantScope', 'const rows = await db.select().from(organizations).where(where);'),
      a.svc('tenantScope', RLS_CONTEXT, RUNTIME_ROLE, 'withRLSContext'),
      a.svc('tenantScope', RLS_CONTEXT, "await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`)", 'withRLSContext'),
      a.sch('tenantScope', RLS_0108, POLICY_COMMENT),
      a.h('behavior', "const includeStats = searchParams.get('include_stats') === 'true';"),
      a.h('mutation', 'return NextResponse.json({ data: mapped });'),
      a.h('privacy', 'billing_contact_id: row.billingContactId,'),
      a.h('privacy', 'settings: row.settings ?? {},'),
      a.tbl('privacy', 'organizations', /billingContactId: uuid\('billing_contact_id'\)/),
      a.h('defect', "if (parentId) conditions.push(eq(organizations.parentId, parentId));"),
      a.h('defect', 'FROM grievances'),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler never passes a limit and never validates the parent query string before comparing it with the uuid column parent_id, and it does not catch the error that withRLSContext throws when the session has no organization.' },
    ],
    def: ['DEF-0B10-OPL-01', 'DEF-0B10-OPL-02', CURRENT_ROW],
    corr: [],
  })
}

function createFacts(a) {
  return mk({
    persona: 'System administrator of the platform creating an organization, with its type and parent, on the new organization page or the hierarchy administration component',
    service: `${LIST_ROUTE} (POST: auth, requireSystemAdmin, withSystemContext parent lookup and insert, persistAtomicAudit)`,
    authn: `${SESSION} (auth() in the handler; 401 when no user id).`,
    cat: 'PLATFORM_ADMIN_IDENTITY',
    authz: 'requireSystemAdmin (the system administrator flag of the user, read from the canonical context or the users table) runs before any database access and answers 403 on any failure, including a failure to read the flag; the check is an identity flag, not a mandate naming the organization created or the parent it is attached to. authorizeAction is not called.',
    tenant: 'No organization of the caller is involved: the new organization id is generated by the insert, the parent id comes from the body and is read inside the same withSystemContext transaction (the system role, which the 0108 policy exempts), and the audit row is written for the new organization id.',
    owner: 'The new organizations row and its place in the hierarchy (hierarchy path and level derived from the parent row); the audit row is owned by the new organization.',
    sens: 'Organization name, slug, type, parent affiliation, contact fields, status, cached member counters, settings JSON and enabled features',
    priv: 'The response returns the stored organization row (201) with every column, including billing contact id and settings; the audit row records the type and the parent id.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The insert and the organization.create audit row (persistAtomicAudit with the transaction handle of withSystemContext, so a failed audit rolls the insert back) commit in one system transaction; the audit lists the type and the parent id and not the other values written.',
    reqAudit: 'Keep the in-transaction audit row and add the authorizing mandate, the values written and the approval of the authority of the parent.',
    does: 'Returns 401 without a user id and 403 unless the user is a system administrator, parses the body, requires one of seven organization types, reads the parent hierarchy path and level when a parent id is given (400 when absent or beyond the depth limit), inserts the organization with the body name, slug, contacts, status, counters, settings and features and the derived path, writes the audit row in the same transaction and returns 201 with the row.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.create,
    dec: [D_ORG_RECORD, D_PLATFORM, D_ONBOARDING_EVENT, D_ORG_ROSTER],
    ev: [
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', 'await requireSystemAdmin();'),
      a.imp('authorization', 'requireSystemAdmin', 'const isAdmin = await isSystemAdmin();'),
      a.svc('authorization', AUTH_GUARD, 'return (await getCanonicalOrganizationContext({ expectedActorUserId: userIdOverride })).isSystemAdmin;', 'isSystemAdmin'),
      a.h('tenantScope', 'created = await withSystemContext(async (tx) => {'),
      a.h('tenantScope', '.where(eq(organizations.id, parentId));'),
      a.svc('tenantScope', RLS_CONTEXT, 'return await systemDb.transaction(async (tx) => {', 'withSystemContext'),
      a.h('mutation', '.insert(organizations)'),
      a.h('mutation', 'return NextResponse.json({ data: created }, { status: 201 });'),
      a.h('audit', 'await persistAtomicAudit(tx as RLSTx, {'),
      a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.h('privacy', 'settings: body.settings ?? {},'),
      a.tbl('privacy', 'organizations', /settings: jsonb\('settings'\)/),
      a.h('defect', 'const body = await req.json();'),
      a.h('defect', 'memberCount: body.member_count ?? 0,'),
      a.h('defect', 'status: body.status ?? ' + "'active',"),
      a.h('defect', "const requestedType = body.type ?? body.organization_type ?? body.organizationType;"),
      a.h('defect', "action: 'organization.create',"),
      a.tbl('defect', 'organizations', /slug: text\('slug'\)\.notNull\(\)\.unique\(\)/),
    ],
    inf: [
      { claim: 'defect', statement: 'The insert values list contains no description, province_territory, charter_number or affiliation_date, so those fields of the organization record are not written by this route whatever the body states.' },
    ],
    def: ['DEF-0B10-OPL-03', 'DEF-0B10-OPL-04'],
    corr: [],
  })
}

function searchFacts(a) {
  return mk({
    persona: 'Any signed-in user looking up an organization by name or slug',
    service: `${SEARCH_ROUTE} (auth, withSystemContext read of organizations with an ILIKE match, limit 50)`,
    authn: `${SESSION} (auth() in the handler; 401 when no user id).`,
    cat: 'SESSION_ONLY',
    authz: 'The handler requires a session user id and nothing more: no membership, no role floor and no mandate. authorizeAction is not called.',
    tenant: 'The scope is every organization, not the session organization: the rows are read inside withSystemContext, the union_eyes_system role that the 0108 policy exempts, so no tenant predicate or policy applies and the caller is never related to the organizations found.',
    owner: 'organizations rows of every tenant (the whole row is selected; eight fields are returned).',
    sens: 'Organization id, name, slug, type, parent id, member count, lifecycle status and sectors of up to 50 organizations of any tenant',
    priv: 'Any signed-in user learns which organizations exist, their size, their status and their parent affiliation, whatever their own organization; the platform organization type and archived organizations are returned when a q is given.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of another organization directory entry need a decided directory field list and a read audit once the readers are named.',
    does: 'Returns 401 without a user id, takes q or query from the query string, selects up to 50 organizations with the system role whose name or slug matches the raw pattern (or, with no q, every organization other than the platform type) and returns the mapped id, name, slug, type, parent id, member count, status and sectors.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.directory,
    dec: [D_ORG_RECORD, D_ONBOARDING_DISCLOSURE, D_FEDERATION],
    ev: [
      a.h('authentication', 'const { userId } = await auth()'),
      a.h('authorization', "if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })"),
      a.h('tenantScope', 'const rows = await withSystemContext(() =>'),
      a.svc('tenantScope', RLS_CONTEXT, 'return await systemDb.transaction(async (tx) => {', 'withSystemContext'),
      a.sch('tenantScope', RLS_0108, POLICY_COMMENT),
      a.h('behavior', 'or(ilike(organizations.name, `%${q}%`), ilike(organizations.slug, `%${q}%`))'),
      a.h('mutation', 'return NextResponse.json({ data: mapped })'),
      a.h('privacy', 'member_count: row.memberCount,'),
      a.h('privacy', 'parent_id: row.parentId,'),
      a.tbl('privacy', 'organizations', /memberCount: integer\('member_count'\)/),
      a.h('defect', ": ne(organizations.organizationType, 'platform'),"),
      a.h('defect', '.limit(50),'),
      a.h('defect', '.select()'),
    ],
    inf: [],
    def: ['DEF-0B10-OPL-05', 'DEF-0B10-OPL-06'],
    corr: [],
  })
}

function treeFacts(a) {
  return mk({
    persona: 'Any signed-in user whose client draws the organization tree of the union',
    service: `${TREE_ROUTE} (canonical branch: getCanonicalOrganizationTree over the memberships of the caller; legacy branch: bare db read of every organization)`,
    authn: `${SESSION} (the legacy branch calls auth() and answers 401 without a user id; the canonical branch resolves the canonical membership context and answers 401 or 403 on a denial).`,
    cat: 'SESSION_ONLY',
    authz: 'In the legacy branch the handler requires a session user id and nothing more: no membership, no role floor and no mandate; in the canonical branch the tree is limited to the active organizations of the private memberships of the caller. A parent and child relationship between organizations authorizes nothing in either branch. authorizeAction is not called.',
    tenant: 'In the legacy branch the scope is every organization, read through the shared db client with no withRLSContext and no withSystemContext, so whether the rows are confined to the caller depends on the row-level-security role of the connection; in the canonical branch the rows are those of the memberships of the caller (read in a system context by the id list of those memberships).',
    owner: 'organizations rows of every tenant (legacy) or of the memberships of the caller (canonical).',
    sens: 'Organization id, name, slug, type, parent id, sector, jurisdiction, description, hierarchy level, member count, status and timestamps',
    priv: 'In the legacy branch any signed-in user receives the structure, size, jurisdiction and description of every organization; in the canonical branch only organizations the caller belongs to.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of another organization place in the hierarchy need a mandate and a read audit once the offices that may read it are named.',
    does: 'When the canonical bootstrap flag is 1 returns the canonical tree of the memberships of the caller (403 or 401 on a denial); otherwise returns 401 without a user id and reads every organization ordered by level and name through the shared db client and returns the mapped records with parent id, level, member count and status.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.selection,
    dec: [D_FEDERATION, D_ORG_RECORD, D_ONBOARDING_DISCLOSURE],
    ev: [
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', 'if (!userId) {'),
      a.h('authorization', 'return NextResponse.json(await getCanonicalOrganizationTree())'),
      a.imp('authorization', 'currentStateContextEnabled', "return flag === '1'"),
      a.svc('tenantScope', SELECTION, 'inArray(', 'choicesInIdentityScope'),
      a.svc('tenantScope', SELECTION, 'eq(organizations.status, ' + "'active'),", 'choicesInIdentityScope'),
      a.h('tenantScope', '.from(organizations)'),
      a.h('mutation', 'return NextResponse.json({'),
      a.h('privacy', 'memberCount: o.memberCount ?? 0,'),
      a.h('privacy', 'parentId: o.parentId ?? null,'),
      a.tbl('privacy', 'organizations', /hierarchyPath: text\('hierarchy_path'\)\.array\(\)\.notNull\(\)/),
      a.h('defect', "createdAt: o.createdAt?.toISOString() ?? new Date().toISOString(),"),
      a.h('defect', "status: o.status ?? 'active',"),
      a.h('defect', '.orderBy(asc(organizations.hierarchyLevel), asc(organizations.name));'),
      a.sch('defect', RLS_0108, POLICY_COMMENT),
    ],
    inf: [
      { claim: 'defect', statement: 'The legacy statement has no where clause and no limit, and the route file imports no withRLSContext or withSystemContext, so the rows it sees are those the connection role permits.' },
    ],
    def: ['DEF-0B10-OPL-07', 'DEF-0B10-OPL-08'],
    corr: [],
  })
}

function switchFacts(a) {
  return mk({
    persona: 'Signed-in user who belongs to several organizations choosing the organization the session works in; a platform administrator in the legacy mode',
    service: `${SWITCH_ROUTE} (canonical branch: handleCanonicalOrganizationSwitch with rebindSessionOrganization; legacy branch: organizations and organization_members reads on the shared db client)`,
    authn: `${SESSION} (the legacy branch calls auth() and answers 401 without a user id; the canonical branch requires a verified provider session or a password session cookie).`,
    cat: 'SESSION_ONLY',
    authz: 'In the legacy branch the handler requires a session user id and then either a user id on the PLATFORM_ADMIN_USER_IDS list (any organization) or an organization_members row of the user and the organization (status and removal ignored); in the canonical branch the choice must be one of the active private memberships of the caller. A membership of a parent or child organization authorizes nothing. authorizeAction is not called.',
    tenant: 'The organization is the body organizationId and is related to the caller by membership (the legacy lookup compares user id and organization id on the shared db client; the canonical lookup is limited to the active memberships of the caller in the identity scope); the response returns the metadata of the chosen organization only.',
    owner: 'organizations row and organization_members row of the chosen organization; the canonical branch writes the session row owned by platform-auth.',
    sens: 'Organization id, name, slug, type, parent id, sector, jurisdiction and description of the chosen organization; the identity of the session that is rebound',
    priv: 'The caller receives the metadata of an organization they belong to (or, as a platform administrator in the legacy mode, of any organization); the canonical branch sets the session cookie to a new token bound to the choice.',
    mut: 'NONE',
    auditDetail: 'The canonical branch revokes the active session and inserts a new organization-bound session row (rebindSessionOrganization) or writes a preference cookie, and the legacy branch stores nothing; neither branch writes an audit record of the selection.',
    reqAudit: 'Record each organization selection (the actor, the organization left, the organization chosen and the authority used) in the audit trail committed with the session rebinding.',
    does: 'When the canonical bootstrap flag is 1 delegates to the canonical switch (verified uuid, membership choice, session rebinding or preference cookie); otherwise returns 401 without a user id, 400 without an organizationId, looks the organization up (404), lets a platform administrator pass or requires a membership row (403), and returns success true with the organization metadata without storing anything.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.selection,
    dec: [D_CONTEXT, D_PLATFORM],
    ev: [
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', 'const isAdmin = await isPlatformAdminUser(userId);'),
      a.h('authorization', 'if (!isAdmin) {'),
      a.imp('authorization', 'isPlatformAdminUser', "return (process.env.PLATFORM_ADMIN_USER_IDS ?? '')"),
      a.h('authorization', 'return handleCanonicalOrganizationSwitch(req)'),
      a.h('tenantScope', 'eq(organizationMembers.organizationId, organizationId),'),
      a.svc('tenantScope', SELECTION, 'const rebound = await rebindSessionOrganization({', 'handleCanonicalOrganizationSwitch'),
      a.svc('audit', SELECTION, 'const rebound = await rebindSessionOrganization({', 'handleCanonicalOrganizationSwitch'),
      a.h('mutation', 'success: true,'),
      a.h('privacy', 'description: org.description ?? null,'),
      a.tbl('privacy', 'organizations', /description: text\('description'\)/),
      a.tbl('defect', 'organizationMembers', /status: text\('status'\)\.notNull\(\)\.default\('active'\)/),
      a.h('defect', "createdAt: org.createdAt?.toISOString() ?? new Date().toISOString(),"),
      a.svc('defect', ORG_UTILS, 'eq(organizationMembers.status, ' + "'active'),", 'getOrganizationIdForUser'),
    ],
    inf: [
      { claim: 'defect', statement: 'Neither the route, handleCanonicalOrganizationSwitch nor rebindSessionOrganization contains an audit write: the session rebinding updates and inserts rows of the session table only.' },
    ],
    def: ['DEF-0B10-OPL-09', 'DEF-0B10-OPL-10', 'DEF-0B10-OPL-08'],
    corr: [],
  })
}

function platformIdFacts(a) {
  return mk({
    persona: 'Any signed-in user whose client asks which organization is the platform organization',
    service: `${PLATFORM_ID_ROUTE} (auth, constant DEFAULT_ORGANIZATION_ID)`,
    authn: `${SESSION} (auth() in the handler; 401 when no user id).`,
    cat: 'SESSION_ONLY',
    authz: 'The handler requires a session user id and nothing more: no role floor and no membership. authorizeAction is not called.',
    tenant: 'No organization of the caller is read: the response is a constant of the source file and no table is queried.',
    owner: 'A constant of lib/organization-utils.ts; no organizations row is read.',
    sens: 'The internal identifier of the default organization',
    priv: 'Every signed-in user receives the identifier of the default organization under the name platformOrgId.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads need no audit record; the route returns a constant.',
    does: 'Returns 401 without a user id and otherwise returns {platformOrgId} with the constant DEFAULT_ORGANIZATION_ID, without reading the organizations table.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1],
    future: future.platformId,
    dec: [D_ORG_RECORD],
    ev: [
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', "if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });"),
      a.h('tenantScope', 'return NextResponse.json({ platformOrgId: DEFAULT_ORGANIZATION_ID });'),
      a.h('mutation', 'return NextResponse.json({ platformOrgId: DEFAULT_ORGANIZATION_ID });'),
      a.svc('defect', ORG_UTILS, '* This points to the Default Organization where all users start'),
      a.svc('defect', ORG_UTILS, 'export const DEFAULT_ORGANIZATION_ID = "458a56cb-251a-4c91-a0b5-81bb8ac39087"; // Default Organization'),
    ],
    inf: [{ claim: 'defect', statement: 'The route file imports no database module and queries no table, so platformOrgId is the constant and not the id of an organization whose type is platform.' }],
    def: ['DEF-0B10-OPL-11'],
    corr: [],
  })
}

function metricsFacts(a, kind) {
  const route = { mrr: MRR_ROUTE, churn: CHURN_ROUTE, 'unit-economics': UNIT_ROUTE }[kind]
  const label = { mrr: 'monthly recurring revenue', churn: 'subscription churn', 'unit-economics': 'unit economics' }[kind]
  return mk({
    persona: `Platform operator (and, as the route is written, any administrator of an organization) asking for ${label}`,
    service: `${route} (withApi admin floor, handler returns a fixed object)`,
    authn: `${SESSION} (withApi requires a session; 401 otherwise).`,
    authz: `withApi requires the admin role floor (the organization administrator level, 140) and nothing more: a role title that any organization can confer, no platform-operator floor, no platform mandate and no entitlement. authorizeAction is not called.`,
    tenant: 'No organization is read: the handler ignores the request, queries no table and returns a constant object, so no tenant predicate is involved.',
    owner: 'None: no stored row is read; the platform subscription events, monthly recurring revenue snapshots and customer acquisition rows that would hold the figures exist in the financial service schema and are not read.',
    sens: 'None today (three constant zeros); the figures the path names (platform revenue, churn and unit economics) would be commercial data of the platform and its organizations',
    priv: 'The caller receives activeUsers 0, requestsToday 0 and errorRate 0; no personal or organization data is returned.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of platform revenue figures need a platform mandate and a read audit once the figures are read from stored records.',
    does: `Returns 200 with the constant object {activeUsers: 0, requestsToday: 0, errorRate: 0} for a request to the ${kind} path, whatever the subscriptions are; the response contains no ${label} figure.`,
    status: 'NOT_IMPLEMENTED_RETURNS_200',
    gate: GATE,
    deps: [9, 13],
    future: future.metrics,
    dec: [D_REVENUE, D_PLATFORM, D_CONTRACT],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'admin' },"),
      a.h('behavior', 'return { activeUsers: 0, requestsToday: 0, errorRate: 0 };'),
      a.h('mutation', 'return { activeUsers: 0, requestsToday: 0, errorRate: 0 };'),
      a.h('defect', "summary: 'System metrics',"),
    ],
    inf: [{ claim: 'defect', statement: 'The route file imports only withApi: it reads no table, no service and no request value, so every figure of the response is a literal.' }],
    def: ['DEF-0B10-OPL-12', 'DEF-0B10-OPL-13', PLATFORM_ROLE_TITLE],
    corr: [],
  })
}

function statsFacts(a) {
  return mk({
    persona: 'Platform operator (platform_lead role title or above) using the operations dashboard, customer success and platform administration pages',
    service: `${STATS_ROUTE} (withApi platform_lead floor, getPlatformStatsFromDb on the shared db client)`,
    authn: `${SESSION} (withApi requires a session; 401 otherwise).`,
    cat: 'PLATFORM_ROLE_FLOOR',
    authz: "withApi requires the platform_lead role floor (level 270): a role-title check, not a platform-staff mandate with scope and expiry. authorizeAction is not called.",
    tenant: 'The statistics are platform-wide by design: the statements select organizations, organization_members, grievances, collective_agreements and settlements with no organization predicate through the shared db client, with no withSystemContext and no withRLSContext, so whether they see every tenant depends on the database role of the connection.',
    owner: 'organizations, organization_members, grievances, collective_agreements and settlements rows of every organization.',
    sens: 'Per-organization name, type, status, member counts, sectors, CLC affiliation, subscription tier and per-capita rate; user, role, grievance, agreement and settlement totals including the total monetary value of settlements',
    priv: 'The caller receives commercial and operational aggregates of every organization and the list of organizations with their subscription tier and per-capita rate; no individual member or grievant is named.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record, and the cross-organization read is not audited.',
    reqAudit: 'A platform-wide read needs a platform-staff mandate and a read audit record naming the operator and the scope.',
    does: 'Returns the platform statistics computed by getPlatformStatsFromDb: organization counts and sums, member and active member rows, grievance totals by status and priority, agreement counts by status, settlement count and monetary sum, a sector breakdown, the organization list and the role distribution, as the response body.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [9, 14],
    future: future.stats,
    dec: [D_PLATFORM, D_CONTRACT],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'platform_lead' },"),
      a.h('tenantScope', 'const stats = await getPlatformStatsFromDb();'),
      a.imp('tenantScope', 'getPlatformStatsFromDb', '.where(ne(organizations.organizationType, ' + "'platform'));"),
      a.imp('tenantScope', 'getPlatformStatsFromDb', 'FROM grievances'),
      a.h('mutation', 'return stats as any as Record<string, unknown>;'),
      a.imp('privacy', 'getPlatformStatsFromDb', 'subscriptionTier: organizations.subscriptionTier,'),
      a.imp('privacy', 'getPlatformStatsFromDb', 'perCapitaRate: organizations.perCapitaRate,'),
      a.imp('defect', 'getPlatformStatsFromDb', 'coalesce(sum(monetary_amount), 0) as total_monetary_value'),
      a.imp('defect', 'getPlatformStatsFromDb', 'FROM organization_members'),
      a.sch('defect', GRIEVANCE_SCHEMA, 'status: varchar("status", { length: 50 }).notNull().default("proposed"), // proposed, agreed, implemented, rejected'),
    ],
    inf: [{ claim: 'defect', statement: 'The route file and getPlatformStatsFromDb import no withSystemContext or withRLSContext and carry no audit call; every statement runs on the shared db client.' }],
    def: ['DEF-0B10-OPL-14', 'DEF-0B10-OPL-15', PLATFORM_ROLE_TITLE],
    corr: [],
    cross: 'Reads organization-spanning commercial and operational data at a platform_lead role title with no mandate and no read audit. No adopted decision authorizes the read; it is recorded as an implementation defect, not as authorized access.',
  })
}

export const RISK_SCREENS = {}

export function facts(a, readText) {
  void readText
  const record = applyCrossTenantExposure(build(a), DEFECTS)
  record.riskScreen = RISK_SCREENS[`${a.route}|${a.method}`] ?? {}
  return record
}

function build(a) {
  const { route, method } = a
  switch (route) {
    case 'organizations/route.ts': return method === 'GET' ? listFacts(a) : createFacts(a)
    case 'organizations/search/route.ts': return searchFacts(a)
    case 'organizations/tree/route.ts': return treeFacts(a)
    case 'organizations/switch/route.ts': return switchFacts(a)
    case 'organizations/platform-id/route.ts': return platformIdFacts(a)
    case 'platform/metrics/mrr/route.ts': return metricsFacts(a, 'mrr')
    case 'platform/metrics/churn/route.ts': return metricsFacts(a, 'churn')
    case 'platform/metrics/unit-economics/route.ts': return metricsFacts(a, 'unit-economics')
    case 'platform/stats/route.ts': return statsFacts(a)
    default: throw new Error(`no organizations-platform facts for ${route}`)
  }
}
