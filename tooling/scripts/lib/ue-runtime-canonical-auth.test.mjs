import test from 'node:test'
import assert from 'node:assert/strict'
import {deriveRuntimeCredentials,runtimeDatabaseUrl,planRuntimeLoginProvisioning,RUNTIME_LOGIN_BINDINGS} from './ue-runtime-canonical-auth.mjs'

const credentials=deriveRuntimeCredentials('a'.repeat(48))
const safe={rolcanlogin:true,rolsuper:false,rolbypassrls:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false}
const roles=RUNTIME_LOGIN_BINDINGS.map(binding=>({rolname:binding.role,...safe}))
const memberships=RUNTIME_LOGIN_BINDINGS.map(binding=>({member:binding.role,granted:binding.target,admin_option:false,inherit_option:false,set_option:true}))

test('purpose credentials are distinct and stable without changing the shared secret',()=>{
  assert.deepEqual(credentials,deriveRuntimeCredentials('a'.repeat(48)))
  assert.equal(new Set(Object.values(credentials).filter(value=>value?.password).map(value=>value.password)).size,8)
  const url=new URL(runtimeDatabaseUrl({database:'ue_runtime',port:55516,credential:credentials.runtime}))
  assert.equal(url.username,'ue_runtime_web');assert.equal(url.hostname,'127.0.0.1')
  assert.throws(()=>runtimeDatabaseUrl({database:'external.invalid',port:55516,credential:credentials.runtime}))
})
test('exact current logins are a no-op; unsafe, missing and extra membership facts refuse',async()=>{
  assert.deepEqual(await planRuntimeLoginProvisioning({roles,memberships,postgresMajor:16,credentials}),[])
  for(const change of [{rolsuper:true},{rolinherit:true},{rolcanlogin:false},{rolcreatedb:true},{rolbypassrls:null}])
    await assert.rejects(planRuntimeLoginProvisioning({roles:[{...roles[0],...change},...roles.slice(1)],memberships,postgresMajor:16,credentials}),/differs/)
  for(const change of [{admin_option:true},{inherit_option:true},{set_option:false},{set_option:null},{granted:'nzila_auth_gateway'}])
    await assert.rejects(planRuntimeLoginProvisioning({roles,memberships:[{...memberships[0],...change},...memberships.slice(1)],postgresMajor:16,credentials}),/differs/)
  await assert.rejects(planRuntimeLoginProvisioning({roles,memberships:memberships.slice(1),postgresMajor:16,credentials}),/differs/)
  await assert.rejects(planRuntimeLoginProvisioning({roles,memberships:memberships.concat(memberships[0]),postgresMajor:16,credentials}),/differs/)
  await assert.rejects(planRuntimeLoginProvisioning({roles,memberships:memberships.concat({member:'unrelated_login',granted:'ue_runtime_web',admin_option:false,inherit_option:false,set_option:true}),postgresMajor:16,credentials}),/Unexpected/)
})
test('new logins receive only exact source gateway edges on each supported major',async()=>{
  for(const postgresMajor of [15,16]){
    const sql=await planRuntimeLoginProvisioning({roles:[],memberships:[],postgresMajor,credentials})
    assert.equal(sql.length,12)
    assert.equal(sql.filter(statement=>statement.startsWith('CREATE ROLE')).length,6)
    assert.ok(sql.every(statement=>!statement.includes('SUPERUSER PASSWORD')||statement.includes('NOSUPERUSER')))
    assert.ok(!sql.join('\n').includes('CREATEDB TO'))
    if(postgresMajor===15)assert.ok(sql.some(statement=>statement.includes('REVOKE ADMIN OPTION FOR')))
    else assert.ok(sql.some(statement=>statement.includes('WITH ADMIN FALSE, INHERIT FALSE, SET TRUE')))
  }
})
