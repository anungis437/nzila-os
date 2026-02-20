/**
 * ESLint — No Shadow AI Rule
 *
 * Prevents direct imports of AI provider SDKs or @nzila/ai-core/providers
 * in app code. All AI calls must go through @nzila/ai-sdk.
 *
 * Usage in your eslint.config.mjs:
 *
 *   import noShadowAi from '@nzila/ai-sdk/eslint-no-shadow-ai'
 *   export default [
 *     ...otherConfigs,
 *     noShadowAi,
 *   ]
 */

/** @type {import('eslint').Linter.FlatConfig} */
const noShadowAiConfig = {
  name: 'nzila/no-shadow-ai',
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@nzila/ai-core/providers/*'],
            message:
              'Direct provider imports are prohibited. Use @nzila/ai-sdk instead. See packages/ai-sdk/README.md.',
          },
          {
            group: ['openai', 'openai/*'],
            message:
              'Direct OpenAI SDK usage is prohibited. Use @nzila/ai-sdk for all AI calls — it provides governance, auditing, and policy enforcement.',
          },
          {
            group: ['@azure/openai', '@azure/openai/*'],
            message:
              'Direct Azure OpenAI SDK usage is prohibited. Use @nzila/ai-sdk for all AI calls.',
          },
          {
            group: ['anthropic', '@anthropic-ai/*'],
            message:
              'Direct Anthropic SDK usage is prohibited. Use @nzila/ai-sdk for all AI calls.',
          },
          {
            group: ['@google/generative-ai', '@google-cloud/aiplatform'],
            message:
              'Direct Google AI SDK usage is prohibited. Use @nzila/ai-sdk for all AI calls.',
          },
          {
            group: ['cohere-ai', 'cohere-ai/*'],
            message:
              'Direct Cohere SDK usage is prohibited. Use @nzila/ai-sdk for all AI calls.',
          },
        ],
      },
    ],
  },
}

export default noShadowAiConfig
