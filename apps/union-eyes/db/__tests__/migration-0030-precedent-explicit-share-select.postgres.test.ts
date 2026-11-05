/**
 * Native PostgreSQL qualification of cache migration 0030_precedent_explicit_share_select.
 *
 * Part one, on a disposable database holding the PRECEDING shape (arbitration_precedents with only the owner-only policies
 * that 0012 installs through 0010's ue_create_direct_org_rls_policy('arbitration_precedents', 'source_organization_id')):
 * the defect is reproduced (a precedent shared with another organization is invisible to it), the migration is applied, and
 * the runtime role is proven to read exactly what the migration admits — an explicit grant or sharing_level = 'public' —
 * and nothing else: federation and congress stay owner-only, a revoked grant stops at once, a missing, empty or malformed
 * app.current_org_id never raises or matches, and INSERT, UPDATE and DELETE stay owner-only. The migration is proven to be
 * idempotent and atomic, to fail closed on each checkable precondition without touching existing policy, and its rollback is
 * proven to remove only the shared-read policy. Part two checks the combined database built by Django migrate plus the
 * approved Drizzle bootstrap, which applied it for real; it only reads catalog state there.
 *
 * Needs UE_AUTHORITY_COMBINED_URL (see apps/union-eyes/db/__tests__/README.md); skipped when it is not set. The disposable
 * databases are created and dropped on the same server and never touch the combined database's data. The union_eyes_runtime
 * precondition is not exercised: the role is cluster-wide, and removing it would break the combined database.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const dir = join(__dirname, '..', 'migrations-cache')
const up = readFileSync(join(dir, '0030_precedent_explicit_share_select.sql'), 'utf8')
const down = readFileSync(join(dir, '0030_precedent_explicit_share_select.rollback.sql'), 'utf8')

const SHARED = 'ue_precedent_shared_select'
const OWNER_POLICIES = ['ue_org_isolation_delete', 'ue_org_isolation_insert', 'ue_org_isolation_select', 'ue_org_isolation_update', 'ue_system_full_access']

// The columns the policies and the 0030 guard read, with the real types from db/schema/arbitration-precedents-schema.ts,
// and the five policies 0010's ue_create_direct_org_rls_policy creates for a uuid organization column, verbatim.
const PRECEDING = `
  CREATE TABLE public.arbitration_precedents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_organization_id uuid NOT NULL,
    case_title varchar(500) NOT NULL,
    sharing_level varchar(50) NOT NULL DEFAULT 'federation',
    shared_with_org_ids uuid[],
    created_by varchar(255) NOT NULL
  );
  ALTER TABLE arbitration_precedents ENABLE ROW LEVEL SECURITY;
  ALTER TABLE arbitration_precedents FORCE ROW LEVEL SECURITY;
  CREATE POLICY ue_org_isolation_select ON arbitration_precedents FOR SELECT TO union_eyes_runtime
    USING (source_organization_id::text = current_setting('app.current_org_id', true));
  CREATE POLICY ue_org_isolation_insert ON arbitration_precedents FOR INSERT TO union_eyes_runtime
    WITH CHECK (source_organization_id::text = current_setting('app.current_org_id', true));
  CREATE POLICY ue_org_isolation_update ON arbitration_precedents FOR UPDATE TO union_eyes_runtime
    USING (source_organization_id::text = current_setting('app.current_org_id', true))
    WITH CHECK (source_organization_id::text = current_setting('app.current_org_id', true));
  CREATE POLICY ue_org_isolation_delete ON arbitration_precedents FOR DELETE TO union_eyes_runtime
    USING (source_organization_id::text = current_setting('app.current_org_id', true));
  CREATE POLICY ue_system_full_access ON arbitration_precedents FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.arbitration_precedents TO union_eyes_runtime, union_eyes_system;
`

const withDb = (url: string, name: string) => {
  const u = new globalThis.URL(url)
  u.pathname = `/${name}`
  return u.toString()
}

const scratchName = () => `m0030_${randomUUID().replace(/-/g, '').slice(0, 12)}`

const policies = async (c: pg.Client) =>
  (await c.query(`SELECT policyname, cmd, permissive, roles::text[] AS roles, qual FROM pg_policies WHERE schemaname='public' AND tablename='arbitration_precedents' ORDER BY policyname`)).rows as Array<{ policyname: string; cmd: string; permissive: string; roles: string[]; qual: string | null }>

const policyNames = async (c: pg.Client) => (await policies(c)).map((p) => p.policyname)

/** Run `fn` as union_eyes_runtime (or another role) with app.current_org_id set as given; undefined leaves it unset. */
const asRole = async <T>(c: pg.Client, role: string, org: string | undefined, fn: () => Promise<T>): Promise<T> => {
  await c.query('BEGIN')
  try {
    await c.query(`SET LOCAL ROLE ${role}`)
    if (org !== undefined) await c.query(`SELECT set_config('app.current_org_id', $1, true)`, [org])
    return await fn()
  } finally {
    await c.query('ROLLBACK')
  }
}

describe.skipIf(!URL_)('migration 0030 on native PostgreSQL', () => {
  const scratch = scratchName()
  const ownerOrg = randomUUID()
  const granteeOrg = randomUUID()
  const otherOrg = randomUUID()
  const ids: Record<string, string> = {}
  let admin: pg.Client
  let db: pg.Client

  const visible = async (org: string | undefined, client: pg.Client = db) =>
    asRole(client, 'union_eyes_runtime', org, async () =>
      (await client.query(`SELECT case_title FROM arbitration_precedents ORDER BY case_title`)).rows.map((r) => r.case_title as string))

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${scratch}`)
    db = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await db.connect()
    await db.query(PRECEDING)
    const rows: Array<[string, string, string, string[] | null]> = [
      ['owner-private', ownerOrg, 'private', null],
      ['owner-granted-to-grantee', ownerOrg, 'private', [granteeOrg]],
      ['owner-public', ownerOrg, 'public', null],
      ['owner-federation', ownerOrg, 'federation', null],
      ['owner-congress', ownerOrg, 'congress', null],
      ['owner-granted-to-other', ownerOrg, 'private', [otherOrg]],
      ['owner-federation-granted-to-grantee', ownerOrg, 'federation', [granteeOrg]],
      ['owner-empty-grant-list', ownerOrg, 'private', []],
      ['grantee-private', granteeOrg, 'private', null],
    ]
    for (const [title, org, level, grants] of rows) {
      ids[title] = (await db.query(
        `INSERT INTO arbitration_precedents (source_organization_id, case_title, sharing_level, shared_with_org_ids, created_by) VALUES ($1, $2, $3, $4::uuid[], 'ue-qa-fixture') RETURNING id`,
        [org, title, level, grants],
      )).rows[0].id
    }
  })

  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.end()
  })

  it('reproduces the defect on the preceding shape: an explicitly shared or public precedent is invisible to the grantee', async () => {
    expect(await policyNames(db)).toEqual(OWNER_POLICIES)
    expect(await visible(granteeOrg)).toEqual(['grantee-private'])
  })

  it('adds exactly one permissive SELECT policy for the runtime role and leaves the owner policies untouched', async () => {
    const before = (await policies(db)).filter((p) => p.policyname !== SHARED)
    await db.query(up)
    const after = await policies(db)
    expect(after.map((p) => p.policyname)).toEqual([...OWNER_POLICIES, SHARED].sort())
    expect(after.filter((p) => p.policyname !== SHARED)).toEqual(before)
    const shared = after.find((p) => p.policyname === SHARED)!
    expect(shared).toMatchObject({ cmd: 'SELECT', permissive: 'PERMISSIVE', roles: ['union_eyes_runtime'] })
    expect(shared.qual).toMatch(/shared_with_org_ids/)
    expect(shared.qual).not.toMatch(/federation|congress/)
  })

  it('lets the grantee read an explicit grant and public precedents, and nothing else of the owner', async () => {
    expect(await visible(granteeOrg)).toEqual(['grantee-private', 'owner-federation-granted-to-grantee', 'owner-granted-to-grantee', 'owner-public'])
  })

  it('keeps federation and congress owner-only unless an explicit grant names the caller', async () => {
    const seen = await visible(otherOrg)
    expect(seen).toEqual(['owner-granted-to-other', 'owner-public'])
    expect(seen).not.toContain('owner-federation')
    expect(seen).not.toContain('owner-congress')
  })

  it('still shows the owner every one of its own precedents', async () => {
    expect(await visible(ownerOrg)).toEqual([
      'owner-congress', 'owner-empty-grant-list', 'owner-federation', 'owner-federation-granted-to-grantee',
      'owner-granted-to-grantee', 'owner-granted-to-other', 'owner-private', 'owner-public',
    ])
  })

  it('never raises or matches a grant on a missing, empty or malformed organization id; only public rows remain', async () => {
    const fresh = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await fresh.connect()
    try {
      expect(await visible(undefined, fresh)).toEqual(['owner-public']) // never set on this session: NULL
    } finally {
      await fresh.end()
    }
    expect(await visible('')).toEqual(['owner-public'])
    expect(await visible('not-a-uuid')).toEqual(['owner-public'])
    expect(await visible(granteeOrg.toUpperCase())).toEqual(['owner-public']) // text comparison: no case folding into a match
    expect(await visible(`${granteeOrg},${otherOrg}`)).toEqual(['owner-public'])
  })

  it('keeps INSERT, UPDATE and DELETE owner-only: reading a shared precedent never implies writing it', async () => {
    const target = ids['owner-granted-to-grantee']
    await asRole(db, 'union_eyes_runtime', granteeOrg, async () => {
      expect((await db.query(`UPDATE arbitration_precedents SET case_title = 'hijacked' WHERE id = $1`, [target])).rowCount).toBe(0)
      expect((await db.query(`UPDATE arbitration_precedents SET shared_with_org_ids = NULL WHERE id = $1`, [ids['owner-public']])).rowCount).toBe(0)
      expect((await db.query(`DELETE FROM arbitration_precedents WHERE id = $1`, [target])).rowCount).toBe(0)
    })
    await expect(asRole(db, 'union_eyes_runtime', granteeOrg, () =>
      db.query(`INSERT INTO arbitration_precedents (source_organization_id, case_title, sharing_level, created_by) VALUES ($1, 'forged', 'public', 'x')`, [ownerOrg]),
    )).rejects.toThrow(/row-level security/)
    await asRole(db, 'union_eyes_runtime', ownerOrg, async () => {
      expect((await db.query(`UPDATE arbitration_precedents SET case_title = case_title WHERE id = $1`, [target])).rowCount).toBe(1)
    })
    expect((await db.query(`SELECT case_title FROM arbitration_precedents WHERE id = $1`, [target])).rows[0].case_title).toBe('owner-granted-to-grantee')
  })

  it('removes access as soon as a grant is revoked, and admits it as soon as one is added', async () => {
    const target = ids['owner-granted-to-grantee']
    await db.query(`UPDATE arbitration_precedents SET shared_with_org_ids = array_remove(shared_with_org_ids, $1::uuid) WHERE id = $2`, [granteeOrg, target])
    expect(await visible(granteeOrg)).not.toContain('owner-granted-to-grantee')
    await db.query(`UPDATE arbitration_precedents SET shared_with_org_ids = array_append(shared_with_org_ids, $1::uuid) WHERE id = $2`, [granteeOrg, target])
    expect(await visible(granteeOrg)).toContain('owner-granted-to-grantee')
  })

  it('leaves the system role full access, as 0010 defined it', async () => {
    const all = await asRole(db, 'union_eyes_system', undefined, async () => (await db.query(`SELECT count(*)::int AS n FROM arbitration_precedents`)).rows[0].n)
    expect(all).toBe(9)
  })

  it('is idempotent: re-applying keeps one shared policy and the same visibility', async () => {
    const before = await visible(granteeOrg)
    await db.query(up)
    await db.query(up)
    expect((await policyNames(db)).filter((n) => n === SHARED)).toHaveLength(1)
    expect(await visible(granteeOrg)).toEqual(before)
  })

  it('rolls back by removing only the shared-read policy: owners keep access, grantees lose it; then re-applies', async () => {
    await db.query(down)
    expect(await policyNames(db)).toEqual(OWNER_POLICIES)
    expect(await visible(granteeOrg)).toEqual(['grantee-private'])
    expect(await visible(ownerOrg)).toHaveLength(8)
    await db.query(down) // the rollback is itself idempotent
    await db.query(up)
    expect(await visible(granteeOrg)).toContain('owner-granted-to-grantee')
  })
})

describe.skipIf(!URL_)('migration 0030 fails closed on native PostgreSQL', () => {
  const scratch = scratchName()
  let admin: pg.Client
  let db: pg.Client
  // A stand-in shared policy that admits nothing. If a failed apply ran any statement after its guard, this would be replaced.
  const SENTINEL = `CREATE POLICY ${SHARED} ON public.arbitration_precedents FOR SELECT TO union_eyes_runtime USING (false)`
  const sharedQual = async () => (await policies(db)).find((p) => p.policyname === SHARED)?.qual ?? null

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${scratch}`)
    db = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await db.connect()
  })

  beforeEach(async () => {
    await db.query('DROP TABLE IF EXISTS public.arbitration_precedents, public.arbitration_precedents_moved CASCADE')
    await db.query(PRECEDING)
    await db.query(SENTINEL)
  })

  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.end()
  })

  it('applies cleanly over the sentinel when every precondition holds (control)', async () => {
    await db.query(up)
    expect(await sharedQual()).toMatch(/shared_with_org_ids/)
  })

  it('fails closed when the table does not exist', async () => {
    await db.query('ALTER TABLE public.arbitration_precedents RENAME TO arbitration_precedents_moved')
    await expect(db.query(up)).rejects.toThrow(/RLS 0030 fail-closed: public.arbitration_precedents does not exist/)
  })

  it('fails closed when shared_with_org_ids is not uuid[], and changes no policy', async () => {
    await db.query(`DROP POLICY ${SHARED} ON public.arbitration_precedents`)
    await db.query('ALTER TABLE public.arbitration_precedents ALTER COLUMN shared_with_org_ids TYPE text[] USING shared_with_org_ids::text[]')
    await db.query(SENTINEL)
    await expect(db.query(up)).rejects.toThrow(/shared_with_org_ids is not uuid\[\]/)
    expect(await sharedQual()).toBe('false')
  })

  it('fails closed when shared_with_org_ids is missing, and changes no policy', async () => {
    await db.query(`DROP POLICY ${SHARED} ON public.arbitration_precedents`)
    await db.query('ALTER TABLE public.arbitration_precedents DROP COLUMN shared_with_org_ids')
    await db.query(SENTINEL)
    await expect(db.query(up)).rejects.toThrow(/shared_with_org_ids is not uuid\[\]/)
    expect(await sharedQual()).toBe('false')
  })

  it('fails closed when the 0012 owner policy is not installed, and changes no policy', async () => {
    await db.query('DROP POLICY ue_org_isolation_select ON public.arbitration_precedents')
    await expect(db.query(up)).rejects.toThrow(/the owner policy \(0012\) is not installed/)
    expect(await sharedQual()).toBe('false')
    expect(await policyNames(db)).not.toContain('ue_org_isolation_select')
  })
})

describe.skipIf(!URL_)('migration 0030 on the combined database', () => {
  it('holds there: the shared-read policy for the runtime role, the owner policies, forced RLS and the runtime SELECT grant', async () => {
    const combined = new pg.Client({ connectionString: URL_ })
    await combined.connect()
    try {
      const found = await policies(combined)
      expect(found.map((p) => p.policyname)).toEqual(expect.arrayContaining([...OWNER_POLICIES, SHARED]))
      const shared = found.find((p) => p.policyname === SHARED)!
      expect(shared).toMatchObject({ cmd: 'SELECT', permissive: 'PERMISSIVE', roles: ['union_eyes_runtime'] })
      expect(shared.qual).toMatch(/shared_with_org_ids/)
      expect(shared.qual).not.toMatch(/federation|congress/)
      for (const cmd of ['INSERT', 'UPDATE', 'DELETE']) {
        const writers = found.filter((p) => p.cmd === cmd && p.roles.includes('union_eyes_runtime')).map((p) => p.policyname)
        expect(writers, `${cmd} policies for union_eyes_runtime`).toEqual([`ue_org_isolation_${cmd.toLowerCase()}`])
      }
      const rls = (await combined.query(`SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced FROM pg_class WHERE oid = 'public.arbitration_precedents'::regclass`)).rows[0]
      expect(rls).toEqual({ enabled: true, forced: true })
      expect((await combined.query(`SELECT has_table_privilege('union_eyes_runtime','public.arbitration_precedents','SELECT') AS ok`)).rows[0].ok).toBe(true)
    } finally {
      await combined.end()
    }
  })
})
