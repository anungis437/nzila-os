// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
  withRLSContext: vi.fn(),
  consentSelect: vi.fn(),
  consentLimit: vi.fn(),
  consentWhere: vi.fn(),
  trendOrderBy: vi.fn(),
  trendWhere: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: mocks.getUserRoleInOrganization }));
// The consent read runs in the organization's own context; the module-level handle below is only for the stored trends.
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: mocks.withRLSContext }));
vi.mock('@/db', async () => {
  const { movementTrends } = await import('@/db/schema/domains/marketing');
  return {
    db: {
      select: (selection?: unknown) => {
        mocks.select(selection);
        return {
          from: (table: unknown) => ({
            where: (condition: unknown) => {
              if (table !== movementTrends) throw new Error('only the stored trends may be read through the module-level handle');
              mocks.trendWhere(condition);
              return { orderBy: mocks.trendOrderBy };
            },
          }),
        };
      },
    },
  };
});
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => `[${key}]` }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import MovementInsightsPage from '../page';

const dialect = new PgDialect();

const ORG_ID = '0b7a1c3e-5d2f-4e8a-9b6c-1a2b3c4d5e6f';

const storedConsent = (overrides: Record<string, unknown> = {}) => ({
  consentGiven: true,
  consentDate: new Date('2026-01-15T00:00:00Z'),
  categories: ['grievance-type'],
  expiresAt: null,
  ...overrides,
});

const trend = (overrides: Record<string, unknown> = {}) => ({
  id: 'trend-1',
  category: 'grievance-type',
  dimension: 'harassment',
  aggregatedCount: 12345,
  organizationsContributing: 7,
  timeframe: 'Q1-2025',
  insights: 'Reports of harassment are rising',
  legislativeBriefRelevance: false,
  emergingPattern: true,
  confidenceLevel: 'high',
  createdAt: new Date(),
  ...overrides,
});

async function renderPage(options: { locale?: string; timeframe?: string | string[] } = {}) {
  const element = await MovementInsightsPage({
    params: Promise.resolve({ locale: options.locale ?? 'en-CA' }),
    searchParams: Promise.resolve({ timeframe: options.timeframe }),
  });
  return render(element);
}

beforeEach(() => {
  mocks.requireUser.mockReset().mockResolvedValue({ userId: 'user-1', organizationId: ORG_ID });
  mocks.getUserRoleInOrganization.mockReset().mockResolvedValue('officer');
  mocks.consentLimit.mockReset().mockResolvedValue([]);
  mocks.consentWhere.mockReset();
  mocks.consentSelect.mockReset();
  mocks.withRLSContext.mockReset().mockImplementation(async (_context: unknown, run: (tx: unknown) => unknown) =>
    run({
      select: (selection?: unknown) => {
        mocks.consentSelect(selection);
        return {
          from: () => ({
            where: (condition: unknown) => {
              mocks.consentWhere(condition);
              return { limit: mocks.consentLimit };
            },
          }),
        };
      },
    }),
  );
  mocks.trendOrderBy.mockReset().mockResolvedValue([]);
  mocks.trendWhere.mockReset();
  mocks.select.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('movement-insights: consent', () => {
  it('says no consent is on record and offers only the read-only status, not a way to opt in', async () => {
    await renderPage();

    expect(screen.getByText('No consent on record for your organization')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View consent status' })).toHaveAttribute('href', '/en-CA/dashboard/settings/data-sharing');
    expect(document.body.textContent).not.toMatch(/enable data sharing|opt(ting)? in|manage your consent/i);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('says a consent is on record without claiming that data is flowing or that it can be managed here', async () => {
    mocks.consentLimit.mockResolvedValue([storedConsent()]);
    await renderPage();

    expect(screen.getByText('Consent on record for your organization')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View consent status' })).toHaveAttribute('href', '/en-CA/dashboard/settings/data-sharing');
    expect(document.body.textContent).not.toMatch(/thank you|is helping unions|manage your consent|enable data sharing/i);
    expect(screen.queryByText('No consent on record for your organization')).toBeNull();
  });

  it('treats a stored row whose consent_given is false as no consent', async () => {
    mocks.consentLimit.mockResolvedValue([storedConsent({ consentGiven: false })]);
    await renderPage();

    expect(screen.getByText('No consent on record for your organization')).toBeInTheDocument();
    expect(screen.queryByText('Consent on record for your organization')).toBeNull();
  });

  it('asserts no privacy guarantee that nothing in the application enforces', async () => {
    await renderPage();

    expect(screen.getByText('What this page shows')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/minimum 5 unions|10 cases|statistical noise|explicitly opted in|cannot be identified/i);
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/en-CA/legal/privacy');
  });

  it('reads the caller’s organization only, in that organization’s own context', async () => {
    await renderPage();

    expect(mocks.withRLSContext).toHaveBeenCalledTimes(1);
    expect(mocks.withRLSContext.mock.calls[0][0]).toEqual({ organizationId: ORG_ID });
    expect(mocks.consentSelect).toHaveBeenCalledTimes(1);
    const condition = dialect.sqlToQuery(mocks.consentWhere.mock.calls[0][0] as SQL);
    expect(condition.sql).toContain('"data_aggregation_consent"."organization_id" = $1');
    expect(condition.params).toEqual([ORG_ID]);
    expect(mocks.getUserRoleInOrganization).toHaveBeenCalledWith('user-1', ORG_ID);
    // The only read through the module-level handle is the stored trends.
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.trendWhere).toHaveBeenCalledTimes(1);
  });
});

describe('movement-insights: the stored trends', () => {
  it('shows each stored row by its own columns, grouped by its category', async () => {
    mocks.trendOrderBy.mockResolvedValue([
      trend(),
      trend({
        id: 'trend-2',
        category: 'sector-trend',
        dimension: 'scheduling',
        aggregatedCount: 4,
        organizationsContributing: 5,
        timeframe: 'last_30_days',
        insights: 'Shift changes with short notice',
        emergingPattern: false,
        confidenceLevel: 'medium',
      }),
    ]);
    await renderPage();

    expect(screen.getByText('Grievance types')).toBeInTheDocument();
    expect(screen.getByText('harassment')).toBeInTheDocument();
    expect(screen.getByText('Reports of harassment are rising')).toBeInTheDocument();
    expect(screen.getByText(/Count: 12,345 · Contributing organizations: 7 · Confidence: High/)).toBeInTheDocument();
    expect(screen.getByText('Emerging pattern')).toBeInTheDocument();

    expect(screen.getByText('Sector trends')).toBeInTheDocument();
    expect(screen.getByText('scheduling')).toBeInTheDocument();
    expect(screen.getByText(/Count: 4 · Contributing organizations: 5 · Confidence: Medium/)).toBeInTheDocument();
    expect(screen.queryByText('No stored trends')).toBeNull();
  });

  it('computes nothing from the rows: no improving or declining verdict, no previous-period comparison', async () => {
    mocks.trendOrderBy.mockResolvedValue([trend(), trend({ id: 'trend-2', aggregatedCount: 1 })]);
    await renderPage();

    expect(document.body.textContent).not.toMatch(/improving|declining|vs previous period|win rate|satisfaction/i);
  });

  it('offers no sector filter and no legislative-brief export it cannot back', async () => {
    mocks.trendOrderBy.mockResolvedValue([trend()]);
    await renderPage();

    expect(screen.queryByText(/sector$/i)).toBeNull();
    expect(screen.queryByText(/non-profit|public|private/i)).toBeNull();
    expect(screen.queryByText(/legislative brief/i)).toBeNull();
    expect(screen.queryAllByRole('link').filter((link) => link.getAttribute('href')?.includes('/movement-insights/export'))).toHaveLength(0);
  });

  it('builds the timeframe filter from the stored timeframes and filters by one of them', async () => {
    mocks.trendOrderBy.mockResolvedValue([
      trend(),
      trend({ id: 'trend-2', category: 'sector-trend', dimension: 'scheduling', timeframe: 'last_30_days' }),
    ]);
    const { unmount } = await renderPage();

    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/en-CA/dashboard/movement-insights');
    expect(screen.getByRole('link', { name: 'Q1-2025' })).toHaveAttribute('href', '/en-CA/dashboard/movement-insights?timeframe=Q1-2025');
    expect(screen.getByRole('link', { name: 'last_30_days' })).toHaveAttribute(
      'href',
      '/en-CA/dashboard/movement-insights?timeframe=last_30_days',
    );
    expect(screen.getByText('harassment')).toBeInTheDocument();
    expect(screen.getByText('scheduling')).toBeInTheDocument();
    unmount();

    await renderPage({ timeframe: 'last_30_days' });
    expect(screen.queryByText('harassment')).toBeNull();
    expect(screen.getByText('scheduling')).toBeInTheDocument();
  });

  it('says so when no stored trend has the requested timeframe, instead of showing an empty page', async () => {
    mocks.trendOrderBy.mockResolvedValue([trend()]);
    await renderPage({ timeframe: 'year' });

    expect(screen.getByRole('status')).toHaveTextContent('No stored trends');
    expect(screen.getByRole('status')).toHaveTextContent('No trend stored in the last 30 days has this timeframe.');
    expect(screen.queryByText('harassment')).toBeNull();
  });

  it('says so when nothing is stored, and shows no filter', async () => {
    await renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('No trends were stored in the last 30 days.');
    expect(screen.queryByRole('link', { name: 'All' })).toBeNull();
  });

  it('shows a category it has no label for as stored', async () => {
    mocks.trendOrderBy.mockResolvedValue([trend({ category: 'a-new-category' })]);
    await renderPage();

    expect(screen.getByText('a-new-category')).toBeInTheDocument();
  });

  it('reads the trends stored in the last 30 days', async () => {
    await renderPage();

    const condition = dialect.sqlToQuery(mocks.trendWhere.mock.calls[0][0] as SQL);
    expect(condition.sql).toContain('"movement_trends"."created_at" >= $1');
    const since = new Date(condition.params[0] as string);
    const days = (Date.now() - since.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});

describe('movement-insights: access, language and failures', () => {
  it('sends a role that may not see cross-union analytics to the dashboard without reading anything', async () => {
    mocks.getUserRoleInOrganization.mockResolvedValue('member');

    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT:/dashboard');
    expect(mocks.withRLSContext).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('sends a user with no organization to the dashboard without resolving a role', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', organizationId: null });

    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT:/dashboard');
    expect(mocks.getUserRoleInOrganization).not.toHaveBeenCalled();
    expect(mocks.withRLSContext).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('is in French on a French locale', async () => {
    mocks.trendOrderBy.mockResolvedValue([trend()]);
    await renderPage({ locale: 'fr-CA' });

    expect(screen.getByText('Aucun consentement enregistré pour votre organisation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir l’état du consentement' })).toHaveAttribute(
      'href',
      '/fr-CA/dashboard/settings/data-sharing',
    );
    expect(screen.getByText('Types de griefs')).toBeInTheDocument();
    expect(screen.getByText(/Compte : 12 345|Compte: 12 345/)).toBeInTheDocument();
    expect(screen.getByText('Tendance émergente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute('href', '/fr-CA/legal/privacy');
  });

  it('does not turn a failed read into “no trends”', async () => {
    mocks.trendOrderBy.mockRejectedValue(new Error('connection refused'));

    await expect(renderPage()).rejects.toThrow('connection refused');
  });

  it('does not turn a failed consent read into “no consent”', async () => {
    mocks.consentLimit.mockRejectedValue(new Error('connection refused'));

    await expect(renderPage()).rejects.toThrow('connection refused');
  });

  it('does not turn a tenant context that cannot be opened into “no consent”', async () => {
    mocks.withRLSContext.mockRejectedValue(new Error('cannot set the organization context'));

    await expect(renderPage()).rejects.toThrow('cannot set the organization context');
  });
});
