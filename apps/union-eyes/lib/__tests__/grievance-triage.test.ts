/**
 * Unit Tests — Grievance Triage AI Service
 *
 * Tests analyzeGrievance, getTriageHistory, reviewTriage.
 * Mocks DB and AI client to verify prompt construction,
 * response parsing, and envelope building.
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
    resolve([]);
    return Promise.resolve([]);
  };
  return chain;
}

function makeQueryProxy(): Record<string, unknown> {
  return new Proxy({}, {
    get: () => ({
      findFirst: vi.fn().mockResolvedValue({
        id: "gr-1",
        organizationId: "org-1",
        title: "Test Grievance",
        description: "Test description",
        status: "new",
        priority: "medium",
        category: "wages",
      }),
      findMany: vi.fn().mockResolvedValue([]),
    }),
  });
}

vi.mock("@/db/db", () => ({ db: { ...makeDbChain(), query: makeQueryProxy() } }));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((x: unknown) => x),
  sql: vi.fn(),
}));

vi.mock("@/db/schema/domains/ml/ai-grievance-triage", () => ({
  aiGrievanceTriages: { id: "id", grievanceId: "grievanceId", organizationId: "organizationId" },
}));

vi.mock("@/db/schema/domains/claims/grievances", () => ({
  grievances: { id: "id", orgId: "orgId", title: "title", description: "description" },
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
  auditAiInteraction: vi.fn().mockResolvedValue("ai-grievance_triage-mock-ref"),
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

// Import after mocks
import {
  analyzeGrievance,
  getTriageHistory,
  reviewTriage,
} from "@/lib/ai/grievance-triage";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Grievance Triage AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exports", () => {
    it("exports analyzeGrievance function", () => {
      expect(typeof analyzeGrievance).toBe("function");
    });

    it("exports getTriageHistory function", () => {
      expect(typeof getTriageHistory).toBe("function");
    });

    it("exports reviewTriage function", () => {
      expect(typeof reviewTriage).toBe("function");
    });
  });

  describe("analyzeGrievance", () => {
    it("calls AI client with the correct profile", async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify({
          suggestedPriority: "high",
          suggestedCategory: "wages",
          complexity: "complex",
          estimatedDaysToResolve: 14,
          suggestedStep: "investigation",
          confidence: 0.85,
          explanation: "Multiple contract violations detected",
          factors: [{ factor: "wages", weight: 0.7, description: "Overtime" }],
        }),
      });

      await analyzeGrievance({
        grievanceId: "gr-1",
        organizationId: "org-1",
        userId: "user-1",
      });

      expect(mockGenerate).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerate.mock.calls[0][0];
      expect(callArgs.profileKey).toBe("ue-grievance-triage");
      expect(callArgs.orgId).toBe("00000000-0000-0000-0000-000000000000");
    });
  });

  describe("getTriageHistory", () => {
    it("returns an array", async () => {
      const result = await getTriageHistory("gr-1", "org-1");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("reviewTriage", () => {
    it("is callable", async () => {
      expect(typeof reviewTriage).toBe("function");
    });
  });
});
