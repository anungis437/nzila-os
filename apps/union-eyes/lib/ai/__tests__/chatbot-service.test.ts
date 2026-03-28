import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsertValues, mockInsertReturning, mockSelectChain } = vi.hoisted(() => ({
  mockInsertValues: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockSelectChain: vi.fn(() => []),
}));

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockInsertReturning,
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => mockSelectChain()),
          })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    query: {
      chatSessions: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  chatSessions: { id: 'id', userId: 'userId', organizationId: 'organizationId' },
  chatMessages: { id: 'id', sessionId: 'sessionId' },
  knowledgeBase: {},
  aiSafetyFilters: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/services/ai/embedding-cache', () => ({
  embeddingCache: {
    getCachedEmbedding: vi.fn(async () => null),
    setCachedEmbedding: vi.fn(async () => {}),
  },
}));

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: vi.fn(() => ({
    generate: vi.fn(async () => ({ content: 'AI response', tokensIn: 10, tokensOut: 20, model: 'gpt-4' })),
    embed: vi.fn(async () => ({ embeddings: [Array(1536).fill(0.1)] })),
  })),
  UE_APP_KEY: 'union-eyes',
  UE_PROFILES: { CHATBOT: 'ue-chatbot', EMBEDDINGS: 'ue-embeddings' },
  UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000',
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { ChatSessionManager } from '../chatbot-service';

describe('ChatSessionManager', () => {
  let manager: ChatSessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ChatSessionManager();
    mockInsertReturning.mockResolvedValue([{
      id: 'sess-1',
      userId: 'user-1',
      organizationId: 'org-1',
      title: 'New conversation',
      createdAt: new Date(),
    }]);
  });

  describe('createSession', () => {
    it('creates a new chat session', async () => {
      const session = await manager.createSession({
        userId: 'user-1',
        organizationId: 'org-1',
        title: 'Test chat',
      });
      expect(session).toBeDefined();
      expect(session.id).toBe('sess-1');
    });
  });
});
