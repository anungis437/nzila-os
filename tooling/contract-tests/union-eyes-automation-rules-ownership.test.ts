import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const authorityWorkflowPath = '.github/workflows/union-eyes-authority-rollout.yml'

const extractPythonHeredoc = (run: string, stepName: string) => {
  const match = run.match(/python - <<'PY'\n([\s\S]*?)\nPY(?:\n|$)/)
  expect(match, `${stepName} Python heredoc`).not.toBeNull()
  return match![1]
}

describe('Union Eyes automation_rules ownership correction', () => {
  it('fails closed instead of inventing ownership for existing rows', () => {
    const migration = read(
      'apps/union-eyes/backend/core/migrations/0003_automation_rules_organization_id.py',
    )

    expect(migration).toContain("IF to_regclass('public.automation_rules') IS NULL")
    expect(migration).toContain("column_name = 'org_id'")
    expect(migration).toContain('existing_data_type IS NOT NULL AND legacy_column_exists')
    expect(migration).toContain('ambiguous dual ownership geometry')
    expect(migration).toContain('populated legacy org_id-only ownership geometry')
    expect(migration).toContain("legacy_data_type <> 'uuid'")
    expect(migration).toContain("legacy_nullable <> 'NO'")
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS automation_rules_org_id_organizations_id_fk')
    expect(migration).toContain('DROP INDEX IF EXISTS public.automation_rules_org_idx')
    expect(migration).toContain('RENAME COLUMN org_id TO organization_id')
    expect(migration).toContain('ALTER COLUMN organization_id TYPE varchar(255)')
    expect(migration).toContain('IF EXISTS (SELECT 1 FROM public.automation_rules LIMIT 1)')
    expect(migration).toContain('a separately reviewed deterministic backfill')
    expect(migration).toContain('ADD COLUMN organization_id varchar(255) NOT NULL')
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_automation_rules_org')
    expect(migration).toContain('reverse_sql=migrations.RunSQL.noop')
  })

  it('keeps every Drizzle ownership declaration on varchar organization_id', () => {
    const schemaPaths = [
      'apps/union-eyes/db/schema/automation-rules-schema.ts',
      'apps/union-eyes/db/schema/domains/infrastructure/automation.ts',
      'apps/union-eyes/db/schema/recognition-rewards-schema.ts',
      'apps/union-eyes/db/schema/domains/infrastructure/rewards.ts',
    ]

    for (const schemaPath of schemaPaths) {
      const schema = read(schemaPath)
      const declaration = schema.slice(schema.indexOf('export const automationRules'))
      expect(declaration).toMatch(
        /(?:organizationId|orgId): varchar\(["']organization_id["'], \{ length: 255 \}\)\.notNull\(\)/,
      )
      expect(declaration.split('export const automationRulesRelations')[0]).not.toMatch(
        /orgId: uuid\(["']org_id["']\)/,
      )
    }
  })

  it('uses text tenant comparison for the Round 59 geometry correction', () => {
    const round59 = read('apps/union-eyes/scripts/apply-round59-rls-geometry-gap-closure.ts')

    expect(round59).toContain("table: 'automation_rules', column: 'organization_id', isText: true")
  })

  it('compiles both production-only Python heredocs extracted from the workflow', () => {
    const workflow = load(read(authorityWorkflowPath)) as any
    const steps = [
      [
        'apply-authority-schema-prerequisites',
        'Apply and verify required Django schema prerequisites (fail-closed)',
      ],
      ['apply-automation-rules-ownership-migration', 'Apply core migration 0003 (fail-closed)'],
    ] as const

    for (const [jobName, stepName] of steps) {
      const step = workflow.jobs[jobName].steps.find(
        (candidate: { name?: string }) => candidate.name === stepName,
      )
      expect(step, stepName).toBeDefined()

      const python = extractPythonHeredoc(step.run, stepName)
      const result = spawnSync(
        'python3',
        ['-c', 'import sys; compile(sys.stdin.read(), "<workflow-heredoc>", "exec")'],
        { input: python, encoding: 'utf8' },
      )
      expect(result.error, `${stepName} compiler launch`).toBeUndefined()
      expect(result.status, `${stepName}\n${result.stderr}`).toBe(0)
    }
  })

  it('proves the complete success-only authority rollout DAG structurally', () => {
    const workflow = load(read(authorityWorkflowPath)) as any
    const chain = [
      'apply-authority-schema-prerequisites',
      'apply-automation-rules-ownership-migration',
      'apply-rls-foundation-migration',
      'apply-authority-enforcement-migration',
      'apply-round58-grant-fix-migration',
      'apply-round59-geometry-gap-closure',
    ] as const

    expect(workflow.on.workflow_dispatch.inputs.operation).toMatchObject({
      type: 'string',
      required: true,
    })
    expect(workflow.on.workflow_dispatch.inputs.authorized_sha).toMatchObject({
      type: 'string',
      required: true,
    })

    for (const [index, jobName] of chain.entries()) {
      const job = workflow.jobs[jobName]
      expect(job.environment).toBe('production')

      if (index === 0) {
        expect(job.needs).toBe('preflight')
      } else {
        const previousJob = chain[index - 1]
        expect(job.needs).toBe(previousJob)
        expect(job.if).toContain(`needs.${previousJob}.result == 'success'`)
        expect(job.if).not.toContain(`${previousJob}.result == 'skipped'`)
      }
    }

    const prerequisiteStep = workflow.jobs['apply-authority-schema-prerequisites'].steps.find(
      (step: { name?: string }) => step.name?.startsWith('Apply and verify required Django'),
    )
    expect(prerequisiteStep.run).toContain('"0003_rename_clerk_organization_id"')
    expect(prerequisiteStep.run).toContain('"0003_pilotapplications_commercial_terms"')
    expect(prerequisiteStep.run).toContain('0002_pilotapplications_verified_organization')
    expect(prerequisiteStep.run).toContain('verified_organization_id')

    expect(workflow.jobs['post-mutation-attestation'].needs).toBe(
      'apply-round59-geometry-gap-closure',
    )
    for (const forbiddenJob of ['build-push', 'apply-django-migrations', 'deploy']) {
      expect(workflow.jobs[forbiddenJob]).toBeUndefined()
    }
  })
})
