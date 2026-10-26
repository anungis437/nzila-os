/**
 * Writes the Gate 0A persona source recovery file.
 *
 * Every source is a git object addressed by commit and path. Nothing here restates a requirement in new
 * words: titles and quotes are copied from the cited blob, and the validator re-finds each one.
 * Run: node tooling/scripts/lib/ue-gate0a-build-recovery.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RECOVERY_FILE, gitBlobAt, gitShowAt } from './ue-gate0a-persona-recovery.mjs'
import { ROOT } from './ue-gate0-scope-lock.mjs'

const REP = 'docs/union-eyes/convergence/UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION.md'
const FO = 'docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md'
const SR = 'docs/union-eyes/reality-remediation/32_UE_SENIOR_REPRESENTATIVE_2_1_CONVERGENCE_DISPOSITION.md'

const BASE = 'f39828e97837afa73cf2a03f40c841b3b2699dad'
const REP_V1 = '571784d58f93ed6939438422534c63b83d77c7ed'
const REP_V2 = 'a0e7753fdfc43f4fd3fcc7c39a69d6c68b845407'
const FO_V1 = 'ee9ecbb5100497b2bbefa9e06b276d3c7d31ae80'
const FO_V2 = '7ba993a318425c94820bc20ad07a6821302aca25'

const sourceDefs = [
  { id: 'REP-DISPOSITION-V1', class: 'FROZEN_DISPOSITION', commit: REP_V1, path: REP, note: 'First Representative 2.2 disposition. Its R01–R24 matrix was removed when the record was rewritten at a0e7753fd, so it exists only in git history.' },
  { id: 'REP-DISPOSITION-V2', class: 'FROZEN_DISPOSITION', commit: REP_V2, path: REP, note: 'Rewritten disposition. Same blob as the working tree.' },
  { id: 'FO-DISPOSITION-V1', class: 'FROZEN_DISPOSITION', commit: FO_V1, path: FO, note: 'First Financial Officer 2.1 disposition.' },
  { id: 'FO-DISPOSITION-V2', class: 'FROZEN_DISPOSITION', commit: FO_V2, path: FO, note: 'Follow-up disposition. Same blob as the working tree.' },
  { id: 'SR-DISPOSITION', class: 'FROZEN_DISPOSITION', commit: BASE, path: SR, note: 'Senior Representative disposition. It is a source for Senior Representative actions and is cited here only for the steward boundary it assigns to Representative 2.2.' },
  { id: 'EXEC-ROLES', class: 'EXISTING_EXECUTABLE_CONTRACT', commit: BASE, path: 'apps/union-eyes/lib/auth/roles.ts', note: 'Role enumeration. Names the steward role. Does not state what a steward must be able to do.' },
  { id: 'EXEC-FINANCIAL-AUTHORITY', class: 'EXISTING_EXECUTABLE_CONTRACT', commit: BASE, path: 'apps/union-eyes/lib/finance/financial-authority.ts', note: 'Route-level allow-list. Its own header says it is not a mandate model.' },
  { id: 'EXEC-FINANCIAL-LIFECYCLE', class: 'EXISTING_EXECUTABLE_CONTRACT', commit: BASE, path: 'apps/union-eyes/lib/finance/financial-mandate-lifecycle.ts', note: 'Names six financial powers and the three-person rule. Shows what the code distinguishes. Does not prove the institution required it.' },
  { id: 'EXEC-FINANCIAL-PRINCIPAL', class: 'EXISTING_EXECUTABLE_CONTRACT', commit: BASE, path: 'apps/union-eyes/lib/finance/principal-financial-authority.ts', note: 'Names the segregated powers.' },
]

const quote = (sourceId, text) => ({ sourceId, quote: text })

const identifiers = [
  { persona: 'representative', id: 'R01', level: 'INDIVIDUALLY_DEFINED', title: 'identity/mandates', sourceId: 'REP-DISPOSITION-V1', quote: '| R01 identity/mandates | LIMITED |', statements: [quote('REP-DISPOSITION-V1', '| R01 identity/mandates | LIMITED |')].map((s) => ({ ...s, status: 'LIMITED' })), capabilityId: 'UE-CAP-I-001' },
  { persona: 'representative', id: 'R02', level: 'INDIVIDUALLY_DEFINED', title: 'daily workload', sourceId: 'REP-DISPOSITION-V1', quote: '| R02 daily workload | LIMITED |', statements: [{ ...quote('REP-DISPOSITION-V1', '| R02 daily workload | LIMITED |'), status: 'LIMITED' }], capabilityId: 'UE-CAP-I-001' },
  { persona: 'representative', id: 'R09', level: 'INDIVIDUALLY_DEFINED', title: 'member relationships', sourceId: 'REP-DISPOSITION-V1', quote: '| R09 member relationships | LIMITED |', statements: [{ ...quote('REP-DISPOSITION-V1', '| R09 member relationships | LIMITED |'), status: 'LIMITED' }], capabilityId: 'UE-CAP-I-001' },
  { persona: 'representative', id: 'R13', level: 'INDIVIDUALLY_DEFINED', title: 'evidence/records', sourceId: 'REP-DISPOSITION-V1', quote: '| R13 evidence/records | UNAVAILABLE (unverified) |', statements: [{ ...quote('REP-DISPOSITION-V1', '| R13 evidence/records | UNAVAILABLE (unverified) |'), status: 'UNAVAILABLE (UNVERIFIED)' }], capabilityId: 'UE-CAP-F-002' },
  { persona: 'representative', id: 'R14', level: 'INDIVIDUALLY_DEFINED', title: 'tasks/deadlines', sourceId: 'REP-DISPOSITION-V1', quote: '| R14 tasks/deadlines | LIMITED |', statements: [{ ...quote('REP-DISPOSITION-V1', '| R14 tasks/deadlines | LIMITED |'), status: 'LIMITED' }], capabilityId: 'UE-OMIT-DEADLINE-OVERDUE' },
  { persona: 'representative', id: 'R15', level: 'INDIVIDUALLY_DEFINED', title: 'agreements', sourceId: 'REP-DISPOSITION-V1', quote: '| R15 agreements | LIMITED |', statements: [{ ...quote('REP-DISPOSITION-V1', '| R15 agreements | LIMITED |'), status: 'LIMITED' }], capabilityId: 'UE-CAP-I-001' },
  {
    persona: 'representative',
    id: 'R18',
    level: 'INDIVIDUALLY_DEFINED',
    title: 'WorkAid/specialists',
    sourceId: 'REP-DISPOSITION-V1',
    quote: '| R18 WorkAid/specialists | BLOCKED |',
    statements: [
      { ...quote('REP-DISPOSITION-V1', '| R18 WorkAid/specialists | BLOCKED |'), status: 'BLOCKED' },
      { ...quote('REP-DISPOSITION-V2', 'R18 is MISSING'), status: 'MISSING' },
    ],
    capabilityId: 'UE-CAP-G-002',
  },
  { persona: 'financial-officer', id: 'F08', level: 'INDIVIDUALLY_DEFINED', title: 'access restricted; individual-record scoping not runtime-proven', titleLevel: 'STATUS_STATEMENT_ONLY', sourceId: 'FO-DISPOSITION-V2', quote: 'F08 LIMITED (access restricted; individual-record scoping not runtime-proven)', statements: [{ ...quote('FO-DISPOSITION-V2', 'F08 LIMITED (access restricted; individual-record scoping not runtime-proven)'), status: 'LIMITED' }] },
  { persona: 'financial-officer', id: 'F09', level: 'INDIVIDUALLY_DEFINED', title: 'source preservation only', titleLevel: 'STATUS_STATEMENT_ONLY', sourceId: 'FO-DISPOSITION-V2', quote: 'F09 LIMITED (source preservation only)', statements: [{ ...quote('FO-DISPOSITION-V2', 'F09 LIMITED (source preservation only)'), status: 'LIMITED' }] },
  { persona: 'financial-officer', id: 'F10', level: 'INDIVIDUALLY_DEFINED', title: 'affiliate remittances', titleLevel: 'DOMAIN_TITLE', sourceId: 'FO-DISPOSITION-V2', quote: 'F10 (affiliate remittances) UNAVAILABLE', statements: [{ ...quote('FO-DISPOSITION-V2', 'F10 (affiliate remittances) UNAVAILABLE'), status: 'UNAVAILABLE' }] },
  { persona: 'financial-officer', id: 'F19', level: 'INDIVIDUALLY_DEFINED', title: 'trustees', titleLevel: 'DOMAIN_TITLE', sourceId: 'FO-DISPOSITION-V2', quote: 'F19 (trustees) BLOCKED on trustee authority', statements: [{ ...quote('FO-DISPOSITION-V2', 'F19 (trustees) BLOCKED on trustee authority'), status: 'BLOCKED' }] },
]

const groups = [
  { persona: 'representative', ids: ['R07', 'R08'], level: 'GROUPED_ONLY', labels: ['case lifecycle', 'assignment'], pairing: 'POSITIONAL_INFERENCE', sourceId: 'REP-DISPOSITION-V1', quote: '| R07/R08 case lifecycle, assignment | LIMITED |', note: 'Two identifiers share one label cell. Reading the first label as R07 and the second as R08 is an inference from order and is not recorded as a definition.' },
  { persona: 'representative', ids: ['R11', 'R12'], level: 'GROUPED_ONLY', labels: ['communications'], pairing: 'NONE', sourceId: 'REP-DISPOSITION-V1', quote: '| R11/R12 communications | LIMITED |', note: 'One label for two identifiers.' },
  { persona: 'representative', ids: ['R03', 'R04', 'R05', 'R06'], level: 'GROUPED_ONLY', labels: ['intake', 'assessment', 'triage', 'escalation'], pairing: 'POSITIONAL_INFERENCE', sourceId: 'REP-DISPOSITION-V2', quote: 'R03–R06 (intake, assessment, triage, escalation)', note: 'Four labels for four identifiers in a parenthetical. The order is suggestive and is not a one-to-one definition.' },
  { persona: 'representative', ids: ['R03', 'R04', 'R05', 'R06', 'R10', 'R16', 'R17', 'R19', 'R20', 'R21', 'R22', 'R23', 'R24'], level: 'GROUPED_ONLY', labels: [], pairing: 'NONE', sourceId: 'REP-DISPOSITION-V1', quote: '| R03–R06, R10, R16, R17, R19–R24 | UNAVAILABLE (unverified) |', note: 'Status only. The first record gives no label for these identifiers.' },
  { persona: 'financial-officer', ids: ['F11', 'F12', 'F13', 'F14'], level: 'GROUPED_ONLY', labels: ['budgets', 'expenses', 'vendors'], pairing: 'NONE', sourceId: 'FO-DISPOSITION-V2', quote: 'F11/F12/F13/F14 (budgets, expenses, vendors) UNAVAILABLE', note: 'Four identifiers, three labels. No one-to-one pairing exists, so none was made.' },
  { persona: 'financial-officer', ids: ['F17', 'F18'], level: 'GROUPED_ONLY', labels: ['strike and restricted funds'], pairing: 'NONE', sourceId: 'FO-DISPOSITION-V2', quote: 'F17/F18 (strike and restricted funds) UNAVAILABLE', note: 'Two identifiers, one label phrase.' },
]

const conflicts = [
  {
    persona: 'representative',
    id: 'R18',
    field: 'status',
    statements: [
      { ...quote('REP-DISPOSITION-V1', '| R18 WorkAid/specialists | BLOCKED |'), status: 'BLOCKED' },
      { ...quote('REP-DISPOSITION-V2', 'R18 is MISSING'), status: 'MISSING' },
    ],
    disposition: 'UNRESOLVED',
    note: 'The first record says BLOCKED on an operational connector. The rewritten record says MISSING. Gate 0A does not choose between them. Both agree that nothing is operational.',
  },
]

const unidentifiedReferences = [
  { persona: 'representative', label: 'Journeys A–G', sourceId: 'REP-DISPOSITION-V1', quote: 'Journeys A–G, institutional scenario proofs (CAPE / CUPE / LIUNA / small local / specialist)', blocksResolution: true, note: 'A range of letters with no definition. No identifier was created for it.' },
  { persona: 'representative', label: 'Institutional scenarios (CAPE, CUPE, LIUNA, small local)', sourceId: 'REP-DISPOSITION-V2', quote: 'CAPE LRO-led assignment, CUPE regional/National assistance, LIUNA territory denial and the small-local dual-mandate case', blocksResolution: true, note: 'Named scenarios with no identifier.' },
  { persona: 'financial-officer', label: 'Navigation destinations (seven, three named)', sourceId: 'FO-DISPOSITION-V2', quote: 'Navigation (seven destinations)', blocksResolution: true, note: 'Seven destinations are announced. Only three names appear.' },
  { persona: 'financial-officer', label: 'Navigation names: Accounts & Cash, Budgets & Spending, Funds & Programs', sourceId: 'FO-DISPOSITION-V2', quote: '"Accounts & Cash", "Budgets & Spending" and "Funds & Programs"', blocksResolution: true, note: 'Names without identifiers or definitions.' },
  { persona: 'financial-officer', label: 'Organization scenarios, WorkAid boundary, external accounting, succession/revocation, acceptance', sourceId: 'FO-DISPOSITION-V2', quote: 'organization scenarios, WorkAid boundary, external accounting, succession/revocation', blocksResolution: true, note: 'Listed beside FJ01–FJ10 with no identifiers.' },
]

const steward = {
  decision: 'NO_AUTHORITATIVE_STEWARD_ACTION_UNIVERSE',
  authoritativeActions: 0,
  openQuestions: [
    'Is Steward a distinct frozen persona with its own action list, or the level-1 role inside the Representative 2.2 experience?',
    'If Steward is distinct, which institutional owner supplies the canonical?',
    'Which Representative actions, if any, does a steward hold without an assignment, and by what mandate?',
  ],
  inference: {
    class: 'UNVERIFIED_INFERENCE',
    statement: 'The repository treats the steward as the level-1 staff role under Representative 2.2. That reading rests on the evidence below and is not an institutional decision. It does not define a single steward action.',
    basisEvidence: ['S1', 'S2', 'S8'],
  },
  evidence: [
    { id: 'S1', class: 'FROZEN_DISPOSITION', sourceId: 'REP-DISPOSITION-V1', quote: '## 2. Navigation (Slice 1) — steward / staff experience', observation: 'The first Representative 2.2 record names one combined steward and staff experience.', definesAction: false },
    { id: 'S2', class: 'FROZEN_DISPOSITION', sourceId: 'REP-DISPOSITION-V2', quote: 'distinguishes steward (level 1), chief steward / business agent (level 2,', observation: 'The policy layer places the steward at level 1. It lists no steward actions.', definesAction: false },
    { id: 'S3', class: 'FROZEN_DISPOSITION', sourceId: 'REP-DISPOSITION-V2', quote: 'Steward and legacy aliases held `VIEW_ALL_CLAIMS`/`EDIT_ALL_CLAIMS`/`ASSIGN_CLAIMS`', observation: 'A finding about what a steward must not hold. It is a denial, not an action.', definesAction: false },
    { id: 'S4', class: 'FROZEN_DISPOSITION', sourceId: 'REP-DISPOSITION-V2', quote: "A steward's working note posted from the workbench was saved **member-visible**", observation: 'A finding about note visibility. It implies steward notes exist and default to staff only.', definesAction: false },
    { id: 'S5', class: 'FROZEN_DISPOSITION', sourceId: 'REP-DISPOSITION-V1', quote: 'steward → self + members of claims assigned to them', observation: 'The directory policy a steward received after repair. A repair outcome, not a requirement.', definesAction: false },
    { id: 'S6', class: 'FROZEN_DISPOSITION', sourceId: 'REP-DISPOSITION-V1', quote: 'Steward triage for unassigned intake has no delegation grant to key off, so stewards currently see only assigned/own matters.', observation: 'A recorded gap. The intended steward triage is not stated.', definesAction: false },
    { id: 'S7', class: 'EXISTING_EXECUTABLE_CONTRACT', sourceId: 'EXEC-ROLES', quote: 'STEWARD = "steward", // Union Steward', observation: 'The role exists in code. Code existence does not prove an institutional requirement.', definesAction: false },
    { id: 'S8', class: 'FROZEN_DISPOSITION', sourceId: 'SR-DISPOSITION', quote: 'Steward+ organization-wide case and document read (queue confidentiality) | Representative 2.2', observation: 'The Senior Representative record assigns the steward-plus read boundary to Representative 2.2.', definesAction: false },
  ],
}

const financialAuthoritySeparation = [
  {
    concern: 'viewing',
    status: 'EXECUTABLE_CONTRACT_AND_DISPOSITION_FINDING',
    institutionallyRequired: false,
    evidence: [
      { ...quote('FO-DISPOSITION-V2', 'auth.roles = FINANCIAL_MEMBER_DATA_ROLES'), observation: 'Member financial data routes use a role allow-list.' },
      { ...quote('EXEC-FINANCIAL-AUTHORITY', "FINANCIAL_MEMBER_DATA_ROLES: UserRole[] = ['secretary_treasurer'];"), observation: 'The allow-list is one role. A role is not an issued financial mandate.' },
    ],
  },
  {
    concern: 'preparation',
    status: 'EXECUTABLE_CONTRACT_ONLY',
    institutionallyRequired: false,
    evidence: [{ ...quote('EXEC-FINANCIAL-LIFECYCLE', "const FINANCIAL_POWERS = ['view', 'prepare', 'approve', 'execute', 'reconcile', 'audit'] as const"), observation: 'The code names prepare as a power. No disposition states a preparation requirement.' }],
  },
  {
    concern: 'approval',
    status: 'DISPOSITION_STATES_GAP',
    institutionallyRequired: false,
    evidence: [{ ...quote('FO-DISPOSITION-V2', 'no financial approval workflow exists to qualify'), observation: 'No approval workflow exists.' }],
  },
  {
    concern: 'payment execution',
    status: 'DISPOSITION_STATES_GAP',
    institutionallyRequired: false,
    evidence: [
      { ...quote('FO-DISPOSITION-V2', 'Native dues scheduler hardcoded test tenant; autopay/Stripe | Not activated or touched'), observation: 'Payment automation was not activated.' },
      { ...quote('EXEC-FINANCIAL-PRINCIPAL', "const SEGREGATED = new Set(['approve', 'execute', 'reconcile', 'audit'])"), observation: 'The code segregates execute from other powers.' },
    ],
  },
  {
    concern: 'reconciliation',
    status: 'DISPOSITION_STATES_GAP',
    institutionallyRequired: false,
    evidence: [{ ...quote('FO-DISPOSITION-V2', 'Reconciliation has no engine-driven transition at all yet'), observation: 'No remittance can become reconciled.' }],
  },
  {
    concern: 'mandate administration',
    status: 'EXECUTABLE_CONTRACT_AND_DISPOSITION_FINDING',
    institutionallyRequired: false,
    evidence: [
      { ...quote('EXEC-FINANCIAL-LIFECYCLE', 'The issuer, the holder and the approver of a financial mandate are three different people.'), observation: 'The code requires three different people. No disposition states the institutional rule.' },
      { ...quote('FO-DISPOSITION-V2', 'must decide whether a delegated-mandate store or an interim allow-list expansion is required'), observation: 'The product owner has not decided on a mandate store.' },
    ],
  },
  {
    concern: 'audit',
    status: 'EXECUTABLE_CONTRACT_AND_DISPOSITION_FINDING',
    institutionallyRequired: false,
    evidence: [
      { ...quote('EXEC-FINANCIAL-PRINCIPAL', "const SEGREGATED = new Set(['approve', 'execute', 'reconcile', 'audit'])"), observation: 'The code treats audit as a segregated power.' },
      { ...quote('FO-DISPOSITION-V2', 'the evidence-pack call remains fire-and-forget'), observation: 'Evidence-pack recording is not an atomic audit.' },
    ],
  },
]

const canonicalSearch = [
  {
    persona: 'steward',
    canonicalId: null,
    status: 'NOT_RECOVERED',
    note: 'No document in the repository or its history names a Steward canonical identifier.',
  },
  {
    persona: 'representative',
    canonicalId: 'UE-REPRESENTATIVE-CANONICAL-2.2',
    status: 'NOT_RECOVERED',
    firstCited: { ...quote('REP-DISPOSITION-V1', 'Canonical authority:** UE-REPRESENTATIVE-CANONICAL-2.2 (FROZEN)'), commit: REP_V1 },
    note: 'Cited as FROZEN by the disposition. First appears at the cited commit as a citation only. No ref contains a file or text with that identifier as its subject.',
  },
  {
    persona: 'financial-officer',
    canonicalId: 'UE-FINANCIAL-OFFICER-CANONICAL-2.1',
    status: 'NOT_RECOVERED',
    firstCited: { ...quote('FO-DISPOSITION-V1', 'Canonical authority:** UE-FINANCIAL-OFFICER-CANONICAL-2.1 (FROZEN — design only)'), commit: FO_V1 },
    note: 'Cited as FROZEN (design only). Also cited by the financial-authority.ts header. No ref contains the canonical.',
  },
]

const searchProtocol = {
  searchedAt: 'Mon Oct 26 2026 America/Toronto, starting HEAD ' + BASE,
  refsScanned: 526,
  commands: [
    "git log --all -S'<identifier>' for UE-REPRESENTATIVE-CANONICAL, UE-FINANCIAL-OFFICER-CANONICAL, FINANCIAL-OFFICER-CANONICAL, STEWARD-CANONICAL, STEWARD_CANONICAL, REPRESENTATIVE_CANONICAL, UE-STEWARD, FJ01, CANONICAL-2.2",
    "git log --all --diff-filter=ACDMR --name-only, filtered for canonical, frozen, persona or disposition near steward, represent or financ",
    "git log --all --name-only, filtered for docx, pdf, txt, rtf, odt",
    "git ls-remote --heads origin and git fetch of every remote head",
    "git grep for F01–F28 and R01–R24 tokens at the starting HEAD",
  ],
  result: 'No ref contains a Steward, Representative 2.2, or Financial Officer 2.1 canonical. The three identifiers appear only as citations inside dispositions and code comments. The earliest Representative record is the only source that carries titles for R01, R02, R09, R13, R14, R15 and R18.',
  treeProbe: 'computePersonaSpecs re-probes the tracked tree on every run and treats any file named like a steward, representative, or financial canonical as a canonical.',
}

const universeFloorAnchor = { commit: BASE, path: 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json', note: 'The persona universes recorded before Gate 0A. A persona identifier present there must stay in the extracted universe and in the matrix.' }

const sources = sourceDefs.map((source) => {
  const blob = gitBlobAt(ROOT, source.commit, source.path)
  if (!blob || gitShowAt(ROOT, source.commit, source.path) === null) throw new Error(`cannot read ${source.id} at ${source.commit}:${source.path}`)
  return { ...source, blob, presentAtHead: gitBlobAt(ROOT, 'HEAD', source.path) === blob }
})

const recovery = {
  schemaVersion: 1,
  kind: 'EVIDENCE_CONSOLIDATION',
  note: 'This file consolidates evidence for Gate 0A. It is not a canonical, it adds no requirement, and it cannot add or remove a persona identifier. Quotes are copied from the cited git blob and re-verified by the Gate 0 validator.',
  baseCommit: BASE,
  universeFloorAnchor,
  searchProtocol,
  canonicalSearch,
  sources,
  identifiers,
  groups,
  conflicts,
  unidentifiedReferences,
  steward,
  financialAuthoritySeparation,
}

writeFileSync(join(ROOT, RECOVERY_FILE), `${JSON.stringify(recovery, null, 2)}\n`)
console.log(`wrote ${RECOVERY_FILE}: ${sources.length} sources, ${identifiers.length} identifiers, ${groups.length} groups, ${conflicts.length} conflicts, ${unidentifiedReferences.length} unidentified references, ${steward.evidence.length} steward evidence items`)
