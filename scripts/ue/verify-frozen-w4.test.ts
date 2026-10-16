import { vi } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const { default: path } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const { format, resolveConfig } = await import('prettier')
  const assert: typeof import('node:assert/strict') = (await import('node:assert/strict')).default
  const crypto = await import('node:crypto')
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const folder = path.join(root, 'docs', 'union-eyes', 'reality-remediation')
  const canonicalFile = path.join(folder, 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json')
  const authority: {
    PRIOR_JSON_INVERSE_PATCHES: {
      canonical: { PATH: string[]; EXISTED: boolean; VALUE?: unknown }[]
    }
    VERSION_1_3_SHA256: string
  } = JSON.parse(
    actual.readFileSync(
      path.join(folder, 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json'),
      'utf8',
    ),
  )
  const { restoreW4PInputs } = await import('./w4p-historical-inputs')
  const replacements = await restoreW4PInputs((file) => actual.readFileSync(file, 'utf8'))
  const canonical: object = JSON.parse(
    replacements.get(path.resolve(canonicalFile)) ?? actual.readFileSync(canonicalFile, 'utf8'),
  )
  if (Reflect.get(canonical, 'CONTRACT_VERSION') === '1.3.2') {
    const amendment: {
      versionAmendment: {
        PRIOR_JSON_INVERSE_PATCHES: {
          canonical: { PATH: string[]; EXISTED: boolean; VALUE?: unknown }[]
        }
      }
    } = JSON.parse(
      actual.readFileSync(
        path.join(folder, 'PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.json'),
        'utf8',
      ),
    )
    for (const patch of amendment.versionAmendment.PRIOR_JSON_INVERSE_PATCHES.canonical) {
      let parent: object = canonical
      for (const key of patch.PATH.slice(0, -1)) {
        const next: unknown = Reflect.get(parent, key)
        assert(next && typeof next === 'object')
        parent = next
      }
      const key = patch.PATH.at(-1)!
      if (patch.EXISTED) Reflect.set(parent, key, structuredClone(patch.VALUE))
      else Reflect.deleteProperty(parent, key)
    }
  }
  for (const patch of authority.PRIOR_JSON_INVERSE_PATCHES.canonical) {
    assert(patch.PATH.length)
    let parent: object = canonical
    for (const key of patch.PATH.slice(0, -1)) {
      const next: unknown = Reflect.get(parent, key)
      assert(next && typeof next === 'object')
      parent = next
    }
    const key = patch.PATH.at(-1)!
    if (patch.EXISTED) Reflect.set(parent, key, structuredClone(patch.VALUE))
    else Reflect.deleteProperty(parent, key)
  }
  const config = await resolveConfig(canonicalFile)
  const frozenBytes = await format(JSON.stringify(canonical), { ...config, parser: 'json' })
  assert.equal(
    crypto.createHash('sha256').update(frozenBytes).digest('hex'),
    authority.VERSION_1_3_SHA256,
  )
  return {
    ...actual,
    readFileSync(
      file: import('node:fs').PathOrFileDescriptor,
      options?: Parameters<typeof actual.readFileSync>[1],
    ) {
      if (typeof file === 'string' && path.resolve(file) === canonicalFile) {
        const encoding = typeof options === 'string' ? options : options?.encoding
        return encoding ? frozenBytes : Buffer.from(frozenBytes)
      }
      return actual.readFileSync(file, options)
    },
  }
})

await import('./w4-physical-producers.test')
