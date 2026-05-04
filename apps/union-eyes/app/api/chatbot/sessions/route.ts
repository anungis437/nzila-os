/**
 * GET  /api/chatbot/sessions — list current user's chat sessions
 * POST /api/chatbot/sessions — create a new chat session
 */
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { ChatSessionManager } from '@/lib/ai/chatbot-service';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';

export const dynamic = 'force-dynamic';

const sessionManager = new ChatSessionManager();

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'ai_chatbot',
    rateLimit: RATE_LIMITS.AI_COMPLETION,
    openapi: { tags: ['AI'], summary: 'List user chat sessions' },
  },
  async ({ userId, organizationId }) => {
    const blocked = await guardAiFeature(AI_FEATURES.AI_CHATBOT, { userId: userId ?? undefined, organizationId: organizationId ?? undefined });
    if (blocked) return blocked;
    enforceAISafety({
      origin: 'chatbot-sessions',
      action: 'GET',
      organizationId,
      userId,
      userRole: 'member',
      dataClass: 'internal',
    });
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
    auth: { minRole: 'member' },
    entitlement: 'ai_chatbot',
    rateLimit: RATE_LIMITS.AI_COMPLETION,
    openapi: { tags: ['AI'], summary: 'Create new chat session' },
  },
  async ({ body, userId, organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('No active organization. Please select an organization and try again.');
    }
    const blocked = await guardAiFeature(AI_FEATURES.AI_CHATBOT, { userId: userId ?? undefined, organizationId: organizationId ?? undefined });
    if (blocked) return blocked;
    enforceAISafety({
      origin: 'chatbot-sessions',
      action: 'POST',
      organizationId,
      userId,
      userRole: 'member',
      dataClass: 'internal',
    });
    const session = await sessionManager.createSession({
      userId: userId!,
      organizationId: organizationId,
      title: body.title,
    });
    return { data: session };
  },
);
