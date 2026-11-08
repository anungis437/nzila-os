import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Source contract: every return path, including authorization and validation
// failures, must use the private response constructor. Runtime proof remains separate.
const route = readFileSync(fileURLToPath(new URL('../app/api/reviews/route.ts', import.meta.url)), 'utf8')

describe('review response cache isolation', () => {
  it('sets no-store for sensitive review payloads', () => {
    expect(route).toContain("'Cache-Control': 'no-store, private'")
    expect(route).toContain('headers: { ...init?.headers, ...PRIVATE_RESPONSE_HEADERS }')
  })

  it('routes GET, POST and error responses through privateJson', () => {
    const directCalls = route.match(/NextResponse\.json\(/g) ?? []
    expect(directCalls).toHaveLength(1) // the single privateJson implementation
    expect(route).toContain('return privateJson({ success: true, ...list })')
    expect(route).toContain('return privateJson({ success: true, ...opened, alreadyOpen: !created }')
    expect(route).toContain('return reviewErrorResponse(error)')
    expect(route).toContain("denied.headers.set('Cache-Control', PRIVATE_RESPONSE_HEADERS['Cache-Control'])")
    expect(route).toContain('return privateJson({ success: false, error:')
  })
})
