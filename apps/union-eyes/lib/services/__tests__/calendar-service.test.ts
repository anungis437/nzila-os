/**
 * Calendar Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([{ id: "cal-1", name: "Test Calendar" }]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  const mockSetWhere = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
  const mockOrderBy = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  return {
    mockDb: {
      select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete,
      query: {
        calendars: { findFirst: vi.fn() },
      },
    },
    mockSelect, mockFrom, mockWhere, mockOrderBy,
    mockInsert, mockValues, mockReturning,
    mockUpdate, mockSet, mockSetWhere,
    mockDelete, mockDeleteWhere,
  };
});

vi.mock("@/db/db", () => ({ db: mocks.mockDb }));
vi.mock("@/db/schema", () => ({
  calendars: { id: "id", organizationId: "organizationId", ownerId: "ownerId", isPersonal: "isPersonal", isShared: "isShared", name: "name" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c, v) => ({ _type: "eq", v })),
  and: vi.fn((...a: any[]) => ({ _type: "and", a })),
  asc: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getCalendarById, listCalendars, createCalendar, updateCalendar, deleteCalendar,
  createEvent, getEventById, updateEvent, deleteEvent, listEvents,
  getEventsForDateRange, generateRecurringInstances,
  addRecurringException, updateRecurringInstance,
  addAttendee, updateAttendeeResponse, removeAttendee, getEventAttendees,
} from "../calendar-service";

describe("calendar-service", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Calendar CRUD ────────────────────────────────────────────────────────
  describe("getCalendarById", () => {
    it("returns calendar when found", async () => {
      mocks.mockDb.query.calendars.findFirst.mockResolvedValueOnce({ id: "cal-1", name: "Team Calendar" });
      const result = await getCalendarById("cal-1");
      expect(result).toEqual({ id: "cal-1", name: "Team Calendar" });
    });

    it("returns null when not found", async () => {
      mocks.mockDb.query.calendars.findFirst.mockResolvedValueOnce(undefined);
      const result = await getCalendarById("nope");
      expect(result).toBeNull();
    });

    it("throws on db error", async () => {
      mocks.mockDb.query.calendars.findFirst.mockRejectedValueOnce(new Error("DB error"));
      await expect(getCalendarById("cal-1")).rejects.toThrow("Failed to fetch calendar");
    });
  });

  describe("listCalendars", () => {
    it("returns calendars with default filters", async () => {
      const cals = [{ id: "c1", name: "A" }];
      mocks.mockOrderBy.mockResolvedValueOnce(cals);
      const result = await listCalendars();
      expect(result).toEqual(cals);
    });

    it("applies all filter conditions", async () => {
      mocks.mockOrderBy.mockResolvedValueOnce([]);
      await listCalendars({ organizationId: "org-1", ownerId: "u1", isPersonal: true, isShared: false });
      expect(mocks.mockSelect).toHaveBeenCalled();
    });

    it("throws on error", async () => {
      mocks.mockOrderBy.mockRejectedValueOnce(new Error("fail"));
      await expect(listCalendars()).rejects.toThrow("Failed to list calendars");
    });
  });

  describe("createCalendar", () => {
    it("inserts and returns calendar", async () => {
      mocks.mockReturning.mockResolvedValueOnce([{ id: "new-cal", name: "New" }]);
      const result = await createCalendar({ name: "New" } as never);
      expect(result).toEqual({ id: "new-cal", name: "New" });
    });

    it("throws on insert error", async () => {
      mocks.mockReturning.mockRejectedValueOnce(new Error("dup"));
      await expect(createCalendar({} as never)).rejects.toThrow("Failed to create calendar");
    });
  });

  describe("updateCalendar", () => {
    it("returns updated calendar", async () => {
      mocks.mockReturning.mockResolvedValueOnce([{ id: "cal-1", name: "Updated" }]);
      const result = await updateCalendar("cal-1", { name: "Updated" } as never);
      expect(result).toEqual({ id: "cal-1", name: "Updated" });
    });

    it("returns null when not found", async () => {
      mocks.mockReturning.mockResolvedValueOnce([]);
      const result = await updateCalendar("nope", {});
      expect(result).toBeNull();
    });
  });

  describe("deleteCalendar", () => {
    it("returns true", async () => {
      const result = await deleteCalendar("cal-1");
      expect(result).toBe(true);
    });

    it("throws on error", async () => {
      mocks.mockDeleteWhere.mockRejectedValueOnce(new Error("fail"));
      await expect(deleteCalendar("x")).rejects.toThrow("Failed to delete calendar");
    });
  });

  // ── Event operations (many are stubs) ────────────────────────────────────
  describe("createEvent", () => {
    it("returns event with generated ID", async () => {
      const result = await createEvent({
        calendarId: "cal-1", title: "Meeting", eventType: "meeting",
        startTime: new Date(), endTime: new Date(), allDay: false,
        status: "confirmed", createdBy: "u1",
      });
      expect(result.id).toMatch(/^event-/);
      expect(result.title).toBe("Meeting");
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("getEventById", () => {
    it("returns null (stub)", async () => {
      expect(await getEventById("e1")).toBeNull();
    });
  });

  describe("updateEvent", () => {
    it("returns null (stub)", async () => {
      expect(await updateEvent("e1", { title: "X" })).toBeNull();
    });
  });

  describe("deleteEvent", () => {
    it("returns true (stub)", async () => {
      expect(await deleteEvent("e1")).toBe(true);
    });
  });

  describe("listEvents", () => {
    it("returns empty array (stub)", async () => {
      expect(await listEvents("cal-1")).toEqual([]);
    });
  });

  describe("getEventsForDateRange", () => {
    it("returns empty array (stub)", async () => {
      expect(await getEventsForDateRange(["c1"], new Date(), new Date())).toEqual([]);
    });
  });

  // ── Recurring Events ─────────────────────────────────────────────────────
  describe("generateRecurringInstances", () => {
    it("returns empty when event not found", async () => {
      const result = await generateRecurringInstances("no-event", new Date(), new Date());
      expect(result).toEqual([]);
    });

    it("returns empty when event has no recurrenceRule", async () => {
      // getEventById stub returns null, so no instances
      const result = await generateRecurringInstances("e1", new Date("2026-01-01"), new Date("2026-01-31"));
      expect(result).toEqual([]);
    });
  });

  describe("addRecurringException", () => {
    it("returns null when event not found", async () => {
      const result = await addRecurringException("e1", new Date());
      expect(result).toBeNull();
    });
  });

  describe("updateRecurringInstance", () => {
    it("throws when original event not found", async () => {
      await expect(
        updateRecurringInstance("e1", new Date(), { title: "Updated" })
      ).rejects.toThrow("Failed to update recurring instance");
    });
  });

  // ── Attendee management (stubs) ──────────────────────────────────────────
  describe("addAttendee", () => {
    it("returns attendee with generated ID", async () => {
      const result = await addAttendee("e1", { userId: "u1", name: "Jane", email: "j@x.com", status: "invited", isOrganizer: false });
      expect(result.id).toMatch(/^attendee-/);
      expect(result.eventId).toBe("e1");
    });
  });

  describe("updateAttendeeResponse", () => {
    it("returns null (stub)", async () => {
      expect(await updateAttendeeResponse("a1", "accepted")).toBeNull();
    });
  });

  describe("removeAttendee", () => {
    it("returns true", async () => {
      expect(await removeAttendee("a1")).toBe(true);
    });
  });

  describe("getEventAttendees", () => {
    it("returns empty array (stub)", async () => {
      expect(await getEventAttendees("e1")).toEqual([]);
    });
  });
});
