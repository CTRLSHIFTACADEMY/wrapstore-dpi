// ============================================================
// WRAPSTORE WHATSAPP DELIVERY SERVICE
// Dispatches invoices via WhatsApp Business Cloud API
// Supports: Automatic post-sale dispatch, retries, audit tracking
// ============================================================

import { supabase } from '../lib/supabase'

/**
 * Send PDF invoice to customer via WhatsApp
 * @param {Object} params
 * @param {Object} params.invoice - Invoice record
 * @param {string} [params.pdfUrl] - URL of the PDF in storage
 * @param {string} [params.customerPhone] - Recipient phone number
 * @param {number} [params.grandTotal] - Grand total amount
 * @param {string} [params.customerId] - Customer ID
 * @returns {Promise<{success: boolean, status: 'SENT'|'FAILED', error?: string}>}
 */
export const sendWhatsAppInvoice = async ({
  invoice,
  pdfUrl,
  customerPhone,
  grandTotal,
  customerId,
}) => {
  if (!invoice || !invoice.id) {
    return { success: false, status: 'FAILED', error: 'Invoice details missing' }
  }

  const phone = customerPhone || invoice.customer_phone
  if (!phone) {
    return { success: false, status: 'FAILED', error: 'Customer phone number is required' }
  }

  try {
    const payload = {
      invoice_id: invoice.id,
      recipient_phone: phone,
      pdf_url: pdfUrl || invoice.pdf_url || null,
      invoice_number: invoice.invoice_number,
      grand_total: grandTotal != null ? grandTotal : invoice.grand_total,
      customer_id: customerId || invoice.customer_id || null,
    }

    const { data, error } = await supabase.functions.invoke('send-whatsapp-invoice', {
      body: payload,
    })

    if (error) {
      // Mark as failed in database if not already handled
      await supabase
        .from('invoices')
        .update({
          whatsapp_status: 'FAILED',
          whatsapp_error: error.message || 'WhatsApp dispatch error',
        })
        .eq('id', invoice.id)

      return {
        success: false,
        status: 'FAILED',
        error: error.message || 'WhatsApp delivery failed',
      }
    }

    return {
      success: true,
      status: 'SENT',
      messageId: data?.messageId,
    }
  } catch (err) {
    console.error('WhatsApp dispatch exception:', err)
    try {
      await supabase
        .from('invoices')
        .update({
          whatsapp_status: 'FAILED',
          whatsapp_error: err.message || 'Unknown network error',
        })
        .eq('id', invoice.id)
    } catch { /* ignore secondary error */ }

    return {
      success: false,
      status: 'FAILED',
      error: err.message || 'Network exception during WhatsApp dispatch',
    }
  }
}

/**
 * Retry sending WhatsApp invoice for an existing sale
 * GUARANTEE: Never duplicates invoice, never alters stock, only re-dispatches message.
 * @param {Object} invoice - Existing invoice record
 * @returns {Promise<{success: boolean, status: string, error?: string}>}
 */
export const retryWhatsAppDelivery = async (invoice) => {
  if (!invoice || !invoice.id) {
    return { success: false, status: 'FAILED', error: 'Invoice not found' }
  }

  return sendWhatsAppInvoice({
    invoice,
    pdfUrl: invoice.pdf_url,
    customerPhone: invoice.customer_phone,
    grandTotal: invoice.grand_total,
    customerId: invoice.customer_id,
  })
}
