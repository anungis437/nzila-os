import { describe, expect, it } from 'vitest'
import { storageAuthorityManifest } from '@/db/rls-storage-authority'
import contract from './catalog-authority-contract.json'
import { catalogContractDigest, privilegesInOrder } from './catalog-admission-core.mjs'

describe('packaged catalog authority contract', () => {
  it('keeps the digest bound to the payload', () => {
    expect(catalogContractDigest(contract.payload)).toBe(contract.digest)
    expect(contract.payload.entries.length).toBeGreaterThanOrEqual(100)
  })

  it('never packages member-writable global location tracking policy', () => {
    const location = contract.payload.entries.find((entry) => entry.table === 'location_tracking_config')
    const canonical = storageAuthorityManifest.find((entry) => entry.table === 'location_tracking_config')
    expect(location?.classification).toBe('GLOBAL_REFERENCE_DATA')
    expect(location?.runtime).toEqual(['SELECT'])
    expect(location?.system).toEqual([])
    expect(canonical?.requiredRuntimePrivileges).toEqual(['SELECT'])
    expect(canonical?.requiredSystemPrivileges).toEqual([])
  })

  it('matches the reviewed storage-authority source', () => {
    const packaged = new Map(contract.payload.entries.map((entry) => [entry.table, entry]))
    expect(packaged.size).toBe(storageAuthorityManifest.length)
    for (const entry of storageAuthorityManifest) {
      const row = packaged.get(entry.table)
      expect(row?.classification, entry.table).toBe(entry.classification)
      expect(row?.runtime, entry.table).toEqual(privilegesInOrder(entry.requiredRuntimePrivileges))
      expect(row?.system, entry.table).toEqual(privilegesInOrder(entry.requiredSystemPrivileges))
    }
  })
})
