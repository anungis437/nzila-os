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
} from './schemas.js'

export {
  runAI,
  AIControlError,
  type AIProvider,
  type AIRunnerConfig,
} from './runner.js'

export {
  checkBudget,
  recordSpend,
  getCurrentPeriod,
  type BudgetStore,
  InMemoryBudgetStore,
} from './budget.js'

export {
  checkAIPolicy,
  AIPolicyRegistry,
  getAIPolicyRegistry,
  setAIPolicyRegistry,
  restrictedDataPolicy,
  modelAllowlistPolicy,
  type AIPolicyRule,
} from './policy.js'

export {
  classifyOutput,
  OutputClassifier,
  type ClassificationRule,
  type ClassificationResult,
} from './classifier.js'

export {
  createAILogEntry,
  type AILogStore,
  InMemoryAILogStore,
} from './logging.js'
