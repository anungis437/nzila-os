import { createHash } from 'node:crypto'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import base from './catalog-authority-contract.json'
import { assessCatalogAdmission, catalogContractDigest, currentFunctionViolations } from './catalog-admission-core.mjs'
import {canonicalCatalogContract} from './canonical-catalog-admission'
import {assertCurrentCatalogContract,readCurrentCatalogContract} from '../../../../tooling/scripts/lib/union-eyes-catalog-authority.mjs'

const body = 'SELECT principal IS NOT NULL'
const spec = {
  schema:'public', name:'purpose_bound_helper', signature:'public.purpose_bound_helper(text)',
  owner:'nzila_auth_org_authority_reader', bodyDigest:createHash('sha256').update(body).digest('hex'),
  language:'sql', volatility:'s', definer:true, strict:false, leakproof:false,
  returns:'boolean', returnsSet:false, argumentNames:['principal'], argumentModes:null,
  allArgumentTypes:['text'], defaultCount:0, defaults:null, config:['search_path=pg_catalog'],
  executeAcl:[{role:'nzila_auth_org_authority_reader',grantable:false},{role:'union_eyes_system',grantable:false}],
}
const actual = { ...spec, body }
function contract() {
  const payload = { ...structuredClone(base.payload), currentFunctions:[spec],
    approvedColumnGrants:[{schema:'user_management',table:'users',role:'nzila_auth_org_authority_reader',privilege:'SELECT',columns:['user_id'],grantable:false}],
    dedicatedRolePrivileges:[{schema:'public',table:'claims',role:'nzila_auth_org_authority_reader',privileges:['SELECT']}],
  }
  return { payload,digest:catalogContractDigest(payload) }
}
function snapshot() {
  return {
    roles:['union_eyes_runtime','union_eyes_system'].map(rolname=>({rolname,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false})),
    schemaUsage:[...base.payload.runtimeSchemaUsage.map(nspname=>({rolname:'union_eyes_runtime',nspname})),...base.payload.systemSchemaUsage.map(nspname=>({rolname:'union_eyes_system',nspname}))],
    currentFunctions:[actual],
    definers:[{nspname:spec.schema,proname:spec.name,owner:spec.owner,proconfig:spec.config,runtime_execute:false,system_execute:true,public_execute:false}],
  }
}

describe('source-declared catalog functions and privileges', () => {
  it('uses one exact current contract across the installer and application, refusing re-signed legacy authority',()=>{
    const root=path.resolve(import.meta.dirname,'../../../..')
    const current=readCurrentCatalogContract(root)
    expect(current).toEqual(canonicalCatalogContract())
    expect(assertCurrentCatalogContract(root,current)).toEqual(current)
    expect(()=>assertCurrentCatalogContract(root,base)).toThrow(/current source/)
    const changed=structuredClone(current)
    changed.payload.entries.find((entry:{table:string})=>entry.table==='donations')!.runtime=['SELECT']
    changed.digest=catalogContractDigest(changed.payload)
    expect(()=>assertCurrentCatalogContract(root,changed)).toThrow(/current source/)
  })
  it('admits the exact purpose-bound system helper and rejects a missing source contract', () => {
    expect(currentFunctionViolations([spec],[actual])).toEqual([])
    expect(currentFunctionViolations(undefined,[actual])).toEqual(['current function source contract is missing'])
    expect(assessCatalogAdmission(contract(),snapshot()).ok).toBe(true)
  })

  it.each([
    {signature:'public.purpose_bound_helper(uuid)'}, {owner:'union_eyes_system'}, {body:'SELECT true'},
    {config:['search_path=public']}, {volatility:'v'}, {language:'plpgsql'}, {definer:false},
    {strict:true}, {leakproof:true}, {returns:'text'}, {returnsSet:true},
    {argumentNames:['different']}, {argumentModes:['o']}, {allArgumentTypes:['uuid']},
    {defaultCount:1,defaults:'NULL::text'},
    {executeAcl:[...spec.executeAcl,{role:'PUBLIC',grantable:false}]},
    {executeAcl:[{role:'nzila_auth_org_authority_reader',grantable:false},{role:'union_eyes_system',grantable:true}]},
  ])('rejects same-name altered source or authority metadata', change => {
    expect(currentFunctionViolations([spec],[{...actual,...change}])).toEqual(['current function differs: public.purpose_bound_helper(text)'])
  })

  it('rejects same-name overloads and repeated live function identities', () => {
    for (const extra of [actual,{...actual,signature:'public.purpose_bound_helper(uuid)'}])
      expect(currentFunctionViolations([spec],[actual,extra])).toEqual(['current function differs: public.purpose_bound_helper(text)'])
  })

  it('rejects unknown function authority even when its function name resembles an approved helper', () => {
    const report = assessCatalogAdmission(contract(),{...snapshot(),definers:[{
      nspname:'public',proname:'purpose_bound_helper_other',owner:spec.owner,
      runtime_execute:false,system_execute:true,public_execute:false,
    }]})
    expect(report.ok).toBe(false)
    expect(report.violations.some(message=>message.includes('purpose_bound_helper_other'))).toBe(true)
  })

  it('rejects unknown dedicated-role tables, sensitive columns and column grant options', () => {
    for (const change of [
      {dedicatedRoles:[{schema_name:'public',table_name:'password_cache',role_name:spec.owner,privileges:['SELECT']}]},
      {columnGrants:[{schema_name:'user_management',table_name:'users',role_name:spec.owner,column_name:'password_hash',privilege_type:'SELECT',is_grantable:false}]},
      {columnGrants:[{schema_name:'user_management',table_name:'users',role_name:spec.owner,column_name:'user_id',privilege_type:'SELECT',is_grantable:true}]},
    ]) expect(assessCatalogAdmission(contract(),{...snapshot(),...change}).ok).toBe(false)
  })

  it('requires a known source entry for public views even without application grants',()=>{
    for(const relkind of ['v','m']) {
      const report=assessCatalogAdmission(contract(),{...snapshot(),relations:[{schema_name:'public',table_name:'unregistered_view',relkind,runtime:[],system:[]}]})
      expect(report.violations).toContain('public.unregistered_view is unclassified')
    }
  })
})
