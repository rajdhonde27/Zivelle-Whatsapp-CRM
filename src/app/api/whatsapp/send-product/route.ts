import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  sendSingleProductMessage,
  sendCatalogMessage,
  sendMediaMessage,
  sendTextMessage,
} from '@/lib/whatsapp/meta-api'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * POST /api/whatsapp/send-product (agent+)
 * Sends a product to a customer over WhatsApp.
 * Supports:
 *   - 'native_catalog' (Meta Catalog interactive single product)
 *   - 'store_link' (Card with direct checkout / view URL)
 *   - 'catalog_message' (Opens full WhatsApp Catalog)
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    const limit = checkRateLimit(`send-product:${userId}`, RATE_LIMITS.send)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const conversationId = body.conversationId
    if (!conversationId) return bad('conversationId is required')

    const mode = body.mode || 'store_link' // 'native_catalog' | 'store_link' | 'catalog_message'

    // 1. Load conversation and contact phone
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('id, contact_id, contacts(phone, name)')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .single()

    if (convErr || !conv) {
      return bad('Conversation not found')
    }

    const contact = (conv as unknown as { contacts: { phone: string; name?: string } }).contacts
    if (!contact?.phone) {
      return bad('Contact has no valid phone number')
    }
    const toPhone = contact.phone

    // 2. Load WhatsApp config for token and phone number ID
    const { data: waConfig, error: waErr } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token, status')
      .eq('account_id', accountId)
      .maybeSingle()

    if (waErr || !waConfig || !waConfig.access_token || waConfig.status !== 'connected') {
      return bad('WhatsApp is not connected for this account')
    }

    const phoneNumberId = waConfig.phone_number_id
    const accessToken = decrypt(waConfig.access_token)

    // 3. Load Commerce Settings for Catalog ID if needed
    const { data: commerceSettings } = await supabase
      .from('commerce_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    let waMessageId: string
    let contentType: string = 'text'
    let contentText: string = ''
    let mediaUrl: string | null = null

    if (mode === 'native_catalog') {
      const catalogId = body.catalogId || commerceSettings?.meta_catalog_id
      const productRetailerId = body.productRetailerId
      if (!catalogId) return bad('Meta Catalog ID is not configured.')
      if (!productRetailerId) return bad('Product retailer ID is required.')

      const bodyText = body.bodyText || body.title || 'Check out this product from our catalog!'
      const footerText = body.footerText || undefined

      const metaRes = await sendSingleProductMessage({
        phoneNumberId,
        accessToken,
        to: toPhone,
        catalogId,
        productRetailerId,
        bodyText,
        footerText,
      })

      waMessageId = metaRes.messageId
      contentType = 'interactive'
      contentText = `🛍️ ${body.title || 'Product'} (${productRetailerId})`
    } else if (mode === 'catalog_message') {
      const bodyText =
        body.bodyText ||
        'Welcome! Browse our full product catalog and place your order directly in WhatsApp.'
      const footerText = body.footerText || 'Tap below to explore'

      const metaRes = await sendCatalogMessage({
        phoneNumberId,
        accessToken,
        to: toPhone,
        bodyText,
        footerText,
        thumbnailProductRetailerId: body.thumbnailProductRetailerId || undefined,
      })

      waMessageId = metaRes.messageId
      contentType = 'interactive'
      contentText = '📖 [WhatsApp Catalog Message]'
    } else {
      // mode === 'store_link'
      const title = body.title || 'Product'
      const price = typeof body.price === 'number' ? body.price.toFixed(2) : body.price
      const currency = body.currency || 'USD'
      const description = body.description ? `\n\n${body.description}` : ''
      const url = body.url ? `\n\n👉 View & Order: ${body.url}` : ''
      const messageBody = `*${title}*\n💰 ${currency} ${price}${description}${url}`

      if (body.image_url) {
        mediaUrl = body.image_url
        const metaRes = await sendMediaMessage({
          phoneNumberId,
          accessToken,
          to: toPhone,
          kind: 'image',
          link: body.image_url,
          caption: messageBody,
        })
        waMessageId = metaRes.messageId
        contentType = 'image'
        contentText = messageBody
      } else {
        const metaRes = await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: toPhone,
          text: messageBody,
        })
        waMessageId = metaRes.messageId
        contentType = 'text'
        contentText = messageBody
      }
    }

    // 4. Save to messages table
    const { data: messageRecord, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'agent',
        sender_id: userId,
        content_type: contentType,
        content_text: contentText,
        media_url: mediaUrl,
        message_id: waMessageId,
        status: 'sent',
      })
      .select()
      .single()

    if (msgError) {
      console.error('[send-product] error inserting message:', msgError)
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // 5. Update conversation last message
    await supabase
      .from('conversations')
      .update({
        last_message_text: contentText,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    return NextResponse.json({
      success: true,
      message: messageRecord,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
