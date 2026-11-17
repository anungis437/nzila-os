import {describe,it,expect} from 'vitest'
import {randomUUID} from 'node:crypto'
import {CASE_STATUS_EMAIL_PURPOSE,sealCaseStatusEmail,verifyCaseStatusEmail,sealCaseStatusReceipt,verifyCaseStatusReceipt} from './case-status-intent'
const key='synthetic-test-seal-key-not-a-real-key-123456'
const createdAt=new Date('2026-11-17T13:00:00.000Z')
const input={purpose:CASE_STATUS_EMAIL_PURPOSE,version:1 as const,queueId:randomUUID(),organizationId:randomUUID(),caseId:randomUUID(),
 queuedBy:randomUUID(),recipientId:randomUUID(),previousStatus:'submitted' as const,newStatus:'under_review' as const,
 createdAt:createdAt.toISOString(),mail:null,authorityCapability:'synthetic-token-'.repeat(4)}
const row={id:input.queueId,organizationId:input.organizationId,createdAt}
describe('case state notification seals',()=>{
 it('binds actor, resource, recipient, organization, exact state and capability',()=>{
  const intent=sealCaseStatusEmail(input,key)
  expect(verifyCaseStatusEmail(intent,row,key)).toEqual(intent)
  for(const change of [{queuedBy:randomUUID()},{caseId:randomUUID()},{recipientId:randomUUID()},{newStatus:'closed'},{authorityCapability:'another-token-'.repeat(4)}])
   expect(()=>verifyCaseStatusEmail({...intent,...change},row,key)).toThrow('seal')
  expect(()=>verifyCaseStatusEmail(intent,{...row,organizationId:randomUUID()},key)).toThrow('context')
  expect(()=>verifyCaseStatusEmail(intent,{...row,createdAt:new Date(createdAt.getTime()+1)},key)).toThrow('context')
 })
 it('does not accept staff notes or arbitrary extra payload as a status intent',()=>{
  expect(()=>sealCaseStatusEmail({...input,notes:'private strategy'} as never,key)).toThrow()
  expect(()=>sealCaseStatusEmail({...input,newStatus:'forged-status'} as never,key)).toThrow()
 })
 it('freezes the actual destination and minimal message in the seal',()=>{
  const intent=sealCaseStatusEmail({...input,mail:{from:'sender@example.invalid',to:'member@example.invalid',subject:'Case update',text:'Your case status changed.'}},key)
  expect(verifyCaseStatusEmail(intent,row,key)).toEqual(intent)
  expect(()=>verifyCaseStatusEmail({...intent,mail:{...intent.mail,to:'other@example.invalid'}},row,key)).toThrow('seal')
 })
 it('recognizes only a sealed provider receipt for this exact frozen intent',()=>{
  const intent=sealCaseStatusEmail(input,key)
  const receipt=sealCaseStatusReceipt({purpose:'case_status_email_receipt_v1',queueId:input.queueId,organizationId:input.organizationId,
   intentSeal:intent.seal,providerMessageId:randomUUID(),acceptedAt:createdAt.toISOString()},key)
  expect(verifyCaseStatusReceipt(receipt,intent,key)).toEqual(receipt)
  expect(verifyCaseStatusReceipt({...receipt,providerMessageId:randomUUID()},intent,key)).toBeNull()
  expect(verifyCaseStatusReceipt({...receipt,seal:'0'.repeat(64)},intent,key)).toBeNull()
  expect(verifyCaseStatusReceipt(receipt,{...intent,seal:'a'.repeat(64)},key)).toBeNull()
 })
})
