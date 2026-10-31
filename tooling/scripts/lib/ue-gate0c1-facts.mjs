/**
 * Gate 0C.1 facts: the two operations of `app/api/reviews/route.ts` that the route-coverage manifest had omitted. Every
 * evidence item is produced by `opAuthoring` from the exact handler, the helper or service it calls, or the migration
 * that creates the table, and is proved again by the validator. This tranche records the source; it repairs nothing,
 * approves no access and adopts no institutional decision. Ownership is accountability, not authorization.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { APP, GET_CORR } from './ue-gate0b4-fact-helpers.mjs'

export const REVIEW_CAP = 'UE-CAP-REVIEW-INTAKE'
const GATE = 12

const STORE = `${APP}lib/authority/store/review-intake.ts`
const WORKFLOW = `${APP}lib/authority/store/workflow.ts`
const AUDIT = `${APP}lib/authority/store/audit.ts`
const EXECUTOR = `${APP}lib/authority/store/executor.ts`
const MIGRATION_TABLE = `${APP}db/migrations-platform/0013_authority_kernel_storage.sql`
const MIGRATION_RLS = `${APP}db/migrations-cache/0020_authority_kernel_rls_closure.sql`
const STORAGE_MANIFEST = `${APP}db/rls-storage-authority/authority-kernel.ts`

export const ROUTES = new Set(['reviews/route.ts'])

export const GROUPS = {
  MEMBER_REVIEW_INTAKE: {
    capabilityId: REVIEW_CAP,
    domain: 'MEMBER_REVIEW_INTAKE_AND_OVERSIGHT_LIST',
    actor: 'Active member opening a complaint, appeal or reconsideration and reading the reviews they opened or filed, and a governance officer holding a live review:monitor mandate reading the reviews that mandate names',
    routes: ['reviews/route.ts'],
    methods: ['GET', 'POST'],
    evidence: [
      { kind: 'file', ref: 'apps/union-eyes/app/api/reviews/route.ts', quote: ' *   POST — the same member opens a complaint, appeal or reconsideration.' },
      { kind: 'file', ref: 'apps/union-eyes/lib/authority/store/review-intake.ts', quote: ' * Any active member may open a complaint, appeal or reconsideration. The opener' },
      { kind: 'file', ref: 'apps/union-eyes/lib/authority/review-intake-types.ts', quote: "export const REVIEW_INTAKE_TYPES = ['complaint', 'appeal', 'reconsideration'] as const" },
    ],
  },
}

export const DECISIONS = []

export const CAPABILITIES = []

const D = (id, severity, title, extra = {}) => ({ id, ownerCapabilityId: REVIEW_CAP, gate: GATE, severity, title, ...extra })

const RLS_ORG_ONLY = 'DEF-0C1-REV-REVIEW-ROWS-ARE-PROTECTED-BY-AN-ORGANIZATION-ONLY-RLS-POLICY-SO-ADVERSE-PARTY-COMPLAINANT-AND-PRIVILEGE-CONFIDENTIALITY-IS-APPLICATION-CODE-ONLY'
const ADVERSE_UNVERIFIED = 'DEF-0C1-REV-ADVERSE-PARTY-IDS-ARE-CHECKED-FOR-SHAPE-ONLY-AND-NEVER-AGAINST-ORGANIZATION-MEMBERSHIP'
const POST_UNBOUNDED = 'DEF-0C1-REV-POST-HAS-NO-RATE-LIMIT-OR-IDEMPOTENCY-AND-EVERY-CALL-WRITES-A-PERMANENT-APPEND-ONLY-REVIEW-AND-AUDIT-ROW'
const BODY_UNCAPPED = 'DEF-0C1-REV-POST-READS-AN-UNCAPPED-REQUEST-BODY-BEFORE-ITS-SCHEMA-BOUNDS-APPLY'
const ORG_TWICE = 'DEF-0C1-REV-THE-ROUTE-RESOLVES-ITS-ORGANIZATION-ONCE-AND-THE-DATABASE-CONTEXT-RESOLVES-IT-AGAIN-WITH-NO-COMPARISON'
const UNHANDLED = 'DEF-0C1-REV-FAILURES-OUTSIDE-THE-STORE-AND-CASE-AUTHORIZATION-ERRORS-ARE-RETHROWN-UNLOGGED-AS-AN-UNSTRUCTURED-SERVER-ERROR'
const OVERSIGHT_UNAUDITED = 'DEF-0C1-REV-THE-OVERSIGHT-LIST-RETURNS-COMPLAINANT-IDENTITY-AND-PRIVILEGED-CLASSIFICATION-WITH-NO-ACCESS-RECORD'

export const DEFECTS = [
  D(RLS_ORG_ONLY, 'MEDIUM',
    'ue_authority_reviews holds the complainant, the adverse parties and the privileged classification of every review of an organization, and the only row-level-security policy on it is the organization-only policy ue_create_direct_org_rls_policy (migration 0020) while the storage-authority manifest requires SELECT on the table for the tenant runtime role; the rules that hide a review from its adverse party, show an overseer only the reviews a live monitor mandate names, and omit respondent identifiers are SQL predicates and kernel calls inside lib/authority/store/review-intake.ts, so any other query that runs in an organization context can read every review of the organization and the database enforces none of those rules.'),
  D(ADVERSE_UNVERIFIED, 'MEDIUM',
    'POST /api/reviews accepts up to eight adverseUserIds and normaliseAdverse tests each only with isPrincipalId (a non-empty string of at most 255 characters with no control character) plus a self and duplicate check; registerReview then stores them in adverse_user_ids with no lookup showing that the named person is a member of the organization, no trigger checks them (the actor trigger guards opened_by only), and the own-list query excludes a stored adverse id and the kernel decideReview denies oversight to it (ADVERSE_PARTY: respondent cannot exercise oversight), so a complainant decides, by an unverified assertion, which person is excluded from seeing the review and from overseeing it.'),
  D(POST_UNBOUNDED, 'MEDIUM',
    'POST /api/reviews applies no rate limit of its own, never reads the idempotency key and never uses the ue_authority_requests idempotency store, and the table declares no uniqueness over the opener, type and adverse parties, so every call by an active member inserts a new review, the authority event row the trigger records and a canonical audit row; ue_authority_reviews is append-only (a trigger refuses DELETE and TRUNCATE), so a member or a script can create an unbounded number of permanent review rows that no route or retry path can remove.'),
  D(BODY_UNCAPPED, 'LOW',
    'POST /api/reviews reads the body with request.json() before openSchema.safeParse, so the schema limits (reviewType enum, eight adverse ids, 255 characters each) apply only after the whole body has been buffered and parsed; the route sets no body-size cap and imports no public-intake or size guard.'),
  D(ORG_TWICE, 'LOW',
    'The route takes the organization from getOrganizationIdForUser (the selected-organization cookie checked against active membership) and passes it to the store as the explicit organizationId, but calls withRLSContext(async (tx) => ...) with no context map, so outside the canonical-state mode the transaction binds app.current_org_id from the organization on the auth session or user metadata (orgId = authOrgId) instead; withRLSContext documents that only an explicit { organizationId } enforces exactly one organization, and the route never compares its two resolutions, so a disagreement surfaces only as an empty result or as a database error that the route rethrows.'),
  D(UNHANDLED, 'LOW',
    'reviewErrorResponse answers only AuthorityStoreError and the case-authorization errors; any other failure (a database or row-level-security error, the Unauthorized error withRLSContext throws, a binding error) is rethrown with `throw error` from a route that has no wrapper, so the caller receives the framework default server error with no structured body, and the route neither logs nor audits the failure.'),
  D(OVERSIGHT_UNAUDITED, 'LOW',
    'GET /api/reviews returns, for each review a live monitor mandate allows, complainantUserId and the standard or privileged classification, and listMemberReviewIntake calls the pure kernel decide for review:monitor and writes no record of the read; the decision, the mandate that supplied it and the reviews disclosed are not stored, so an oversight read of complainant identity cannot be reconstructed afterwards.'),
]

const base = (a) => ({
  service: `${STORE} (listMemberReviewIntake, openMemberReview) through drizzleExecutor on the withRLSContext transaction`,
  authn: 'Entra session read in the route (auth()), then an active organization membership required by the store.',
  gate: GATE,
  deps: [10, 1],
  corr: [],
})

const SENS = 'Review type, status and opening time of the reviews a member opened or filed; for an overseer also the complainant user id and the standard or privileged classification of each reviewed matter; for the opener the adverse party ids they name.'

function reviewsGet(a) {
  return mk({
    ...base(a),
    persona: 'Active member reading the reviews they opened or filed, and governance officer reading the reviews a live review:monitor mandate names',
    cat: 'SESSION_ONLY',
    authz: 'Session plus an active membership: the own list is limited by SQL predicate to rows the member opened or filed and excludes any row naming them adverse; the oversight list is built only from the review ids of the principal\'s live governance_review mandates with the monitor power and each row is kept only when the pure kernel decide returns allow for review:monitor. A membership check is not a kernel decision for the own list, so kernelAuthorization stays false for the operation.',
    tenant: 'The route passes the organization resolved by getOrganizationIdForUser to the store, whose SELECTs are conditioned on organization_id; the transaction runs under withRLSContext. The only RLS policy on the table is the organization-only policy, so the per-member and per-mandate limits are application predicates.',
    owner: 'ue_authority_reviews rows of the session organization; the response is derived data and creates no row.',
    sens: SENS,
    priv: 'Own reviews return id, type, status, opening time and whether the member opened or is complainant; oversight reviews also return complainantUserId and the classification; respondent and adverse identifiers are not returned. The response states that no notice is delivered and no notification policy is adopted.',
    mut: 'NOT_MUTATING',
    nonMutationReason: 'The GET handler only reads the review table and the authority facts and returns the two lists.',
    auditDetail: 'No audit row is written for the read; the oversight disclosure of complainant identity and privileged classification is not recorded.',
    reqAudit: 'Record each oversight read with the mandate that authorized it and the review ids disclosed.',
    does: 'Resolves the session user and organization, binds the session actor, requires an active membership, selects the reviews the member opened or filed (excluding rows that name them adverse), loads their authority facts, selects the reviews named by live monitor mandates, keeps each one the kernel allows for review:monitor and returns both lists with the not-adopted notification marker.',
    status: 'PARTIAL',
    future: 'Add a per-member row policy or a security-definer read path so the database enforces the adverse-party and mandate limits, verify one organization for the route and the transaction, and record each oversight disclosure with its mandate.',
    dec: [],
    corr: [GET_CORR('ATOMIC_SERVICE')],
    ev: [
      a.local('authentication', 'actor', 'const { userId } = await auth()'),
      a.local('authentication', 'actor', 'if (!userId) throw ApiError.unauthorized()'),
      a.local('authorization', 'actor', 'if (!organizationId) throw ApiError.forbidden()'),
      a.imp('authorization', 'listMemberReviewIntake', 'await requireActiveMember(exec, deps, input.organizationId, input.actorUserId)'),
      a.imp('authorization', 'listMemberReviewIntake', "action: 'review:monitor',"),
      a.imp('authorization', 'listMemberReviewIntake', "if (decide(request, facts, resource, now).effect !== 'allow') continue"),
      a.imp('authorization', 'listMemberReviewIntake', 'AND NOT ($2 = ANY(adverse_user_ids))'),
      a.h('tenantScope', 'const list = await withRLSContext(async (tx) =>'),
      a.h('tenantScope', 'listMemberReviewIntake(drizzleExecutor(tx), kernelDeps, { organizationId: who.organizationId, actorUserId: who.userId }),'),
      a.imp('tenantScope', 'listMemberReviewIntake', 'WHERE organization_id = $1::uuid'),
      a.sch('tenantScope', MIGRATION_RLS, "SELECT ue_create_direct_org_rls_policy('ue_authority_reviews');"),
      a.imp('mutation', 'listMemberReviewIntake', 'return { own, oversight, ...NOTIFICATION }'),
      a.imp('privacy', 'listMemberReviewIntake', 'complainantUserId: resource.complainantUserId ?? null,'),
      a.imp('behavior', 'listMemberReviewIntake', "participation: String(row.opened_by) === input.actorUserId ? 'opened' : 'complainant',"),
      a.h('defect', 'return reviewErrorResponse(error)'),
      a.local('defect', 'reviewErrorResponse', 'throw error'),
      a.sch('defect', STORAGE_MANIFEST, "tenant('ue_authority_reviews'"),
      a.imp('defect', 'withRLSContext', 'orgId = authOrgId'),
    ],
    inf: [
      { claim: 'defect', statement: 'No other file of the application queries ue_authority_reviews: the table is named only in lib/authority/store, the schema, the migrations and the register of subordinate authority, so the confidentiality rules are not bypassed by a current route.' },
    ],
    def: [RLS_ORG_ONLY, ORG_TWICE, UNHANDLED, OVERSIGHT_UNAUDITED],
  })
}

function reviewsPost(a) {
  return mk({
    ...base(a),
    persona: 'Active member opening a complaint, an appeal or a reconsideration',
    cat: 'SESSION_ONLY',
    authz: 'Session plus an active membership: openMemberReview requires the organization uuid, a principal id for the actor, an allowed review type, a normalised adverse list and an active membership row for the actor; registerReview checks the membership again. No kernel action governs the opening, so kernelAuthorization stays false and the opener is the complainant by construction.',
    tenant: 'The organization comes from getOrganizationIdForUser, the opener and complainant come from the session and the insert is written with that organization id inside the withRLSContext transaction; a body naming an organization, opener or complainant is refused by the strict schema.',
    owner: 'A new ue_authority_reviews row of the session organization, its authority event row and the canonical audit row; the row is append-only after insert apart from status and remediation owner.',
    sens: SENS,
    priv: 'The response returns the review id, type and status and the not-adopted notification marker; the adverse party is not told and the audit row records the review type and the opener.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The review insert and the authority.review.open canonical audit row (auditAuthorityMutation on the same executor) commit together, and a deferred database trigger refuses COMMIT when an authority event has no canonical audit row naming it.',
    reqAudit: 'Keep the in-transaction audit row and the database commit guard, and add the adverse-party verification and the request limit.',
    does: 'Reads and validates the body (review type enum, at most eight adverse ids), binds the session actor, requires an active membership, rejects a self-named or duplicate adverse id, inserts the review with the actor as opener and complainant and classification standard, writes the audit row in the same transaction and returns 201 with the id and the marker that no notice was sent.',
    status: 'PARTIAL',
    future: 'Verify that each adverse id is an active member of the organization, bound the request with a limiter and an idempotency key, cap the body before parsing, and answer every failure with a classified response.',
    dec: [],
    ev: [
      a.local('authentication', 'actor', 'const { userId } = await auth()'),
      a.local('authentication', 'actor', 'if (!userId) throw ApiError.unauthorized()'),
      a.local('authorization', 'actor', 'if (!organizationId) throw ApiError.forbidden()'),
      a.imp('authorization', 'openMemberReview', 'await requireActiveMember(exec, deps, input.organizationId, input.actorUserId)'),
      a.local('authorization', 'openSchema', '}).strict()'),
      a.h('tenantScope', 'const opened = await withRLSContext(async (tx) =>'),
      a.h('tenantScope', 'organizationId: who.organizationId,'),
      a.h('tenantScope', 'actorUserId: who.userId,'),
      a.imp('tenantScope', 'openMemberReview', 'complainantUserId: input.actorUserId,'),
      a.sch('tenantScope', MIGRATION_RLS, "SELECT ue_create_direct_org_rls_policy('ue_authority_reviews');"),
      a.imp('mutation', 'openMemberReview', 'const id = await registerReview(exec, deps, {'),
      a.svc('mutation', WORKFLOW, 'INSERT INTO ue_authority_reviews (organization_id, review_type, complainant_user_id, adverse_user_ids, classification, opened_by)', 'registerReview'),
      a.svc('audit', WORKFLOW, "await auditAuthorityMutation(exec, { organizationId: i.organizationId, action: 'review.open'", 'registerReview'),
      a.svc('audit', AUDIT, 'await appendCanonicalAuditLog(asRlsTx(exec), {', 'auditAuthorityMutation'),
      a.sch('audit', MIGRATION_TABLE, "RAISE EXCEPTION 'AUDIT_LINK_MISSING: authority event % has no canonical audit record'"),
      a.h('behavior', 'return NextResponse.json({ success: true, ...opened }, { status: 201 })'),
      a.imp('behavior', 'openMemberReview', "return { id, reviewType, status: 'open', ...NOTIFICATION }"),
      a.local('behavior', 'openSchema', 'adverseUserIds: z.array(z.string().min(1).max(255)).max(8).optional(),'),
      a.h('defect', 'raw = await request.json()'),
      a.h('defect', 'const parsed = openSchema.safeParse(raw)'),
      a.svc('defect', STORE, "if (!isPrincipalId(id)) throw new AuthorityStoreError('INVALID_CONTEXT', 'ADVERSE_ID_INVALID: expected an internal principal id')", 'normaliseAdverse'),
      a.svc('defect', EXECUTOR, 'value.length <= 255 &&', 'isPrincipalId'),
      a.sch('defect', MIGRATION_TABLE, "EXECUTE format('CREATE TRIGGER ue_authority_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation()', tbl);"),
      a.sch('defect', STORAGE_MANIFEST, "tenant('ue_authority_reviews'"),
      a.imp('defect', 'withRLSContext', 'orgId = authOrgId'),
      a.h('defect', 'return reviewErrorResponse(error)'),
      a.local('defect', 'reviewErrorResponse', 'throw error'),
    ],
    inf: [
      { claim: 'defect', statement: 'The route file imports no limiter and does not read the idempotency-key header, and the ue_authority_reviews table definition declares only a primary key and check constraints, so neither the route nor the table rejects a repeated identical request.' },
      { claim: 'defect', statement: 'The actor trigger ue_authority_guard_actor is attached to ue_authority_reviews for the opened_by column only, so no trigger compares adverse_user_ids with the organization membership.' },
    ],
    def: [RLS_ORG_ONLY, ADVERSE_UNVERIFIED, POST_UNBOUNDED, BODY_UNCAPPED, ORG_TWICE, UNHANDLED],
  })
}

const OPERATIONS = { 'reviews/route.ts|GET': reviewsGet, 'reviews/route.ts|POST': reviewsPost }

export function facts(authoring, readText) {
  const fn = OPERATIONS[`${authoring.route}|${authoring.method}`]
  if (!fn) throw new Error(`no Gate 0C.1 facts for ${authoring.route}|${authoring.method}`)
  return fn(authoring, readText)
}

export const RISK_SCREENS = {}
