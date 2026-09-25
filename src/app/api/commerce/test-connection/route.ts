import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { decrypt } from '@/lib/whatsapp/encryption'
import { testMetaCatalogConnection } from '@/lib/commerce/meta-catalog'
import { testShopifyConnection } from '@/lib/commerce/shopify'
import { testWooCommerceConnection } from '@/lib/commerce/woocommerce'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * POST /api/commerce/test-connection (admin+)
 * Test connection with Meta Catalog, Shopify, or WooCommerce.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const limit = checkRateLimit(`commerce-test:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const provider = body.provider
    if (provider !== 'meta' && provider !== 'shopify' && provider !== 'woocommerce') {
      return bad('provider must be "meta", "shopify", or "woocommerce"')
    }

    // Load existing settings in case user tested without re-entering saved secrets
    const { data: settings } = await supabase
      .from('commerce_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (provider === 'meta') {
      const catalogId = body.catalogId?.trim() || settings?.meta_catalog_id
      if (!catalogId) return bad('Meta Catalog ID is required.')

      let accessToken = body.accessToken?.trim()
      if (!accessToken && settings?.meta_access_token) {
        accessToken = decrypt(settings.meta_access_token)
      }
      if (!accessToken) {
        // Fall back to whatsapp_config access token if available
        const { data: waConfig } = await supabase
          .from('whatsapp_config')
          .select('access_token')
          .eq('account_id', accountId)
          .maybeSingle()
        if (waConfig?.access_token) {
          accessToken = decrypt(waConfig.access_token)
        }
      }

      if (!accessToken) {
        return bad('Meta Access Token is required (or connect WhatsApp in Settings first).')
      }

      const result = await testMetaCatalogConnection({ catalogId, accessToken })
      return NextResponse.json(result)
    }

    if (provider === 'shopify') {
      const shopDomain = body.shopDomain?.trim() || settings?.shopify_shop_domain
      if (!shopDomain) return bad('Shopify Shop Domain is required.')

      let accessToken = body.accessToken?.trim()
      if (!accessToken && settings?.shopify_access_token) {
        accessToken = decrypt(settings.shopify_access_token)
      }
      if (!accessToken) return bad('Shopify Admin Access Token is required.')

      const result = await testShopifyConnection({ shopDomain, accessToken })
      return NextResponse.json(result)
    }

    if (provider === 'woocommerce') {
      const storeUrl = body.storeUrl?.trim() || settings?.woocommerce_store_url
      if (!storeUrl) return bad('WooCommerce Store URL is required.')

      let consumerKey = body.consumerKey?.trim()
      if (!consumerKey && settings?.woocommerce_consumer_key) {
        consumerKey = decrypt(settings.woocommerce_consumer_key)
      }

      let consumerSecret = body.consumerSecret?.trim()
      if (!consumerSecret && settings?.woocommerce_consumer_secret) {
        consumerSecret = decrypt(settings.woocommerce_consumer_secret)
      }

      if (!consumerKey || !consumerSecret) {
        return bad('WooCommerce Consumer Key and Consumer Secret are required.')
      }

      const result = await testWooCommerceConnection({ storeUrl, consumerKey, consumerSecret })
      return NextResponse.json(result)
    }

    return bad('Invalid provider')
  } catch (err) {
    return toErrorResponse(err)
  }
}
