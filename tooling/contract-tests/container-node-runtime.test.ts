import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')

// pdfjs-dist 6 calls Promise.withResolvers (Node >=22.13) and sanitize-html 2.18 declares
// Node >=22.12. On Node 20 every PDF parse fails at runtime, so the image base must not
// fall behind the declared engines of the dependencies it ships.
describe('Container runtime Node version', () => {
  it('builds the app images on Node 22 or newer', () => {
    const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8')
    const base = dockerfile.match(/^FROM node:(\d+)[^\s]* AS base$/m)
    expect(base, 'root Dockerfile base stage').not.toBeNull()
    expect(Number(base![1])).toBeGreaterThanOrEqual(22)
  })
})
