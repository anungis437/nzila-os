import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { redactSignerNetworkData, signatureViewForViewer } from '../signer-privacy'

const document = {
  id: 'd1',
  sentBy: 'sender',
  signers: [
    { userId: 'a', email: 'a@example.test', ipAddress: '10.0.0.1', userAgent: 'UA-A', geolocation: { city: 'X' } },
    { userId: 'b', email: 'b@example.test', ipAddress: '10.0.0.2', userAgent: 'UA-B', geolocation: { city: 'Y' } },
  ],
}

describe('B44 signer network data (DEF-0B11-SOC-SIGNATURE-STATUS-AND-AUDIT-DISCLOSE-E...)', () => {
  it('shows the sender every signer row whole', () => {
    expect(signatureViewForViewer(document, 'sender', 'sender')).toEqual(document)
  })

  it('shows a signer only their own network data', () => {
    const view = signatureViewForViewer(document, 'a', 'sender')
    expect(view.signers[0]).toMatchObject({ ipAddress: '10.0.0.1', userAgent: 'UA-A' })
    expect(view.signers[0].email).toBe('a@example.test')
    expect(view.signers[1]).toEqual({ userId: 'b' })
  })

  it('removes network data from audit rows that describe someone else', () => {
    const rows = [
      { actorUserId: 'a', ipAddress: '10.0.0.1', eventType: 'signed' },
      { actorUserId: 'b', ipAddress: '10.0.0.2', userAgent: 'UA-B', eventType: 'signed' },
    ]
    expect(redactSignerNetworkData(rows, 'a')).toEqual([rows[0], { actorUserId: 'b', eventType: 'signed' }])
  })


  it('does not leak a peer signer through a viewer-owned outer report', () => {
    const view = redactSignerNetworkData({
      userId: 'a',
      signers: [
        { userId: 'a', email: 'a@example.test', ipAddress: '10.0.0.1' },
        { userId: 'b', email: 'b@example.test', ipAddress: '10.0.0.2' },
      ],
    }, 'a')
    expect(view.signers).toEqual([
      { userId: 'a', email: 'a@example.test', ipAddress: '10.0.0.1' },
      { userId: 'b' },
    ])
  })

  it('redacts unstructured audit descriptions containing peer identity or network details', () => {
    const view = signatureViewForViewer([
      { actorUserId: 'b', eventType: 'signer_status_updated',
        eventDescription: 'Signer b@example.test signed from 10.0.0.2',
        metadata: { signerEmail: 'b@example.test', ip_address: '10.0.0.2', outcome: 'signed' } },
      { actorUserId: 'a', eventType: 'signed', eventDescription: 'Own signature recorded' },
    ], 'a', 'sender')
    expect(view).toEqual([
      { actorUserId: 'b', eventType: 'signer_status_updated', metadata: { outcome: 'signed' } },
      { actorUserId: 'a', eventType: 'signed', eventDescription: 'Own signature recorded' },
    ])
  })

  it('does not treat the actor of a peer-signature event as owner of the peer email', () => {
    const event = {
      actorUserId: 'a', signerEmail: 'b@example.test',
      email: 'b@example.test', ipAddress: '10.0.0.1', eventType: 'signer_status_updated',
    }
    expect(redactSignerNetworkData(event, 'a')).toEqual({
      actorUserId: 'a', ipAddress: '10.0.0.1', eventType: 'signer_status_updated',
    })
  })

  it('preserves the sender audit report unchanged', () => {
    const report = [{ actorUserId: 'b', email: 'b@example.test', eventDescription: 'Signer b@example.test signed' }]
    expect(signatureViewForViewer(report, 'sender', 'sender')).toEqual(report)
  })

  it('leaves dates untouched', () => {
    const when = new Date()
    expect(redactSignerNetworkData({ signedAt: when }, 'a').signedAt).toBe(when)
  })
})

describe('B44 signature routes', () => {
  const read = (path: string) => readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), path), 'utf8')

  it('applies the void schema, with a bounded reason, instead of reading the raw body', () => {
    const route = read('app/api/signatures/documents/[id]/route.ts')
    expect(route).toContain('signaturesDocumentsSchema.safeParse(body)')
    expect(route).toContain('.max(1000)')
    expect(route).not.toContain('const { action, reason } = body')
  })

  it('redacts the status and the audit trail for a viewer who is not the sender', () => {
    expect(read('app/api/signatures/documents/[id]/route.ts')).toContain('signatureViewForViewer(')
    expect(read('app/api/signatures/audit/[documentId]/route.ts')).toContain('signatureViewForViewer(')
  })

  it('pages the caller own document list and states the audit report is unsealed', () => {
    const service = read('lib/signature/signature-service.ts')
    expect(service.match(/\.limit\(USER_DOCUMENT_LIMIT\)/g)).toHaveLength(2)
    expect(service).toContain('hashChained: false')
  })
})
