/**
 * The calendar event form and what the event routes accept of it.
 *
 * POST /api/calendar/events takes any column of calendar_events (the organization, the organizer and the creator are the caller's, never the
 * form's). PATCH /api/calendar/events/[id] takes only title, description, location, startTime and endTime, so an event can be renamed, moved
 * or described after it is made but not retyped, made all-day or given a meeting link. The form therefore offers those other fields only
 * when an event is created, and an edit sends only what the person changed.
 *
 * Times: a datetime-local input holds the browser's wall-clock time without a zone, so it is turned into the instant it names before it is
 * sent, and an instant read back is shown in the browser's zone. An all-day event runs from local midnight of its first day to local
 * midnight after its last.
 */

import { ApiShapeError } from '@/lib/client/api-envelope';

export interface EventFormData {
  title: string;
  description: string;
  location: string;
  /** 'YYYY-MM-DDTHH:mm' in the browser's zone, or 'YYYY-MM-DD' for an all-day event. */
  startTime: string;
  endTime: string;
  timezone: string;
  isAllDay: boolean;
  eventType: string;
  meetingUrl: string;
}

/** An event as the calendar's event list returns it. */
export interface CalendarEventDetail {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  eventType: string | null;
  status: string;
}

export type EventFormProblem = 'calendar' | 'title' | 'start' | 'end' | 'range';

export class EventFormError extends Error {
  constructor(readonly problem: EventFormProblem) {
    super(`Event form: ${problem}`);
    this.name = 'EventFormError';
  }
}

const textOf = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** An event from a record of GET /api/calendars/[id]/events; a record without an id, a title and times is not an event. */
export function eventDetailFrom(record: Record<string, unknown>): CalendarEventDetail {
  const id = textOf(record.id);
  const title = textOf(record.title);
  const startTime = textOf(record.startTime);
  const endTime = textOf(record.endTime);
  if (!id || title === null || !startTime || !endTime) throw new ApiShapeError('not an event');
  return {
    id,
    calendarId: textOf(record.calendarId) ?? '',
    title,
    description: textOf(record.description),
    location: textOf(record.location),
    startTime,
    endTime,
    isAllDay: record.isAllDay === true,
    eventType: textOf(record.eventType),
    status: textOf(record.status) ?? 'scheduled',
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** 'YYYY-MM-DDTHH:mm' in the browser's zone, the value a datetime-local input takes. */
export function toLocalInputValue(instant: Date | string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** Local midnight of the day a 'YYYY-MM-DD…' value names, `plusDays` later; null when it names no day. */
function localMidnight(value: string, plusDays = 0): Date | null {
  const match = DAY.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + plusDays);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The instant a datetime-local value names, as an ISO string; null when it names none. */
export function instantOfLocalValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Moves the form between a timed and an all-day event, keeping the day the person chose so the inputs never hold a value they cannot show. */
export function withAllDay(form: EventFormData, isAllDay: boolean): EventFormData {
  if (isAllDay === form.isAllDay) return form;
  if (isAllDay) {
    return { ...form, isAllDay, startTime: form.startTime.slice(0, 10), endTime: form.endTime.slice(0, 10) };
  }
  return {
    ...form,
    isAllDay,
    startTime: form.startTime.length === 10 ? `${form.startTime}T09:00` : form.startTime,
    endTime: form.endTime.length === 10 ? `${form.endTime}T10:00` : form.endTime,
  };
}

export function blankEventForm(timezone: string, initialDate?: Date): EventFormData {
  const start = initialDate ? new Date(initialDate) : null;
  const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
  return {
    title: '',
    description: '',
    location: '',
    startTime: start ? toLocalInputValue(start) : '',
    endTime: end ? toLocalInputValue(end) : '',
    timezone,
    isAllDay: false,
    eventType: 'meeting',
    meetingUrl: '',
  };
}

export function formFromEvent(event: CalendarEventDetail, timezone: string): EventFormData {
  const start = toLocalInputValue(event.startTime);
  // An all-day event ends at local midnight after its last day, so its last day is the one before that, and never before its first.
  const firstDay = start.slice(0, 10);
  const lastDay = toLocalInputValue(new Date(new Date(event.endTime).getTime() - 1)).slice(0, 10);
  return {
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    startTime: event.isAllDay ? firstDay : start,
    endTime: event.isAllDay ? (lastDay < firstDay ? firstDay : lastDay) : toLocalInputValue(event.endTime),
    timezone,
    isAllDay: event.isAllDay,
    eventType: event.eventType ?? 'meeting',
    meetingUrl: '',
  };
}

const startInstant = (value: string, isAllDay: boolean): string | null =>
  isAllDay ? (localMidnight(value)?.toISOString() ?? null) : instantOfLocalValue(value);
const endInstant = (value: string, isAllDay: boolean): string | null =>
  isAllDay ? (localMidnight(value, 1)?.toISOString() ?? null) : instantOfLocalValue(value);

/** The ISO start and end the form names; an all-day event ends at local midnight after its last day. */
function rangeOf(form: EventFormData): { start: string; end: string } {
  const start = startInstant(form.startTime, form.isAllDay);
  if (!start) throw new EventFormError('start');
  const end = endInstant(form.endTime, form.isAllDay);
  if (!end) throw new EventFormError('end');
  if (new Date(end).getTime() <= new Date(start).getTime()) throw new EventFormError('range');
  return { start, end };
}

/** The body of POST /api/calendar/events. */
export function createEventBody(form: EventFormData, calendarId: string): Record<string, unknown> {
  if (!calendarId) throw new EventFormError('calendar');
  const title = form.title.trim();
  if (!title) throw new EventFormError('title');
  const { start, end } = rangeOf(form);
  const body: Record<string, unknown> = {
    calendarId,
    title,
    startTime: start,
    endTime: end,
    timezone: form.timezone,
    isAllDay: form.isAllDay,
    eventType: form.eventType,
  };
  if (form.description.trim()) body.description = form.description.trim();
  if (form.location.trim()) body.location = form.location.trim();
  if (form.meetingUrl.trim()) body.meetingUrl = form.meetingUrl.trim();
  return body;
}

/**
 * The body of PATCH /api/calendar/events/[id]: only the fields the person changed, compared with the form the event produced. Null when
 * nothing changed, so no request is made. A time the person did not touch is left exactly as stored, never re-sent from the form.
 */
export function updateEventBody(form: EventFormData, event: CalendarEventDetail): Record<string, unknown> | null {
  const initial = formFromEvent(event, form.timezone);
  const body: Record<string, unknown> = {};

  if (form.title !== initial.title) {
    const title = form.title.trim();
    if (!title) throw new EventFormError('title');
    body.title = title;
  }
  if (form.description !== initial.description) body.description = form.description.trim() || null;
  if (form.location !== initial.location) body.location = form.location.trim() || null;

  const startChanged = form.startTime !== initial.startTime;
  const endChanged = form.endTime !== initial.endTime;
  if (startChanged || endChanged) {
    const start = startChanged ? startInstant(form.startTime, event.isAllDay) : event.startTime;
    if (!start) throw new EventFormError('start');
    const end = endChanged ? endInstant(form.endTime, event.isAllDay) : event.endTime;
    if (!end) throw new EventFormError('end');
    if (new Date(end).getTime() <= new Date(start).getTime()) throw new EventFormError('range');
    if (startChanged) body.startTime = start;
    if (endChanged) body.endTime = end;
  }

  return Object.keys(body).length > 0 ? body : null;
}
