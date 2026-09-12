import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const authorityPath = resolve(root, '.github/workflows/union-eyes-authority-rollout.yml')
const deployPath = resolve(root, '.github/workflows/deploy-union-eyes.yml')
const statePath = resolve(root, 'apps/union-eyes/scripts/p4-authority-state.ts')
const authoritySource = readFileSync(authorityPath, 'utf8')
const deploySource = readFileSync(deployPath, 'utf8')
const stateSource = readFileSync(statePath, 'utf8')
const workflow = load(authoritySource) as any
const deployWorkflow = load(deploySource) as any

const chain = [
  'apply-authority-schema-prerequisites',
  'apply-automation-rules-ownership-migration',
  'apply-rls-foundation-migration',
  'apply-authority-enforcement-migration',
  'apply-round58-grant-fix-migration',
  'apply-round59-geometry-gap-closure',
] as const

const combinedRun = (jobName: string) =>
  workflow.jobs[jobName].steps.map((step: { run?: string }) => step.run ?? '').join('\n')

describe('Union Eyes P4 authority-only rollout', () => {
  it('has one explicit operation and no partial-chain inputs', () => {
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch'])
    expect(Object.keys(workflow.on.workflow_dispatch.inputs).sort()).toEqual([
      'authorized_sha',
      'operation',
    ])
    expect(workflow.on.workflow_dispatch.inputs.operation).toMatchObject({
      required: true,
      type: 'string',
    })
    expect(combinedRun('preflight')).toContain('test "$OPERATION" = "p4_authority_rollout"')
    expect(authoritySource).not.toMatch(/inputs\.apply_|apply_[a-z0-9_]+:\s*\n/)
  })

  it('contains no application build, push, migration, or deployment surface', () => {
    for (const job of ['build-push', 'apply-django-migrations', 'deploy']) {
      expect(workflow.jobs[job]).toBeUndefined()
    }
    expect(authoritySource).not.toMatch(/docker (?:build|push)|az acr build|az containerapp (?:update|revision|ingress)|traffic set/)
    expect(authoritySource).not.toContain('manage.py migrate --noinput')
  })

  it('places every authority mutator behind production Environment review and predecessor success', () => {
    for (const [index, jobName] of chain.entries()) {
      const job = workflow.jobs[jobName]
      const predecessor = index === 0 ? 'preflight' : chain[index - 1]
      expect(job.environment).toBe('production')
      expect(job.needs).toBe(predecessor)
      expect(job.if).toBe(`\${{ always() && needs.${predecessor}.result == 'success' }}`)
    }
  })

  it('fails operation, main-ref, and exact-SHA mismatches before Azure authentication', () => {
    const steps = workflow.jobs.preflight.steps
    const guardIndex = steps.findIndex((step: { name?: string }) => step.name?.includes('authorized SHA'))
    const loginIndex = steps.findIndex((step: { uses?: string }) => step.uses === 'azure/login@v3')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(loginIndex)
    const guard = steps[guardIndex].run
    expect(guard).toContain('refs/heads/main')
    expect(guard).toContain('test "$GITHUB_SHA" = "$AUTHORIZED_SHA"')
    expect(guard).toContain('test "$(git rev-parse HEAD)" = "$AUTHORIZED_SHA"')
  })

  it('positively asserts every canonical production resource and excludes the drill server', () => {
    expect(workflow.env).toMatchObject({
      EXPECTED_SUBSCRIPTION_ID: '5d819f33-d16f-429c-a3c0-5b0e94740ba3',
      EXPECTED_RESOURCE_GROUP: 'nzila-canada-prod-rg',
      EXPECTED_CONTAINERAPPS_ENVIRONMENT: 'nzila-canada-prod-env',
      EXPECTED_CONTAINER_APP: 'nzila-os-union-eyes-prod',
      EXPECTED_POSTGRES_SERVER: 'nzila-os-union-eyes-prod-db',
      EXPECTED_POSTGRES_HOST: 'nzila-os-union-eyes-prod-db.postgres.database.azure.com',
      EXPECTED_DATABASE: 'nzila_os_prod',
      EXPECTED_KEY_VAULT: 'nzila-canada-prod-kv',
    })
    expect(combinedRun('preflight')).toContain('az postgres flexible-server show')
    expect(authoritySource).not.toContain('nzila-ue-prod-db-drill')
    expect(stateSource).toContain("url.hostname === EXPECTED_HOST")
    expect(stateSource).toContain("decodeURIComponent(url.pathname.slice(1)) === EXPECTED_DATABASE")
  })

  it('uses only the canonical migration secret and never persists or outputs its value', () => {
    expect(workflow.env.MIGRATION_SECRET_NAME).toBe('union-eyes-migration-admin-database-url')
    expect(authoritySource).not.toMatch(/GITHUB_(?:ENV|OUTPUT).*ADMIN_URL|ADMIN_URL.*GITHUB_(?:ENV|OUTPUT)/)
    expect(authoritySource).not.toContain('actions/upload-artifact')
    expect(authoritySource).not.toContain('db-admin-password')
    expect(authoritySource).toContain("trap 'unset ADMIN_URL")
    expect(authoritySource).toContain('::add-mask::$ADMIN_URL')
  })

  it('runs the read-only census before the first mutator and captures required geometry', () => {
    expect(combinedRun('preflight')).toContain('rls:p4-authority-state -- --mode=preflight')
    expect(workflow.jobs['apply-authority-schema-prerequisites'].needs).toBe('preflight')
    for (const evidence of [
      'row_count',
      "column_name IN ('organization_id', 'org_id')",
      'automation_rules_org_id_organizations_id_fk',
      'automation_rules_org_idx',
      'idx_automation_rules_org',
      'indisvalid',
      'indisready',
      'indpred',
      'indnkeyatts',
      'confdeltype',
      'confupdtype',
      'update_action',
      'relrowsecurity',
      'relforcerowsecurity',
      'pg_policies',
      'role_table_grants',
      'django_migrations',
    ]) {
      expect(stateSource).toContain(evidence)
    }
  })

  it('attests final ownership, text-mode policy, exact grants, and migration ledger after the chain', () => {
    const attestation = workflow.jobs['post-mutation-attestation']
    expect(attestation.needs).toBe('apply-round59-geometry-gap-closure')
    expect(attestation.environment).toBe('production')
    expect(combinedRun('post-mutation-attestation')).toContain('rls:p4-authority-state -- --mode=attest')
    expect(combinedRun('post-mutation-attestation')).toContain('rls:post-apply-verifier')
    for (const evidence of [
      'organization_id length is not 255',
      'Legacy org_id remains present',
      'Canonical ownership index geometry is not exact',
      'Legacy ownership index remains present',
      'Legacy ownership foreign key remains present',
      'RLS and FORCE RLS are not both enabled',
      'automation_rules policy geometry is not exact',
      'EXPECTED_POLICY_GEOMETRY',
      "roles: ['union_eyes_runtime']",
      "roles: ['union_eyes_system']",
      "grantee: 'union_eyes_system', privilege_type: 'SELECT'",
    ]) {
      expect(stateSource).toContain(evidence)
    }
  })

  it('keeps the ordinary deployment workflow independent and its legacy P4 path unreachable', () => {
    for (const jobName of chain) {
      expect(deployWorkflow.jobs[jobName].if).toBe('${{ false }}')
    }
    for (const inputName of [
      'apply_authority_schema_prerequisites',
      'apply_automation_rules_ownership_migration',
      'apply_rls_foundation_migration',
      'apply_authority_enforcement_migration',
      'apply_round58_grant_fix_migration',
      'apply_round59_geometry_gap_closure',
    ]) {
      expect(deployWorkflow.on.workflow_dispatch.inputs[inputName]).toBeUndefined()
    }
    expect(deployWorkflow.jobs['build-push'].needs).toEqual(['plan', 'pre-deploy-gates'])
    expect(deployWorkflow.jobs.deploy.needs).not.toEqual(expect.arrayContaining([...chain]))
    expect(deploySource).toContain('union-eyes-authority-rollout.yml')
  })

  it('keeps all embedded shell and Python blocks syntactically executable', () => {
    for (const [jobName, job] of Object.entries<any>(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        if (!step.run) continue
        const shell = step.run.replace(/\$\{\{[^\n]+\}\}/g, 'expression')
        const shellCheck = spawnSync('bash', ['-n'], { input: shell, encoding: 'utf8' })
        expect(shellCheck.status, `${jobName}/${step.name ?? 'unnamed'}\n${shellCheck.stderr}`).toBe(0)

        const heredoc = step.run.match(/python - <<'PY'\n([\s\S]*?)\nPY(?:\n|$)/)
        if (heredoc) {
          const pythonCheck = spawnSync(
            'python3',
            ['-c', 'import sys; compile(sys.stdin.read(), "<workflow-heredoc>", "exec")'],
            { input: heredoc[1], encoding: 'utf8' },
          )
          expect(pythonCheck.status, `${jobName}/${step.name}\n${pythonCheck.stderr}`).toBe(0)
        }
      }
    }
  })
})