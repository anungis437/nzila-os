/**
 * Unit Tests — AI Feature Guard
 *
 * Tests guardAiFeature, auditAiInteraction, and buildAiEnvelope.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockIsFeatureEnabled = vi.fn();
vi.mock("@/lib/services/feature-flags", () => ({
  isFeatureEnabled: (...args: any[]) => mockIsFeatureEnabled(...args),
}));

const mockAuditLog = vi.fn();
vi.mock("@/lib/audit-logger", () => ({
  auditLog: (...args: any[]) => mockAuditLog(...args),
  AuditSeverity: { LOW: "low", MEDIUM: "medium", HIGH: "high", CRITICAL: "critical" },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api/standardized-responses", () => ({
  standardErrorResponse: vi.fn((_code: string, message: string) => ({
    json: async () => ({ error: message }),
    status: 500,
  })),
  ErrorCode: {
    INTERNAL_ERROR: "INTERNAL_ERROR",
    AUTH_ERROR: "AUTH_ERROR",
    FORBIDDEN: "FORBIDDEN",
  },
}));

// Import after mocks
import {
  guardAiFeature,
  auditAiInteraction,
  buildAiEnvelope,
  type AiResponseEnvelope,
} from "@/lib/ai/ai-feature-guard";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("AI Feature Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── guardAiFeature ──────────────────────────────────────────────────────

  describe("guardAiFeature", () => {
    it("returns null when feature is enabled", async () => {
      mockIsFeatureEnabled.mockResolvedValue(true);

      const result = await guardAiFeature("ai_grievance_triage", {
        organizationId: "org-1",
      });

      expect(result).toBeNull();
      expect(mockIsFeatureEnabled).toHaveBeenCalledWith("ai_grievance_triage", {
        organizationId: "org-1",
      });
    });

    it("returns 403 response when feature is disabled", async () => {
      mockIsFeatureEnabled.mockResolvedValue(false);

      const result = await guardAiFeature("ai_employer_risk", {
        organizationId: "org-2",
      });

      expect(result).not.toBeNull();
      const body = await result!.json();
      expect(body.available).toBe(false);
      expect(body.reason).toContain("ai_employer_risk");
      expect(body.fallbackAdvice).toBeTruthy();
    });

    it("returns error response when isFeatureEnabled throws", async () => {
      mockIsFeatureEnabled.mockRejectedValue(new Error("DB down"));

      const result = await guardAiFeature("ai_steward_copilot", {
        organizationId: "org-3",
      });

      // Should return some error response (not null)
      expect(result).not.toBeNull();
    });
  });

  // ── auditAiInteraction ──────────────────────────────────────────────────

  describe("auditAiInteraction", () => {
    it("returns a string auditRef starting with ai-", async () => {
      mockAuditLog.mockResolvedValue(undefined);

      const ref = await auditAiInteraction({
        featureName: "grievance_triage",
        userId: "user-1",
        organizationId: "org-1",
        resource: "grievance",
        resourceId: "gr-42",
        action: "triage",
      });

      expect(typeof ref).toBe("string");
      expect(ref).toMatch(/^ai-grievance_triage-/);
    });

    it("calls auditLog with correct eventType", async () => {
      mockAuditLog.mockResolvedValue(undefined);

      await auditAiInteraction({
        featureName: "clause_reasoning",
        userId: "user-2",
        organizationId: "org-1",
        resource: "grievance",
        action: "suggest_clauses",
      });

      expect(mockAuditLog).toHaveBeenCalledTimes(1);
      const entry = mockAuditLog.mock.calls[0][0];
      expect(entry.eventType).toBe("ai.clause_reasoning");
      expect(entry.userId).toBe("user-2");
      expect(entry.organizationId).toBe("org-1");
      expect(entry.resource).toBe("grievance");
    });

    it("includes confidence and modelVersion in audit details", async () => {
      mockAuditLog.mockResolvedValue(undefined);

      await auditAiInteraction({
        featureName: "employer_risk",
        organizationId: "org-1",
        resource: "employer",
        action: "score",
        confidence: 0.87,
        modelVersion: "gpt-4o-2024-08",
      });

      const entry = mockAuditLog.mock.calls[0][0];
      expect(entry.details.confidence).toBe(0.87);
      expect(entry.details.modelVersion).toBe("gpt-4o-2024-08");
    });

    it("does not log raw input/output to audit — only keys", async () => {
      mockAuditLog.mockResolvedValue(undefined);

      await auditAiInteraction({
        featureName: "steward_copilot",
        organizationId: "org-1",
        resource: "copilot",
        action: "query",
        input: { query: "Sensitive text here", actionType: "custom_query" },
        output: { responseText: "Do not log this" },
      });

      const entry = mockAuditLog.mock.calls[0][0];
      expect(entry.details.inputKeys).toEqual(["query", "actionType"]);
      expect(entry.details.outputKeys).toEqual(["responseText"]);
      expect(JSON.stringify(entry.details)).not.toContain("Sensitive text here");
      expect(JSON.stringify(entry.details)).not.toContain("Do not log this");
    });
  });

  // ── buildAiEnvelope ─────────────────────────────────────────────────────

  describe("buildAiEnvelope", () => {
    it("creates a complete envelope with all mandatory fields", () => {
      const envelope = buildAiEnvelope({ score: 42 }, {
        confidence: 0.92,
        explanation: "Based on 30-day trends",
        modelVersion: "gpt-4o",
        auditRef: "ai-test-123",
      });

      expect(envelope.available).toBe(true);
      expect(envelope.data).toEqual({ score: 42 });
      expect(envelope.confidence).toBe(0.92);
      expect(envelope.explanation).toBe("Based on 30-day trends");
      expect(envelope.modelVersion).toBe("gpt-4o");
      expect(envelope.auditRef).toBe("ai-test-123");
      expect(envelope.disclaimer).toBeTruthy();
      expect(envelope.disclaimer).toContain("advisory");
    });

    it("always marks available as true", () => {
      const envelope = buildAiEnvelope(null, {
        confidence: 0,
        explanation: "",
        modelVersion: "",
        auditRef: "",
      });

      expect(envelope.available).toBe(true);
    });

    it("preserves generic data types", () => {
      interface Custom { items: string[]; count: number }
      const envelope: AiResponseEnvelope<Custom> = buildAiEnvelope(
        { items: ["a", "b"], count: 2 },
        {
          confidence: 0.5,
          explanation: "test",
          modelVersion: "v1",
          auditRef: "ref",
        },
      );

      expect(envelope.data.items).toEqual(["a", "b"]);
      expect(envelope.data.count).toBe(2);
    });
  });
});
