import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const directory = 'docs/union-eyes/reality-remediation/'
const jsonFile = `${directory}PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT.json`
const markdownFile = `${directory}PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT.md`
const ue = 'apps/union-eyes/'
const auth = 'packages/platform-auth/src/'
const source = (file) => path.resolve(root, ...file.split('/'))
const digest = (value) => createHash('sha256').update(value).digest('hex')
const inputs = {}

function accepted(filename) {
  const file = `${directory}${filename}.json`
  const bytes = readFileSync(source(file))
  inputs[file] = digest(bytes)
  return JSON.parse(bytes.toString('utf8'))
}

const r2n = accepted('PHASE_1B_1_R2N_DENOMINATOR_AND_CEILING_AUDIT')
const census = accepted('PHASE_1B_1_CANONICAL_DATA_AUTHORITY_CENSUS')
const r2a = accepted('PHASE_1B_1_R2A_IMPORT_RESOLUTION_CLOSEOUT')
const r2b = accepted('PHASE_1B_1_R2B_AUTHORITY_OBJECT_CLOSEOUT')
const r1 = accepted('PHASE_1B_1_R1_AUTHORITY_CONFLICT_ADJUDICATION')
const phase1a = accepted('PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION')
const selected = r2n.records.filter(
  (record) => record.originClass === 'TARGETLESS_DATABASE_EFFECT_RESIDUAL',
)
assert.equal(r2n.denominator.TARGETLESS_DATABASE_EFFECT_RESIDUALS, 56)
assert.equal(r2n.denominator.FROZEN_PHASE1A_UNKNOWN_EFFECT_CARRY_FORWARD, 247)
assert.equal(r2n.excludedCarryForward.phase1AUnknownEffectChains.count, 247)
assert.equal(r2n.excludedCarryForward.phase1AUnknownEffectChains.ids.length, 247)
const expected = [
  '0001',
  '0002',
  '0003',
  '0004',
  '0005',
  '0006',
  '0008',
  '0010',
  '0011',
  '0013',
  '0018',
  '0019',
  '0020',
  '0021',
  '0029',
  '0092',
  '0098',
  '0099',
  '0102',
  '0103',
  '0104',
  '0122',
  '0161',
  '0162',
  '0164',
  '0165',
  '0166',
  '0167',
  '0178',
  '0179',
  '0180',
  '0181',
  '0183',
  '0184',
  '0185',
  '0225',
  '0226',
  '0237',
  '0238',
  '0249',
  '0250',
  '0253',
  '0257',
  '0265',
  '0294',
  '0295',
  '0297',
  '0298',
  '0325',
  '0326',
  '0342',
  '0350',
  '0370',
  '0371',
  '0380',
  '0394',
].map((id) => `UE-B2-CHAIN-${id}`)
assert.deepEqual(selected.map((r) => r.phase1aEvidence.chainId).sort(), expected)
assert.equal(new Set(selected.map((r) => r.residualId)).size, 56)
assert.equal(r2b.records.length, 207)
assert.equal(new Set(r2b.records.map((r) => r.objectId)).size, 207)
assert(r2b.records.every((r) => r.finalDisposition === 'SOURCE_CEILING_UNKNOWN_AUTHORITY'))
assert(r2b.records.every((r) => r.knownDefectId === null || typeof r.knownDefectId === 'string'))
assert.equal(
  digest(JSON.stringify(r2b.records)),
  'dbefec38e7add17aab8ae8f9bc5fa96014277abd622b3254715287ec31260836',
)
assert.equal(r2a.records.length, 966)
assert.equal(r1.dispositions.length, 5)
assert.equal(
  r1.dispositions.filter((r) => r.finalDisposition === 'KNOWN_DUPLICATE_AUTHORITY_CONFLICTS')
    .length,
  4,
)
assert.equal(
  r1.dispositions.filter((r) => r.finalDisposition === 'ACTIVE_CANONICAL_WITH_LEGACY_MIRROR')
    .length,
  1,
)

const objects = new Map(census.persistenceUniverse.map((object) => [object.objectId, object]))
const authorityOverrides = new Map(
  [...r1.dispositions, ...r2b.records].map((record) => [record.objectId, record]),
)
const canonicalEffects = new Map(
  phase1a.canonicalRecords
    .filter((record) => expected.includes(record.chainId))
    .map((record) => [record.chainId, record]),
)
assert.equal(canonicalEffects.size, 56)

const sources = new Map()
const evidenceErrors = []
function evidence(file, start, end, tokens, purpose) {
  if (!sources.has(file)) sources.set(file, readFileSync(source(file), 'utf8'))
  const lines = sources.get(file).split(/\r?\n/)
  if (!(start >= 1 && end >= start && end <= lines.length)) {
    evidenceErrors.push(`Invalid range: ${file}:${start}-${end}; file length ${lines.length}`)
  }
  const text = lines.slice(start - 1, end).join('\n')
  for (const token of tokens) {
    if (!text.includes(token))
      evidenceErrors.push(`Evidence drift: ${file}:${start}-${end}: ${token}`)
  }
  return {
    FILE: file,
    LINE_START: start,
    LINE_END: end,
    PURPOSE: purpose,
    REQUIRED_SOURCE_TOKENS: tokens,
    RANGE_SHA256: digest(text),
  }
}

const e = (file, start, end, tokens, purpose = 'Exact selected operation and local target path') =>
  evidence(`${ue}${file}`, start, end, tokens, purpose)
const a = (file, start, end, tokens) =>
  evidence(
    `${auth}${file}`,
    start,
    end,
    tokens,
    'Selected shared-auth operation; stop at the unmapped shared schema boundary',
  )
const sym = (file, name) => ({ FILE: `${ue}${file}`, SYMBOL: name })
const sql = (name) => ({ SQL_OBJECT_NAME: name })
const shared = (file, names) =>
  names.map((name) => ({
    FILE: `${auth}${file}`,
    SYMBOL: name,
    UNMAPPED_SHARED_BOUNDARY: true,
  }))
const groups = []
function group(ids, targets, consumed, relationship, extra = {}) {
  groups.push({ ids, targets, consumed, relationship, ...extra })
}

const auditFile = 'lib/audit-logger.ts'
const auditEvidence = e(
  auditFile,
  135,
  183,
  ["import('@/db/schema')", 'db.insert(auditLogs)', 'entry.organizationId'],
  'Explicit domain audit call: conditional database write, not proof that it succeeds',
)
const auditTarget = { ...sym(auditFile, 'auditLogs'), ACCEPTED_DYNAMIC_BARREL: '@/db/schema' }
const auditRelationship =
  'Includes the explicitly called, organization-conditional audit write; no audit completeness or atomicity claim.'
const billing = 'services/platform-economics/billing-service.ts'
const allocation = 'services/platform-economics/allocation-engine.ts'
const correspondence = 'lib/services/correspondence-service.ts'
const metrics = 'lib/ingestion/migration-metrics.ts'
const search = 'lib/knowledge-transfer/search/hybrid-search.ts'
const session = 'password/session.ts'
const password = 'password/auth-service.ts'
const mfa = 'mfa/service.ts'
const passwordAudit = a(password, 126, 148, ['insert(authAuditLog)'])
const sessionCreate = a(session, 56, 94, ['insert(authUserSessions)'])
const sharedReason =
  'The exact queried/modified shared schema symbols are explicit in the selected source path, but @nzila/db/schema has no accepted R2A import mapping and no accepted shared database scope in the frozen census. Equating these symbols to similarly named union-eyes objects would invent a linkage. Reading declarations or rebuilding import/authority resolution is outside R2C. Required next evidence is an accepted shared-schema/object/connection mapping outside this frozen boundary. This is not proof of a missing table, broken runtime, or an external database.'

group(
  ['0001'],
  [
    {
      ...sym('db/queries/profiles-queries.ts', 'profilesTable'),
      ACCEPTED_CENSUS_DIRECT_IMPORT: true,
    },
  ],
  [
    e('db/queries/profiles-queries.ts', 1, 7, ['../schema/profiles-schema', 'profilesTable']),
    e('db/queries/profiles-queries.ts', 65, 78, ['.from(profilesTable)']),
  ],
  'Fixed profiles query target; accepted authority disposition is inherited.',
)
group(
  ['0002', '0003', '0004', '0005'],
  [sym('lib/gdpr/consent-manager.ts', 'cookieConsents')],
  [
    e('lib/gdpr/consent-manager.ts', 150, 210, [
      '.from(cookieConsents)',
      '.update(cookieConsents)',
      '.insert(cookieConsents)',
    ]),
  ],
  'Read-existing, conditional update-or-insert, and readback all address the same object. Accepted DATABASE_INSERT classifications are unchanged.',
)
group(
  ['0006'],
  [...shared(password, ['authUsers', 'authAuditLog']), ...shared(session, ['authUserSessions'])],
  [
    a(password, 170, 243, ['.from(authUsers)', '.insert(authUsers)', 'createSession(']),
    passwordAudit,
    sessionCreate,
  ],
  'Signup user, session, and best-effort audit persistence are distinct intentional targets.',
  { ceiling: sharedReason },
)
group(
  ['0008'],
  [
    ...shared(password, ['authUsers', 'authPasswordResetTokens', 'authAuditLog']),
    ...shared(session, ['authUserSessions']),
  ],
  [
    a(password, 611, 679, [
      '.from(authPasswordResetTokens)',
      '.update(authUsers)',
      'revokeAllUserSessions(',
    ]),
    passwordAudit,
    a(session, 163, 183, ['authUserSessions']),
  ],
  'Reset-token lookup/consumption, password update, session revocation and audit are intentional targets.',
  { ceiling: sharedReason },
)
group(
  ['0010'],
  [
    ...shared(password, [
      'authUsers',
      'authOrganizationUsers',
      'authMfaTotp',
      'authOrgPolicies',
      'authAuditLog',
    ]),
    ...shared(session, ['authUserSessions']),
    ...shared(mfa, ['authMfaChallenges']),
  ],
  [
    a(password, 247, 529, [
      '.from(authUsers)',
      '.from(authOrganizationUsers)',
      '.from(authMfaTotp)',
      '.from(authOrgPolicies)',
      'issueMfaChallenge(',
      'createSession(',
    ]),
    passwordAudit,
    sessionCreate,
    a(mfa, 255, 275, ['insert(authMfaChallenges)']),
  ],
  'Conditional login/session/MFA/audit paths. Observed symbols are not a claim of exhaustive ancillary risk-provider persistence.',
  { ceiling: sharedReason },
)
group(
  ['0013'],
  shared(password, ['authUsers', 'authPasswordResetTokens', 'authAuditLog']),
  [
    a(password, 548, 607, [
      '.from(authUsers)',
      '.update(authPasswordResetTokens)',
      '.insert(authPasswordResetTokens)',
    ]),
    a(password, 155, 164, ['authAuditLog']),
    passwordAudit,
  ],
  'Rate-limit audit read, user lookup, invalidate-old/insert-new reset tokens, and audit.',
  { ceiling: sharedReason },
)
group(
  ['0011'],
  shared('magic-link/service.ts', ['authUsers', 'authMagicLinks', 'authAuditLog']),
  [
    a('magic-link/service.ts', 152, 215, ['.from(authUsers)', '.insert(authMagicLinks)']),
    a('magic-link/service.ts', 87, 107, ['insert(authAuditLog)']),
  ],
  'Magic-link request user lookup, token insert and audit; bounded stop at unmapped shared schema.',
  { ceiling: sharedReason },
)
group(
  ['0018'],
  shared(mfa, ['authMfaTotp', 'authUsers', 'authAuditLog']),
  [
    a(mfa, 195, 229, ['.from(authMfaTotp)', '.update(authMfaTotp)', '.update(authUsers)']),
    a(mfa, 103, 123, ['insert(authAuditLog)']),
  ],
  'Enrollment verification updates TOTP and user state and attempts audit.',
  { ceiling: sharedReason },
)
group(
  ['0019', '0021'],
  shared(mfa, ['authMfaTotp']),
  [a(mfa, 127, 148, ['.from(authMfaTotp)'])],
  'MFA status reads a fixed shared symbol, not a dynamically selected object.',
  { ceiling: sharedReason },
)
group(
  ['0020'],
  shared(mfa, ['authMfaTotp', 'authUsers', 'authAuditLog']),
  [
    a(mfa, 233, 251, ['.update(authMfaTotp)', '.update(authUsers)']),
    a(mfa, 103, 123, ['insert(authAuditLog)']),
  ],
  'Disable TOTP, update user MFA state, and attempt audit.',
  { ceiling: sharedReason },
)

const evidenceIndex = 'packages/os-core/src/evidence/generate-evidence-index.ts'
group(
  ['0029'],
  [
    sym('lib/services/voting-service.ts', 'voterEligibility'),
    sym('lib/services/voting-service.ts', 'votingOptions'),
    sym('lib/services/voting-service.ts', 'votes'),
    ...['documents', 'auditEvents', 'evidencePacks', 'evidencePackArtifacts'].map((name) => ({
      FILE: evidenceIndex,
      SYMBOL: name,
      UNMAPPED_SHARED_BOUNDARY: true,
    })),
  ],
  [
    e('app/api/voting/sessions/[id]/vote/route.ts', 26, 40, [
      'castVote(',
      'buildUnionEvidencePack(',
    ]),
    e('lib/services/voting-service.ts', 356, 373, ['db.query.voterEligibility.findFirst']),
    e('lib/services/voting-service.ts', 463, 525, [
      'db.query.votingOptions.findFirst',
      'db.query.votes.findFirst',
      '.insert(votes)',
    ]),
    e('lib/evidence.ts', 38, 51, ['buildEvidencePackFromAction', 'processEvidencePack']),
    evidence(
      evidenceIndex,
      24,
      33,
      ['@nzila/db/schema', 'documents', 'auditEvents'],
      'Explicit shared metadata/audit schema boundary',
    ),
    evidence(
      evidenceIndex,
      147,
      240,
      ['uploadBuffer(', '.insert(documents)', '.from(auditEvents)', '.insert(auditEvents)'],
      'Reachable artifact upload and metadata/audit writes',
    ),
    evidence(
      evidenceIndex,
      314,
      402,
      [
        'uploadBuffer(',
        '.insert(documents)',
        '.insert(evidencePacks)',
        '.insert(evidencePackArtifacts)',
        '.update(documents)',
      ],
      'Reachable pack index and artifact-link persistence',
    ),
    evidence(
      'packages/blob/src/index.ts',
      17,
      63,
      ['AZURE_STORAGE_ACCOUNT_NAME', 'BlobServiceClient', 'uploadData(opts.buffer'],
      'Minimum uploadBuffer adapter path; no provider call executed',
    ),
  ],
  'Vote eligibility/options/vote are mapped; asynchronous shared evidence-pack metadata remains unmapped. The known Blob boundary does not resolve the relational remainder.',
  {
    ceiling: sharedReason,
    external: [
      {
        PROVIDER: 'Azure Blob Storage',
        STORAGE_BOUNDARY:
          'AZURE_STORAGE_ACCOUNT_NAME endpoint; request.blobContainer or evidence; org/control-family/year/month/pack/artifact and index paths',
        ADAPTER_CLIENT: '@nzila/blob uploadBuffer -> BlobServiceClient -> uploadData',
        DATA_CLASS: 'Evidence artifacts and sealed evidence-pack index JSON',
        ROLE: 'Ancillary intentional persistence alongside relational metadata; not an exclusive external-target disposition',
        RUNTIME_PROVEN: 'NO',
      },
    ],
  },
)
group(
  ['0092', '0370', '0371'],
  [sym(search, 'exitInterviews'), sql('knowledge_base')],
  [
    e(search, 89, 117, ['exitInterviews']),
    e(search, 150, 164, ['FROM knowledge_base', 'exit_interviews']),
    e(search, 204, 223, ['exitInterviews']),
  ],
  'Hybrid search combines exit-interview queries and knowledge-base SQL joined to exit_interviews. Embedding calls do not establish another database target.',
)
group(
  ['0098', '0099'],
  [
    sym('lib/services/dashboard-kpi-service.ts', 'grievances'),
    sym('lib/services/dashboard-kpi-service.ts', 'complianceAlerts'),
    auditTarget,
  ],
  [
    e('lib/services/dashboard-kpi-service.ts', 138, 180, [
      '.from(grievances)',
      '.from(complianceAlerts)',
    ]),
    e('app/api/dashboard/leadership/route.ts', 41, 57, [
      'getLeadershipDashboardMetrics(',
      'emitCapeAuditEvent(',
    ]),
    e('lib/audit/cape-audit-events.ts', 51, 64, ['auditLog(']),
    auditEvidence,
  ],
  `Grievance/compliance aggregation and explicit dashboard-view audit. ${auditRelationship} Cache transport is not inferred as a new relational target.`,
)
group(
  ['0102', '0103', '0104'],
  [sym('lib/ai/steward-copilot.ts', 'aiCopilotSessions'), auditTarget],
  [
    e('app/api/ai/copilot/sessions/[id]/route.ts', 51, 71, [
      'recordCopilotOutcome(',
      'logAiActionTaken(',
    ]),
    e('lib/ai/steward-copilot.ts', 187, 197, ['.update(aiCopilotSessions)']),
    e(auditFile, 287, 313, ['auditLog(', 'organizationId: params.organizationId']),
    auditEvidence,
  ],
  `Session outcome update and the explicitly called AI-action audit. ${auditRelationship}`,
)
group(
  ['0122'],
  [
    sym('lib/services/steward-assignment.ts', 'grievances'),
    sym('lib/services/steward-assignment.ts', 'stewards'),
  ],
  [e('lib/services/steward-assignment.ts', 130, 151, ['.from(grievances)', '.from(stewards)'])],
  'Recommendation reads the grievance and eligible steward pool.',
)
group(
  ['0161', '0162'],
  [
    sym(billing, 'billingAccounts'),
    sym(billing, 'platformInvoices'),
    sym('services/platform-economics/ledger-service.ts', 'platformCostLedgerEntries'),
    sym(allocation, 'chargebackStatements'),
    ...['member_dues_ledger', 'employer_remittances', 'member_arrears', 'organizations'].map(sql),
  ],
  [
    e('app/api/finance/dashboard/route.ts', 32, 49, [
      'getBillingAccount(',
      'getLedgerSummary(',
      'getInvoices(',
      'getChargebacks(',
      'generateDuesAlignmentReport(',
    ]),
    e(billing, 100, 108, ['.from(billingAccounts)']),
    e(billing, 826, 833, ['.from(platformInvoices)']),
    e('services/platform-economics/ledger-service.ts', 224, 260, [
      '.from(platformCostLedgerEntries)',
    ]),
    e(allocation, 490, 510, ['.from(chargebackStatements)']),
    e('services/platform-economics/dues-alignment.ts', 70, 96, [
      'member_dues_ledger',
      'employer_remittances',
      'member_arrears',
    ]),
    e('services/platform-economics/dues-alignment.ts', 123, 150, [
      'organizations',
      'member_dues_ledger',
      'employer_remittances',
      'member_arrears',
    ]),
  ],
  'Dashboard combines billing, invoices, optional period-specific ledger summary, chargebacks and dues alignment. LATERAL is SQL syntax, not an object.',
)
group(
  ['0164'],
  [sym(billing, 'platformInvoices'), sym(billing, 'platformInvoiceLineItems')],
  [e(billing, 835, 850, ['.from(platformInvoices)', '.from(platformInvoiceLineItems)'])],
  'Invoice header with its line items.',
)
group(
  ['0165'],
  [sym(billing, 'billingAccounts'), auditTarget],
  [e(billing, 110, 138, ['.update(billingAccounts)', 'auditLog(']), auditEvidence],
  `Billing account update and explicit audit. ${auditRelationship}`,
)
group(
  ['0166'],
  [sym(billing, 'billingAccounts'), auditTarget],
  [e(billing, 69, 99, ['.insert(billingAccounts)', 'auditLog(']), auditEvidence],
  `Billing account creation and explicit audit. ${auditRelationship}`,
)
group(
  ['0167'],
  [
    ...[
      'allocationRules',
      'allocationRuleVersions',
      'platformCostLedgerEntries',
      'allocationRuns',
      'allocationBasisSnapshots',
      'allocationRunLines',
    ].map((name) => sym(allocation, name)),
    auditTarget,
  ],
  [
    e('app/api/finance/simulation/route.ts', 56, 67, ['runAllocation(', 'isSimulation: true']),
    e(allocation, 122, 178, ['.from(allocationRuleVersions)', '.from(allocationRules)']),
    e(allocation, 185, 377, [
      '!input.isSimulation',
      '.from(platformCostLedgerEntries)',
      'tx.insert(allocationRuns)',
      'tx.insert(allocationBasisSnapshots)',
      'tx.insert(allocationRunLines)',
      'auditLog(',
    ]),
    auditEvidence,
  ],
  `Simulation reads rule ownership/version and ledger input, writes run/basis/lines, and explicitly audits. ${auditRelationship}`,
  {
    exclusions: [
      'Simulation excludes !input.isSimulation billingPeriods validation, ledger insertion/update and chargeback insertion. Route comment is not used to override the accepted DATABASE_INSERT classification.',
    ],
  },
)
group(
  ['0178', '0180'],
  [sym('lib/services/dispatch-engine.ts', 'dispatchRequests')],
  [e('lib/services/dispatch-engine.ts', 109, 122, ['.from(dispatchRequests)'])],
  'Queue filters one fixed dispatch-request object.',
)
group(
  ['0179'],
  [sym('lib/services/dispatch-engine.ts', 'dispatchRequests')],
  [e('lib/services/dispatch-engine.ts', 98, 101, ['.insert(dispatchRequests)'])],
  'Request creation inserts the fixed dispatch-request object.',
)
group(
  ['0181'],
  [sym(correspondence, 'correspondence')],
  [e(correspondence, 278, 292, ['.from(correspondence)'])],
  'Correspondence list query.',
)
group(
  ['0183'],
  [
    ...['correspondence', 'correspondenceRecipients', 'correspondenceAuditTrail'].map((name) =>
      sym(correspondence, name),
    ),
    sym('lib/services/audit-service.ts', 'auditLogs'),
  ],
  [
    e(correspondence, 71, 101, [
      '.from(correspondenceAuditTrail)',
      '.insert(correspondenceAuditTrail)',
    ]),
    e(correspondence, 136, 228, [
      '.from(correspondence)',
      '.insert(correspondence)',
      'db.insert(correspondenceRecipients)',
      'appendAuditEntry(',
      'createAuditLog(',
    ]),
    e('lib/services/audit-service.ts', 46, 56, ['.insert(auditLogs)']),
  ],
  'Reference-number lookup, correspondence header, optional recipients, appendAuditEntry hash-chain and createAuditLog are intentional targets, not ambiguity.',
)
const propagation = [
  e('lib/knowledge-transfer/propagation/index.ts', 1, 10, ['dependency-propagator']),
  e('lib/knowledge-transfer/propagation/dependency-propagator.ts', 42, 71, [
    '.from(exitInterviews)',
    'buildTopicGraph(',
  ]),
  e('lib/knowledge-transfer/topic-graph/topic-graph-builder.ts', 64, 85, ['.from(exitInterviews)']),
]
group(
  ['0184', '0380'],
  [
    sym('lib/knowledge-transfer/propagation/dependency-propagator.ts', 'exitInterviews'),
    sym('lib/knowledge-transfer/topic-graph/topic-graph-builder.ts', 'exitInterviews'),
  ],
  propagation,
  'Propagation map and topic graph read the same accepted exit-interviews object.',
)
group(
  ['0185'],
  [
    sym('lib/knowledge-transfer/simulation/continuity-simulator.ts', 'exitInterviews'),
    sym('lib/knowledge-transfer/propagation/dependency-propagator.ts', 'exitInterviews'),
  ],
  [
    ...propagation,
    e('lib/knowledge-transfer/simulation/continuity-simulator.ts', 37, 70, [
      '.from(exitInterviews)',
      'buildDependencyPropagationMap(',
    ]),
  ],
  'Simulation loads published interviews and computes the propagation graph; no simulation insert is established.',
)
const reports = 'services/clc/compliance-reports.ts'
const logOnly = e(
  'lib/middleware/api-security.ts',
  511,
  521,
  ['logger.info(', 'API_SECURITY_AUDIT'],
  'Endpoint API audit helper is structured logging, not another established database target',
)
group(
  ['0225'],
  [sym(reports, 'perCapitaRemittances'), sym(reports, 'organizations')],
  [
    e(reports, 212, 247, [
      '.from(perCapitaRemittances)',
      'analyzeOrganizationPerformance(',
      'detectComplianceAnomalies(',
    ]),
    e(reports, 456, 479, ['.from(organizations)']),
    e(reports, 776, 831, ['.from(organizations)']),
    logOnly,
  ],
  'Annual report remittances, organization performance and anomaly enrichment. logApiAuditEvent only logs; it does not prove persisted audit.',
)
group(
  ['0226'],
  [sym(reports, 'perCapitaRemittances')],
  [e(reports, 305, 401, ['.from(perCapitaRemittances)']), logOnly],
  'Multi-year selections read the same remittances object for every year; year selection is not target selection.',
)
group(
  ['0237'],
  [sym('app/api/claims/route.ts', 'claims')],
  [
    e('app/api/claims/route.ts', 41, 64, ['table: claims', 'handlers.GET']),
    e('lib/api/crud-factory.ts', 289, 304, ['table,']),
    e('lib/api/crud-factory.ts', 350, 361, ['.from(table)']),
  ],
  'Collection GET generic query parameter table is fixed by route configuration to claims.',
  {
    exclusions: ['Collection POST and its write hooks are not the selected READ chain.'],
  },
)
group(
  ['0238'],
  [...shared(password, ['authUsers']), ...shared(session, ['authUserSessions'])],
  [
    a(password, 687, 711, ['getSessionFromCookie()', '.from(authUsers)']),
    a(session, 101, 145, ['.from(authUserSessions)', '.update(authUserSessions)']),
    a(session, 219, 232, ['getSessionFromCookie', 'validateSession(']),
  ],
  'Auth/me validates and touches the session and reads the user. Accepted READ is retained; the ancillary session touch is explicit.',
  { ceiling: sharedReason },
)
const chatbot = 'lib/ai/chatbot-service.ts'
group(
  ['0249', '0253', '0257'],
  [sym(chatbot, 'chatSessions')],
  [
    e('app/api/chatbot/sessions/route.ts', 69, 77, ['sessionManager.createSession(']),
    e(chatbot, 91, 116, ['.insert(chatSessions)']),
  ],
  'Selected POST creates a fixed chat-session object. Collection GET and message-generation/provider methods are not this INSERT path.',
)
group(
  ['0250'],
  [sym(chatbot, 'chatSessions'), sym(chatbot, 'chatMessages')],
  [
    e('app/api/chatbot/sessions/[sessionId]/messages/route.ts', 19, 25, [
      'chatbotService.getMessages(',
    ]),
    e(chatbot, 121, 129, ['.from(chatSessions)']),
    e(chatbot, 473, 494, ['this.sessionManager.getSession(', '.from(chatMessages)']),
  ],
  'History reads the owning session and its messages; the object pair is intentional, not ambiguity.',
)
group(
  ['0265'],
  [sym('app/api/pilot/apply/route.ts', 'pilotApplications')],
  [
    e('app/api/pilot/apply/route.ts', 28, 40, ['table: pilotApplications']),
    e('lib/api/crud-factory.ts', 289, 304, ['table,']),
    e('lib/api/crud-factory.ts', 350, 361, ['.from(table)']),
  ],
  'Pilot collection GET is fixed by the route factory configuration.',
  {
    exclusions: ['POST CRM synchronization and submission writes are outside this selected READ.'],
  },
)
group(
  ['0294'],
  ['ingestionBatches', 'duplicateGroups', 'dataQualityWarnings'].map((name) => sym(metrics, name)),
  [
    e('app/api/admin/ingest/batches/route.ts', 30, 47, ['listBatches(', 'getMetricsSummary(']),
    e(metrics, 98, 112, ['.from(ingestionBatches)']),
    e(metrics, 206, 234, [
      '.from(ingestionBatches)',
      '.from(duplicateGroups)',
      '.from(dataQualityWarnings)',
    ]),
  ],
  'Paginated batch list and aggregate duplicate/data-quality metrics.',
)
group(
  ['0295', '0297'],
  ['ingestionBatches', 'ingestionRecords', 'dataQualityWarnings'].map((name) => sym(metrics, name)),
  [
    e(metrics, 138, 163, [
      '.from(ingestionBatches)',
      '.from(ingestionRecords)',
      '.from(dataQualityWarnings)',
    ]),
  ],
  'Batch detail combines header, record status and warnings.',
)
group(
  ['0298'],
  shared('invites/service.ts', ['authInvites', 'authAuditLog']),
  [
    a('invites/service.ts', 122, 163, ['.insert(authInvites)', 'logEvent(']),
    a('invites/service.ts', 100, 120, ['insert(authAuditLog)']),
  ],
  'Shared invitation insertion and event audit.',
  { ceiling: sharedReason },
)
const cycle = 'lib/services/billing-cycle-service.ts'
const dues = 'lib/dues-calculation-engine.ts'
const cycleEvidence = [
  e(cycle, 105, 233, ['getActiveMembersForBilling(', 'processMemberBilling(']),
  e(cycle, 238, 277, ['.from(organizationMembers)', '.leftJoin(', 'memberEmployment']),
  e(cycle, 282, 390, ['calculateMemberDues(', 'dryRun', '.insert(duesTransactions)']),
  e(dues, 48, 149, ['.from(memberDuesAssignments)', '.leftJoin(duesRules']),
]
const cycleReads = [
  sym(cycle, 'organizationMembers'),
  sym(cycle, 'memberEmployment'),
  sym(dues, 'memberDuesAssignments'),
  sym(dues, 'duesRules'),
]
group(
  ['0325'],
  cycleReads,
  [
    e('app/api/admin/billing-cycles/preview/route.ts', 78, 90, [
      'generateBillingCycle(',
      'dryRun: true',
    ]),
    ...cycleEvidence,
  ],
  'Forced dry-run preview reads members/employment and dues assignment/rule joins; returns before transaction insertion.',
  {
    exclusions: [
      'duesTransactions insertion and unrelated dues-engine methods are excluded from preview.',
    ],
  },
)
group(
  ['0326'],
  [...cycleReads, sym(cycle, 'duesTransactions')],
  [
    e('app/api/admin/billing-cycles/route.ts', 94, 104, ['generateBillingCycle(', 'dryRun']),
    ...cycleEvidence,
  ],
  'Generation reads billing inputs and inserts dues transactions when not dry-run; dryRun query option does not change the possible target set.',
)
group(
  ['0342'],
  [
    ...shared('policy/admin.ts', ['authOrgPolicies', 'authAuditLog']),
    ...shared('policy/service.ts', ['authOrgPolicies']),
  ],
  [
    a('policy/admin.ts', 73, 138, [
      '.from(authOrgPolicies)',
      '.update(authOrgPolicies)',
      '.insert(authOrgPolicies)',
      '.insert(authAuditLog)',
    ]),
    a('policy/service.ts', 44, 48, ['.from(authOrgPolicies)']),
  ],
  'Policy lookup, update-existing/insert-new, refresh and audit; accepted UPDATE classification is unchanged.',
  { ceiling: sharedReason },
)
const outputs = 'services/platform-economics/finance-outputs.ts'
const exportBranches = {
  master_invoice: [
    'platform_invoices',
    'billing_periods',
    'organizations',
    'platform_invoice_line_items',
  ],
  allocation_statement: [
    'allocation_runs',
    'billing_periods',
    'allocation_run_lines',
    'organizations',
  ],
  chargeback_report: ['chargeback_statements', 'billing_periods', 'organizations'],
  gl_journal: [
    'platform_cost_ledger_entries',
    'cost_centers',
    'gl_account_mappings',
    'chart_of_accounts',
    'audit_logs',
  ],
  evidence_pack: [
    'platform_invoices',
    'billing_periods',
    'organizations',
    'platform_invoice_line_items',
    'allocation_runs',
    'allocation_run_lines',
    'chargeback_statements',
    'platform_cost_ledger_entries',
    'cost_centers',
    'gl_account_mappings',
    'chart_of_accounts',
    'audit_logs',
  ],
}
group(
  ['0350'],
  [...new Set(Object.values(exportBranches).flat())]
    .filter((name) => name !== 'audit_logs')
    .map(sql)
    .concat(auditTarget),
  [
    e('app/api/finance/exports/route.ts', 43, 115, [
      "case 'master_invoice'",
      "case 'allocation_statement'",
      "case 'chargeback_report'",
      "case 'gl_journal'",
      "case 'evidence_pack'",
    ]),
    e(outputs, 168, 241, [
      'platform_invoices',
      'billing_periods',
      'organizations',
      'platform_invoice_line_items',
    ]),
    e(outputs, 247, 312, [
      'allocation_runs',
      'billing_periods',
      'allocation_run_lines',
      'organizations',
    ]),
    e(outputs, 318, 394, ['chargeback_statements', 'billing_periods', 'organizations']),
    e(outputs, 400, 451, [
      'platform_cost_ledger_entries',
      'cost_centers',
      'gl_account_mappings',
      'chart_of_accounts',
      'auditLog(',
    ]),
    e(outputs, 477, 576, [
      'platform_invoices',
      'allocation_runs',
      'chargeback_statements',
      'platform_cost_ledger_entries',
      'exportMasterInvoice(',
      'exportAllocationStatement(',
      'exportChargebackReport(',
      'exportGlJournal(',
    ]),
    auditEvidence,
  ],
  'Closed five-way export dispatch chooses an intentional subset of a bounded target universe; evidence composes the report helpers. Not incompatible target ambiguity.',
  {
    dynamic: {
      PARAMETER: 'Required URL search parameter type; no default',
      BRANCHES: Object.fromEntries(
        Object.entries(exportBranches).map(([key, names]) => [
          key,
          names.map(
            (name) =>
              `union-eyes::${name === 'audit_logs' ? 'audit_security.audit_logs' : `public.${name}`}`,
          ),
        ]),
      ),
      INVALID_VALUE_BEHAVIOR: 'Validation error before an export function is selected',
      AUDIT_CONDITION:
        'GL export, including the evidence composite, attempts organization-conditional audit',
    },
  },
)
group(
  ['0394'],
  [
    sym('app/api/pilot/apply/[id]/route.ts', 'pilotApplications'),
    sym('lib/pilot/pilot-ownership.ts', 'pilotApplications'),
  ],
  [
    e('app/api/pilot/apply/[id]/route.ts', 12, 84, ['table: pilotApplications', 'handlers.PATCH']),
    e('lib/pilot/pilot-ownership.ts', 519, 537, ['.from(pilotApplications)']),
    e('lib/api/crud-factory.ts', 506, 565, ['.from(table)', '.update(table)']),
  ],
  'Pilot ownership read and hook-enabled locked PATCH transaction use the fixed pilotApplications route target. No ownership correctness claim.',
)

assert.deepEqual(evidenceErrors, [], 'Reviewed source slices must match all pinned tokens')
const observedGroups = new Map()
for (const specification of groups) {
  for (const id of specification.ids) {
    const chainId = `UE-B2-CHAIN-${id}`
    assert(!observedGroups.has(chainId), `Duplicate group: ${chainId}`)
    observedGroups.set(chainId, specification)
  }
}
assert.deepEqual([...observedGroups.keys()].sort(), expected)

function lookup(target) {
  if (target.UNMAPPED_SHARED_BOUNDARY) {
    assert.equal(
      r2a.records.filter(
        (r) => r.importer === target.FILE && r.moduleSpecifier.includes('@nzila/db'),
      ).length,
      0,
    )
    return {
      ...target,
      LOOKUP: 'NO_ACCEPTED_SHARED_IMPORT_OR_DATABASE_SCOPE_MAPPING',
      OBJECT_IDS: [],
    }
  }
  if (target.SQL_OBJECT_NAME) {
    const candidates = census.persistenceUniverse.filter(
      (o) => o.databaseScope === 'union-eyes' && o.objectName === target.SQL_OBJECT_NAME,
    )
    assert.equal(candidates.length, 1, `SQL mapping is not unique: ${target.SQL_OBJECT_NAME}`)
    assert.equal(candidates[0].qualifiedName, `public.${target.SQL_OBJECT_NAME}`)
    return {
      ...target,
      LOOKUP: 'UNIQUE_ACCEPTED_UNION_EYES_CENSUS_SQL_OBJECT',
      QUALIFICATION_NOTE:
        'Unqualified source SQL is represented by the unique accepted public object; runtime search_path is unproven.',
      OBJECT_IDS: [candidates[0].objectId],
    }
  }
  if (target.ACCEPTED_CENSUS_DIRECT_IMPORT) {
    const matches = census.persistenceUniverse.flatMap((object) =>
      object.accessReferences
        .filter(
          (reference) =>
            reference.file === target.FILE && reference.symbols.includes(target.SYMBOL),
        )
        .flatMap((reference) =>
          reference.imports.flatMap((edge) =>
            object.declarations
              .filter(
                (declaration) =>
                  declaration.file === edge.resolvedFile &&
                  declaration.exportName === target.SYMBOL,
              )
              .map((declaration) => ({
                OBJECT_ID: object.objectId,
                IMPORTER: reference.file,
                MODULE_SPECIFIER: edge.specifier,
                RESOLVED_MODULE: edge.resolvedFile,
                DECLARATION_FILE: declaration.file,
                DECLARATION_LINE: declaration.line,
                EXPORT_NAME: declaration.exportName,
                EVIDENCE_CLASS: reference.evidenceClass,
              })),
          ),
        ),
    )
    const ids = [...new Set(matches.map((m) => m.OBJECT_ID))]
    assert.equal(ids.length, 1, 'Previously resolved census import must be exact')
    assert(
      r2a.records.some((record) =>
        matches.some((match) => record.resolvedModule === match.RESOLVED_MODULE),
      ),
      'Accepted R2A must corroborate the already resolved module',
    )
    const corroboration = r2a.records.filter((record) =>
      record.importedExports.some(
        (exp) =>
          exp.importedName === target.SYMBOL &&
          exp.linkedSchemaObjects.some((o) => o.objectId === ids[0]),
      ),
    )
    assert(corroboration.length, 'Accepted R2A must independently corroborate the symbol/object')
    return {
      ...target,
      LOOKUP:
        'PREVIOUSLY_RESOLVED_EXACT_CENSUS_IMPORT_WITH_INDEPENDENT_R2A_SYMBOL_OBJECT_CORROBORATION',
      LOOKUP_EVIDENCE: matches,
      INDEPENDENT_R2A_SYMBOL_OBJECT_CORROBORATION: corroboration.map((r) => ({
        IMPORTER: r.importer,
        IMPORT_LINE: r.importLine,
        RESOLVED_MODULE: r.resolvedModule,
      })),
      OBJECT_IDS: ids,
    }
  }
  const matches = r2a.records
    .filter((r) =>
      target.ACCEPTED_DYNAMIC_BARREL
        ? r.moduleSpecifier === target.ACCEPTED_DYNAMIC_BARREL && r.importer.startsWith(ue)
        : r.importer === target.FILE,
    )
    .flatMap((r) =>
      r.importedExports
        .filter((exp) =>
          target.ACCEPTED_DYNAMIC_BARREL
            ? exp.importedName === target.SYMBOL
            : exp.localName === target.SYMBOL,
        )
        .flatMap((exp) =>
          exp.linkedSchemaObjects.map((o) => ({
            OBJECT_ID: o.objectId,
            IMPORTER: r.importer,
            IMPORT_LINE: r.importLine,
            MODULE_SPECIFIER: r.moduleSpecifier,
            RESOLVED_MODULE: r.resolvedModule,
            EXPORT_STATUS: exp.status,
          })),
        ),
    )
  const ids = [...new Set(matches.map((m) => m.OBJECT_ID))].sort()
  assert.equal(ids.length, 1, `Accepted symbol mapping not unique: ${target.FILE} ${target.SYMBOL}`)
  return {
    ...target,
    LOOKUP: target.ACCEPTED_DYNAMIC_BARREL
      ? 'ACCEPTED_R2A_BARREL_EXPORT_FOR_EXPLICIT_DYNAMIC_IMPORT'
      : 'EXACT_ACCEPTED_R2A_IMPORTER_LOCAL_SYMBOL',
    LOOKUP_EVIDENCE: matches
      .sort((a, b) =>
        `${a.IMPORTER}:${a.IMPORT_LINE}`.localeCompare(`${b.IMPORTER}:${b.IMPORT_LINE}`),
      )
      .slice(0, 1),
    OBJECT_IDS: ids,
  }
}

function targetStatus(id) {
  assert(objects.has(id), `Target outside accepted universe: ${id}`)
  const object = objects.get(id)
  const override = authorityOverrides.get(id)
  return {
    OBJECT_ID: id,
    QUALIFIED_NAME: object.qualifiedName,
    DATABASE_SCOPE: object.databaseScope,
    AUTHORITY_STATUS: override?.finalDisposition ?? object.authorityClass,
    AUTHORITY_SOURCE: override
      ? r2b.records.some((r) => r.objectId === id)
        ? 'ACCEPTED_R2B'
        : 'ACCEPTED_R1'
      : 'ACCEPTED_CENSUS',
    DEFECT_IDS:
      override && 'knownDefectId' in override
        ? override.knownDefectId
          ? [override.knownDefectId]
          : []
        : (override?.defectIds ?? []),
    AUTHORITY_RE_ADJUDICATED: 'NO',
    RUNTIME_PROVEN: 'NO',
  }
}

const linkageErrors = []
const groupLinkages = new Map()
for (const specification of groups) {
  const linkages = []
  for (const target of specification.targets) {
    try {
      linkages.push(lookup(target))
    } catch (error) {
      if (error.code !== 'ERR_ASSERTION') throw error
      linkageErrors.push(error)
    }
  }
  groupLinkages.set(specification, linkages)
}
if (linkageErrors.length) {
  throw new AggregateError(
    linkageErrors,
    'Accepted target linkage validation failed; no artifacts written',
  )
}

const dispositions = [
  'RESOLVED_TO_SINGLE_RELATIONAL_OBJECT',
  'RESOLVED_TO_MULTIPLE_RELATIONAL_OBJECTS',
  'RESOLVED_TO_EXTERNAL_PERSISTENCE',
  'RESOLVED_TO_DYNAMIC_RELATIONAL_TARGET_SET',
  'KNOWN_MISSING_PERSISTENCE_TARGET',
  'KNOWN_AMBIGUOUS_PERSISTENCE_TARGET',
  'SOURCE_CEILING_TARGET_UNRESOLVED',
]
const records = selected
  .map((row) => {
    const original = row.phase1aEvidence
    const specification = observedGroups.get(original.chainId)
    assert.equal(
      canonicalEffects.get(original.chainId).primaryDataEffect,
      original.primaryDataEffect,
    )
    const linkages = groupLinkages.get(specification)
    const ids = [...new Set(linkages.flatMap((t) => t.OBJECT_IDS))].sort()
    const unresolved = linkages.filter((t) => t.OBJECT_IDS.length === 0)
    assert.equal(Boolean(specification.ceiling), unresolved.length > 0)
    const statuses = ids.map(targetStatus)
    const disposition = specification.ceiling
      ? 'SOURCE_CEILING_TARGET_UNRESOLVED'
      : specification.dynamic
        ? 'RESOLVED_TO_DYNAMIC_RELATIONAL_TARGET_SET'
        : ids.length === 1
          ? 'RESOLVED_TO_SINGLE_RELATIONAL_OBJECT'
          : 'RESOLVED_TO_MULTIPLE_RELATIONAL_OBJECTS'
    assert(ids.length || specification.ceiling, `No target/disposition: ${original.chainId}`)
    if (specification.dynamic) {
      for (const branchIds of Object.values(specification.dynamic.BRANCHES)) {
        assert(
          branchIds.every((id) => ids.includes(id)),
          'Dynamic branch escapes accepted bounded targets',
        )
      }
    }
    return {
      CHAIN_ID: original.chainId,
      RESIDUAL_ID: row.residualId,
      PRIMARY_DATA_EFFECT: original.primaryDataEffect,
      SOURCE_REFERENCES: original.sourceReferences,
      SOURCE_REFERENCE_COUNT: original.sourceReferences.length,
      SOURCE_PATH_CONSUMED: specification.consumed,
      FINAL_TARGET_DISPOSITION: disposition,
      TARGET_OBJECT_IDS: ids,
      TARGET_QUALIFIED_NAMES: statuses.map((s) => s.QUALIFIED_NAME),
      TARGET_AUTHORITY_STATUSES: statuses,
      TARGET_DEFECT_IDS: [...new Set(statuses.flatMap((s) => s.DEFECT_IDS))].sort(),
      TARGET_LOOKUP_EVIDENCE: linkages,
      UNRESOLVED_TARGET_SYMBOLS: unresolved,
      TARGET_RELATIONSHIP: specification.relationship,
      POSSIBLE_TARGET_OBJECT_IDS: specification.dynamic ? ids : null,
      SELECTION_MECHANISM: specification.dynamic ?? null,
      EXTERNAL_PERSISTENCE_BOUNDARY: specification.external ?? null,
      KNOWN_EFFECT_TARGET_DEFECT_ID: null,
      SOURCE_CEILING_REASON: specification.ceiling ?? null,
      EVIDENCE_PATHS_CONSUMED: specification.consumed,
      WHY_STATIC_SOURCE_CANNOT_RESOLVE_TARGET: specification.ceiling ?? null,
      EXCLUDED_PATHS: specification.exclusions ?? [],
      TARGET_PATH_EXHAUSTED_WITHIN_AUTHORIZED_BOUNDARY: 'YES',
      STATIC_WORK_REMAINING: 0,
      RUNTIME_PROVEN: 'NO',
      PERSISTENCE_RUNTIME_PROVEN: 'NO',
    }
  })
  .sort((a, b) => a.CHAIN_ID.localeCompare(b.CHAIN_ID))

const counts = Object.fromEntries(
  dispositions.map((d) => [d, records.filter((r) => r.FINAL_TARGET_DISPOSITION === d).length]),
)
assert.equal(
  Object.values(counts).reduce((sum, n) => sum + n, 0),
  56,
)
const resolved = records.filter((r) => r.FINAL_TARGET_DISPOSITION.startsWith('RESOLVED_TO_'))
const ceilings = records.filter(
  (r) => r.FINAL_TARGET_DISPOSITION === 'SOURCE_CEILING_TARGET_UNRESOLVED',
)
const targetDefects = records.filter((r) => r.FINAL_TARGET_DISPOSITION.startsWith('KNOWN_'))
assert.equal(resolved.length + ceilings.length + targetDefects.length, 56)
assert(records.every((r) => r.KNOWN_EFFECT_TARGET_DEFECT_ID === null))
assert.equal(targetDefects.length, 0)
const distinctTargets = [...new Set(records.flatMap((r) => r.TARGET_OBJECT_IDS))]
  .sort()
  .map(targetStatus)
const isCeiling = (s) =>
  ['UNKNOWN_SOURCE_CEILING', 'SOURCE_CEILING_UNKNOWN_AUTHORITY'].includes(s.AUTHORITY_STATUS)
const isMirror = (s) =>
  ['ACTIVE_CANONICAL_AUTHORITY_WITH_LEGACY_MIRROR', 'ACTIVE_CANONICAL_WITH_LEGACY_MIRROR'].includes(
    s.AUTHORITY_STATUS,
  )
const classes = [
  'DATABASE_INSERT',
  'DATABASE_UPDATE',
  'DATABASE_DELETE',
  'DATABASE_READ',
  'DATABASE_TRANSACTION',
  'OTHER_ACCEPTED_DATABASE_EFFECT',
]
assert(records.every((r) => classes.includes(r.PRIMARY_DATA_EFFECT)))
const threeDefectObjects = [
  'financial-service::public.customer_acquisition',
  'financial-service::public.mrr_snapshots',
  'financial-service::public.subscription_events',
]
const carriedAuthorityDefects = r2b.records.filter((r) => r.knownDefectId !== null)
assert.deepEqual(carriedAuthorityDefects.map((r) => r.objectId).sort(), threeDefectObjects)
const state = {
  PHASE_1A: 'SOURCE_CEILING_ACCEPTED',
  PHASE_1B_1_R2BN_GATE: 'PASS',
  PHASE_1B_1_R2B_GATE: 'SOURCE_CEILING',
  PHASE_1B_1_R2B: 'SOURCE_CEILING_ACCEPTED',
  PHASE_1B_1_R2C_GATE: ceilings.length ? 'SOURCE_CEILING' : 'PASS',
  PHASE_1B_1: 'SOURCE_CEILING_ACCEPTED',
  CANONICAL_DATA_AUTHORITY_MODEL: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
  DATA_OBJECT_UNIVERSE: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
  IMPORT_RESOLUTION_UNIVERSE: 'CLOSED',
  EFFECT_TARGET_UNIVERSE: ceilings.length ? 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS' : 'CLOSED',
  NO_FURTHER_PHASE_1B_1_STATIC_PASS: 'YES',
  STATIC_WORK_REMAINING: 0,
  PHASE_1B_2_AUTHORIZATION_CENSUS: 'AUTHORIZED',
  PHASE_1B_2_STARTED: 'NO',
  PHASE_1C_STARTED: 'NO',
  PHASE_1D_STARTED: 'NO',
  PHASE_2_STARTED: 'NO',
  RUNTIME_PROVEN: 'NO',
  DATA_RUNTIME_EXISTENCE_PROVEN: 'NO',
  PERSISTENCE_RUNTIME_PROVEN: 'NO',
  AUTHORIZATION_PROVEN: 'NO',
  ORG_SCOPE_ENFORCEMENT_PROVEN: 'NO',
  RLS_CORRECTNESS_PROVEN: 'NO',
  AUDIT_COMPLETENESS_PROVEN: 'NO',
  PRODUCT_READY: 'NO',
}
const result = {
  PHASE: 'PHASE_1B_1_R2C_TARGETLESS_EFFECT_RECONCILIATION',
  METHOD: {
    SELECTOR: 'R2N originClass === TARGETLESS_DATABASE_EFFECT_RESIDUAL',
    SCOPE: 'Exactly the fixed 56 known effects; target identification only',
    SOURCE_READ_POLICY:
      'Reviewed explicit ranges and minimum directly called helpers only; no source glob, import reconstruction, declaration scan, authority re-adjudication or execution of application code',
    STOP_RULE:
      'Stop once target identity is mapped; for shared targets stop at the exhausted accepted import/object-mapping boundary. Observed shared symbols are not an exhaustive ancillary-effect census.',
    REFERENCE_POLICY:
      'Full accepted reference envelopes are preserved. SOURCE_PATH_CONSUMED identifies the slices actually inspected; unrelated guard, provider and off-path references are not claimed as inspected.',
    BOUNDARY_RULE:
      'Target identity and authority proof are independent. Shared packages alone do not prove external persistence. Mixed/partially mapped chains remain exclusive target ceilings.',
    DYNAMIC_IMPORT_RULE:
      'Only the explicit auditLogs dynamic import of @/db/schema uses that same barrel export in accepted R2A metadata from other UE consumers; no importer or barrel source is re-resolved.',
    PREVIOUSLY_RESOLVED_IMPORT_RULE:
      'The profiles-query import was already resolved in the accepted census, so it is not one of R2A residual imports. Its exact importer/symbol/import edge/declaration is inherited from census accessReferences. R2A independently confirms the profilesTable/object identity and the legacy module resolution through other consumers; it does not contain this exact importer record. No import is reconstructed.',
    KNOWN_DEFECT_RULE:
      'No accepted mapping for a shared symbol is a source ceiling, not a known missing implementation. Multiple intentional targets and bounded selection are not ambiguity.',
    GLOBAL_EXCLUSIONS: [
      'Authorization/org-resource enforcement and guard internals are deferred to Phase 1B.2.',
      'No transport/cache-provider internals, unselected handler branches, unrelated service methods or frozen unknown effect chains are investigated.',
      'No table existence, deployment, runtime persistence, authorization, RLS, audit completeness or staging certification is established.',
    ],
  },
  ACCEPTED_INPUT_SHA256: inputs,
  ACCEPTED_R2B_RECORDS_SHA256: digest(JSON.stringify(r2b.records)),
  SCOPE_EXCEPTION_REGISTER: [
    {
      FILE: 'apps/union-eyes/app/api/finance/allocation/run/route.ts',
      EVENT:
        'Rejected guessed simulation-route range was read by the initial manifest token check before the exact recorded simulation route was substituted.',
      USED_FOR_ADJUDICATION: 'NO',
      APPLICATION_FILE_MODIFIED: 'NO',
      NOTE: 'This diagnostic read prevents an unqualified assertion that no unrelated application source was read. It did not open another effect-chain investigation.',
    },
  ],
  REVIEWED_SOURCE_SHA256: Object.fromEntries(
    [...sources].sort(([a], [b]) => a.localeCompare(b)).map(([file, text]) => [file, digest(text)]),
  ),
  PRE_SOURCE_SELECTION_INVENTORY: selected
    .map((row) => ({
      CHAIN_ID: row.phase1aEvidence.chainId,
      PRIMARY_DATA_EFFECT: row.phase1aEvidence.primaryDataEffect,
      REFERENCE_COUNT: row.phase1aEvidence.sourceReferences.length,
      SOURCE_FILES: [
        ...new Set(row.phase1aEvidence.sourceReferences.filter((r) => r.file).map((r) => r.file)),
      ].sort(),
    }))
    .sort((a, b) => a.CHAIN_ID.localeCompare(b.CHAIN_ID)),
  DISPOSITION_COUNTS: counts,
  EXCLUSIVE_ACCOUNTING: {
    INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS: 56,
    CHAINS_WITH_RESOLVED_TARGETS: resolved.length,
    CHAINS_WITH_KNOWN_TARGET_DEFECTS: targetDefects.length,
    CHAINS_WITH_TARGET_SOURCE_CEILING: ceilings.length,
    SUM: 56,
    TARGETS_RESOLVED: resolved.length,
    KNOWN_EFFECT_TARGET_DEFECTS: targetDefects.length,
    SOURCE_CEILING_TARGET_UNRESOLVED: ceilings.length,
    EFFECT_TARGET_STATIC_WORK_REMAINING: 0,
    EQUATION: `56 = ${resolved.length} resolved + ${targetDefects.length} known target defects + ${ceilings.length} target ceilings + 0 remaining`,
  },
  EFFECT_CLASS_DISTRIBUTION: Object.fromEntries(
    classes.map((effect) => [
      effect,
      {
        TOTAL: records.filter((r) => r.PRIMARY_DATA_EFFECT === effect).length,
        DISPOSITIONS: Object.fromEntries(
          dispositions.map((disposition) => [
            disposition,
            records.filter(
              (r) => r.PRIMARY_DATA_EFFECT === effect && r.FINAL_TARGET_DISPOSITION === disposition,
            ).length,
          ]),
        ),
      },
    ]),
  ),
  DISTINCT_RELATIONAL_TARGET_SUMMARY: {
    DISTINCT_RELATIONAL_TARGET_OBJECTS: distinctTargets.length,
    TARGETS_WITH_CANONICAL_AUTHORITY: distinctTargets.filter(
      (s) => s.AUTHORITY_STATUS === 'ACTIVE_CANONICAL_AUTHORITY' || isMirror(s),
    ).length,
    TARGETS_WITH_AUTHORITY_SOURCE_CEILING: distinctTargets.filter(isCeiling).length,
    TARGETS_WITH_KNOWN_AUTHORITY_DEFECT: distinctTargets.filter((s) => s.DEFECT_IDS.length).length,
    TARGETS_WITH_LEGACY_OR_MIRROR_STATUS: distinctTargets.filter(isMirror).length,
    INHERITED_STATUS_DISTRIBUTION: Object.fromEntries(
      [...new Set(distinctTargets.map((s) => s.AUTHORITY_STATUS))]
        .sort()
        .map((status) => [
          status,
          distinctTargets.filter((s) => s.AUTHORITY_STATUS === status).length,
        ]),
    ),
    TOTAL: distinctTargets.length,
    CANONICAL: distinctTargets.filter(
      (s) => s.AUTHORITY_STATUS === 'ACTIVE_CANONICAL_AUTHORITY' || isMirror(s),
    ).length,
    AUTHORITY_SOURCE_CEILING: distinctTargets.filter(isCeiling).length,
    KNOWN_AUTHORITY_DEFECT: distinctTargets.filter((s) => s.DEFECT_IDS.length).length,
    LEGACY_MIRROR: distinctTargets.filter(isMirror).length,
    SCOPE_NOTE:
      'Unique accepted mapped objects across all chains, including partial mappings in target-ceiling records. Mirror count overlaps canonical; authority defect count may overlap ceilings. These are not an exclusive partition of 56 chains.',
    OBJECTS: distinctTargets,
  },
  INHERITED_AUTHORITY_COUNTS: {
    RESOLVED_CHAINS_WITH_AUTHORITY_SOURCE_CEILING: resolved.filter((r) =>
      r.TARGET_AUTHORITY_STATUSES.some(isCeiling),
    ).length,
    RESOLVED_CHAINS_WITH_KNOWN_AUTHORITY_DEFECT: resolved.filter((r) => r.TARGET_DEFECT_IDS.length)
      .length,
    NOTE: 'Exact target resolution never upgrades its inherited authority status.',
  },
  EFFECT_TARGET_DEFECT_REGISTER: [],
  TARGET_SOURCE_CEILING_REGISTER: ceilings.map((r) => ({
    CHAIN_ID: r.CHAIN_ID,
    DISPOSITION: r.FINAL_TARGET_DISPOSITION,
    REASON: r.SOURCE_CEILING_REASON,
    UNRESOLVED_TARGET_SYMBOLS: r.UNRESOLVED_TARGET_SYMBOLS,
    PARTIAL_ACCEPTED_TARGET_OBJECT_IDS: r.TARGET_OBJECT_IDS,
    CONSUMED_EVIDENCE: r.SOURCE_PATH_CONSUMED,
    EVIDENCE_PATHS_CONSUMED: r.SOURCE_PATH_CONSUMED,
    WHY_STATIC_SOURCE_CANNOT_RESOLVE_TARGET: r.SOURCE_CEILING_REASON,
    STATIC_WORK_REMAINING: 0,
    OPEN_ASSURANCE_OBLIGATION: 'YES',
  })),
  CARRY_FORWARD_REGISTERS: {
    AUTHORITY_SOURCE_CEILINGS: r2b.records.map((r) => ({
      OBJECT_ID: r.objectId,
      DISPOSITION: r.finalDisposition,
      DEFECT_IDS: r.knownDefectId ? [r.knownDefectId] : [],
      STATIC_EVIDENCE_EXHAUSTED: 'YES',
      STATIC_AUTHORITY_PROVEN: 'NO',
      RUNTIME_EXISTENCE_PROVEN: 'NO',
    })),
    KNOWN_AUTHORITY_DEFECT_OBJECTS: carriedAuthorityDefects.map((r) => ({
      OBJECT_ID: r.objectId,
      DEFECT_IDS: [r.knownDefectId],
      SOURCE_CEILING_UNKNOWN_AUTHORITY: 'YES',
      KNOWN_DEFECT: 'YES',
      REGISTER_REFERENCE: `${directory}PHASE_1B_1_R2B_AUTHORITY_OBJECT_CLOSEOUT.json`,
    })),
    KNOWN_IMPORT_EXPORT_DEFECTS: r2a.records
      .filter((r) => r.disposition === 'KNOWN_MISSING_NAMED_EXPORT')
      .map((r) => ({
        IMPORTER: r.importer,
        IMPORT_LINE: r.importLine,
        DISPOSITION: r.disposition,
      })),
    EFFECT_TARGET_SOURCE_CEILINGS: ceilings.map((r) => r.CHAIN_ID),
    NEW_EFFECT_TARGET_DEFECTS: [],
    FROZEN_PHASE_1A_UNKNOWN_EFFECT_CHAINS: {
      COUNT: 247,
      DISPOSITION: 'FROZEN_SOURCE_CEILING_NOT_REOPENED',
      NOTE: 'Separate inherited register reference; not part of the 56 targetless known effects.',
      REGISTER_REFERENCE: `${directory}PHASE_1B_1_R2N_DENOMINATOR_AND_CEILING_AUDIT.json`,
    },
  },
  STATIC_WORK_ACCOUNTING: {
    STATIC_WORK_BEFORE_R2B: 263,
    STATIC_WORK_BEFORE_R2C: 56,
    AUTHORITY_STATIC_WORK_BEFORE_R2B: 207,
    AUTHORITY_STATIC_WORK_AFTER_R2B: 0,
    TARGETLESS_EFFECT_STATIC_WORK_BEFORE_R2C: 56,
    TARGETLESS_EFFECTS_ADJUDICATED: 56,
    TARGETLESS_EFFECT_STATIC_WORK_AFTER_R2C: 0,
    TARGETLESS_EFFECT_STATIC_WORK_AFTER: 0,
    AUTHORITY_SOURCE_CEILING_CARRY_FORWARD: 207,
    AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD: 3,
    EFFECT_TARGET_SOURCE_CEILING_CARRY_FORWARD: ceilings.length,
    NEW_EFFECT_TARGET_DEFECT_CARRY_FORWARD: 0,
    TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD: ceilings.length,
    TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD: 0,
    FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD: 247,
    STATIC_WORK_AFTER_R2C: 0,
  },
  PRESERVATION_ASSERTIONS: {
    R1_FINANCIAL_SERVICE_KNOWN_CONFLICTS: 4,
    R1_UNION_EYES_CANONICAL_WITH_LEGACY_MIRROR: 1,
    R2A_INPUT_IMPORTS: 966,
    R2A_IMPORT_STATIC_WORK_REMAINING: 0,
    R2B_RECORDS: 207,
    R2B_UNIQUE_RECORD_IDS: 207,
    R2B_SOURCE_CEILINGS: 207,
    R2B_KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS: 3,
    R2N_FROZEN_PHASE1A_UNKNOWN_EFFECT_CHAINS: 247,
    ACCEPTED_ARTIFACTS_MODIFIED: 'NO',
    AUTHORITY_IMPORT_RE_ADJUDICATION: 'NO',
    UNSELECTED_APPLICATION_SOURCE_INVESTIGATED: 'NO',
    UNRELATED_APPLICATION_SOURCE_READ: 'YES_DIAGNOSTIC_ONLY_SEE_SCOPE_EXCEPTION_REGISTER',
    SCOPE_COMPLIANCE: 'DIAGNOSTIC_READ_EXCEPTION_REQUIRES_REVIEW',
    FROZEN_PHASE1A_UNKNOWN_EFFECTS_TOUCHED: 0,
    R2B_AUTHORITY_OBJECTS_READJUDICATED: 0,
    R2A_IMPORTS_REOPENED: 0,
    R1_FIXED_FIVE_REOPENED: 0,
    RUNTIME_DB_INSPECTED: 'NO',
    MIGRATION_EXECUTED: 'NO',
    DATABASE_WRITE_EXECUTED: 'NO',
    PRODUCT_REPAIR: 'NO',
    PR_CREATED: 'NO',
  },
  STATE: state,
  records,
}
assert.equal(result.CARRY_FORWARD_REGISTERS.KNOWN_IMPORT_EXPORT_DEFECTS.length, 2)
for (const record of records) {
  const original = selected.find(
    (r) => r.phase1aEvidence.chainId === record.CHAIN_ID,
  ).phase1aEvidence
  assert.deepEqual(record.SOURCE_REFERENCES, original.sourceReferences)
  assert.equal(record.PRIMARY_DATA_EFFECT, original.primaryDataEffect)
}
assert.equal(new Set(records.map((r) => r.CHAIN_ID)).size, 56)

function render() {
  const lines = [
    '# Phase 1B.1-R2C - Targetless database-effect closeout',
    '',
    'Bounded, source-only target reconciliation. This report does not prove runtime existence, successful writes, canonical authority, authorization/RLS correctness, audit completeness, staging certification, or product readiness.',
    '',
    '## Gate and phase state',
    '',
    '```text',
    ...Object.entries(state).map(([key, value]) => `${key} = ${value}`),
    '```',
    '',
    '## Exact selection, before source inspection',
    '',
    'The 56-ID inventory was returned and reviewed before the selected source paths were inspected. Reference counts include metadata-only references without a file. The JSON preserves the complete original envelopes.',
    '',
    '| Chain ID | Accepted effect | References | Recorded source files |',
    '| --- | --- | ---: | --- |',
    ...result.PRE_SOURCE_SELECTION_INVENTORY.map(
      (r) =>
        `| ${r.CHAIN_ID} | ${r.PRIMARY_DATA_EFFECT} | ${r.REFERENCE_COUNT} | ${r.SOURCE_FILES.map((f) => `\`${f}\``).join('<br>')} |`,
    ),
    '',
    '## Exclusive dispositions',
    '',
    '| Disposition | Chains |',
    '| --- | ---: |',
    ...Object.entries(counts).map(([key, n]) => `| ${key} | ${n} |`),
    '',
    result.EXCLUSIVE_ACCOUNTING.EQUATION,
    '',
    'A resolved target can retain an authority source ceiling. Multiple intentional objects are not ambiguity. Conditional selection among a closed set is a dynamic target set. The shared-symbol linkage gap is not a known missing implementation or proof of an external database.',
    '',
    '## Effect-class accounting',
    '',
    '| Accepted effect | Total | Resolved | Target defects | Target ceilings |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...classes.map((effect) => {
      const subset = records.filter((r) => r.PRIMARY_DATA_EFFECT === effect)
      return `| ${effect} | ${subset.length} | ${subset.filter((r) => r.FINAL_TARGET_DISPOSITION.startsWith('RESOLVED_TO_')).length} | ${subset.filter((r) => r.FINAL_TARGET_DISPOSITION.startsWith('KNOWN_')).length} | ${subset.filter((r) => r.FINAL_TARGET_DISPOSITION === 'SOURCE_CEILING_TARGET_UNRESOLVED').length} |`
    }),
    '',
    '| Accepted effect | Final target disposition | Chains |',
    '| --- | --- | ---: |',
    ...classes.flatMap((effect) =>
      dispositions.map(
        (disposition) =>
          `| ${effect} | ${disposition} | ${result.EFFECT_CLASS_DISTRIBUTION[effect].DISPOSITIONS[disposition]} |`,
      ),
    ),
    '',
    '## Distinct mapped relational targets',
    '',
    `- Distinct objects: ${distinctTargets.length}.`,
    `- Canonical (including accepted mirrors): ${result.DISTINCT_RELATIONAL_TARGET_SUMMARY.CANONICAL}.`,
    `- Inherited authority source ceilings: ${result.DISTINCT_RELATIONAL_TARGET_SUMMARY.AUTHORITY_SOURCE_CEILING}.`,
    `- Known authority defect objects among mapped targets: ${result.DISTINCT_RELATIONAL_TARGET_SUMMARY.KNOWN_AUTHORITY_DEFECT}.`,
    `- Legacy mirrors: ${result.DISTINCT_RELATIONAL_TARGET_SUMMARY.LEGACY_MIRROR} (overlaps canonical).`,
    `- Full inherited-status distribution: ${JSON.stringify(result.DISTINCT_RELATIONAL_TARGET_SUMMARY.INHERITED_STATUS_DISTRIBUTION)}. This preserves census conflicts without assigning new authority dispositions or defect IDs.`,
    `- Resolved chains touching authority ceilings: ${result.INHERITED_AUTHORITY_COUNTS.RESOLVED_CHAINS_WITH_AUTHORITY_SOURCE_CEILING}.`,
    '',
    result.DISTINCT_RELATIONAL_TARGET_SUMMARY.SCOPE_NOTE,
    '',
    '| Object ID | Inherited authority | Source | Defects |',
    '| --- | --- | --- | --- |',
    ...distinctTargets.map(
      (s) =>
        `| ${s.OBJECT_ID} | ${s.AUTHORITY_STATUS} | ${s.AUTHORITY_SOURCE} | ${s.DEFECT_IDS.join(', ') || 'None'} |`,
    ),
    '',
    '## Per-chain closeout',
    '',
  ]
  for (const record of records) {
    lines.push(
      `### ${record.CHAIN_ID}`,
      '',
      `- Accepted effect: \`${record.PRIMARY_DATA_EFFECT}\`.`,
      `- Final target disposition: \`${record.FINAL_TARGET_DISPOSITION}\`.`,
      `- Accepted object IDs: ${record.TARGET_OBJECT_IDS.map((id) => `\`${id}\``).join(', ') || 'None; shared target linkage remains a bounded ceiling'}.`,
      `- Target relationship: ${record.TARGET_RELATIONSHIP}`,
      '- Runtime and persistence-runtime proven: NO. Static target work remaining: 0.',
      '- Known new target defect: none.',
    )
    if (record.SOURCE_CEILING_REASON)
      lines.push(
        `- Source-ceiling reason: ${record.SOURCE_CEILING_REASON}`,
        `- Observed unmapped symbols: ${record.UNRESOLVED_TARGET_SYMBOLS.map((t) => `\`${t.FILE}::${t.SYMBOL}\``).join(', ')}.`,
      )
    if (record.SELECTION_MECHANISM)
      lines.push(`- Selection mechanism: ${JSON.stringify(record.SELECTION_MECHANISM)}`)
    if (record.EXTERNAL_PERSISTENCE_BOUNDARY)
      lines.push(
        `- Explicit ancillary external boundary: ${JSON.stringify(record.EXTERNAL_PERSISTENCE_BOUNDARY)}`,
      )
    for (const note of record.EXCLUDED_PATHS) lines.push(`- Excluded branch: ${note}`)
    lines.push(
      '',
      '| Consumed source slice | Purpose |',
      '| --- | --- |',
      ...record.SOURCE_PATH_CONSUMED.map(
        (r) => `| \`${r.FILE}:${r.LINE_START}-${r.LINE_END}\` | ${r.PURPOSE} |`,
      ),
      '',
    )
  }
  lines.push(
    '## Carry-forward registers and static-work accounting',
    '',
    '- 207 accepted R2B authority ceilings remain open assurance obligations, not unfinished static work.',
    '- Three R2B configured-schema discrepancy objects retain both SOURCE_CEILING_UNKNOWN_AUTHORITY and KNOWN_DEFECT:',
    ...threeDefectObjects.map(
      (id) => `  - \`${id}\` - \`R2B-DEFECT-FINANCIAL-CONFIG-SCHEMA-EXCLUSION\`.`,
    ),
    `- ${ceilings.length} target ceilings: ${ceilings.map((r) => `\`${r.CHAIN_ID}\``).join(', ')}.`,
    '- New effect-target defects: 0; no duplicate authority/import defects are opened.',
    '- R2A: 966 records preserved; two missing-export defects carried forward; zero import static work.',
    '- R1: four financial-service conflicts and one Union Eyes canonical-with-legacy-mirror disposition preserved.',
    '- 247 frozen Phase 1A unknown-effect chains remain excluded, unchanged, and separately carried forward.',
    '- Static work: 263 before R2B = 207 authority + 56 targetless effects; 56 before R2C; 0 after R2C.',
    '',
    'All carry-forward entries and the exact consumed target-ceiling paths appear in the JSON registers. No source ceiling implies that an object is absent, unused, invalid, or runtime-broken.',
    '',
    '## Scope and determinism',
    '',
    result.METHOD.SOURCE_READ_POLICY,
    '',
    result.METHOD.STOP_RULE,
    '',
    result.METHOD.REFERENCE_POLICY,
    '',
    result.METHOD.DYNAMIC_IMPORT_RULE,
    '',
    result.METHOD.PREVIOUSLY_RESOLVED_IMPORT_RULE,
    '',
    'Scope exception: the first manifest token-check read a rejected guessed allocation/run route range before binding to the recorded simulation route. That rejected candidate contributed no adjudication evidence. No other chain was investigated, but an unqualified assertion of zero unrelated application-source reads is not made.',
    '',
    'Accepted artifact byte hashes, the preserved R2B record-array hash, reviewed source hashes, required source tokens and slice hashes are recorded in JSON. Regeneration refuses accepted-input or reviewed-source drift relative to an existing closeout. No timestamps, environment inspection, database client loading, application-code execution or nondeterministic IDs are used.',
    '',
    '## Validation and handoff',
    '',
    '```text',
    'node --check scripts/ue/reconcile-r2c-targetless-effects.mjs',
    'node scripts/ue/reconcile-r2c-targetless-effects.mjs',
    'node scripts/ue/reconcile-r2c-targetless-effects.mjs --check',
    'pnpm exec prettier --check scripts/ue/reconcile-r2c-targetless-effects.mjs docs/union-eyes/reality-remediation/PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT.json docs/union-eyes/reality-remediation/PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT.md',
    'pnpm validate:docs',
    '```',
    '',
    'Execution results are reported in the task handoff, not asserted by this generated document. Exact-once selection, unchanged effects/reference envelopes, accepted object membership, inherited authority, exclusive disposition arithmetic, dynamic-branch membership and carry-forward arithmetic are generator assertions.',
    '',
    'Phase 1B.1 static data-authority analysis is closed with explicit source ceilings. Phase 1B.2 authorization/org/resource enforcement census is AUTHORIZED but NOT STARTED. No later phase, product repair, migration, runtime DB inspection/write, or PR creation is performed.',
  )
  return `${lines.join('\n')}\n`
}

let previous
try {
  previous = JSON.parse(readFileSync(source(jsonFile), 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
if (previous) {
  assert.deepEqual(
    result.ACCEPTED_INPUT_SHA256,
    previous.ACCEPTED_INPUT_SHA256,
    'Accepted inputs changed; do not re-adjudicate',
  )
  assert.deepEqual(
    result.REVIEWED_SOURCE_SHA256,
    previous.REVIEWED_SOURCE_SHA256,
    'Reviewed source drift; regeneration must not invent new evidence',
  )
}
const json = await format(`${JSON.stringify(result, null, 2)}\n`, {
  ...((await resolveConfig(source(jsonFile))) ?? {}),
  filepath: source(jsonFile),
  parser: 'json',
})
const markdown = await format(render(), {
  ...((await resolveConfig(source(markdownFile))) ?? {}),
  filepath: source(markdownFile),
  parser: 'markdown',
})
const check = process.argv.includes('--check')
assert(
  process.argv.slice(2).every((arg) => arg === '--check'),
  'Only --check is supported',
)
if (check) {
  assert.equal(
    readFileSync(source(jsonFile), 'utf8'),
    json,
    'JSON differs from deterministic regeneration',
  )
  assert.equal(
    readFileSync(source(markdownFile), 'utf8'),
    markdown,
    'Markdown differs from deterministic regeneration',
  )
} else {
  writeFileSync(source(jsonFile), json)
  writeFileSync(source(markdownFile), markdown)
}
console.log(
  JSON.stringify(
    {
      mode: check ? 'check' : 'generate',
      dispositionCounts: counts,
      exclusiveAccounting: result.EXCLUSIVE_ACCOUNTING,
      distinctTargets: Object.fromEntries(
        Object.entries(result.DISTINCT_RELATIONAL_TARGET_SUMMARY).filter(
          ([key]) => key !== 'OBJECTS',
        ),
      ),
      state,
    },
    null,
    2,
  ),
)
