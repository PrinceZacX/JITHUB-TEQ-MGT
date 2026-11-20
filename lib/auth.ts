import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

const origin = (host?: string) => host ? `https://${host}` : undefined
const previewOrigin = 'https://jithub-teq-management-system.v0.build'

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL ?? origin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ?? origin(process.env.VERCEL_URL) ?? process.env.V0_RUNTIME_URL ?? (process.env.NODE_ENV === 'development' ? previewOrigin : undefined),
  emailAndPassword: { enabled: true, autoSignIn: true },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development' ? [
      'http://localhost:3000',
      ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
      ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
      ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
      ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
      previewOrigin,
    ] : []),
    ...(process.env.NODE_ENV === 'production' ? [
      ...(process.env.VERCEL_URL ? [origin(process.env.VERCEL_URL)!] : []),
      ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [origin(process.env.VERCEL_PROJECT_PRODUCTION_URL)!] : []),
    ] : []),
  ],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  ...(process.env.NODE_ENV === 'development' ? { advanced: { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } } } : {}),
})
