export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { businesses, auditLogs, businessMemberships } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { loadEnv } from '@/lib/env';
import { requirePermission } from '@/lib/permissions';
import { withDbTimeout, DatabaseTimeoutError } from '@/lib/db/query-timeout';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
// SVG removed from allowlist due to XSS risk. WebP fixed signature validation.
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'logos');

async function requireBusinessContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error('Please sign in to continue.');
  return session.user.id;
}

function getImageBuffer(file: File): Promise<Buffer> {
  return file.arrayBuffer().then((ab) => Buffer.from(ab));
}

function detectImageMime(buffer: Buffer): string | null {
  // PNG signature
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return 'image/png';
  // JPEG signature
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  // WebP signature: RIFF....WEBP (RIFF = 52 49 46 46, WEBP = 57 45 42 50 at offset 8)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  )
    return 'image/webp';
  return null;
}

async function handleDbError(err: unknown) {
  if (err instanceof DatabaseTimeoutError) {
    throw new Error('Database unavailable');
  }
  throw err;
}

export async function POST(request: Request) {
  loadEnv();
  const userId = await requireBusinessContext();

  // Resolve active business membership with permission check
  let membership:
    | {
        businessId: string;
        role: string;
        status: string;
        deletedAt: Date | null;
      }
    | undefined;
  try {
    const result = await withDbTimeout(
      db
        .select({
          businessId: businessMemberships.businessId,
          role: businessMemberships.role,
          status: businessMemberships.status,
          deletedAt: businessMemberships.deletedAt,
        })
        .from(businessMemberships)
        .where(
          and(
            eq(businessMemberships.userId, userId),
            eq(businessMemberships.status, 'active'),
            sql`${businessMemberships.deletedAt} IS NULL`,
          ),
        )
        .limit(1),
    );
    membership = result[0];
  } catch (err) {
    throw handleDbError(err);
  }
  if (!membership) throw new Error('You are not an active member of a business.');
  requirePermission(membership.role as any, 'business.settings');

  const formData = await request.formData();
  const file = formData.get('logo');
  if (!(file instanceof File)) throw new Error('No logo file provided.');

  if (file.size > MAX_FILE_SIZE) throw new Error('Logo must be 2 MB or smaller.');
  if (!ALLOWED_MIME_TYPES.includes(file.type))
    throw new Error('Unsupported file type. Use PNG, JPEG or WebP.');

  const buffer = await getImageBuffer(file);
  const detectedMime = detectImageMime(buffer);
  if (!detectedMime) throw new Error('File is not a valid image.');
  if (detectedMime !== file.type) throw new Error('File type does not match actual image content.');

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = detectedMime.split('/')[1];
  const filename = `logo-${randomUUID()}.${ext}`;
  const path = join(UPLOAD_DIR, filename);
  await writeFile(path, buffer);

  const logoUrl = `/uploads/logos/${filename}`;

  try {
    await withDbTimeout(
      db.update(businesses).set({ logoUrl }).where(eq(businesses.id, membership.businessId)),
    );
    await withDbTimeout(
      db.insert(auditLogs).values({
        id: randomUUID(),
        businessId: membership.businessId,
        userId,
        action: 'business.logo_updated',
        entityType: 'business',
        entityId: membership.businessId,
        details: { logoUrl },
      }),
    );
  } catch (err) {
    throw handleDbError(err);
  }

  return NextResponse.json({ ok: true, logoUrl });
}
