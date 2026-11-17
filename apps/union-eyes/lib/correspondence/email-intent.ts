import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { canonicalPythonJson } from '@/lib/audit/canonical-audit-chain'

export const CORRESPONDENCE_EMAIL_PURPOSE = 'approved_correspondence_email_v1'
// Resend retains idempotency keys for24h. Stop automatic retries before that
// boundary; a stale or ambiguous task needs reconciliation, never a fresh key.
export const CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000
export const CORRESPONDENCE_EMAIL_LEASE_MS = 90000

const signatureSummarySchema = z.object({purpose:z.literal('ue-correspondence-signature/1'),
  organizationId:z.string().uuid(),correspondenceId:z.string().uuid(),signatureId:z.string().uuid(),
  signedBy:z.string().min(1),signedAt:z.string().datetime(),documentHash:z.string().regex(/^[a-f0-9]{64}$/),
  imageHash:z.string().regex(/^[a-f0-9]{64}$/),displayName:z.string().min(1).max(255),displayTitle:z.string().nullable(),
  seal:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
export type CorrespondenceSignatureSummary = z.infer<typeof signatureSummarySchema>

/** No private signature image or URL is copied into a staff-readable letter. */
export function sealCorrespondenceSignature(input:Omit<CorrespondenceSignatureSummary,'seal'>,key:string):CorrespondenceSignatureSummary {
  return signatureSummarySchema.parse({...input,seal:createHmac('sha256',key).update('ue-correspondence-signature/1\n'+canonicalPythonJson(input)).digest('hex')})
}

export function verifiedCorrespondenceSignature(value:unknown,key:string):CorrespondenceSignatureSummary {
  const input=signatureSummarySchema.parse(value)
  const {seal,...unsigned}=input
  const expected=sealCorrespondenceSignature(unsigned,key).seal
  if(!timingSafeEqual(Buffer.from(seal,'hex'),Buffer.from(expected,'hex')))throw new Error('Correspondence signature summary seal mismatch')
  return input
}

export function signedCorrespondenceDocumentHash(letter:{id:string;organizationId:string;subject:string;body:string;
  referenceNumber:string|null;approvedBy:string|null;approvedAt:Date|null;assignedSignerId:string|null},recipients:readonly {
    id:string;name:string;email:string|null;recipientType:string;mailingAddress:string|null;organization:string|null;title:string|null}[]) {
  return correspondenceEmailHash({id:letter.id,organizationId:letter.organizationId,referenceNumber:letter.referenceNumber,subject:letter.subject,body:letter.body,
    approvedBy:letter.approvedBy,approvedAt:letter.approvedAt?.toISOString()??null,assignedSignerId:letter.assignedSignerId,
    recipients:recipients.map(r=>({id:r.id,name:r.name,email:r.email,recipientType:r.recipientType,
      mailingAddress:r.mailingAddress,organization:r.organization,title:r.title})).sort((a,b)=>a.id.localeCompare(b.id))})
}

const emailIntentSchema = z.object({
  purpose: z.literal(CORRESPONDENCE_EMAIL_PURPOSE), version: z.literal(1),
  queueId: z.string().uuid(), organizationId: z.string().uuid(), correspondenceId: z.string().uuid(),
  queuedBy: z.string().min(1).max(255), queuedRole: z.string().min(1).max(100),
  // Historical sealed intents remain readable; a worker cannot send one until the live actor binds its capability.
  authorityCapability:z.string().min(32).max(512).optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/), createdAt: z.string().datetime(),
  recipientIds: z.array(z.string().uuid()).min(1).max(100),
  mail: z.object({ from: z.string().min(1).max(500), to: z.string().email().max(320),
    subject: z.string().min(1).max(600), text: z.string().min(1).max(150000) }).strict(),
  seal: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()
export type CorrespondenceEmailIntent = z.infer<typeof emailIntentSchema>
export type UnsignedEmailIntent = Omit<CorrespondenceEmailIntent, 'seal'>

export function correspondenceEmailKey(): string {
  const key = process.env.EVIDENCE_SEAL_KEY
  if (!key || Buffer.byteLength(key,'utf8') < 32) throw new Error('Correspondence queue signing is not configured')
  return key
}

export function correspondenceEmailHash(value: unknown): string {
  return createHash('sha256').update(canonicalPythonJson(value)).digest('hex')
}

export function correspondenceEmailId(organizationId: string, letterId: string, contentHash: string, email: string): string {
  const h = correspondenceEmailHash(['ue-correspondence-email/1',organizationId,letterId,contentHash,email.toLowerCase()])
  return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`
}

export function sealCorrespondenceEmail(input: UnsignedEmailIntent, key: string): CorrespondenceEmailIntent {
  const seal = createHmac('sha256',key).update(CORRESPONDENCE_EMAIL_PURPOSE+'\n'+canonicalPythonJson(input)).digest('hex')
  return emailIntentSchema.parse({ ...input, seal })
}

export function verifiedCorrespondenceEmail(payload: unknown, row: {
  id: string; organizationId: string; createdAt: Date
}, key: string): CorrespondenceEmailIntent {
  const input = emailIntentSchema.parse(payload)
  if (input.queueId !== row.id || input.organizationId !== row.organizationId || input.createdAt !== row.createdAt.toISOString())
    throw new Error('Correspondence queue identity mismatch')
  const { seal, ...unsigned } = input
  const expected = sealCorrespondenceEmail(unsigned,key).seal
  if (!timingSafeEqual(Buffer.from(seal,'hex'),Buffer.from(expected,'hex'))) throw new Error('Correspondence queue seal mismatch')
  return input
}

export function correspondenceEmailRetryAllowed(createdAt: Date, now = new Date()): boolean {
  const age = now.getTime() - createdAt.getTime()
  return Number.isFinite(age) && age >= 0 && age < CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS
}

export interface CorrespondenceEmailReceipt {
  queueId: string; organizationId: string; correspondenceId: string; contentHash: string;
  providerMessageId: string; acceptedAt: string; seal: string
}

export function sealCorrespondenceEmailReceipt(input: Omit<CorrespondenceEmailReceipt,'seal'>, key: string): CorrespondenceEmailReceipt {
  return { ...input, seal: createHmac('sha256',key).update('ue-correspondence-accepted/1\n'+canonicalPythonJson(input)).digest('hex') }
}

/** Ordinary notification ledger rows cannot manufacture a correspondence send. */
export function verifiedCorrespondenceEmailReceipt(value: unknown, intent: CorrespondenceEmailIntent, key: string): CorrespondenceEmailReceipt | null {
  if (!value || typeof value !== 'object') return null
  const r = value as CorrespondenceEmailReceipt
  if (r.queueId !== intent.queueId || r.organizationId !== intent.organizationId
    || r.correspondenceId !== intent.correspondenceId || r.contentHash !== intent.contentHash
    || !z.string().uuid().safeParse(r.providerMessageId).success
    || !Number.isFinite(Date.parse(r.acceptedAt)) || typeof r.seal !== 'string' || !/^[a-f0-9]{64}$/.test(r.seal)) return null
  const unsigned = { queueId: r.queueId, organizationId: r.organizationId, correspondenceId: r.correspondenceId,
    contentHash: r.contentHash, providerMessageId: r.providerMessageId, acceptedAt: r.acceptedAt }
  const expected = sealCorrespondenceEmailReceipt(unsigned,key)
  return timingSafeEqual(Buffer.from(r.seal,'hex'),Buffer.from(expected.seal,'hex')) ? expected : null
}
