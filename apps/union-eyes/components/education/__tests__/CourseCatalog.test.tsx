// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';
import { COURSE_A, COURSE_B, SESSION_A1, SESSION_A2, SESSION_B1, courseRow, crudItem, crudList, failure, ok, registrationRow, sessionRow } from '@/lib/__tests__/support/education-rows';
import { CourseCatalog } from '../CourseCatalog';

vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }));

beforeAll(() => {
  // Radix dialogs measure and focus things jsdom does not implement.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

let coursePages: Answer[];
let sessionPages: Answer[];
let register: (body: unknown) => Answer;
let calls: Call[];

const pageOf = (url: string) => Number(new URL(url, 'http://host').searchParams.get('page')) - 1;

beforeEach(() => {
  coursePages = [ok(crudList([
    courseRow({}),
    courseRow({ id: COURSE_B, courseCode: 'ORG-200', courseName: 'Organizing Basics', courseCategory: 'political_action', deliveryMethod: 'virtual_live', courseDifficulty: 'advanced', durationHours: null, durationDays: null, providesCertification: false, certificationName: null, clcApproved: false, courseFee: '0.00', minEnrollment: null, maxEnrollment: null, courseDescription: null }),
  ]))];
  sessionPages = [ok(crudList([
    sessionRow({}),
    sessionRow({ id: SESSION_A2, sessionCode: 'STW-101-B', sessionName: null, startDate: '2099-12-01', endDate: '2099-12-01' }),
    sessionRow({ id: SESSION_B1, courseId: COURSE_B, sessionCode: 'ORG-200-A', sessionName: 'Other course session' }),
  ]))];
  register = (body) => ok(crudItem(registrationRow(body as Record<string, unknown>)));
  calls = installFetch(({ url, method, body }) => {
    if (url.startsWith('/api/education/courses?')) return coursePages[pageOf(url)];
    if (url.startsWith('/api/education/sessions?')) return sessionPages[pageOf(url)];
    if (url === '/api/education/registrations' && method === 'POST') return register(body);
    throw new Error(`unexpected request ${method} ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderCatalog = (memberId: string | null = 'user_alex') => render(<CourseCatalog organizationId="org-1" memberId={memberId ?? undefined} />);

async function openCourse(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `${name}, details` }));
  return screen.findByRole('dialog');
}

describe('CourseCatalog: what the routes send', () => {
  it('lists the live courses with the figures the rows hold', async () => {
    renderCatalog();

    const steward = await screen.findByRole('button', { name: 'Steward Fundamentals, details' });
    expect(within(steward).getByText('STW-101')).toBeInTheDocument();
    expect(within(steward).getByText('steward training')).toBeInTheDocument();
    expect(within(steward).getByText('in person')).toBeInTheDocument();
    // numeric columns arrive as strings: "8.00" hours, "150.00" dollars.
    expect(within(steward).getByText('8 hours • 2 days')).toBeInTheDocument();
    expect(within(steward).getByText('5-30 participants')).toBeInTheDocument();
    expect(within(steward).getByText('Provides certification')).toBeInTheDocument();
    expect(within(steward).getByText('$150.00')).toBeInTheDocument();
    expect(within(steward).getByText('Learn the grievance process.')).toBeInTheDocument();
    expect(screen.getByText('2 courses')).toBeInTheDocument();
    expect(calls.map((call) => call.url)).toContain('/api/education/courses?limit=100&page=1');
  });

  it('shows nothing for a course that has no duration or capacity, not a zero or "0-0"', async () => {
    renderCatalog();

    const organizing = await screen.findByRole('button', { name: 'Organizing Basics, details' });
    expect(within(organizing).getByText('Free')).toBeInTheDocument();
    expect(organizing).not.toHaveTextContent(/hours|participants/);
    expect(organizing.textContent).not.toMatch(/(^|\D)0(\D|$)/);
  });

  it('reads every page of the catalogue', async () => {
    coursePages = [
      ok(crudList([courseRow({})], 1, 2)),
      ok(crudList([courseRow({ id: COURSE_B, courseCode: 'ORG-200', courseName: 'Organizing Basics' })], 2, 2)),
    ];
    renderCatalog();

    expect(await screen.findByRole('button', { name: 'Organizing Basics, details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Steward Fundamentals, details' })).toBeInTheDocument();
    expect(screen.getByText('2 courses')).toBeInTheDocument();
  });

  it('does not list a course that is not live, which staff can read but nobody can enroll in', async () => {
    coursePages = [ok(crudList([courseRow({}), courseRow({ id: COURSE_B, courseName: 'Archived course', isActive: false })]))];
    renderCatalog();

    await screen.findByRole('button', { name: 'Steward Fundamentals, details' });
    expect(screen.queryByText('Archived course')).not.toBeInTheDocument();
    expect(screen.getByText('1 courses')).toBeInTheDocument();
  });

  it('says a fee that is not a valid amount is unavailable, never free', async () => {
    coursePages = [ok(crudList([courseRow({ courseFee: null })]))];
    renderCatalog();

    const card = await screen.findByRole('button', { name: 'Steward Fundamentals, details' });
    expect(within(card).getByText('Fee unavailable')).toBeInTheDocument();
    expect(within(card).queryByText('Free')).not.toBeInTheDocument();
  });

  it('says the union has published nothing only when the catalogue was read and is empty', async () => {
    coursePages = [ok(crudList([]))];
    renderCatalog();

    expect(await screen.findByText('No courses are listed')).toBeInTheDocument();
  });
});

describe('CourseCatalog: filters', () => {
  it('offers the categories, methods and levels that exist in the catalogue, including those the old fixed lists left out', async () => {
    renderCatalog();
    await screen.findByRole('button', { name: 'Steward Fundamentals, details' });

    const category = screen.getByLabelText('Category');
    expect(within(category).getAllByRole('option').map((option) => option.textContent)).toEqual(['All Categories', 'political action', 'steward training']);
    expect(within(screen.getByLabelText('Delivery Method')).getAllByRole('option').map((option) => option.textContent)).toEqual(['All Methods', 'in person', 'virtual live']);
    expect(within(screen.getByLabelText('Difficulty')).getAllByRole('option').map((option) => option.textContent)).toEqual(['All Levels', 'advanced', 'beginner']);
  });

  it('narrows the list by category, search and CLC approval, and says how many remain', async () => {
    const user = userEvent.setup();
    renderCatalog();
    await screen.findByRole('button', { name: 'Steward Fundamentals, details' });

    await user.selectOptions(screen.getByLabelText('Category'), 'political_action');
    expect(screen.queryByRole('button', { name: 'Steward Fundamentals, details' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Organizing Basics, details' })).toBeInTheDocument();
    expect(screen.getByText('1 of 2 courses')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Category'), 'all');
    await user.type(screen.getByLabelText('Search'), 'grievance');
    expect(screen.getByRole('button', { name: 'Steward Fundamentals, details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Organizing Basics, details' })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search'));
    await user.click(screen.getByRole('button', { name: 'CLC Approved' }));
    expect(screen.getByRole('button', { name: 'Steward Fundamentals, details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Organizing Basics, details' })).not.toBeInTheDocument();
  });

  it('says no course matches when the filters leave none, not that none exist', async () => {
    const user = userEvent.setup();
    renderCatalog();
    await screen.findByRole('button', { name: 'Steward Fundamentals, details' });

    await user.type(screen.getByLabelText('Search'), 'zzz');

    expect(screen.getByText('No courses found')).toBeInTheDocument();
    expect(screen.queryByText('No courses are listed')).not.toBeInTheDocument();
  });
});

describe('CourseCatalog: when the catalogue cannot be read it says so', () => {
  it('shows the route’s message and recovers on retry, without a count or an empty-catalogue card', async () => {
    coursePages = [failure(503, 'Courses are unavailable')];
    const user = userEvent.setup();
    renderCatalog();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The course catalogue could not be loaded.');
    expect(alert).toHaveTextContent('Courses are unavailable');
    expect(screen.queryByText(/courses$/)).not.toBeInTheDocument();
    expect(screen.queryByText('No courses found')).not.toBeInTheDocument();
    expect(screen.queryByText('No courses are listed')).not.toBeInTheDocument();

    coursePages = [ok(crudList([courseRow({})]))];
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Steward Fundamentals, details' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['a course without a name', ok(crudList([courseRow({ courseName: null })]))],
    ['a course without a category', ok(crudList([courseRow({ courseCategory: null })]))],
    ['a duration that is not a number', ok(crudList([courseRow({ durationHours: 'soon' })]))],
    ['a list that is not a list', ok({ success: true, data: { data: 'none', pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } } })],
    ['an answer with no data', ok({ success: true })],
  ])('does not show %s as a course or as an empty catalogue', async (_what, answer) => {
    coursePages = [answer];
    renderCatalog();

    expect(await screen.findByRole('alert')).toHaveTextContent('The course catalogue could not be loaded.');
    expect(screen.queryByText('Course details unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('No courses are listed')).not.toBeInTheDocument();
  });

  it('shows a request that never reached the server as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    renderCatalog();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
  });
});

describe('CourseCatalog: sessions and enrollment', () => {
  it('offers only the sessions of this course that are open, labelled by name and day, never by id', async () => {
    const user = userEvent.setup();
    renderCatalog();

    const dialog = await openCourse(user, 'Steward Fundamentals');
    const select = await within(dialog).findByLabelText('Available session');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));
    const labels = within(select).getAllByRole('option').map((option) => option.textContent);
    // A date column is the day that was recorded: shown in UTC it is Nov 2, never Nov 1 in a western time zone.
    expect(labels).toEqual(['Select a session', 'Spring cohort · Nov 2, 2099 – Nov 3, 2099', 'STW-101-B · Dec 1, 2099']);
    expect(dialog.textContent).not.toContain(SESSION_A1);
    expect(dialog.textContent).not.toContain('Other course session');
  });

  it('does not offer a session that is full, closed to registration, or not scheduled', async () => {
    sessionPages = [ok(crudList([
      sessionRow({ sessionName: 'Full session', maxEnrollment: 10, registrationCount: 10 }),
      sessionRow({ id: SESSION_A2, sessionName: 'Closed window', registrationCloseDate: '2000-01-01' }),
      sessionRow({ id: 'ab000000-1111-4111-8111-000000000009', sessionName: 'Cancelled session', sessionStatus: 'cancelled' }),
      sessionRow({ id: 'ab000000-1111-4111-8111-000000000010', sessionName: 'No status', sessionStatus: null }),
    ]))];
    const user = userEvent.setup();
    renderCatalog();

    const dialog = await openCourse(user, 'Steward Fundamentals');

    expect(await within(dialog).findByText(/No session of this course is open for registration/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Enroll in selected session' })).toBeDisabled();
  });

  it('reads every page of the sessions, so a later session of the course is not missing', async () => {
    sessionPages = [
      ok(crudList([sessionRow({ id: SESSION_B1, courseId: COURSE_B, sessionName: 'Other course session' })], 1, 2)),
      ok(crudList([sessionRow({ sessionName: 'Late session' })], 2, 2)),
    ];
    const user = userEvent.setup();
    renderCatalog();

    const dialog = await openCourse(user, 'Steward Fundamentals');

    expect(await within(dialog).findByRole('option', { name: /Late session/ })).toBeInTheDocument();
  });

  it('shows the route’s message when the sessions cannot be read, and does not allow enrollment', async () => {
    sessionPages = [failure(500, 'Sessions are down')];
    const user = userEvent.setup();
    renderCatalog();

    const dialog = await openCourse(user, 'Steward Fundamentals');

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Sessions could not be loaded');
    expect(alert).toHaveTextContent('Sessions are down');
    expect(within(dialog).queryByText(/No session of this course is open/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Enroll in selected session' })).toBeDisabled();
  });

  it('registers for the selected session with only the course and the session, and says so', async () => {
    const user = userEvent.setup();
    renderCatalog();
    const dialog = await openCourse(user, 'Steward Fundamentals');
    const select = await within(dialog).findByLabelText('Available session');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));

    await user.selectOptions(select, SESSION_A1);
    await user.click(within(dialog).getByRole('button', { name: 'Enroll in selected session' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Registration submitted. Check My Courses for its current status.');
    expect(calls.filter((call) => call.method === 'POST')).toEqual([{ url: '/api/education/registrations', method: 'POST', body: { courseId: COURSE_A, sessionId: SESSION_A1 } }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the route’s reason when the registration is refused, and keeps the dialog open', async () => {
    register = () => failure(409, 'This session is full');
    const user = userEvent.setup();
    renderCatalog();
    const dialog = await openCourse(user, 'Steward Fundamentals');
    const select = await within(dialog).findByLabelText('Available session');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));

    await user.selectOptions(select, SESSION_A1);
    await user.click(within(dialog).getByRole('button', { name: 'Enroll in selected session' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Registration could not be completed: This session is full');
    expect(screen.queryByText('Registration submitted. Check My Courses for its current status.')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Enroll in selected session' })).toBeEnabled();
  });

  it('does not say it registered when the answer is not the created registration', async () => {
    register = () => ok(crudItem({ id: 'ee000000-0000-4000-8000-000000000000', courseId: COURSE_A, sessionId: SESSION_A2 }));
    const user = userEvent.setup();
    renderCatalog();
    const dialog = await openCourse(user, 'Steward Fundamentals');
    const select = await within(dialog).findByLabelText('Available session');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));

    await user.selectOptions(select, SESSION_A1);
    await user.click(within(dialog).getByRole('button', { name: 'Enroll in selected session' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Registration identity mismatch');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says a fee that is unavailable pauses enrollment, and a missing sign-in is named', async () => {
    coursePages = [ok(crudList([courseRow({ courseFee: null })]))];
    const user = userEvent.setup();
    renderCatalog(null);

    const dialog = await openCourse(user, 'Steward Fundamentals');

    expect(await within(dialog).findByText(/enrollment is paused until it can be confirmed/)).toBeInTheDocument();
    expect(within(dialog).getByText('Sign in to enroll.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Enroll in selected session' })).toBeDisabled();
  });
});
