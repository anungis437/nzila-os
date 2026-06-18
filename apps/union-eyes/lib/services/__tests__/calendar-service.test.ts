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

import { logger } from "@/lib/logger";

import {
  getCalendarById, listCalendars, createCalendar, updateCalendar, deleteCalendar,
  createEvent, getEventById, updateEvent, deleteEvent, listEvents,
  getEventsForDateRange, generateRecurringInstances,
  buildRecurringInstances,
  addRecurringException, updateRecurringInstance,
  addAttendee, updateAttendeeResponse, removeAttendee, getEventAttendees,
  listMeetingRooms, checkRoomAvailability, bookMeetingRoom, cancelRoomBooking,
  getUserAvailability, findCommonAvailability, syncExternalCalendar,
  enableCalendarSync, disableCalendarSync, addEventReminder, getPendingReminders,
  getCalendarStatistics,
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

    it("throws on update error", async () => {
      mocks.mockSetWhere.mockRejectedValueOnce(new Error("fail"));
      await expect(updateCalendar("cal-1", { name: "Broken" } as never)).rejects.toThrow("Failed to update calendar");
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

  describe("buildRecurringInstances", () => {
    const baseEvent = {
      id: "event-1",
      calendarId: "cal-1",
      title: "Recurring meeting",
      eventType: "meeting",
      startTime: new Date("2026-01-01T09:00:00.000Z"),
      endTime: new Date("2026-01-01T10:00:00.000Z"),
      allDay: false,
      status: "confirmed",
      createdBy: "u1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      recurrenceRule: "RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3",
    } as const;

    it("builds recurring instances and skips exception dates", () => {
      const instances = buildRecurringInstances(
        {
          ...baseEvent,
          exceptionDates: [new Date("2026-01-03T09:00:00.000Z")],
        },
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-01-10T00:00:00.000Z")
      );

      expect(instances).toHaveLength(2);
      expect(instances[0].event.id).toBe("event-1_2026-01-01");
      expect(instances[1].event.id).toBe("event-1_2026-01-05");
      expect(instances[0].event.startTime).toEqual(new Date("2026-01-01T09:00:00.000Z"));
      expect(instances[0].event.endTime).toEqual(new Date("2026-01-01T10:00:00.000Z"));
    });

    it("stops at UNTIL and supports weekly recurrence", () => {
      const instances = buildRecurringInstances(
        {
          ...baseEvent,
          recurrenceRule: "RRULE:FREQ=WEEKLY;INTERVAL=1;UNTIL=20260116T000000Z",
        },
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-01-31T00:00:00.000Z")
      );

      expect(instances.map(instance => instance.event.id)).toEqual([
        "event-1_2026-01-01",
        "event-1_2026-01-08",
        "event-1_2026-01-15",
      ]);
    });

    it("returns existing instances when frequency is unsupported", () => {
      const instances = buildRecurringInstances(
        {
          ...baseEvent,
          recurrenceRule: "RRULE:FREQ=HOURLY;COUNT=2",
        },
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-01-02T00:00:00.000Z")
      );

      expect(instances).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledWith("Unsupported frequency", { frequency: "HOURLY" });
    });

    it("returns empty for invalid rules", () => {
      const instances = buildRecurringInstances(
        {
          ...baseEvent,
          recurrenceRule: "RRULE:COUNT=2",
        },
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-01-02T00:00:00.000Z")
      );

      expect(instances).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith("Invalid RRULE", { rruleString: "RRULE:COUNT=2" });
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

  // ── Meeting rooms ────────────────────────────────────────────────────────
  describe("listMeetingRooms", () => {
    it("returns empty array (stub)", async () => {
      expect(await listMeetingRooms()).toEqual([]);
      expect(await listMeetingRooms({ location: 'HQ', minCapacity: 10, amenities: ['video'] })).toEqual([]);
    });
  });

  describe("checkRoomAvailability", () => {
    it("returns true (stub)", async () => {
      expect(await checkRoomAvailability("room-1", new Date(), new Date())).toBe(true);
    });
  });

  describe("bookMeetingRoom", () => {
    it("returns booking with generated ID", async () => {
      const booking = await bookMeetingRoom("room-1", "event-1", new Date(), new Date(), "u1");
      expect(booking.id).toMatch(/^booking-/);
      expect(booking.roomId).toBe("room-1");
    });
  });

  describe("cancelRoomBooking", () => {
    it("returns true (stub)", async () => {
      expect(await cancelRoomBooking("booking-1")).toBe(true);
    });
  });

  // ── Availability ─────────────────────────────────────────────────────────
  describe("getUserAvailability", () => {
    it("returns empty array (stub)", async () => {
      expect(await getUserAvailability("u1", new Date(), new Date())).toEqual([]);
    });
  });

  describe("findCommonAvailability", () => {
    it("returns empty array (stub)", async () => {
      expect(await findCommonAvailability(["u1", "u2"], new Date(), new Date(), 30)).toEqual([]);
    });
  });

  // ── External sync ────────────────────────────────────────────────────────
  describe("syncExternalCalendar", () => {
    it("returns success when calendar found", async () => {
      mocks.mockDb.query.calendars.findFirst.mockResolvedValueOnce({ id: "cal-1", name: "My Cal" });
      mocks.mockReturning.mockResolvedValueOnce([{ id: "cal-1", name: "My Cal" }]);
      const result = await syncExternalCalendar("cal-1", "google");
      expect(result.success).toBe(true);
      expect(result.syncedEvents).toBe(0);
    });

    it("throws when calendar not found", async () => {
      mocks.mockDb.query.calendars.findFirst.mockResolvedValueOnce(undefined);
      // updateCalendar will be called on error path
      mocks.mockReturning.mockResolvedValueOnce([]);
      await expect(syncExternalCalendar("nope", "outlook")).rejects.toThrow("Failed to sync external calendar");
    });
  });

  describe("enableCalendarSync", () => {
    it("returns updated calendar after syncing", async () => {
      // updateCalendar for enable
      mocks.mockReturning.mockResolvedValueOnce([{ id: "cal-1", syncEnabled: true }]);
      // getCalendarById inside syncExternalCalendar
      mocks.mockDb.query.calendars.findFirst.mockResolvedValueOnce({ id: "cal-1" });
      // updateCalendar inside syncExternalCalendar (lastSyncAt)
      mocks.mockReturning.mockResolvedValueOnce([{ id: "cal-1", syncStatus: "synced" }]);
      const result = await enableCalendarSync("cal-1", "google", "ext-123");
      expect(result).toEqual({ id: "cal-1", syncEnabled: true });
    });

    it("returns null when update returns null", async () => {
      mocks.mockReturning.mockResolvedValueOnce([]);
      expect(await enableCalendarSync("cal-1", "google", "ext-1")).toBeNull();
    });
  });

  describe("disableCalendarSync", () => {
    it("returns updated calendar", async () => {
      mocks.mockReturning.mockResolvedValueOnce([{ id: "cal-1", syncEnabled: false }]);
      const result = await disableCalendarSync("cal-1");
      expect(result).toEqual({ id: "cal-1", syncEnabled: false });
    });
  });

  // ── Reminders ────────────────────────────────────────────────────────────
  describe("addEventReminder", () => {
    it("returns reminder with generated ID", async () => {
      const r = await addEventReminder("e1", "email", 15);
      expect(r.id).toMatch(/^reminder-/);
      expect(r.eventId).toBe("e1");
      expect(r.minutesBefore).toBe(15);
    });
  });

  describe("getPendingReminders", () => {
    it("returns empty array (stub)", async () => {
      expect(await getPendingReminders()).toEqual([]);
      expect(await getPendingReminders(30)).toEqual([]);
    });
  });

  // ── Statistics ───────────────────────────────────────────────────────────
  describe("getCalendarStatistics", () => {
    it("returns zero stats (stub)", async () => {
      const stats = await getCalendarStatistics("cal-1", new Date(), new Date());
      expect(stats.totalEvents).toBe(0);
      expect(stats.eventsByType).toEqual({});
    });
  });
});
