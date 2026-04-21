export * from './contract.js'
export * from './action-queue.js'
export * from './registry.js'
export { chiefOfStaffAgent } from './agents/chief-of-staff.js'
export type { ChiefOfStaffSignal } from './agents/chief-of-staff.js'
export { internalCfoAgent } from './agents/internal-cfo.js'
export type { CfoSignal } from './agents/internal-cfo.js'
export { treasuryAgent } from './agents/treasury.js'
export type { TreasurySignal, WeekCashFlow } from './agents/treasury.js'
export { collectionsAgent } from './agents/collections.js'
export type { CollectionsSignal, OverdueInvoice } from './agents/collections.js'
export { controllerAgent } from './agents/controller.js'
export type {
  ControllerSignal,
  OpenClosePeriod,
  OverdueCloseTask,
  OpenCloseException,
} from './agents/controller.js'
export { fpaAgent } from './agents/fpa.js'
export type { FpaSignal, FpaLine, FpaLineActuals } from './agents/fpa.js'
export { taxAgent } from './agents/tax.js'
export type { TaxSignal, UpcomingTaxFiling, UpcomingInstallment } from './agents/tax.js'
export { revopsAgent } from './agents/revops.js'
export type { RevOpsSignal, RevOpsOpportunity, RevOpsStage } from './agents/revops.js'
export { csRenewalAgent } from './agents/cs-renewal.js'
export type { CsSignal, CsAccount, HealthScore } from './agents/cs-renewal.js'
export { partnershipsAgent } from './agents/partnerships.js'
export type {
  PartnershipsSignal,
  PartnerDealSignal,
  PartnerDealStage,
  PartnerCommissionSignal,
} from './agents/partnerships.js'
export { grantsAgent } from './agents/grants.js'
export type { GrantsSignal, Grant, GrantStage } from './agents/grants.js'
export { reliabilityAgent } from './agents/reliability.js'
export type { ReliabilitySignal, RouteHealth, ReliabilityIncident } from './agents/reliability.js'
export { releaseGuardAgent } from './agents/release-guard.js'
export type { ReleaseGuardSignal, ChangeRecord, ChangeStatus } from './agents/release-guard.js'
export { finopsAgent } from './agents/finops.js'
export type { FinopsSignal, CostCategoryTotal, BudgetBreach } from './agents/finops.js'
export { securityAgent } from './agents/security.js'
export type { SecuritySignal, VulnFinding, VulnSeverity } from './agents/security.js'
export { auditAgent } from './agents/audit.js'
export type { AuditSignal, EvidencePackSummary, ControlFamily, PackStatus, ChainIntegrity } from './agents/audit.js'
export { legalAgent } from './agents/legal.js'
export type { LegalSignal, FilingRecord, FilingStatus, FilingKind, ComplianceTaskRecord, ComplianceTaskStatus, ComplianceTaskKind, GovernanceActionRecord, GovernanceActionStatus } from './agents/legal.js'
export { knowledgeStewardAgent } from './agents/knowledge-steward.js'
export type { KnowledgeSignal, DocumentSummary, DocumentCategory, DocumentClassification } from './agents/knowledge-steward.js'
export { portfolioAllocatorAgent } from './agents/portfolio-allocator.js'
export type { PortfolioSignal, InitiativeRecord, InitiativeStatus } from './agents/portfolio-allocator.js'
export { cooAgent } from './agents/coo.js'
export type { CooSignal, CooInitiative, CooTicket, CooMilestone } from './agents/coo.js'
export { pmoAgent } from './agents/pmo.js'
export type { PmoSignal, PmoInitiative } from './agents/pmo.js'
export { productStrategyAgent } from './agents/product-strategy.js'
export type { ProductStrategySignal, ProductHealth } from './agents/product-strategy.js'
export { hiringAgent } from './agents/hiring.js'
export type { HiringSignal, OpenRole, ApplicationBacklog } from './agents/hiring.js'
export { chiefOfStaffV2Agent } from './agents/chief-of-staff-v2.js'
export type { CosV2Signal, RecentInsight, AgentRunSummary } from './agents/chief-of-staff-v2.js'
export { crossDomainSynthesisAgent, synthesizeFindings } from './agents/cross-domain-synthesis.js'
export type {
  SynthesisSignal,
  SynthesisAccount,
  SynthesisIncident,
  SynthesisGrant,
  SynthesisPortfolioItem,
  RankedFinding,
} from './agents/cross-domain-synthesis.js'

// Intelligence utilities (ranking engine)
export { rank, rankCompare, explainTopFactors, DEFAULT_WEIGHTS } from './intelligence/rank.js'
export type { RankInputs, RankOutput, RankBucket, RankWeights, RankOptions } from './intelligence/rank.js'

// NIL capability registration
export { registerExecutiveCapabilities, EXECUTIVE_CAPABILITIES } from './intelligence/capabilities.js'
