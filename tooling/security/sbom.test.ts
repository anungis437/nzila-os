import { describe, expect, it } from 'vitest'
import { extractDependencies } from '../../scripts/generate-sbom'

const sri = Buffer.alloc(64, 7).toString('base64')
const lock = (packages: string, snapshots = '  one@1.0.0: {}') =>
  `lockfileVersion: '9.0'\npackages:\n${packages}\nsnapshots:\n${snapshots}\n`

describe('lockfile SBOM evidence', () => {
  it('decodes the actual package SRI to the declared hash algorithm and ignores peer snapshots', () => {
    const components = extractDependencies(
      lock(
        `  one@1.0.0:\n    resolution: {integrity: sha512-${sri}}`,
        '  one@1.0.0(peer@2.0.0): {}\n  one@1.0.0(peer@3.0.0): {}',
      ),
    )
    expect(components).toHaveLength(1)
    expect(components[0]!.hashes).toEqual([
      { alg: 'SHA-512', content: Buffer.alloc(64, 7).toString('hex') },
    ])
    expect(components[0]!.version).toBe('1.0.0')
    expect(components[0]!.licenses[0]!.license.name).toBe('NOASSERTION')
  })

  it('never borrows an adjacent package integrity or invents an artifact digest', () => {
    expect(() =>
      extractDependencies(
        lock(`  one@1.0.0: {}\n  two@2.0.0:\n    resolution: {integrity: sha512-${sri}}`),
      ),
    ).toThrow('Missing package integrity: one@1.0.0')
    expect(() =>
      extractDependencies(lock('  one@1.0.0:\n    resolution: {integrity: sha512-YQ==}')),
    ).toThrow('Invalid package integrity digest')
  })

  it('refuses malformed, incomplete or contradictory package evidence', () => {
    expect(() => extractDependencies('lockfileVersion: 9.0\n')).toThrow('complete pnpm')
    expect(() => extractDependencies(lock('  one@1.0.0: {}\n  one@1.0.0: {}'))).toThrow()
    expect(() =>
      extractDependencies(
        lock(`  one@1.0.0:\n    resolution: {integrity: sha512-${sri}}`, '  two@2.0.0: {}'),
      ),
    ).toThrow('Snapshot lacks package evidence')
  })

  it('records a local patch separately from the original tarball and preserves scoped package identity', () => {
    const content =
      lock(
        `  '@scope/one@1.0.0':\n    resolution: {integrity: sha512-${sri}}`,
        "  '@scope/one@1.0.0(patch_hash=abcdef)': {}",
      ) + "patchedDependencies:\n  '@scope/one@1.0.0': {path: patches/one.patch, hash: abcdef}\n"
    const [component] = extractDependencies(content)
    expect(component!.purl).toBe('pkg:npm/%40scope/one@1.0.0')
    expect(component!.properties).toContainEqual({
      name: 'pnpm:patch-path',
      value: 'patches/one.patch',
    })
    expect(component!.properties).toContainEqual({
      name: 'nzila:hash-subject',
      value: 'upstream-registry-tarball',
    })
  })

  it('refuses registry license evidence for another artifact or package URL', () => {
    const content = lock(`  one@1.0.0:\n    resolution: {integrity: sha512-${sri}}`)
    const valid = {
      integrity: `sha512-${sri}`,
      license: 'MIT',
      sourceUrl: 'https://registry.npmjs.org/one/1.0.0',
    }
    expect(extractDependencies(content, { 'one@1.0.0': valid })[0]!.licenses[0]!.license.name).toBe(
      'MIT',
    )
    expect(() =>
      extractDependencies(content, { 'one@1.0.0': { ...valid, integrity: 'sha512-other' } }),
    ).toThrow('invalid registry metadata')
    expect(() =>
      extractDependencies(content, {
        'one@1.0.0': { ...valid, sourceUrl: 'https://example.com/one/1.0.0' },
      }),
    ).toThrow('invalid registry metadata')
  })
})
