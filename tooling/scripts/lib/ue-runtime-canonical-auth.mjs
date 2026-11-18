/** Credentials and exact role topology for the owned disposable runtime only. */
import {createHmac} from 'node:crypto'

export const RUNTIME_OPERATOR='uev2admin'
export const RUNTIME_LOGIN_BINDINGS=Object.freeze([
  {key:'runtime',role:'ue_runtime_web',target:'union_eyes_runtime'},
  {key:'system',role:'ue_runtime_system',target:'union_eyes_system'},
  {key:'auth',role:'ue_runtime_auth',target:'nzila_auth_gateway'},
  {key:'authSystem',role:'ue_runtime_auth_system',target:'nzila_auth_system_gateway'},
  {key:'framework',role:'ue_runtime_framework',target:'ue_framework_gateway'},
  {key:'worker',role:'ue_runtime_worker',target:'ue_framework_worker_gateway'},
])
export const RUNTIME_NAR_LOGIN='ue_runtime_nar'
const quote=value=>{
  if(!/^[a-z_][a-z0-9_]{0,62}$/.test(value))throw new Error('Invalid disposable role identifier')
  return `"${value}"`
}

/** Existing shared secret bytes are read only. Each purpose gets a distinct
 * private credential; no credential or bearer is written to an evidence log. */
export function deriveRuntimeCredentials(dbSecret){
  if(typeof dbSecret!=='string'||!/^[a-f0-9]{48}$/.test(dbSecret))throw new Error('Existing disposable database secret required')
  const derive=purpose=>createHmac('sha256',dbSecret).update(`ue-runtime-canonical/1/${purpose}`).digest('hex')
  return {
    operator:{role:RUNTIME_OPERATOR,password:dbSecret},
    ...Object.fromEntries(RUNTIME_LOGIN_BINDINGS.map(binding=>[binding.key,{role:binding.role,password:derive(binding.key)}])),
    nar:{role:RUNTIME_NAR_LOGIN,password:derive('nar')},
    mfaKey:derive('mfa-encryption'),
  }
}

export function runtimeDatabaseUrl({database,port,credential}){
  if(!/^[a-z][a-z0-9_]{0,62}$/.test(database)||!Number.isInteger(port)||port<1024||port>65535)
    throw new Error('Owned loopback database target required')
  quote(credential.role)
  if(typeof credential.password!=='string'||!/^[a-f0-9]{48,64}$/.test(credential.password))throw new Error('Generated disposable credential required')
  const url=new URL('postgresql://127.0.0.1')
  url.port=String(port);url.pathname=`/${database}`;url.username=credential.role;url.password=credential.password
  return url.toString()
}

/** Source roles, never observed catalog privileges, define the allowed graph. */
export async function planRuntimeLoginProvisioning({roles,memberships,postgresMajor,credentials}){
  const {tsImport}=await import('tsx/esm/api')
  const {compileCanonicalMembershipGrant}=await tsImport('../../../packages/db/src/auth-storage-authority/membership-semantics.ts',{parentURL:import.meta.url})
  const expected=RUNTIME_LOGIN_BINDINGS
  const statements=[]
  for(const row of roles)if(!expected.some(binding=>binding.role===row.rolname)&&row.rolname!==RUNTIME_NAR_LOGIN)
    throw new Error(`Unknown disposable runtime login: ${row.rolname}`)
  for(const binding of expected){
    const actual=roles.filter(row=>row.rolname===binding.role)
    if(actual.length>1)throw new Error('Duplicate disposable login catalog fact')
    const edges=memberships.filter(row=>row.member===binding.role)
    if(actual.length){
      const role=actual[0]
      if(role.rolcanlogin!==true||['rolsuper','rolbypassrls','rolinherit','rolcreatedb','rolcreaterole'].some(flag=>role[flag]!==false)
        ||edges.length!==1||edges[0].granted!==binding.target||edges[0].admin_option!==false||edges[0].inherit_option!==false||edges[0].set_option!==true)
        throw new Error(`Existing disposable runtime login differs: ${binding.role}`)
      continue
    }
    if(edges.length)throw new Error('Membership without a disposable role is not an admissible catalog fact')
    const credential=credentials[binding.key]
    if(credential?.role!==binding.role||!/^[a-f0-9]{64}$/.test(credential.password))throw new Error('Purpose-bound generated credential required')
    statements.push(`CREATE ROLE ${quote(binding.role)} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${credential.password}'`,
      compileCanonicalMembershipGrant(binding.role,[binding.target],{inherit:false,set:true,memberRoleInherit:false},postgresMajor))
  }
  if(memberships.some(edge=>!expected.some(binding=>binding.role===edge.member)))throw new Error('Unexpected disposable login membership')
  return statements
}
