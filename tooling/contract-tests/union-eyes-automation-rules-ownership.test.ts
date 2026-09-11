import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Union Eyes automation_rules ownership correction', () => {
  it('fails closed instead of inventing ownership for existing rows', () => {
    const migration = read(
      'apps/union-eyes/backend/core/migrations/0003_automation_rules_organization_id.py',
    )

    expect(migration).toContain("IF to_regclass('public.automation_rules') IS NULL")
    expect(migration).toContain("column_name = 'org_id'")
    expect(migration).toContain('legacy org_id-only ownership geometry')
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

  it('proves the complete success-only authority rollout DAG structurally', () => {
    const workflow = load(read('.github/workflows/deploy-union-eyes.yml')) as any
    const chain = [
      ['apply-authority-schema-prerequisites', 'apply_authority_schema_prerequisites'],
      ['apply-automation-rules-ownership-migration', 'apply_automation_rules_ownership_migration'],
      ['apply-rls-foundation-migration', 'apply_rls_foundation_migration'],
      ['apply-authority-enforcement-migration', 'apply_authority_enforcement_migration'],
      ['apply-round58-grant-fix-migration', 'apply_round58_grant_fix_migration'],
      ['apply-round59-geometry-gap-closure', 'apply_round59_geometry_gap_closure'],
    ] as const

    for (const [index, [jobName, inputName]] of chain.entries()) {
      const input = workflow.on.workflow_dispatch.inputs[inputName]
      const job = workflow.jobs[jobName]
      expect(input, `${inputName} input`).toMatchObject({ type: 'boolean', default: false })
      expect(job.if).toContain("github.event_name == 'workflow_dispatch'")
      expect(job.if).toContain(`github.event.inputs.${inputName} == 'true'`)

      if (index === 0) {
        expect(job.needs).toBe('plan')
      } else {
        const previousJob = chain[index - 1][0]
        expect(job.needs).toEqual(['plan', previousJob])
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

    const oneTimeJobs = new Set(chain.map(([jobName]) => jobName))
    for (const ordinaryJobName of ['pre-deploy-gates', 'build-push', 'apply-django-migrations', 'deploy']) {
      const ordinaryNeeds = workflow.jobs[ordinaryJobName].needs
      const needs = Array.isArray(ordinaryNeeds) ? ordinaryNeeds : [ordinaryNeeds]
      expect(needs.some((dependency: string) => oneTimeJobs.has(dependency))).toBe(false)
    }
  })
})
