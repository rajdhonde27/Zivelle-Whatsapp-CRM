import type { ProductAvailability } from '@/types'
import type { NormalizedProduct } from './meta-catalog'

const SHOPIFY_API_VERSION = '2024-01'

function cleanShopDomain(domain: string): string {
  let clean = domain.trim().toLowerCase()
  clean = clean.replace(/^https?:\/\//, '')
  clean = clean.replace(/\/$/, '')
  return clean
}

export async function testShopifyConnection(args: {
  shopDomain: string
  accessToken: string
}): Promise<{ success: boolean; shopName?: string; currency?: string; error?: string }> {
  const { shopDomain, accessToken } = args
  try {
    const domain = cleanShopDomain(shopDomain)
    const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.shop) {
      return {
        success: false,
        error:
          data.errors ||
          `Shopify connection failed (HTTP ${res.status}). Verify domain and access token.`,
      }
    }
    return {
      success: true,
      shopName: data.shop.name,
      currency: data.shop.currency,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Shopify connection failed',
    }
  }
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  const links = linkHeader.split(/,\s*(?=<)/)
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel=["']?next["']?/i)
    if (match) return match[1].trim()
  }
  return null
}

export async function fetchShopifyProducts(args: {
  shopDomain: string
  accessToken: string
  limit?: number
}): Promise<{ products: NormalizedProduct[]; error?: string }> {
  const { shopDomain, accessToken, limit } = args
  try {
    const domain = cleanShopDomain(shopDomain)

    // Attempt to get the shop currency
    let shopCurrency = 'USD'
    try {
      const shopRes = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
      })
      const shopData = await shopRes.json().catch(() => ({}))
      if (shopData?.shop?.currency) {
        shopCurrency = shopData.shop.currency
      }
    } catch {
      // Best-effort currency lookup
    }

    interface ShopifyVariant {
      id: number
      product_id?: number
      price: string
      sku?: string | null
      inventory_management?: string | null
      inventory_policy?: string | null
      inventory_quantity?: number | null
      title?: string
      image_id?: number | null
    }

    interface ShopifyImage {
      id?: number
      src: string
    }

    interface ShopifyProduct {
      id: number
      title: string
      body_html?: string | null
      product_type?: string | null
      vendor?: string | null
      handle: string
      variants: ShopifyVariant[]
      images: ShopifyImage[]
      status: string
    }

    // Shopify allows max 250 products per request
    const pageSize = limit && limit > 0 && limit <= 250 ? limit : 250
    let nextUrl: string | null = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=${pageSize}`
    const allItems: ShopifyProduct[] = []
    let pageCount = 0
    const MAX_PAGES = 40 // Up to 10,000 products safety limit

    while (nextUrl && pageCount < MAX_PAGES) {
      pageCount++

      // Request with retry on rate limit (HTTP 429)
      let res: Response | null = null
      let data: Record<string, unknown> = {}
      let attempt = 0
      const maxAttempts = 3

      while (attempt < maxAttempts) {
        attempt++
        try {
          res = await fetch(nextUrl, {
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': accessToken,
            },
          })

          if (res.status === 429) {
            // Respect Shopify's Retry-After header or default to 2 seconds
            const retryAfter = parseFloat(res.headers.get('retry-after') || '2')
            await new Promise((r) => setTimeout(r, Math.max(1000, retryAfter * 1000)))
            continue
          }

          data = await res.json().catch(() => ({}))
          break
        } catch (fetchErr) {
          if (attempt >= maxAttempts) throw fetchErr
          await new Promise((r) => setTimeout(r, 1000))
        }
      }

      if (!res || !res.ok || !Array.isArray(data.products)) {
        if (allItems.length > 0) {
          // If at least one page succeeded, use the products fetched so far
          break
        }
        return {
          products: [],
          error:
            typeof data.errors === 'string'
              ? data.errors
              : `Failed to fetch Shopify products (HTTP ${res?.status || 'network error'})`,
        }
      }

      allItems.push(...(data.products as ShopifyProduct[]))

      if (limit && limit > 0 && allItems.length >= limit) {
        break
      }

      const linkHeader = res.headers.get('link')
      nextUrl = parseNextLink(linkHeader)

      // Slight polite delay to avoid consuming entire Shopify leaky bucket
      if (nextUrl) {
        await new Promise((r) => setTimeout(r, 150))
      }
    }

    // Normalize products and variants
    // If a product has multiple variants (e.g., sizes/colors), each variant is represented as an item
    // so that 100% of store items can be viewed, filtered, and sent to WhatsApp customers.
    const seenRetailerIds = new Set<string>()
    const normalized: NormalizedProduct[] = []

    for (const p of allItems) {
      // Strip basic HTML from body_html
      let desc: string | null = null
      if (p.body_html) {
        desc = p.body_html.replace(/<[^>]*>?/gm, '').trim()
      }

      // Map image IDs to src
      const productImagesMap = new Map<number, string>()
      if (Array.isArray(p.images)) {
        for (const img of p.images) {
          if (img.id && img.src) productImagesMap.set(img.id, img.src)
        }
      }
      const defaultImageUrl = p.images?.[0]?.src || null

      const variants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : [null]
      const hasMultipleVariants = variants.length > 1

      for (const v of variants) {
        // Item title
        let itemTitle = p.title || 'Untitled Product'
        if (hasMultipleVariants && v?.title && v.title !== 'Default Title') {
          itemTitle = `${p.title} - ${v.title}`
        }

        // Price
        const price = v?.price ? parseFloat(v.price) : 0

        // Collision-free unique retailer_id
        let retailerId = ''
        const trimmedSku = v?.sku?.trim()
        if (trimmedSku && !seenRetailerIds.has(trimmedSku)) {
          retailerId = trimmedSku
        } else if (v?.id) {
          retailerId = `shopify_${p.id}_${v.id}`
        } else {
          retailerId = `shopify_${p.id}`
        }

        if (seenRetailerIds.has(retailerId)) {
          let suffix = 1
          while (seenRetailerIds.has(`${retailerId}_${suffix}`)) {
            suffix++
          }
          retailerId = `${retailerId}_${suffix}`
        }
        seenRetailerIds.add(retailerId)

        // Availability:
        // A variant is "out of stock" if:
        // 1. The parent product is not active (draft / archived), OR
        // 2. Quantity is 0 or less, backorders are not allowed (policy !== 'continue'),
        //    and inventory is tracked (management !== null).
        let avail: ProductAvailability = 'in stock'
        if (p.status !== 'active') {
          avail = 'out of stock'
        } else if (
          v &&
          v.inventory_policy !== 'continue' &&
          v.inventory_management !== null &&
          typeof v.inventory_quantity === 'number' &&
          v.inventory_quantity <= 0
        ) {
          avail = 'out of stock'
        } else if (
          v &&
          v.inventory_policy === 'continue' &&
          typeof v.inventory_quantity === 'number' &&
          v.inventory_quantity <= 0
        ) {
          avail = 'preorder'
        }

        // Image
        const variantImageUrl =
          (v?.image_id ? productImagesMap.get(v.image_id) : null) || defaultImageUrl

        // Product Link
        const productUrl =
          v?.id && hasMultipleVariants
            ? `https://${domain}/products/${p.handle}?variant=${v.id}`
            : `https://${domain}/products/${p.handle}`

        normalized.push({
          retailer_id: retailerId,
          title: itemTitle,
          description: desc,
          price: isNaN(price) ? 0 : price,
          currency: shopCurrency,
          image_url: variantImageUrl,
          url: productUrl,
          availability: avail,
          category: p.product_type || null,
          raw_data: {
            shopify_product_id: p.id,
            shopify_variant_id: v?.id,
            handle: p.handle,
            vendor: p.vendor,
            status: p.status,
            inventory_quantity: v?.inventory_quantity,
            inventory_policy: v?.inventory_policy,
            inventory_management: v?.inventory_management,
          },
        })
      }
    }

    return { products: normalized }
  } catch (err) {
    return {
      products: [],
      error: err instanceof Error ? err.message : 'Failed to fetch Shopify products',
    }
  }
}
