/**
 * CLC Executive Intelligence — NIL Reasoning Service
 *
 * Concrete implementation of NilReasoningService for the executive
 * intelligence pipeline. Uses Azure OpenAI when configured, otherwise
 * gracefully reports unavailable (triggers deterministic fallback).
 *
 * Environment-gated: requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY
 * to activate. Without these, isAvailable() returns false and the
 * executive pipeline uses deterministic fallback outputs.
 *
 * @module lib/clc/nil-executive-service
 */

import type {
  NilReasoningService,
  NilRefinement,
  DecisionPromptContract,
} from '@nzila/clc-executive-intelligence';

// ── Configuration ───────────────────────────────────────────────────────────

interface NilServiceConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

function loadConfig(): NilServiceConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21';

  if (!endpoint || !apiKey) return null;
  return { endpoint, apiKey, deploymentName, apiVersion };
}

// ── Service Implementation ──────────────────────────────────────────────────

class AzureNilReasoningService implements NilReasoningService {
  private config: NilServiceConfig;

  constructor(config: NilServiceConfig) {
    this.config = config;
  }

  isAvailable(): boolean {
    return true;
  }

  async refine(
    contract: DecisionPromptContract,
    input: Record<string, unknown>,
  ): Promise<NilRefinement | null> {
    const url = `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;

    const body = {
      messages: [
        { role: 'system', content: contract.systemPrompt },
        {
          role: 'user',
          content: `Analyze the following data and respond with JSON containing these fields: ${contract.requiredOutputFields.join(', ')}.\n\nData:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`NIL service error: ${response.status}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Record<string, unknown>;

    return {
      headline: typeof parsed.headline === 'string' ? parsed.headline : undefined,
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
      keyTakeaway: typeof parsed.keyTakeaway === 'string' ? parsed.keyTakeaway : undefined,
      recommendedNextStep: typeof parsed.recommendedNextStep === 'string' ? parsed.recommendedNextStep : undefined,
    };
  }
}

// ── Unavailable Sentinel ────────────────────────────────────────────────────

class UnavailableNilService implements NilReasoningService {
  isAvailable(): boolean {
    return false;
  }

  async refine(): Promise<NilRefinement | null> {
    return null;
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

let cachedService: NilReasoningService | null = null;

/**
 * Create or retrieve the NIL reasoning service.
 * Returns an Azure OpenAI-backed service when configured,
 * otherwise returns an unavailable sentinel (deterministic fallback).
 */
export function getNilReasoningService(): NilReasoningService {
  if (cachedService) return cachedService;

  const config = loadConfig();
  cachedService = config
    ? new AzureNilReasoningService(config)
    : new UnavailableNilService();

  return cachedService;
}
