import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeNarExportPackHash, signNarExportPackHash, verifyFullChain } from '@nzila/nar'
import type { NarExportPack } from '@nzila/nar'

type VerifyResult = {
  valid: boolean
  errors: string[]
}

function parseInputArg(): string {
  const marker = '--input='
  const arg = process.argv.find((entry) => entry.startsWith(marker))
  if (!arg) {
    throw new Error('Missing --input=<path-to-audit-pack.json|zip>')
  }
  return arg.slice(marker.length)
}

function readSigningSecret(): string {
  const secret = process.env.NAR_SIGNING_SECRET
  if (!secret || secret.trim().length === 0) {
    throw new Error('Missing NAR_SIGNING_SECRET for audit pack verification')
  }
  return secret
}

async function readPackFromZip(filePath: string): Promise<NarExportPack> {
  const { default: JSZip } = await import('jszip')
  const buffer = await readFile(filePath)
  const zip = await JSZip.loadAsync(buffer)
  const jsonEntry = zip.file('audit-pack.json')
  if (!jsonEntry) {
    throw new Error('Zip archive missing audit-pack.json')
  }
  const raw = await jsonEntry.async('string')
  return JSON.parse(raw) as NarExportPack
}

async function readPack(filePath: string): Promise<NarExportPack> {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.zip') {
    return readPackFromZip(filePath)
  }

  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as NarExportPack
}

export async function verifyAuditPack(pack: NarExportPack, signingSecret: string): Promise<VerifyResult> {
  const errors: string[] = []

  const expectedChecksum = computeNarExportPackHash({
    version: pack.version,
    generatedAt: pack.generatedAt,
    organizationId: pack.organizationId,
    records: pack.records,
    chainProof: pack.chainProof,
    metadata: pack.metadata,
  })

  if (pack.verification.checksum !== expectedChecksum) {
    errors.push('Audit pack checksum mismatch')
  }

  const expectedSignature = signNarExportPackHash(expectedChecksum, signingSecret)
  if (pack.verification.signature !== expectedSignature) {
    errors.push('Audit pack signature mismatch')
  }

  const chain = await verifyFullChain({ organizationId: pack.organizationId, records: pack.records })
  if (!chain.valid) {
    errors.push(`Audit pack chain validation failed at index ${chain.corruptionIndex ?? 'unknown'}`)
  }

  if (pack.chainProof.totalRecords !== chain.totalRecords) {
    errors.push('Audit pack chainProof.totalRecords does not match records length')
  }

  if (pack.chainProof.rootHash !== (chain.rootHash ?? '')) {
    errors.push('Audit pack chainProof.rootHash mismatch')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

async function run(): Promise<void> {
  const filePath = parseInputArg()
  const signingSecret = readSigningSecret()
  const pack = await readPack(filePath)
  const result = await verifyAuditPack(pack, signingSecret)

  if (!result.valid) {
    for (const error of result.errors) {
      console.error(error)
    }
    process.exit(1)
  }

  console.log(`Audit pack verified: ${filePath}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
