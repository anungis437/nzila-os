/**
 * POST /api/chatbot/messages
 *
 * Send a user message to the AI chatbot and receive an AI-generated response.
 * Uses ChatbotService which performs RAG, safety filtering, and LLM generation.
 */
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ChatbotService } from '@/lib/ai/chatbot-service';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { standardSuccessResponse } from '@/lib/api/standardized-responses';
import { auditAIInvocation } from '@/lib/audit-logger';

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
    auth: { minRole: 'member' },
    entitlement: 'ai_chatbot',
    rateLimit: RATE_LIMITS.AI_COMPLETION,
    openapi: { tags: ['AI'], summary: 'Send chatbot message and get AI response' },
  },
  async ({ body, userId, organizationId }) => {
    const blocked = await guardAiFeature(AI_FEATURES.AI_CHATBOT, { userId: userId ?? undefined, organizationId: organizationId ?? undefined });
    if (blocked) return blocked;
    enforceAISafety({
      origin: 'chatbot',
      action: 'POST',
      organizationId,
      userId,
      userRole: 'member',
      dataClass: 'internal',
    });
    const auditRefId = await auditAIInvocation({
      userId: userId ?? undefined,
      organizationId: organizationId ?? undefined,
      origin: 'chatbot',
      model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4',
      dataClass: 'internal',
    });
    const assistantMessage = await chatbotService.sendMessage({
      sessionId: body.sessionId,
      userId: userId!,
      content: body.content,
      useRAG: body.useRAG,
    });

    return standardSuccessResponse({ data: assistantMessage }, {
      aiGenerated: true,
      reviewRequired: false,
      source: 'ai',
      model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4',
      timestamp: new Date().toISOString(),
      auditRefId,
    });
  },
);
