/**
 * Nzila OS — Control Plane Boundary System Tests
 *
 * Verifies the architectural separation:
 *   Control Plane  → authority (policy, governance, audit, entitlements)
 *   Orchestrator   → execution only (no policy, no governance)
 *   Console        → operator interface (delegates enforcement to CP)
 *   Platform Admin → org-scoped admin only
 *
 * These tests are lightweight static + structural checks; they do NOT
 * require running servers and can execute in CI without additional deps.
 */

import { describe, it, expect } from 'vitest'
import {
  CapabilityOwnership,
  assertCapabilityOwner,
  getCapabilitiesFor,
} from '../../apps/control-plane/lib/capability-ownership'

// ── 1. Capability ownership assertions ──────────────────────────────────────

describe('CapabilityOwnership map', () => {
  it('control-plane owns policyEnforcement', () => {
    expect(() => assertCapabilityOwner('policyEnforcement', 'control-plane')).not.toThrow()
  })

  it('control-plane owns governanceActions', () => {
    expect(() => assertCapabilityOwner('governanceActions', 'control-plane')).not.toThrow()
  })

  it('control-plane owns orgLifecycle', () => {
    expect(() => assertCapabilityOwner('orgLifecycle', 'control-plane')).not.toThrow()
  })

  it('control-plane owns auditPolicy', () => {
    expect(() => assertCapabilityOwner('auditPolicy', 'control-plane')).not.toThrow()
  })

  it('control-plane owns entitlements', () => {
    expect(() => assertCapabilityOwner('entitlements', 'control-plane')).not.toThrow()
  })

  it('orchestrator owns workflowExecution', () => {
    expect(() => assertCapabilityOwner('workflowExecution', 'orchestrator')).not.toThrow()
  })

  it('orchestrator owns commandDispatch', () => {
    expect(() => assertCapabilityOwner('commandDispatch', 'orchestrator')).not.toThrow()
  })

  it('console owns operatorDashboard', () => {
    expect(() => assertCapabilityOwner('operatorDashboard', 'console')).not.toThrow()
  })

  it('platform-admin owns orgUsers', () => {
    expect(() => assertCapabilityOwner('orgUsers', 'platform-admin')).not.toThrow()
  })

  it('throws when wrong owner asserted', () => {
    expect(() => assertCapabilityOwner('policyEnforcement', 'orchestrator')).toThrow(
      /Capability boundary violation/,
    )
  })
})

// ── 2. Capability owner set completeness ────────────────────────────────────

describe('getCapabilitiesFor', () => {
  it('control-plane has at least 8 owned capabilities', () => {
    const caps = getCapabilitiesFor('control-plane')
    expect(caps.length).toBeGreaterThanOrEqual(8)
  })

  it('orchestrator has at least 3 owned capabilities', () => {
    const caps = getCapabilitiesFor('orchestrator')
    expect(caps.length).toBeGreaterThanOrEqual(3)
  })

  it('console has at least 3 owned capabilities', () => {
    const caps = getCapabilitiesFor('console')
    expect(caps.length).toBeGreaterThanOrEqual(3)
  })

  it('platform-admin has at least 2 owned capabilities', () => {
    const caps = getCapabilitiesFor('platform-admin')
    expect(caps.length).toBeGreaterThanOrEqual(2)
  })
})

// ── 3. Structural import checks ──────────────────────────────────────────────

/**
 * These checks verify that boundary-violating imports do not appear in
 * the source files by statically analyzing their content.
 *
 * They complement the capability map tests with file-level enforcement.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')

function readSource(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8')
}

describe('Console — policy enforcement proxy (no direct policy calls)', () => {
  const src = readSource('apps/console/lib/policy-enforcement.ts')

  it('does not import @nzila/platform-policy-engine directly', () => {
    expect(src).not.toContain("from '@nzila/platform-policy-engine'")
  })

  it('does not load YAML policy files directly', () => {
    expect(src).not.toContain("readdirSync")
    expect(src).not.toContain("ops/policies")
  })

  it('delegates to control-plane API', () => {
    expect(src).toContain('CONTROL_PLANE_URL')
    expect(src).toContain('/api/control-plane/policy/evaluate')
  })
})

describe('Console — governance state machine proxy (no direct DB calls)', () => {
  const src = readSource('apps/console/lib/governance/state-machine.ts')

  it('does not import platformDb', () => {
    expect(src).not.toContain("from '@nzila/db/platform'")
  })

  it('does not manipulate governanceActions table directly', () => {
    expect(src).not.toContain("governanceActions")
  })

  it('delegates to control-plane API', () => {
    expect(src).toContain('CONTROL_PLANE_URL')
    expect(src).toContain('/api/control-plane/governance/actions')
  })
})

describe('Orchestrator — execution only (no policy evaluator)', () => {
  const src = readSource('apps/orchestrator-api/src/platform.ts')

  it('does not import platform-governed-ai', () => {
    expect(src).not.toContain("from '@nzila/platform-governed-ai'")
  })

  it('does not export getPolicyEvaluator', () => {
    expect(src).not.toContain('getPolicyEvaluator')
  })

  it('does not export getAIRunStore', () => {
    expect(src).not.toContain('getAIRunStore')
  })

  it('still exports getEventBus', () => {
    expect(src).toContain('export function getEventBus')
  })
})

describe('Orchestrator — index.ts (no policy init)', () => {
  const src = readSource('apps/orchestrator-api/src/index.ts')

  it('does not call getPolicyEvaluator', () => {
    expect(src).not.toContain('getPolicyEvaluator')
  })

  it('does not import getAIRunStore', () => {
    expect(src).not.toContain('getAIRunStore')
  })
})

// ── 4. Control Plane API surface ─────────────────────────────────────────────

describe('Control Plane — API routes exist', () => {
  const policyRoute = readSource(
    'apps/control-plane/app/api/control-plane/policy/evaluate/route.ts',
  )
  const governanceRoute = readSource(
    'apps/control-plane/app/api/control-plane/governance/actions/route.ts',
  )

  it('policy evaluate endpoint exports POST handler', () => {
    expect(policyRoute).toContain('export async function POST')
  })

  it('governance actions endpoint exports POST handler', () => {
    expect(governanceRoute).toContain('export async function POST')
  })

  it('governance actions endpoint exports GET handler', () => {
    expect(governanceRoute).toContain('export async function GET')
  })

  it('policy endpoint is auth-gated', () => {
    expect(policyRoute).toContain('requireApiAuth')
  })

  it('governance endpoint is auth-gated', () => {
    expect(governanceRoute).toContain('requireApiAuth')
  })
})
