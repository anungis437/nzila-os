/**
 * Provincial Privacy Service — Unit Tests
 *
 * Covers all exported functions.
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── mocks ──────────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => {
  const mockExecute = vi.fn();
  return {
    mockDb: { execute: mockExecute },
    mockExecute,
  };
});

vi.mock("@/db", () => ({ db: mocks.mockDb }));
vi.mock("drizzle-orm", () => ({
  sql: Object.assign(vi.fn((...args: unknown[]) => args), { raw: vi.fn() }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* ── imports ────────────────────────────────────────────────────────────── */

import {
  getPrivacyRules,
  assessBreachNotification,
  generateBreachNotification,
  getDataRetentionPolicy,
  validateConsent,
  generateComplianceReport,
} from "../provincial-privacy-service";

/* ── tests ──────────────────────────────────────────────────────────────── */

describe("provincial-privacy-service", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── getPrivacyRules ─────────────────────────────────────────────────
  describe("getPrivacyRules", () => {
    it("returns QC rules with 24h breach notification", () => {
      const rules = getPrivacyRules("QC");
      expect(rules.province).toBe("QC");
      expect(rules.breachNotificationHours).toBe(24);
      expect(rules.consentRequired).toBe(true);
      expect(rules.specificRequirements).toContain("Breach notification within 24 hours");
    });

    it("returns ON rules", () => {
      const rules = getPrivacyRules("ON");
      expect(rules.province).toBe("ON");
      expect(rules.breachNotificationHours).toBe(72);
      expect(rules.contactAuthority).toContain("Ontario");
    });

    it("returns AB rules", () => {
      const rules = getPrivacyRules("AB");
      expect(rules.province).toBe("AB");
      expect(rules.contactAuthority).toContain("Alberta");
    });

    it("returns BC rules", () => {
      const rules = getPrivacyRules("BC");
      expect(rules.province).toBe("BC");
      expect(rules.consentRequired).toBe(true);
    });

    it("falls back to FEDERAL for unknown province", () => {
      const rules = getPrivacyRules("XX");
      expect(rules.province).toBe("FEDERAL");
      expect(rules.contactAuthority).toContain("Privacy Commissioner of Canada");
    });
  });

  // ── assessBreachNotification ────────────────────────────────────────
  describe("assessBreachNotification", () => {
    it("returns breach notification assessment", async () => {
      // DB is skipped in test env, falls back to FEDERAL
      const result = await assessBreachNotification("m-1", ["personal-info"], new Date());
      expect(result.memberId).toBe("m-1");
      expect(result.dataTypes).toEqual(["personal-info"]);
      expect(result.notificationDeadline).toBeInstanceOf(Date);
    });

    it("works with organizationId parameter", async () => {
      const result = await assessBreachNotification("m-1", ["email"], new Date(), "org-1");
      expect(result.memberId).toBe("m-1");
    });
  });

  // ── generateBreachNotification ──────────────────────────────────────
  describe("generateBreachNotification", () => {
    it("generates notification with deadline", async () => {
      const breach = {
        province: "QC",
        memberId: "m-1",
        breachDate: new Date(),
        dataTypes: ["email"],
        realRiskOfHarm: true,
        notificationSent: false,
        notificationDeadline: new Date(),
      };
      const result = await generateBreachNotification(breach);
      expect(result.notificationId).toBeDefined();
      expect(result.deadline).toBeInstanceOf(Date);
    });
  });

  // ── getDataRetentionPolicy ──────────────────────────────────────────
  describe("getDataRetentionPolicy", () => {
    it("returns retention policy for QC", () => {
      const policy = getDataRetentionPolicy("QC");
      expect(policy.maxRetentionDays).toBeGreaterThan(0);
      expect(policy.description).toBeDefined();
    });

    it("returns federal policy for unknown province", () => {
      const policy = getDataRetentionPolicy("ZZ");
      expect(policy.maxRetentionDays).toBeGreaterThan(0);
    });
  });

  // ── validateConsent ─────────────────────────────────────────────────
  describe("validateConsent", () => {
    it("returns true for province requiring consent", () => {
      expect(validateConsent("QC", "explicit")).toBe(true);
    });

    it("validates consent type", () => {
      const result = validateConsent("ON", "implied");
      expect(typeof result).toBe("boolean");
    });
  });

  // ── generateComplianceReport ────────────────────────────────────────
  describe("generateComplianceReport", () => {
    it("returns compliance report for QC", async () => {
      const report = await generateComplianceReport("QC");
      expect(typeof report.compliant).toBe("boolean");
      expect(Array.isArray(report.issues)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it("returns report for unknown province (FEDERAL)", async () => {
      const report = await generateComplianceReport("ZZ");
      expect(typeof report.compliant).toBe("boolean");
    });
  });
});
