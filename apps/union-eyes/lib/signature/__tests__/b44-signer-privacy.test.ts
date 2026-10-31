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
    expect(view.signers[1]).toEqual({ userId: 'b', email: 'b@example.test' })
  })

  it('removes network data from audit rows that describe someone else', () => {
    const rows = [
      { actorUserId: 'a', ipAddress: '10.0.0.1', eventType: 'signed' },
      { actorUserId: 'b', ipAddress: '10.0.0.2', userAgent: 'UA-B', eventType: 'signed' },
    ]
    expect(redactSignerNetworkData(rows, 'a')).toEqual([rows[0], { actorUserId: 'b', eventType: 'signed' }])
  })

  it('leaves dates untouched', () => {
    const when = new Date()
    expect(redactSignerNetworkData({ signedAt: when }, 'a').signedAt).toBe(when)
  })
})

describe('B44 signature routes', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

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
