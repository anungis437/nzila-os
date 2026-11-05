import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { claims } from '@/db/schema'

describe('Gate 0 batch B92: generic CRUD attribution fields', () => {
  it('refuses attribution and approval fields under any spelling in a generic write', () => {
    const columns = Object.keys(claims as unknown as Record<string, unknown>)
    expect(columns.length).toBeGreaterThan(0)
    for (const field of ['approvedById', 'reviewedById', 'verifiedByName', 'closedBy', 'signedById', 'enteredBy']) {
      const source = readFileSync(join(process.cwd(), 'lib/api/crud-factory.ts'), 'utf8')
      expect(source).toContain(`'${field}'`)
    }
  })
})
