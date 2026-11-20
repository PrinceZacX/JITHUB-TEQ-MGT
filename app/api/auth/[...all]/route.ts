import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

const handlers = toNextJsHandler(auth)
const secretIsStrong = () => Boolean(process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 32)
const unavailable = () => new Response('Authentication is temporarily unavailable. Configure a random BETTER_AUTH_SECRET of at least 32 characters.', { status: 503 })

export const GET = (request: Request) => secretIsStrong() ? handlers.GET(request) : unavailable()
export const POST = (request: Request) => secretIsStrong() ? handlers.POST(request) : unavailable()
