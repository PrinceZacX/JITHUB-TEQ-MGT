import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { receipts, payments, customers, businesses } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateThermalReceipt } from '@/lib/pdf/documents'
import { loadEnv } from '@/lib/env'

const safeDate = (value: Date | string | null): string => {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toISOString().slice(0, 10)
}

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  loadEnv()
  const session = await getSession({ headers: await headers() })
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const { id: receiptId } = await params
  const url = new URL(request.url)
  const widthMm = url.searchParams.get('width') === '80' ? 80 : 58

  const [receipt] = await db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1)
  if (!receipt) return new Response('Receipt not found', { status: 404 })

  const { businessMemberships } = await import('@/lib/db/schema')
  const [membership] = await db
    .select({ businessId: businessMemberships.businessId, role: businessMemberships.role })
    .from(businessMemberships)
    .where(and(eq(businessMemberships.userId, session.user.id), eq(businessMemberships.businessId, receipt.businessId)))
    .limit(1)
  if (!membership) return new Response('Forbidden', { status: 403 })

  const [payment] = await db.select().from(payments).where(eq(payments.id, receipt.paymentId)).limit(1)
  const [customer] = await db.select().from(customers).where(and(eq(customers.id, payment?.customerId), eq(customers.businessId, receipt.businessId))).limit(1)

  const data = {
    id: receipt.id,
    number: receipt.number,
    status: receipt.status,
    issuedAt: safeDate(receipt.issuedAt),
    voidedAt: safeDate(receipt.voidedAt),
    amount: payment?.amount || '0',
    currency: payment?.currency || 'UGX',
    method: payment?.method || 'unknown',
    reference: payment?.reference || null,
    paidAt: safeDate(payment?.paidAt),
    customerName: customer?.name || 'Unknown Customer',
    customerEmail: customer?.email || null,
  }

  const receiptText = await generateThermalReceipt(data, receipt.businessId, widthMm)

  return new Response(receiptText, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="receipt-${receipt.number}-${widthMm}mm.txt"`,
      'Cache-Control': 'no-store',
    },
  })
}
