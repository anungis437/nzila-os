// @vitest-environment jsdom
// jsdom tests of the calendar page against a mocked fetch. They prove which routes the page calls to list, create, change and delete events,
// with what body, and what it shows when the server refuses; they prove nothing about the real routes (see the route tests for those).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next-intl', () => ({
  useLocale: () => 'en-CA',
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/calendar/CalendarView', () => ({
  CalendarView: (props: {
    events?: Array<{ id: string; title: string }>;
    onEventClick?: (event: unknown) => void;
    onCreateEvent?: (date: Date) => void;
  }) => (
    <div data-testid="calendar-view">
      {(props.events ?? []).map((event) => (
        <button key={event.id} onClick={() => props.onEventClick?.(event)}>
          {event.title}
        </button>
      ))}
      <button onClick={() => props.onCreateEvent?.(new Date(2026, 10, 3, 14, 0))}>pick-day</button>
    </div>
  ),
}));
vi.mock('@/components/calendar/CalendarSidebar', () => ({
  CalendarSidebar: (props: { calendars: Array<{ id: string; name: string; visibility: boolean }> }) => (
    <ul data-testid="sidebar">
      {props.calendars.map((calendar) => (
        <li key={calendar.id}>{`${calendar.name}:${String(calendar.visibility)}`}</li>
      ))}
    </ul>
  ),
}));
vi.mock('@/components/calendar/CalendarSyncManager', () => ({ CalendarSyncManager: () => null }));

import CalendarPage from '../page';

const CAL = '11111111-1111-4111-8111-111111111111';
const EV = '22222222-2222-4222-8222-222222222222';
const hearing = {
  id: EV,
  calendarId: CAL,
  title: 'Hearing prep',
  description: 'Bring the file',
  location: 'Union hall',
  startTime: new Date(2026, 10, 3, 10, 0).toISOString(),
  endTime: new Date(2026, 10, 3, 11, 0).toISOString(),
  isAllDay: false,
  eventType: 'hearing',
  status: 'scheduled',
  organizerId: 'user-1',
  visibility: 'default',
};

type Reply = { status?: number; body?: unknown };
type Routes = Record<string, (init?: RequestInit) => Reply>;

const answer = ({ status = 200, body = {} }: Reply) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

function mockServer(overrides: Routes = {}) {
  const calls: Array<{ key: string; body: unknown }> = [];
  const routes: Routes = {
    'GET /api/calendars': () => ({ body: { success: true, data: { data: [{ id: CAL, name: 'Union calendar', color: '#3B82F6' }] } } }),
    [`GET /api/calendars/${CAL}/events`]: () => ({ body: { success: true, data: { data: [hearing], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } } } }),
    ...overrides,
  };
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = routes[key];
    return answer(handler ? handler(init) : { status: 404, body: { code: 'NOT_FOUND', message: `no route ${key}` } });
  });
  vi.stubGlobal('fetch', fetchMock);
  const called = (key: string) => calls.filter((call) => call.key === key);
  return { calls, called };
}

const openEventDialog = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Hearing prep' }));
  return screen.findByRole('heading', { name: 'Edit Event' });
};

beforeEach(() => {
  vi.stubGlobal('confirm', vi.fn(() => true));
  // Radix measures the event-type select with ResizeObserver, which jsdom does not provide.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CalendarPage (jsdom, mocked server)', () => {
  it('lists the calendars and the selected calendar’s events from the routes that exist', async () => {
    const server = mockServer();
    render(<CalendarPage />);
    expect(await screen.findByRole('button', { name: 'Hearing prep' }, { timeout: 5000 })).toBeInTheDocument();
    expect(server.calls.map((call) => call.key)).toEqual(['GET /api/calendars', `GET /api/calendars/${CAL}/events`]);
    expect(screen.getByTestId('sidebar')).toHaveTextContent('Union calendar:true');
  });

  it('creates an event with POST /api/calendar/events: the calendar and the instants the times name, nothing the route does not store', async () => {
    const server = mockServer({ 'POST /api/calendar/events': () => ({ status: 201, body: { success: true, data: { data: { id: EV } } } }) });
    render(<CalendarPage />);
    await screen.findByRole('button', { name: 'Hearing prep' });

    fireEvent.click(screen.getByRole('button', { name: 'calendar.newEvent' }));
    await screen.findByRole('heading', { name: 'Create Event' });
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: '  Steward meeting ' } });
    fireEvent.change(screen.getByLabelText('Start Time *'), { target: { value: '2026-11-04T09:30' } });
    fireEvent.change(screen.getByLabelText('End Time *'), { target: { value: '2026-11-04T10:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(server.called('POST /api/calendar/events')).toHaveLength(1));
    const [{ body }] = server.called('POST /api/calendar/events');
    expect(body).toMatchObject({
      calendarId: CAL,
      title: 'Steward meeting',
      startTime: new Date(2026, 10, 4, 9, 30).toISOString(),
      endTime: new Date(2026, 10, 4, 10, 30).toISOString(),
      isAllDay: false,
      eventType: 'meeting',
    });
    for (const key of ['organizationId', 'organizerId', 'createdBy', 'attendees', 'isRecurring', 'recurrenceRule', 'roomId', 'reminders']) {
      expect(body).not.toHaveProperty(key);
    }
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Create Event' })).not.toBeInTheDocument());
    expect(server.called(`GET /api/calendars/${CAL}/events`)).toHaveLength(2);
  });

  it('starts a new event from the day that was picked, shown in the browser’s wall-clock time', async () => {
    mockServer();
    render(<CalendarPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'pick-day' }));
    await screen.findByRole('heading', { name: 'Create Event' });
    expect(screen.getByLabelText('Start Time *')).toHaveValue('2026-11-03T14:00');
    expect(screen.getByLabelText('End Time *')).toHaveValue('2026-11-03T15:00');
  });

  it('does not offer attendees or recurrence, which no route stores', async () => {
    mockServer();
    render(<CalendarPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'calendar.newEvent' }));
    await screen.findByRole('heading', { name: 'Create Event' });
    expect(screen.queryByLabelText(/attendees/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recurring/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/RRULE/i)).not.toBeInTheDocument();
  });

  it('says why a create was refused and keeps the dialog open, instead of closing as though it had worked', async () => {
    const server = mockServer({
      'POST /api/calendar/events': () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'steward' role" } }),
    });
    render(<CalendarPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'pick-day' }));
    await screen.findByRole('heading', { name: 'Create Event' });
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Steward meeting' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Requires at least 'steward' role");
    expect(screen.getByRole('heading', { name: 'Create Event' })).toBeInTheDocument();
    expect(server.called(`GET /api/calendars/${CAL}/events`)).toHaveLength(1);
  });

  it('refuses an end that is not after the start before any request is made', async () => {
    const server = mockServer();
    render(<CalendarPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'pick-day' }));
    await screen.findByRole('heading', { name: 'Create Event' });
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Steward meeting' } });
    fireEvent.change(screen.getByLabelText('End Time *'), { target: { value: '2026-11-03T13:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The end must be after the start.');
    expect(server.called('POST /api/calendar/events')).toHaveLength(0);
  });

  it('opens an event with its stored values and changes it with PATCH /api/calendar/events/[id], sending only what changed', async () => {
    const server = mockServer({ [`PATCH /api/calendar/events/${EV}`]: () => ({ body: { success: true, data: { data: { id: EV } } } }) });
    render(<CalendarPage />);
    await openEventDialog();
    expect(screen.getByLabelText('Title *')).toHaveValue('Hearing prep');
    expect(screen.getByLabelText('Location')).toHaveValue('Union hall');
    expect(screen.getByLabelText('Description')).toHaveValue('Bring the file');
    expect(screen.getByLabelText('Start Time *')).toHaveValue('2026-11-03T10:00');
    // Only what an edit can save is offered.
    expect(screen.queryByLabelText('Meeting URL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('All-day event')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Event Type')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Arbitration prep' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(server.called(`PATCH /api/calendar/events/${EV}`)).toHaveLength(1));
    expect(server.called(`PATCH /api/calendar/events/${EV}`)[0].body).toEqual({ title: 'Arbitration prep' });
    expect(server.calls.some((call) => call.key.startsWith('PATCH /api/calendars/'))).toBe(false);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Event' })).not.toBeInTheDocument());
  });

  it('makes no request when an edit changed nothing', async () => {
    const server = mockServer();
    render(<CalendarPage />);
    await openEventDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Event' })).not.toBeInTheDocument());
    expect(server.calls.filter((call) => call.key.startsWith('PATCH'))).toHaveLength(0);
  });

  it('deletes an event with DELETE /api/calendar/events/[id] and reloads the list', async () => {
    const server = mockServer({ [`DELETE /api/calendar/events/${EV}`]: () => ({ body: { success: true, data: { deleted: true, id: EV } } }) });
    render(<CalendarPage />);
    await openEventDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(server.called(`DELETE /api/calendar/events/${EV}`)).toHaveLength(1));
    await waitFor(() => expect(server.called(`GET /api/calendars/${CAL}/events`)).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Event' })).not.toBeInTheDocument());
  });

  it('keeps the dialog open and says so when a delete is refused', async () => {
    mockServer({ [`DELETE /api/calendar/events/${EV}`]: () => ({ status: 404, body: { code: 'NOT_FOUND', message: 'Event not found' } }) });
    render(<CalendarPage />);
    await openEventDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Event not found');
    expect(screen.getByRole('heading', { name: 'Edit Event' })).toBeInTheDocument();
  });

  it('says the events could not be loaded rather than showing an empty calendar', async () => {
    mockServer({ [`GET /api/calendars/${CAL}/events`]: () => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Internal error' } }) });
    render(<CalendarPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal error');
    expect(screen.queryByRole('button', { name: 'Hearing prep' })).not.toBeInTheDocument();
  });

  it('says the calendars could not be loaded when the list is not the shape the route returns', async () => {
    mockServer({ 'GET /api/calendars': () => ({ body: { calendars: [] } }) });
    render(<CalendarPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Calendars could not be loaded.');
  });
});

describe('CalendarPage: creating a calendar (jsdom, mocked server)', () => {
  const NEW = '33333333-3333-4333-8333-333333333333';
  const empty = { 'GET /api/calendars': () => ({ body: { success: true, data: { data: [] } } }) };

  async function fillCreateDialog(name = 'Team calendar') {
    fireEvent.click(await screen.findByRole('button', { name: 'calendar.createFirstCalendar' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: name } });
  }

  it('creates the calendar with the fields the route stores, then lists the calendars again and closes', async () => {
    let created = false;
    const server = mockServer({
      'GET /api/calendars': () => ({ body: { success: true, data: { data: created ? [{ id: NEW, name: 'Team calendar', color: '#2563eb' }] : [] } } }),
      'POST /api/calendars': () => {
        created = true;
        return { status: 201, body: { success: true, data: { data: { id: NEW, name: 'Team calendar' } } } };
      },
      [`GET /api/calendars/${NEW}/events`]: () => ({ body: { success: true, data: { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } } } }),
    });
    render(<CalendarPage />);
    await fillCreateDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Create Calendar' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Create Calendar' })).not.toBeInTheDocument());
    expect(server.called('POST /api/calendars')[0].body).toEqual({ name: 'Team calendar', color: '#2563eb', timezone: 'America/New_York', isPersonal: true });
    expect(screen.getByTestId('sidebar')).toHaveTextContent('Team calendar:true');
    expect(server.called('GET /api/calendars')).toHaveLength(2);
  });

  it.each([
    [403, { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'steward' role" }, "Requires at least 'steward' role"],
    [500, {}, 'The calendar could not be created.'],
  ])('says why the calendar could not be created (%s) and keeps the dialog open with what was typed', async (status, answer, shown) => {
    const server = mockServer({ ...empty, 'POST /api/calendars': () => ({ status, body: answer }) });
    render(<CalendarPage />);
    await fillCreateDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Create Calendar' }));

    expect(await screen.findByText(shown)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create Calendar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Team calendar');
    expect(server.called('GET /api/calendars')).toHaveLength(1);
  });

  it('takes the earlier refusal back when the dialog is opened again', async () => {
    mockServer({ ...empty, 'POST /api/calendars': () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Not allowed' } }) });
    render(<CalendarPage />);
    await fillCreateDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create Calendar' }));
    await screen.findByText('Not allowed');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Create Calendar' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'calendar.createFirstCalendar' }));

    await screen.findByRole('heading', { name: 'Create Calendar' });
    expect(screen.queryByText('Not allowed')).not.toBeInTheDocument();
  });
});
