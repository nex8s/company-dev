import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3100";
const COMPANY = "fbdf5864-8f58-40fd-bc71-b7b53a8affa3";
const OUT = path.resolve("qa-screenshots");
fs.mkdirSync(OUT, { recursive: true });

const pages = [
  { name: "01-landing", url: `${BASE}/` },
  { name: "02-auth", url: `${BASE}/auth` },
  { name: "03-company-shell", url: `${BASE}/c/${COMPANY}/` },
  { name: "04-company-overview", url: `${BASE}/c/${COMPANY}/overview` },
  { name: "05-company-strategy", url: `${BASE}/c/${COMPANY}/strategy` },
  { name: "06-company-payments", url: `${BASE}/c/${COMPANY}/payments` },
  { name: "07-company-settings", url: `${BASE}/c/${COMPANY}/settings/general` },
  { name: "08-settings-billing", url: `${BASE}/c/${COMPANY}/settings/billing` },
  { name: "09-settings-team", url: `${BASE}/c/${COMPANY}/settings/team` },
  { name: "10-settings-usage", url: `${BASE}/c/${COMPANY}/settings/usage` },
  { name: "11-settings-server", url: `${BASE}/c/${COMPANY}/settings/server` },
  { name: "12-settings-publishing", url: `${BASE}/c/${COMPANY}/settings/publishing` },
  { name: "13-tasks", url: `${BASE}/c/${COMPANY}/tasks` },
  { name: "14-drive", url: `${BASE}/c/${COMPANY}/drive` },
  { name: "15-store", url: `${BASE}/c/${COMPANY}/store` },
  { name: "16-upgrade", url: `${BASE}/c/${COMPANY}/upgrade` },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  for (const p of pages) {
    const page = await context.newPage();
    try {
      await page.goto(p.url, { waitUntil: "networkidle", timeout: 15000 });
    } catch {
      // timeout is OK — still screenshot what rendered
    }
    // Extra wait for React to render
    await page.waitForTimeout(2000);
    const filepath = path.join(OUT, `${p.name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`✓ ${p.name} → ${filepath}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nDone. ${pages.length} screenshots in ${OUT}/`);
}

run().catch((e) => { console.error(e); process.exit(1); });
