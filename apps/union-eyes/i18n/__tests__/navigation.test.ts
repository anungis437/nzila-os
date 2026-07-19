import { describe, expect, it, vi } from 'vitest';

const createNavigationMock = vi.fn((config: unknown) => ({
  Link: () => null,
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
  __config: config,
}));

vi.mock('next-intl/navigation', () => ({
  createNavigation: createNavigationMock,
}));

describe('i18n/navigation', () => {
  it('configures next-intl navigation with the union-eyes locales', async () => {
    const nav = await import('../navigation');

    expect(createNavigationMock).toHaveBeenCalledTimes(1);
    const config = createNavigationMock.mock.calls[0]![0] as {
      locales: readonly string[];
      defaultLocale: string;
      localePrefix: string;
    };
    expect(config.locales).toContain('en-CA');
    expect(config.defaultLocale).toBe('en-CA');
    expect(config.localePrefix).toBe('always');

    expect(nav.Link).toBeDefined();
    expect(nav.redirect).toBeDefined();
    expect(nav.usePathname).toBeDefined();
    expect(nav.useRouter).toBeDefined();
  });
});
