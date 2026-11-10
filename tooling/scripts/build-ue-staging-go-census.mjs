#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))

const ENGINEERING_BASELINE_SHA = 'e87e3799f3cd9a2408f75d846bc5ec676dae3847'
const GENERATED_ON = '2026-11-10'
const STAGING_CANDIDATE_SHA = '2eb48a0e8bb41be5dca3cb08c57c294f0327d8f9'
const STAGING_WORKFLOW_SHA = 'd43a640e5a2a2e88b7e61986360aa5b6f87cedc4'
const outputDirectory = path.join(root, 'docs/union-eyes/staging')

const register = readJson('docs/union-eyes/convergence/remediation/ue-all-777-remediation-register.json')
const elimination = readJson('docs/union-eyes/convergence/remediation/ue-gate0-defect-elimination.json')
const reconciliation = readJson('docs/union-eyes/convergence/remediation/ue-gate0-accounting-reconciliation.json')
const matrix = readJson('docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json')
const batches = readJson('docs/union-eyes/convergence/remediation/elimination-batches.json')
const evidenceReconciliationBatch = batches.batches.find(batch => batch.id === 'B172-STAGING-CENSUS-EARLIER-RUN-EVIDENCE-RECONCILIATION')
const earlierCreditById = new Map(reconciliation.earlierRunCredits.map(item => [item.defectId, item]))

const capabilityById = new Map(matrix.capabilities.map(capability => [capability.id, capability]))
const personasByCapability = new Map()
for (const action of matrix.personaActions) {
  const actions = personasByCapability.get(action.capabilityId) ?? []
  actions.push({ persona: action.persona, actionId: action.actionId, mandatory: action.mandatory })
  personasByCapability.set(action.capabilityId, actions)
}

const uniqueSorted = values => [...new Set(values.filter(Boolean))].sort()
const isTestFile = file => /(?:__tests__|\.test\.|\.spec\.)/.test(file)
const runtimeClass = record => {
  const value = `${record.defectId} ${record.title}`.toLowerCase()
  if (/(tenant|cross-org|cross-organization|rls|organization_id|authority|mandate|platform|hierarch|permission|role|membership|auth)/.test(value)) return 'IDENTITY_AUTHORITY_TENANT_ISOLATION'
  if (/(billing|dues|payment|invoice|financial|settlement|per-capita|remittance)/.test(value)) return 'FINANCIAL_SAFETY'
  if (/(audit|history|event|provenance|evidence)/.test(value)) return 'AUDIT_AND_EVIDENCE_PERSISTENCE'
  if (/(document|attachment|download|upload|export|privacy|consent|legal|counsel)/.test(value)) return 'DOCUMENT_PRIVACY_LEGAL_CONTROL'
  if (/(worker|job|queue|retry|lease|reminder|deadline|notification|email|sms)/.test(value)) return 'BACKGROUND_WORKER_AND_DELIVERY'
  if (/(route|api|page|navigation|browser|redirect|ui|form)/.test(value)) return 'DEPLOYED_HTTP_AND_PERSONA_JOURNEY'
  return 'DEPLOYED_BEHAVIORAL_QUALIFICATION'
}

const defects = register.records.map(record => {
  const ledger = elimination.entries[record.defectId]
  const earlierCredit = earlierCreditById.get(record.defectId)
  if ((!ledger || ledger.status !== 'IMPLEMENTED_PENDING_QUALIFICATION') && !earlierCredit) {
    throw new Error(`Defect is not source-implemented in the elimination ledger: ${record.defectId}`)
  }
  const capability = capabilityById.get(record.ownerCapabilityId)
  const correctionFiles = uniqueSorted([
    ...(ledger?.files ?? []),
    ...(earlierCredit?.files ?? []),
    ...String(record.engineeringCorrection?.path ?? '').split(';').map(value => value.trim()),
    ...String(earlierCredit?.regressionTest ?? '').split(';').map(value => value.trim()),
  ])
  const personaActions = (personasByCapability.get(record.ownerCapabilityId) ?? [])
    .sort((a, b) => `${a.persona}:${a.actionId}`.localeCompare(`${b.persona}:${b.actionId}`))
  const history = ledger?.history ?? []
  const evidenceCommits = uniqueSorted([...history.map(item => item.evidenceCommit), earlierCredit?.sourceCommit])
  return {
    defectId: record.defectId,
    frozenTranche: record.frozenTranche,
    gate: record.gate,
    severity: record.severity,
    ownerCapabilityId: record.ownerCapabilityId,
    title: record.title,
    sourceImplementation: {
      state: 'IMPLEMENTED_PENDING_QUALIFICATION',
      batch: ledger?.status === 'IMPLEMENTED_PENDING_QUALIFICATION' ? ledger.batch : earlierCredit.batch,
      files: correctionFiles.filter(file => !isTestFile(file)),
      tests: correctionFiles.filter(isTestFile),
      explanation: ledger?.status === 'IMPLEMENTED_PENDING_QUALIFICATION'
        ? ledger.explanation
        : record.engineeringCorrection?.explanation,
      evidenceCommits,
      engineeringBaselineSha: ENGINEERING_BASELINE_SHA,
    },
    acceptance: {
      expectedBehavior: `The frozen failure mechanism is absent as recorded by ${ledger?.status === 'IMPLEMENTED_PENDING_QUALIFICATION' ? ledger.batch : (earlierCredit.batch ?? 'an earlier-run source credit')}; deployed qualification must verify the corrected behavior without weakening direct-scoped authority or fail-closed boundaries.`,
      runtimeEvidenceClass: runtimeClass(record),
      stagingBlockingClassification: 'STAGING_BLOCKING_UNTIL_DEPLOYED_QUALIFICATION',
      qualificationStatus: 'SOURCE_IMPLEMENTED_EXACT_SHA_CI_BASELINE_PASS_RUNTIME_NOT_PROVEN',
      formallyClosed: false,
    },
    personas: personaActions.length > 0 ? personaActions : [{ mapping: 'NO_DIRECT_PERSONA_MAPPING_IN_FROZEN_MATRIX' }],
    securityPrivacy: {
      privacyClassification: capability?.privacyClassification ?? 'NOT_CLASSIFIED_IN_FROZEN_CAPABILITY_MATRIX',
      negativeAndRecovery: capability?.negativeAndRecovery ?? 'Fail closed; do not claim success without persisted evidence.',
      issue1116Rule: 'DIRECT_SPECIFIC_AUTHORITY_NO_PLATFORM_OR_HIERARCHY_TENANT_CONTENT_BYPASS',
    },
    institutionalAuthorization: {
      defectRecord: record.institutionalAcceptance,
      currentState: 'NOT_INFERRED_FROM_ENGINEERING_OR_SECURITY_LABEL',
    },
  }
})

const earlierRunCredits = reconciliation.earlierRunCredits.map(item => ({
  defectId: item.defectId,
  independentRegressionEvidence: item.hasIndependentRegressionEvidence,
  batch: item.batch,
  sourceCommit: item.sourceCommit,
  regressionTest: item.regressionTest,
}))
const creditsMissingIndependentEvidence = earlierRunCredits.filter(item => !item.independentRegressionEvidence)

const census = {
  schemaVersion: 1,
  record: 'UE_GATE0_QUALIFICATION_CENSUS',
  mandateId: 'UE-GATE0-TO-STAGING-GO-20261109',
  generatedOn: GENERATED_ON,
  engineeringBaselineSha: ENGINEERING_BASELINE_SHA,
  frozenPopulation: defects.length,
  authorityRule: {
    source: 'https://github.com/anungis437/nzila-os/issues/1116',
    state: 'OPEN_P0_ENGINEERING_REMEDIATION_REQUIRED',
    rule: 'Platform administrator identity and organization hierarchy alone do not authorize tenant content or financial reads or mutations. Direct organization authority or an explicit live scoped instrument is required and must be enforced by server and database controls.',
  },
  summary: {
    sourceImplemented: defects.length,
    partial: 0,
    untouched: 0,
    engineeringOutstanding: 0,
    independentlyQualificationVerified: 0,
    formallyClosed: 0,
    directLedgerEvidence: elimination.totals.implementedPendingQualification,
    creditedByEarlierRuns: reconciliation.totals.creditedByEarlierRuns,
    earlierRunCreditsWithIndependentRegressionEvidence: reconciliation.totals.earlierRunCreditsWithIndependentRegressionEvidence,
    earlierRunCreditsWithoutIndependentRegressionEvidence: creditsMissingIndependentEvidence.length,
    earlierRunEvidenceGapsResolvedInB172: evidenceReconciliationBatch?.items.length ?? 0,
    traceabilityOnlyBatchLabelDifferences: reconciliation.batchLabelDifferences.length,
  },
  reconciliation: {
    consistent: reconciliation.consistent,
    auxiliaryLedgerPartial: elimination.totals.partial,
    evidenceGapResolution: {
      batch: evidenceReconciliationBatch?.id,
      resolvedCount: evidenceReconciliationBatch?.items.length ?? 0,
      defectIds: evidenceReconciliationBatch?.items.map(item => item.prefix) ?? [],
      focusedReplay: '25 test files passed; 238 tests passed; 1 native-only file and 13 environment-gated cases skipped. This is source regression evidence, not deployed qualification.',
    },
    earlierRunCredits,
    creditsMissingIndependentEvidence,
    batchLabelDifferences: reconciliation.batchLabelDifferences.map(item => ({
      defectId: item.defectId,
      overlayBatch: item.overlayBatch,
      ledgerBatch: item.ledgerBatch,
      classification: 'TRACEABILITY_ONLY_NO_DOUBLE_COUNT',
    })),
  },
  defects,
}

const contract = {
  schemaVersion: 1,
  record: 'UE_STAGING_GO_CONTRACT',
  mandateId: 'UE-GATE0-TO-STAGING-GO-20261109',
  generatedOn: GENERATED_ON,
  engineeringBaselineSha: ENGINEERING_BASELINE_SHA,
  acceptedStagingCandidateSha: STAGING_CANDIDATE_SHA,
  stagingWorkflowDefinitionSha: STAGING_WORKFLOW_SHA,
  verdict: 'STAGING_NO_GO',
  verdictReason: 'The source baseline and staging foundation are complete, but Azure currently limits Canada Central to the existing production Container Apps environment. The isolated staging environment cannot be previewed or deployed until Microsoft raises ManagedEnvironmentCount from 1 to 2; the staging change record also still requires independent approval. No real deployed Phase 3A evidence exists.',
  decisionAuthority: {
    role: 'NZILA_OWNER_OR_AUTHORIZED_PLATFORM_REVIEWER',
    acceptanceRecorded: false,
  },
  boundaries: {
    stagingOnly: true,
    productionAuthorized: false,
    mergeAuthorizedByThisContract: false,
    institutionalPowersInferred: false,
  },
  localValidation: {
    focusedRemediation: 'PASS — 7 files, 65 tests',
    earlierRunEvidenceReplay: 'PASS — 25 files, 238 tests; 1 native-only file and 13 environment-gated cases skipped',
    accountingAndProvenance: 'PASS — 2 files, 10 tests',
    censusContract: 'PASS — 3 tests',
    holisticRegression: {
      status: 'ENVIRONMENT_HOLD',
      passedFiles: 3273,
      passedTests: 49052,
      skippedFiles: 116,
      skippedTests: 1682,
      failedFiles: 2,
      failedTests: 13,
      failures: [
        'contract-tests/civic-oci-doctrine-integrity.test.ts — 10 unrelated civic authorization/filesystem-context fixture failures',
        'scripts/bootstrap-v2/local-vault-fixture.test.ts — 3 fixtures could not import the host Python cryptography package',
      ],
      unionEyesAccountingAuthorityOrCensusFailure: false,
    },
  },
  passRule: 'Every REQUIRED criterion must be PASS from real deployed evidence on the accepted staging revision; synthetic, local, source-only, or historical evidence cannot satisfy a runtime criterion.',
  criteria: [
    ['CANDIDATE_IDENTITY', 'PASS', `Engineering baseline ${ENGINEERING_BASELINE_SHA}, staging image/source ${STAGING_CANDIDATE_SHA}, and workflow definition ${STAGING_WORKFLOW_SHA} are unambiguous and contained on main.`],
    ['SOURCE_ENGINEERING', 'PASS', 'Frozen 777 population is source implemented with zero partial, untouched, or engineering-outstanding entries.'],
    ['LOCAL_HOLISTIC_REGRESSION', 'ENVIRONMENT_HOLD', '49,052 tests passed; 13 failures are confined to an unrelated civic filesystem/authorization fixture and a missing host Python cryptography package. Exact-SHA CI remains authoritative.'],
    ['FINAL_CANDIDATE_CI', 'PASS', 'PR #1155 validated the staging candidate with 103 passing and 11 intentionally skipped checks; PR #1157 validated the final read-only what-if workflow correction with 102 passing and 11 intentionally skipped checks.'],
    ['AUTHORIZED_STAGING_DEPLOYMENT', 'EXTERNAL_HOLD', 'The candidate, protected GitHub environments, OIDC identities, least-privilege roles, and digest-pinned images exist. Azure what-if run 42745600190 passed all repository, identity, subscription, and registry attestations, then failed provider preflight because Canada Central ManagedEnvironmentCount is limit 1 / usage 1. CHG-2026-0114 also remains pending independent approval.'],
    ['DEPLOYED_REVISION_IDENTITY', 'NOT_PROVEN', 'No staging revision running this candidate is identified.'],
    ['DATABASE_MIGRATIONS', 'NOT_PROVEN', 'No real candidate-bound staging migration receipt exists.'],
    ['ENTRA_AUTHENTICATED_SESSIONS', 'NOT_PROVEN', 'No real staging Entra/session acceptance exists for this candidate.'],
    ['API_AND_POSTGRES_TENANT_ISOLATION', 'NOT_PROVEN', 'No candidate-bound real staging API plus native PostgreSQL isolation proof exists.'],
    ['BUSINESS_WORKFLOWS_AND_PERSONAS', 'NOT_PROVEN', 'Credentialed staging persona journeys are not recorded.'],
    ['WORKERS_RETRIES_AND_DELIVERY', 'NOT_PROVEN', 'No real worker lease/recovery and successor reminder delivery receipts exist.'],
    ['AUDIT_AND_TELEMETRY', 'NOT_PROVEN', 'No candidate-bound live audit persistence and Azure Monitor/OpenTelemetry evidence exists.'],
    ['DOCUMENT_REVOCATION_PRIVACY_FINANCE', 'NOT_PROVEN', 'Deployed revocation, privacy/legal, and financial safety scenarios are not recorded.'],
    ['OPERATIONAL_RECOVERY', 'NOT_PROVEN', 'Rollback, backup/restore, and recovery evidence is not candidate-bound.'],
    ['CAPABILITY_TRUTHFULNESS', 'PENDING', 'The capability registry remains conservative, but deployed availability must be compared with it.'],
    ['INSTITUTIONAL_BOUNDARIES', 'PASS', 'Platform-staff mandate remains decision-ready but not decided; restricted cross-tenant and financial powers remain deny-by-default.'],
    ['STAGING_DECISION_ACCEPTANCE', 'EXTERNAL_HOLD', 'No authorized staging acceptance is recorded because deployed qualification has not occurred.'],
  ].map(([id, status, evidence]) => ({ id, requirement: 'REQUIRED', status, evidence })),
  externalBlockers: [
    {
      id: 'EXT-01-CONTAINER-APPS-ENVIRONMENT-QUOTA',
      dependency: 'Canada Central ManagedEnvironmentCount is limit 1 / usage 1. The existing environment is production and the approved topology expressly forbids sharing it. Azure what-if run 42745600190 failed with MaxNumberOfRegionalEnvironmentsInSubExceeded after identity and digest attestations passed.',
      requiredAction: 'Microsoft must raise the subscription\'s Canada Central ManagedEnvironmentCount from 1 to 2 through the Azure quota portal or support channel. CLI quota update returned ResourceNotAvailableForOffer and the support API returned InvalidSupportPlan.',
      engineeringBypassPermitted: false,
    },
    {
      id: 'EXT-02-NO-APPROVED-STAGING-CHANGE-RECORD',
      dependency: `CHG-2026-0114 is prepared and candidate-bound to ${STAGING_CANDIDATE_SHA}, but remains PENDING with no independent approver recorded.`,
      requiredAction: 'A designated approver must approve the prepared staging change instrument; the implementer must not self-approve.',
      engineeringBypassPermitted: false,
    },
    {
      id: 'EXT-04-CREDENTIALLED-ACCEPTANCE-ACTORS',
      dependency: 'No credentialed real staging persona set and independent acceptance actor are available for candidate-bound journeys.',
      requiredAction: 'Provide or authorize the staging identities and designated acceptance reviewer after deployment.',
      engineeringBypassPermitted: false,
    },
  ],
}

if (census.frozenPopulation !== 777) throw new Error(`Frozen population changed: ${census.frozenPopulation}`)
if (!reconciliation.consistent || reconciliation.problems.length > 0) throw new Error('Accounting reconciliation is inconsistent')
if (census.summary.partial !== 0 || census.summary.engineeringOutstanding !== 0) throw new Error('Engineering baseline regressed')
if (creditsMissingIndependentEvidence.length !== 0) throw new Error(`Expected no unreferenced earlier-run credits, found ${creditsMissingIndependentEvidence.length}`)
if (evidenceReconciliationBatch?.items.length !== 24) throw new Error(`Expected B172 to resolve 24 evidence gaps, found ${evidenceReconciliationBatch?.items.length ?? 0}`)
if (reconciliation.batchLabelDifferences.length !== 56) throw new Error(`Expected 56 traceability differences, found ${reconciliation.batchLabelDifferences.length}`)

fs.mkdirSync(outputDirectory, { recursive: true })
fs.writeFileSync(path.join(outputDirectory, 'UE_GATE0_QUALIFICATION_CENSUS.json'), `${JSON.stringify(census, null, 2)}\n`)
fs.writeFileSync(path.join(outputDirectory, 'UE_STAGING_GO_CONTRACT.json'), `${JSON.stringify(contract, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ frozenPopulation: census.frozenPopulation, summary: census.summary, verdict: contract.verdict })}\n`)
