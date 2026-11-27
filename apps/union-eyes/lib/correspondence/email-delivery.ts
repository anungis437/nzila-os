import { and, eq, or, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { correspondence, correspondenceRecipients } from '@/db/schema/domains/documents/correspondence'
import { notificationQueue, notificationDeliveryLog } from '@/db/schema/domains/communications/notifications'
import { withRLSContext, withSystemContext, type RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { appendAuditEntry } from '@/lib/services/correspondence-service'
import { ApiError } from '@/lib/api/errors'
import { getFromEmail, sendResendEmail, type SendEmailResult } from '@/lib/email-service'
import { correspondencePrincipal, requireCorrespondenceWrite, requireCorrespondenceDisclosure } from './access'
import { CORRESPONDENCE_EMAIL_PURPOSE, CORRESPONDENCE_EMAIL_LEASE_MS, CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS,
  correspondenceEmailKey, correspondenceEmailHash, correspondenceEmailId, sealCorrespondenceEmail,
  verifiedCorrespondenceEmail, correspondenceEmailRetryAllowed, sealCorrespondenceEmailReceipt,
  verifiedCorrespondenceEmailReceipt, type CorrespondenceEmailIntent } from './email-intent'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { issueQueuedCaseMailCapability,queuedCaseMailContext } from '@/lib/authority/store/queued-case-mail'
import { verifiedCorrespondenceSignature, signedCorrespondenceDocumentHash } from './email-intent'

type QueueRow = typeof notificationQueue.$inferSelect
const purpose = sql`${notificationQueue.payload}->>'purpose' = ${CORRESPONDENCE_EMAIL_PURPOSE}`
const forLetter = (id: string) => and(purpose, sql`${notificationQueue.payload}->>'correspondenceId' = ${id}`)
const actor = 'system:correspondence-email-worker'

async function signedEmailMaterial(tx:RLSTx,letter:typeof correspondence.$inferSelect,key:string) {
  const recipients=await tx.select().from(correspondenceRecipients).where(eq(correspondenceRecipients.correspondenceId,letter.id))
  let signature
  try { signature=verifiedCorrespondenceSignature((letter.templateVariables as Record<string,unknown>|null)?.ueSignedEmailProof,key) }
  catch { throw ApiError.conflict('This letter needs a verified signature summary. Reopen it through the approval workflow and sign again before emailing.') }
  if(signature.organizationId !== letter.organizationId || signature.correspondenceId !== letter.id
    || signature.signatureId !== letter.signatureId || signature.signedBy !== letter.signedBy
    || signature.signedAt !== letter.signedAt?.toISOString() || letter.assignedSignerId !== letter.signedBy
    || signature.documentHash !== signedCorrespondenceDocumentHash(letter,recipients)) throw ApiError.conflict('The signed letter or its recipients changed. Nothing was sent.')
  if (!recipients.length || recipients.length > 20) throw ApiError.badRequest('Email requires between one and twenty recipients.')
  const addresses=new Map<string,string[]>()
  for(const recipient of recipients) {
    const parsed=z.string().email().max(320).safeParse(recipient.email?.trim())
    if(!parsed.success)throw ApiError.badRequest('Every recipient must have a valid email address. Nothing was queued.')
    const address=parsed.data.toLowerCase();addresses.set(address,[...(addresses.get(address)??[]),recipient.id])
  }
  for(const ids of addresses.values())ids.sort()
  const contentHash=correspondenceEmailHash({id:letter.id,organizationId:letter.organizationId,subject:letter.subject,body:letter.body,
    documentHash:signature.documentHash,
    signedAt:signature.signedAt,signedBy:signature.signedBy,signatureId:signature.signatureId,imageHash:signature.imageHash,
    recipients:[...addresses].sort(([a],[b])=>a.localeCompare(b))})
  return {signature,addresses,contentHash}
}

export async function readCorrespondenceQueueHealth(tx: RLSTx) {
  const [row] = await tx.execute<{unresolved:number}>(sql`SELECT count(*)::int AS unresolved FROM public.notification_queue
    WHERE payload->>'purpose'=${CORRESPONDENCE_EMAIL_PURPOSE} AND
      (status='failed' OR (status IN ('pending','retrying') AND created_at < now()-interval '15 minutes')
       OR (status='processing' AND (processed_at IS NULL OR processed_at < now()-interval '3 minutes')))`)
  if (!row || !Number.isInteger(row.unresolved) || row.unresolved < 0) throw new Error('Invalid correspondence queue measurement')
  return {state:row.unresolved === 0?'ok' as const:'fail' as const,unresolved:row.unresolved}
}

async function record(tx: RLSTx, row: QueueRow, event: string, details?: Record<string, unknown>) {
  await tx.insert(notificationDeliveryLog).values({ organizationId: row.organizationId,
    notificationId: row.id, event, eventTimestamp: new Date(), providerId: 'resend',
    externalEventId: typeof details?.providerMessageId === 'string' ? details.providerMessageId : null,
    details: details ?? {} })
  await persistAtomicAudit(tx, { organizationId: row.organizationId, userId: actor,
    action: `correspondence.email_${event}`, resourceType: 'notification_queue', resourceId: row.id,
    details: { purpose: CORRESPONDENCE_EMAIL_PURPOSE, ...details } })
}

async function acceptance(tx: RLSTx, intent: CorrespondenceEmailIntent, key: string) {
  const logs = await tx.select({ details: notificationDeliveryLog.details }).from(notificationDeliveryLog).where(and(
    eq(notificationDeliveryLog.organizationId, intent.organizationId),
    eq(notificationDeliveryLog.notificationId, intent.queueId), eq(notificationDeliveryLog.event, 'accepted')))
  for (const log of logs) {
    const receipt = verifiedCorrespondenceEmailReceipt(log.details, intent, key)
    if (receipt) return receipt
  }
  return null
}

/** The user's signed and approved intent, its frozen envelopes and the audit
 * commit together. The provider is never called from the tenant transaction. */
export async function queueCorrespondenceEmail(id: string, organizationId: string, userId: string) {
  const key = correspondenceEmailKey()
  return withRLSContext({ organizationId }, async tx => {
    const principal = correspondencePrincipal(organizationId, userId)
    const [letter] = await tx.select().from(correspondence).where(and(
      eq(correspondence.id,id), eq(correspondence.organizationId,organizationId))).for('update')
    if (!letter) throw ApiError.notFound('Correspondence')
    await requireCorrespondenceDisclosure(tx,letter,userId)
    if (letter.status !== 'signed' || !letter.signedAt || !letter.signedBy || !letter.signatureId
      || !letter.approvedBy || !letter.approvedAt) throw ApiError.conflict('Approve and sign the letter before sending email.')
    if (letter.attachments?.length || letter.signedPdfUrl || letter.signedPdfHash)
      throw ApiError.conflict('Email attachments require a verified document delivery path. This letter has not been sent.')
    const {signature,addresses,contentHash}=await signedEmailMaterial(tx,letter,key)
    // The approval screen presents literal text. Plain-text email must keep
    // that exact text, including comparison signs or literal markup examples.
    const text = `${letter.body}\n\n${signature.displayName}${signature.displayTitle ? '\n'+signature.displayTitle : ''}${letter.referenceNumber ? '\n'+letter.referenceNumber : ''}`
    const subject=`${letter.referenceNumber ? letter.referenceNumber+' — ' : ''}${letter.subject.replace(/[\r\n]+/g,' ')}`
    if(text.length>150000 || subject.length>600)throw ApiError.badRequest('The letter exceeds the email text limit. Shorten it through the approval workflow before sending.')
    const ids: string[] = []
    for (const [to,recipientIds] of addresses) {
      const queueId = correspondenceEmailId(organizationId,id,contentHash,to)
      ids.push(queueId)
      const [existing] = await tx.select().from(notificationQueue).where(eq(notificationQueue.id,queueId)).for('update')
      if (existing) {
        const frozen = verifiedCorrespondenceEmail(existing.payload,existing,key)
        if (frozen.contentHash !== contentHash || frozen.mail.to !== to) throw ApiError.conflict('The existing email intent cannot be reused.')
        if (!frozen.authorityCapability) {
          if(frozen.queuedBy!==userId)throw ApiError.conflict('The original sender must revalidate this historical email intent before it can be sent.')
          const authorityCapability=await issueQueuedCaseMailCapability(drizzleExecutor(tx),{queueId})
          const {seal:_seal,...unsigned}=frozen
          await tx.update(notificationQueue).set({payload:sealCorrespondenceEmail({...unsigned,authorityCapability},key)}).where(and(eq(notificationQueue.id,queueId),eq(notificationQueue.organizationId,organizationId)))
          await persistAtomicAudit(tx,{organizationId,userId,action:'CORRESPONDENCE_EMAIL_AUTHORITY_BOUND',resourceType:'notification_queue',resourceId:queueId,details:{correspondenceId:id}})
        }
        continue
      }
      const createdAt = new Date()
      const payload = sealCorrespondenceEmail({ purpose: CORRESPONDENCE_EMAIL_PURPOSE, version:1, queueId,
        organizationId, correspondenceId:id, queuedBy:userId, queuedRole:principal.role, contentHash,
        createdAt:createdAt.toISOString(), recipientIds, mail:{ from:getFromEmail(),to,
          subject,text } },key)
      await tx.insert(notificationQueue).values({ id:queueId,organizationId,payload,createdAt,status:'pending',maxAttempts:'3' })
      const authorityCapability=await issueQueuedCaseMailCapability(drizzleExecutor(tx),{queueId})
      const {seal:_seal,...unsigned}=payload
      await tx.update(notificationQueue).set({payload:sealCorrespondenceEmail({...unsigned,authorityCapability},key)}).where(and(eq(notificationQueue.id,queueId),eq(notificationQueue.organizationId,organizationId)))
      await persistAtomicAudit(tx,{ organizationId,userId,action:'CORRESPONDENCE_EMAIL_QUEUED',
        resourceType:'correspondence',resourceId:id,details:{ queueId,contentHash,recipientCount:recipientIds.length } })
    }
    return { state:'queued' as const, correspondenceId:id, tasks:ids.length }
  })
}

async function claimEmail(now: Date): Promise<{ row:QueueRow; intent:CorrespondenceEmailIntent; attempt:number } | null> {
  const key = correspondenceEmailKey()
  return withSystemContext(async tx => {
    const [row] = await tx.select().from(notificationQueue).where(and(purpose,or(
      and(or(eq(notificationQueue.status,'pending'),eq(notificationQueue.status,'retrying')),
        or(sql`${notificationQueue.nextRetryAt} IS NULL`,lte(notificationQueue.nextRetryAt,now))),
      and(eq(notificationQueue.status,'processing'),or(sql`${notificationQueue.processedAt} IS NULL`,
        lte(notificationQueue.processedAt,new Date(now.getTime()-CORRESPONDENCE_EMAIL_LEASE_MS)))),
    ))).orderBy(notificationQueue.createdAt,notificationQueue.id).limit(1).for('update',{ skipLocked:true })
    if (!row) return null
    let intent: CorrespondenceEmailIntent
    try { intent = verifiedCorrespondenceEmail(row.payload,row,key) } catch {
      await tx.update(notificationQueue).set({status:'failed',errorMessage:'CORRESPONDENCE_INVALID_SEAL',updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      await record(tx,row,'review_required',{reason:'invalid_seal'})
      return null
    }
    const receipt = await acceptance(tx,intent,key)
    if (receipt) {
      await tx.update(notificationQueue).set({status:'completed',completedAt:new Date(receipt.acceptedAt),updatedAt:now,errorMessage:null}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      await record(tx,row,'receipt_recovered',{ providerMessageId:receipt.providerMessageId })
      return null
    }
    const count = /^\d$/.test(row.attemptCount) ? Number(row.attemptCount) : 99
    if (!correspondenceEmailRetryAllowed(row.createdAt,now) || count >= 3) {
      await tx.update(notificationQueue).set({status:'failed',errorMessage:'CORRESPONDENCE_RECONCILIATION_REQUIRED',updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      await record(tx,row,'review_required',{reason:'retry_boundary'})
      return null
    }
    // The system transport may execute only the live principal's bounded, database-minted intent.
    if(!intent.authorityCapability) {
      await tx.update(notificationQueue).set({status:'failed',errorMessage:'CORRESPONDENCE_AUTHORITY_REVALIDATION_REQUIRED',updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      await record(tx,row,'review_required',{reason:'authority_capability_required'});return null
    }
    const context=await queuedCaseMailContext(drizzleExecutor(tx),{queueId:row.id,capability:intent.authorityCapability})
    // The bounded database verifier checks the current approval, signature
    // metadata, content and recipients against the immutable minted snapshot.
    // The transport consumes the sealed envelope without tenant-table access.
    if(!context.allowed) {
      await tx.update(notificationQueue).set({status:'failed',errorMessage:'CORRESPONDENCE_AUTHORITY_OR_CONTENT_CHANGED',updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      await record(tx,row,'suppressed',{reason:'authority_or_content_changed'});return null
    }
    const attempt = count+1
    await tx.update(notificationQueue).set({status:'processing',attemptCount:String(attempt),processedAt:now,
      nextRetryAt:null,errorMessage:null,updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
    await record(tx,row,'attempted',{attempt})
    return {row,intent,attempt}
  })
}

async function providerSubmission(intent: CorrespondenceEmailIntent): Promise<SendEmailResult> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      sendResendEmail(intent.mail,{feature:'approved-correspondence',correlationId:intent.queueId,
        idempotencyKey:`ue-letter/${intent.queueId}`,sensitiveContent:true,disableRetry:true,
        notAfter:Date.parse(intent.createdAt)+CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS}),
      new Promise<SendEmailResult>(resolve => { timer = setTimeout(() => resolve({success:false,code:'OUTCOME_UNKNOWN'}),8000) }),
    ])
  } catch { return {success:false,code:'OUTCOME_UNKNOWN'} }
  finally { if (timer) clearTimeout(timer) }
}

/** Short, separately committed claims and receipts surround network I/O.
 * A lost acknowledgement reuses exactly the sealed envelope and provider key
 * within23h. After that boundary operator reconciliation is required. */
export async function processCorrespondenceEmails(limit = 5) {
  const report = {attempted:0,accepted:0,unconfirmed:0}
  for (let i=0;i<Math.min(10,Math.max(1,limit));i++) {
    const claimed = await claimEmail(new Date())
    if (!claimed) break
    report.attempted++
    const result = await providerSubmission(claimed.intent)
    const accepted = result.success && z.string().uuid().safeParse(result.messageId).success
    await withSystemContext(async tx => {
      const [row] = await tx.select().from(notificationQueue).where(and(eq(notificationQueue.id,claimed.row.id),eq(notificationQueue.organizationId,claimed.row.organizationId))).for('update')
      if (!row) throw new Error('Correspondence queue task disappeared')
      const intent = verifiedCorrespondenceEmail(row.payload,row,correspondenceEmailKey())
      if (intent.seal !== claimed.intent.seal) throw new Error('Correspondence intent changed during submission')
      if (await acceptance(tx,intent,correspondenceEmailKey())) return
      const now = new Date()
      if (accepted) {
        const receipt = sealCorrespondenceEmailReceipt({queueId:row.id,organizationId:row.organizationId,
          correspondenceId:intent.correspondenceId,contentHash:intent.contentHash,
          providerMessageId:result.messageId!,acceptedAt:now.toISOString()},correspondenceEmailKey())
        await record(tx,row,'accepted',{...receipt})
        await tx.update(notificationQueue).set({status:'completed',completedAt:now,updatedAt:now,errorMessage:null}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
      } else if (row.status === 'processing' && row.attemptCount === String(claimed.attempt)) {
        const permanent = result.statusCode !== undefined && result.statusCode >= 400 && result.statusCode < 500
          && ![408,409,425,429].includes(result.statusCode)
        const retry = !permanent && claimed.attempt < 3 && correspondenceEmailRetryAllowed(row.createdAt,now)
        const reason = permanent ? 'CORRESPONDENCE_PROVIDER_REJECTED' : 'CORRESPONDENCE_OUTCOME_UNCONFIRMED'
        await tx.update(notificationQueue).set({status:retry?'retrying':'failed',errorMessage:reason,
          nextRetryAt:retry?new Date(now.getTime()+60_000):null,updatedAt:now}).where(and(eq(notificationQueue.id,row.id),eq(notificationQueue.organizationId,row.organizationId)))
        await record(tx,row,permanent?'rejected':'unconfirmed',{attempt:claimed.attempt,reason})
      }
    })
    if (accepted) report.accepted++; else report.unconfirmed++
  }
  return report
}

/** Authenticated finalization never sends email. A browser can safely repeat
 * it after a lost response; signed provider receipts remain authoritative. */
export async function settleCorrespondenceEmail(id: string, organizationId: string, userId: string) {
  const key = correspondenceEmailKey()
  return withRLSContext({organizationId},async tx => {
    correspondencePrincipal(organizationId,userId)
    const [letter] = await tx.select().from(correspondence).where(and(eq(correspondence.id,id),
      eq(correspondence.organizationId,organizationId))).for('update')
    if (!letter) throw ApiError.notFound('Correspondence')
    await requireCorrespondenceWrite(tx,letter,userId)
    if (letter.status === 'cancelled') return {state:'cancelled' as const,accepted:0,total:0}
    const tasks = await tx.select().from(notificationQueue).where(and(forLetter(id),eq(notificationQueue.organizationId,organizationId)))
    if(!tasks.length)return {state:'not_queued' as const,accepted:0,total:0}
    const material=await signedEmailMaterial(tx,letter,key)
    const intents = tasks.map(row => ({row,intent:verifiedCorrespondenceEmail(row.payload,row,key)}))
      .filter(({intent}) => intent.contentHash === material.contentHash)
    if (!intents.length) return {state:'not_queued' as const,accepted:0,total:0}
    const receipts = await Promise.all(intents.map(({intent}) => acceptance(tx,intent,key)))
    const accepted = receipts.filter(r => r !== null)
    if (accepted.length !== intents.length) return {state:intents.some(v => v.row.status === 'failed' || v.row.status === 'completed')?'review_required' as const:'queued' as const,
      accepted:accepted.length,total:intents.length}
    if (letter.status === 'dispatched' && letter.dispatchMethod === 'email') return {state:'accepted' as const,accepted:accepted.length,total:intents.length}
    if (letter.status !== 'signed') throw ApiError.conflict('Email acceptance needs correspondence reconciliation.')
    const acknowledgedAt = new Date(Math.max(...accepted.map(r => Date.parse(r.acceptedAt))))
    await tx.update(correspondence).set({status:'dispatched',dispatchMethod:'email',dispatchedAt:acknowledgedAt,
      dispatchedBy:intents[0].intent.queuedBy,updatedAt:new Date()}).where(and(eq(correspondence.id,id),eq(correspondence.organizationId,organizationId)))
    await appendAuditEntry({exec:tx,correspondenceId:id,eventType:'dispatched',actorUserId:userId,
      description:'Email accepted by provider; inbox receipt is separate',metadata:{queueIds:intents.map(v=>v.row.id)}})
    await persistAtomicAudit(tx,{organizationId,userId,action:'CORRESPONDENCE_DISPATCHED',resourceType:'correspondence',resourceId:id,
      details:{dispatchMethod:'email',queuedBy:intents[0].intent.queuedBy,queueIds:intents.map(v=>v.row.id),providerAcceptedAt:acknowledgedAt.toISOString()}})
    return {state:'accepted' as const,accepted:accepted.length,total:intents.length}
  })
}
