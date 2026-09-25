import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { resolveConversationByPhone } from '@/lib/whatsapp/resolve-conversation';
import { parseInternationalPhone } from '@/lib/whatsapp/phone-utils';
import { CONVERSATION_SELECT, normalizeConversation } from '@/lib/inbox/conversations';

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent');

    const body = (await request.json().catch(() => ({}))) as {
      contact_id?: string;
      phone?: string;
      name?: string;
    };

    const { contact_id, phone, name } = body;

    if (!contact_id && !phone) {
      return NextResponse.json(
        { error: 'Either contact_id or phone is required' },
        { status: 400 }
      );
    }

    let conversationId: string | null = null;

    if (contact_id) {
      // Find or create conversation for existing contact
      const { data: contactRow, error: contactErr } = await supabase
        .from('contacts')
        .select('id')
        .eq('id', contact_id)
        .eq('account_id', accountId)
        .maybeSingle();

      if (contactErr || !contactRow) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }

      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('account_id', accountId)
        .eq('contact_id', contact_id)
        .maybeSingle();

      if (existing) {
        conversationId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('conversations')
          .insert({
            account_id: accountId,
            user_id: userId,
            contact_id: contact_id,
            status: 'open',
          })
          .select('id')
          .single();

        if (createErr || !created) {
          return NextResponse.json(
            { error: createErr?.message || 'Failed to create conversation' },
            { status: 500 }
          );
        }
        conversationId = created.id;
      }
    } else if (phone) {
      const sanitized = parseInternationalPhone(phone);
      if (!sanitized) {
        return NextResponse.json(
          { error: 'Phone must be in E.164 format with country code (e.g. +14155550123)' },
          { status: 400 }
        );
      }

      const resolved = await resolveConversationByPhone(
        supabase,
        accountId,
        sanitized,
        name?.trim() || null
      );
      conversationId = resolved.conversationId;
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Failed to resolve conversation' },
        { status: 500 }
      );
    }

    // Hydrate the full conversation object with contact details
    const { data: convData, error: hydrateErr } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('id', conversationId)
      .single();

    if (hydrateErr || !convData) {
      return NextResponse.json(
        { conversation_id: conversationId },
        { status: 200 }
      );
    }

    return NextResponse.json({
      conversation_id: conversationId,
      conversation: normalizeConversation(convData),
    });
  } catch (err) {
    console.error('Failed to start conversation:', err);
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
