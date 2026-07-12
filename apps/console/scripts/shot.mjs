// Screenshot ADP pages for visual verification.
// usage: node scripts/shot.mjs <url> <out.png> <light|dark> [fullpage]
import { chromium } from "playwright";

// variant: fullpage | mobile | mobile-full | mobile-menu (opens the header drawer first)
const [url, out, mode = "dark", variant = ""] = process.argv.slice(2);
const mobile = variant.startsWith("mobile");
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 1100 },
});
await page.addInitScript((m) => {
  localStorage.setItem("adp-console-theme", m);
  localStorage.setItem("adp-console-access", "meridian-adp-2026");
  localStorage.setItem("adp-member-session", "PH-389197");
  localStorage.setItem("adp-borrower-session", "BOR-100004");
}, mode);
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
if (variant === "mobile-menu") {
  await page.click(".cds--header__menu-trigger");
  await page.waitForTimeout(800);
}
await page.screenshot({ path: out, fullPage: variant.endsWith("full") || variant === "fullpage" });
console.log("saved", out, "final-url:", page.url());
await browser.close();
