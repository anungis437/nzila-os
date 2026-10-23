import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { ORPHANED_TENANT_TABLES_QUERY } from '../rls-verify'

describe('RLS verifier tenant-table discovery without runtime grants', () => {
  it('discovers inaccessible tables and partitioned tables without granting data access', async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        CREATE ROLE discovery_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN;
        CREATE TABLE public.hidden_tenant (organization_id uuid, org_id uuid, tenant_id uuid);
        CREATE TABLE public.visible_tenant (org_id uuid);
        CREATE TABLE public.excluded_tenant (tenant_id uuid);
        CREATE TABLE public.dropped_tenant (tenant_id uuid, retained text);
        ALTER TABLE public.dropped_tenant DROP COLUMN tenant_id;
        CREATE TABLE public.partitioned_tenant (tenant_id uuid) PARTITION BY HASH (tenant_id);
        CREATE SCHEMA foreign_schema;
        CREATE TABLE foreign_schema.hidden_tenant (organization_id uuid);
        CREATE VIEW public.tenant_view AS SELECT * FROM public.hidden_tenant;
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, discovery_runtime;
        GRANT USAGE ON SCHEMA public TO discovery_runtime;
        GRANT SELECT ON public.visible_tenant TO discovery_runtime;
        SET ROLE discovery_runtime;
      `)
      const filtered = await db.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name IN ('organization_id', 'org_id', 'tenant_id')
      `)
      expect(filtered.rows.map(row => row.table_name)).toEqual(['visible_tenant'])
      const discovered = await db.query<{ table_name: string; column_name: string }>(
        ORPHANED_TENANT_TABLES_QUERY, [['excluded_tenant']],
      )
      expect(discovered.rows).toEqual([
        { table_name: 'hidden_tenant', column_name: 'org_id' },
        { table_name: 'hidden_tenant', column_name: 'organization_id' },
        { table_name: 'hidden_tenant', column_name: 'tenant_id' },
        { table_name: 'partitioned_tenant', column_name: 'tenant_id' },
        { table_name: 'visible_tenant', column_name: 'org_id' },
      ])
      await expect(db.query('SELECT * FROM public.hidden_tenant')).rejects.toMatchObject({ code: '42501' })
      await expect(db.query('SELECT * FROM public.partitioned_tenant')).rejects.toMatchObject({ code: '42501' })
      expect((await db.query('SELECT * FROM public.visible_tenant')).rows).toEqual([])
    } finally {
      await db.close()
    }
  })
})
