import { NextRequest, NextResponse } from 'next/server'
import { ZohoInventoryClient } from '@/lib/zoho/inventory-client'
import { createZohoOAuthClient } from '@/lib/zoho/oauth'

/**
 * GET /api/zoho/products?q=search&page=1
 *
 * Search Zoho Inventory items by name or SKU.
 * Used by the product picker in the new-quote form.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? ''
  const page = Number(request.nextUrl.searchParams.get('page') ?? '1')

  const orgId = process.env.ZOHO_ORGANIZATION_ID
  if (!orgId) {
    return NextResponse.json({ items: [], message: 'Zoho not configured' })
  }

  try {
    const oauth = createZohoOAuthClient(orgId)
    const client = new ZohoInventoryClient(oauth, { organizationId: orgId })

    const response = await client.getItems(page, 50)
    let items = response.data ?? []

    // Client-side filter if query provided (Zoho API search is limited)
    if (query) {
      const q = query.toLowerCase()
      items = items.filter(
        (item) =>
          item.name?.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q),
      )
    }

    return NextResponse.json({
      items: items
        .filter((i) => i.status === 'active')
        .map((item) => ({
          itemId: item.item_id,
          name: item.name,
          sku: item.sku ?? '',
          description: item.description ?? '',
          rate: item.rate,
          unit: item.unit,
          stock: item.stock_on_hand ?? 0,
        })),
    })
  } catch {
    // Zoho not connected — return empty with message
    return NextResponse.json({ items: [], message: 'Zoho connection unavailable' })
  }
}
