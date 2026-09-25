import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { decrypt } from '@/lib/whatsapp/encryption'
import { fetchMetaCatalogProducts } from '@/lib/commerce/meta-catalog'
import { fetchShopifyProducts } from '@/lib/commerce/shopify'
import { fetchWooCommerceProducts } from '@/lib/commerce/woocommerce'
import type { NormalizedProduct } from '@/lib/commerce/meta-catalog'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * POST /api/commerce/sync/[provider]  (admin+)
 * Fetches products from Meta Catalog, Shopify, or WooCommerce and
 * upserts into `catalog_products`.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ provider: string }> }
) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const params = await props.params
    const provider = params.provider

    if (provider !== 'meta' && provider !== 'shopify' && provider !== 'woocommerce') {
      return bad('Unknown provider')
    }

    const limit = checkRateLimit(`commerce-sync:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    // Load credentials from commerce_settings
    const { data: settings } = await supabase
      .from('commerce_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (!settings) {
      return bad('Commerce settings have not been configured yet.')
    }

    let products: NormalizedProduct[] = []
    let fetchError: string | undefined

    if (provider === 'meta') {
      const catalogId = settings.meta_catalog_id
      if (!catalogId) return bad('Meta Catalog ID is not configured.')

      let accessToken = settings.meta_access_token ? decrypt(settings.meta_access_token) : null
      if (!accessToken) {
        const { data: waConfig } = await supabase
          .from('whatsapp_config')
          .select('access_token')
          .eq('account_id', accountId)
          .maybeSingle()
        if (waConfig?.access_token) accessToken = decrypt(waConfig.access_token)
      }

      if (!accessToken) {
        return bad('No active Meta access token found. Configure in Settings or Catalog.')
      }

      const res = await fetchMetaCatalogProducts({ catalogId, accessToken })
      products = res.products
      fetchError = res.error
    } else if (provider === 'shopify') {
      const domain = settings.shopify_shop_domain
      const token = settings.shopify_access_token ? decrypt(settings.shopify_access_token) : null
      if (!domain || !token) {
        return bad('Shopify shop domain or access token is not configured.')
      }

      const res = await fetchShopifyProducts({ shopDomain: domain, accessToken: token })
      products = res.products
      fetchError = res.error
    } else if (provider === 'woocommerce') {
      const storeUrl = settings.woocommerce_store_url
      const key = settings.woocommerce_consumer_key ? decrypt(settings.woocommerce_consumer_key) : null
      const secret = settings.woocommerce_consumer_secret
        ? decrypt(settings.woocommerce_consumer_secret)
        : null

      if (!storeUrl || !key || !secret) {
        return bad('WooCommerce store URL or API keys are not configured.')
      }

      const res = await fetchWooCommerceProducts({
        storeUrl,
        consumerKey: key,
        consumerSecret: secret,
      })
      products = res.products
      fetchError = res.error
    }

    if (fetchError && products.length === 0) {
      return NextResponse.json({ error: fetchError }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Upsert into catalog_products
    if (products.length > 0) {
      const rows = products.map((p) => ({
        account_id: accountId,
        source: provider,
        retailer_id: p.retailer_id,
        title: p.title,
        description: p.description,
        price: p.price,
        currency: p.currency,
        image_url: p.image_url,
        url: p.url,
        availability: p.availability,
        category: p.category,
        raw_data: p.raw_data,
        last_synced_at: now,
        updated_at: now,
      }))

      // Batch upsert in chunks of 50 to avoid payload limit or timeout issues
      const BATCH_SIZE = 50
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE)
        const { error: upsertErr } = await supabase
          .from('catalog_products')
          .upsert(chunk, { onConflict: 'account_id,source,retailer_id' })

        if (upsertErr) {
          console.error(`[commerce/sync/${provider}] upsert error at chunk ${i}:`, upsertErr)
          return NextResponse.json(
            { error: `Database error saving products: ${upsertErr.message}` },
            { status: 500 }
          )
        }
      }
    }

    // Update timestamp in commerce_settings
    const timestampCol =
      provider === 'meta'
        ? 'meta_last_synced_at'
        : provider === 'shopify'
        ? 'shopify_last_synced_at'
        : 'woocommerce_last_synced_at'

    await supabase
      .from('commerce_settings')
      .update({ [timestampCol]: now, updated_at: now })
      .eq('account_id', accountId)

    return NextResponse.json({
      success: true,
      provider,
      count: products.length,
      synced_at: now,
      warning: fetchError,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
