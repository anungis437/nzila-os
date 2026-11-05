/** Stable identifiers for Gate 0C.3 (institutional scope exceptions and release-debt reconciliation). */

export const GATE_ID = 'GATE-0C.3'
export const ANCHOR_COMMIT = 'f90f74d135c209812b4728585c076ea410704719'
export const PREPARED_ON = '2026-10-27'

export const REGISTER_DIR = 'docs/union-eyes/convergence/register'
export const DOC_DIR = 'docs/union-eyes/convergence/gate-0c3'

export const FILES_0C3 = {
  assessment: `${REGISTER_DIR}/ue-release-high-defect-assessment-0c3.json`,
  debt: `${REGISTER_DIR}/ue-release-debt-index-0c3.json`,
  challenges: `${REGISTER_DIR}/ue-opl-challenge-treatment-0c3.json`,
  carbon: `${REGISTER_DIR}/ue-carbon-scope-decision-0c3.json`,
  decisions: `${REGISTER_DIR}/ue-decision-index-0c3.json`,
  relationships: `${REGISTER_DIR}/ue-defect-relationship-map-0c3.json`,
  closure: `${REGISTER_DIR}/ue-closure-model-0c3.json`,
}

export const DOCS_0C3 = {
  index: `${DOC_DIR}/UE-GATE-0C3-RECONCILIATION.md`,
  assessment: `${DOC_DIR}/UE-HIGH-DEFECT-RELEASE-ASSESSMENT-0C3.md`,
  carbon: `${DOC_DIR}/UE-CARBON-SCOPE-DECISION-RECORD-0C3.md`,
}

export const MATRIX_FILE = `${REGISTER_DIR}/ue-pre-vs-engineering-completion.json`
export const CLASSIFICATION_FILE = `${REGISTER_DIR}/ue-route-classification-0c1.json`
export const QUEUE_FILE = `${REGISTER_DIR}/ue-release-disposition-review-queue.json`
export const CHALLENGES_FILE = `${REGISTER_DIR}/ue-release-disposition-challenges.json`
export const EXCEPTIONS_FILE = `${REGISTER_DIR}/ue-route-decision-bound-exceptions.json`
export const HANDOFF_FILE = `${REGISTER_DIR}/ue-gate0c-handoff-register.json`
export const RATCHETS_FILE = `${REGISTER_DIR}/ue-convergence-ratchets.json`
export const BASELINE_DECISIONS_FILE = `${REGISTER_DIR}/ue-persona-proposed-baseline-decisions.json`
export const PRODUCT_DECISIONS_FILE = `${REGISTER_DIR}/ue-persona-product-decision-register-0c2.json`

export const TRANCHE_FILES = ['0b1', '0b2', '0b3', '0b4', '0b5', '0b6', '0b7', '0b8', '0b9', '0b10', '0b11', '0b12', '0c1'].map((tranche) => `${REGISTER_DIR}/ue-route-classification-${tranche}.json`)

export const CHALLENGE_ANCHOR_COMMIT = 'b091158a8df04eb82c837ab0b53b115e1be70e90'

export const PROPOSED_DISPOSITIONS = ['RELEASE_BLOCKING', 'CONDITIONALLY_BLOCKING', 'NON_BLOCKING_WITH_JUSTIFICATION', 'REVIEW_REQUIRED']
export const ASSESSMENT_STATE = 'PROPOSED_NOT_ACCEPTED'
export const EVIDENCE_BASIS = 'SOURCE_INFERENCE_NO_EXECUTED_PROOF'

export const RECORD_TYPES = ['defect', 'releaseDispositionAssessment', 'challenge', 'exposureContract', 'engineeringRepairObligation', 'acceptedReleaseDecision']

export const DECISION_FAMILIES = ['INVENTORY_INSTITUTIONAL', 'BASELINE_INSTITUTIONAL_AUTHORITY', 'BASELINE_PRODUCT', 'GATE_0C2_PRODUCT', 'PERSONA_RATIFICATION']
export const RUNTIME_PROOFS = ['RLS_TENANT_ISOLATION', 'NATIVE_POSTGRES', 'ROLE_AUTHORIZATION', 'DEPLOYMENT_CONFIGURATION', 'BROWSER', 'REPAIR_REGRESSION_ONLY']

export const CARBON_DECISION_ID = 'UE-INST-CARBON-ACCOUNTING-SCOPE'
export const CARBON_OPERATIONS = ['carbon/dashboard/route.ts|GET', 'carbon/infrastructure/route.ts|GET', 'carbon/validate/route.ts|GET', 'carbon/validate/route.ts|POST']
export const CARBON_OPTIONS = ['OPT-PLATFORM-OWNED-MEASURED', 'OPT-ORGANIZATION-OWNED-MEASURED', 'OPT-RETIRE-ROUTES']

export const EXPOSURE_OPERATIONS = ['docs/openapi/route.ts|GET', 'docs/route.ts|GET', 'version/route.ts|GET']
export const OPL_DEFECTS = ['DEF-0B10-OPL-01', 'DEF-0B10-OPL-07']
export const CHALLENGE_IDS = ['CHALLENGE-0B10-OPL-01', 'CHALLENGE-0B10-OPL-07']
export const CHALLENGE_POSITION = 'RELEASE_BLOCKING_PENDING_CONTAINMENT_PROOF'

export const TRACKED_ITEMS = {
  'COUNSEL-PGLITE-SUITE-FAILS-AT-SETUP': { kind: 'TEST_SUITE', capabilityId: 'UE-CAP-G-001' },
  'DIRECT-MANDATORY-AUDIT-IMPORT@election-succession': { kind: 'RATCHET', capabilityId: 'UE-CAP-K-005' },
  'MUTABLE-REP-IDENTIFIER@case-ownership-backfill': { kind: 'RATCHET', capabilityId: 'UE-CAP-B-001' },
  'P0-F2-TRANSITION-REASON-LEAK': { kind: 'SOURCE_DEFECT', capabilityId: 'UE-OMIT-REP-TRANSITION-REASON-LEAK' },
}

export const RECONCILIATION_0C2_FILE = `${REGISTER_DIR}/ue-persona-requirement-reconciliation-0c2.json`

/** Totals accepted at the Gate 0C.2 commit. They are compared with what the registers hold; they are never forced onto them. */
export const FROZEN_TOTALS = {
  operations: 1646,
  capabilities: 111,
  defects: 777,
  institutionalDecisions: 79,
  releaseBlockingDispositions: 32,
  conditionallyBlockingDispositions: 41,
  earlierHighAwaitingQualification: 71,
  challenges: 2,
  publicExposures: 3,
  carbonExceptions: 4,
  proposedPersonaBaselines: 3,
}

export const CERTIFICATION_RULING_DOC = 'docs/union-eyes/reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md'
export const CHALLENGE_FLAG = 'UE_CANONICAL_BOOTSTRAP_V2'
export const FLAG_SCAN_PATHS = ['apps/union-eyes', 'infrastructure', '.github']
