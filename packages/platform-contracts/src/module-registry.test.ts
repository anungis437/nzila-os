import { describe, it, expect } from 'vitest'
import {
  moduleRegistrationSchema,
  moduleManifestSchema,
} from './module-registry'

describe('moduleRegistrationSchema', () => {
  it('validates a well-formed registration', () => {
    const mod = {
      id: 'union-eyes',
      name: 'UnionEyes',
      basePath: '/union-eyes',
      tier: 'PRODUCTION',
    }
    const result = moduleRegistrationSchema.safeParse(mod)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.showInNav).toBe(true)
      expect(result.data.navOrder).toBe(100)
      expect(result.data.enabledByDefault).toBe(false)
      expect(result.data.requiresOrgScope).toBe(true)
    }
  })

  it('rejects invalid module id format', () => {
    const mod = {
      id: 'INVALID_ID',
      name: 'Bad',
      basePath: '/bad',
      tier: 'PRODUCTION',
    }
    const result = moduleRegistrationSchema.safeParse(mod)
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const mod = {
      id: 'test',
      name: '',
      basePath: '/test',
      tier: 'PRODUCTION',
    }
    const result = moduleRegistrationSchema.safeParse(mod)
    expect(result.success).toBe(false)
  })
})

describe('moduleManifestSchema', () => {
  it('extends registration with runtime fields', () => {
    const manifest = {
      id: 'flow',
      name: 'Flow',
      basePath: '/flow',
      tier: 'PRODUCTION',
      accessible: true,
      enabledForOrg: true,
    }
    const result = moduleManifestSchema.safeParse(manifest)
    expect(result.success).toBe(true)
  })
})
