import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * GET /api/commerce/products
 * Read products for the account with search and filtering.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')?.trim() || ''
    const source = searchParams.get('source')?.trim() || 'all'
    const availability = searchParams.get('availability')?.trim() || 'all'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Math.min(1000, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit))
    const offset = (page - 1) * limit

    let query = supabase
      .from('catalog_products')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)

    if (source && source !== 'all') {
      query = query.eq('source', source)
    }

    if (availability && availability !== 'all') {
      query = query.eq('availability', availability)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,retailer_id.ilike.%${search}%,category.ilike.%${search}%`)
    }

    query = query.order('updated_at', { ascending: false }).range(offset, offset + limit - 1)

    let inStockQuery = supabase
      .from('catalog_products')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('availability', 'in stock')

    if (source && source !== 'all') {
      inStockQuery = inStockQuery.eq('source', source)
    }

    const [{ data, count, error }, { count: inStockTotal }] = await Promise.all([
      query,
      inStockQuery,
    ])

    if (error) {
      console.error('[commerce/products GET] fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    return NextResponse.json({
      products: data || [],
      total: count || 0,
      inStockTotal: inStockTotal ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/commerce/products  (agent+)
 * Create or update a manual or custom product.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return bad('Product title is required.')

    const retailer_id =
      typeof body.retailer_id === 'string' && body.retailer_id.trim()
        ? body.retailer_id.trim()
        : `prod_${Date.now()}`

    const price = typeof body.price === 'number' ? body.price : parseFloat(body.price || '0')
    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'USD'
    const source = (body.source as string) || 'manual'
    const availability = (body.availability as string) || 'in stock'
    const image_url = typeof body.image_url === 'string' && body.image_url.trim() ? body.image_url.trim() : null
    const url = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null
    const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null
    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('catalog_products')
      .upsert(
        {
          id: body.id || undefined,
          account_id: accountId,
          source,
          retailer_id,
          title,
          description,
          price: isNaN(price) ? 0 : price,
          currency,
          image_url,
          url,
          availability,
          category,
          updated_at: now,
        },
        { onConflict: 'account_id,source,retailer_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[commerce/products POST] save error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, product: data })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/commerce/products (agent+)
 * Delete a product by id.
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent')
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return bad('Product ID is required')

    const { error } = await supabase
      .from('catalog_products')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId)

    if (error) {
      console.error('[commerce/products DELETE] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
