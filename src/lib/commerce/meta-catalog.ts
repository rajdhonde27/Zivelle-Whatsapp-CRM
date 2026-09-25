import type { ProductAvailability } from '@/types'

const META_GRAPH_VERSION = 'v21.0'
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`

export interface RawMetaProduct {
  id: string
  retailer_id?: string
  name?: string
  description?: string
  price?: string
  currency?: string
  image_url?: string
  url?: string
  availability?: string
  category?: string
}

export interface NormalizedProduct {
  retailer_id: string
  title: string
  description?: string | null
  price: number
  currency: string
  image_url?: string | null
  url?: string | null
  availability: ProductAvailability
  category?: string | null
  raw_data: Record<string, unknown>
}

/**
 * Test connectivity with Meta Commerce Product Catalog.
 * Hits GET /{catalog_id}?fields=id,name,product_count
 */
export async function testMetaCatalogConnection(args: {
  catalogId: string
  accessToken: string
}): Promise<{ success: boolean; name?: string; productCount?: number; error?: string }> {
  const { catalogId, accessToken } = args
  try {
    const res = await fetch(
      `${META_GRAPH_BASE}/${encodeURIComponent(catalogId)}?fields=id,name,product_count`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error?.message || `Meta Catalog request failed with status ${res.status}`,
      }
    }
    return {
      success: true,
      name: data.name,
      productCount: typeof data.product_count === 'number' ? data.product_count : undefined,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

/**
 * Fetch products from a Meta Commerce Catalog.
 */
export async function fetchMetaCatalogProducts(args: {
  catalogId: string
  accessToken: string
  limit?: number
}): Promise<{ products: NormalizedProduct[]; error?: string }> {
  const { catalogId, accessToken, limit = 100 } = args
  try {
    const fields = [
      'id',
      'retailer_id',
      'name',
      'description',
      'price',
      'currency',
      'image_url',
      'url',
      'availability',
      'category',
    ].join(',')

    const url = `${META_GRAPH_BASE}/${encodeURIComponent(catalogId)}/products?fields=${fields}&limit=${limit}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
      return {
        products: [],
        error: data.error?.message || `Failed to fetch products (HTTP ${res.status})`,
      }
    }

    const items = (data.data as RawMetaProduct[]) || []
    const normalized: NormalizedProduct[] = items.map((p) => {
      // Parse numeric price: Meta returns price string (e.g. "99.00 USD" or "99.00")
      let numericPrice = 0
      if (p.price) {
        const cleaned = p.price.replace(/[^0-9.]/g, '')
        const parsed = parseFloat(cleaned)
        if (!isNaN(parsed)) numericPrice = parsed
      }

      let avail: ProductAvailability = 'in stock'
      if (p.availability) {
        const lower = p.availability.toLowerCase()
        if (lower.includes('out') || lower === 'discontinued') avail = 'out of stock'
        else if (lower.includes('preorder')) avail = 'preorder'
      }

      return {
        retailer_id: p.retailer_id || p.id,
        title: p.name || 'Untitled Product',
        description: p.description || null,
        price: numericPrice,
        currency: p.currency || 'USD',
        image_url: p.image_url || null,
        url: p.url || null,
        availability: avail,
        category: p.category || null,
        raw_data: p as unknown as Record<string, unknown>,
      }
    })

    return { products: normalized }
  } catch (err) {
    return {
      products: [],
      error: err instanceof Error ? err.message : 'Failed to fetch Meta products',
    }
  }
}
