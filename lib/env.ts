/**
 * Environment validation for the JITHUB-TEQ Management System.
 *
 * Validates DATABASE_URL and other required configuration. Validation is
 * intentionaly lazy (invoke `loadEnv()`) so that the Next.js build step
 * is not blocked when DATABASE_URL is only available at runtime.
 *
 * Sensitive values are never logged.
 */

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
const isDev = process.env.NODE_ENV === 'development'
const isPreview = process.env.VERCEL_ENV === 'preview'
const isProduction = process.env.VERCEL_ENV === 'production'

export interface EnvConfig {
  databaseUrl: string
  betterAuthSecret: string
  betterAuthUrl: string | undefined
  smtpHost: string | undefined
  smtpPort: number
  smtpFrom: string | undefined
  smtpUser: string | undefined
  nodeEnv: string
  vercelEnv: string | undefined
  isProduction: boolean
  isPreview: boolean
  isDevelopment: boolean
  isTest: boolean
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.password) u.password = '****'
    return u.toString()
  } catch {
    return '<invalid DATABASE_URL>'
  }
}

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not configured. Set DATABASE_URL to the intended PostgreSQL database for this environment.',
    )
  }

  return databaseUrl
}

export function loadEnv(): EnvConfig {
  const databaseUrl = getDatabaseUrl()

  if ((isDev || isTest) && databaseUrl.includes('.prod.')) {
    throw new Error(
      'Refusing to resolve a production DATABASE_URL in a non-production environment.',
    )
  }

  const betterAuthSecret = process.env.BETTER_AUTH_SECRET
  if (!betterAuthSecret || betterAuthSecret.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET must be set to a random value of at least 32 characters.',
    )
  }

  const smtpPort = Number(process.env.SMTP_PORT || 587)
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be a valid port number (1-65535).')
  }

  const config: EnvConfig = {
    databaseUrl,
    betterAuthSecret,
    betterAuthUrl: process.env.BETTER_AUTH_URL,
    smtpHost: process.env.SMTP_HOST,
    smtpPort,
    smtpFrom: process.env.SMTP_FROM,
    smtpUser: process.env.SMTP_USER,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    vercelEnv: process.env.VERCEL_ENV,
    isProduction,
    isPreview,
    isDevelopment: isDev,
    isTest,
  }

  if (!isTest) {
    // eslint-disable-next-line no-console
    console.info(
      `[env] environment=${config.nodeEnv} vercelEnv=${config.vercelEnv ?? '-'} database=${maskUrl(config.databaseUrl)}`,
    )
  }

  return config
}
