import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import sourcePlan from '../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'
import { compileSecurity } from './security'
import type { SourceTable, V2Plan } from './source'
import {
  CONTAINED_PARENT_POLICY_QUERY, containedParentPolicyInstallViolations,
  planContainedParentPolicyInstall,
} from './contained-parent-policies'

function fixture(required: boolean): V2Plan {
  const parent: SourceTable = {
    name: 'boundary_parent', source: 'synthetic-contained-parent', sourceDigest: 'synthetic',
    columns: [{ name: 'id', type: 'text', notNull: true }], foreignKeys: [],
    authority: { table: 'boundary_parent', classification: 'CONTAINED_NO_AUTHORITY', reason: 'synthetic denied parent',
      supportingCapability: [], requiredRuntimePrivileges: [], requiredSystemPrivileges: [],
      invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', reviewPriority: 'NONE' },
  }
  const child: SourceTable = {
    name: 'boundary_child', source: 'synthetic-authorized-child', sourceDigest: 'synthetic',
    columns: [{ name: 'id', type: 'text', notNull: true }, { name: 'organization_id', type: 'text', notNull: true },
      { name: 'parent_id', type: 'text', notNull: required }],
    foreignKeys: [{ column: 'parent_id', table: parent.name, referencedColumn: 'id' }],
    authority: { table: 'boundary_child', classification: 'TENANT_RLS_REQUIRED', reason: 'synthetic authorized child',
      supportingCapability: [], requiredRuntimePrivileges: ['SELECT', 'INSERT', 'UPDATE'], requiredSystemPrivileges: ['SELECT', 'INSERT', 'UPDATE'],
      invocationAuthority: 'MIXED', dbExecutionPrincipal: 'MIXED', reviewPriority: 'NONE' },
  }
  return { ...sourcePlan, authExecution: undefined, frameworkExecution: undefined,
    securityBlockers: [], tables: [parent, child] } as unknown as V2Plan
}

describe('contained-parent references in current compiled policies', () => {
  it.each([false, true])('keeps the tenant predicate and denies an unavailable %s-required parent', required => {
    const compiled = compileSecurity(fixture(required))
    expect(compiled.blockers).toEqual([])
    const rule = compiled.rules.find(rule => rule.table === 'boundary_child')!
    expect(rule.writePredicate).toBe(`"organization_id"::text = nullif(current_setting('app.current_org_id', true), '')`)
    expect(rule.checkPredicate).toContain(required ? 'false' : '"parent_id" IS NULL')
    expect(rule.checkPredicate).not.toContain('EXISTS')
    expect(compiled.statements.filter(sql => /^CREATE POLICY.*system_(insert|update)/s.test(sql)).every(sql =>
      sql.includes(required ? 'false' : '"parent_id" IS NULL'))).toBe(true)
  })

  it('refuses missing FK columns instead of inferring nullable containment', () => {
    const plan = fixture(false)
    plan.tables[1].columns = plan.tables[1].columns.filter(column => column.name !== 'parent_id')
    expect(() => compileSecurity(plan)).toThrow('UE_V2_CONTAINED_PARENT_COLUMN_REQUIRED')
  })

  it('refuses missing parent keys instead of inventing a valid source relationship', () => {
    const plan = fixture(false)
    plan.tables[1].foreignKeys[0].referencedColumn = 'unknown'
    expect(() => compileSecurity(plan)).toThrow('UE_V2_CONTAINED_PARENT_KEY_REQUIRED')
  })

  it.each([false, true])('secures existing permissive policies additively for a %s-required contained parent', async required => {
    const db = new PGlite()
    try {
      // Synthetic resource policy isolates this restrictive layer. Production
      // canonical session qualification remains a separate native gate.
      await db.exec(`CREATE ROLE ue_v2_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
        CREATE ROLE union_eyes_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
        CREATE ROLE union_eyes_system NOLOGIN NOSUPERUSER NOBYPASSRLS;
        CREATE TABLE boundary_parent(id text PRIMARY KEY);
        CREATE TABLE boundary_child(id text PRIMARY KEY, organization_id text NOT NULL,
          parent_id text ${required ? 'NOT NULL' : ''} REFERENCES boundary_parent(id));
        INSERT INTO boundary_parent VALUES ('private-parent');
        INSERT INTO boundary_child VALUES ('history','org-a','private-parent');
        ALTER TABLE boundary_parent OWNER TO ue_v2_owner;
        ALTER TABLE boundary_child OWNER TO ue_v2_owner;
        ALTER TABLE boundary_child ENABLE ROW LEVEL SECURITY;
        ALTER TABLE boundary_child FORCE ROW LEVEL SECURITY;
        GRANT SELECT,INSERT,UPDATE ON boundary_child TO union_eyes_runtime,union_eyes_system;
        CREATE POLICY existing_runtime ON boundary_child TO union_eyes_runtime
          USING (organization_id=current_setting('app.current_org_id',true))
          WITH CHECK (organization_id=current_setting('app.current_org_id',true));
        CREATE POLICY existing_system ON boundary_child TO union_eyes_system USING (true) WITH CHECK (true);`)
      const source = compileSecurity(fixture(required)).containedParentPolicies
      expect(source).toHaveLength(2)
      const existingBefore = (await db.query("SELECT polname,pg_get_expr(polqual,polrelid) AS qual,pg_get_expr(polwithcheck,polrelid) AS with_check FROM pg_policy WHERE polname LIKE 'existing_%' ORDER BY polname")).rows
      // Real counterexample before the additive layer: both restricted roles
      // can attach the otherwise unreadable historical parent.
      for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
        await db.exec(`SET ROLE ${role}; SELECT set_config('app.current_org_id','org-a',false)`)
        await db.query('INSERT INTO boundary_child VALUES ($1,$2,$3)', [`before-${role}`, 'org-a', 'private-parent'])
        await db.exec('RESET ROLE')
      }
      const options = { expectedOwner: 'ue_v2_owner', requireForcedRls: true }
      const plan = planContainedParentPolicyInstall(source, (await db.query(CONTAINED_PARENT_POLICY_QUERY)).rows, options)
      expect(plan.statements).toHaveLength(2)
      await db.exec(plan.statements.join('\n'))
      const inspected = (await db.query(CONTAINED_PARENT_POLICY_QUERY)).rows
      expect(containedParentPolicyInstallViolations(source, inspected, options)).toEqual([])
      expect(planContainedParentPolicyInstall(source, inspected, options).statements).toEqual([])
      for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
        await db.exec(`SET ROLE ${role}; SELECT set_config('app.current_org_id','org-a',false)`)
        await expect(db.query('SELECT id FROM boundary_parent')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('INSERT INTO boundary_child VALUES ($1,$2,$3)', [`after-${role}`, 'org-a', 'private-parent'])).rejects.toMatchObject({ code: '42501' })
        await expect(db.query("UPDATE boundary_child SET parent_id='private-parent' WHERE id='history'")).rejects.toMatchObject({ code: '42501' })
        if (!required) {
          await db.query('INSERT INTO boundary_child VALUES ($1,$2,NULL)', [`nullable-${role}`, 'org-a'])
          await db.query('UPDATE boundary_child SET parent_id=NULL WHERE id=$1', [`nullable-${role}`])
          if (role === 'union_eyes_runtime')
            await expect(db.query("INSERT INTO boundary_child VALUES ('foreign','org-b',NULL)")).rejects.toMatchObject({ code: '42501' })
        }
        await db.exec('RESET ROLE')
      }
      expect((await db.query("SELECT parent_id FROM boundary_child WHERE id='history'")).rows).toEqual([{ parent_id: 'private-parent' }])
      expect((await db.query("SELECT polname,pg_get_expr(polqual,polrelid) AS qual,pg_get_expr(polwithcheck,polrelid) AS with_check FROM pg_policy WHERE polname LIKE 'existing_%' ORDER BY polname")).rows).toEqual(existingBefore)
      expect((await db.query('SELECT count(*)::integer AS count FROM boundary_child')).rows).toEqual([{ count: required ? 3 : 5 }])
    } finally { await db.close() }
  }, 20000)

  it.each([false, true])('executes ordinary/system denial with actual RLS for a %s-required parent', async required => {
    const db = new PGlite()
    try {
      await db.exec(`CREATE ROLE union_eyes_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
        CREATE ROLE union_eyes_system NOLOGIN NOSUPERUSER NOBYPASSRLS;
        CREATE TABLE boundary_parent(id text PRIMARY KEY);
        CREATE TABLE boundary_child(id text PRIMARY KEY, organization_id text NOT NULL,
          parent_id text ${required ? 'NOT NULL' : ''} REFERENCES boundary_parent(id));
        INSERT INTO boundary_parent VALUES ('private-parent');
        INSERT INTO boundary_child VALUES ('existing','org-a',${required ? "'private-parent'" : 'NULL'});`)
      await db.exec(compileSecurity(fixture(required)).statements.join('\n'))
      for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
        await db.exec(`SET ROLE ${role}; SELECT set_config('app.current_user_id','synthetic-member',false),
          set_config('app.current_org_id','org-a',false);`)
        await expect(db.query('SELECT id FROM boundary_parent')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('INSERT INTO boundary_child VALUES ($1,$2,$3)', [`${role}-forged`, 'org-a', 'private-parent'])).rejects.toMatchObject({ code: '42501' })
        await expect(db.query("UPDATE boundary_child SET parent_id='private-parent' WHERE id='existing'")).rejects.toMatchObject({ code: '42501' })
        if (!required) {
          await db.query('INSERT INTO boundary_child VALUES ($1,$2,NULL)', [`${role}-allowed`, 'org-a'])
          await db.query("UPDATE boundary_child SET parent_id=NULL WHERE id=$1", [`${role}-allowed`])
        }
        if (role === 'union_eyes_runtime') {
          await expect(db.query('INSERT INTO boundary_child VALUES ($1,$2,$3)', ['foreign-row', 'org-b', required ? 'private-parent' : null])).rejects.toMatchObject({ code: '42501' })
          await db.exec("SELECT set_config('app.current_user_id','',false)")
          await expect(db.query('INSERT INTO boundary_child VALUES ($1,$2,$3)', ['unattributed-row', 'org-a', required ? 'private-parent' : null])).rejects.toMatchObject({ code: '42501' })
        }
        await db.exec('RESET ROLE')
      }
      expect((await db.query<{ id: string }>('SELECT id FROM boundary_parent')).rows).toEqual([{ id: 'private-parent' }])
      expect((await db.query<{ parent_id: string | null }>("SELECT parent_id FROM boundary_child WHERE id='existing'")).rows)
        .toEqual([{ parent_id: required ? 'private-parent' : null }])
      expect((await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM boundary_child")).rows[0].count).toBe(required ? 1 : 3)
    } finally { await db.close() }
  }, 20000)
})
