/**
 * Gate 0B.4 facts for the carried-forward newsletter batch-status route, the platform case-study content routes and the
 * carbon accounting routes. Evidence is produced from the exact handler by `opAuthoring` and proved again by the
 * validator; nothing is quoted from memory.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { crudRecord } from './ue-gate0b4-crud.mjs'
import { APP, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const BATCH = 'billing/batch-status/[jobId]/route.ts'
const CAMPAIGN_DECISION = 'UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'
const PLATFORM_DECISION = 'UE-INST-PLATFORM-STAFF-MANDATE'
const CARBON_DECISION = 'UE-INST-CARBON-ACCOUNTING-SCOPE'

export const MISC_ROUTES = new Set([
  BATCH, 'case-studies/route.ts', 'case-studies/[slug]/route.ts',
  'carbon/dashboard/route.ts', 'carbon/infrastructure/route.ts', 'carbon/validate/route.ts',
])
export const UNRESOLVED_ROUTES = new Set(['carbon/dashboard/route.ts', 'carbon/infrastructure/route.ts', 'carbon/validate/route.ts'])

const D = (id, gate, severity, ownerCapabilityId, title) => ({ id, gate, severity, ownerCapabilityId, title })
export const MISC_DEFECTS = (ids) => [
  D('DEF-0B4-BATCH-STATUS-FINANCE-ENTITLEMENT-ON-NEWSLETTER', 11, 'MEDIUM', ids.COMMS_DELIVERY, 'The newsletter delivery status route is gated by the financial_intelligence_suite entitlement, a finance product gate, so the entitlement that decides who may read campaign delivery state is unrelated to the data and to the communications obligation.'),
  D('DEF-0B4-BATCH-STATUS-FABRICATED-PROCESSING', 11, 'MEDIUM', ids.COMMS_DELIVERY, 'Any job id that does not start with campaign-, and any campaign id that is not found, returns status processing with zero counts and a start time of the moment of the request, so a job that does not exist is reported as running.'),
  D('DEF-0B4-BATCH-STATUS-RECIPIENT-EMAILS-DISCLOSED', 11, 'MEDIUM', ids.COMMS_DELIVERY, 'The status response lists the e-mail address of up to ten failed recipients to any steward holding the entitlement and records no audit of the disclosure.'),
  D('DEF-0B4-CASE-STUDIES-ORG-ADMIN-WRITES-GLOBAL-CONTENT', 9, 'HIGH', 'UE-OMIT-PLATFORM-OPERATOR-CONTROLS', 'Case studies are global marketing rows read by every organization and the public, yet create, update and delete sit at the organization admin role floor, so the admin of any one organization can publish, rewrite or remove content shown to all organizations; no source names the platform staff mandate that should hold this write.'),
  D('DEF-0B4-CASE-STUDIES-READ-IGNORES-PUBLICATION-STATE', 9, 'HIGH', 'UE-OMIT-PLATFORM-OPERATOR-CONTROLS', 'The public case-study list and the member item read filter on neither visibility nor publishedAt, and the list status filter reads a status column that case_studies does not have, so unpublished rows and rows marked authenticated are returned to anonymous callers and to members of every organization.'),
  D('DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200', 8, 'HIGH', 'UE-CAP-H-001', 'The carbon dashboard and infrastructure routes return emissions totals, regional breakdowns, renewable percentages and optimization advice as literals in the handler, with success true and status 200, for any authenticated caller, so invented measurements are presented as monitoring results.'),
  D('DEF-0B4-CARBON-ORG-ID-FROM-QUERY-STRING', 8, 'MEDIUM', 'UE-CAP-H-001', 'The carbon dashboard takes organizationId from the query string, defaults it to union-eyes and echoes it, so the response names an organization chosen by the caller and not the session organization.'),
  D('DEF-0B4-CARBON-VALIDATE-ATTESTS-CALLER-DATA', 8, 'MEDIUM', 'UE-CAP-H-001', 'The carbon validation route computes a certificationEligible result and a message of Eligible for certification from numbers the caller supplied, with no source for the data points and no record of the check, so an unverified figure yields a certification-shaped answer.'),
]

export const CARBON_DECISIONS = [{
  id: CARBON_DECISION,
  status: 'OUTSTANDING',
  question: 'Does the platform operator or an organization own carbon accounting, and which measured data source, if any, may back an emissions figure or a neutrality claim?',
  sourceState: 'The carbon routes return emissions figures written as literals in the handler, take the organization from the query string and are called by no product source; no table, service, persona source or capability record names carbon accounting.',
  softwareOwners: ['UE-CAP-H-001'],
}]

const BATCH_FACTS = (a) => mk({
  persona: 'Steward holding the financial_intelligence_suite entitlement',
  service: `${APP}app/api/${BATCH}`,
  authn: 'Authenticated session resolved by withRoleAuth.',
  authz: "withRoleAuth('steward') plus requireEntitlement financial_intelligence_suite, a finance product entitlement that has no relation to newsletters. A role title is not a kernel decision.",
  tenant: 'The campaign lookup filters newsletter_campaigns on the session organizationId; the recipient statistics filter only on the campaign id taken from that lookup.',
  owner: 'newsletter_campaigns and newsletter_recipients rows of the organization; no route or service in the source writes either table.',
  sens: 'Recipient e-mail addresses of failed deliveries and campaign delivery counts',
  priv: 'Up to ten failed recipient e-mail addresses with their error text are returned to a steward.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read of campaign delivery state; nothing is written, and the disclosure of recipient addresses is not audited.',
  reqAudit: 'Audit reads of recipient e-mail addresses once the communications capability that owns the route is named.',
  does: 'Returns delivery progress for a job id that starts with campaign-; any other job id, and a campaign that is not found, returns status processing with zero counts and a start time of now.',
  status: 'PARTIAL',
  gate: 11,
  deps: [9, 14],
  future: 'Move the route under the communications capability, gate it by a communications entitlement, return not found for an unknown job, and audit reads of recipient addresses.',
  dec: [CAMPAIGN_DECISION],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "return withRoleAuth('steward', async (request, context) => {"),
    a.h('authorization', "await requireEntitlement(context.organizationId as string, 'financial_intelligence_suite', context.userId);"),
    a.h('tenantScope', 'eq(newsletterCampaigns.organizationId, context.organizationId as string)'),
    a.h('mutation', '.from(newsletterRecipients)'),
    a.h('defect', "let status = 'processing';"),
    a.h('privacy', 'recipientEmail: r.email,'),
    a.tbl('privacy', 'newsletterRecipients', /email:/),
    a.tbl('tenantScope', 'newsletterCampaigns', /organizationId:/),
  ],
  def: ['DEF-0B4-BATCH-STATUS-FINANCE-ENTITLEMENT-ON-NEWSLETTER', 'DEF-0B4-BATCH-STATUS-FABRICATED-PROCESSING', 'DEF-0B4-BATCH-STATUS-RECIPIENT-EMAILS-DISCLOSED'],
})

const caseProfile = {
  persona: undefined,
  owner: 'case_studies rows: global platform marketing content. organizationId, when set, names the organization a story is about; no route scopes by it.',
  sens: 'Marketing case-study text, metrics and testimonial quotes naming people and organizations, with a visibility marker and a publication date',
  priv: (method) => (method === 'GET'
    ? 'Any member of any organization reads any case study by slug, including rows whose visibility is authenticated and whose publishedAt is null, because the item read filters on neither.'
    : method === 'DELETE'
      ? 'The row is removed for every organization and for the public site.'
      : 'Any body field is stored, including organizationId, visibility, featured and publishedAt, so a published or organization-attributed story can be fabricated.'),
  does: (method, _model, floor) => ({
    GET: `Returns one case_studies row by slug at a role floor of ${floor}, with no organization, visibility or publication filter.`,
    POST: `Inserts a case_studies row with the body fields at a role floor of ${floor}.`,
    PATCH: `Updates a case_studies row found by slug with any body field except the primary key at a role floor of ${floor}.`,
    DELETE: `Hard-deletes a case_studies row found by slug at the fixed administrator floor (${floor}).`,
  })[method],
  future: 'Write platform marketing content only through the platform staff mandate, serve public and member reads only for rows that are published and visible to that audience, and keep organization admins out of global content.',
  gate: 9,
  deps: [13, 14],
  decisions: [PLATFORM_DECISION],
  status: () => 'PARTIAL',
  def: (method) => (method === 'GET' ? ['DEF-0B4-CASE-STUDIES-READ-IGNORES-PUBLICATION-STATE'] : ['DEF-0B4-CASE-STUDIES-ORG-ADMIN-WRITES-GLOBAL-CONTENT']),
  extraEv: (a) => [
    a.tbl('privacy', 'caseStudies', /visibility: text\('visibility'\)/),
    a.tbl('privacy', 'caseStudies', /publishedAt: timestamp\('published_at'\)/),
  ],
  cross: (method) => (method === 'GET'
    ? 'Rows whose organizationId names an organization, including unpublished rows and rows marked authenticated, are returned to members of every other organization without a publication check.'
    : undefined),
}

const CASE_LIST_GET = (a) => mk({
  persona: 'Unauthenticated visitor to the marketing site',
  service: `${APP}app/api/case-studies/route.ts`,
  authn: 'None: withApi is configured with auth.required false.',
  cat: 'NONE_PUBLIC',
  authz: 'No authentication and no role check. Nothing decides who may see unpublished or authenticated-only rows.',
  tenant: 'None: the query runs on the system role over a global table and applies no organization, visibility or publication filter.',
  owner: 'case_studies rows: global platform marketing content; organizationId, when set, names the organization a story is about.',
  sens: 'Marketing case-study text, metrics and testimonial quotes naming people and organizations, with a visibility marker and a publication date',
  priv: 'Every case_studies row is returned to an anonymous caller, including rows whose visibility is authenticated and whose publishedAt is null; the status filter reads a column the table does not have and filters nothing.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read of marketing content; nothing is written and no audit record is expected.',
  reqAudit: 'Public marketing reads need no audit record once only published rows can be returned.',
  does: 'Lists a page of case_studies rows newest first, with a total count, through the system role.',
  status: 'PARTIAL',
  gate: 9,
  deps: [13, 14],
  future: 'Return only published rows marked public to anonymous callers, and decide authenticated-audience rows after the platform staff mandate is named.',
  dec: [PLATFORM_DECISION],
  ev: [
    a.h('authentication', 'auth: { required: false },'),
    a.imp('authentication', 'withApi', 'const requireAuth = options.auth?.required !== false'),
    a.h('authorization', 'auth: { required: false },'),
    a.imp('authorization', 'withApi', 'const minRoleLevel = options.auth?.minRole'),
    a.h('tenantScope', 'const [rows, totalResult] = await withSystemContext(() => {'),
    a.imp('tenantScope', 'withSystemContext', 'SET LOCAL ROLE union_eyes_system'),
    a.h('mutation', 'const baseQuery = db.select().from(caseStudies);'),
    a.h('defect', "const statusCol = (caseStudies as any as Record<string, unknown>)['status'];"),
    a.tbl('defect', 'caseStudies', /visibility: text\('visibility'\)/, { absentColumns: ['status'] }),
    a.tbl('privacy', 'caseStudies', /publishedAt: timestamp\('published_at'\)/),
  ],
  def: ['DEF-0B4-CASE-STUDIES-READ-IGNORES-PUBLICATION-STATE'],
  cross: 'Rows whose organizationId names an organization, including unpublished rows and rows marked authenticated, are returned to anonymous callers without a publication check.',
  corr: [{ field: 'control', manifest: 'GENERIC_CRUD_ROLE_FLOOR', actual: 'A hand-written public withApi handler with auth.required false; the generic factory is used only for POST on this file.' }],
})

const carbonBase = (a) => ({
  persona: 'Any authenticated user; no organization or role is required',
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withApiAuth.',
  authz: 'withApiAuth with no role argument: any authenticated user, whether or not they belong to an organization. A role title is not a kernel decision.',
  tenant: 'None: the handler resolves no organization and reads no table.',
  owner: 'No owner: the handler holds literal figures and reads no data.',
  priv: 'No personal data is read or returned.',
  gate: 8,
  deps: [13, 14],
  dec: [CARBON_DECISION],
  unresolved: true,
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.h('authorization', `export const ${a.method} = withApiAuth(async`),
    a.h('tenantScope', `export const ${a.method} = withApiAuth(async`),
  ],
})

const CARBON = {
  'carbon/dashboard/route.ts|GET': (a) => {
    const b = carbonBase(a)
    return {
      ...b,
      sens: 'Invented emissions totals attributed to an organization chosen by the caller',
      mut: 'NOT_MUTATING',
      auditDetail: 'A read of literals; nothing is written.',
      reqAudit: 'No audit is needed for a literal; a real emissions dashboard needs reads of measured organization data to be attributed to the session organization.',
      does: 'Returns a dashboard of emissions figures written as literals in the handler, with success true, status 200 and the organizationId taken from the query string.',
      status: 'NOT_IMPLEMENTED_RETURNS_200',
      future: 'Return 501 until a measured data source and an owner exist, then scope the dashboard to the session organization.',
      tenant: 'None: the handler takes organizationId from the query string, defaulting to union-eyes, and uses no session organization.',
      ev: [
        ...b.ev,
        a.h('tenantScope', "const organizationId = searchParams.get('organizationId') || 'union-eyes';"),
        a.h('mutation', 'return NextResponse.json({'),
        a.h('behavior', 'totalEmissions: 1245.67,'),
      ],
      def: ['DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200', 'DEF-0B4-CARBON-ORG-ID-FROM-QUERY-STRING'],
    }
  },
  'carbon/infrastructure/route.ts|GET': (a) => {
    const b = carbonBase(a)
    return {
      ...b,
      sens: 'Invented emissions estimates by Azure region and resource type',
      mut: 'NOT_MUTATING',
      auditDetail: 'A read of literals; nothing is written.',
      reqAudit: 'No audit is needed for a literal.',
      does: 'Returns an infrastructure monitoring list written as literals in the handler, filtered by the region and resourceType query parameters, with success true and status 200.',
      status: 'NOT_IMPLEMENTED_RETURNS_200',
      future: 'Return 501 until a measured data source and an owner exist.',
      ev: [
        ...b.ev,
        a.h('mutation', 'return NextResponse.json({'),
        a.h('behavior', 'estimatedEmissions: 567.89,'),
      ],
      def: ['DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200'],
    }
  },
  'carbon/validate/route.ts|GET': (a) => {
    const b = carbonBase(a)
    return {
      ...b,
      sens: 'Static reference text about carbon claim standards',
      mut: 'NOT_MUTATING',
      auditDetail: 'A read of static text; nothing is written.',
      reqAudit: 'No audit is needed for static reference text.',
      does: 'Returns static text describing the carbon-neutral, renewable-powered and net-zero standards, in a response shaped as a validation result with valid true and a score of 100.',
      status: 'PARTIAL',
      future: 'Serve standards text from a documented source under the capability that owns carbon accounting and do not shape it as a validation result.',
      ev: [
        ...b.ev,
        a.h('mutation', 'return NextResponse.json({'),
        a.h('behavior', "message: 'Carbon validation standards',"),
      ],
      def: [],
    }
  },
  'carbon/validate/route.ts|POST': (a) => {
    const b = carbonBase(a)
    return {
      ...b,
      sens: 'Caller-supplied emissions and offset figures, echoed with an eligibility result',
      mut: 'NOT_MUTATING',
      nonMutationReason: 'The handler parses the body, scores it and returns the result; it writes no row.',
      auditDetail: 'A computation; nothing is written and the check is not recorded.',
      reqAudit: 'Record who asked for a certification-shaped result, and from what data source, once an owner exists.',
      does: 'Scores caller-supplied data points against fixed thresholds and returns certificationEligible and a message of eligibility for certification.',
      status: 'PARTIAL',
      future: 'Do not return a certification-shaped result for unverified numbers; require a measured data source and record the check.',
      ev: [
        ...b.ev,
        a.h('mutation', 'const validation = carbonValidateSchema.safeParse(body);'),
        a.h('audit', 'valid: validationScore >= 70,'),
        a.h('behavior', 'certificationEligible = true;'),
      ],
      def: ['DEF-0B4-CARBON-VALIDATE-ATTESTS-CALLER-DATA'],
    }
  },
}

export function carbonUnresolved(a) {
  const f = CARBON[`${a.route}|${a.method}`]
  if (!f) throw new Error(`no carbon facts for ${a.route}|${a.method}`)
  const c = f(a)
  const rec = mk({
    persona: c.persona, service: c.service, authn: c.authn, authz: c.authz, tenant: c.tenant, owner: c.owner, sens: c.sens, priv: c.priv,
    mut: c.mut, auditDetail: c.auditDetail, reqAudit: c.reqAudit, does: c.does, status: c.status, gate: c.gate, deps: c.deps, future: c.future,
    dec: c.dec, ev: c.ev, def: c.def, nonMutationReason: c.nonMutationReason,
  })
  return {
    ...rec,
    domain: 'UNRESOLVED',
    proposedCapability: 'A future carbon accounting capability that names a measured data source and an owning office; none exists in the register, the persona sources or the capability registry.',
    unresolvedReason: 'The routes serve emissions figures written as literals in the handler. There is no data owner, no table, no service and no caller, so the operation has no business domain to be owned by, only a defect to be repaired.',
    evidenceGap: 'No table, service, persona source, register entry or product caller names carbon accounting or Azure emissions monitoring, so there is no engineering capability whose obligation covers the operation and no institutional office that owns it.',
    softwareOwnerCandidate: 'UE-CAP-H-001 holds the defects (retired scaffold behavior returning 200) but is not the business owner; a future carbon accounting capability would be.',
  }
}

export function miscFacts(a, readText) {
  const id = `${a.route}|${a.method}`
  if (id === `${BATCH}|GET`) return BATCH_FACTS(a)
  if (id === 'case-studies/route.ts|GET') return CASE_LIST_GET(a)
  if (a.route === 'case-studies/route.ts' || a.route === 'case-studies/[slug]/route.ts') return crudRecord(a, readText, caseProfile)
  return carbonUnresolved(a)
}
