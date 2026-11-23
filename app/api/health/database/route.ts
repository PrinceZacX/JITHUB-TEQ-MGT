import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const startedAt = Date.now()

  try {
    await pool.query('SELECT 1')
    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
        latencyMs: Date.now() - startedAt,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        database: 'unavailable',
        message: 'Database readiness check failed.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
