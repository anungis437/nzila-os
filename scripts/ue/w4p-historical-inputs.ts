import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

export async function restoreW4PInputs(readText: (file: string) => string) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const folder = path.join(root, 'docs', 'union-eyes', 'reality-remediation')
  const canonicalFile = path.join(folder, 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json')
  const canonical: { CONTRACT_VERSION: string } = JSON.parse(readText(canonicalFile))
  const replacements = new Map<string, string>()
  if (canonical.CONTRACT_VERSION !== '1.3.3') return replacements
  type Patch = { PATH: string[]; EXISTED: boolean; VALUE?: unknown }
  const report: {
    priorMarkdown: { canonical: string; producer: string }
    versionAmendment: {
      VERSION_1_3_2_SHA256: string
      VERSION_1_3_3_SHA256: string
      PRIOR_PRODUCER_SHA256: string
      AMENDED_PRODUCER_SHA256: string
      PRIOR_JSON_INVERSE_PATCHES: { canonical: Patch[]; producer: Patch[] }
    }
  } = JSON.parse(
    readText(path.join(folder, 'PHASE_1B_3C_A1I_W4P_PLATFORM_BASELINE_PROMOTION.json')),
  )
  const sha = (value: string) => createHash('sha256').update(value).digest('hex')
  for (const key of ['canonical', 'producer'] as const) {
    const file = path.join(
      folder,
      key === 'canonical'
        ? 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json'
        : 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
    )
    const bytes = readText(file)
    const amendment = report.versionAmendment
    assert.equal(
      sha(bytes),
      key === 'canonical' ? amendment.VERSION_1_3_3_SHA256 : amendment.AMENDED_PRODUCER_SHA256,
    )
    const value: object = JSON.parse(bytes)
    for (const patch of amendment.PRIOR_JSON_INVERSE_PATCHES[key]) {
      assert(patch.PATH.length)
      let parent: object = value
      for (const part of patch.PATH.slice(0, -1)) {
        const next: unknown = Reflect.get(parent, part)
        assert(next && typeof next === 'object')
        parent = next
      }
      const part = patch.PATH.at(-1)!
      if (patch.EXISTED) Reflect.set(parent, part, structuredClone(patch.VALUE))
      else Reflect.deleteProperty(parent, part)
    }
    const restored = await format(JSON.stringify(value), {
      ...(await resolveConfig(file)),
      parser: 'json',
    })
    assert.equal(
      sha(restored),
      key === 'canonical' ? amendment.VERSION_1_3_2_SHA256 : amendment.PRIOR_PRODUCER_SHA256,
    )
    replacements.set(path.resolve(file), restored)
    replacements.set(path.resolve(file.replace(/\.json$/, '.md')), report.priorMarkdown[key])
  }
  return replacements
}
