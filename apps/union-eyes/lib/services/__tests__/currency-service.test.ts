/**
 * Currency Service — Unit Tests
 *
 * Covers all exported members:
 *   CurrencyService (instance): enforceCurrencyCAD, convertUSDToCAD,
 *     getBankOfCanadaNoonRate, convertCurrency, recordCrossBorderTransaction,
 *     getT106RequiredTransactions, getTotalTransactions, fileT106,
 *     validateArmLengthPricing, getComplianceSummary
 *   currencyService (singleton)
 *   annualT106Reminder (standalone function)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted ────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      exchangeRates: { findFirst: mocks.mockFindFirst },
      crossBorderTransactions: { findMany: mocks.mockFindMany },
    },
    insert: mocks.mockInsert,
    update: vi.fn(() => ({
      set: mocks.mockUpdateSet,
    })),
    $count: mocks.mockCount,
  },
}));

vi.mock("@/db/schema/domains/finance", () => ({
  crossBorderTransactions: {
    id: "id",
    transactionDate: "transactionDate",
    requiresT106: "requiresT106",
    cadEquivalentCents: "cadEquivalentCents",
    craReportingStatus: "craReportingStatus",
  },
  exchangeRates: {
    fromCurrency: "fromCurrency",
    toCurrency: "toCurrency",
    rateSource: "rateSource",
    effectiveDate: "effectiveDate",
    exchangeRate: "exchangeRate",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  gte: vi.fn((...a: unknown[]) => a),
  lte: vi.fn((...a: unknown[]) => a),
}));

vi.mock("@/lib/decimal-safe", () => ({
  moneyToNumber: vi.fn((s: string) => parseFloat(s)),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* ── imports ────────────────────────────────────────────────────────── */

import { CurrencyService, currencyService, annualT106Reminder } from "../currency-service";

/* ── tests ──────────────────────────────────────────────────────────── */

describe("CurrencyService", () => {
  let svc: CurrencyService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new CurrencyService();
    mocks.mockFindFirst.mockResolvedValue(undefined);
    mocks.mockFindMany.mockResolvedValue([]);
    mocks.mockCount.mockResolvedValue(0);
  });

  // ── enforceCurrencyCAD ─────────────────────────────────────────────
  describe("enforceCurrencyCAD", () => {
    const cadInvoice = {
      id: "inv-1",
      amount: 1000,
      currency: "CAD" as const,
      issueDate: new Date(),
      isRelatedParty: false,
      counterpartyName: "Test Corp",
      counterpartyCountry: "CA",
    };

    it("returns compliant for CAD", () => {
      expect(svc.enforceCurrencyCAD(cadInvoice).compliant).toBe(true);
    });

    it("returns non-compliant for USD", () => {
      const r = svc.enforceCurrencyCAD({ ...cadInvoice, currency: "USD" as const });
      expect(r.compliant).toBe(false);
      expect(r.message).toContain("USD");
    });

    it("returns non-compliant for EUR", () => {
      expect(svc.enforceCurrencyCAD({ ...cadInvoice, currency: "EUR" as const }).compliant).toBe(false);
    });
  });

  // ── getBankOfCanadaNoonRate ─────────────────────────────────────────
  describe("getBankOfCanadaNoonRate", () => {
    it("returns cached rate when available", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ exchangeRate: "1.34" });
      const rate = await svc.getBankOfCanadaNoonRate(new Date());
      expect(rate).toBe(1.34);
    });

    it("returns fallback 1.35 when no cached rate", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined);
      expect(await svc.getBankOfCanadaNoonRate(new Date())).toBe(1.35);
    });

    it("returns fallback 1.35 on error", async () => {
      mocks.mockFindFirst.mockRejectedValueOnce(new Error("db fail"));
      expect(await svc.getBankOfCanadaNoonRate(new Date())).toBe(1.35);
    });
  });

  // ── convertUSDToCAD ────────────────────────────────────────────────
  describe("convertUSDToCAD", () => {
    it("converts using BOC rate", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ exchangeRate: "1.40" });
      const r = await svc.convertUSDToCAD(100, new Date());
      expect(r.amountCAD).toBe(140);
      expect(r.exchangeRate).toBe(1.40);
      expect(r.source).toBe("BOC");
    });

    it("uses fallback rate if no cached rate", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined);
      const r = await svc.convertUSDToCAD(200, new Date());
      expect(r.amountCAD).toBe(270);
    });
  });

  // ── convertCurrency ────────────────────────────────────────────────
  describe("convertCurrency", () => {
    it("returns same amount for same currency", async () => {
      const r = await svc.convertCurrency(500, "CAD", "CAD", new Date());
      expect(r.amount).toBe(500);
      expect(r.rate).toBe(1);
    });

    it("converts USD to CAD", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ exchangeRate: "1.35" });
      const r = await svc.convertCurrency(100, "USD", "CAD", new Date());
      expect(r.amount).toBe(135);
    });

    it("converts CAD to USD (inverse)", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ exchangeRate: "1.35" });
      const r = await svc.convertCurrency(135, "CAD", "USD", new Date());
      expect(r.amount).toBeCloseTo(100, 1);
    });

    it("handles other currency pairs via USD pivot", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ exchangeRate: "1.35" });
      const r = await svc.convertCurrency(100, "EUR", "CAD", new Date());
      expect(r.source).toBe("BOC");
    });
  });

  // ── validateArmLengthPricing ───────────────────────────────────────
  describe("validateArmLengthPricing", () => {
    it("returns compliant for within 5%", async () => {
      const r = await svc.validateArmLengthPricing("tx-1", 100, 103);
      expect(r.compliant).toBe(true);
      expect(r.acceptableRange).toContain("5%");
    });

    it("returns non-compliant for > 5% variance", async () => {
      const r = await svc.validateArmLengthPricing("tx-2", 100, 120);
      expect(r.compliant).toBe(false);
      expect(r.message).toContain("threshold");
    });
  });

  // ── recordCrossBorderTransaction ───────────────────────────────────
  describe("recordCrossBorderTransaction", () => {
    it("records transaction and returns result", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined); // getBankOfCanadaNoonRate
      const mockReturning = vi.fn().mockResolvedValue([{ id: "tx-1" }]);
      mocks.mockInsert.mockReturnValue({
        values: vi.fn(() => ({
          returning: mockReturning,
        })),
      });

      const r = await svc.recordCrossBorderTransaction({
        transactionId: "tx-1",
        fromPartyId: "p1",
        fromPartyName: "Company A",
        fromPartyType: "organization",
        fromCountryCode: "US",
        toPartyId: "p2",
        toPartyName: "Company B",
        toPartyType: "organization",
        toCountryCode: "CA",
        originalAmount: 10000,
        originalCurrency: "USD",
        transactionCategory: "service",
        transactionDate: new Date(),
        armLengthPrice: 10000,
        transferPricingMethod: "CUP",
        relatedParty: true,
      });
      expect(r.transactionId).toBe("tx-1");
    });
  });

  // ── getT106RequiredTransactions ────────────────────────────────────
  describe("getT106RequiredTransactions", () => {
    it("returns mapped transactions", async () => {
      mocks.mockFindMany.mockResolvedValueOnce([
        {
          id: "t-1",
          counterpartyName: "Corp",
          toCountryCode: "US",
          transactionType: "service",
          cadEquivalentCents: 2_000_000_00,
        },
      ]);
      const r = await svc.getT106RequiredTransactions(2025);
      expect(r.count).toBe(1);
      expect(r.transactions[0].nonResidentName).toBe("Corp");
      expect(r.transactions[0].transactionType).toBe("Service Agreement");
    });

    it("returns empty for no qualifying transactions", async () => {
      mocks.mockFindMany.mockResolvedValueOnce([]);
      const r = await svc.getT106RequiredTransactions(2025);
      expect(r.count).toBe(0);
    });
  });

  // ── getTotalTransactions ───────────────────────────────────────────
  describe("getTotalTransactions", () => {
    it("returns count from db.$count", async () => {
      mocks.mockCount.mockResolvedValueOnce(42);
      expect(await svc.getTotalTransactions(2025)).toBe(42);
    });
  });

  // ── fileT106 ───────────────────────────────────────────────────────
  describe("fileT106", () => {
    it("rejects past deadline", async () => {
      const r = await svc.fileT106({
        taxYear: 2020,
        businessNumber: "BN-001",
        transactions: [],
        filingDeadline: new Date("2021-06-30"),
      });
      expect(r.success).toBe(false);
      expect(r.message).toContain("deadline");
    });

    it("files successfully before deadline", async () => {
      const futureDeadline = new Date();
      futureDeadline.setFullYear(futureDeadline.getFullYear() + 1);
      mocks.mockUpdateSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      const r = await svc.fileT106({
        taxYear: 2025,
        businessNumber: "BN-001",
        transactions: [
          {
            id: "tx-1",
            nonResidentName: "Corp",
            nonResidentCountry: "US",
            transactionType: "Service",
            amountCAD: 2_000_000,
            transferPricingMethod: "CUP",
          },
        ],
        filingDeadline: futureDeadline,
      });
      expect(r.success).toBe(true);
      expect(r.confirmationNumber).toContain("CRA-T106");
    });
  });

  // ── getComplianceSummary ───────────────────────────────────────────
  describe("getComplianceSummary", () => {
    it("returns compliance summary with recommendations", async () => {
      mocks.mockFindMany.mockResolvedValueOnce([]); // T106 transactions
      mocks.mockCount.mockResolvedValueOnce(10);
      const r = await svc.getComplianceSummary(2025, "BN-001");
      expect(r.taxYear).toBe(2025);
      expect(r.totalCrossBorderTransactions).toBe(10);
      expect(r.recommendations).toHaveLength(5);
    });
  });

  // ── T106 threshold ─────────────────────────────────────────────────
  it("T106_THRESHOLD is 1,000,000", () => {
    expect((svc as never)["T106_THRESHOLD"]).toBe(1_000_000);
  });
});

// ── singleton ─────────────────────────────────────────────────────────
describe("currencyService", () => {
  it("is an instance of CurrencyService", () => {
    expect(currencyService).toBeInstanceOf(CurrencyService);
  });
});

// ── annualT106Reminder ───────────────────────────────────────────────
describe("annualT106Reminder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs without error when no transactions", async () => {
    mocks.mockFindMany.mockResolvedValueOnce([]);
    await annualT106Reminder();
  });

  it("logs warning when T106 required", async () => {
    mocks.mockFindMany.mockResolvedValueOnce([
      {
        id: "t-1",
        counterpartyName: "Corp",
        toCountryCode: "US",
        transactionType: "service",
        cadEquivalentCents: 5_000_000_00,
      },
    ]);
    await annualT106Reminder();
  });
});
