/**
 * AI Chatbot Service — Unit Tests
 *
 * Covers ChatSessionManager (6 methods), RAGService (3 methods),
 * ChatbotService (sendMessage, getMessages).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
}));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: mocks.mockInsertValues.mockReturnValue({
        returning: mocks.mockInsertReturning,
      }),
    })),
    select: vi.fn((_cols?: unknown) => ({
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
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((a: unknown) => a),
  sql: Object.assign(
    vi.fn((_s: unknown, ..._v: unknown[]) => ({ _tag: "sql" })),
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

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 29, limit: 30, resetIn: 60 })),
}));

/* ── imports ────────────────────────────────────────────────────────── */

import { ChatSessionManager, RAGService, ChatbotService } from "../chatbot-service";

/* ── helpers ─────────────────────────────────────────────────────────── */

function limitResult(data: unknown[]) {
  return Object.assign(Promise.resolve(data), { offset: mocks.mockSelectOffset });
}

/* ── tests ──────────────────────────────────────────────────────────── */

const session = {
  id: "sess-1",
  userId: "user-1",
  organizationId: "org-1",
  title: "Test chat",
  model: "gpt-4",
  temperature: "0.7",
  messageCount: 0,
  createdAt: new Date(),
};

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
    await mgr.updateSessionTitle("sess-1", "Updated title");
    expect(mocks.mockUpdateWhere).toHaveBeenCalled();
  });

  it("archiveSession sets archived status", async () => {
    await mgr.archiveSession("sess-1");
    expect(mocks.mockUpdateWhere).toHaveBeenCalled();
  });

  it("deleteSession sets deleted status", async () => {
    await mgr.deleteSession("sess-1");
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

  it("searchDocuments returns scored results", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([
      {
        id: "doc-1",
        title: "Policy",
        content: "Grievance filing procedures for union members...",
        embedding: JSON.stringify(Array(384).fill(0.1)),
      },
    ]);
    const results = await rag.searchDocuments("grievance", { limit: 5 });
    expect(Array.isArray(results)).toBe(true);
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
    const results = await rag.searchDocuments("grievance", { similarityThreshold: 0.99 });
    expect(results).toHaveLength(0);
  });

  it("incrementCitationCount updates db", async () => {
    await rag.incrementCitationCount("doc-1");
    expect(mocks.mockUpdateWhere).toHaveBeenCalled();
  });
});

describe("ChatbotService", () => {
  let bot: ChatbotService;

  beforeEach(() => {
    vi.clearAllMocks();
    bot = new ChatbotService();
    // Session lookup
    mocks.mockSelectLimit.mockReturnValue(limitResult([session]));
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
    // No OPENAI_API_KEY → skip safety check
    delete process.env.OPENAI_API_KEY;
  });

  it("sendMessage throws if session not found", async () => {
    mocks.mockSelectLimit.mockResolvedValueOnce([]); // getSession returns null
    await expect(
      bot.sendMessage({ sessionId: "bad", userId: "u-1", content: "hi" }),
    ).rejects.toThrow("Session not found");
  });

  it("sendMessage returns assistant message", async () => {
    // getSession returns session
    mocks.mockSelectLimit
      .mockResolvedValueOnce([session]) // getSession
      .mockResolvedValueOnce([]); // history
    const msg = await bot.sendMessage({
      sessionId: "sess-1",
      userId: "user-1",
      content: "What are my rights?",
    });
    expect(msg.role).toBe("assistant");
    expect(msg.content).toContain("union rights");
  });

  it("sendMessage handles AI error with fallback", async () => {
    mocks.mockSelectLimit
      .mockResolvedValueOnce([session])
      .mockResolvedValueOnce([]);
    mocks.mockAiGenerate.mockRejectedValueOnce(new Error("AI down"));
    mocks.mockInsertReturning.mockResolvedValueOnce([
      {
        id: "msg-2",
        sessionId: "sess-1",
        role: "assistant",
        content: "I'm sorry, the AI assistant is temporarily unavailable.",
        modelUsed: "fallback",
      },
    ]);
    const msg = await bot.sendMessage({
      sessionId: "sess-1",
      userId: "user-1",
      content: "Hello",
      useRAG: false,
    });
    expect(msg.content).toContain("temporarily unavailable");
  });

  it("sendMessage with content safety flagged throws", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
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
      bot.sendMessage({ sessionId: "sess-1", userId: "user-1", content: "bad content" }),
    ).rejects.toThrow("Message flagged by content safety filter");
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it("getMessages returns messages in chronological order", async () => {
    const msgs = [
      { id: "m-2", role: "assistant", content: "reply" },
      { id: "m-1", role: "user", content: "hello" },
    ];
    mocks.mockSelectOffset.mockResolvedValueOnce(msgs);
    const result = await bot.getMessages("sess-1");
    // reverse() is called, so first should be m-1
    expect(result[0].id).toBe("m-1");
  });
});
