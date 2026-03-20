/**
 * Zonga — Architecture Purity Tests
 *
 * Validates that server-action files follow the governance rules:
 *   1. Status-changing mutations route through the command bus (executeCommand)
 *   2. The command bus has all expected handlers registered
 *   3. Shared UX components are exported from the barrel
 *   4. Detail pages use shared components (not inline status pills)
 *
 * These tests use static source analysis — no DB required.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

function readSource(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8')
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. COMMAND BUS ROUTING
// ═══════════════════════════════════════════════════════════════════════════

describe('Command Bus Routing', () => {
  it('creator-actions.ts routes mutations through executeCommand', () => {
    const src = readSource('lib/actions/creator-actions.ts')
    expect(src).toContain('executeCommand')
    expect(src).toContain("'register_creator'")
  })

  it('release-actions.ts routes mutations through executeCommand', () => {
    const src = readSource('lib/actions/release-actions.ts')
    expect(src).toContain('executeCommand')
    expect(src).toContain("'create_release'")
    expect(src).toContain("'transition_release_status'")
  })

  it('moderation-actions.ts routes mutations through executeCommand', () => {
    const src = readSource('lib/actions/moderation-actions.ts')
    expect(src).toContain('executeCommand')
    expect(src).toContain("'create_moderation_case'")
    expect(src).toContain("'resolve_moderation_case'")
  })

  it('payout-actions.ts routes mutations through executeCommand', () => {
    const src = readSource('lib/actions/payout-actions.ts')
    expect(src).toContain('executeCommand')
    expect(src).toContain("'execute_payout'")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. HANDLER REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Handler Registration', () => {
  it('register-handlers.ts registers all expected handlers', () => {
    const src = readSource('lib/control/register-handlers.ts')

    const expectedHandlers = [
      'registerCreatorHandler',
      'createReleaseHandler',
      'transitionReleaseStatusHandler',
      'createModerationCaseHandler',
      'resolveModerationCaseHandler',
      'executePayoutHandler',
    ]

    for (const handler of expectedHandlers) {
      expect(src).toContain(handler)
    }
  })

  it('command-bus.ts exports registerHandler and execute', () => {
    const src = readSource('lib/control/command-bus.ts')
    expect(src).toContain('export function registerHandler')
    expect(src).toContain('export async function execute')
  })

  it('control-adapter.ts exports executeCommand', () => {
    const src = readSource('lib/control/control-adapter.ts')
    expect(src).toContain('export async function executeCommand')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. UX COMPONENT BARREL EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

describe('UX Component Barrel', () => {
  it('index.ts exports all shared dashboard components', () => {
    const src = readSource('components/index.ts')
    expect(src).toContain('StatusBadge')
    expect(src).toContain('LifecycleTimeline')
    expect(src).toContain('SystemGuidance')
    expect(src).toContain('ProgressStepper')
    expect(src).toContain('TimelineEvent')
    expect(src).toContain('Step')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. DETAIL PAGES USE SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Detail Pages Use Shared Components', () => {
  it('creator detail page imports StatusBadge', () => {
    const src = readSource('app/[locale]/dashboard/creators/[id]/page.tsx')
    expect(src).toContain('StatusBadge')
    expect(src).toContain('SystemGuidance')
    // Should NOT have inline status-pill logic
    expect(src).not.toContain('bg-green-100 text-green-800')
  })

  it('release detail page imports shared components', () => {
    const src = readSource('app/[locale]/dashboard/releases/[id]/page.tsx')
    expect(src).toContain('StatusBadge')
    expect(src).toContain('ProgressStepper')
    expect(src).toContain('SystemGuidance')
    // Should NOT have inline statusColors map
    expect(src).not.toContain('const statusColors')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. CONTROL LAYER STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

describe('Control Layer Structure', () => {
  it('control index re-exports executeCommand', () => {
    const src = readSource('lib/control/index.ts')
    expect(src).toContain('executeCommand')
    expect(src).toContain('./register-handlers')
  })

  it('each handler file exports a handler with commandType', () => {
    const handlerFiles = [
      'lib/control/handlers/register-creator.handler.ts',
      'lib/control/handlers/create-release.handler.ts',
      'lib/control/handlers/transition-release-status.handler.ts',
      'lib/control/handlers/create-moderation-case.handler.ts',
      'lib/control/handlers/resolve-moderation-case.handler.ts',
      'lib/control/handlers/execute-payout.handler.ts',
    ]

    for (const file of handlerFiles) {
      const src = readSource(file)
      expect(src).toContain('commandType')
      expect(src).toContain('async execute(command, context)')
    }
  })
})
