// cognition-governance-ci: allow-route-bypass — Interactive POST copilot with multi-arg session inputs.
/**
 * POST /api/exit-interviews/copilot
 * GET  /api/exit-interviews/copilot — List recent conversations
 *
 * Governance-aware continuity reasoning copilot.
 * All responses are fully explainable with evidence lineage.
 *
 * Requires: steward+
 * Entitlement: union_knowledge_suite
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import {
  processCopilotQuery,
  listConversations,
  loadConversationHistory,
} from '@/lib/knowledge-transfer/copilot';

export const dynamic = 'force-dynamic';

const CopilotQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  sessionId: z.string().optional().nullable(),
  conversationId: z.string().optional().nullable(),
  priorMessages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
  graphContext: z
    .object({
      focusedNodeId: z.string().optional().nullable(),
      overlay: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    body: CopilotQuerySchema,
  },
  async ({ organizationId, body }) => {
    const result = await processCopilotQuery(organizationId!, {
      query: body.query,
      sessionId: body.sessionId,
      conversationId: body.conversationId,
      priorMessages: body.priorMessages,
      graphContext: body.graphContext,
    });
    return { data: result };
  },
);

const GetCopilotQuerySchema = z.object({
  conversationId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    query: GetCopilotQuerySchema,
  },
  async ({ organizationId, query }) => {
    if (query.conversationId) {
      const messages = await loadConversationHistory(organizationId!, query.conversationId);
      return { data: { messages } };
    }
    const conversations = await listConversations(organizationId!, query.limit);
    return { data: { conversations } };
  },
);
