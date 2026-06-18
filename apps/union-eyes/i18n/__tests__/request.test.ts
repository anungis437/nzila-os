import { describe, expect, it, vi } from 'vitest';

// Capture the config factory passed to getRequestConfig so we can invoke it directly.
const getRequestConfigMock = vi.fn((factory: unknown) => factory);

vi.mock('next-intl/server', () => ({
  getRequestConfig: getRequestConfigMock,
}));

type RequestConfigFactory = (args: {
  locale: string | undefined;
}) => Promise<{ locale: string; messages: unknown; timeZone: string }>;

describe('i18n/request', () => {
  it('resolves config for a valid locale', async () => {
    const mod = await import('../request');
    const factory = mod.default as unknown as RequestConfigFactory;

    const result = await factory({ locale: 'fr-CA' });

    expect(result.locale).toBe('fr-CA');
    expect(result.timeZone).toBe('America/Toronto');
    expect(result.messages).toBeTypeOf('object');
  });

  it('falls back to the default locale for an unknown locale', async () => {
    const mod = await import('../request');
    const factory = mod.default as unknown as RequestConfigFactory;

    const result = await factory({ locale: 'zz-ZZ' });

    expect(result.locale).toBe('en-CA');
    expect(result.messages).toBeTypeOf('object');
  });

  it('falls back to the default locale when locale is undefined', async () => {
    const mod = await import('../request');
    const factory = mod.default as unknown as RequestConfigFactory;

    const result = await factory({ locale: undefined });

    expect(result.locale).toBe('en-CA');
  });
});
