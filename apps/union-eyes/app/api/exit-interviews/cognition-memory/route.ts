// cognition-governance-ci: allow-route-bypass — Memory CRUD endpoint (GET/POST/DELETE); not a single-engine cognition output.
/**
 * GET  /api/exit-interviews/cognition-memory — Load org cognition memory
 * POST /api/exit-interviews/cognition-memory — Save a new cognition memory entry
 *
 * Requires: officer+
 * Entitlement: union_knowledge_suite
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import {
  loadCognitionMemory,
  saveCognitionMemory,
  archiveCognitionMemory,
} from '@/lib/knowledge-transfer/cognition-memory';

export const dynamic = 'force-dynamic';

const GetMemoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  memoryType: z.string().optional(),
  sessionId: z.string().optional(),
});

const SaveMemorySchema = z.object({
  memoryType: z.enum([
    'simulation_snapshot',
    'propagation_investigation',
    'mitigation_comparison',
    'governance_reasoning',
    'resilience_baseline',
    'continuity_assessment',
    'decision_brief',
  ]),
  title: z.string().min(1).max(200),
  contextSummary: z.string().max(2000).optional(),
  payload: z.record(z.unknown()).optional(),
  resilienceScoreAtCapture: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  keyInsights: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  /** Archive an existing entry by ID */
  archiveId: z.string().optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    query: GetMemoryQuerySchema,
  },
  async ({ organizationId, query }) => {
    const store = await loadCognitionMemory(organizationId!, {
      limit: query.limit,
      memoryType: query.memoryType,
      sessionId: query.sessionId,
    });
    return { data: store };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    body: SaveMemorySchema,
  },
  async ({ organizationId, body }) => {
    if (body.archiveId) {
      await archiveCognitionMemory(organizationId!, body.archiveId);
      return { data: { archived: true, id: body.archiveId } };
    }
    const entry = await saveCognitionMemory(organizationId!, {
      memoryType: body.memoryType as 'simulation_snapshot' | 'propagation_investigation' | 'mitigation_comparison' | 'governance_reasoning' | 'resilience_baseline' | 'continuity_assessment' | 'decision_brief',
      title: body.title ?? '',
      contextSummary: body.contextSummary ?? '',
      payload: body.payload ?? {},
      resilienceScoreAtCapture: body.resilienceScoreAtCapture,
      tags: body.tags,
      keyInsights: body.keyInsights,
      sessionId: body.sessionId,
    });
    return { data: entry };
  },
);
