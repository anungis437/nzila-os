import { randomUUID } from 'node:crypto'
import { and,eq,or,lte,sql } from 'drizzle-orm'
import { z } from 'zod'
import { notificationQueue,notificationDeliveryLog } from '@/db/schema/domains/communications/notifications'
import { withSystemContext,type RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { getFromEmail,sendResendEmail,type SendEmailResult } from '@/lib/email-service'
import { correspondenceEmailKey,correspondenceEmailRetryAllowed,CORRESPONDENCE_EMAIL_LEASE_MS,CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS } from '@/lib/correspondence/email-intent'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { issueQueuedCaseMailCapability,queuedCaseMailContext } from '@/lib/authority/store/queued-case-mail'
import { CASE_STATUS_EMAIL_PURPOSE,renderCaseStatusNotification,sealCaseStatusEmail,verifyCaseStatusEmail,sealCaseStatusReceipt,verifyCaseStatusReceipt,type CaseStatusEmailIntent } from './case-status-intent'

type QueueRow=typeof notificationQueue.$inferSelect
const purpose=sql`${notificationQueue.payload}->>'purpose'=${CASE_STATUS_EMAIL_PURPOSE}`
const actor='system:case-status-email-worker'

export async function queueCaseStatusEmail(tx:RLSTx,input:{organizationId:string;caseId:string;queuedBy:string;
  recipientId:string;previousStatus:CaseStatusEmailIntent['previousStatus'];newStatus:CaseStatusEmailIntent['newStatus']}) {
  const id=randomUUID(),createdAt=new Date()
  const pending={...input,purpose:CASE_STATUS_EMAIL_PURPOSE as typeof CASE_STATUS_EMAIL_PURPOSE,version:1 as const,queueId:id,
    createdAt:createdAt.toISOString(),mail:null}
  await tx.insert(notificationQueue).values({id,organizationId:input.organizationId,payload:{...pending,authorityCapability:null},createdAt,status:'pending',maxAttempts:'3'})
  const authorityCapability=await issueQueuedCaseMailCapability(drizzleExecutor(tx),{queueId:id})
  const payload=sealCaseStatusEmail({...pending,authorityCapability},correspondenceEmailKey())
  await tx.update(notificationQueue).set({payload}).where(and(eq(notificationQueue.id,id),eq(notificationQueue.organizationId,input.organizationId)))
  await persistAtomicAudit(tx,{organizationId:input.organizationId,userId:input.queuedBy,action:'case.status_email_queued',
    resourceType:'notification_queue',resourceId:id,details:{caseId:input.caseId,recipientId:input.recipientId}})
  return id
}
async function record(tx:RLSTx,row:QueueRow,event:string,details:Record<string,unknown>={}) {
  await tx.insert(notificationDeliveryLog).values({organizationId:row.organizationId,notificationId:row.id,event,
    eventTimestamp:new Date(),providerId:'resend',externalEventId:typeof details.providerMessageId==='string'?details.providerMessageId:null,details})
  await persistAtomicAudit(tx,{organizationId:row.organizationId,userId:actor,action:`case.status_email_${event}`,
    resourceType:'notification_queue',resourceId:row.id,details})
}
async function receipt(tx:RLSTx,intent:CaseStatusEmailIntent,key:string) {
  const logs=await tx.select({details:notificationDeliveryLog.details}).from(notificationDeliveryLog).where(and(
    eq(notificationDeliveryLog.organizationId,intent.organizationId),eq(notificationDeliveryLog.notificationId,intent.queueId),eq(notificationDeliveryLog.event,'accepted')))
  for(const log of logs){const found=verifyCaseStatusReceipt(log.details,intent,key);if(found)return found}
  return null
}
async function claim(now:Date) {
  const key=correspondenceEmailKey()
  return withSystemContext(async tx=>{
    const [row]=await tx.select().from(notificationQueue).where(and(purpose,or(
      and(or(eq(notificationQueue.status,'pending'),eq(notificationQueue.status,'retrying')),
        or(sql`${notificationQueue.nextRetryAt} IS NULL`,lte(notificationQueue.nextRetryAt,now))),
      and(eq(notificationQueue.status,'processing'),or(sql`${notificationQueue.processedAt} IS NULL`,lte(notificationQueue.processedAt,new Date(now.getTime()-CORRESPONDENCE_EMAIL_LEASE_MS)))),
    ))).orderBy(notificationQueue.createdAt,notificationQueue.id).limit(1).for('update',{skipLocked:true})
    if(!row)return null
    let intent:CaseStatusEmailIntent
    try{intent=verifyCaseStatusEmail(row.payload,row,key)}catch{
      await tx.update(notificationQueue).set({status:'failed',errorMessage:'CASE_STATUS_INVALID_SEAL',updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      await record(tx,row,'review_required',{reason:'invalid_seal'});return null
    }
    const prior=await receipt(tx,intent,key)
    if(prior){await tx.update(notificationQueue).set({status:'completed',completedAt:new Date(prior.acceptedAt),updatedAt:now,errorMessage:null}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)));return null}
    const context=await queuedCaseMailContext(drizzleExecutor(tx),{queueId:row.id,capability:intent.authorityCapability})
    const email=z.string().email().max(320).safeParse(context.recipientEmail)
    if(!context.allowed || !email.success || (intent.mail && intent.mail.to!==email.data)) {
      await tx.update(notificationQueue).set({status:'failed',errorMessage:'CASE_STATUS_AUTHORITY_REVOKED',updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      await record(tx,row,'suppressed',{reason:'authority_or_recipient_changed'});return null
    }
    const count=/^\d$/.test(row.attemptCount)?Number(row.attemptCount):99
    if(count>=3 || !correspondenceEmailRetryAllowed(row.createdAt,now)) {
      await tx.update(notificationQueue).set({status:'failed',errorMessage:'CASE_STATUS_RECONCILIATION_REQUIRED',updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      await record(tx,row,'review_required',{reason:'retry_boundary'});return null
    }
    if(!intent.mail){
      const {seal:_seal,...unsigned}=intent
      intent=sealCaseStatusEmail({...unsigned,mail:{from:getFromEmail(),to:email.data,
        ...renderCaseStatusNotification(intent.newStatus,context.recipientLocale)}},key)
    }
    await tx.update(notificationQueue).set({payload:intent,status:'processing',attemptCount:String(count+1),processedAt:now,nextRetryAt:null,errorMessage:null,updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
    await record(tx,row,'attempted',{attempt:count+1})
    return {row,intent,attempt:count+1}
  })
}
async function submit(intent:CaseStatusEmailIntent):Promise<SendEmailResult> {
  if(!intent.mail)throw new Error('Unfrozen case notification')
  let timer:ReturnType<typeof setTimeout>|undefined
  try{return await Promise.race([sendResendEmail(intent.mail,{feature:'case-status',correlationId:intent.queueId,
    idempotencyKey:`ue-case-status/${intent.queueId}`,sensitiveContent:true,disableRetry:true,
    notAfter:Date.parse(intent.createdAt)+CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS}),
    new Promise<SendEmailResult>(resolve=>{timer=setTimeout(()=>resolve({success:false,code:'OUTCOME_UNKNOWN'}),8000)})])}
  catch{return {success:false,code:'OUTCOME_UNKNOWN'}}finally{if(timer)clearTimeout(timer)}
}
export async function processCaseStatusEmails(limit=5) {
  const report={attempted:0,accepted:0,unconfirmed:0}
  for(let i=0;i<Math.min(10,Math.max(1,limit));i++){
    const task=await claim(new Date());if(!task)break
    report.attempted++;const result=await submit(task.intent)
    const accepted=result.success && z.string().uuid().safeParse(result.messageId).success
    await withSystemContext(async tx=>{
      const [row]=await tx.select().from(notificationQueue).where(and(eq(notificationQueue.id,task.row.id),eq(notificationQueue.organizationId,task.row.organizationId))).for('update')
      if(!row)throw new Error('Case notification task disappeared')
      const key=correspondenceEmailKey(),intent=verifyCaseStatusEmail(row.payload,row,key)
      if(intent.seal!==task.intent.seal)throw new Error('Case notification changed during submission')
      if(await receipt(tx,intent,key))return
      const now=new Date()
      if(accepted){
        const proof=sealCaseStatusReceipt({purpose:'case_status_email_receipt_v1',queueId:row.id,organizationId:row.organizationId,
          intentSeal:intent.seal,providerMessageId:result.messageId!,acceptedAt:now.toISOString()},key)
        await record(tx,row,'accepted',proof)
        await tx.update(notificationQueue).set({status:'completed',completedAt:now,updatedAt:now,errorMessage:null}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      }else if(row.status==='processing' && row.attemptCount===String(task.attempt)){
        const permanent=result.statusCode!==undefined && result.statusCode>=400 && result.statusCode<500 && ![408,409,425,429].includes(result.statusCode)
        const retry=!permanent && task.attempt<3 && correspondenceEmailRetryAllowed(row.createdAt,now)
        await tx.update(notificationQueue).set({status:retry?'retrying':'failed',nextRetryAt:retry?new Date(now.getTime()+60000):null,
          errorMessage:permanent?'CASE_STATUS_PROVIDER_REJECTED':'CASE_STATUS_OUTCOME_UNCONFIRMED',updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
        await record(tx,row,permanent?'rejected':'unconfirmed',{attempt:task.attempt})
      }
    })
    if(accepted)report.accepted++;else report.unconfirmed++
  }
  return report
}

export async function readCaseStatusQueueHealth(tx:RLSTx) {
  const [row]=await tx.execute<{unresolved:number}>(sql`SELECT count(*)::int AS unresolved FROM public.notification_queue
    WHERE payload->>'purpose'=${CASE_STATUS_EMAIL_PURPOSE} AND (status='failed'
      OR (status IN ('pending','retrying') AND created_at<now()-interval '15 minutes')
      OR (status='processing' AND (processed_at IS NULL OR processed_at<now()-interval '3 minutes')))`)
  if(!row || !Number.isInteger(row.unresolved) || row.unresolved<0)throw new Error('Invalid case notification queue measurement')
  return {state:row.unresolved===0?'ok' as const:'fail' as const,unresolved:row.unresolved}
}
