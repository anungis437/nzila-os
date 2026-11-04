// @vitest-environment jsdom
// The communications hub page against a mocked loader. It proves the figures shown are the ones the loader returned, and that a loader that throws
// leaves an explicit "could not load" message, in both languages, in place of the figures: no count of zero and no "No campaigns yet" that would
// read as an empty organization. The page's own redirects are covered too. They prove nothing about the database read itself.
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  hasMinRole: vi.fn(),
  loadMetrics: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/api-auth-guard', () => ({ requireUser: mocks.requireUser, hasMinRole: mocks.hasMinRole }));
vi.mock('@/lib/communications/hub-metrics', () => ({ loadCommunicationsHubMetrics: mocks.loadMetrics }));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('../campaigns/page', () => ({ default: () => <div>campaigns-tab</div> }));
vi.mock('../distribution-lists/page', () => ({ default: () => <div>lists-tab</div> }));
vi.mock('../templates/page', () => ({ default: () => <div>templates-tab</div> }));
vi.mock('@/components/communications/sms-console', () => ({ SmsConsole: () => <div>sms-tab</div> }));

import CommunicationsDashboard from '../page';

const ORG = '5b1f3d9e-7c2a-4e0b-9a41-0c6d8f2e1a77';

const metrics = {
  activeCampaignCount: 7,
  scheduledCount: 3,
  sentCount: 11,
  listCount: 5,
  totalSubscribers: 1234,
  templateCount: 9,
  smsCampaignCount: 2,
  recentCampaigns: [{ id: 'c1', name: 'Spring drive', status: 'sent', channel: 'email', createdAt: new Date() }],
};

async function renderHub(locale = 'en-CA') {
  render(await CommunicationsDashboard({ params: Promise.resolve({ locale }) }));
}

beforeEach(() => {
  mocks.requireUser.mockReset().mockResolvedValue({ id: 'user-1', organizationId: ORG });
  mocks.hasMinRole.mockReset().mockResolvedValue(true);
  mocks.loadMetrics.mockReset().mockResolvedValue(metrics);
  mocks.logError.mockReset();
});
afterEach(cleanup);

describe('communications hub page', () => {
  it('shows the figures the loader returned, read for the caller’s own organization', async () => {
    await renderHub();

    expect(mocks.loadMetrics).toHaveBeenCalledExactlyOnceWith(ORG);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('stats.scheduled {"count":3}')).toBeInTheDocument();
    expect(screen.getByText('stats.smsCampaigns {"count":2}')).toBeInTheDocument();
    expect(screen.getByText('Spring drive')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says there are no campaigns only when the loader returned none', async () => {
    mocks.loadMetrics.mockResolvedValue({ ...metrics, activeCampaignCount: 0, sentCount: 0, recentCampaigns: [] });
    await renderHub();

    expect(screen.getByText('overview.recentActivity.empty')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a "could not load" message, no zeros and no "no campaigns yet", when the figures cannot be read', async () => {
    mocks.loadMetrics.mockRejectedValue(new Error('permission denied for table campaigns'));
    await renderHub();

    expect(screen.getByRole('alert')).toHaveTextContent('The communications figures could not be loaded');
    expect(screen.getByText('Recent campaigns could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('stats.activeCampaigns')).not.toBeInTheDocument();
    expect(screen.queryByText('stats.campaignsSent')).not.toBeInTheDocument();
    expect(screen.queryByText('overview.recentActivity.empty')).not.toBeInTheDocument();
  });

  it('logs the failure with its cause and the organization, and keeps the tabs and the quick actions', async () => {
    const cause = new Error('connection reset');
    mocks.loadMetrics.mockRejectedValue(cause);
    await renderHub();

    expect(mocks.logError).toHaveBeenCalledExactlyOnceWith('Communications hub figures failed to load', cause, { organizationId: ORG });
    expect(screen.getByRole('tab', { name: 'tabs.campaigns' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'tabs.sms' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /overview.quickActions.createCampaign/ })).toHaveAttribute('href', '/en-CA/dashboard/communications/campaigns/new');
  });

  it('says so in French for a French locale', async () => {
    mocks.loadMetrics.mockRejectedValue(new Error('down'));
    await renderHub('fr-CA');

    expect(screen.getByRole('alert')).toHaveTextContent('Les chiffres des communications n’ont pas pu être chargés');
    expect(screen.getByText('Les campagnes récentes n’ont pas pu être chargées.')).toBeInTheDocument();
    expect(screen.queryByText('The communications figures could not be loaded')).not.toBeInTheDocument();
  });

  it('sends a caller who is not signed in to the login page without reading anything', async () => {
    mocks.requireUser.mockRejectedValue(new Error('no session'));

    await expect(CommunicationsDashboard({ params: Promise.resolve({ locale: 'en-CA' }) })).rejects.toThrow('NEXT_REDIRECT:/en-CA/login');
    expect(mocks.loadMetrics).not.toHaveBeenCalled();
  });

  it('sends a caller below steward to the dashboard without reading anything', async () => {
    mocks.hasMinRole.mockResolvedValue(false);

    await expect(CommunicationsDashboard({ params: Promise.resolve({ locale: 'fr-CA' }) })).rejects.toThrow('NEXT_REDIRECT:/fr-CA/dashboard');
    expect(mocks.hasMinRole).toHaveBeenCalledWith('steward');
    expect(mocks.loadMetrics).not.toHaveBeenCalled();
  });

  it('sends a caller who belongs to no organization to the dashboard without reading anything', async () => {
    mocks.requireUser.mockResolvedValue({ id: 'platform-admin', organizationId: 'platform' });

    await expect(CommunicationsDashboard({ params: Promise.resolve({ locale: 'en-CA' }) })).rejects.toThrow('NEXT_REDIRECT:/en-CA/dashboard');
    expect(mocks.loadMetrics).not.toHaveBeenCalled();
  });
});
