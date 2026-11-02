import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs, parseManifestTargets, inspectHealthResponse } from '../../scripts/deploy-transactional'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
const image = (name: string) =>
  'nzilacanadaacr.azurecr.io/nzila/' + name + '@sha256:' + 'a'.repeat(64)
function fixture(targets: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), 'nzila-p0-deploy-'))
  dirs.push(dir)
  const path = join(dir, 'selected.json')
  const raw = JSON.stringify({ deployTargets: targets })
  writeFileSync(path, raw)
  return { dir, path, sha: createHash('sha256').update(raw).digest('hex') }
}

describe('P0 #1038 transactional production promotion boundary', () => {
  it('rejects redirected, missing-marker and oversized health responses', async () => {
    expect(await inspectHealthResponse(new Response('ready', { status: 200 }), 'ready')).toBe(true)
    expect(await inspectHealthResponse(new Response('ready', { status: 200 }))).toBe(true)
    expect(await inspectHealthResponse(new Response('ready', { status: 302, headers: {
      location: 'https://untrusted.example/ready',
    } }), 'ready')).toBe(false)
    expect(await inspectHealthResponse(new Response('ready', { status: 200 }), 'missing')).toBe(false)
    expect(await inspectHealthResponse(new Response('ready', { status: 200 }), '')).toBe(false)
    expect(await inspectHealthResponse(new Response('ready', { status: 200 }), 'x'.repeat(257))).toBe(false)
    expect(await inspectHealthResponse(new Response('ready' + 'x'.repeat(65_537), { status: 200 }), 'ready')).toBe(false)
  })

  it('rejects non-string and oversized signed health markers', () => {
    for (const marker of [{ value: 'ready' }, 'x'.repeat(257), '']) {
      const f = fixture([{ containerAppName: 'alpha', image: image('alpha'), expectedBodyContains: marker }])
      expect(() => parseManifestTargets(f.path, undefined, true, f.sha))
        .toThrow(/Health marker must be a bounded literal string/)
    }
  })

  it('requires an exact verified selection SHA even with digest-pinned images', () => {
    expect(() => parseArgs(['--resource-group', 'nzila-canada-prod-rg']))
      .toThrow(/verified manifest SHA-256 handoff/)
    expect(() => parseArgs(['--resource-group', 'nzila-canada-prod-rg',
      '--require-digest-pinned', 'false', '--expected-manifest-sha256', 'a'.repeat(64)]))
      .toThrow(/cannot be disabled/)
    expect(parseArgs(['--resource-group', 'nzila-canada-prod-rg',
      '--expected-manifest-sha256', 'a'.repeat(64)]).requireDigestPinned).toBe(true)
  })

  it('accepts only exact bytes of a bounded canonical ACR manifest', () => {
    const f = fixture([{ containerAppName: 'alpha', image: image('alpha') }])
    expect(parseManifestTargets(f.path, undefined, true, f.sha)).toHaveLength(1)
    expect(() => parseManifestTargets(f.path, undefined, true)).toThrow(/receipt missing/)
    expect(() => parseManifestTargets(f.path, undefined, true, 'b'.repeat(64)))
      .toThrow(/differs from verified selection/)
    writeFileSync(f.path, JSON.stringify({ deployTargets: [
      { containerAppName: 'alpha', image: image('alpha'), healthPath: '/new' },
    ] }))
    expect(() => parseManifestTargets(f.path, undefined, true, f.sha))
      .toThrow(/differs from verified selection/)
  })

  it('rejects foreign registries, mutable tags, aliases and fallback-only production', () => {
    for (const invalid of [
      'evil.example/nzila/alpha@sha256:' + 'a'.repeat(64),
      'nzilacanadaacr.azurecr.io/nzila/alpha:latest',
      'nzilacanadaacr.azurecr.io/other/alpha@sha256:' + 'a'.repeat(64),
    ]) {
      const f = fixture([{ containerAppName: 'alpha', image: invalid }])
      expect(() => parseManifestTargets(f.path, undefined, true, f.sha))
        .toThrow(/canonical nzilacanadaacr/)
    }
    const f = fixture([])
    expect(() => parseManifestTargets(f.path, JSON.stringify([
      { containerAppName: 'alpha', image: image('alpha') },
    ]), true, f.sha)).toThrow(/no fallback is permitted/)
  })

  it('rejects oversized sets, oversized files and symlinked selected manifests', () => {
    const many = fixture(Array.from({ length: 33 }, (_, i) => ({
      containerAppName: 'app' + i, image: image('alpha'),
    })))
    expect(() => parseManifestTargets(many.path, undefined, true, many.sha))
      .toThrow(/1–32 targets/)
    const big = fixture([{ containerAppName: 'alpha', image: image('alpha') }])
    writeFileSync(big.path, ' '.repeat(2_097_153))
    expect(() => parseManifestTargets(big.path, undefined, true, big.sha))
      .toThrow(/unavailable, unsafe or mutated/)
    const f = fixture([{ containerAppName: 'alpha', image: image('alpha') }])
    const link = join(f.dir, 'linked.json')
    symlinkSync(f.path, link)
    expect(() => parseManifestTargets(link, undefined, true, f.sha))
      .toThrow(/unavailable, unsafe or mutated/)
  })
})
