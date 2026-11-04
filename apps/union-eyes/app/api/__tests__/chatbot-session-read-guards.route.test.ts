import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  getMessages: vi.fn(),
  getUserSessions: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/ai/chatbot-service', () => ({
  ChatbotService: class { getMessages = m.getMessages; },
  ChatSessionManager: class { getUserSessions = m.getUserSessions; },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_CHATBOT: 'ai_chatbot' } }));
vi.mock('@/lib/rate-limiter', () => ({ RATE_LIMITS: { AI_COMPLETION: { limit: 30 } } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/api/errors', () => ({
  ApiError: {
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    notFound: (message: string) => Object.assign(new Error(message), { status: 404 }),
  },
}));

const SESSION_ID = '5e5a1c3e-0000-4000-8000-000000000001';
const ctx = { params: { sessionId: SESSION_ID }, userId: 'user-1', organizationId: 'org-1' };

describe('DEF-0B4 chatbot session transcript visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_config: unknown, handler: (context: typeof ctx) => Promise<unknown>) => handler);
    m.guardAiFeature.mockResolvedValue(null);
    m.getMessages.mockResolvedValue([{ id: 'message-1' }]);
    m.getUserSessions.mockResolvedValue([{ id: 'session-1' }]);
  });

  it('requires entitlement, rate limiting, feature and safety checks before a transcript is read', async () => {
    const { GET } = await import('../chatbot/sessions/[sessionId]/messages/route');
    const result = await (GET as any)(ctx);
    expect(m.withApi).toHaveBeenCalledWith(expect.objectContaining({
      entitlement: 'ai_advanced_insights',
      rateLimit: expect.objectContaining({ limit: 30 }),
    }), expect.any(Function));
    expect(result).toEqual({ data: [{ id: 'message-1' }] });
    expect(m.guardAiFeature).toHaveBeenCalledWith('ai_chatbot', { userId: 'user-1', organizationId: 'org-1' });
    expect(m.enforceAISafety).toHaveBeenCalledWith(expect.objectContaining({ action: 'GET', organizationId: 'org-1' }));
    expect(m.getMessages).toHaveBeenCalledWith(SESSION_ID, { userId: 'user-1', organizationId: 'org-1' });
  });

  it('answers 404 for a session id that is not a uuid, without any feature check or database read', async () => {
    const { GET } = await import('../chatbot/sessions/[sessionId]/messages/route');
    await expect((GET as any)({ ...ctx, params: { sessionId: 'session-1' } })).rejects.toMatchObject({ status: 404 });
    await expect((GET as any)({ ...ctx, params: {} })).rejects.toMatchObject({ status: 404 });
    expect(m.guardAiFeature).not.toHaveBeenCalled();
    expect(m.getMessages).not.toHaveBeenCalled();
  });

  it('does not disclose a transcript when the feature is disabled', async () => {
    const { GET } = await import('../chatbot/sessions/[sessionId]/messages/route');
    m.guardAiFeature.mockResolvedValueOnce(new Response('disabled', { status: 403 }));
    const result = await (GET as any)(ctx);
    expect(result.status).toBe(403);
    expect(m.getMessages).not.toHaveBeenCalled();
  });

  it('fails closed when feature evaluation fails', async () => {
    const { GET } = await import('../chatbot/sessions/[sessionId]/messages/route');
    m.guardAiFeature.mockRejectedValueOnce(new Error('feature service down'));
    await expect((GET as any)(ctx)).rejects.toThrow('feature service down');
    expect(m.getMessages).not.toHaveBeenCalled();
  });

  it('rejects missing organization context before reading the transcript', async () => {
    const { GET } = await import('../chatbot/sessions/[sessionId]/messages/route');
    await expect((GET as any)({ ...ctx, organizationId: null })).rejects.toMatchObject({ status: 400 });
    expect(m.guardAiFeature).not.toHaveBeenCalled();
    expect(m.getMessages).not.toHaveBeenCalled();
  });

  it('maps an inaccessible session to 404 without exposing messages', async () => {
    const { GET } = await import('../chatbot/sessions/[sessionId]/messages/route');
    m.getMessages.mockRejectedValueOnce(new Error('Session not found'));
    await expect((GET as any)(ctx)).rejects.toMatchObject({ status: 404 });
  });

  it('lists only active sessions for the authenticated user and organization', async () => {
    const { GET } = await import('../chatbot/sessions/route');
    const result = await (GET as any)(ctx);
    expect(result).toEqual({ data: [{ id: 'session-1' }] });
    expect(m.getUserSessions).toHaveBeenCalledWith('user-1', {
      organizationId: 'org-1',
      status: 'active',
    });
  });
});
