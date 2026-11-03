import { describe, expect, it } from 'vitest'
import { validateEnv } from './server'
describe('Zod 4 media worker environment boundary', () => {
  it('preserves coercion and defaults while rejecting invalid endpoints and concurrency', () => {
    const original = process.env
    try {
      process.env = { S3_ENDPOINT: 'https://s3.example.com', S3_ACCESS_KEY_ID: 'access', S3_SECRET_ACCESS_KEY: 'secret', S3_BUCKET: 'bucket', REDIS_URL: 'redis://localhost:6379', DATABASE_URL: 'postgresql://user:pass@localhost:5432/db', PORT: '8081', WORKER_CONCURRENCY: '3' }
      const parsed = validateEnv()
      expect(parsed.PORT).toBe(8081)
      expect(parsed.WORKER_CONCURRENCY).toBe(3)
      expect(parsed.S3_REGION).toBe('auto')
      process.env = { ...process.env, S3_ENDPOINT: 'invalid-endpoint' }
      expect(() => validateEnv()).toThrow('Invalid environment configuration:')
      process.env = { ...process.env, S3_ENDPOINT: 'https://s3.example.com', WORKER_CONCURRENCY: '-1' }
      expect(() => validateEnv()).toThrow('Invalid environment configuration:')
      process.env = { ...process.env, WORKER_CONCURRENCY: '65' }
      expect(() => validateEnv()).toThrow('Invalid environment configuration:')
      process.env = { ...process.env, WORKER_CONCURRENCY: '64' }
      expect(validateEnv().WORKER_CONCURRENCY).toBe(64)
    } finally {
      process.env = original
    }
  })
})
