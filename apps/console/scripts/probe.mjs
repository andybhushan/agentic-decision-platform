import { chromium } from "playwright";
const url = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
p.on("console", (m) => { if (m.type() === "error") console.log("PAGE ERROR:", m.text().slice(0, 300)); });
p.on("requestfailed", (r) => console.log("REQ FAILED:", r.url().slice(0, 140), r.failure()?.errorText));
p.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url().slice(0, 140)); });
await p.addInitScript(() => {
  localStorage.setItem("adp-console-theme", "dark");
  localStorage.setItem("adp-console-access", "meridian-adp-2026");
});
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForTimeout(5000);
console.log("title:", await p.title(), "| url:", p.url());
await b.close();
