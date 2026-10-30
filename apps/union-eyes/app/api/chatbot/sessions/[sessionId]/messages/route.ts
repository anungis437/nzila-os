/**
 * GET /api/chatbot/sessions/[sessionId]/messages
 *
 * Retrieve all messages for a specific chat session.
 */
import { withApi } from '@/lib/api/with-api';
import { ChatbotService } from '@/lib/ai/chatbot-service';
import { ApiError } from '@/lib/api/errors';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';

export const dynamic = 'force-dynamic';

const chatbotService = new ChatbotService();

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'ai_chatbot',
    rateLimit: RATE_LIMITS.AI_COMPLETION,
    openapi: { tags: ['AI'], summary: 'Get messages for a chat session' },
  },
  async ({ params, userId, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('An active organization is required');
    const blocked = await guardAiFeature(AI_FEATURES.AI_CHATBOT, {
      userId: userId ?? undefined,
      organizationId,
    });
    if (blocked) return blocked;
    enforceAISafety({
      origin: 'chatbot-session-messages',
      action: 'GET',
      organizationId,
      userId,
      userRole: 'member',
      dataClass: 'internal',
    });
    const messages = await chatbotService
      .getMessages(params.sessionId, {
        userId: userId!,
        organizationId: organizationId!,
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === 'Session not found')
          throw ApiError.notFound('Chat session');
        throw error;
      });
    return { data: messages };
  },
);
