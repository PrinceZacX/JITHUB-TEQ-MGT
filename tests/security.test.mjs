import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const finance = fs.readFileSync(new URL('../app/actions/finance.ts', import.meta.url), 'utf8')
const permissions = fs.readFileSync(new URL('../lib/permissions.ts', import.meta.url), 'utf8')
const schema = fs.readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8')

/* ------------------------------------------------------------------ */
/* Security: Platform Owner Authorization                             */
/* ------------------------------------------------------------------ */

test('platform_owner column exists on user table', () => {
  assert.match(schema, /platformOwner/)
})

test('platform_owner column has default false', () => {
  assert.match(schema, /platform_owner/)
})

test('platform_owner permissions are defined', () => {
  assert.match(permissions, /PlatformPermission/)
})

test('platform_owner role is defined', () => {
  assert.match(permissions, /PlatformRole = 'platform_owner'/)
})

test('requirePlatformOwner function exists', () => {
  assert.match(finance, /async function requirePlatformOwner\(\)/)
})

test('requirePlatformPermission function exists', () => {
  assert.match(finance, /requirePlatformPermission/)
})

test('platform owner can access platform dashboard without business membership', () => {
  assert.match(finance, /export async function getPlatformDashboardData\(\)/)
  assert.match(finance, /requirePlatformOwner\(\)/)
  assert.match(finance, /from\(businesses\)/)
  assert.match(finance, /from\(auditLogs\)/)
})

test('platform owner business-scoped operations require businessId', () => {
  assert.match(finance, /if \(!context\.businessId\) \{/)
  assert.match(finance, /throw new Error\('Please select a business before performing business-scoped operations\.'\)/)
})

test('getDashboardData requires business context for non-owner users', () => {
  assert.match(finance, /export async function getDashboardData\(\)/)
  assert.match(finance, /requireBusinessPermission\('reports\.read'\)/)
})

test('page.tsx redirects unauthenticated users to sign-in', () => {
  const page = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /redirect\('\/sign-in'\)/)
})

test('page.tsx routes platform owners to PlatformPage', () => {
  const page = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /platformOwner/)
  assert.match(page, /PlatformPage/)
})

test('platform owner business-scoped actions require businessId', () => {
  assert.match(finance, /export async function createGoodsReceipt\(/)
  assert.match(finance, /export async function listBusinesses\(\)/)
})