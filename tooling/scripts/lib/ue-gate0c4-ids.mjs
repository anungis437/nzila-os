/** Stable identifiers for Gate 0C.4 (independent scope-lock qualification and decision dossier). */

export const GATE_ID = 'GATE-0C.4'
export const PREPARED_ON = '2026-10-27'
/** The accepted Gate 0C.3 commit. Every Gate 0C.3 and earlier artifact must stay byte-identical to it. */
export const ANCHOR_0C3_COMMIT = 'ab9c184263020a95b91066014395f16dc3ec78e8'

export const REGISTER_DIR = 'docs/union-eyes/convergence/register'
export const DOC_DIR = 'docs/union-eyes/convergence/gate-0c4'

export const FILES_0C4 = {
  qualification: `${REGISTER_DIR}/ue-high-defect-qualification-0c4.json`,
  evidence: `${REGISTER_DIR}/ue-evidence-qualification-0c4.json`,
  supersessions: `${REGISTER_DIR}/ue-supersession-clarification-0c4.json`,
  certification: `${REGISTER_DIR}/ue-gate0-certification-model-0c4.json`,
  product: `${REGISTER_DIR}/ue-product-ratification-dossier-0c4.json`,
  institutional: `${REGISTER_DIR}/ue-institutional-decision-dossier-0c4.json`,
}

export const DOCS_0C4 = {
  index: `${DOC_DIR}/UE-GATE-0C4-QUALIFICATION.md`,
  product: `${DOC_DIR}/UE-PRODUCT-RATIFICATION-DOSSIER-0C4.md`,
  institutional: `${DOC_DIR}/UE-INSTITUTIONAL-DECISION-DOSSIER-0C4.md`,
  checklist: `${DOC_DIR}/UE-GATE0-CERTIFICATION-CHECKLIST-0C4.md`,
}

export const MATRIX_FILE = `${REGISTER_DIR}/ue-pre-vs-engineering-completion.json`
export const APP_ROOT = 'apps/union-eyes'
export const API_ROOT = `${APP_ROOT}/app/api`

export const REVIEW_STATUSES = ['SOURCE_VERIFIED', 'PARTIALLY_VERIFIED', 'INFERENCE_ONLY', 'REQUIRES_RUNTIME_PROOF']
export const SOURCE_VERIFICATION = ['SOURCE_VERIFIED', 'PARTIALLY_VERIFIED', 'INFERENCE_ONLY']
/** Proofs that no reading of the repository can supply. A proposed disposition that rests on one of these needs runtime proof. */
export const RUNTIME_ONLY_PROOFS = ['RLS_TENANT_ISOLATION', 'NATIVE_POSTGRES', 'DEPLOYMENT_CONFIGURATION', 'BROWSER']

export const REVIEWER_ROLE = 'ENGINEERING_AGENT_METHOD_REVIEW'
export const REVIEW_INDEPENDENCE = 'METHOD_INDEPENDENT_ONLY'
export const REVIEW_LIMITATION =
  'The reviewer belongs to the same engineering-agent family that prepared the Gate 0C.3 registers. The review re-reads the source with a separate extractor and shares no code with the Gate 0C.3 builder, so it is independent in method. It is not an authority-independent approval and it accepts, ratifies and authorizes nothing.'

export const SUPERSESSION_KINDS = ['CLARIFICATION', 'SUPERSESSION']
export const CERTIFICATION_CHECKS = [
  'DOCUMENTARY_SCOPE_COMPLETENESS',
  'INDEPENDENT_EVIDENCE_QUALIFICATION',
  'PRODUCT_SPECIFICATION_RATIFICATION',
  'DEFERRED_DECISIONS_NON_AUTHORIZING',
  'REQUIRED_INSTITUTIONAL_DECISIONS_ADOPTED',
  'EXCEPTION_GOVERNANCE_ACCEPTED',
  'DOWNSTREAM_RELEASE_OBLIGATIONS_CARRIED',
  'ACTUAL_RELEASE_READINESS',
]

export const DOCUMENTARY_LABEL = 'DOCUMENTARY_SCOPE_RECORD_COMPLETE'
export const PRESENTATION = {
  documentaryScopeRecord: DOCUMENTARY_LABEL,
  independentGate0Certification: 'NOT_GRANTED',
  personaRatification: 'PENDING',
  institutionalAuthorityDecisions: 'OUTSTANDING',
  releaseAuthorization: 'NOT_GRANTED',
  ueSaasOperationalReadiness: 'NO_GO',
  gate0Verdict: 'IN_PROGRESS',
}

export const THEMES = ['CARBON_SCOPE', 'CROSS_ORGANIZATION_DISCLOSURE', 'CASE_MEMBER_DOCUMENT_CONFIDENTIALITY', 'FINANCIAL_MANDATE_AND_SENSITIVE_RECORDS', 'EXTERNAL_PROCESSOR_AND_CONSENT', 'OTHER']

export const SCOPE_LOCK_DISPOSITIONS = ['REQUIRED_BEFORE_CERTIFICATION', 'DEFERRED_NON_AUTHORIZING']

export const PERSONA_PACKAGES = {
  steward: 'docs/union-eyes/convergence/register/ue-persona-decision-package-steward-0c2.json',
  representative: 'docs/union-eyes/convergence/register/ue-persona-decision-package-representative-0c2.json',
  'financial-officer': 'docs/union-eyes/convergence/register/ue-persona-decision-package-financial-officer-0c2.json',
}

export const STRUCTURE_FILE = `${REGISTER_DIR}/ue-persona-steward-structure-0c2.json`

export const PER_CAPITA = {
  table: 'perCapitaRemittances',
  mediumDefect: 'DEF-0B8-JUR-HEALTH-WELFARE-PLANS-PATH-IS-THE-PER-CAPITA-REMITTANCE-LEDGER-AT-MEMBER-FLOOR',
  highDefect: 'DEF-0B12-CRUD-TAX-PATHS-SERVE-THE-PER-CAPITA-REMITTANCE-LEDGER-TO-ANY-MEMBER',
  routes: ['healthwelfare/plans/route.ts', 'tax/slips/route.ts', 'tax/t106/route.ts', 'tax/rl-1/generate/route.ts', 'tax/cope/receipts/route.ts'],
}

export const CARBON_SERVICE_FILES = [
  'apps/union-eyes/services/carbon-accounting-service.ts',
  'apps/union-eyes/services/carbon-accounting-integration.ts',
  'apps/union-eyes/backend/services/api/carbon_accounting_service_views.py',
  'apps/union-eyes/db/migrations/0004_phase2_complete.sql',
]
export const RETENTION_DEFECT = 'DEF-0B6-SYS-LOCATION-RETENTION-HAS-NO-SCHEDULER-IN-REPOSITORY'
export const RETENTION_ROUTE = 'cron/location-retention/route.ts'

export const OVERBROAD_CLAIMS = [
  /no source names carbon accounting/i,
  /\b(?:gate 0|scope[- ]lock)\s+(?:is\s+)?(?:certified|certification (?:is )?granted)\b/i,
  /\bproduction (?:is )?(?:ready|go)\b/i,
  /absence of (?:a )?(?:source )?citation proves/i,
  /\bindependently (?:approved|accepted|ratified)\b/i,
]
