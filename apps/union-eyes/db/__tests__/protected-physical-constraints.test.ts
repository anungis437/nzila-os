/**
 * Declaration retirement must not authorize a schema diff to drop a physical
 * foreign key that PostgreSQL already has.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertNoProtectedConstraintDrop,
  PROTECTED_PHYSICAL_CONSTRAINTS,
} from '../../scripts/lib/protected-physical-constraints'

const APP = path.resolve(__dirname, '../..')

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

describe('protected physical constraints', () => {
  it('rejects a diff that drops signature_documents.template_id', () => {
    const sql = 'ALTER TABLE "signature_documents" DROP CONSTRAINT "signature_documents_template_id_signature_templates_id_fk";'
    expect(() => assertNoProtectedConstraintDrop(sql)).toThrow(/must not be dropped/)
    expect(() => assertNoProtectedConstraintDrop('ALTER TABLE "signature_documents" ADD COLUMN "note" text;')).not.toThrow()
  })

  it('keeps the column in the declaration and the constraint out of platform SQL', () => {
    const signatures = readFileSync(path.join(APP, 'db/schema/domains/documents/signatures.ts'), 'utf8')
    expect(signatures).toContain('templateId: uuid("template_id")')
    expect(signatures).not.toContain('.references(() => signatureTemplates.id)')
    const platform = path.join(APP, 'db/migrations-platform')
    const drops: string[] = []
    for (const file of walk(platform)) {
      if (!file.endsWith('.sql')) continue
      const text = readFileSync(file, 'utf8')
      for (const item of PROTECTED_PHYSICAL_CONSTRAINTS) {
        if (new RegExp(`drop\\s+constraint(?:\\s+if\\s+exists)?\\s+"?${item.name}"?`, 'i').test(text)) {
          drops.push(path.relative(APP, file))
        }
      }
    }
    expect(drops).toEqual([])
  })
})
