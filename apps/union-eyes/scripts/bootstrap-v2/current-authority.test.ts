import { describe, expect, it } from 'vitest'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import { reconcileCurrentAuthority } from './current-authority'
import type { CurrentModel } from './source'
import { PLATFORM_METADATA_MODEL_OWNERS } from './framework-contract'

const model: CurrentModel = {
  table: 'evidence_packs',
  app: 'evidence_pack',
  model: 'EvidencePack',
  source: 'apps/union-eyes/backend/services/evidence_pack/models.py',
  sourceDigest: 'synthetic-source-digest',
  columns: [],
  uniqueTogether: [],
  constraints: [],
}

describe('current evidence capability authority', () => {
  it('adds the current builder save/seal operation without rewriting the legacy registry', () => {
    const prior = storageAuthorityManifest.find((entry) => entry.table === 'evidence_packs')!
    const before = JSON.stringify(prior)
    const current = reconcileCurrentAuthority(model, prior)!
    expect(current.requiredRuntimePrivileges).toEqual(['SELECT', 'INSERT', 'UPDATE'])
    expect(current.requiredSystemPrivileges).toEqual(prior.requiredSystemPrivileges)
    expect(current.classification).toBe('TENANT_RLS_REQUIRED')
    expect(JSON.stringify(prior)).toBe(before)
  })

  it('requires source-owned tenant and parent contracts instead of inventing global authority', () => {
    expect(() => reconcileCurrentAuthority(model, null)).toThrow(
      'UE_V2_EVIDENCE_PACK_TENANT_AUTHORITY_REQUIRED',
    )
    expect(() => reconcileCurrentAuthority({ ...model, source: 'unrelated-owner' }, null)).toThrow(
      'UE_V2_EVIDENCE_OWNER_REQUIRED',
    )
    expect(() =>
      reconcileCurrentAuthority({ ...model, table: 'evidence_artifacts' }, null),
    ).toThrow('UE_V2_EVIDENCE_ARTIFACT_PARENT_REQUIRED')
  })

  it('does not change unrelated authority', () => {
    expect(reconcileCurrentAuthority({ ...model, table: 'other_table' }, null)).toBeNull()
  })

  it.each(Object.entries(PLATFORM_METADATA_MODEL_OWNERS))(
    'restricts %s to live private platform metadata without legacy-system grants',
    (table, source) => {
      const current: CurrentModel = { ...model, table, source }
      const authority = reconcileCurrentAuthority(current, null)!
      expect(authority.classification).toBe('SYSTEM_ONLY')
      expect(authority.requiredRuntimePrivileges).toEqual([])
      expect(authority.requiredSystemPrivileges).toEqual([])
      expect(authority.reason).toContain('live canonical bearer')
      expect(() =>
        reconcileCurrentAuthority({ ...current, source: 'unrelated-owner' }, null),
      ).toThrow(`UE_V2_PLATFORM_METADATA_SOURCE_REQUIRED:${table}`)
    },
  )

  it('reconciles current donation metadata without merging the financial boundary', () => {
    const prior = storageAuthorityManifest.find((entry) => entry.table === 'donations')!
    const before = JSON.stringify(prior)
    const donation: CurrentModel = {
      ...model,
      table: 'donations',
      source: 'apps/union-eyes/backend/billing/models.py',
      columns: [
        {
          name: 'organization_id',
          type: 'uuid',
          notNull: true,
          primaryKey: false,
          unique: false,
          index: true,
          hasClientDefault: false,
          clientDefault: null,
          choices: [],
          foreignKey: {
            table: 'organizations',
            column: 'id',
            onDelete: 'CASCADE',
            databaseSemantics: 'DEFERRED_NO_ACTION',
          },
        },
      ],
    }
    const authority = reconcileCurrentAuthority(donation, prior)!
    expect(authority.classification).toBe('TENANT_RLS_REQUIRED')
    expect(authority.requiredRuntimePrivileges).toEqual(['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
    expect(authority.requiredSystemPrivileges).toEqual([])
    expect(authority.reason).toContain('does not merge')
    expect(JSON.stringify(prior)).toBe(before)
    for (const invalid of [
      { ...donation, source: 'unrelated-owner' },
      { ...donation, columns: [] },
      {
        ...donation,
        columns: [{ ...donation.columns[0], notNull: false }],
      },
      {
        ...donation,
        columns: [{ ...donation.columns[0], foreignKey: null }],
      },
    ])
      expect(() => reconcileCurrentAuthority(invalid, prior)).toThrow(
        'UE_V2_DONATION_METADATA_ORGANIZATION_SOURCE_REQUIRED',
      )
  })

  it.each(['users', 'oauth_providers'])(
    'qualifies %s only as source-owned self metadata, never canonical auth authority',
    (table) => {
      const legacy: CurrentModel = {
        ...model,
        table,
        source: 'apps/union-eyes/backend/auth_core/models.py',
        columns: [
          {
            name: 'user_id',
            type: 'varchar(255)',
            notNull: false,
            primaryKey: false,
            unique: false,
            index: false,
            hasClientDefault: false,
            clientDefault: null,
            choices: [],
            foreignKey: null,
          },
        ],
      }
      const authority = reconcileCurrentAuthority(legacy, null)!
      expect(authority.classification).toBe('USER_RLS_REQUIRED')
      expect(authority.requiredRuntimePrivileges).toEqual(['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      expect(authority.requiredSystemPrivileges).toEqual([])
      expect(authority.reason).toContain('not canonical identity')
      expect(() => reconcileCurrentAuthority({ ...legacy, columns: [] }, null)).toThrow(
        'UE_V2_LEGACY_SELF_METADATA_SOURCE_REQUIRED',
      )
      expect(() =>
        reconcileCurrentAuthority({ ...legacy, source: 'unrelated-owner' }, null),
      ).toThrow('UE_V2_LEGACY_SELF_METADATA_SOURCE_REQUIRED')
    },
  )
})
