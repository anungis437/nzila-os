/**
 * GET /api/chatbot/sessions/[sessionId]/messages
 *
 * Retrieve all messages for a specific chat session.
 */
import { withApi } from '@/lib/api/with-api';
import { ChatbotService } from '@/lib/ai/chatbot-service';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const chatbotService = new ChatbotService();

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: { tags: ['AI'], summary: 'Get messages for a chat session' },
  },
  async ({ params, userId, organizationId }) => {
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
