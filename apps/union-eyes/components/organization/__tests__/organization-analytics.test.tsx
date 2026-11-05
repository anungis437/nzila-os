// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { OrganizationAnalytics } from '../organization-analytics';

/** What GET /api/organizations/{id}/analytics answers (app/api/organizations/[id]/analytics/route.ts): plain { data }, with null for a figure it withholds or cannot define. */
const analytics = (values: Record<string, unknown> = {}) => ({
  suppression: { minimumGroupSize: 5, members: false, claims: false },
  organizationId: 'org-9',
  organizationName: 'Local 1000',
  organizationType: 'local',
  totalMembers: 120,
  activeMembers: 90,
  newMembersThisMonth: 4,
  memberGrowthRate: 3.4,
  totalClaims: 40,
  activeClaims: 12,
  resolvedClaims: 20,
  claimsThisMonth: 3,
  avgResolutionDays: 21,
  childOrganizations: 2,
  claimsByStatus: { filed: 12, closed: 20 },
  ...values,
});

const ok = (data: unknown): Answer => ({ status: 200, body: { data } });

let answer: Answer;
let calls: Call[];

beforeEach(() => {
  answer = ok(analytics());
  calls = installFetch(() => answer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderAnalytics = () => render(<OrganizationAnalytics organizationId="org-9" />);

const card = (title: string) => screen.getByText(title).closest('[class*="rounded-lg"]') as HTMLElement;

describe('OrganizationAnalytics: the figures it shows', () => {
  it('reads the analytics of the organization from its route, and nothing else', async () => {
    renderAnalytics();

    expect(await screen.findByRole('heading', { name: 'Local 1000' })).toBeInTheDocument();
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/organizations/org-9/analytics']);
    expect(screen.getByText('Local Analytics')).toBeInTheDocument();
  });

  it('shows the key figures as the route states them', async () => {
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    expect(card('Total Members')).toHaveTextContent('120');
    expect(card('Total Members')).toHaveTextContent('+3.4%');
    expect(card('Total Members')).toHaveTextContent('4 new this month');
    expect(card('Active Claims')).toHaveTextContent('12');
    expect(card('Active Claims')).toHaveTextContent('40 total claims');
    expect(card('Resolution Time')).toHaveTextContent('21 days');
    expect(card('Child Organizations')).toHaveTextContent('2');
    expect(card('Child Organizations')).toHaveTextContent('Direct children only');
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('shows the member and claims tabs, and no financial tab, since the route has no financial figures', async () => {
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Members', 'Claims']);
  });

  it('shows the member breakdown and works out the activity rate from the figures', async () => {
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    expect(card('Member Status')).toHaveTextContent('Active90');
    expect(card('Member Status')).toHaveTextContent('Total120');
    expect(card('Member Status')).toHaveTextContent('New This Month4');
    expect(card('Growth Metrics')).toHaveTextContent('Growth Rate+3.4%');
    expect(card('Growth Metrics')).toHaveTextContent('Activity Rate75.0%');
  });

  it('shows the claims breakdown and works out the resolution rate from the figures', async () => {
    const user = userEvent.setup();
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    await user.click(screen.getByRole('tab', { name: 'Claims' }));

    expect(card('Claims Overview')).toHaveTextContent('Active Claims12');
    expect(card('Claims Overview')).toHaveTextContent('Resolved20');
    expect(card('Claims Overview')).toHaveTextContent('This Month3');
    expect(card('Performance')).toHaveTextContent('Avg Resolution21 days');
    expect(card('Performance')).toHaveTextContent('Resolution Rate50.0%');
  });

  it('shows a decline as a decline', async () => {
    answer = ok(analytics({ memberGrowthRate: -2.5 }));
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    expect(card('Total Members')).toHaveTextContent('-2.5%');
    expect(card('Growth Metrics')).toHaveTextContent('Growth Rate-2.5%');
  });
});

describe('OrganizationAnalytics: what the route withholds or cannot define', () => {
  it('shows withheld member figures as dashes, says why, and shows the claims figures that were not withheld', async () => {
    answer = ok(
      analytics({
        suppression: { minimumGroupSize: 5, members: true, claims: false },
        totalMembers: null,
        activeMembers: null,
        newMembersThisMonth: null,
        memberGrowthRate: null,
      }),
    );
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    expect(screen.getByRole('note')).toHaveTextContent('The member figures are not shown for a group smaller than 5, so that no individual can be identified.');
    expect(card('Total Members')).toHaveTextContent('—');
    expect(card('Total Members')).toHaveTextContent('— new this month');
    expect(card('Total Members')).not.toHaveTextContent('%');
    expect(card('Member Status')).toHaveTextContent('Active—');
    expect(card('Growth Metrics')).toHaveTextContent('Growth Rate—');
    expect(card('Growth Metrics')).toHaveTextContent('Activity Rate—');
    expect(card('Active Claims')).toHaveTextContent('12');
    expect(document.body).not.toHaveTextContent(/null|undefined|NaN|N\/A/);
  });

  it('says both families were withheld when they were, and shows no claim figure as zero', async () => {
    answer = ok(
      analytics({
        suppression: { minimumGroupSize: 5, members: true, claims: true },
        totalMembers: null,
        activeMembers: null,
        newMembersThisMonth: null,
        memberGrowthRate: null,
        totalClaims: null,
        activeClaims: null,
        resolvedClaims: null,
        claimsThisMonth: null,
        avgResolutionDays: null,
        claimsByStatus: null,
      }),
    );
    const user = userEvent.setup();
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    expect(screen.getByRole('note')).toHaveTextContent('The member and claims figures are not shown for a group smaller than 5');
    expect(card('Resolution Time')).toHaveTextContent('—');
    // Withheld is not "No claim has been resolved yet".
    expect(card('Resolution Time')).toHaveTextContent('Average resolution time');
    await user.click(screen.getByRole('tab', { name: 'Claims' }));
    expect(card('Performance')).toHaveTextContent('Resolution Rate—');
    expect(card('Claims Overview')).toHaveTextContent('Resolved—');
    expect(document.body).not.toHaveTextContent(/null|undefined|NaN|N\/A|\b0%/);
  });

  it('says no claim has been resolved when none has, and does not show "null days"', async () => {
    answer = ok(analytics({ avgResolutionDays: null, resolvedClaims: 0 }));
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    expect(card('Resolution Time')).toHaveTextContent('—');
    expect(card('Resolution Time')).toHaveTextContent('No claim has been resolved yet');
    expect(document.body).not.toHaveTextContent(/null days/);
  });

  it('shows no growth where there was no membership to grow from, instead of "+0%"', async () => {
    answer = ok(analytics({ memberGrowthRate: null }));
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    expect(card('Total Members')).not.toHaveTextContent('%');
    expect(card('Growth Metrics')).toHaveTextContent('Growth Rate—');
  });

  it('shows zero as zero, and a rate over nothing as a dash, not as 0%', async () => {
    answer = ok(analytics({ totalMembers: 0, activeMembers: 0, newMembersThisMonth: 0, memberGrowthRate: null, totalClaims: 0, activeClaims: 0, resolvedClaims: 0, claimsThisMonth: 0, avgResolutionDays: null }));
    const user = userEvent.setup();
    renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    expect(card('Total Members')).toHaveTextContent('0');
    expect(card('Member Status')).toHaveTextContent('Total0');
    expect(card('Growth Metrics')).toHaveTextContent('Activity Rate—');
    await user.click(screen.getByRole('tab', { name: 'Claims' }));
    expect(card('Performance')).toHaveTextContent('Resolution Rate—');
    expect(document.body).not.toHaveTextContent(/\b0%|NaN/);
  });

  it('names no type when the organization has none', async () => {
    answer = ok(analytics({ organizationType: null }));
    renderAnalytics();

    expect(await screen.findByText('Analytics')).toBeInTheDocument();
  });
});

describe('OrganizationAnalytics: when the figures cannot be shown', () => {
  it('shows it is loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderAnalytics();

    expect(screen.getByRole('status', { name: 'Loading analytics' })).toBeInTheDocument();
  });

  it('says why the route refused, and Retry reads the figures again', async () => {
    answer = { status: 403, body: { error: 'Forbidden: requires officer role' } };
    const user = userEvent.setup();
    renderAnalytics();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Forbidden: requires officer role');
    expect(screen.queryByRole('heading', { name: 'Local 1000' })).toBeNull();

    answer = ok(analytics());
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'Local 1000' })).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });

  it('says why in the standard error shape too', async () => {
    answer = { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } };
    renderAnalytics();

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
  });

  it('reads the figures of another organization when the organization changes, and does not show the old ones meanwhile', async () => {
    const { rerender } = renderAnalytics();
    await screen.findByRole('heading', { name: 'Local 1000' });

    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    rerender(<OrganizationAnalytics organizationId="org-2" />);

    expect(screen.queryByRole('heading', { name: 'Local 1000' })).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading analytics' })).toBeInTheDocument();
  });

  it.each([
    ['a body that is not a record', [], 'Unexpected API response: no analytics'],
    ['a body without data', {}, 'Unexpected API response: analytics is not a record'],
    ['analytics in the wrong nesting', { data: { data: analytics() } }, 'Unexpected API response: suppression is not a record'],
    ['analytics without a name', { data: analytics({ organizationName: null }) }, 'Unexpected API response: organizationName is missing'],
    ['analytics without the suppression notice', { data: analytics({ suppression: undefined }) }, 'Unexpected API response: suppression is not a record'],
    ['a suppression flag that is not a boolean', { data: analytics({ suppression: { minimumGroupSize: 5, members: 'yes', claims: false } }) }, 'Unexpected API response: members is not a boolean'],
    ['a figure that is not a number', { data: analytics({ totalMembers: '120' }) }, 'Unexpected API response: totalMembers is not a number'],
    ['a child count that is not a number', { data: analytics({ childOrganizations: null }) }, 'Unexpected API response: childOrganizations is not a number'],
  ])('reports %s instead of drawing figures', async (_what, body, message) => {
    answer = { status: 200, body };
    renderAnalytics();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('Member Status')).toBeNull();
  });
});
