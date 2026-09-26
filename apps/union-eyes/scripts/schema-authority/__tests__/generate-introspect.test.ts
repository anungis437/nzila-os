import { describe, expect, it } from 'vitest';
import { introspect } from '../generate-canonical-schema';
import { computeSchemaDigest } from '../lib/normalize';

// Minimal fake pg.Client: routes each catalog query to a fixed row set so the
// generator's assembly + normalization can be tested without a live database.
function fakeClient(data: {
  tables: any[];
  columns: any[];
  constraints: any[];
  indexes: any[];
}) {
  return {
    async query(sql: string) {
      if (/relrowsecurity/.test(sql)) return { rows: data.tables };
      if (/format_type/.test(sql)) return { rows: data.columns };
      if (/con\.contype/.test(sql)) return { rows: data.constraints };
      if (/pg_index/.test(sql)) return { rows: data.indexes };
      return { rows: [] };
    },
  } as any;
}

function fixture() {
  return {
    tables: [
      { schema: 'public', table: 'organization_members', rls_enabled: true, rls_forced: false },
      { schema: 'public', table: 'claims', rls_enabled: false, rls_forced: false },
    ],
    columns: [
      { schema: 'public', table: 'organization_members', column: 'id', type: 'uuid', not_null: true, default_expr: 'gen_random_uuid()' },
      { schema: 'public', table: 'organization_members', column: 'organization_id', type: 'uuid', not_null: true, default_expr: null },
      { schema: 'public', table: 'claims', column: 'id', type: 'uuid', not_null: true, default_expr: null },
      { schema: 'public', table: 'claims', column: 'claim_amount', type: 'character varying(255)', not_null: false, default_expr: null },
    ],
    constraints: [
      { schema: 'public', table: 'organization_members', name: 'organization_members_pkey', contype: 'p', columns: ['id'], ref_schema: null, ref_table: null, ref_columns: null },
      { schema: 'public', table: 'claims', name: 'claims_pkey', contype: 'p', columns: ['id'], ref_schema: null, ref_table: null, ref_columns: null },
    ],
    indexes: [
      { schema: 'public', table: 'organization_members', name: 'organization_members_pkey', is_unique: true, columns: ['id'] },
    ],
  };
}

describe('generator introspection (Step 10)', () => {
  it('assembles a normalized, deterministically ordered schema', async () => {
    const schemas = await introspect(fakeClient(fixture()));
    expect(schemas.map((s) => s.schema)).toEqual(['public']);
    expect(schemas[0].tables.map((t) => t.table)).toEqual(['claims', 'organization_members']);
    const claims = schemas[0].tables.find((t) => t.table === 'claims')!;
    // type normalization applied
    expect(claims.columns.find((c) => c.column === 'claim_amount')!.type).toBe('varchar(255)');
    // primary-key flag set
    expect(claims.columns.find((c) => c.column === 'id')!.primaryKey).toBe(true);
  });

  it('captures RLS state', async () => {
    const schemas = await introspect(fakeClient(fixture()));
    const om = schemas[0].tables.find((t) => t.table === 'organization_members')!;
    const claims = schemas[0].tables.find((t) => t.table === 'claims')!;
    expect(om.rlsEnabled).toBe(true);
    expect(claims.rlsEnabled).toBe(false);
  });

  it('same rows -> same JSON and digest', async () => {
    const a = await introspect(fakeClient(fixture()));
    const b = await introspect(fakeClient(fixture()));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(computeSchemaDigest(a)).toBe(computeSchemaDigest(b));
  });

  it('row ordering does not change the digest', async () => {
    const base = fixture();
    const shuffled = fixture();
    shuffled.tables.reverse();
    shuffled.columns.reverse();
    const a = await introspect(fakeClient(base));
    const b = await introspect(fakeClient(shuffled));
    expect(computeSchemaDigest(a)).toBe(computeSchemaDigest(b));
  });
});
