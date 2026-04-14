/**
 * @nzila/ai-core — AI Control adapter
 *
 * Bridges @nzila/ai-control policy/budget/logging runner with ai-core gateway
 * so applications can execute governed AI requests through the same provider
 * routing used by the control plane.
 */

import {
  InMemoryBudgetStore,
  InMemoryAILogStore,
  runAI,
  type AIRunnerConfig,
  type AIRequest,
} from '@nzila/ai-control'
import type { AIPolicyRegistry, OutputClassifier } from '@nzila/ai-control'
import type { AiGenerateRequest, AiGenerateResponse, DataClass } from './types'
import { generate } from './gateway'

export interface GovernedGenerateInput {
  readonly request: AiGenerateRequest
  readonly actorId: string
  readonly model: string
  readonly systemPrompt?: string
}

export interface GovernedGenerateOutput {
  readonly controlResponse: Awaited<ReturnType<typeof runAI>>
  readonly gatewayResponse: AiGenerateResponse
}

export interface GovernedGenerateConfig {
  readonly budgetStore?: AIRunnerConfig['budgetStore']
  readonly logStore?: AIRunnerConfig['logStore']
  readonly policyRegistry?: AIPolicyRegistry
  readonly classifier?: OutputClassifier
}

function mapDataClass(dataClass: DataClass): 'public' | 'internal' | 'confidential' | 'restricted' {
  if (dataClass === 'regulated') return 'restricted'
  if (dataClass === 'sensitive') return 'confidential'
  return dataClass
}

/**
 * Executes a request through ai-control first, then returns the canonical
 * ai-core gateway response using the same model and prompt parameters.
 */
export async function governedGenerate(
  input: GovernedGenerateInput,
  config: GovernedGenerateConfig = {},
): Promise<GovernedGenerateOutput> {
  const budgetStore = config.budgetStore ?? new InMemoryBudgetStore()
  const logStore = config.logStore ?? new InMemoryAILogStore()
  let gatewayResponseCache: AiGenerateResponse | undefined

  const provider: AIRunnerConfig['provider'] = {
    name: 'ai-core-gateway-adapter',
    async invoke(request: AIRequest) {
      const gatewayResponse = await generate({
        ...input.request,
        input: request.prompt,
        params: {
          temperature: request.temperature,
          maxTokens: request.maxTokens,
        },
      })
      gatewayResponseCache = gatewayResponse

      return {
        content: gatewayResponse.content,
        tokensUsed: {
          prompt: gatewayResponse.tokensIn,
          completion: gatewayResponse.tokensOut,
          total: gatewayResponse.tokensIn + gatewayResponse.tokensOut,
        },
        costUsd: gatewayResponse.costUsd ?? 0,
      }
    },
  }

  const controlRequest: AIRequest = {
    model: input.model,
    orgId: input.request.orgId,
    actorId: input.actorId,
    prompt: typeof input.request.input === 'string'
      ? input.request.input
      : input.request.input.map((message) => `${message.role}: ${message.content}`).join('\n'),
    systemPrompt: input.systemPrompt,
    temperature: input.request.params?.temperature,
    maxTokens: input.request.params?.maxTokens,
    metadata: {
      appKey: input.request.appKey,
      profileKey: input.request.profileKey,
      dataClassification: mapDataClass(input.request.dataClass),
      trace: input.request.trace,
    },
  }

  const controlResponse = await runAI(
    {
      provider,
      budgetStore,
      logStore,
      policyRegistry: config.policyRegistry,
      classifier: config.classifier,
    },
    controlRequest,
  )

  if (!gatewayResponseCache) {
    throw new Error('governedGenerate failed to capture gateway response from control provider')
  }

  return {
    controlResponse,
    gatewayResponse: gatewayResponseCache,
  }
}
