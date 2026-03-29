/**
 * Geofence Privacy Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

  return {
    mockDb: {
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      query: {
        memberLocationConsent: { findFirst: vi.fn() },
        locationTracking: { findMany: vi.fn().mockResolvedValue([]) },
      },
    },
    mockInsert, mockInsertValues,
    mockUpdate, mockUpdateSet,
    mockDelete, mockDeleteWhere,
  };
});

vi.mock("@/db", () => ({ db: mocks.mockDb }));
vi.mock("@/db/schema/geofence-privacy-schema", () => ({
  memberLocationConsent: { userId: "userId", consentStatus: "consentStatus", id: "id", expiresAt: "expiresAt", consentPurpose: "consentPurpose", optedInAt: "optedInAt" },
  locationTracking: { userId: "userId", expiresAt: "expiresAt", trackingType: "trackingType" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c, v) => ({ _type: "eq", v })),
  lte: vi.fn((_c, v) => ({ _type: "lte", v })),
}));

import {
  requestLocationPermission,
  trackLocation,
  purgeExpiredLocations,
  revokeLocationConsent,
  getLocationConsentStatus,
  verifyNoBackgroundTracking,
  generateGeofencePrivacyReport,
} from "../geofence-privacy-service";

describe("geofence-privacy-service", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── requestLocationPermission ────────────────────────────────────────────
  describe("requestLocationPermission", () => {
    it("returns existing consent when already opted in", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce({
        id: "consent-1", consentStatus: "opted_in",
      });
      const result = await requestLocationPermission("u1", "safety-check-ins");
      expect(result.requiresUserAction).toBe(false);
      expect(result.consentId).toBe("consent-1");
    });

    it("requires user action when no consent exists", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce(null);
      const result = await requestLocationPermission("u1", "strike-line-tracking");
      expect(result.requiresUserAction).toBe(true);
      expect(result.consentId).toMatch(/^pending-/);
    });

    it("requires user action when consent is opted_out", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce({
        id: "consent-1", consentStatus: "opted_out",
      });
      const result = await requestLocationPermission("u1", "event-coordination");
      expect(result.requiresUserAction).toBe(true);
    });

    it("handles db error gracefully", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockRejectedValueOnce(new Error("fail"));
      // The .catch(() => null) in source means this returns pending
      const result = await requestLocationPermission("u1", "safety");
      expect(result.requiresUserAction).toBe(true);
    });
  });

  // ── trackLocation ───────────────────────────────────────────────────────
  describe("trackLocation", () => {
    it("returns error when no consent", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce(null);
      const result = await trackLocation("u1", { latitude: 45.5, longitude: -73.5 }, "safety");
      expect(result.success).toBe(false);
      expect(result.error).toContain("explicit opt-in consent");
    });

    it("returns error when consent is opted_out", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce({
        consentStatus: "opted_out",
      });
      const result = await trackLocation("u1", { latitude: 45.5, longitude: -73.5 }, "safety");
      expect(result.success).toBe(false);
    });

    it("returns error when consent expired", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce({
        consentStatus: "opted_in",
        expiresAt: new Date("2020-01-01"), // expired
      });
      const result = await trackLocation("u1", { latitude: 45.5, longitude: -73.5 }, "safety");
      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("stores location when consent is valid", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce({
        consentStatus: "opted_in",
        expiresAt: new Date("2099-01-01"),
      });
      const result = await trackLocation("u1", { latitude: 45.5, longitude: -73.5 }, "safety");
      expect(result.success).toBe(true);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it("stores location when consent has no expiry", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce({
        consentStatus: "opted_in",
        expiresAt: null,
      });
      const result = await trackLocation("u1", { latitude: 45.5, longitude: -73.5 }, "safety");
      expect(result.success).toBe(true);
    });

    it("returns error on insert failure", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce({
        consentStatus: "opted_in", expiresAt: null,
      });
      mocks.mockInsertValues.mockRejectedValueOnce(new Error("insert fail"));
      const result = await trackLocation("u1", { latitude: 45.5, longitude: -73.5 }, "safety");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to track location");
    });

    it("handles findFirst DB error via .catch fallback", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockRejectedValueOnce(new Error("db down"));
      const result = await trackLocation("u1", { latitude: 45.5, longitude: -73.5 }, "safety");
      // .catch(() => null) ⇒ consent is null ⇒ returns consent error
      expect(result.success).toBe(false);
      expect(result.error).toContain("explicit opt-in consent");
    });
  });

  // ── purgeExpiredLocations ────────────────────────────────────────────────
  describe("purgeExpiredLocations", () => {
    it("returns purge result", async () => {
      const result = await purgeExpiredLocations();
      expect(result.message).toContain("purged");
      expect(mocks.mockDelete).toHaveBeenCalled();
    });

    it("handles error gracefully", async () => {
      mocks.mockDeleteWhere.mockRejectedValueOnce(new Error("fail"));
      const result = await purgeExpiredLocations();
      expect(result.message).toContain("Error");
    });
  });

  // ── revokeLocationConsent ────────────────────────────────────────────────
  describe("revokeLocationConsent", () => {
    it("revokes consent successfully", async () => {
      const result = await revokeLocationConsent("u1");
      expect(result.success).toBe(true);
      expect(result.message).toContain("disabled");
    });

    it("handles error", async () => {
      mocks.mockUpdateSet.mockReturnValueOnce({ where: vi.fn().mockRejectedValue(new Error("fail")) });
      const result = await revokeLocationConsent("u1");
      expect(result.success).toBe(false);
    });
  });

  // ── getLocationConsentStatus ─────────────────────────────────────────────
  describe("getLocationConsentStatus", () => {
    it("returns opted_in status with details", async () => {
      const optedInAt = new Date("2026-01-01");
      const expiresAt = new Date("2027-01-01");
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce({
        consentStatus: "opted_in", consentPurpose: "safety", optedInAt, expiresAt,
      });
      const result = await getLocationConsentStatus("u1");
      expect(result.status).toBe("opted_in");
      expect(result.canRevokeAnytime).toBe(true);
      expect(result.purpose).toBe("safety");
      expect(result.optedInAt).toEqual(optedInAt);
    });

    it("returns never_asked when no consent record", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockResolvedValueOnce(null);
      const result = await getLocationConsentStatus("u1");
      expect(result.status).toBe("never_asked");
      expect(result.canRevokeAnytime).toBe(true);
    });

    it("handles db error", async () => {
      mocks.mockDb.query.memberLocationConsent.findFirst.mockRejectedValueOnce(new Error("fail"));
      // .catch(() => null) means null consent
      const result = await getLocationConsentStatus("u1");
      expect(result.status).toBe("never_asked");
    });
  });

  // ── verifyNoBackgroundTracking ───────────────────────────────────────────
  describe("verifyNoBackgroundTracking", () => {
    it("returns compliant when all records are foreground_only", async () => {
      mocks.mockDb.query.locationTracking.findMany.mockResolvedValueOnce([
        { trackingType: "foreground_only" },
        { trackingType: "foreground_only" },
      ]);
      const result = await verifyNoBackgroundTracking();
      expect(result.compliant).toBe(true);
      expect(result.backgroundTrackingDetected).toBe(false);
    });

    it("detects policy violation with background tracking", async () => {
      mocks.mockDb.query.locationTracking.findMany.mockResolvedValueOnce([
        { trackingType: "foreground_only" },
        { trackingType: "background" },
      ]);
      const result = await verifyNoBackgroundTracking();
      expect(result.compliant).toBe(false);
      expect(result.backgroundTrackingDetected).toBe(true);
      expect(result.message).toContain("POLICY VIOLATION");
    });

    it("returns compliant when no records", async () => {
      mocks.mockDb.query.locationTracking.findMany.mockResolvedValueOnce([]);
      const result = await verifyNoBackgroundTracking();
      expect(result.compliant).toBe(true);
    });

    it("returns compliant when findMany rejects (DB error)", async () => {
      mocks.mockDb.query.locationTracking.findMany.mockRejectedValueOnce(new Error("db fail"));
      // .catch(() => []) ⇒ empty array ⇒ compliant
      const result = await verifyNoBackgroundTracking();
      expect(result.compliant).toBe(true);
      expect(result.backgroundTrackingDetected).toBe(false);
    });
  });

  // ── generateGeofencePrivacyReport ────────────────────────────────────────
  describe("generateGeofencePrivacyReport", () => {
    it("returns compliant report when no issues", async () => {
      mocks.mockDb.query.locationTracking.findMany.mockResolvedValueOnce([]);
      const result = await generateGeofencePrivacyReport();
      expect(result.compliant).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("returns non-compliant report with issues", async () => {
      mocks.mockDb.query.locationTracking.findMany.mockResolvedValueOnce([
        { trackingType: "background" },
      ]);
      const result = await generateGeofencePrivacyReport();
      expect(result.compliant).toBe(false);
      expect(result.issues).toContain("Background location tracking detected - POLICY VIOLATION");
    });
  });
});
