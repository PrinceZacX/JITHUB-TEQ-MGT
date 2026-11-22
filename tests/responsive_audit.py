"""
Comprehensive Responsive UI/UX Audit for JITHUB-TEQ
Tests all routes across desktop (1440px), tablet (768px), mobile (375px) viewports.
"""
import json
import sys
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"

ROUTES = [
    "/", "/sign-in", "/reset-password", "/platform",
    "/goods-receipts", "/purchase-orders", "/stock-movements",
    "/suppliers", "/tax-rates", "/verify/test-token-123",
    "/business/members/test-id-123"
]

VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "tablet": {"width": 768, "height": 1024},
    "mobile": {"width": 375, "height": 667},
}

results = {
    "routes": {},
    "viewport_issues": [],
    "console_errors": [],
    "horizontal_scroll": [],
    "touch_target_issues": [],
    "summary": {"pass": 0, "fail": 0}
}

def check_viewport_issues(route, vp_name, page, body_text, console_errors):
    issues = []
    
    # Check for horizontal scroll
    body_width = page.evaluate("document.body.scrollWidth")
    viewport_width = page.viewport_size["width"]
    if body_width > viewport_width + 2:  # small tolerance
        issues.append(f"Horizontal scroll detected: body={body_width}px > viewport={viewport_width}px")
    
    # Check for console errors
    if console_errors:
        issues.append(f"Console errors: {console_errors[:3]}")
    
    # Check for common responsive issues in body text
    if "Something didn't load" in body_text:
        issues.append("Error boundary triggered")
    
    # Check for overflow elements
    overflow_elements = page.evaluate("""
        () => {
            const results = [];
            document.querySelectorAll('*').forEach(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                if (rect.width > window.innerWidth && style.overflow !== 'hidden' && style.overflowX !== 'hidden') {
                    results.push({
                        tag: el.tagName.toLowerCase(),
                        class: el.className,
                        width: rect.width,
                        viewport: window.innerWidth
                    });
                }
            });
            return results.slice(0, 5);
        }
    """)
    if overflow_elements:
        issues.append(f"Overflow elements: {overflow_elements}")
    
    # Check touch targets (mobile only)
    if vp_name == "mobile":
        small_targets = page.evaluate("""
            () => {
                const results = [];
                document.querySelectorAll('button, a, input, select, [role="button"]').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
                        const style = window.getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            results.push({
                                tag: el.tagName.toLowerCase(),
                                class: el.className,
                                width: Math.round(rect.width),
                                height: Math.round(rect.height)
                            });
                        }
                    }
                });
                return results.slice(0, 10);
            }
        """)
        if small_targets:
            issues.append(f"Touch targets < 44px: {small_targets}")
    
    return issues

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # First, sign in to get authenticated state for protected routes
        auth_page = browser.new_page()
        auth_page.goto(BASE_URL + "/sign-in", wait_until="networkidle", timeout=60000)
        auth_page.wait_for_timeout(2000)
        auth_page.fill('input[name="email"]', 'audit3@test.local')
        auth_page.fill('input[name="password"]', 'AuditTestPass123!')
        auth_page.click('button:has-text("Sign in")')
        auth_page.wait_for_timeout(5000)
        
        # Get cookies/storage for authenticated session
        cookies = auth_page.context.cookies()
        auth_page.close()
        
        for vp_name, vp_size in VIEWPORTS.items():
            print(f"\n=== Testing {vp_name} ({vp_size['width']}x{vp_size['height']}) ===")
            
            for route in ROUTES:
                page = browser.new_page(viewport=vp_size)
                console_errors = []
                page.on("console", lambda m: console_errors.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
                page.on("pageerror", lambda e: console_errors.append(f"[pageerror] {e}"))
                
                try:
                    resp = page.goto(BASE_URL + route, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_timeout(2000)
                    
                    status = resp.status if resp else None
                    title = page.title()
                    body_text = page.inner_text("body")[:500]
                    
                    # Run viewport checks
                    viewport_issues = check_viewport_issues(route, vp_name, page, body_text, console_errors)
                    
                    key = f"{vp_name}:{route}"
                    results["routes"][key] = {
                        "viewport": vp_name,
                        "route": route,
                        "http_status": status,
                        "title": title,
                        "body_preview": body_text[:200],
                        "console_errors": console_errors[:3],
                        "viewport_issues": viewport_issues,
                        "pass": len(viewport_issues) == 0
                    }
                    
                    if viewport_issues:
                        results["summary"]["fail"] += 1
                        results["viewport_issues"].extend([{"viewport": vp_name, "route": route, "issue": i} for i in viewport_issues])
                    else:
                        results["summary"]["pass"] += 1
                    
                    print(f"  {route:35s} HTTP={status} {'PASS' if len(viewport_issues)==0 else 'FAIL'}")
                    for issue in viewport_issues:
                        print(f"    - {issue}")
                        
                except Exception as e:
                    results["routes"][f"{vp_name}:{route}"] = {
                        "viewport": vp_name,
                        "route": route,
                        "error": str(e)[:200],
                        "pass": False
                    }
                    results["summary"]["fail"] += 1
                    print(f"  {route:35s} ERROR: {e}")
                
                page.close()
        
        browser.close()
    
    with open("tests/responsive_audit_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n=== SUMMARY ===")
    print(f"Pass: {results['summary']['pass']}")
    print(f"Fail: {results['summary']['fail']}")
    print(f"\nViewport Issues: {len(results['viewport_issues'])}")
    for issue in results['viewport_issues'][:20]:
        print(f"  [{issue['viewport']}] {issue['route']}: {issue['issue']}")

if __name__ == "__main__":
    main()