import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  coraFarmer360Assertions,
  coraFarmer360ContextVersions,
  coraFarmer360Profiles,
} from '../schema/cora-farmer360'

describe('Cora Farmer 360 schema', () => {
  it('uses Cora-owned profile, versioned context, and assertion tables', () => {
    expect(getTableConfig(coraFarmer360Profiles).name).toBe('cora_farmer360_profiles')
    expect(getTableConfig(coraFarmer360ContextVersions).name).toBe(
      'cora_farmer360_context_versions',
    )
    expect(getTableConfig(coraFarmer360Assertions).name).toBe('cora_farmer360_assertions')
  })

  it('scopes context and assertions to the profile organization and exact evidence hash', () => {
    const profiles = getTableConfig(coraFarmer360Profiles)
    const contexts = getTableConfig(coraFarmer360ContextVersions)
    const assertions = getTableConfig(coraFarmer360Assertions)
    expect(
      profiles.indexes.some(
        (index) => index.config.name === 'cora_farmer360_profiles_subject_uidx',
      ),
    ).toBe(true)
    expect(contexts.foreignKeys).toHaveLength(1)
    expect(assertions.foreignKeys).toHaveLength(2)
    expect(assertions.checks).toHaveLength(2)
  })

  it('ships append-only history guards in the unapplied migration artifact', () => {
    const migration = readFileSync(
      fileURLToPath(new URL('../../drizzle/0040_cora_farmer360.sql', import.meta.url)),
      'utf8',
    )
    expect(migration).toContain('cora_farmer360_context_versions_immutable')
    expect(migration).toContain('cora_farmer360_assertions_immutable')
    expect(migration).toContain('BEFORE UPDATE OR DELETE')
  })
})
