/**
 * Unit Tests — Clause Reasoning AI Service
 *
 * Tests suggestClausesForGrievance, explainClauseRelevance, getClauseReasoningHistory.
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
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  desc: vi.fn((x: any) => x),
  sql: vi.fn(),
}));

vi.mock("@/db/schema/domains/ml/ai-clause-reasoning", () => ({
  aiClauseReasonings: { id: "id", grievanceId: "grievanceId", organizationId: "organizationId" },
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
  auditAiInteraction: vi.fn().mockResolvedValue("ai-clause_reasoning-mock-ref"),
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
  suggestClausesForGrievance,
  explainClauseRelevance,
  getClauseReasoningHistory,
} from "@/lib/ai/clause-reasoning";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Clause Reasoning AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exports", () => {
    it("exports suggestClausesForGrievance function", () => {
      expect(typeof suggestClausesForGrievance).toBe("function");
    });

    it("exports explainClauseRelevance function", () => {
      expect(typeof explainClauseRelevance).toBe("function");
    });

    it("exports getClauseReasoningHistory function", () => {
      expect(typeof getClauseReasoningHistory).toBe("function");
    });
  });

  describe("suggestClausesForGrievance", () => {
    it("calls AI client with clause-reasoning profile", async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify({
          suggestedClauses: [
            {
              clauseArticle: "12",
              clauseSection: "3",
              clauseTitle: "Overtime Pay",
              clauseSnippet: "All hours worked beyond 40…",
              relevanceScore: 0.92,
              reasoning: "Directly addresses overtime violation",
              applicationNotes: "Applicable to member's shift pattern",
              strengthAssessment: "strong",
              precedentRefs: [],
            },
          ],
          overallAnalysis: "One strongly relevant clause identified",
          confidence: 0.88,
          explanation: "CBA analysis complete",
        }),
      });

      await suggestClausesForGrievance({
        grievanceId: "gr-1",
        organizationId: "org-1",
        userId: "user-1",
      });

      expect(mockGenerate).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerate.mock.calls[0][0];
      expect(callArgs.profileKey).toBe("ue-clause-reasoning");
    });
  });

  describe("getClauseReasoningHistory", () => {
    it("returns an array", async () => {
      const result = await getClauseReasoningHistory("gr-1", "org-1");
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
