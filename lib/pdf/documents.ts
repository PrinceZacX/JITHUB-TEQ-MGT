import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { businesses } from '@/lib/db/schema'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'

type Money = string | number

function formatMoney(value: Money, currency = 'UGX'): string {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function wrapText(doc: PDFKit.PDFDocument, text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (doc.widthOfString(test) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

async function getBusiness(businessId: string) {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1)
  return biz
}

export interface InvoiceData {
  id: string
  number: string
  status: string
  issueDate: string
  dueDate: string
  currency: string
  subtotal: Money
  taxAmount: Money
  total: Money
  amountPaid: Money
  notes: string | null
  customerName: string
  customerEmail: string | null
  items: Array<{ description: string; quantity: Money; unitPrice: Money; taxRate: Money; lineTotal: Money }>
}

export interface ReceiptData {
  id: string
  number: string
  status: string
  issuedAt: string
  voidedAt: string | null
  amount: Money
  currency: string
  method: string
  reference: string | null
  paidAt: string
  customerName: string
  customerEmail: string | null
}

/* ------------------------------------------------------------------ */
/* A4 Invoice PDF                                                     */
/* ------------------------------------------------------------------ */

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const biz = await getBusiness('placeholder') // replaced by caller context
  return buildInvoicePdf(data, biz)
}

export async function generateInvoicePdfForBusiness(data: InvoiceData, businessId: string): Promise<Buffer> {
  const biz = await getBusiness(businessId)
  return buildInvoicePdf(data, biz)
}

function buildInvoicePdf(data: InvoiceData, biz: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - 100
    const logoUrl = biz?.logoUrl

    // Header
    doc.fontSize(20).font('Helvetica-Bold')
    if (logoUrl) {
      try { doc.image(logoUrl, 50, 40, { width: 60 }) } catch {}
      doc.text(biz?.name || 'Business', 120, 50)
    } else {
      doc.text(biz?.name || 'Business', 50, 50)
    }
    doc.fontSize(9).font('Helvetica')
    if (biz?.address) doc.text(biz.address, 50, 70)
    if (biz?.city || biz?.country) doc.text(`${biz.city || ''}, ${biz.country || ''}`.trim(), 50, 82)
    if (biz?.email) doc.text(biz.email, 50, 94)
    if (biz?.phone) doc.text(biz.phone, 50, 106)

    // Invoice title
    doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', 50, 140)
    doc.fontSize(9).font('Helvetica')
    doc.text(`Invoice No: ${data.number}`, 50, 158)
    doc.text(`Issue Date: ${data.issueDate}`, 50, 170)
    doc.text(`Due Date: ${data.dueDate}`, 50, 182)
    doc.text(`Status: ${data.status}`, 50, 194)

    // Customer
    doc.fontSize(10).font('Helvetica-Bold').text('Bill To:', 50, 220)
    doc.fontSize(9).font('Helvetica')
    doc.text(data.customerName, 50, 232)
    if (data.customerEmail) doc.text(data.customerEmail, 50, 244)

    // Items table
    let y = 270
    const colX = [50, 300, 380, 450, 520]
    const headers = ['Description', 'Qty', 'Unit Price', 'Tax', 'Total']
    doc.fontSize(8).font('Helvetica-Bold')
    headers.forEach((h, i) => doc.text(h, colX[i], y))
    doc.moveTo(50, y + 12).lineTo(doc.page.width - 50, y + 12).stroke()

    y += 24
    doc.fontSize(8).font('Helvetica')
    for (const item of data.items) {
      doc.text(item.description, colX[0], y, { width: 240 })
      doc.text(String(item.quantity), colX[1], y)
      doc.text(formatMoney(item.unitPrice, data.currency), colX[2], y)
      doc.text(`${Number(item.taxRate)}%`, colX[3], y)
      doc.text(formatMoney(item.lineTotal, data.currency), colX[4], y)
      y += 18
    }

    // Totals
    const totals = [
      ['Subtotal', formatMoney(data.subtotal, data.currency)],
      ['Tax', formatMoney(data.taxAmount, data.currency)],
      ['Total', formatMoney(data.total, data.currency)],
      ['Paid', formatMoney(data.amountPaid, data.currency)],
      ['Outstanding', formatMoney(Number(data.total) - Number(data.amountPaid), data.currency)],
    ]
    let ty = y + 10
    doc.fontSize(9).font('Helvetica-Bold')
    totals.forEach(([label, value]) => {
      doc.text(label, 380, ty)
      doc.text(value, 520, ty, { align: 'right' })
      ty += 16
    })

    // Footer
    doc.fontSize(8).font('Helvetica')
    doc.text('Issued by ' + (biz?.name || 'Business'), 50, doc.page.height - 60)
    if (biz?.footerText) doc.text(biz.footerText, 50, doc.page.height - 48)
    doc.text('This is a computer-generated invoice.', 50, doc.page.height - 36)

    doc.end()
  })
}

/* ------------------------------------------------------------------ */
/* A4 Receipt PDF                                                     */
/* ------------------------------------------------------------------ */

export async function generateReceiptPdf(data: ReceiptData, businessId: string): Promise<Buffer> {
  const biz = await getBusiness(businessId)
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const logoUrl = biz?.logoUrl
    doc.fontSize(20).font('Helvetica-Bold')
    if (logoUrl) {
      try { doc.image(logoUrl, 50, 40, { width: 60 }) } catch {}
      doc.text(biz?.name || 'Business', 120, 50)
    } else {
      doc.text(biz?.name || 'Business', 50, 50)
    }
    doc.fontSize(9).font('Helvetica')
    if (biz?.address) doc.text(biz.address, 50, 70)
    if (biz?.city || biz?.country) doc.text(`${biz.city || ''}, ${biz.country || ''}`.trim(), 50, 82)
    if (biz?.email) doc.text(biz.email, 50, 94)

    doc.fontSize(16).font('Helvetica-Bold').text('OFFICIAL RECEIPT', 50, 130)
    doc.fontSize(9).font('Helvetica')
    doc.text(`Receipt No: ${data.number}`, 50, 150)
    doc.text(`Status: ${data.status === 'voided' ? 'VOIDED' : 'Issued'}`, 50, 162)
    doc.text(`Payment Date: ${data.paidAt}`, 50, 174)
    doc.text(`Method: ${data.method}`, 50, 186)
    if (data.reference) doc.text(`Reference: ${data.reference}`, 50, 196)

    doc.fontSize(10).font('Helvetica-Bold').text('Received from:', 50, 220)
    doc.fontSize(9).font('Helvetica')
    doc.text(data.customerName, 50, 232)

    doc.fontSize(12).font('Helvetica-Bold')
    doc.text(`Amount Received: ${formatMoney(data.amount, data.currency)}`, 50, 260)

    doc.fontSize(8).font('Helvetica')
    doc.text(`Currency: ${data.currency}`, 50, 280)

    if (data.status === 'voided') {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#dc2626')
      doc.text('VOIDED RECEIPT - Not valid as payment confirmation', 50, 300)
      doc.fillColor('#000000')
    }

    doc.fontSize(8).font('Helvetica')
    doc.text('Issued by ' + (biz?.name || 'Business'), 50, doc.page.height - 60)
    if (biz?.footerText) doc.text(biz.footerText, 50, doc.page.height - 48)

    doc.end()
  })
}

/* ------------------------------------------------------------------ */
/* Thermal Receipt (58mm / 80mm)                                      */
/* ------------------------------------------------------------------ */

export async function generateThermalReceipt(data: ReceiptData, businessId: string, widthMm: 58 | 80 = 58): Promise<Buffer> {
  const biz = await getBusiness(businessId)
  const charsPerLine = widthMm === 58 ? 32 : 48
  const lines: string[] = []

  const center = (text: string) => text.padStart(Math.floor((charsPerLine + text.length) / 2)).padEnd(charsPerLine)
  const left = (text: string) => text.padEnd(charsPerLine)
  const right = (text: string) => text.padStart(charsPerLine)
  const split = (label: string, value: string) => {
    const v = value.slice(0, charsPerLine - label.length - 2)
    return (label + ' ' + v).padEnd(charsPerLine)
  }

  lines.push(center(biz?.name || 'BUSINESS'))
  if (biz?.address) lines.push(center(biz.address))
  if (biz?.city || biz?.country) lines.push(center(`${biz.city || ''}, ${biz.country || ''}`))
  lines.push('='.repeat(charsPerLine))
  lines.push(center('OFFICIAL RECEIPT'))
  lines.push('='.repeat(charsPerLine))
  lines.push(left(`Receipt: ${data.number}`))
  lines.push(left(`Date: ${data.paidAt}`))
  lines.push(left(`Method: ${data.method}`))
  if (data.reference) lines.push(left(`Ref: ${data.reference}`))
  lines.push('-'.repeat(charsPerLine))
  lines.push(left('Received from:'))
  lines.push(left(data.customerName))
  lines.push('-'.repeat(charsPerLine))
  lines.push(split('Amount:', formatMoney(data.amount, data.currency)))
  lines.push(left(`Currency: ${data.currency}`))
  lines.push('='.repeat(charsPerLine))
  if (data.status === 'voided') {
    lines.push(center('*** VOIDED ***'))
    lines.push(center('Not valid as payment'))
  } else {
    lines.push(center('Thank you!'))
  }
  lines.push('='.repeat(charsPerLine))
  if (biz?.footerText) lines.push(center(biz.footerText))
  lines.push('')
  lines.push('')

  return Buffer.from(lines.join('\n'), 'utf8')
}
