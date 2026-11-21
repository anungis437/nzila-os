/** Attribution for a new survey comes from the current governed case relationship, never claims.assigned_to. */
import { and,eq } from 'drizzle-orm'
import { claims } from '@/db/schema/claims-schema'
import type {RLSTx} from '@/lib/db/with-rls-context'
import {currentStateContextEnabled} from '@/lib/auth/canonical-bootstrap'
import {drizzleExecutor,decideCase} from '@/lib/authority/store/route-adapter'
import {sessionActor,isPrincipalId} from '@/lib/authority/store/executor'
import {activeMembershipSource} from '@/lib/authority/store/active-membership-source'
import {mapRelationship} from '@/lib/authority/store/facts'
import {isLive,validStringArray} from '@/lib/authority/common'

export class SurveyAttributionError extends Error {}
type SurveyCaseInput={organizationId:string;claimId:string;memberId:string;lroId?:string}
export async function authorizeCaseSurveyCreation(tx:RLSTx,input:SurveyCaseInput){
 const executor=drizzleExecutor(tx),actor=await sessionActor(executor)
 const [reference]=await tx.select({claimId:claims.claimId}).from(claims).where(and(eq(claims.id,input.claimId),eq(claims.organizationId,input.organizationId))).limit(1)
 if(!reference||!actor)throw new SurveyAttributionError('The claim is unavailable for a satisfaction survey')
 if(currentStateContextEnabled()){
  const allowed=(await executor.query<{allowed:boolean}>('SELECT public.ue_case_domain_authorized($1::uuid,$2::uuid,$3::text) AS allowed',[input.organizationId,reference.claimId,'case:transition'])).rows[0]?.allowed
  if(allowed!==true)throw new SurveyAttributionError('Current case authority is required to create a satisfaction survey')
 }else if((await decideCase(tx,{userId:actor,organizationId:input.organizationId,caseId:reference.claimId,action:'case:transition'})).effect!=='allow')throw new SurveyAttributionError('Current case authority is required to create a satisfaction survey')
 const [claim]=await tx.select({claimId:claims.claimId,memberId:claims.memberId,status:claims.status}).from(claims)
  .where(and(eq(claims.id,input.claimId),eq(claims.organizationId,input.organizationId))).limit(1).for('update')
 if(!claim||claim.memberId!==input.memberId||!['resolved','closed'].includes(claim.status))throw new SurveyAttributionError('The survey must belong to the member of a resolved or closed claim')
 return claim
}
export async function resolveCaseSurveyPrimary(tx:RLSTx,input:SurveyCaseInput){
 const claim=await authorizeCaseSurveyCreation(tx,input),executor=drizzleExecutor(tx)
 const rows=(await executor.query<Record<string,unknown>>(`SELECT * FROM public.ue_authority_resource_relationships
  WHERE organization_id=$1::uuid AND resource_type='case' AND resource_id=$2::uuid AND relation IN ('owner','assignee')`,[input.organizationId,claim.claimId])).rows
 const memberships=await activeMembershipSource(executor,input.organizationId,[...new Set(rows.map(row=>String(row.principal_user_id)))])
 const now=(await executor.query<{checked_at:Date|string}>('SELECT pg_catalog.clock_timestamp() AS checked_at')).rows[0]?.checked_at
 const checkedAt=now instanceof Date?now:new Date(String(now))
 const eligible=rows.map(mapRelationship).filter(row=>isLive(row,checkedAt)&&row.origin==='explicit'&&isPrincipalId(row.grantedBy)&&row.grantedBy!==row.principalUserId&&validStringArray(row.permissions))
 const principals=[...new Set(eligible.map(row=>row.principalUserId))]
 if(principals.length!==1)throw new SurveyAttributionError('The claim has no single current governed primary representative to rate')
 const principal=principals[0],membership=memberships.filter(row=>row.userId===principal&&row.organizationId===input.organizationId)
 if(membership.length!==1||membership[0].status!=='active'||!membership[0].capacities.some(capacity=>['steward','chief_steward','officer'].includes(capacity)))
  throw new SurveyAttributionError('The current primary representative is no longer eligible')
 if(input.lroId!==undefined&&input.lroId!==principal)throw new SurveyAttributionError('The survey must rate the current governed primary representative')
 return {primaryUserId:principal,memberId:claim.memberId,claimId:input.claimId}
}
