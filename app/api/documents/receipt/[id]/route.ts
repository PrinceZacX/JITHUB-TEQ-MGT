import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { receipts, payments, customers, businesses } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateReceiptPdf } from '@/lib/pdf/documents';
import { loadEnv } from '@/lib/env';
import { withDbTimeout, DatabaseTimeoutError } from '@/lib/db/query-timeout';

const safeDate = (value: Date | string | null): string => {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
};

export const dynamic = 'force-dynamic';

async function handleDbError(err: unknown) {
  if (err instanceof DatabaseTimeoutError) {
    return new Response('Database unavailable', { status: 503 });
  }
  throw err;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  loadEnv();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id: receiptId } = await params;

  let receipt: typeof receipts.$inferSelect | undefined;
  try {
    const result = await withDbTimeout(
      db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1),
    );
    receipt = result[0];
  } catch (err) {
    return handleDbError(err);
  }
  if (!receipt) return new Response('Receipt not found', { status: 404 });

  const { businessMemberships } = await import('@/lib/db/schema');
  let membership: { businessId: string; role: string } | undefined;
  try {
    const result = await withDbTimeout(
      db
        .select({
          businessId: businessMemberships.businessId,
          role: businessMemberships.role,
        })
        .from(businessMemberships)
        .where(
          and(
            eq(businessMemberships.userId, session.user.id),
            eq(businessMemberships.businessId, receipt.businessId),
          ),
        )
        .limit(1),
    );
    membership = result[0];
  } catch (err) {
    return handleDbError(err);
  }
  if (!membership) return new Response('Forbidden', { status: 403 });

  let payment: typeof payments.$inferSelect | undefined;
  let customer: typeof customers.$inferSelect | undefined;
  try {
    const paymentResult = await withDbTimeout(
      db.select().from(payments).where(eq(payments.id, receipt.paymentId)).limit(1),
    );
    payment = paymentResult[0];
    if (payment?.customerId) {
      const customerResult = await withDbTimeout(
        db
          .select()
          .from(customers)
          .where(
            and(eq(customers.id, payment.customerId), eq(customers.businessId, receipt.businessId)),
          )
          .limit(1),
      );
      customer = customerResult[0];
    }
  } catch (err) {
    return handleDbError(err);
  }

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
  };

  const pdf = await generateReceiptPdf(data, receipt.businessId);

  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${receipt.number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
