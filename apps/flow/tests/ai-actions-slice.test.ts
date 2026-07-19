import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockResolveOrgContext,
  mockPlatformExecute,
  mockLogger,
  mockBuildCanonicalAiOutput,
  mockRunAICompletionDetailed,
  mockRunAIEmbedDetailed,
  mockRunAIExtractionDetailed,
  mockRunPredictionDetailed,
  mockBuildEvidencePackFromAction,
  mockProcessEvidencePack,
} = vi.hoisted(() => ({
  mockResolveOrgContext: vi.fn(),
  mockPlatformExecute: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockBuildCanonicalAiOutput: vi.fn(),
  mockRunAICompletionDetailed: vi.fn(),
  mockRunAIEmbedDetailed: vi.fn(),
  mockRunAIExtractionDetailed: vi.fn(),
  mockRunPredictionDetailed: vi.fn(),
  mockBuildEvidencePackFromAction: vi.fn(),
  mockProcessEvidencePack: vi.fn(),
}))

vi.mock('@/lib/resolve-org', () => ({
  resolveOrgContext: mockResolveOrgContext,
}))

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    execute: mockPlatformExecute,
  },
}))

vi.mock('drizzle-orm', () => ({
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('@nzila/ai-sdk', () => ({
  buildCanonicalAiOutput: mockBuildCanonicalAiOutput,
}))

vi.mock('@/lib/ai-client', () => ({
  runAICompletionDetailed: mockRunAICompletionDetailed,
  runAIEmbedDetailed: mockRunAIEmbedDetailed,
  runAIExtractionDetailed: mockRunAIExtractionDetailed,
}))

vi.mock('@/lib/ml-client', () => ({
  runPredictionDetailed: mockRunPredictionDetailed,
}))

vi.mock('@/lib/evidence', () => ({
  buildEvidencePackFromAction: mockBuildEvidencePackFromAction,
  processEvidencePack: mockProcessEvidencePack,
}))

describe('ai actions slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1', actorId: 'user-1' })
    mockBuildCanonicalAiOutput.mockImplementation((input) => input)
    mockPlatformExecute.mockResolvedValue([])

    mockRunAICompletionDetailed.mockResolvedValue({
      content: '[]',
      execution: { modelUsed: 'gpt', provider: 'aoai', engineVersion: 'v1' },
    })

    mockRunAIEmbedDetailed.mockResolvedValue({
      embeddings: [0.1, 0.2],
      execution: { modelUsed: 'embed', provider: 'aoai', engineVersion: 'v1' },
    })

    mockRunAIExtractionDetailed.mockResolvedValue({
      data: {
        clientName: 'Acme Corp',
        clientEmail: 'buyer@acme.test',
        items: [{ description: 'Tea Hamper', quantity: 25 }],
        budget: 5000,
        deadline: '2026-10-01',
        notes: 'Board gifts',
      },
      execution: { modelUsed: 'extract', provider: 'aoai', engineVersion: 'v1' },
    })

    mockRunPredictionDetailed.mockResolvedValue({
      data: {
        probability: 0.81,
        factors: [{ name: 'history', impact: 'positive', weight: 0.4 }],
        recommendation: 'Fast-track quote',
      },
      execution: { modelUsed: 'ml-predict', provider: 'ml', engineVersion: 'v1' },
    })

    mockBuildEvidencePackFromAction.mockReturnValue({ id: 'pack-1' })
    mockProcessEvidencePack.mockResolvedValue(undefined)
  })

  it('covers getSmartPricing success, parse-failure, and outer-failure branches', async () => {
    const actions = await import('@/lib/ai-actions')

    mockPlatformExecute.mockResolvedValueOnce([{ tier: 'PREMIUM', total: '100' }])
    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: JSON.stringify([
        { sku: 'SKU-1', description: 'Luxury Box', suggestedPrice: 120, confidence: 0.9, reasoning: 'premium' },
      ]),
      execution: { modelUsed: 'pricing', provider: 'aoai', engineVersion: 'v1' },
    })

    const ok = await actions.getSmartPricing({ tier: 'PREMIUM', boxCount: 20, theme: 'Holiday', clientHistory: 'VIP' })
    expect(ok.length).toBe(1)
    expect(ok[0]).toMatchObject({
      payload: {
        sku: 'SKU-1',
        description: 'Luxury Box',
        suggestedPrice: 120,
        confidence: 0.9,
      },
    })

    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: 'not-json',
      execution: { modelUsed: 'pricing', provider: 'aoai', engineVersion: 'v1' },
    })
    const parseFail = await actions.getSmartPricing({ tier: 'STANDARD', boxCount: 5, theme: 'Welcome' })
    expect(parseFail).toEqual([])
    expect(mockLogger.warn).toHaveBeenCalled()

    mockPlatformExecute.mockRejectedValueOnce(new Error('db unavailable'))
    const outerFail = await actions.getSmartPricing({ tier: 'BUDGET', boxCount: 1, theme: 'Basic' })
    expect(outerFail).toEqual([])
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('covers findSimilarProducts with empty embeddings, success, parse-failure, and error branches', async () => {
    const actions = await import('@/lib/ai-actions')

    mockRunAIEmbedDetailed.mockResolvedValueOnce({ embeddings: [] })
    await expect(actions.findSimilarProducts('gift box', 3)).resolves.toEqual([])

    mockRunAIEmbedDetailed.mockResolvedValueOnce({ embeddings: [0.4] })
    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: JSON.stringify([
        { sku: 'SIM-1', name: 'Wellness Basket', similarity: 0.92 },
        { sku: 'SIM-2', name: 'Tea Bundle', similarity: 0.87 },
      ]),
      execution: { modelUsed: 'recommend', provider: 'aoai', engineVersion: 'v1' },
    })
    const ok = await actions.findSimilarProducts('wellness gift', 1)
    expect(ok.length).toBe(1)
    expect(ok[0]).toMatchObject({ payload: { sku: 'SIM-1', similarity: 0.92 } })

    mockRunAIEmbedDetailed.mockResolvedValueOnce({ embeddings: [0.2] })
    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: '{bad json',
      execution: { modelUsed: 'recommend', provider: 'aoai', engineVersion: 'v1' },
    })
    await expect(actions.findSimilarProducts('bad parse')).resolves.toEqual([])

    mockRunAIEmbedDetailed.mockRejectedValueOnce(new Error('embed unavailable'))
    await expect(actions.findSimilarProducts('error path')).resolves.toEqual([])
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('covers extractFromRfp success and failure branches', async () => {
    const actions = await import('@/lib/ai-actions')

    const ok = await actions.extractFromRfp('Need 25 holiday boxes under $5000')
    expect(ok).toMatchObject({
      payload: {
        clientName: 'Acme Corp',
        clientEmail: 'buyer@acme.test',
        budget: 5000,
      },
    })
    expect(mockBuildEvidencePackFromAction).toHaveBeenCalled()
    expect(mockProcessEvidencePack).toHaveBeenCalled()

    mockRunAIExtractionDetailed.mockRejectedValueOnce(new Error('extract unavailable'))
    await expect(actions.extractFromRfp('bad input')).resolves.toBeNull()
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('covers predictConversion ML and fallback branches', async () => {
    const actions = await import('@/lib/ai-actions')

    const ml = await actions.predictConversion('quote-ml')
    expect(ml).toMatchObject({
      payload: {
        probability: 0.81,
        recommendation: 'Fast-track quote',
      },
    })

    mockRunPredictionDetailed.mockResolvedValueOnce({ data: null, execution: undefined })
    mockPlatformExecute.mockResolvedValueOnce([])
    await expect(actions.predictConversion('quote-none')).resolves.toBeNull()

    mockRunPredictionDetailed.mockResolvedValueOnce({ data: null, execution: undefined })
    mockPlatformExecute.mockResolvedValueOnce([{ metadata: { dealSize: 'large' } }])
    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: JSON.stringify({
        probability: 0.67,
        factors: [{ name: 'deal-size', impact: 'positive', weight: 0.3 }],
        recommendation: 'Assign senior AE',
      }),
      execution: { modelUsed: 'predict-fallback', provider: 'aoai', engineVersion: 'v1' },
    })

    const fallback = await actions.predictConversion('quote-fallback')
    expect(fallback).toMatchObject({
      payload: {
        probability: 0.67,
        recommendation: 'Assign senior AE',
      },
    })

    mockRunPredictionDetailed.mockResolvedValueOnce({ data: null, execution: undefined })
    mockPlatformExecute.mockResolvedValueOnce([{ metadata: { dealSize: 'small' } }])
    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: 'not-json',
      execution: { modelUsed: 'predict-fallback', provider: 'aoai', engineVersion: 'v1' },
    })

    await expect(actions.predictConversion('quote-bad-json')).resolves.toBeNull()

    mockRunPredictionDetailed.mockRejectedValueOnce(new Error('prediction service down'))
    await expect(actions.predictConversion('quote-error')).resolves.toBeNull()
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('covers coercion defaults and non-array JSON branches', async () => {
    const actions = await import('@/lib/ai-actions')

    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: JSON.stringify({ sku: 'not-an-array' }),
      execution: { modelUsed: 'pricing', provider: 'aoai', engineVersion: 'v1' },
    })
    await expect(actions.getSmartPricing({ tier: 'PREMIUM', boxCount: 10, theme: 'Seasonal' })).resolves.toEqual([])

    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: JSON.stringify([
        { sku: 123, description: null, suggestedPrice: 'n/a', confidence: 'high', reasoning: 9 },
      ]),
      execution: { modelUsed: 'pricing', provider: 'aoai', engineVersion: 'v1' },
    })
    const pricingDefaults = await actions.getSmartPricing({ tier: 'STANDARD', boxCount: 2, theme: 'Welcome' })
    expect(pricingDefaults[0]).toMatchObject({
      payload: {
        sku: 'unknown',
        description: '',
        suggestedPrice: 0,
        confidence: 0.65,
        reasoning: '',
      },
    })

    mockRunAIEmbedDetailed.mockResolvedValueOnce({ embeddings: [0.2] })
    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: JSON.stringify({ sku: 'not-an-array' }),
      execution: { modelUsed: 'recommend', provider: 'aoai', engineVersion: 'v1' },
    })
    await expect(actions.findSimilarProducts('tea and snacks')).resolves.toEqual([])

    mockRunAIEmbedDetailed.mockResolvedValueOnce({ embeddings: [0.2] })
    mockRunAICompletionDetailed.mockResolvedValueOnce({
      content: JSON.stringify([{ sku: 1, name: null, similarity: 'nope' }]),
      execution: { modelUsed: 'recommend', provider: 'aoai', engineVersion: 'v1' },
    })
    const similarDefaults = await actions.findSimilarProducts('tea and snacks', 1)
    expect(similarDefaults[0]).toMatchObject({
      payload: {
        sku: 'unknown',
        name: '',
        similarity: 0.5,
      },
    })

    mockRunAIExtractionDetailed.mockResolvedValueOnce({
      data: {
        clientName: undefined,
        clientEmail: undefined,
        items: 'bad-items',
        budget: 'not-number',
        deadline: undefined,
        notes: undefined,
      },
      execution: { modelUsed: 'extract', provider: 'aoai', engineVersion: 'v1' },
    })
    const extractionDefaults = await actions.extractFromRfp('short rfp')
    expect(extractionDefaults).toMatchObject({
      payload: {
        clientName: null,
        clientEmail: null,
        items: [],
        budget: null,
        deadline: null,
        notes: null,
      },
    })

    mockRunPredictionDetailed.mockResolvedValueOnce({
      data: { probability: 'bad', factors: 'bad', recommendation: 7 },
      execution: undefined,
    })
    const mlDefaults = await actions.predictConversion('quote-ml-defaults')
    expect(mlDefaults).toMatchObject({
      payload: {
        probability: 0,
        factors: [],
        recommendation: '',
      },
      confidenceScore: 0.5,
      execution: {
        modelUsed: 'quote-conversion-predictor',
      },
    })
  })
})
