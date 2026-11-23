import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'
import { loadEnv } from '@/lib/env'
import { sendPasswordRecoveryEmail, sendSecurityNotification, sendVerificationEmail } from '@/lib/email'

const origin = (host?: string) => host ? `https://${host}` : undefined
const previewOrigin = 'https://jithub-teq-management-system.v0.build'

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL
    ?? (process.env.VERCEL_ENV === 'preview' ? origin(process.env.VERCEL_URL) : undefined)
    ?? origin(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? origin(process.env.VERCEL_URL)
    ?? process.env.V0_RUNTIME_URL
    ?? (process.env.NODE_ENV === 'development' ? previewOrigin : undefined),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordRecoveryEmail(user.email, url)
    },
    onPasswordReset: async ({ user }) => {
      await sendSecurityNotification({
        to: user.email,
        subject: 'Your password was changed',
        message: 'The password for your JITHUB-TEQ account was changed. If this was not you, contact your workspace administrator immediately.',
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url)
    },
  },
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

export async function getSession(options: Parameters<typeof auth.api.getSession>[0]) {
  loadEnv()
  return auth.api.getSession(options)
}
