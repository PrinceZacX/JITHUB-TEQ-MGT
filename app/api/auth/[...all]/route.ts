import { auth } from '@/lib/auth'
import { loadEnv } from '@/lib/env'
import { toNextJsHandler } from 'better-auth/next-js'

const handlers = toNextJsHandler(auth)
const isConfigured = () => {
  try {
    loadEnv()
    return true
  } catch {
    return false
  }
}
const unavailable = () => new Response('Authentication is temporarily unavailable. Check the database and authentication configuration for this environment.', { status: 503 })

export const GET = (request: Request) => isConfigured() ? handlers.GET(request) : unavailable()
export const POST = (request: Request) => isConfigured() ? handlers.POST(request) : unavailable()
