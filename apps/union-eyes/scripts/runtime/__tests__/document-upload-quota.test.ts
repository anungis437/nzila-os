import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RATE_LIMITS } from '@/lib/rate-limiter'
import { documentUploadQuotaKey, ownedRedisReleaseTarget, releaseOwnedDocumentUploadQuota } from '../document-upload-quota'

const saved = { ...process.env }
afterEach(() => {
  process.env = { ...saved }
  vi.resetModules()
})

describe('document upload quota contract', () => {
  it('keeps the production document-upload limit at 30 per hour', () => {
    expect(RATE_LIMITS.DOCUMENT_UPLOAD).toMatchObject({ limit: 30, window: 3600, identifier: 'document-upload' })
    expect(documentUploadQuotaKey('ue-qa-member-primary')).toBe('ratelimit:document-upload:doc-upload:ue-qa-member-primary')
    expect(documentUploadQuotaKey('ue-qa-steward-primary')).toBe('ratelimit:document-upload:doc-upload:ue-qa-steward-primary')
  })

  it('refuses a user who is not a named synthetic fixture', () => {
    expect(() => documentUploadQuotaKey('member-primary')).toThrow(/Synthetic fixture user required/)
    expect(() => documentUploadQuotaKey('ratelimit:document-upload:doc-upload:ue-qa-member-primary')).toThrow(/Synthetic fixture user required/)
    expect(() => documentUploadQuotaKey('*')).toThrow(/Synthetic fixture user required/)
  })

  it('accepts only an owned loopback Redis binding', () => {
    const token = 'a'.repeat(32)
    const labels = { 'nzila.mission': 'UE_DISPOSABLE_LOCAL_RUNTIME', 'nzila.qualification-owner': token }
    expect(ownedRedisReleaseTarget({ labels, token, binding: '127.0.0.1:56379', port: '56379' })).toBe(true)
    expect(ownedRedisReleaseTarget({ labels, token, binding: '0.0.0.0:56379', port: '56379' })).toBe(false)
    expect(ownedRedisReleaseTarget({ labels: { ...labels, 'nzila.mission': 'other' }, token, binding: '127.0.0.1:56379', port: '56379' })).toBe(false)
    expect(ownedRedisReleaseTarget({ labels, token: 'b'.repeat(32), binding: '127.0.0.1:56379', port: '56379' })).toBe(false)
    expect(ownedRedisReleaseTarget({ labels: null, token, binding: '127.0.0.1:56379', port: '56379' })).toBe(false)
  })

  it('refuses to release a counter without the QA provenance', () => {
    delete process.env.QA_TEST_ENV
    expect(() => releaseOwnedDocumentUploadQuota(['ue-qa-member-primary'])).toThrow(/QA fixture environment required/)
    process.env.QA_TEST_ENV = 'true'
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    expect(() => releaseOwnedDocumentUploadQuota(['ue-qa-member-primary'])).toThrow(/Canonical fixture bootstrap required/)
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    expect(() => releaseOwnedDocumentUploadQuota([])).toThrow(/Explicit synthetic fixture users required/)
    expect(() => releaseOwnedDocumentUploadQuota(['not-a-fixture'])).toThrow(/Synthetic fixture user required/)
    process.env.REDIS_URL = 'redis://10.1.2.3:6379'
    expect(() => releaseOwnedDocumentUploadQuota(['ue-qa-member-primary'])).toThrow(/Loopback Redis without credentials required/)
    process.env.REDIS_URL = 'redis://127.0.0.1:56379'
    delete process.env.UE_RUNTIME_OPERATOR_DATABASE_URL
    expect(() => releaseOwnedDocumentUploadQuota(['ue-qa-member-primary'])).toThrow(/Private canonical fixture record required/)
  })

  it('fails closed with an empty counter when Redis is not configured', async () => {
    vi.resetModules()
    delete process.env.REDIS_URL
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const limiter = await import('@/lib/rate-limiter')
    const result = await limiter.checkRateLimit('doc-upload:ue-qa-member-primary', limiter.RATE_LIMITS.DOCUMENT_UPLOAD)
    expect(result.allowed).toBe(false)
    expect(result.current).toBe(0)
    expect(result.resetIn).toBe(3600)
    expect(result.error).toMatch(/REDIS_URL/)
  })

  it('keeps the E2E runtime on owned Redis and runs this proof there', () => {
    const workflow = readFileSync(path.resolve(__dirname, '../../../../../.github/workflows/e2e.yml'), 'utf8')
    expect(workflow).toContain('up --prod --fresh --rebuild --redis --azurite')
    expect(workflow).toContain('UE_DOCUMENT_UPLOAD_QUOTA_PROOF')
    expect(workflow.match(/ue-e2e-runtime-contract\.mjs export/g)).toHaveLength(2)
    expect(workflow.match(/ue-e2e-runtime-contract\.mjs check/g)).toHaveLength(2)
    expect(workflow).not.toContain('EVIDENCE_SEAL_KEY=')
    expect(workflow).not.toContain('FLUSHALL')
    expect(workflow).not.toContain('FLUSHDB')
  })
})

const prove = process.env.UE_DOCUMENT_UPLOAD_QUOTA_PROOF === '1'
describe.skipIf(!prove)('owned Redis document-upload quota', () => {
  const member = 'ue-qa-member-primary'
  const steward = 'ue-qa-steward-primary'

  it('gives each synthetic identity its own 30 and releases only that key', async () => {
    const Redis = (await import('ioredis')).default
    const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1, lazyConnect: false })
    try {
      const memberKey = documentUploadQuotaKey(member)
      const stewardKey = documentUploadQuotaKey(steward)
      releaseOwnedDocumentUploadQuota([member, steward])
      expect(await redis.zcard(memberKey)).toBe(0)
      expect(await redis.ttl(memberKey)).toBe(-2)
      const { checkRateLimit, RATE_LIMITS: limits } = await import('@/lib/rate-limiter')
      for (let n = 1; n <= 30; n += 1) {
        const decision = await checkRateLimit(`doc-upload:${member}`, limits.DOCUMENT_UPLOAD)
        expect(decision.allowed, `decision ${n}`).toBe(true)
      }
      const refused = await checkRateLimit(`doc-upload:${member}`, limits.DOCUMENT_UPLOAD)
      expect(refused.allowed).toBe(false)
      expect(refused.resetIn).toBe(3600)
      expect(await redis.zcard(memberKey)).toBe(31)
      expect(await redis.ttl(memberKey)).toBeGreaterThan(0)
      const second = await checkRateLimit(`doc-upload:${steward}`, limits.DOCUMENT_UPLOAD)
      expect(second.allowed).toBe(true)
      expect(await redis.zcard(stewardKey)).toBe(1)
      expect(releaseOwnedDocumentUploadQuota([member])).toEqual([memberKey])
      expect(await redis.zcard(memberKey)).toBe(0)
      expect(await redis.zcard(stewardKey)).toBe(1)
      const restored = await checkRateLimit(`doc-upload:${member}`, limits.DOCUMENT_UPLOAD)
      expect(restored.allowed).toBe(true)
      releaseOwnedDocumentUploadQuota([member, steward])
      expect(await redis.zcard(memberKey)).toBe(0)
      expect(await redis.zcard(stewardKey)).toBe(0)
    } finally {
      await redis.quit()
    }
  }, 60_000)
})
