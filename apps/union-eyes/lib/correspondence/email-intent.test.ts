import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { correspondenceEmailId, correspondenceEmailHash, sealCorrespondenceEmail, verifiedCorrespondenceEmail,
  correspondenceEmailRetryAllowed, sealCorrespondenceEmailReceipt, verifiedCorrespondenceEmailReceipt,
  CORRESPONDENCE_EMAIL_PURPOSE, CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS } from './email-intent'
import { sealCorrespondenceSignature,verifiedCorrespondenceSignature,signedCorrespondenceDocumentHash } from './email-intent'

const key = 'synthetic-correspondence-seal-key-123456789'
const organizationId = randomUUID(), correspondenceId = randomUUID(), createdAt = new Date('2026-11-17T13:00:00.000Z')
const contentHash = correspondenceEmailHash({body:'Approved text é😀',signedBy:'signer'})
const queueId = correspondenceEmailId(organizationId,correspondenceId,contentHash,'controlled@example.invalid')
const input = {purpose:CORRESPONDENCE_EMAIL_PURPOSE,version:1 as const,queueId,organizationId,correspondenceId,
  queuedBy:randomUUID(),queuedRole:'steward',contentHash,createdAt:createdAt.toISOString(),recipientIds:[randomUUID()],
  mail:{from:'sender@example.invalid',to:'controlled@example.invalid',subject:'Approved letter',text:'Approved text é😀'}}
const row = {id:queueId,organizationId,createdAt}

describe('durable correspondence email intent and acceptance',()=>{
  it('binds the signer summary to the approved document and recipients without copying a private signature image',()=>{
    const letter={id:correspondenceId,organizationId,referenceNumber:'LTR-2026-0001',subject:'Approved',body:'Text',
      approvedBy:randomUUID(),approvedAt:createdAt,assignedSignerId:randomUUID()}
    const recipient={id:randomUUID(),name:'Synthetic',email:'controlled@example.invalid',recipientType:'to',mailingAddress:null,organization:null,title:null}
    const hash=signedCorrespondenceDocumentHash(letter,[recipient])
    const summary=sealCorrespondenceSignature({purpose:'ue-correspondence-signature/1',organizationId,correspondenceId,
      signatureId:randomUUID(),signedBy:letter.assignedSignerId,signedAt:createdAt.toISOString(),documentHash:hash,
      displayName:'Synthetic Signer',displayTitle:null,imageHash:'a'.repeat(64)},key)
    expect(verifiedCorrespondenceSignature(summary,key)).toEqual(summary)
    expect(()=>verifiedCorrespondenceSignature({...summary,displayName:'Another person'},key)).toThrow('seal')
    expect(signedCorrespondenceDocumentHash({...letter,body:'Changed'},[recipient])).not.toBe(hash)
    expect(signedCorrespondenceDocumentHash(letter,[{...recipient,email:'other@example.invalid'}])).not.toBe(hash)
    expect(JSON.stringify(summary)).not.toContain('imageUrl')
  })
  it('keeps the same task identity across retries, without merging different letters or versions',()=>{
    expect(correspondenceEmailId(organizationId,correspondenceId,contentHash,input.mail.to.toUpperCase())).toBe(queueId)
    expect(correspondenceEmailId(organizationId,randomUUID(),contentHash,input.mail.to)).not.toBe(queueId)
    expect(correspondenceEmailId(organizationId,correspondenceId,'a'.repeat(64),input.mail.to)).not.toBe(queueId)
  })
  it('binds the actual envelope, actor, organization, task and creation time to its seal',()=>{
    const intent = sealCorrespondenceEmail(input,key)
    expect(verifiedCorrespondenceEmail(intent,row,key)).toEqual(intent)
    expect(()=>verifiedCorrespondenceEmail({...intent,mail:{...intent.mail,to:'other@example.invalid'}},row,key)).toThrow('seal')
    expect(()=>verifiedCorrespondenceEmail({...intent,queuedBy:randomUUID()},row,key)).toThrow('seal')
    expect(()=>verifiedCorrespondenceEmail(intent,{...row,organizationId:randomUUID()},key)).toThrow('identity')
    expect(()=>verifiedCorrespondenceEmail(intent,{...row,createdAt:new Date(createdAt.getTime()+1)},key)).toThrow('identity')
    expect(()=>verifiedCorrespondenceEmail(intent,row,key+'other')).toThrow('seal')
  })
  it('stops before the provider key expires, including invalid or future dates',()=>{
    expect(correspondenceEmailRetryAllowed(createdAt,new Date(createdAt.getTime()+CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS-1))).toBe(true)
    expect(correspondenceEmailRetryAllowed(createdAt,new Date(createdAt.getTime()+CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS))).toBe(false)
    expect(correspondenceEmailRetryAllowed(createdAt,new Date(createdAt.getTime()-1))).toBe(false)
    expect(correspondenceEmailRetryAllowed(new Date('invalid'))).toBe(false)
  })
  it('does not turn a forged ledger row, another letter receipt or an invalid provider ID into acceptance',()=>{
    const intent=sealCorrespondenceEmail(input,key)
    const receipt=sealCorrespondenceEmailReceipt({queueId,organizationId,correspondenceId,contentHash,
      providerMessageId:randomUUID(),acceptedAt:createdAt.toISOString()},key)
    expect(verifiedCorrespondenceEmailReceipt(receipt,intent,key)).toEqual(receipt)
    expect(verifiedCorrespondenceEmailReceipt({...receipt,providerMessageId:randomUUID()},intent,key)).toBeNull()
    expect(verifiedCorrespondenceEmailReceipt({...receipt,contentHash:'b'.repeat(64)},intent,key)).toBeNull()
    expect(verifiedCorrespondenceEmailReceipt({...receipt,seal:'0'.repeat(64)},intent,key)).toBeNull()
    expect(verifiedCorrespondenceEmailReceipt({...receipt,providerMessageId:'not-a-provider-id'},intent,key)).toBeNull()
    expect(verifiedCorrespondenceEmailReceipt(receipt,{...intent,correspondenceId:randomUUID()},key)).toBeNull()
  })
})
