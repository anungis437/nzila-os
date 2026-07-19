import { describe, expect, it } from 'vitest'
import type { SageWorkspace, SageWorkspaceSummary } from '@nzila/sage-core'
import {
  toSummaryResponse,
  toWorkspaceDetailResponse,
  toWorkspaceListResponse,
  toWorkspaceResponse,
} from '../view'

function workspace(overrides: Partial<SageWorkspace> = {}): SageWorkspace {
  return {
    id: 'ws-1',
    orgId: 'org-1',
    name: 'Test WS',
    status: 'draft',
    institutionType: 'regulator',
    riskSurface: 'regulatory_boundary',
    boundaryProfile: {
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
      excludedSourceClasses: ['leaked'],
      prohibitedUses: ['no automated decisions'],
      requiredReviewers: ['privacy'],
      exportRestrictions: ['no external export of excluded'],
      notes: [],
    },
    createdBy: 'actor-1',
    updatedBy: 'actor-1',
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
    ...overrides,
  }
}

describe('view mappers', () => {
  it('toWorkspaceResponse exposes only browser-safe identity fields', () => {
    const res = toWorkspaceResponse(workspace())
    expect(res).toEqual({
      id: 'ws-1',
      name: 'Test WS',
      status: 'draft',
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    })
    // Never leaks orgId, createdBy, or the raw boundary profile object.
    expect(res).not.toHaveProperty('orgId')
    expect(res).not.toHaveProperty('createdBy')
    expect(res).not.toHaveProperty('boundaryProfile')
  })

  it('toWorkspaceListResponse maps an empty list to a stable shape', () => {
    expect(toWorkspaceListResponse([])).toEqual({ workspaces: [] })
  })

  it('toWorkspaceDetailResponse includes structured boundary posture (no raw JSON)', () => {
    const detail = toWorkspaceDetailResponse(workspace())
    expect(detail.boundaryProfile.prohibitedUses).toContain('no automated decisions')
    expect(detail.boundaryProfile.excludedSourceClasses).toContain('leaked')
    expect(detail.boundaryProfile.requiredReviewers).toContain('privacy')
  })

  it('toSummaryResponse returns status + counts only, with no forbidden fields', () => {
    const summary: SageWorkspaceSummary = {
      workspaceId: 'ws-1',
      orgId: 'org-1',
      name: 'Test WS',
      status: 'active',
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
      boundaryProfilePresent: true,
      counts: {
        evidenceSources: 2,
        evidenceItems: 3,
        boundaryFlags: 1,
        decisionRecords: 0,
        openExportRequests: 4,
      },
    }
    const res = toSummaryResponse(summary)
    expect(res.counts.evidenceSources).toBe(2)
    expect(res.status).toBe('active')

    const serialized = JSON.stringify(res).toLowerCase()
    expect(serialized).not.toMatch(/score|rank|grade|certif/)
  })
})
