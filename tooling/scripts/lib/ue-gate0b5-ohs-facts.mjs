/**
 * Gate 0B.5 facts for the CNESST preventive withdrawal, right-of-refusal and pay equity routes. All fifteen operations
 * are the generic CRUD factory over an OPERATIONAL table. The route configuration, the table definition and the
 * factory behaviour are read from source by the CRUD helper; this module states only what no source line can say, and
 * the defects the source lines prove.
 */
import { crudRecord, crudModel } from './ue-gate0b5-crud.mjs'

const OHS_GATE = 6
const D = (id, gate, severity, title) => ({ id, gate, severity, title })

export const WITHDRAWAL_ROUTES = new Set(['cnesst/preventive-withdrawals/[id]/route.ts', 'cnesst/preventive-withdrawals/route.ts'])
export const REFUSAL_ROUTES = new Set(['cnesst/right-of-refusal/[id]/route.ts', 'cnesst/right-of-refusal/route.ts'])
export const PAY_EQUITY_ROUTES = new Set(['cnesst/pay-equity/[id]/route.ts', 'cnesst/pay-equity/route.ts'])
export const CNESST_ROUTES = new Set([...WITHDRAWAL_ROUTES, ...REFUSAL_ROUTES, ...PAY_EQUITY_ROUTES])

export const OHS_DEFECTS_0B5 = [
  D('DEF-0B5-OHS-OWNER-COLUMN-WORKERID-ABSENT', OHS_GATE, 'MEDIUM', 'The collection routes of preventive_withdrawals and right_of_refusal_events declare ownerColumn workerId, and neither table has a workerId column, so the factory resolves no owner column and applies no owner condition: the declared owner scope is not applied, and the item routes of the same tables declare no owner scope at all.'),
  D('DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY', OHS_GATE, 'HIGH', 'Any steward of the organization reads, creates and rewrites any member preventive withdrawal and right-of-refusal record, and accepts memberId, memberName, cneesstFilingId and the outcome fields from the body, without holding the member case; the withdrawal holds the physician name, medical certificate date, reassignment and income replacement amounts, and the refusal holds the reprisal complaint details.'),
  D('DEF-0B5-OHS-REFUSAL-EVENT-HARD-DELETE', OHS_GATE, 'MEDIUM', 'right_of_refusal_events has no status column, so the fixed administrator delete of the factory removes the regulatory record of a refusal and any reprisal complaint permanently; only the audit record of the delete remains, and no source names a retention rule.'),
]

export const PAY_EQUITY_DEFECTS = [
  D('DEF-0B5-PAY-EQUITY-NO-STATE-MACHINE-OR-DEADLINES', OHS_GATE, 'MEDIUM', 'The pay equity routes store any body field, including status, results and adjustment amounts, so an officer can record an exercise as adjustments_paid without the intermediate states; the contest deadline and the next maintenance date are plain date columns whose statutory rules (sixty days from posting, every five years) exist only as schema comments, so no source computes or enforces them.'),
]

const sensWithdrawal = 'Pregnancy, breastfeeding or hazardous-exposure reason, physician name, medical certificate date, reassignment details, employer paid days and CNESST income replacement amounts of a named member'
const sensRefusal = 'Task refused and danger description, supervisor, health and safety representative and CNESST inspector names, inspector decision, outcome, corrective actions and reprisal complaint details of a named member'
const sensEquity = 'Pay equity committee worker and employer member names and represented groups, job class counts, evaluation method, results and contest dates, adjustment amounts and the CNESST declaration state'

const withdrawalProfile = {
  persona: 'Steward and above recording preventive withdrawals of members from hazardous work through the generic CRUD factory',
  owner: 'preventive_withdrawals rows of the organization; the member the withdrawal concerns is memberId, and the table records no author.',
  sens: sensWithdrawal,
  priv: (method) => (method === 'GET'
    ? 'Any steward of the organization reads the medical certificate date, physician name and income replacement amounts of any member, without holding the member case.'
    : method === 'DELETE'
      ? 'The row is archived (status archived) by the fixed administrator delete; only the audit record of the delete remains.'
      : 'Any body field is stored, including memberId, memberName, cneesstFilingId, status, physician name and income replacement amounts.'),
  does: (method, _model, floor) => ({
    GET: `Returns preventive_withdrawals rows of the organization at a role floor of ${floor}${method === 'GET' ? '' : ''}.`,
    POST: `Inserts a preventive_withdrawals row from the body at a role floor of ${floor}.`,
    PATCH: `Updates a preventive_withdrawals row with any body field except the primary key and organization at a role floor of ${floor}.`,
    DELETE: `Sets status archived on a preventive_withdrawals row at the fixed administrator floor of the generic delete (${floor}).`,
  })[method],
  future: 'Decide who may see and change a withdrawal from the member case and the representing steward, force memberId from the case, resolve one owner rule for the collection and item routes, and retain rather than delete the record.',
  gate: OHS_GATE,
  deps: [2, 13],
  status: () => 'PARTIAL',
  def: (method, model) => [
    'DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY',
    ...(model.explicitOwner && !model.columns.includes(model.explicitOwner) ? ['DEF-0B5-OHS-OWNER-COLUMN-WORKERID-ABSENT'] : []),
  ],
  extraEv: (a) => [
    a.tbl('privacy', 'preventiveWithdrawals', /physicianName: varchar\("physician_name"/),
    a.tbl('privacy', 'preventiveWithdrawals', /cneesstIrrWeeklyAmount: numeric/),
  ],
  reqRead: 'Audit reads of withdrawals: they hold medical certificate dates, physician names and income replacement amounts of pregnant or breastfeeding members.',
}

const refusalProfile = {
  persona: 'Steward and above recording the exercise of the right to refuse dangerous work through the generic CRUD factory',
  owner: 'right_of_refusal_events rows of the organization; the member who refused is memberId, and the table records no author.',
  sens: sensRefusal,
  priv: (method) => (method === 'GET'
    ? 'Any steward of the organization reads the danger description, inspector decision and reprisal complaint details of any member, without holding the member case.'
    : method === 'DELETE'
      ? 'The row is removed permanently; only the audit record of the delete remains.'
      : 'Any body field is stored, including memberId, memberName, the outcome fields and the reprisal complaint details.'),
  does: (method, _model, floor) => ({
    GET: `Returns right_of_refusal_events rows of the organization at a role floor of ${floor}.`,
    POST: `Inserts a right_of_refusal_events row from the body at a role floor of ${floor}.`,
    PATCH: `Updates a right_of_refusal_events row with any body field except the primary key and organization at a role floor of ${floor}.`,
    DELETE: `Permanently removes a right_of_refusal_events row at the fixed administrator floor of the generic delete (${floor}).`,
  })[method],
  future: 'Decide who may see and change a refusal record from the member case and the representing steward, retain rather than delete the record, and audit reads of reprisal complaint details.',
  gate: OHS_GATE,
  deps: [2, 13],
  status: () => 'PARTIAL',
  def: (method, model) => [
    'DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY',
    ...(model.explicitOwner && !model.columns.includes(model.explicitOwner) ? ['DEF-0B5-OHS-OWNER-COLUMN-WORKERID-ABSENT'] : []),
    ...(method === 'DELETE' ? ['DEF-0B5-OHS-REFUSAL-EVENT-HARD-DELETE'] : []),
  ],
  extraEv: (a) => [
    a.tbl('privacy', 'rightOfRefusalEvents', /reprisalDetails: text\("reprisal_details"\)/),
    a.tbl('privacy', 'rightOfRefusalEvents', /dangerDescription: text\("danger_description"\)/),
  ],
  reqRead: 'Audit reads of refusal records: they hold reprisal complaint details of named members.',
}

const payEquityProfile = {
  persona: 'Steward reading, and officer maintaining, the pay equity exercises of the organization through the generic CRUD factory',
  owner: 'pay_equity_exercises rows of the organization; the table has no author column and no link to the employer or bargaining unit the exercise concerns.',
  sens: sensEquity,
  priv: (method) => (method === 'GET'
    ? 'Any steward of the organization reads the names of the worker and employer committee members and the adjustment amounts.'
    : method === 'DELETE'
      ? 'The row is archived (status archived) by the fixed administrator delete; only the audit record of the delete remains.'
      : 'Any body field is stored, including status, results, adjustment amounts and the committee member lists.'),
  does: (method, _model, floor) => ({
    GET: `Returns pay_equity_exercises rows of the organization at a role floor of ${floor}.`,
    POST: `Inserts a pay_equity_exercises row from the body at a role floor of ${floor}.`,
    PATCH: `Updates a pay_equity_exercises row with any body field except the primary key and organization at a role floor of ${floor}.`,
    DELETE: `Sets status archived on a pay_equity_exercises row at the fixed administrator floor of the generic delete (${floor}).`,
  })[method],
  future: 'Drive the status from the exercise steps, compute the contest deadline and the maintenance date from the posting date, restrict committee member names to the committee and union officers, and retain the exercise record.',
  gate: OHS_GATE,
  deps: [13, 14],
  status: () => 'PARTIAL',
  def: (method) => (method === 'POST' || method === 'PATCH' ? ['DEF-0B5-PAY-EQUITY-NO-STATE-MACHINE-OR-DEADLINES'] : []),
  extraEv: (a, model) => [
    a.tbl('privacy', 'payEquityExercises', /workerMembers: jsonb\("worker_members"\)/),
    ...(a.method === 'POST' || a.method === 'PATCH' ? [a.tbl('defect', 'payEquityExercises', /contestDeadline: date\("contest_deadline"\), \/\/ 60 days from posting/)] : []),
    ...(model.hasStatus ? [] : []),
  ],
  reqRead: 'Audit reads of pay equity exercises once the readers are named: they list committee members by name.',
}

export function cnesstFacts(a, readText) {
  const profile = WITHDRAWAL_ROUTES.has(a.route) ? withdrawalProfile : REFUSAL_ROUTES.has(a.route) ? refusalProfile : payEquityProfile
  const record = crudRecord(a, readText, profile)
  const model = crudModel(a, readText)
  if (!model.explicitOwner && !PAY_EQUITY_ROUTES.has(a.route)) {
    record.inferences = [...record.inferences, {
      claim: 'defect',
      statement: 'The item route configuration lists table, pk, tags, orgScoped, itemRoute, readRole and writeRole and no ownerColumn, so the factory applies no owner condition to it.',
    }]
  }
  return record
}
