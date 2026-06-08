/**
 * Unit Tests — Steward Copilot AI Service
 *
 * Tests executeCopilotAction, recordCopilotOutcome, getCopilotHistory.
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
  desc: vi.fn((x: any) => x),
  sql: vi.fn(),
}));

vi.mock("@/db/schema/domains/ml/ai-copilot-sessions", () => ({
  aiCopilotSessions: { id: "id", userId: "userId", organizationId: "organizationId" },
}));

vi.mock("@/db/schema/domains/claims/grievances", () => ({
  grievances: { id: "id", orgId: "orgId", title: "title", description: "description" },
}));

const mockGenerate = vi.fn();
vi.mock("@/lib/ai/ai-client", () => ({
  getAiClient: () => ({ generate: mockGenerate }),
  buildOrgAiTrace: vi.fn(() => ({
    component: "test",
    action: "mock",
  })),
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
  auditAiInteraction: vi.fn().mockResolvedValue("ai-steward_copilot-mock-ref"),
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
  executeCopilotAction,
  summarizeTimeline,
  suggestAction,
  draftResponse,
  recordCopilotOutcome,
  getCopilotHistory,
} from "@/lib/ai/steward-copilot";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Steward Copilot AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exports", () => {
    it("exports executeCopilotAction", () => {
      expect(typeof executeCopilotAction).toBe("function");
    });

    it("exports summarizeTimeline", () => {
      expect(typeof summarizeTimeline).toBe("function");
    });

    it("exports suggestAction", () => {
      expect(typeof suggestAction).toBe("function");
    });

    it("exports draftResponse", () => {
      expect(typeof draftResponse).toBe("function");
    });

    it("exports recordCopilotOutcome", () => {
      expect(typeof recordCopilotOutcome).toBe("function");
    });

    it("exports getCopilotHistory", () => {
      expect(typeof getCopilotHistory).toBe("function");
    });
  });

  describe("executeCopilotAction", () => {
    it("calls AI client with copilot profile", async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify({
          responseText: "Here is a summary of the case timeline.",
          structuredOutput: null,
          suggestedActions: ["Schedule mediation", "Gather witness statements"],
          sources: ["Grievance GR-42 timeline", "CBA Article 7"],
          confidence: 0.82,
          explanation: "Based on grievance history analysis",
        }),
      });

      await executeCopilotAction({
        actionType: "timeline_summary",
        organizationId: "org-1",
        userId: "user-1",
        userRole: "steward",
        relatedEntityType: "grievance",
        relatedEntityId: "gr-42",
      });

      expect(mockGenerate).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerate.mock.calls[0][0];
      expect(callArgs.profileKey).toBe("ue-steward-copilot");
    });
  });

  describe("getCopilotHistory", () => {
    it("returns an array", async () => {
      const result = await getCopilotHistory("user-1", "org-1");
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
