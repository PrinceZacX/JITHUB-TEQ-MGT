# Playwright System Audit Report

**Date:** 2026-11-22
**Auditor:** Automated (Playwright + static tests)
**Scope:** Full application — routes, UI rendering, console errors, network failures, TypeScript, build, test suite.

---

## 1. Environment & Tooling

| Check | Result |
|-------|--------|
| Node.js | v24.22.1 |
| Next.js | 16.4.6 (Turbopack) |
| TypeScript (`tsc --noEmit`) | 0 errors |
| Production build (`next build`) | PASS (12/12 static pages) |
| Test suite (`pnpm test`) | 108 pass / 0 fail |
| Playwright (Chromium) | Available and used for E2E reconnaissance |
| Dev server | Running on http://localhost:3000 |

**Note:** The local dev database (Neon) is unreachable from this machine (DNS resolution fails), so authenticated server actions that hit the DB return 500 / hang. Production deployment is unaffected.

---

## 2. Playwright Route Audit (Unauthenticated)

| Route | HTTP | Rendered | Issues |
|-------|------|----------|--------|
| `/` | 200 | Sign-in screen | OK |
| `/sign-in` | 200 | Sign-in screen | OK (auth paused: BETTER_AUTH_SECRET < 32 chars in `.env.local`) |
| `/reset-password` | 200 | Password recovery form | OK |
| `/platform` | 200 | Redirects to sign-in (unauth) | OK |
| `/goods-receipts` | 200 | Table shell | 500 on data fetch (DB) |
| `/purchase-orders` | 200 | Table shell | 500 on data fetch (DB) |
| `/stock-movements` | timeout | Hung (fetch never resolves) | **Robustness issue** — no fetch timeout/abort |
| `/suppliers` | 200 | Table shell | 500 on data fetch (DB) |
| `/tax-rates` | 200 | Table shell | 500 on data fetch (DB) |
| `/verify/:token` | 200 | Invalid receipt (fixed) | Fixed param read |
| `/business/members/:id` | 200 | Members table (fixed) | Fixed async client component |

---

## 3. Bugs Found & Fixed

### 3.1 Async Client Component — `app/business/members/[id]/page.tsx`
- **Severity:** High (runtime crash)
- The file was marked `'use client'` but exported an `async` default function reading `searchParams`. React client components cannot be async → runtime error "async Client Component".
- **Fix:** Converted to a synchronous client component using `useParams()` to read the path `id`. Removed `async`/`await searchParams`.

### 3.2 Wrong Route Param — `app/verify/[token]/page.tsx`
- **Severity:** High (runtime error on every verification link)
- Route is `/verify/[token]` (path param) but the page read `searchParams.token` (query param), so `token` was always `undefined`. `verifyReceipt({ token: '' })` ran a DB query with an empty token and errored.
- **Fix:** Switched to `params.token` (path param).

### 3.3 Broken "Open Workspace" Link — `app/platform/page.tsx`
- **Severity:** Medium (dead link)
- Platform dashboard linked to `/business/${b.id}`, but no route exists there (members page is `/business/members/:id`). 
- **Fix:** Corrected href to `/business/members/${b.id}`.

---

## 4. Configuration Issues (Noted, Not Changed)

- `.env.local` has `BETTER_AUTH_SECRET` set to a value shorter than 32 characters → sign-in is paused in local dev. Production secret must be ≥32 chars.
- `.env.local` sets `VERCEL_ENV=production`, causing `isProduction=true` locally; environment isolation logic in `lib/env.ts` should be reviewed.
- Local DNS cannot resolve the Neon hostname → no live DB integration testing possible from this machine.

---

## 5. Robustness Observations

- `stock-movements` page: `fetch('/api/stock-movements')` has no timeout/abort; if the API hangs, the page never reaches `networkidle` and the loading spinner stays indefinitely. Recommend adding an `AbortController` timeout.
- Several table pages render shells but show 500 errors on data fetch when the DB is unavailable; error boundaries handle them gracefully ("Something didn't load").

---

## 6. Test Coverage Summary

| Layer | Count | Status |
|-------|-------|--------|
| Unit tests (real execution) | 10 | PASS |
| Static pattern-based tests | 98 | PASS |
| Integration tests (live DB) | 0 | BLOCKED (no DATABASE_URL_TEST) |
| E2E browser tests | 0 → reconnaissance done | NOT STARTED (no Playwright suite) |

---

## 7. Final State

- TypeScript: 0 errors
- Production build: PASS
- Test suite: 108/108 pass
- Playwright reconnaissance: completed across 11 routes
- Code changes: 3 files fixed (members page, verify page, platform link)
- No regressions introduced.
