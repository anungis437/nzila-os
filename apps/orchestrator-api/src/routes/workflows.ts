/**
 * Workflow routes — expose available playbooks and their metadata.
 *
 * GET /workflows           — List all registered playbooks
 * GET /workflows/:name     — Get details for a specific playbook
 */
import type { FastifyInstance } from 'fastify'
import { PlaybookName } from '../contract.js'

export interface WorkflowDefinition {
  name: string
  description: string
  dangerLevel: 'safe' | 'moderate' | 'destructive'
  requiresApproval: boolean
  defaultDryRun: boolean
  estimatedDurationSeconds: number
}

const WORKFLOWS: WorkflowDefinition[] = [
  {
    name: 'contract_guardian',
    description: 'Validate repo contracts — package boundaries, dependency rules, and schema compliance.',
    dangerLevel: 'safe',
    requiresApproval: false,
    defaultDryRun: true,
    estimatedDurationSeconds: 120,
  },
  {
    name: 'lint_check',
    description: 'Run ESLint and Prettier across the monorepo.',
    dangerLevel: 'safe',
    requiresApproval: false,
    defaultDryRun: true,
    estimatedDurationSeconds: 90,
  },
  {
    name: 'typecheck',
    description: 'TypeScript type-checking across all workspaces.',
    dangerLevel: 'safe',
    requiresApproval: false,
    defaultDryRun: true,
    estimatedDurationSeconds: 180,
  },
  {
    name: 'unit_tests',
    description: 'Run Vitest unit tests for changed packages.',
    dangerLevel: 'safe',
    requiresApproval: false,
    defaultDryRun: true,
    estimatedDurationSeconds: 300,
  },
  {
    name: 'full_ci',
    description: 'Full CI pipeline — lint, typecheck, test, build, contract validation.',
    dangerLevel: 'moderate',
    requiresApproval: true,
    defaultDryRun: true,
    estimatedDurationSeconds: 600,
  },
]

// ga-check:exempt — static lookup derived from WORKFLOWS constant
const workflowMap = new Map(WORKFLOWS.map((w) => [w.name, w]))

export async function workflowRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return {
      workflows: WORKFLOWS,
      count: WORKFLOWS.length,
      registeredPlaybooks: PlaybookName.options,
    }
  })

  app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
    const workflow = workflowMap.get(req.params.name)
    if (!workflow) {
      return reply.status(404).send({ error: `Workflow '${req.params.name}' not found` })
    }
    return workflow
  })
}
