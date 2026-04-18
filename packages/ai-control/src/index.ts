// ─── @nzila/ai-control ───────────────────────────────────────────────────────
// AI Control Plane with governance, budgeting, output classification,
// policy enforcement, and comprehensive logging.

export {
  type AIRequest,
  type AIResponse,
  type BudgetConfig,
  type BudgetStatus,
  type AIPolicyContext,
  type AIPolicyDecision,
  type OutputClassification,
  type AILogEntry,
  aiRequestSchema,
  aiResponseSchema,
  budgetConfigSchema,
  budgetStatusSchema,
  aiPolicyContextSchema,
  aiPolicyDecisionSchema,
  aiLogEntrySchema,
} from './schemas'

export {
  runAI,
  AIControlError,
  type AIProvider,
  type AIRunnerConfig,
} from './runner'

export {
  checkBudget,
  recordSpend,
  getCurrentPeriod,
  type BudgetStore,
  InMemoryBudgetStore,
} from './budget'

export {
  checkAIPolicy,
  AIPolicyRegistry,
  getAIPolicyRegistry,
  setAIPolicyRegistry,
  restrictedDataPolicy,
  modelAllowlistPolicy,
  type AIPolicyRule,
} from './policy'

export {
  classifyOutput,
  OutputClassifier,
  type ClassificationRule,
  type ClassificationResult,
} from './classifier'

export {
  createAILogEntry,
  type AILogStore,
  InMemoryAILogStore,
} from './logging'

export {
  defaultDomainPolicyPacks,
  evaluateDomainPolicy,
  type DomainPolicyDomain,
  type DomainPolicyPack,
  type DomainPolicyInput,
  type DomainPolicyDecision,
} from './domain-policy-packs'
