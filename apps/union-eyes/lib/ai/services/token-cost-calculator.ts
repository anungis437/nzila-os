/**
 * Token Cost Calculator
 * 
 * Calculates estimated costs for different LLM providers and models.
 * Pricing is updated as of February 2026.
 * 
 * Part of Phase 1: LLM Excellence Implementation
 */

import { createLogger } from '@nzila/os-core'
export interface ModelPricing {
  inputPerMillion: number; // USD per 1M input tokens
  outputPerMillion: number; // USD per 1M output tokens
}

const logger = createLogger('token-cost-calculator')

/**
 * Model pricing data (as of February 2026)
 * Update regularly as providers change pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4-turbo-preview': { inputPerMillion: 10.0, outputPerMillion: 30.0 },
  'gpt-4-turbo': { inputPerMillion: 10.0, outputPerMillion: 30.0 },
  'gpt-4': { inputPerMillion: 30.0, outputPerMillion: 60.0 },
  'gpt-3.5-turbo': { inputPerMillion: 0.5, outputPerMillion: 1.5 },
  'gpt-3.5-turbo-1106': { inputPerMillion: 1.0, outputPerMillion: 2.0 },
  'text-embedding-ada-002': { inputPerMillion: 0.1, outputPerMillion: 0 },
  'text-embedding-3-small': { inputPerMillion: 0.02, outputPerMillion: 0 },
  'text-embedding-3-large': { inputPerMillion: 0.13, outputPerMillion: 0 },
  
  // Anthropic
  'claude-3-opus-20240229': { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  'claude-3-sonnet-20240229': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'claude-3-haiku-20240307': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  'claude-3-5-sonnet-20240620': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  
  // Google
  'gemini-1.5-pro': { inputPerMillion: 3.5, outputPerMillion: 10.5 },
  'gemini-1.5-flash': { inputPerMillion: 0.35, outputPerMillion: 1.05 },
  'gemini-1.0-pro': { inputPerMillion: 0.5, outputPerMillion: 1.5 },
  
  // Azure OpenAI (same as OpenAI pricing generally)
  'azure-gpt-4': { inputPerMillion: 30.0, outputPerMillion: 60.0 },
  'azure-gpt-35-turbo': { inputPerMillion: 0.5, outputPerMillion: 1.5 },
};

/**
 * Calculate cost for a given model and token usage
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  
  if (!pricing) {
    logger.warn(`No pricing data for model: ${model}. Returning 0 cost.`);
    return 0;
  }
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  
  return inputCost + outputCost;
}

/**
 * Estimate number of tokens in a text string
 * 
 * This is a rough estimate. For precise counts, use tiktoken library.
 * Rule of thumb: 1 token ≈ 4 characters for English text
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }
  
  // Rough estimate: 1 token ≈ 4 characters
  // This works reasonably well for English text
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost for a text string based on model
 * Useful for pre-request cost estimation
 */
export function estimateCostForText(
  text: string,
  model: string,
  estimatedOutputRatio: number = 1.0 // Ratio of output to input tokens
): number {
  const estimatedInputTokens = estimateTokens(text);
  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * estimatedOutputRatio);
  
  return calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
}

/**
 * Get pricing information for a model
 */
export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING[model] || null;
}

/**
 * List all available models with pricing
 */
export function getAllModelPricing(): Array<{
  model: string;
  pricing: ModelPricing;
  provider: string;
}> {
  const models: Array<{ model: string; pricing: ModelPricing; provider: string }> = [];
  
  for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
    let provider = 'unknown';
    if (model.startsWith('gpt-') || model.startsWith('text-embedding')) {
      provider = 'openai';
    } else if (model.startsWith('claude-')) {
      provider = 'anthropic';
    } else if (model.startsWith('gemini-')) {
      provider = 'google';
    } else if (model.startsWith('azure-')) {
      provider = 'azure';
    }
    
    models.push({ model, pricing, provider });
  }
  
  return models;
}

/**
 * Compare costs across different models
 */
export function compareCosts(
  models: string[],
  inputTokens: number,
  outputTokens: number
): Array<{
  model: string;
  cost: number;
  costPerRequest: string;
}> {
  return models
    .map((model) => ({
      model,
      cost: calculateCost(model, inputTokens, outputTokens),
      costPerRequest: `$${calculateCost(model, inputTokens, outputTokens).toFixed(6)}`,
    }))
    .sort((a, b) => a.cost - b.cost);
}

/**
 * Get cheapest model for a given token count
 */
export function getCheapestModel(
  inputTokens: number,
  outputTokens: number,
  requiredCapabilities: 'completion' | 'embedding' = 'completion'
): { model: string; cost: number } | null {
  let cheapestModel: string | null = null;
  let cheapestCost = Infinity;
  
  for (const model of Object.keys(MODEL_PRICING)) {
    // Filter by capability
    if (requiredCapabilities === 'embedding' && !model.includes('embedding')) {
      continue;
    }
    if (requiredCapabilities === 'completion' && model.includes('embedding')) {
      continue;
    }
    
    const cost = calculateCost(model, inputTokens, outputTokens);
    if (cost < cheapestCost) {
      cheapestCost = cost;
      cheapestModel = model;
    }
  }
  
  if (!cheapestModel) {
    return null;
  }
  
  return { model: cheapestModel, cost: cheapestCost };
}

// Export singleton object for convenient use
export const tokenCostCalculator = {
  calculateCost,
  estimateTokens,
  estimateCostForText,
  getModelPricing,
  getAllModelPricing,
  compareCosts,
  getCheapestModel,
};
