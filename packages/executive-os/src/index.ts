export * from './contract'
export * from './action-queue'
export * from './registry'
export { chiefOfStaffAgent } from './agents/chief-of-staff'
export type { ChiefOfStaffSignal } from './agents/chief-of-staff'
export { internalCfoAgent } from './agents/internal-cfo'
export type { CfoSignal } from './agents/internal-cfo'
export { treasuryAgent } from './agents/treasury'
export type { TreasurySignal, WeekCashFlow } from './agents/treasury'
export { collectionsAgent } from './agents/collections'
export type { CollectionsSignal, OverdueInvoice } from './agents/collections'
export { controllerAgent } from './agents/controller'
export type {
  ControllerSignal,
  OpenClosePeriod,
  OverdueCloseTask,
  OpenCloseException,
} from './agents/controller'
export { fpaAgent } from './agents/fpa'
export type { FpaSignal, FpaLine, FpaLineActuals } from './agents/fpa'
export { taxAgent } from './agents/tax'
export type { TaxSignal, UpcomingTaxFiling, UpcomingInstallment } from './agents/tax'
export { revopsAgent } from './agents/revops'
export type { RevOpsSignal, RevOpsOpportunity, RevOpsStage } from './agents/revops'
export { csRenewalAgent } from './agents/cs-renewal'
export type { CsSignal, CsAccount, HealthScore } from './agents/cs-renewal'
export { partnershipsAgent } from './agents/partnerships'
export type {
  PartnershipsSignal,
  PartnerDealSignal,
  PartnerDealStage,
  PartnerCommissionSignal,
} from './agents/partnerships'
export { grantsAgent } from './agents/grants'
export type { GrantsSignal, Grant, GrantStage } from './agents/grants'
export { reliabilityAgent } from './agents/reliability'
export type { ReliabilitySignal, RouteHealth, ReliabilityIncident } from './agents/reliability'
export { releaseGuardAgent } from './agents/release-guard'
export type { ReleaseGuardSignal, ChangeRecord, ChangeStatus } from './agents/release-guard'
export { finopsAgent } from './agents/finops'
export type { FinopsSignal, CostCategoryTotal, BudgetBreach } from './agents/finops'
export { securityAgent } from './agents/security'
export type { SecuritySignal, VulnFinding, VulnSeverity } from './agents/security'
export { auditAgent } from './agents/audit'
export type { AuditSignal, EvidencePackSummary, ControlFamily, PackStatus, ChainIntegrity } from './agents/audit'
export { legalAgent } from './agents/legal'
export type { LegalSignal, FilingRecord, FilingStatus, FilingKind, ComplianceTaskRecord, ComplianceTaskStatus, ComplianceTaskKind, GovernanceActionRecord, GovernanceActionStatus } from './agents/legal'
export { knowledgeStewardAgent } from './agents/knowledge-steward'
export type { KnowledgeSignal, DocumentSummary, DocumentCategory, DocumentClassification } from './agents/knowledge-steward'
export { portfolioAllocatorAgent } from './agents/portfolio-allocator'
export type { PortfolioSignal, InitiativeRecord, InitiativeStatus } from './agents/portfolio-allocator'
export { cooAgent } from './agents/coo'
export type { CooSignal, CooInitiative, CooTicket, CooMilestone } from './agents/coo'
export { pmoAgent } from './agents/pmo'
export type { PmoSignal, PmoInitiative } from './agents/pmo'
export { productStrategyAgent } from './agents/product-strategy'
export type { ProductStrategySignal, ProductHealth } from './agents/product-strategy'
export { hiringAgent } from './agents/hiring'
export type { HiringSignal, OpenRole, ApplicationBacklog } from './agents/hiring'
export { chiefOfStaffV2Agent } from './agents/chief-of-staff-v2'
export type { CosV2Signal, RecentInsight, AgentRunSummary } from './agents/chief-of-staff-v2'
export { crossDomainSynthesisAgent, synthesizeFindings } from './agents/cross-domain-synthesis'
export type {
  SynthesisSignal,
  SynthesisAccount,
  SynthesisIncident,
  SynthesisGrant,
  SynthesisPortfolioItem,
  RankedFinding,
} from './agents/cross-domain-synthesis'

// Intelligence utilities (ranking engine)
export { rank, rankCompare, explainTopFactors, DEFAULT_WEIGHTS } from './intelligence/rank'
export type { RankInputs, RankOutput, RankBucket, RankWeights, RankOptions } from './intelligence/rank'

// NIL capability registration
export { registerExecutiveCapabilities, EXECUTIVE_CAPABILITIES } from './intelligence/capabilities'
