/**
 * Workflow routes — expose available playbooks and their metadata.
 *
 * GET /workflows           — List all registered playbooks
 * GET /workflows/:name     — Get details for a specific playbook
 */
import type { FastifyInstance } from 'fastify'
import { PlaybookName } from '../contract.js'
import {
  createWorkflowRegistry,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_SLO_TARGETS,
  type WorkflowDefinition,
} from '@nzila/platform-ops/workflow-registry'

// ── Registry seeded with known CI/platform playbooks ────────────────────────

const registry = createWorkflowRegistry()

function wf(
  name: string,
  description: string,
  tags: string[],
  dangerLevel: WorkflowDefinition['dangerLevel'],
  requiresApproval: boolean,
  estimatedDurationSeconds: number,
): WorkflowDefinition {
  return {
    name,
    description,
    version: '1.0.0',
    status: 'active',
    dangerLevel,
    requiresApproval,
    defaultDryRun: true,
    estimatedDurationSeconds,
    requiredPermissions: [],
    retry: DEFAULT_RETRY_CONFIG,
    slo: DEFAULT_SLO_TARGETS,
    tags,
    owner: tags[0] ?? 'platform',
    registeredAt: new Date().toISOString(),
  }
}

const seedWorkflows: WorkflowDefinition[] = [
  wf('contract_guardian', 'Validate repo contracts — package boundaries, dependency rules, and schema compliance.', ['ci'], 'safe', false, 120),
  wf('lint_check', 'Run ESLint and Prettier across the monorepo.', ['ci'], 'safe', false, 90),
  wf('typecheck', 'TypeScript type-checking across all workspaces.', ['ci'], 'safe', false, 180),
  wf('unit_tests', 'Run Vitest unit tests for changed packages.', ['ci'], 'safe', false, 300),
  wf('full_ci', 'Full CI pipeline — lint, typecheck, test, build, contract validation.', ['ci'], 'moderate', true, 600),
]

for (const w of seedWorkflows) registry.register(w)

// ── Routes ──────────────────────────────────────────────────────────────────

export async function workflowRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const workflows = registry.list()
    return {
      workflows,
      count: workflows.length,
      registeredPlaybooks: PlaybookName.options,
    }
  })

  app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
    const workflow = registry.get(req.params.name)
    if (!workflow) {
      return reply.status(404).send({ error: `Workflow '${req.params.name}' not found` })
    }
    return workflow
  })
}
