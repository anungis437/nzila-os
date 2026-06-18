/**
 * Evidence Export Module
 *
 * Produces a self-contained evidence pack (JSON) for a given case.
 * Includes: case record, notes, status transitions, audit trail, and
 * an HMAC-SHA256 seal for tamper detection and origin authentication.
 *
 * PR-032: Evidence Export + Seal Verification
 */

import { createHmac } from 'crypto';
import { createHash, timingSafeEqual } from 'crypto';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { generatePDF } from '@/lib/utils/pdf-generator';

/** Seal key — must be set in production; falls back for dev/test only. */
function getSealKey(): string {
  const key = process.env.EVIDENCE_SEAL_KEY;
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('EVIDENCE_SEAL_KEY environment variable is required in production');
  }
  return key || 'dev-seal-key-not-for-production';
}

// ---------------------------------------------------------------------------
// Evidence pack shape
// ---------------------------------------------------------------------------

export interface EvidencePack {
  version: '1.0';
  exportedAt: string;
  exportedBy: string;
  caseId: string;
  organizationId: string;
  caseRecord: Record<string, unknown>;
  notes: Record<string, unknown>[];
  auditTrail: Record<string, unknown>[];
  /** HMAC-SHA256 hex digest of the canonical JSON (everything except `seal`) */
  seal: string;
}

export interface EvidenceManifestArtifact {
  name: 'caseRecord' | 'notes' | 'auditTrail' | 'evidencePack';
  sha256: string;
  count?: number;
  bytes: number;
}

export interface EvidenceManifest {
  schemaVersion: '1.0';
  generatedAt: string;
  algorithm: 'hmac-sha256';
  caseId: string;
  organizationId: string;
  exportedBy: string;
  artifacts: EvidenceManifestArtifact[];
  attachmentSecurity?: {
    totalAttachments: number;
    clean: number;
    infected: number;
    unavailable: number;
    unscanned: number;
    entries: Array<{
      fileName: string;
      status: 'clean' | 'infected' | 'unavailable' | 'unscanned';
      scannedAt?: string;
      signature?: string;
      reason?: string;
    }>;
  };
}

export interface EvidencePackage {
  manifest: EvidenceManifest;
  pack: EvidencePack;
  verification: {
    sealValid: boolean;
    verifiedAt: string;
  };
}

// ---------------------------------------------------------------------------
// Build + seal
// ---------------------------------------------------------------------------

export function buildEvidencePack(input: {
  exportedBy: string;
  caseId: string;
  organizationId: string;
  caseRecord: Record<string, unknown>;
  notes: Record<string, unknown>[];
  auditTrail: Record<string, unknown>[];
}): EvidencePack {
  const unsealedPack = {
    version: '1.0' as const,
    exportedAt: new Date().toISOString(),
    exportedBy: input.exportedBy,
    caseId: input.caseId,
    organizationId: input.organizationId,
    caseRecord: input.caseRecord,
    notes: input.notes,
    auditTrail: input.auditTrail,
  };

  const seal = computeSeal(unsealedPack);

  return { ...unsealedPack, seal };
}

function sha256Of(value: any): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function byteSizeOf(value: any): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function extractAttachmentSecurity(caseRecord: Record<string, unknown>): EvidenceManifest['attachmentSecurity'] | undefined {
  const rawAttachments = caseRecord.attachments;
  if (!Array.isArray(rawAttachments)) {
    return undefined;
  }

  const entries = rawAttachments
    .map((attachment) => {
      if (!attachment || typeof attachment !== 'object') {
        return null;
      }

      const value = attachment as Record<string, unknown>;
      const fileName =
        (typeof value.fileName === 'string' && value.fileName) ||
        (typeof value.name === 'string' && value.name) ||
        'unknown-file';

      const malwareScan = value.malwareScan;
      if (!malwareScan || typeof malwareScan !== 'object') {
        return {
          fileName,
          status: 'unscanned' as const,
        };
      }

      const scan = malwareScan as Record<string, unknown>;
      const status = typeof scan.status === 'string' ? scan.status : '';
      const normalizedStatus: 'clean' | 'infected' | 'unavailable' | 'unscanned' =
        status === 'clean' || status === 'infected' || status === 'unavailable'
          ? status
          : 'unscanned';

      return {
        fileName,
        status: normalizedStatus,
        scannedAt: typeof scan.scannedAt === 'string' ? scan.scannedAt : undefined,
        signature: typeof scan.signature === 'string' ? scan.signature : undefined,
        reason: typeof scan.reason === 'string' ? scan.reason : undefined,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const totals = entries.reduce(
    (acc, entry) => {
      acc[entry.status] += 1;
      return acc;
    },
    { clean: 0, infected: 0, unavailable: 0, unscanned: 0 },
  );

  return {
    totalAttachments: entries.length,
    clean: totals.clean,
    infected: totals.infected,
    unavailable: totals.unavailable,
    unscanned: totals.unscanned,
    entries,
  };
}

/**
 * Build a production evidence export envelope.
 * Includes a deterministic manifest and immediate seal verification result.
 */
export function buildEvidencePackage(input: {
  exportedBy: string;
  caseId: string;
  organizationId: string;
  caseRecord: Record<string, unknown>;
  notes: Record<string, unknown>[];
  auditTrail: Record<string, unknown>[];
}): EvidencePackage {
  const pack = buildEvidencePack(input);

  const artifacts: EvidenceManifestArtifact[] = [
    {
      name: 'caseRecord',
      sha256: sha256Of(input.caseRecord),
      bytes: byteSizeOf(input.caseRecord),
      count: 1,
    },
    {
      name: 'notes',
      sha256: sha256Of(input.notes),
      bytes: byteSizeOf(input.notes),
      count: input.notes.length,
    },
    {
      name: 'auditTrail',
      sha256: sha256Of(input.auditTrail),
      bytes: byteSizeOf(input.auditTrail),
      count: input.auditTrail.length,
    },
    {
      name: 'evidencePack',
      sha256: sha256Of(pack),
      bytes: byteSizeOf(pack),
      count: 1,
    },
  ];

  const manifest: EvidenceManifest = {
    schemaVersion: '1.0',
    generatedAt: pack.exportedAt,
    algorithm: 'hmac-sha256',
    caseId: pack.caseId,
    organizationId: pack.organizationId,
    exportedBy: pack.exportedBy,
    artifacts,
    attachmentSecurity: extractAttachmentSecurity(pack.caseRecord),
  };

  return {
    manifest,
    pack,
    verification: {
      sealValid: verifySeal(pack),
      verifiedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Seal computation + verification
// ---------------------------------------------------------------------------

/**
 * Compute an HMAC-SHA256 hex digest over a canonical JSON representation.
 * Uses EVIDENCE_SEAL_KEY for authentication — prevents seal forgery.
 * Stable ordering is guaranteed by `JSON.stringify` on objects with
 * consistent property insertion order (we control the shape).
 */
export function computeSeal(data: Omit<EvidencePack, 'seal'>): string {
  const canonical = JSON.stringify(data);
  return createHmac('sha256', getSealKey()).update(canonical).digest('hex');
}

/**
 * Verify that a pack has not been tampered with.
 * Returns `true` when the computed HMAC seal matches the embedded seal.
 */
export function verifySeal(pack: EvidencePack): boolean {
  const { seal, ...rest } = pack;
  const computed = computeSeal(rest);

  const left = Buffer.from(computed, 'utf8');
  const right = Buffer.from(seal, 'utf8');
  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}

function collectArchiveBuffer(archive: archiver.Archiver): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    archive.on('error', reject);
    archive.pipe(stream);
  });
}

/**
 * Build a downloadable ZIP containing evidence pack, manifest, and verification status.
 */
export async function buildEvidenceZip(pkg: EvidencePackage): Promise<Buffer> {
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  const bufferPromise = collectArchiveBuffer(archive);

  archive.append(JSON.stringify(pkg.manifest, null, 2), { name: 'manifest.json' });
  archive.append(JSON.stringify(pkg.pack, null, 2), { name: 'evidence-pack.json' });
  archive.append(JSON.stringify(pkg.verification, null, 2), { name: 'verification.json' });

  await archive.finalize();
  return bufferPromise;
}

/**
 * Build a downloadable PDF summary for legal/operational review.
 */
export async function buildEvidencePdf(pkg: EvidencePackage): Promise<Buffer> {
  const pack = pkg.pack;
  return generatePDF({
    title: `Case Evidence Summary - ${pack.caseId}`,
    template: 'usage-report',
    data: {
      period: {
        start: pack.exportedAt,
        end: pkg.verification.verifiedAt,
      },
      claims: {
        total: 1,
        byStatus: {
          current: String((pack.caseRecord.status as string | undefined) ?? 'unknown'),
        },
        byPriority: {
          current: String((pack.caseRecord.priority as string | undefined) ?? 'unknown'),
        },
      },
      grievances: {
        total: Array.isArray(pack.notes) ? pack.notes.length : 0,
        resolved: pack.auditTrail.filter((entry) => String(entry.action ?? '').includes('resolved')).length,
      },
      integrity: {
        seal: pack.seal,
        sealValid: pkg.verification.sealValid,
      },
    },
    metadata: {
      author: 'Nzila UnionEyes',
      subject: `Evidence export ${pack.caseId}`,
      keywords: 'evidence,defensibility,union-eyes',
    },
  });
}
