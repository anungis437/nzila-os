/**
 * Gate 0B.4 facts for the CLC synchronization routes and the CNESST occupational health and safety routes. All
 * twenty-one operations are the generic CRUD factory over an OPERATIONAL table. The route configuration, the table
 * definition and the factory behaviour are read from source by the CRUD helper; this module states only what no source
 * line can say, and the defects the source lines prove.
 */
import { crudRecord, crudModel } from './ue-gate0b4-crud.mjs'
import { APP, LOW_ROLE } from './ue-gate0b4-fact-helpers.mjs'

const CLC_GATE = 13
const OHS_GATE = 6
const CLC_TABLE_FILE = `${APP}db/schema/domains/infrastructure/clc-sync.ts`

export const CLC_ROUTES = new Set(['clc/dashboard/route.ts', 'clc/remittances/route.ts', 'clc/sync/route.ts'])
export const OHS_ROUTES = new Set([
  'cnesst/anti-scab/[id]/route.ts', 'cnesst/anti-scab/route.ts', 'cnesst/filings/[id]/route.ts', 'cnesst/filings/route.ts',
  'cnesst/hs-committees/[id]/route.ts', 'cnesst/hs-committees/route.ts',
])

const D = (id, gate, severity, title) => ({ id, gate, severity, title })
export const CLC_DEFECTS = [
  D('DEF-0B4-CLC-ROUTES-FACADE-OVER-SYNC-LOG', CLC_GATE, 'MEDIUM', 'The clc dashboard, remittances and sync routes are the same generic CRUD configuration over clc_sync_log, and no other code in the application reads or writes that table, so the dashboard and remittance routes return and create synchronization log rows and serve no dashboard or remittance, and the sync route records a log entry and starts no synchronization.'),
  D('DEF-0B4-CLC-SYNC-LOG-MEMBER-READ-AND-FORGEABLE-VERIFICATION', CLC_GATE, 'HIGH', 'The routes read the whole clc_sync_log row, with errorMessage, errorDetails, syncData and dataHash, at the member floor, and the steward create stores any body field, including status, record counts, isVerified, verifiedBy and verifiedAt, so a steward can record a synchronization as verified that never ran and every member can read integration error details.'),
]

const clcLabel = (route) => ({ 'clc/dashboard/route.ts': 'dashboard', 'clc/remittances/route.ts': 'remittances', 'clc/sync/route.ts': 'sync' })[route]

const clcProfile = (route) => ({
  persona: 'Organization member reading, and steward writing, rows of the CLC synchronization log through the generic CRUD factory',
  owner: 'clc_sync_log rows of the organization. No code other than these three route files writes the table.',
  sens: 'Synchronization type and direction, record counts, error messages and details, data hash and verification fields of synchronization with the Canadian Labour Congress',
  priv: (method) => (method === 'GET'
    ? 'Every member of the organization reads the whole sync row, including errorMessage, errorDetails, syncData and dataHash.'
    : 'Any body field is stored, including status, record counts, dataHash, isVerified, verifiedBy and verifiedAt.'),
  does: (method, _model, floor) => {
    const label = clcLabel(route)
    return method === 'GET'
      ? `Returns clc_sync_log rows of the organization at a role floor of ${floor}, whatever the route name (${label}) says.`
      : `Inserts a clc_sync_log row from the body at a role floor of ${floor}; no synchronization runs and no remittance is recorded.`
  },
  future: 'Serve a dashboard, remittance records and synchronization runs from the services that own them, restrict integration error details to the office that operates the integration, and derive verification fields from the verification itself.',
  gate: CLC_GATE,
  deps: [5, 14],
  status: (_method, _model) => (route === 'clc/sync/route.ts' ? 'PARTIAL' : 'FACADE_OVER_GENERIC_TABLE'),
  def: () => ['DEF-0B4-CLC-ROUTES-FACADE-OVER-SYNC-LOG', 'DEF-0B4-CLC-SYNC-LOG-MEMBER-READ-AND-FORGEABLE-VERIFICATION'],
  extraEv: (a) => [
    a.sch('privacy', CLC_TABLE_FILE, /errorDetails: jsonb\("error_details"\)/, { symbol: 'clcSyncLog' }),
    a.sch('defect', CLC_TABLE_FILE, /isVerified: boolean\("is_verified"\)\.default\(false\)/, { symbol: 'clcSyncLog' }),
    ...(a.method === 'GET' ? [a.imp('privacy', 'crudRoutes', /db\.select\(\)\.from\(table\)/)] : []),
  ],
  reqRead: 'Audit reads of integration error details once the readers are named.',
})

const CLC_INFERENCE = {
  claim: 'implementation',
  statement: 'A search of the tracked application source for the clcSyncLog export finds it only in the three clc route files and in schema files, so no service reads or writes clc_sync_log and no code produces a dashboard or a remittance.',
}

export const OHS_DEFECTS = [
  D('DEF-0B4-OHS-FILINGS-OWNER-FILTER-INCONSISTENT', OHS_GATE, 'MEDIUM', 'The CNESST filing collection declares ownerColumn memberId, so the factory compares the uuid memberId column with the session user id for every caller, steward included, while the item routes declare no ownerColumn and let a steward read any filing of the organization; the source does not show that the session user id is the member id, so the collection and the item routes disagree about which filings a steward may see.'),
  D('DEF-0B4-OHS-FILINGS-NO-CASE-AUTHORITY', OHS_GATE, 'HIGH', 'The CNESST filing item routes and the create read and write any filing of the organization for a steward role floor, accept any memberId, incidentId and unionRepId in the body, and do not check that the steward represents the member the filing concerns; a filing holds the member injury narrative, outcome and compensation awarded.'),
  D('DEF-0B4-OHS-ANTI-SCAB-RECORD-NO-AUTHOR-OR-CASE-AUTHORITY', OHS_GATE, 'MEDIUM', 'anti_scab_violations has no createdBy column, so the factory records no author, reportedById and reportedByName are taken from the body rather than the session, and any steward of the organization can change the outcome fields (resolved, penaltyAmount, injunctionGranted, tatFileNumber) of any violation record.'),
  D('DEF-0B4-OHS-REGULATORY-RECORD-HARD-DELETE', OHS_GATE, 'MEDIUM', 'The anti-scab violation and joint committee tables have no status column, so the fixed administrator delete of the factory removes the regulatory record permanently; only the audit record of the delete remains, and no source names a retention rule for them.'),
  D('DEF-0B4-OHS-COMMITTEE-ROSTER-MEMBER-READ', OHS_GATE, 'LOW', 'The joint committee read sits at the member floor and returns the worker representative list with member identifiers, names and roles, and the worker co-chair identifier, to every member of the organization.'),
]

const OHS_OWNER_ARCHIVE = 'DEF-0B4-OHS-REGULATORY-RECORD-HARD-DELETE'

const antiScabProfile = {
  persona: 'Steward and above reporting and managing anti-scab violations during a strike or lockout through the generic CRUD factory',
  owner: 'anti_scab_violations rows of the organization; the reporter is recorded only if the body supplies reportedById and reportedByName.',
  sens: 'Strike or lockout dates, violation descriptions, evidence summaries, replacement worker counts, tribunal complaint and injunction status, penalty amounts and the reporter name',
  priv: (method) => (method === 'GET'
    ? 'Steward and above read every violation record of the organization, including evidence summaries and the reporter name.'
    : method === 'DELETE'
      ? 'The record is removed permanently; only the audit record of the delete remains.'
      : 'Any body field is stored, including the outcome fields resolved, penaltyAmount and injunctionGranted and the reporter identity.'),
  does: (method, _model, floor) => ({
    GET: `Returns anti_scab_violations rows of the organization at a role floor of ${floor}.`,
    POST: `Inserts an anti_scab_violations row from the body at a role floor of ${floor}; the table has no createdBy column, so no author is recorded.`,
    PATCH: `Updates an anti_scab_violations row with any body field except the primary key and organization at a role floor of ${floor}.`,
    DELETE: `Permanently removes an anti_scab_violations row at the fixed administrator floor of the generic delete (${floor}).`,
  })[method],
  future: 'Record the reporter from the session, restrict outcome fields to the office that files with the tribunal, retain rather than delete regulatory records, and decide read access from the case the violation belongs to.',
  gate: OHS_GATE,
  deps: [2, 13],
  status: () => 'PARTIAL',
  def: (method) => [
    ...(method === 'POST' || method === 'PATCH' ? ['DEF-0B4-OHS-ANTI-SCAB-RECORD-NO-AUTHOR-OR-CASE-AUTHORITY'] : []),
    ...(method === 'DELETE' ? [OHS_OWNER_ARCHIVE] : []),
  ],
  extraEv: (a) => [
    a.tbl('privacy', 'antiScabViolations', /reportedById: uuid\("reported_by_id"\)/),
    a.tbl('defect', 'antiScabViolations', /pgTable\(/, { absentColumns: ['createdBy'] }),
  ],
  reqRead: 'Audit reads of violation records once the readers are named; they describe a labour dispute and identify the reporter.',
}

const filingsProfile = {
  persona: 'Steward and above managing CNESST and tribunal filings for members through the generic CRUD factory',
  owner: 'cnesst_filings rows of the organization; the member the filing concerns is memberId and the representing steward is unionRepId.',
  sens: 'Workplace injury and occupational-disease filing narratives, legal basis, filing deadlines, decisions, outcome, compensation awarded, and the member and union representative identifiers',
  priv: (method) => (method === 'GET'
    ? 'Any steward of the organization reads a member injury or tribunal filing, with outcome and compensation, without holding the case; the collection narrows the list to rows whose memberId equals the session user id.'
    : 'Any body field is stored, including memberId, incidentId, unionRepId, status, outcome and compensationAwarded.'),
  does: (method, _model, floor) => ({
    GET: `Returns cnesst_filings rows at a role floor of ${floor}; the collection route adds a memberId equals session user id condition, the item route does not.`,
    POST: `Inserts a cnesst_filings row from the body, with createdBy set to the session user, at a role floor of ${floor}.`,
    PATCH: `Updates a cnesst_filings row with any body field except the primary key and organization at a role floor of ${floor}.`,
    DELETE: `Sets status archived on a cnesst_filings row at the fixed administrator floor of the generic delete (${floor}).`,
  })[method],
  future: 'Decide filing visibility and change authority from the case the filing belongs to and the representing steward, force memberId and unionRepId from the case, and use one owner rule on the collection and the item routes.',
  gate: OHS_GATE,
  deps: [2, 13],
  status: () => 'PARTIAL',
  def: () => ['DEF-0B4-OHS-FILINGS-NO-CASE-AUTHORITY', 'DEF-0B4-OHS-FILINGS-OWNER-FILTER-INCONSISTENT'],
  extraEv: (a) => [
    a.tbl('privacy', 'cneesstFilings', /memberId: uuid\("member_id"\)/),
    a.tbl('privacy', 'cneesstFilings', /compensationAwarded: numeric/),
    a.sch('privacy', LOW_ROLE, "const OWNER_COLUMNS = ['userId', 'memberId'] as const"),
    ...(a.route === 'cnesst/filings/route.ts' ? [a.imp('defect', 'crudRoutes', 'conditions.push(eq(ownerCol, userId));')] : []),
  ],
  reqRead: 'Audit reads of filings: they hold member injury narratives and compensation.',
}

const committeeProfile = {
  persona: 'Organization member reading, and officer maintaining, joint health and safety committee records through the generic CRUD factory',
  owner: 'joint_hs_committees rows of the organization, with worker and employer representative lists held as json.',
  sens: 'Committee composition with worker representative member identifiers, names and roles, co-chairs, meeting schedule and prevention program approval',
  priv: (method) => (method === 'GET'
    ? 'Every member of the organization reads the committee record, including the worker representative member identifiers and the worker co-chair identifier.'
    : method === 'DELETE'
      ? 'The committee record is removed permanently; only the audit record of the delete remains.'
      : 'Any body field is stored, including the worker and employer representative lists and the co-chair identifiers.'),
  does: (method, _model, floor) => ({
    GET: `Returns joint_hs_committees rows of the organization at a role floor of ${floor}.`,
    POST: `Inserts a joint_hs_committees row from the body at a role floor of ${floor}.`,
    PATCH: `Updates a joint_hs_committees row with any body field except the primary key and organization at a role floor of ${floor}.`,
    DELETE: `Permanently removes a joint_hs_committees row at the fixed administrator floor of the generic delete (${floor}).`,
  })[method],
  future: 'Restrict representative identifiers to the committee and its union officers, validate the equal-representation rule on write, and retain rather than delete committee records.',
  gate: OHS_GATE,
  deps: [2, 13],
  status: () => 'PARTIAL',
  def: (method) => [
    ...(method === 'GET' ? ['DEF-0B4-OHS-COMMITTEE-ROSTER-MEMBER-READ'] : []),
    ...(method === 'DELETE' ? [OHS_OWNER_ARCHIVE] : []),
  ],
  extraEv: (a) => [a.tbl('privacy', 'jointHsCommittees', /workerRepresentatives: jsonb\("worker_representatives"\)/)],
}

const OHS_PROFILES = new Map([
  ['cnesst/anti-scab/route.ts', antiScabProfile],
  ['cnesst/anti-scab/[id]/route.ts', antiScabProfile],
  ['cnesst/filings/route.ts', filingsProfile],
  ['cnesst/filings/[id]/route.ts', filingsProfile],
  ['cnesst/hs-committees/route.ts', committeeProfile],
  ['cnesst/hs-committees/[id]/route.ts', committeeProfile],
])

const ITEM_ROUTE_NO_OWNER = {
  claim: 'defect',
  statement: 'The item route configuration lists table, pk, tags, orgScoped, itemRoute, readRole and writeRole and no ownerColumn, so the factory applies no owner condition to it.',
}

export function ohsFacts(a, readText) {
  if (CLC_ROUTES.has(a.route)) {
    const record = crudRecord(a, readText, clcProfile(a.route))
    record.inferences = [...record.inferences, CLC_INFERENCE]
    return record
  }
  const profile = OHS_PROFILES.get(a.route)
  if (!profile) throw new Error(`no OHS facts for ${a.route}|${a.method}`)
  const record = crudRecord(a, readText, profile)
  if (a.route === 'cnesst/filings/[id]/route.ts') {
    const model = crudModel(a, readText)
    if (model.explicitOwner) throw new Error('filings item route unexpectedly declares ownerColumn')
    record.inferences = [...record.inferences, ITEM_ROUTE_NO_OWNER]
  }
  return record
}
