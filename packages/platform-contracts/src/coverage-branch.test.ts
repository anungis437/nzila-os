import { describe, it, expect } from 'vitest'
import { meetsRoleRequirement } from './role.js'
import {
  paginationInputSchema,
  buildPaginationMeta,
  paginatedListSchema,
  cursorListSchema,
} from './pagination.js'
import { checkFeatureGate, featureGateManifestSchema } from './entitlement.js'
import { platformEventSchema } from './platform-event.js'
import { notificationSchema } from './notification.js'
import { fileMetadataSchema } from './file-metadata.js'
import {
  isValidHealthResponse,
  isValidMetricsSummary,
  isValidGovernanceTelemetry,
  isValidEvidenceExport,
} from './schemas.js'
import { validateAppManifest, validateAppRegistry } from './app-registry.js'
import {
  userIdentitySchema,
  sessionIdentitySchema,
  userDisplayProfileSchema,
} from './identity.js'
import {
  orgScopeSchema,
  orgScopedRequestContextSchema,
  toOrgScopeId,
} from './org-scope.js'
import {
  platformAuditEventSchema,
  platformAuditInputSchema,
} from './audit-event.js'

describe('role hierarchy fallback branch', () => {
  it('returns false when user role is unknown at runtime', () => {
    expect(meetsRoleRequirement('unknown-role' as Parameters<typeof meetsRoleRequirement>[0], 'org_viewer')).toBe(false)
  })
})

describe('pagination contracts', () => {
  it('coerces and defaults pagination input', () => {
    const input = paginationInputSchema.parse({ page: '2', pageSize: '10' })
    expect(input.page).toBe(2)
    expect(input.pageSize).toBe(10)
    expect(input.sortOrder).toBe('desc')
  })

  it('builds meta with next/previous branch variants', () => {
    const first = buildPaginationMeta(95, { page: 1, pageSize: 20, sortOrder: 'desc' })
    expect(first.hasNextPage).toBe(true)
    expect(first.hasPreviousPage).toBe(false)

    const last = buildPaginationMeta(95, { page: 5, pageSize: 20, sortOrder: 'desc' })
    expect(last.hasNextPage).toBe(false)
    expect(last.hasPreviousPage).toBe(true)
  })

  it('validates paginated and cursor list schemas', () => {
    const paged = paginatedListSchema(notificationSchema).parse({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    })
    expect(paged.items).toEqual([])

    const cursor = cursorListSchema(fileMetadataSchema).parse({
      items: [],
      cursor: {
        nextCursor: null,
        previousCursor: null,
        hasMore: false,
        count: 0,
      },
    })
    expect(cursor.cursor.hasMore).toBe(false)
  })
})

describe('feature gate branches', () => {
  const manifest = featureGateManifestSchema.parse({
    appId: 'partners',
    tierOrder: ['registered', 'select', 'professional', 'enterprise'],
    gates: [{ feature: 'deals.pipeline', minTier: 'professional', audited: true }],
  })

  it('grants when no gate is defined for feature', () => {
    expect(checkFeatureGate(manifest, 'deals.unknown', 'registered')).toEqual({
      key: 'deals.unknown',
      granted: true,
    })
  })

  it('denies when tier order is unknown', () => {
    const customManifest = {
      ...manifest,
      tierOrder: ['registered', 'select'] as const,
    }
    const result = checkFeatureGate(
      customManifest as unknown as Parameters<typeof checkFeatureGate>[0],
      'deals.pipeline',
      'professional' as Parameters<typeof checkFeatureGate>[2],
    )
    expect(result.granted).toBe(false)
    expect(result.reason).toBe('Unknown tier')
  })

  it('denies below min tier and grants at/above min tier', () => {
    const denied = checkFeatureGate(manifest, 'deals.pipeline', 'select')
    expect(denied.granted).toBe(false)
    expect(denied.reason).toBe('Requires professional tier')

    const granted = checkFeatureGate(manifest, 'deals.pipeline', 'enterprise')
    expect(granted.granted).toBe(true)
    expect(granted.reason).toBeUndefined()
  })
})

describe('schema defaults and validators', () => {
  it('applies defaults in platform event and notification schemas', () => {
    const event = platformEventSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'session.started',
      timestamp: '2026-01-01T00:00:00.000Z',
      actorId: 'user-1',
      payload: {},
    })
    expect(event.version).toBe(1)

    const notification = notificationSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      recipientId: 'user-1',
      title: 'Title',
      body: 'Body',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(notification.priority).toBe('normal')
    expect(notification.channels).toEqual(['in_app'])
    expect(notification.read).toBe(false)
  })

  it('validates file metadata and contract validator success/failure branches', () => {
    const file = fileMetadataSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440002',
      orgId: 'org-1',
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      storagePath: 'blob/doc.pdf',
      uploadedAt: '2026-01-01T00:00:00.000Z',
      uploadedBy: 'user-1',
    })
    expect(file.accessLevel).toBe('org')

    expect(isValidHealthResponse({ app: 'a' })).toBe(false)
    expect(
      isValidHealthResponse({
        status: 'healthy',
        app: 'app',
        version: '1',
        timestamp: '2026-01-01T00:00:00.000Z',
        uptime_seconds: 1,
        components: [],
      }),
    ).toBe(true)

    expect(isValidMetricsSummary({ app: 'app', org_id: 'org', entries: [{ name: 'n', type: 'bad', value: 1 }] })).toBe(false)
    expect(
      isValidMetricsSummary({
        app: 'app',
        org_id: 'org',
        period_start: 'a',
        period_end: 'b',
        entries: [{ name: 'n', type: 'counter', value: 1, labels: {}, timestamp: 't' }],
      }),
    ).toBe(true)

    expect(isValidGovernanceTelemetry({ app: 'app', org_id: 'org', checks: [], overall_result: 'nope' })).toBe(false)
    expect(
      isValidGovernanceTelemetry({
        app: 'app',
        org_id: 'org',
        checks: [],
        overall_result: 'warn',
        generated_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(true)

    expect(isValidEvidenceExport({ app: 'app', org_id: 'org', export_id: 1, artifacts: [], chain_hash: 'x' })).toBe(false)
    expect(
      isValidEvidenceExport({
        app: 'app',
        org_id: 'org',
        export_id: 'exp-1',
        artifacts: [],
        chain_hash: 'abc',
      }),
    ).toBe(true)
  })

  it('validates identity, org scope, and audit event contracts', () => {
    const identity = userIdentitySchema.parse({
      userId: 'user-1',
      email: 'user@example.com',
      displayName: 'Test User',
      onboarded: true,
    })
    const session = sessionIdentitySchema.parse({
      sessionId: 'session-1',
      user: identity,
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
    })
    const profile = userDisplayProfileSchema.parse({
      userId: 'user-1',
      displayName: 'Test User',
      email: 'user@example.com',
      initials: 'TU',
    })
    const org = orgScopeSchema.parse({
      id: 'org-1',
      name: 'Org One',
      slug: 'org-one',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const requestContext = orgScopedRequestContextSchema.parse({
      orgId: 'org-1',
      actorId: 'user-1',
      role: 'org_admin',
      permissions: ['claims.read'],
      requestId: 'req-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      moduleId: 'claims',
    })
    const auditEvent = platformAuditEventSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440010',
      timestamp: '2026-01-01T00:00:00.000Z',
      actorId: 'user-1',
      orgId: 'org-1',
      moduleId: 'claims',
      action: 'claim.created',
      resource: 'claim',
      payload: {},
    })
    const auditInput = platformAuditInputSchema.parse({
      actorId: 'user-1',
      orgId: 'org-1',
      moduleId: 'claims',
      action: 'claim.created',
      resource: 'claim',
      payload: {},
    })

    expect(session.user.userId).toBe(identity.userId)
    expect(profile.initials).toBe('TU')
    expect(toOrgScopeId(org.id)).toBe('org-1')
    expect(requestContext.moduleId).toBe('claims')
    expect(auditEvent.severity).toBe('info')
    expect(auditEvent.evidenceGrade).toBe(false)
    expect(auditInput.action).toBe('claim.created')
  })
})

describe('app registry validation branches', () => {
  function baseManifest() {
    return {
      id: 'sample-app',
      name: 'Sample App',
      basePath: '/sample',
      tier: 'PRODUCTION' as const,
      requiresOrgScope: true,
      enabledCapabilities: ['auth'],
      reportingBindings: { emitsFinancialRecords: true },
    }
  }

  it('returns warnings and errors from validateAppManifest branch paths', () => {
    const result = validateAppManifest(baseManifest())
    expect(result.valid).toBe(false)
    expect(result.warnings.some((w) => w.includes('no governance requirements'))).toBe(true)
    expect(result.warnings.some((w) => w.includes("does not declare 'org-scope' capability"))).toBe(true)
    expect(result.warnings.some((w) => w.includes('no health binding declared'))).toBe(true)
    expect(result.errors.some((e) => e.includes("does not declare 'evidence' capability"))).toBe(true)
  })

  it('returns parse errors for invalid manifest input', () => {
    const result = validateAppManifest({ id: '', tier: 'NOT_A_TIER' })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('detects duplicate IDs and provider summary in validateAppRegistry', () => {
    const one = {
      id: 'dup-app',
      name: 'One',
      basePath: '/one',
      tier: 'PILOT' as const,
      integrationDependencies: [{ provider: 'entra', type: 'auth' as const, required: true }],
    }
    const two = {
      id: 'dup-app',
      name: 'Two',
      basePath: '/two',
      tier: 'PILOT' as const,
      integrationDependencies: [{ provider: 'postgresql', type: 'storage' as const, required: true }],
    }

    const result = validateAppRegistry([one, two])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Duplicate app ID'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('Registry uses 2 integration providers'))).toBe(true)
  })
})

describe('module loading coverage', () => {
  it('loads the barrel file and type-only contract modules', async () => {
    const barrel = await import('./index.js')
    const modules = await Promise.all([
      import('./change.js'),
      import('./environment.js'),
      import('./evidence.js'),
      import('./governance.js'),
      import('./health.js'),
      import('./metrics.js'),
    ])

    expect(barrel.platformAuditEventSchema).toBe(platformAuditEventSchema)
    expect(barrel.userIdentitySchema).toBe(userIdentitySchema)
    expect(modules).toHaveLength(6)
    expect(modules.every((moduleExports) => typeof moduleExports === 'object')).toBe(true)
  })
})
