/**
 * @nzila/os-core — Evidence Pack Cryptographic Sealing
 *
 * Provides tamper-evident integrity for evidence packs:
 *  1. Top-level SHA-256 digest over the entire pack index
 *  2. Merkle root over all artifact hashes
 *  3. Seal envelope with version, algorithm, and timestamps
 *  4. Optional HMAC signing when EVIDENCE_SEAL_KEY is available
 *
 * Regenerating an identical pack must produce the identical digest.
 * This closes the "evidence pack is not immutable" audit gap.
 */
import { createHash, createHmac } from 'node:crypto'

// ── Types ─────────────────────────────────────────────────────────────────

export interface SealEnvelope {
  /** Seal schema version */
  sealVersion: '1.0'
  /** Hash algorithm used */
  algorithm: 'sha256'
  /** SHA-256 digest of the canonicalized pack index JSON (excluding the seal itself) */
  packDigest: string
  /** Merkle root of all artifact SHA-256 hashes */
  artifactsMerkleRoot: string
  /** Number of artifacts included */
  artifactCount: number
  /** ISO 8601 seal timestamp */
  sealedAt: string
  /** If HMAC-signed, the HMAC-SHA256 signature over packDigest */
  hmacSignature?: string
  /** Key identifier (last 8 hex chars of the key hash) for verification */
  hmacKeyId?: string
}

export interface SealablePackIndex {
  /** All fields from the evidence pack index except `seal` */
  [key: string]: unknown
  artifacts: Array<{ sha256: string; [key: string]: unknown }>
}

// ── Merkle root ───────────────────────────────────────────────────────────

/**
 * Compute a binary Merkle root from an ordered array of hex-encoded SHA-256
 * artifact hashes. If the array is empty, returns the hash of an empty string.
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    return createHash('sha256').update('').digest('hex')
  }

  let layer: Buffer<ArrayBufferLike>[] = hashes.map((h) => Buffer.from(h, 'hex'))

  while (layer.length > 1) {
    const next: Buffer<ArrayBufferLike>[] = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i] // duplicate last if odd
      const combined = createHash('sha256')
        .update(Buffer.concat([left, right]))
        .digest()
      next.push(combined)
    }
    layer = next
  }

  return layer[0].toString('hex')
}

// ── Canonical JSON ────────────────────────────────────────────────────────

/**
 * Produce a deterministic JSON string (sorted keys, no extra whitespace).
 * This ensures that regeneration produces an identical digest.
 */
export function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort(), 0)
}

/**
 * Deep-sort an object's keys recursively for canonical representation.
 */
function deepSortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(deepSortKeys)

  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = deepSortKeys((obj as Record<string, unknown>)[key])
  }
  return sorted
}

// ── Seal generation ───────────────────────────────────────────────────────

export interface SealOptions {
  /**
   * HMAC key for signing. If not provided, falls back to
   * process.env.EVIDENCE_SEAL_KEY. If neither is present,
   * the seal is unsigned (digest-only — still tamper-evident).
   */
  hmacKey?: string
  /** Override the seal timestamp (for deterministic testing) */
  sealedAt?: string
}

/**
 * Generate a cryptographic seal for an evidence pack index.
 *
 * The `packIndex` must NOT already contain a `seal` field —
 * the seal is computed over the raw index.
 */
export function generateSeal(
  packIndex: SealablePackIndex,
  opts: SealOptions = {},
): SealEnvelope {
  // 1. Strip any existing seal to ensure idempotent resealing
  const { seal: _existingSeal, ...indexWithoutSeal } = packIndex as Record<string, unknown>
  const cleanIndex = deepSortKeys(indexWithoutSeal)

  // 2. Compute pack digest
  const canonicalJson = JSON.stringify(cleanIndex)
  const packDigest = createHash('sha256').update(canonicalJson).digest('hex')

  // 3. Compute Merkle root of artifact hashes
  const artifactHashes = (packIndex.artifacts ?? []).map((a) => a.sha256)
  const artifactsMerkleRoot = computeMerkleRoot(artifactHashes)

  // 4. Build envelope
  const envelope: SealEnvelope = {
    sealVersion: '1.0',
    algorithm: 'sha256',
    packDigest,
    artifactsMerkleRoot,
    artifactCount: artifactHashes.length,
    sealedAt: opts.sealedAt ?? new Date().toISOString(),
  }

  // 5. Optional HMAC signing
  const key = opts.hmacKey ?? process.env.EVIDENCE_SEAL_KEY
  if (key) {
    const hmac = createHmac('sha256', key).update(packDigest).digest('hex')
    envelope.hmacSignature = hmac
    // Key ID = last 8 hex chars of the SHA-256 of the key itself
    envelope.hmacKeyId = createHash('sha256').update(key).digest('hex').slice(-8)
  }

  return envelope
}

// ── Seal verification ─────────────────────────────────────────────────────

export interface VerifySealResult {
  valid: boolean
  digestMatch: boolean
  merkleMatch: boolean
  signatureVerified: boolean | 'no-key' | 'unsigned'
  errors: string[]
}

/**
 * Verify the integrity seal on an evidence pack index.
 */
export function verifySeal(
  packIndex: SealablePackIndex & { seal?: SealEnvelope },
  opts: { hmacKey?: string } = {},
): VerifySealResult {
  const errors: string[] = []
  const seal = packIndex.seal

  if (!seal) {
    return {
      valid: false,
      digestMatch: false,
      merkleMatch: false,
      signatureVerified: 'unsigned',
      errors: ['No seal found on evidence pack index'],
    }
  }

  // 1. Recompute pack digest (without seal)
  const { seal: _s, ...indexWithoutSeal } = packIndex as Record<string, unknown>
  const cleanIndex = deepSortKeys(indexWithoutSeal)
  const canonicalJson = JSON.stringify(cleanIndex)
  const recomputedDigest = createHash('sha256').update(canonicalJson).digest('hex')
  const digestMatch = recomputedDigest === seal.packDigest
  if (!digestMatch) {
    errors.push(
      `Pack digest mismatch: expected ${seal.packDigest}, got ${recomputedDigest}`,
    )
  }

  // 2. Verify Merkle root
  const artifactHashes = (packIndex.artifacts ?? []).map((a) => a.sha256)
  const recomputedMerkle = computeMerkleRoot(artifactHashes)
  const merkleMatch = recomputedMerkle === seal.artifactsMerkleRoot
  if (!merkleMatch) {
    errors.push(
      `Merkle root mismatch: expected ${seal.artifactsMerkleRoot}, got ${recomputedMerkle}`,
    )
  }

  // 3. Verify HMAC signature if present
  let signatureVerified: boolean | 'no-key' | 'unsigned' = 'unsigned'
  if (seal.hmacSignature) {
    const key = opts.hmacKey ?? process.env.EVIDENCE_SEAL_KEY
    if (!key) {
      signatureVerified = 'no-key'
      errors.push('HMAC signature present but no key available for verification')
    } else {
      const expectedHmac = createHmac('sha256', key)
        .update(seal.packDigest)
        .digest('hex')
      signatureVerified = expectedHmac === seal.hmacSignature
      if (!signatureVerified) {
        errors.push('HMAC signature verification failed')
      }
    }
  }

  return {
    valid: digestMatch && merkleMatch && (signatureVerified === true || signatureVerified === 'unsigned'),
    digestMatch,
    merkleMatch,
    signatureVerified,
    errors,
  }
}
