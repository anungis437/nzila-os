/**
 * Gate 0A.2R product-specification models.
 *
 * Each model corrects one contradiction found in the adversarial review of the proposed persona baselines. A model is a
 * proposed design for product specification review. None of them adopts an institutional requirement, issues authority
 * or settles an outstanding decision.
 */

export const ANCHOR_COMMIT = '9836ecd7ad4c64e5c2e89732e733c9807bf0c8bc'
export const REVISION_ROUND = 'GATE_0A_2R'

// ---------------------------------------------------------------------------------------------------------------------
// Proposed versus adopted authority
// ---------------------------------------------------------------------------------------------------------------------

export const AUTHORITY_STATES_VOCABULARY = {
  rule: 'An outstanding institutional authority decision does not stop engineering. It stops production or institutional activation of the authority the decision governs.',
  states: {
    ENGINEERING_IMPLEMENTATION: 'PERMITTED. Drafts, queues, previews, read models, refusal paths and positive paths may be built.',
    SYNTHETIC_AUTHORIZED_PATH_TESTING: 'PERMITTED. A positive path may be demonstrated with test-issued authority in a synthetic organization that is marked synthetic and holds no real member, money or privileged record.',
    PRODUCTION_INSTITUTIONAL_ACTIVATION: 'PROHIBITED until a duly authorized body adopts the decision. No real organization receives the authority.',
    EXTERNAL_OR_INSTITUTIONAL_ADOPTION: 'REQUIRED. The decision is settled outside this repository and is recorded here only as outstanding.',
  },
  syntheticAuthority: {
    scope: 'SYNTHETIC_ORGANIZATIONS_ONLY',
    mayBeIssuedInRealOrganization: false,
    note: 'Test-issued authority exists only inside a test fixture. It is never copied into, derived from or promoted to a real organization.',
  },
}

export const PROHIBITED_WITHOUT_ADOPTION = [
  { id: 'REAL_FINANCIAL_MANDATES', prohibited: 'Issuing a real financial mandate. FINANCIAL_MANDATES_NOT_ISSUED stays the answer.' },
  { id: 'INSTITUTIONAL_OFFICES', prohibited: 'Establishing, naming or filling an institutional office, including a steward office.' },
  { id: 'REAL_PAYMENTS', prohibited: 'Authorizing or executing a real payment, payment rail or export to an external accounting system.' },
  { id: 'PRIVILEGED_DISCLOSURE', prohibited: 'Disclosing privileged, counsel-controlled or third-party restricted material to anyone.' },
  { id: 'COUNSEL_EXECUTION', prohibited: 'Activating counsel execution or transmitting anything to counsel. UE-CONV-G-003 stays an external gate.' },
]

// ---------------------------------------------------------------------------------------------------------------------
// Steward identity and navigation
// ---------------------------------------------------------------------------------------------------------------------

const noGrant = { impliesOrganizationWideVisibility: false, impliesTriage: false, impliesReassignment: false, impliesPrivilegedDisclosure: false }

export const STEWARD_IDENTITY = {
  rule: 'A distinct Steward workspace is a presentation choice. Five facts are kept apart. Only a live case relationship and issued authority can carry authority, and each does so only for what it names.',
  distinctInstitutionalOfficeImplied: false,
  officeAndCapacityConfigurablePerOrganization: true,
  focusedWorkspaceGrants: { organizationWideVisibility: false, triage: false, reassignment: false, privilegedDisclosure: false },
  dimensions: [
    { id: 'UI_PERSONA', name: 'Interface persona', meaning: 'The focused Steward workspace: its navigation, queue and layout.', definedBy: 'Product design (DEC-PD-01)', grantsAuthorityByItself: false, ...noGrant },
    { id: 'UNION_OFFICE', name: 'Employment or union office', meaning: 'Whatever office, election, appointment or employment status the institution gives a person. Whether a steward office exists, what it is called and what it does differ by institution. This baseline names no office.', definedBy: 'The institution (DEC-IA-32)', grantsAuthorityByItself: false, ...noGrant },
    { id: 'PLATFORM_ROLE', name: 'Platform role', meaning: 'The role value on a membership record. The code has a steward role (evidence S7). It is eligibility for a representation capacity and never authority.', definedBy: 'The membership record', grantsAuthorityByItself: false, ...noGrant },
    { id: 'CASE_RELATIONSHIP', name: 'Case relationship', meaning: 'A live owner, assignee or explicit collaborator relationship to one case. It reaches that case only, and only the actions the kernel decides.', definedBy: 'Kernel assignment facts', grantsAuthorityByItself: true, authorityScope: 'ONE_CASE_ONLY' },
    { id: 'ISSUED_AUTHORITY', name: 'Issued authority', meaning: 'A triage designation, supervisory mandate, delegation, appointment or other instrument that an authorized body issued under an adopted rule. This baseline issues none.', definedBy: 'The issuing body under an adopted rule', grantsAuthorityByItself: true, authorityScope: 'AS_ISSUED', issuedByThisBaseline: false },
  ],
}

export const STEWARD_NAVIGATION_POLICY = {
  rule: 'Navigation follows what a signed-in principal can use now. The seven destinations are candidates, not a promise. A destination appears only while at least one capability behind it is usable by that principal, and it is hidden otherwise.',
  fixedDestinationCount: false,
  candidateDestinations: 7,
  hiddenWhenNoUsableCapability: true,
  neverAdvertisesRouteThatResolvesTo404: true,
  usableCapabilityMeans: 'The capability is implemented or partially implemented, is not answering HTTP 501, and the principal holds the case relationship or issued authority it needs.',
}

export const STEWARD_NAV_CAPABILITIES = {
  'STW-NAV-1': ['STW-ACT-01', 'STW-ACT-02', 'STW-ACT-03'],
  'STW-NAV-2': ['STW-ACT-01', 'STW-ACT-06', 'STW-ACT-07', 'STW-ACT-08', 'STW-ACT-10', 'STW-ACT-12'],
  'STW-NAV-3': ['STW-ACT-34', 'STW-ACT-35'],
  'STW-NAV-4': ['STW-ACT-25', 'STW-ACT-26', 'STW-ACT-27'],
  'STW-NAV-5': ['STW-ACT-13', 'STW-ACT-14', 'STW-ACT-15', 'STW-ACT-16', 'STW-ACT-39'],
  'STW-NAV-6': ['STW-ACT-21', 'STW-ACT-22', 'STW-ACT-23', 'STW-ACT-24'],
  'STW-NAV-7': ['STW-ACT-36', 'STW-ACT-37'],
}

// ---------------------------------------------------------------------------------------------------------------------
// Case and intake lifecycle
// ---------------------------------------------------------------------------------------------------------------------

const ent = (id, name, meaning, evidence, extra = {}) => ({ id, name, meaning, requiresPriorEntity: false, mayStandAlone: true, evidence, ...extra })

export const LIFECYCLE_MODEL = {
  rule: 'Seven entity types are distinct. None is a stage of another. No sequence is mandatory, and the allowed links and transitions are configured per organization protocol.',
  mandatoryLinearSequence: false,
  canonicalEntityDecision: {
    capabilityId: 'UE-CAP-C-001',
    gate: 4,
    status: 'UNRESOLVED_UNDER_GATE_4',
    settledByThisBaseline: false,
    note: 'Whether the product keeps claims and grievances as one canonical entity or two is decided under Gate 4. This model names CASE and GRIEVANCE as distinct concepts and does not choose a storage model.',
  },
  entityTypes: [
    ent('INQUIRY', 'Inquiry', 'A question or request for information. It may be answered and closed without opening a case.', { class: 'PROPOSED_NEW_BASELINE', note: 'No source stores an inquiry as its own entity.' }),
    ent('SERVICE_REQUEST', 'Service request', 'A request that the union act or provide a service, such as representation. It may be accepted into a case, declined, referred or answered.', { class: 'PROPOSED_NEW_BASELINE', note: 'No source stores a service request as its own entity.' }),
    ent('CASE', 'Case', 'A matter accepted for handling by a representative. In source it is the claims or cases model.', { class: 'SOURCE_BACKED', file: 'apps/union-eyes/app/api/cases/intake/route.ts', quote: 'Server-side validated case creation', note: 'The intake route creates a case directly. It does not create an inquiry or a request first.' }),
    ent('GRIEVANCE', 'Formal grievance', 'A formal contractual grievance with its own clock and formal states. It may be opened from a case or, where the organization protocol allows, directly.', { class: 'SOURCE_BACKED', file: 'docs/union-eyes/convergence/UE-FINAL-CONVERGENCE-CHECKPOINT-6.md', quote: 'grievance create and import use capacity', note: 'The Checkpoint 6 record states that grievance create and import use capacity, not a prior case.' }),
    ent('COMPLAINT', 'Complaint', 'A member complaint about union conduct or service. It is reviewed on its own and is not a grievance unless an organization protocol says it is treated as one.', { class: 'SOURCE_BACKED', file: 'apps/union-eyes/lib/authority/review-intake-types.ts', quote: "['complaint', 'appeal', 'reconsideration']", note: 'Source opens a complaint as a review intake. UE-OMIT-M04-MEMBER-REQUESTS records review intake as a different obligation from a representation matter.' }),
    ent('APPEAL', 'Appeal', 'A request that a body review a decision. It may follow a grievance outcome, a union decision about a member, or a complaint outcome. It is not necessarily a stage after a grievance is accepted.', { class: 'SOURCE_BACKED', file: 'apps/union-eyes/lib/authority/review-intake-types.ts', quote: "['complaint', 'appeal', 'reconsideration']", note: 'Source opens an appeal as a review intake with no grievance reference.' }),
    ent('RECONSIDERATION', 'Reconsideration', 'A request that the deciding body reconsider its own decision. It may follow any decision, including an appeal outcome.', { class: 'SOURCE_BACKED', file: 'apps/union-eyes/lib/authority/review-intake-types.ts', quote: "['complaint', 'appeal', 'reconsideration']", note: 'Source opens a reconsideration as a review intake with no grievance reference.' }),
  ],
  allowedLinks: [
    ['INQUIRY', 'SERVICE_REQUEST'], ['INQUIRY', 'CASE'], ['SERVICE_REQUEST', 'CASE'], ['SERVICE_REQUEST', 'GRIEVANCE'], ['CASE', 'GRIEVANCE'],
    ['GRIEVANCE', 'APPEAL'], ['CASE', 'APPEAL'], ['COMPLAINT', 'CASE'], ['COMPLAINT', 'GRIEVANCE'], ['COMPLAINT', 'APPEAL'], ['APPEAL', 'RECONSIDERATION'], ['GRIEVANCE', 'RECONSIDERATION'], ['COMPLAINT', 'RECONSIDERATION'],
  ].map(([from, to]) => ({ from, to, kind: 'MAY_LINK', required: false, exclusive: false })),
  transitions: {
    configurationScope: 'PER_ORGANIZATION_PROTOCOL',
    everyTransitionConfigurable: true,
    defaultsAreProposalsOnly: true,
    note: 'A transition between entity types or between states of one entity type is allowed only when the organization protocol allows it and the actor holds the authority the transition needs. A source finite-state machine for grievances is evidence of one configuration, not of a universal one.',
    proposedDefaults: [
      { from: 'INQUIRY', to: 'SERVICE_REQUEST', configurable: true, decisionIds: ['DEC-IA-03'] },
      { from: 'SERVICE_REQUEST', to: 'CASE', configurable: true, decisionIds: ['DEC-IA-03', 'DEC-IA-11'] },
      { from: 'CASE', to: 'GRIEVANCE', configurable: true, decisionIds: ['DEC-IA-09', 'DEC-IA-11'] },
      { from: 'GRIEVANCE', to: 'APPEAL', configurable: true, decisionIds: ['DEC-IA-09', 'DEC-IA-11'] },
      { from: 'COMPLAINT', to: 'RECONSIDERATION', configurable: true, decisionIds: ['DEC-IA-09'] },
    ],
  },
  organizationVariations: [
    { scenarioId: 'REP-SCN-CAPE', variation: 'An Officer holds every case. Intake by a steward is a recorded request and acceptance, escalation and grievance filing belong to the Officer under the protocol.' },
    { scenarioId: 'REP-SCN-CUPE', variation: 'A National Representative may open a grievance on a case held with a local steward, or an appeal on a decision, under a mandate scoped to named matters.' },
    { scenarioId: 'REP-SCN-LIUNA', variation: 'A hypothesis. A territory may open a grievance directly from a request without a separate case. This needs discovery with the institution.' },
    { scenarioId: 'REP-SCN-SMALL-LOCAL', variation: 'A hypothesis. One person may hold intake and a case, and a complaint about that person needs a different reviewer. This needs discovery with the institution.' },
  ],
}

export const LIFECYCLE_ENTITY_IDS = LIFECYCLE_MODEL.entityTypes.map((e) => e.id)

/** Contracts that touch the lifecycle, with the entity types each one handles. None assumes a prior entity. */
export const LIFECYCLE_CONTRACTS = {
  'STW-ACT-10': ['CASE', 'GRIEVANCE'], 'STW-ACT-11': ['CASE'], 'STW-ACT-18': ['CASE', 'GRIEVANCE'], 'STW-ACT-28': ['INQUIRY', 'SERVICE_REQUEST', 'CASE'],
  'STW-ACT-30': ['SERVICE_REQUEST', 'CASE'], 'STW-ACT-31': ['SERVICE_REQUEST', 'CASE'],
  'REP-ACT-02': ['INQUIRY', 'SERVICE_REQUEST', 'CASE'], 'REP-ACT-04': ['CASE', 'GRIEVANCE'], 'REP-ACT-05': ['CASE'], 'REP-ACT-07': ['CASE'], 'REP-ACT-08': ['GRIEVANCE'],
  'REP-ACT-19': ['CASE', 'GRIEVANCE'], 'REP-ACT-21': ['CASE', 'GRIEVANCE'],
  R03: ['INQUIRY', 'SERVICE_REQUEST', 'CASE', 'GRIEVANCE', 'COMPLAINT', 'APPEAL', 'RECONSIDERATION'], R05: ['INQUIRY', 'SERVICE_REQUEST'], R06: ['CASE', 'GRIEVANCE'], R07: ['CASE'], R08: ['CASE', 'GRIEVANCE'],
  'REP-JRN-A': ['SERVICE_REQUEST', 'CASE'], 'REP-JRN-B': ['CASE', 'GRIEVANCE'],
}

// ---------------------------------------------------------------------------------------------------------------------
// Staff notes and member disclosure
// ---------------------------------------------------------------------------------------------------------------------

export const DISCLOSURE_MODEL = {
  rule: 'A staff note is staff-only. It becomes member-visible only after it is classified and an authorized disclosure decision is taken on the server. A visibility flag sent by a client is never sufficient.',
  defaultVisibility: 'STAFF_ONLY',
  memberVisibleRequires: ['CLASSIFICATION', 'AUTHORIZED_DISCLOSURE_DECISION'],
  clientVisibilityFlagSufficient: false,
  decisionEvaluatedServerSide: true,
  independentOfAuthoringAuthority: true,
  neverDisclosable: ['privileged', 'counsel-controlled', 'third-party restricted'],
  paths: [
    { id: 'DISC-PATH-COMMUNICATION', title: 'A communication written for the member', classification: 'MEMBER_COMMUNICATION', decisionAction: 'case:comment', basisId: 'CASE_OWNER_OR_ASSIGNEE', note: 'The text is authored as a member communication from the start. The server classifies it, checks the relationship permits commenting and refuses restricted content.' },
    { id: 'DISC-PATH-STRUCTURED-ENTRY', title: 'A structured entry produced by a state change', classification: 'STRUCTURED_STATE_CHANGE_ENTRY', decisionAction: 'case:transition', basisId: 'CASE_OWNER_OR_ASSIGNEE', note: 'The member-visible entry holds only the from and to states. The author supplies no free text for it, and the reason stays a separate staff-only entry.' },
    { id: 'DISC-PATH-RECORD', title: 'Disclosure of an existing staff-held note or record', classification: 'A label the institution lists as member-disclosable (DEC-IA-05)', decisionAction: 'case:disclose_to_member', basisId: 'CASE_PRIMARY_HANDLER_ONLY', note: 'A working note is never converted by editing a flag. The primary handler takes a separate disclosure decision for each record.' },
  ],
  decisionRecord: 'One disclosure record naming the classification, the discloser, the authority source, the record and the time.',
  sourceBehaviourToday: 'The notes route lets the request body choose an internal or member-visible note and decides a member-visible note with case:comment. It records no classification and no separate disclosure decision. Source is partial against this model.',
}

export const DISCLOSURE_CONTRACTS = {
  'STW-ACT-08': { path: 'DISC-PATH-COMMUNICATION', basis: 'CASE_OWNER_OR_ASSIGNEE', actions: ['case:comment'], classification: 'MEMBER_COMMUNICATION' },
  'STW-ACT-09': { path: 'DISC-PATH-COMMUNICATION', basis: 'CASE_OWNER_OR_ASSIGNEE', actions: ['case:comment'], classification: 'MEMBER_COMMUNICATION' },
  'STW-ACT-10': { path: 'DISC-PATH-STRUCTURED-ENTRY', basis: 'CASE_OWNER_OR_ASSIGNEE', actions: ['case:transition'], classification: 'STRUCTURED_STATE_CHANGE_ENTRY' },
  'STW-ACT-13': { path: 'DISC-PATH-RECORD', basis: 'CASE_PRIMARY_HANDLER_ONLY', actions: ['case:disclose_to_member'], classification: 'MEMBER_DISCLOSABLE_LABEL' },
  'STW-ACT-17': { path: 'DISC-PATH-RECORD', basis: 'CASE_PRIMARY_HANDLER_ONLY', actions: ['case:disclose_to_member'], classification: 'MEMBER_DISCLOSABLE_LABEL' },
  'REP-ACT-06': { path: 'DISC-PATH-COMMUNICATION', basis: 'CASE_OWNER_OR_ASSIGNEE', actions: ['case:comment'], classification: 'MEMBER_COMMUNICATION' },
  'REP-ACT-07': { path: 'DISC-PATH-STRUCTURED-ENTRY', basis: 'CASE_OWNER_OR_ASSIGNEE', actions: ['case:transition'], classification: 'STRUCTURED_STATE_CHANGE_ENTRY' },
  R10: { path: 'DISC-PATH-COMMUNICATION', basis: 'CASE_OWNER_OR_ASSIGNEE', actions: ['case:comment'], classification: 'MEMBER_COMMUNICATION' },
}

// ---------------------------------------------------------------------------------------------------------------------
// Representative scope and conflict boundaries
// ---------------------------------------------------------------------------------------------------------------------

export const REP_SCOPE_AND_CONFLICT = {
  scopeDimensions: ['CASE_RELATIONSHIP', 'TERRITORY', 'BARGAINING_UNIT', 'RESPONDENT'],
  scopeIsNeverInferredFromOfficeOrSeniority: true,
  territoryAndUnitScopeInactiveUntil: ['DEC-IA-10'],
  conflictDenialPrecedesEverySourceOfAuthority: true,
  recusalLiftingAndConflictAdjudicationDecision: 'DEC-IA-07',
  rule: 'Case relationship is the only scope the source decides today. Territory, bargaining-unit and respondent scope are named dimensions that stay inactive until the institution adopts them. A live recusal or adverse-party status denies an action before any source of authority is consulted.',
}

// ---------------------------------------------------------------------------------------------------------------------
// Financial segregation, reporting and platform billing
// ---------------------------------------------------------------------------------------------------------------------

export const SEPARATION_EVALUATED_AGAINST = ['transaction', 'account', 'amount', 'mandate', 'approval', 'principal']

const FINANCE = 'apps/union-eyes/lib/authority/policies/finance.ts'
const LIFECYCLE = 'apps/union-eyes/lib/finance/financial-mandate-lifecycle.ts'

const tp = (id, title, meaning, file, quote) => ({ id, title, meaning, kind: 'MANDATORY_TECHNICAL_PROTECTION', institutionalRequirement: false, source: { file, quote } })

export const MANDATORY_TECHNICAL_PROTECTIONS = [
  tp('TP-01', 'A financial capacity is required', 'Financial authority needs a live membership and a financial capacity. A title or role is never a mandate.', FINANCE, 'a financial capacity is required to hold financial authority'),
  tp('TP-02', 'The recorded facts must be consistent', 'A transaction whose recorded approvals contradict each other is refused and nothing proceeds on it.', FINANCE, 'recorded approvals violate segregation of duties'),
  tp('TP-03', 'The amount and currency must match the record', 'A request that differs from the amount or currency on record is refused, so one figure cannot be approved and another executed.', FINANCE, 'requested amount differs from the amount on record'),
  tp('TP-04', 'The transaction state must allow the duty', 'A duty is refused when the transaction is not in a state that allows it, and execution is refused until the required approvals are met.', FINANCE, 'required approvals not met'),
  tp('TP-05', 'An adverse party or recused principal is refused', 'A live recusal or adverse-party status denies the duty before any source of authority is consulted.', FINANCE, 'ADVERSE_PARTY'),
  tp('TP-06', 'A financial duty is not delegable', 'The source refuses a delegation on every finance action. Whether any duty may be delegated is an outstanding institutional decision (DEC-IA-17); the refusal is a technical default until then.', FINANCE, 'financial duties are not delegable'),
]

const sw = (id, title, meaning, scope, combos, quote, file = FINANCE, extra = {}) => ({
  id, title, meaning, kind: 'IMPLEMENTED_SOFTWARE_RULE', scope, prohibitedCombinations: combos, universal: false, configurableInSource: false, institutionallyAdopted: false,
  evaluatedAgainst: SEPARATION_EVALUATED_AGAINST, adoptionDecisionIds: ['DEC-IA-18'], source: { file, quote }, ...extra,
})
const pi = (id, title, meaning, scope, combos, decisionIds, extra = {}) => ({
  id, title, meaning, kind: 'PROPOSED_INSTITUTIONAL_SEPARATION', scope, prohibitedCombinations: combos, universal: false, configurable: true, institutionallyAdopted: false,
  evaluatedAgainst: SEPARATION_EVALUATED_AGAINST, adoptionDecisionIds: decisionIds, ...extra,
})

export const SEPARATION_RULES = [
  sw('SEP-SW-01', 'The preparer does not approve their own transaction', 'Evaluated against the transaction\u2019s recorded preparer.', 'SAME_TRANSACTION', [['prepare', 'approve']], 'the preparer cannot approve their own transaction'),
  sw('SEP-SW-02', 'The executor is independent of the preparer and approvers', 'Evaluated against the transaction\u2019s recorded preparer and approvers.', 'SAME_TRANSACTION', [['execute', 'prepare'], ['execute', 'approve']], 'the executor must be independent of the preparer and approvers'),
  sw('SEP-SW-03', 'The reconciler is independent of the transaction\u2019s participants', 'Evaluated against the preparer, approvers and executor.', 'SAME_TRANSACTION', [['reconcile', 'prepare'], ['reconcile', 'approve'], ['reconcile', 'execute']], 'the reconciler must be independent of the preparer, approvers and executor', FINANCE, { adoptionDecisionIds: ['DEC-IA-21'] }),
  sw('SEP-SW-04', 'The auditor is independent of the transaction audited', 'Evaluated against every participant of the transaction.', 'SAME_TRANSACTION', [['audit', '*']], 'an auditor must be independent of the transaction they audit', FINANCE, { adoptionDecisionIds: ['DEC-IA-23'] }),
  sw('SEP-SW-05', 'An approver approves a transaction once', 'Evaluated against the approvals already recorded. It is separate from the number of approvals a class of transaction needs.', 'SAME_TRANSACTION', [['approve', 'approve']], 'already approved'),
  sw('SEP-SW-06', 'Incompatible duties are not held together over one account', 'Evaluated when a mandate is issued, against the duties one principal holds on the same account. The pairs are read from source and are not every pair of duties.', 'SAME_ACCOUNT_MANDATE_HOLDING', 'DERIVED_FROM_SOURCE', 'export const INCOMPATIBLE_DUTIES', FINANCE, { adoptionDecisionIds: ['DEC-IA-16', 'DEC-IA-18'] }),
  sw('SEP-SW-07', 'A mandate has three different issuer, holder and approver', 'Evidence of an implemented software rule at issuance. It is not proof that any institution adopted it, and a small local may not have three people.', 'SAME_MANDATE_ISSUANCE', null, 'The issuer, the holder and the approver of a financial mandate are three different people.', LIFECYCLE, { distinctPrincipals: ['issuer', 'holder', 'approver'], adoptionDecisionIds: ['DEC-IA-16', 'DEC-IA-31'] }),
  sw('SEP-SW-08', 'The issuer and approver do not activate the mandate', 'Evaluated against the mandate\u2019s recorded parties.', 'SAME_MANDATE_ISSUANCE', null, 'The issuer and the approver do not activate the mandate they created.', LIFECYCLE, { distinctPrincipals: ['issuer', 'holder', 'approver'], adoptionDecisionIds: ['DEC-IA-16'] }),
  pi('SEP-PI-01', 'Independent approvals required per class of transaction', 'The number of independent approvals a class of transaction needs, by amount, account and mandate. Source records a required-approvals count on a transaction; the policy that sets it is outstanding.', 'SAME_TRANSACTION', [['approve', 'approve']], ['DEC-IA-18', 'DEC-IA-19']),
  pi('SEP-PI-02', 'A recipient does not approve a payment to themselves', 'Evaluated against the beneficiary of the payment, such as a stipend recipient or an expense claimant.', 'SAME_PARTY', [['approve', 'beneficiary']], ['DEC-IA-24', 'DEC-IA-19']),
  pi('SEP-PI-03', 'A vendor bank change is not approved by the person who made it', 'Evaluated against the vendor record and the principal who changed its banking reference.', 'SAME_RECORD', [['prepare', 'approve']], ['DEC-IA-19']),
  pi('SEP-PI-04', 'A governed exception for a small local', 'Where an institution cannot meet a rule, an exception names the rule relaxed, the compensating control and the independent reviewer. No exception exists unless the institution adopts one.', 'SAME_TRANSACTION', null, ['DEC-IA-16', 'DEC-IA-31'], { exceptionRule: true }),
  pi('SEP-PI-05', 'The exporter did not approve the records exported', 'Evaluated against the approvers of the exported records.', 'SAME_RECORD', [['execute', 'approve']], ['DEC-IA-29']),
  pi('SEP-PI-06', 'The preparer of a tax slip does not issue it', 'Evaluated against the slip record.', 'SAME_RECORD', [['prepare', 'execute']], ['DEC-IA-30']),
  pi('SEP-PI-07', 'Maker-checker on one non-transaction record', 'The preparer and approver of one account change, billing cycle, budget version, vendor record, plan or fund movement. Source evaluates this for payment transactions, not for these records.', 'SAME_RECORD', [['prepare', 'approve']], ['DEC-IA-18']),
  pi('SEP-PI-08', 'A person affected by an action does not take part in it', 'Evaluated against the principal an action revokes, suspends or otherwise affects.', 'SAME_PARTY', null, ['DEC-IA-28', 'DEC-IA-07'], { distinctPrincipals: ['affected person', 'decider'] }),
  pi('SEP-PI-09', 'The preparer of a record does not reconcile it', 'Evaluated against the remittance or record the principal prepared.', 'SAME_RECORD', [['prepare', 'reconcile']], ['DEC-IA-21']),
  pi('SEP-PI-10', 'An auditor takes no part in the records audited', 'Evaluated against every duty the auditor holds on the audited records.', 'SAME_RECORD', [['audit', '*']], ['DEC-IA-23']),
]

export const SEGREGATION_MODEL = {
  stance: 'CONFIGURABLE_NOT_UNIVERSAL',
  rule: 'Viewing, preparing, approving, executing, reconciling and auditing stay separate powers. Whether one principal may hold two of them is decided by a separation rule evaluated against the actual transaction, account, amount, mandate, approval and principal. No rule is assumed for consecutive steps.',
  universalDifferentPersonPerStep: false,
  evaluatedAgainst: SEPARATION_EVALUATED_AGAINST,
  distinctDuties: ['view', 'prepare', 'approve', 'execute', 'reconcile', 'audit'],
  threePersonIssuance: 'The three-person issuance design (SEP-SW-07) is evidence of an implemented software rule. It is not proof that an institution adopted it.',
  technicalProtections: MANDATORY_TECHNICAL_PROTECTIONS,
  separationRules: SEPARATION_RULES,
}

export const FINANCE_RULES_BY_DOMAIN = {
  F01: { rules: ['SEP-SW-07', 'SEP-SW-08', 'SEP-PI-04'], summary: 'Mandate issuance is evaluated by SEP-SW-07 and SEP-SW-08, which are implemented software rules. A governed exception for a small local is a proposal (SEP-PI-04).' },
  F02: { rules: ['SEP-PI-07'], summary: 'A proposed maker-checker rule applies to an account change if the institution adopts it.' },
  F03: { rules: [], summary: 'No separation applies to a view duty.' },
  F04: { rules: ['SEP-PI-07'], summary: 'A proposed maker-checker rule applies to a billing cycle if adopted. A payment made against it is a transaction and follows SEP-SW-01 to SEP-SW-03.' },
  F05: { rules: ['SEP-PI-07', 'SEP-PI-02'], summary: 'A proposed maker-checker rule applies to a charge or waiver. A person is not the approver of an adjustment to their own account where SEP-PI-02 is adopted.' },
  F06: { rules: ['SEP-PI-07'], summary: 'A proposed maker-checker rule applies to a plan if adopted.' },
  F07: { rules: ['SEP-PI-07'], summary: 'A proposed maker-checker rule applies to an allocation if adopted. A payment is a transaction and follows SEP-SW-01 to SEP-SW-03.' },
  F08: { rules: ['SEP-PI-08'], summary: 'A person who is the subject of a record does not use a mandate to act on it where SEP-PI-08 is adopted.' },
  F09: { rules: ['SEP-PI-09'], summary: 'The preparer of a remittance does not reconcile it where SEP-PI-09 is adopted.' },
  F10: { rules: ['SEP-PI-07', 'SEP-SW-02'], summary: 'A proposed maker-checker rule applies to the remittance. Submission that is a payment transaction follows SEP-SW-02.' },
  F11: { rules: ['SEP-PI-07'], summary: 'A proposed maker-checker rule applies to a budget version if adopted.' },
  F12: { rules: ['SEP-SW-01', 'SEP-PI-02'], summary: 'An expense payment is a transaction and follows SEP-SW-01. A claimant does not approve their own expense where SEP-PI-02 is adopted.' },
  F13: { rules: ['SEP-PI-03'], summary: 'A vendor bank change is not approved by the person who made it where SEP-PI-03 is adopted.' },
  F14: { rules: ['SEP-PI-07', 'SEP-SW-01'], summary: 'A proposed maker-checker rule applies to a payable. A payment made from it follows SEP-SW-01.' },
  F15: { rules: ['SEP-SW-01', 'SEP-SW-05', 'SEP-PI-01', 'SEP-PI-02'], summary: 'SEP-SW-01 and SEP-SW-05 are implemented software rules. The number of independent approvals a class of transaction needs is a proposal (SEP-PI-01).' },
  F16: { rules: ['SEP-SW-02'], summary: 'SEP-SW-02 is an implemented software rule evaluated against the transaction\u2019s participants.' },
  F17: { rules: ['SEP-PI-07', 'SEP-PI-02'], summary: 'A proposed maker-checker rule applies to a fund movement. A recipient does not approve their own stipend where SEP-PI-02 is adopted.' },
  F18: { rules: ['SEP-PI-07', 'SEP-PI-02', 'SEP-SW-02'], summary: 'A proposed maker-checker rule applies to a disbursement. A payment from it follows SEP-SW-02.' },
  F19: { rules: ['SEP-PI-10'], summary: 'A trustee takes no part in records audited where SEP-PI-10 is adopted.' },
  F20: { rules: ['SEP-SW-03', 'SEP-PI-09'], summary: 'SEP-SW-03 is an implemented software rule for a transaction. SEP-PI-09 is a proposed rule for other records.' },
  F21: { rules: ['SEP-SW-04', 'SEP-PI-10'], summary: 'SEP-SW-04 is an implemented software rule for a transaction. SEP-PI-10 is a proposed rule for other records.' },
  F22: { rules: [], summary: 'No separation applies to a view duty. Report and export authorization is separate (see the reporting model).' },
  F23: { rules: ['SEP-PI-06'], summary: 'The preparer of a slip does not issue it where SEP-PI-06 is adopted.' },
  F24: { rules: ['SEP-PI-07', 'SEP-SW-01'], summary: 'A proposed maker-checker rule applies to a contribution or benefit record. A payment follows SEP-SW-01.' },
  F25: { rules: ['SEP-PI-05'], summary: 'The exporter did not approve the exported records where SEP-PI-05 is adopted.' },
  F26: { rules: ['SEP-PI-08', 'SEP-SW-07'], summary: 'The affected person takes no part in a revocation where SEP-PI-08 is adopted. Replacement issuance follows SEP-SW-07.' },
  F27: { rules: ['SEP-SW-04', 'SEP-PI-10'], summary: 'A reader of an audit trail who took part in the transaction is refused by SEP-SW-04 where the duty is audit.' },
  F28: { rules: [], summary: 'Not applicable.' },
}

export const FINANCE_DUTY_BY_BASIS = {
  FINANCIAL_MANDATE_VIEW: 'view', FINANCIAL_MANDATE_PREPARE: 'prepare', FINANCIAL_MANDATE_APPROVE: 'approve', FINANCIAL_MANDATE_EXECUTE: 'execute',
  FINANCIAL_MANDATE_RECONCILE: 'reconcile', FINANCIAL_MANDATE_AUDIT: 'audit', AUDITOR_APPOINTMENT_DUTY: 'audit',
}

export const REPORTING_MODEL = {
  rule: 'A report, an aggregate and an export are each authorized on their own. A view duty over the records behind a report does not carry them.',
  viewDutyAloneSufficientForReport: false,
  viewDutyAloneSufficientForMemberLevelRows: false,
  viewDutyAloneSufficientForExport: false,
  exportIsSeparateDutyCheckedAction: true,
  authorizationDimensions: [
    { id: 'DISCLOSED_FIELDS', requires: 'Each class of field is granted: member-identifying, contact, banking and amount fields are separate grants.' },
    { id: 'AGGREGATION', requires: 'An aggregate over a population is a separate grant from the rows beneath it. A small population can identify an individual, so a minimum-population rule and suppression are decided per report.' },
    { id: 'SCOPE', requires: 'The accounts, periods, locals and bargaining units the report covers are named by the mandate.' },
    { id: 'SENSITIVITY', requires: 'Each report carries a sensitivity class. Member personal data, audit-restricted data and privileged data are never in a general report.' },
    { id: 'EXPORT', requires: 'An export is a separate duty-checked action with its own record naming requester, scope, fields, destination and time. An external accounting target needs DEC-IA-29.' },
    { id: 'INFERENCE', requires: 'Two permitted reports must not combine to disclose what neither may disclose. Comparison and differencing risk is reviewed per report.' },
  ],
  institutionalDecisionIds: ['DEC-IA-16', 'DEC-IA-23', 'DEC-IA-27', 'DEC-IA-29'],
  unionFinanceReportEngineExists: false,
}

export const REPORTING_CONTRACTS = {
  F22: { reportKind: 'REPORT', exportAllowed: false },
  F25: { reportKind: 'EXPORT', exportAllowed: true },
  F27: { reportKind: 'AUDIT_TRAIL_VIEW', exportAllowed: false },
  F08: { reportKind: 'MEMBER_LEVEL_ROWS', exportAllowed: false },
  'FO-NAV-6': { reportKind: 'NAVIGATION_TO_REPORTS', exportAllowed: false },
}

export const PLATFORM_BILLING_BOUNDARY = {
  rule: 'Nzila platform billing and Union Eyes institutional finance are separate. A page, route or service that belongs to platform economics is never evidence of a union finance capability, and no union finance destination is built from one.',
  isUnionFinance: false,
  separateFromUnionFinance: true,
  evidence: [
    { file: 'apps/union-eyes/services/platform-economics/index.ts', quote: 'Unified export point for all 5 DAPL layers' },
    { file: 'apps/union-eyes/services/platform-economics/ledger-service.ts', quote: 'Canonical append-only ledger for all platform economics entries' },
    { file: 'apps/union-eyes/app/[locale]/dashboard/finance/page.tsx', quote: 'Platform economics overview' },
  ],
}

/**
 * A source file is a platform-economics surface when it imports platform economics (other than the entitlement guard)
 * or declares itself a platform economics page. The same test runs in the validator.
 */
export function isPlatformEconomicsText(text) {
  if (/Platform economics overview/.test(text)) return true
  if (/from\s+'@\/services\/platform-economics(?:\/(?!entitlement-guard)[a-z-]+)?'/.test(text)) return true
  return /\b(platformPayments|billingAccounts|transactionFeeEvents)\b/.test(text)
}

export const NAVIGATION_ADVERTISEMENT = {
  NOT_ADVERTISED_UNTIL_IMPLEMENTED: 'Every capability behind the destination is NOT_IMPLEMENTED or answers HTTP 501. The entry is not shown.',
  SHOWN_WITH_STATE_LABELS: 'Some capability behind the destination is partly implemented. The entry is shown, and each unavailable capability is labelled with its state. A page existing is not evidence of an operational engine.',
  SHOWN_WHEN_USABLE: 'Every capability behind the destination is implemented. The entry is shown only to a principal who can use it.',
}

export function deriveNavigationState(statuses) {
  const list = Object.values(statuses)
  const usable = (s) => s === 'SOURCE_PRESENT' || s === 'PARTIAL_SOURCE'
  if (list.length === 0 || !list.some(usable)) return { aggregate: 'NONE_USABLE', advertisement: 'NOT_ADVERTISED_UNTIL_IMPLEMENTED' }
  if (list.every((s) => s === 'SOURCE_PRESENT')) return { aggregate: 'ALL_IMPLEMENTED', advertisement: 'SHOWN_WHEN_USABLE' }
  return { aggregate: 'PARTIALLY_AVAILABLE', advertisement: 'SHOWN_WITH_STATE_LABELS' }
}

export const SCENARIO_CONFIGURATION = {
  REP: {
    'REP-SCN-CAPE': 'rep.protocol.cape', 'REP-SCN-CUPE': 'rep.protocol.cupe', 'REP-SCN-LIUNA': 'rep.scope.liuna', 'REP-SCN-SMALL-LOCAL': 'rep.protocol.small-local',
  },
  FO: {
    'FO-SCN-CAPE': 'finance.model.cape', 'FO-SCN-CUPE': 'finance.model.cupe', 'FO-SCN-LIUNA': 'finance.model.liuna', 'FO-SCN-SMALL-LOCAL': 'finance.model.small-local',
  },
}

// ---------------------------------------------------------------------------------------------------------------------
// Product decision recommendations
// ---------------------------------------------------------------------------------------------------------------------

export const PD_RECOMMENDATIONS = {
  'DEC-PD-01': { disposition: 'ACCEPT_DESIGN', revisionRequired: true, qualification: 'Distinct experience, configurable office and capacity. The persona does not imply a distinct institutional office or extra authority.' },
  'DEC-PD-02': { disposition: 'REVISE', revisionRequired: true, qualification: 'Visibility follows actual available functions, not a fixed seven-page promise.' },
  'DEC-PD-03': { disposition: 'ACCEPT', revisionRequired: true, qualification: 'Explicit member disclosure must still pass a server-side disclosure decision.' },
  'DEC-PD-04': { disposition: 'REVISE', revisionRequired: true, qualification: 'Separate inquiry or request, accepted case, formal grievance and appeal without assuming one universal linear progression.' },
  'DEC-PD-05': { disposition: 'ACCEPT', revisionRequired: false, qualification: 'Acknowledgement does not transfer authority.' },
  'DEC-PD-06': { disposition: 'ACCEPT_AS_PROPOSED_TAXONOMY', revisionRequired: false, qualification: 'Preserve every historical-versus-proposed distinction.' },
  'DEC-PD-07': { disposition: 'ACCEPT', revisionRequired: false, qualification: 'Historical disposition and live implementation status remain separate.' },
  'DEC-PD-08': { disposition: 'ACCEPT_AS_TEST_DESIGNS', revisionRequired: true, qualification: 'No journey counts as passed until executed.' },
  'DEC-PD-09': { disposition: 'ACCEPT_AS_PROPOSED_TAXONOMY', revisionRequired: true, qualification: 'Not evidence of existing financial functionality.' },
  'DEC-PD-10': { disposition: 'REVISE', revisionRequired: true, qualification: 'Do not imply union financial operations are implemented where they remain unavailable.' },
  'DEC-PD-11': { disposition: 'REVISE', revisionRequired: true, qualification: 'Distinct financial duties do not mean every consecutive step universally requires a different person.' },
  'DEC-PD-12': { disposition: 'ACCEPT', revisionRequired: true, qualification: 'Requesting an extension does not modify its legal or contractual effect.' },
  'DEC-PD-13': { disposition: 'ACCEPT_WITH_CONTROLS', revisionRequired: true, qualification: 'Aggregation, export and inference risks require separate authorization.' },
  'DEC-PD-14': { disposition: 'ACCEPT_AS_SCENARIO_HYPOTHESES', revisionRequired: true, qualification: 'CAPE, CUPE, LIUNA and small-local workflows must remain independently configurable and validated.' },
}

export const PD_DISPOSITIONS = ['ACCEPT', 'ACCEPT_DESIGN', 'ACCEPT_AS_PROPOSED_TAXONOMY', 'ACCEPT_AS_TEST_DESIGNS', 'ACCEPT_WITH_CONTROLS', 'ACCEPT_AS_SCENARIO_HYPOTHESES', 'REVISE']

// ---------------------------------------------------------------------------------------------------------------------
// Institutional authority decisions: what engineering may do before adoption
// ---------------------------------------------------------------------------------------------------------------------

export const IA_ENGINEERING = {
  'DEC-IA-01': ['The designation record, expiry, revocation, a metadata-only queue read model and a queue preview.', 'A test-issued designation in a synthetic organization exercising the metadata-only queue.'],
  'DEC-IA-02': ['The take-ownership action, its refusal paths and a preview of its result.', 'A test-issued protocol and designation in a synthetic organization exercising take-ownership.'],
  'DEC-IA-03': ['The assign and route actions, a draft assignment and a preview.', 'A test-issued supervisory mandate in a synthetic organization exercising assignment.'],
  'DEC-IA-04': ['The closure action, its state checks and a closure-proposal draft.', 'A test fixture exercising closure by a test-designated primary handler.'],
  'DEC-IA-05': ['The disclosure decision record, the classification step and a disclosure preview.', 'A test fixture with a synthetic label list exercising a disclosure decision.'],
  'DEC-IA-06': ['The privileged-access grant record and its refusal paths.', 'A test-issued independent grant in a synthetic organization exercising privileged access to synthetic content only.'],
  'DEC-IA-07': ['The recusal record, the refusal path and a lifting-request draft.', 'A test fixture exercising a recusal and a test-designated lifting decision.'],
  'DEC-IA-08': ['The delegation record, expiry and a substitute-coverage preview.', 'A test-issued delegation in a synthetic organization exercising coverage.'],
  'DEC-IA-09': ['The review request, a recommendation draft and a review queue.', 'A test-designated reviewer in a synthetic organization exercising approve and decline.'],
  'DEC-IA-10': ['Territory and unit scope fields and a scoped read model.', 'A test-issued territory mandate in a synthetic organization exercising scoped reads.'],
  'DEC-IA-11': ['The protocol record, an approval step and an automatic-assignment preview.', 'A test-approved protocol in a synthetic organization exercising assignment.'],
  'DEC-IA-12': ['The referral draft, the consent step and a referral preview that writes no consent text.', 'A synthetic consent fixture exercising a referral to a synthetic specialist.'],
  'DEC-IA-13': ['The extension request record and a grant-decision draft.', 'A test-designated approver in a synthetic organization exercising grant and decline.'],
  'DEC-IA-14': ['The correspondence draft, a review queue and a dispatch preview that sends nothing.', 'A test-designated approver and a stub dispatch exercising approve and sign.'],
  'DEC-IA-15': ['The hold and retention records and a preview.', 'A test-designated governance mandate in a synthetic organization exercising place and release.'],
  'DEC-IA-16': ['The mandate lifecycle service, a register preview and refusal paths.', 'A test-issued mandate in a synthetic organization exercising the three-person issuance rule. No real mandate is issued.'],
  'DEC-IA-17': ['The delegation refusal path and a delegation-request draft.', 'A test fixture exercising the refusal and a test-permitted delegation.'],
  'DEC-IA-18': ['Limit and approval-count fields, a limit check and a preview.', 'A test-issued limit in a synthetic organization exercising within-limit and over-limit decisions.'],
  'DEC-IA-19': ['The expenditure workflow behind its unavailable state, with drafts and previews.', 'A test policy in a synthetic organization exercising the expense workflow with synthetic amounts.'],
  'DEC-IA-20': ['The payment execution path against a stub rail.', 'A stub rail and synthetic accounts exercising execution. No real payment moves.'],
  'DEC-IA-21': ['The reconciliation duty, a match queue and a preview.', 'A test-issued reconcile mandate in a synthetic organization exercising reconciliation.'],
  'DEC-IA-22': ['The trustee register behind its unavailable state.', 'A test appointment in a synthetic organization exercising the register.'],
  'DEC-IA-23': ['The audit access scope, an audit view preview and refusal paths.', 'A test-appointed auditor in a synthetic organization exercising scoped audit reads.'],
  'DEC-IA-24': ['The fund and stipend workflow behind its unavailable state.', 'A synthetic fund exercising disbursement with synthetic amounts.'],
  'DEC-IA-25': ['The remittance workflow behind its unavailable state, with a preview.', 'A synthetic affiliate and stub submission exercising the workflow.'],
  'DEC-IA-26': ['The pension finance workflow behind its refusal path.', 'A synthetic plan exercising contribution and benefit records.'],
  'DEC-IA-27': ['An explicit allow-list read path and a mandate-store read model.', 'A test allow-list entry in a synthetic organization exercising member dues reads.'],
  'DEC-IA-28': ['The revocation and expiry paths and a succession preview.', 'A test fixture exercising revocation and replacement.'],
  'DEC-IA-29': ['The export record and a stub export target.', 'A stub target exercising export with synthetic records. No external system is called.'],
  'DEC-IA-30': ['The slip and receipt draft and a preview.', 'A synthetic registration exercising slip drafting. No slip is issued or filed.'],
  'DEC-IA-31': ['An organization-level adoption switch that defaults to off.', 'A synthetic organization with the switch on, exercising the financial baseline.'],
  'DEC-IA-32': ['Per-organization steward scope configuration that defaults to relationship-only scope.', 'A synthetic organization with a test protocol exercising steward scope.'],
}

export const PD_PROPOSALS = {
  'DEC-PD-01': {
    proposal: 'Steward is specified as its own persona with a distinct workspace. The workspace is a presentation choice that carries no authority. Five facts stay apart: interface persona, employment or union office, platform role, case relationship and issued authority. A distinct institutional office is not implied, and office and capacity are configurable per organization. Every steward action still names the Representative 2.2 action it narrows.',
    options: ['Distinct workspace with office and capacity configurable per organization (proposed)', 'Front-line capacity inside Representative 2.2', 'Distinct persona only where an institution configures a steward-led protocol'],
  },
  'DEC-PD-02': {
    question: 'Which destinations does the steward see, and what decides whether one appears?',
    proposal: 'Seven candidate destinations, each narrowed to the steward\u2019s own relationships. A destination appears only while the signed-in principal can use at least one capability behind it, and it is hidden otherwise. No page count is promised. Knowledge & Guidance appears only while a clause-library capability is usable.',
    options: ['Capability-conditional candidate destinations (proposed)', 'A fixed set of seven narrowed destinations', 'A fixed set of five destinations without Communications and Knowledge'],
  },
  'DEC-PD-03': {
    proposal: 'Staff-only by default. A note becomes member-visible only after it is classified and an authorized disclosure decision is taken on the server. A visibility flag sent by a client is never sufficient. A communication written for the member is decided by case:comment, and disclosure of an existing staff-held record is decided separately by case:disclose_to_member for the primary handler. This keeps the repaired source default recorded as P0-F1 and records that source does not yet classify or record a disclosure decision.',
    options: ['Staff-only default with a classification and an authorized server-side disclosure decision (proposed)', 'Staff-only default with an author-chosen visibility flag', 'Member-visible default'],
  },
  'DEC-PD-04': {
    question: 'How are an inquiry, a service request, a case, a formal grievance, a complaint, an appeal and a reconsideration distinguished, and how may they relate?',
    proposal: 'Seven distinct entity types. None is a stage of another, none requires a prior entity, and no sequence is mandatory. Allowed links are optional and transitions are configured per organization protocol. Whether claims and grievances are one canonical entity or two stays unresolved under Gate 4 (UE-CAP-C-001) and is not decided here. An unassigned intake is metadata until a person accepts or routes it.',
    options: ['Seven distinct entity types with configurable links and transitions (proposed)', 'One mandatory linear sequence from inquiry to grievance', 'Two entity types: intake and case'],
  },
  'DEC-PD-10': {
    proposal: 'Accounts & Cash, Budgets & Spending and Funds & Programs are recovered names. Dues & Remittances, Approvals & Payments, Reports & Records and Mandates & Oversight are proposed. Every destination carries a capability state derived from the contracts behind it. A destination whose capabilities are all unavailable is not advertised, and a page that exists does not imply an operational finance engine. Nzila platform billing surfaces are not union finance destinations.',
    options: ['Capability-state derived navigation (proposed)', 'A fixed set of seven destinations', 'Only destinations with a full implementation'],
  },
  'DEC-PD-11': {
    question: 'Are FJ01\u2013FJ10 accepted as the ten proposed workflows, and how is separation of duties modelled?',
    proposal: 'Ten proposed, testable workflows. Viewing, preparing, approving, executing, reconciling and auditing stay separate powers. Whether one principal may hold two of them is decided by a separation rule evaluated against the transaction, account, amount, mandate, approval and principal. The model distinguishes mandatory technical protections, implemented software rules and proposed institutional rules. No rule is assumed for consecutive steps, and the three-person issuance design is evidence of an implemented software rule and not proof of institutional adoption.',
    options: ['Rule-driven separation evaluated per transaction, account and principal (proposed)', 'Every consecutive duty held by a different person', 'No separation beyond a mandate'],
  },
  'DEC-PD-13': {
    question: 'Which reports and exports does the Financial Officer baseline cover, and what authorizes them?',
    proposal: 'Reports are views over records the viewer holds a view duty on, and a view duty alone does not authorize a report, an aggregate, member-level rows or an export. Disclosed fields, aggregation, scope, sensitivity, export and inference risk are each authorized separately. An export is a separate duty-checked action with its own record. Nzila platform billing reports are not union finance reports.',
    options: ['Separately authorized reports, aggregates and exports (proposed)', 'A view duty authorizes every report over its records', 'No reports in this baseline'],
  },
}

export const PD_QUALIFICATIONS = {
  'DEC-PD-05': ' Acknowledgement does not transfer or create authority.',
  'DEC-PD-06': ' Each pairing of an identifier to a meaning stays labelled as proposed, and historical and proposed meanings are never merged.',
  'DEC-PD-07': ' The historical disposition and the live implementation status stay separate fields.',
  'DEC-PD-08': ' No journey counts as passed until it is executed. Every journey records NOT_EXECUTED.',
  'DEC-PD-09': ' The map is a proposed taxonomy and is not evidence that any financial functionality exists.',
  'DEC-PD-12': ' Requesting an extension records a request only. It does not change the legal or contractual deadline or its effect.',
  'DEC-PD-14': ' The four scenarios are independently configurable and independently validated. None borrows another\u2019s configuration, and the two hypotheses stay hypotheses until discovery with the institution.',
}

/** Reads the incompatible duty pairs from the finance policy source so the baseline cannot restate them wrongly. */
export function incompatibleDutiesFromSource(text) {
  const block = text.match(/export const INCOMPATIBLE_DUTIES[^=]*=\s*\[([\s\S]*?)\n\]/)
  if (!block) return []
  return [...block[1].matchAll(/\[\s*'([a-z]+)'\s*,\s*'([a-z]+)'\s*\]/g)].map((m) => [m[1], m[2]])
}
