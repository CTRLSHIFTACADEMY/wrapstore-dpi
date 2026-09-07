// ============================================================
// WRAPSTORE INVOICE PDF GENERATOR
// Uses jsPDF + jspdf-autotable
// Generates professional A4 invoices with WrapStore branding
// ============================================================

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const INR = (val) =>
  '\u20B9' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PAYMENT_METHOD_LABELS = {
  Cash: 'Cash',
  UPI: 'UPI / Online Transfer',
  Card: 'Debit / Credit Card',
  Other: 'Other',
}

// Convert an image URL to base64 for embedding in PDF
const urlToBase64 = async (url) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Generate a WrapStore PDF invoice
 * @param {Object} invoice - Invoice record
 * @param {Array}  items   - invoice_items array
 * @param {Object} store   - store_settings record
 * @param {String} logoUrl - URL to WrapStore logo image
 * @returns {jsPDF} - jsPDF document instance
 */
export const generateInvoicePDF = async ({ invoice, items, store, logoUrl }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const W = 210   // page width mm
  const MARGIN = 14
  const CONTENT_W = W - MARGIN * 2
  let y = MARGIN

  // ---- COLORS ----
  const BLACK = [10, 10, 10]
  const GRAY = [100, 100, 100]
  const LIGHT = [245, 245, 245]
  const WHITE = [255, 255, 255]
  const GREEN = [16, 185, 129]

  // ---- FONTS ----
  doc.setFont('helvetica')

  // ====================================================
  // HEADER: Logo + Store Info
  // ====================================================

  // Try to embed logo
  let logoLoaded = false
  if (logoUrl) {
    try {
      const b64 = await urlToBase64(logoUrl)
      if (b64) {
        doc.addImage(b64, 'JPEG', MARGIN, y, 45, 18)
        logoLoaded = true
      }
    } catch { /* skip */ }
  }

  if (!logoLoaded) {
    // Fallback text logo
    doc.setFillColor(...BLACK)
    doc.rect(MARGIN, y, 22, 12, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('WRAP', MARGIN + 11, y + 8, { align: 'center' })
    doc.setTextColor(...BLACK)
    doc.setFontSize(11)
    doc.text('STORE', MARGIN + 34, y + 8)
    doc.setDrawColor(10, 10, 10)
    doc.rect(MARGIN, y, 44, 12)
  }

  // Store info (right side)
  doc.setTextColor(...BLACK)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const storeLines = [
    store?.store_name || 'WRAPSTORE',
    store?.address || 'Railway Station Rd, Dharmapuri',
    'Tamil Nadu, India - 636701',
    store?.phone || '+91 81227 47947',
    store?.gstin ? `GSTIN: ${store.gstin}` : '',
  ].filter(Boolean)

  const storeInfoX = W - MARGIN
  storeLines.forEach((line, i) => {
    if (i === 0) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9) }
    else { doc.setFont('helvetica', 'normal'); doc.setFontSize(8) }
    doc.text(line, storeInfoX, y + 4 + i * 4.5, { align: 'right' })
  })

  y += 26

  // ---- DIVIDER ----
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.8)
  doc.line(MARGIN, y, W - MARGIN, y)
  y += 6

  // ====================================================
  // INVOICE TITLE + NUMBER
  // ====================================================
  doc.setFillColor(...BLACK)
  doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TAX INVOICE', MARGIN + 6, y + 7)
  doc.setFontSize(10)
  doc.text(invoice.invoice_number, W - MARGIN - 6, y + 7, { align: 'right' })
  y += 16

  // ====================================================
  // INVOICE DETAILS + CUSTOMER DETAILS
  // ====================================================
  doc.setTextColor(...BLACK)

  const invoiceDate = new Date(invoice.created_at)
  const dateStr = invoiceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = invoiceDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  const leftColX = MARGIN
  const rightColX = MARGIN + CONTENT_W / 2 + 4

  // Left: Invoice info
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE DETAILS', leftColX, y)
  y += 5

  const invoiceInfo = [
    ['Invoice No.', invoice.invoice_number],
    ['Date', dateStr],
    ['Time', timeStr],
    ['Payment', PAYMENT_METHOD_LABELS[invoice.payment_method] || invoice.payment_method],
    ['Status', invoice.payment_status],
  ]

  invoiceInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(label + ':', leftColX, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BLACK)
    doc.text(value, leftColX + 28, y)
    y += 5
  })

  // Right: Customer info
  const customerStartY = y - (invoiceInfo.length * 5) - 5
  let ry = customerStartY

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLACK)
  doc.text('BILLED TO', rightColX, ry)
  ry += 5

  const customerInfo = [
    ['Name', invoice.customer_name],
    ['Phone', invoice.customer_phone],
  ]

  customerInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(label + ':', rightColX, ry)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BLACK)
    doc.text(value, rightColX + 18, ry)
    ry += 5
  })

  y = Math.max(y, ry) + 4

  // ---- DIVIDER ----
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, W - MARGIN, y)
  y += 6

  // ====================================================
  // ITEMS TABLE
  // ====================================================
  const tableColumns = [
    { header: '#', dataKey: 'no' },
    { header: 'Product', dataKey: 'name' },
    { header: 'ID', dataKey: 'code' },
    { header: 'Model', dataKey: 'model' },
    { header: 'Qty', dataKey: 'qty' },
    { header: 'Unit Price', dataKey: 'price' },
    { header: 'Disc%', dataKey: 'disc' },
    { header: 'GST%', dataKey: 'gst' },
    { header: 'Total', dataKey: 'total' },
  ]

  const tableRows = items.map((item, idx) => ({
    no: idx + 1,
    name: item.product_name,
    code: item.product_id_code,
    model: item.mobile_model || '—',
    qty: item.quantity,
    price: INR(item.unit_price),
    disc: item.discount_pct + '%',
    gst: item.gst_pct + '%',
    total: INR(item.line_total),
  }))

  autoTable(doc, {
    startY: y,
    head: [tableColumns.map(c => c.header)],
    body: tableRows.map(row => tableColumns.map(c => row[c.dataKey])),
    theme: 'striped',
    headStyles: {
      fillColor: BLACK,
      textColor: WHITE,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: BLACK,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 58 },
      2: { cellWidth: 20 },
      3: { cellWidth: 26 },
      4: { cellWidth: 9, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 11, halign: 'center' },
      7: { cellWidth: 11, halign: 'center' },
      8: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: MARGIN, right: MARGIN },
    styles: { overflow: 'linebreak', font: 'helvetica' },
  })

  y = doc.lastAutoTable.finalY + 8

  // ====================================================
  // TOTALS SECTION
  // ====================================================
  const totalsX = W - MARGIN - 72
  const totalsW = 72

  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(totalsX, y, W - MARGIN, y)
  y += 4

  const totalsRows = [
    ['Subtotal', INR(invoice.subtotal)],
    invoice.discount_amount > 0 ? ['Discount', '- ' + INR(invoice.discount_amount)] : null,
    ['Taxable Amount', INR(invoice.taxable_amount)],
    ['GST', INR(invoice.gst_amount)],
  ].filter(Boolean)

  totalsRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    doc.text(label, totalsX + 2, y)
    doc.setTextColor(...BLACK)
    doc.text(value, W - MARGIN - 2, y, { align: 'right' })
    y += 5.5
  })

  // Grand total box
  y += 1
  doc.setFillColor(...BLACK)
  doc.roundedRect(totalsX, y - 1, totalsW, 10, 1.5, 1.5, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('GRAND TOTAL', totalsX + 4, y + 6.5)
  doc.setFontSize(11)
  doc.text(INR(invoice.grand_total), W - MARGIN - 4, y + 6.5, { align: 'right' })
  y += 18

  // Payment method badge
  doc.setFillColor(240, 255, 248)
  doc.setDrawColor(...GREEN)
  doc.roundedRect(totalsX, y, totalsW, 7, 1, 1, 'FD')
  doc.setTextColor(10, 100, 60)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Paid via ' + (PAYMENT_METHOD_LABELS[invoice.payment_method] || invoice.payment_method), totalsX + totalsW / 2, y + 4.5, { align: 'center' })
  y += 14

  // ====================================================
  // NOTES
  // ====================================================
  if (invoice.notes) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('Note: ' + invoice.notes, MARGIN, y)
    y += 8
  }

  // ====================================================
  // FOOTER
  // ====================================================
  const footerY = 282
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, footerY - 6, W - MARGIN, footerY - 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  const thankYou = store?.invoice_footer || 'Thank you for shopping at WrapStore!'
  doc.text(thankYou, W / 2, footerY, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('This is a computer-generated invoice and does not require a physical signature.', W / 2, footerY + 5, { align: 'center' })
  doc.text(`${store?.store_name || 'WRAPSTORE'} · ${store?.phone || '+91 81227 47947'}`, W / 2, footerY + 9, { align: 'center' })

  return doc
}

/**
 * Download the invoice as a PDF file
 */
export const downloadInvoicePDF = async (params) => {
  const doc = await generateInvoicePDF(params)
  doc.save(`${params.invoice.invoice_number}.pdf`)
}

/**
 * Open the invoice PDF in a new browser tab (for printing)
 */
export const printInvoicePDF = async (params) => {
  const doc = await generateInvoicePDF(params)
  const blobUrl = doc.output('bloburl')
  window.open(blobUrl, '_blank')
}

/**
 * Get the PDF as a Blob for uploading to Supabase Storage
 */
export const getInvoicePDFBlob = async (params) => {
  const doc = await generateInvoicePDF(params)
  return doc.output('blob')
}
