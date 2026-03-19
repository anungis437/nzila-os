import type { AIPolicyContext, AIPolicyDecision } from './schemas.js'

// ─── Policy Rule ────────────────────────────────────────────────────────────

export interface AIPolicyRule {
  readonly id: string
  readonly description: string
  readonly evaluate: (ctx: AIPolicyContext) => AIPolicyDecision
}

// ─── Policy Registry ────────────────────────────────────────────────────────

export class AIPolicyRegistry {
  private readonly rules: AIPolicyRule[] = []

  register(rule: AIPolicyRule): void {
    this.rules.push(rule)
  }

  evaluate(ctx: AIPolicyContext): AIPolicyDecision {
    for (const rule of this.rules) {
      const decision = rule.evaluate(ctx)
      if (!decision.allowed) {
        return decision
      }
    }

    return {
      allowed: true,
      reason: 'All policies passed',
    }
  }

  getRules(): readonly AIPolicyRule[] {
    return this.rules
  }
}

// ─── checkAIPolicy (convenience) ────────────────────────────────────────────

let globalRegistry: AIPolicyRegistry | undefined

export function getAIPolicyRegistry(): AIPolicyRegistry {
  if (!globalRegistry) {
    globalRegistry = new AIPolicyRegistry()
  }
  return globalRegistry
}

export function setAIPolicyRegistry(registry: AIPolicyRegistry): void {
  globalRegistry = registry
}

export function checkAIPolicy(ctx: AIPolicyContext): AIPolicyDecision {
  return getAIPolicyRegistry().evaluate(ctx)
}

// ─── Built-in Policy Rules ──────────────────────────────────────────────────

export const restrictedDataPolicy: AIPolicyRule = {
  id: 'restricted-data-guard',
  description: 'Block AI requests with restricted data classification',
  evaluate: (ctx) => {
    if (ctx.dataClassification === 'restricted') {
      return {
        allowed: false,
        reason: 'AI requests with restricted data classification are not allowed',
        policyId: 'restricted-data-guard',
        restrictions: ['restricted-data'],
      }
    }
    return { allowed: true, reason: 'Data classification acceptable' }
  },
}

export const modelAllowlistPolicy = (allowedModels: string[]): AIPolicyRule => ({
  id: 'model-allowlist',
  description: `Only allow models: ${allowedModels.join(', ')}`,
  evaluate: (ctx) => {
    if (!allowedModels.includes(ctx.model)) {
      return {
        allowed: false,
        reason: `Model ${ctx.model} is not in the allowed list`,
        policyId: 'model-allowlist',
        restrictions: ['model-not-allowed'],
      }
    }
    return { allowed: true, reason: 'Model is allowed' }
  },
})
