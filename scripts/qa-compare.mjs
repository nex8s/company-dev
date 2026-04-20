import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const NAIVE_BASE = "https://app.usenaive.ai";
const OUR_BASE = "http://127.0.0.1:3100";
const OUR_COMPANY = "fbdf5864-8f58-40fd-bc71-b7b53a8affa3";
const OUT = path.resolve("qa-screenshots/compare");
fs.mkdirSync(OUT, { recursive: true });

let shotN = 0;
async function snap(page, label) {
  shotN++;
  const name = `${String(shotN).padStart(3, "0")}-${label}`;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`✓ ${name}`);
}

async function tryClick(page, selector, label) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 3000 })) {
      await el.scrollIntoViewIfNeeded();
      await el.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await snap(page, label);
      return true;
    }
  } catch {}
  console.log(`  ⚠ skip: ${label}`);
  return false;
}

async function run() {
  // Connect to user's logged-in Chrome
  const liveB = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const liveCtx = liveB.contexts()[0];
  const naivePage = liveCtx?.pages()[0] || await liveCtx.newPage();

  // Our app in headless Playwright
  const ourB = await chromium.launch({ headless: true });
  const ourCtx = await ourB.newContext({ viewport: { width: 1440, height: 900 } });
  const ourPage = await ourCtx.newPage();

  // Helper: compare both sides
  async function compareBoth(naiveUrl, ourUrl, label) {
    // Naive side
    await naivePage.goto(naiveUrl, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await naivePage.waitForTimeout(2500);
    await snap(naivePage, `naive-${label}`);

    // Our side
    await ourPage.goto(ourUrl, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    await ourPage.waitForTimeout(2000);
    await snap(ourPage, `ours-${label}`);
  }

  // ===== 1. MAIN CHAT VIEW =====
  console.log("\n=== COMPANY CHAT ===");
  await compareBoth(
    `${NAIVE_BASE}/COMPAB84E80/company/chat`,
    `${OUR_BASE}/c/${OUR_COMPANY}/`,
    "chat"
  );
  // Naive: click company switcher
  await tryClick(naivePage, '[class*="company"] >> text="Company"', "naive-company-switcher");
  // Naive: click user menu
  await tryClick(naivePage, 'text="credits"', "naive-user-menu");
  await naivePage.keyboard.press("Escape");
  // Naive: click review pill
  await tryClick(naivePage, 'text="review waiting"', "naive-review-pill");
  await naivePage.keyboard.press("Escape");

  // Our side: same interactions
  await ourPage.goto(`${OUR_BASE}/c/${OUR_COMPANY}/`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await ourPage.waitForTimeout(2000);
  await tryClick(ourPage, 'text="Company X", [data-testid="company-switcher"]', "ours-company-switcher");
  await ourPage.keyboard.press("Escape");
  await tryClick(ourPage, 'text="credits"', "ours-user-menu");
  await ourPage.keyboard.press("Escape");
  await tryClick(ourPage, 'text="review waiting"', "ours-review-pill");
  await ourPage.keyboard.press("Escape");

  // ===== 2. OVERVIEW =====
  console.log("\n=== OVERVIEW ===");
  await compareBoth(
    `${NAIVE_BASE}/COMPAB84E80/company/overview`,
    `${OUR_BASE}/c/${OUR_COMPANY}/overview`,
    "overview"
  );

  // ===== 3. STRATEGY =====
  console.log("\n=== STRATEGY ===");
  await compareBoth(
    `${NAIVE_BASE}/COMPAB84E80/company/strategy`,
    `${OUR_BASE}/c/${OUR_COMPANY}/strategy`,
    "strategy"
  );

  // ===== 4. PAYMENTS =====
  console.log("\n=== PAYMENTS ===");
  await compareBoth(
    `${NAIVE_BASE}/COMPAB84E80/company/payments`,
    `${OUR_BASE}/c/${OUR_COMPANY}/payments`,
    "payments"
  );

  // ===== 5. SETTINGS > GENERAL =====
  console.log("\n=== SETTINGS GENERAL ===");
  await compareBoth(
    `${NAIVE_BASE}/COMPAB84E80/company/settings`,
    `${OUR_BASE}/c/${OUR_COMPANY}/settings/general`,
    "settings-general"
  );

  // Settings: click each sub-tab on naive
  for (const tab of ["Billing", "Team", "Usage", "Server", "Publishing"]) {
    await tryClick(naivePage, `text="${tab}"`, `naive-settings-${tab.toLowerCase()}`);
    await tryClick(ourPage, `text="${tab}"`, `ours-settings-${tab.toLowerCase()}`);
  }

  // Settings > General: click Domains tile
  await naivePage.goto(`${NAIVE_BASE}/COMPAB84E80/company/settings`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await naivePage.waitForTimeout(2000);
  await tryClick(naivePage, 'text="Domains"', "naive-settings-domains-click");
  await ourPage.goto(`${OUR_BASE}/c/${OUR_COMPANY}/settings/general`, { waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
  await ourPage.waitForTimeout(1500);
  await tryClick(ourPage, 'text="Domains"', "ours-settings-domains-click");

  // Settings > General: click Connections tile
  await naivePage.goto(`${NAIVE_BASE}/COMPAB84E80/company/settings`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await naivePage.waitForTimeout(2000);
  await tryClick(naivePage, 'text="Connections"', "naive-settings-connections-click");
  await ourPage.goto(`${OUR_BASE}/c/${OUR_COMPANY}/settings/general`, { waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
  await ourPage.waitForTimeout(1500);
  await tryClick(ourPage, ':text("Connections"):not(:text("Go to"))', "ours-settings-connections-click");

  // ===== 6. TASKS =====
  console.log("\n=== TASKS ===");
  await compareBoth(
    `${NAIVE_BASE}/COMPAB84E80/tasks`,
    `${OUR_BASE}/c/${OUR_COMPANY}/tasks`,
    "tasks"
  );

  // ===== 7. DRIVE =====
  console.log("\n=== DRIVE ===");
  await compareBoth(
    `${NAIVE_BASE}/COMPAB84E80/drive`,
    `${OUR_BASE}/c/${OUR_COMPANY}/drive`,
    "drive"
  );
  // Click Pending tab on both
  await tryClick(naivePage, 'text="Pending"', "naive-drive-pending");
  await tryClick(ourPage, 'text="Pending"', "ours-drive-pending");

  // ===== 8. STORE =====
  console.log("\n=== STORE ===");
  await compareBoth(
    `${NAIVE_BASE}/COMPAB84E80/store`,
    `${OUR_BASE}/c/${OUR_COMPANY}/store`,
    "store"
  );
  // Click category filters
  await tryClick(naivePage, 'text="Agency & Services"', "naive-store-agency");
  await tryClick(ourPage, 'text="Agency & Services"', "ours-store-agency");
  await tryClick(naivePage, 'text="All Businesses"', "naive-store-all");
  await tryClick(ourPage, 'text="All Businesses"', "ours-store-all");

  // ===== 9. TEAM > CEO =====
  console.log("\n=== CEO PROFILE ===");
  // Naive: click CEO in sidebar
  await naivePage.goto(`${NAIVE_BASE}/COMPAB84E80/company/chat`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await naivePage.waitForTimeout(2000);
  await tryClick(naivePage, 'text="Naive (CEO)"', "naive-ceo-click");
  await naivePage.waitForTimeout(2000);
  await snap(naivePage, "naive-ceo-profile");

  // Our: click CEO
  await ourPage.goto(`${OUR_BASE}/c/${OUR_COMPANY}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
  await ourPage.waitForTimeout(1500);
  await tryClick(ourPage, 'text="Naive (CEO)"', "ours-ceo-click");
  await ourPage.waitForTimeout(1500);
  await snap(ourPage, "ours-ceo-profile");

  // CEO sub-tabs on both
  for (const tab of ["Chat", "Inbox", "Compute", "Settings"]) {
    await tryClick(naivePage, `button:has-text("${tab}"), a:has-text("${tab}")`, `naive-ceo-${tab.toLowerCase()}`);
    await tryClick(ourPage, `button:has-text("${tab}"), a:has-text("${tab}")`, `ours-ceo-${tab.toLowerCase()}`);
  }

  // ===== 10. TEAM > EXPAND DEPTS + CLICK AGENTS =====
  console.log("\n=== DEPT AGENTS ===");
  // Naive: expand Engineering, click agent
  await naivePage.goto(`${NAIVE_BASE}/COMPAB84E80/company/chat`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await naivePage.waitForTimeout(2000);
  await tryClick(naivePage, 'text="ENGINEERING"', "naive-expand-eng");
  await naivePage.waitForTimeout(1000);
  await tryClick(naivePage, 'text="Landing Page Engineer"', "naive-eng-agent-click");
  await naivePage.waitForTimeout(2000);
  await snap(naivePage, "naive-eng-agent-profile");

  // Naive: engineer sub-tabs
  for (const tab of ["Chat", "Browser", "Phone", "Workspace", "Virtual Cards", "Inbox", "Compute", "Settings"]) {
    await tryClick(naivePage, `button:has-text("${tab}"), a:has-text("${tab}")`, `naive-eng-${tab.toLowerCase().replace(/ /g, '-')}`);
  }

  // ===== 11. UPGRADE =====
  console.log("\n=== UPGRADE ===");
  await compareBoth(
    `${NAIVE_BASE}/upgrade`,
    `${OUR_BASE}/c/${OUR_COMPANY}/upgrade`,
    "upgrade"
  );

  // ===== 12. APPS > LANDING PAGE =====
  console.log("\n=== APPS LANDING PAGE ===");
  await naivePage.goto(`${NAIVE_BASE}/COMPAB84E80/company/chat`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await naivePage.waitForTimeout(2000);
  await tryClick(naivePage, 'text="Landing Page"', "naive-apps-landing-click");
  await naivePage.waitForTimeout(2000);
  await snap(naivePage, "naive-apps-landing");

  // Our side
  await ourPage.goto(`${OUR_BASE}/c/${OUR_COMPANY}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
  await ourPage.waitForTimeout(1500);
  await tryClick(ourPage, 'text="Landing Page"', "ours-apps-landing-click");
  await ourPage.waitForTimeout(1500);
  await snap(ourPage, "ours-apps-landing");

  // Naive apps sub-tabs
  for (const tab of ["Preview", "Code", "Deployments", "Settings"]) {
    await tryClick(naivePage, `button:has-text("${tab}"), a:has-text("${tab}")`, `naive-apps-${tab.toLowerCase()}`);
  }

  // ===== 13. SIDEBAR GETTING STARTED ITEMS =====
  console.log("\n=== GETTING STARTED CLICKS ===");
  await naivePage.goto(`${NAIVE_BASE}/COMPAB84E80/company/chat`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await naivePage.waitForTimeout(2000);
  // Click each Getting Started item on naive
  for (const item of ["Incorporate Company", "Connect or buy", "Setup email", "Setup Stripe"]) {
    await tryClick(naivePage, `text="${item}"`, `naive-gs-${item.slice(0, 15).replace(/ /g, '-')}`);
    await naivePage.waitForTimeout(1000);
    await snap(naivePage, `naive-gs-result-${item.slice(0, 15).replace(/ /g, '-')}`);
    await naivePage.goBack().catch(() => {});
    await naivePage.waitForTimeout(1500);
  }

  await ourB.close();
  // Don't close liveB — it's the user's Chrome
  liveB.disconnect();

  console.log(`\nDone. ${shotN} screenshots in ${OUT}/`);
}

run().catch((e) => { console.error(e); process.exit(1); });
