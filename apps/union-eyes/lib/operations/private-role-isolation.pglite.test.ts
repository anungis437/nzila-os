import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PRIVATE_ROLE_ISOLATED_SQL } from './catalog-admission-core.mjs'

// One definition of "isolated private function owner" serves the native catalog check, the managed
// restore qualification and the packaged runtime admission. It must hold on a managed server, where a
// non-superuser CREATEROLE operator creates the role, and refuse every edge that confers its powers.
describe('private function-owner isolation', () => {
  let db: PGlite
  const isolated = async (role: string) =>
    (await db.query<{ isolated: boolean }>(`SELECT ${PRIVATE_ROLE_ISOLATED_SQL} AS isolated FROM pg_catalog.pg_roles r WHERE r.rolname=$1`, [role]))
      .rows[0]?.isolated

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      CREATE ROLE superuser_made NOLOGIN;
      CREATE ROLE operator_login LOGIN CREATEROLE;
      SET ROLE operator_login;
      CREATE ROLE operator_made NOLOGIN;
      CREATE ROLE operator_made_set NOLOGIN;
      CREATE ROLE operator_made_inherit NOLOGIN;
      CREATE ROLE operator_made_member NOLOGIN;
      CREATE ROLE operator_made_second_admin NOLOGIN;
      CREATE ROLE bystander NOLOGIN;
      RESET ROLE;
      GRANT operator_made_set TO bystander WITH INHERIT FALSE, SET TRUE;
      GRANT operator_made_inherit TO bystander WITH INHERIT TRUE, SET FALSE;
      GRANT bystander TO operator_made_member;
      CREATE ROLE second_creator LOGIN CREATEROLE;
      GRANT operator_made_second_admin TO second_creator WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;
    `)
  })
  afterAll(async () => db?.close())

  it('admits a role with no edges and the one creator ADMIN-only edge PostgreSQL records', async () => {
    expect(await isolated('superuser_made')).toBe(true)
    const edge = await db.query<{ admin_option: boolean; inherit_option: boolean; set_option: boolean; grantor_super: boolean }>(
      `SELECT m.admin_option,m.inherit_option,m.set_option,g.rolsuper AS grantor_super FROM pg_auth_members m
         JOIN pg_roles g ON g.oid=m.grantor WHERE m.roleid='operator_made'::regrole AND m.member='operator_login'::regrole`)
    expect(edge.rows).toEqual([{ admin_option: true, inherit_option: false, set_option: false, grantor_super: true }])
    expect(await isolated('operator_made')).toBe(true)
  })
  it('refuses any edge that lets a holder use the role, any membership of the role, and a second ADMIN edge', async () => {
    for (const role of ['operator_made_set', 'operator_made_inherit', 'operator_made_member', 'operator_made_second_admin'])
      expect(await isolated(role)).toBe(false)
  })
})
