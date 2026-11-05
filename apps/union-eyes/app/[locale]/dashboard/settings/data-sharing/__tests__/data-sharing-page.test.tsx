// @vitest-environment jsdom
import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getUserRole: vi.fn(),
  withRLSContext: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  plainSelect: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ requireUser: mocks.requireUser, getUserRole: mocks.getUserRole }));
// The consent read runs in the organization's own context. The module-level handle sets no organization, so the runtime role sees no consent row
// through it: the page must never read through that handle.
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: mocks.withRLSContext }));
vi.mock('@/db', () => ({ db: { select: mocks.plainSelect } }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => `[${key}]` }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import DataSharingPage from '../page';

const dialect = new PgDialect();

const ORG_ID = '0b7a1c3e-5d2f-4e8a-9b6c-1a2b3c4d5e6f';

const storedConsent = (overrides: Record<string, unknown> = {}) => ({
  consentGiven: true,
  consentDate: new Date('2026-01-15T00:00:00Z'),
  categories: ['grievance-type', 'sector-trend'],
  expiresAt: null,
  ...overrides,
});

async function renderPage(locale = 'en-CA') {
  const element = await DataSharingPage({ params: Promise.resolve({ locale }) });
  return render(element);
}

// Nothing on the page may let anyone record or withdraw consent, or claim that someone just did or still can.
function expectNoConsentAction() {
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(screen.queryAllByRole('switch')).toHaveLength(0);
  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(/granted successfully|revocable|opt out instantly|revoke consent at any time|You can revoke/i);
  expect(text).not.toMatch(/minimum 5 unions|statistical noise|never identified/i);
  expect(fetch).not.toHaveBeenCalled();
}

beforeEach(() => {
  mocks.requireUser.mockReset().mockResolvedValue({ userId: 'user-1', organizationId: ORG_ID });
  mocks.getUserRole.mockReset().mockResolvedValue('admin');
  mocks.limit.mockReset().mockResolvedValue([]);
  mocks.where.mockReset().mockReturnValue({ limit: mocks.limit });
  mocks.from.mockReset().mockReturnValue({ where: mocks.where });
  mocks.select.mockReset().mockReturnValue({ from: mocks.from });
  mocks.plainSelect.mockReset();
  mocks.withRLSContext
    .mockReset()
    .mockImplementation(async (_context: unknown, run: (tx: unknown) => unknown) => run({ select: mocks.select }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('settings/data-sharing: a read-only statement of the consent the feature reads', () => {
  it('shows a consent that is on record as stored, and says withdrawing it is not available', async () => {
    mocks.limit.mockResolvedValue([storedConsent({ expiresAt: new Date('2099-12-31T00:00:00Z') })]);
    await renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('[pageTitle]');
    expect(screen.getByText('Consent on record')).toBeInTheDocument();
    expect(screen.getByText('Date of consent')).toBeInTheDocument();
    expect(screen.getByText('January 15, 2026')).toBeInTheDocument();
    expect(screen.getByText('Expires on')).toBeInTheDocument();
    expect(screen.getByText('December 31, 2099')).toBeInTheDocument();
    expect(screen.getByText('Grievance types')).toBeInTheDocument();
    expect(screen.getByText('Sector trends')).toBeInTheDocument();
    expect(screen.queryByText('Systemic issues')).toBeNull();

    expect(screen.getByRole('alert')).toHaveTextContent('Not available in this release');
    expect(screen.getByRole('alert')).toHaveTextContent('UE-MOVEMENT-INSIGHTS-CONSENT-REVOCATION');
    expect(screen.getByText(/Withdrawing your organization’s consent is not available/)).toBeInTheDocument();
    expectNoConsentAction();
  });

  it('shows no consent when nothing is stored, and says recording one is not available', async () => {
    await renderPage();

    expect(screen.getByText('No consent on record')).toBeInTheDocument();
    expect(screen.getByText('Your organization has not consented to contribute to movement insights.')).toBeInTheDocument();
    expect(screen.queryByText('Date of consent')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('UE-MOVEMENT-INSIGHTS-CONSENT-GRANT');
    expect(screen.getByText(/Recording your organization’s consent is not available/)).toBeInTheDocument();
    expectNoConsentAction();
  });

  it('treats a stored row whose consent_given is false as no consent, and shows none of its details', async () => {
    mocks.limit.mockResolvedValue([storedConsent({ consentGiven: false })]);
    await renderPage();

    expect(screen.getByText('No consent on record')).toBeInTheDocument();
    expect(screen.queryByText('January 15, 2026')).toBeNull();
    expect(screen.queryByText('Grievance types')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('UE-MOVEMENT-INSIGHTS-CONSENT-GRANT');
  });

  it('says so when the stored expiry has passed, and when no category is recorded', async () => {
    mocks.limit.mockResolvedValue([storedConsent({ expiresAt: new Date('2000-06-30T00:00:00Z'), categories: [] })]);
    await renderPage();

    expect(screen.getByText('Expired on')).toBeInTheDocument();
    expect(screen.getByText('June 30, 2000')).toBeInTheDocument();
    expect(screen.queryByText('Expires on')).toBeNull();
    expect(screen.getByText('No categories are recorded with this consent.')).toBeInTheDocument();
  });

  it('shows a category it has no label for as stored instead of hiding or guessing it', async () => {
    mocks.limit.mockResolvedValue([storedConsent({ categories: ['sector-trend', 'a-new-category'] })]);
    await renderPage();

    expect(screen.getByText('Sector trends')).toBeInTheDocument();
    expect(screen.getByText('a-new-category')).toBeInTheDocument();
  });

  it('is in French on a French locale, with the French consent notice', async () => {
    mocks.limit.mockResolvedValue([storedConsent()]);
    await renderPage('fr-CA');

    expect(screen.getByText('Consentement enregistré')).toBeInTheDocument();
    expect(screen.getByText('15 janvier 2026')).toBeInTheDocument();
    expect(screen.getByText('Types de griefs')).toBeInTheDocument();
    expect(screen.getByText('Tendances sectorielles')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Non disponible dans cette version');
    expect(screen.getByText(/Le retrait du consentement de votre organisation n’est pas disponible/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute('href', '/fr-CA/legal/privacy');
    expectNoConsentAction();
  });

  it('is in French when no consent is stored', async () => {
    await renderPage('fr-CA');

    expect(screen.getByText('Aucun consentement enregistré')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('UE-MOVEMENT-INSIGHTS-CONSENT-GRANT');
    expect(screen.getByText(/L’enregistrement du consentement de votre organisation n’est pas disponible/)).toBeInTheDocument();
  });

  it('links to the legal pages that exist', async () => {
    await renderPage();

    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/en-CA/legal/privacy');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/en-CA/legal/terms');
    expect(existsSync('app/[locale]/(marketing)/legal/privacy/page.tsx')).toBe(true);
    expect(existsSync('app/[locale]/(marketing)/legal/terms/page.tsx')).toBe(true);
  });
});

describe('settings/data-sharing: what it reads and who may read it', () => {
  it('reads the caller’s organization in that organization’s own context, and only columns the consent table has', async () => {
    await renderPage();

    expect(mocks.withRLSContext).toHaveBeenCalledTimes(1);
    expect(mocks.withRLSContext.mock.calls[0][0]).toEqual({ organizationId: ORG_ID });
    expect(mocks.plainSelect).not.toHaveBeenCalled();

    expect(mocks.select).toHaveBeenCalledTimes(1);
    const selection = mocks.select.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(selection).sort()).toEqual(['categories', 'consentDate', 'consentGiven', 'expiresAt']);

    const condition = dialect.sqlToQuery(mocks.where.mock.calls[0][0] as SQL);
    expect(condition.sql).toContain('"data_aggregation_consent"."organization_id" = $1');
    expect(condition.params).toEqual([ORG_ID]);
    expect(mocks.getUserRole).toHaveBeenCalledWith('user-1', ORG_ID);
  });

  it('sends a non-administrator to their profile without reading consent', async () => {
    mocks.getUserRole.mockResolvedValue('member');

    await expect(renderPage('fr-CA')).rejects.toThrow('NEXT_REDIRECT:/fr-CA/dashboard/profile');
    expect(mocks.withRLSContext).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('sends a user with no organization to their profile without resolving a role or reading consent', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', organizationId: null });

    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT:/en-CA/dashboard/profile');
    expect(mocks.getUserRole).not.toHaveBeenCalled();
    expect(mocks.withRLSContext).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('does not turn a failed read into “no consent”', async () => {
    mocks.limit.mockRejectedValue(new Error('connection refused'));

    await expect(renderPage()).rejects.toThrow('connection refused');
  });

  it('does not turn a tenant context that cannot be opened into “no consent”', async () => {
    mocks.withRLSContext.mockRejectedValue(new Error('cannot set the organization context'));

    await expect(renderPage()).rejects.toThrow('cannot set the organization context');
  });
});
