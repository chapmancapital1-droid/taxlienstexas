#!/usr/bin/env python3
"""Optional headless browser smoke test.

The execution environment used for this project blocks browser navigation to
localhost, so the test inlines the app assets and mocks only the local JSON API.
Application JavaScript, DOM events, localStorage, downloads, and calculations
still execute in Chromium.
"""
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError as exc:  # pragma: no cover - optional dependency
    raise SystemExit("Playwright is not installed. Run this optional test where Playwright is available.") from exc

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
PREVIEW = ROOT / "docs" / "dashboard-preview.png"


def assembled_html():
    html = (APP / "index.html").read_text()
    css = (APP / "style.css").read_text() + "\n" + (APP / "dashboard.css").read_text()
    app_js = (APP / "app.js").read_text()
    dashboard_js = (APP / "dashboard.js").read_text()
    counties = (APP / "data" / "counties.json").read_text()
    cities = (APP / "data" / "cities.json").read_text()
    mock = f"""<script>
window.__MOCK_COUNTIES__ = {counties};
window.__MOCK_CITIES__ = {cities};
window.fetch = async function(url) {{
  const value = String(url);
  if (value.includes('/api/counties')) return new Response(JSON.stringify(window.__MOCK_COUNTIES__), {{status: 200, headers: {{'Content-Type': 'application/json'}}}});
  if (value.includes('/api/cities')) return new Response(JSON.stringify(window.__MOCK_CITIES__), {{status: 200, headers: {{'Content-Type': 'application/json'}}}});
  if (value.includes('/api/check')) return new Response(JSON.stringify({{ok: true, code: 200}}), {{status: 200, headers: {{'Content-Type': 'application/json'}}}});
  return new Response('not found', {{status: 404}});
}};
</script>"""
    html = html.replace(
        '<link rel="stylesheet" href="/style.css">\n<link rel="stylesheet" href="/dashboard.css">',
        f"<style>{css}</style>",
    )
    html = html.replace(
        '<script src="/app.js"></script>\n<script src="/dashboard.js"></script>',
        mock + f"<script>{app_js}</script><script>{dashboard_js}</script>",
    )
    return html


def main():
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/usr/bin/chromium",
            args=["--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        page.on("console", lambda message: errors.append(f"console {message.type}: {message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
        page.set_content(assembled_html(), wait_until="load")
        page.wait_for_timeout(300)

        assert page.locator("#tbody tr").count() == 254
        assert page.evaluate("TXSF.statutorySaleDate(new Date(2030,0,1)).toISOString().slice(0,10)") == "2030-01-02"
        assert page.evaluate("TXSF.statutorySaleDate(new Date(2023,6,1)).toISOString().slice(0,10)") == "2023-07-05"
        assert page.evaluate("TXSF.csvValue(-200)") == '"-200"'
        assert page.evaluate("TXSF.csvValue('=1+1')") == '"\'=1+1"'

        page.locator("#tbody [data-fav]").first.click()
        page.locator("#f-fav").click()
        assert page.locator("#tbody tr").count() == 1
        page.locator("#f-fav").click()

        page.locator('[data-view="deals"]').click()
        assert page.locator("#deal-tbody tr").count() == 3
        assert page.locator("#kpi-go").inner_text() == "1"
        assert page.locator("#kpi-capital").inner_text() == "$40,500"
        assert page.locator("#kpi-spread").inner_text() == "$59,500"
        assert page.locator("#kpi-open").inner_text() == "1"
        assert page.locator("#deal-tbody tr").nth(1).locator(".rank-score").inner_text() == "39"
        page.screenshot(path=str(PREVIEW), full_page=True)

        page.locator("#deal-rec").select_option("go")
        assert page.locator("#deal-tbody tr").count() == 1
        page.locator("#deal-reset-filters").click()

        page.locator("#bb-allin").fill("40")
        assert page.locator("#kpi-go").inner_text() == "0"
        page.locator("#bb-reset").click()
        assert page.locator("#kpi-go").inner_text() == "1"

        page.locator("#deal-add").click()
        page.locator('[name="property"]').fill("Automation Test Parcel")
        page.locator('[name="countyId"]').select_option("dallas")
        page.locator('[name="account"]').fill("TEST-1")
        page.locator('[name="minBid"]').fill("10000")
        page.locator('[name="exitValue"]').fill("50000")
        page.locator('[name="sourceUrl"]').fill("https://example.com/test")
        page.locator('#deal-form button[type="submit"]').click()
        assert page.locator("#deal-tbody tr").count() == 4

        with page.expect_download() as download_info:
            page.locator("#deal-template").click()
        assert download_info.value.suggested_filename == "texas-property-screen-template.csv"
        with page.expect_download() as download_info:
            page.locator("#deal-export").click()
        assert download_info.value.suggested_filename == "texas-property-decision-view.csv"

        import_path = Path("/tmp/txsf-browser-import.csv")
        import_path.write_text("property,countyId,minBid,exitValue,parcelVerified\nImported Test,denton,9000,45000,yes\n")
        page.locator("#deal-file").set_input_files(str(import_path))
        page.wait_for_timeout(200)
        assert page.locator("#deal-tbody tr").count() == 5

        assert not errors, errors
        browser.close()

    print(f"Browser smoke passed. Preview written to {PREVIEW}")


if __name__ == "__main__":
    main()
