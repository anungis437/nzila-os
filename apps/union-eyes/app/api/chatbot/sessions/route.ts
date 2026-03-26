/**
 * GET  /api/chatbot/sessions — list current user's chat sessions
 * POST /api/chatbot/sessions — create a new chat session
 */
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ChatSessionManager } from '@/lib/ai/chatbot-service';

export const dynamic = 'force-dynamic';

const sessionManager = new ChatSessionManager();

export const GET = withApi(
  {
    openapi: { tags: ['AI'], summary: 'List user chat sessions' },
  },
  async ({ userId, organizationId }) => {
    const sessions = await sessionManager.getUserSessions(userId!, {
      organizationId: organizationId ?? undefined,
    });
    return { data: sessions };
  },
);

const createBody = z.object({
  title: z.string().min(1).max(500).optional().default('New conversation'),
});

export const POST = withApi(
  {
    body: createBody,
    openapi: { tags: ['AI'], summary: 'Create new chat session' },
  },
  async ({ body, userId, organizationId }) => {
    const session = await sessionManager.createSession({
      userId: userId!,
      organizationId: organizationId ?? '',
      title: body.title,
    });
    return { data: session };
  },
);
