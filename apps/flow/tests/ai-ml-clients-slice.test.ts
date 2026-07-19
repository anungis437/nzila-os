import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockBuildAiEngineVersion,
  mockCreateAiClient,
  mockAiGenerate,
  mockAiEmbed,
  mockAiExtract,
  mockCreateMlClient,
  mockGetInferenceRuns,
} = vi.hoisted(() => ({
  mockBuildAiEngineVersion: vi.fn((provider: string, model: string) => `${provider}:${model}`),
  mockCreateAiClient: vi.fn(),
  mockAiGenerate: vi.fn(),
  mockAiEmbed: vi.fn(),
  mockAiExtract: vi.fn(),
  mockCreateMlClient: vi.fn(),
  mockGetInferenceRuns: vi.fn(),
}))

vi.mock('@nzila/ai-sdk', () => ({
  buildAiEngineVersion: mockBuildAiEngineVersion,
  createAiClient: mockCreateAiClient,
}))

vi.mock('@nzila/ml-sdk', () => ({
  createMlClient: mockCreateMlClient,
}))

describe('ai/ml client slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    mockCreateAiClient.mockReturnValue({
      generate: mockAiGenerate,
      embed: mockAiEmbed,
      extract: mockAiExtract,
    })

    mockCreateMlClient.mockReturnValue({
      getInferenceRuns: mockGetInferenceRuns,
    })

    vi.stubEnv('NODE_ENV', 'test')
    delete process.env.AI_CORE_URL
    delete process.env.AI_API_KEY
    delete process.env.ML_CORE_URL
    delete process.env.ML_API_KEY
  })

  it('ai client resolves defaults, creates singleton, and maps completion/embed/extraction telemetry', async () => {
    mockAiGenerate.mockResolvedValueOnce({
      requestId: 'req-1',
      provider: 'openai',
      model: 'gpt-test',
      content: 'ok',
      tokensIn: 11,
      tokensOut: 22,
      costUsd: 0.03,
      latencyMs: 150,
    })
    mockAiGenerate.mockResolvedValueOnce({
      requestId: 'req-1b',
      provider: 'openai',
      model: 'gpt-test',
      content: 'ok',
      tokensIn: 11,
      tokensOut: 22,
      costUsd: 0.03,
      latencyMs: 150,
    })
    mockAiEmbed.mockResolvedValueOnce({
      requestId: 'req-2',
      model: 'text-embed',
      embeddings: [[0.1, 0.2]],
      tokensUsed: 9,
      latencyMs: 45,
    })
    mockAiExtract.mockResolvedValueOnce({
      requestId: 'req-3',
      provider: 'openai',
      model: 'gpt-extract',
      data: { foo: 'bar' },
      latencyMs: 30,
      costUsd: 0.01,
      tokensIn: 4,
      tokensOut: 3,
    })

    const ai = await import('@/lib/ai-client')

    const clientA = ai.getAiClient()
    const clientB = ai.getAiClient()
    expect(clientA).toBe(clientB)
    expect(mockCreateAiClient).toHaveBeenCalledTimes(1)

    const completion = await ai.runAICompletionDetailed('prompt')
    expect(completion.content).toBe('ok')
    expect(completion.execution.engineVersion).toBe('openai:gpt-test')
    expect(await ai.runAICompletion('prompt2')).toBe('ok')

    const embed = await ai.runAIEmbedDetailed(['a', 'b'])
    expect(embed.embeddings).toEqual([[0.1, 0.2]])
    expect(embed.execution.provider).toBe('ai')

    const extracted = await ai.runAIExtractionDetailed('input', 'prompt-key', {
      variables: { a: 'b' },
    })
    expect(extracted.data).toEqual({ foo: 'bar' })
    expect(extracted.execution.modelUsed).toBe('gpt-extract')
  })

  it('ai client throws outside test/dev when AI_CORE_URL is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const ai = await import('@/lib/ai-client')

    expect(() => ai.getAiClient()).toThrow('Missing required environment variable outside dev/test: AI_CORE_URL')
  })

  it('ml client resolves defaults and returns null when model run is absent', async () => {
    mockGetInferenceRuns.mockResolvedValueOnce([
      {
        id: 'run-1',
        modelKey: 'other-model',
        startedAt: '2024-01-01T00:00:00.000Z',
        finishedAt: '2024-01-01T00:00:10.000Z',
        summaryJson: { score: 1 },
      },
    ])
    mockGetInferenceRuns.mockResolvedValueOnce([
      {
        id: 'run-1b',
        modelKey: 'other-model',
        startedAt: '2024-01-01T00:00:00.000Z',
        finishedAt: '2024-01-01T00:00:10.000Z',
        summaryJson: { score: 1 },
      },
    ])

    const ml = await import('@/lib/ml-client')
    const clientA = ml.getMlClient()
    const clientB = ml.getMlClient()

    expect(clientA).toBe(clientB)
    expect(mockCreateMlClient).toHaveBeenCalledTimes(1)

    expect(await ml.runPrediction({ model: 'missing' })).toBeNull()

    const detailed = await ml.runPredictionDetailed({ model: 'missing' })
    expect(detailed).toEqual({ data: null, execution: null })
  })

  it('ml prediction detailed maps execution metadata and latency', async () => {
    mockGetInferenceRuns.mockResolvedValueOnce([
      {
        id: 'run-2',
        modelKey: 'demand-forecast',
        startedAt: '2024-01-01T00:00:00.000Z',
        finishedAt: '2024-01-01T00:00:02.000Z',
        summaryJson: { demand: 42 },
      },
    ])

    const ml = await import('@/lib/ml-client')
    const detailed = await ml.runPredictionDetailed({ model: 'demand-forecast', orgId: 'org-1' })

    expect(detailed.data).toEqual({ demand: 42 })
    expect(detailed.execution?.provider).toBe('ml')
    expect(detailed.execution?.engineVersion).toBe('ml:demand-forecast')
    expect(detailed.execution?.latencyMs).toBe(2000)
  })

  it('ml client throws outside test/dev when ML_CORE_URL is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const ml = await import('@/lib/ml-client')

    expect(() => ml.getMlClient()).toThrow('Missing required environment variable outside dev/test: ML_CORE_URL')
  })
})
