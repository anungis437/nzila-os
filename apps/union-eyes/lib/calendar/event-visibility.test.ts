import { describe, expect, it } from 'vitest';
import { canSeeCalendarEvent, canModifyCalendarEvent, type CalendarAccessRow } from './event-visibility';

const owned: CalendarAccessRow = {
  organizerId: 'user-a',
  isPrivate: false,
  visibility: 'default',
  calendarOwnerId: 'user-a',
  calendarIsPersonal: true,
};

describe('calendar personal-event boundaries', () => {
  it('permits the owner of a personal calendar', () => {
    expect(canSeeCalendarEvent(owned, 'user-a')).toBe(true);
    expect(canModifyCalendarEvent(owned, 'user-a')).toBe(true);
  });

  it('refuses another member of the same organization a personal calendar', () => {
    expect(canSeeCalendarEvent(owned, 'user-b')).toBe(false);
    expect(canModifyCalendarEvent(owned, 'user-b')).toBe(false);
  });

  it('lets organization members read ordinary shared-calendar events without granting write authority', () => {
    const shared = { ...owned, calendarIsPersonal: false };
    expect(canSeeCalendarEvent(shared, 'user-b')).toBe(true);
    expect(canModifyCalendarEvent(shared, 'user-b')).toBe(false);
  });

  it('keeps private and confidential shared events organizer-only', () => {
    for (const variant of [
      { isPrivate: true, visibility: 'default' },
      { isPrivate: false, visibility: 'private' },
      { isPrivate: false, visibility: 'confidential' },
    ]) {
      const event = { ...owned, calendarIsPersonal: false, ...variant };
      expect(canSeeCalendarEvent(event, 'user-a')).toBe(true);
      expect(canSeeCalendarEvent(event, 'user-b')).toBe(false);
    }
  });

  it('fails closed if a calendar has no explicit non-personal designation', () => {
    expect(canSeeCalendarEvent({ ...owned, calendarIsPersonal: null }, 'user-b')).toBe(false);
  });
});
