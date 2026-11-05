import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { intelligencePayloadSchema, parsePilotPayload, transitionPayloadSchema, versionNotePayloadSchema } from '@/lib/pilot/write-payloads'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')
const req = (body?: string) => new Request('http://localhost/x', { method: 'POST', body })

describe('Gate 0 batch B74: pilot write payloads', () => {
  it('treats an absent or empty body as the empty object and refuses malformed, oversized or mistyped bodies', async () => {
    expect(await parsePilotPayload(req(), versionNotePayloadSchema)).toEqual({ ok: true, data: {} })
    expect(await parsePilotPayload(req('  '), versionNotePayloadSchema)).toEqual({ ok: true, data: {} })
    const malformed = await parsePilotPayload(req('{bad'), versionNotePayloadSchema)
    expect(malformed.ok === false && malformed.response.status).toBe(400)
    const array = await parsePilotPayload(req('[1]'), versionNotePayloadSchema)
    expect(array.ok).toBe(false)
    const long = await parsePilotPayload(req(JSON.stringify({ notes: 'x'.repeat(4001) })), versionNotePayloadSchema)
    expect(long.ok).toBe(false)
    const big = await parsePilotPayload(req(JSON.stringify({ notes: 'x'.repeat(40_000) })), versionNotePayloadSchema)
    expect(big.ok === false && big.response.status).toBe(413)
  })

  it('bounds every field of each schema and drops unknown keys', () => {
    expect(transitionPayloadSchema.safeParse({ targetState: 'x'.repeat(61) }).success).toBe(false)
    expect(transitionPayloadSchema.safeParse({ allowSkip: 'yes' }).success).toBe(false)
    expect(transitionPayloadSchema.parse({ targetState: 'active', commercialState: 'signed' })).toEqual({ targetState: 'active' })
    expect(intelligencePayloadSchema.safeParse({ stakeholderSentiment: { sentiment: 'furious' } }).success).toBe(false)
    expect(intelligencePayloadSchema.safeParse({ lessonLearned: 'x'.repeat(2001) }).success).toBe(false)
  })

  it('parses the body in all four routes instead of casting it', () => {
    for (const name of ['commercial-transition', 'artifacts', 'intelligence', 'reference-profile']) {
      const route = src('app/api/pilot/apply/[id]/' + name + '/route.ts')
      expect(route, name).toContain('parsePilotPayload(request,')
      expect(route, name).not.toMatch(/await request\.json\(\)\.catch\(\(\) => \(\{\}\)\)\) as/)
    }
  })

  it('verified: the public application bounds responses by size, keys and depth and keeps only the score of an assessment', () => {
    const route = src('app/api/pilot/apply/route.ts')
    expect(route).toContain('boundedJsonRecord({ maxBytes: 16 * 1024, maxKeys: 60, maxDepth: 4 })')
    expect(route).toContain('assessment: z.object({ score:')
  })
})
