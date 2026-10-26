/**
 * schema-live-unreferenced: five union-eyes declarations are gone.
 * Eight stay because a kept declaration or a production SQL reader names them.
 * The census file still names every relation. No platform migration drops one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import * as schema from '../schema'

const APP = path.resolve(__dirname, '../..')
const REMOVED = ['bank_accounts', 'bank_reconciliations', 'clc_remittance_mapping', 'erp_invoices', 'grievance_timeline'] as const
const RETAINED = ['budget_pool', 'dues_rates', 'gl_account_mappings', 'grievance_settlements', 'integration_webhooks', 'payment_cycles', 'payment_disputes', 'safety_training_records'] as const
const REGISTER = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register')

function walk(dir: string, out: string[] = []): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue
    const full = path.join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

describe('schema-live-unreferenced', () => {
  it('removes only the five declarations that no kept reader names', () => {
    const declared = new Set<string>()
    for (const value of Object.values(schema as Record<string, unknown>)) {
      if (!is(value, PgTable)) continue
      const config = getTableConfig(value)
      const qualified = config.schema && config.schema !== 'public' ? `${config.schema}.${config.name}` : config.name
      declared.add(qualified)
    }
    for (const table of REMOVED) expect(declared.has(table)).toBe(false)
    for (const table of RETAINED) expect(declared.has(table)).toBe(true)

    const census = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-census.json'), 'utf8')).entries as { table: string }[]
    for (const table of [...REMOVED, ...RETAINED]) {
      expect(census.some((entry) => entry.table === table)).toBe(true)
    }
  })

  it('leaves Django models and does not drop the relations', () => {
    const billing = readFileSync(path.join(APP, 'backend/billing/models.py'), 'utf8')
    const grievances = readFileSync(path.join(APP, 'backend/grievances/models.py'), 'utf8')
    for (const table of ['bank_accounts', 'bank_reconciliations', 'clc_remittance_mapping', 'erp_invoices']) {
      expect(billing).toContain(`db_table = '${table}'`)
    }
    expect(grievances).toContain('db_table = "grievance_timeline"')

    const platform = path.join(APP, 'db/migrations-platform')
    const drops: string[] = []
    for (const file of walk(platform)) {
      if (!file.endsWith('.sql')) continue
      const text = readFileSync(file, 'utf8')
      if (/DROP TABLE[^;]*(bank_accounts|bank_reconciliations|clc_remittance_mapping|erp_invoices|grievance_timeline)/i.test(text)) {
        drops.push(path.relative(APP, file))
      }
    }
    expect(drops).toEqual([])
  })

  it('keeps the console erp_invoices declaration outside this barrel', () => {
    const execData = readFileSync(path.resolve(APP, '../../packages/db/src/schema/exec-data.ts'), 'utf8')
    expect(execData).toContain("pgTable('erp_invoices'")
  })
})
