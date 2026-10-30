/**
 * AI Chatbot Service — Unit Tests
 *
 * Covers ChatSessionManager (6 methods), RAGService (3 methods),
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
  mockAiEmbed: vi.fn(),
  mockFetch: vi.fn(),
  audit: vi.fn(),
  operation: vi.fn(),
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
  getAiClient: vi.fn(() => ({
    generate: mocks.mockAiGenerate,
    embed: mocks.mockAiEmbed,
  })),
  UE_APP_KEY: "union-eyes",
  UE_PROFILES: { CHATBOT: "ue-chatbot", EMBEDDINGS: "ue-embeddings" },
  UE_SYSTEM_ORG_ID: "00000000-0000-0000-0000-000000000000",
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/db/with-rls-context", () => ({
  withRLSContext: async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => fn((await import("@/db")).db),
}));
vi.mock("@/lib/audit/atomic-audit", () => ({ persistAtomicAudit: mocks.audit }));
vi.mock("@/lib/audit/operation-audit", () => ({ performAuditedOperation: mocks.operation }));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 29, limit: 30, resetIn: 60 })),
}));

/* ── imports ────────────────────────────────────────────────────────── */

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
    mocks.mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("createSession returns new session", async () => {
    const s = await mgr.createSession({ userId: "user-1", organizationId: "org-1" });
    expect(s.id).toBe("sess-1");
    expect(s.title).toBe("Test chat");
  });

  it("getSession returns session by id", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    const s = await mgr.getSession("sess-1");
    expect(s?.id).toBe("sess-1");
  });

  it("getSession returns null when not found", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([]);
    const s = await mgr.getSession("missing");
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

  it("updateSessionTitle updates", async () => {
    await mgr.updateSessionTitle("sess-1", "org-1", "Updated title");
    expect(mocks.mockUpdateWhere).toHaveBeenCalled();
  });

  it("archiveSession sets archived status", async () => {
    await mgr.archiveSession("sess-1", "org-1");
    expect(mocks.mockUpdateWhere).toHaveBeenCalled();
  });

  it("deleteSession sets deleted status", async () => {
    await mgr.deleteSession("sess-1", "org-1");
    expect(mocks.mockUpdateWhere).toHaveBeenCalled();
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

  it("addDocument generates embedding and inserts", async () => {
    await rag.addDocument({
      organizationId: "org-1",
      title: "Test Doc",
      documentType: "policy",
      content: "Document content about grievance procedures",
      sourceType: "manual",
      createdBy: "user-1",
    });
    expect(mocks.mockAiEmbed).toHaveBeenCalled();
  });

  it("searchDocuments fails closed before embedding or SQL when organization is absent", async () => {
    await expect(rag.searchDocuments("grievance", { organizationId: "" })).rejects.toThrow(
      "Organization context required for knowledge search",
    );
    expect(mocks.mockAiEmbed).not.toHaveBeenCalled();
    expect(mocks.mockSelectFrom).not.toHaveBeenCalled();
  });

  it("searchDocuments returns scored results", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([
      {
        id: "doc-1",
        title: "Policy",
        content: "Grievance filing procedures for union members...",
        embedding: JSON.stringify(Array(384).fill(0.1)),
      },
    ]);
    const results = await rag.searchDocuments("grievance", { organizationId: "org-1", limit: 5 });
    expect(Array.isArray(results)).toBe(true);
  });

  // DEF-0B4-CHATBOT-RAG-LIMITS-BEFORE-SCORING
  it("searchDocuments scores the candidate set before applying the limit, and skips unreadable embeddings", async () => {
    const aligned = (n: number) => JSON.stringify(Array(384).fill(n));
    mocks.mockSelectLimit.mockResolvedValueOnce([
      { id: "weak", title: "Weak", content: "x", embedding: JSON.stringify(Array.from({ length: 384 }, (_, i) => (i === 0 ? 1 : 0))) },
      { id: "broken", title: "Broken", content: "x", embedding: "not json" },
      { id: "missing", title: "Missing", content: "x", embedding: null },
      { id: "best", title: "Best", content: "x", embedding: aligned(0.1) },
    ]);
    const results = await rag.searchDocuments("grievance", { organizationId: "org-1", limit: 1, similarityThreshold: 0 });
    expect(results.map((r) => r.documentId)).toEqual(["best"]);
    // The query reads a bounded candidate set, not the requested limit.
    expect(mocks.mockSelectLimit).toHaveBeenCalledWith(500);
  });

  it("searchDocuments filters by threshold", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([
      {
        id: "doc-1",
        title: "Irrelevant",
        content: "Totally unrelated content",
        embedding: JSON.stringify(Array(384).fill(0)),
      },
    ]);
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
    // Use an explicit, valid moderation-provider response. A missing key must
    // fail closed in production; it must not silently disable moderation in tests.
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ flagged: false, categories: {}, category_scores: {} }],
      }),
    }));
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

  it("sendMessage refuses missing moderation credentials without calling the model or storing messages", async () => {
    delete process.env.OPENAI_API_KEY;
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    await expect(bot.sendMessage({
      sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "hello",
    })).rejects.toThrow("Content safety system unavailable");
    expect(mocks.mockAiGenerate).not.toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
  });

  it("sendMessage refuses a malformed moderation response without calling the model", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }));
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
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          results: [
            {
              flagged: true,
              categories: { violence: true },
              category_scores: { violence: 0.9 },
            },
          ],
        }),
      }),
    );
    mocks.mockSelectLimit.mockResolvedValueOnce([session]);
    await expect(
      bot.sendMessage({ sessionId: "sess-1", userId: "user-1", organizationId: "org-1", content: "bad content" }),
    ).rejects.toThrow("Message flagged by content safety filter");
    // round 54: flagged rows must retain sessionId so they're traceable to a tenant/session
    expect(mocks.mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "sess-1" }),
    );
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
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
