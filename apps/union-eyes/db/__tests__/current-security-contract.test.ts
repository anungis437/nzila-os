import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { projectCurrentCompilerSecurity } from '../../../../tooling/scripts/lib/union-eyes-current-security-contract'
import { currentSecurityPrograms, currentSecurityProjection } from '../../../../tooling/scripts/lib/union-eyes-current-security-programs'
import { buildCurrentCatalogOverlay } from '../../../../tooling/scripts/write-union-eyes-current-catalog'
import { reconcileCurrentAuthority } from '../../scripts/bootstrap-v2/current-authority'
import historical from '../../lib/operations/catalog-authority-contract.json'
import type { V2Plan } from '../../scripts/bootstrap-v2/source'

const declaration = `CREATE FUNCTION public.exact_guard(actor text, scope_ids text[] DEFAULT NULL)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
 AS $body$SELECT actor IS NOT NULL$body$;
 REVOKE ALL ON FUNCTION public.exact_guard(text,text[]) FROM PUBLIC;
 ALTER FUNCTION public.exact_guard(text,text[]) OWNER TO nzila_auth_org_authority_reader;
 GRANT EXECUTE ON FUNCTION public.exact_guard(text,text[]) TO union_eyes_runtime;`

describe('current security source projection', () => {
  it('derives full identities, bodies, ownership, configuration and exact ACL from source', async () => {
    const { functions } = await projectCurrentCompilerSecurity([declaration])
    expect(functions).toHaveLength(1)
    expect(functions[0]).toMatchObject({
      signature: 'public.exact_guard(text,text[])', owner: 'nzila_auth_org_authority_reader',
      language: 'sql', volatility: 's', definer: true, strict: false, leakproof: false,
      argumentNames: ['actor', 'scope_ids'], argumentModes: null, allArgumentTypes: ['text', 'text[]'],
      defaultCount: 1, defaults: 'NULL::text[]', config: ['search_path=pg_catalog'],
      executeAcl: [{ role: 'nzila_auth_org_authority_reader', grantable: false }, { role: 'union_eyes_runtime', grantable: false }],
    })
  })

  it.each([
    declaration.replace('public.exact_guard(actor', 'exact_guard(actor'),
    declaration.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'),
    declaration.replace('SET search_path=pg_catalog', ''),
    declaration.replace('DEFAULT NULL', "DEFAULT ARRAY['unreviewed']"),
    declaration + ' GRANT EXECUTE ON FUNCTION public.exact_guard(text,text[]) TO union_eyes_system WITH GRANT OPTION;',
    declaration + ' GRANT EXECUTE ON FUNCTION public.unproduced(text) TO union_eyes_system;',
    declaration + declaration,
  ])('refuses incomplete or ambiguous source authority', async source => {
    await expect(projectCurrentCompilerSecurity([source])).rejects.toThrow()
  })

  it('tracks column privileges separately from whole table revocation', async () => {
    const projected = await projectCurrentCompilerSecurity([
      'GRANT SELECT (user_id,is_active) ON user_management.users TO nzila_auth_org_authority_reader;',
      'GRANT UPDATE ON user_management.users TO nzila_auth_mutation;',
      'REVOKE ALL ON user_management.users FROM nzila_auth_org_authority_reader,nzila_auth_mutation;',
    ])
    expect(projected.tableGrants).toEqual([])
    expect(projected.columnGrants).toEqual([{ schema: 'user_management', table: 'users', role: 'nzila_auth_org_authority_reader', privilege: 'SELECT', columns: ['is_active','user_id'], grantable: false }])
  })

  it('projects the actual current auth, framework, purpose helpers and physical compilers', async () => {
    const root = path.resolve(import.meta.dirname, '../../../..')
    const plan = JSON.parse(readFileSync(path.join(root, 'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8')) as V2Plan
    const programs = currentSecurityPrograms(plan)
    const projected = await projectCurrentCompilerSecurity([...programs.auth, programs.framework, ...programs.companions, ...programs.guardFunctions, ...programs.messaging])
    expect(projected.functions.length).toBeGreaterThan(30)
    expect(projected.functions.some(fn => fn.name === 'ue_case_domain_authorized')).toBe(true)
    expect(projected.functions.some(fn => fn.name === 'auth_business_org_authorized')).toBe(true)
  })

  it('projects current authority decisions in installation order and contains historical-only storage', async () => {
    const root = path.resolve(import.meta.dirname, '../../../..')
    const plan = JSON.parse(readFileSync(path.join(root, 'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8')) as V2Plan
    // This pure compiler fixture applies the production decision producer; it
    // never writes a plan or bypasses the installer's source commitment check.
    for (const table of plan.tables) {
      const model = plan.currentModels.models.find(model => model.table === table.name)
      if (model) table.authority = reconcileCurrentAuthority(model, table.authority ?? null) ?? undefined
    }
    const projected = await currentSecurityProjection(plan)
    expect(projected.tableGrants.find(grant => grant.table === 'auth_user' && grant.role === 'ue_framework_admin')?.privileges).toEqual(['DELETE','INSERT','SELECT','UPDATE'])
    expect(projected.functions.some(fn => fn.name.startsWith('ue_v2_visible_parent_'))).toBe(true)
    const before = JSON.stringify(historical)
    const overlay = await buildCurrentCatalogOverlay(plan)
    expect(overlay.entries.find(entry => entry.table === 'donations')).toMatchObject({classification:'CONTAINED_NO_AUTHORITY',runtime:[],system:[]})
    expect(overlay.entries.find(entry => entry.table === 'icra_anonymized_metrics')).toMatchObject({classification:'CONTAINED_NO_AUTHORITY',runtime:[],system:[]})
    expect(JSON.stringify(historical)).toBe(before)
    expect(overlay.currentSecurity.currentFunctions).toEqual(projected.functions)
  })
})
