import { NextRequest, NextResponse } from 'next/server'
import {
  SearchModes,
  createInMemorySearchIndex,
  indexEntity,
  searchEntities,
} from '@nzila/platform-semantic-search'
import type { SearchMode } from '@nzila/platform-semantic-search'
import {
  listTrustcoreDataAssets,
  listTrustcoreVendors,
} from '@nzila/db/queries/trustcore'
import { withRequiredRole } from '@/lib/rbac/requireRole'

const VALID_MODES = new Set<SearchMode>(Object.values(SearchModes) as SearchMode[])

function isSearchMode(value: unknown): value is SearchMode {
  return typeof value === 'string' && VALID_MODES.has(value as SearchMode)
}

function compactTags(values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

type SearchBody = {
  query?: unknown
  mode?: unknown
  limit?: unknown
}

export const POST = withRequiredRole(
  ['auditor', 'staff', 'org_admin', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    const body = (await request.json().catch(() => null)) as SearchBody | null
    const query = typeof body?.query === 'string' ? body.query.trim() : ''
    const mode = isSearchMode(body?.mode)
      ? body.mode
      : SearchModes.LEXICAL
    const limit =
      typeof body?.limit === 'number' && Number.isFinite(body.limit)
        ? Math.max(1, Math.min(20, Math.floor(body.limit)))
        : 10

    if (!query) {
      return NextResponse.json({ success: false, error: 'query is required' }, { status: 400 })
    }

    const [assets, vendors] = await Promise.all([
      listTrustcoreDataAssets(ctx.orgId),
      listTrustcoreVendors(ctx.orgId),
    ])

    const index = createInMemorySearchIndex()

    for (const asset of assets) {
      await indexEntity(index, {
        tenantId: ctx.orgId,
        entityType: 'data_asset',
        entityId: asset.id,
        title: asset.name,
        content: [
          asset.description,
          asset.processingPurpose,
          asset.storageLocation,
          asset.dataCategory,
          asset.sensitivityLevel,
        ]
          .filter(Boolean)
          .join(' '),
        metadata: {
          module: 'data_inventory',
          sensitivityLevel: asset.sensitivityLevel,
          crossBorderTransfer: asset.crossBorderTransfer,
        },
        tags: compactTags([asset.dataCategory, asset.sensitivityLevel, 'data_asset']),
      })
    }

    for (const vendor of vendors) {
      await indexEntity(index, {
        tenantId: ctx.orgId,
        entityType: 'vendor',
        entityId: vendor.id,
        title: vendor.name,
        content: [
          vendor.serviceDescription,
          vendor.dataSharedDescription,
          vendor.country,
          vendor.riskLevel,
        ]
          .filter(Boolean)
          .join(' '),
        metadata: {
          module: 'vendors',
          riskLevel: vendor.riskLevel,
          crossBorderTransfer: vendor.crossBorderTransfer,
        },
        tags: compactTags([vendor.riskLevel, vendor.country, 'vendor']),
      })
    }

    const results = await searchEntities(index, {
      tenantId: ctx.orgId,
      query,
      mode,
      limit,
    })

    return NextResponse.json({ success: true, data: results })
  },
)