import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Union Eyes automation_rules ownership correction', () => {
  it('fails closed instead of inventing ownership for existing rows', () => {
    const migration = read(
      'apps/union-eyes/backend/core/migrations/0003_automation_rules_organization_id.py',
    )

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

  it('keeps rollout opt-in and dependency ordered', () => {
    const workflow = read('.github/workflows/deploy-union-eyes.yml')

    expect(workflow).toMatch(/apply_automation_rules_ownership_migration:[\s\S]*?default: false/)
    expect(workflow).toMatch(/apply_round59_geometry_gap_closure:[\s\S]*?default: false/)
    expect(workflow).toContain('needs: [plan, apply-automation-rules-ownership-migration]')
    expect(workflow).toContain('needs: [plan, apply-rls-foundation-migration]')
    expect(workflow).toContain('needs: [plan, apply-authority-enforcement-migration]')
    expect(workflow).toContain('needs: [plan, apply-round58-grant-fix-migration]')
  })
})
