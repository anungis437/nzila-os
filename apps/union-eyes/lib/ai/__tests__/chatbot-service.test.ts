/**
 * AI Chatbot Service — Unit Tests
 *
 * Covers ChatSessionManager (3 methods), RAGService (3 methods),
 * ChatbotService (sendMessage, getMessages).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ── hoisted ────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockInsertValues: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockSelectFrom: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockSelectOrderBy: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockSelectOffset: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockFindFirstSession: vi.fn(),
  mockAiGenerate: vi.fn(),
  mockModerate: vi.fn(),
  mockAiEmbed: vi.fn(),
  mockFetch: vi.fn(),
  audit: vi.fn(),
  operation: vi.fn(),
  rls: vi.fn(),
  requireVector: vi.fn(),
  searchKb: vi.fn(),
  sourceCondition: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: mocks.mockInsertValues.mockReturnValue({
        returning: mocks.mockInsertReturning,
      }),
    })),
    select: vi.fn((_cols?: any) => ({
      from: mocks.mockSelectFrom.mockReturnValue({
        where: mocks.mockSelectWhere.mockReturnValue({
          orderBy: mocks.mockSelectOrderBy.mockReturnValue({
            limit: mocks.mockSelectLimit.mockReturnValue({
              offset: mocks.mockSelectOffset,
            }),
          }),
          limit: mocks.mockSelectLimit,
        }),
        limit: mocks.mockSelectLimit,
      }),
    })),
    update: vi.fn(() => ({
      set: mocks.mockUpdateSet.mockReturnValue({
        where: mocks.mockUpdateWhere,
      }),
    })),
    query: {
      chatSessions: { findFirst: mocks.mockFindFirstSession },
    },
  },
}));

vi.mock("@/db/schema", () => ({
  chatSessions: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    status: "status",
    lastMessageAt: "lastMessageAt",
    messageCount: "messageCount",
  },
  chatMessages: {
    id: "id",
    sessionId: "sessionId",
    createdAt: "createdAt",
  },
  knowledgeBase: {
    id: "id",
    title: "title",
    content: "content",
    embedding: "embedding",
    isActive: "isActive",
    organizationId: "organizationId",
    citationCount: "citationCount",
    lastUsedAt: "lastUsedAt",
  },
  aiSafetyFilters: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  desc: vi.fn((a: any) => a),
  sql: Object.assign(
    vi.fn((_s: any, ..._v: any[]) => ({ _tag: "sql" })),
    { raw: vi.fn() },
  ),
}));

vi.mock("@/lib/services/ai/embedding-cache", () => ({
  embeddingCache: {
    getCachedEmbedding: vi.fn(async () => null),
    setCachedEmbedding: vi.fn(async () => {}),
  },
}));

vi.mock("@/lib/ai/ai-client", () => ({
  buildOrgAiTrace: () => ({}),
  toGatewayDataClass: () => "sensitive",
  getAiClient: vi.fn(() => ({
    // Moderation and the reply are both control-plane calls; the profile tells them apart.
    generate: (request: { profileKey: string }) =>
      request.profileKey === "ue-chatbot-moderation" ? mocks.mockModerate(request) : mocks.mockAiGenerate(request),
    embed: mocks.mockAiEmbed,
  })),
  UE_APP_KEY: "union-eyes",
  UE_PROFILES: { CHATBOT: "ue-chatbot", CHATBOT_MODERATION: "ue-chatbot-moderation", EMBEDDINGS: "ue-embeddings" },
  UE_SYSTEM_ORG_ID: "00000000-0000-0000-0000-000000000000",
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/db/with-rls-context", () => ({
  withRLSContext: mocks.rls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => fn((await import("@/db")).db)),
}));
vi.mock("@/lib/audit/atomic-audit", () => ({ persistAtomicAudit: mocks.audit }));
vi.mock("@/lib/audit/operation-audit", () => ({ performAuditedOperation: mocks.operation }));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 29, limit: 30, resetIn: 60 })),
}));

vi.mock("@/lib/ai/vector-readiness", () => ({
  KNOWLEDGE_BASE_EMBEDDING: { table: "knowledge_base", column: "embedding" },
  VectorSearchUnavailableError: class VectorSearchUnavailableError extends Error {},
  requireVectorColumn: mocks.requireVector,
}));
vi.mock("@/lib/ai/knowledge-base-embeddings", () => ({ searchKnowledgeBaseByEmbedding: mocks.searchKb }));
vi.mock("@/lib/knowledge-transfer/governance/interview-access", () => ({ knowledgeBaseSourceCondition: mocks.sourceCondition }));

/* ── imports ────────────────────────────────────────────────────────── */

import { VectorSearchUnavailableError } from "@/lib/ai/vector-readiness";
import { logger } from "@/lib/logger";
import { ChatSessionManager, RAGService, ChatbotService, ChatbotUnavailableError } from "../chatbot-service";

/* ── helpers ─────────────────────────────────────────────────────────── */

function limitResult(data: any[]) {
  return Object.assign(Promise.resolve(data), { offset: mocks.mockSelectOffset });
}

/* ── tests ──────────────────────────────────────────────────────────── */

const session = {
  id: "sess-1",
  userId: "user-1",
  organizationId: "org-1",
  title: "Test chat",
  status: "active",
  model: "gpt-4",
  temperature: "0.7",
  messageCount: 0,
  createdAt: new Date(),
};

beforeEach(() => {
  mocks.audit.mockReset().mockResolvedValue(undefined);
  mocks.operation.mockReset().mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
  mocks.requireVector.mockReset().mockResolvedValue(undefined);
  mocks.searchKb.mockReset().mockResolvedValue([]);
  mocks.sourceCondition.mockReset().mockReturnValue({ _tag: "source-condition" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
});

describe("ChatSessionManager", () => {
  let mgr: ChatSessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new ChatSessionManager();
    mocks.mockInsertReturning.mockResolvedValue([session]);
    mocks.mockSelectLimit.mockReturnValue(limitResult([session]));
    mocks.mockSelectOffset.mockResolvedValue([session]);
  });

  it("createSession returns new session", async () => {
    const s = await mgr.createSession({ userId: "user-1", organizationId: "org-1" });
    expect(s.id).toBe("sess-1");
    expect(s.title).toBe("Test chat");
  });

  it('getSession returns session by id', async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    const s = await mgr.getSession("sess-1", "org-1");
    expect(s?.id).toBe("sess-1");
  });

  it("getSession returns null when not found", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([]);
    const s = await mgr.getSession("missing", "org-1");
    expect(s).toBeNull();
  });

  it("getUserSessions returns sessions list", async () => {
    mocks.mockSelectOffset.mockResolvedValueOnce([session]);
    const list = await mgr.getUserSessions("user-1", { organizationId: "org-1", limit: 10 });
    expect(list).toHaveLength(1);
  });

  it("getUserSessions with status filter", async () => {
    mocks.mockSelectOffset.mockResolvedValueOnce([]);
    const list = await mgr.getUserSessions("user-1", { status: "active" });
    expect(list).toEqual([]);
  });
});

describe("RAGService", () => {
  let rag: RAGService;

  beforeEach(() => {
    vi.clearAllMocks();
    rag = new RAGService();
    mocks.mockAiEmbed.mockResolvedValue({ embeddings: [Array(384).fill(0.1)] });
    mocks.mockInsertValues.mockReturnValue({ returning: mocks.mockInsertReturning });
    mocks.mockInsertReturning.mockResolvedValue([]);
    mocks.mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("searchDocuments fails closed before embedding or SQL when organization is absent", async () => {
    await expect(rag.searchDocuments("grievance", { organizationId: "" })).rejects.toThrow(
      "Organization context required for knowledge search",
    );
    expect(mocks.requireVector).not.toHaveBeenCalled();
    expect(mocks.mockAiEmbed).not.toHaveBeenCalled();
    expect(mocks.searchKb).not.toHaveBeenCalled();
  });

  it("searchDocuments is unavailable, before the question is embedded, where the database has no vector column", async () => {
    mocks.requireVector.mockRejectedValueOnce(new VectorSearchUnavailableError("no vector column"));
    await expect(rag.searchDocuments("grievance", { organizationId: "org-1" })).rejects.toBeInstanceOf(VectorSearchUnavailableError);
    expect(mocks.mockAiEmbed).not.toHaveBeenCalled();
    expect(mocks.searchKb).not.toHaveBeenCalled();
  });

  it("searchDocuments has the database score and order the matches, and returns an excerpt of each", async () => {
    mocks.searchKb.mockResolvedValueOnce([
      { id: "doc-1", title: "Policy", content: "Grievance filing procedures for union members. ".repeat(10), similarity: 0.93 },
      { id: "doc-2", title: "Guide", content: "Short", similarity: 0.81 },
    ]);
    const results = await rag.searchDocuments("grievance", { organizationId: "org-1", limit: 5 });

    expect(results.map((r) => [r.documentId, r.relevanceScore])).toEqual([["doc-1", 0.93], ["doc-2", 0.81]]);
    expect(results[0].excerpt).toHaveLength(203);
    expect(results[0].excerpt.endsWith("...")).toBe(true);
    expect(results[1].excerpt).toBe("Short...");
  });

  it("searchDocuments asks the database for the best matches above the threshold, scoped to the organization and the reader's levels", async () => {
    await rag.searchDocuments("grievance", {
      organizationId: "org-1",
      limit: 3,
      similarityThreshold: 0.6,
      documentTypes: ["policy"],
      readableLevels: ["public_internal", "restricted"],
    });

    expect(mocks.sourceCondition).toHaveBeenCalledWith(
      expect.objectContaining({ levels: new Set(["public_internal", "restricted"]) }),
      "org-1",
    );
    expect(mocks.searchKb).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: "org-1",
        embedding: Array(384).fill(0.1),
        minSimilarity: 0.6,
        limit: 3,
        documentTypes: ["policy"],
        sourceCondition: { _tag: "source-condition" },
      }),
    );
  });

  it("searchDocuments defaults to a threshold of 0.7 and five matches, and reads no interview-derived knowledge without reader levels", async () => {
    await rag.searchDocuments("grievance", { organizationId: "org-1" });

    expect(mocks.sourceCondition).toHaveBeenCalledWith(expect.objectContaining({ levels: new Set() }), "org-1");
    expect(mocks.searchKb).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ minSimilarity: 0.7, limit: 5 }));
  });

  it("searchDocuments returns nothing when no row reaches the threshold", async () => {
    mocks.searchKb.mockResolvedValueOnce([]);
    const results = await rag.searchDocuments("grievance", { organizationId: "org-1", similarityThreshold: 0.99 });
    expect(results).toHaveLength(0);
  });

  it("incrementCitationCount updates db", async () => {
    await rag.incrementCitationCount("doc-1", "org-1");
    expect(mocks.mockUpdateWhere).toHaveBeenCalled();
  });
});

describe("ChatbotService", () => {
  let bot: ChatbotService;

  beforeEach(() => {
    vi.clearAllMocks();
    bot = new ChatbotService();
    // Reset queued one-shot lookups: a fail-closed moderation rejection must not
    // leak an unused history lookup into the next test's session ownership check.
    mocks.mockSelectLimit.mockReset().mockReturnValue(limitResult([session]));
    mocks.mockSelectOffset.mockResolvedValue([]);
    // AI responses
    mocks.mockAiGenerate.mockResolvedValue({
      content: "AI response about union rights",
      tokensIn: 10,
      tokensOut: 20,
      model: "gpt-4",
    });
    mocks.mockAiEmbed.mockResolvedValue({ embeddings: [Array(384).fill(0.1)] });
    // Insert returning (assistant message)
    mocks.mockInsertReturning.mockResolvedValue([
      {
        id: "msg-1",
        sessionId: "sess-1",
        role: "assistant",
        content: "AI response about union rights",
        modelUsed: "gpt-4",
      },
    ]);
    mocks.mockInsertValues.mockReturnValue({ returning: mocks.mockInsertReturning });
    mocks.mockUpdateWhere.mockResolvedValue(undefined);
    // Moderation is a control-plane call with an explicit, well-formed verdict. A refused call or an unusable answer fails closed;
    // it must not silently disable moderation in tests.
    mocks.mockModerate.mockReset().mockResolvedValue({ content: JSON.stringify({ flagged: false, categories: [] }), tokensIn: 5, tokensOut: 5, model: "gpt-4o" });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sendMessage throws if session not found", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([]); // getSession returns null
    await expect(
      bot.sendMessage({ sessionId: "bad", userId: "u-1", organizationId: "org-1", content: "hi" }),
    ).rejects.toThrow("Session not found");
  });

  it("sendMessage throws when the session belongs to a different user", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]); // getSession
    await expect(
      bot.sendMessage({ sessionId: "sess-1", userId: "other-user", organizationId: "org-1", content: "hi" }),
    ).rejects.toThrow("Session not found");
  });

  it("sendMessage throws when the session belongs to a different organization", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]); // getSession
    await expect(
      bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-2", content: "hi" }),
    ).rejects.toThrow("Session not found");
  });

  it("sendMessage refuses when the control plane refuses the moderation call, without calling the model or storing messages", async () => {
    mocks.mockModerate.mockRejectedValueOnce(new Error("profile not enabled"));
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    await expect(bot.sendMessage({
      sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "hello",
    })).rejects.toThrow("Content safety system unavailable");
    expect(mocks.mockAiGenerate).not.toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
  });

  it.each([
    ["not json", "I think this is fine"],
    ["a verdict without a boolean", JSON.stringify({ flagged: "no", categories: [] })],
    ["a verdict without categories", JSON.stringify({ flagged: false })],
  ])("sendMessage refuses a moderation answer that is %s, without calling the model", async (_label, content) => {
    mocks.mockModerate.mockResolvedValueOnce({ content, tokensIn: 1, tokensOut: 1, model: "gpt-4o" });
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    await expect(bot.sendMessage({
      sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "hello",
    })).rejects.toThrow("Content safety system unavailable");
    expect(mocks.mockAiGenerate).not.toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
  });

  it("sendMessage returns assistant message", async () => {
    // getSession returns session
    mocks.mockSelectLimit
      .mockResolvedValueOnce([session]) // getSession
      .mockResolvedValueOnce([]); // history
    const msg = await bot.sendMessage({
      sessionId: "sess-1",
      userId: "user-1",
      organizationId: "org-1",
      content: "What are my rights?",
    });
    expect(msg.role).toBe("assistant");
    expect(msg.content).toContain("union rights");
  });

  it("sendMessage retrieves knowledge for the sender's readable levels and gives the model the matched excerpts as context", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]).mockResolvedValueOnce([]);
    mocks.searchKb.mockResolvedValueOnce([{ id: "doc-1", title: "Policy", content: "Grievances are filed within 30 days.", similarity: 0.9 }]);
    await bot.sendMessage({
      sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "How long do I have to file?", readableLevels: ["public_internal"],
    });

    expect(mocks.sourceCondition).toHaveBeenCalledWith(expect.objectContaining({ levels: new Set(["public_internal"]) }), "org-1");
    const request = mocks.mockAiGenerate.mock.calls[0][0];
    expect(request.input[0]).toMatchObject({ role: "system", content: expect.stringContaining("[Policy]: Grievances are filed within 30 days.") });
  });

  it("sendMessage answers without context, and without a warning, where semantic retrieval is not available", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]).mockResolvedValueOnce([]);
    mocks.requireVector.mockRejectedValueOnce(new VectorSearchUnavailableError("no vector column"));
    const msg = await bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "What are my rights?" });

    expect(msg.role).toBe("assistant");
    expect(mocks.mockAiEmbed).not.toHaveBeenCalled();
    const request = mocks.mockAiGenerate.mock.calls[0][0];
    expect(request.input.every((m: { role: string }) => m.role !== "system")).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("sendMessage warns, and still answers without context, when retrieval fails for another reason", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]).mockResolvedValueOnce([]);
    mocks.searchKb.mockRejectedValueOnce(new Error("database down"));
    const msg = await bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "What are my rights?" });

    expect(msg.role).toBe("assistant");
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("RAG search failed"), expect.objectContaining({ error: "database down" }));
  });

  it("sendMessage and getMessages read and write only in the tenant transaction of the session's organization, never on the ambient handle", async () => {
    mocks.rls.mockClear();
    mocks.mockSelectLimit.mockResolvedValueOnce([session]).mockResolvedValueOnce([]);
    await bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "What are my rights?" });
    // the session lookup, the history read and the exchange commit are three short transactions; none stays open around the model call
    const sendScopes = mocks.rls.mock.calls.map((call) => call[0]);
    expect(sendScopes.length).toBeGreaterThanOrEqual(3);
    expect(sendScopes.every((scope) => scope.organizationId === "org-1")).toBe(true);

    mocks.rls.mockClear();
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    mocks.mockSelectOffset.mockResolvedValueOnce([]);
    await bot.getMessages("sess-1", { userId: "user-1", organizationId: "org-1" });
    expect(mocks.rls.mock.calls.map((call) => call[0])).toEqual([{ organizationId: "org-1" }, { organizationId: "org-1" }]);
  });

  it("sendMessage stores the exchange with its audit record on the same transaction", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]).mockResolvedValueOnce([]);
    await bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "What are my rights?" });
    expect(mocks.operation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", userId: "user-1", action: "chatbot.message.respond", resourceId: "sess-1" }),
      expect.any(Function),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ insert: expect.any(Function) }),
      expect.objectContaining({ organizationId: "org-1", userId: "user-1", action: "chatbot.message.exchange", resourceId: "sess-1" }),
    );
  });

  it("sendMessage sends nothing to the provider when the operation intent cannot be recorded", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    mocks.operation.mockRejectedValueOnce(new Error("intent not recorded"));
    await expect(
      bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "hi" }),
    ).rejects.toThrow("intent not recorded");
    expect(mocks.mockAiGenerate).not.toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
  });

  it("sendMessage does not keep an exchange whose audit record cannot be written", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]).mockResolvedValueOnce([]);
    mocks.audit.mockRejectedValueOnce(new Error("audit down"));
    await expect(
      bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "hi", useRAG: false }),
    ).rejects.toThrow("audit down");
  });

  // Replaced: this test asserted that a failed generation was stored as an assistant reply from the model "fallback". The ai-client mock also
  // lacked buildOrgAiTrace, so the other sendMessage tests were passing on that canned reply; the mock now provides it.
  // DEF-0B4-CHATBOT-FALLBACK-PRESENTED-AS-AI-REPLY
  it("sendMessage raises when generation fails and stores no reply", async () => {
    mocks.mockSelectLimit
      .mockResolvedValueOnce([session])
      .mockResolvedValueOnce([]);
    mocks.mockAiGenerate.mockRejectedValueOnce(new Error("AI down"));
    await expect(bot.sendMessage({
      sessionId: "sess-1",
      userId: "user-1",
      organizationId: "org-1",
      content: "Hello",
    })).rejects.toBeInstanceOf(ChatbotUnavailableError);
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
  });

  it("sendMessage with content safety flagged throws", async () => {
    mocks.mockModerate.mockResolvedValueOnce({ content: JSON.stringify({ flagged: true, categories: ["violence"] }), tokensIn: 1, tokensOut: 1, model: "gpt-4o" });
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    await expect(
      bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "bad content" }),
    ).rejects.toThrow("Message flagged by content safety filter");
    // round 54: flagged rows must retain sessionId so they're traceable to a tenant/session
    expect(mocks.mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "sess-1", flaggedCategories: ["violence"] }),
    );
    expect(mocks.mockAiGenerate).not.toHaveBeenCalled();
  });

  // F06 A5: moderation is an AI call like any other. It goes through the control plane under its own profile, classed as member text,
  // and never to a provider directly with a provider key.
  it("F06 A5: moderates through the AI control plane under its own profile and data class, never by a direct provider call", async () => {
    process.env.OPENAI_API_KEY = "provider-key-must-not-be-used";
    mocks.mockSelectLimit.mockResolvedValueOnce([session]).mockResolvedValueOnce([]);
    await bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "What are my rights?" });

    expect(mocks.mockModerate).toHaveBeenCalledTimes(1);
    const request = mocks.mockModerate.mock.calls[0][0];
    expect(request).toMatchObject({ profileKey: "ue-chatbot-moderation", dataClass: "sensitive", appKey: "union-eyes" });
    expect(request.input[0].role).toBe("system");
    expect(request.input[1].content).toBe("<<<MESSAGE\nWhat are my rights?\nMESSAGE>>>");
    expect(fetch).not.toHaveBeenCalled();
    delete process.env.OPENAI_API_KEY;
  });

  it("F06 A5: reads a fenced verdict and keeps only known categories, naming an unclassified flag as unspecified", async () => {
    mocks.mockModerate.mockResolvedValueOnce({ content: "```json\n" + JSON.stringify({ flagged: true, categories: ["made_up"] }) + "\n```", tokensIn: 1, tokensOut: 1, model: "gpt-4o" });
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    await expect(
      bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "bad" }),
    ).rejects.toThrow("Message flagged by content safety filter");
    expect(mocks.mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ flaggedCategories: ["unspecified"] }));
  });

  it("getMessages returns messages in chronological order", async () => {
    const msgs = [
      { id: "m-2", role: "assistant", content: "reply" },
      { id: "m-1", role: "user", content: "hello" },
    ];
    mocks.mockSelectLimit.mockResolvedValueOnce([session]); // getSession (ownership check)
    mocks.mockSelectOffset.mockResolvedValueOnce(msgs);
    const result = await bot.getMessages("sess-1", { userId: "user-1", organizationId: "org-1" });
    // reverse() is called, so first should be m-1
    expect(result[0].id).toBe("m-1");
  });

  it.each(["archived", "deleted"])("getMessages refuses %s sessions before reading messages", async (status) => {
    mocks.mockSelectLimit.mockResolvedValueOnce([{ ...session, status }]);
    await expect(
      bot.getMessages("sess-1", { userId: "user-1", organizationId: "org-1" }),
    ).rejects.toThrow("Session not found");
    expect(mocks.mockSelectOffset).not.toHaveBeenCalled();
  });

  it.each(["archived", "deleted"])("sendMessage refuses %s sessions before AI generation", async (status) => {
    mocks.mockSelectLimit.mockResolvedValueOnce([{ ...session, status }]);
    await expect(
      bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "hi" }),
    ).rejects.toThrow("Session not found");
    expect(mocks.operation).not.toHaveBeenCalled();
    expect(mocks.mockAiGenerate).not.toHaveBeenCalled();
  });

  it("getMessages throws when the caller does not own the session", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]); // getSession
    await expect(
      bot.getMessages("sess-1", { userId: "other-user", organizationId: "org-1" }),
    ).rejects.toThrow("Session not found");
  });
});
