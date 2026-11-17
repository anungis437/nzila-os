import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { canonicalPythonJson } from '@/lib/audit/canonical-audit-chain'

export const CASE_STATUS_EMAIL_PURPOSE = 'case_status_notification_v1'
const statuses = z.enum(['submitted','under_review','assigned','investigation','pending_documentation','resolved','rejected','closed'])
const mail = z.object({from:z.string().min(1).max(500),to:z.string().email().max(320),
  subject:z.string().min(1).max(600),text:z.string().min(1).max(2000)}).strict()
const schema = z.object({purpose:z.literal(CASE_STATUS_EMAIL_PURPOSE),version:z.literal(1),
  queueId:z.string().uuid(),organizationId:z.string().uuid(),caseId:z.string().uuid(),
  queuedBy:z.string().min(1).max(255),recipientId:z.string().min(1).max(255),
  previousStatus:statuses,newStatus:statuses,createdAt:z.string().datetime(),mail:mail.nullable(),
  authorityCapability:z.string().min(32).max(512),
  seal:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
export type CaseStatusEmailIntent = z.infer<typeof schema>

/** The machine can deliver only a frozen, state-only intent committed by an authorized transition. */
export function sealCaseStatusEmail(input:Omit<CaseStatusEmailIntent,'seal'>,key:string):CaseStatusEmailIntent {
  return schema.parse({...input,seal:createHmac('sha256',key).update(CASE_STATUS_EMAIL_PURPOSE+'\n'+canonicalPythonJson(input)).digest('hex')})
}
export function verifyCaseStatusEmail(value:unknown,row:{id:string;organizationId:string;createdAt:Date},key:string) {
  const input=schema.parse(value)
  if(input.queueId!==row.id || input.organizationId!==row.organizationId || input.createdAt!==row.createdAt.toISOString())throw new Error('Case notification context mismatch')
  const {seal,...unsigned}=input
  const expected=sealCaseStatusEmail(unsigned,key).seal
  if(!timingSafeEqual(Buffer.from(seal,'hex'),Buffer.from(expected,'hex')))throw new Error('Invalid case notification seal')
  return input
}

const receiptSchema=z.object({purpose:z.literal('case_status_email_receipt_v1'),queueId:z.string().uuid(),
  organizationId:z.string().uuid(),intentSeal:z.string().regex(/^[a-f0-9]{64}$/),
  providerMessageId:z.string().uuid(),acceptedAt:z.string().datetime(),seal:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
export function sealCaseStatusReceipt(input:Omit<z.infer<typeof receiptSchema>,'seal'>,key:string) {
  return receiptSchema.parse({...input,seal:createHmac('sha256',key).update('case-status-receipt/1\n'+canonicalPythonJson(input)).digest('hex')})
}
export function verifyCaseStatusReceipt(value:unknown,intent:CaseStatusEmailIntent,key:string) {
  const parsed=receiptSchema.safeParse(value)
  if(!parsed.success)return null
  const {seal,...unsigned}=parsed.data
  if(unsigned.queueId!==intent.queueId || unsigned.organizationId!==intent.organizationId || unsigned.intentSeal!==intent.seal)return null
  const expected=sealCaseStatusReceipt(unsigned,key).seal
  return timingSafeEqual(Buffer.from(seal,'hex'),Buffer.from(expected,'hex'))?parsed.data:null
}

/** State-only copy; no case identifier, staff narrative or personal name enters the message. */
export function renderCaseStatusNotification(status:CaseStatusEmailIntent['newStatus'],locale?:string|null):{subject:string;text:string} {
  const checked=statuses.parse(status)
  const french=/^fr(?:[-_]|$)/i.test(locale ?? '')
  const labels:Record<CaseStatusEmailIntent['newStatus'],[string,string]>={
    submitted:['Submitted','Soumis'],under_review:['Under review','En cours d’examen'],assigned:['Assigned','Attribué'],
    investigation:['Investigation','Enquête'],pending_documentation:['Awaiting documentation','En attente de documents'],
    resolved:['Resolved','Résolu'],rejected:['Rejected','Rejeté'],closed:['Closed','Fermé'],
  }
  return french ? {subject:'Le statut de votre dossier a été mis à jour',
    text:`Nouveau statut de votre dossier : ${labels[checked][1]}. Connectez-vous à Union Eyes pour consulter votre dossier.`}
    : {subject:'Your case status was updated',
      text:`Your case status was updated to ${labels[checked][0]}. Sign in to Union Eyes to view your case.`}
}
