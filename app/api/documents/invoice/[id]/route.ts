import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { invoices, invoiceItems, customers, businesses } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateInvoicePdfForBusiness } from '@/lib/pdf/documents'
import { loadEnv } from '@/lib/env'
import { withDbTimeout, DatabaseTimeoutError } from '@/lib/db/query-timeout'

const safeDate = (value: Date | string | null): string => {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toISOString().slice(0, 10)
}

export const dynamic = 'force-dynamic'

async function handleDbError(err: unknown) {
  if (err instanceof DatabaseTimeoutError) {
    return new Response('Database unavailable', { status: 503 })
  }
  throw err
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  loadEnv()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const { id: invoiceId } = await params

  // Fetch invoice with business scoping
  let invoice: typeof invoices.$inferSelect | undefined
  try {
    const result = await withDbTimeout(db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1))
    invoice = result[0]
  } catch (err) {
    return handleDbError(err)
  }
  if (!invoice) return new Response('Invoice not found', { status: 404 })

  // Verify user has access to this business
  const { businessMemberships } = await import('@/lib/db/schema')
  let membership: { businessId: string; role: string } | undefined
  try {
    const result = await withDbTimeout(
      db
        .select({ businessId: businessMemberships.businessId, role: businessMemberships.role })
        .from(businessMemberships)
        .where(and(eq(businessMemberships.userId, session.user.id), eq(businessMemberships.businessId, invoice.businessId)))
        .limit(1)
    )
    membership = result[0]
  } catch (err) {
    return handleDbError(err)
  }
  if (!membership) return new Response('Forbidden', { status: 403 })

  // Fetch customer and items
  let customer: typeof customers.$inferSelect | undefined
  let items: typeof invoiceItems.$inferSelect[] = []
  try {
    const [customerResult, itemsResult] = await Promise.all([
      withDbTimeout(db.select().from(customers).where(and(eq(customers.id, invoice.customerId), eq(customers.businessId, invoice.businessId))).limit(1)),
      withDbTimeout(db.select().from(invoiceItems).where(and(eq(invoiceItems.invoiceId, invoiceId), eq(invoiceItems.businessId, invoice.businessId)))),
    ])
    customer = customerResult[0]
    items = itemsResult
  } catch (err) {
    return handleDbError(err)
  }

  const data = {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    issueDate: safeDate(invoice.issueDate),
    dueDate: safeDate(invoice.dueDate),
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    notes: invoice.notes,
    customerName: customer?.name || 'Unknown Customer',
    customerEmail: customer?.email || null,
    items: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      lineTotal: item.lineTotal,
    })),
  }

  const pdf = await generateInvoicePdfForBusiness(data, invoice.businessId)

  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
