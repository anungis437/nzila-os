/**
 * Unit Tests — Employer Risk Scoring AI Service
 *
 * Tests classifyRiskBand, calculateEmployerRisk, deriveRiskSignals,
 * getLatestRiskScore, getRiskHistory.
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
  chain.then = (resolve: (v: unknown[]) => void) => {
    resolve([{ value: 0 }]);
    return Promise.resolve([{ value: 0 }]);
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
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  gte: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((x: unknown) => x),
  count: vi.fn(() => "count"),
  sql: vi.fn(),
}));

vi.mock("@/db/schema/domains/ml/employer-risk-scores", () => ({
  employerRiskScores: { id: "id", employerId: "employerId", organizationId: "organizationId" },
}));

vi.mock("@/db/schema/domains/compliance/employer-compliance", () => ({
  employers: { id: "id", orgId: "orgId", name: "name", industry: "industry" },
  complianceAlerts: { id: "id", employerId: "employerId", orgId: "orgId", createdAt: "createdAt" },
}));

vi.mock("@/db/schema/domains/claims/grievances", () => ({
  grievances: { id: "id", orgId: "orgId", employerId: "employerId", organizationId: "organizationId", createdAt: "createdAt", status: "status" },
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
  auditAiInteraction: vi.fn().mockResolvedValue("ai-employer_risk-mock-ref"),
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
  calculateEmployerRisk,
  deriveRiskSignals,
  getLatestRiskScore,
  getRiskHistory,
  classifyRiskBand,
} from "@/lib/ai/employer-risk";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Employer Risk AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("classifyRiskBand", () => {
    it('returns "low" for score < 0.2', () => {
      expect(classifyRiskBand(0)).toBe("low");
      expect(classifyRiskBand(0.1)).toBe("low");
      expect(classifyRiskBand(0.19)).toBe("low");
    });

    it('returns "moderate" for score 0.2-0.4', () => {
      expect(classifyRiskBand(0.2)).toBe("moderate");
      expect(classifyRiskBand(0.3)).toBe("moderate");
      expect(classifyRiskBand(0.39)).toBe("moderate");
    });

    it('returns "elevated" for score 0.4-0.6', () => {
      expect(classifyRiskBand(0.4)).toBe("elevated");
      expect(classifyRiskBand(0.5)).toBe("elevated");
      expect(classifyRiskBand(0.59)).toBe("elevated");
    });

    it('returns "high" for score 0.6-0.8', () => {
      expect(classifyRiskBand(0.6)).toBe("high");
      expect(classifyRiskBand(0.7)).toBe("high");
      expect(classifyRiskBand(0.79)).toBe("high");
    });

    it('returns "critical" for score >= 0.8', () => {
      expect(classifyRiskBand(0.8)).toBe("critical");
      expect(classifyRiskBand(0.9)).toBe("critical");
      expect(classifyRiskBand(1.0)).toBe("critical");
    });
  });

  describe("exports", () => {
    it("exports calculateEmployerRisk", () => {
      expect(typeof calculateEmployerRisk).toBe("function");
    });

    it("exports deriveRiskSignals", () => {
      expect(typeof deriveRiskSignals).toBe("function");
    });

    it("exports getLatestRiskScore", () => {
      expect(typeof getLatestRiskScore).toBe("function");
    });

    it("exports getRiskHistory", () => {
      expect(typeof getRiskHistory).toBe("function");
    });
  });

  describe("deriveRiskSignals", () => {
    it("returns an object with signal counts", async () => {
      const result = await deriveRiskSignals("emp-1", "org-1");
      expect(result).toHaveProperty("grievanceCount30d");
      expect(result).toHaveProperty("complianceAlertCount30d");
      expect(result).toHaveProperty("arbitrationCount12m");
    });
  });

  describe("getLatestRiskScore", () => {
    it("returns undefined when no scores exist", async () => {
      const result = await getLatestRiskScore("emp-1", "org-1");
      expect(result).toBeUndefined();
    });
  });

  describe("getRiskHistory", () => {
    it("returns an array", async () => {
      const result = await getRiskHistory("emp-1", "org-1");
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
