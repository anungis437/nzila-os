import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LocalInstitutionalStore } from './local-store'

describe('Checkpoint 3 Gate B ephemeral persistence', () => {
  it('preserves revisions across restart, scopes identical IDs and rejects stale writes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nzila-cp3-'))
    const file = join(dir, 'fixture.sqlite')
    const scope = { type: 'PLATFORM_INSTITUTION', id: 'fictional-I' } as const
    const other = { ...scope, id: 'fictional-other' }
    let store = new LocalInstitutionalStore(file)
    try {
      store.transaction(() => store.append(scope, 'Mission', 'M', 0, { status: 'proposed' }))
      store.close()
      store = new LocalInstitutionalStore(file)
      expect(store.get(scope, 'Mission', 'M')?.version).toBe(1)
      expect(store.get(other, 'Mission', 'M')).toBeUndefined()
      expect(() => store.transaction(() => store.append(scope, 'Mission', 'M', 0, {}))).toThrow('CONFLICT')
      store.transaction(() => store.append(scope, 'Mission', 'M', 1, { status: 'authorized' }))
      expect(store.get(scope, 'Mission', 'M', 1)?.data).toEqual({ status: 'proposed' })
    } finally {
      store.close()
      rmSync(dir, { recursive: true })
    }
  })

  it('rolls back the complete transaction on failure and does not allow out-of-transaction writes', () => {
    const store = new LocalInstitutionalStore(':memory:')
    const scope = { type: 'SYSTEM', id: 'fixture-maintenance' } as const
    try {
      expect(() => store.append(scope, 'Binding', 'I', 0, {})).toThrow('TRANSACTION_REQUIRED')
      expect(() => store.transaction(() => {
        store.append(scope, 'Binding', 'I', 0, {})
        throw new Error('fixture failure')
      })).toThrow('fixture failure')
      expect(store.get(scope, 'Binding', 'I')).toBeUndefined()
    } finally {
      store.close()
    }
  })
})
