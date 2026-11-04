// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';
import { COURSE_A, COURSE_B, SESSION_A1, SESSION_A2, SESSION_B1, certificationRow, courseRow, crudList, failure, ok, registrationRow, sessionRow } from './education-rows';
import { MemberLearningPortal } from '../MemberLearningPortal';

vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement('a', { href, ...props }, children),
}));
// The joining control has its own tests; here it is only a marker that the portal offered it for that session.
vi.mock('../MemberSessionJoin', () => ({
  MemberSessionJoin: ({ sessionId }: { sessionId: string }) => createElement('span', { 'data-testid': 'join-control' }, sessionId),
}));

/** A calendar day, "YYYY-MM-DD", this many days from today (UTC). */
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const REG_LIVE = 'ee000000-1111-4111-8111-00000000000a';
const REG_SOON = 'ee000000-1111-4111-8111-00000000000b';
const REG_DONE = 'ee000000-1111-4111-8111-00000000000c';
const REG_WAIT = 'ee000000-1111-4111-8111-00000000000d';

let registrationPages: Answer[];
let coursePages: Answer[];
let sessionPages: Answer[];
let certificationPages: Answer[];
let calls: Call[];

const pageOf = (url: string) => Number(new URL(url, 'http://host').searchParams.get('page')) - 1;

beforeEach(() => {
  registrationPages = [ok(crudList([
    registrationRow({ id: REG_LIVE, courseId: COURSE_A, sessionId: SESSION_A1 }),
    registrationRow({ id: REG_SOON, courseId: COURSE_B, sessionId: SESSION_B1 }),
    registrationRow({ id: REG_DONE, courseId: COURSE_A, sessionId: SESSION_A2, completed: true, registrationStatus: 'completed', passed: true }),
    registrationRow({ id: REG_WAIT, courseId: COURSE_B, sessionId: 'ab000000-9999-4999-8999-000000000009', registrationStatus: 'waitlisted' }),
  ]))];
  coursePages = [ok(crudList([
    courseRow({}),
    courseRow({ id: COURSE_B, courseCode: 'ORG-200', courseName: 'Organizing Basics', courseCategory: 'organizing' }),
  ]))];
  sessionPages = [ok(crudList([
    sessionRow({ id: SESSION_A1, courseId: COURSE_A, sessionName: 'Spring cohort', startDate: day(-1), endDate: day(1), deliveryMethod: 'virtual_live', venueName: 'Zoom room' }),
    sessionRow({ id: SESSION_A2, courseId: COURSE_A, startDate: day(-60), endDate: day(-59) }),
    sessionRow({ id: SESSION_B1, courseId: COURSE_B, sessionCode: 'ORG-200-A', sessionName: 'Autumn cohort', startDate: '2099-11-02', endDate: '2099-11-03', venueName: 'Union Hall' }),
  ]))];
  certificationPages = [ok(crudList([
    certificationRow({ id: 'c-1', certificationName: 'Certified Steward', certificationNumber: 'CERT-1', expiryDate: day(400), certificateUrl: 'https://files.example.test/cert.pdf' }),
    certificationRow({ id: 'c-2', certificationName: 'First Aid', certificationNumber: 'CERT-2', expiryDate: day(30) }),
    certificationRow({ id: 'c-3', certificationName: 'WHMIS', expiryDate: day(-5) }),
    certificationRow({ id: 'c-4', certificationName: 'Pending one', verified: false, certificationStatus: 'pending_verification' }),
  ]))];
  calls = installFetch(({ url }) => {
    if (url.startsWith('/api/education/registrations?')) return registrationPages[pageOf(url)];
    if (url.startsWith('/api/education/courses?')) return coursePages[pageOf(url)];
    if (url.startsWith('/api/education/sessions?')) return sessionPages[pageOf(url)];
    if (url.startsWith('/api/education/certifications?')) return certificationPages[pageOf(url)];
    throw new Error(`unexpected request ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPortal = () => render(<MemberLearningPortal organizationId="org-1" memberId="user_alex" />);

describe('MemberLearningPortal: the courses', () => {
  it('names each registration from the course and the session it points at, and sorts it by the dates on the session', async () => {
    renderPortal();

    const live = await screen.findByTestId('in-progress-course');
    expect(within(live).getByText('Steward Fundamentals')).toBeInTheDocument();
    expect(within(live).getByText('STW-101')).toBeInTheDocument();
    expect(within(live).getByText('steward training')).toBeInTheDocument();
    expect(within(live).getByText('Venue: Zoom room')).toBeInTheDocument();

    const soon = screen.getByTestId('upcoming-course');
    expect(within(soon).getByText('Organizing Basics')).toBeInTheDocument();
    expect(within(soon).getByText('Autumn cohort')).toBeInTheDocument();
    // The recorded day, in UTC: Nov 2, never Nov 1 in a western time zone.
    expect(within(soon).getByText('November 2, 2099')).toBeInTheDocument();
    expect(within(soon).getByText('registered')).toBeInTheDocument();
    expect(within(soon).getByText('Venue: Union Hall')).toBeInTheDocument();

    expect(calls.map((call) => call.url)).toEqual(expect.arrayContaining([
      '/api/education/registrations?limit=100&page=1',
      '/api/education/courses?limit=100&page=1',
      '/api/education/sessions?limit=100&page=1',
    ]));
  });

  it('counts the active and the completed registrations from the rows', async () => {
    renderPortal();

    await screen.findByTestId('in-progress-course');
    expect(screen.getByTestId('stat-active-courses')).toHaveTextContent('2');
    expect(screen.getByText('1 in progress, 1 upcoming')).toBeInTheDocument();
    expect(screen.getByTestId('stat-completed')).toHaveTextContent('1');
  });

  it('shows no progress bar or percentage: nothing records progress before a registration completes', async () => {
    renderPortal();

    const live = await screen.findByTestId('in-progress-course');
    expect(live).not.toHaveTextContent(/progress|%/i);
    expect(within(live).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('offers the joining control only for a registered, virtual session that is on today', async () => {
    renderPortal();

    const live = await screen.findByTestId('in-progress-course');
    expect(within(live).getByTestId('join-control')).toHaveTextContent(SESSION_A1);
    expect(within(screen.getByTestId('upcoming-course')).queryByTestId('join-control')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('join-control')).toHaveLength(1);
  });

  it('does not offer the joining control for an in-person session that is on today', async () => {
    sessionPages = [ok(crudList([
      sessionRow({ id: SESSION_A1, courseId: COURSE_A, startDate: day(-1), endDate: day(1), deliveryMethod: 'in_person' }),
      sessionRow({ id: SESSION_A2, courseId: COURSE_A, startDate: day(-60), endDate: day(-59) }),
      sessionRow({ id: SESSION_B1, courseId: COURSE_B, startDate: '2099-11-02', endDate: '2099-11-03' }),
    ]))];
    renderPortal();

    await screen.findByTestId('in-progress-course');
    expect(screen.queryByTestId('join-control')).not.toBeInTheDocument();
  });

  it('lists a registration with no schedule on file, or a waitlist, with its status and does not invent a date', async () => {
    renderPortal();

    const others = await screen.findAllByTestId('other-course');
    expect(others).toHaveLength(1);
    expect(others[0]).toHaveTextContent('Organizing Basics');
    expect(others[0]).toHaveTextContent('Status: waitlisted.');
    expect(others[0]).toHaveTextContent('Session schedule is not available in this view.');
    expect(others[0]).not.toHaveTextContent(/1970|Invalid/);
  });

  it('says a registration whose course the catalogue no longer lists is exactly that', async () => {
    coursePages = [ok(crudList([courseRow({})]))];
    renderPortal();

    const soon = await screen.findByTestId('upcoming-course');
    expect(within(soon).getByText('Course no longer in the catalogue')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Course details unavailable');
  });

  it('says there are no registrations only when the list was read and is empty', async () => {
    registrationPages = [ok(crudList([]))];
    renderPortal();

    expect(await screen.findByText('No registrations yet')).toBeInTheDocument();
    expect(screen.getByTestId('stat-active-courses')).toHaveTextContent('0');
  });

  it('reads every page of the registrations', async () => {
    registrationPages = [
      ok(crudList([registrationRow({ id: REG_LIVE, courseId: COURSE_A, sessionId: SESSION_A1 })], 1, 2)),
      ok(crudList([registrationRow({ id: REG_SOON, courseId: COURSE_B, sessionId: SESSION_B1 })], 2, 2)),
    ];
    renderPortal();

    await screen.findByTestId('upcoming-course');
    expect(screen.getByTestId('stat-active-courses')).toHaveTextContent('2');
  });
});

describe('MemberLearningPortal: the certificates', () => {
  it('counts and lists the valid certifications, warns about those that expire soon, and counts those not yet verified apart', async () => {
    const user = userEvent.setup();
    renderPortal();
    await screen.findByTestId('in-progress-course');

    expect(screen.getByTestId('stat-certificates')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-expiring')).toHaveTextContent('1');

    await user.click(screen.getByRole('tab', { name: 'My Certificates' }));

    const valid = await screen.findAllByTestId('valid-certificate');
    expect(valid.map((card) => within(card).getByRole('heading').textContent)).toEqual(['Certified Steward', 'First Aid']);
    expect(screen.getByText('Certificates Expiring Soon')).toBeInTheDocument();
    expect(screen.getByTestId('pending-certifications')).toHaveTextContent('1 certification is waiting for verification by your union and not counted above.');
    expect(screen.queryByText('WHMIS')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending one')).not.toBeInTheDocument();
    expect(within(valid[0]).getByRole('link', { name: /Open certificate/ })).toHaveAttribute('href', 'https://files.example.test/cert.pdf');
    expect(within(valid[1]).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See every certification/ })).toHaveAttribute('href', '/en-CA/dashboard/education/certificates');
  });

  it('says there is no valid certificate only when the list was read and none is valid', async () => {
    certificationPages = [ok(crudList([]))];
    const user = userEvent.setup();
    renderPortal();
    await screen.findByTestId('in-progress-course');

    await user.click(screen.getByRole('tab', { name: 'My Certificates' }));

    expect(await screen.findByText('No valid certificates')).toBeInTheDocument();
    expect(screen.getByTestId('stat-certificates')).toHaveTextContent('0');
  });
});

describe('MemberLearningPortal: when a read fails it says so and does not show zeros or placeholder names', () => {
  it('shows the route’s message for the registrations, dashes in the figures that depend on them, and recovers on retry', async () => {
    registrationPages = [failure(500, 'Registrations are down')];
    const user = userEvent.setup();
    renderPortal();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your courses could not be loaded.');
    expect(alert).toHaveTextContent('Registrations are down');
    expect(screen.getByTestId('stat-active-courses')).toHaveTextContent('—');
    expect(screen.getByTestId('stat-completed')).toHaveTextContent('—');
    expect(screen.queryByText('No registrations yet')).not.toBeInTheDocument();
    // The certifications read did not fail, so its figures are shown.
    expect(screen.getByTestId('stat-certificates')).toHaveTextContent('2');

    registrationPages = [ok(crudList([registrationRow({ id: REG_LIVE, courseId: COURSE_A, sessionId: SESSION_A1 })]))];
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('in-progress-course')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show registrations with placeholder names when the course list cannot be read', async () => {
    coursePages = [failure(503, 'Courses are down')];
    renderPortal();

    expect(await screen.findByRole('alert')).toHaveTextContent('Courses are down');
    expect(screen.queryByTestId('in-progress-course')).not.toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-course')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Course details unavailable');
  });

  it('shows the route’s message for the certifications and keeps the courses', async () => {
    certificationPages = [failure(500, 'Certifications are down')];
    const user = userEvent.setup();
    renderPortal();

    expect(await screen.findByTestId('in-progress-course')).toBeInTheDocument();
    expect(screen.getByTestId('stat-certificates')).toHaveTextContent('—');
    expect(screen.getByTestId('stat-expiring')).toHaveTextContent('—');

    await user.click(screen.getByRole('tab', { name: 'My Certificates' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your certifications could not be loaded.');
    expect(alert).toHaveTextContent('Certifications are down');
    expect(screen.queryByText('No valid certificates')).not.toBeInTheDocument();
  });

  it.each([
    ['a registration without its course', ok(crudList([registrationRow({ courseId: null })]))],
    ['a registration whose passed flag is not yes or no', ok(crudList([registrationRow({ passed: 'maybe' })]))],
    ['a list that is not a list', ok({ success: true, data: { data: 'none', pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } } })],
    ['an answer with no data', ok({ success: true })],
  ])('does not read %s as "no registrations"', async (_what, answer) => {
    registrationPages = [answer];
    renderPortal();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your courses could not be loaded.');
    expect(screen.queryByText('No registrations yet')).not.toBeInTheDocument();
  });

  it('shows a request that never reached the server as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    renderPortal();

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]).toHaveTextContent('Failed to fetch');
    expect(screen.getByTestId('stat-active-courses')).toHaveTextContent('—');
  });
});
