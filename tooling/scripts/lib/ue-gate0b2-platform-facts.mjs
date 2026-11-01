/**
 * Gate 0B.2 facts for the platform, member-access, agreement and operator routes that are neither generic CRUD
 * nor AI. Each fact was read from the cited file.
 */
import { APP, ev, routeEv, appEv, NOT_ATOMIC, GET_CORR } from './ue-gate0b2-fact-helpers.mjs'

const REVOCATION = appEv('lib/services/member-access-revocation-service.ts', "await withMemberAuthMutation(input, 'revoke-sessions'")
const REVOCATION_AUDIT = appEv('lib/services/member-access-revocation-service.ts', 'await persistAtomicAudit(')

export const PLATFORM_ROUTES = new Set([
  'admin/stats/activity/route.ts|GET',
  'admin/stats/overview/route.ts|GET',
  'admin/users/route.ts|GET',
  'admin/users/[userId]/route.ts|PUT',
  'admin/users/[userId]/route.ts|DELETE',
  'agreements/route.ts|GET',
  'agreements/route.ts|POST',
  'analytics/cross-org/route.ts|GET',
  'ai/cache-stats/route.ts|GET',
  'ai/cache-stats/route.ts|POST',
])

const CROSS_TENANT = (what) => ({
  crossTenantExposure: true,
  crossTenantAuthorized: false,
  exposureContract: `${what} No adopted decision authorizes the read; it is recorded as an implementation defect owned by the enumeration capability, not as authorized access.`,
})

const READ = { mutationAudit: 'NOT_MUTATING', auditDetail: 'A read; nothing written and no read audit is recorded.', implementationStatus: 'IMPLEMENTED_IN_SOURCE' }

const FACTS = {
  'admin/stats/activity/route.ts|GET': {
    persona: 'Platform lead', serviceOwner: `${APP}app/api/admin/stats/activity/route.ts (inline query)`,
    authenticationMechanism: 'Entra session via withApi (auth.required true).',
    authorizationCategory: 'PLATFORM_ROLE_FLOOR', authorizationDetail: "withApi minRole 'platform_lead': a role-title check, not a platform mandate.",
    tenantScope: 'Cross-organization: recent organization_members joined to organizations with no organization predicate.',
    dataOwnership: 'organization_members rows owned by each member organization.', dataSensitivity: 'Member name, email and role with organization name',
    privacyDisclosure: 'Member name and email of every organization leave their organization to any caller at the platform_lead role title.',
    ...READ,
    implementedBehavior: 'Returns the most recently added members across all organizations as an activity feed.',
    requiredGate: 14, requiredFutureGuard: 'Authorize by a platform-staff mandate, withhold personal data the reader does not need and audit the read.',
    evidence: [routeEv('admin/stats/activity/route.ts', "auth: { required: true, minRole: 'platform_lead' }"), routeEv('admin/stats/activity/route.ts', '.leftJoin(organizations,'), routeEv('admin/stats/activity/route.ts', 'email: organizationMembers.email,')],
    defects: ['DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'], manifestCorrections: [],
    decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'],
    ...CROSS_TENANT('Reads member names and emails across organizations at a platform_lead role title.'),
  },
  'admin/stats/overview/route.ts|GET': {
    persona: 'Platform lead', serviceOwner: `${APP}app/api/admin/stats/overview/route.ts (inline queries)`,
    authenticationMechanism: 'Entra session via withApi (auth.required true).',
    authorizationCategory: 'PLATFORM_ROLE_FLOOR', authorizationDetail: "withApi minRole 'platform_lead': a role-title check, not a platform mandate.",
    tenantScope: 'Cross-organization aggregate counts plus the size of the shared database (withSystemContext).',
    dataOwnership: 'Aggregate counts over organization_members and organizations; database size is platform data.', dataSensitivity: 'Aggregate counts and database size',
    privacyDisclosure: 'Counts only; no member personal data is returned. Database size is platform topology.',
    ...READ,
    implementedBehavior: 'Returns total members, organizations, active organizations, database size and members active in the last 24 hours across all organizations.',
    requiredGate: 14, requiredFutureGuard: 'Authorize by a platform-staff mandate.',
    evidence: [routeEv('admin/stats/overview/route.ts', "auth: { required: true, minRole: 'platform_lead' }"), routeEv('admin/stats/overview/route.ts', 'pg_database_size(current_database())')],
    defects: ['DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'], manifestCorrections: [],
    decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'],
    ...CROSS_TENANT('Reads aggregate member and organization counts and database size across organizations at a platform_lead role title.'),
  },
  'admin/users/route.ts|GET': {
    persona: 'Platform lead', serviceOwner: `${APP}app/api/admin/users/route.ts (inline query)`,
    authenticationMechanism: 'Entra session via withApi (auth.required true).',
    authorizationCategory: 'PLATFORM_ROLE_FLOOR', authorizationDetail: "withApi minRole 'platform_lead': a role-title check, not a platform mandate.",
    tenantScope: 'Cross-organization: up to 100 organization_members rows, searchable by name or email, with no organization predicate.',
    dataOwnership: 'organization_members rows owned by each member organization.', dataSensitivity: 'Member name, email, role, status and organization',
    privacyDisclosure: 'Member name, email and role of any organization can be searched by name or email at a role title.',
    ...READ,
    implementedBehavior: 'Lists up to 100 members across all organizations, filtered by an optional name or email search.',
    requiredGate: 14, requiredFutureGuard: 'Authorize by a platform-staff mandate, scope the search and audit the read.',
    evidence: [routeEv('admin/users/route.ts', "auth: { required: true, minRole: 'platform_lead' }"), routeEv('admin/users/route.ts', 'ilike(organizationMembers.email, pattern),'), routeEv('admin/users/route.ts', '.limit(100)')],
    defects: ['DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'], manifestCorrections: [],
    decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'],
    ...CROSS_TENANT('Searches member names and emails across organizations at a platform_lead role title.'),
  },
  'admin/users/[userId]/route.ts|PUT': memberAccess('PUT'),
  'admin/users/[userId]/route.ts|DELETE': memberAccess('DELETE'),
  'agreements/route.ts|GET': {
    persona: 'Organization member reading the organization collective agreements', serviceOwner: `${APP}app/api/agreements/route.ts`,
    authenticationMechanism: 'Entra session via withApi (auth.required true).',
    authorizationCategory: 'ROLE_FLOOR', authorizationDetail: "withApi minRole 'member': any active member reads every agreement of the organization.",
    tenantScope: 'collectiveAgreements.organizationId equals the session organization, under withRLSContext.',
    dataOwnership: 'collective_agreements rows owned by the organization.', dataSensitivity: 'Collective agreement terms, employer and bargaining unit descriptions',
    privacyDisclosure: 'Agreement rows, including those with isPublic false, are returned to every member of the organization.',
    ...READ,
    implementedBehavior: 'Lists, searches and pages the collective agreements of the caller organization.',
    requiredGate: 10, requiredFutureGuard: 'Decide which personas may read which agreements and apply that decision through a kernel resource check.',
    evidence: [routeEv('agreements/route.ts', "auth: { required: true, minRole: 'member' }"), routeEv('agreements/route.ts', 'eq(collectiveAgreements.organizationId, organizationId)')],
    defects: [], manifestCorrections: [], decisions: [],
  },
  'agreements/route.ts|POST': {
    persona: 'Steward or above registering a collective agreement', serviceOwner: `${APP}app/api/agreements/route.ts`,
    authenticationMechanism: 'Entra session via withApi (auth.required true).',
    authorizationCategory: 'ROLE_FLOOR', authorizationDetail: "withApi minRole 'steward': a role-title check; the agreement is not tied to a mandate.",
    tenantScope: 'The inserted row carries the session organizationId under withRLSContext.',
    dataOwnership: 'collective_agreements rows owned by the organization.', dataSensitivity: 'Collective agreement terms, employer and bargaining unit descriptions',
    privacyDisclosure: 'The row is created with isPublic false; publishing beyond the organization is not decided at creation.',
    mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION', auditDetail: "The insert and persistAtomicAudit (action 'agreement.create') run in one withRLSContext transaction.",
    implementedBehavior: 'Inserts a collective agreement from an unvalidated request body, checking only the status value.',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    requiredGate: 13, requiredFutureGuard: 'Validate the body with a schema and authorize creation by a kernel resource check.',
    evidence: [routeEv('agreements/route.ts', "auth: { required: true, minRole: 'steward' }"), routeEv('agreements/route.ts', 'const body = await request.json();'), routeEv('agreements/route.ts', "action: 'agreement.create',"), routeEv('agreements/route.ts', 'await persistAtomicAudit(tx, {')],
    defects: ['DEF-0B2-AGREEMENTS-BODY-UNVALIDATED'], manifestCorrections: [], decisions: ['UE-INST-KNOWLEDGE-PUBLICATION'],
  },
  'analytics/cross-org/route.ts|GET': {
    persona: 'Platform lead', serviceOwner: `${APP}app/api/analytics/cross-org/route.ts`,
    authenticationMechanism: 'Entra session via withApi (auth.required true).',
    authorizationCategory: 'PLATFORM_ROLE_FLOOR', authorizationDetail: "withApi minRole 'platform_lead': a role-title check, not a platform mandate.",
    tenantScope: 'Reads analytics_metrics with no organization predicate through the global db handle inside withRLSContext called with no organization. Which rows tenant security returns is not shown by this route.',
    dataOwnership: 'analytics_metrics rows owned by each organization.', dataSensitivity: 'Aggregated metric values grouped across organizations',
    privacyDisclosure: 'The response is aggregate only (dataClass aggregate_only, rawRowsExposed false); the grouping spans organizations.',
    ...READ,
    implementedBehavior: 'Aggregates up to 1000 recent analytics_metrics rows by metric type across organizations and returns only the aggregate.',
    requiredGate: 14, requiredFutureGuard: 'Authorize by a platform-staff mandate and prove the organization scope the read actually has.',
    evidence: [routeEv('analytics/cross-org/route.ts', "auth: { required: true, minRole: 'platform_lead' }"), routeEv('analytics/cross-org/route.ts', '.limit(1000);'), routeEv('analytics/cross-org/route.ts', 'rawRowsExposed: false')],
    defects: ['DEF-0B2-CROSS-ORG-ANALYTICS-SCOPE-UNPROVEN', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'], manifestCorrections: [],
    decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'],
    ...CROSS_TENANT('Aggregates metrics across organizations at a platform_lead role title; the aggregate-only response limits disclosure but does not authorize the read.'),
  },
  'ai/cache-stats/route.ts|GET': {
    persona: 'Organization administrator reading platform embedding-cache statistics', serviceOwner: `${APP}app/api/ai/cache-stats/route.ts`,
    authenticationMechanism: 'Entra session via withAdminAuth.',
    authorizationCategory: 'ROLE_FLOOR', authorizationDetail: 'withAdminAuth: an organization administrator role-title check on platform-wide cache statistics.',
    tenantScope: 'Platform-wide: the embedding cache is shared and the route applies no organization predicate.',
    dataOwnership: 'The shared embedding cache, a platform resource.', dataSensitivity: 'Cache hit rate and key counts',
    privacyDisclosure: 'Operational statistics only.',
    ...READ,
    implementedBehavior: 'Returns embedding-cache statistics and logs the view.',
    requiredGate: 13, requiredFutureGuard: 'Authorize by a platform-staff mandate.',
    evidence: [routeEv('ai/cache-stats/route.ts', 'export const GET = withAdminAuth('), routeEv('ai/cache-stats/route.ts', 'await embeddingCache.getStats()')],
    defects: ['DEF-0B2-AI-CACHE-PLATFORM-WIDE-ORG-ADMIN', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'], manifestCorrections: [], decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'],
  },
  'ai/cache-stats/route.ts|POST': {
    persona: 'Platform administrator clearing or resetting the shared embedding cache', serviceOwner: `${APP}app/api/ai/cache-stats/route.ts`,
    authenticationMechanism: 'Entra session via withSystemAdminAuth.',
    authorizationCategory: 'PLATFORM_ADMIN_IDENTITY', authorizationDetail: 'withSystemAdminAuth: a platform-administrator identity check.',
    tenantScope: 'Platform-wide: clearing the cache removes cached embeddings for every organization.',
    dataOwnership: 'The shared embedding cache, a platform resource.', dataSensitivity: 'Cached embeddings',
    privacyDisclosure: 'None returned beyond a deleted-key count.',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', auditDetail: "Wrapped in performAuditedOperation ('ai.embedding_cache.<action>'); the cache lives outside the database, so the audit record is not committed with the effect.",
    implementedBehavior: 'Clears the embedding cache or resets its statistics after recording intent.',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    requiredGate: 9, requiredFutureGuard: 'Authorize by a platform-staff mandate.',
    evidence: [routeEv('ai/cache-stats/route.ts', 'export const POST = withSystemAdminAuth('), routeEv('ai/cache-stats/route.ts', 'action: `ai.embedding_cache.${action}`,'), routeEv('ai/cache-stats/route.ts', 'performAuditedOperation(')],
    defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'], manifestCorrections: [NOT_ATOMIC], decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'],
  },
}

function memberAccess(method) {
  const reactivates = method === 'PUT'
  return {
    persona: 'Platform administrator deactivating, reactivating or removing a member membership', serviceOwner: `${APP}lib/services/member-access-revocation-service.ts`,
    authenticationMechanism: 'Entra session resolved in the handler with auth().',
    authorizationCategory: 'PLATFORM_ADMIN_IDENTITY', authorizationDetail: 'isPlatformAdminUser(callerId): a platform-administrator identity check made before any system-context work. The manifest calls it SESSION_ONLY.',
    tenantScope: 'The target is a membership row id resolved under withSystemContext; the caller is not confined to an organization.',
    dataOwnership: 'organization_members rows plus platform-auth sessions and memberships, held in separate stores.',
    dataSensitivity: 'Member access state; target auth user id',
    privacyDisclosure: 'No personal data is returned; the 502 body lists failed revocation steps.',
    mutationAudit: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
    auditDetail: reactivates
      ? 'Toggles between deactivate and reactivate. Deactivation commits the local status change and persistAtomicAudit together; sessions and the platform-auth membership change in other stores. Reactivation records a reactivate_attempt audit and a result audit in separate system transactions.'
      : 'Soft-deletes the membership and commits the local change with persistAtomicAudit; sessions and the platform-auth membership are revoked in other stores before it.',
    implementedBehavior: reactivates
      ? 'Toggles a membership between active and inactive; deactivation revokes sessions and disables the auth membership, and reactivation re-enables it. A failed step returns HTTP 502.'
      : 'Revokes sessions, disables the auth membership and soft-deletes the local membership. A failed step returns HTTP 502.',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    requiredGate: 1, requiredFutureGuard: 'Authorize by a platform-staff mandate and prove every kernel record type denies after revocation.',
    evidence: [routeEv('admin/users/[userId]/route.ts', 'isPlatformAdminUser(callerId)'), routeEv('admin/users/[userId]/route.ts', 'await revokeMemberAccess({'), REVOCATION, REVOCATION_AUDIT],
    defects: ['DEF-0B2-REVOCATION-MULTI-STORE', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [
      { field: 'guard', manifest: 'SESSION_ONLY', actual: 'The handler checks isPlatformAdminUser(callerId) and returns 403 otherwise.' },
      { field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'The audit record commits atomically with the local status update only; session revocation and the auth membership change happen in separate stores.' },
    ],
    decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'],
  }
}

export function platformFacts(id) {
  const facts = FACTS[id]
  if (!facts) throw new Error(`no platform facts for ${id}`)
  const out = { ...facts }
  out.institutionalDecisions = out.decisions ?? []
  delete out.decisions
  return out
}

void ev
void GET_CORR
