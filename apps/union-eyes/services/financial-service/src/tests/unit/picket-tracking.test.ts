import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const queue: any[] = [];
  function next() {
    const v = queue.shift();
    if (v instanceof Error) throw v;
    return v ?? [];
  }
  function makeChain(): any {
    const chain: any = {};
    for (const m of [
      "select",
      "from",
      "where",
      "limit",
      "groupBy",
      "orderBy",
      "set",
      "values",
      "returning",
    ]) {
      chain[m] = vi.fn(() => chain);
    }
    chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
      try {
        return resolve(next());
      } catch (e) {
        return reject ? reject(e) : Promise.reject(e);
      }
    };
    return chain;
  }
  const db: any = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
  };
  const tableCache: Record<string, any> = {};
  const schema: any = new Proxy(
    {},
    {
      get: (_t, table: string) => {
        if (!tableCache[table]) {
          tableCache[table] = new Proxy(
            { __name: table },
            { get: (o: any, col: string) => (col in o ? o[col] : { __col: col }) },
          );
        }
        return tableCache[table];
      },
    },
  );
  return { queue, db, schema };
});

vi.mock("../../db", () => ({ db: h.db, schema: h.schema }));

import {
  calculateDistance,
  verifyGPSLocation,
  generateQRCodeData,
  validateQRCodeData,
  checkIn,
  checkOut,
  getActiveCheckIns,
  getAttendanceHistory,
  getAttendanceSummary,
  coordinatorOverride,
} from "../../services/picket-tracking";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
});

describe("pure GPS/QR helpers", () => {
  it("calculateDistance returns 0 for identical points and a positive distance otherwise", () => {
    expect(calculateDistance(45, -73, 45, -73)).toBe(0);
    expect(calculateDistance(45, -73, 45.1, -73)).toBeGreaterThan(0);
  });

  it("verifyGPSLocation verifies within threshold and rejects beyond it", () => {
    const near = verifyGPSLocation(45, -73, { latitude: 45, longitude: -73 });
    expect(near.verified).toBe(true);
    expect(near.distance).toBe(0);

    const far = verifyGPSLocation(45, -73, { latitude: 46, longitude: -73, radius: 50 });
    expect(far.verified).toBe(false);
    expect(far.distance).toBeGreaterThan(50);
  });

  it("generateQRCodeData round-trips through validateQRCodeData", () => {
    const qr = generateQRCodeData("fund-1", "member-1");
    const result = validateQRCodeData(qr);
    expect(result.valid).toBe(true);
    expect(result.fundId).toBe("fund-1");
    expect(result.memberId).toBe("member-1");
  });

  it("validateQRCodeData rejects expired codes", () => {
    const expired = generateQRCodeData(
      "fund-1",
      "member-1",
      new Date(Date.now() - 10 * 60 * 1000),
    );
    expect(validateQRCodeData(expired)).toEqual({ valid: false, error: "QR code expired" });
  });

  it("validateQRCodeData rejects malformed input", () => {
    expect(validateQRCodeData("!!!not-base64-json")).toEqual({
      valid: false,
      error: "Invalid QR code format",
    });
  });
});

describe("checkIn", () => {
  const base = {
    organizationId: "org-1",
    strikeFundId: "fund-1",
    memberId: "m1",
    method: "gps" as const,
  };

  it("rejects when location is too far and no override", async () => {
    const result = await checkIn(
      { ...base, latitude: 46, longitude: -73 },
      { latitude: 45, longitude: -73, radius: 50 },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("too far");
  });

  it("rejects an invalid QR code", async () => {
    const result = await checkIn({ ...base, method: "qr_code", qrCodeData: "bad" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid QR code format");
  });

  it("rejects a QR code that does not match the member", async () => {
    const qr = generateQRCodeData("fund-1", "other-member");
    const result = await checkIn({ ...base, method: "qr_code", qrCodeData: qr });
    expect(result.success).toBe(false);
    expect(result.error).toBe("QR code does not match member");
  });

  it("blocks a duplicate active check-in", async () => {
    enqueue([{ id: "existing-1" }]); // existing active check-in
    const result = await checkIn({ ...base, coordinatorOverride: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain("already checked in");
    expect(result.attendanceId).toBe("existing-1");
  });

  it("creates an attendance record on a verified check-in", async () => {
    enqueue([], [{ id: "att-1" }]); // no existing, insert returns new
    const result = await checkIn(
      { ...base, latitude: 45, longitude: -73 },
      { latitude: 45, longitude: -73 },
    );
    expect(result.success).toBe(true);
    expect(result.attendanceId).toBe("att-1");
    expect(result.distance).toBe(0);
  });

  it("returns a failure object when the insert throws", async () => {
    enqueue([], new Error("db down"));
    const result = await checkIn({ ...base, coordinatorOverride: true });
    expect(result).toEqual({ success: false, error: "Failed to check in" });
  });
});

describe("checkOut", () => {
  it("returns not found when the record is missing", async () => {
    enqueue([]);
    const result = await checkOut({ organizationId: "org-1", attendanceId: "x" });
    expect(result).toEqual({ success: false, error: "Attendance record not found" });
  });

  it("reports already checked out", async () => {
    enqueue([{ id: "a1", checkOutTime: new Date().toISOString(), hoursWorked: "5" }]);
    const result = await checkOut({ organizationId: "org-1", attendanceId: "a1" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Member already checked out");
    expect(result.hoursWorked).toBe(5);
  });

  it("computes hours worked on a successful checkout", async () => {
    const checkInTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    enqueue([{ id: "a1", checkInTime, checkOutTime: null }], []);
    const result = await checkOut({
      organizationId: "org-1",
      attendanceId: "a1",
      latitude: 45,
      longitude: -73,
    });
    expect(result.success).toBe(true);
    expect(result.hoursWorked).toBeCloseTo(2, 1);
  });

  it("returns a failure object when the query throws", async () => {
    enqueue(new Error("db down"));
    const result = await checkOut({ organizationId: "org-1", attendanceId: "a1" });
    expect(result).toEqual({ success: false, error: "Failed to check out" });
  });
});

describe("query helpers", () => {
  const rows = [
    {
      id: "a1",
      memberId: "m1",
      checkInTime: new Date().toISOString(),
      checkOutTime: null,
      hoursWorked: null,
      checkInMethod: "gps",
      locationVerified: true,
    },
    {
      id: "a2",
      memberId: "m2",
      checkInTime: new Date().toISOString(),
      checkOutTime: new Date().toISOString(),
      hoursWorked: "4.5",
      checkInMethod: null,
      locationVerified: null,
    },
  ];

  it("getActiveCheckIns maps records", async () => {
    enqueue(rows);
    const result = await getActiveCheckIns("org-1", "fund-1");
    expect(result).toHaveLength(2);
    expect(result[0].method).toBe("gps");
    expect(result[1].method).toBe("unknown");
    expect(result[1].hoursWorked).toBe(4.5);
    expect(result[1].locationVerified).toBe(false);
  });

  it("getAttendanceHistory maps records (with member filter)", async () => {
    enqueue(rows);
    const result = await getAttendanceHistory(
      "org-1",
      "fund-1",
      new Date("2025-01-01"),
      new Date("2025-02-01"),
      "m1",
    );
    expect(result).toHaveLength(2);
  });

  it("getAttendanceSummary computes averages and handles zero shifts", async () => {
    enqueue([
      { memberId: "m1", totalHours: 10, totalShifts: 4, lastCheckIn: new Date().toISOString() },
      { memberId: "m2", totalHours: 0, totalShifts: 0, lastCheckIn: null },
    ]);
    const result = await getAttendanceSummary(
      "org-1",
      "fund-1",
      new Date("2025-01-01"),
      new Date("2025-02-01"),
      "m1",
    );
    expect(result[0].averageHoursPerShift).toBe(2.5);
    expect(result[1].averageHoursPerShift).toBe(0);
    expect(result[1].lastCheckIn).toBeUndefined();
  });
});

describe("coordinatorOverride", () => {
  it("creates a manual attendance record", async () => {
    enqueue([{ id: "ovr-1" }]);
    const result = await coordinatorOverride("org-1", "fund-1", "m1", "coord-1", "sick cover", 6);
    expect(result.success).toBe(true);
    expect(result.attendanceId).toBe("ovr-1");
  });

  it("returns a failure object when the insert throws", async () => {
    enqueue(new Error("db down"));
    const result = await coordinatorOverride("org-1", "fund-1", "m1", "coord-1", "x", 6);
    expect(result).toEqual({
      success: false,
      error: "Failed to create manual attendance record",
    });
  });
});
