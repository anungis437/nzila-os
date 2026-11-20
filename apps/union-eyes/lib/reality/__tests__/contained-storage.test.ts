import { afterEach, describe, expect, it, vi } from 'vitest'
import decisions from '../../operations/catalog-v2-decisions.json'
import { CONTAINED_STORAGE_REASONS, ContainedStorageUnavailable, requireContainedStorageAuthority, type ContainedStorage } from '../contained-storage'

const storages = Object.keys(CONTAINED_STORAGE_REASONS) as ContainedStorage[]

describe('contained storage boundary', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('refuses every contained relation 501 NOT_IMPLEMENTED with its reason in a canonical deployment', () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    for (const storage of storages) {
      let refusal: unknown
      try { requireContainedStorageAuthority(storage) } catch (error) { refusal = error }
      expect(refusal).toBeInstanceOf(ContainedStorageUnavailable)
      expect(refusal).toMatchObject({ status: 501, code: 'NOT_IMPLEMENTED', storage, message: CONTAINED_STORAGE_REASONS[storage] })
    }
  })

  it('covers relations the compiled canonical source contains with no runtime or system grant', () => {
    expect(storages.sort()).toEqual(['employer_remittances', 'payments', 'per_capita_remittances', 'signature_audit_trail'])
    for (const storage of storages)
      expect((decisions as { entries: { table: string }[] }).entries.find((entry) => entry.table === storage), storage)
        .toMatchObject({ classification: 'CONTAINED_NO_AUTHORITY', runtime: [], system: [] })
  })

  it('leaves the legacy lineage, whose historical catalog still grants them, unchanged', () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    for (const storage of storages) expect(() => requireContainedStorageAuthority(storage)).not.toThrow()
  })
})
