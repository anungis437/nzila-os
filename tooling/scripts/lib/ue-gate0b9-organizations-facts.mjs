/**
 * Gate 0B.9 facts: the organization record, hierarchy and organization-membership surface. Fourteen route files, 21
 * operations: the current-organization context routes, the organization item route (read, update, archive), the member
 * roster of an organization (read, add), the member directory and its search, the five hierarchy reads (ancestors,
 * children, descendants, path, hierarchy list), the organization analytics read, and the access-logs and sharing-settings
 * routes, which are the generic CRUD factory over the organizations table and read neither the sharing settings table
 * nor the cross-organization access log table. Every evidence item is produced by `opAuthoring` from the exact handler,
 * the helper or service it calls, or the resolved schema, and is proved again by the validator. This tranche records the
 * source; it repairs nothing.
 */
import { applyCrossTenantExposure } from './ue-gate0b9-exposure.mjs'
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, LOW_ROLE, CRUD_FACTORY, CRUD_GOVERNANCE, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudModel } from './ue-gate0b5-crud.mjs'

const ORG_CAP = 'UE-OMIT-ORGANIZATION-ADMINISTRATION'
const HIER_CAP = 'UE-OMIT-FEDERATION-LOCAL-HIERARCHY'
const ANALYTICS_CAP = 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION'
const SHARING_CAP = 'UE-OMIT-CLAUSE-LIBRARY-SHARING'
const GATE = 14

const D_ORG_RECORD = 'UE-INST-ORGANIZATION-RECORD-AUTHORITY'
const D_ORG_ROSTER = 'UE-INST-ORGANIZATION-ROSTER-AND-ROLE-GRANT-AUTHORITY'
const D_ORG_SHARING = 'UE-INST-ORGANIZATION-SHARING-SETTINGS-AUTHORITY'
const D_FEDERATION = 'UE-INST-FEDERATION-AFFILIATE-DATA-SHARING'
const D_PLATFORM = 'UE-INST-PLATFORM-STAFF-MANDATE'
const D_AUDIT_READERS = 'UE-INST-AUDIT-HISTORY-READERS'

const ORG_SCHEMA = `${APP}db/schema-organizations.ts`
const SHARING_SCHEMA = `${APP}db/schema/sharing-permissions-schema.ts`
const RLS_0108 = `${APP}db/migrations/0108_rls_tenant_isolation_foundation.sql`
const RLS_CONTEXT = `${APP}lib/db/with-rls-context.ts`
const AUTH_GUARD = `${APP}lib/api-auth-guard.ts`
const DIRECTORY = `${APP}lib/members/directory-access.ts`
const OWN_ORG_ITEM = `${APP}lib/api/require-own-organization-item.ts`
const SELECTION = `${APP}lib/auth/canonical-organization-selection.ts`
const BOOTSTRAP = `${APP}lib/auth/canonical-bootstrap.ts`
const AUDIT_ATOMIC = `${APP}lib/audit/atomic-audit.ts`

export const ROUTES = new Set([
  'org/current/route.ts',
  'organization/members/route.ts',
  'organization/members/search/route.ts',
  'organizations/[id]/access-logs/route.ts',
  'organizations/[id]/analytics/route.ts',
  'organizations/[id]/ancestors/route.ts',
  'organizations/[id]/children/route.ts',
  'organizations/[id]/descendants/route.ts',
  'organizations/[id]/members/route.ts',
  'organizations/[id]/path/route.ts',
  'organizations/[id]/route.ts',
  'organizations/[id]/sharing-settings/route.ts',
  'organizations/current/route.ts',
  'organizations/hierarchy/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  ORG_CURRENT_CONTEXT: {
    capabilityId: ORG_CAP,
    domain: 'CURRENT_ORGANIZATION_CONTEXT',
    actor: 'Signed-in member or officer whose client asks which organization the session is working in and for the record of that organization',
    routes: ['org/current/route.ts', 'organizations/current/route.ts'],
    evidence: [
      ev(ORG_SCHEMA, "billingContactId: uuid('billing_contact_id'),"),
      ev(ORG_SCHEMA, "organizationType: organizationTypeEnum('organization_type').notNull(),"),
      ev(`${API}org/current/route.ts`, ' * Canonical org endpoint — all new code should hit this route.'),
    ],
  },
  ORG_RECORD_ADMINISTRATION: {
    capabilityId: ORG_CAP,
    domain: 'ORGANIZATION_RECORD_ADMINISTRATION',
    actor: 'Organization administrator keeping the profile of the organization, and any signed-in user reading an organization record by its id; a platform administrator changing parent affiliation and lifecycle status',
    routes: ['organizations/[id]/route.ts'],
    evidence: [
      ev(ORG_SCHEMA, "parentId: uuid('parent_id').references((): AnyPgColumn => organizations.id, { onDelete: 'restrict' }),"),
      ev(ORG_SCHEMA, "settings: jsonb('settings').$type<Record<string, unknown>>().default({}),"),
      ev(RLS_0108, "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row"),
    ],
  },
  ORG_MEMBERSHIP_ROSTER: {
    capabilityId: ORG_CAP,
    domain: 'ORGANIZATION_MEMBERSHIP_ROSTER',
    actor: 'Member of an organization reading its roster, and steward adding a person to the roster of the organization with an organization role',
    routes: ['organizations/[id]/members/route.ts'],
    evidence: [
      ev(ORG_SCHEMA, "role: text('role').notNull(),"),
      ev(ORG_SCHEMA, "uniqueMembership: uniqueIndex('unique_org_membership').on("),
      ev(ORG_SCHEMA, "deletedAt: timestamp('deleted_at', { withTimezone: true }),"),
    ],
  },
  ORG_MEMBER_DIRECTORY: {
    capabilityId: ORG_CAP,
    domain: 'ORGANIZATION_MEMBER_DIRECTORY',
    actor: 'Steward reading the members of the cases assigned to them, and officer reading the member directory of the organization, through the member-directory policy',
    routes: ['organization/members/route.ts', 'organization/members/search/route.ts'],
    evidence: [
      ev(DIRECTORY, ' * Directory authority is derived from the case policy, not from a union-wide role name:'),
      ev(ORG_SCHEMA, "membershipNumber: text('membership_number'),"),
    ],
  },
  ORG_HIERARCHY_READS: {
    capabilityId: HIER_CAP,
    domain: 'ORGANIZATION_PARENT_CHILD_HIERARCHY_READS',
    actor: 'Administrator or officer who expects to see the ancestors, children, descendants, path and tree of an organization of the union hierarchy',
    routes: [
      'organizations/[id]/ancestors/route.ts',
      'organizations/[id]/children/route.ts',
      'organizations/[id]/descendants/route.ts',
      'organizations/[id]/path/route.ts',
      'organizations/hierarchy/route.ts',
    ],
    evidence: [
      ev(ORG_SCHEMA, "hierarchyPath: text('hierarchy_path').array().notNull(),"),
      ev(ORG_SCHEMA, "hierarchyLevel: integer('hierarchy_level').notNull().default(0),"),
      ev(`${API}organizations/[id]/descendants/route.ts`, '/** GET /api/organizations/:id/descendants — orgs whose hierarchy_path contains this id */'),
    ],
  },
  ORG_ANALYTICS: {
    capabilityId: ANALYTICS_CAP,
    domain: 'ORGANIZATION_MEMBERSHIP_AND_CLAIM_ANALYTICS',
    actor: 'Administrator or officer reading member and grievance counts, resolution time and growth of an organization',
    routes: ['organizations/[id]/analytics/route.ts'],
    evidence: [
      ev(ORG_SCHEMA, "activeMemberCount: integer('active_member_count').default(0),"),
      ev(`${API}organizations/[id]/analytics/route.ts`, '    // Average resolution days (for resolved grievances)'),
    ],
  },
  ORG_SHARING_SETTINGS: {
    capabilityId: SHARING_CAP,
    domain: 'ORGANIZATION_SHARING_SETTINGS',
    actor: 'Organization administrator deciding what the organization shares with its federation, sector, province and the congress',
    routes: ['organizations/[id]/sharing-settings/route.ts'],
    evidence: [
      ev(SHARING_SCHEMA, 'allowFederationSharing: boolean("allow_federation_sharing").default(false),'),
      ev(SHARING_SCHEMA, 'sharingApprovalRequired: boolean("sharing_approval_required").default(true),'),
      ev(`${APP}components/sharing/SharingSettingsForm.tsx`, 'method: "PUT",'),
    ],
  },
  ORG_ACCESS_LOGS: {
    capabilityId: SHARING_CAP,
    domain: 'CROSS_ORGANIZATION_ACCESS_LOG',
    actor: 'Organization administrator reviewing which other organizations viewed, downloaded, compared or cited the resources of the organization',
    routes: ['organizations/[id]/access-logs/route.ts'],
    evidence: [
      ev(SHARING_SCHEMA, 'export const crossOrgAccessLog = pgTable("cross_org_access_log", {'),
      ev(SHARING_SCHEMA, 'resourceOrganizationId: uuid("resource_organization_id").notNull(),'),
      ev(`${APP}components/sharing/AccessLogViewer.tsx`, 'setLogs(data.logs);'),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_ORG_RECORD,
    status: 'OUTSTANDING',
    question: 'Which office of an organization may change its profile, contact details, settings, parent affiliation and lifecycle status (including archiving the organization), who verifies a change of parent, and which fields of an organization record (contacts, billing contact, settings, member counts, hierarchy position) may a signed-in user of another organization read?',
    sourceState: 'The item route lets an organization administrator update the profile and settings of the organization and archive it, and refuses a change of parent or status unless the caller is a system administrator; the delete path archives with no such check, and the read path returns the whole record of any organization to any signed-in user. No source names the office that owns each field, who verifies a parent change, or what another organization may see; the 0108 policy comment states only that a tenant sees its own organization row.',
    softwareOwners: [ORG_CAP, HIER_CAP],
  },
  {
    id: D_ORG_ROSTER,
    status: 'OUTSTANDING',
    question: 'Which office of an organization may add a person to the organization and assign an organization role, may that office grant a role above its own, does the person have to accept before the membership is active, and which offices may read the full roster with contact details and membership numbers?',
    sourceState: 'The roster route lets any member read every roster row with email, phone and membership number and lets a steward insert an active membership with any of five roles for any user id; the member directory route reads the same table through a case-policy based directory authority. No source states which office decides membership or grants an organization role, or how a person consents to being added.',
    softwareOwners: [ORG_CAP],
  },
  {
    id: D_ORG_SHARING,
    status: 'OUTSTANDING',
    question: 'Which office of an organization decides what it shares with its federation, sector, province and the congress (clauses, precedents, anonymization, approval and approver role), may a federation change those settings for an affiliate, and which offices may read the log of other organizations that accessed the resources of the organization?',
    sourceState: 'The sharing settings and cross-organization access log tables exist with defaults (sharing off, anonymization required, approval required, approver role admin), but no route reads or writes either table: the sharing-settings and access-logs routes are the generic factory over the organizations table, so no source shows who decides or who reads.',
    softwareOwners: [SHARING_CAP],
  },
]

export const CAPABILITIES = [
  {
    id: ORG_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'organization-record-roster-and-directory',
    primaryGate: GATE,
    dependencyGates: [1, 13],
    actor: 'Organization administrator keeping the organization record and the membership roster; steward adding a member; member and officer reading the roster and the member directory; any signed-in user asking for the current organization',
    businessOutcome: 'The organization record, its roster and its member directory are read and changed only by the offices the institution names, a read of another organization is authorized by a mandate and limited to what the reader needs, a membership grant names the person who accepted it and is limited to roles the granting office may confer, parent affiliation and lifecycle status change only through one verified path, and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/organizations, app/api/organization/members, app/api/org/current',
    service: `${APP}app/api/organizations/[id]/route.ts`,
    sourceFiles: [
      `${APP}app/api/organizations/[id]/route.ts`,
      `${APP}app/api/organizations/[id]/members/route.ts`,
      `${APP}app/api/organizations/current/route.ts`,
      `${APP}app/api/organization/members/route.ts`,
      `${APP}app/api/org/current/route.ts`,
      `${APP}lib/members/directory-access.ts`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/organizations/[id]/route.ts` }],
    auditEvidence: 'The organization update and archive and the roster insert commit persistAtomicAudit with the row through the transaction handle; the audit records list the changed field names or the member user id and role. Reads of the organization record, the roster and the member directory are not audited.',
    privacyClassification: 'Organization contact details, billing contact reference, settings and member counts; member names, emails, phones, membership numbers, departments, roles and (for officers) employment dates, seniority and profile metadata.',
    gap: 'No existing capability owns the organization record or the roster. UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION concerns platform operators reading organizations, users and statistics through the admin routes under a platform role; UE-CAP-A-003 and UE-CAP-A-005 concern the authentication-side membership projection and its readers, not the organization profile, the member roster insert or the member directory; UE-OMIT-FEDERATION-LOCAL-HIERARCHY owns the parent and child link, which this record references but does not own; and UE-OMIT-AUDIT-LOG-VISIBILITY, UE-OMIT-ROUTE-EXPOSURE-HARDENING and UE-CAP-K-007 do not name the organization profile, the roster grant or the member directory. The source has an organization item route that mixes a tenant-scoped update with a system-context cross-organization read, a roster route that grants roles to any user id, and a directory policy that only two of the routes use.',
  },
]

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE, severity, title, ...extra })

const ITEM_ROUTE = `${API}organizations/[id]/route.ts`
const MEMBERS_ROUTE = `${API}organizations/[id]/members/route.ts`
const HIERARCHY_ROUTE = `${API}organizations/hierarchy/route.ts`
const CHILDREN_ROUTE = `${API}organizations/[id]/children/route.ts`
const DESCENDANTS_ROUTE = `${API}organizations/[id]/descendants/route.ts`
const ANCESTORS_ROUTE = `${API}organizations/[id]/ancestors/route.ts`
const ANALYTICS_ROUTE = `${API}organizations/[id]/analytics/route.ts`
const PATH_ROUTE = `${API}organizations/[id]/path/route.ts`

const UNAUTH = "if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })"

const crossTenantDisposition = (route, what) => ({
  disposition: 'RELEASE_BLOCKING',
  actualExposure: `Any signed-in user can call the route with the id of an organization that is not theirs: the only guard is the presence of a session user id, the lookup runs under withSystemContext (the union_eyes_system role that the 0108 row-level-security policy exempts), and the response returns ${what} of that organization.`,
  potentialImpact: {
    classes: ['CROSS_TENANT_DISCLOSURE'],
    description: `A member or officer of one organization learns the identity, size and structure of organizations they have no relationship with; the 0108 policy states that a tenant sees only its own organization row, and this route discloses ${what} outside that boundary.`,
  },
  activationState: 'REACHABLE_ANY_AUTHENTICATED',
  activationEvidence: [{ ref: route, quote: UNAUTH }],
  existingContainment: 'NONE',
  justification: `The route authenticates a user but never relates the caller to the requested organization, runs the read with the system role that bypasses tenant isolation, and returns ${what}; a reachable cross-tenant read is not made safe by the data being organization-level, so the route blocks release until a mandate and a scope are decided.`,
})

export const DEFECTS = [
  D('DEF-0B9-ORG-ITEM-GET-ANY-SIGNED-IN-USER-READS-ANY-ORGANIZATION-RECORD-AS-SYSTEM', ORG_CAP, 'HIGH',
    'GET /api/organizations/[id] checks only that a session user id exists, validates only the uuid shape of the path id, and reads the organizations row of that id inside withSystemContext (the union_eyes_system role that the 0108 policy for the organizations table exempts), so any signed-in user receives the whole record of any organization: contact email, phone, website and address, charter number, subscription tier, billing contact id, the settings JSON, enabled features, member counts, creator id and legacy organization id, with no membership, role or mandate check.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any signed-in user can request /api/organizations/<uuid> for an organization that is not theirs: the handler checks only that a session user id exists, reads the row under withSystemContext and returns the mapped record including contact fields, billing contact id, settings and enabled features; the administrative dashboard pages call the same path for organizations the administrator picks.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE'],
          description: 'A member of one organization can read the contact details, billing contact reference, settings JSON (per-capita rate and fiscal configuration keys) and subscription tier of every other organization whose id they obtain, which the 0108 row-level-security policy states a tenant must not see.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [{ ref: ITEM_ROUTE, quote: "if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })" }],
        existingContainment: 'NONE',
        justification: 'The only checks are a session user id and the uuid shape of the id; the read deliberately runs with the system role that bypasses the tenant policy and returns every column the mapper exposes, so a signed-in user of any organization reaches the record of any other. A cross-tenant read of contact, billing and settings data is not made acceptable by the id being hard to guess, so the route blocks release.',
      },
    }),
  D('DEF-0B9-ORG-ITEM-GET-STATISTICS-RUN-ON-BARE-DB-AFTER-SYSTEM-READ-WITHOUT-ORGANIZATION-CONTEXT', ORG_CAP, 'MEDIUM',
    'After the organization row is read inside withSystemContext, GET /api/organizations/[id] computes activeClaims, totalClaims and childCount with db.execute outside any withRLSContext or withSystemContext callback, so the grievances and organizations statements run on the pooled connection with no app.current_org_id set: under the 0108 tenant policy they return no rows (so the counts are zero for every organization, including the caller own), and on a connection role that bypasses the policy they return the real counts of whatever organization id the caller named; the route returns either an unisolated or a silently zero figure and cannot be relied on for either.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),
  D('DEF-0B9-ORG-ITEM-PATCH-BODY-UNVALIDATED-SETTINGS-AND-SLUG-REPLACED-WHOLESALE', ORG_CAP, 'MEDIUM',
    'PATCH /api/organizations/[id] reads the request body with an unguarded req.json() and copies name, slug, display_name, email, phone, website, sectors and settings into the update with no schema validation: the settings JSON column (which holds per-capita rate, remittance day and fiscal year keys) is replaced wholesale by whatever object the organization administrator sends, a changed slug is accepted with no uniqueness or format check although the path route resolves organizations by slug, a malformed JSON body or an invalid sectors value surfaces as an unhandled 500, and the unvalidated email and website are stored as sent.'),
  D('DEF-0B9-ORG-ITEM-PATCH-PARENT-CHANGE-DOES-NOT-REPOINT-HIERARCHY-PATH-OR-CHECK-CYCLE', HIER_CAP, 'MEDIUM',
    'When a system administrator changes parent_id through PATCH /api/organizations/[id], the update writes only parentId: hierarchy_path and hierarchy_level of the organization and of every descendant are not recomputed, the new parent is not checked to exist or not to be a descendant of the organization, and no source in the route or its audit record keeps the previous parent, so the ancestors, descendants and path reads (which follow hierarchy_path) disagree with the children read (which follows parent_id) after a parent change.'),
  D('DEF-0B9-ORG-ITEM-DELETE-ORGANIZATION-ADMIN-ARCHIVES-OWN-ORGANIZATION-BYPASSING-STATUS-GOVERNANCE', ORG_CAP, 'HIGH',
    'DELETE /api/organizations/[id] lets the administrator of an organization set the status of that organization to archived with no further check, although the PATCH on the same route refuses any change of status unless the caller is a system administrator because lifecycle status defines the institution standing: the delete takes no reason or confirmation, does not look at child organizations (the parent_id foreign key restricts deletion, not archiving), does not require a second approver, and the archived status removes the organization from the canonical organization choices (only status active organizations are offered) and from the billing scheduler, so one organization administrator can take the whole organization out of service.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'A member of the organization with the admin role (or above) calls DELETE on the id of their own organization: requireUserForOrganization admits the member, the role check requires admin, and the update sets status archived and commits the organization.archive audit row in the same transaction; the PATCH on the same file refuses a status change unless requireSystemAdmin passes.',
        potentialImpact: {
          classes: ['UNAUTHORIZED_MUTATION', 'AVAILABILITY_OR_DATA_LOSS'],
          description: 'The organization is withdrawn from organization selection and billing by one administrator, contradicting the route own rule that lifecycle status changes require platform governance; only a system administrator PATCH can restore the status.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          { ref: ITEM_ROUTE, quote: "return NextResponse.json({ error: 'Forbidden: requires admin role' }, { status: 403 })" },
          { ref: SELECTION, quote: "eq(organizations.status, 'active')," },
        ],
        existingContainment: {
          summary: 'The caller must be a member of the organization with the admin role, the update touches only the path organization row inside the caller tenant transaction, an organization.archive audit row commits with it, and the change is a status value a system administrator can reverse through PATCH.',
          evidence: [
            { ref: ITEM_ROUTE, quote: "action: 'organization.archive'," },
            { ref: ITEM_ROUTE, quote: "const archived = await withRLSContext(async (tx) => {" },
          ],
        },
        blockingCondition: 'The deployment runs the canonical organization selection (UE_CANONICAL_BOOTSTRAP_V2 set to 1), where only organizations with status active are offered, or the institution decides that archiving an organization is a platform governance act, as the PATCH on the same route already enforces.',
        justification: 'The harm is bounded to the organization of an administrator and is recorded in an atomic audit row, so it does not block while archived organizations remain usable; it blocks as soon as archived status removes the organization from selection or the institution reserves lifecycle status to platform governance, because the delete path then performs the act the update path refuses.',
      },
    }),
  D('DEF-0B9-ORG-MEMBERSHIP-GUARD-IGNORES-MEMBER-STATUS-AND-REMOVAL-FLAG', ORG_CAP, 'HIGH',
    'The organization-scoped guard that the item and roster routes call (requireUserForOrganization, through getUserContextForOrganization) finds the caller membership with only the user id and the organization id in the where clause, with no status and no deleted_at condition, so in the legacy (non-canonical) mode a member whose status is suspended or inactive, or whose row is soft-deleted, still passes as a member of the organization with the role the row keeps: they can read the full roster, update or archive the organization when the kept role is admin, and add roster members when it is steward or above; other lookups in organization-utils require status active.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'A person whose membership row is suspended, inactive or soft-deleted but still carries a role calls the roster or item routes of that organization: getUserContextForOrganization selects the membership by user id and organization id alone and returns its role, so the role floors of the routes are evaluated against a row the organization may have withdrawn.',
        potentialImpact: {
          classes: ['UNAUTHORIZED_MUTATION', 'SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
          description: 'A removed or suspended steward or administrator keeps the authority of the kept role over roster reads and writes, organization updates and archiving until the row is deleted for good, and a removed member keeps read access to the roster with contact details.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [{ ref: `${API}organizations/[id]/members/route.ts`, quote: 'userCtx = await requireUserForOrganization(id);' }],
        existingContainment: 'NONE',
        blockingCondition: 'The deployment runs in the legacy mode (UE_CANONICAL_BOOTSTRAP_V2 unset or 0) and an organization holds a membership row with a suspended, inactive or deleted state that keeps a steward, admin or member role; the canonical mode resolves the role from the canonical organization context instead.',
        justification: 'The guard is the sole authority check of the roster and item routes and it accepts a withdrawn membership, so any organization that retains a role on a suspended or soft-deleted row gives that person live authority; the condition is a runtime mode and a data state the route file does not state, so the defect blocks release where both hold.',
      },
    }),
  D('DEF-0B9-ORG-ROSTER-GET-ANY-ORGANIZATION-MEMBER-READS-FULL-ROSTER-WITH-CONTACT-DETAILS', ORG_CAP, 'HIGH',
    'GET /api/organizations/[id]/members requires only that the caller is a member of the path organization (any role, including member, in any status) and returns every roster row with user id, name, email, phone, department, membership number, role, status, primary flag and join dates, with no role floor, no member-directory policy (the organization/members route limits stewards to members of their assigned cases and withholds employment data below officer), no pagination and no read audit; the page and the SMS campaign builder call it.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any member of an organization, whatever their role, calls /api/organizations/<own organization id>/members and receives the email, phone, membership number, role and status of every roster row of the organization; the same table is served to stewards through the narrower directory policy by organization/members, which this route does not apply.',
        potentialImpact: {
          classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
          description: 'Contact details and membership numbers of every colleague, including those of members who have not consented to being listed, reach an ordinary member who has no case or office that needs them, which the sibling directory route is written to prevent.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [{ ref: MEMBERS_ROUTE, quote: "if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });" }],
        existingContainment: 'NONE',
        justification: 'The membership check proves only that the caller belongs to the organization; no role floor or directory policy narrows what a member receives, so the personal contact data of the whole roster is reachable by every authenticated member today and the route blocks release.',
      },
    }),
  D('DEF-0B9-ORG-ROSTER-GET-INCLUDES-REMOVED-MEMBERS-AND-IS-UNBOUNDED', ORG_CAP, 'MEDIUM',
    'GET /api/organizations/[id]/members selects every organization_members row of the organization with no deleted_at condition, no status filter, no limit and no ordering, so soft-deleted members are returned beside active ones with their contact details and the whole roster of a large organization is returned in one response, whereas organization/members excludes deleted rows.'),
  D('DEF-0B9-ORG-ROSTER-POST-STEWARD-GRANTS-ANY-ORGANIZATION-ROLE-TO-ANY-USER-ID-WITHOUT-ACCEPTANCE', ORG_CAP, 'HIGH',
    'POST /api/organizations/[id]/members lets any member whose role is steward or above insert an organization_members row for any user_id string with any of the roles member, steward, admin, executive or observer and an immediately active status: the route does not compare the granted role with the role of the caller, does not check that the user id exists or consented, does not use an invitation or acceptance step, and the inserted row is what getUserContextForOrganization later reads as the role of that person, so a steward can create an administrator or executive membership for an accomplice account; the unique (organization, user) index turns a repeated or previously removed user id into an unhandled 500.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'A steward of an organization posts a JSON body with any user_id and role admin to the roster of their own organization: the route validates the shape with zod, inserts the active membership with that role in the tenant transaction and commits a membership.create audit row, and the role it stores is the one the organization item routes then honour for that user.',
        potentialImpact: {
          classes: ['UNAUTHORIZED_MUTATION', 'PRIVACY_OR_CONSENT'],
          description: 'A steward can confer a higher organization role than they hold on any account, which then administers the organization (profile, settings, archive, roster), and adds people to the roster without their acceptance, exposing their contact data to the organization.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [{ ref: MEMBERS_ROUTE, quote: "return NextResponse.json({ error: 'Forbidden: requires steward role' }, { status: 403 });" }],
        existingContainment: {
          summary: 'The caller must be a member of the organization with at least the steward role, the body is validated by a zod schema that limits the role to five values and the email to a valid address, the insert is scoped to the path organization in its own transaction, and a membership.create audit row commits with it.',
          evidence: [
            { ref: MEMBERS_ROUTE, quote: "role: z.enum(['member', 'steward', 'admin', 'executive', 'observer']).default('member')," },
            { ref: MEMBERS_ROUTE, quote: "action: 'membership.create'," },
          ],
        },
        justification: 'The containment limits who can post but not what they may confer: the role enum includes admin and executive and no comparison with the caller role exists, so a steward can create authority above their own for any user id. This is a privilege-escalation path inside the tenant and blocks release until the granting office and the role ceiling are decided.',
      },
    }),
  D('DEF-0B9-ORG-ROSTER-POST-DUPLICATE-USER-ID-AND-INVALID-JSON-HANDLING-LEAVES-UNHANDLED-ERRORS', ORG_CAP, 'LOW',
    'POST /api/organizations/[id]/members inserts without a conflict clause or an existence check, so a user id that already has a row (including a soft-deleted one) violates unique_org_membership and the exception propagates as an unhandled 500 rather than a 409, and the response of a successful insert returns the whole stored row including the generated ids.'),
  D('DEF-0B9-ORG-DIRECTORY-PROJECTION-FILLS-MISSING-FIELDS-WITH-CANNED-DEPARTMENT-POSITION-AND-ZERO-SENIORITY', ORG_CAP, 'LOW',
    'The member directory projection used by GET /api/organization/members substitutes the department Administration and the position Union Member when the stored values are empty and reports seniority 0 for an officer-level reader when none is recorded, so the response presents canned organizational facts and an unmeasured seniority as recorded data about a member.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D('DEF-0B9-ORG-DIRECTORY-SEARCH-UNESCAPED-WILDCARDS-FIXED-FIFTY-NO-ORDER-OR-PAGE', ORG_CAP, 'LOW',
    'GET /api/organization/members/search places the raw q parameter inside an ILIKE pattern with no escaping of percent and underscore and no length bound, returns at most 50 rows with no ordering and no paging parameter so members past the first 50 matches are unreachable and the page returned is not stable, and returns the email address of each match to the caller.'),
  D('DEF-0B9-ORG-CURRENT-CONTEXT-ROUTE-RETURNS-PLACEHOLDER-ORGANIZATION-WITH-NULL-NAME-AND-NO-FEATURES', ORG_CAP, 'MEDIUM',
    'GET /api/org/current is described as the canonical organization endpoint but reads no table: it returns the session organization id with name null, slug null, subscriptionTier null and an empty features list, and an availableOrgs array that holds only that same placeholder, so a client receives a 200 organization payload that carries none of the organization data and lists no other organization the user belongs to.'),
  D('DEF-0B9-ORG-CURRENT-ROW-READ-AT-ANY-MEMBER-FLOOR-RETURNS-SETTINGS-AND-BILLING-CONTACT', ORG_CAP, 'MEDIUM',
    'GET /api/organizations/current requires only a session user and returns the whole organization row of the session organization to any member, whatever their role: settings JSON (per-capita rate and fiscal configuration), billing_contact_id, subscription tier, enabled features, created_by, legacy_org_id, contact email and phone and the claim counts, none of which an ordinary member is shown to need.'),
  D('DEF-0B9-ORG-HIERARCHY-LIST-ANY-SIGNED-IN-USER-ENUMERATES-EVERY-ORGANIZATION-AS-SYSTEM', HIER_CAP, 'HIGH',
    'GET /api/organizations/hierarchy lets any signed-in user list up to 500 organizations of every tenant (all organization types except platform) because it reads the organizations table inside withSystemContext with no membership, role or mandate check, and returns for each one the name, slug, type, parent id, hierarchy path and level, member count, active member count, child count, status, sectors and CLC affiliation; the rootOrgId query parameter only filters the rows already read, so it narrows nothing for a caller who leaves it out or names another organization, and the member counts are aggregate figures of organizations other than the caller own.',
    {
      riskCategories: ['ANALYTICS_CROSSES_BOUNDARY'],
      releaseDisposition: crossTenantDisposition(HIERARCHY_ROUTE, 'the name, structure, member counts and affiliation of up to 500 organizations'),
    }),
  D('DEF-0B9-ORG-HIERARCHY-LIST-HARD-CODED-RLS-FLAG-AND-SILENT-FIVE-HUNDRED-ROW-CAP', HIER_CAP, 'LOW',
    'GET /api/organizations/hierarchy sets rls_enabled to the constant true on every row whatever the policy state of the connection that read it (the read ran with the system role that the policy exempts), and truncates the list at 500 rows with no flag, total or page, so the child_count of a row is computed only from the truncated set and the response presents a complete and isolated tree it did not build.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D('DEF-0B9-ORG-CHILDREN-ANY-SIGNED-IN-USER-LISTS-CHILDREN-OF-ANY-ORGANIZATION-AS-SYSTEM', HIER_CAP, 'HIGH',
    'GET /api/organizations/[id]/children reads every organization whose parent_id equals the path id inside withSystemContext after checking only that a session user exists, so any signed-in user can list the child organizations of any organization (including a federation or the congress) with name, slug, type, parent id, hierarchy path and level, sectors, member and active member counts, status, CLC affiliation and creation date; the scope is the path id and never the caller organization.',
    {
      riskCategories: ['ANALYTICS_CROSSES_BOUNDARY'],
      releaseDisposition: crossTenantDisposition(CHILDREN_ROUTE, 'the child organizations with their member counts, sectors, CLC affiliation and creation date'),
    }),
  D('DEF-0B9-ORG-DESCENDANTS-ANY-SIGNED-IN-USER-LISTS-WHOLE-SUBTREE-OF-ANY-ORGANIZATION-UNBOUNDED-AS-SYSTEM', HIER_CAP, 'HIGH',
    'GET /api/organizations/[id]/descendants reads every organization whose hierarchy_path contains the path id inside withSystemContext, with no limit, after checking only that a session user exists, so any signed-in user receives the whole subtree of any organization (for a federation or the congress, every affiliate and local) with name, slug, type, parent id, hierarchy path and level, member count and status; the scope is the path id and never the caller organization, and an organization the caller does not belong to is not distinguished from one they do.',
    {
      riskCategories: ['ANALYTICS_CROSSES_BOUNDARY'],
      releaseDisposition: crossTenantDisposition(DESCENDANTS_ROUTE, 'the whole subtree of organizations with their hierarchy paths, member counts and status'),
    }),
  D('DEF-0B9-ORG-ANCESTORS-ANY-SIGNED-IN-USER-READS-ANCESTRY-OF-ANY-ORGANIZATION-AS-SYSTEM', HIER_CAP, 'MEDIUM',
    'GET /api/organizations/[id]/ancestors reads the hierarchy_path of the path organization and then its ancestor rows inside withSystemContext after checking only that a session user exists, so any signed-in user learns which federations and congress an organization they do not belong to is affiliated with (name, slug, type, level, status of each ancestor), and the response is the same empty list whether the organization is unknown, a root, or one the caller may not see.'),
  D('DEF-0B9-ORG-HIERARCHY-ROUTES-PASS-UNVALIDATED-PATH-ID-TO-UUID-COLUMN-AND-ANSWER-EMPTY-200-FOR-UNKNOWN-ORGANIZATION', HIER_CAP, 'LOW',
    'The ancestors, children and analytics routes compare the raw path segment with a uuid column and the descendants route compares it with the hierarchy text array without validating its shape (the item route validates it, these do not): a segment that is not a uuid makes the database raise an unhandled error and a 500, and an unknown organization answers 200 with an empty list (ancestors, children, descendants) instead of 404, so a caller cannot tell an organization that does not exist from one with no relatives.'),
  D('DEF-0B9-ORG-PATH-LEGACY-BRANCH-READS-ORGANIZATIONS-ON-BARE-DB-WITHOUT-CONTEXT-OR-MEMBERSHIP-CHECK', HIER_CAP, 'HIGH',
    'When the canonical bootstrap flag is not 1, GET /api/organizations/[id]/path checks only that a session user exists and then selects the organization named by the path uuid or slug, and every ancestor named by its hierarchy_path, through the shared db client with no withRLSContext, no withSystemContext, no membership check and no comparison with the caller organization: the result depends entirely on the row-level-security role of the connection (an unscoped tenant connection returns no rows, so the route answers empty for everyone; a connection the policy does not bind returns the name, slug, parent id, sector, jurisdiction and description of any organization and its ancestry), and only the canonical branch limits the path to the memberships of the caller and reports omitted ancestors.',
    {
      riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any signed-in user calls /api/organizations/<uuid or slug>/path in the legacy mode: the handler authenticates the session user, queries organizations and the ancestors through the shared db client, and returns the path with name, slug, parent id, sector, jurisdiction and description of each organization found, with no check of the caller membership.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE'],
          description: 'A user of one organization can read the identity, jurisdiction, description and ancestry of another organization by id or slug whenever the connection role is not confined by the organizations row-level-security policy, and receives a silently empty path for their own organization when it is.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [{ ref: PATH_ROUTE, quote: 'if (!userId) {' }],
        existingContainment: {
          summary: 'In the canonical mode (UE_CANONICAL_BOOTSTRAP_V2 set to 1) the route returns getCanonicalOrganizationPath, which is limited to the memberships of the caller and reports the ancestors it omitted; the legacy branch has no such limit.',
          evidence: [
            { ref: PATH_ROUTE, quote: 'return NextResponse.json(await getCanonicalOrganizationPath((await params).id))' },
            { ref: BOOTSTRAP, quote: "return flag === '1'" },
          ],
        },
        blockingCondition: 'The deployment runs with UE_CANONICAL_BOOTSTRAP_V2 unset or 0 and the DATABASE_URL role used by the shared db client is not confined by the 0108 organizations policy, so the legacy branch returns rows of organizations other than the caller own.',
        justification: 'The canonical branch is membership scoped, so the exposure exists only in the legacy mode and only if the connection role is not confined by the policy; both are runtime facts the route does not state. Where both hold the route discloses other tenants organizations to any signed-in user, so it blocks release under that condition.',
      },
    }),
  D('DEF-0B9-ORG-ANALYTICS-ANY-SIGNED-IN-USER-READS-ANY-ORGANIZATION-NAME-TYPE-CHILD-COUNT-AND-AGGREGATES-BY-PATH-ID', ANALYTICS_CAP, 'HIGH',
    'GET /api/organizations/[id]/analytics checks only that a session user exists and takes the organization from the path id with no uuid validation and no membership check: it reads the organization name and type inside withSystemContext and counts its child organizations inside withSystemContext for any id, and then computes member totals, active members, new members this month, member growth rate, grievance totals, active, resolved and this-month counts, average resolution days and the grievances by status with statements filtered by that path id, so a signed-in user of any organization receives the analytics of any other organization on a connection whose row-level security does not confine the counts, and at least its name, type and child count when it does.',
    {
      riskCategories: ['ANALYTICS_CROSSES_BOUNDARY'],
      releaseDisposition: crossTenantDisposition(ANALYTICS_ROUTE, 'the name, type, child organization count and (where the connection does not confine them) the member and grievance aggregates'),
    }),
  D('DEF-0B9-ORG-ANALYTICS-METRIC-QUERIES-RUN-IN-SESSION-ORGANIZATION-CONTEXT-FILTERED-BY-PATH-ID-RETURNING-ZEROS', ANALYTICS_CAP, 'MEDIUM',
    'The metric statements of GET /api/organizations/[id]/analytics run inside withRLSContext with no context map (the organization context of the session) while their organization_id predicate is the path id, and the child count runs under a nested system context: for an organization other than the caller own, a connection confined by the 0108 policy returns zero rows for the member and grievance counts, so the route answers 200 with zeros and a real child count that read as a measured figure of an organization whose data it could not see.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),
  D('DEF-0B9-ORG-ANALYTICS-ZERO-AND-HUNDRED-PERCENT-DEFAULTS-MEMBER-FLOOR-AND-NO-GROUP-SIZE-SUPPRESSION', ANALYTICS_CAP, 'MEDIUM',
    'GET /api/organizations/[id]/analytics coalesces the average resolution days to 0 when no grievance has a resolution date, reports a member growth rate of 100 when the previous month count is zero and members exist, counts members without excluding soft-deleted rows, applies no role floor (any session user reaches it) and applies no minimum group size to the grievance status counts, so unmeasured values are presented as measured figures and a small organization status counts can identify the members involved.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D('DEF-0B9-ORG-ACCESS-LOGS-ROUTE-IS-ORGANIZATIONS-ROW-CRUD-NOT-A-CROSS-ORGANIZATION-ACCESS-LOG', SHARING_CAP, 'MEDIUM',
    'The /api/organizations/[id]/access-logs route is crudRoutes over the organizations table (itemRoute true, orgScoped false) wrapped by requireOwnOrganizationItem: it never reads the cross_org_access_log table, applies none of the page, pageSize, resourceType, accessType, fromDate and toDate parameters the access log viewer sends, and answers with the organizations row of the caller own organization as {data: row} while the viewer reads logs, pagination and stats, so the viewer shows no log and no other organization access to the resources of the organization is ever reported.'),
  D('DEF-0B9-ORG-SHARING-SETTINGS-ROUTE-IS-ORGANIZATIONS-ROW-CRUD-NOT-SHARING-SETTINGS', SHARING_CAP, 'MEDIUM',
    'The /api/organizations/[id]/sharing-settings route is crudRoutes over the organizations table wrapped by requireOwnOrganizationItem: it never reads or writes organization_sharing_settings, answers GET with the organizations row of the own organization instead of the sharing flags, refuses PATCH and DELETE with 403 because the organizations table is READ_ONLY in the CRUD governance table, and exports no PUT although the sharing settings form sends PUT, so the sharing flags (federation, sector, province and congress sharing, anonymization, approval) cannot be read or changed through the HTTP surface and no sharing decision is recorded.'),
  D('DEF-0B9-ORG-ORGANIZATION-ROW-FACADES-RETURN-WHOLE-ORGANIZATION-ROW-AT-STEWARD-OR-ADMIN-FLOOR', SHARING_CAP, 'MEDIUM',
    'The GET of the access-logs route (declared member floor, raised to steward by the low-role guard because the organizations table has email, phone and address columns) and of the sharing-settings route (admin floor) return the complete organizations row of the own organization (settings JSON, billing_contact_id, subscription tier, enabled features, created_by, legacy_org_id, contact fields) under the name of an access log and of sharing settings, so a steward who opens the access-log tab receives billing and configuration data that the name does not announce and that the admin-floor item route is meant to restrict.'),
  D('DEF-0B9-ORG-ORGANIZATION-ROW-FACADES-CONFIGURE-STEWARD-WRITES-OVER-ORGANIZATIONS-REFUSED-ONLY-BY-GOVERNANCE-LIST', SHARING_CAP, 'MEDIUM',
    'The access-logs route configures PATCH at the steward write floor and the sharing-settings route at the admin floor over the organizations table with no blocked patch fields, and both configure the administrator DELETE that archives the organization; the only thing that makes them answer 403 today is the entry of organizations in the READ_ONLY list of the CRUD governance table, so one edit of that list would let a steward rewrite parent_id, status, settings and slug of the organization through a route named for logs, bypassing the system-administrator check that the organizations item route applies to parent and status.'),
]

const GOVERNANCE_LIST_QUOTE = "'organization_members', 'organizations', 'profiles', 'steward_assignments', 'per_capita_remittances', 'dues_transactions',"

const future = {
  record: 'Decide which office owns each field of the organization record and which of them another organization may read, authorize a cross-organization read by a platform mandate and not by a session, route parent and status changes (and the archive) through one governance check that recomputes the hierarchy and keeps the prior values, validate the body, and read statistics inside the tenant transaction.',
  roster: 'Decide the office that may add a person to an organization and the ceiling of the role it may confer, require the person acceptance before an active membership, apply the member-directory policy to the roster read, exclude removed members and page the result, and make the organization guard honour member status and removal.',
  directory: 'Keep the case-policy directory authority, record the reads of member contact and employment data in the audit trail once the readers are named, drop the canned department, position and seniority defaults and escape and bound the search.',
  hierarchy: 'Decide with the institution what an organization may see of its parents, children and descendants and through which verified link, derive the scope from the caller membership on the server instead of the path id, run the read in the caller tenant context, validate the id, answer 404 for an unknown organization and bound the result.',
  analytics: 'Decide who may read organization analytics, derive the organization from the session or from a verified mandate, run the counts in that organization context, return a count of unmeasured values as unmeasured, suppress small groups and audit the read.',
  sharing: 'Serve the sharing settings and the cross-organization access log from routes that read organization_sharing_settings and cross_org_access_log under the office the institution names, write every sharing change with its audit record in the same transaction, and retire the organizations row copies.',
}

const personaOwnOrg = 'Signed-in member of an organization asking for the record of the organization of their session'

function itemGet(a) {
  return mk({
    persona: 'Any signed-in user, including an administrator of the organization, reading an organization record by its id',
    service: `${ITEM_ROUTE} (GET: auth, withSystemContext read of organizations, bare db statistics)`,
    authn: `${SESSION} (auth() in the handler; 401 when no user id).`,
    cat: 'SESSION_ONLY',
    authz: 'The handler requires a session user id and the uuid shape of the path id and nothing more: no membership of the organization, no role floor and no mandate. authorizeAction is not called.',
    tenant: 'The organization is the path id, not the session organization: the row is read inside withSystemContext, the union_eyes_system role that the 0108 policy for the organizations table exempts, so no tenant predicate or policy applies, and the statistics run on the shared db client with no organization context.',
    owner: 'organizations row of the path id (profile, contact, billing contact reference, settings JSON, enabled features, member counters); the grievances and organizations counts are derived from other rows.',
    sens: 'Organization name, contact email, phone, website and address, charter number, subscription tier, billing contact id, settings JSON, enabled features, member counts, creator id and legacy id',
    priv: 'The caller receives the whole mapped organization record of any organization whose uuid they supply, together with claim totals and child count; no field of the mapper is withheld.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Read of another organization record needs a mandate and a read audit once the offices that may read it are named.',
    does: 'Returns 401 without a session user, 400 for a non-uuid id, reads the organizations row of the id with the system role (404 when absent), computes active and total grievance counts and the child organization count with db.execute and returns the mapped record plus those figures.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.record,
    dec: [D_ORG_RECORD, D_PLATFORM],
    ev: [
      a.h('authentication', 'const { userId } = await auth()'),
      a.h('authorization', UNAUTH),
      a.h('authorization', "const invalid = assertOrgIdParam(id)"),
      a.h('tenantScope', 'const [row] = await withSystemContext(() =>'),
      a.h('tenantScope', 'db.select().from(organizations).where(eq(organizations.id, id)),'),
      a.svc('tenantScope', RLS_CONTEXT, 'return await systemDb.transaction(async (tx) => {', 'withSystemContext'),
      a.sch('tenantScope', RLS_0108, "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row"),
      a.h('mutation', 'return NextResponse.json({'),
      a.h('privacy', 'const mapped = mapOrg(row)'),
      a.local('privacy', 'mapOrg', 'billing_contact_id: row.billingContactId,'),
      a.local('privacy', 'mapOrg', 'settings: row.settings ?? {},'),
      a.local('privacy', 'mapOrg', 'email: row.email,'),
      a.h('defect', 'await db.execute('),
      a.tbl('defect', 'organizations', /billingContactId: uuid\('billing_contact_id'\)/),
    ],
    inf: [
      { claim: 'defect', statement: 'The statistics statements are issued after the withSystemContext callback has returned and outside any withRLSContext callback, so the db proxy resolves to the pooled connection with no active tenant or system transaction; whether they see rows depends on the role of that connection under the 0108 policies.' },
    ],
    def: [
      'DEF-0B9-ORG-ITEM-GET-ANY-SIGNED-IN-USER-READS-ANY-ORGANIZATION-RECORD-AS-SYSTEM',
      'DEF-0B9-ORG-ITEM-GET-STATISTICS-RUN-ON-BARE-DB-AFTER-SYSTEM-READ-WITHOUT-ORGANIZATION-CONTEXT',
    ],
    corr: [],
  })
}

const memberGuardEv = (a) => [
  a.imp('authentication', 'requireUserForOrganization', 'const userId = userIdOverride || (await auth()).userId;'),
  a.imp('authorization', 'requireUserForOrganization', 'const user = await getUserContextForOrganization(organizationId, userId);'),
  a.svc('tenantScope', AUTH_GUARD, 'where: (om, { eq, and }) => and(eq(om.userId, userId), eq(om.organizationId, organizationId)),', 'getUserContextForOrganization'),
  a.svc('defect', AUTH_GUARD, 'columns: { id: true, organizationId: true, role: true },', 'getUserContextForOrganization'),
  a.svc('defect', AUTH_GUARD, "const platformAdminIds = (process.env.PLATFORM_ADMIN_USER_IDS || '')", 'getUserContextForOrganization'),
  a.sch('defect', ORG_SCHEMA, /deletedAt: timestamp\('deleted_at'/, { symbol: 'organizationMembers' }),
  a.sch('defect', ORG_SCHEMA, /status: text\('status'\)\.notNull\(\)\.default\('active'\)/, { symbol: 'organizationMembers' }),
]

function itemPatch(a) {
  return mk({
    persona: 'Administrator of an organization updating its profile, contact details, sectors and settings; a system administrator changing its parent or status',
    service: `${ITEM_ROUTE} (PATCH: requireUserForOrganization, role admin, requireSystemAdmin for parent and status, tenant transaction with persistAtomicAudit)`,
    authn: `${SESSION} (requireUserForOrganization; 403 when it throws).`,
    authz: 'The caller must hold a membership of the path organization (requireUserForOrganization) whose first role ranks at admin or above in ROLE_HIERARCHY; a change of parent_id or status additionally requires requireSystemAdmin. A role title is not a kernel decision and authorizeAction is not called.',
    tenant: 'The organization is the path id and membership of that organization is required, but the row is read and updated with withRLSContext with no context map, so the transaction carries the session organization: the update filters on the path id and a caller whose session organization differs from the path organization updates nothing under the 0108 policy and receives 404.',
    owner: 'organizations row of the path id; the update changes profile, contact, sectors, settings and (system administrator only) parent and status.',
    sens: 'Organization name, slug, display name, contact email, phone and website, sectors, settings JSON, parent affiliation and lifecycle status',
    priv: 'The response returns the whole mapped updated record including billing contact id and settings; the audit record lists the changed field names and no values.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The update and the organization.update audit row (persistAtomicAudit with the transaction handle) commit in one tenant transaction; the audit lists the field names and not the prior or new values, the actor is the membership user id.',
    reqAudit: 'Keep the in-transaction audit row and add the prior and new values of parent, status and settings and the authorizing decision.',
    does: 'Requires membership and admin role of the path organization, parses the body without a schema, builds an update from name, slug, display_name, status, email, phone, website, sectors, parent_id and settings, drops parent and status unless they change (and requires a system administrator when they do), updates the row inside withRLSContext, commits the audit row and returns the mapped record; 404 when no row.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.record,
    dec: [D_ORG_RECORD],
    ev: [
      ...memberGuardEv(a),
      a.h('authentication', 'userCtx = await requireUserForOrganization(id)'),
      a.h('authorization', 'if ((ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] ?? 0) < ROLE_HIERARCHY.admin) {'),
      a.h('authorization', 'await requireSystemAdmin()'),
      a.imp('authorization', 'requireSystemAdmin', 'const isAdmin = await isSystemAdmin();'),
      a.h('tenantScope', 'const updated = await withRLSContext(async (tx) => {'),
      a.h('tenantScope', 'const [current] = await tx.select().from(organizations).where(eq(organizations.id, id))'),
      a.h('mutation', 'const [row] = await tx.update(organizations).set(updates).where(eq(organizations.id, id)).returning()'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.h('defect', 'const body = await req.json()'),
      a.h('defect', 'if (body.slug !== undefined) updates.slug = body.slug'),
      a.h('defect', 'if (body.settings !== undefined) updates.settings = body.settings'),
      a.h('defect', 'if (body.parent_id !== undefined) updates.parentId = body.parent_id'),
      a.h('defect', "details: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },"),
      a.tbl('defect', 'organizations', /hierarchyPath: text\('hierarchy_path'\)\.array\(\)\.notNull\(\)/),
      a.tbl('defect', 'organizations', /settings: jsonb\('settings'\)/),
      a.tbl('defect', 'organizations', /slug: text\('slug'\)\.notNull\(\)\.unique\(\)/),
    ],
    inf: [
      { claim: 'defect', statement: 'The update object never contains hierarchyPath or hierarchyLevel, and the route reads no descendant row, so a changed parent_id leaves the stored path of the organization and of its descendants as it was.' },
    ],
    def: [
      'DEF-0B9-ORG-ITEM-PATCH-BODY-UNVALIDATED-SETTINGS-AND-SLUG-REPLACED-WHOLESALE',
      'DEF-0B9-ORG-ITEM-PATCH-PARENT-CHANGE-DOES-NOT-REPOINT-HIERARCHY-PATH-OR-CHECK-CYCLE',
      'DEF-0B9-ORG-MEMBERSHIP-GUARD-IGNORES-MEMBER-STATUS-AND-REMOVAL-FLAG',
    ],
    corr: [],
  })
}

function itemDelete(a) {
  return mk({
    persona: 'Administrator of an organization archiving their own organization',
    service: `${ITEM_ROUTE} (DELETE: requireUserForOrganization, role admin, tenant transaction with persistAtomicAudit)`,
    authn: `${SESSION} (requireUserForOrganization; 403 when it throws).`,
    authz: 'The caller must hold a membership of the path organization whose first role ranks at admin or above; no system administrator check, no second approver and no reason are required, unlike the status change on the PATCH of the same file. A role title is not a kernel decision.',
    tenant: 'Membership of the path organization is required; the archive runs in withRLSContext with no context map (the session organization) and updates the row of the path id, so a caller whose session organization differs updates nothing and receives 404.',
    owner: 'organizations row of the path id; the archive sets its status to archived.',
    sens: 'Lifecycle status of the organization; the response returns the whole mapped organization record',
    priv: 'The response returns the archived organization record, including billing contact id and settings.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The status update and the organization.archive audit row (persistAtomicAudit with the transaction handle) commit in one tenant transaction; the audit lists only the status value.',
    reqAudit: 'Keep the in-transaction audit row and add the reason, the prior status, the approving office and the child organizations affected.',
    does: 'Requires membership and the admin role of the path organization, sets status archived and updatedAt on the organization row inside withRLSContext, writes the audit row in the same transaction and returns the mapped archived record; 404 when no row.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.record,
    dec: [D_ORG_RECORD],
    ev: [
      ...memberGuardEv(a),
      a.h('authentication', 'userCtx = await requireUserForOrganization(id)'),
      a.h('authorization', 'if ((ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] ?? 0) < ROLE_HIERARCHY.admin) {'),
      a.h('tenantScope', 'const archived = await withRLSContext(async (tx) => {'),
      a.h('mutation', ".set({ status: 'archived', updatedAt: new Date() })"),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.h('defect', "action: 'organization.archive',"),
      a.tbl('defect', 'organizations', /status: text\('status'\)\.default\('active'\)/),
    ],
    inf: [
      { claim: 'defect', statement: 'The DELETE handler contains no requireSystemAdmin call, whereas the PATCH handler of the same file calls requireSystemAdmin before it lets a status change through; the archive therefore performs a status change that the PATCH reserves to a system administrator.' },
    ],
    def: [
      'DEF-0B9-ORG-ITEM-DELETE-ORGANIZATION-ADMIN-ARCHIVES-OWN-ORGANIZATION-BYPASSING-STATUS-GOVERNANCE',
      'DEF-0B9-ORG-MEMBERSHIP-GUARD-IGNORES-MEMBER-STATUS-AND-REMOVAL-FLAG',
    ],
    corr: [],
  })
}

function rosterGet(a) {
  return mk({
    persona: 'Member of an organization (any role) reading the roster of the organization',
    service: `${MEMBERS_ROUTE} (GET: requireUserForOrganization, withRLSContext read of organization_members)`,
    authn: `${SESSION} (auth() in the handler; 401 when no user id; requireUserForOrganization, 403 when it throws).`,
    authz: 'The caller must hold a membership of the path organization (requireUserForOrganization) in any role, status or removal state; there is no role floor, no member-directory policy and no mandate. authorizeAction is not called.',
    tenant: 'The organization is the path id after membership of that organization is shown; the roster is read with withRLSContext({ organizationId: id }) and an explicit eq(organizationMembers.organizationId, id) predicate.',
    owner: 'organization_members rows of the path organization: one row per member with user id, name, email, phone, department, membership number, role and status.',
    sens: 'Member names, emails, phone numbers, departments, membership numbers, organization roles and statuses, join dates',
    priv: 'Every member receives every roster row of the organization with contact details and role, including inactive, suspended and soft-deleted rows; no field is withheld by role.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Audit reads of the roster once the offices that may read contact details are named.',
    does: 'Returns 401 without a user, 403 when the caller is not a member of the path organization, then returns every organization_members row of the organization (no limit, no deleted or status filter) mapped to user id, role, status, name, email, phone, department, membership number, primary flag and dates.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.roster,
    dec: [D_ORG_ROSTER],
    ev: [
      ...memberGuardEv(a),
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', 'await requireUserForOrganization(id);'),
      a.h('tenantScope', 'const rows = await withRLSContext({ organizationId: id }, async () =>'),
      a.h('tenantScope', 'db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, id)),'),
      a.h('mutation', 'return NextResponse.json({ data: mapped });'),
      a.h('privacy', 'email: row.email,'),
      a.h('privacy', 'phone: row.phone,'),
      a.h('privacy', 'membership_number: row.membershipNumber,'),
      a.h('defect', 'const mapped = rows.map(row => ({'),
      a.tbl('defect', 'organizationMembers', /phone: text\('phone'\)/),
    ],
    inf: [
      { claim: 'defect', statement: 'The organization/members route applies memberDirectoryAccess (case-policy scope: own row and assigned-case members for a steward, employment data only at officer level) and isNull(deletedAt); this roster route imports neither.' },
      { claim: 'defect', statement: 'The statement carries no isNull(deletedAt), no status condition and no limit, and the handler never reads the role of the caller after requireUserForOrganization returns, so a member of any role receives the whole table of the organization.' },
    ],
    def: [
      'DEF-0B9-ORG-ROSTER-GET-ANY-ORGANIZATION-MEMBER-READS-FULL-ROSTER-WITH-CONTACT-DETAILS',
      'DEF-0B9-ORG-ROSTER-GET-INCLUDES-REMOVED-MEMBERS-AND-IS-UNBOUNDED',
      'DEF-0B9-ORG-MEMBERSHIP-GUARD-IGNORES-MEMBER-STATUS-AND-REMOVAL-FLAG',
    ],
    corr: [],
  })
}

function rosterPost(a) {
  return mk({
    persona: 'Steward or above of an organization adding a person to the roster of the organization with an organization role',
    service: `${MEMBERS_ROUTE} (POST: requireUserForOrganization, steward floor, zod body, tenant transaction with persistAtomicAudit)`,
    authn: `${SESSION} (requireUserForOrganization; 403 when it throws).`,
    authz: 'The caller must hold a membership of the path organization whose first role ranks at steward or above in ROLE_HIERARCHY; the granted role is any of member, steward, admin, executive or observer and is not compared with the caller role. A role title is not a kernel decision.',
    tenant: 'The organization is the path id after membership of that organization is shown; the insert carries organizationId = id inside withRLSContext({ organizationId: id }).',
    owner: 'organization_members row of the path organization for the named user id; the row is the source of the role that the organization routes later honour for that user.',
    sens: 'Member name, email, phone, department, membership number, organization role and status of the person added',
    priv: 'The response returns the stored roster row (201) with the contact details of the person added; the audit record names the member user id, role and status.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The insert and the membership.create audit row (persistAtomicAudit with the transaction handle, so a failed audit rolls the insert back) commit in one tenant transaction; the audit names the member user id, role, status and the route.',
    reqAudit: 'Keep the in-transaction audit row and add the granting decision, the ceiling of the granting role and the acceptance of the person added.',
    does: 'Requires membership and the steward role of the path organization, parses the body with zod (user_id, role, status, name, email and optional phone, department, membership number), inserts an organization_members row with the stated role and status in the organization, commits the audit row and returns 201 with the stored row.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.roster,
    dec: [D_ORG_ROSTER],
    ev: [
      ...memberGuardEv(a),
      a.h('authentication', 'userCtx = await requireUserForOrganization(id);'),
      a.h('authorization', 'if ((ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] ?? 0) < ROLE_HIERARCHY.steward) {'),
      a.local('authorization', 'createMemberSchema', "role: z.enum(['member', 'steward', 'admin', 'executive', 'observer']).default('member'),"),
      a.h('tenantScope', 'const [created] = await withRLSContext({ organizationId: id }, async (tx) => {'),
      a.h('mutation', '.insert(organizationMembers)'),
      a.h('mutation', 'organizationId: id,'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.svc('audit', AUDIT_ATOMIC, 'await tx.insert(auditLogs).values({', 'persistAtomicAudit'),
      a.local('defect', 'createMemberSchema', "status: z.enum(['active', 'inactive', 'pending', 'suspended']).default('active'),"),
      a.local('defect', 'createMemberSchema', 'user_id: z.string().min(1).max(255),'),
      a.h('defect', 'role,'),
      a.h('defect', "action: 'membership.create',"),
      a.tbl('defect', 'organizationMembers', /uniqueMembership: uniqueIndex\('unique_org_membership'\)/),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler compares the caller role with ROLE_HIERARCHY.steward only; no statement compares role with the role of the caller, checks the user id against any identity table, or issues an invitation, so the stored role and the active status are whatever the body states.' },
    ],
    def: [
      'DEF-0B9-ORG-ROSTER-POST-STEWARD-GRANTS-ANY-ORGANIZATION-ROLE-TO-ANY-USER-ID-WITHOUT-ACCEPTANCE',
      'DEF-0B9-ORG-ROSTER-POST-DUPLICATE-USER-ID-AND-INVALID-JSON-HANDLING-LEAVES-UNHANDLED-ERRORS',
      'DEF-0B9-ORG-MEMBERSHIP-GUARD-IGNORES-MEMBER-STATUS-AND-REMOVAL-FLAG',
    ],
    corr: [],
  })
}

function directoryFacts(a, kind) {
  const search = kind === 'search'
  return mk({
    persona: search
      ? 'Steward (members of their assigned cases) or officer (the organization) searching the member directory by name or email'
      : 'Steward (members of their assigned cases) or officer (the organization) reading the member directory with membership statistics',
    service: `${API}${search ? 'organization/members/search' : 'organization/members'}/route.ts (withApi steward floor, memberDirectoryAccess, withRLSContext read of organization_members)`,
    authn: `${SESSION} (withApi requires a session; 401 otherwise).`,
    authz: 'withApi requires the steward role floor, and memberDirectoryAccess then derives the directory scope from the case policy: platform and ordinary roles receive none (403), a steward receives only their own row and members of claims assigned to them, an officer-level reader receives the organization. The role floor is eligibility, not a kernel decision; authorizeAction is not called.',
    tenant: 'The organization comes from the session through withApi, never from the query; the read runs in withRLSContext (the session organization) with an explicit eq(organizationMembers.organizationId, organizationId) predicate, soft-deleted rows excluded, and for stewards a correlated claims predicate.',
    owner: 'organization_members rows of the session organization.',
    sens: search
      ? 'Member name, email, role, status, department and membership number of up to 50 matches'
      : 'Member name, email, phone, role, status, department, position, membership number, location and, for officer-level readers, hire date, seniority, union join date and profile metadata',
    priv: search
      ? 'A steward receives name, email, role, status, department and membership number of the members of their assigned cases that match the query; an officer receives matches across the organization; no employment data is returned.'
      : 'A steward receives their own row and the rows of members of claims assigned to them; an officer receives the organization; employment dates, seniority and profile metadata only at officer level.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Audit reads of member contact and employment data once the offices that may read them are named; the directory authority is a case-policy derivation, not a recorded mandate.',
    does: search
      ? 'Reads the q parameter, derives the directory scope of the caller, and selects up to 50 organization_members rows of the organization (own and assigned-case rows only for a steward) whose name or email matches the raw pattern, returning id, name, email, role, status, department and membership number.'
      : 'Derives the directory scope of the caller, selects the organization_members rows of the organization (own and assigned-case rows only for a steward, deleted rows excluded, no limit), projects each row through the directory projection with location and returns the members with total and active counts.',
    status: 'IMPLEMENTED_IN_SOURCE',
    gate: GATE,
    deps: [1, 13],
    future: future.directory,
    dec: [D_ORG_ROSTER],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
      a.h('authorization', 'const access = memberDirectoryAccess(user?.role);'),
      a.imp('authorization', 'memberDirectoryAccess', "if (!policyRole || !caseActionAllowed('note_add_internal', policyRole)) return DENIED"),
      a.imp('authorization', 'memberDirectoryAccess', "if (!caseActionAllowed('case_read_any', policyRole)) return { scope: 'case-context', includeSensitive: false }"),
      a.h('tenantScope', 'eq(organizationMembers.organizationId, organizationId),'),
      a.h('tenantScope', 'isNull(organizationMembers.deletedAt),'),
      a.h('tenantScope', 'return withRLSContext(async () => {'),
      a.h('mutation', '.from(organizationMembers)'),
      a.h('privacy', search ? 'email: m.email,' : 'location: m.location || \'\','),
      a.tbl('privacy', 'organizationMembers', /email: text\('email'\)\.notNull\(\)/),
      ...(search
        ? [
          a.h('defect', 'ilike(organizationMembers.name, `%${q}%`),'),
          a.h('defect', '.limit(50);'),
        ]
        : [
          a.imp('defect', 'projectDirectoryMember', "department: m.department || 'Administration',"),
          a.imp('defect', 'projectDirectoryMember', "position: m.position || 'Union Member',"),
          a.imp('defect', 'projectDirectoryMember', 'seniority: access.includeSensitive ? m.seniority ?? 0 : null,'),
        ]),
    ],
    inf: [],
    def: search
      ? ['DEF-0B9-ORG-DIRECTORY-SEARCH-UNESCAPED-WILDCARDS-FIXED-FIFTY-NO-ORDER-OR-PAGE']
      : ['DEF-0B9-ORG-DIRECTORY-PROJECTION-FILLS-MISSING-FIELDS-WITH-CANNED-DEPARTMENT-POSITION-AND-ZERO-SENIORITY'],
    corr: [],
  })
}

function orgCurrentFacts(a) {
  return mk({
    persona: 'Signed-in user whose client asks which organization the session works in',
    service: `${API}org/current/route.ts (withApiAuth, resolveOrgIdFromContext)`,
    authn: `${SESSION} (withApiAuth requires a session; 401 otherwise).`,
    cat: 'SESSION_ONLY',
    authz: 'withApiAuth requires a signed-in user and nothing more: no role floor and no entitlement. authorizeAction is not called.',
    tenant: 'The organization id comes from the verified session context (resolveOrgIdFromContext prefers the validated context organization and falls back to the canonical resolver for the user); no path or query value is read and no table is queried.',
    owner: 'The session organization id only; no organization row is read.',
    sens: 'The organization id of the caller session',
    priv: 'The caller receives their own organization id with null name, slug and subscription tier and an empty feature list; no other organization is listed.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads need no audit record; the route returns no organization data.',
    does: 'Returns 401 without a user id, resolves the session organization id (404 when none), and returns an organization object with that id and null name, null slug, null subscription tier and no features, with the same object as the only element of availableOrgs.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1],
    future: 'Read the organization record and the memberships of the user from the canonical source, list every organization the user may select, and return the real name, slug, tier and features.',
    dec: [],
    ev: [
      ...guardEv(a, 'withApiAuth'),
      a.h('authorization', 'const userId = context.userId;'),
      a.h('tenantScope', 'const orgId = await resolveOrgIdFromContext(context, userId);'),
      a.imp('tenantScope', 'resolveOrgIdFromContext', 'if (isAppOrgUuid(context.organizationId)) {'),
      a.h('mutation', 'return NextResponse.json({ org, availableOrgs: [org] });'),
      a.h('defect', 'name: null as string | null,'),
      a.h('defect', 'features: [] as string[],'),
    ],
    inf: [{ claim: 'defect', statement: 'The route file imports no database module and queries no table, so the null name, slug and tier and the empty feature list are literals and not the stored values of the organization.' }],
    def: ['DEF-0B9-ORG-CURRENT-CONTEXT-ROUTE-RETURNS-PLACEHOLDER-ORGANIZATION-WITH-NULL-NAME-AND-NO-FEATURES'],
    corr: [],
  })
}

function organizationsCurrentFacts(a) {
  return mk({
    persona: personaOwnOrg,
    service: `${API}organizations/current/route.ts (auth, getOrganizationIdForUser, withRLSContext read of organizations and grievance counts)`,
    authn: `${SESSION} (auth() in the handler; 401 when no user id; 403 when no organization can be resolved).`,
    cat: 'SESSION_ONLY',
    authz: 'The handler requires a session user and a resolvable organization and nothing more: no role floor, so an ordinary member receives the organization record. authorizeAction is not called.',
    tenant: 'The organization is the session organization (auth orgId or getOrganizationIdForUser), never a path or query value; the row and the counts are read inside withRLSContext({ organizationId }) with an explicit predicate on that id.',
    owner: 'organizations row of the session organization; claim counts derive from grievances rows of that organization.',
    sens: 'Organization name, contact email, phone, website and address, charter number, subscription tier, billing contact id, settings JSON, enabled features, member counts, creator id and legacy id',
    priv: 'Any member of the organization receives the whole organization record of their own organization, including billing contact id and settings, with claim totals and child count.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of the organization record need no audit record once the fields a member may see are named.',
    does: 'Resolves the session organization (403 when none), reads its organizations row inside withRLSContext (404 when absent), counts total and active grievances and child organizations of that id and returns the record in snake case with the counts.',
    status: 'IMPLEMENTED_IN_SOURCE',
    gate: GATE,
    deps: [1],
    future: 'Return a member-safe projection of the organization record and reserve billing contact, settings and subscription fields to the offices the institution names.',
    dec: [D_ORG_RECORD],
    ev: [
      a.h('authentication', 'const { userId, orgId: sessionOrgId } = await auth()'),
      a.h('authorization', UNAUTH),
      a.h('tenantScope', 'organizationId = sessionOrgId || (await getOrganizationIdForUser(userId));'),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async () => {'),
      a.h('tenantScope', '.where(eq(organizations.id, organizationId))'),
      a.h('mutation', 'return NextResponse.json({'),
      a.h('privacy', 'billing_contact_id: row.billingContactId,'),
      a.h('privacy', 'settings: row.settings ?? {},'),
      a.tbl('privacy', 'organizations', /billingContactId: uuid\('billing_contact_id'\)/),
      a.tbl('privacy', 'organizations', /settings: jsonb\('settings'\)/),
    ],
    inf: [],
    def: ['DEF-0B9-ORG-CURRENT-ROW-READ-AT-ANY-MEMBER-FLOOR-RETURNS-SETTINGS-AND-BILLING-CONTACT'],
    corr: [],
  })
}

const hierarchyBase = {
  authn: `${SESSION} (auth() in the handler; 401 when no user id).`,
  cat: 'SESSION_ONLY',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the route writes no row and no audit record.',
  reqAudit: 'Reads of another organization hierarchy need a mandate and a read audit once the offices that may read it are named.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [1, 13],
  future: future.hierarchy,
  dec: [D_FEDERATION, D_PLATFORM],
}

const systemTenant = 'The organization scope is the path id (or the query rootOrgId), not the session organization: the rows are read inside withSystemContext, the union_eyes_system role that the 0108 policy exempts, so no tenant predicate or policy applies and the caller is never related to the organization named.'

function hierarchyEv(a) {
  return [
    a.h('authentication', 'const { userId } = await auth()'),
    a.h('authorization', UNAUTH),
    a.svc('tenantScope', RLS_CONTEXT, 'return await systemDb.transaction(async (tx) => {', 'withSystemContext'),
    a.sch('tenantScope', RLS_0108, "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row"),
    a.tbl('defect', 'organizations', /hierarchyPath: text\('hierarchy_path'\)\.array\(\)\.notNull\(\)/),
    a.tbl('defect', 'organizations', /memberCount: integer\('member_count'\)/),
  ]
}

function ancestorsFacts(a) {
  return mk({
    ...hierarchyBase,
    persona: 'Any signed-in user asking for the ancestors of an organization by its id',
    service: `${ANCESTORS_ROUTE} (auth, withSystemContext reads of organizations)`,
    authz: 'The handler requires a session user id and nothing more: no membership of the organization, no role floor and no mandate. authorizeAction is not called.',
    tenant: systemTenant,
    owner: 'organizations rows of the path organization and of the ancestors named by its hierarchy_path.',
    sens: 'Name, slug, type, hierarchy level and status of the ancestor organizations of the organization named by the path',
    priv: 'Any signed-in user learns the federations and congress an organization of their choosing is affiliated with; the response is an empty list for an unknown organization, a root, and any organization.',
    does: 'Returns 401 without a user id, reads the hierarchy_path of the path organization with the system role, reads the organizations named by that path (excluding itself) with the system role and returns id, name, slug, type, level and status ordered by level; an unknown or root organization returns an empty list.',
    ev: [
      ...hierarchyEv(a),
      a.h('tenantScope', 'const [org] = await withSystemContext(() =>'),
      a.h('tenantScope', '.where(eq(organizations.id, id)),'),
      a.h('behavior', 'const ancestorIds = (org.hierarchyPath ?? []).filter((aid) => aid !== id)'),
      a.h('mutation', 'db.select().from(organizations).where(inArray(organizations.id, ancestorIds)),'),
      a.h('privacy', 'status: row.status,'),
      a.h('defect', "if (!org) return NextResponse.json({ data: [] })"),
    ],
    inf: [],
    def: [
      'DEF-0B9-ORG-ANCESTORS-ANY-SIGNED-IN-USER-READS-ANCESTRY-OF-ANY-ORGANIZATION-AS-SYSTEM',
      'DEF-0B9-ORG-HIERARCHY-ROUTES-PASS-UNVALIDATED-PATH-ID-TO-UUID-COLUMN-AND-ANSWER-EMPTY-200-FOR-UNKNOWN-ORGANIZATION',
    ],
    corr: [],
  })
}

function childrenFacts(a) {
  return mk({
    ...hierarchyBase,
    persona: 'Any signed-in user asking for the child organizations of an organization by its id',
    service: `${CHILDREN_ROUTE} (auth, withSystemContext read of organizations by parent id)`,
    authz: 'The handler requires a session user id and nothing more: no membership of the organization, no role floor and no mandate. authorizeAction is not called.',
    tenant: systemTenant,
    owner: 'organizations rows whose parent_id is the path id.',
    sens: 'Name, slug, type, parent id, hierarchy path and level, sectors, member and active member counts, status, CLC affiliation and creation date of each child organization',
    priv: 'Any signed-in user receives the child organizations of any organization, with their member counts, sectors and CLC affiliation, whatever their own organization.',
    does: 'Returns 401 without a user id, reads every organizations row whose parent_id equals the path id with the system role (no limit) and returns the mapped child records.',
    ev: [
      ...hierarchyEv(a),
      a.h('tenantScope', 'const rows = await withSystemContext(() =>'),
      a.h('tenantScope', 'db.select().from(organizations).where(eq(organizations.parentId, id)),'),
      a.h('mutation', 'return NextResponse.json({ data: mapped })'),
      a.h('privacy', 'member_count: row.memberCount,'),
      a.h('privacy', 'clc_affiliated: row.clcAffiliated,'),
      a.h('defect', 'sectors: row.sectors,'),
    ],
    inf: [],
    def: [
      'DEF-0B9-ORG-CHILDREN-ANY-SIGNED-IN-USER-LISTS-CHILDREN-OF-ANY-ORGANIZATION-AS-SYSTEM',
      'DEF-0B9-ORG-HIERARCHY-ROUTES-PASS-UNVALIDATED-PATH-ID-TO-UUID-COLUMN-AND-ANSWER-EMPTY-200-FOR-UNKNOWN-ORGANIZATION',
    ],
    corr: [],
  })
}

function descendantsFacts(a) {
  return mk({
    ...hierarchyBase,
    persona: 'Any signed-in user asking for every descendant organization of an organization by its id',
    service: `${DESCENDANTS_ROUTE} (auth, withSystemContext read of organizations by hierarchy path)`,
    authz: 'The handler requires a session user id and nothing more: no membership of the organization, no role floor and no mandate. authorizeAction is not called.',
    tenant: systemTenant,
    owner: 'organizations rows whose hierarchy_path contains the path id.',
    sens: 'Name, slug, type, parent id, hierarchy path and level, member count and status of every descendant organization',
    priv: 'Any signed-in user receives the whole subtree of any organization, with member counts and hierarchy paths, whatever their own organization.',
    does: 'Returns 401 without a user id, reads every organizations row other than the path organization whose hierarchy_path array contains the path id with the system role (no limit) and returns the mapped records.',
    ev: [
      ...hierarchyEv(a),
      a.h('tenantScope', 'const rows = await withSystemContext(() =>'),
      a.h('tenantScope', '.where(sql`${id} = ANY(${organizations.hierarchyPath}) AND ${organizations.id} != ${id}`),'),
      a.h('mutation', 'return NextResponse.json({ data: mapped })'),
      a.h('privacy', 'member_count: row.memberCount,'),
      a.h('defect', 'hierarchy_path: row.hierarchyPath,'),
    ],
    inf: [],
    def: [
      'DEF-0B9-ORG-DESCENDANTS-ANY-SIGNED-IN-USER-LISTS-WHOLE-SUBTREE-OF-ANY-ORGANIZATION-UNBOUNDED-AS-SYSTEM',
      'DEF-0B9-ORG-HIERARCHY-ROUTES-PASS-UNVALIDATED-PATH-ID-TO-UUID-COLUMN-AND-ANSWER-EMPTY-200-FOR-UNKNOWN-ORGANIZATION',
    ],
    corr: [],
  })
}

function hierarchyListFacts(a) {
  return mk({
    ...hierarchyBase,
    persona: 'Any signed-in user, including an administrator using the organization hierarchy page, listing the organizations of the hierarchy',
    service: `${HIERARCHY_ROUTE} (auth, withSystemContext read of up to 500 organizations, in-memory rootOrgId filter)`,
    authz: 'The handler requires a session user id and nothing more: no membership, no role floor and no mandate. The rootOrgId query parameter narrows nothing for a caller who omits it. authorizeAction is not called.',
    tenant: 'The scope is every organization except platform (and the query rootOrgId, applied in memory after the read), not the session organization: the rows are read inside withSystemContext, which the 0108 policy exempts, so no tenant predicate or policy applies.',
    owner: 'organizations rows of every tenant except type platform.',
    sens: 'Name, slug, type, parent id, hierarchy path and level, member and active member counts, child count, status, sectors and CLC affiliation of up to 500 organizations',
    priv: 'Any signed-in user receives the structure, size and affiliation of up to 500 organizations of every tenant.',
    does: 'Returns 401 without a user id, reads up to 500 organizations other than type platform ordered by level and name with the system role, filters in memory to the rootOrgId subtree when the query names one, adds child_count computed from the rows read and a constant rls_enabled true, and returns the list.',
    ev: [
      ...hierarchyEv(a),
      a.h('tenantScope', 'const baseRows = await withSystemContext(() =>'),
      a.h('tenantScope', ".where(ne(organizations.organizationType, 'platform'))"),
      a.h('behavior', "const rootOrgId = searchParams.get('rootOrgId')"),
      a.h('behavior', '(row) => row.id === rootOrgId || (row.hierarchyPath ?? []).includes(rootOrgId),'),
      a.h('mutation', "return NextResponse.json({ success: true, data: mapped })"),
      a.h('privacy', 'member_count: row.memberCount,'),
      a.h('defect', '.limit(500),'),
      a.h('defect', 'rls_enabled: true,'),
      a.h('defect', 'child_count: rows.filter((candidate) => candidate.parentId === row.id).length,'),
    ],
    inf: [],
    def: [
      'DEF-0B9-ORG-HIERARCHY-LIST-ANY-SIGNED-IN-USER-ENUMERATES-EVERY-ORGANIZATION-AS-SYSTEM',
      'DEF-0B9-ORG-HIERARCHY-LIST-HARD-CODED-RLS-FLAG-AND-SILENT-FIVE-HUNDRED-ROW-CAP',
    ],
    corr: [],
  })
}

function pathFacts(a) {
  return mk({
    ...hierarchyBase,
    persona: 'Any signed-in user asking for the root-to-organization path of an organization by id or slug',
    service: `${PATH_ROUTE} (canonical branch: getCanonicalOrganizationPath; legacy branch: bare db reads of organizations)`,
    authn: `${SESSION} (the legacy branch calls auth() and answers 401 without a user id; the canonical branch resolves the canonical membership context).`,
    authz: 'In the legacy branch the handler requires a session user id and nothing more: no membership, no role floor and no mandate; in the canonical branch the path is limited to organizations of the caller memberships. authorizeAction is not called.',
    tenant: 'In the legacy branch the organization is the path uuid or slug and the rows are read through the shared db client with no withRLSContext and no withSystemContext, so whether they are confined to the caller depends on the row-level-security role of the connection; in the canonical branch the path is built from the memberships of the caller and reports the ancestors it omitted.',
    owner: 'organizations rows of the path organization and of the ancestors named by its hierarchy_path.',
    sens: 'Name, slug, type, parent id, sector, jurisdiction, description, hierarchy level and dates of each organization on the path',
    priv: 'In the legacy branch any signed-in user receives the identity, jurisdiction and description of the organization named by id or slug and of its ancestors when the connection does not confine the read; in the canonical branch only organizations of the caller memberships.',
    does: 'When the canonical bootstrap flag is 1 returns the membership-scoped path with completePath and omittedAncestorCount; otherwise returns 401 without a user, looks the organization up by uuid or slug, reads the ancestors named by its hierarchy_path by id and by slug, and returns the path from the root to the organization (an empty list for an unknown organization).',
    ev: [
      a.imp('behavior', 'currentStateContextEnabled', "return flag === '1'"),
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', 'if (!userId) {'),
      a.h('behavior', 'return NextResponse.json(await getCanonicalOrganizationPath((await params).id))'),
      a.h('tenantScope', 'const rows = await db'),
      a.h('tenantScope', '.where(lookupByUuid ? eq(organizations.id, id as any) : eq(organizations.slug, id as any))'),
      a.h('mutation', 'return NextResponse.json({ data: path });'),
      a.h('privacy', 'path.push(formatOrg(ancestor));'),
      a.local('privacy', 'formatOrg', 'description: o.description ?? null,'),
      a.h('defect', 'const [uuidAncestors, slugAncestors] = await Promise.all(['),
      a.svc('defect', SELECTION, 'const choices = await getCanonicalOrganizationChoices()', 'getCanonicalOrganizationPath'),
      a.svc('tenantScope', RLS_CONTEXT, 'return await systemDb.transaction(async (tx) => {', 'withSystemContext'),
      a.sch('defect', RLS_0108, "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row"),
      a.tbl('defect', 'organizations', /slug: text\('slug'\)\.notNull\(\)\.unique\(\)/),
    ],
    inf: [{ claim: 'defect', statement: 'The legacy branch imports db from the shared client and names no context wrapper; the active tenant or system transaction is resolved by the db proxy only inside a with-context callback, so these statements run on the pooled connection.' }],
    def: ['DEF-0B9-ORG-PATH-LEGACY-BRANCH-READS-ORGANIZATIONS-ON-BARE-DB-WITHOUT-CONTEXT-OR-MEMBERSHIP-CHECK'],
    corr: [],
  })
}

function analyticsFacts(a) {
  return mk({
    persona: 'Any signed-in user, including an administrator of the organization, reading the membership and grievance analytics of an organization by its id',
    service: `${ANALYTICS_ROUTE} (auth, withSystemContext organization read and child count, withRLSContext aggregate SQL over organization_members and grievances)`,
    authn: `${SESSION} (auth() in the handler; 401 when no user id).`,
    cat: 'SESSION_ONLY',
    authz: 'The handler requires a session user id and nothing more: no membership of the organization, no role floor and no mandate. authorizeAction is not called.',
    tenant: 'The organization is the path id with no shape validation and no relation to the caller: the organization row and the child count are read with the system role, and the member and grievance aggregates carry organization_id = path id inside a withRLSContext callback that sets the session organization, so what the aggregates return for another organization depends on the row-level-security role of the connection.',
    owner: 'organizations row of the path id and the organization_members and grievances rows of that organization, aggregated.',
    sens: 'Organization name and type, child organization count, member totals, active and new members, growth rate, grievance totals, active, resolved and this-month counts, average resolution days and counts by status',
    priv: 'Any signed-in user receives at least the name, type and child count of any organization, and the member and grievance aggregates of any organization when the connection does not confine them; counts by status are returned for small groups with no suppression.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of organization analytics need a mandate and a read audit once the offices that may read them are named.',
    does: 'Returns 401 without a user, reads the organization name and type with the system role (404 when absent), then in withRLSContext counts members (total, active, new this month, previous-month count), grievances (total, active, resolved, this month, by status), the average resolution days and, with a nested system context, the child organizations, and returns those figures with the computed growth rate.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: future.analytics,
    dec: [D_FEDERATION, D_PLATFORM],
    ev: [
      a.h('authentication', 'const { userId } = await auth()'),
      a.h('authorization', UNAUTH),
      a.h('tenantScope', 'const [org] = await withSystemContext(() =>'),
      a.h('tenantScope', 'db.select().from(organizations).where(eq(organizations.id, id)),'),
      a.h('tenantScope', 'const analytics = await withRLSContext(async () => {'),
      a.h('tenantScope', 'WHERE organization_id = ${id}`,'),
      a.h('tenantScope', 'db.execute(sql`SELECT count(*)::int AS cnt FROM organizations WHERE parent_id = ${id}`),'),
      a.svc('tenantScope', RLS_CONTEXT, 'return await systemDb.transaction(async (tx) => {', 'withSystemContext'),
      a.sch('tenantScope', RLS_0108, "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row"),
      a.h('mutation', 'return NextResponse.json({ data: analytics })'),
      a.h('privacy', 'organizationName: org.name,'),
      a.h('defect', "sql`SELECT coalesce(avg(EXTRACT(EPOCH FROM (coalesce(resolved_at, closed_at) - created_at)) / 86400)::int, 0) AS avg_days"),
      a.h('defect', 'const memberGrowthRate = prev > 0 ? ((mem.total - prev) / prev) * 100 : mem.total > 0 ? 100 : 0'),
      a.h('defect', 'GROUP BY status`,'),
      a.tbl('defect', 'organizations', /memberCount: integer\('member_count'\)/),
    ],
    inf: [{ claim: 'defect', statement: 'The member statements carry no deleted_at condition, so soft-deleted roster rows count toward total members and the growth figures.' }],
    def: [
      'DEF-0B9-ORG-ANALYTICS-ANY-SIGNED-IN-USER-READS-ANY-ORGANIZATION-NAME-TYPE-CHILD-COUNT-AND-AGGREGATES-BY-PATH-ID',
      'DEF-0B9-ORG-ANALYTICS-METRIC-QUERIES-RUN-IN-SESSION-ORGANIZATION-CONTEXT-FILTERED-BY-PATH-ID-RETURNING-ZEROS',
      'DEF-0B9-ORG-ANALYTICS-ZERO-AND-HUNDRED-PERCENT-DEFAULTS-MEMBER-FLOOR-AND-NO-GROUP-SIZE-SUPPRESSION',
      'DEF-0B9-ORG-HIERARCHY-ROUTES-PASS-UNVALIDATED-PATH-ID-TO-UUID-COLUMN-AND-ANSWER-EMPTY-200-FOR-UNKNOWN-ORGANIZATION',
    ],
    corr: [],
  })
}

function rowFacadeFacts(a, readText, kind) {
  const model = crudModel(a, readText)
  const logs = kind === 'access-logs'
  const method = a.method
  const isRead = method === 'GET'
  const floor = isRead ? model.readRole : method === 'DELETE' ? 'admin' : model.writeRole
  const effectiveRead = logs ? 'steward (member floor raised by the low-role guard)' : 'admin'
  const label = logs ? 'access log' : 'sharing settings'
  const route = `${API}organizations/[id]/${kind}/route.ts`
  const common = [
    a.h('authentication', `export const ${method} = requireOwnOrganizationItem('id', raw${method});`),
    a.h('authorization', `export const ${method} = requireOwnOrganizationItem('id', raw${method});`),
    a.imp('authentication', 'requireOwnOrganizationItem', 'const user = await getCurrentUser();'),
    a.imp('authorization', 'requireOwnOrganizationItem', 'if (!ownOrgId || requestedId !== ownOrgId) {'),
    a.imp('tenantScope', 'requireOwnOrganizationItem', 'const ownOrgId = await getOrganizationIdForUser(user.id);'),
    a.svc('tenantScope', CRUD_FACTORY, 'if (orgScoped && orgCol && organizationId) {'),
    a.tbl('tenantScope', 'organizations', /pgTable\(/, { absentColumns: ['organizationId'] }),
    a.sch('scope', CRUD_GOVERNANCE, GOVERNANCE_LIST_QUOTE),
    a.sch('scope', SHARING_SCHEMA, logs ? 'export const crossOrgAccessLog = pgTable("cross_org_access_log", {' : 'export const organizationSharingSettings = pgTable("organization_sharing_settings", {'),
  ]
  const readDefects = [
    logs
      ? 'DEF-0B9-ORG-ACCESS-LOGS-ROUTE-IS-ORGANIZATIONS-ROW-CRUD-NOT-A-CROSS-ORGANIZATION-ACCESS-LOG'
      : 'DEF-0B9-ORG-SHARING-SETTINGS-ROUTE-IS-ORGANIZATIONS-ROW-CRUD-NOT-SHARING-SETTINGS',
  ]
  const base = {
    service: `${CRUD_FACTORY} (crudRoutes over organizations, wrapped by requireOwnOrganizationItem)`,
    authn: `${SESSION} (requireOwnOrganizationItem calls getCurrentUser, 401 otherwise; the factory then requires a session through withApi).`,
    gate: GATE,
    deps: [1, 13],
    future: future.sharing,
    dec: [D_ORG_SHARING, ...(logs ? [D_AUDIT_READERS] : [])],
    crudTable: model.sql,
    crudClass: model.governance,
  }
  if (isRead) {
    return mk({
      ...base,
      persona: logs
        ? 'Steward or above of an organization opening the access log tab and receiving the organization row instead'
        : 'Administrator of an organization opening the sharing settings page and receiving the organization row instead',
      authz: `The wrapper requires the path id to equal the caller own organization id (403 otherwise); the factory then requires the ${floor} role floor (${effectiveRead} in effect), and the low-role guard refuses a caller below steward because organizations has email, phone and address columns. A role title is not a kernel decision.`,
      tenant: 'The path id must equal the organization of the caller (requireOwnOrganizationItem), which closes the cross-organization read; orgScoped is false and organizations has no organization_id column, so the factory adds no predicate of its own and the row returned is the organizations row of that id.',
      owner: `organizations row of the own organization; the ${label} table (${logs ? 'cross_org_access_log' : 'organization_sharing_settings'}) is not read.`,
      sens: 'The whole organizations row: name, contacts, charter number, subscription tier, billing contact id, settings JSON, enabled features, member counts, creator id',
      priv: `A caller at or above ${effectiveRead} receives the whole organizations row of their own organization as {data: row} under the name of an ${label}; no ${label} record is returned and no other organization row is reachable.`,
      mut: 'NOT_MUTATING',
      auditDetail: 'A read: the factory writes no row and no audit record.',
      reqAudit: `Reads of the ${label} need no audit record until a route that returns it exists; the cross-organization access log itself must be written when another organization reads a resource.`,
      does: `Answers the own-organization check, then returns the organizations row of the path id at the ${floor} role floor (the low-role guard raises the effective floor), whatever filters or paging the ${logs ? 'access log viewer' : 'sharing settings page'} sends; neither ${logs ? 'cross_org_access_log' : 'organization_sharing_settings'} is read.`,
      status: 'FACADE_OVER_GENERIC_TABLE',
      ev: [
        ...common,
        a.svc('behavior', CRUD_FACTORY, 'assertCrudRead(governance);'),
        a.svc('mutation', CRUD_FACTORY, 'const [row] = await db.select().from(table).where(and(...conditions));'),
        a.sch('privacy', LOW_ROLE, "return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }"),
        a.tbl('privacy', 'organizations', /billingContactId: uuid\('billing_contact_id'\)/),
        a.tbl('defect', 'organizations', /settings: jsonb\('settings'\)/),
        a.sch('defect', SHARING_SCHEMA, logs ? 'resourceOrganizationId: uuid("resource_organization_id").notNull(),' : 'allowFederationSharing: boolean("allow_federation_sharing").default(false),'),
      ],
      inf: [
        logs
          ? { claim: 'defect', statement: 'The access log viewer component sends page, pageSize, resourceType, accessType, fromDate and toDate and reads data.logs, data.pagination and data.stats from the response; the route returns {data: row} and reads none of those parameters.' }
          : { claim: 'defect', statement: 'The sharing settings form sends PUT to this path, and the route file exports GET, PATCH and DELETE only, so the form request is answered by the framework with 405.' },
      ],
      def: [...readDefects, 'DEF-0B9-ORG-ORGANIZATION-ROW-FACADES-RETURN-WHOLE-ORGANIZATION-ROW-AT-STEWARD-OR-ADMIN-FLOOR'],
      corr: [],
    })
  }
  return mk({
    ...base,
    persona: logs
      ? `${method === 'PATCH' ? 'Steward' : 'Administrator'} of an organization calling the ${method} that the access-logs route configures over the organizations table`
      : `Administrator of an organization calling the ${method} that the sharing-settings route configures over the organizations table`,
    authz: `The wrapper requires the path id to equal the caller own organization id; the factory then requires the ${floor} role floor; assertCrudWrite then refuses the write because organizations is READ_ONLY in the CRUD governance table. A role title is not a kernel decision.`,
    tenant: 'The path id must equal the organization of the caller (requireOwnOrganizationItem); orgScoped is false and organizations has no organization_id column, so the factory adds no predicate of its own; no row is reached because the write is refused first.',
    owner: `organizations row of the own organization; the ${label} table is not written.`,
    sens: method === 'PATCH' ? 'Any column of the organizations row the body names (parent, status, settings, slug)' : 'Lifecycle status of the organization',
    priv: 'Nothing is stored or returned: the write is refused with 403 before any row or audit record is written.',
    mut: 'WRITE_REFUSED_BY_GOVERNANCE',
    auditDetail: 'organizations is READ_ONLY in the CRUD governance table, so assertCrudWrite refuses the write with 403 before any row or audit record is written; nothing is mutated and nothing is audited.',
    reqAudit: `No audit record is required for a refused write; the ${label} are changed through a dedicated route that commits its audit record in the same transaction as the row.`,
    does: `Applies the own-organization check and answers 403 at the ${floor} role floor: assertCrudWrite refuses the READ_ONLY organizations table before any update or delete. The configured ${method === 'PATCH' ? 'PATCH would take any body column of the organizations row' : 'DELETE would archive the organization'} if the governance entry changed.`,
    status: 'LATENT_NOT_OPERATIONAL',
    ev: [
      ...common,
      a.svc('mutation', CRUD_FACTORY, 'assertCrudWrite(governance);'),
      a.sch('audit', CRUD_GOVERNANCE, 'export function assertCrudWrite'),
      a.sch('defect', CRUD_GOVERNANCE, "const READ_ONLY = ["),
      ...(method === 'PATCH'
        ? [a.svc('defect', CRUD_FACTORY, /\.update\(table\)/), a.tbl('defect', 'organizations', /parentId: uuid\('parent_id'\)/)]
        : [a.svc('defect', CRUD_FACTORY, ".set({ status: 'archived', updatedAt: new Date() } as Record<string, unknown>)")]),
    ],
    inf: [],
    def: [...readDefects, 'DEF-0B9-ORG-ORGANIZATION-ROW-FACADES-CONFIGURE-STEWARD-WRITES-OVER-ORGANIZATIONS-REFUSED-ONLY-BY-GOVERNANCE-LIST'],
    corr: [{ field: 'audit', manifest: 'audit CRUD_ATOMIC', actual: 'organizations is READ_ONLY, so the write is refused before any row or audit record is written.' }],
  })
}

export const RISK_SCREENS = {}

export function facts(a, readText) {
  const record = applyCrossTenantExposure(build(a, readText), DEFECTS)
  record.riskScreen = RISK_SCREENS[`${a.route}|${a.method}`] ?? {}
  return record
}

function build(a, readText) {
  const { route, method } = a
  switch (route) {
    case 'org/current/route.ts': return orgCurrentFacts(a)
    case 'organizations/current/route.ts': return organizationsCurrentFacts(a)
    case 'organizations/[id]/route.ts':
      return method === 'GET' ? itemGet(a) : method === 'PATCH' ? itemPatch(a) : itemDelete(a)
    case 'organizations/[id]/members/route.ts': return method === 'GET' ? rosterGet(a) : rosterPost(a)
    case 'organization/members/route.ts': return directoryFacts(a, 'list')
    case 'organization/members/search/route.ts': return directoryFacts(a, 'search')
    case 'organizations/[id]/ancestors/route.ts': return ancestorsFacts(a)
    case 'organizations/[id]/children/route.ts': return childrenFacts(a)
    case 'organizations/[id]/descendants/route.ts': return descendantsFacts(a)
    case 'organizations/hierarchy/route.ts': return hierarchyListFacts(a)
    case 'organizations/[id]/path/route.ts': return pathFacts(a)
    case 'organizations/[id]/analytics/route.ts': return analyticsFacts(a)
    case 'organizations/[id]/access-logs/route.ts': return rowFacadeFacts(a, readText, 'access-logs')
    case 'organizations/[id]/sharing-settings/route.ts': return rowFacadeFacts(a, readText, 'sharing-settings')
    default: throw new Error(`no organizations facts for ${route}`)
  }
}
