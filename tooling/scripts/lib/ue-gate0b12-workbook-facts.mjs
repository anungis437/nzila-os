/**
 * Gate 0B.12 facts: the Governance Entropy Workbook routes of the final tranche. Six route files, 8 operations: the public
 * start and checkout routes, the claim route that binds a paid workbook to a signed-in identity, the PDF export, and the
 * memory-holder routes whose authority is a bearer id before the claim and a claimant or same-organization peer after it.
 * Every evidence item is produced by `opAuthoring` from the exact handler, the helper or service it calls, or the resolved
 * schema, and is proved again by the validator. This tranche records the source; it repairs nothing and approves no route.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { APP, API } from './ue-gate0b4-fact-helpers.mjs'

const WORKBOOK_CAP = 'UE-OMIT-GOVERNANCE-WORKBOOK-PRODUCT'
const GATE = { [WORKBOOK_CAP]: 14 }

const D_LIFECYCLE = 'UE-INST-WORKBOOK-PSEUDONYMOUS-DATA-LIFECYCLE-CONSENT-AND-PROCESSOR'
const D_AUTHORITY = 'UE-INST-WORKBOOK-CLAIM-AND-SAME-ORGANIZATION-PEER-AUTHORITY'

const GUARD = `${APP}lib/public-intake/guard.ts`
const ACCESS = `${APP}lib/workbook/access-control.ts`
const CLAIMED_AUDIT = `${APP}lib/workbook/claimed-write-audit.ts`
const SCHEMA = `${APP}db/schema/workbook-schema.ts`
const DB_PROXY = `${APP}db/db.ts`
const RLS_CLOSURE = `${APP}db/migrations/20261005_prod_rls_closure_twelve_tables.sql`
const START_ROUTE = `${API}workbook/start/route.ts`
const CHECKOUT_ROUTE = `${API}workbook/checkout/route.ts`
const CLAIM_ROUTE = `${API}workbook/[id]/claim/route.ts`
const EXPORT_ROUTE = `${API}workbook/[id]/export/route.ts`
const HOLDERS_ROUTE = `${API}workbook/[id]/memory-holders/route.ts`
const HOLDER_ROUTE = `${API}workbook/[id]/memory-holders/[holderId]/route.ts`
const PDF_TEMPLATE = `${APP}lib/workbook-pdf/GovernanceEntropyWorkbookTemplate.tsx`
const PDF_LOADER = `${APP}lib/workbook-pdf/loadWorkbookModules.ts`

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const ROUTES = new Set([
  'workbook/start/route.ts',
  'workbook/checkout/route.ts',
  'workbook/[id]/claim/route.ts',
  'workbook/[id]/export/route.ts',
  'workbook/[id]/memory-holders/route.ts',
  'workbook/[id]/memory-holders/[holderId]/route.ts',
])

export const GROUPS = {
  WORKBOOK_PRODUCT: {
    capabilityId: WORKBOOK_CAP,
    domain: 'GOVERNANCE_ENTROPY_WORKBOOK_START_PURCHASE_CLAIM_EXPORT_AND_MEMORY_HOLDERS',
    actor: 'Visitor starting a pseudonymous Governance Entropy Workbook, buyer paying for the self-guided tier, signed-in claimant binding the paid workbook to an organization, and claimant or same-organization colleague recording the people who hold institutional memory',
    routes: [...ROUTES],
    evidence: [
      ev(START_ROUTE, ' * No authentication required (public pseudonymous intake, rate limited and body capped). Returns the new workbookId so the caller'),
      ev(CHECKOUT_ROUTE, ' * Self-Guided ($2,400 CAD) is the only tier with self-serve checkout.'),
      ev(CLAIM_ROUTE, ' * POST /api/workbook/[id]/claim — Bind a pseudonymous, paid Workbook to a Nzila identity.'),
      ev(ACCESS, ' * Shared claimed-workbook ownership authority.'),
      ev(SCHEMA, "claimedOrgId: uuid('claimed_org_id'),"),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_LIFECYCLE,
    status: 'OUTSTANDING',
    question: 'On what consent, notice and retention does the institution keep a pseudonymous workbook and the names, roles and free-text notes of the people it describes, which payment processor may receive the workbook identifier, and when is an unclaimed workbook deleted?',
    sourceState: 'The start route stores an optional consent object that no route reads, the checkout route sends the workbook identifier to Stripe in the redirect addresses and the session metadata, and the memory-holder routes store a display name and free-text notes of up to 4,000 characters about named people with no notice to them; no retention rule for an unclaimed or abandoned workbook is found. No source names the consent text, the processor terms or the deletion period.',
    softwareOwners: [WORKBOOK_CAP],
  },
  {
    id: D_AUTHORITY,
    status: 'OUTSTANDING',
    question: 'Who may claim a paid workbook into an organization, may any member of that organization (whatever their role) read, change and delete its memory holders and export it, and what authority does a person who holds only the workbook identifier keep over an unclaimed workbook?',
    sourceState: 'The claim route binds the workbook to the organization that getOrganizationIdForUser resolves for the signed-in holder of the claim token; after the claim every member of that organization is treated as a peer with read and write authority (no role floor), and before the claim the workbook identifier alone authorizes reads and writes of the memory holders. No source names the claiming officer, the role floor for a peer or the pre-claim authority.',
    softwareOwners: [WORKBOOK_CAP],
  },
]

export const CAPABILITIES = [
  {
    id: WORKBOOK_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    sourceStatus: 'PARTIAL',
    obligationKey: 'governance-entropy-workbook-product',
    primaryGate: 14,
    dependencyGates: [1, 13],
    actor: 'Visitor, buyer, claimant and same-organization colleague of the Governance Entropy Workbook product',
    businessOutcome: 'A workbook is started, bought and claimed only on a decision the institution has made about consent, retention and the payment processor, the claim binds it to a person and organization the institution authorizes, the people it names are recorded on a notice and read and changed only by the roles the institution names, and every identity-linked read and write is limited and recorded.',
    apiRoute: 'app/api/workbook',
    service: `${APP}lib/workbook/access-control.ts`,
    sourceFiles: [
      `${APP}app/api/workbook/start/route.ts`,
      `${APP}app/api/workbook/checkout/route.ts`,
      `${APP}app/api/workbook/[id]/claim/route.ts`,
      `${APP}app/api/workbook/[id]/export/route.ts`,
      `${APP}app/api/workbook/[id]/memory-holders/route.ts`,
      `${APP}app/api/workbook/[id]/memory-holders/[holderId]/route.ts`,
      `${APP}lib/workbook/access-control.ts`,
      `${APP}lib/workbook/claimed-write-audit.ts`,
      `${APP}db/schema/workbook-schema.ts`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/workbook/[id]/claim/route.ts` }],
    auditEvidence: 'The claim commits a workbook.claim audit row in the same system transaction (persistAtomicAudit); a write to the memory holders of a claimed workbook commits its audit row on the same executor, a write to an unclaimed workbook is not audited by design, and the start, checkout and export routes write no audit record.',
    privacyClassification: 'A pseudonymous workbook identifier (a bearer credential until the claim), locale, attribution (UTM) values, an optional consent object, the claimant user id and organization id, and per memory holder a role, a display name, a responsibility, tenure and criticality bands, a successor flag and free-text notes about a named person.',
    gap: 'UE-OMIT-ICRA-PUBLIC-ASSESSMENT owns the pseudonymous assessment product and UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING owns the subscription billing of the platform; neither owns the separate Governance Entropy Workbook (its public start and checkout, the claim into an organization and the memory-holder register), and the public start and checkout contracts of the 0B.1 inventory cover only the unauthenticated edge of two of its routes. UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. Six route files serve the workbook and no existing capability names them. This record closes none of the gaps and names no consent, retention or processor, which no source states.',
  },
]

const D = (id, severity, title, extra = {}) => ({ id, ownerCapabilityId: WORKBOOK_CAP, gate: GATE[WORKBOOK_CAP], severity, title, ...extra })

const PRECLAIM_WRITES = 'DEF-0B12-WBK-MEMORY-HOLDER-ROUTES-ACCEPT-READS-AND-WRITES-ON-THE-BEARER-ID-OF-AN-UNCLAIMED-WORKBOOK-WITH-NO-LIMIT-AND-NO-AUDIT'
const PEER_WRITES = 'DEF-0B12-WBK-ANY-MEMBER-OF-THE-CLAIMING-ORGANIZATION-CAN-READ-CHANGE-AND-DELETE-THE-NAMED-PEOPLE-WITH-NO-ROLE-FLOOR-OR-NOTICE'
const CONSENT_NOT_ENFORCED = 'DEF-0B12-WBK-START-STORES-AN-OPTIONAL-CONSENT-OBJECT-THAT-NO-ROUTE-READS'
const PUBLIC_LIMITER = 'DEF-0B12-WBK-PUBLIC-START-AND-CHECKOUT-ARE-LIMITED-BY-A-REQUEST-HEADER-ADDRESS-WITH-NO-BOT-CHALLENGE'
const CHECKOUT_RLS = 'DEF-0B12-WBK-CHECKOUT-READS-THE-USER-OWNED-WORKBOOKS-TABLE-OUTSIDE-ANY-DATABASE-CONTEXT'
const CHECKOUT_STRIPE = 'DEF-0B12-WBK-CHECKOUT-SENDS-THE-BEARER-WORKBOOK-ID-TO-STRIPE-IN-THE-REDIRECT-ADDRESSES-AND-METADATA'
const CHECKOUT_FALLBACK = 'DEF-0B12-WBK-CHECKOUT-REDIRECT-BASE-FALLS-BACK-TO-LOCALHOST-AND-EVERY-CALL-OPENS-A-NEW-SESSION'
const CLAIM_NO_LIMIT = 'DEF-0B12-WBK-CLAIM-HAS-NO-RATE-LIMIT-AND-READS-AN-UNCAPPED-BODY'
const EXPORT_UNAUDITED = 'DEF-0B12-WBK-EXPORT-STREAMS-THE-IDENTITY-LINKED-CARRIER-REGISTER-WITH-NO-AUDIT-RECORD'
const ID_IN_LOGS = 'DEF-0B12-WBK-ROUTES-LOG-THE-BEARER-WORKBOOK-ID'

export const DEFECTS = [
  D(PRECLAIM_WRITES, 'MEDIUM',
    'For a workbook with no claimed_by_user_id, resolveClaimedWorkbookAuthority returns the preclaim authority from the workbook identifier alone, so GET, POST, PATCH and DELETE on /api/workbook/<id>/memory-holders run in the system context for any caller who presents that identifier, with no session, with no guardPublicIntake or other rate limit (the route files import none), and auditClaimedWorkbookWrite returns at once for a preclaim authority so the create, update and delete are not recorded; the same identifier is returned by the public start route and placed in the checkout redirect addresses, and each write may carry a display name and notes of up to 4,000 characters.'),
  D(PEER_WRITES, 'MEDIUM',
    'After the claim, a same-organization peer is any signed-in person for whom getOrganizationIdForUser returns the claimed organization (that function selects an organization by a client cookie after a membership check): resolveClaimedWorkbookAuthority applies no role floor, and the memory-holder routes then let that person list, create, change and delete holders in the system context, with a display name and notes naming individuals who have no notice that they are recorded, and the PATCH and DELETE audit rows are written only when a row changed.'),
  D(CONSENT_NOT_ENFORCED, 'MEDIUM',
    'POST /api/workbook/start accepts consent as an optional object (consentToPersist and a time), inserts the workbook whether or not the object is present or true (consent is stored as null when absent) and logs only the workbook id and locale; no route of the workbook product reads workbooks.consent before it stores a memory holder, creates a checkout session or exports, so the consent the visitor gave or withheld changes nothing the product does.'),
  D(PUBLIC_LIMITER, 'MEDIUM',
    'guardPublicIntake keys its per-client limit (20 starts per hour, 10 checkouts per hour) on the first of cf-connecting-ip, x-real-ip or the first x-forwarded-for entry, all request headers a client can set when the application is not behind a proxy that overwrites them, and neither public route reads a challenge token, so a caller can create workbooks and open Stripe checkout sessions at a rate the limit does not bound.'),
  D(CHECKOUT_RLS, 'MEDIUM',
    'POST /api/workbook/checkout reads the workbook through the shared database handle (import { db } from \'@/db\') outside withSystemContext, withRLSContext and withClaimedWorkbookAccess, so the handle is the pooled runtime connection with no app.current_user_id; the closure migration creates the user isolation policy on workbooks over claimed_by_user_id, whose select policy compares that column with app.current_user_id, so an unclaimed workbook (the only kind a buyer has before paying) is not visible to the read and the route would answer 404 for it; the start and claim routes use withSystemContext for the same table, and the runtime proof of the policy is outstanding.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),
  D(CHECKOUT_STRIPE, 'MEDIUM',
    'POST /api/workbook/checkout sends the workbook identifier, which is the bearer credential for the memory holders of an unclaimed workbook, to Stripe in metadata.workbook_id and in the success and cancel addresses (/workbook/<id>?tier_unlocked=workbook_self_guided), so the credential is held by the payment processor, appears in the browser history and referrer chain of the buyer and is logged with the session id, and no source states the processor agreement or the lifecycle of the identifier.',
    { riskCategories: ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION'] }),
  D(CHECKOUT_FALLBACK, 'LOW',
    'When NEXT_PUBLIC_APP_URL is not set the checkout success and cancel addresses fall back to http://localhost:3000, and the route tests only that the workbook is not already at the self-guided tier, so each call creates a new Stripe session with no pending-session or idempotency check and a buyer or script can open any number of sessions for one workbook.'),
  D(CLAIM_NO_LIMIT, 'LOW',
    'POST /api/workbook/<id>/claim requires a session but applies no rate limit and reads the body with request.json() without a size cap, and a request whose id and token match a row but whose claim has lapsed is answered 409 or 410 while a miss is answered 404, so a signed-in caller can try claim tokens against an identifier at the speed of the application.'),
  D(EXPORT_UNAUDITED, 'LOW',
    'GET /api/workbook/<id>/export builds a PDF of the carrier register (role, criticality, tenure, successor and the free-text responsibility of every memory holder, with the cartography) for a claimant or any same-organization peer and writes no audit record of the read; loadWorkbookModules also selects the display name of every holder into memory although the template does not print it.'),
  D(ID_IN_LOGS, 'LOW',
    'The start, checkout and claim routes write the workbook identifier, which is the bearer credential of an unclaimed workbook, to the application log (with the locale, the Stripe session id, or the user id and organization id), so anyone who reads the log can use the identifier on the memory-holder routes until the workbook is claimed.'),
]

const future = {
  start: 'Decide the consent and notice text and enforce the stored consent before any identifying text is collected, bound the route with a limiter that does not rely on a client header and a bot challenge, and decide how long an unclaimed workbook is kept.',
  checkout: 'Read the workbook in the system context the other workbook routes use, keep the workbook identifier out of the processor metadata and redirect addresses (use a separate opaque purchase reference), require the application address in production, return the existing open session for a workbook and decide the processor terms.',
  claim: 'Rate limit the route, cap the body, answer one uniform refusal for a bad id or token and decide who may claim and into which organization.',
  holders: 'Decide the pre-claim authority and the role floor of a peer, rate limit and record the pre-claim writes, give the named people a notice and bound the free text.',
  export: 'Record the export with the actor in the same transaction, stop selecting the display name that the template does not print and decide who may export.',
}

const WORKBOOK_SENS = 'Pseudonymous workbook identifier, locale, attribution values, optional consent object, tier, claimant user id and organization id'
const HOLDER_SENS = 'Role, display name, responsibility, tenure band, criticality, successor flag and free-text notes of each person who holds institutional memory, with the cartography derived from them'

const base = (a) => ({
  service: `${a.routeFile}`,
  gate: GATE[WORKBOOK_CAP],
  corr: [],
})

function startPost(a) {
  return mk({
    ...base(a),
    persona: 'Anonymous visitor beginning a Governance Entropy Workbook from the landing page',
    service: `${a.routeFile} (guardPublicIntake, withSystemContext)`,
    authn: 'None: no session and no account; guardPublicIntake bounds the caller by a request-header address and a 16 KiB body cap, and the route returns the new workbook identifier, which is the only credential the visitor holds.',
    cat: 'NONE_PUBLIC',
    authz: 'No authentication and no role check. guardPublicIntake applies the write bucket (20 per hour per header-derived address, refusing when the limiter is unavailable in production) and a body cap; no bot challenge is read. Nothing created here grants access to tenant data. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'None: the route reads no tenant data. It inserts a workbooks row and one workbook_modules row per module in one system transaction, with no organization or user; the row is reachable only by its identifier until it is claimed.',
    owner: 'A new workbooks row and its module status rows; the visitor owns the row only through the identifier returned once in the body.',
    sens: WORKBOOK_SENS,
    priv: 'The visitor receives only the new workbook identifier; the locale, the optional consent object, the sector and size bands and the attribution values are stored as typed.',
    mut: 'NONE',
    auditDetail: 'The workbook and its module rows are inserted in one system transaction and no audit record is written; the only trace is the logger line [workbook-start] Workbook created, which carries the workbook identifier.',
    reqAudit: 'A pseudonymous start has no actor to attribute; record the consent decision server-side before any text is stored and count starts per address bucket for abuse review.',
    does: 'Applies the public intake guard, validates the body with zod (locale, optional consent, bands, attribution), inserts the workbook and seeds a not_started status row for every module in one system transaction, logs the creation and answers with the workbook identifier; a failed insert answers 500 and a database error 503.',
    status: 'PARTIAL',
    deps: [1, 13],
    future: future.start,
    dec: [D_LIFECYCLE],
    ev: [
      a.h('authentication', "const intake = await guardPublicIntake(request, { bucket: 'write' });"),
      a.imp('authentication', 'guardPublicIntake', 'const limit = await checkRateLimit(`ip:${clientAddress(request)}`, config)'),
      a.h('authorization', 'if (!intake.ok) return intake.response;'),
      a.svc('authorization', GUARD, "write: { limit: 20, window: 3600, identifier: 'public-intake-write' },"),
      a.h('tenantScope', 'const wb = await withSystemContext(async (tx) => {'),
      a.tbl('tenantScope', 'workbooks', /claimedOrgId: uuid\('claimed_org_id'\),/, { absentColumns: ['tenantId', 'tenant_id', 'organizationId'] }),
      a.h('mutation', '.insert(workbooks)'),
      a.h('mutation', '.insert(workbookModules)'),
      a.h('audit', "logger.info('[workbook-start] Workbook created', { workbookId: wb.id, locale });"),
      a.h('behavior', 'return NextResponse.json({ workbookId: wb.id });'),
      a.h('privacy', 'consent: consent ?? null,'),
      a.h('defect', 'consent: consent ?? null,'),
      a.svc('defect', GUARD, "const direct = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip')", 'clientAddress'),
    ],
    inf: [
      { claim: 'defect', statement: 'No file of the workbook routes or of the workbook library reads workbooks.consent: the column is written by this route and is not selected by the checkout, claim, export or memory-holder routes, and the route has no bot challenge.' },
    ],
    def: [CONSENT_NOT_ENFORCED, PUBLIC_LIMITER, ID_IN_LOGS],
  })
}

function checkoutPost(a) {
  return mk({
    ...base(a),
    persona: 'Anonymous buyer opening the Stripe checkout for the self-guided workbook tier',
    service: `${a.routeFile} (guardPublicIntake, shared database handle, @nzila/payments-stripe)`,
    authn: 'None: no session and no account; guardPublicIntake bounds the caller by a request-header address and a body cap, and the workbook identifier in the body is the only reference to the workbook.',
    cat: 'NONE_PUBLIC',
    authz: 'No authentication and no role check. guardPublicIntake applies the checkout bucket (10 per hour per header-derived address, refusing when the limiter is unavailable in production) and a body cap; the route accepts any identifier of an existing workbook and no other test is made of the caller. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'None by organization: workbooks has no tenant organization column for an unclaimed workbook; the row is selected by the identifier in the body with the shared database handle, outside any database context.',
    owner: 'The workbooks row named in the body is read for its report tier; the Stripe checkout session belongs to the payment processor.',
    sens: 'The workbook identifier, the report tier of the workbook, the price and the Stripe session address',
    priv: 'The caller receives the Stripe checkout address; the workbook identifier is sent to Stripe in the metadata and in both redirect addresses and logged with the session id.',
    mut: 'NOT_MUTATING',
    nonMutationReason: 'The POST reads the workbook and creates a Stripe checkout session at the payment processor; it writes no row and no audit record in the application, and the tier is upgraded later by the Stripe webhook.',
    auditDetail: 'The route writes no row and no audit record; the only trace is the logger line [workbook-checkout] Checkout session created with the workbook identifier and the session id.',
    reqAudit: 'A checkout opened for a workbook needs the buyer reference the processor returns and a record that the session was opened; the audit of the payment belongs to the webhook that upgrades the tier.',
    does: 'Applies the public intake guard, validates the workbook identifier, reads the workbook (404 when missing, 409 when it already holds the self-guided tier), builds the line item from the configured Stripe price or the tier amount, creates a Stripe checkout session in payment mode with the workbook identifier in the metadata and the redirect addresses and answers with the session address.',
    status: 'PARTIAL',
    deps: [1, 13],
    future: future.checkout,
    dec: [D_LIFECYCLE],
    ev: [
      a.h('authentication', "const intake = await guardPublicIntake(request, { bucket: 'checkout' });"),
      a.imp('authentication', 'guardPublicIntake', 'const limit = await checkRateLimit(`ip:${clientAddress(request)}`, config)'),
      a.h('authorization', 'if (!intake.ok) return intake.response;'),
      a.svc('authorization', GUARD, "checkout: { limit: 10, window: 3600, identifier: 'public-intake-checkout' },"),
      a.h('tenantScope', '.where(eq(workbooks.id, workbookId))'),
      a.tbl('tenantScope', 'workbooks', /claimedOrgId: uuid\('claimed_org_id'\),/, { absentColumns: ['tenantId', 'tenant_id', 'organizationId'] }),
      a.h('mutation', 'const session = await stripe.checkout.sessions.create({'),
      a.h('audit', "logger.info('[workbook-checkout] Checkout session created', {"),
      a.h('behavior', 'return NextResponse.json({ url: session.url });'),
      a.h('privacy', 'workbook_id: workbookId,'),
      a.h('defect', "process.env.NEXT_PUBLIC_APP_URL?.replace(/\\/$/, '') ?? 'http://localhost:3000';"),
      a.h('defect', 'const successUrl = `${baseUrl}/workbook/${workbookId}?tier_unlocked=${SELF_GUIDED_TIER_ID}`;'),
      a.svc('defect', DB_PROXY, 'const activeSystemDb = getActiveSystemDb();', undefined),
      a.svc('defect', GUARD, "const direct = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip')", 'clientAddress'),
    ],
    inf: [
      { claim: 'defect', statement: `${RLS_CLOSURE} calls ue_create_user_rls_policy('workbooks', 'claimed_by_user_id'), and ue_create_user_rls_policy in the round 58 migration creates the select policy for union_eyes_runtime with USING (claimed_by_user_id::text = current_setting('app.current_user_id', true)); the checkout route runs no with*Context function, so the shared handle resolves to the pooled runtime connection and a row with a null claimed_by_user_id does not satisfy the policy.` },
      { claim: 'defect', statement: 'The route keeps no record of the sessions it opens and tests only the self-guided tier of the workbook before it calls Stripe.' },
    ],
    def: [CHECKOUT_RLS, CHECKOUT_STRIPE, CHECKOUT_FALLBACK, PUBLIC_LIMITER, ID_IN_LOGS],
  })
}

function claimPost(a) {
  return mk({
    ...base(a),
    persona: 'Signed-in buyer binding the paid workbook to their organization with the single-use claim token',
    service: `${a.routeFile} (auth, getOrganizationIdForUser, withSystemContext, persistAtomicAudit)`,
    authn: 'Entra session resolved by auth() (401 when absent) and a single-use claim token of at least 16 characters in the body that the Stripe webhook stamped on the workbook.',
    cat: 'EXTERNAL_TRUST',
    authz: 'The decision is possession of the claim token for the identifier in the path, an unexpired token on an unclaimed workbook, and an organization resolved for the signed-in user (403 when none); there is no role floor, no officer test and no authorizeAction call, so kernelAuthorization stays false.',
    tenant: 'The update runs under withSystemContext on one workbook (id, token, unclaimed and unexpired predicates) and stamps the organization that getOrganizationIdForUser resolves for the user; the audit row is written under that organization.',
    owner: 'The workbooks row named in the path; after the claim it belongs to the claimant and the organization stamped on it.',
    sens: 'The claim token, the workbook identifier, the claimant user id and organization id and the claim time',
    priv: 'The caller receives the workbook identifier and the organization id; a miss, an already claimed workbook and an expired token are answered 404, 409 and 410.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The claim update (claimed user, claimed organization, claim time, status active, token nulled) and the workbook.claim audit row (persistAtomicAudit on the same system transaction) commit together; a failed audit rolls the claim back.',
    reqAudit: 'Keep the in-transaction audit row and record the organization chosen and the source of the claim token.',
    does: 'Requires a session, validates the claim token, resolves the organization of the user, then in one system transaction sets the claimed user, organization and time on the workbook, nulls the token and writes the audit row when the id, token, unclaimed and unexpired predicates match; otherwise it answers 404, 409 or 410.',
    status: 'PARTIAL',
    deps: [1, 13],
    future: future.claim,
    dec: [D_AUTHORITY],
    ev: [
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', 'eq(workbooks.claimToken, claimToken),'),
      a.h('authorization', 'gt(workbooks.claimTokenExpiresAt, claimedAt),'),
      a.h('tenantScope', 'const orgId = await getOrganizationIdForUser(userId).catch(() => null);'),
      a.h('tenantScope', 'claimedOrgId: orgId,'),
      a.h('mutation', '.update(workbooks)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('audit', "action: 'workbook.claim',"),
      a.h('behavior', "return NextResponse.json({ error: 'Claim token expired' }, { status: 410 });"),
      a.h('privacy', 'logger.info(\'[workbook-claim] Workbook claimed\', { workbookId, userId, orgId });'),
      a.h('defect', 'body = await request.json();'),
    ],
    inf: [
      { claim: 'defect', statement: 'The route file imports no guardPublicIntake or checkRateLimit: the only limit between a signed-in caller and the claim update is the token predicate of the update itself.' },
    ],
    def: [CLAIM_NO_LIMIT, ID_IN_LOGS],
  })
}

function exportGet(a) {
  return mk({
    ...base(a),
    persona: 'Claimant or same-organization colleague downloading the Governance Entropy Workbook PDF',
    service: `${a.routeFile} (withClaimedWorkbookAccess, generateWorkbookPdf)`,
    authn: 'Entra session resolved by auth() inside withClaimedWorkbookAccess; an unclaimed workbook has no identity-bound owner and is refused 403, and a claimed workbook without a session is refused 401.',
    cat: 'SESSION_ONLY',
    authz: 'The caller must be the claimant or a member of the organization the workbook was claimed into, and the workbook must hold the self-guided, facilitated or enterprise tier (402 otherwise); there is no role floor and no authorizeAction call, so kernelAuthorization stays false.',
    tenant: 'withClaimedWorkbookAccess resolves the authority first and runs the callback in the claimant user context or in a bounded system context for a peer; the tier read and the PDF reads are constrained to the workbook identifier in the path.',
    owner: 'The workbooks row and its memory-holder and module rows, owned by the claimant and the claiming organization.',
    sens: HOLDER_SENS,
    priv: 'The caller receives a PDF of the carrier register and cartography (role, criticality, tenure, successor flag and responsibility text per holder); the display name and notes are not printed and the response is not cacheable.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record of the export.',
    reqAudit: 'Record the export of an identity-linked register with the actor and the workbook identifier, in the same transaction.',
    does: 'Resolves the claimed-workbook authority, refuses an unclaimed workbook (403), reads the tier (404 when missing, 402 when below the self-guided tier), renders the PDF and returns it with a no-store cache header; a render error answers 503.',
    status: 'IMPLEMENTED_IN_SOURCE',
    deps: [1, 13],
    future: future.export,
    dec: [D_AUTHORITY],
    ev: [
      ...exportEvidence(a),
    ],
    inf: [
      { claim: 'defect', statement: `${PDF_TEMPLATE} prints the role, criticality, tenure band, successor flag and responsibility of each holder and not the display name or notes, and ${PDF_LOADER} selects displayName into the holder list.` },
    ],
    def: [EXPORT_UNAUDITED],
  })
}

function exportEvidence(a) {
  return [
    a.h('authentication', 'const access = await withClaimedWorkbookAccess('),
    a.svc('authentication', ACCESS, 'const { userId } = await auth();', 'resolveClaimedWorkbookAuthority'),
    a.h('authorization', "if (authority.kind === 'preclaim') {"),
    a.h('authorization', 'if (!wb.reportTierId || !ELIGIBLE_TIERS.has(wb.reportTierId)) {'),
    a.svc('authorization', ACCESS, 'if (!requesterOrgId || !ownerOrgId || requesterOrgId !== ownerOrgId) {', 'resolveClaimedWorkbookAuthority'),
    a.h('tenantScope', '{ workbookId, operation: \'read\' },'),
    a.svc('tenantScope', ACCESS, 'value = await withSystemContext(() => callback(authority));', 'withClaimedWorkbookAccess'),
    a.svc('tenantScope', DB_PROXY, 'const activeSystemDb = getActiveSystemDb();', undefined),
    a.h('mutation', 'const buffer = await generateWorkbookPdf({ workbookId });'),
    a.h('behavior', 'const buffer = await generateWorkbookPdf({ workbookId });'),
    a.h('privacy', "'Content-Type': 'application/pdf',"),
    a.h('defect', 'const buffer = await generateWorkbookPdf({ workbookId });'),
  ]
}

const holderScreen = (a) => [
  a.svc('tenantScope', ACCESS, 'value = await withSystemContext(() => callback(authority));', 'withClaimedWorkbookAccess'),
  a.svc('tenantScope', ACCESS, 'value = await withExplicitUserContext(', 'withClaimedWorkbookAccess'),
]

const holdersAuthn = (a) => [
  a.h('authentication', 'const access = await withClaimedWorkbookAccess('),
  a.imp('authorization', 'withClaimedWorkbookAccess', 'const decision = await resolveClaimedWorkbookAuthority(args.workbookId);'),
  a.svc('authentication', ACCESS, 'const { userId } = await auth();', 'resolveClaimedWorkbookAuthority'),
  a.svc('authorization', ACCESS, 'if (!ownership.claimedByUserId) {', 'resolveClaimedWorkbookAuthority'),
  a.svc('authorization', ACCESS, 'if (!requesterOrgId || !ownerOrgId || requesterOrgId !== ownerOrgId) {', 'resolveClaimedWorkbookAuthority'),
]

const HOLDER_AUTHN = 'Entra session resolved by auth() inside withClaimedWorkbookAccess once the workbook is claimed; for an unclaimed workbook no session is read and the workbook identifier in the path is the credential.'
const HOLDER_AUTHZ = 'An unclaimed workbook accepts any caller who presents its identifier; a claimed workbook accepts only the claimant or a member of the organization it was claimed into, with no role floor and no authorizeAction call, so kernelAuthorization stays false.'
const HOLDER_TENANT = 'withClaimedWorkbookAccess resolves the authority first and runs the callback in the claimant user context (RLS scopes to the claimant) or in a bounded system context for a peer or a bearer; the callback itself constrains each statement to the workbook identifier in the path, and the shared database handle resolves to that context.'

function holdersGet(a) {
  return mk({
    ...base(a),
    persona: 'Claimant, same-organization colleague or holder of the workbook identifier listing the memory holders and the cartography',
    service: `${a.routeFile} (withClaimedWorkbookAccess, stewardship cartography engine)`,
    authn: HOLDER_AUTHN,
    cat: 'EXTERNAL_TRUST',
    authz: HOLDER_AUTHZ,
    tenant: HOLDER_TENANT,
    owner: 'The workbook_memory_holders rows of the workbook named in the path.',
    sens: HOLDER_SENS,
    priv: 'The caller receives every holder row including the display name and the free-text notes, and the cartography computed from the structural fields; for an unclaimed workbook the identifier alone is enough.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of the register need no audit record once the pre-claim authority is decided; a read of the named people by a peer is an identity-linked disclosure that may need one.',
    does: 'Resolves the claimed-workbook authority and returns every memory holder of the workbook ordered by capture time with the cartography; an unknown workbook is 404 and a database error 503.',
    status: 'PARTIAL',
    deps: [1, 13],
    future: future.holders,
    dec: [D_AUTHORITY, D_LIFECYCLE],
    ev: [
      ...holdersAuthn(a),
      a.h('tenantScope', "{ workbookId, operation: 'read' },"),
      ...holderScreen(a),
      a.h('mutation', 'async () => loadCartography(workbookId),'),
      a.local('behavior', 'loadCartography', '.orderBy(workbookMemoryHolders.capturedAt);'),
      a.local('privacy', 'loadCartography', 'notes: workbookMemoryHolders.notes,'),
      a.local('defect', 'loadCartography', 'displayName: workbookMemoryHolders.displayName,'),
    ],
    inf: [
      { claim: 'defect', statement: 'resolveClaimedWorkbookAuthority returns the preclaim authority when ownership.claimedByUserId is empty without reading a session, and the route imports no rate limiter.' },
      { claim: 'defect', statement: `${DB_PROXY} makes the shared db proxy resolve to the active system or tenant transaction, so the reads inside the callback run in the context withClaimedWorkbookAccess established.` },
    ],
    def: [PRECLAIM_WRITES, PEER_WRITES],
  })
}

function holdersPost(a) {
  return mk({
    ...base(a),
    persona: 'Claimant, same-organization colleague or holder of the workbook identifier recording a person who holds institutional memory',
    service: `${a.routeFile} (withClaimedWorkbookAccess, auditClaimedWorkbookWrite)`,
    authn: HOLDER_AUTHN,
    cat: 'EXTERNAL_TRUST',
    authz: HOLDER_AUTHZ,
    tenant: HOLDER_TENANT,
    owner: 'A new workbook_memory_holders row of the workbook named in the path.',
    sens: HOLDER_SENS,
    priv: 'The caller stores a role, a responsibility, optional bands, a display name of up to 255 characters and notes of up to 4,000 characters about a named person, and receives the new id with the refreshed register and cartography.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'For a claimed workbook the insert and the workbook.memory_holder.create audit row (persistAtomicAudit through auditClaimedWorkbookWrite on the executor of the context) commit together and the audit fails closed without an organization; for an unclaimed workbook auditClaimedWorkbookWrite returns at once and nothing is recorded.',
    reqAudit: 'Record the write with the actor for every authority, including the pre-claim bearer, and name the fields stored.',
    does: 'Validates the body (role, responsibility, optional bands, display name and notes), resolves the claimed-workbook authority for a write, inserts the holder and its audit row in that context and returns 201 with the new id, the register and the cartography.',
    status: 'PARTIAL',
    deps: [1, 13],
    future: future.holders,
    dec: [D_AUTHORITY, D_LIFECYCLE],
    ev: [
      ...holdersAuthn(a),
      a.h('tenantScope', "{ workbookId, operation: 'write' },"),
      ...holderScreen(a),
      a.h('mutation', '.insert(workbookMemoryHolders)'),
      a.h('audit', 'await auditClaimedWorkbookWrite(authority, {'),
      a.svc('audit', CLAIMED_AUDIT, 'await persistAtomicAudit(db as unknown as RLSTx, {', 'auditClaimedWorkbookWrite'),
      a.h('behavior', 'return NextResponse.json(access.value, { status: 201 });'),
      a.h('privacy', 'displayName: parse.data.displayName ?? null,'),
      a.h('defect', "action: 'workbook.memory_holder.create',"),
      a.svc('defect', CLAIMED_AUDIT, "if (authority.kind === 'preclaim') return;", 'auditClaimedWorkbookWrite'),
    ],
    inf: [
      { claim: 'defect', statement: 'The route file imports no rate limiter or guardPublicIntake, and the create schema bounds displayName at 255 characters and notes at 4,000 with no check that the person named has been told.' },
    ],
    def: [PRECLAIM_WRITES, PEER_WRITES],
  })
}

function holderPatch(a) {
  return mk({
    ...base(a),
    persona: 'Claimant, same-organization colleague or holder of the workbook identifier correcting a recorded memory holder',
    service: `${a.routeFile} (withClaimedWorkbookAccess, auditClaimedWorkbookWrite)`,
    authn: HOLDER_AUTHN,
    cat: 'EXTERNAL_TRUST',
    authz: HOLDER_AUTHZ,
    tenant: `${HOLDER_TENANT} The update also requires the holder id and the workbook id to match and the workbook to carry the resolved organization or no organization.`,
    owner: 'The workbook_memory_holders row named in the path, within the workbook named in the path.',
    sens: HOLDER_SENS,
    priv: 'The caller changes any subset of the role, display name, responsibility, bands, successor flag and notes of a recorded person; the response is ok true.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'For a claimed workbook the update and the workbook.memory_holder.update audit row (the names of the changed fields) commit together, and the audit is written only when a row changed; for an unclaimed workbook nothing is recorded.',
    reqAudit: 'Record the change with the actor for every authority and keep the previous values of the changed fields.',
    does: 'Validates the optional fields, resolves the claimed-workbook authority for a write and updates the holder that matches the holder id, the workbook id and the organization predicate, writes the audit row when a row changed, and answers ok true or 404.',
    status: 'PARTIAL',
    deps: [1, 13],
    future: future.holders,
    dec: [D_AUTHORITY, D_LIFECYCLE],
    ev: [
      ...holdersAuthn(a),
      a.h('tenantScope', "{ workbookId, operation: 'write' },"),
      a.h('tenantScope', 'holderInOrgWorkbook(workbookId, orgId),'),
      a.local('tenantScope', 'holderInOrgWorkbook', 'AND (claimed_org_id = ${orgId} OR claimed_org_id IS NULL))`'),
      ...holderScreen(a),
      a.h('mutation', '.update(workbookMemoryHolders)'),
      a.h('audit', 'await auditClaimedWorkbookWrite(authority, {'),
      a.svc('audit', CLAIMED_AUDIT, 'await persistAtomicAudit(db as unknown as RLSTx, {', 'auditClaimedWorkbookWrite'),
      a.h('behavior', "return NextResponse.json({ error: 'Memory holder not found' }, { status: 404 });"),
      a.h('privacy', "details: { fields: Object.keys(parse.data).filter((k) => parse.data[k as keyof typeof parse.data] !== undefined) },"),
      a.h('defect', 'if (updated.length > 0) {'),
    ],
    inf: [
      { claim: 'defect', statement: 'The route file imports no rate limiter or guardPublicIntake, and the audit details carry only the names of the changed fields and not their old or new values.' },
    ],
    def: [PRECLAIM_WRITES, PEER_WRITES],
  })
}

function holderDelete(a) {
  return mk({
    ...base(a),
    persona: 'Claimant, same-organization colleague or holder of the workbook identifier removing a recorded memory holder',
    service: `${a.routeFile} (withClaimedWorkbookAccess, auditClaimedWorkbookWrite)`,
    authn: HOLDER_AUTHN,
    cat: 'EXTERNAL_TRUST',
    authz: HOLDER_AUTHZ,
    tenant: `${HOLDER_TENANT} The delete also requires the holder id and the workbook id to match and the workbook to carry the resolved organization or no organization.`,
    owner: 'The workbook_memory_holders row named in the path, within the workbook named in the path.',
    sens: HOLDER_SENS,
    priv: 'The caller permanently deletes a recorded person and the free text kept about them; the response is ok true.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'For a claimed workbook the hard delete and the workbook.memory_holder.delete audit row commit together, and the audit is written only when a row was removed (its details are empty); for an unclaimed workbook nothing is recorded.',
    reqAudit: 'Record the removal with the actor for every authority and keep what was removed.',
    does: 'Resolves the claimed-workbook authority for a write and deletes the holder that matches the holder id, the workbook id and the organization predicate, writes the audit row when a row was removed, and answers ok true or 404.',
    status: 'PARTIAL',
    deps: [1, 13],
    future: future.holders,
    dec: [D_AUTHORITY, D_LIFECYCLE],
    ev: [
      ...holdersAuthn(a),
      a.h('tenantScope', "{ workbookId, operation: 'write' },"),
      a.h('tenantScope', 'holderInOrgWorkbook(workbookId, orgId),'),
      a.local('tenantScope', 'holderInOrgWorkbook', 'AND (claimed_org_id = ${orgId} OR claimed_org_id IS NULL))`'),
      ...holderScreen(a),
      a.h('mutation', '.delete(workbookMemoryHolders)'),
      a.h('audit', 'await auditClaimedWorkbookWrite(authority, {'),
      a.svc('audit', CLAIMED_AUDIT, 'await persistAtomicAudit(db as unknown as RLSTx, {', 'auditClaimedWorkbookWrite'),
      a.h('behavior', "return NextResponse.json({ error: 'Memory holder not found' }, { status: 404 });"),
      a.h('privacy', "action: 'workbook.memory_holder.delete',"),
      a.h('defect', 'details: {},'),
    ],
    inf: [
      { claim: 'defect', statement: 'The delete is a hard delete with no soft-delete column or copy of the removed row, so the audit row names the holder id and nothing that was removed; the route file imports no rate limiter.' },
    ],
    def: [PRECLAIM_WRITES, PEER_WRITES],
  })
}

const rlsScreen = (route) => ({
  RLS_ASSUMED_FROM_DB_CLIENT: {
    reason: 'The route reads and writes through the shared db import only inside the callback of withClaimedWorkbookAccess, which establishes the claimant user context or a bounded system context first; the db proxy resolves to that transaction, so the handle is not the bare pooled connection.',
    evidence: [
      { ref: ACCESS, quote: 'value = await withSystemContext(() => callback(authority));' },
      { ref: ACCESS, quote: 'value = await withExplicitUserContext(' },
      { ref: DB_PROXY, quote: 'const activeTenantDb = getActiveTenantDb();' },
    ],
  },
  ...(route === 'export'
    ? {
        SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: {
          reason: 'The PDF prints the role, bands, successor flag and responsibility text of each holder; the template prints neither the display name nor the notes of the source rows, so the derived output carries no field the source marks as the named person.',
          evidence: [
            { ref: PDF_TEMPLATE, quote: '<Text style={S.holderResp}>{h.responsibility}</Text>' },
            { ref: PDF_LOADER, quote: ' * Holder names, lineage prose, and notes never leave the row.' },
          ],
        },
      }
    : {}),
})

export const RISK_SCREENS = {
  'workbook/[id]/export/route.ts|GET': rlsScreen('export'),
  'workbook/[id]/memory-holders/route.ts|GET': rlsScreen(),
  'workbook/[id]/memory-holders/route.ts|POST': rlsScreen(),
  'workbook/[id]/memory-holders/[holderId]/route.ts|PATCH': rlsScreen(),
  'workbook/[id]/memory-holders/[holderId]/route.ts|DELETE': rlsScreen(),
}

export function facts(a) {
  const record = build(a)
  record.riskScreen = RISK_SCREENS[`${a.route}|${a.method}`] ?? {}
  return record
}

function build(a) {
  switch (a.route) {
    case 'workbook/start/route.ts': return startPost(a)
    case 'workbook/checkout/route.ts': return checkoutPost(a)
    case 'workbook/[id]/claim/route.ts': return claimPost(a)
    case 'workbook/[id]/export/route.ts': return exportGet(a)
    case 'workbook/[id]/memory-holders/route.ts': return a.method === 'GET' ? holdersGet(a) : holdersPost(a)
    case 'workbook/[id]/memory-holders/[holderId]/route.ts': return a.method === 'PATCH' ? holderPatch(a) : holderDelete(a)
    default: throw new Error(`no workbook facts for ${a.route}`)
  }
}

