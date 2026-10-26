/**
 * schema-retire-declaration: the three Drizzle declarations are gone.
 * The census file still names them. The physical relations are not dropped.
 * Django still defines the two signature tables.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import * as schema from '../schema'

const APP = path.resolve(__dirname, '../..')
const RETIRED = ['org_usage', 'signature_templates', 'signature_webhooks_log'] as const
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

function rel(file: string): string {
  return path.relative(APP, file).split(path.sep).join('/')
}

describe('schema-retire-declaration', () => {
  it('removes the three Drizzle declarations and leaves the census rows', () => {
    const declared = new Set<string>()
    for (const value of Object.values(schema as Record<string, unknown>)) {
      if (!is(value, PgTable)) continue
      const config = getTableConfig(value)
      const qualified = config.schema && config.schema !== 'public' ? `${config.schema}.${config.name}` : config.name
      declared.add(qualified)
    }
    for (const table of RETIRED) expect(declared.has(table)).toBe(false)

    const census = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-census.json'), 'utf8')).entries as { table: string }[]
    const disposition = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-disposition.json'), 'utf8')).entries as Record<string, { disposition: string }>
    for (const table of RETIRED) {
      expect(census.some((entry) => entry.table === table)).toBe(true)
      expect(disposition[table].disposition).toBe('RETIRE_DECLARATION')
    }
  })

  it('has no remaining pgTable for the three relations and no platform DROP', () => {
    const hits: string[] = []
    for (const file of walk(APP)) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
      const text = readFileSync(file, 'utf8')
      if (/pgTable\(\s*["'`](org_usage|signature_templates|signature_webhooks_log)["'`]/.test(text)) hits.push(rel(file))
    }
    expect(hits).toEqual([])

    const platform = path.join(APP, 'db/migrations-platform')
    const drops: string[] = []
    for (const file of walk(platform)) {
      if (!file.endsWith('.sql')) continue
      const text = readFileSync(file, 'utf8')
      if (/DROP TABLE[^;]*(org_usage|signature_templates|signature_webhooks_log)/i.test(text)) drops.push(rel(file))
    }
    expect(drops).toEqual([])
  })

  it('keeps Django ownership of the signature tables and finds no production reader', () => {
    const models = readFileSync(path.join(APP, 'backend/content/models.py'), 'utf8')
    expect(models).toContain('db_table = "signature_templates"')
    expect(models).toContain('db_table = "signature_webhooks_log"')
    const urls = readFileSync(path.join(APP, 'backend/content/urls.py'), 'utf8')
    expect(urls).toContain("router.register(r'signature-templates', views.SignatureTemplatesViewSet)")
    expect(urls).toContain("router.register(r'signature-webhooks-log', views.SignatureWebhooksLogViewSet)")

    const documents = readFileSync(path.join(APP, 'db/schema/domains/documents/signatures.ts'), 'utf8')
    expect(documents).toContain('templateId: uuid("template_id")')
    expect(documents).not.toContain('signatureTemplates')

    const readers: string[] = []
    for (const file of walk(APP)) {
      if (!/\.(?:ts|tsx|js|mjs|py)$/.test(file)) continue
      const name = rel(file)
      if (name.includes('/__tests__/') || /\.test\.(?:ts|tsx)$/.test(name) || /\.spec\.(?:ts|tsx)$/.test(name)) continue
      if (name.startsWith('db/schema') || name.startsWith('db/migrations') || name.startsWith('db/rls-') || name.startsWith('scripts/') || name.startsWith('backend/') || name === 'db/schema-organizations.ts') continue
      const text = readFileSync(file, 'utf8')
      if (/\borgUsage\b|\bsignatureTemplates\b|\bsignatureWebhooksLog\b|['"`](?:org_usage|signature_templates|signature_webhooks_log)['"`]/.test(text)) {
        readers.push(name)
      }
    }
    expect(readers).toEqual([])
  })
})
