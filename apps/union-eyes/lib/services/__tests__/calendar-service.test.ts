/**
 * Calendar Service — Unit Tests
 *
 * Tests:
 *   - getCalendarById: fetch calendar
 *   - createCalendar: insert
 *   - createEvent: event creation
 *   - generateRecurringInstances: recurrence expansion
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockFindMany, mockInsertValues, mockReturning } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  return {
    mockFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockReturning,
  };
});

vi.mock('@/db/db', () => ({
  db: {
    query: {
      calendars: { findFirst: mockFindFirst, findMany: mockFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReturning })) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({ offset: vi.fn(async () => []) })),
        })),
        limit: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  calendars: {
    id: 'id', organizationId: 'organizationId', name: 'name', calendarType: 'calendarType',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getCalendarById, createCalendar, createEvent, generateRecurringInstances } from '../calendar-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getCalendarById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns calendar when found', async () => {
    const cal = { id: 'cal-1', name: 'Union Events' };
    mockFindFirst.mockResolvedValue(cal);
    const result = await getCalendarById('cal-1');
    expect(result).toEqual(cal);
  });

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getCalendarById('missing');
    expect(result).toBeNull();
  });
});

describe('createCalendar', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new calendar', async () => {
    const newCal = { id: 'cal-new', name: 'Bargaining Schedule' };
    mockReturning.mockResolvedValue([newCal]);
    const result = await createCalendar({
      organizationId: 'org-1', name: 'Bargaining Schedule',
    } as never);
    expect(result).toEqual(newCal);
  });
});

describe('createEvent', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates in-memory event with generated id', async () => {
    const result = await createEvent({
      calendarId: 'cal-1', title: 'Team Meeting',
      startTime: new Date(), endTime: new Date(),
    } as never);
    expect(result.id).toMatch(/^event-/);
    expect(result.title).toBe('Team Meeting');
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});

describe('generateRecurringInstances', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty array when event not found', async () => {
    const result = await generateRecurringInstances(
      'evt-nonexistent',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    );
    expect(result).toEqual([]);
  });
});
