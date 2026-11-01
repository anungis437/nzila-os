/** Stable identifiers for Gate 0C.2 (persona canonical ratification readiness). */

export const GATE_ID = 'GATE-0C.2'
export const ANCHOR_COMMIT = 'fe8469cff34c561b2beccddb965e13355d74bb09'
export const PREPARED_ON = '2026-10-27'

export const REGISTER_DIR = 'docs/union-eyes/convergence/register'
export const DOC_DIR = 'docs/union-eyes/persona-baselines/decision-packages'

export const PERSONAS = ['steward', 'representative', 'financial-officer']

export const FILES_0C2 = {
  preservation: `${REGISTER_DIR}/ue-persona-identifier-preservation-0c2.json`,
  structure: `${REGISTER_DIR}/ue-persona-steward-structure-0c2.json`,
  steward: `${REGISTER_DIR}/ue-persona-decision-package-steward-0c2.json`,
  representative: `${REGISTER_DIR}/ue-persona-decision-package-representative-0c2.json`,
  'financial-officer': `${REGISTER_DIR}/ue-persona-decision-package-financial-officer-0c2.json`,
  reconciliation: `${REGISTER_DIR}/ue-persona-requirement-reconciliation-0c2.json`,
  decisions: `${REGISTER_DIR}/ue-persona-product-decision-register-0c2.json`,
}

export const DOCS_0C2 = {
  index: `${DOC_DIR}/UE-PERSONA-RATIFICATION-READINESS-0C2.md`,
  steward: `${DOC_DIR}/UE-STEWARD-DECISION-PACKAGE-0C2.md`,
  representative: `${DOC_DIR}/UE-REPRESENTATIVE-2.2-DECISION-PACKAGE-0C2.md`,
  'financial-officer': `${DOC_DIR}/UE-FINANCIAL-OFFICER-2.1-DECISION-PACKAGE-0C2.md`,
}

export const BASELINE_FILES = {
  steward: `${REGISTER_DIR}/ue-persona-proposed-baseline-steward.json`,
  representative: `${REGISTER_DIR}/ue-persona-proposed-baseline-representative.json`,
  'financial-officer': `${REGISTER_DIR}/ue-persona-proposed-baseline-financial-officer.json`,
  decisions: `${REGISTER_DIR}/ue-persona-proposed-baseline-decisions.json`,
}

export const MATRIX_FILE = `${REGISTER_DIR}/ue-pre-vs-engineering-completion.json`
export const RECOVERY_FILE = `${REGISTER_DIR}/ue-gate0a-persona-source-recovery.json`

export const PROPOSED_CANONICALS = {
  steward: { id: 'UE-STEWARD-PROPOSED-CANONICAL-R1', version: '1.0-R1', historicalIdentifier: null },
  representative: { id: 'UE-REPRESENTATIVE-PROPOSED-CANONICAL-2.2-R1', version: '2.2-R1', historicalIdentifier: 'UE-REPRESENTATIVE-CANONICAL-2.2' },
  'financial-officer': { id: 'UE-FINANCIAL-OFFICER-PROPOSED-CANONICAL-2.1-R1', version: '2.1-R1', historicalIdentifier: 'UE-FINANCIAL-OFFICER-CANONICAL-2.1' },
}

export const RECORD_IDS = {
  steward: 'PDR-0C2-STEWARD-V1',
  representative: 'PDR-0C2-REPRESENTATIVE-V1',
  'financial-officer': 'PDR-0C2-FINANCIAL-OFFICER-V1',
}

export const DECISION_STATES = ['PROPOSED_FOR_RATIFICATION', 'RETURNED_FOR_REWORK', 'ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER', 'REJECTED_BY_AUTHORIZED_PRODUCT_OWNER']

export const DOMAINS = [
  'IDENTITY_ELIGIBILITY',
  'ORG_FEDERATION_SCOPE',
  'CASE_MEMBER_DOCUMENT_VISIBILITY',
  'RECORD_CREATION_UPDATE',
  'DELEGATION_SUBSTITUTION',
  'CONFIDENTIALITY_PRIVILEGED',
  'FINANCIAL_ADMIN_APPROVALS',
  'AUDIT_ACCOUNTABILITY',
  'NOTIFICATIONS_WORKFLOW',
  'REVOCATION_TERMINATION_HISTORY',
  'CROSS_PERSONA_HANDOFFS',
]

export const AUTHORITY_CLASSES = ['ENGINEERING_REQUIREMENT', 'IMPLEMENTED_SOURCE_BEHAVIOR', 'PROPOSED_PERMISSION', 'ADOPTED_INSTITUTIONAL_AUTHORIZATION']

export const HISTORICAL_CLASSES = ['DIRECT_INDIVIDUAL', 'GROUP_LABEL_ONLY', 'STATUS_ONLY', 'NAME_RANGE_ONLY', 'NONE']

export const COVERAGE_STATES = ['COVERED', 'PARTIAL', 'GAP']
