import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrationsDir = join(__dirname, '..')
const migration = readFileSync(join(migrationsDir, '0082_platform_staff_mandate_kind.sql'), 'utf8')
const rollback = readFileSync(join(migrationsDir, '0082_platform_staff_mandate_kind.rollback.sql'), 'utf8')

let db: PGlite

beforeEach(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE TABLE public.ue_authority_mandates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind text NOT NULL,
      CONSTRAINT ue_authority_mandates_kind_chk CHECK (kind IN ('supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access'))
    );
    CREATE TABLE public.ue_authority_issuance_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      domain text NOT NULL,
      CONSTRAINT ue_authority_rule_domain_chk CHECK (domain IN ('supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access', 'delegation', 'case_assignment', 'recusal'))
    );
  `)
})

afterEach(async () => {
  await db.close()
})

describe('migration 0082: platform_staff mandate kind (DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ, DEF-0B10-OPL-14)', () => {
  it('widens both CHECK constraints additively: every original kind/domain stays accepted, platform_staff becomes accepted, anything else stays refused', async () => {
    await db.exec(migration)
    for (const kind of ['supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access', 'platform_staff']) {
      await expect(db.query(`INSERT INTO ue_authority_mandates (kind) VALUES ($1)`, [kind])).resolves.toBeDefined()
    }
    for (const domain of ['supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access', 'platform_staff', 'delegation', 'case_assignment', 'recusal']) {
      await expect(db.query(`INSERT INTO ue_authority_issuance_rules (domain) VALUES ($1)`, [domain])).resolves.toBeDefined()
    }
    await expect(db.query(`INSERT INTO ue_authority_mandates (kind) VALUES ('bogus')`)).rejects.toThrow(/ue_authority_mandates_kind_chk/)
    await expect(db.query(`INSERT INTO ue_authority_issuance_rules (domain) VALUES ('bogus')`)).rejects.toThrow(/ue_authority_rule_domain_chk/)
  })

  it('rollback refuses while a platform_staff mandate or issuance rule exists, and succeeds once removed', async () => {
    await db.exec(migration)
    await db.query(`INSERT INTO ue_authority_mandates (kind) VALUES ('platform_staff')`)
    await expect(db.exec(rollback)).rejects.toThrow(/ue_authority_mandates holds a platform_staff row/)

    await db.query(`DELETE FROM ue_authority_mandates WHERE kind = 'platform_staff'`)
    await db.query(`INSERT INTO ue_authority_issuance_rules (domain) VALUES ('platform_staff')`)
    await expect(db.exec(rollback)).rejects.toThrow(/ue_authority_issuance_rules holds a platform_staff row/)

    await db.query(`DELETE FROM ue_authority_issuance_rules WHERE domain = 'platform_staff'`)
    await db.exec(rollback)
    await expect(db.query(`INSERT INTO ue_authority_mandates (kind) VALUES ('platform_staff')`)).rejects.toThrow(/ue_authority_mandates_kind_chk/)
    await expect(db.query(`INSERT INTO ue_authority_issuance_rules (domain) VALUES ('platform_staff')`)).rejects.toThrow(/ue_authority_rule_domain_chk/)
  })
})
