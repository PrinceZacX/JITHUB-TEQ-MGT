import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { stockMovements, businessMemberships } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { loadEnv } from '@/lib/env';
import { withDbTimeout, DatabaseTimeoutError } from '@/lib/db/query-timeout';

export const dynamic = 'force-dynamic';

export async function GET() {
  loadEnv();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // Resolve user's active business
  let membership: { businessId: string } | undefined;
  try {
    const result = await withDbTimeout(
      db
        .select({ businessId: businessMemberships.businessId })
        .from(businessMemberships)
        .where(
          and(
            eq(businessMemberships.userId, session.user.id),
            eq(businessMemberships.status, 'active'),
          ),
        )
        .limit(1),
    );
    membership = result[0];
  } catch (err) {
    if (err instanceof DatabaseTimeoutError) {
      return new Response('Database unavailable', { status: 503 });
    }
    throw err;
  }
  if (!membership) return new Response('No active business membership', { status: 403 });

  let rows: Array<{
    id: string;
    itemId: string;
    warehouseId: string;
    movementType: string;
    quantity: string;
    unitCost: string | null;
    referenceType: string;
    referenceId: string | null;
    referenceNumber: string | null;
    notes: string | null;
    createdAt: Date;
  }> = [];
  try {
    rows = await withDbTimeout(
      db
        .select({
          id: stockMovements.id,
          itemId: stockMovements.itemId,
          warehouseId: stockMovements.warehouseId,
          movementType: stockMovements.movementType,
          quantity: stockMovements.quantity,
          unitCost: stockMovements.unitCost,
          referenceType: stockMovements.referenceType,
          referenceId: stockMovements.referenceId,
          referenceNumber: stockMovements.referenceNumber,
          notes: stockMovements.notes,
          createdAt: stockMovements.createdAt,
        })
        .from(stockMovements)
        .where(eq(stockMovements.businessId, membership.businessId))
        .orderBy(desc(stockMovements.createdAt)),
    );
  } catch (err) {
    if (err instanceof DatabaseTimeoutError) {
      return new Response('Database unavailable', { status: 503 });
    }
    throw err;
  }

  return NextResponse.json(rows);
}
