/** Transaction-bound read admission shares its ordering with authority, identity and case-source writers. */
import type { AuthorityRequest } from '../ontology'
import { AuthorityStoreError, isPrincipalId, isUuid, sessionActor, type SqlExecutor } from './executor'

export async function assertAuthorityReadLock(exec:SqlExecutor):Promise<void>{
  const row=(await exec.query<{held:boolean}>(`SELECT /* ue.authority.read-lock-check */
    NULLIF(pg_catalog.current_setting('ue.authority_read_tx',true),'')=pg_catalog.txid_current()::text AS held`)).rows[0]
  if(row?.held!==true)throw new AuthorityStoreError('INVALID_CONTEXT','authority reads require one dedicated transaction')
}

/** The collection adapter may lock its complete sorted set once before loading per-case facts. */
export async function lockAuthorityReadSet(exec:SqlExecutor,input:{principalUserId:string;organizationId:string;resourceIds:readonly string[];delegationId?:string|null}):Promise<void>{
  if(!isPrincipalId(input.principalUserId)||!isUuid(input.organizationId)||input.resourceIds.some(id=>!isUuid(id)))
    throw new AuthorityStoreError('INVALID_CONTEXT','canonical actor, organization and resources required')
  if(await sessionActor(exec)!==input.principalUserId)throw new AuthorityStoreError('DENIED','read actor does not match the authenticated transaction')
  const principals=[input.principalUserId]
  if(input.delegationId){
    if(!isUuid(input.delegationId))throw new AuthorityStoreError('INVALID_CONTEXT','canonical delegation required')
    const rows=(await exec.query<{delegator_user_id:string}>(`SELECT delegator_user_id FROM public.ue_authority_delegations
      WHERE organization_id=$1::uuid AND id=$2::uuid AND delegate_user_id=$3`,[input.organizationId,input.delegationId,input.principalUserId])).rows
    if(rows.length>1||rows.some(row=>!isPrincipalId(row.delegator_user_id)))throw new AuthorityStoreError('DENIED','delegation identity is contradictory')
    principals.push(...rows.map(row=>row.delegator_user_id))
  }
  await exec.query(`SELECT /* ue.authority.read-lock */
    pg_catalog.set_config('ue.authority_read_tx',pg_catalog.txid_current()::text,true),
    pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lock_key,0))
    FROM (SELECT DISTINCT 0 AS tier,'ue.case-mail.principal:'||person AS lock_key FROM unnest($1::text[]) person
      UNION SELECT DISTINCT 1 AS tier,'ue.case-mail.resource:'||resource AS lock_key FROM unnest($2::text[]) resource) ordered
    ORDER BY tier,lock_key`,[[...new Set(principals)].sort(),[...new Set(input.resourceIds)].sort()])
  await assertAuthorityReadLock(exec)
}

export async function lockAuthorityRead(exec:SqlExecutor,request:AuthorityRequest):Promise<void>{
  const ids=[request.resource.id]
  if(request.documentId&&isUuid(request.documentId))ids.push(request.documentId)
  await lockAuthorityReadSet(exec,{principalUserId:request.principalUserId,organizationId:request.organizationId,
    resourceIds:ids,delegationId:request.delegationId})
}
