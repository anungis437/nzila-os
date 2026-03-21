import { randomUUID } from 'node:crypto'
import { aiRequestSchema, type AIRequest, type AIResponse } from './schemas.js'
import { checkBudget, recordSpend, type BudgetStore } from './budget.js'
import { checkAIPolicy, type AIPolicyRegistry } from './policy.js'
import { classifyOutput, type OutputClassifier } from './classifier.js'
import { createAILogEntry, type AILogStore } from './logging.js'

// ─── AI Provider Interface ──────────────────────────────────────────────────

export interface AIProvider {
  readonly name: string
  invoke(request: AIRequest): Promise<{
    content: string
    tokensUsed: { prompt: number; completion: number; total: number }
    costUsd: number
  }>
}

// ─── Runner Configuration ───────────────────────────────────────────────────

export interface AIRunnerConfig {
  readonly provider: AIProvider
  readonly budgetStore: BudgetStore
  readonly logStore: AILogStore
  readonly policyRegistry?: AIPolicyRegistry
  readonly classifier?: OutputClassifier
}

// ─── AI Runner Error ────────────────────────────────────────────────────────

export class AIControlError extends Error {
  constructor(
    message: string,
    public readonly code: 'POLICY_DENIED' | 'BUDGET_EXCEEDED' | 'PROVIDER_ERROR' | 'VALIDATION_ERROR',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AIControlError'
  }
}

// ─── runAI — Unified Entry Point ────────────────────────────────────────────

export async function runAI(
  config: AIRunnerConfig,
  request: AIRequest,
): Promise<AIResponse> {
  const startTime = Date.now()

  // 1. Validate input
  const validated = aiRequestSchema.parse(request)

  // 2. Check policy
  const policyDecision = config.policyRegistry
    ? config.policyRegistry.evaluate({
        orgId: validated.orgId,
        actorId: validated.actorId,
        model: validated.model,
        action: 'ai.invoke',
      })
    : checkAIPolicy({
        orgId: validated.orgId,
        actorId: validated.actorId,
        model: validated.model,
        action: 'ai.invoke',
      })

  if (!policyDecision.allowed) {
    throw new AIControlError(
      `AI request denied: ${policyDecision.reason}`,
      'POLICY_DENIED',
      { policyId: policyDecision.policyId },
    )
  }

  // 3. Check budget
  const budgetStatus = await checkBudget(config.budgetStore, validated.orgId)
  if (budgetStatus.status === 'blocked') {
    throw new AIControlError(
      `AI budget exceeded for org ${validated.orgId}: ${budgetStatus.usagePercent.toFixed(1)}% used`,
      'BUDGET_EXCEEDED',
      { budgetStatus },
    )
  }

  // 4. Invoke provider
  const providerResult = await config.provider.invoke(validated)

  // 5. Classify output
  const classifier = config.classifier ?? undefined
  const classificationResult = classifier
    ? classifier.classify(providerResult.content)
    : classifyOutput(providerResult.content)

  const durationMs = Date.now() - startTime

  // 6. Build response
  const response: AIResponse = {
    id: randomUUID(),
    model: validated.model,
    content: providerResult.content,
    tokensUsed: providerResult.tokensUsed,
    costUsd: providerResult.costUsd,
    classification: classificationResult.classification,
    durationMs,
    timestamp: new Date().toISOString(),
  }

  // 7. Record spend
  await recordSpend(config.budgetStore, validated.orgId, providerResult.costUsd)

  // 8. Log the request
  const logEntry = createAILogEntry(validated, response, policyDecision)
  await config.logStore.append(logEntry)

  return response
}
