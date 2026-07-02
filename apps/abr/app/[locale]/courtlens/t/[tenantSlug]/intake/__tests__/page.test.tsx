/**
 * @vitest-environment jsdom
 *
 * CourtLens Phase 2F public intake page tests.
 * Proves the server-side tenantSlug pre-check.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isValidTenantSlug: vi.fn(),
  resolveTenantSlug: vi.fn(),
}));

vi.mock('@/modules/tenants/tenant-resolver', async () => {
  const actual = await vi.importActual<typeof import('@/modules/tenants/tenant-resolver')>(
    '@/modules/tenants/tenant-resolver',
  );
  return {
    ...actual,
    isValidTenantSlug: mocks.isValidTenantSlug,
    resolveTenantSlug: mocks.resolveTenantSlug,
  };
});

// PublicIntakeForm is a client component; mock it to isolate page-level logic.
vi.mock('../PublicIntakeForm', () => ({
  PublicIntakeForm: ({ tenantSlug }: { tenantSlug: string }) => (
    <div data-testid="mocked-form" data-slug={tenantSlug}>form</div>
  ),
}));

import { TenantNotFoundError } from '@/modules/tenants/tenant-resolver';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('PublicIntakePage — server pre-check', () => {
  it('renders unavailable state for malformed slug', async () => {
    mocks.isValidTenantSlug.mockReturnValue(false);
    const { default: Page } = await import('../page');

    const el = await Page({
      params: Promise.resolve({ locale: 'en-CA', tenantSlug: 'ab' }),
    });
    render(el);

    expect(screen.getByTestId('intake-unavailable')).toBeDefined();
    expect(mocks.resolveTenantSlug).not.toHaveBeenCalled();
  });

  it('renders unavailable state for unknown tenant', async () => {
    mocks.isValidTenantSlug.mockReturnValue(true);
    mocks.resolveTenantSlug.mockRejectedValue(new TenantNotFoundError('nope'));
    const { default: Page } = await import('../page');

    const el = await Page({
      params: Promise.resolve({ locale: 'en-CA', tenantSlug: 'nope' }),
    });
    render(el);

    expect(screen.getByTestId('intake-unavailable')).toBeDefined();
  });

  it('renders form for valid, resolvable tenant slug', async () => {
    mocks.isValidTenantSlug.mockReturnValue(true);
    mocks.resolveTenantSlug.mockResolvedValue({ orgId: 'metro-university', name: 'Metro University' });
    const { default: Page } = await import('../page');

    const el = await Page({
      params: Promise.resolve({ locale: 'en-CA', tenantSlug: 'metro-university' }),
    });
    render(el);

    expect(screen.getByTestId('mocked-form')).toBeDefined();
    expect(screen.getByTestId('mocked-form').getAttribute('data-slug')).toBe('metro-university');
    // Does not leak tenant name on the page
    expect(screen.getByText(/CourtLens Access/i)).toBeDefined();
  });

  it('unavailable state includes "not legal advice" framing', async () => {
    mocks.isValidTenantSlug.mockReturnValue(false);
    const { default: Page } = await import('../page');

    const el = await Page({
      params: Promise.resolve({ locale: 'en-CA', tenantSlug: 'ab' }),
    });
    render(el);

    expect(screen.getByText(/not legal advice/i)).toBeDefined();
  });
});
