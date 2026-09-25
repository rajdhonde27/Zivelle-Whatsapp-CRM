import type { ProductAvailability } from '@/types'
import type { NormalizedProduct } from './meta-catalog'

function cleanStoreUrl(url: string): string {
  let clean = url.trim()
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`
  }
  return clean.replace(/\/$/, '')
}

function getAuthHeader(consumerKey: string, consumerSecret: string): string {
  const credentials = `${consumerKey.trim()}:${consumerSecret.trim()}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

export async function testWooCommerceConnection(args: {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
}): Promise<{ success: boolean; storeName?: string; productCount?: number; error?: string }> {
  const { storeUrl, consumerKey, consumerSecret } = args
  try {
    const base = cleanStoreUrl(storeUrl)
    // Query 1 product to check credentials and endpoint
    const url = `${base}/wp-json/wc/v3/products?per_page=1`
    const res = await fetch(url, {
      headers: {
        Authorization: getAuthHeader(consumerKey, consumerSecret),
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || (data && data.code && data.message)) {
      return {
        success: false,
        error:
          data?.message ||
          `WooCommerce connection failed (HTTP ${res.status}). Verify store URL, Consumer Key, and Consumer Secret.`,
      }
    }
    const totalCount = res.headers.get('x-wp-total')
    return {
      success: true,
      productCount: totalCount ? parseInt(totalCount, 10) : undefined,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'WooCommerce connection failed',
    }
  }
}

export async function fetchWooCommerceProducts(args: {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
  limit?: number
}): Promise<{ products: NormalizedProduct[]; error?: string }> {
  const { storeUrl, consumerKey, consumerSecret, limit } = args
  try {
    const base = cleanStoreUrl(storeUrl)
    const perPage = limit && limit > 0 && limit <= 100 ? limit : 100
    const allItems: WCProduct[] = []
    let page = 1
    let hasMore = true
    const MAX_PAGES = 50 // Up to 5,000 products safety ceiling

    interface WCImage {
      src: string
    }

    interface WCCategory {
      name: string
    }

    interface WCProduct {
      id: number
      name: string
      sku?: string | null
      price?: string | null
      regular_price?: string | null
      permalink?: string | null
      description?: string | null
      short_description?: string | null
      stock_status?: string | null
      images?: WCImage[]
      categories?: WCCategory[]
    }

    while (hasMore && page <= MAX_PAGES) {
      const url = `${base}/wp-json/wc/v3/products?per_page=${perPage}&page=${page}&status=publish`
      const res = await fetch(url, {
        headers: {
          Authorization: getAuthHeader(consumerKey, consumerSecret),
        },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !Array.isArray(data)) {
        if (allItems.length > 0) break
        return {
          products: [],
          error:
            data?.message || `Failed to fetch WooCommerce products (HTTP ${res.status})`,
        }
      }

      const items = data as WCProduct[]
      allItems.push(...items)

      if (items.length < perPage || (limit && limit > 0 && allItems.length >= limit)) {
        hasMore = false
      } else {
        page++
      }
    }

    const normalized: NormalizedProduct[] = allItems.map((p) => {
      const priceStr = p.price || p.regular_price || '0'
      const parsedPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''))
      const sku = p.sku?.trim() || `wc_${p.id}`

      // Strip basic HTML from description or short_description
      let desc: string | null = null
      const rawDesc = p.short_description || p.description
      if (rawDesc) {
        desc = rawDesc.replace(/<[^>]*>?/gm, '').trim()
      }

      let avail: ProductAvailability = 'in stock'
      if (p.stock_status === 'outofstock') {
        avail = 'out of stock'
      } else if (p.stock_status === 'onbackorder') {
        avail = 'preorder'
      }

      const imageUrl = p.images?.[0]?.src || null
      const category = p.categories?.[0]?.name || null

      return {
        retailer_id: sku,
        title: p.name || 'Untitled Product',
        description: desc,
        price: isNaN(parsedPrice) ? 0 : parsedPrice,
        currency: 'USD',
        image_url: imageUrl,
        url: p.permalink || null,
        availability: avail,
        category,
        raw_data: p as unknown as Record<string, unknown>,
      }
    })

    return { products: normalized }
  } catch (err) {
    return {
      products: [],
      error: err instanceof Error ? err.message : 'Failed to fetch WooCommerce products',
    }
  }
}
