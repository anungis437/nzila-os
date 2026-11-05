import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('S9 contact submissions store (platform 0045, cache 0036)', () => {
  it('the route stores under the system role before the CRM and acknowledges only a stored submission', () => {
    const route = read('app/api/contact/route.ts')
    expect(route).toContain('withSystemContext')
    expect(route.indexOf('.insert(contactSubmissions)')).toBeLessThan(route.indexOf('upsertContact({'))
    expect(route).toContain('status: 503')
  })

  it('classifies the table as system-only with no runtime privilege', () => {
    const manifest = read('db/rls-storage-authority/communications-notifications.ts')
    const block = manifest.slice(manifest.indexOf('table: "contact_submissions"'))
    expect(block).toContain('classification: "SYSTEM_ONLY"')
    expect(block.slice(0, block.indexOf('reviewPriority'))).toContain('requiredRuntimePrivileges: []')
    expect(read('db/migrations-cache/0036_contact_submissions_rls_closure.sql')).toContain('FOR ALL TO union_eyes_system')
    expect(read('db/migrations-cache/0036_contact_submissions_rls_closure.sql')).not.toContain('union_eyes_runtime')
  })
})
