import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

function read(rel: string): string {
  if (rel.includes('..')) {
    throw new Error(`Invalid relative path: ${rel}`)
  }

  return readFileSync(join(ROOT, rel), 'utf8')
}

describe('Operating Layer E2E Contract', () => {
  it('enforces Console action -> Control Plane authorization -> Orchestrator execution -> telemetry -> dashboard update chain', () => {
    const consolePolicy = read('apps/console/lib/policy-enforcement.ts')
    const cpAuthorizeRoute = read('apps/control-plane/app/api/control-plane/authority/authorize-workflow/route.ts')
    const orchestratorExecuteRoute = read('apps/orchestrator-api/src/routes/execute.ts')
    const orchestratorTelemetry = read('apps/orchestrator-api/src/telemetry-hooks.ts')
    const revenueDashboard = read('apps/control-plane/app/[locale]/(dashboard)/revenue/page.tsx')
    const commandCenterDashboard = read('apps/control-plane/app/[locale]/(dashboard)/command-center/page.tsx')

    // 1) Console operator action routes through Control Plane policy/authority surface.
    expect(consolePolicy).toContain('/api/control-plane/policy/evaluate')

    // 2) Control Plane exposes explicit workflow authorization gate.
    expect(cpAuthorizeRoute).toContain('authorizeWorkflowTrigger')
    expect(cpAuthorizeRoute).toContain('WORKFLOW_DENIED')

    // 3) Orchestrator requires CP authorization decision for non-dry-run execution.
    expect(orchestratorExecuteRoute).toContain('authorizationDecisionId')
    expect(orchestratorExecuteRoute).toContain('AUTHORIZATION_REQUIRED')
    expect(orchestratorExecuteRoute).toContain('executeWorkflow')

    // 4) Orchestrator emits request telemetry for lifecycle visibility.
    expect(orchestratorTelemetry).toContain('requestTelemetry')
    expect(orchestratorTelemetry).toContain('handlerCompleted')
    expect(orchestratorTelemetry).toContain('responseSent')

    // 5) Control Plane dashboards read live API snapshots and expose mode labels.
    expect(revenueDashboard).toContain('/api/control-plane/revenue/pipeline')
    expect(revenueDashboard).toContain('dataMode')
    expect(commandCenterDashboard).toContain('/api/control-plane/revenue/command-center')
    expect(commandCenterDashboard).toContain('dataMode')
  })

  it('enforces hardening guards: no localhost runtime fallbacks, strict boot env checks, and dev-only in-memory store', () => {
    const consolePolicy = read('apps/console/lib/policy-enforcement.ts')
    const consoleStateMachine = read('apps/console/lib/governance/state-machine.ts')
    const cpTelemetry = read('apps/control-plane/app/api/control-plane/modules/union-eyes/telemetry/route.ts')
    const consoleBootEnv = read('apps/console/lib/boot-env.ts')
    const controlPlaneBootEnv = read('apps/control-plane/lib/boot-env.ts')
    const platformAdminBootEnv = read('apps/platform-admin/lib/boot-env.ts')
    const orchestratorEnv = read('apps/orchestrator-api/src/env.ts')
    const orchestratorStore = read('apps/orchestrator-api/src/store.ts')

    // Runtime operating paths cannot silently fallback to localhost.
    expect(consolePolicy).not.toContain('localhost')
    expect(consoleStateMachine).not.toContain('localhost')
    expect(cpTelemetry).not.toContain('localhost')

    // Production boot asserts must exist for core dependency contracts.
    expect(consoleBootEnv).toContain("if (process.env.NODE_ENV !== 'production') return")
    expect(consoleBootEnv).toContain("requireEnv('CONTROL_PLANE_URL')")
    expect(consoleBootEnv).toContain("requireEnv('CONTROL_PLANE_API_KEY')")
    expect(consoleBootEnv).toContain("requireEnv('ORCHESTRATOR_API_URL')")

    expect(controlPlaneBootEnv).toContain("if (process.env.NODE_ENV !== 'production') return")
    expect(controlPlaneBootEnv).toContain("requireEnv('CONTROL_PLANE_API_KEY')")
    expect(controlPlaneBootEnv).toContain("requireEnv('UNION_EYES_URL')")

    expect(platformAdminBootEnv).toContain("if (process.env.NODE_ENV !== 'production') return")
    expect(platformAdminBootEnv).toContain("requireEnv('CONTROL_PLANE_URL')")
    expect(platformAdminBootEnv).toContain("requireEnv('CONTROL_PLANE_API_KEY')")
    expect(platformAdminBootEnv).toContain("requireEnv('ORCHESTRATOR_API_URL')")

    // Orchestrator contract: DB required outside dev and in-memory store restricted to dev-only fallback.
    expect(orchestratorEnv).toContain("if (parsed.NODE_ENV !== 'development' && !parsed.DATABASE_URL)")
    expect(orchestratorStore).toContain('function canUseMemoryStore(): boolean')
    expect(orchestratorStore).toContain("process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL")
    expect(orchestratorStore).toContain('In-memory orchestrator store is allowed only in development without DATABASE_URL')
  })
})
