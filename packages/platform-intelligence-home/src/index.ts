/**
 * @nzila/platform-intelligence-home
 *
 * Barrel export — all types + all service functions.
 */

// Types
export type {
  FundingStatus,
  FundingOpportunity,
  DealStage,
  DealType,
  Deal,
  DealKpis,
  PartnerType,
  PartnerStatus,
  Partner,
  PartnerKpis,
  ProductScore,
  RiskSeverity,
  RiskCategory,
  Risk,
  BriefingActionCategory,
  BriefingAction,
  WeeklyBriefing,
  SyncStatus,
  DataSourceHealth,
  SyncHealthKpis,
  DashboardKpis,
  InsightSignal,
  ExecutiveInsight,
  DecisionQuestion,
  FounderDecision,
  MichelActionType,
  MichelAction,
} from './types'

// Funding service
export {
  getFundingOpportunities,
  getOpenOpportunities,
  getUpcomingDeadlines,
  getImmediateActions,
  getFundingKpis,
} from './funding-service'

// Deal service
export {
  getDealPipeline,
  getDealsByProduct,
  getActiveDeals,
  getStaleDeals,
  getHighProbabilityDeals,
  getDealKpis,
} from './deal-service'

// Partner service
export {
  getPartners,
  getPartnersByDomain,
  getActivePartners,
  getProspects,
  getPartnerKpis,
} from './partner-service'

// Scoring service
export {
  scoreProducts,
  getTopProducts,
  getPriorityProduct,
  getTotalRecommendedHours,
  getUnderPrioritizedProducts,
} from './scoring-service'

// Risk service
export {
  detectRisks,
  getRiskKpis,
} from './risk-service'

// Briefing service
export {
  generateWeeklyBriefing,
} from './briefing-service'

// Data sync service
export {
  getDataSourceHealth,
  getSyncHealthKpis,
  getFailedSyncs,
  getNeverRunSyncs,
} from './data-sync-service'

// Dashboard service
export {
  getDashboardKpis,
} from './dashboard-service'

// Insight service
export {
  generateExecutiveInsights,
  getUrgentInsights,
} from './insight-service'

// Decision engine
export {
  getFounderDecisions,
} from './decision-engine'

// Michel panel
export {
  getMichelWeeklyActions,
} from './michel-panel'

