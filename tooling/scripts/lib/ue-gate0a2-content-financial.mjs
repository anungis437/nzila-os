/**
 * Proposed Financial Officer 2.1 baseline.
 *
 * Four of the 38 identifiers have a recovered title or status statement and six more have a group label. The other
 * identifiers have no historical meaning. Every meaning below is a new design and is marked so. No financial mandate is
 * created by any statement here: a financial duty is held through a live mandate, a role title is never a mandate, and
 * no mandate has been issued (FINANCIAL_MANDATES_NOT_ISSUED).
 */
import { buildContract, buildJourney, buildScenario } from './ue-gate0a2-content-lib.mjs'

const A = (p) => `apps/union-eyes/${p}`
const FO2 = 'FO-DISPOSITION-V2'
const NO_MANDATE = 'Where no live mandate exists the answer is that no financial mandate has been issued.'

const BASIS = {
  view: 'FINANCIAL_MANDATE_VIEW', prepare: 'FINANCIAL_MANDATE_PREPARE', approve: 'FINANCIAL_MANDATE_APPROVE',
  execute: 'FINANCIAL_MANDATE_EXECUTE', reconcile: 'FINANCIAL_MANDATE_RECONCILE', audit: 'FINANCIAL_MANDATE_AUDIT',
}

const HIST = {
  F08: { src: FO2, q: 'F08 LIMITED (access restricted; individual-record scoping not runtime-proven)', kind: 'STATUS_STATEMENT', individual: true, note: 'A status statement with no domain title.' },
  F09: { src: FO2, q: 'F09 LIMITED (source preservation only)', kind: 'STATUS_STATEMENT', individual: true, note: 'A status statement with no domain title.' },
  F10: { src: FO2, q: 'F10 (affiliate remittances) UNAVAILABLE', kind: 'TITLE', individual: true },
  F19: { src: FO2, q: 'F19 (trustees) BLOCKED on trustee authority', kind: 'TITLE', individual: true },
}
for (const id of ['F11', 'F12', 'F13', 'F14']) HIST[id] = { src: FO2, q: 'F11/F12/F13/F14 (budgets, expenses, vendors) UNAVAILABLE', kind: 'GROUP_LABEL', individual: false, note: 'Four identifiers, three labels. No one-to-one pairing is recorded.' }
for (const id of ['F17', 'F18']) HIST[id] = { src: FO2, q: 'F17/F18 (strike and restricted funds) UNAVAILABLE', kind: 'GROUP_LABEL', individual: false, note: 'Two identifiers, one label phrase.' }
for (const id of ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F15', 'F16', 'F20', 'F21', 'F22', 'F23', 'F24', 'F25', 'F26', 'F27', 'F28']) HIST[id] = { src: FO2, q: 'all other domains NOT_PROVEN', kind: 'STATUS_ONLY', individual: false, note: 'Status only. The record gives no label for this identifier.' }

const NONE_RECOVERED = 'NONE_RECOVERED'

/** One F-domain: a financial capability with its own duties, segregation, data scope and integration boundary. */
const fo = (n, o) => {
  const id = `F${String(n).padStart(2, '0')}`
  const duties = o.duties ?? []
  const basis = o.basis ?? BASIS[duties[0]]
  const dutyText = duties.length ? duties.join(', ') : 'none'
  return {
    id, kind: 'DOMAIN', hist: HIST[id],
    actor: o.actor ?? (duties.length ? `Holder of a live financial mandate that names the account and the ${dutyText} duty` : o.actorText),
    pre: o.pre ?? ['A live financial mandate that names the account and the duty, held by a principal with a financial capacity.', 'No transaction participation that segregates the duty, and no recusal.', 'Unknown values stay unknown.'],
    auth: {
      basis, kernel: duties.map((d) => `finance:${d}`),
      req: o.authReq ?? `A live financial mandate naming the account and the ${dutyText} duty. A role title, including the Secretary-Treasurer title, is never a mandate. ${NO_MANDATE}`,
    },
    audit: o.audit ?? 'write', priv: o.priv ?? 'PRIV_FINANCIAL_PERSONAL',
    deny: o.deny ?? 'forbid', denyNote: o.denyNote ?? NO_MANDATE,
    design: HIST[id].individual ? 'The recovered title or status statement is kept and the capability is a new specification.' : 'The meaning is a new design choice. It is not historically evidenced.',
    extra: {
      financial: {
        historicalMeaningRecovered: HIST[id].individual && HIST[id].kind === 'TITLE' ? HIST[id].q : HIST[id].individual ? `Status statement only: ${HIST[id].q}` : NONE_RECOVERED,
        operationalCapability: o.cap,
        requiredFinancialAuthority: { duties, authorizationBasisId: basis, mandateRequired: true, derivedFromRoleTitle: false },
        requiredSegregationOfDuties: o.sod,
        dataAndReportingScope: o.data,
        integrationBoundary: o.integ,
      },
    },
    ...o,
    duties: undefined,
  }
}

const navFo = (n, title, recovered, route, status, desc, resource, rel, note) => ({
  id: `FO-NAV-${n}`, kind: 'NAVIGATION', title,
  hist: recovered ? { src: FO2, q: `"${title}"`, kind: 'NAME', individual: true } : null,
  desc,
  actor: 'A signed-in principal who holds at least one live financial mandate or financial appointment',
  trigger: `The principal opens ${title} from the financial navigation.`,
  resource,
  pre: ['A live membership in the active organization.', 'At least one live financial mandate or appointment. The entry is not shown to anyone else.', 'The destination is real. An entry whose destination would be unavailable is not advertised.'],
  act: `Enter ${title} and see only the records and duties the principal\u2019s live mandates name.`,
  result: 'None. Entering a destination persists nothing.',
  auth: { basis: 'ACTIVE_MEMBERSHIP_NAVIGATION', kernel: [], req: 'A live membership. The entry shows only what live mandates name; the entry itself confers no duty.' },
  audit: 'view', priv: 'PRIV_NONE',
  ui: `${title} lists only the accounts and duties of the principal\u2019s live mandates. With none, the entry is absent.`,
  deny: 'closed', denyNote: 'A principal with no live mandate sees no financial navigation.',
  impl: { status, routes: route ? [route] : [], cap: null, note },
  rel, adopt: ['DEC-IA-16', 'DEC-IA-31'], evidence: [],
  design: recovered ? 'The destination name is recovered from the Financial Officer 2.1 record. The definition is new.' : 'A proposed new destination name. It is not a recovered name.',
  open: ['DEC-PD-10'],
  extra: { navigationNameOrigin: recovered ? 'RECOVERED_HISTORICAL_NAME' : 'PROPOSED_NEW_NAME' },
})

const navs = [
  navFo(1, 'Accounts & Cash', true, A('app/[locale]/dashboard/finance/page.tsx'), 'NOT_IMPLEMENTED', 'Accounts, funds and cash position for the accounts a mandate names. The existing finance page shows Nzila platform billing and is not union finance, so it is not this destination.', 'Accounts, balances and cash movements of the organization, limited to named accounts.', ['F02', 'F03', 'F20'], 'The disposition records the destination as not implemented. The nearest page is labelled platform billing.'),
  navFo(2, 'Budgets & Spending', true, A('app/[locale]/dashboard/financial/page.tsx'), 'UNAVAILABLE_501', 'Budgets, expenses and vendors. Shown only when a qualified engine exists.', 'Budget, expense and vendor records.', ['F11', 'F12', 'F13', 'F14'], 'The page renders a not-available state and the APIs return HTTP 501.'),
  navFo(3, 'Funds & Programs', true, A('app/[locale]/dashboard/strike-fund/page.tsx'), 'UNAVAILABLE_501', 'Strike funds, restricted funds and the programs they support. Shown only when a qualified engine exists.', 'Fund and program records.', ['F17', 'F18', 'F24'], 'The page renders a not-available state and the APIs return HTTP 501.'),
  navFo(4, 'Dues & Remittances', false, A('app/[locale]/dashboard/finance/remittances/page.tsx'), 'PARTIAL_SOURCE', 'Dues billing, arrears, employer remittances and reconciliation queues.', 'Dues ledger, arrears, remittance and reconciliation records for named accounts.', ['F04', 'F05', 'F06', 'F08', 'F09', 'F20'], 'A remittances page and dues routes exist. Their authority is a role allow-list in part.'),
  navFo(5, 'Approvals & Payments', false, null, 'NOT_IMPLEMENTED', 'Payments waiting for the next duty: prepare, approve, execute or reconcile, each shown only to a holder of that duty.', 'Registered payments and their duty state.', ['F15', 'F16', 'FJ05'], 'The duty workflow exists as a route. No page shows it.'),
  navFo(6, 'Reports & Records', false, null, 'NOT_IMPLEMENTED', 'Financial reports and the records behind them, read under a view duty. Exports are a separate duty-checked action.', 'Reports over records the viewer holds a view duty on.', ['F22', 'F25', 'F27'], 'No union financial report engine exists. The existing finance reports describe platform billing.'),
  navFo(7, 'Mandates & Oversight', false, null, 'NOT_IMPLEMENTED', 'The register of financial mandates, their holders, limits and expiry, and the audit and trustee oversight surfaces.', 'Financial mandates, appointments and oversight records.', ['F01', 'F19', 'F21', 'F26'], 'A mandate lifecycle service exists. No page or route exposes it.'),
]

const REG = 'The kernel names an account by id; no account-structure record is read here.'

const domains = [
  fo(1, {
    title: 'Financial mandate register',
    desc: 'The register of financial mandates: who holds which duty on which account, within what limit and until when. It supports issuing, accepting, suspending and revoking a mandate. No mandate exists until a successful issue.',
    basis: 'FINANCIAL_MANDATE_ADMINISTRATION', duties: [], actorText: 'The issuer, the holder and the approver of a mandate, who are three different people',
    trigger: 'An authorized issuer opens a mandate for issue, or a holder accepts or a party revokes it.',
    resource: 'One financial mandate and its parties, powers, account, limit, currency and term.',
    pre: ['A live issuance rule adopted by the institution.', 'The issuer, holder and approver are three different people.', 'The term is not expired.'],
    act: 'Issue, activate (by the holder), suspend or revoke a mandate.',
    result: 'One mandate row or one status change with the three parties and time.',
    authReq: 'A live issuance rule (DEC-IA-16). The holder activates. No mandate is issued from a request body or derived from a role title.',
    ui: 'The register lists each mandate with its status. With none issued it says that no financial mandate has been issued.',
    cap: 'The register is the only way a financial duty comes to exist.',
    sod: 'Issuer, holder and approver are three different people.', data: 'Mandate records for the organization. No transaction data.', integ: 'None.',
    impl: { status: 'PARTIAL_SOURCE', services: [A('lib/finance/financial-mandate-lifecycle.ts')], cap: 'UE-FIN-UNION-BUDGETS-EXPENSES-VENDORS', note: 'The lifecycle service issues, activates and revokes. No route or page exposes it and no issuance rule is adopted.' },
    adopt: ['DEC-IA-16', 'DEC-IA-17', 'DEC-IA-28'], rel: ['FJ01', 'FJ10', 'F26', 'FO-NAV-7'], open: ['DEC-PD-09'],
    audit: 'write', deny: 'unavailable', denyNote: 'Without an adopted issuance rule nothing is issued.',
  }),
  fo(2, {
    title: 'Chart of accounts and fund structure',
    desc: 'The list of accounts and funds the organization keeps, each with a type, a currency and an owner of record. A duty names an account from this list.',
    duties: ['prepare', 'view'],
    trigger: 'A preparer opens the account list or proposes a new account.', resource: 'Account and fund definitions of the organization.',
    act: 'View accounts; prepare a new or changed account for approval.', result: 'A prepared account change awaiting approval.',
    ui: 'The list of accounts the mandate names, each with type and currency.',
    cap: 'Gives each duty an account to name.', sod: 'The preparer of an account change does not approve it.',
    data: 'Account definitions. Balances are F03.', integ: 'No bank or accounting connection.',
    impl: { status: 'NOT_IMPLEMENTED', cap: null, note: REG }, adopt: ['DEC-IA-16', 'DEC-IA-18'], rel: ['FO-NAV-1', 'F03'], open: ['DEC-PD-09'],
  }),
  fo(3, {
    title: 'Cash position and account balances',
    desc: 'The current balance of each named account and recent movements, as known. An unknown balance is shown as unknown.',
    duties: ['view'],
    trigger: 'A viewer opens Accounts & Cash.', resource: 'Balances and movements of named accounts.',
    act: 'Read balances and movements.', result: 'None.', audit: 'sensitiveRead',
    ui: 'Balances with their as-of time. Unknown values are labelled unknown and never zero.',
    cap: 'Shows what is held and where.', sod: 'None. A read duty does not segregate.',
    data: 'Balances and movements for named accounts only.', integ: 'No bank feed is connected; balances come only from recorded transactions.',
    impl: { status: 'NOT_IMPLEMENTED', cap: null, note: 'No cash-position view exists for union accounts. The finance dashboard reports platform billing.' }, adopt: ['DEC-IA-16'], rel: ['FO-NAV-1', 'F02'], open: ['DEC-PD-09'],
  }),
  fo(4, {
    title: 'Dues rates and billing cycle',
    desc: 'The dues rate schedule and the billing cycle that creates dues charges for members. A cycle run is prepared, approved and executed as separate duties.',
    duties: ['prepare', 'approve'],
    trigger: 'A preparer opens the billing cycle for a period.', resource: 'Dues rate schedule and one billing cycle.',
    act: 'Prepare a billing cycle; approve it by a different holder.', result: 'A prepared and then approved cycle record.',
    ui: 'The cycle shows its period, rates, counts and status.',
    cap: 'Creates the charges that members later see.', sod: 'The preparer of a cycle does not approve it. The approver does not execute any payment against it.',
    data: 'Dues rates and cycle records for the organization.', integ: 'The scheduler is not activated and a native scheduler hardcodes a test tenant.',
    impl: { status: 'PARTIAL_SOURCE', routes: [A('app/api/dues/billing-cycle/route.ts'), A('app/api/dues/calculate/route.ts')], cap: 'UE-FIN-DUES-CALCULATION-WORKFLOW', note: 'Billing-cycle and calculation routes exist and show no kernel signal. The disposition moved them to a role allow-list.' },
    adopt: ['DEC-IA-18', 'DEC-IA-27'], rel: ['FJ02', 'FO-NAV-4'], open: ['DEC-PD-09'],
  }),
  fo(5, {
    title: 'Member dues charges and late fees',
    desc: 'Individual charges, late fees and adjustments on a member account, each prepared and approved before it affects a balance.',
    duties: ['prepare', 'approve'],
    trigger: 'A preparer opens a member charge or fee.', resource: 'One member dues charge, fee or adjustment.',
    act: 'Prepare a charge or waiver; approve it by a different holder.', result: 'A charge or waiver record with preparer and approver.',
    ui: 'The member account shows the charge with its reason and status.',
    cap: 'Keeps a member balance explainable.', sod: 'The preparer of a waiver does not approve it. A person does not adjust their own member account.',
    data: 'Member account records for named accounts.', integ: 'None.',
    impl: { status: 'PARTIAL_SOURCE', routes: [A('app/api/dues/late-fees/route.ts')], cap: 'UE-FIN-DUES-CALCULATION-WORKFLOW', note: 'A late-fees read route exists. No prepare and approve workflow for charges exists.' },
    adopt: ['DEC-IA-18', 'DEC-IA-27'], rel: ['F08', 'FJ04'], open: ['DEC-PD-09'],
  }),
  fo(6, {
    title: 'Arrears follow-up and payment plans',
    desc: 'Following up on members in arrears: reminders, payment plans and exceptions. A plan is prepared and then approved.',
    duties: ['prepare', 'approve'],
    trigger: 'A preparer opens the arrears list.', resource: 'Arrears records, reminders and payment plans.',
    act: 'Prepare a reminder or plan; approve the plan by a different holder.', result: 'A reminder record or a plan record.',
    ui: 'The arrears list with each member\u2019s state; the plan shows its schedule.',
    cap: 'Recovers dues without exposing member data to unrelated staff.', sod: 'The preparer of a plan does not approve it.',
    data: 'Member financial records for named accounts only.', integ: 'No collections agency or card rail.',
    impl: { status: 'PARTIAL_SOURCE', routes: [A('app/api/dues/arrears/route.ts'), A('app/api/dues/payment-plans/route.ts'), A('app/api/dues/arrears/[id]/reminder/route.ts')], cap: 'UE-FIN-DUES-REMINDER-SCHEDULER', note: 'Routes exist and are restricted to an explicit role allow-list. They show no kernel signal.' },
    adopt: ['DEC-IA-18', 'DEC-IA-27'], rel: ['FJ04', 'F08'], open: ['DEC-PD-09'],
  }),
  fo(7, {
    title: 'Payment receipts and allocation',
    desc: 'Recording a payment received and allocating it to the member account or charge it settles. Allocation is prepared and approved before the ledger changes.',
    duties: ['prepare', 'approve'],
    trigger: 'A received payment appears for allocation.', resource: 'One received payment and its allocation.',
    act: 'Prepare an allocation; approve it by a different holder.', result: 'An allocation record.',
    ui: 'The payment shows what it settles and what remains.',
    cap: 'Ties money received to what it settles.', sod: 'The person who prepares an allocation does not approve or execute it.',
    data: 'Payment and allocation records.', integ: 'Stripe and PayPal webhooks exist; card and wallet rails are not authorized (DEC-IA-20).',
    impl: { status: 'PARTIAL_SOURCE', routes: [A('app/api/finance/allocation/route.ts'), A('app/api/payments/webhooks/stripe/route.ts')], cap: 'UE-DUES-DIRECT-PAYMENT', note: 'Allocation and webhook routes exist and show no kernel signal. Their domain is not shown to be union finance.' },
    adopt: ['DEC-IA-20'], rel: ['F16', 'F20'], open: ['DEC-PD-09'],
  }),
  fo(8, {
    title: 'Member financial record access',
    desc: 'Access to an individual member\u2019s financial record: arrears, ledger, exceptions and history. Access is limited to the member and to a live mandate that names the account. Scoping to one member\u2019s record is specified and is not runtime-proven.',
    duties: ['view'], basis: 'FINANCIAL_MANDATE_VIEW',
    trigger: 'A mandate holder opens a member financial record, or the member opens their own.', resource: 'One member\u2019s financial record.',
    act: 'Read the record the mandate and the member relationship allow.', result: 'None.', audit: 'sensitiveRead',
    authReq: 'A live view mandate that names the account, or the member viewing their own record. Presidents and administrators receive no access by title (DEC-IA-27).',
    ui: 'The record with as-of times. A record outside the mandate does not appear.',
    cap: 'Protects the most personal financial data the union holds.', sod: 'A person who is the subject of the record does not view it through a mandate and does not approve actions on it.',
    data: 'One member\u2019s ledger, arrears and exceptions.', integ: 'None.',
    impl: { status: 'PARTIAL_SOURCE', routes: [A('app/api/dues/ledger/route.ts'), A('app/api/dues/exceptions/route.ts'), A('app/api/dues/arrears/route.ts')], cap: 'UE-FIN-DUES-CALCULATION-WORKFLOW', note: 'Routes are restricted to an explicit role allow-list. Individual-record scoping is not runtime-proven.' },
    adopt: ['DEC-IA-27', 'DEC-IA-16'], rel: ['FO-NAV-4', 'F05', 'F06'], open: ['DEC-PD-09'],
  }),
  fo(9, {
    title: 'Employer remittance source preservation',
    desc: 'An employer remittance file is stored unaltered with its hash, period and employer, and recorded as unparsed. Nothing is matched or posted from it by this capability.',
    duties: ['prepare'], basis: 'FINANCIAL_MANDATE_PREPARE',
    trigger: 'A preparer uploads a remittance file.', resource: 'One employer remittance file and its record.',
    act: 'Hash and store the file, then record it as source preserved and unparsed.', result: 'One remittance record with file reference, hash, period and employer.',
    ui: 'The record shows source preserved and unparsed. A duplicate hash is refused.',
    cap: 'Keeps the original evidence before any matching.', sod: 'The uploader does not reconcile the same remittance (F20).',
    data: 'Remittance files and records.', integ: 'Blob storage stores the bytes. Employer identity is not validated against an employer register.',
    impl: { status: 'SOURCE_PRESENT', routes: [A('app/api/dues/remittances/upload/route.ts')], cap: 'UE-FIN-EMPLOYER-REMITTANCE-INGESTION', note: 'The upload route carries a kernel signal. The disposition records an unparsed state, a duplicate-hash refusal and a fire-and-forget evidence call.' },
    adopt: ['DEC-IA-21'], rel: ['FJ03', 'F20'], open: ['DEC-PD-09'],
  }),
  fo(10, {
    title: 'Affiliate remittances',
    desc: 'Remittances the organization owes to a central or affiliated body: prepared, approved, submitted and reconciled as separate duties.',
    duties: ['prepare', 'approve'],
    trigger: 'A preparer opens an affiliate remittance period.', resource: 'One affiliate remittance.',
    act: 'Prepare a remittance; approve it by a different holder; submit it through a separate execute duty.', result: 'A remittance record at each step.',
    ui: 'The remittance shows its state. Submission and export are not available until adopted.',
    cap: 'Meets obligations to an affiliate.', sod: 'Preparer, approver and submitter are different people.',
    data: 'Affiliate remittance records.', integ: 'The affiliate\u2019s own system. No submission is made.',
    deny: 'unavailable', denyNote: 'The routes answer HTTP 501.',
    impl: { status: 'UNAVAILABLE_501', routes: [A('app/api/admin/clc/remittances/route.ts'), A('app/api/admin/clc/remittances/[id]/submit/route.ts')], cap: 'UE-FIN-AFFILIATE-REMITTANCES', note: 'Every remittance route answers HTTP 501 and imports no table.' },
    adopt: ['DEC-IA-25'], rel: ['FJ08', 'FO-SCN-CUPE'], open: ['DEC-PD-09'],
  }),
  fo(11, {
    title: 'Budgets',
    desc: 'The annual and program budgets: lines, amounts and versions, prepared and approved by different holders.',
    duties: ['prepare', 'approve'],
    trigger: 'A preparer opens a budget.', resource: 'One budget and its lines.',
    act: 'Prepare a budget version; approve it by a different holder.', result: 'A budget version record.',
    ui: 'A budget with its lines and status. Currently a not-available state.',
    cap: 'Sets what may be spent.', sod: 'The preparer of a budget does not approve it.',
    data: 'Budget records.', integ: 'None.', deny: 'unavailable', denyNote: 'The routes answer HTTP 501.',
    impl: { status: 'UNAVAILABLE_501', routes: [A('app/api/financial/budgets/route.ts')], cap: 'UE-FIN-UNION-BUDGETS-EXPENSES-VENDORS', note: 'The budget routes answer HTTP 501. The tables were never created.' },
    adopt: ['DEC-IA-19', 'DEC-IA-18'], rel: ['FO-NAV-2', 'F12'], open: ['DEC-PD-09'],
  }),
  fo(12, {
    title: 'Expenses',
    desc: 'Expense claims and expenditures against a budget line, prepared, approved, paid and reconciled as separate duties.',
    duties: ['prepare', 'approve'],
    trigger: 'A claimant or preparer records an expense.', resource: 'One expense record.',
    act: 'Prepare the expense; approve it by a different holder.', result: 'An expense record at each step.',
    ui: 'The expense shows its state. Currently a not-available state.',
    cap: 'Controls spending.', sod: 'The claimant does not approve their own expense. The approver does not pay it.',
    data: 'Expense records.', integ: 'None.', deny: 'unavailable', denyNote: 'The routes answer HTTP 501.',
    impl: { status: 'UNAVAILABLE_501', routes: [A('app/api/financial/expenses/route.ts')], cap: 'UE-FIN-UNION-BUDGETS-EXPENSES-VENDORS', note: 'The expense routes answer HTTP 501.' },
    adopt: ['DEC-IA-19', 'DEC-IA-18'], rel: ['FJ05', 'F11'], open: ['DEC-PD-09'],
  }),
  fo(13, {
    title: 'Vendors',
    desc: 'The vendors the organization pays: identity, banking reference and status, prepared and approved by different holders before any payment.',
    duties: ['prepare', 'approve'],
    trigger: 'A preparer adds or changes a vendor.', resource: 'One vendor record.',
    act: 'Prepare a vendor change; approve it by a different holder.', result: 'A vendor record change.',
    ui: 'The vendor list with status. Currently a not-available state.',
    cap: 'Prevents payment to an unverified payee.', sod: 'The person who changes a vendor\u2019s bank reference does not approve the change or pay the vendor.',
    data: 'Vendor records.', integ: 'None.', deny: 'unavailable', denyNote: 'The routes answer HTTP 501.',
    impl: { status: 'UNAVAILABLE_501', routes: [A('app/api/financial/vendors/route.ts')], cap: 'UE-FIN-UNION-BUDGETS-EXPENSES-VENDORS', note: 'The vendor routes answer HTTP 501.' },
    adopt: ['DEC-IA-19'], rel: ['FJ06', 'F14'], open: ['DEC-PD-09'],
  }),
  fo(14, {
    title: 'Vendor invoices and payables',
    desc: 'Invoices received from vendors and the payables they create, each matched to an approved expense or budget line before payment.',
    duties: ['prepare', 'approve'],
    trigger: 'A vendor invoice arrives.', resource: 'One vendor invoice and its payable.',
    act: 'Prepare a payable; approve it by a different holder.', result: 'A payable record.',
    ui: 'The payable shows its match and state. Currently a not-available state.',
    cap: 'Pays only what was approved.', sod: 'The person who prepares a payable does not approve it. A duplicate invoice is refused.',
    data: 'Invoice and payable records.', integ: 'None.', deny: 'unavailable', denyNote: 'No vendor engine exists.',
    impl: { status: 'NOT_IMPLEMENTED', cap: 'UE-FIN-UNION-BUDGETS-EXPENSES-VENDORS', note: 'No vendor invoice record exists. The disposition names duplicate-invoice denial as not proven.' },
    adopt: ['DEC-IA-19'], rel: ['FJ06', 'F13'], open: ['DEC-PD-09'],
  }),
  fo(15, {
    title: 'Payment approval',
    desc: 'The approval of a registered payment by a holder who is not its preparer and not a party to it, within the mandate\u2019s limit and currency.',
    duties: ['approve'],
    trigger: 'A prepared payment awaits approval.', resource: 'One registered payment in the financial workflow.',
    act: 'Approve the prepared payment. The workflow records the approval and counts toward the required number of independent approvals.', result: 'One approval step on the payment with approver and time.',
    ui: 'The payment shows its approvals. A refusal says which rule applies.',
    cap: 'Stops a single person moving money.', sod: 'The approver is not the preparer, the executor or a party to the payment.',
    data: 'One payment and its workflow state.', integ: 'None.',
    impl: { status: 'SOURCE_PRESENT', routes: [A('app/api/payments/[id]/duties/route.ts')], services: [A('lib/authority/store/finance-route-adapter.ts')], cap: 'UE-FIN-DUES-CALCULATION-WORKFLOW', note: 'The duties route carries a kernel signal. No mandate is issued, so no approval can succeed today.' },
    adopt: ['DEC-IA-16', 'DEC-IA-18', 'DEC-IA-19'], rel: ['FJ05', 'FO-NAV-5'], open: ['DEC-PD-09'],
  }),
  fo(16, {
    title: 'Payment execution',
    desc: 'The movement of money for an approved payment, performed only in the route that moves it and never by marking a payment executed.',
    duties: ['execute'],
    trigger: 'An approved payment is posted.', resource: 'One approved payment and the ledger entry it creates.',
    act: 'Post the payment, the ledger entry, the arrears update and the audit record in one transaction.', result: 'One ledger entry, one arrears update and one execute step.',
    ui: 'The payment shows executed with the executor. A refusal says which rule applies.',
    cap: 'Moves money only after independent approval.', sod: 'The executor is neither the preparer nor the approver, and does not later reconcile.',
    data: 'One payment and its ledger entry.', integ: 'No processor or bank rail is activated (DEC-IA-20).',
    impl: { status: 'SOURCE_PRESENT', routes: [A('app/api/dues/arrears/[id]/payment/route.ts')], services: [A('lib/dues/arrears-payment.ts')], cap: 'UE-DUES-DIRECT-PAYMENT', note: 'The route delegates to the arrears payment service. The route file shows no kernel signal; the service is the cited place. Conformance is unchecked.' },
    adopt: ['DEC-IA-20', 'DEC-IA-16'], rel: ['FJ05', 'FO-NAV-5'], open: ['DEC-PD-09'],
  }),
  fo(17, {
    title: 'Strike fund',
    desc: 'The strike fund: its balance, contributions and disbursements, each controlled by separate duties and restricted to its purpose.',
    duties: ['prepare', 'approve'],
    trigger: 'A preparer opens the strike fund.', resource: 'The strike fund account and its movements.',
    act: 'Prepare a movement; approve it by a different holder.', result: 'A fund movement record.',
    ui: 'The fund page shows a not-available state until a qualified engine exists.',
    cap: 'Keeps strike money for strike purposes.', sod: 'The preparer of a disbursement does not approve it. A person does not approve their own stipend.',
    data: 'Strike fund records.', integ: 'None.', deny: 'unavailable', denyNote: 'The routes answer HTTP 501.',
    impl: { status: 'UNAVAILABLE_501', routes: [A('app/api/strike/funds/route.ts'), A('app/api/strike-fund/dashboard/route.ts')], cap: 'UE-FIN-STRIKE-FUNDS', note: 'The strike routes answer HTTP 501. The dashboard route shows no kernel signal.' },
    adopt: ['DEC-IA-24'], rel: ['FJ07', 'FO-NAV-3', 'F18'], open: ['DEC-PD-09'],
  }),
  fo(18, {
    title: 'Restricted funds and stipends',
    desc: 'Funds whose use is restricted by purpose or donor, and the stipends and disbursements paid from them. Eligibility is decided by the institution, not by the application.',
    duties: ['prepare', 'approve'],
    trigger: 'A preparer opens a restricted fund or stipend.', resource: 'One restricted fund, stipend or disbursement.',
    act: 'Prepare a disbursement against the restriction; approve it by a different holder.', result: 'A disbursement record.',
    ui: 'A not-available state until adopted.',
    cap: 'Honours restrictions on money.', sod: 'The preparer, approver and executor are different people.',
    data: 'Restricted fund records.', integ: 'None.', deny: 'unavailable', denyNote: 'The routes answer HTTP 501.',
    impl: { status: 'UNAVAILABLE_501', routes: [A('app/api/strike/stipends/route.ts'), A('app/api/strike/disbursements/route.ts'), A('app/api/strike/eligibility/route.ts')], cap: 'UE-FIN-STRIKE-FUNDS', note: 'The stipend, disbursement and eligibility routes answer HTTP 501.' },
    adopt: ['DEC-IA-24'], rel: ['FJ07', 'F17'], open: ['DEC-PD-09'],
  }),
  fo(19, {
    title: 'Trustees',
    desc: 'The trustee register and the oversight a trustee provides. The trustee capacity is earned only by a recorded appointment and never by role.',
    duties: ['view', 'audit'], basis: 'TRUSTEE_APPOINTMENT_DUTY',
    trigger: 'An appointment is recorded, or a trustee opens oversight.', resource: 'The trustee register and oversight records.',
    act: 'Record an appointment; read oversight records under a live mandate.', result: 'An appointment row or none for a read.',
    authReq: 'A recorded trustee appointment and a live mandate naming the duty. Trustee administration needs an independent authority (DEC-IA-22).',
    ui: 'The register shows appointments. Changes are not available until an administration authority exists.',
    cap: 'Gives members independent oversight of finances.', sod: 'A trustee takes no part in a transaction they audit.',
    data: 'Trustee register and oversight records.', integ: 'None.', deny: 'unavailable', denyNote: 'Trustee mutations answer HTTP 501 for every role.',
    impl: { status: 'UNAVAILABLE_501', routes: [A('app/api/pension/trustees/route.ts'), A('app/api/pension/trustees/[id]/route.ts')], cap: 'UE-FIN-PENSION-TRUSTEE-ADMIN', note: 'Trustee routes answer HTTP 501.' },
    adopt: ['DEC-IA-22'], rel: ['FO-NAV-7', 'F21'], open: ['DEC-PD-09'],
  }),
  fo(20, {
    title: 'Reconciliation',
    desc: 'Matching recorded remittances and payments to what was received or paid, resolving differences, and closing a period. The reconciler did not execute the transaction.',
    duties: ['reconcile'],
    trigger: 'A reconciler opens a queue item.', resource: 'One remittance or payment and its match.',
    act: 'Match, reject or accept a variance and record the result.', result: 'A match, rejection or accepted-variance record.',
    ui: 'The queue shows items and variances. Counts claimed by a caller are never accepted as verified.',
    cap: 'Proves records agree with money.', sod: 'The reconciler did not prepare or execute the item.',
    data: 'Remittances, payments and matches.', integ: 'No bank feed or accounting system.',
    impl: { status: 'PARTIAL_SOURCE', routes: [A('app/api/dues/reconciliation/queue/route.ts'), A('app/api/dues/reconciliation/match/route.ts'), A('app/api/dues/reconcile/route.ts')], cap: 'UE-FIN-EMPLOYER-REMITTANCE-INGESTION', note: 'Reconciliation routes carry kernel signals. The disposition records no engine-driven transition to reconciled.' },
    adopt: ['DEC-IA-21'], rel: ['FJ03', 'FJ09'], open: ['DEC-PD-09'],
  }),
  fo(21, {
    title: 'Audit and review access',
    desc: 'An appointed auditor reads the records of named accounts and periods and records findings. The auditor takes no part in the transactions audited.',
    duties: ['audit', 'view'], basis: 'AUDITOR_APPOINTMENT_DUTY',
    trigger: 'An auditor opens an audit period.', resource: 'Records of named accounts and periods.',
    act: 'Read records and record findings.', result: 'A finding record.', audit: 'sensitiveRead',
    authReq: 'A recorded auditor appointment and a live mandate naming the audit duty and period (DEC-IA-23).',
    ui: 'Records within the audit scope with a findings list.',
    cap: 'Independent assurance.', sod: 'The auditor took no part in the transaction audited.',
    data: 'Named accounts and periods only.', integ: 'None.',
    impl: { status: 'NOT_IMPLEMENTED', cap: null, note: 'The auditor capacity exists in the kernel. No audit surface exists.' },
    adopt: ['DEC-IA-23'], rel: ['FJ09', 'F19'], open: ['DEC-PD-09'],
  }),
  fo(22, {
    title: 'Financial statements and reports',
    desc: 'Statements and reports over the records a viewer holds a view duty on. A report is a read; an export is a separate action (F25).',
    duties: ['view'],
    trigger: 'A viewer opens a report.', resource: 'A report over named accounts and periods.',
    act: 'Read the report.', result: 'None.', audit: 'sensitiveRead',
    ui: 'The report states its scope, period and as-of time. Missing data is shown as missing.',
    cap: 'Lets officers and members understand finances.', sod: 'None. A read duty does not segregate.',
    data: 'Aggregates over named accounts. No member-level rows unless the viewer holds the member record duty.', integ: 'None.',
    impl: { status: 'NOT_IMPLEMENTED', cap: null, note: 'No union financial statement exists. The finance exports describe Nzila platform billing.' },
    adopt: ['DEC-IA-16'], rel: ['FO-NAV-6', 'F25'], open: ['DEC-PD-13', 'DEC-PD-09'],
  }),
  fo(23, {
    title: 'Tax slips and receipts',
    desc: 'Receipts and tax slips for members and payees. Issue is a separate execute duty under an institutional registration.',
    duties: ['prepare', 'execute'],
    trigger: 'A period closes and slips are due.', resource: 'Tax slip and receipt records.',
    act: 'Prepare slips; issue them through a separate execute duty.', result: 'A slip record per member or payee.',
    ui: 'Not offered until the institution adopts the registration.',
    cap: 'Meets statutory duties.', sod: 'The preparer of a slip does not issue it.',
    data: 'Member and payee tax records.', integ: 'A tax authority filing is out of scope.', deny: 'unavailable', denyNote: 'No slip is issued.',
    impl: { status: 'NOT_IMPLEMENTED', cap: null, note: 'A receipt read route exists for a member. No union-issued tax slip workflow exists.' },
    adopt: ['DEC-IA-30'], rel: ['F22'], open: ['DEC-PD-09'],
  }),
  fo(24, {
    title: 'Pension and benefit finance',
    desc: 'Pension contributions and benefit payments: records prepared and approved by different holders under the plan\u2019s administrator.',
    duties: ['prepare', 'approve'],
    trigger: 'A preparer opens a contribution or benefit record.', resource: 'Pension plan, contribution and benefit records.',
    act: 'Prepare a record; approve it by a different holder.', result: 'A contribution or benefit record.',
    ui: 'Not offered under the financial baseline until adopted.',
    cap: 'Pays benefits correctly.', sod: 'The preparer of a payment does not approve it.',
    data: 'Pension records.', integ: 'A plan administrator\u2019s system.', deny: 'unavailable', denyNote: 'Writes are not offered.',
    impl: { status: 'PARTIAL_SOURCE', routes: [A('app/api/pension/contributions/route.ts'), A('app/api/pension/benefits/route.ts')], cap: 'UE-FIN-PENSION-TRUSTEE-ADMIN', note: 'Contribution and benefit routes exist and show no kernel signal.' },
    adopt: ['DEC-IA-26'], rel: ['FO-NAV-3', 'F19'], open: ['DEC-PD-09'],
  }),
  fo(25, {
    title: 'External accounting export',
    desc: 'Exporting approved financial records to an external accounting system or an auditor, as a separate duty-checked action with its own record.',
    duties: ['view', 'execute'], basis: 'FINANCIAL_MANDATE_VIEW',
    trigger: 'A holder selects Export.', resource: 'An export of approved records.',
    act: 'Produce the export and record it.', result: 'One export record naming requester, scope, contents and time.',
    ui: 'Not offered until the institution authorizes an export target.',
    cap: 'Moves books to the accountant.', sod: 'The person who exports is not the person who approved the records exported.',
    data: 'Approved records for named accounts.', integ: 'The external system. No connection is configured.', deny: 'unavailable', denyNote: 'No export is offered.',
    impl: { status: 'NOT_IMPLEMENTED', cap: null, note: 'No external accounting connection exists.' },
    adopt: ['DEC-IA-29'], rel: ['FO-NAV-6', 'F22'], open: ['DEC-PD-13', 'DEC-PD-09'],
  }),
  fo(26, {
    title: 'Succession and revocation',
    desc: 'What happens to financial mandates when an office-holder leaves, is suspended or is replaced. A mandate that is not live is not honoured; revocation takes effect when recorded.',
    basis: 'FINANCIAL_MANDATE_ADMINISTRATION', duties: [], actorText: 'The issuer and approver of a revocation or replacement, and the person it affects',
    trigger: 'An office-holder leaves or a mandate must change.', resource: 'Mandates of one person.',
    pre: ['A live issuance rule.', 'The revoker is not the person revoked.'],
    act: 'Revoke the mandates; issue replacements through the register.', result: 'Revocation rows and, later, new mandates.',
    authReq: 'A live issuance rule (DEC-IA-28) for the mandates concerned. Succession is never automatic.',
    ui: 'The register shows the revoked mandates and the reason.',
    cap: 'Ends access when a person leaves.', sod: 'The person revoked does not take part in the revocation.',
    data: 'Mandate records.', integ: 'The membership system supplies departure facts.',
    impl: { status: 'PARTIAL_SOURCE', services: [A('lib/finance/financial-mandate-lifecycle.ts')], cap: null, note: 'The lifecycle service revokes a mandate and lists expired mandates. No route or rule applies it on departure.' },
    adopt: ['DEC-IA-28'], rel: ['FJ10', 'F01'], open: ['DEC-PD-09'], audit: 'write', deny: 'unavailable', denyNote: 'No automatic succession exists.',
  }),
  fo(27, {
    title: 'Financial evidence and audit trail',
    desc: 'The record of who prepared, approved, executed, reconciled and audited each transaction, written in the same transaction as the change.',
    duties: ['audit', 'view'], basis: 'FINANCIAL_MANDATE_AUDIT',
    trigger: 'An auditor or reviewer opens a transaction history.', resource: 'The duty history of one transaction.',
    act: 'Read the history.', result: 'None.', audit: 'sensitiveRead',
    ui: 'A list of duties with actor and time.',
    cap: 'Makes every money movement attributable.', sod: 'The reader took no part in the transaction.',
    data: 'Duty history of one transaction.', integ: 'None.',
    impl: { status: 'PARTIAL_SOURCE', routes: [A('app/api/payments/[id]/duties/route.ts')], cap: null, note: 'The duties route reads the transaction. The disposition records the evidence-pack call as fire and forget.' },
    adopt: ['DEC-IA-23'], rel: ['F21', 'FO-NAV-6'], open: ['DEC-PD-09'],
  }),
  fo(28, {
    title: 'Language, mobile and accessibility',
    desc: 'Every financial destination works in English and French, on mobile and desktop, by keyboard and screen reader, in a native browser.',
    basis: 'SELF_SCOPED', duties: [], actorText: 'Any financial principal',
    trigger: 'The principal changes language or uses assistive technology.', resource: 'The language preference and the rendered interface.',
    pre: ['Strings exist in both languages.'],
    act: 'Change language and use the destinations.', result: 'The language preference.',
    authReq: 'The person\u2019s own settings.',
    ui: 'No untranslated labels and no inaccessible control.',
    cap: 'Equal access.', sod: 'Not applicable.', data: 'None.', integ: 'None.',
    audit: 'view', priv: 'PRIV_NONE', deny: 'validation', denyNote: '',
    impl: { status: 'PARTIAL_SOURCE', routes: [A('app/[locale]/dashboard/finance/page.tsx')], cap: 'UE-OMIT-A11Y-BILINGUAL', note: 'Only the unavailable-state and platform-billing notice strings exist in English and French. Other locales were not updated.' },
    adopt: [], rel: ['FO-NAV-1'], open: ['DEC-PD-09'],
  }),
]

/**
 * A step carries an actor slot. Two steps may share a slot (one principal) unless a listed separation rule prohibits that
 * pair of duties on the transaction, account or record the journey touches. No rule is assumed beyond those listed.
 */
const stepFo = (slot, role, action, ids, basis, assert) => ({ slot, actor: role, action, ids, basis, assert })

const STANCE = 'Separation is decided by the rules listed in the journey\u2019s separation checks, evaluated against the transaction, account, amount, mandate, approval and principal. A pair of steps that no listed rule prohibits may be held by one principal. Position in a workflow creates no separation requirement of its own.'
const jr = (n, title, desc, steps, checks, assertions, adopt, rel, recovery = 'A refusal writes nothing and says which rule applied. Where no mandate exists the answer is that no financial mandate has been issued.') => buildJourney({
  id: `FJ${String(n).padStart(2, '0')}`, title: `FJ${String(n).padStart(2, '0')}: ${title}`,
  hist: { src: FO2, q: 'Journeys FJ01\u2013FJ10', kind: 'NAME', note: 'The range is named. No journey is defined.' },
  desc, actor: 'Financial mandate holders named per step',
  pre: ['Live mandates exist for each step.', 'Principals are assigned to steps so that every separation rule in force for the journey is satisfied. A rule the institution has not adopted is not in force, and only the implemented software rules refuse today.', 'The institution has adopted the rules the steps depend on.'],
  steps, result: steps.map((s) => s.assert).slice(-1)[0],
  recovery, assertions: [...assertions, STANCE], adopt, rel, open: ['DEC-PD-11'],
  design: 'A proposed testable workflow.',
  extra: { separationStance: 'RULE_DRIVEN_NOT_UNIVERSAL', consecutiveStepsRequireDifferentPerson: false, separationChecks: checks, executionStatus: 'NOT_EXECUTED', countsAsPassed: false },
})
const chk = (ruleId, stepNumbers) => ({ ruleId, stepNumbers })

const journeys = [
  jr(1, 'Issue and activate a financial mandate', 'An issuer proposes a mandate, an approver approves it, and the holder activates it. Until then no duty exists.', [
    stepFo('S1', 'Issuer', 'Issue the mandate.', ['F01'], 'FINANCIAL_MANDATE_ADMINISTRATION', 'A pending mandate exists with three named parties.'),
    stepFo('S2', 'Approver', 'Approve the issue.', ['F01'], 'FINANCIAL_MANDATE_ADMINISTRATION', 'The implemented rule SEP-SW-07 is evaluated for issuer, approver and holder; where the institution has adopted it, an approver who is also the issuer or holder is refused.'),
    stepFo('S3', 'Holder', 'Activate the mandate.', ['F01'], 'FINANCIAL_MANDATE_ADMINISTRATION', 'The mandate is live and the holder can take only the named duties. SEP-SW-08 refuses activation by the issuer or approver.'),
  ], [chk('SEP-SW-07', [1, 2, 3]), chk('SEP-SW-08', [1, 2, 3])], ['An expired term is not activated.', 'No mandate exists before a successful issue.', 'The three-person issuance rule is an implemented software rule. Its adoption by an institution is outstanding (DEC-IA-16).'], ['DEC-IA-16', 'DEC-IA-17'], ['F01']),
  jr(2, 'Run a dues billing cycle', 'A preparer prepares the cycle for a period, an approver approves it, and the charges become visible to members.', [
    stepFo('S1', 'Preparer', 'Prepare the cycle.', ['F04'], 'FINANCIAL_MANDATE_PREPARE', 'A prepared cycle exists with counts.'),
    stepFo('S2', 'Approver', 'Approve the cycle.', ['F04'], 'FINANCIAL_MANDATE_APPROVE', 'Where the institution adopts maker-checker approval for this record (SEP-PI-07), the preparer is refused as approver.'),
    stepFo('M', 'Member', 'See their charge.', ['F08'], 'FINANCIAL_SUBJECT_OWN_RECORD', 'The member sees only their own record.'),
  ], [chk('SEP-PI-07', [1, 2])], ['Where SEP-PI-07 is adopted, the preparer cannot approve the cycle.', 'A member sees no other member\u2019s record.'], ['DEC-IA-18'], ['F04', 'F08']),
  jr(3, 'Receive and reconcile an employer remittance', 'A preparer uploads a remittance file, the file is preserved unparsed, and a reconciler matches it.', [
    stepFo('S1', 'Preparer', 'Upload and preserve the file.', ['F09'], 'FINANCIAL_MANDATE_PREPARE', 'The file is stored with its hash and recorded unparsed.'),
    stepFo('S2', 'Reconciler', 'Match the remittance.', ['F20'], 'FINANCIAL_MANDATE_RECONCILE', 'Where the institution adopts SEP-PI-09, the uploader is refused as reconciler of the same remittance.'),
    stepFo('S3', 'Auditor', 'Review the period.', ['F21'], 'AUDITOR_APPOINTMENT_DUTY', 'Where SEP-PI-10 is adopted, an auditor who took part in the remittance is refused.'),
  ], [chk('SEP-PI-09', [1, 2]), chk('SEP-PI-10', [1, 2, 3])], ['A duplicate hash is refused.', 'Where SEP-PI-09 is adopted, the uploader cannot reconcile.'], ['DEC-IA-21', 'DEC-IA-23'], ['F09', 'F20']),
  jr(4, 'Follow up a member in arrears', 'A viewer finds the arrears, prepares a plan, and an approver approves it. Viewing and preparing may be held by one principal because no rule prohibits that pair.', [
    stepFo('S1', 'Viewer', 'View the arrears record.', ['F08'], 'FINANCIAL_MANDATE_VIEW', 'The viewer sees only named accounts.'),
    stepFo('S1', 'Preparer', 'Prepare a payment plan.', ['F06'], 'FINANCIAL_MANDATE_PREPARE', 'A prepared plan exists. The same principal that viewed the record may prepare it because a view duty does not segregate.'),
    stepFo('S2', 'Approver', 'Approve the plan.', ['F06'], 'FINANCIAL_MANDATE_APPROVE', 'Where SEP-PI-07 is adopted, the preparer is refused as approver.'),
  ], [chk('SEP-PI-07', [2, 3])], ['A president or administrator without a mandate sees no arrears.'], ['DEC-IA-27', 'DEC-IA-18'], ['F05', 'F06', 'F08']),
  jr(5, 'Pay an expense', 'An expense is prepared, approved, paid and reconciled. The implemented software rules decide which of these duties one principal may not combine on this transaction.', [
    stepFo('S1', 'Preparer', 'Register and prepare the expense payment.', ['F12', 'F15'], 'FINANCIAL_MANDATE_PREPARE', 'A registered payment exists.'),
    stepFo('S2', 'Approver', 'Approve the payment.', ['F15'], 'FINANCIAL_MANDATE_APPROVE', 'SEP-SW-01 refuses an approver who prepared this transaction.'),
    stepFo('S3', 'Executor', 'Execute the payment.', ['F16'], 'FINANCIAL_MANDATE_EXECUTE', 'SEP-SW-02 refuses an executor who prepared or approved this transaction.'),
    stepFo('S4', 'Reconciler', 'Reconcile the payment.', ['F20'], 'FINANCIAL_MANDATE_RECONCILE', 'SEP-SW-03 refuses a reconciler who took part in this transaction.'),
  ], [chk('SEP-SW-01', [1, 2]), chk('SEP-SW-02', [1, 2, 3]), chk('SEP-SW-03', [1, 2, 3, 4])], ['No one can mark a payment executed without posting it.', 'Under the implemented rules the four duties on one transaction need four principals. That is a consequence of those rules and not a universal requirement. An institution may adopt a different rule set (DEC-IA-18).'], ['DEC-IA-19', 'DEC-IA-18', 'DEC-IA-20'], ['F12', 'F15', 'F16', 'F20']),
  jr(6, 'Pay a vendor', 'A vendor is verified, an invoice is matched, and the payment passes through approval and execution.', [
    stepFo('S1', 'Preparer', 'Prepare the vendor and payable.', ['F13', 'F14'], 'FINANCIAL_MANDATE_PREPARE', 'The payable matches an approved line.'),
    stepFo('S2', 'Approver', 'Approve the vendor change and the payable.', ['F13', 'F15'], 'FINANCIAL_MANDATE_APPROVE', 'SEP-SW-01 refuses an approver who prepared the payment. Where SEP-PI-03 is adopted, the person who changed the vendor bank reference does not approve that change.'),
    stepFo('S3', 'Executor', 'Execute the payment.', ['F16'], 'FINANCIAL_MANDATE_EXECUTE', 'SEP-SW-02 refuses an executor who prepared or approved the payment.'),
  ], [chk('SEP-SW-01', [1, 2]), chk('SEP-SW-02', [1, 2, 3]), chk('SEP-PI-03', [1, 2])], ['A duplicate invoice is refused.', 'Where SEP-PI-03 is adopted, a changed bank reference is not approved by the person who changed it.'], ['DEC-IA-19'], ['F13', 'F14']),
  jr(7, 'Disburse from a strike or restricted fund', 'A disbursement is prepared against a restriction, approved, and executed.', [
    stepFo('S1', 'Preparer', 'Prepare the disbursement.', ['F17', 'F18'], 'FINANCIAL_MANDATE_PREPARE', 'The disbursement names its restriction.'),
    stepFo('S2', 'Approver', 'Approve it.', ['F17', 'F18'], 'FINANCIAL_MANDATE_APPROVE', 'SEP-SW-01 refuses an approver who prepared it. Where SEP-PI-02 is adopted, a recipient is refused as approver.'),
    stepFo('S3', 'Executor', 'Execute the payment.', ['F16'], 'FINANCIAL_MANDATE_EXECUTE', 'SEP-SW-02 refuses an executor who prepared or approved it.'),
  ], [chk('SEP-SW-01', [1, 2]), chk('SEP-SW-02', [1, 2, 3]), chk('SEP-PI-02', [2])], ['Where SEP-PI-02 is adopted, a person cannot approve their own stipend.'], ['DEC-IA-24'], ['F17', 'F18']),
  jr(8, 'Remit to an affiliate', 'An affiliate remittance is prepared, approved and submitted.', [
    stepFo('S1', 'Preparer', 'Prepare the remittance.', ['F10'], 'FINANCIAL_MANDATE_PREPARE', 'A prepared remittance exists.'),
    stepFo('S2', 'Approver', 'Approve it.', ['F10'], 'FINANCIAL_MANDATE_APPROVE', 'Where SEP-PI-07 is adopted, the preparer is refused as approver.'),
    stepFo('S3', 'Executor', 'Submit it.', ['F10', 'F16'], 'FINANCIAL_MANDATE_EXECUTE', 'Submission is a separate duty. SEP-SW-02 applies where the submission is a payment transaction.'),
  ], [chk('SEP-PI-07', [1, 2]), chk('SEP-SW-02', [1, 2, 3])], ['Submission and export answer HTTP 501 until adopted.'], ['DEC-IA-25'], ['F10']),
  jr(9, 'Close a period with independent review', 'A reconciler closes the period and an appointed auditor reviews it. The reconciler may later read the statements because a view duty does not segregate.', [
    stepFo('S1', 'Reconciler', 'Reconcile the period.', ['F20'], 'FINANCIAL_MANDATE_RECONCILE', 'All items are matched or accepted.'),
    stepFo('S2', 'Auditor', 'Review the period and record findings.', ['F21', 'F27'], 'AUDITOR_APPOINTMENT_DUTY', 'Where SEP-PI-10 is adopted, an auditor who took part in the period\u2019s records is refused.'),
    stepFo('S1', 'Viewer', 'Read the statements.', ['F22'], 'FINANCIAL_MANDATE_VIEW', 'The statements state their scope. Reading is authorized separately from reconciling and from any export (F25).'),
  ], [chk('SEP-PI-10', [1, 2])], ['Where SEP-PI-10 is adopted, the auditor holds no other duty on the audited records.'], ['DEC-IA-21', 'DEC-IA-23'], ['F20', 'F21', 'F22']),
  jr(10, 'Revoke financial authority on departure', 'When an office-holder leaves, their mandates are revoked and replacements are issued by the register.', [
    stepFo('S1', 'Issuer', 'Revoke the departing person\u2019s mandates.', ['F26', 'F01'], 'FINANCIAL_MANDATE_ADMINISTRATION', 'Revocation takes effect when recorded. The departing person takes no part in it (SEP-PI-08).'),
    stepFo('S2', 'Approver', 'Approve the replacement issue.', ['F01'], 'FINANCIAL_MANDATE_ADMINISTRATION', 'SEP-SW-07 is evaluated for the replacement\u2019s issuer, approver and holder.'),
    stepFo('S3', 'Holder', 'Activate the replacement.', ['F01'], 'FINANCIAL_MANDATE_ADMINISTRATION', 'The new holder takes only the named duties. SEP-SW-08 refuses activation by the issuer or approver.'),
  ], [chk('SEP-PI-08', [1]), chk('SEP-SW-07', [1, 2, 3]), chk('SEP-SW-08', [1, 2, 3])], ['The departed person\u2019s duty is refused immediately after revocation.'], ['DEC-IA-28', 'DEC-IA-16'], ['F26', 'F01']),
]

const denial = (n, title, desc, attempt, basis, rel) => ({
  id: `FO-DENY-${String(n).padStart(2, '0')}`, kind: 'DENIAL', title, desc,
  actor: 'A person who holds a title, role or entitlement but no live financial mandate',
  trigger: `A person attempts ${attempt}.`, resource: attempt,
  pre: ['No live financial mandate names this duty and account for the person.'],
  act: 'No action is permitted. The attempt is refused and recorded.',
  result: 'None. Nothing is written except the refusal record.',
  auth: { basis, kernel: [], req: 'Eligibility is not authority. This contract states what a title or entitlement never grants.' },
  audit: 'denial', priv: 'PRIV_FINANCIAL_PERSONAL',
  ui: 'The person is told that no financial mandate has been issued to them, and how to request one.',
  deny: 'forbid', denyNote: 'The refusal is the contract.',
  impl: { status: 'SOURCE_PRESENT', routes: [A('lib/authority/policies/finance.ts')], cap: null, note: 'The kernel finance policy refuses without a live mandate. Conformance has not been checked end to end.' },
  rel, evidence: [], adopt: [], design: 'A denial contract so the absence of a power is a recorded decision.',
})

const denials = [
  denial(1, 'No financial authority from a role title', 'The Secretary-Treasurer, President, administrator and every other title carry no financial duty. A duty comes only from a live mandate.', 'taking any financial duty on the strength of a title', 'ROLE_ELIGIBILITY_ONLY', ['F01', 'F08']),
  denial(2, 'No union financial authority from platform billing or entitlement', 'Nzila platform billing and a SaaS entitlement are not union finance and confer no authority over union records.', 'reading or changing union financial records through platform billing or entitlement', 'PLATFORM_BOUNDARY_NO_AUTHORITY', ['F22']),
  denial(3, 'No bypass of a separation rule in force', 'A title, seniority or consecutive position in a workflow never creates or removes a separation requirement. Where an implemented software rule or an institutionally adopted rule prohibits a duty combination on this transaction, account or record, the combination is refused. No rule is assumed beyond those listed in the separation model.', 'taking a duty that a separation rule in force prohibits on the same transaction, account or record', 'ROLE_ELIGIBILITY_ONLY', ['F15', 'F16', 'F20']),
  denial(4, 'No delegation of a financial duty', 'A financial duty is not delegable. The source refuses a delegation on every finance action.', 'delegating a financial duty', 'ROLE_ELIGIBILITY_ONLY', ['F01']),
  denial(5, 'No success where the capability is unavailable', 'A financial capability that is unavailable answers HTTP 501. It never returns a success it did not perform.', 'receiving a success answer from an unavailable financial route', 'ROLE_ELIGIBILITY_ONLY', ['F10', 'F11', 'F17']),
]

const SCN = (id, title, hist, model, backing, facts, structure, behavior, denials2, ids, distinct, adopt) => ({ id, title, hist, model, backing, facts, structure, behavior, denials: denials2, ids, distinct, adopt, rel: ids })

const scenarios = [
  SCN('FO-SCN-CAPE', 'CAPE: national structure with Labour Relations Officers', { src: FO2, q: 'organization scenarios', kind: 'NAME' }, 'NATIONAL_FINANCE_OFFICE', 'HYPOTHESIS_ONLY',
    [{ t: 'No source describes CAPE finance. The source protocol for representation is not a finance rule.' }],
    'A central finance office holds mandates; locals do not hold their own.', 'Financial duties are held by named central staff. Officers who lead representation hold no financial duty.',
    ['An Officer who leads representation does not hold a financial duty by that role.'], ['F01', 'F15', 'F16'], 'Finance is centralized and separate from representation.', ['DEC-IA-31', 'DEC-IA-16']),
  SCN('FO-SCN-CUPE', 'CUPE: local with affiliate remittances', { src: FO2, q: 'organization scenarios', kind: 'NAME' }, 'LOCAL_WITH_AFFILIATE_REMITTANCE', 'HYPOTHESIS_ONLY',
    [{ t: 'No source describes CUPE finance. The affiliate remittance routes answer HTTP 501.' }],
    'A local holds its own accounts and remits per-capita amounts to an affiliate.', 'A local prepares, approves and submits affiliate remittances through separate duties, and keeps its own books.',
    ['The affiliate does not hold a duty on the local\u2019s accounts.'], ['F10', 'F20'], 'Money flows outward to an affiliate on a schedule.', ['DEC-IA-25', 'DEC-IA-31']),
  SCN('FO-SCN-LIUNA', 'LIUNA: territory funds and benefit administration', { src: FO2, q: 'organization scenarios', kind: 'NAME' }, 'TERRITORY_AND_BENEFIT_FUNDS', 'HYPOTHESIS_ONLY',
    [{ t: 'No source describes LIUNA finance. The scenario is a hypothesis that needs discovery with the institution.' }],
    'Funds and benefit administration are organized by territory.', 'A mandate names a territory\u2019s accounts. Benefit and pension finance follow a plan administrator.',
    ['A holder in one territory has no duty in another.'], ['F24', 'F17', 'F01'], 'Authority is bounded by territory and by fund type.', ['DEC-IA-26', 'DEC-IA-24', 'DEC-IA-31']),
  SCN('FO-SCN-SMALL-LOCAL', 'Small local: too few people to separate duties', { src: FO2, q: 'organization scenarios', kind: 'NAME' }, 'SMALL_LOCAL_THREE_PERSON_RULE', 'HYPOTHESIS_ONLY',
    [{ t: 'The source requires three different people to issue a mandate. A small local may not have three.' , file: A('lib/finance/financial-mandate-lifecycle.ts'), q: 'The issuer, the holder and the approver of a financial mandate are three different people.' }],
    'One or two officers hold every financial office.', 'Where the three-person rule cannot be met, no mandate is issued unless a governed exception exists.',
    ['A governed exception, where the institution adopts one, names the rule it relaxes, the compensating control and the independent reviewer. Without one, the implemented software rules still refuse.'], ['F01', 'F15', 'F16'], 'The binding constraint is the count of independent people.', ['DEC-IA-16', 'DEC-IA-31']),
].map((s) => ({ ...s }))

const boundary = {
  id: 'FO-BND-WORKAID', kind: 'DOMAIN', title: 'WorkAid boundary',
  hist: { src: FO2, q: 'WorkAid boundary', kind: 'NAME', individual: false, note: 'Named in a list. No definition is recorded.' },
  desc: 'Financial records never move to a WorkAid specialist through a financial duty. A referral about a financial matter uses the case referral path and the member\u2019s live consent; a union-authored record never opens counsel material.',
  actor: 'Financial mandate holder who needs specialist help on a member\u2019s financial matter', trigger: 'A holder wishes to share a financial record with a specialist.',
  resource: 'A member financial record or a case that concerns one.',
  pre: ['The member\u2019s live consent covers the financial categories named.', 'The referral is made through the case path by someone with the case relationship.'],
  act: 'Refuse to disclose through a financial duty and point to the case referral path.', result: 'None.',
  auth: { basis: 'WORKAID_REFERRAL_WITH_CONSENT', kernel: ['workaid:refer'], req: 'A case relationship and a live consent. A financial duty alone never discloses a record to a specialist.' },
  audit: 'denial', priv: 'PRIV_PRIVILEGED_EXCLUDED',
  ui: 'The holder is told a financial duty does not share records with specialists.',
  deny: 'forbid', denyNote: 'The boundary is the contract.',
  impl: { status: 'PARTIAL_SOURCE', routes: [A('app/api/workaid/referrals/route.ts')], services: [A('lib/authority/workaid-disclosure.ts')], cap: 'UE-CAP-G-002', note: 'The case referral path exists. No financial path to a specialist exists.' },
  rel: ['R18', 'REP-ACT-24'], adopt: ['DEC-IA-12'], evidence: [], design: 'A proposed boundary.',
  open: ['DEC-PD-09'],
}

export function buildFinancial(root) {
  return {
    navigation: navs.map((item) => buildContract(root, item)),
    domains: domains.map((item) => buildContract(root, item)),
    journeys,
    scenarios: scenarios.map((item) => buildScenario(root, item)),
    boundaries: [buildContract(root, boundary)],
    denials: denials.map((item) => buildContract(root, item)),
  }
}
