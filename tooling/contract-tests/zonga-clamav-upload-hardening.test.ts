import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8')
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'coverage' || entry === '.turbo') continue
      walk(full, acc)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

describe('Zonga ClamAV upload-scan hardening contract', () => {
  it('exposes the centralized malware-scan helper', () => {
    const source = read('apps/zonga/lib/security/clamav.ts')

    expect(source).toContain('assertBufferSafeForUpload')
    expect(source).toContain('isMalwareScanError')
    expect(source).toContain('MalwareScanError')
    expect(source).toContain('CLAMAV_URL')
  })

  it('routes audio + cover-art uploads through assertBufferSafeForUpload in lib/blob.ts', () => {
    const source = read('apps/zonga/lib/blob.ts')

    expect(source).toContain("from '@/lib/security/clamav'")
    expect(source).toContain('assertBufferSafeForUpload')

    // Both upload helpers must call the scanner before uploadBuffer
    const audioFn = source.slice(source.indexOf('export async function uploadAudioFile'))
    const audioBody = audioFn.slice(0, audioFn.indexOf('export async function uploadCoverArt'))
    expect(audioBody.indexOf('assertBufferSafeForUpload')).toBeGreaterThan(-1)
    expect(audioBody.indexOf('assertBufferSafeForUpload')).toBeLessThan(
      audioBody.indexOf('uploadBuffer({'),
    )

    const coverFn = source.slice(source.indexOf('export async function uploadCoverArt'))
    expect(coverFn.indexOf('assertBufferSafeForUpload')).toBeGreaterThan(-1)
    expect(coverFn.indexOf('assertBufferSafeForUpload')).toBeLessThan(
      coverFn.indexOf('uploadBuffer({'),
    )
  })

  it('routes track + artwork uploads through assertBufferSafeForUpload in features/media/upload-service.ts', () => {
    const source = read('apps/zonga/features/media/upload-service.ts')

    expect(source).toContain("from '@/lib/security/clamav'")
    expect(source).toContain('assertBufferSafeForUpload')
    expect(source).toContain('isMalwareScanError')

    // Audio path scans before uploadToS3
    const audioFn = source.slice(source.indexOf('export async function uploadTrackAudio'))
    const audioBody = audioFn.slice(0, audioFn.indexOf('// ── Artwork Upload'))
    expect(audioBody.indexOf('assertBufferSafeForUpload')).toBeGreaterThan(-1)
    expect(audioBody.indexOf('assertBufferSafeForUpload')).toBeLessThan(audioBody.indexOf('uploadToS3('))

    // Artwork path scans before uploadBuffer
    const artFn = source.slice(source.indexOf('export async function uploadArtwork'))
    expect(artFn.indexOf('assertBufferSafeForUpload')).toBeGreaterThan(-1)
    expect(artFn.indexOf('assertBufferSafeForUpload')).toBeLessThan(artFn.indexOf('uploadBuffer({'))
  })

  it('forbids new direct uploadBuffer / uploadToS3 call sites that bypass the scanner', () => {
    const allowList = new Set(
      [
        // Helpers below already invoke assertBufferSafeForUpload before the upload call
        'apps/zonga/lib/blob.ts',
        'apps/zonga/features/media/upload-service.ts',
      ].map((p) => resolve(ROOT, p)),
    )

    const offenders: string[] = []
    for (const file of walk(resolve(ROOT, 'apps/zonga'))) {
      const text = readFileSync(file, 'utf8')
      const callsUploadBuffer = /\buploadBuffer\s*\(/.test(text)
      const callsUploadToS3 = /\buploadToS3\s*\(/.test(text)
      if (!callsUploadBuffer && !callsUploadToS3) continue
      if (allowList.has(file)) continue
      offenders.push(file.replace(ROOT + '\\', '').replace(ROOT + '/', ''))
    }

    expect(offenders, `Direct upload calls bypassing ClamAV: ${offenders.join(', ')}`).toEqual([])
  })
})
