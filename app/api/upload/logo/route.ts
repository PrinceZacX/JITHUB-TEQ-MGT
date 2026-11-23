export const maxDuration = 60

import { del, put } from '@vercel/blob'
import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLogs, businesses, businessMemberships } from '@/lib/db/schema'
import { requirePermission } from '@/lib/permissions'
import { loadEnv } from '@/lib/env'

const MAX_FILE_SIZE = 2 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

async function requireBusinessContext() {
  const session = await getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Please sign in to continue.')
  const [membership] = await db
    .select({ businessId: businessMemberships.businessId, role: businessMemberships.role })
    .from(businessMemberships)
    .where(and(
      eq(businessMemberships.userId, session.user.id),
      eq(businessMemberships.status, 'active'),
      sql`${businessMemberships.deletedAt} IS NULL`,
    ))
    .limit(1)
  if (!membership) throw new Error('You are not an active member of a business.')
  requirePermission(membership.role as Parameters<typeof requirePermission>[0], 'business.settings')
  return { userId: session.user.id, businessId: membership.businessId }
}

function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png'
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export async function POST(request: Request) {
  loadEnv()
  try {
    const context = await requireBusinessContext()
    const formData = await request.formData()
    const file = formData.get('logo')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No logo file provided.' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Logo must be 2 MB or smaller.' }, { status: 400 })
    if (!ALLOWED_MIME_TYPES.includes(file.type)) return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPEG or WebP.' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const detectedMime = detectImageMime(buffer)
    if (!detectedMime || detectedMime !== file.type) return NextResponse.json({ error: 'File content does not match a supported image type.' }, { status: 400 })

    const [business] = await db.select({ logoUrl: businesses.logoUrl }).from(businesses).where(eq(businesses.id, context.businessId)).limit(1)
    const extension = detectedMime === 'image/jpeg' ? 'jpg' : detectedMime.split('/')[1]
    const blob = await put(`business-logos/${context.businessId}/${randomUUID()}.${extension}`, buffer, {
      access: 'public',
      contentType: detectedMime,
      addRandomSuffix: false,
    })

    try {
      await db.transaction(async (tx) => {
        await tx.update(businesses).set({ logoUrl: blob.url }).where(eq(businesses.id, context.businessId))
        await tx.insert(auditLogs).values({
          id: randomUUID(), businessId: context.businessId, userId: context.userId,
          action: 'business.logo_updated', entityType: 'business', entityId: context.businessId,
          details: { logoUrl: blob.url },
        })
      })
    } catch (error) {
      await del(blob.url).catch(() => undefined)
      throw error
    }

    if (business?.logoUrl?.includes('.public.blob.vercel-storage.com/')) {
      await del(business.logoUrl).catch(() => undefined)
    }
    return NextResponse.json({ ok: true, logoUrl: blob.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logo upload failed.'
    const status = /sign in|member|permission/i.test(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE() {
  loadEnv()
  try {
    const context = await requireBusinessContext()
    const [business] = await db.select({ logoUrl: businesses.logoUrl }).from(businesses).where(eq(businesses.id, context.businessId)).limit(1)
    if (!business?.logoUrl) return NextResponse.json({ ok: true })

    await db.transaction(async (tx) => {
      await tx.update(businesses).set({ logoUrl: null }).where(eq(businesses.id, context.businessId))
      await tx.insert(auditLogs).values({
        id: randomUUID(), businessId: context.businessId, userId: context.userId,
        action: 'business.logo_removed', entityType: 'business', entityId: context.businessId,
        details: {},
      })
    })
    if (business.logoUrl.includes('.public.blob.vercel-storage.com/')) {
      await del(business.logoUrl).catch(() => undefined)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logo removal failed.'
    const status = /sign in|member|permission/i.test(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
