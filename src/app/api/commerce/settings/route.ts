import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { encrypt } from '@/lib/whatsapp/encryption'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * GET /api/commerce/settings
 * Read account commerce settings. Tokens are stripped and represented as boolean flags.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { data, error } = await supabase
      .from('commerce_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (error) {
      console.error('[commerce/settings GET] error:', error)
      return NextResponse.json({ error: 'Failed to load commerce settings' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        configured: false,
        settings: null,
      })
    }

    const {
      meta_access_token,
      shopify_access_token,
      woocommerce_consumer_key,
      woocommerce_consumer_secret,
      ...safe
    } = data

    return NextResponse.json({
      configured: true,
      settings: {
        ...safe,
        has_meta_token: !!meta_access_token,
        has_shopify_token: !!shopify_access_token,
        has_woocommerce_credentials: !!(woocommerce_consumer_key && woocommerce_consumer_secret),
      },
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/commerce/settings (admin+)
 * Upsert commerce settings. Sensitive tokens are encrypted at rest with AES-256-GCM.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const limit = checkRateLimit(`commerce-settings:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    // Fetch existing row to preserve tokens when omitted
    const { data: existing } = await supabase
      .from('commerce_settings')
      .select('meta_access_token, shopify_access_token, woocommerce_consumer_key, woocommerce_consumer_secret')
      .eq('account_id', accountId)
      .maybeSingle()

    const updatePayload: Record<string, unknown> = {
      account_id: accountId,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }

    // Meta Product Catalog
    if ('meta_catalog_id' in body) {
      updatePayload.meta_catalog_id =
        typeof body.meta_catalog_id === 'string' && body.meta_catalog_id.trim()
          ? body.meta_catalog_id.trim()
          : null
    }

    if (typeof body.meta_access_token === 'string') {
      const raw = body.meta_access_token.trim()
      updatePayload.meta_access_token = raw ? encrypt(raw) : null
    } else if (existing?.meta_access_token) {
      updatePayload.meta_access_token = existing.meta_access_token
    }

    // Shopify
    if ('shopify_shop_domain' in body) {
      updatePayload.shopify_shop_domain =
        typeof body.shopify_shop_domain === 'string' && body.shopify_shop_domain.trim()
          ? body.shopify_shop_domain.trim()
          : null
    }

    if (typeof body.shopify_access_token === 'string') {
      const raw = body.shopify_access_token.trim()
      updatePayload.shopify_access_token = raw ? encrypt(raw) : null
    } else if (existing?.shopify_access_token) {
      updatePayload.shopify_access_token = existing.shopify_access_token
    }

    if (typeof body.shopify_auto_sync === 'boolean') {
      updatePayload.shopify_auto_sync = body.shopify_auto_sync
    }

    // WooCommerce
    if ('woocommerce_store_url' in body) {
      updatePayload.woocommerce_store_url =
        typeof body.woocommerce_store_url === 'string' && body.woocommerce_store_url.trim()
          ? body.woocommerce_store_url.trim()
          : null
    }

    if (typeof body.woocommerce_consumer_key === 'string') {
      const raw = body.woocommerce_consumer_key.trim()
      updatePayload.woocommerce_consumer_key = raw ? encrypt(raw) : null
    } else if (existing?.woocommerce_consumer_key) {
      updatePayload.woocommerce_consumer_key = existing.woocommerce_consumer_key
    }

    if (typeof body.woocommerce_consumer_secret === 'string') {
      const raw = body.woocommerce_consumer_secret.trim()
      updatePayload.woocommerce_consumer_secret = raw ? encrypt(raw) : null
    } else if (existing?.woocommerce_consumer_secret) {
      updatePayload.woocommerce_consumer_secret = existing.woocommerce_consumer_secret
    }

    if (typeof body.woocommerce_auto_sync === 'boolean') {
      updatePayload.woocommerce_auto_sync = body.woocommerce_auto_sync
    }

    const { data: saved, error } = await supabase
      .from('commerce_settings')
      .upsert(updatePayload, { onConflict: 'account_id' })
      .select()
      .single()

    if (error) {
      console.error('[commerce/settings POST] upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const {
      meta_access_token: _m,
      shopify_access_token: _s,
      woocommerce_consumer_key: _ck,
      woocommerce_consumer_secret: _cs,
      ...safe
    } = saved

    return NextResponse.json({
      success: true,
      settings: {
        ...safe,
        has_meta_token: !!saved.meta_access_token,
        has_shopify_token: !!saved.shopify_access_token,
        has_woocommerce_credentials: !!(saved.woocommerce_consumer_key && saved.woocommerce_consumer_secret),
      },
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
