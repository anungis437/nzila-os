/**
 * Multi-Currency Treasury Service — Unit Tests
 *
 * Covers all 11 static methods of MultiCurrencyTreasuryService:
 *   getExchangeRate, convertCurrency, fetchBOCRates, revaluateAccount,
 *   calculateFXGainLoss, createForwardContract, executeSpotTransaction,
 *   getFXExposure, scheduleRateUpdates, calculateRiskMetrics,
 *   generateRevaluationEntries
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "decimal.js";

/* ── hoisted ────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsertValues: vi.fn(),
}));

function sfwol(data: unknown[] = []) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(data),
        })),
      })),
    })),
  };
}
function sfwNoOrder(data: unknown[] = []) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(data),
    })),
  };
}

vi.mock("@/db", () => ({
  db: {
    select: mocks.mockSelect,
    insert: vi.fn(() => ({ values: mocks.mockInsertValues })),
  },
}));

vi.mock("@/db/schema/domains/finance", () => ({
  transactionCurrencyConversions: {
    id: "id",
    createdAt: "createdAt",
    originalCurrency: "originalCurrency",
    originalAmount: "originalAmount",
    cadAmount: "cadAmount",
    fxRateUsed: "fxRateUsed",
    fxRateDate: "fxRateDate",
  },
}));

vi.mock("@/db/schema/domains/infrastructure", () => ({
  currencyExchangeRates: {
    baseCurrency: "baseCurrency",
    targetCurrency: "targetCurrency",
    effectiveDate: "effectiveDate",
    rate: "rate",
    source: "source",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((c: unknown) => c),
  lte: vi.fn((...a: unknown[]) => a),
  gte: vi.fn((...a: unknown[]) => a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* ── imports ────────────────────────────────────────────────────────── */

import { MultiCurrencyTreasuryService } from "../multi-currency-treasury-service";

/* ── tests ──────────────────────────────────────────────────────────── */

const mockRate = {
  baseCurrency: "USD",
  targetCurrency: "CAD",
  rate: "1.35",
  effectiveDate: new Date("2026-03-01"),
  source: "BOC",
};

describe("MultiCurrencyTreasuryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSelect.mockReturnValue(sfwol());
  });

  // ── getExchangeRate ────────────────────────────────────────────────
  describe("getExchangeRate", () => {
    it("returns rate from DB", async () => {
      mocks.mockSelect.mockReturnValueOnce(sfwol([mockRate]));
      const r = await MultiCurrencyTreasuryService.getExchangeRate("USD", "CAD");
      expect(r).not.toBeNull();
      expect(r!.rate).toEqual(new Decimal("1.35"));
      expect(r!.source).toBe("BOC");
    });

    it("returns null when no rate found", async () => {
      mocks.mockSelect.mockReturnValueOnce(sfwol([]));
      const r = await MultiCurrencyTreasuryService.getExchangeRate("USD", "JPY");
      expect(r).toBeNull();
    });
  });

  // ── convertCurrency ────────────────────────────────────────────────
  describe("convertCurrency", () => {
    it("returns same amount for same currency", async () => {
      const r = await MultiCurrencyTreasuryService.convertCurrency(
        new Decimal(100),
        "CAD",
        "CAD"
      );
      expect(r.convertedAmount.toNumber()).toBe(100);
      expect(r.exchangeRate.toNumber()).toBe(1);
    });

    it("converts using exchange rate", async () => {
      mocks.mockSelect.mockReturnValueOnce(sfwol([mockRate]));
      const r = await MultiCurrencyTreasuryService.convertCurrency(
        new Decimal(100),
        "USD",
        "CAD"
      );
      expect(r.convertedAmount.toNumber()).toBe(135);
    });

    it("throws when rate not found", async () => {
      mocks.mockSelect.mockReturnValueOnce(sfwol([]));
      await expect(
        MultiCurrencyTreasuryService.convertCurrency(new Decimal(100), "USD", "JPY")
      ).rejects.toThrow("Exchange rate not found");
    });
  });

  // ── fetchBOCRates ──────────────────────────────────────────────────
  describe("fetchBOCRates", () => {
    it("fetches and stores rates", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          observations: [{ d: "2026-03-01", FXUSDCAD: { v: "1.35" } }],
        }),
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
      mocks.mockInsertValues.mockResolvedValue(undefined);

      await MultiCurrencyTreasuryService.fetchBOCRates("org-1");
      expect(mocks.mockInsertValues).toHaveBeenCalledTimes(2); // USD/CAD + CAD/USD
      vi.unstubAllGlobals();
    });

    it("throws on fetch failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
      await expect(MultiCurrencyTreasuryService.fetchBOCRates("org-1")).rejects.toThrow(
        "Failed to fetch BOC rates"
      );
      vi.unstubAllGlobals();
    });

    it("handles missing observation data gracefully", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ observations: [{}] }),
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
      await MultiCurrencyTreasuryService.fetchBOCRates("org-1");
      // No FXUSDCAD → insert not called
      expect(mocks.mockInsertValues).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  // ── revaluateAccount ───────────────────────────────────────────────
  describe("revaluateAccount", () => {
    it("calculates revaluation with gain/loss", async () => {
      mocks.mockSelect.mockReturnValueOnce(sfwol([mockRate]));
      const r = await MultiCurrencyTreasuryService.revaluateAccount({
        accountId: "acc-1",
        accountNumber: "1234",
        baseCurrency: "CAD",
        foreignCurrency: "USD",
        originalAmount: new Decimal(1000),
        revaluationDate: new Date(),
      });
      expect(r.revaluedAmount.toNumber()).toBe(1350);
      expect(r.accountId).toBe("acc-1");
    });

    it("throws when rate not available", async () => {
      mocks.mockSelect.mockReturnValueOnce(sfwol([]));
      await expect(
        MultiCurrencyTreasuryService.revaluateAccount({
          accountId: "acc-1",
          accountNumber: "1234",
          baseCurrency: "CAD",
          foreignCurrency: "XYZ",
          originalAmount: new Decimal(100),
          revaluationDate: new Date(),
        })
      ).rejects.toThrow("Exchange rate not found");
    });
  });

  // ── calculateFXGainLoss ────────────────────────────────────────────
  describe("calculateFXGainLoss", () => {
    it("returns empty transactions for empty period", async () => {
      mocks.mockSelect.mockReturnValueOnce(sfwNoOrder([]));
      const r = await MultiCurrencyTreasuryService.calculateFXGainLoss({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        baseCurrency: "CAD",
      });
      expect(r.totalGain.toNumber()).toBe(0);
      expect(r.totalLoss.toNumber()).toBe(0);
      expect(r.transactions).toHaveLength(0);
    });

    it("calculates gain and loss from FX transactions", async () => {
      mocks.mockSelect.mockReturnValueOnce(
        sfwNoOrder([
          {
            id: "t-1",
            transactionDate: new Date("2026-03-01"),
            originalCurrency: "USD",
            originalAmount: "1000",
            cadAmount: "1300",
            fxRateUsed: "1.30",
            fxRateDate: new Date(),
          },
        ])
      );
      // getExchangeRate for the current rate lookup
      mocks.mockSelect.mockReturnValueOnce(sfwol([mockRate]));
      const r = await MultiCurrencyTreasuryService.calculateFXGainLoss({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        baseCurrency: "CAD",
      });
      expect(r.transactions).toHaveLength(1);
    });
  });

  // ── createForwardContract ──────────────────────────────────────────
  describe("createForwardContract", () => {
    it("creates forward contract", async () => {
      const r = await MultiCurrencyTreasuryService.createForwardContract({
        fromCurrency: "USD",
        toCurrency: "CAD",
        amount: new Decimal(10000),
        forwardRate: new Decimal(1.38),
        settlementDate: new Date("2026-06-01"),
        counterparty: "Bank A",
      });
      expect(r.id).toMatch(/^FWD-/);
      expect(r.transactionType).toBe("forward");
      expect(r.toAmount.toNumber()).toBe(13800);
      expect(r.settlementDate).toEqual(new Date("2026-06-01"));
    });
  });

  // ── executeSpotTransaction ─────────────────────────────────────────
  describe("executeSpotTransaction", () => {
    it("executes spot transaction with current rate", async () => {
      mocks.mockSelect.mockReturnValueOnce(sfwol([mockRate]));
      const r = await MultiCurrencyTreasuryService.executeSpotTransaction({
        fromCurrency: "USD",
        toCurrency: "CAD",
        amount: new Decimal(500),
      });
      expect(r.id).toMatch(/^SPOT-/);
      expect(r.transactionType).toBe("spot");
      expect(r.toAmount.toNumber()).toBe(675);
    });

    it("throws when rate not available", async () => {
      mocks.mockSelect.mockReturnValueOnce(sfwol([]));
      await expect(
        MultiCurrencyTreasuryService.executeSpotTransaction({
          fromCurrency: "USD",
          toCurrency: "JPY",
          amount: new Decimal(100),
        })
      ).rejects.toThrow("Exchange rate not available");
    });
  });

  // ── getFXExposure ──────────────────────────────────────────────────
  describe("getFXExposure", () => {
    it("returns zeroed exposure (stub)", async () => {
      const r = await MultiCurrencyTreasuryService.getFXExposure({
        organizationId: "org-1",
        baseCurrency: "CAD",
      });
      expect(r.totalExposure.toNumber()).toBe(0);
      expect(r.byCurrency).toBeInstanceOf(Map);
    });
  });

  // ── scheduleRateUpdates ────────────────────────────────────────────
  describe("scheduleRateUpdates", () => {
    it("delegates to fetchBOCRates", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          observations: [{ d: "2026-03-01", FXUSDCAD: { v: "1.35" } }],
        }),
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
      mocks.mockInsertValues.mockResolvedValue(undefined);
      await MultiCurrencyTreasuryService.scheduleRateUpdates("org-1", 12);
      vi.unstubAllGlobals();
    });
  });

  // ── calculateRiskMetrics ───────────────────────────────────────────
  describe("calculateRiskMetrics", () => {
    it("calculates VaR for positions", () => {
      const vol = new Map([["USDCAD", 0.08]]);
      const r = MultiCurrencyTreasuryService.calculateRiskMetrics({
        positions: [
          { currency: "USD", amount: new Decimal(10000) },
          { currency: "CAD", amount: new Decimal(5000) },
        ],
        baseCurrency: "CAD",
        volatility: vol,
      });
      // USD: 10000 * 0.08 * 1.96 = 1568
      expect(r.valueAtRisk.toNumber()).toBe(1568);
      expect(r.confidenceLevel).toBe(0.95);
    });

    it("uses default 10% vol when pair not in map", () => {
      const r = MultiCurrencyTreasuryService.calculateRiskMetrics({
        positions: [{ currency: "EUR", amount: new Decimal(1000) }],
        baseCurrency: "CAD",
        volatility: new Map(),
      });
      // 1000 * 0.10 * 1.96 = 196
      expect(r.valueAtRisk.toNumber()).toBe(196);
    });

    it("skips base currency positions", () => {
      const r = MultiCurrencyTreasuryService.calculateRiskMetrics({
        positions: [{ currency: "CAD", amount: new Decimal(50000) }],
        baseCurrency: "CAD",
        volatility: new Map(),
      });
      expect(r.valueAtRisk.toNumber()).toBe(0);
    });
  });

  // ── generateRevaluationEntries ─────────────────────────────────────
  describe("generateRevaluationEntries", () => {
    it("generates debit/credit entries for gain", async () => {
      const entries = await MultiCurrencyTreasuryService.generateRevaluationEntries([
        {
          accountId: "acc-1",
          accountNumber: "1234",
          baseCurrency: "CAD",
          foreignCurrency: "USD",
          originalAmount: new Decimal(1000),
          exchangeRate: new Decimal(1.35),
          revaluedAmount: new Decimal(1350),
          gainLoss: new Decimal(350),
          revaluationDate: new Date(),
        },
      ]);
      expect(entries).toHaveLength(2);
      expect(entries[0].debitAmount.toNumber()).toBe(350);
      expect(entries[1].accountId).toBe("fx_gain_account");
    });

    it("generates debit/credit entries for loss", async () => {
      const entries = await MultiCurrencyTreasuryService.generateRevaluationEntries([
        {
          accountId: "acc-1",
          accountNumber: "1234",
          baseCurrency: "CAD",
          foreignCurrency: "USD",
          originalAmount: new Decimal(1000),
          exchangeRate: new Decimal(1.20),
          revaluedAmount: new Decimal(1200),
          gainLoss: new Decimal(-200),
          revaluationDate: new Date(),
        },
      ]);
      expect(entries).toHaveLength(2);
      expect(entries[0].accountId).toBe("fx_loss_account");
      expect(entries[0].debitAmount.toNumber()).toBe(200);
    });

    it("returns empty for no revaluations", async () => {
      const entries = await MultiCurrencyTreasuryService.generateRevaluationEntries([]);
      expect(entries).toHaveLength(0);
    });
  });

  // ── Batch 37: calculateFXGainLoss branch coverage ─────────────────────
  describe("calculateFXGainLoss — additional branches", () => {
    it("aggregates loss when gainLoss < 0", async () => {
      mocks.mockSelect.mockReturnValueOnce(
        sfwNoOrder([
          {
            id: "t-loss",
            transactionDate: new Date("2026-03-01"),
            originalCurrency: "USD",
            originalAmount: "1000",
            cadAmount: "1400",
            fxRateUsed: "1.40",
            fxRateDate: new Date(),
          },
        ])
      );
      // getExchangeRate returns a lower current rate → loss
      mocks.mockSelect.mockReturnValueOnce(
        sfwol([{ ...mockRate, rate: "1.25" }])
      );
      const r = await MultiCurrencyTreasuryService.calculateFXGainLoss({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        baseCurrency: "CAD",
      });
      expect(r.transactions).toHaveLength(1);
      // currentValue=1000*1.25=1250, historical=1400, gain=1250-1400=-150
      expect(r.totalLoss.toNumber()).toBe(150);
      expect(r.totalGain.toNumber()).toBe(0);
    });

    it("uses fallback rate 1 when getExchangeRate returns null", async () => {
      mocks.mockSelect.mockReturnValueOnce(
        sfwNoOrder([
          {
            id: "t-null",
            transactionDate: new Date("2026-06-01"),
            originalCurrency: "GBP",
            originalAmount: "500",
            cadAmount: "800",
            fxRateUsed: "1.60",
            fxRateDate: new Date(),
          },
        ])
      );
      // getExchangeRate returns no rate → null ?.rate → undefined → fallback 1
      mocks.mockSelect.mockReturnValueOnce(sfwol([]));
      const r = await MultiCurrencyTreasuryService.calculateFXGainLoss({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        baseCurrency: "CAD",
      });
      expect(r.transactions).toHaveLength(1);
      // currentValue=500*1=500, historical=800, gain=500-800=-300 (loss)
      expect(r.totalLoss.toNumber()).toBe(300);
    });

    it("returns zeros on DB error", async () => {
      mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => { throw new Error("db-fail"); }),
        })),
      });
      const r = await MultiCurrencyTreasuryService.calculateFXGainLoss({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        baseCurrency: "CAD",
      });
      expect(r.totalGain.toNumber()).toBe(0);
      expect(r.totalLoss.toNumber()).toBe(0);
      expect(r.transactions).toHaveLength(0);
    });
  });
});
