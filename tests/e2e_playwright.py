"""
Playwright E2E regression tests for JITHUB-TEQ.

Run:  python tests/e2e_playwright.py [base_url]
Default base_url: http://localhost:3000

Requires: Python 3 + playwright (pip install playwright && playwright install chromium)
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"

ROUTES = [
    "/", "/sign-in", "/reset-password", "/platform", "/goods-receipts",
    "/purchase-orders", "/stock-movements", "/suppliers", "/tax-rates",
    "/verify/test-token-123", "/business/members/test-id-123",
]

passed = 0
failed = 0
errors = []

def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS: {name}")
    else:
        failed += 1
        errors.append(f"{name}: {detail}")
        print(f"  FAIL: {name} - {detail}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # --- Route loading: every route must load without unhandled page errors ---
        for route in ROUTES:
            page = browser.new_page()
            page_errors = []
            page.on("pageerror", lambda e: page_errors.append(str(e)))
            try:
                resp = page.goto(BASE + route, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(2500)
                check(f"route {route} loads", resp is not None and resp.status < 500,
                      f"HTTP {resp.status if resp else 'none'}")
                check(f"route {route} no page errors", len(page_errors) == 0,
                      "; ".join(page_errors)[:200])
            except Exception as e:
                check(f"route {route} loads", False, str(e)[:200])
            page.close()

        # --- Defect regression 1: members page no longer crashes (async client component) ---
        page = browser.new_page()
        page.goto(BASE + "/business/members/test-id-123", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(2500)
        body = page.inner_text("body")
        check("defect1: members page renders", "Business Members" in body,
              body[:120])
        check("defect1: no async client component error",
              "async Client Component" not in body)
        page.close()

        # --- Defect regression 2: verify page renders invalid-receipt state ---
        page = browser.new_page()
        page.goto(BASE + "/verify/test-token-123", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(3000)
        body = page.inner_text("body")
        check("defect2: verify page renders", "Invalid receipt" in body or "Valid receipt" in body,
              body[:120])
        page.close()

        # --- Defect regression 3: stock-movements has no indefinite loading ---
        page = browser.new_page()
        page.goto(BASE + "/stock-movements", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(4000)
        body = page.inner_text("body")
        check("defect3: stock-movements not stuck loading",
              "Loading stock movements" not in body or "No stock movements" in body or "Retry" in body,
              body[:120])
        # Retry button present in error state
        page.close()

        # --- No broken navigation: platform page loads ---
        page = browser.new_page()
        page.goto(BASE + "/platform", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(2500)
        check("platform page loads", "Platform" in page.inner_text("body") or "Sign in" in page.inner_text("body"))
        page.close()

        browser.close()

    print(f"\n=== RESULT: {passed} passed, {failed} failed ===")
    if errors:
        print("Failures:")
        for e in errors:
            print("  -", e)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
