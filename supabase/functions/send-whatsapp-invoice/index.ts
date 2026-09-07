// ============================================================
// SUPABASE EDGE FUNCTION: send-whatsapp-invoice
// Dispatches WrapStore PDF Invoice via Meta WhatsApp Cloud API
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const {
      invoice_id,
      recipient_phone,
      pdf_url,
      invoice_number,
      grand_total,
      customer_id,
    } = payload

    if (!invoice_id || !recipient_phone) {
      return new Response(
        JSON.stringify({ error: 'Missing invoice_id or recipient_phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Format Indian phone number (ensure country code 91)
    const cleanDigits = recipient_phone.replace(/\D/g, '')
    const formattedPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits

    const formattedAmount = Number(grand_total || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    const messageCaption = [
      'Thank you for shopping with WrapStore.',
      '',
      'Please find your invoice attached.',
      '',
      `Invoice: ${invoice_number || 'N/A'}`,
      `Amount: ₹${formattedAmount}`,
      '',
      'Thank you for choosing WrapStore.',
    ].join('\n')

    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    let deliveryStatus = 'FAILED'
    let errorMessage: string | null = null
    let responseData: any = null
    let messageId: string | null = null

    // If Meta WhatsApp Cloud API credentials are configured, execute official Cloud API call
    if (whatsappToken && whatsappPhoneId) {
      const fbUrl = `https://graph.facebook.com/v19.0/${whatsappPhoneId}/messages`

      const messageBody = pdf_url
        ? {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'document',
            document: {
              link: pdf_url,
              filename: `${invoice_number || 'WrapStore-Invoice'}.pdf`,
              caption: messageCaption,
            },
          }
        : {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'text',
            text: { body: messageCaption },
          }

      const fbResponse = await fetch(fbUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageBody),
      })

      responseData = await fbResponse.json()

      if (fbResponse.ok && responseData.messages?.[0]?.id) {
        deliveryStatus = 'SENT'
        messageId = responseData.messages[0].id
      } else {
        errorMessage = responseData.error?.message || 'Meta Cloud API rejected the message'
      }
    } else {
      // Mock / Local mode fallback
      deliveryStatus = 'SENT'
      messageId = `wamid.mock.${Date.now()}`
      responseData = { status: 'mock_sent', messageId }
    }

    const now = new Date().toISOString()

    // Update invoice record with WhatsApp delivery status
    await supabaseClient
      .from('invoices')
      .update({
        whatsapp_status: deliveryStatus,
        whatsapp_sent_at: deliveryStatus === 'SENT' ? now : null,
        whatsapp_error: errorMessage,
        whatsapp_message_id: messageId,
      })
      .eq('id', invoice_id)

    // Write to audit log
    await supabaseClient.from('whatsapp_logs').insert({
      invoice_id,
      customer_id: customer_id || null,
      recipient_phone: formattedPhone,
      message_body: messageCaption,
      pdf_url: pdf_url || null,
      status: deliveryStatus,
      response_payload: responseData,
      error_message: errorMessage,
    })

    return new Response(
      JSON.stringify({
        success: deliveryStatus === 'SENT',
        status: deliveryStatus,
        messageId,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: deliveryStatus === 'SENT' ? 200 : 502,
      }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
