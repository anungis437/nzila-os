/**
 * Tests for ai-env.ts — AI Control Plane environment configuration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// We must reset modules between tests because getAiEnv() is a singleton
describe('ai-env', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('AI_') || key.startsWith('AZURE_OPENAI') || key.startsWith('AZURE_STORAGE') || key.startsWith('OPENAI_') || key.startsWith('ANTHROPIC_')) {
        delete process.env[key]
      }
    }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  async function loadModule() {
    return import('../ai-env') as Promise<typeof import('../ai-env')>
  }

  describe('getAiEnv', () => {
    it('returns validated config with azure_openai defaults when all required vars set', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'azure_openai'
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/'
      process.env.AZURE_OPENAI_API_KEY = 'test-key'
      process.env.AZURE_OPENAI_DEPLOYMENT_TEXT = 'gpt-4'
      process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDINGS = 'text-embedding-3-small'

      const { getAiEnv } = await loadModule()
      const env = getAiEnv()

      expect(env.AI_DEFAULT_PROVIDER).toBe('azure_openai')
      expect(env.AZURE_OPENAI_ENDPOINT).toBe('https://test.openai.azure.com/')
      expect(env.AZURE_OPENAI_API_KEY).toBe('test-key')
      expect(env.AZURE_OPENAI_API_VERSION).toBe('2024-06-01')
      expect(env.AI_LOG_PAYLOADS).toBe(true)
      expect(env.AI_REDACTION_MODE).toBe('strict')
      expect(env.AI_MAX_TOKENS_DEFAULT).toBe(1024)
      expect(env.AI_TEMPERATURE_DEFAULT).toBe(0.2)
      expect(env.AZURE_STORAGE_CONTAINER_EVIDENCE).toBe('evidence')
      expect(env.AZURE_STORAGE_CONTAINER_EXPORTS).toBe('exports')
    })

    it('caches the validated config on second call', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'azure_openai'
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/'
      process.env.AZURE_OPENAI_API_KEY = 'key'
      process.env.AZURE_OPENAI_DEPLOYMENT_TEXT = 'gpt-4'
      process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDINGS = 'embed'

      const { getAiEnv } = await loadModule()
      const first = getAiEnv()
      const second = getAiEnv()
      expect(first).toBe(second) // same reference
    })

    it('throws when azure_openai provider is missing required vars', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'azure_openai'
      // Missing AZURE_OPENAI_ENDPOINT, etc.

      const { getAiEnv } = await loadModule()
      expect(() => getAiEnv()).toThrow('Missing or invalid environment variables')
    })

    it('throws when openai provider is missing OPENAI_API_KEY', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'openai'
      // Missing OPENAI_API_KEY

      const { getAiEnv } = await loadModule()
      expect(() => getAiEnv()).toThrow('Missing or invalid environment variables')
    })

    it('succeeds with openai provider when key is provided', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'openai'
      process.env.OPENAI_API_KEY = 'sk-test-key'

      const { getAiEnv } = await loadModule()
      const env = getAiEnv()
      expect(env.AI_DEFAULT_PROVIDER).toBe('openai')
      expect(env.OPENAI_API_KEY).toBe('sk-test-key')
    })

    it('throws when anthropic provider is missing ANTHROPIC_API_KEY', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'anthropic'

      const { getAiEnv } = await loadModule()
      expect(() => getAiEnv()).toThrow('Missing or invalid environment variables')
    })

    it('succeeds with anthropic provider when key is provided', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'anthropic'
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test'

      const { getAiEnv } = await loadModule()
      const env = getAiEnv()
      expect(env.AI_DEFAULT_PROVIDER).toBe('anthropic')
    })

    it('parses AI_LOG_PAYLOADS=false correctly', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'openai'
      process.env.OPENAI_API_KEY = 'sk-test'
      process.env.AI_LOG_PAYLOADS = 'false'

      const { getAiEnv } = await loadModule()
      const env = getAiEnv()
      expect(env.AI_LOG_PAYLOADS).toBe(false)
    })

    it('parses numeric env vars (AI_MAX_TOKENS_DEFAULT, AI_TEMPERATURE_DEFAULT)', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'openai'
      process.env.OPENAI_API_KEY = 'sk-test'
      process.env.AI_MAX_TOKENS_DEFAULT = '4096'
      process.env.AI_TEMPERATURE_DEFAULT = '0.7'

      const { getAiEnv } = await loadModule()
      const env = getAiEnv()
      expect(env.AI_MAX_TOKENS_DEFAULT).toBe(4096)
      expect(env.AI_TEMPERATURE_DEFAULT).toBe(0.7)
    })

    it('accepts optional AI_EMBEDDINGS_PROVIDER', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'openai'
      process.env.OPENAI_API_KEY = 'sk-test'
      process.env.AI_EMBEDDINGS_PROVIDER = 'azure_openai'

      const { getAiEnv } = await loadModule()
      const env = getAiEnv()
      expect(env.AI_EMBEDDINGS_PROVIDER).toBe('azure_openai')
    })

    it('accepts optional AI_ENCRYPTION_KEY', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'openai'
      process.env.OPENAI_API_KEY = 'sk-test'
      process.env.AI_ENCRYPTION_KEY = 'my-encryption-key'

      const { getAiEnv } = await loadModule()
      const env = getAiEnv()
      expect(env.AI_ENCRYPTION_KEY).toBe('my-encryption-key')
    })
  })

  describe('isAiConfigured', () => {
    it('returns true when AI env is properly configured', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'openai'
      process.env.OPENAI_API_KEY = 'sk-test'

      const { isAiConfigured } = await loadModule()
      expect(isAiConfigured()).toBe(true)
    })

    it('returns false when required vars are missing', async () => {
      process.env.AI_DEFAULT_PROVIDER = 'azure_openai'
      // Missing all Azure vars

      const { isAiConfigured } = await loadModule()
      expect(isAiConfigured()).toBe(false)
    })
  })
})
