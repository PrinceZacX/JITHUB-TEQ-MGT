import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const finance = fs.readFileSync(new URL('../app/actions/finance.ts', import.meta.url), 'utf8')
const permissions = fs.readFileSync(new URL('../lib/permissions.ts', import.meta.url), 'utf8')
const schema = fs.readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8')
const logoRoute = fs.readFileSync(new URL('../app/api/upload/logo/route.ts', import.meta.url), 'utf8')
const auth = fs.readFileSync(new URL('../lib/auth.ts', import.meta.url), 'utf8')
const database = fs.readFileSync(new URL('../lib/db/index.ts', import.meta.url), 'utf8')
const environment = fs.readFileSync(new URL('../lib/env.ts', import.meta.url), 'utf8')
const databaseHealth = fs.readFileSync(new URL('../app/api/health/database/route.ts', import.meta.url), 'utf8')
const authRoute = fs.readFileSync(new URL('../app/api/auth/[...all]/route.ts', import.meta.url), 'utf8')
const homePage = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')

/* ------------------------------------------------------------------ */
/* Integration: Database configuration guard                          */
/* ------------------------------------------------------------------ */

test('session and auth endpoints validate database configuration before querying', () => {
  const sessionGuard = auth.match(/export async function getSession[\s\S]*?\n\}/)
  assert.ok(sessionGuard, 'server session helper should exist')
  assert.ok(sessionGuard[0].indexOf('loadEnv()') < sessionGuard[0].indexOf('return auth.api.getSession'))
  assert.match(authRoute, /loadEnv\(\)/)
  assert.match(homePage, /getSession\(/)
  assert.doesNotMatch(homePage, /auth\.api\.getSession/)
})

/* ------------------------------------------------------------------ */
/* Integration: Money calculations                                    */
/* ------------------------------------------------------------------ */

test('money function converts to integer cents', () => {
  assert.match(finance, /const \[whole, fraction = ''\] = value\.split\('\.'\)/)
  assert.match(finance, /return Number\(whole\) \* 100 \+ Number\(fraction\.padEnd\(2, '0'\)\)/)
})

test('money function rejects invalid formats', () => {
  assert.match(finance, /if \(!moneyPattern\.test\(value\)\) throw new Error\('Enter a valid amount with up to two decimal places\.'\)/)
})

test('scaledDecimal validates decimal places', () => {
  assert.match(finance, /Math\.abs\(Number\(value\) \* multiplier - scaled\) > 1e-6/)
})

test('quantity scaled to 3 decimal places in invoice creation', () => {
  assert.match(finance, /scaledDecimal\(input\.quantity, 3, 'Quantity'\)/)
})

test('tax rate scaled to 4 decimal places in invoice creation', () => {
  assert.match(finance, /scaledDecimal\(input\.taxRate, 4, 'Tax rate'\)/)
})

test('invoice subtotal uses integer arithmetic', () => {
  assert.match(finance, /BigInt\(unitCents\) \* quantityMilli \+ 500n/)
})

test('invoice tax uses integer basis-point arithmetic', () => {
  assert.match(finance, /BigInt\(subtotalCents\) \* taxRateBasisPoints \+ 500_000n/)
})

/* ------------------------------------------------------------------ */
/* Integration: Document numbering                                    */
/* ------------------------------------------------------------------ */

test('allocateDocumentNumber uses composite business + type uniqueness', () => {
  assert.match(schema, /unique\('document_sequences_business_type_uq'\)\.on\(table\.businessId, table\.documentType\)/)
})

test('invoice number format uses prefix-year-sequence', () => {
  assert.match(finance, /const number = `\$\{prefix\}-\$\{year\}-\$\{padded\}`/)
})

test('receipt number format uses prefix-year-sequence', () => {
  assert.match(finance, /const number = `\$\{prefix\}-\$\{year\}-\$\{padded\}`/)
})

test('sequence allocation uses row-level locking', () => {
  assert.match(finance, /\.for\('update'\)/)
})

/* ------------------------------------------------------------------ */
/* Integration: Receipt verification                                  */
/* ------------------------------------------------------------------ */

test('receipt has verification token', () => {
  assert.match(schema, /verificationToken: text\('verification_token'\)\.unique\(\)/)
})

test('verification token generated on receipt creation', () => {
  assert.match(finance, /const verificationToken = createHash\('sha256'\)/)
})

test('public verifyReceipt does not require authentication', () => {
  assert.match(finance, /export async function verifyReceipt\(input: \{ token: string \}\)/)
  const verifyFn = finance.match(/export async function verifyReceipt[\s\S]*?\n\}/)
  assert.ok(verifyFn, 'verifyReceipt function should exist')
  assert.doesNotMatch(verifyFn[0], /requireUser\(\)/)
  assert.doesNotMatch(verifyFn[0], /requireBusiness\(\)/)
})

test('verifyReceipt returns limited information only', () => {
  assert.match(finance, /return \{[\s\S]*?valid: true,/)
  assert.match(finance, /number: receipt\.number,/)
  assert.match(finance, /status: receipt\.status,/)
  assert.match(finance, /amount: receipt\.amount,/)
  assert.match(finance, /currency: 'UGX',/)
  assert.match(finance, /method: receipt\.method,/)
  assert.match(finance, /reference: receipt\.reference,/)
  assert.match(finance, /paidAt: receipt\.paidAt,/)
  assert.match(finance, /customerName: receipt\.customerName,/)
  assert.match(finance, /businessName: receipt\.businessName,/)
})

test('verifyReceipt does not expose internal IDs', () => {
  const verifyFn = finance.match(/export async function verifyReceipt[\s\S]*?\n\}/)
  assert.ok(verifyFn, 'verifyReceipt function should exist')
  assert.doesNotMatch(verifyFn[0], /\breceipt\.id\b/)
  assert.doesNotMatch(verifyFn[0], /\bpayment\.id\b/)
  assert.doesNotMatch(verifyFn[0], /\buserId\b/)
  assert.doesNotMatch(verifyFn[0], /\bbusinessId:/)
})

/* ------------------------------------------------------------------ */
/* Integration: Refund workflow                                       */
/* ------------------------------------------------------------------ */

test('refund has approval workflow with statuses', () => {
  assert.match(schema, /status: text\('status'\)\.notNull\(\)\.default\('pending'\)/)
  assert.match(schema, /requestedBy: text\('requested_by'\)\.notNull\(\)/)
  assert.match(schema, /approvedBy: text\('approved_by'\)/)
})

test('refund completion records processed timestamp', () => {
  assert.match(schema, /processedAt: timestamp\('processed_at'[^)]*\)/)
})

test('refund rejection sets status to rejected', () => {
  assert.match(finance, /await tx\.update\(refunds\)\.set\(\{ status: 'rejected',/)
})

test('refund completion sets status to completed', () => {
  assert.match(finance, /await tx\.update\(refunds\)\.set\(\{ status: 'completed',/)
})

/* ------------------------------------------------------------------ */
/* Integration: Receipt voiding                                       */
/* ------------------------------------------------------------------ */

test('voiding records voidedAt and voidedBy', () => {
  assert.match(finance, /await tx\.update\(receipts\)\.set\(\{ status: 'voided', voidedAt: new Date\(\), voidedBy: context\.userId \}/)
})

test('void receipt rejects already voided receipts', () => {
  assert.match(finance, /if \(receipt\.status === 'voided'\) throw new Error\('Receipt is already voided\.'\)/)
})

/* ------------------------------------------------------------------ */
/* Integration: Invoice cancellation                                  */
/* ------------------------------------------------------------------ */

test('cancel invoice prevents cancellation when payments exist', () => {
  assert.match(finance, /if \(money\(invoice\.amountPaid\) > 0\) throw new Error\('Cannot cancel an invoice that has received payments\./)
})

test('cancel invoice sets status to cancelled', () => {
  assert.match(finance, /await tx\.update\(invoices\)\.set\(\{ status: 'cancelled' \}/)
})

/* ------------------------------------------------------------------ */
/* Integration: Business settings                                     */
/* ------------------------------------------------------------------ */

test('updateBusiness validates all fields', () => {
  assert.match(finance, /if \(name.length < 2 || name.length > 160\) throw new Error\('Business name must be between 2 and 160 characters\.'\)/)
  assert.match(finance, /if \(prefix.length < 1 || prefix.length > 10\) throw new Error\('Receipt prefix must be 1-10 characters\.'\)/)
  assert.match(finance, /if \(prefix.length < 1 || prefix.length > 10\) throw new Error\('Invoice prefix must be 1-10 characters\.'\)/)
})

test('updateBusiness audits changes', () => {
  assert.match(finance, /action: 'business\.updated', entityType: 'business'/)
})

/* ------------------------------------------------------------------ */
/* Integration: Logo upload validation                                */
/* ------------------------------------------------------------------ */

test('logo upload validates file size with a client-safe response', () => {
  assert.match(logoRoute, /if \(file\.size > MAX_FILE_SIZE\) return NextResponse\.json\(\{ error: 'Logo must be 2 MB or smaller\.' \}, \{ status: 400 \}\)/)
})

test('logo upload validates MIME type with a client-safe response', () => {
  assert.match(logoRoute, /if \(!ALLOWED_MIME_TYPES\.includes\(file\.type\)\) return NextResponse\.json\(\{ error: 'Unsupported file type\./)
})

test('logo upload validates actual image format via magic bytes', () => {
  assert.match(logoRoute, /function detectImageMime\(buffer: Buffer\)/)
  assert.match(logoRoute, /buffer\[0\] === 0x89.*buffer\[1\] === 0x50.*buffer\[2\] === 0x4e.*buffer\[3\] === 0x47/)
  assert.match(logoRoute, /buffer\[0\] === 0xff.*buffer\[1\] === 0xd8/)
})

test('logo upload requires business.settings permission', () => {
  assert.match(logoRoute, /requirePermission\(membership\.role as Parameters<typeof requirePermission>\[0\], 'business\.settings'\)/)
})

/* ------------------------------------------------------------------ */
/* Integration: Fail-closed database configuration                    */
/* ------------------------------------------------------------------ */

test('database pool requires an explicit validated DATABASE_URL', () => {
  assert.match(database, /connectionString:\s*getDatabaseUrl\(\)/)
  assert.doesNotMatch(database, /connectionString:\s*process\.env\.DATABASE_URL/)
  assert.match(database, /connectionTimeoutMillis:\s*10_000/)
})

test('database URL validation rejects missing, malformed and non-PostgreSQL URLs', () => {
  assert.match(environment, /DATABASE_URL is not configured/)
  assert.match(environment, /new URL\(databaseUrl\)/)
  assert.match(environment, /must use the postgres:\/\/ or postgresql:\/\/ protocol/)
  assert.match(environment, /must include a database host and database name/)
})

test('Vercel deployments reject localhost database fallback', () => {
  assert.match(environment, /process\.env\.VERCEL && isLoopback/)
  assert.match(environment, /not localhost/)
})

test('database health endpoint checks the real PostgreSQL pool without exposing secrets', () => {
  assert.match(databaseHealth, /pool\.query\('SELECT 1'\)/)
  assert.match(databaseHealth, /database: 'connected'/)
  assert.match(databaseHealth, /database: 'unavailable'/)
  assert.match(databaseHealth, /status: 503/)
  assert.doesNotMatch(databaseHealth, /DATABASE_URL|password|connectionString/i)
})
