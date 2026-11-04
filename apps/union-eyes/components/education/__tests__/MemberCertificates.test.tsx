// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';
import { certificationRow, crudList, failure, ok } from './education-rows';
import { MemberCertificates } from '../MemberCertificates';

vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }));

/** A calendar day, "YYYY-MM-DD", this many days from today (UTC). */
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

let pages: Answer[];
let calls: Call[];

beforeEach(() => {
  pages = [ok(crudList([
    certificationRow({ id: 'c-active', certificationName: 'Certified Steward', certificationNumber: 'CERT-1', issueDate: '2024-05-01', expiryDate: day(400) }),
    certificationRow({ id: 'c-soon', certificationName: 'First Aid', certificationNumber: 'CERT-2', expiryDate: day(30) }),
    certificationRow({ id: 'c-old', certificationName: 'WHMIS', certificationNumber: 'CERT-3', expiryDate: day(-10) }),
    certificationRow({ id: 'c-pending', certificationName: 'Health and Safety Rep', certificationNumber: null, certificationStatus: 'pending_verification', verified: false }),
    certificationRow({ id: 'c-revoked', certificationName: 'Revoked course', revoked: true, certificationStatus: 'revoked' }),
  ]))];
  calls = installFetch(({ url }) => {
    if (url.startsWith('/api/education/certifications?')) return pages[Number(new URL(url, 'http://host').searchParams.get('page')) - 1];
    throw new Error(`unexpected request ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderCertificates = () => render(<MemberCertificates memberId="user_alex" organizationId="org-1" />);
const cardOf = async (name: string) => (await screen.findAllByTestId('certification-card')).find((card) => within(card).queryByText(name) !== null)!;

describe('MemberCertificates: what the route sends', () => {
  it('counts the certifications from the rows, by what each one is today', async () => {
    renderCertificates();

    await screen.findAllByTestId('certification-card');
    expect(screen.getByTestId('stat-total')).toHaveTextContent('5');
    expect(screen.getByTestId('stat-active')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-expiring')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-expired')).toHaveTextContent('1');
    expect(calls.map((call) => call.url)).toEqual(['/api/education/certifications?limit=100&page=1']);
  });

  it('says what each certification is: active, expiring, expired, awaiting verification, or revoked', async () => {
    renderCertificates();

    expect(within(await cardOf('Certified Steward')).getByText('Active')).toBeInTheDocument();
    expect(within(await cardOf('First Aid')).getByText('Expiring Soon')).toBeInTheDocument();
    expect(within(await cardOf('WHMIS')).getByText('Expired')).toBeInTheDocument();
    const pending = await cardOf('Health and Safety Rep');
    expect(within(pending).getByText('Pending verification')).toBeInTheDocument();
    expect(within(pending).getByText(/waiting for verification by your union/)).toBeInTheDocument();
    expect(within(pending).queryByText('Active')).not.toBeInTheDocument();
    expect(within(await cardOf('Revoked course')).getByText('Revoked')).toBeInTheDocument();
  });

  it('shows the stored fields: number, type, issuer, the recorded days, CLC registration and renewal', async () => {
    pages = [ok(crudList([certificationRow({
      certificationName: 'Certified Steward',
      certificationNumber: 'CERT-9',
      certificationType: 'course_completion',
      issuedByOrganization: 'Local 42',
      issueDate: '2024-05-01',
      expiryDate: '2030-06-15',
      clcRegistered: true,
      clcRegistrationNumber: 'CLC-77',
      renewalRequired: true,
      renewalDate: '2030-05-01',
    })]))];
    renderCertificates();

    const card = await cardOf('Certified Steward');
    expect(within(card).getByText('CERT-9')).toBeInTheDocument();
    expect(within(card).getByText('course completion')).toBeInTheDocument();
    expect(within(card).getByText('Local 42')).toBeInTheDocument();
    // A date column is the day that was recorded, shown in UTC: May 1, never Apr 30 in a western time zone.
    expect(within(card).getByText('Issued: May 1, 2024')).toBeInTheDocument();
    expect(within(card).getByText(/Expires: June 15, 2030/)).toBeInTheDocument();
    expect(within(card).getByText(/CLC Registered • CLC-77/)).toBeInTheDocument();
    expect(within(card).getByText('Renewal Required')).toBeInTheDocument();
    expect(within(card).getByText('Renew by: May 1, 2030')).toBeInTheDocument();
  });

  it('says "No expiry date" for a certification with none, and invents no number', async () => {
    pages = [ok(crudList([certificationRow({ certificationNumber: null, expiryDate: null })]))];
    renderCertificates();

    const card = (await screen.findAllByTestId('certification-card'))[0];
    expect(within(card).getByText('No expiry date')).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/undefined|null|NaN|Invalid/);
  });

  it('offers the certificate and the badge only as https links, in a new tab that is not given the opener', async () => {
    pages = [ok(crudList([
      certificationRow({ id: 'c-1', certificationName: 'Has links', certificateUrl: 'https://files.example.test/cert.pdf', digitalBadgeUrl: 'https://badges.example.test/b/1' }),
      certificationRow({ id: 'c-2', certificationName: 'Unsafe links', certificateUrl: 'javascript:alert(1)', digitalBadgeUrl: 'http://badges.example.test/b/2' }),
    ]))];
    renderCertificates();

    const good = await cardOf('Has links');
    const certificate = within(good).getByRole('link', { name: /Open certificate/ });
    expect(certificate).toHaveAttribute('href', 'https://files.example.test/cert.pdf');
    expect(certificate).toHaveAttribute('rel', 'noopener noreferrer');
    expect(certificate).toHaveAttribute('target', '_blank');
    expect(within(good).getByRole('link', { name: /Digital badge/ })).toHaveAttribute('href', 'https://badges.example.test/b/1');

    expect(within(await cardOf('Unsafe links')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('reads every page of the certifications', async () => {
    pages = [
      ok(crudList([certificationRow({ id: 'c-1', certificationName: 'First page' })], 1, 2)),
      ok(crudList([certificationRow({ id: 'c-2', certificationName: 'Second page' })], 2, 2)),
    ];
    renderCertificates();

    await cardOf('Second page');
    expect(screen.getByTestId('stat-total')).toHaveTextContent('2');
  });

  it('says there is none only when the list was read and is empty', async () => {
    pages = [ok(crudList([]))];
    renderCertificates();

    expect(await screen.findByText('No certifications are recorded for you yet.')).toBeInTheDocument();
    expect(screen.getByTestId('stat-total')).toHaveTextContent('0');
  });
});

describe('MemberCertificates: filters', () => {
  it('narrows by status and by name or number', async () => {
    const user = userEvent.setup();
    renderCertificates();
    await screen.findAllByTestId('certification-card');

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'expired');
    expect(screen.getAllByTestId('certification-card')).toHaveLength(1);
    expect(screen.getByText('WHMIS')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'pending');
    expect(screen.getByText('Health and Safety Rep')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'all');
    await user.type(screen.getByLabelText('Search certifications'), 'cert-2');
    expect(screen.getAllByTestId('certification-card')).toHaveLength(1);
    expect(screen.getByText('First Aid')).toBeInTheDocument();
  });

  it('says nothing matches when the filters leave none, not that the member has none', async () => {
    const user = userEvent.setup();
    renderCertificates();
    await screen.findAllByTestId('certification-card');

    await user.type(screen.getByLabelText('Search certifications'), 'zzz');

    expect(screen.getByText('No certification matches these filters.')).toBeInTheDocument();
    expect(screen.queryByText('No certifications are recorded for you yet.')).not.toBeInTheDocument();
  });
});

describe('MemberCertificates: when the list cannot be read it says so', () => {
  it('shows the route’s message and recovers on retry', async () => {
    pages = [failure(500, 'Certifications are down')];
    const user = userEvent.setup();
    renderCertificates();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your certifications could not be loaded.');
    expect(alert).toHaveTextContent('Certifications are down');
    expect(screen.queryByTestId('stat-total')).not.toBeInTheDocument();
    expect(screen.queryByText(/No certifications/)).not.toBeInTheDocument();

    pages = [ok(crudList([certificationRow({})]))];
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('certification-card')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['the body the screen used to expect, { certifications, stats }', ok({ success: true, data: { certifications: [], stats: { total: 0, active: 0, expiring: 0, expired: 0 } } })],
    ['a certification without a name', ok(crudList([certificationRow({ certificationName: null })]))],
    ['a certification without an issue date', ok(crudList([certificationRow({ issueDate: null })]))],
    ['a certification whose expiry is not a date', ok(crudList([certificationRow({ expiryDate: 'never' })]))],
    ['an answer with no data', ok({ success: true })],
  ])('does not read %s as "no certifications"', async (_what, answer) => {
    pages = [answer];
    renderCertificates();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your certifications could not be loaded.');
    expect(screen.queryByText('No certifications are recorded for you yet.')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stat-total')).not.toBeInTheDocument();
  });

  it('shows a request that never reached the server as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    renderCertificates();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
  });
});
