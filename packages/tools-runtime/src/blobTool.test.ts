/**
 * Unit tests for blob tool path builders.
 * These are pure functions — no I/O needed.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock @nzila/blob to avoid requiring Azure config at import time
vi.mock('@nzila/blob', () => ({
  uploadBuffer: vi.fn(),
  downloadBuffer: vi.fn(),
  generateSasUrl: vi.fn(),
  computeSha256: vi.fn(),
}))

import {
  buildExportPath,
  buildEvidencePath,
  buildAttestationPath,
  uploadWithLogging,
  downloadWithLogging,
  generateSasUrl,
  computeSha256,
} from './blobTool'
import { uploadBuffer, downloadBuffer } from '@nzila/blob'
import { hashSanitized } from './sanitize'

describe('buildExportPath', () => {
  it('constructs the correct path', () => {
    const path = buildExportPath({
      orgId: 'acme-123',
      domain: 'stripe',
      year: '2026',
      month: '02',
      subPath: 'revenue_summary/report.json',
    })
    expect(path).toBe('exports/acme-123/stripe/2026/02/revenue_summary/report.json')
  })
})

describe('buildEvidencePath', () => {
  it('constructs the correct path', () => {
    const path = buildEvidencePath({
      orgId: 'acme-123',
      periodLabel: '2026-02',
      subPath: 'payments/stripe/manifest.json',
    })
    expect(path).toBe('evidence/acme-123/month/2026-02/payments/stripe/manifest.json')
  })
})

describe('buildAttestationPath', () => {
  it('constructs the correct path with dotted actionType', () => {
    const path = buildAttestationPath({
      orgId: 'acme-123',
      year: '2026',
      month: '02',
      actionType: 'finance.generate_stripe_monthly_reports',
      runId: 'run-abc',
    })
    expect(path).toBe(
      'exports/acme-123/attestations/2026/02/finance/generate_stripe_monthly_reports/run-abc/attestation.json',
    )
  })

  it('handles actionType without dots', () => {
    const path = buildAttestationPath({
      orgId: 'acme-123',
      year: '2026',
      month: '01',
      actionType: 'simple_action',
      runId: 'run-xyz',
    })
    expect(path).toBe(
      'exports/acme-123/attestations/2026/01/simple_action/run-xyz/attestation.json',
    )
  })
})

describe('uploadWithLogging', () => {
  it('uploads with default container and returns success tool call', async () => {
    vi.mocked(uploadBuffer).mockResolvedValueOnce({
      blobPath: 'exports/acme/report.json',
      sha256: 'abc',
      sizeBytes: 3,
    })

    const result = await uploadWithLogging({
      blobPath: 'exports/acme/report.json',
      buffer: Buffer.from('abc'),
      contentType: 'application/json',
    })

    expect(uploadBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        container: 'exports',
        blobPath: 'exports/acme/report.json',
      }),
    )
    expect(result.toolCall.status).toBe('success')
    expect(result.toolCall.outputsHash).toBe(
      hashSanitized({ blobPath: 'exports/acme/report.json', sha256: 'abc' }),
    )
  })

  it('uploads with explicit container', async () => {
    vi.mocked(uploadBuffer).mockResolvedValueOnce({
      blobPath: 'custom/path.txt',
      sha256: 'def',
      sizeBytes: 4,
    })

    await uploadWithLogging({
      container: 'evidence',
      blobPath: 'custom/path.txt',
      buffer: Buffer.from('data'),
      contentType: 'text/plain',
    })

    expect(uploadBuffer).toHaveBeenCalledWith(expect.objectContaining({ container: 'evidence' }))
  })

  it('attaches toolCall metadata when upload fails', async () => {
    vi.mocked(uploadBuffer).mockRejectedValueOnce(new Error('upload failed'))

    await expect(
      uploadWithLogging({
        blobPath: 'exports/acme/fail.json',
        buffer: Buffer.from('x'),
        contentType: 'application/json',
      }),
    ).rejects.toMatchObject({
      message: 'upload failed',
      toolCall: expect.objectContaining({
        status: 'error',
        error: 'upload failed',
      }),
    })
  })
})

describe('downloadWithLogging', () => {
  it('downloads and emits success tool call', async () => {
    vi.mocked(downloadBuffer).mockResolvedValueOnce(Buffer.from('file-content'))

    const result = await downloadWithLogging('exports', 'exports/acme/file.txt')

    expect(downloadBuffer).toHaveBeenCalledWith('exports', 'exports/acme/file.txt')
    expect(result.buffer.toString()).toBe('file-content')
    expect(result.toolCall.status).toBe('success')
    expect(result.toolCall.outputsHash).toBe(hashSanitized({ sizeBytes: 12 }))
  })

  it('attaches toolCall metadata when download fails', async () => {
    vi.mocked(downloadBuffer).mockRejectedValueOnce(new Error('download failed'))

    await expect(downloadWithLogging('exports', 'missing/file.txt')).rejects.toMatchObject({
      message: 'download failed',
      toolCall: expect.objectContaining({
        status: 'error',
        error: 'download failed',
      }),
    })
  })
})

describe('blob helper re-exports', () => {
  it('re-exports generateSasUrl and computeSha256 references', async () => {
    expect(generateSasUrl).toBe(vi.mocked(generateSasUrl))
    expect(computeSha256).toBe(vi.mocked(computeSha256))
  })
})
