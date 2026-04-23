/**
 * @nzila/ue-cognition — Public barrel export.
 *
 * Union Eyes integration of @nzila/platform-cognition-core. Five engines:
 *   1. case-risk    — Grievance/claim trajectory intelligence
 *   2. workload     — Steward workload balancer
 *   3. engagement   — Member disengagement risk
 *   4. precedents   — Precedent memory engine
 *   5. kpis         — Measurable KPI snapshot
 * Plus an executive-summary aggregator and an append-only audit trail.
 */
export * from './types'

export {
  computeCaseRisk,
  listCaseRiskSnapshots,
  latestCaseRiskByCase,
  caseRisksToSignals,
  CASE_RISK_MODEL_VERSION,
  type CaseRiskInput,
} from './case-risk'

export {
  computeStewardWorkload,
  computeWorkloadFairness,
  listWorkloadSnapshots,
  latestWorkloadByOrg,
  type StewardWorkloadInput,
} from './workload'

export {
  computeMemberEngagement,
  listEngagementSnapshots,
  latestEngagementByMember,
  disengagedMembersCount,
  ENGAGEMENT_MODEL_VERSION,
  type MemberEngagementInput,
} from './engagement'

export {
  findPrecedents,
  listPrecedentMatches,
  CrossOrgPrecedentLeakError,
  type PrecedentSearchInput,
} from './precedents'

export {
  computeKpiSnapshot,
  listKpiSnapshots,
  latestKpiSnapshot,
  KPI_MODEL_VERSION,
  KPI_ASSUMPTIONS,
  type KpiComputeInput,
} from './kpis'

export {
  buildExecutiveSummary,
  type ExecutiveSummary,
} from './executive/summary'

export {
  recordAudit,
  listAuditEntries,
  type AuditInput,
} from './audit'

export {
  setUeCognitionStoreRoot,
  ueCognitionRoot,
} from './utils'

export { ueCognitionAuditSchema, ueCognitionKpiSnapshotSchema } from './schemas'
