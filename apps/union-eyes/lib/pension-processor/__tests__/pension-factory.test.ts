import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  cppInit: vi.fn(),
  otppInit: vi.fn(),
}));

vi.mock('@/lib/pension-processor/processors/cpp-qpp-processor', () => ({
  CPPQPPProcessor: class {
    type: string;
    constructor(type: string) { this.type = type; }
    initialize = h.cppInit;
    getCapabilities() { return { supportsBuyBack: true }; }
  },
}));

vi.mock('@/lib/pension-processor/processors/otpp-processor', () => ({
  OTTPProcessor: class {
    type = 'otpp';
    initialize = h.otppInit;
    getCapabilities() { return { supportsBuyBack: false }; }
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { PensionProcessorFactory } from '../pension-factory';

const config = {
  environment: 'sandbox' as const,
};

function factoryConfig(defaultPlan?: string) {
  return {
    defaultPlan: defaultPlan as never,
    plans: {
      cpp: config,
      otpp: config,
    } as never,
  };
}

let factory: PensionProcessorFactory;

beforeEach(() => {
  h.cppInit.mockReset().mockResolvedValue(undefined);
  h.otppInit.mockReset().mockResolvedValue(undefined);
  factory = PensionProcessorFactory.getInstance();
  factory.reset();
});

describe('PensionProcessorFactory', () => {
  it('getInstance returns a singleton', () => {
    expect(PensionProcessorFactory.getInstance()).toBe(factory);
  });

  it('initialize creates and initializes configured processors', async () => {
    await factory.initialize(factoryConfig('cpp'));
    expect(factory.getAvailableProcessors().sort()).toEqual(['cpp', 'otpp']);
    expect(h.cppInit).toHaveBeenCalled();
    expect(h.otppInit).toHaveBeenCalled();
  });

  it('initialize is a no-op when already initialized', async () => {
    await factory.initialize(factoryConfig('cpp'));
    h.cppInit.mockClear();
    await factory.initialize(factoryConfig('cpp'));
    expect(h.cppInit).not.toHaveBeenCalled();
  });

  it('initialize skips unknown plan types', async () => {
    await factory.initialize({
      defaultPlan: 'cpp' as never,
      plans: { cpp: config, bogus: config } as never,
    });
    expect(factory.isProcessorAvailable('bogus' as never)).toBe(false);
  });

  it('initialize rejects and removes a failing processor', async () => {
    h.cppInit.mockRejectedValue(new Error('init failed'));
    await expect(factory.initialize(factoryConfig('cpp'))).rejects.toThrow('init failed');
  });

  it('getProcessor returns a configured processor', async () => {
    await factory.initialize(factoryConfig('cpp'));
    expect(factory.getProcessor('cpp' as never)).toBeDefined();
  });

  it('getProcessor throws for missing processor', async () => {
    await factory.initialize(factoryConfig('cpp'));
    expect(() => factory.getProcessor('qpp' as never)).toThrow(/not configured/);
  });

  it('getProcessor throws when not initialized', () => {
    expect(() => factory.getProcessor('cpp' as never)).toThrow(/not initialized/);
  });

  it('getDefaultProcessor returns the default plan processor', async () => {
    await factory.initialize(factoryConfig('cpp'));
    expect(factory.getDefaultProcessor()).toBeDefined();
  });

  it('getDefaultProcessor throws when no default configured', async () => {
    await factory.initialize(factoryConfig());
    expect(() => factory.getDefaultProcessor()).toThrow(/No default/);
  });

  it('isProcessorAvailable reflects configured processors', async () => {
    await factory.initialize(factoryConfig('cpp'));
    expect(factory.isProcessorAvailable('cpp' as never)).toBe(true);
    expect(factory.isProcessorAvailable('qpp' as never)).toBe(false);
  });

  it('getProcessorCapabilities delegates to the processor', async () => {
    await factory.initialize(factoryConfig('cpp'));
    expect(factory.getProcessorCapabilities('cpp' as never)).toEqual({ supportsBuyBack: true });
  });

  it('reset clears all state', async () => {
    await factory.initialize(factoryConfig('cpp'));
    factory.reset();
    expect(factory.getAvailableProcessors()).toEqual([]);
  });
});
