import { describe, expect, it } from 'vitest'
import {
  classifyConnectionEnvironment,
  environmentReferences,
} from './connection-environment-surface'

describe('source-derived connection environment surface', () => {
  it('collects literals, brackets and destructuring without inventing dynamic selector values', () => {
    const references = environmentReferences(
      `
      const a=process.env.DATABASE_URL;
      const b=process.env['REDIS_URL'];
      const { SMTP_HOST: smtp, AUTH_SECRET: auth }=process.env;
      const c=process.env[key];
      const flag=process.env.FEATURE_ENABLED;
    `,
      'runtime.ts',
    )
    expect(references.map((entry) => entry.key)).toEqual([
      'DATABASE_URL',
      'REDIS_URL',
      'SMTP_HOST',
      null,
    ])
    expect(references.every((entry) => /^[a-f0-9]{64}$/.test(entry.sourceDigest))).toBe(true)
  })

  it('classifies only exact owned ports and does not persist credential values', () => {
    const references = environmentReferences('const db=process.env.DATABASE_URL', 'db.ts')
    const surface = {
      references,
      keys: ['DATABASE_URL'],
      dynamicSelectors: [],
      sourceDigest: '',
      sourceScope: '',
    }
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://synthetic:private@127.0.0.1:54321/owned',
      UE_V2_LOCAL_PORTS: '54321',
    }
    const result = classifyConnectionEnvironment(surface, env)
    expect(result[0].classification).toBe('OWNED_LOOPBACK_FIXTURE')
    expect(JSON.stringify(result)).not.toContain('private')
    expect(() =>
      classifyConnectionEnvironment(surface, { ...env, UE_V2_LOCAL_PORTS: '54322' }),
    ).toThrow('Unowned')
    expect(() =>
      classifyConnectionEnvironment(surface, {
        ...env,
        DATABASE_URL: 'postgresql://external.invalid:54321/db',
      }),
    ).toThrow('Unowned')
  })
})
