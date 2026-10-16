import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function readRegularArchivalArtifact(root: string, artifact: string): Buffer {
  const segments = artifact.replace(/\\/g, '/').split('/')
  if (
    segments.some(
      (segment) => !segment || segment === '.' || segment === '..' || segment.includes(':'),
    )
  )
    throw new Error(`Invalid archival path: ${artifact}`)
  let path = root
  if (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())
    throw new Error('Archival root must be a regular directory')
  for (let index = 0; index < segments.length; index++) {
    path = join(path, segments[index])
    const stats = lstatSync(path)
    if (
      stats.isSymbolicLink() ||
      (index < segments.length - 1 ? !stats.isDirectory() : !stats.isFile())
    )
      throw new Error(`Non-regular archival path: ${artifact}`)
  }
  return readFileSync(path)
}

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null && name in value
    ? Reflect.get(value, name)
    : undefined
}

export function verifyCivicRetainedEvidence(
  root: string,
  inventoryDigests: Readonly<Record<string, string>>,
  sourceDigests: Readonly<Record<string, string>>,
): void {
  for (const [artifact, expected] of Object.entries(inventoryDigests)) {
    const content = readRegularArchivalArtifact(root, artifact)
    if (createHash('sha256').update(content).digest('hex') !== expected)
      throw new Error(`Retained inventory changed: ${artifact}`)
    const inventory: unknown = JSON.parse(content.toString('utf8'))
    const slice1 = artifact.includes('/slice1/')
    const sources = artifact.endsWith('final-source-inventory.json')
    const entries = field(inventory, slice1 ? 'files' : 'entries')
    if (
      field(inventory, 'classification') !== 'LOCAL_SYNTHETIC_PROOF_ARTIFACT' ||
      !Array.isArray(entries) ||
      entries.length !== (slice1 ? 22 : sources ? 11 : 204)
    )
      throw new Error(`Invalid retained inventory: ${artifact}`)
    for (const entry of entries) {
      const name = field(entry, slice1 ? 'path' : 'file')
      const digest = field(entry, sources ? 'normalizedLfSha256' : 'sha256')
      const bytes = field(entry, 'bytes')
      if (typeof name !== 'string' || typeof digest !== 'string')
        throw new Error(`Invalid retained entry: ${artifact}`)
      const path = (slice1 ? `.civic-runtime/slice1/${name}` : name).replace(/\\/g, '/')
      if (
        sources
          ? !(path in sourceDigests) || sourceDigests[path] !== digest
          : !['.civic-runtime/slice1/', '.civic-runtime/slice2/', '.civic-anchor/slice2/'].some(
              (prefix) => path.startsWith(prefix),
            )
      )
        throw new Error(`Unapproved retained payload path: ${path}`)
      const payload = readRegularArchivalArtifact(root, path)
      const input = sources ? payload.toString('utf8').replace(/\r\n/g, '\n') : payload
      if (
        createHash('sha256').update(input).digest('hex') !== digest ||
        (!sources && (typeof bytes !== 'number' || payload.length !== bytes))
      )
        throw new Error(`Retained payload changed: ${path}`)
    }
  }
}
