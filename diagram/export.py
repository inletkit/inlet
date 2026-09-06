import pathlib, re, sys
from playwright.sync_api import sync_playwright

files = [pathlib.Path(p) for p in sys.argv[1:]]
FONTS = "@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Geist:wght@400;500;600&amp;family=Geist+Mono:wght@400;500;600&amp;display=swap');"

with sync_playwright() as p:
    browser = p.chromium.launch()
    for src in files:
        html = src.read_text()
        svg = re.search(r"<svg.*?</svg>", html, re.S).group(0)
        if 'xmlns="http://www.w3.org/2000/svg"' not in svg:
            svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
        svg = svg.replace("<defs>", f"<defs>\n<style>{FONTS}</style>", 1)
        src.with_suffix(".svg").write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + svg + "\n")
        page = browser.new_page(device_scale_factor=2)
        page.goto(f"file://{src.resolve()}")
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(500)
        page.locator("svg").first.screenshot(path=str(src.with_suffix(".png")), omit_background=True)
        page.close()
        print("exported", src.with_suffix(".svg").name, src.with_suffix(".png").name)
    browser.close()
