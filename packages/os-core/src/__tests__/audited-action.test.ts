/**
 * @nzila/os-core — Audited Action tests
 */
import { describe, it, expect } from 'vitest'
import { auditedAction } from '../audited-action'

const baseInput = {
  actionType: 'test.action',
  orgId: 'org-1',
  userId: 'user-1',
}

describe('auditedAction', () => {
  it('returns success result with audit record', async () => {
    const result = await auditedAction(baseInput, async () => 'done')

    expect(result.success).toBe(true)
    expect(result.data).toBe('done')
    expect(result.actionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.artifacts).toEqual([])

    expect(result.auditRecord.actionType).toBe('test.action')
    expect(result.auditRecord.orgId).toBe('org-1')
    expect(result.auditRecord.userId).toBe('user-1')
    expect(result.auditRecord.outcome).toBe('success')
    expect(result.auditRecord.artifactCount).toBe(0)
  })

  it('records metadata', async () => {
    const result = await auditedAction(
      { ...baseInput, metadata: { orderId: 'ord-1' } },
      async () => 42,
    )

    expect(result.auditRecord.metadata).toEqual({ orderId: 'ord-1' })
  })

  it('collects artifacts', async () => {
    const result = await auditedAction(baseInput, async (ctx) => {
      ctx.addArtifact(
        'receipt',
        Buffer.from('hello'),
        'text/plain',
        { filename: 'receipt.txt', description: 'A receipt' },
      )
      ctx.addArtifact(
        'invoice',
        Buffer.from('{}'),
        'application/json',
      )
      return 'ok'
    })

    expect(result.artifacts).toHaveLength(2)
    expect(result.artifacts[0]!.artifactType).toBe('receipt')
    expect(result.artifacts[0]!.filename).toBe('receipt.txt')
    expect(result.artifacts[0]!.description).toBe('A receipt')
    expect(result.artifacts[0]!.contentType).toBe('text/plain')
    expect(result.artifacts[1]!.artifactType).toBe('invoice')
    expect(result.artifacts[1]!.filename).toBe('invoice.bin') // default name
    expect(result.auditRecord.artifactCount).toBe(2)
  })

  it('rethrows on failure and attaches audit record to error', async () => {
    const err = new Error('boom')
    try {
      await auditedAction(baseInput, async () => {
        throw err
      })
      expect.unreachable('should have thrown')
    } catch (caught) {
      expect(caught).toBe(err)
      const e = caught as Error & { auditRecord?: Record<string, unknown>; artifacts?: unknown[] }
      expect(e.auditRecord).toBeDefined()
      expect(e.auditRecord!.outcome).toBe('failure')
      expect(e.auditRecord!.errorMessage).toBe('boom')
      expect(e.artifacts).toBeDefined()
    }
  })

  it('handles non-Error throws', async () => {
    try {
      await auditedAction(baseInput, async () => {
        throw 'string-error'
      })
      expect.unreachable('should have thrown')
    } catch (caught) {
      // String throws can't have properties attached
      expect(caught).toBe('string-error')
    }
  })

  it('uses default retentionClass and classification', async () => {
    const result = await auditedAction(baseInput, async (ctx) => {
      ctx.addArtifact('doc', Buffer.from('x'), 'text/plain')
      return null
    })

    expect(result.artifacts[0]!.retentionClass).toBe('7_YEARS')
    expect(result.artifacts[0]!.classification).toBe('INTERNAL')
  })

  it('allows overriding retentionClass and classification', async () => {
    const result = await auditedAction(
      { ...baseInput, retentionClass: 'PERMANENT', classification: 'CONFIDENTIAL' },
      async (ctx) => {
        ctx.addArtifact('doc', Buffer.from('x'), 'text/plain')
        return null
      },
    )

    expect(result.artifacts[0]!.retentionClass).toBe('PERMANENT')
    expect(result.artifacts[0]!.classification).toBe('CONFIDENTIAL')
  })

  it('actionId from context matches result actionId', async () => {
    let ctxActionId: string | undefined
    const result = await auditedAction(baseInput, async (ctx) => {
      ctxActionId = ctx.actionId
      return null
    })

    expect(ctxActionId).toBe(result.actionId)
  })

  it('sets timing fields', async () => {
    const result = await auditedAction(baseInput, async () => {
      // small delay
      return 'fast'
    })

    expect(result.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(result.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(new Date(result.completedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(result.startedAt).getTime(),
    )
  })
})
