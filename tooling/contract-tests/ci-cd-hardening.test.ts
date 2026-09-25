/**
 * Contract test: CI/CD Hardening (PHASE 8)
 *
 * CI-001: Main CI workflow must exist and run contract tests
 * CI-002: All apps must have a turbo.json entry or be in pnpm-workspace.yaml
 * CI-003: Contract test config must include all test files
 * CI-004: Governance gates must be non-bypassable (required in CI)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ── CI-001: Main CI workflow runs contract tests ────────────────────────────

describe('CI-001: CI workflow includes contract test gate', () => {
  it('ci.yml exists and runs pnpm contract-tests', () => {
    const ciPath = join(ROOT, '.github', 'workflows', 'ci.yml')
    expect(existsSync(ciPath), 'ci.yml must exist').toBe(true)

    const src = readSafe(ciPath)
    expect(src, 'CI must run contract tests').toContain('contract-tests')
    expect(src, 'CI must use pnpm contract-tests command').toContain('pnpm contract-tests')
  })

  it('CI runs on pull_request and push to main', () => {
    const ciPath = join(ROOT, '.github', 'workflows', 'ci.yml')
    const src = readSafe(ciPath)
    expect(src, 'CI must trigger on pull_request').toContain('pull_request')
    expect(src, 'CI must trigger on push to main').toMatch(/push[\s\S]*main|main[\s\S]*push/)
  })

  it('keeps the protected build check while compiling only the affected graph', () => {
    const src = readSafe(join(ROOT, '.github', 'workflows', 'ci.yml'))

    expect(src).toContain('name: Build All')
    expect(src).toContain('fetch-depth: 0')
    expect(src).toContain('TURBO_SCM_BASE="$BASE" TURBO_SCM_HEAD="$HEAD"')
    expect(src).toContain('pnpm exec turbo run build --affected')
  })
})

// ── CI-002: All apps listed in workspace config ─────────────────────────────

describe('CI-002: All apps are in workspace config', () => {
  it('pnpm-workspace.yaml includes apps/* pattern', () => {
    const wsPath = join(ROOT, 'pnpm-workspace.yaml')
    expect(existsSync(wsPath), 'pnpm-workspace.yaml must exist').toBe(true)

    const src = readSafe(wsPath)
    expect(src, 'workspace must include apps/*').toMatch(/apps\/\*/)
  })

  it('turbo.json exists for build orchestration', () => {
    const turboPath = join(ROOT, 'turbo.json')
    expect(existsSync(turboPath), 'turbo.json must exist').toBe(true)
  })
})

// ── CI-003: Contract test coverage is comprehensive ─────────────────────────

describe('CI-003: Contract test coverage', () => {
  const REQUIRED_CONTRACT_TEST_FILES = [
    'shared-core-enforcement.test.ts',
    'canonical-schema-enforcement.test.ts',
    'control-plane-authority.test.ts',
    'org-scope-enforcement.test.ts',
    'org-scope-provability.test.ts',
    'evidence-universal-coverage.test.ts',
    'evidence-coverage.test.ts',
    'observability-unification.test.ts',
    'zonga-monetization-finalization.test.ts',
    'health-routes.test.ts',
  ]

  const contractTestDir = join(ROOT, 'tooling', 'contract-tests')

  for (const testFile of REQUIRED_CONTRACT_TEST_FILES) {
    it(`${testFile} exists in tooling/contract-tests/`, () => {
      expect(
        existsSync(join(contractTestDir, testFile)),
        `Missing contract test: ${testFile}`,
      ).toBe(true)
    })
  }
})

// ── CI-004: Governance summary generation ───────────────────────────────────

describe('CI-004: Governance and enforcement infrastructure', () => {
  it('CODEOWNERS file exists', () => {
    expect(existsSync(join(ROOT, 'CODEOWNERS')), 'CODEOWNERS must exist').toBe(true)
  })

  it('SECURITY.md exists', () => {
    expect(existsSync(join(ROOT, 'SECURITY.md')), 'SECURITY.md must exist').toBe(true)
  })

  it('lefthook.yml exists for pre-commit hooks', () => {
    expect(existsSync(join(ROOT, 'lefthook.yml')), 'lefthook.yml must exist').toBe(true)
  })

  it('ESLint architecture boundary config exists', () => {
    const boundaryPath = join(ROOT, 'packages', 'config', 'eslint-arch-boundary.mjs')
    expect(existsSync(boundaryPath), 'eslint-arch-boundary.mjs must exist').toBe(true)
  })
})

// ── CI-005: Cost-aware deploy orchestration ────────────────────────────────

describe('CI-005: GitOps deploy is exact-tip and app-scoped', () => {
  it('starts after successful main CI instead of duplicating the push trigger', () => {
    const workflowPath = join(ROOT, '.github', 'workflows', 'gitops-deploy.yml')
    expect(existsSync(workflowPath), 'gitops-deploy.yml must exist').toBe(true)

    const src = readSafe(workflowPath)
    expect(src).toContain('workflow_run:')
    expect(src).toContain('workflows: [CI]')
    expect(src).toContain("github.event.workflow_run.conclusion == 'success'")
    expect(src).not.toMatch(/\n  push:\s*\n/)
  })

  it('uses a changed-app dynamic matrix and permits successful no-op runs', () => {
    const src = readSafe(join(ROOT, '.github', 'workflows', 'gitops-deploy.yml'))

    expect(src).toContain('--automatic')
    expect(src).toContain('--changed-since "${VERSION}^"')
    expect(src).toContain('--allow-empty')
    expect(src).toContain('app: ${{ fromJSON(needs.plan.outputs.apps_json) }}')
    expect(src).toContain("if: needs.plan.outputs.has_apps == 'true'")
    expect(src).not.toContain('Check if app should be built')
    expect(src).not.toMatch(/app:\s*\[[^\]]+\]/)
  })

  it('reuses exact-tip CI for automatic runs and retains full validation for manual dispatch', () => {
    const src = readSafe(join(ROOT, '.github', 'workflows', 'gitops-deploy.yml'))

    expect(src).toContain('Exact-tip CI authority')
    expect(src).toContain('github.event.workflow_run.head_sha }}" = "${{ needs.plan.outputs.version')
    for (const command of ['pnpm typecheck', 'pnpm lint', 'pnpm test:fast', 'pnpm contract-tests']) {
      const position = src.indexOf(command)
      expect(position, `${command} must remain available for manual dispatch`).toBeGreaterThan(-1)
      expect(src.slice(Math.max(0, position - 100), position)).toContain("if: github.event_name == 'workflow_dispatch'")
    }
  })

  it('broad GitOps deploy does not own Union Eyes image fanout', () => {
    const workflowPath = join(ROOT, '.github', 'workflows', 'gitops-deploy.yml')
    const src = readSafe(workflowPath)

    expect(src, 'GitOps deploy must preserve the Union Eyes ownership comment').toContain(
      'union-eyes is owned by .github/workflows/auto-promote-union-eyes.yml',
    )
    expect(src, 'GitOps matrix must not include union-eyes').not.toMatch(
      /app:\s*\[[^\]]*\bunion-eyes\b[^\]]*\]/,
    )
  })

  it('passes Container Apps environment variables as distinct CLI arguments', () => {
    const workflowPath = join(ROOT, '.github', 'workflows', 'gitops-deploy.yml')
    const src = readSafe(workflowPath)

    expect(src).toContain('ENV_VARS=(')
    expect(src).toContain('"NODE_ENV=production"')
    expect(src).toContain('"NEXT_PUBLIC_APP_ENV=${ENV}"')
    expect(src).toContain('--set-env-vars "${ENV_VARS[@]}"')
    expect(src).not.toContain('ENV_VARS="NODE_ENV=production NEXT_PUBLIC_APP_ENV=${ENV}"')
  })

  it('fails closed on post-deploy health, drift, and evidence', () => {
    const workflowPath = join(ROOT, '.github', 'workflows', 'gitops-deploy.yml')
    const src = readSafe(workflowPath)

    expect(src).toContain('Resolve protected probe credentials')
    expect(src).toContain('--secret-name orchestrator-api-key')
    expect(src).toContain('echo "::add-mask::$ORCHESTRATOR_API_KEY"')
    expect(src).toContain("'.apps[$app].routing.healthPath // \"/api/health\"'")
    expect(src).toContain('echo "::error::Post-deploy health check failed')
    expect(src).not.toMatch(/drift-version\.ts[\s\S]{0,200}\|\| true/)
    expect(src).not.toMatch(/build-deploy-evidence\.ts[^\n]*\|\| true/)
  })

  it('probes the control plane through its public runtime proof routes', () => {
    const inventory = JSON.parse(
      readSafe(join(ROOT, 'governance', 'release', 'deployment-inventory.json')),
    ) as {
      apps: Record<string, {
        routing?: { healthPath?: string; readyPath?: string; versionPath?: string }
      }>
    }
    const routing = inventory.apps['control-plane']?.routing

    expect(routing?.healthPath).toBe('/api/health')
    expect(routing?.readyPath).toBe('/api/ready')
    expect(routing?.versionPath).toBe('/api/version')

    for (const route of ['health', 'ready', 'version']) {
      expect(
        existsSync(join(ROOT, 'apps', 'control-plane', 'app', 'api', route, 'route.ts')),
        `control-plane ${route} probe route must exist`,
      ).toBe(true)
    }
  })

  it('uses inventory fallback routing and authenticated version probes without staging exceptions', () => {
    const smoke = readSafe(join(ROOT, 'scripts', 'release', 'run-smoke.ts'))
    const drift = readSafe(join(ROOT, 'scripts', 'release', 'drift-version.ts'))
    const evidence = readSafe(join(ROOT, 'scripts', 'release', 'build-deploy-evidence.ts'))

    expect(smoke).toContain("versionHeaders['x-api-key'] = process.env.ORCHESTRATOR_API_KEY")
    expect(smoke).toContain('const ok = probes.every((probe) => probe.ok)')
    expect(smoke).not.toContain('nonBlockingForStaging')

    expect(drift).toContain('stagingFallback?: string')
    expect(drift).toContain("headers['x-api-key'] = process.env.ORCHESTRATOR_API_KEY")
    expect(drift).toContain("env === 'staging' ? cfg.routing?.stagingFallback : undefined")

    expect(evidence).toContain("if (promotionVerdict !== 'ready') process.exit(1)")
  })
})
