/**
 * Unit Tests — Executive Insights AI Service
 *
 * Tests generateInsightReport, getInsightReports, and helper type exports.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function makeDbChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  for (const m of [
    "select", "from", "innerJoin", "leftJoin", "orderBy",
    "limit", "update", "set", "where", "returning", "insert", "values",
  ]) {
    chain[m] = vi.fn(() => makeDbChain());
  }
  chain.then = (resolve: (v: any[]) => void) => {
    resolve([]);
    return Promise.resolve([]);
  };
  return chain;
}

function makeQueryProxy(): Record<string, unknown> {
  return new Proxy({}, {
    get: () => ({
      findFirst: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn().mockResolvedValue([]),
    }),
  });
}

vi.mock("@/db/db", () => ({ db: { ...makeDbChain(), query: makeQueryProxy() } }));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  gte: vi.fn((...a: any[]) => a),
  desc: vi.fn((x: any) => x),
  count: vi.fn(() => "count"),
  sql: vi.fn(),
}));

vi.mock("@/db/schema/domains/ml/ai-insight-reports", () => ({
  aiInsightReports: { id: "id", organizationId: "organizationId", reportType: "reportType" },
}));

vi.mock("@/db/schema/domains/claims/grievances", () => ({
  grievances: { id: "id", orgId: "orgId" },
}));

vi.mock("@/db/schema/domains/compliance/employer-compliance", () => ({
  employers: { id: "id", orgId: "orgId" },
  complianceAlerts: { id: "id", orgId: "orgId" },
}));

const mockGenerate = vi.fn();
vi.mock("@/lib/ai/ai-client", () => ({
  getAiClient: () => ({ generate: mockGenerate }),
  UE_APP_KEY: "union-eyes",
  UE_PROFILES: {
    GRIEVANCE_TRIAGE: "ue-grievance-triage",
    CLAUSE_REASONING: "ue-clause-reasoning",
    EMPLOYER_RISK: "ue-employer-risk",
    STEWARD_COPILOT: "ue-steward-copilot",
    EXECUTIVE_INSIGHTS: "ue-executive-insights",
  },
  UE_SYSTEM_ORG_ID: "00000000-0000-0000-0000-000000000000",
}));

vi.mock("@/lib/ai/ai-feature-guard", () => ({
  auditAiInteraction: vi.fn().mockResolvedValue("ai-executive_insights-mock-ref"),
  buildAiEnvelope: vi.fn((data, meta) => ({
    available: true,
    data,
    confidence: meta.confidence,
    explanation: meta.explanation,
    modelVersion: meta.modelVersion,
    auditRef: meta.auditRef,
    disclaimer: "Advisory only",
  })),
}));

vi.mock("@/lib/audit-logger", () => ({
  auditLog: vi.fn(),
  auditDataMutation: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  generateInsightReport,
  generateTrendForecast,
  forecastEmployerHotspots,
  predictStewardCapacity,
  predictArbitrationEscalation,
  getInsightReports,
  type InsightReportType,
} from "@/lib/ai/executive-insights";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Executive Insights AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exports", () => {
    it("exports generateInsightReport", () => {
      expect(typeof generateInsightReport).toBe("function");
    });

    it("exports generateTrendForecast", () => {
      expect(typeof generateTrendForecast).toBe("function");
    });

    it("exports forecastEmployerHotspots", () => {
      expect(typeof forecastEmployerHotspots).toBe("function");
    });

    it("exports predictStewardCapacity", () => {
      expect(typeof predictStewardCapacity).toBe("function");
    });

    it("exports predictArbitrationEscalation", () => {
      expect(typeof predictArbitrationEscalation).toBe("function");
    });

    it("exports getInsightReports", () => {
      expect(typeof getInsightReports).toBe("function");
    });
  });

  describe("generateInsightReport", () => {
    it("calls AI client with executive-insights profile", async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify({
          title: "90-Day Trend Forecast",
          summary: "Grievances up 12%, employer compliance improving.",
          insights: [{ topic: "grievance_volume", observation: "Rising trend" }],
          predictions: [
            {
              metric: "Grievance Volume",
              currentValue: 42,
              predictedValue: 47,
              changePercent: 12,
              direction: "up",
              rationale: "Seasonal pattern",
            },
          ],
          recommendations: [
            {
              priority: "high",
              action: "Increase steward allocation",
              expectedImpact: "Reduce backlog by 30%",
            },
          ],
          confidence: 0.75,
          explanation: "Based on 90-day historical patterns",
        }),
      });

      await generateInsightReport({
        organizationId: "org-1",
        userId: "user-1",
        reportType: "trend_forecast",
        timeframe: "90d",
      });

      expect(mockGenerate).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerate.mock.calls[0][0];
      expect(callArgs.profileKey).toBe("ue-executive-insights");
    });
  });

  describe("getInsightReports", () => {
    it("returns an array", async () => {
      const result = await getInsightReports("org-1");
      expect(Array.isArray(result)).toBe(true);
    });

    it("accepts optional reportType filter", async () => {
      const result = await getInsightReports("org-1", "trend_forecast" as InsightReportType);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
