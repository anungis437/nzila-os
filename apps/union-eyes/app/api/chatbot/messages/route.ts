/**
 * POST /api/chatbot/messages
 *
 * Send a user message to the AI chatbot and receive an AI-generated response.
 * Uses ChatbotService which performs RAG, safety filtering, and LLM generation.
 */
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ChatbotService } from '@/lib/ai/chatbot-service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1).max(10_000),
  useRAG: z.boolean().optional().default(true),
});

const chatbotService = new ChatbotService();

export const POST = withApi(
  {
    body: bodySchema,
    openapi: { tags: ['AI'], summary: 'Send chatbot message and get AI response' },
  },
  async ({ body, userId }) => {
    const assistantMessage = await chatbotService.sendMessage({
      sessionId: body.sessionId,
      userId: userId!,
      content: body.content,
      useRAG: body.useRAG,
    });

    return { data: assistantMessage };
  },
);
