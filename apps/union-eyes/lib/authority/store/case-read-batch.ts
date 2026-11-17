import type {RLSTx} from '@/lib/db/with-rls-context'
import {createReadBatchExecutor} from '@/lib/db/read-batch-executor'
import {enforceCaseProjection,type EnforcementDeps} from './enforce'
import {drizzleExecutor,kernelDeps} from './route-adapter'
import {isUuid} from './executor'
import {lockAuthorityReadSet} from './read-lock'

/** Fresh canonical projections for one actor/tenant transaction; later mutations always authorize afresh.
 * The existing loaders and pure kernel remain authoritative. Only their read transport is coalesced.
 */
export async function decideCaseCapabilitiesBatch(tx:RLSTx,input:{userId:string;organizationId:string;caseIds:readonly string[]},deps:EnforcementDeps=kernelDeps) {
  if(!isUuid(input.organizationId))throw new Error('Canonical organization required')
  const ids=[...new Set(input.caseIds)]
  if(ids.some(id=>!isUuid(id)))throw new Error('Canonical case identity required')
  const database=drizzleExecutor(tx)
  await lockAuthorityReadSet(database,{principalUserId:input.userId,organizationId:input.organizationId,resourceIds:ids})
  const batch=createReadBatchExecutor(database)
  const projections=await Promise.all(ids.map(async caseId=>[caseId,await enforceCaseProjection(batch.executor,deps,{
    principalUserId:input.userId,organizationId:input.organizationId,caseId,
  })] as const))
  // The kernel refuses unavailable facts; a collection must additionally expose the outage,
  // never manufacture an apparently successful empty list or a zero aggregate.
  batch.assertHealthy()
  return new Map(projections)
}
