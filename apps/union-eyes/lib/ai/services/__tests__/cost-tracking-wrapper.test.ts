import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCheckLimit, mockRecordUsage } = vi.hoisted(() => ({
  mockCheckLimit: vi.fn(async () => ({ allowed: true, currentUsage: { requests: 0, tokens: 0, costUSD: 0 } })),
  mockRecordUsage: vi.fn(async () => {}),
}));

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn() })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  aiUsageMetrics: {},
  aiBudgets: { organizationId: 'organizationId' },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: {},
  organizations: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('../rate-limiter', () => ({
  aiRateLimiter: {
    checkLimit: mockCheckLimit,
    recordUsage: mockRecordUsage,
  },
}));

vi.mock('../token-cost-calculator', () => ({
  tokenCostCalculator: {
    getModelPricing: vi.fn(() => ({ inputPer1k: 0.01, outputPer1k: 0.03 })),
    calculateCost: vi.fn(() => 0.05),
    estimateTokens: vi.fn(() => 100),
  },
}));

vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: vi.fn(() => ({
    sendNotification: vi.fn(),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { CostTrackingWrapper } from '../cost-tracking-wrapper';

describe('CostTrackingWrapper', () => {
  let wrapper: CostTrackingWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckLimit.mockResolvedValue({ allowed: true, currentUsage: { requests: 0, tokens: 0, costUSD: 0 } });
    mockRecordUsage.mockResolvedValue(undefined);
    wrapper = new CostTrackingWrapper();
  });

  describe('trackLLMCall', () => {
    it('tracks a successful LLM call', async () => {
      const mockApiCall = vi.fn(async () => ({
        usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
        choices: [{ message: { content: 'Hello' } }],
      }));

      const result = await wrapper.trackLLMCall(
        'org-1',
        'user-1',
        { provider: 'openai', model: 'gpt-4', messages: [{ role: 'user', content: 'Hi' }] },
        mockApiCall,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.usage).toBeDefined();
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns error when rate limited', async () => {
      mockCheckLimit.mockResolvedValueOnce({
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: 30,
        currentUsage: { requests: 60, tokens: 50000, costUSD: 10 },
      });

      const result = await wrapper.trackLLMCall(
        'org-1',
        'user-1',
        { provider: 'openai', model: 'gpt-4', prompt: 'test' },
        vi.fn(),
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Rate limit');
      }
    });

    it('handles API call failure', async () => {
      const result = await wrapper.trackLLMCall(
        'org-1',
        'user-1',
        { provider: 'openai', model: 'gpt-4', prompt: 'test' },
        vi.fn(async () => { throw new Error('API error'); }),
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('API error');
      }
    });
  });
});
