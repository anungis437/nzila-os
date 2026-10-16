import { vi } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const path = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const { format, resolveConfig } = await import('prettier')
  const { createHash } = await import('node:crypto')
  const assert: typeof import('node:assert/strict') = (await import('node:assert/strict')).default
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const folder = path.join(root, 'docs', 'union-eyes', 'reality-remediation')
  const reportFile = path.join(folder, 'PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.json')
  type Patch = { PATH: string[]; EXISTED: boolean; VALUE?: unknown }
  const { restoreW4PInputs } = await import('./w4p-historical-inputs')
  const replacements = await restoreW4PInputs((file) => actual.readFileSync(file, 'utf8'))
  const priorRead = (file: string) =>
    replacements.get(path.resolve(file)) ?? actual.readFileSync(file, 'utf8')
  const canonicalFile = path.join(folder, 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json')
  const canonical: { CONTRACT_VERSION: string } = JSON.parse(priorRead(canonicalFile))
  if (canonical.CONTRACT_VERSION === '1.3.2') {
    const report: {
      priorMarkdown: { canonical: string; producer: string }
      versionAmendment: {
        PRIOR_JSON_INVERSE_PATCHES: { canonical: Patch[]; producer: Patch[] }
        VERSION_1_3_1_SHA256: string
        VERSION_1_3_2_SHA256: string
        PRIOR_PRODUCER_SHA256: string
        AMENDED_PRODUCER_SHA256: string
      }
    } = JSON.parse(actual.readFileSync(reportFile, 'utf8'))
    for (const key of ['canonical', 'producer'] as const) {
      const file = path.join(
        folder,
        key === 'canonical'
          ? 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json'
          : 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
      )
      const bytes = priorRead(file)
      const sha = (value: string) => createHash('sha256').update(value).digest('hex')
      assert.equal(
        sha(bytes),
        key === 'canonical'
          ? report.versionAmendment.VERSION_1_3_2_SHA256
          : report.versionAmendment.AMENDED_PRODUCER_SHA256,
      )
      const restored: object = JSON.parse(bytes)
      for (const patch of report.versionAmendment.PRIOR_JSON_INVERSE_PATCHES[key]) {
        assert(patch.PATH.length)
        let parent: object = restored
        for (const part of patch.PATH.slice(0, -1)) {
          const next: unknown = Reflect.get(parent, part)
          assert(next && typeof next === 'object')
          parent = next
        }
        const part = patch.PATH.at(-1)!
        if (patch.EXISTED) Reflect.set(parent, part, structuredClone(patch.VALUE))
        else Reflect.deleteProperty(parent, part)
      }
      const config = await resolveConfig(file)
      const restoredBytes = await format(JSON.stringify(restored), { ...config, parser: 'json' })
      assert.equal(
        sha(restoredBytes),
        key === 'canonical'
          ? report.versionAmendment.VERSION_1_3_1_SHA256
          : report.versionAmendment.PRIOR_PRODUCER_SHA256,
      )
      replacements.set(path.resolve(file), restoredBytes)
      replacements.set(path.resolve(file.replace(/\.json$/, '.md')), report.priorMarkdown[key])
    }
  }
  return {
    ...actual,
    readFileSync(
      file: import('node:fs').PathOrFileDescriptor,
      options?: Parameters<typeof actual.readFileSync>[1],
    ) {
      const bytes = typeof file === 'string' ? replacements.get(path.resolve(file)) : undefined
      if (bytes !== undefined) {
        const encoding = typeof options === 'string' ? options : options?.encoding
        return encoding ? bytes : Buffer.from(bytes)
      }
      return actual.readFileSync(file, options)
    },
  }
})
