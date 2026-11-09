// cognition-governance-ci: allow-route-bypass — Memory CRUD endpoint (GET/POST/DELETE); not a single-engine cognition output.
/**
 * GET  /api/exit-interviews/cognition-memory — Load org cognition memory
 * POST /api/exit-interviews/cognition-memory — Save a new cognition memory entry
 *
 * A memoryType 'simulation_snapshot' call with a scenario runs the real simulateContinuityImpact workflow
 * server-side and persists its real output as a system_generated entry (payload is ignored for that call). Without
 * a scenario, any memoryType (including simulation_snapshot) saves the officer's own payload as officer_asserted
 * (DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR).
 *
 * Requires: officer+
 * Entitlement: union_knowledge_suite
 */

import { z } from 'zod';
import { PROVENANCE_KEY } from '@/lib/knowledge-transfer/cognition-memory/memory-models';
import { withApi, ApiError } from '@/lib/api/framework';
import {
  loadCognitionMemory,
  saveCognitionMemory,
  archiveCognitionMemory,
} from '@/lib/knowledge-transfer/cognition-memory';

export const dynamic = 'force-dynamic';

const GetMemoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  memoryType: z.string().max(60).optional(),
  sessionId: z.string().max(100).optional(),
});

const MAX_PAYLOAD_BYTES = 16 * 1024;

const SimulationScenarioSchema = z.object({
  simulationType: z.enum([
    'retirement',
    'sudden_departure',
    'vendor_loss',
    'governance_knowledge_loss',
    'undocumented_process_loss',
    'procedural_fragmentation',
    'bottleneck_collapse',
  ]),
  affectedNodeIds: z.array(z.string().max(200)).max(50),
  affectedRoles: z.array(z.string().max(100)).max(20).optional(),
  timelineWeeks: z.number().int().min(0).max(520).optional(),
  context: z.string().max(1000).optional(),
}).strict();

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
  // Everything here is the officer's own statement: it is bounded, and it cannot carry the key the server reserves for authorship.
  payload: z
    .record(z.string(), z.unknown())
    .refine((value) => !(PROVENANCE_KEY in value), { message: `${PROVENANCE_KEY} is reserved` })
    .refine((value) => JSON.stringify(value).length <= MAX_PAYLOAD_BYTES, { message: 'payload must be at most 16 KB' })
    .optional(),
  resilienceScoreAtCapture: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  keyInsights: z.array(z.string().min(1).max(500)).max(20).optional(),
  sessionId: z.string().max(100).optional(),
  /**
   * For memoryType 'simulation_snapshot' only: when given, the server runs the real simulation workflow itself
   * and persists its real output as a system_generated entry; payload is ignored for this call. Rejected for any
   * other memoryType - a simulation can only be run and recorded against a simulation_snapshot.
   */
  scenario: SimulationScenarioSchema.optional(),
  /** Archive an existing entry by ID */
  archiveId: z.guid().optional(),
}).refine((body) => !body.scenario || body.memoryType === 'simulation_snapshot', {
  message: 'scenario is only accepted for memoryType simulation_snapshot',
  path: ['scenario'],
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
  async ({ organizationId, userId, body }) => {
    if (body.archiveId) {
      const archived = await archiveCognitionMemory(organizationId!, body.archiveId, userId!);
      if (!archived) throw ApiError.notFound('Memory entry', body.archiveId);
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
      scenario: body.scenario,
    }, userId!);
    return { data: entry };
  },
);
