import { describe, expect, it } from 'vitest';
import {
  EventFormError,
  blankEventForm,
  createEventBody,
  eventDetailFrom,
  formFromEvent,
  toLocalInputValue,
  updateEventBody,
  withAllDay,
  type CalendarEventDetail,
  type EventFormData,
} from './event-form';
import { ApiShapeError } from '@/lib/client/api-envelope';

const CALENDAR = '11111111-1111-4111-8111-111111111111';
const form = (over: Partial<EventFormData> = {}): EventFormData => ({
  ...blankEventForm('America/Toronto'),
  title: 'Grievance hearing',
  startTime: '2026-11-03T10:00',
  endTime: '2026-11-03T11:30',
  ...over,
});
const stored = (over: Partial<CalendarEventDetail> = {}): CalendarEventDetail => ({
  id: '22222222-2222-4222-8222-222222222222',
  calendarId: CALENDAR,
  title: 'Grievance hearing',
  description: 'Room 4',
  location: 'Union hall',
  startTime: new Date(2026, 10, 3, 10, 0).toISOString(),
  endTime: new Date(2026, 10, 3, 11, 30).toISOString(),
  isAllDay: false,
  eventType: 'hearing',
  status: 'scheduled',
  ...over,
});
const allDayEvent = (lastDay: number) =>
  stored({ isAllDay: true, startTime: new Date(2026, 10, 3).toISOString(), endTime: new Date(2026, 10, lastDay + 1).toISOString() });
const problemOf = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof EventFormError ? error.problem : 'other';
  }
  return null;
};

describe('local time values', () => {
  it('shows an instant as the wall-clock time of the browser zone, and nothing for a bad one', () => {
    expect(toLocalInputValue(new Date(2026, 10, 3, 9, 5))).toBe('2026-11-03T09:05');
    expect(toLocalInputValue(new Date(2026, 10, 3, 9, 5).toISOString())).toBe('2026-11-03T09:05');
    expect(toLocalInputValue('not a time')).toBe('');
  });

  it('starts a new event from the clicked day for one hour, or blank when no day was chosen', () => {
    const clicked = blankEventForm('America/Toronto', new Date(2026, 10, 3, 14, 0));
    expect([clicked.startTime, clicked.endTime]).toEqual(['2026-11-03T14:00', '2026-11-03T15:00']);
    const blank = blankEventForm('America/Toronto');
    expect([blank.startTime, blank.endTime, blank.title, blank.eventType]).toEqual(['', '', '', 'meeting']);
  });

  it('moves a form between timed and all-day without leaving a value the inputs cannot show', () => {
    const allDay = withAllDay(form(), true);
    expect([allDay.isAllDay, allDay.startTime, allDay.endTime]).toEqual([true, '2026-11-03', '2026-11-03']);
    const timed = withAllDay(allDay, false);
    expect([timed.isAllDay, timed.startTime, timed.endTime]).toEqual([false, '2026-11-03T09:00', '2026-11-03T10:00']);
    const unchanged = form();
    expect(withAllDay(unchanged, false)).toBe(unchanged);
  });
});

describe('createEventBody (POST /api/calendar/events)', () => {
  it('names the calendar and sends the instants the wall-clock times name, never the caller identity or fields no route stores', () => {
    const body = createEventBody(form({ description: ' Agenda ', location: ' Hall ', meetingUrl: 'https://meet.example/x' }), CALENDAR);
    expect(body).toEqual({
      calendarId: CALENDAR,
      title: 'Grievance hearing',
      startTime: new Date(2026, 10, 3, 10, 0).toISOString(),
      endTime: new Date(2026, 10, 3, 11, 30).toISOString(),
      timezone: 'America/Toronto',
      isAllDay: false,
      eventType: 'meeting',
      description: 'Agenda',
      location: 'Hall',
      meetingUrl: 'https://meet.example/x',
    });
    for (const key of ['organizationId', 'organizerId', 'createdBy', 'attendees', 'isRecurring', 'recurrenceRule', 'roomId', 'reminders']) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it('leaves out optional text the person did not fill in', () => {
    const body = createEventBody(form(), CALENDAR);
    expect(body).not.toHaveProperty('description');
    expect(body).not.toHaveProperty('location');
    expect(body).not.toHaveProperty('meetingUrl');
  });

  it('runs an all-day event from local midnight of its first day to local midnight after its last', () => {
    const one = createEventBody(withAllDay(form(), true), CALENDAR);
    expect(one).toMatchObject({ isAllDay: true, startTime: new Date(2026, 10, 3).toISOString(), endTime: new Date(2026, 10, 4).toISOString() });
    const three = createEventBody({ ...withAllDay(form(), true), endTime: '2026-11-05' }, CALENDAR);
    expect(three.endTime).toBe(new Date(2026, 10, 6).toISOString());
  });

  it('refuses what a route would reject or what is not an event, before any request', () => {
    expect(problemOf(() => createEventBody(form(), ''))).toBe('calendar');
    expect(problemOf(() => createEventBody(form({ title: '   ' }), CALENDAR))).toBe('title');
    expect(problemOf(() => createEventBody(form({ startTime: '' }), CALENDAR))).toBe('start');
    expect(problemOf(() => createEventBody(form({ endTime: 'soon' }), CALENDAR))).toBe('end');
    expect(problemOf(() => createEventBody(form({ endTime: '2026-11-03T10:00' }), CALENDAR))).toBe('range');
    expect(problemOf(() => createEventBody({ ...withAllDay(form(), true), endTime: '2026-11-02' }, CALENDAR))).toBe('range');
  });
});

describe('updateEventBody (PATCH /api/calendar/events/[id])', () => {
  it('sends nothing when nothing changed, so no request is made', () => {
    expect(updateEventBody(formFromEvent(stored(), 'America/Toronto'), stored())).toBeNull();
  });

  it('sends only the fields the person changed', () => {
    const edited = { ...formFromEvent(stored(), 'America/Toronto'), title: ' Arbitration hearing ' };
    expect(updateEventBody(edited, stored())).toEqual({ title: 'Arbitration hearing' });
  });

  it('clears a description or location with null rather than an empty string', () => {
    const edited = { ...formFromEvent(stored(), 'America/Toronto'), description: '  ', location: '' };
    expect(updateEventBody(edited, stored())).toEqual({ description: null, location: null });
  });

  it('moves an event with the instants the new wall-clock times name, and leaves an untouched end exactly as it is stored', () => {
    const start = formFromEvent(stored(), 'America/Toronto');
    expect(updateEventBody({ ...start, startTime: '2026-11-03T09:00' }, stored())).toEqual({ startTime: new Date(2026, 10, 3, 9, 0).toISOString() });
    const withSeconds = stored({ endTime: new Date(2026, 10, 3, 11, 30, 42).toISOString() });
    const moved = updateEventBody({ ...formFromEvent(withSeconds, 'America/Toronto'), startTime: '2026-11-03T09:30' }, withSeconds);
    expect(moved).toEqual({ startTime: new Date(2026, 10, 3, 9, 30).toISOString() });
  });

  it('refuses an end that does not follow the start, judged against the stored time when only one side changed', () => {
    const base = formFromEvent(stored(), 'America/Toronto');
    expect(problemOf(() => updateEventBody({ ...base, endTime: '2026-11-03T09:00' }, stored()))).toBe('range');
    expect(problemOf(() => updateEventBody({ ...base, startTime: '2026-11-03T12:00' }, stored()))).toBe('range');
    expect(problemOf(() => updateEventBody({ ...base, startTime: '' }, stored()))).toBe('start');
    expect(problemOf(() => updateEventBody({ ...base, title: ' ' }, stored()))).toBe('title');
  });

  it('never sends a field the PATCH route does not accept', () => {
    const edited = { ...formFromEvent(stored(), 'America/Toronto'), title: 'x', eventType: 'training', meetingUrl: 'https://m.example', isAllDay: true };
    const body = updateEventBody(edited, stored());
    expect(Object.keys(body ?? {}).sort()).toEqual(['title']);
  });

  it('edits an all-day event by its days: the form shows the first and last day, and a change is sent as local midnights', () => {
    const event = allDayEvent(5);
    const form = formFromEvent(event, 'America/Toronto');
    expect([form.isAllDay, form.startTime, form.endTime]).toEqual([true, '2026-11-03', '2026-11-05']);
    expect(updateEventBody(form, event)).toBeNull();
    expect(updateEventBody({ ...form, endTime: '2026-11-07' }, event)).toEqual({ endTime: new Date(2026, 10, 8).toISOString() });
    expect(updateEventBody({ ...form, startTime: '2026-11-04' }, event)).toEqual({ startTime: new Date(2026, 10, 4).toISOString() });
    expect(problemOf(() => updateEventBody({ ...form, startTime: '2026-11-06' }, event))).toBe('range');
  });

  it('shows a one-day all-day event as a single day, and never an end before its start', () => {
    expect(formFromEvent(allDayEvent(3), 'America/Toronto')).toMatchObject({ startTime: '2026-11-03', endTime: '2026-11-03' });
    const degenerate = stored({ isAllDay: true, startTime: new Date(2026, 10, 3).toISOString(), endTime: new Date(2026, 10, 3).toISOString() });
    expect(formFromEvent(degenerate, 'America/Toronto')).toMatchObject({ startTime: '2026-11-03', endTime: '2026-11-03' });
  });
});

describe('eventDetailFrom (a record of GET /api/calendars/[id]/events)', () => {
  it('reads the stored event, with null for a description or location it does not have and false when all-day is not stated', () => {
    expect(eventDetailFrom({ ...stored(), description: null, location: undefined, isAllDay: undefined, organizerId: 'u1' })).toEqual({
      ...stored(),
      description: null,
      location: null,
      isAllDay: false,
    });
    expect(eventDetailFrom({ ...stored(), isAllDay: true }).isAllDay).toBe(true);
  });

  it('refuses a record that is not an event rather than opening a blank one', () => {
    expect(() => eventDetailFrom({})).toThrow(ApiShapeError);
    expect(() => eventDetailFrom({ id: 'a', title: 'x', startTime: 'y' })).toThrow(ApiShapeError);
    expect(() => eventDetailFrom({ id: 'a', title: null, startTime: 'y', endTime: 'z' })).toThrow(ApiShapeError);
  });
});
