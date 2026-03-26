/**
 * GET /api/chatbot/sessions/[sessionId]/messages
 *
 * Retrieve all messages for a specific chat session.
 */
import { withApi } from '@/lib/api/with-api';
import { ChatbotService } from '@/lib/ai/chatbot-service';

export const dynamic = 'force-dynamic';

const chatbotService = new ChatbotService();

export const GET = withApi(
  {
    openapi: { tags: ['AI'], summary: 'Get messages for a chat session' },
  },
  async ({ params }) => {
    const messages = await chatbotService.getMessages(params.sessionId);
    return { data: messages };
  },
);
