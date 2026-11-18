import { describe, expect, it } from 'vitest'
import { extractDependencies, readRegistryLicense } from '../../scripts/generate-sbom'

const sri = Buffer.alloc(64, 7).toString('base64')
const lock = (packages: string, snapshots = '  one@1.0.0: {}') =>
  `lockfileVersion: '9.0'\npackages:\n${packages}\nsnapshots:\n${snapshots}\n`

// Original legacy fields from these exact cached release manifests. The
// upstream URL remains evidence, never a URL followed to infer a newer license.
const legacyReleases = [
  {
    name: 'busboy',
    version: '1.6.0',
    integrity:
      'sha512-8SFQbg/0hQ9xy3UNTB0YEnsNBbWfhf7RtnzpL7TkBiTBRfrQ9Fxcnz7VJsleJpyp6rVLvXiuORqjlHi5q+PYuA==',
    licenses: [{ type: 'MIT', url: 'http://github.com/mscdex/busboy/raw/master/LICENSE' }],
  },
  {
    name: 'exit',
    version: '0.1.2',
    integrity:
      'sha512-Zk/eNKV2zbjpKzrsQ+n1G6poVbErQxJ0LBOJXaKZ1EViLzH+hrLu9cdXI4zw9dBQJslwBEpbQ2P1oS7nDxs6jQ==',
    licenses: [{ type: 'MIT', url: 'https://github.com/cowboy/node-exit/blob/master/LICENSE-MIT' }],
  },
  {
    name: 'limiter',
    version: '1.1.5',
    integrity:
      'sha512-FWWMIEOxz3GwUI4Ts/IvgVy6LPvoMPgjMdQ185nN6psJyBJ4yOpzqm695/h5umdLJg2vW3GR5iG11MAkR2AzJA==',
    licenses: [
      { type: 'MIT', url: 'http://github.com/jhurliman/node-rate-limiter/raw/master/LICENSE.txt' },
    ],
  },
  {
    name: 'streamsearch',
    version: '1.1.0',
    integrity:
      'sha512-Mcc5wHehp9aXz1ax6bZUyY5afg9u2rv5cqQI3mRrYkGC8rW2hM02jWuwjtL++LS5qinSyhj2QfLyNsuc+VsExg==',
    licenses: [{ type: 'MIT', url: 'http://github.com/mscdex/streamsearch/raw/master/LICENSE' }],
  },
]

describe('registry legacy license evidence', () => {
  it.each(legacyReleases)(
    'preserves the actual single legacy declaration for $name@$version',
    (raw) => {
      const result = readRegistryLicense(raw)
      expect(result.license).toBe('MIT')
      expect(result.licenseProvenance).toEqual({
        field: 'licenses[0].type',
        declaration: { licenses: raw.licenses },
      })
      const key = `${raw.name}@${raw.version}`
      const sourceUrl = `https://registry.npmjs.org/${raw.name}/${raw.version}`
      const content = lock(
        `  ${key}:\n    resolution: {integrity: ${raw.integrity}}`,
        `  ${key}: {}`,
      )
      const [component] = extractDependencies(content, {
        [key]: { integrity: raw.integrity, sourceUrl, ...result },
      })
      expect(component!.licenses[0]!.license.name).toBe('MIT')
      expect(component!.properties).toContainEqual({
        name: 'nzila:license-source',
        value: sourceUrl,
      })
      expect(component!.properties).toContainEqual({
        name: 'nzila:license-field',
        value: 'licenses[0].type',
      })
      expect(component!.properties).toContainEqual({
        name: 'nzila:license-declaration',
        value: JSON.stringify({ licenses: raw.licenses }),
      })
    },
  )

  it.each([
    { licenses: [] },
    { licenses: [{ type: 'MIT' }, { type: 'MIT' }] },
    { licenses: [{ type: 'MIT' }, { type: 'GPL-3.0-only' }] },
    { licenses: 'MIT' },
    { licenses: [null] },
    { licenses: [{ type: 7 }] },
    { licenses: [{ type: '' }] },
    { licenses: [{ type: ' MIT ' }] },
    { licenses: [{ type: 'MIT\n' }] },
    { licenses: [{ type: 'MIT', url: 7 }] },
    { licenses: [{ type: 'MIT', name: 'GPL-3.0-only' }] },
    { license: 'GPL-3.0-only', licenses: [{ type: 'MIT' }] },
    { license: null, licenses: [{ type: 'MIT' }] },
    { license: '', licenses: [{ type: 'MIT' }] },
    { license: ['MIT'], licenses: [{ type: 'MIT' }] },
    { license: 'MIT', licenses: [{ type: 'MIT' }, { type: 'MIT' }] },
  ])('retains UNKNOWN for ambiguous or invalid declarations: %j', (raw) => {
    const result = readRegistryLicense(raw)
    expect(result.license).toBe('NOASSERTION')
    expect(result.licenseProvenance.field).toBeNull()
    expect(result.licenseProvenance.declaration).toEqual(raw)
  })

  it('retains primary declarations and does not infer a license from arbitrary text or files', () => {
    expect(readRegistryLicense({ license: 'MIT' })).toMatchObject({
      license: 'MIT',
      licenseProvenance: { field: 'license', declaration: { license: 'MIT' } },
    })
    expect(
      readRegistryLicense({ license: { type: 'MIT', url: 'https://fixture.invalid/LICENSE' } }),
    ).toMatchObject({
      license: 'MIT',
      licenseProvenance: { field: 'license.type' },
    })
    expect(readRegistryLicense({ license: 'MIT', licenses: [{ type: 'MIT' }] })).toMatchObject({
      license: 'MIT',
      licenseProvenance: { field: 'license' },
    })
    expect(readRegistryLicense({})).toEqual({
      license: 'NOASSERTION',
      licenseProvenance: { field: null, declaration: {} },
    })
    for (const type of ['FSL-1.1-MIT', 'MIT AND GPL-3.0-only', 'SEE LICENSE IN LICENSE'])
      expect(readRegistryLicense({ licenses: [{ type }] }).license).toBe(type)
  })

  it('rejects forged, altered or ambiguous cached declaration provenance', () => {
    const content = lock(`  one@1.0.0:\n    resolution: {integrity: sha512-${sri}}`)
    const identity = {
      integrity: `sha512-${sri}`,
      sourceUrl: 'https://registry.npmjs.org/one/1.0.0',
    }
    for (const licenseProvenance of [
      { field: 'licenses[0].type' as const, declaration: { licenses: [{ type: 'GPL-3.0-only' }] } },
      { field: 'license' as const, declaration: { licenses: [{ type: 'MIT' }] } },
      {
        field: 'licenses[0].type' as const,
        declaration: { licenses: [{ type: 'MIT' }, { type: 'MIT' }] },
      },
    ])
      expect(() =>
        extractDependencies(content, {
          'one@1.0.0': { ...identity, license: 'MIT', licenseProvenance },
        }),
      ).toThrow('invalid registry license provenance')
  })
})

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
