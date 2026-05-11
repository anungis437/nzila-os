// cognition-governance-ci: allow-route-bypass — CRUD on reasoning sessions; not a single-engine cognition surface.
/**
 * GET  /api/exit-interviews/reasoning-sessions — List sessions for org
 * POST /api/exit-interviews/reasoning-sessions — Create new session
 *
 * Requires: steward+
 * Entitlement: union_knowledge_suite
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import {
  createReasoningSession,
  listReasoningSessions,
} from '@/lib/knowledge-transfer/reasoning-sessions';

export const dynamic = 'force-dynamic';

const CreateSessionSchema = z.object({
  title: z.string().min(1).max(200),
  focus: z.enum([
    'general_continuity',
    'governance_investigation',
    'resilience_planning',
    'simulation_exploration',
    'mitigation_planning',
    'dependency_analysis',
  ]),
  contextDescription: z.string().max(2000).optional(),
});

const GetSessionsQuerySchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    query: GetSessionsQuerySchema,
  },
  async ({ organizationId, query }) => {
    const sessions = await listReasoningSessions(organizationId!, {
      status: query.status,
      limit: query.limit,
    });
    return { data: sessions };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    body: CreateSessionSchema,
  },
  async ({ organizationId, body }) => {
    const session = await createReasoningSession(organizationId!, {
      title: body.title,
      focus: body.focus,
      contextDescription: body.contextDescription,
    });
    return { data: session };
  },
);
