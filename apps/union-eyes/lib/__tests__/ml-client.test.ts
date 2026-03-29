import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createMlClient: vi.fn(),
  mockGetInferenceRuns: vi.fn(),
}));

vi.mock('@nzila/ml-sdk', () => ({
  createMlClient: mocks.createMlClient,
}));

describe('ml-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mocks.createMlClient.mockReturnValue({
      getInferenceRuns: mocks.mockGetInferenceRuns,
    });
  });

  it('getMlClient creates a singleton ML client', async () => {
    process.env.ML_CORE_URL = 'http://ml:4200';
    process.env.ML_API_KEY = 'test-key';

    const { getMlClient } = await import('../ml-client');
    const client = getMlClient();

    expect(mocks.createMlClient).toHaveBeenCalledWith({
      baseUrl: 'http://ml:4200',
      getToken: expect.any(Function),
    });
    expect(client).toBeDefined();
  });

  it('makeMlClient creates a client-side ML client with token', async () => {
    process.env.NEXT_PUBLIC_CONSOLE_URL = 'http://console:3001';
    const { makeMlClient } = await import('../ml-client');
    const getToken = vi.fn().mockResolvedValue('clerk-token');

    makeMlClient(getToken);

    expect(mocks.createMlClient).toHaveBeenCalledWith({
      baseUrl: 'http://console:3001',
      getToken: expect.any(Function),
    });
  });

  it('runPrediction returns matching inference result', async () => {
    process.env.ML_CORE_URL = 'http://ml:4200';
    process.env.ML_API_KEY = 'key';

    mocks.mockGetInferenceRuns.mockResolvedValue([
      { modelKey: 'sentiment', summaryJson: { score: 0.95 } },
      { modelKey: 'classify', summaryJson: { class: 'A' } },
    ]);

    const { runPrediction } = await import('../ml-client');
    const result = await runPrediction({ model: 'sentiment' });

    expect(result).toEqual({ score: 0.95 });
  });

  it('runPrediction returns null when no matching model', async () => {
    process.env.ML_CORE_URL = 'http://ml:4200';
    process.env.ML_API_KEY = 'key';

    mocks.mockGetInferenceRuns.mockResolvedValue([
      { modelKey: 'other', summaryJson: {} },
    ]);

    const { runPrediction } = await import('../ml-client');
    const result = await runPrediction({ model: 'nonexistent' });

    expect(result).toBeNull();
  });
});
