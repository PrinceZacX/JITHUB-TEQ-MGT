import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { stockMovements, businessMemberships } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { loadEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  loadEnv()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  // Resolve user's active business
  const [membership] = await db
    .select({ businessId: businessMemberships.businessId })
    .from(businessMemberships)
    .where(and(
      eq(businessMemberships.userId, session.user.id),
      eq(businessMemberships.status, 'active'),
    ))
    .limit(1)
  if (!membership) return new Response('No active business membership', { status: 403 })

  const rows = await db
    .select({
      id: stockMovements.id, itemId: stockMovements.itemId,
      warehouseId: stockMovements.warehouseId,
      movementType: stockMovements.movementType,
      quantity: stockMovements.quantity, unitCost: stockMovements.unitCost,
      referenceType: stockMovements.referenceType,
      referenceId: stockMovements.referenceId,
      referenceNumber: stockMovements.referenceNumber,
      notes: stockMovements.notes, createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .where(eq(stockMovements.businessId, membership.businessId))
    .orderBy(desc(stockMovements.createdAt))

  return NextResponse.json(rows)
}
