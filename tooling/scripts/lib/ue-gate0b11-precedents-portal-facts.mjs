/**
 * Gate 0B.11 facts: the member dues portal routes (portal/dues/balance, portal/dues/pay), the arbitration precedent
 * library routes (precedents, precedents/[id], precedents/search, precedents/jurisdiction-preferences), the profile
 * routes (profile/me, profile/roles), the platform reconciliation routes (reconciliation/bank, process, resolve,
 * upload) and the rewards routes (rewards/cron, export, redemptions, wallet). Sixteen route files, 25 operations.
 * Every evidence item is produced by `opAuthoring` from the exact handler, the helper or service it calls, or the
 * resolved schema. This tranche records the source; it repairs nothing and adopts no business decision.
 */
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const DUES_CAP = 'UE-OMIT-MEMBER-DUES-SELF-SERVICE'
const PREC_CAP = 'UE-OMIT-ARBITRATION-PRECEDENT-LIBRARY'
const REW_CAP = 'UE-OMIT-REWARDS-REDEMPTION-FULFILMENT'
const BILL_CAP = 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING'
const GATE = 14

const D_DUES = 'UE-INST-MEMBER-DUES-SELF-SERVICE-COLLECTION'
const D_PREC = 'UE-INST-ARBITRATION-PRECEDENT-LIBRARY-AUDIENCE-AND-PUBLICATION'
const D_REWARDS_AUTO = 'UE-INST-REWARDS-PROGRAM-AUTOMATION-EXPIRY-AND-EXPORT'
const D_RECON = 'UE-INST-PLATFORM-RECONCILIATION-AUTHORITY'
const D_REDEMPTION = 'UE-INST-REWARDS-REDEMPTION-PROVIDER-AUTHORITY'
const D_SHARING = 'UE-INST-ORGANIZATION-SHARING-SETTINGS-AUTHORITY'
const D_KNOWLEDGE = 'UE-INST-KNOWLEDGE-PUBLICATION'
const D_ROSTER = 'UE-INST-ORGANIZATION-ROSTER-AND-ROLE-GRANT-AUTHORITY'
const D_CONTRACT = 'UE-INST-PLATFORM-CONTRACT-AUTHORITY'

const WITH_API = `${APP}lib/api/with-api.ts`
const MANDATE = `${APP}lib/finance/require-live-financial-mandate.ts`
const DUES_SVC = `${APP}lib/dues/dues-payment-service.ts`
const DUES_SETTLE = `${APP}lib/dues/dues-settlement.ts`
const DUES_FLAG = `${APP}lib/dues/member-dues-flag.ts`
const DUES_SCHEMA = `${APP}db/schema/dues-finance-schema.ts`
const PREC_SVC = `${APP}lib/services/precedent-service.ts`
const PREC_AUDITED = `${APP}lib/services/precedent-audited-service.ts`
const DECISIONS_SCHEMA = `${APP}db/schema/cba-intelligence-schema.ts`
const PRECEDENTS_SCHEMA = `${APP}db/schema/arbitration-precedents-schema.ts`
const PREFS_SCHEMA = `${APP}db/schema/domains/member/jurisdiction-preferences.ts`
const PROFILES_SCHEMA = `${APP}db/schema/profiles-schema.ts`
const PROFILES_QUERIES = `${APP}db/queries/profiles-queries.ts`
const RECON_SVC = `${APP}services/platform-economics/reconciliation-service.ts`
const RECON_SCHEMA = `${APP}db/schema/domains/finance/reconciliation.ts`
const REW_DIR = `${APP}lib/services/rewards/`
const REW_AUDIT = `${REW_DIR}audit.ts`
const REW_AUTOMATION = `${REW_DIR}automation-service.ts`
const REW_NOTIFY = `${REW_DIR}notification-service.ts`
const REW_WALLET = `${REW_DIR}wallet-service.ts`
const REW_REDEMPTION = `${REW_DIR}redemption-service.ts`
const REW_SCHEMA = `${APP}db/schema/domains/infrastructure/rewards.ts`
const PROXY = `${APP}proxy.ts`

export const ROUTES = new Set([
  'portal/dues/balance/route.ts',
  'portal/dues/pay/route.ts',
  'precedents/[id]/route.ts',
  'precedents/jurisdiction-preferences/route.ts',
  'precedents/route.ts',
  'precedents/search/route.ts',
  'profile/me/route.ts',
  'profile/roles/route.ts',
  'reconciliation/bank/route.ts',
  'reconciliation/process/route.ts',
  'reconciliation/resolve/route.ts',
  'reconciliation/upload/route.ts',
  'rewards/cron/route.ts',
  'rewards/export/route.ts',
  'rewards/redemptions/route.ts',
  'rewards/wallet/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  PRP_MEMBER_DUES_SELF_SERVICE: {
    capabilityId: DUES_CAP,
    domain: 'MEMBER_DUES_BALANCE_AND_PAYMENT_SELF_SERVICE',
    actor: 'Member of the organization reading their own dues balance and payment history and paying outstanding dues by card; treasurer who expects the ledger to be credited only by a verified payment',
    routes: ['portal/dues/balance/route.ts', 'portal/dues/pay/route.ts'],
    evidence: [
      ev(`${API}portal/dues/pay/route.ts`, ' * The member cannot assert payment. This endpoint only creates a server-owned pending dues'),
      ev(DUES_FLAG, ' * Member dues collection is NOT part of the initial Union Eyes launch. The dues initiation and'),
      ev(DUES_SCHEMA, "export const memberDuesLedger = pgTable('member_dues_ledger', {"),
    ],
  },
  PRP_PRECEDENT_LIBRARY: {
    capabilityId: PREC_CAP,
    domain: 'ARBITRATION_DECISION_LIBRARY_READ_SEARCH_AND_PUBLICATION',
    actor: 'Member or steward researching arbitration decisions of the shared precedent library, and the platform content role adding a decision to it',
    routes: ['precedents/route.ts', 'precedents/search/route.ts'],
    evidence: [
      ev(`${API}precedents/route.ts`, '// The precedent library is shared across tenants, so only a platform-elevated role may add to it.'),
      ev(DECISIONS_SCHEMA, 'export const arbitrationDecisions = pgTable("arbitration_decisions", {'),
    ],
  },
  PRP_PRECEDENT_ITEMS: {
    capabilityId: PREC_CAP,
    domain: 'ORGANIZATION_CONTRIBUTED_ARBITRATION_PRECEDENT_ROWS',
    actor: 'Steward or administrator of an organization reading, amending and removing the arbitration precedent rows its own organization contributed to the federation',
    routes: ['precedents/[id]/route.ts'],
    evidence: [
      ev(PRECEDENTS_SCHEMA, 'export const arbitrationPrecedents = pgTable("arbitration_precedents", {'),
      ev(PRECEDENTS_SCHEMA, '  sourceOrganizationId: uuid("source_organization_id")'),
      ev(PRECEDENTS_SCHEMA, '  sharingLevel: varchar("sharing_level", { length: 50 }).notNull().default("federation"),'),
    ],
  },
  PRP_PRECEDENT_PREFERENCES: {
    capabilityId: PREC_CAP,
    domain: 'MEMBER_JURISDICTION_PREFERENCES_FOR_PRECEDENT_FILTERING',
    actor: 'Member choosing the jurisdictions and levels the precedent console filters to',
    routes: ['precedents/jurisdiction-preferences/route.ts'],
    evidence: [
      ev(`${API}precedents/jurisdiction-preferences/route.ts`, ' * User-level jurisdiction preferences for precedent filtering.'),
      ev(PREFS_SCHEMA, "export const memberJurisdictionPreferences = pgTable('member_jurisdiction_preferences', {"),
    ],
  },
  PRP_PROFILE_ROUTES: {
    capabilityId: BILL_CAP,
    domain: 'USER_BILLING_PROFILE_READS',
    actor: 'Signed-in user reading their own subscription and billing profile; steward expecting a role list from a route named roles',
    routes: ['profile/me/route.ts', 'profile/roles/route.ts'],
    evidence: [
      ev(PROFILES_SCHEMA, 'export const profilesTable = pgTable("profiles", {'),
      ev(PROFILES_SCHEMA, '  stripeCustomerId: text("stripe_customer_id"),'),
      ev(PROFILES_SCHEMA, '  membership: membershipEnum("membership").notNull().default("free"),'),
    ],
  },
  PRP_RECONCILIATION: {
    capabilityId: BILL_CAP,
    domain: 'PLATFORM_INVOICE_AND_PAYMENT_RECONCILIATION',
    actor: 'Administrator running a reconciliation of the organization platform invoices, payments and fee events for a period, and officer reading the runs and exceptions',
    routes: ['reconciliation/bank/route.ts', 'reconciliation/process/route.ts', 'reconciliation/resolve/route.ts', 'reconciliation/upload/route.ts'],
    evidence: [
      ev(`${API}reconciliation/upload/route.ts`, ' * Upload endpoint reserved for future bank-statement file intake.'),
      ev(RECON_SVC, ' * Guard: require a completed reconciliation run before period closure.'),
      ev(RECON_SCHEMA, "export const reconciliationExceptions = pgTable('reconciliation_exceptions', {"),
    ],
  },
  PRP_REWARDS_MEMBER_AND_EXPORT: {
    capabilityId: REW_CAP,
    domain: 'REWARDS_WALLET_REDEMPTIONS_AND_PROGRAM_EXPORT',
    actor: 'Member reading their own rewards balance, ledger and redemptions and cancelling an unfulfilled redemption; program administrator expecting to export awards, ledger and budgets',
    routes: ['rewards/export/route.ts', 'rewards/redemptions/route.ts', 'rewards/wallet/route.ts'],
    evidence: [
      ev(`${API}rewards/export/route.ts`, "      const rows = await tx.execute(sql`"),
      ev(REW_SCHEMA, ' * Append-only credit ledger. Prospective entity fields are owned by'),
      ev(REW_REDEMPTION, ' * Returns credits to user wallet'),
    ],
  },
  PRP_REWARDS_CRON: {
    capabilityId: REW_CAP,
    domain: 'REWARDS_SCHEDULED_AUTOMATION_AND_EXPIRATION_WARNINGS',
    actor: 'Scheduler holding the cron secret that triggers anniversary awards, credit expiration warnings and scheduled awards for every active organization',
    routes: ['rewards/cron/route.ts'],
    evidence: [
      ev(`${API}rewards/cron/route.ts`, ' * Security: Requires CRON_SECRET environment variable'),
      ev(REW_AUTOMATION, '        // This is a placeholder for cron-based scheduling'),
    ],
  },
}

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE, severity, title, ...extra })
const DU = (suffix, severity, title, extra) => D(`DEF-0B11-PRP-${suffix}`, DUES_CAP, severity, title, extra)
const PR = (suffix, severity, title, extra) => D(`DEF-0B11-PRP-${suffix}`, PREC_CAP, severity, title, extra)
const BI = (suffix, severity, title, extra) => D(`DEF-0B11-PRP-${suffix}`, BILL_CAP, severity, title, extra)
const RW = (suffix, severity, title, extra) => D(`DEF-0B11-PRP-${suffix}`, REW_CAP, severity, title, extra)

export const DECISIONS = [
  {
    id: D_DUES,
    status: 'OUTSTANDING',
    question: 'Does the union collect membership dues from members through the application by card, which processor account receives the funds and whose merchant account it is, how is a payment applied to the dues ledger and to a balance that is paid through other channels at the same time, what receipt or refund path applies, and what member data may be sent to the processor?',
    sourceState: 'The member dues routes read a member dues ledger and can create a pending payment and a Stripe PaymentIntent for the whole outstanding balance, but the source states that member dues collection is not part of the initial launch and the initiation answers 501 unless UE_MEMBER_DUES_PAYMENTS=1; no source names the merchant account, the receipt or the refund path, and the intent metadata carries the organization id and the member user id.',
    softwareOwners: [DUES_CAP],
  },
  {
    id: D_PREC,
    status: 'OUTSTANDING',
    question: 'Which arbitration decisions and organization-contributed precedents may be read by members of which organizations, which offices may add a decision to the shared library or change what an organization contributed, how is a decision marked public or restricted and who reviews it before it is shared, and may an organization withdraw a contribution?',
    sourceState: 'The library routes serve every arbitration_decisions row to any member at the member floor with the full text, grievor and embedding, and the comment on the create route says the library is shared across tenants and only a platform-elevated role may add to it; the contributed-precedent routes are the generic CRUD configuration over arbitration_precedents, a table keyed by source_organization_id that carries a sharing level, a shared-with list and an anonymization flag, none of which a read route applies; no source names the audience, the review step or the withdrawal rule.',
    softwareOwners: [PREC_CAP],
  },
  {
    id: D_REWARDS_AUTO,
    status: 'OUTSTANDING',
    question: 'Which rewards are awarded automatically (work anniversaries, scheduled awards), under what rule and at what credit amount, how often may the scheduler run and what makes a run safe to repeat, do credits expire and who is told before they do, and which offices may export the awards, wallet ledger and budgets of an organization?',
    sourceState: 'The rewards cron route runs anniversary awards, an expiration warning task and a scheduled-award task for every active organization on a shared secret; the anniversary task creates and issues an award for each member whose join date falls on today, with no record that the award was already made; the scheduled-award task is a placeholder that counts rules as processed; no writer of a credit expiry date was found, and the export route returns every award, ledger and budget row of the organization to any signed-in member; no source names the automation rules, the expiry policy or the export audience.',
    softwareOwners: [REW_CAP],
  },
  {
    id: D_RECON,
    status: 'OUTSTANDING',
    question: 'Which offices may run a platform reconciliation, view its runs and exceptions and resolve or write off an exception, what makes a resolution or write-off valid (second approver, evidence, ledger entry), how is a run repeated or corrected, and is reconciliation of the organization platform billing a duty of the union or of the platform operator?',
    sourceState: 'The reconciliation routes let an administrator run a reconciliation over platform invoices, payments and fee events for a period and resolve or write off the resulting exceptions on a live financial mandate check; a resolution is a status and a note only, no ledger or invoice row changes, the same administrator can run and resolve, and the bank and upload paths do not receive a bank statement; no source names who owns reconciliation, the write-off authority or the correction path.',
    softwareOwners: [BILL_CAP],
  },
]

export const CAPABILITIES = [
  {
    id: DUES_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'member-dues-self-service-balance-and-payment',
    primaryGate: GATE,
    dependencyGates: [5, 13],
    actor: 'Member of the organization reading their own dues balance and ledger history and paying outstanding dues; treasurer who relies on the dues ledger being credited only by a verified payment',
    businessOutcome: 'A member sees their own dues balance and payment history from a ledger that the union keeps, pays outstanding dues once through a processor account the union has decided to use, the ledger is credited exactly once for each verified payment and never past the balance owed, every initiation and settlement commits with its audit record, and member data sent to the processor is limited to what the union has decided.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/portal/dues (balance, pay)',
    service: `${APP}lib/dues/dues-payment-service.ts`,
    sourceFiles: [
      `${API}portal/dues/balance/route.ts`,
      `${API}portal/dues/pay/route.ts`,
      `${APP}lib/dues/dues-payment-service.ts`,
      `${APP}lib/dues/dues-settlement.ts`,
      `${APP}lib/dues/member-dues-flag.ts`,
      `${APP}db/schema/dues-finance-schema.ts`,
    ],
    proof: [{ type: 'path', ref: `${API}portal/dues/pay/route.ts` }],
    auditEvidence: 'The payment initiation commits a dues.payment_initiated audit row in the same tenant transaction as the pending dues_transactions row (persistAtomicAudit); the later processor_payment_id update and the cancellation after a failed processor call write no audit row, the balance and history reads are not audited, and the settlement path is outside these routes.',
    privacyClassification: 'Member dues ledger entries (charges, payments, credits, adjustments, write-offs, payment method, processor payment reference, receipt number) and the processor metadata (organization id, member user id) of a card payment; financial personal data of the member.',
    gap: 'No existing capability owns member dues self-service. UE-CAP-D-001 and UE-CAP-D-003 own the organization-side finance and pension records read by officers and administrators, not a member paying their own dues; UE-OMIT-FINANCE-UNAVAILABLE is the honest-501 owner of finance surfaces that are not built, while these routes read a real ledger and create a real processor payment when enabled; UE-OMIT-MAIN-APP-CRONS owns five named scheduled routes; UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING owns the billing of Union Eyes subscriptions by the platform operator and its records are not union financial records, whereas these routes handle union dues owed by members to their union.',
  },
]

const SAFE_REPLAY = 'a repeat call, a retry by the scheduler or a second click'

const DISPOSITION_EXPORT = {
  disposition: 'RELEASE_BLOCKING',
  actualExposure: 'Any signed-in member of an organization calls GET /api/rewards/export?type=ledger, awards or budgets and receives a CSV of every row of the organization: all members user ids with their credit amounts, balances and memos, every award with recipient, issuer and reason, and every budget envelope; the route resolves the organization from the session and applies no role test and no relation between a row and the caller.',
  potentialImpact: {
    classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
    description: 'Colleagues learn what each member earned and spent, the free-text reason and memo attached to each award and ledger entry, who recognised whom and the program budgets, which the wallet and redemption routes hold to the member own rows and which no source says members may see.',
  },
  activationState: 'REACHABLE_ANY_AUTHENTICATED',
  activationEvidence: [{ ref: `${API}rewards/export/route.ts`, quote: 'const organizationId = await getOrganizationIdForUser(userId);' }],
  existingContainment: 'NONE',
  justification: 'The only guards are a session and an organization membership at any role, the queries select by organization alone and return the whole table as a download, and the sibling wallet and redemption routes show the intended own-row boundary; the data is personal to each member and the audience is undecided, so a signed-in member reaches every colleague record today and the route blocks release.',
}

const DISPOSITION_RECON_RUN = {
  disposition: 'RELEASE_BLOCKING',
  actualExposure: 'An officer of any organization that holds the commercial_reporting entitlement calls GET /api/reconciliation/process?runId=<uuid> and receives the reconciliation run with that id whichever organization owns it: the route checks the caller own financial mandate and then calls getReconciliationRun(runId), whose query filters on the run id alone.',
  potentialImpact: {
    classes: ['CROSS_TENANT_DISCLOSURE'],
    description: 'Another organization run record (period, invoice and payment counts, invoice and payment totals in CAD, variance, run-by user id and the billing period id) is returned to a caller outside that organization once its run id is known, with no organization predicate to refuse it.',
  },
  activationState: 'REACHABLE_ENTITLEMENT_GATED',
  activationEvidence: [{ ref: `${API}reconciliation/process/route.ts`, quote: 'const run = await getReconciliationRun(runId);' }],
  existingContainment: 'NONE',
  justification: 'The mandate check proves only that the caller holds the finance:view duty in their own organization, the entitlement gate restricts the route to organizations that bought commercial_reporting but not to the owner of the run, the run id is a uuid supplied by the caller, and the service query has no organization condition; a reachable cross-tenant read is not contained by an identifier being hard to guess, so the route blocks release.',
}

const DISPOSITION_PRECEDENT_ITEM = {
  disposition: 'RELEASE_BLOCKING',
  actualExposure: 'A member of any organization can GET, a steward can PATCH and an administrator can DELETE /api/precedents/<id> for any arbitration_precedents row: orgScoped true adds a tenant predicate only when the table has an organization column, and this table is keyed by source_organization_id, so the factory query filters on the id alone and the low-role guard finds no owner column to hold a member to.',
  potentialImpact: {
    classes: ['CROSS_TENANT_DISCLOSURE', 'UNAUTHORIZED_MUTATION', 'AVAILABILITY_OR_DATA_LOSS'],
    description: 'A precedent another organization contributed, whatever its sharing level (the column defaults to federation and the sector statistics treat private as excluded), is readable, rewritable (including its sharing level, shared-with list, document links and source organization) and permanently deletable with its tags and citations by users of other organizations once its id is known.',
  },
  activationState: 'REACHABLE_ANY_AUTHENTICATED',
  activationEvidence: [{ ref: `${API}precedents/[id]/route.ts`, quote: "readRole: 'member'," }],
  existingContainment: 'NONE',
  justification: 'The route has no tenant predicate and no sharing test, the table carries a sharing level and a shared-with list that no read or write route applies, and a row-level-security policy on source_organization_id applies only on a connection role that is subject to it, which the source does not establish for these reads and writes; a cross-tenant read and write of institutional case material is not contained by that, so the route blocks release.',
}

const DISPOSITION_PROFILE_ROLES = {
  disposition: 'RELEASE_BLOCKING',
  actualExposure: 'A steward or any higher role of any organization calls GET /api/profile/roles and receives every row of the profiles table: each user email, membership tier, payment provider, Stripe customer and subscription ids, Whop ids, plan dates and credit counters; orgScoped true is a no-op because profiles has no organization column and the low-role guard releases a caller at steward and above from the own-row restriction.',
  potentialImpact: {
    classes: ['CROSS_TENANT_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
    description: 'Contact addresses and payment-provider identifiers of every user of the platform, across all organizations, are listed to the stewards of any one organization, in pages of up to 100 rows, which exposes customer billing identity and supports phishing and account-linking attacks.',
  },
  activationState: 'REACHABLE_ROLE_RESTRICTED',
  activationEvidence: [{ ref: `${API}profile/roles/route.ts`, quote: "readRole: 'member'," }],
  existingContainment: 'NONE',
  justification: 'A steward is a routine office of every local, the role floor restricts the reader to staff of some organization and not to the owner of the profile, the table has no organization column to scope by, and the profiles row-level-security policy depends on a runtime role the source does not establish for this read; a reachable cross-tenant list of personal and billing identifiers is not contained by a staff role, so the route blocks release.',
}

const DISPOSITION_DUES_PAY = {
  disposition: 'CONDITIONALLY_BLOCKING',
  actualExposure: 'When UE_MEMBER_DUES_PAYMENTS=1 a member who calls POST /api/portal/dues/pay repeatedly (a double click, a retry after a timeout, two tabs) gets a new pending dues_transactions row and a new Stripe PaymentIntent for the full outstanding balance on each call, because the idempotency key is derived from the new payment id and no existing pending payment is looked up; settlement locks only the paid row and credits the ledger by that row amount without comparing it with the balance then owed.',
  potentialImpact: {
    classes: ['FINANCIAL_INTEGRITY'],
    description: 'A member who confirms two of the intents is charged twice for the same dues and the ledger is credited twice, driving the balance below zero (balance_after is the prior balance minus the amount with no floor), so money is taken from a member beyond what they owe and the union carries a refund that no route can issue.',
  },
  activationState: 'NOT_ACTIVATED',
  activationEvidence: [{ ref: DUES_FLAG, quote: "return env.UE_MEMBER_DUES_PAYMENTS === '1'" }],
  existingContainment: {
    summary: 'The initiation answers 501 unless the deployment sets UE_MEMBER_DUES_PAYMENTS=1, and settlement of a payment is a single guarded update from pending, so a given pending payment cannot settle twice.',
    evidence: [
      { ref: DUES_FLAG, quote: "throw ApiError.notImplemented('Member dues payment is not enabled in this deployment')" },
      { ref: DUES_SETTLE, quote: "WHERE id = ${row.id}::uuid AND status = 'pending'" },
    ],
  },
  blockingCondition: 'A deployment sets UE_MEMBER_DUES_PAYMENTS=1 so that members can pay dues through the application; the route then creates one charge-capable intent per call for the entire balance and can collect the same dues more than once.',
  justification: 'The flag keeps the route at 501 today, so no member can be charged now, but the defect is in the initiation and settlement logic and not in a configuration choice: the moment the flag is enabled every repeat call yields another full-balance intent and nothing in the settlement path stops the second payment from crediting the ledger past zero, so enabling member dues payments is blocked until the repeat and overpayment paths are closed.',
}

const DISPOSITION_CRON_ANNIVERSARY = {
  disposition: 'CONDITIONALLY_BLOCKING',
  actualExposure: 'The scheduler holder of CRON_SECRET calls POST /api/rewards/cron (task anniversaries or all); for every active organization the task selects every member whose join date falls on today and creates and issues a new Work Anniversary award with its credit amount, with no record or constraint that the award was already made, so a second call on the same day, a scheduler retry or an overlapping run awards and credits the same members again.',
  potentialImpact: {
    classes: ['FINANCIAL_INTEGRITY', 'DATA_QUALITY'],
    description: 'Members receive the anniversary credits two or more times, the wallet ledger and program budget are charged each time, duplicate recognition awards appear in the member history and the export, and the credits are redeemable for provider goods, so a retry converts directly into spendable value.',
  },
  activationState: 'REACHABLE_ROLE_RESTRICTED',
  activationEvidence: [{ ref: `${API}rewards/cron/route.ts`, quote: "const expected = process.env.CRON_SECRET ?? '';" }],
  existingContainment: {
    summary: 'Only a caller with the cron secret reaches the task, and an anniversary award is issued only for an organization that has configured an automated Work Anniversary award type, which the route does not create.',
    evidence: [
      { ref: REW_AUTOMATION, quote: "          eq(types.name, 'Work Anniversary')," },
      { ref: REW_AUTOMATION, quote: "      logger.warn('[Automation] No anniversary award type found', { orgId });" },
    ],
  },
  blockingCondition: 'An organization configures an automated Work Anniversary award type with a credit amount and the scheduler calls the cron route more than once on a day on which a member has an anniversary (a retry, an overlapping run, two schedulers, or a manual call).',
  justification: 'The route reaches no one without the shared secret and no award is made until an organization configures the automated type, so the harm is conditional; once an organization has done so, any repeat of the call on an anniversary day creates and credits a second award because recognition_awards has no uniqueness on recipient, type and day, and the credits are spendable, so the repeat path blocks release for any organization that uses anniversary awards.',
}

export const DEFECTS = [
  /* ---------- member dues ---------- */
  DU('DUES-BALANCE-TAKES-THE-ORGANIZATION-FROM-THE-CLIENT-WITH-NO-MEMBERSHIP-CHECK-AND-NO-TENANT-CONTEXT', 'MEDIUM',
    'GET /api/portal/dues/balance reads the organization id from the organizationId query value or the x-organization-id header and queries member_dues_ledger through the shared db import with the session user id and that organization id as its only predicates: it does not verify that the caller is a member of the named organization (the sibling pay GET does), opens no withRLSContext, and returns totals and the last five entries, so the answer is bounded only by the user id predicate and by whatever row-level-security the connection role enforces.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),
  DU('DUES-BALANCE-CREDIT-STATUS-IS-UNREACHABLE', 'LOW',
    'The balanceStatus of GET /api/portal/dues/balance is computed as currentBalance <= 0 ? paid_up : currentBalance > 0 ? owing : credit, so the credit branch can never be returned: a member whose balance is negative (overpaid) is reported as paid_up and the credit they hold is not distinguished from a zero balance.'),
  DU('DUES-PAY-GET-RETURNS-EVERY-LEDGER-ENTRY-TYPE-AS-PAYMENTS-AND-OMITS-PENDING-ATTEMPTS', 'LOW',
    'GET /api/portal/dues/pay is described as the member payment history but selects every transaction type of the member dues ledger (charges, credits, adjustments, write-offs and payments) under the key payments, includes the processor payment reference and receipt number, never lists the pending dues_transactions attempts that POST creates, and takes the page size from parseInt of the query value, so a non-numeric limit becomes NaN and the query limit is undefined.'),
  DU('DUES-PAY-POST-CREATES-A-NEW-FULL-BALANCE-PAYMENT-AND-INTENT-ON-EVERY-CALL-AND-SETTLEMENT-DOES-NOT-RECHECK-THE-BALANCE', 'HIGH',
    'POST /api/portal/dues/pay computes the outstanding balance, inserts a new pending dues_transactions row for the whole balance and creates a Stripe PaymentIntent with an idempotency key derived from that new row id, without looking for an existing pending payment of the member, so every call creates another full-balance intent; the settlement path locks and settles only the paid row and credits member_dues_ledger by that row amount (balance_after is the prior balance minus the amount, with no floor and no comparison with the balance owed), so two confirmed intents credit the ledger twice.',
    { releaseDisposition: DISPOSITION_DUES_PAY }),
  DU('DUES-PAY-POST-INITIATION-AUDIT-COMMITS-BEFORE-THE-PROCESSOR-CALL-AND-THE-LATER-STATE-CHANGES-ARE-UNAUDITED', 'MEDIUM',
    'POST /api/portal/dues/pay commits the pending dues_transactions row and its dues.payment_initiated audit row in one transaction and only then calls the Stripe API outside any transaction; the later update that stores processor_payment_id and the update that sets the row to cancelled after a processor failure are separate transactions with no audit row, and the cancellation is wrapped in a catch that discards its own failure, so an initiation can be audited for a payment whose provider call never happened and the cancelled state is not audited.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  DU('DUES-PAY-POST-SENDS-THE-ORGANIZATION-AND-MEMBER-USER-ID-TO-THE-PROCESSOR-FOR-A-MERCHANT-ACCOUNT-NO-SOURCE-NAMES', 'MEDIUM',
    'POST /api/portal/dues/pay sends the organization id and the member user id in the PaymentIntent metadata to Stripe through the platform-managed Stripe client (lib/stripe delegates to a platform client; the route holds no per-organization processor configuration): no source names the merchant account that receives union dues, whether it is the union or the platform operator, or the member consent for the disclosure, and the route holds no per-organization processor configuration.',
    { riskCategories: ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION'] }),

  /* ---------- arbitration precedent library ---------- */
  PR('PRECEDENT-ITEM-ROUTE-ORGANIZATION-SCOPE-IS-A-NO-OP-ON-A-TABLE-KEYED-BY-SOURCE-ORGANIZATION', 'HIGH',
    'The generic CRUD routes at /api/precedents/[id] are configured orgScoped true over arbitration_precedents, whose organization column is named source_organization_id and which has no organizationId, no status and no userId or memberId: the factory adds the tenant predicate only for an organizationId column and the low-role guard holds a caller to own rows only for a userId or memberId column, so GET (member), PATCH (steward) and DELETE (administrator) address any precedent row of any organization by id, whatever its sharing_level and shared_with_org_ids.',
    { releaseDisposition: DISPOSITION_PRECEDENT_ITEM }),
  PR('PRECEDENT-ITEM-PATCH-WRITES-SHARING-LEVEL-SHARED-WITH-LIST-AND-SOURCE-ORGANIZATION-FROM-THE-BODY', 'MEDIUM',
    'PATCH /api/precedents/[id] copies the request body into the arbitration_precedents update, so a steward can change sharing_level, shared_with_org_ids, is_parties_anonymized (turning the anonymization of the parties off), the document links and the source_organization_id itself with no sharing authority, no review and no record of the previous value; the audit row lists only the changed field names.'),
  PR('PRECEDENT-ITEM-DELETE-HARD-DELETES-THE-PRECEDENT-AND-CASCADES-TO-ITS-TAGS-AND-CITATIONS', 'MEDIUM',
    'DELETE /api/precedents/[id] permanently deletes the arbitration_precedents row (the table has no status column, so the factory hard-deletes) and the foreign keys on precedent_tags and precedent_citations cascade, so the tags and the citation history of the precedent are destroyed with no soft delete, no withdrawal rule and an audit row that keeps only the row id and the changed field names.'),
  PR('PRECEDENT-LIBRARY-READS-RETURN-EVERY-COLUMN-AND-IGNORE-IS-PUBLIC-AND-ACCESS-RESTRICTIONS', 'MEDIUM',
    'GET /api/precedents (list, issue type, most cited) and POST /api/precedents/search select every column of arbitration_decisions at the member and steward floor, including the grievor name, the panel members, the full text and the embedding, and apply no condition on is_public or access_restrictions, so a decision recorded as not public or carrying an access restriction is returned and searched (the search also matches inside the full text) exactly like a public one; the table has no organization column and the library is shared across organizations.'),
  PR('PRECEDENT-COLLECTION-GET-TAKES-UNBOUNDED-LIMIT-AND-PAGE-FROM-THE-QUERY-STRING', 'LOW',
    'GET /api/precedents passes parseInt of the limit and page query values to the list, most-cited and issue-type queries with no maximum, no minimum and no NaN check, so a caller can request an arbitrarily large page, a negative offset or a NaN limit, and the sortBy value is taken from the query string; the statistics mode counts the whole library.'),
  PR('PRECEDENT-SEARCH-USES-UNESCAPED-WILDCARD-LIKE-OVER-THE-FULL-TEXT-AND-CASTS-UNVALIDATED-FILTERS', 'LOW',
    'POST /api/precedents/search validates only that the query is a string of at most 500 characters and that filters is a record of unknown values, then builds %query% LIKE conditions over the title, case number, summary, headnote and full text without escaping the percent and underscore wildcards, and casts the filter values to the tribunal and precedent value enums without validating them, so an invalid enum value reaches the database as a 500 and a broad pattern scans the whole text column.'),
  PR('PRECEDENT-POST-PUBLISHES-INTO-THE-SHARED-LIBRARY-WITH-NO-REVIEW-PROVENANCE-OR-OWNING-ORGANIZATION', 'MEDIUM',
    'POST /api/precedents inserts the typed decision into the library that every organization reads, with the full text, grievor and parties as typed, is_public defaulting to true, no source or import provenance and no organization on the row (the organization appears only in the audit row), after a single role-title check (content_manager) and with no review, redaction or consent step.'),
  PR('JURISDICTION-PREFERENCES-HAVE-NO-UNIQUE-ROW-UNVALIDATED-FLAGS-AND-NO-SERVER-CONSUMER', 'LOW',
    'PUT /api/precedents/jurisdiction-preferences selects the caller row and then updates or inserts it, but member_jurisdiction_preferences declares no unique index on user_id and organization_id, so two concurrent first saves insert two rows and GET returns an arbitrary one of them; includeNational and autoApply are written as typed with no boolean check, and no precedent route reads the preferences (only the console components apply them in the browser), so the saved preference filters nothing on the server.'),

  /* ---------- profile ---------- */
  BI('PROFILE-ROLES-GET-LISTS-EVERY-USER-BILLING-PROFILE-TO-STEWARD-AND-ABOVE-OF-ANY-ORGANIZATION', 'HIGH',
    'GET /api/profile/roles is the generic CRUD list over the profiles table (readRole member, orgScoped true) although profiles has no organization column, so the tenant predicate is not added, and the low-role guard restricts only callers below steward to their own row: a steward or higher of any organization receives every profile of the platform with email, membership tier, payment provider, Stripe customer and subscription ids, Whop ids, plan dates and credit counters.',
    { releaseDisposition: DISPOSITION_PROFILE_ROLES }),
  BI('PROFILE-ROLES-PATH-IS-A-BILLING-PROFILE-LIST-AND-ITS-POST-IS-REFUSED', 'MEDIUM',
    'The route named profile/roles lists billing profiles (membership tier, payment provider and credits) and holds no role, role assignment or permission data, so a client that expects a role list receives subscription records; its POST is configured at the steward floor but profiles is READ_ONLY in the CRUD governance table, so every POST is refused with 403 after the role check, and no route assigns a role.'),
  BI('PROFILE-ME-GET-SWALLOWS-DATABASE-ERRORS-INTO-A-SUCCESS-WITH-NULL-DATA', 'MEDIUM',
    'GET /api/profile/me returns isSuccess true with the message Profile retrieved successfully and data null when the profile query fails or times out: getProfileByUserId catches the lookup error and returns null, so a database failure and a user who has no profile are indistinguishable from each other, and the caller is told the profile was retrieved.'),

  /* ---------- reconciliation ---------- */
  BI('RECONCILIATION-PROCESS-GET-RETURNS-ANY-ORGANIZATION-RUN-BY-ID', 'HIGH',
    'GET /api/reconciliation/process?runId= checks the caller finance:view mandate in the caller own organization and then returns getReconciliationRun(runId), whose query is .where(eq(reconciliationRuns.id, runId)) with no organization condition and which is read through the shared db handle, so an officer of any organization with the commercial_reporting entitlement reads any other organization reconciliation run (totals, variance, counts, run-by user, billing period) by id.',
    { releaseDisposition: DISPOSITION_RECON_RUN }),
  BI('RECONCILIATION-SERVICE-QUERIES-THROUGH-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY', 'MEDIUM',
    'The reconciliation service (runReconciliation, resolveException, getReconciliationRun, listExceptions, requireReconciliation) imports the shared db handle and opens its own db.transaction without a tenant context, so the organization predicates written in each query (and absent from getReconciliationRun and requireReconciliation) are the only boundary unless the connection role is itself subject to row-level security, which the route files do not establish; the mandate check in the route runs in a separate withRLSContext transaction that the service does not join.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),
  BI('RECONCILIATION-AUDIT-IS-A-SEPARATE-EVENT-NOT-COMMITTED-WITH-THE-RECONCILIATION-WRITES', 'MEDIUM',
    'runReconciliation writes the run, matches and exceptions in db.transaction but calls auditLog (the application audit logger, which does not take the transaction handle) inside it, and resolveException updates the exception and then calls auditLog after the update committed, so the audit event is a separate write: a failed audit of a resolution or write-off leaves the status changed without the record (and in legacy mode the logger logs and swallows a database failure), and a run that later rolls back can leave its audit event behind.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  BI('RECONCILIATION-RUNS-ARE-NOT-REPEATABLE-AND-THE-BILLING-PERIOD-IS-NOT-BOUND-TO-THE-ORGANIZATION', 'MEDIUM',
    'POST /api/reconciliation/process inserts a new reconciliation_runs row and fresh exception rows on every call for the same period (no uniqueness, no supersede or correction of an earlier run), stores the billingPeriodId from the body without checking that the period belongs to the organization, and requireReconciliation(billingPeriodId), the guard that decides whether a period may be closed, filters the runs by period id alone with limit 1 and no order, so a run of one organization (or any earlier run) can satisfy the closure guard; the only caller of that guard is closeBillingPeriod, which no route calls.'),
  BI('RECONCILIATION-ENGINE-FABRICATES-FEE-SETTLEMENT-MATCHES-AND-SUMS-REFUNDED-PAYMENTS-AS-RECEIVED', 'MEDIUM',
    'runReconciliation records a fee_settlement match for each fee event that has a settlement batch id by copying the fee amount as both the source and the target amount with a variance of 0.00, without reading any settlement batch amount, so these matches are always reported as matched; it sums payments whose status is refunded into the payment total as if received; and the exception types duplicate_payment, missing_fee_event and orphaned_refund that the schema defines are never created, so the run reports totals and exception counts that do not test duplicates, missing fees or refunds.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  BI('RECONCILIATION-RESOLVE-IS-A-STATUS-AND-NOTE-ONLY-WITH-NO-SECOND-APPROVER-OR-LEDGER-EFFECT', 'MEDIUM',
    'POST /api/reconciliation/resolve sets an exception to resolved or written_off with the typed notes (an empty string is accepted) and the resolver id, and changes no invoice, payment or ledger row, so a write-off removes the exception from the open list without any financial effect or evidence; the service does not compare the resolver with the user who ran the reconciliation, no second approver is required, and the mandate check passes no participants to the segregation-of-duties rule.'),
  BI('RECONCILIATION-BANK-AND-UPLOAD-PATHS-ARE-NAMED-FOR-BANK-FEEDS-BUT-LIST-RUNS-AND-EXCEPTIONS', 'MEDIUM',
    'GET /api/reconciliation/bank lists the reconciliation runs of the organization and GET /api/reconciliation/upload lists reconciliation exceptions; neither receives, parses or matches a bank statement (the upload route comment says the intake is reserved for future work), and no route records a bank transaction, so the paths named for bank reconciliation reconcile platform invoices and payments only.'),
  BI('RECONCILIATION-LISTS-ARE-UNBOUNDED-AND-THE-EXCEPTION-STATUS-FILTER-IS-AN-UNVALIDATED-CAST', 'LOW',
    'GET /api/reconciliation/bank returns every run of the organization with no limit, and GET /api/reconciliation/upload splits the status query value on commas and casts it to the exception status enum without validation (and returns every matching exception unpaged), so an invalid status value reaches the database as an enum error and the lists grow without bound.'),

  /* ---------- rewards ---------- */
  RW('REWARDS-EXPORT-RETURNS-EVERY-MEMBER-LEDGER-AWARD-AND-BUDGET-ROW-TO-ANY-MEMBER', 'HIGH',
    'GET /api/rewards/export has no role check: after a session and the organization lookup it selects by organization alone and returns as a CSV download every award (recipient and issuer user ids, reason text), every wallet ledger row (user id, event type, credits, balance, memo) and every budget envelope of the organization to any member, while the wallet and redemption routes hold a member to their own rows.',
    { releaseDisposition: DISPOSITION_EXPORT, riskCategories: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'] }),
  RW('REWARDS-EXPORT-CSV-DOES-NOT-NEUTRALISE-SPREADSHEET-FORMULAS', 'MEDIUM',
    'The CSV writer of GET /api/rewards/export quotes only values that contain a comma, a quote or a newline and does not neutralise a leading equals, plus, minus or at sign, so a free-text award reason or ledger memo that begins with a formula is written verbatim and is evaluated when an administrator opens the file in a spreadsheet.'),
  RW('REWARDS-EXPORT-IS-UNBOUNDED-AND-WRITES-NO-AUDIT-RECORD', 'MEDIUM',
    'GET /api/rewards/export returns the whole awards, ledger or budgets table of the organization in one response with no limit or date range, and records nothing about who exported what: the route writes no audit row and sits under no wrapper that does, so a bulk disclosure of member wallet data leaves no trace.'),
  RW('REWARDS-CRON-ANNIVERSARY-AWARDS-REPEAT-ON-EVERY-CALL-ON-AN-ANNIVERSARY-DAY', 'HIGH',
    'The anniversary task of POST /api/rewards/cron selects every organization member whose join date has today month and day and, for each, creates and issues a new Work Anniversary recognition award (credits applied by issueAward) with no check for an award already made for that member and year and no uniqueness on recipient, award type and date in recognition_awards, so the same call repeated on the same day, a scheduler retry or an overlapping run awards and credits the members again; the awards and credits are created in two separate transactions per member.',
    { releaseDisposition: DISPOSITION_CRON_ANNIVERSARY }),
  RW('REWARDS-CRON-SCHEDULED-TASK-IS-A-PLACEHOLDER-THAT-COUNTS-RULES-AS-PROCESSED', 'MEDIUM',
    'The scheduled task of POST /api/rewards/cron loads the active scheduled automation rules of each organization, logs each one and increments processed without evaluating any schedule or issuing any award (the source comment calls it a placeholder), so the response reports rules processed for work that was not done.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  RW('REWARDS-CRON-EXPIRATION-TASK-READS-AN-EXPIRY-NO-WRITER-SETS-AND-WOULD-REPEAT-ACROSS-THE-7-14-AND-30-DAY-WINDOWS', 'MEDIUM',
    'The expiration task of POST /api/rewards/cron e-mails members whose earn ledger rows have an expires_at inside the next 7, 14 and 30 days (three overlapping windows run on every call, so a row expiring in 5 days is selected in all three), summing the earned credits of those rows and ignoring any spending; the call sites that write earn rows pass no expiresAt and no code was found that writes an expire entry, so today the task selects nothing and reports success with zero notifications, and once an expiry is set it would mail the same member up to three times per run with no sent record and with a credit count that does not reflect what was spent.'),
  RW('REWARDS-CRON-REPORTS-SUCCESS-FOR-UNKNOWN-TASKS-AND-FAILED-ORGANIZATIONS', 'MEDIUM',
    'POST /api/rewards/cron returns success true with HTTP 200 for any task value (an unknown task executes nothing and returns an empty executed list), embeds a per-organization failure as an entry inside a successful response (processAnniversaryAwards returns success false with the error object instead of throwing, and a rejected organization is serialised as an Error object that JSON renders as empty), and wraps the expiration result, whose own success flag may be false, in the same success true, so a scheduler that checks the status code cannot see a failed run.'),
  RW('REWARDS-CRON-ACCEPTS-THE-SECRET-IN-TWO-HEADERS-AND-THE-PROXY-COMPARES-IT-WITHOUT-A-CONSTANT-TIME-COMPARISON', 'LOW',
    'The proxy requires the x-cron-secret header for /api/rewards/cron and compares it with the CRON_SECRET value using !==, and the route then requires the same secret again in an Authorization bearer header (compared in constant time), so a scheduler must send the secret in two transports, a secret query parameter is documented in the route comment but not read, and the GET handler has no secret check of its own and depends on the proxy alone.'),
  RW('REWARDS-CRON-ANNIVERSARY-CREDIT-SCALE-IS-COMPUTED-AND-DISCARDED-AND-THE-AWARD-REASON-NAMES-THE-ORGANIZATION-UUID', 'LOW',
    'processAnniversaryAwards computes calculateAnniversaryCredits(yearsOfService) into a variable that is never used (the credit amount issued is the award type default), so a service-based credit scale is implied but not applied, and the reason text stored on every award and shown to the member reads with followed by the organization UUID instead of the organization name.'),
  RW('REWARDS-CRON-AND-WALLET-AND-REDEMPTION-QUERIES-USE-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY', 'MEDIUM',
    'The rewards cron route and the wallet, redemption, automation, award and notification services import the shared db handle (and the cron route lists every active organization through it and runs raw SQL on organization_members) without a tenant context, and the wallet and redemption routes are wrapped by withRoleAuth, which sets no row-level-security context, so the organization and user predicates written in each query are the only boundary unless the connection role is itself subject to row-level security, which the route files do not establish.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),
  RW('REWARDS-CRON-RUNS-ARE-AUDITED-PER-AWARD-ONLY-AND-THE-EXPIRATION-E-MAILS-ARE-NOT-AUDITED', 'MEDIUM',
    'Each anniversary award commits its create audit row in the award transaction and its issue audit row in a second transaction, but the cron run as a whole (organizations covered, members awarded, failures, warnings e-mailed) is written to no audit row, a failure between the two transactions leaves an approved award that is never issued and is not retried, and the expiration e-mails that leave the application are not recorded anywhere beyond a log line.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  RW('REDEMPTIONS-GET-IGNORES-THE-STATUS-FILTER-AND-VALIDATES-AGAINST-AN-INCOMPLETE-LIST', 'LOW',
    'GET /api/rewards/redemptions validates the status query value against pending, ordered, fulfilled, cancelled and refunded (the cancellable states initiated and pending_payment are not in the list) and then never passes it to listUserRedemptions, so the filter has no effect and a member cannot ask for the redemptions that they are allowed to cancel; hasMore is the page length equal to the limit.'),
  RW('REDEMPTIONS-GET-RETURNS-WHOLE-ROWS-INCLUDING-THE-PROVIDER-PAYLOAD', 'LOW',
    'GET /api/rewards/redemptions returns the whole reward_redemptions row of each of the caller redemptions (listUserRedemptions uses findMany with no column list), including providerPayloadJson, which holds the shop provider checkout payload and the cancellation reason, so provider-side identifiers are returned to the member browser.'),
  RW('REDEMPTIONS-POST-IS-NAMED-FOR-INITIATION-BUT-CANCELS-AND-DISCARDS-THE-VALIDATED-BODY', 'MEDIUM',
    'POST /api/rewards/redemptions parses the body with initiateRedemptionSchema into a variable that is never used and then cancels the redemption named by the id query value (refunding the credits), so a client that posts a new redemption receives a cancellation or a missing-id error, the schema validates fields that are ignored, and the cancel does not tell the shop provider that the checkout it may already hold has been cancelled.'),
  RW('WALLET-GET-READS-BALANCE-AND-LEDGER-SEPARATELY-WITH-UNVALIDATED-PAGING', 'LOW',
    'GET /api/rewards/wallet reads the balance (the latest ledger row by created_at) and the ledger page in separate statements, so a ledger write between them returns a balance that does not match the page, takes limit and offset from parseInt of the query string without a NaN or negative check, and reports hasMore as the page length equal to the limit.'),
]

const REQ_AUDIT_READ = 'Reads of personal financial records need no audit while the caller is held to their own rows; audit any read that returns other members rows once the readers are named.'
const KEEP_AUDIT = 'Keep the in-transaction audit row and add the authority decision and the values before and after the change.'
const STATUS = 'PARTIAL'

const orgGuard = (a) => a.h('tenantScope', /if \(!(organizationId|userId) \|\| !(organizationId|userId)\) throw ApiError\.badRequest\('Organization context required'\)/)

/* ---------- member dues ---------- */
function duesBalanceGet(a) {
  return mk({
    persona: 'Member reading their own dues balance and recent ledger entries',
    service: `${a.routeFile} (GET: plain handler, auth(), shared db select of member_dues_ledger by user id and client-supplied organization id)`,
    authn: `${SESSION} read directly in the handler (auth() from the Entra server module; 401 without a user id).`,
    cat: 'SESSION_ONLY',
    authz: 'Session only: any signed-in user is accepted and no role is read. The organization id comes from the organizationId query value or the x-organization-id header and is not checked against the caller memberships (the sibling pay GET calls requireUserForOrganization, this route does not); the rows are limited by the session user id. authorizeAction is not called.',
    tenant: 'The organization is taken from the client (query or header). Every query carries eq(memberDuesLedger.userId, userId) and eq(memberDuesLedger.organizationId, orgId) and status posted; the read goes through the shared db import with no withRLSContext, so the user id predicate and the connection role are the boundary.',
    owner: 'member_dues_ledger rows of the signed-in user in the organization the client names; the ledger is kept by the union (charges, payments, credits, adjustments, write-offs).',
    sens: 'Dues balance, totals by transaction type, transaction count and the last five ledger entries with amount, date, description and balance after',
    priv: 'The member receives their own balance, breakdown and five most recent entries; no other member row is selected. A caller can name any organization id and receives zeros when they have no posted rows there.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: REQ_AUDIT_READ,
    does: 'Sums the caller posted ledger entries by transaction type for the organization the client names, computes the balance as charges minus payments, credits, adjustments and write-offs, and returns the balance, a status of paid_up or owing, the breakdown, the count and the last five entries.',
    status: STATUS,
    gate: GATE,
    deps: [5, 13],
    future: 'Resolve the organization from the verified membership (or verify the named organization), read through an explicit tenant context, and return a real credit status.',
    dec: [D_DUES],
    ev: [
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', 'if (!userId) {'),
      a.h('tenantScope', 'const orgId = req.nextUrl.searchParams.get(\'organizationId\')'),
      a.h('tenantScope', 'eq(memberDuesLedger.organizationId, orgId),'),
      a.h('privacy', 'eq(memberDuesLedger.userId, userId),'),
      a.h('mutation', '.from(memberDuesLedger)'),
      a.tbl('privacy', 'memberDuesLedger', /paymentReference: text\('payment_reference'\)/),
      a.h('defect', "balanceStatus: currentBalance <= 0 ? 'paid_up' : currentBalance > 0 ? 'owing' : 'credit',"),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler opens no withRLSContext and imports db from @/db/db; it never compares the client-supplied organization id with the caller memberships.' },
    ],
    def: [
      'DEF-0B11-PRP-DUES-BALANCE-TAKES-THE-ORGANIZATION-FROM-THE-CLIENT-WITH-NO-MEMBERSHIP-CHECK-AND-NO-TENANT-CONTEXT',
      'DEF-0B11-PRP-DUES-BALANCE-CREDIT-STATUS-IS-UNREACHABLE',
    ],
    corr: [],
  })
}

function duesPayGet(a) {
  return mk({
    persona: 'Member reading their own recent dues ledger entries',
    service: `${a.routeFile} (GET: plain handler, auth(), requireUserForOrganization, withRLSContext select of member_dues_ledger)`,
    authn: `${SESSION} read directly in the handler (auth() from the Entra server module; 401 without a user id).`,
    authz: 'The handler requires a session, reads the organization from the query or header and then calls requireUserForOrganization(orgId), which refuses with 403 unless the caller holds a live canonical membership in that organization; no role beyond membership is required. authorizeAction is not called.',
    tenant: 'The organization is client-supplied but verified by requireUserForOrganization; the select runs inside withRLSContext({ organizationId }) with eq(userId, session user) and eq(organizationId, orgId) predicates.',
    owner: 'member_dues_ledger rows of the signed-in user in the verified organization.',
    sens: 'Ledger entries of every transaction type with amount, balance after, date, description, payment method, processor payment reference, receipt number and status',
    priv: 'The member receives their own ledger entries (up to 100), including the processor payment reference and receipt number; no other member row is returned.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: REQ_AUDIT_READ,
    does: 'Returns up to limit (at most 100) of the caller ledger entries of the organization, newest first, under the key payments, for every transaction type and status.',
    status: STATUS,
    gate: GATE,
    deps: [5, 13],
    future: 'Return payment attempts and settled payments distinctly, validate the limit, and keep the verified-membership check.',
    dec: [D_DUES],
    ev: [
      a.h('authentication', 'const { userId } = await auth()'),
      a.h('authorization', 'await requireUserForOrganization(orgId)'),
      a.imp('authorization', 'requireUserForOrganization', 'const user = await getUserContextForOrganization(organizationId, userId);'),
      a.h('tenantScope', 'const payments = await withRLSContext({ organizationId: orgId }, async () =>'),
      a.h('tenantScope', '.where(and(eq(memberDuesLedger.userId, userId), eq(memberDuesLedger.organizationId, orgId)))'),
      a.h('privacy', 'receiptNumber: memberDuesLedger.receiptNumber,'),
      a.h('mutation', '.from(memberDuesLedger)'),
      a.h('defect', "const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10), 100)"),
    ],
    inf: [
      { claim: 'defect', statement: 'The select has no condition on transaction_type, so charges, credits and write-offs are returned under payments, and the pending dues_transactions attempts that POST creates are in another table and never listed.' },
    ],
    def: ['DEF-0B11-PRP-DUES-PAY-GET-RETURNS-EVERY-LEDGER-ENTRY-TYPE-AS-PAYMENTS-AND-OMITS-PENDING-ATTEMPTS'],
    corr: [{ field: 'guard', manifest: 'control WITH_API_WRAPPER', actual: 'The GET is a plain handler that calls auth() and requireUserForOrganization itself; only the POST export uses withApi.' }],
  })
}

function duesPayPost(a) {
  return mk({
    persona: 'Member paying their outstanding dues by card',
    service: `${a.routeFile} (POST: withApi member floor with financial-write rate limit, assertMemberDuesPaymentEnabled, initiateDuesPayment: tenant transaction, Stripe PaymentIntent)`,
    authn: `${SESSION} through withApi (auth required).`,
    authz: 'withApi minRole member with the FINANCIAL_WRITE rate limit. The handler first calls assertMemberDuesPaymentEnabled(), which answers 501 unless UE_MEMBER_DUES_PAYMENTS=1; the amount, organization and member are derived server-side. authorizeAction is not called.',
    tenant: 'The organization and user come from the withApi session context; the balance query, the pending insert and the audit run in withRLSContext({ organizationId }) with organization and user predicates; no organization id is read from the body.',
    owner: 'dues_transactions row (pending, then settled by the verified processor webhook) and member_dues_ledger entries of the signed-in member; the PaymentIntent is created in the Stripe account configured by STRIPE_SECRET_KEY.',
    sens: 'Dues amount, the pending payment id, the Stripe PaymentIntent id and client secret, and the organization id and member user id sent to Stripe',
    priv: 'The member receives the payment id, intent id, client secret, amount and currency; the organization id and member user id are sent to Stripe in the intent metadata.',
    mut: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
    auditDetail: 'The pending dues_transactions row and its dues.payment_initiated audit row (persistAtomicAudit with the transaction handle) commit together; the Stripe call, the processor_payment_id update and the cancellation after a failed call are outside that transaction and write no audit row.',
    reqAudit: 'Audit the processor attachment and the cancellation, and record the initiation and the processor call as one attributable operation.',
    does: 'When enabled, computes the member outstanding balance from posted ledger entries, answers 409 when nothing is due, inserts a pending dues_transactions row for the full balance with its audit row, creates a Stripe PaymentIntent for that amount, stores the intent id on the row and returns the client secret; on a processor failure it sets the row to cancelled and answers an external-service error. When the flag is off it answers 501 before any of this.',
    status: STATUS,
    gate: GATE,
    deps: [1, 13],
    future: 'Decide the merchant account and member disclosure, reuse or refuse an existing pending payment, bound settlement by the balance owed, and audit the attachment and cancellation.',
    dec: [D_DUES],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { minRole: 'member' },"),
      a.h('authorization', 'rateLimit: RATE_LIMITS.FINANCIAL_WRITE,'),
      a.h('behavior', 'assertMemberDuesPaymentEnabled()'),
      a.imp('behavior', 'assertMemberDuesPaymentEnabled', "throw ApiError.notImplemented('Member dues payment is not enabled in this deployment')"),
      orgGuard(a),
      a.svc('tenantScope', DUES_SVC, 'const pending = await withRLSContext({ organizationId }, async (tx) => {', 'initiateDuesPayment'),
      a.svc('mutation', DUES_SVC, 'INSERT INTO dues_transactions', 'initiateDuesPayment'),
      a.svc('audit', DUES_SVC, 'await persistAtomicAudit(tx, {', 'initiateDuesPayment'),
      a.svc('privacy', DUES_SVC, 'member_user_id: userId,', 'initiateDuesPayment'),
      a.svc('defect', DUES_SVC, '{ idempotencyKey: `ue-dues-${pending.paymentId}` },', 'initiateDuesPayment'),
      a.svc('privacy', `${APP}lib/stripe.ts`, 'Delegates to @nzila/payments-stripe for a platform-managed Stripe client.'),
      a.svc('defect', DUES_SVC, "sql`UPDATE dues_transactions SET status = 'cancelled', updated_at = now()", 'initiateDuesPayment'),
    ],
    inf: [
      { claim: 'defect', statement: 'lib/dues/dues-settlement.ts (the verified-webhook settlement, which this route does not call) locks the paid row FOR UPDATE, updates it from pending, reads the balance and inserts a payment ledger entry whose balance_after is the prior balance minus the row amount, with no comparison against the balance owed.' },
      { claim: 'defect', statement: 'initiateDuesPayment searches for no pending dues_transactions row of the member before inserting, and the intent idempotency key contains the id of the row just inserted, so it deduplicates nothing across calls; settlement locks the one paid row and never reads the balance owed before inserting the payment entry.' },
    ],
    def: [
      'DEF-0B11-PRP-DUES-PAY-POST-CREATES-A-NEW-FULL-BALANCE-PAYMENT-AND-INTENT-ON-EVERY-CALL-AND-SETTLEMENT-DOES-NOT-RECHECK-THE-BALANCE',
      'DEF-0B11-PRP-DUES-PAY-POST-INITIATION-AUDIT-COMMITS-BEFORE-THE-PROCESSOR-CALL-AND-THE-LATER-STATE-CHANGES-ARE-UNAUDITED',
      'DEF-0B11-PRP-DUES-PAY-POST-SENDS-THE-ORGANIZATION-AND-MEMBER-USER-ID-TO-THE-PROCESSOR-FOR-A-MERCHANT-ACCOUNT-NO-SOURCE-NAMES',
    ],
    corr: [{ field: 'audit', manifest: 'audit AUDIT_DECLARED_ATOMIC:ATOMIC_SERVICE', actual: 'Only the initiation insert and its audit row are atomic; the processor call, the processor_payment_id update and the cancellation are outside that transaction and unaudited.' }],
  })
}

/* ---------- precedent library ---------- */
const precedentsGet = (a) => mk({
  persona: 'Member researching arbitration decisions of the shared precedent library',
  service: `${a.routeFile} (GET: withRoleAuth member floor; listPrecedents, getPrecedentStatistics, getMostCitedPrecedents or getPrecedentsByIssueType over arbitration_decisions)`,
  authn: `${SESSION} through withRoleAuth (401 without a user).`,
  authz: 'withRoleAuth(member): any member of the resolved organization at any role reads. The organization is resolved for the session but is not used by the queries; no decision on who may read a decision. authorizeAction is not called.',
  tenant: 'None applied: the queries run through the shared db import over arbitration_decisions, a table with no organization column, so the library is one set of rows for every organization and no predicate narrows it.',
  owner: 'arbitration_decisions rows of the shared library; contributed by the platform content role, not owned by an organization.',
  sens: 'Arbitration decision case number and title, tribunal, arbitrator, panel members, grievor name, union and employer, outcome, full text, summary and embedding',
  priv: 'Every member of every organization receives full decision rows including the grievor, the full text and the embedding, whatever is_public and access_restrictions say; the statistics mode returns counts of the whole library.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the route writes no row and no audit record.',
  reqAudit: 'Audit reads of restricted decisions once the audience and the restriction rule are decided.',
  does: 'Returns, by query mode, library statistics, the most cited decisions, decisions for an issue type, or a filtered, sorted and paged list of arbitration decisions with every column; limit and page are unbounded parseInt values.',
  status: STATUS,
  gate: GATE,
  deps: [6, 13],
  future: 'Apply is_public and access_restrictions, project the columns members may see, bound the page size, and decide the audience of the shared library.',
  dec: [D_PREC, D_KNOWLEDGE],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "withRoleAuth('member'"),
    a.h('mutation', 'const result = await listPrecedents(filters, { page, limit, sortBy, sortOrder });'),
    a.svc('tenantScope', PREC_SVC, '.from(arbitrationDecisions)', 'listPrecedents'),
    a.svc('privacy', PREC_SVC, '.select()', 'listPrecedents'),
    a.sch('privacy', DECISIONS_SCHEMA, /grievor: varchar\("grievor"/, { symbol: 'arbitrationDecisions' }),
    a.sch('privacy', DECISIONS_SCHEMA, /fullText: text\("full_text"\)\.notNull\(\)/, { symbol: 'arbitrationDecisions' }),
    a.sch('privacy', DECISIONS_SCHEMA, /accessRestrictions: text\("access_restrictions"\)/, { symbol: 'arbitrationDecisions' }),
    a.h('defect', 'const limit = parseInt(searchParams.get("limit") || "20");'),
  ],
  inf: [
    { claim: 'defect', statement: 'None of the library service queries references is_public or access_restrictions, and the select has no column list, so the grievor, full text and embedding are returned for every row.' },
  ],
  def: [
    'DEF-0B11-PRP-PRECEDENT-LIBRARY-READS-RETURN-EVERY-COLUMN-AND-IGNORE-IS-PUBLIC-AND-ACCESS-RESTRICTIONS',
    'DEF-0B11-PRP-PRECEDENT-COLLECTION-GET-TAKES-UNBOUNDED-LIMIT-AND-PAGE-FROM-THE-QUERY-STRING',
  ],
  corr: [],
})

const precedentsPost = (a) => mk({
  persona: 'Platform content role adding an arbitration decision to the shared library',
  service: `${a.routeFile} (POST: withRoleAuth content_manager, zod body, createPrecedentAudited: tenant transaction with persistAtomicAudit)`,
  authn: `${SESSION} through withRoleAuth (401 without a user).`,
  authz: 'withRoleAuth(content_manager): the role hierarchy places content_manager above administrator, and the route comment says only a platform-elevated role may add to the shared library; the active organization of the session is required (403 without one). A role title decides; authorizeAction is not called and no review or consent step exists.',
  tenant: 'The insert writes into arbitration_decisions, which has no organization column, so the row belongs to no organization and is visible to all; the session organization is used only for the tenant transaction and the audit row.',
  owner: 'arbitration_decisions row of the shared library; the contributing organization and user appear only in the audit row.',
  sens: 'Arbitration decision text, grievor and party names, panel members, outcome and reasoning',
  priv: 'The typed decision, including the full text and the grievor, becomes readable by every member of every organization at once (is_public defaults to true); the response returns the stored row.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The insert and the precedent.create audit row (persistAtomicAudit with the transaction handle) commit in one tenant transaction; the audit names the case number and tribunal.',
  reqAudit: KEEP_AUDIT,
  does: 'Validates the decision with zod, inserts it into arbitration_decisions in a tenant transaction with an atomic precedent.create audit row and returns it; a duplicate case number answers a conflict.',
  status: STATUS,
  gate: GATE,
  deps: [1, 13],
  future: 'Add a review and redaction step, record the contributing organization and source on the row, and decide who may publish to the shared library.',
  dec: [D_PREC, D_KNOWLEDGE],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "withRoleAuth('content_manager'"),
    a.h('tenantScope', "return standardErrorResponse(ErrorCode.FORBIDDEN, 'No active organization');"),
    a.h('mutation', 'const precedent = await createPrecedentAudited({ organizationId, userId }, validation.data);'),
    a.svc('mutation', PREC_AUDITED, 'const [precedent] = await tx.insert(arbitrationDecisions).values(data).returning();', 'createPrecedentAudited'),
    a.svc('audit', PREC_AUDITED, 'await persistAtomicAudit(tx, {', 'createPrecedentAudited'),
    a.svc('audit', PREC_AUDITED, "action: 'precedent.create',", 'createPrecedentAudited'),
    a.sch('privacy', DECISIONS_SCHEMA, /isPublic: boolean\("is_public"\)\.default\(true\)/, { symbol: 'arbitrationDecisions' }),
    a.local('defect', 'precedentsSchema', 'fullText: z.string().min(1),'),
  ],
  inf: [
    { claim: 'defect', statement: 'The insert omits is_public, access_restrictions and importedFrom (the audited service omits them from its input type), so the database default of public applies and no provenance is recorded.' },
  ],
  def: ['DEF-0B11-PRP-PRECEDENT-POST-PUBLISHES-INTO-THE-SHARED-LIBRARY-WITH-NO-REVIEW-PROVENANCE-OR-OWNING-ORGANIZATION'],
  corr: [],
})

const precedentsSearch = (a) => mk({
  persona: 'Steward searching the arbitration decision library',
  service: `${a.routeFile} (POST: withRoleAuth steward, zod body, searchPrecedents over arbitration_decisions)`,
  authn: `${SESSION} through withRoleAuth (401 without a user).`,
  authz: 'withRoleAuth(steward): steward and above; the POST is a read of the shared library and takes the query in the body. authorizeAction is not called.',
  tenant: 'None applied: searchPrecedents queries arbitration_decisions, which has no organization column, through the shared db import.',
  owner: 'arbitration_decisions rows of the shared library.',
  sens: 'Arbitration decision case number and title, grievor name, panel members, full text, summary and embedding',
  priv: 'The steward receives full decision rows, including the grievor and the embedding, whose title, number, summary, headnote or full text contain the pattern; is_public and access_restrictions are not applied.',
  mut: 'NOT_MUTATING',
  nonMutationReason: 'The POST carries the search query in the body and returns matching rows; searchPrecedents runs a select and writes nothing.',
  auditDetail: 'A read: the search writes no row and no audit record.',
  reqAudit: 'Audit searches of restricted decisions once the audience and restriction rule are decided.',
  does: 'Validates the query, filters and limit, matches the query as a %pattern% over the title, number, summary, headnote and full text, applies optional precedent value and tribunal filters, orders by precedent value and citation count and returns up to the limit rows and their count.',
  status: STATUS,
  gate: GATE,
  deps: [6, 13],
  future: 'Escape the pattern, validate the filters, project the columns, and apply the restriction columns.',
  dec: [D_PREC, D_KNOWLEDGE],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "withRoleAuth('steward'"),
    a.h('mutation', 'const results = await searchPrecedents(query, filters, limit);'),
    a.h('audit', 'const results = await searchPrecedents(query, filters, limit);'),
    a.svc('mutation', PREC_SVC, '.from(arbitrationDecisions)', 'searchPrecedents'),
    a.svc('tenantScope', PREC_SVC, '.where(and(...conditions))', 'searchPrecedents'),
    a.svc('privacy', PREC_SVC, 'like(arbitrationDecisions.fullText, `%${query}%`)', 'searchPrecedents'),
    a.local('defect', 'precedentSearchSchema', 'filters: z.record(z.string(), z.unknown()).prefault({}),'),
    a.svc('defect', PREC_SVC, 'inArray(arbitrationDecisions.tribunal, filters.tribunal as TribunalFilter[])', 'searchPrecedents'),
  ],
  inf: [],
  def: [
    'DEF-0B11-PRP-PRECEDENT-LIBRARY-READS-RETURN-EVERY-COLUMN-AND-IGNORE-IS-PUBLIC-AND-ACCESS-RESTRICTIONS',
    'DEF-0B11-PRP-PRECEDENT-SEARCH-USES-UNESCAPED-WILDCARD-LIKE-OVER-THE-FULL-TEXT-AND-CASTS-UNVALIDATED-FILTERS',
  ],
  corr: [],
})

function precedentItem(a, readText) {
  const profile = {
    persona: 'Steward or administrator of an organization managing the arbitration precedents it contributed to the federation (any organization row is addressable by id)',
    owner: 'arbitration_precedents rows keyed by source_organization_id (the contributing organization) with a sharing level, shared-with organization list, anonymization flag, case summary, positions and reasoning; tags and citations hang off the row.',
    sens: 'Case title and number, union and employer names (unless anonymized), arbitrator, issue summary, union and employer positions, outcome, reasoning, document links, sharing level and shared-with organization ids',
    priv: (method) => (method === 'GET'
      ? 'A member of any organization receives the whole row of the precedent named by the id, including positions, reasoning, party names and document links, whichever organization contributed it and whatever its sharing level.'
      : method === 'PATCH'
        ? 'A steward of any organization rewrites any precedent row named by the id, including its sharing level, shared-with list, anonymization flag and source organization; the response returns the stored row.'
        : 'An administrator of any organization permanently deletes the precedent named by the id and its tags and citations; the response confirms the deletion.'),
    does: (method, _model, floor) => (method === 'GET'
      ? `Returns the arbitration_precedents row whose id is the path id at a role floor of ${floor}; the tenant predicate is not added because the table has no organizationId column.`
      : method === 'PATCH'
        ? `Updates the arbitration_precedents row named by the path id from the request body at a role floor of ${floor}, with no tenant predicate and an atomic audit row.`
        : `Hard-deletes the arbitration_precedents row named by the path id at a role floor of ${floor}, with no tenant predicate; tags and citations cascade.`),
    future: 'Scope the routes to source_organization_id and the sharing level, restrict writable columns, soft-delete or refuse deletion of shared precedents, and decide the contribution and withdrawal authority.',
    gate: GATE,
    deps: [6, 13],
    status: () => 'FACADE_OVER_GENERIC_TABLE',
    decisions: [D_PREC, D_SHARING],
    def: (method) => [
      'DEF-0B11-PRP-PRECEDENT-ITEM-ROUTE-ORGANIZATION-SCOPE-IS-A-NO-OP-ON-A-TABLE-KEYED-BY-SOURCE-ORGANIZATION',
      ...(method === 'PATCH' ? ['DEF-0B11-PRP-PRECEDENT-ITEM-PATCH-WRITES-SHARING-LEVEL-SHARED-WITH-LIST-AND-SOURCE-ORGANIZATION-FROM-THE-BODY'] : []),
      ...(method === 'DELETE' ? ['DEF-0B11-PRP-PRECEDENT-ITEM-DELETE-HARD-DELETES-THE-PRECEDENT-AND-CASCADES-TO-ITS-TAGS-AND-CITATIONS'] : []),
    ],
    extraEv: (b, model) => [
      b.tbl('privacy', model.tableName, /sourceOrganizationId: uuid\("source_organization_id"\)/),
      b.tbl('privacy', model.tableName, /sharingLevel: varchar\("sharing_level"/),
      ...(b.method === 'PATCH' ? [b.tbl('defect', model.tableName, /sharedWithOrgIds: uuid\("shared_with_org_ids"\)\.array\(\)/)] : []),
    ],
    inferences: (method) => [
      { claim: 'defect', statement: `The factory conditions for ${method} are the primary key only: the table has no organizationId, status, userId or memberId column, so orgScoped true and the low-role guard add no condition.` },
      ...(method === 'DELETE' ? [{ claim: 'defect', statement: 'precedent_tags and precedent_citations reference arbitration_precedents.id with onDelete cascade in db/schema/arbitration-precedents-schema.ts, so the hard delete removes them.' }] : []),
    ],
    reqRead: 'Audit reads of contributed precedents once the sharing audience is decided.',
  }
  const record = crudRecord(a, readText, profile)
  record.defects = [...new Set(record.defects.map((id) => (id === 'DEF-0B4-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN' ? 'DEF-0B11-PRP-PRECEDENT-ITEM-ROUTE-ORGANIZATION-SCOPE-IS-A-NO-OP-ON-A-TABLE-KEYED-BY-SOURCE-ORGANIZATION' : id)))]
  return record
}

const prefsGet = (a) => mk({
  persona: 'Member reading their own jurisdiction preferences for precedent filtering',
  service: `${a.routeFile} (GET: withApi member floor, shared db select of member_jurisdiction_preferences by user and organization)`,
  authn: `${SESSION} through withApi (auth required).`,
  authz: 'withApi minRole member: any member reads their own preference row; the rows are selected by the session user id and organization. authorizeAction is not called.',
  tenant: 'The organization and user come from the withApi session; the select carries eq(userId) and eq(organizationId) through the shared db import with no explicit withRLSContext.',
  owner: 'member_jurisdiction_preferences row of the signed-in member in the organization.',
  sens: 'Preferred jurisdictions and levels and two flags of the member',
  priv: 'The member receives their own preference row, or defaults when none exists; no other member row is selected.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the route writes no row and no audit record.',
  reqAudit: 'Reads of a personal preference need no audit.',
  does: 'Returns the caller preference row with isConfigured true, or empty arrays with includeNational and autoApply true and isConfigured false when none exists.',
  status: STATUS,
  gate: GATE,
  deps: [6, 13],
  future: 'Apply the preference in a server-side precedent query or retire the route, and add a unique row per member and organization.',
  dec: [D_PREC],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'eq(memberJurisdictionPreferences.organizationId, organizationId!),'),
    a.h('privacy', 'eq(memberJurisdictionPreferences.userId, userId!),'),
    a.h('mutation', '.from(memberJurisdictionPreferences)'),
    a.tbl('defect', 'memberJurisdictionPreferences', /autoApply: boolean\('auto_apply'\)/),
  ],
  inf: [{ claim: 'defect', statement: 'No precedent route or service reads member_jurisdiction_preferences; the console components apply the preference in the browser.' }],
  def: ['DEF-0B11-PRP-JURISDICTION-PREFERENCES-HAVE-NO-UNIQUE-ROW-UNVALIDATED-FLAGS-AND-NO-SERVER-CONSUMER'],
  corr: [],
})

const prefsPut = (a) => mk({
  persona: 'Member saving their own jurisdiction preferences for precedent filtering',
  service: `${a.routeFile} (PUT: withApi member floor, manual validation, withRLSContext select then update or insert with persistAtomicAudit)`,
  authn: `${SESSION} through withApi (auth required).`,
  authz: 'withApi minRole member: any member writes their own preference row; the row is selected and written by the session user id and organization. authorizeAction is not called.',
  tenant: 'The organization and user come from the withApi session (400 without them); the select, update and insert run in withRLSContext({ organizationId }) with eq(userId) and eq(organizationId) predicates.',
  owner: 'member_jurisdiction_preferences row of the signed-in member in the organization.',
  sens: 'Preferred jurisdictions and levels and two flags of the member',
  priv: 'The member writes and receives their own preference row; the audit row lists the changed field names only.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The update or insert and the precedent.jurisdiction_preferences.update or .create audit row (persistAtomicAudit with the transaction handle) commit in one tenant transaction.',
  reqAudit: KEEP_AUDIT,
  does: 'Validates the jurisdiction and level arrays against fixed lists, then updates the caller row or inserts one, and returns it with isConfigured true; includeNational and autoApply are written as typed.',
  status: STATUS,
  gate: GATE,
  deps: [6, 13],
  future: 'Validate the flags, enforce one row per member and organization, and apply the preference on the server or retire the route.',
  dec: [D_PREC],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    orgGuard(a),
    a.h('tenantScope', 'return withRLSContext({ organizationId: organizationId! }, async (tx) => {'),
    a.h('mutation', '.update(memberJurisdictionPreferences)'),
    a.h('mutation', '.insert(memberJurisdictionPreferences)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('audit', "action: 'precedent.jurisdiction_preferences.update',"),
    a.h('defect', 'if (includeNational !== undefined) data.includeNational = includeNational;'),
    a.tbl('defect', 'memberJurisdictionPreferences', /autoApply: boolean\('auto_apply'\)/),
  ],
  inf: [{ claim: 'defect', statement: 'The table definition declares no unique index on user_id and organization_id and the handler reads then writes without a lock, so two concurrent first saves can insert two rows.' }],
  def: ['DEF-0B11-PRP-JURISDICTION-PREFERENCES-HAVE-NO-UNIQUE-ROW-UNVALIDATED-FLAGS-AND-NO-SERVER-CONSUMER'],
  corr: [],
})

/* ---------- profile ---------- */
const profileMe = (a) => mk({
  persona: 'Signed-in user reading their own subscription and billing profile',
  service: `${a.routeFile} (GET: plain handler, auth(), getProfileByUserId over profiles by user id)`,
  authn: `${SESSION} read directly in the handler (auth() from the api-auth-guard module; 401 without a user id).`,
  cat: 'SESSION_ONLY',
  authz: 'Session only: any signed-in user reads their own profile row; no role and no organization are involved. authorizeAction is not called.',
  tenant: 'Not organization-scoped: the profiles table has no organization column and the lookup is by the session user id (getProfileByUserId runs the select inside withRLSContext, and the profiles row-level-security policy compares the user id setting).',
  owner: 'profiles row of the signed-in user (the platform subscription profile).',
  sens: 'Email, membership tier, payment provider, Stripe customer and subscription ids, Whop ids, plan dates and credit counters',
  priv: 'The user receives their own whole profile row, including the Stripe and Whop identifiers.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the route writes no row and no audit record.',
  reqAudit: 'Reads of a personal profile need no audit.',
  does: 'Looks up the profile by the session user id and returns it under data with isSuccess true, or data null with the same success message when the lookup fails, times out or finds no row.',
  status: STATUS,
  gate: GATE,
  deps: [1],
  future: 'Distinguish a missing profile from a failed lookup and project the fields the client needs.',
  dec: [D_CONTRACT],
  ev: [
    a.h('authentication', 'const { userId } = await auth();'),
    a.h('authorization', 'if (!userId) {'),
    a.h('tenantScope', 'const profile = await getProfileByUserId(userId);'),
    a.svc('tenantScope', PROFILES_QUERIES, 'dbOrTx.select().from(profilesTable).where(eq(profilesTable.userId, userId))', 'getProfileByUserId'),
    a.svc('mutation', PROFILES_QUERIES, 'dbOrTx.select().from(profilesTable).where(eq(profilesTable.userId, userId))', 'getProfileByUserId'),
    a.svc('tenantScope', PROFILES_QUERIES, 'return withRLSContext(async (tx) => executeQuery(tx));', 'getProfileByUserId'),
    a.sch('privacy', PROFILES_SCHEMA, 'stripeCustomerId: text("stripe_customer_id"),'),
    a.h('defect', 'message: "Profile retrieved successfully",'),
  ],
  inf: [{ claim: 'defect', statement: 'getProfileByUserId wraps the lookup in a try with a catch that returns null, so a failed or timed-out query reaches the route as no profile.' }],
  def: ['DEF-0B11-PRP-PROFILE-ME-GET-SWALLOWS-DATABASE-ERRORS-INTO-A-SUCCESS-WITH-NULL-DATA'],
  corr: [],
})

function profileRoles(a, readText) {
  const profile = {
    persona: 'Steward expecting a role list, or member reading their own billing profile, through a path named roles',
    owner: 'profiles rows of the platform subscription system (one per user, no organization column); the route holds no role data.',
    sens: 'Email, membership tier, payment provider, Stripe customer and subscription ids, Whop ids, plan dates and credit counters of the profile rows returned',
    priv: (method) => (method === 'GET'
      ? 'A caller below steward receives only their own profile row; a steward or higher of any organization receives every profile of the platform with email and payment-provider identifiers, in pages of up to 100 rows.'
      : 'No row is created: profiles is READ_ONLY in the CRUD governance table, so the factory refuses the write with 403 after the role check.'),
    does: (method, _model, floor) => (method === 'GET'
      ? `Lists profiles rows at a role floor of ${floor}; no tenant predicate is added because profiles has no organization column, callers below steward are held to their own row and staff are unrestricted.`
      : `Refuses the create at a role floor of ${floor} because profiles is READ_ONLY in the CRUD governance table.`),
    future: 'Retire the path or replace it with an own-profile read, hold every caller to their own row, and keep role assignment on a dedicated authority.',
    gate: GATE,
    deps: [6, 13],
    status: () => 'FACADE_OVER_GENERIC_TABLE',
    decisions: [D_ROSTER, D_CONTRACT],
    def: (method) => [
      'DEF-0B11-PRP-PROFILE-ROLES-PATH-IS-A-BILLING-PROFILE-LIST-AND-ITS-POST-IS-REFUSED',
      ...(method === 'GET' ? ['DEF-0B11-PRP-PROFILE-ROLES-GET-LISTS-EVERY-USER-BILLING-PROFILE-TO-STEWARD-AND-ABOVE-OF-ANY-ORGANIZATION'] : []),
    ],
    extraEv: (b) => [
      b.sch('privacy', PROFILES_SCHEMA, /stripeCustomerId: text\("stripe_customer_id"\)/, { symbol: 'profilesTable' }),
      b.sch('privacy', PROFILES_SCHEMA, /membership: membershipEnum\("membership"\)/, { symbol: 'profilesTable' }),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'profiles has a userId column, so callers below steward are held to their own row, and the guard returns an empty scope for steward and above; the table has no organizationId column, so orgScoped true adds no condition.' },
    ],
    reqRead: 'Audit staff reads of other users billing profiles once the readers are decided.',
  }
  const record = crudRecord(a, readText, profile)
  record.evidence = record.evidence.filter((item) => item.resolvesExport !== 'profilesTable')
  record.evidence.push(a.sch('tenantScope', PROFILES_SCHEMA, /pgTable\("profiles"/, { symbol: 'profilesTable', absentColumns: ['organizationId', 'organization_id'] }))
  record.defects = [...new Set(record.defects.flatMap((id) => {
    if (id !== 'DEF-0B4-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN') return [id]
    return a.method === 'GET' ? ['DEF-0B11-PRP-PROFILE-ROLES-GET-LISTS-EVERY-USER-BILLING-PROFILE-TO-STEWARD-AND-ABOVE-OF-ANY-ORGANIZATION'] : []
  }))]
  return record
}

/* ---------- reconciliation ---------- */
const mandateEv = (a, action) => [
  a.h('authorization', `action: '${action}'`),
  a.imp('authorization', 'requireLiveFinancialMandate', 'return await assertPrincipalFinancialAuthority(drizzleExecutor(tx), input)'),
  a.h('tenantScope', 'await withRLSContext({ organizationId, userId }, (tx) =>'),
  orgGuard(a),
]

const RECON_READ_COMMON = {
  gate: GATE,
  deps: [1, 13],
  status: STATUS,
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the route writes no row and no audit record; withApi adds no audit for a GET.',
  reqAudit: 'Audit reads of reconciliation figures once the readers are named.',
  dec: [D_RECON, D_CONTRACT],
}

const reconBank = (a) => mk({
  ...RECON_READ_COMMON,
  persona: 'Officer reading the reconciliation runs of the organization (the path says bank)',
  service: `${a.routeFile} (GET: withApi officer with commercial_reporting entitlement, requireLiveFinancialMandate finance:view, shared db select of reconciliation_runs)`,
  authn: `${SESSION} through withApi (auth required).`,
  authz: 'withApi minRole officer plus the commercial_reporting entitlement, then requireLiveFinancialMandate with the finance:view action and requiresLedger (a live financial mandate that the caller holds). The mandate check is not the kernel authorizeAction, so kernelAuthorization stays false; the grant it returns is discarded.',
  tenant: 'The organization comes from the withApi session; the mandate check runs in withRLSContext, but the select goes through the shared db import with eq(reconciliationRuns.organizationId, organizationId) as the only predicate.',
  owner: 'reconciliation_runs rows of the organization (platform invoice and payment reconciliation, not bank transactions).',
  sens: 'Reconciliation run periods, invoice and payment counts and totals in CAD, variance, run-by user id and status',
  priv: 'The officer receives every reconciliation run of the organization, unpaged; no other organization row is selected by this route.',
  does: 'Checks the finance:view mandate, then returns every reconciliation run of the organization, newest first; it lists runs of platform invoices and payments and does not read a bank statement.',
  future: 'Name the bank reconciliation or retire the path, page the list, and read through an explicit tenant context.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'officer' },"),
    a.h('authorization', "entitlement: 'commercial_reporting',"),
    ...mandateEv(a, 'finance:view'),
    a.h('tenantScope', '.where(eq(reconciliationRuns.organizationId, organizationId))'),
    a.h('mutation', '.from(reconciliationRuns)'),
    a.tbl('privacy', 'reconciliationRuns', /varianceCad: decimal\('variance_cad'/),
  ],
  inf: [{ claim: 'defect', statement: 'The select has no limit, offset or date range and runs outside the withRLSContext callback, through the shared db import.' }],
  def: [
    'DEF-0B11-PRP-RECONCILIATION-BANK-AND-UPLOAD-PATHS-ARE-NAMED-FOR-BANK-FEEDS-BUT-LIST-RUNS-AND-EXCEPTIONS',
    'DEF-0B11-PRP-RECONCILIATION-LISTS-ARE-UNBOUNDED-AND-THE-EXCEPTION-STATUS-FILTER-IS-AN-UNVALIDATED-CAST',
  ],
  corr: [],
})

const reconUpload = (a) => mk({
  ...RECON_READ_COMMON,
  persona: 'Officer reading the open reconciliation exceptions of the organization (the path says upload)',
  service: `${a.routeFile} (GET: withApi officer with commercial_reporting entitlement, requireLiveFinancialMandate finance:view, listExceptions over reconciliation_exceptions)`,
  authn: `${SESSION} through withApi (auth required).`,
  authz: 'withApi minRole officer plus the commercial_reporting entitlement, then requireLiveFinancialMandate with the finance:view action and requiresLedger. The mandate check is not the kernel authorizeAction, so kernelAuthorization stays false; the grant it returns is discarded.',
  tenant: 'The organization comes from the withApi session; the service query carries eq(reconciliationExceptions.organizationId, organizationId) through the shared db import with no tenant context.',
  owner: 'reconciliation_exceptions rows of the organization.',
  sens: 'Exception type, status, source id, expected and actual amounts, variance, description, resolver and resolution notes',
  priv: 'The officer receives every exception of the organization in the requested statuses (default open and under_review), unpaged.',
  does: 'Checks the finance:view mandate, then returns the organization reconciliation exceptions in the statuses given by the query (comma separated, cast without validation) or open and under_review; it receives no file, despite the path.',
  future: 'Implement the bank-statement intake or rename the path, validate the status values, and page the list.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'officer' },"),
    a.h('authorization', "entitlement: 'commercial_reporting',"),
    ...mandateEv(a, 'finance:view'),
    a.svc('tenantScope', RECON_SVC, 'eq(reconciliationExceptions.organizationId, organizationId),', 'listExceptions'),
    a.svc('mutation', RECON_SVC, '.from(reconciliationExceptions)', 'listExceptions'),
    a.sch('privacy', RECON_SCHEMA, /resolutionNotes: text\('resolution_notes'\)/, { symbol: 'reconciliationExceptions' }),
    a.h('defect', "? (status.split(',') as ('open' | 'under_review' | 'resolved' | 'written_off')[])"),
  ],
  inf: [{ claim: 'defect', statement: 'The route comment says the upload endpoint is reserved for future bank-statement intake; the handler reads no body and no file.' }],
  def: [
    'DEF-0B11-PRP-RECONCILIATION-BANK-AND-UPLOAD-PATHS-ARE-NAMED-FOR-BANK-FEEDS-BUT-LIST-RUNS-AND-EXCEPTIONS',
    'DEF-0B11-PRP-RECONCILIATION-LISTS-ARE-UNBOUNDED-AND-THE-EXCEPTION-STATUS-FILTER-IS-AN-UNVALIDATED-CAST',
    'DEF-0B11-PRP-RECONCILIATION-SERVICE-QUERIES-THROUGH-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY',
  ],
  corr: [],
})

const reconProcessGet = (a) => mk({
  ...RECON_READ_COMMON,
  persona: 'Officer reading one reconciliation run by id (any organization run id is accepted)',
  service: `${a.routeFile} (GET: withApi officer with commercial_reporting entitlement, requireLiveFinancialMandate finance:view, getReconciliationRun by run id)`,
  authn: `${SESSION} through withApi (auth required).`,
  authz: 'withApi minRole officer plus the commercial_reporting entitlement, then requireLiveFinancialMandate with the finance:view action in the caller own organization. The run id from the query is not related to the caller organization; kernelAuthorization stays false.',
  tenant: 'The organization from the session is used only for the mandate check; getReconciliationRun filters on the run id alone through the shared db import, so the run of any organization is returned.',
  owner: 'reconciliation_runs row named by the run id, owned by whichever organization created it.',
  sens: 'Reconciliation run period, invoice and payment counts and totals in CAD, variance, run-by user id, billing period id and status',
  priv: 'A caller who knows or guesses a run id receives that run whichever organization owns it; the mandate check gates only the caller own organization.',
  does: 'Checks the caller finance:view mandate, reads the runId query value and returns the reconciliation run with that id (404 when absent) with no organization condition.',
  future: 'Add the organization predicate to getReconciliationRun and the route, and verify the run belongs to the caller organization before the response.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'officer' },"),
    a.h('authorization', "entitlement: 'commercial_reporting',"),
    ...mandateEv(a, 'finance:view'),
    a.h('tenantScope', 'const run = await getReconciliationRun(runId);'),
    a.svc('tenantScope', RECON_SVC, '.where(eq(reconciliationRuns.id, runId))', 'getReconciliationRun'),
    a.svc('mutation', RECON_SVC, '.from(reconciliationRuns)', 'getReconciliationRun'),
    a.sch('privacy', RECON_SCHEMA, /varianceCad: decimal\('variance_cad'/, { symbol: 'reconciliationRuns' }),
  ],
  inf: [{ claim: 'defect', statement: 'getReconciliationRun takes only the run id; the route passes no organization id to it.' }],
  def: [
    'DEF-0B11-PRP-RECONCILIATION-PROCESS-GET-RETURNS-ANY-ORGANIZATION-RUN-BY-ID',
    'DEF-0B11-PRP-RECONCILIATION-SERVICE-QUERIES-THROUGH-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY',
  ],
  corr: [],
})

const reconProcessPost = (a) => mk({
  persona: 'Administrator running a platform reconciliation for a period',
  service: `${a.routeFile} (POST: withApi admin with commercial_reporting entitlement and financial-write rate limit, requireLiveFinancialMandate finance:reconcile, runReconciliation: db.transaction over invoices, payments, allocations and fee events)`,
  authn: `${SESSION} through withApi (auth required).`,
  authz: 'withApi minRole admin plus the commercial_reporting entitlement, the FINANCIAL_WRITE rate limit and requireLiveFinancialMandate with the finance:reconcile action and requiresLedger. The mandate check is not the kernel authorizeAction, so kernelAuthorization stays false; the grant it returns is discarded and no participants are passed to the segregation-of-duties rule.',
  tenant: 'The organization comes from the withApi session; the service filters invoices, payments and fee events by it; the billingPeriodId from the body is stored without being checked against the organization; the writes go through the shared db handle in db.transaction.',
  owner: 'reconciliation_runs, reconciliation_matches and reconciliation_exceptions rows created for the organization from its platform invoices, payments and fee events.',
  sens: 'Platform invoice and payment totals in CAD for the period, variance, run-by user id and exception rows',
  priv: 'The administrator receives the run result (run id, totals, counts, variance); the audit event records the totals.',
  mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
  auditDetail: 'The run, matches and exceptions are written in db.transaction, and auditLog (reconciliation_completed, and a critical variance event above 100 dollars) is a separate write through the application audit logger that does not take the transaction handle.',
  reqAudit: 'Write the audit row with the transaction handle (persistAtomicAudit) so the run and its record commit together.',
  does: 'Checks the finance:reconcile mandate, inserts a reconciliation run for the period, matches invoices to payments through allocations, records unmatched and discrepancy exceptions, adds fee_settlement matches for fee events that have a settlement batch, stores totals and variance, audits and returns the result; a repeat call creates another run.',
  status: STATUS,
  gate: GATE,
  deps: [1, 13],
  future: 'Make runs repeatable or superseding, bind the billing period to the organization, compute fee matches from settlement amounts, and audit atomically.',
  dec: [D_RECON, D_CONTRACT],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'admin' },"),
    a.h('authorization', "entitlement: 'commercial_reporting',"),
    a.h('authorization', 'rateLimit: RATE_LIMITS.FINANCIAL_WRITE,'),
    ...mandateEv(a, 'finance:reconcile'),
    a.svc('mutation', RECON_SVC, '.insert(reconciliationRuns)', 'runReconciliation'),
    a.svc('tenantScope', RECON_SVC, 'invoiceConditions.push(eq(platformInvoices.organizationId, input.organizationId));', 'runReconciliation'),
    a.svc('audit', RECON_SVC, 'await auditLog({', 'runReconciliation'),
    a.svc('defect', RECON_SVC, "matchType: 'fee_settlement',", 'runReconciliation'),
    a.svc('defect', RECON_SVC, "varianceCad: '0.00',", 'runReconciliation'),
    a.svc('defect', RECON_SVC, "inArray(platformPayments.status, ['completed', 'refunded']),", 'runReconciliation'),
    a.local('defect', 'processSchema', 'billingPeriodId: z.guid().optional(),'),
    a.svc('defect', RECON_SVC, 'eq(reconciliationRuns.billingPeriodId, billingPeriodId),', 'requireReconciliation'),
    a.sch('privacy', RECON_SCHEMA, "'orphaned_refund',", { symbol: 'reconciliationExceptionTypeEnum' }),
  ],
  inf: [{ claim: 'defect', statement: 'The exception types duplicate_payment, missing_fee_event and orphaned_refund are defined in the schema enum and no insert in the service uses them; closeBillingPeriod, the only non-test caller of requireReconciliation, has no non-test caller.' }],
  def: [
    'DEF-0B11-PRP-RECONCILIATION-AUDIT-IS-A-SEPARATE-EVENT-NOT-COMMITTED-WITH-THE-RECONCILIATION-WRITES',
    'DEF-0B11-PRP-RECONCILIATION-RUNS-ARE-NOT-REPEATABLE-AND-THE-BILLING-PERIOD-IS-NOT-BOUND-TO-THE-ORGANIZATION',
    'DEF-0B11-PRP-RECONCILIATION-ENGINE-FABRICATES-FEE-SETTLEMENT-MATCHES-AND-SUMS-REFUNDED-PAYMENTS-AS-RECEIVED',
    'DEF-0B11-PRP-RECONCILIATION-SERVICE-QUERIES-THROUGH-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY',
  ],
  corr: [{ field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'auditLog does not take the transaction handle, so the audit event is a separate write and not committed with the run.' }],
})

const reconResolve = (a) => mk({
  persona: 'Administrator resolving or writing off a reconciliation exception',
  service: `${a.routeFile} (POST: withApi admin with commercial_reporting entitlement and financial-write rate limit, requireLiveFinancialMandate finance:reconcile, resolveException)`,
  authn: `${SESSION} through withApi (auth required).`,
  authz: 'withApi minRole admin plus the commercial_reporting entitlement, the FINANCIAL_WRITE rate limit and requireLiveFinancialMandate with the finance:reconcile action and the exception id as the resource. The mandate check is not the kernel authorizeAction, so kernelAuthorization stays false; no participants are passed to the segregation-of-duties rule.',
  tenant: 'The organization comes from the withApi session; resolveException updates only a row whose id and organization id match and whose status is open or under_review, through the shared db handle.',
  owner: 'reconciliation_exceptions row of the organization.',
  sens: 'Exception status, resolver id, resolution time and resolution notes',
  priv: 'The administrator receives the updated exception; the notes (up to 2000 characters, possibly empty) are stored and audited.',
  mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
  auditDetail: 'The exception update commits first and auditLog (exception_resolved) is then written as a separate event through the application audit logger, not with the transaction handle.',
  reqAudit: 'Write the status change and the audit row in one transaction, and require evidence and a second approver for a write-off.',
  does: 'Checks the finance:reconcile mandate, sets the named open exception of the organization to resolved or written_off with the notes and the resolver, audits it and returns the row; no invoice, payment or ledger row changes.',
  status: STATUS,
  gate: GATE,
  deps: [1, 13],
  future: 'Require a second approver and evidence for a write-off, post the financial effect of a resolution, and audit atomically.',
  dec: [D_RECON, D_CONTRACT],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'admin' },"),
    a.h('authorization', "entitlement: 'commercial_reporting',"),
    a.h('authorization', 'rateLimit: RATE_LIMITS.FINANCIAL_WRITE,'),
    ...mandateEv(a, 'finance:reconcile'),
    a.svc('tenantScope', RECON_SVC, 'eq(reconciliationExceptions.organizationId, organizationId),', 'resolveException'),
    a.svc('mutation', RECON_SVC, '.update(reconciliationExceptions)', 'resolveException'),
    a.svc('audit', RECON_SVC, 'await auditLog({', 'resolveException'),
    a.local('defect', 'resolveSchema', 'notes: z.string().max(2000),'),
    a.svc('defect', RECON_SVC, 'resolutionNotes: resolution.notes,', 'resolveException'),
  ],
  inf: [{ claim: 'defect', statement: 'resolveException receives the resolver id and the status only and compares neither with the run initiator; no statement in it touches an invoice, payment or ledger table.' }],
  def: [
    'DEF-0B11-PRP-RECONCILIATION-RESOLVE-IS-A-STATUS-AND-NOTE-ONLY-WITH-NO-SECOND-APPROVER-OR-LEDGER-EFFECT',
    'DEF-0B11-PRP-RECONCILIATION-AUDIT-IS-A-SEPARATE-EVENT-NOT-COMMITTED-WITH-THE-RECONCILIATION-WRITES',
    'DEF-0B11-PRP-RECONCILIATION-SERVICE-QUERIES-THROUGH-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY',
  ],
  corr: [{ field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'resolveException updates the exception and then writes the audit event with auditLog, a separate write that is not committed with the update.' }],
})

/* ---------- rewards ---------- */
const rewardsWallet = (a) => mk({
  persona: 'Member reading their own rewards balance and ledger',
  service: `${a.routeFile} (GET: withRoleAuth member floor, getBalance and listLedger over reward_wallet_ledger by organization and user)`,
  authn: `${SESSION} through withRoleAuth (401 without a user).`,
  authz: 'withRoleAuth(member): any member of the resolved organization reads their own wallet; the user id and organization come from the auth context. authorizeAction is not called.',
  tenant: 'The organization and user come from the withRoleAuth context (organization resolved by getOrganizationIdForUser); both service queries carry eq(orgId) and eq(userId) through the shared db import with no tenant context.',
  owner: 'reward_wallet_ledger rows of the signed-in member in the organization.',
  sens: 'Rewards credit balance and ledger entries with event type, amount, balance after, source and memo',
  priv: 'The member receives their own balance and ledger page only.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the route writes no row and no audit record.',
  reqAudit: 'Reads of a member own wallet need no audit.',
  does: 'Returns the latest ledger balance and a page (limit at most 100, offset) of the caller ledger entries, with hasMore true when the page is full.',
  status: STATUS,
  gate: GATE,
  deps: [6, 13],
  future: 'Read the balance and the page in one snapshot, validate the paging values and read through an explicit tenant context.',
  dec: [D_REDEMPTION],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "withRoleAuth('member'"),
    a.h('tenantScope', 'const { userId, organizationId } = context as { userId: string; organizationId: string };'),
    a.svc('tenantScope', REW_WALLET, 'eq(rewardWalletLedger.orgId, orgId),', 'listLedger'),
    a.svc('privacy', REW_WALLET, 'eq(rewardWalletLedger.userId, userId)', 'listLedger'),
    a.svc('mutation', REW_WALLET, '.from(rewardWalletLedger)', 'getBalance'),
    a.h('defect', "const offset = parseInt(searchParams.get('offset') || '0', 10);"),
  ],
  inf: [],
  def: [
    'DEF-0B11-PRP-WALLET-GET-READS-BALANCE-AND-LEDGER-SEPARATELY-WITH-UNVALIDATED-PAGING',
    'DEF-0B11-PRP-REWARDS-CRON-AND-WALLET-AND-REDEMPTION-QUERIES-USE-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY',
  ],
  corr: [],
})

const redemptionsGet = (a) => mk({
  persona: 'Member listing their own reward redemptions',
  service: `${a.routeFile} (GET: withRoleAuth member floor, listUserRedemptions over reward_redemptions by organization and user)`,
  authn: `${SESSION} through withRoleAuth (401 without a user).`,
  authz: 'withRoleAuth(member): any member of the resolved organization lists their own redemptions; the user id and organization come from the auth context. authorizeAction is not called.',
  tenant: 'The organization and user come from the withRoleAuth context; the service query carries eq(orgId) and eq(userId) through the shared db import with no tenant context.',
  owner: 'reward_redemptions rows of the signed-in member in the organization.',
  sens: 'Redemption status, credits spent, provider order references and the provider payload JSON',
  priv: 'The member receives their own whole redemption rows, including providerPayloadJson, and no other member rows.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the route writes no row and no audit record.',
  reqAudit: 'Reads of a member own redemptions need no audit.',
  does: 'Validates the optional status value, ignores it, and returns a page (limit at most 100, offset) of the caller redemptions, newest first, with hasMore true when the page is full.',
  status: STATUS,
  gate: GATE,
  deps: [6, 13],
  future: 'Apply the status filter with the full status list, project the columns and read through an explicit tenant context.',
  dec: [D_REDEMPTION],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "withRoleAuth('member'"),
    a.h('tenantScope', 'const { userId, organizationId } = context as { userId: string; organizationId: string };'),
    a.svc('tenantScope', REW_REDEMPTION, 'eq(rewardRedemptions.orgId, orgId),', 'listUserRedemptions'),
    a.svc('privacy', REW_REDEMPTION, 'eq(rewardRedemptions.userId, userId)', 'listUserRedemptions'),
    a.svc('mutation', REW_REDEMPTION, 'const redemptions = await db.query.rewardRedemptions.findMany({', 'listUserRedemptions'),
    a.h('defect', "const validStatuses = ['pending', 'ordered', 'fulfilled', 'cancelled', 'refunded'];"),
    a.sch('defect', REW_SCHEMA, /providerPayloadJson: jsonb\('provider_payload_json'\)/, { symbol: 'rewardRedemptions' }),
  ],
  inf: [{ claim: 'defect', statement: 'The status variable is read and validated but is not an argument of the listUserRedemptions call.' }],
  def: [
    'DEF-0B11-PRP-REDEMPTIONS-GET-IGNORES-THE-STATUS-FILTER-AND-VALIDATES-AGAINST-AN-INCOMPLETE-LIST',
    'DEF-0B11-PRP-REDEMPTIONS-GET-RETURNS-WHOLE-ROWS-INCLUDING-THE-PROVIDER-PAYLOAD',
    'DEF-0B11-PRP-REWARDS-CRON-AND-WALLET-AND-REDEMPTION-QUERIES-USE-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY',
  ],
  corr: [],
})

const redemptionsPost = (a) => mk({
  persona: 'Member cancelling their own unfulfilled reward redemption',
  service: `${a.routeFile} (POST: withRoleAuth member floor, cancelRedemption: db.transaction with status-guarded update, refund ledger entry and auditRewards)`,
  authn: `${SESSION} through withRoleAuth (401 without a user).`,
  authz: 'withRoleAuth(member): any member of the resolved organization; the cancel is held to the caller own redemption (mustOwn compares the redemption user id with the session user id) and to the initiated and pending_payment states. authorizeAction is not called.',
  tenant: 'The organization and user come from the withRoleAuth context; cancelRedemption selects by redemption id and eq(orgId) inside db.transaction through the shared db handle.',
  owner: 'reward_redemptions row and reward_wallet_ledger refund entry of the signed-in member in the organization.',
  sens: 'Redemption status, credits refunded and the provider payload with the cancellation reason',
  priv: 'The member receives their own cancelled redemption row and new balance; the audit row names the reason, the credits refunded and the member user id.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The status update, the refund ledger entry and the rewards.redemption.cancel audit row (auditRewards, which calls persistAtomicAudit with the transaction handle) commit in one transaction.',
  reqAudit: KEEP_AUDIT,
  does: 'Validates the body against the initiation schema and discards it, requires the id query value, and cancels the caller own redemption if it is initiated or pending_payment, refunding the credits and recording the audit row; it does not call the shop provider.',
  status: STATUS,
  gate: GATE,
  deps: [6, 13],
  future: 'Name the route for cancellation, drop the unused schema, and tell the provider when a checkout is cancelled.',
  dec: [D_REDEMPTION],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "withRoleAuth('member'"),
    a.h('authorization', '{ userId, mustOwn: true }'),
    a.h('tenantScope', 'const { userId, organizationId } = context as { userId: string; organizationId: string };'),
    a.svc('authorization', REW_REDEMPTION, "if (!redemption || (actor?.mustOwn && redemption.userId !== actor.userId)) {", 'cancelRedemption'),
    a.svc('mutation', REW_REDEMPTION, "status: 'cancelled',", 'cancelRedemption'),
    a.svc('audit', REW_AUDIT, 'return persistAtomicAudit(tx as RLSTx, entry);', 'auditRewards'),
    a.svc('audit', REW_REDEMPTION, "action: 'rewards.redemption.cancel',", 'cancelRedemption'),
    a.h('defect', '_validatedData = initiateRedemptionSchema.parse(body);'),
  ],
  inf: [],
  def: [
    'DEF-0B11-PRP-REDEMPTIONS-POST-IS-NAMED-FOR-INITIATION-BUT-CANCELS-AND-DISCARDS-THE-VALIDATED-BODY',
    'DEF-0B11-PRP-REWARDS-CRON-AND-WALLET-AND-REDEMPTION-QUERIES-USE-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY',
  ],
  corr: [],
})

const rewardsExport = (a) => mk({
  persona: 'Program administrator exporting awards, wallet ledger or budgets (any member can call it)',
  service: `${a.routeFile} (GET: plain handler, auth(), getOrganizationIdForUser, withRLSContext raw SQL over recognition_awards, reward_wallet_ledger and reward_budget_envelopes)`,
  authn: `${SESSION} read directly in the handler (auth() from the Entra server module; 401 without a user id).`,
  cat: 'SESSION_ONLY',
  authz: 'Session only: the handler reads no role. The organization is resolved by getOrganizationIdForUser(userId), which validates the user membership in the organization (any role), so any member of an organization exports that organization whole awards, ledger or budgets. authorizeAction is not called.',
  tenant: 'The organization is resolved from the verified membership, not from the request; the queries run in withRLSContext({ organizationId }) through tx with org_id = organization as the predicate; no row is related to the caller.',
  owner: 'recognition_awards, reward_wallet_ledger and reward_budget_envelopes rows of the organization.',
  sens: 'Every member user id with awards received and issued and the reason text, ledger event types, credit amounts, balances and memos, and the program budget limits and usage',
  priv: 'Any signed-in member receives a CSV of every row of the chosen type for the whole organization, with member user ids, reasons and memos; nothing is recorded about the export.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the route writes no row and no audit record, although it returns the whole table as a download.',
  reqAudit: 'Audit every export with the requester, the type and the row count, and restrict it to the offices the union names.',
  does: 'Selects, by organization, every award, wallet ledger entry or budget envelope (by the type query value, default awards) and returns them as a CSV attachment.',
  status: STATUS,
  gate: GATE,
  deps: [6, 13],
  future: 'Decide the export audience and require its role, audit the export, bound and project the columns, and neutralise spreadsheet formulas.',
  dec: [D_REWARDS_AUTO, D_REDEMPTION],
  ev: [
    a.h('authentication', 'const { userId } = await auth();'),
    a.h('authorization', 'if (!userId) {'),
    a.h('tenantScope', 'const organizationId = await getOrganizationIdForUser(userId);'),
    a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
    a.h('privacy', 'FROM reward_wallet_ledger'),
    a.h('mutation', 'const rows = await tx.execute(sql`'),
    a.local('defect', 'toCsv', /s\.includes\(','\) \|\|/),
    a.svc('defect', `${APP}lib/organization-utils.ts`, 'eq(organizationMembers.userId, userId),', 'getOrganizationIdForUser'),
  ],
  inf: [{ claim: 'defect', statement: 'No statement in the handler reads a role, a user id predicate or a role list, and the response does not leave a trace beyond the HTTP request.' }],
  def: [
    'DEF-0B11-PRP-REWARDS-EXPORT-RETURNS-EVERY-MEMBER-LEDGER-AWARD-AND-BUDGET-ROW-TO-ANY-MEMBER',
    'DEF-0B11-PRP-REWARDS-EXPORT-CSV-DOES-NOT-NEUTRALISE-SPREADSHEET-FORMULAS',
    'DEF-0B11-PRP-REWARDS-EXPORT-IS-UNBOUNDED-AND-WRITES-NO-AUDIT-RECORD',
  ],
  corr: [],
})

const cronPost = (a) => mk({
  persona: 'Scheduler holding the cron secret running rewards automation for every active organization',
  service: `${a.routeFile} (POST: plain handler, CRON_SECRET bearer check, processAnniversaryAwards, sendBatchExpirationWarnings, processScheduledAwards over every active organization)`,
  authn: 'Shared secret: the Authorization bearer value is compared in constant time with CRON_SECRET (401 when unset or different); the proxy also requires the x-cron-secret header for this path.',
  cat: 'EXTERNAL_TRUST',
  authz: 'No user and no role: the shared secret is the only credential. Any holder of the secret runs the tasks for every organization. authorizeAction is not called.',
  tenant: 'Not tenant-scoped by design: the handler lists every active organization through the shared db handle and runs each task per organization or across all organizations (the expiration task) with no tenant context.',
  owner: 'recognition_awards, reward_wallet_ledger, reward_budget_envelopes and automation rule rows of every active organization; the expiration e-mails go to member addresses.',
  sens: 'Member user ids, join dates, award reasons, credit amounts, balances, and e-mail addresses used for expiration warnings',
  priv: 'The caller receives the per-organization results of the run; the tasks create awards and credits for members and send e-mails.',
  mut: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
  auditDetail: 'Each award create and each award issue commits with its own audit row (auditRewards, which calls persistAtomicAudit with the transaction handle); the run as a whole, the expiration e-mails and the scheduled-rule processing are not audited.',
  reqAudit: 'Audit the run (organizations, members awarded, e-mails sent) and make a repeat of the run safe.',
  does: 'Verifies the secret, picks the task (default all), loads every active organization and, per task, creates and issues anniversary awards for members whose join date is today, e-mails expiring-credit warnings in 7, 14 and 30 day windows, and counts scheduled rules as processed; it answers 200 success with the per-organization results.',
  status: STATUS,
  gate: GATE,
  deps: [9, 13],
  future: 'Make anniversary awards idempotent per member and year, drop or implement the placeholder task, audit the run, and report failures with a failing status.',
  dec: [D_REWARDS_AUTO, D_REDEMPTION],
  ev: [
    a.h('authentication', "const expected = process.env.CRON_SECRET ?? '';"),
    a.h('authorization', 'if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {'),
    a.h('tenantScope', 'const organizations = await db.query.organizations.findMany({'),
    a.h('behavior', "const task = searchParams.get('task') || 'all';"),
    a.svc('mutation', REW_AUTOMATION, 'const award = await createAwardRequest({', 'processAnniversaryAwards'),
    a.svc('audit', REW_AUDIT, 'return persistAtomicAudit(tx as RLSTx, entry);', 'auditRewards'),
    a.svc('defect', REW_AUTOMATION, 'AND EXTRACT(DAY FROM om.joined_at) = ${currentDay}', 'processAnniversaryAwards'),
    a.svc('defect', REW_AUTOMATION, 'const _creditsToAward = calculateAnniversaryCredits(yearsOfService);', 'processAnniversaryAwards'),
    a.svc('defect', REW_AUTOMATION, /This is a placeholder for cron-based scheduling/, 'processScheduledAwards'),
    a.svc('defect', REW_NOTIFY, '{ days: 30, counter: \'usersNotified30Days\' },', 'sendBatchExpirationWarnings'),
    a.svc('defect', REW_NOTIFY, 'expiringAmount: sql<number>`sum(${rewardWalletLedger.amountCredits})`,', 'getExpiringCreditsUsers'),
    a.sch('defect', REW_SCHEMA, "orgIdIdx: index('recognition_awards_org_id_idx').on(table.orgId),", { symbol: 'recognitionAwards' }),
  ],
  inf: [
    { claim: 'defect', statement: 'recognition_awards declares only non-unique indexes and no code in processAnniversaryAwards looks up an earlier award for the member and year, so each call that matches the member creates another award.' },
    { claim: 'defect', statement: 'A search of lib, app, services and actions found no call that passes expiresAt to applyLedgerEntry and none that writes an expire ledger entry, so the expiration task has nothing to select.' },
    { claim: 'defect', statement: 'After the secret check the handler answers success true for any task value, collects per-organization results with Promise.allSettled and returns them in the same 200 response; the proxy also requires the x-cron-secret header for /api/rewards/cron in addition to the bearer secret the handler checks.' },
    { claim: 'defect', statement: 'No scheduler configuration for /api/rewards/cron was read in the application source; the route comment lists Vercel Cron, an external cron service or a self-hosted daemon as possible triggers.' },
  ],
  def: [
    'DEF-0B11-PRP-REWARDS-CRON-ANNIVERSARY-AWARDS-REPEAT-ON-EVERY-CALL-ON-AN-ANNIVERSARY-DAY',
    'DEF-0B11-PRP-REWARDS-CRON-SCHEDULED-TASK-IS-A-PLACEHOLDER-THAT-COUNTS-RULES-AS-PROCESSED',
    'DEF-0B11-PRP-REWARDS-CRON-EXPIRATION-TASK-READS-AN-EXPIRY-NO-WRITER-SETS-AND-WOULD-REPEAT-ACROSS-THE-7-14-AND-30-DAY-WINDOWS',
    'DEF-0B11-PRP-REWARDS-CRON-REPORTS-SUCCESS-FOR-UNKNOWN-TASKS-AND-FAILED-ORGANIZATIONS',
    'DEF-0B11-PRP-REWARDS-CRON-ACCEPTS-THE-SECRET-IN-TWO-HEADERS-AND-THE-PROXY-COMPARES-IT-WITHOUT-A-CONSTANT-TIME-COMPARISON',
    'DEF-0B11-PRP-REWARDS-CRON-ANNIVERSARY-CREDIT-SCALE-IS-COMPUTED-AND-DISCARDED-AND-THE-AWARD-REASON-NAMES-THE-ORGANIZATION-UUID',
    'DEF-0B11-PRP-REWARDS-CRON-AND-WALLET-AND-REDEMPTION-QUERIES-USE-THE-SHARED-DB-HANDLE-WITH-EXPLICIT-PREDICATES-ONLY',
    'DEF-0B11-PRP-REWARDS-CRON-RUNS-ARE-AUDITED-PER-AWARD-ONLY-AND-THE-EXPIRATION-E-MAILS-ARE-NOT-AUDITED',
  ],
  corr: [{ field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'Each award create and issue is atomic with its own audit row, but the run, the expiration e-mails and the scheduled-rule processing are not audited and the two steps of one anniversary award are separate transactions.' }],
})

const cronGet = (a) => mk({
  persona: 'Scheduler or monitor probing whether the rewards cron route is reachable',
  service: `${a.routeFile} (GET: plain handler returning a static reachability payload)`,
  authn: 'No credential in the handler; the proxy requires the x-cron-secret header for /api/rewards/cron (CRON_API_ROUTES) and answers 401 otherwise.',
  cat: 'EXTERNAL_TRUST',
  authz: 'The handler has no guard of its own and depends on the proxy shared-secret check; the proxy compares the header with CRON_SECRET using !==. authorizeAction is not called.',
  tenant: 'Not applicable: the response is static and reads no tenant data.',
  owner: 'No data: the response is a fixed object with a timestamp.',
  sens: 'None: service name, reachable true and a timestamp',
  priv: 'No personal or tenant data is returned.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A static probe: nothing is written or audited.',
  reqAudit: 'No audit is needed for a static reachability probe.',
  does: 'Returns reachable true, the service name and a timestamp; it does not report whether tasks ran or the reward pipeline is healthy, as its own comment states.',
  status: STATUS,
  gate: GATE,
  deps: [9],
  future: 'Add a secret check in the handler so the probe does not depend on the proxy alone, or remove it.',
  dec: [D_REWARDS_AUTO],
  ev: [
    a.h('authentication', 'export async function GET(_request: NextRequest) {'),
    a.h('authorization', 'return NextResponse.json({'),
    a.h('tenantScope', "service: 'rewards-cron',"),
    a.h('mutation', 'reachable: true,'),
  ],
  inf: [
    { claim: 'defect', statement: 'The GET handler contains no reference to CRON_SECRET; only the POST handler checks the secret itself.' },
    { claim: 'behavior', statement: 'apps/union-eyes/proxy.ts rejects a request to a path in CRON_API_ROUTES (which lists /api/rewards/cron) with 401 unless the x-cron-secret header equals CRON_SECRET, using a !== comparison.' },
  ],
  def: ['DEF-0B11-PRP-REWARDS-CRON-ACCEPTS-THE-SECRET-IN-TWO-HEADERS-AND-THE-PROXY-COMPARES-IT-WITHOUT-A-CONSTANT-TIME-COMPARISON'],
  corr: [],
})

export const RISK_SCREENS = {
  'rewards/cron/route.ts|GET': {
    RLS_ASSUMED_FROM_DB_CLIENT: {
      reason: 'The GET handler never touches the database handle the route file imports for its POST: it returns a fixed reachability object with a timestamp and reads no tenant row.',
      evidence: [{ ref: `${API}rewards/cron/route.ts`, quote: 'reachable: true,' }],
    },
  },
}

export function facts(a, readText) {
  const { route, method } = a
  let record
  switch (route) {
    case 'portal/dues/balance/route.ts': record = duesBalanceGet(a); break
    case 'portal/dues/pay/route.ts': record = method === 'GET' ? duesPayGet(a) : duesPayPost(a); break
    case 'precedents/route.ts': record = method === 'GET' ? precedentsGet(a) : precedentsPost(a); break
    case 'precedents/search/route.ts': record = precedentsSearch(a); break
    case 'precedents/[id]/route.ts': record = precedentItem(a, readText); break
    case 'precedents/jurisdiction-preferences/route.ts': record = method === 'GET' ? prefsGet(a) : prefsPut(a); break
    case 'profile/me/route.ts': record = profileMe(a); break
    case 'profile/roles/route.ts': record = profileRoles(a, readText); break
    case 'reconciliation/bank/route.ts': record = reconBank(a); break
    case 'reconciliation/upload/route.ts': record = reconUpload(a); break
    case 'reconciliation/process/route.ts': record = method === 'GET' ? reconProcessGet(a) : reconProcessPost(a); break
    case 'reconciliation/resolve/route.ts': record = reconResolve(a); break
    case 'rewards/wallet/route.ts': record = rewardsWallet(a); break
    case 'rewards/redemptions/route.ts': record = method === 'GET' ? redemptionsGet(a) : redemptionsPost(a); break
    case 'rewards/export/route.ts': record = rewardsExport(a); break
    case 'rewards/cron/route.ts': record = method === 'GET' ? cronGet(a) : cronPost(a); break
    default: throw new Error(`no precedents-portal facts for ${route}`)
  }
  record = applyCrossTenantExposure(record, DEFECTS)
  record.riskScreen = RISK_SCREENS[`${route}|${method}`] ?? {}
  return record
}
