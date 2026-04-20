import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

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
  // Connect to user's Chrome (with debug port)
  const liveB = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const liveCtx = liveB.contexts()[0];
  const np = liveCtx.pages()[0]; // naive page

  // Our app in headless
  const ourB = await chromium.launch({ headless: true });
  const ourCtx = await ourB.newContext({ viewport: { width: 1440, height: 900 } });
  const op = await ourCtx.newPage(); // our page

  // ===== STEP 1: COMPLETE ONBOARDING ON NAIVE =====
  console.log("\n=== ONBOARDING ===");
  await snap(np, "naive-onboard-start");

  // Clear existing text and type company description
  const textarea = np.locator('textarea, [contenteditable], input[type="text"]').first();
  if (await textarea.isVisible({ timeout: 3000 })) {
    await textarea.click();
    await textarea.fill("Build me a DevOps monitoring company that watches servers, sends alerts, and auto-remediates common issues");
    await np.waitForTimeout(1000);
  }

  // Fill company name
  const nameInput = np.locator('input[placeholder*="ompany name"], input:near(:text("Company name"))').first();
  if (await nameInput.isVisible({ timeout: 3000 })) {
    await nameInput.fill("QA Test Co");
  }
  await snap(np, "naive-onboard-filled");

  // Click submit/start button
  const submitBtn = np.locator('button[type="submit"], button:has-text("Start"), button:has(:text("↑"))').first();
  if (await submitBtn.isVisible({ timeout: 3000 })) {
    await submitBtn.click();
    console.log("  Submitted onboarding...");
    // Wait for redirect to dashboard
    await np.waitForTimeout(10000);
  }
  await snap(np, "naive-after-onboard");

  // Get the company URL from the current path
  const naiveUrl = np.url();
  console.log(`  Naive URL after onboard: ${naiveUrl}`);
  const naiveCompanyMatch = naiveUrl.match(/\/([A-Z0-9]+)\//);
  const naivePrefix = naiveCompanyMatch ? naiveCompanyMatch[1] : "COMPAB84E80";
  const NAIVE = `https://app.usenaive.ai/${naivePrefix}`;
  console.log(`  Using naive prefix: ${NAIVE}`);

  // ===== STEP 2: SIDE-BY-SIDE COMPARISON =====

  async function comparePage(naiveUrl, ourUrl, label) {
    console.log(`\n--- ${label} ---`);
    await np.goto(naiveUrl, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await np.waitForTimeout(3000);
    await snap(np, `naive-${label}`);

    await op.goto(ourUrl, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    await op.waitForTimeout(2000);
    await snap(op, `ours-${label}`);
  }

  // Company Chat
  await comparePage(`${NAIVE}/company/chat`, `${OUR_BASE}/c/${OUR_COMPANY}/`, "chat");

  // Company Overview
  await comparePage(`${NAIVE}/company/overview`, `${OUR_BASE}/c/${OUR_COMPANY}/overview`, "overview");

  // Company Strategy
  await comparePage(`${NAIVE}/company/strategy`, `${OUR_BASE}/c/${OUR_COMPANY}/strategy`, "strategy");

  // Company Payments
  await comparePage(`${NAIVE}/company/payments`, `${OUR_BASE}/c/${OUR_COMPANY}/payments`, "payments");

  // Company Settings
  await comparePage(`${NAIVE}/company/settings`, `${OUR_BASE}/c/${OUR_COMPANY}/settings/general`, "settings");

  // Settings sub-tabs
  console.log("\n=== SETTINGS SUB-TABS ===");
  for (const tab of ["Billing", "Team", "Usage", "Server", "Publishing"]) {
    // Naive
    await np.goto(`${NAIVE}/company/settings`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    await np.waitForTimeout(2000);
    await tryClick(np, `text="${tab}"`, `naive-settings-${tab.toLowerCase()}`);

    // Ours
    await op.goto(`${OUR_BASE}/c/${OUR_COMPANY}/settings/general`, { waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
    await op.waitForTimeout(1000);
    await tryClick(op, `text="${tab}"`, `ours-settings-${tab.toLowerCase()}`);
  }

  // Tasks
  await comparePage(`${NAIVE}/tasks`, `${OUR_BASE}/c/${OUR_COMPANY}/tasks`, "tasks");

  // Drive
  await comparePage(`${NAIVE}/drive`, `${OUR_BASE}/c/${OUR_COMPANY}/drive`, "drive");

  // Store
  await comparePage(`${NAIVE}/store`, `${OUR_BASE}/c/${OUR_COMPANY}/store`, "store");

  // ===== STEP 3: SIDEBAR INTERACTIONS (NAIVE) =====
  console.log("\n=== SIDEBAR INTERACTIONS ===");
  await np.goto(`${NAIVE}/company/chat`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await np.waitForTimeout(3000);

  // Company switcher
  await tryClick(np, 'button:has-text("Company"), [class*="switcher"]', "naive-sidebar-company-switcher");
  await np.keyboard.press("Escape");
  await np.waitForTimeout(500);

  // User menu
  await tryClick(np, 'text="credits"', "naive-sidebar-user-menu");
  await np.keyboard.press("Escape");
  await np.waitForTimeout(500);

  // Review pill
  await tryClick(np, 'text="review waiting"', "naive-sidebar-review-pill");
  await np.keyboard.press("Escape");
  await np.waitForTimeout(500);

  // Getting Started items
  for (const item of ["Incorporate Company", "Connect or buy"]) {
    await tryClick(np, `text="${item}"`, `naive-gs-${item.slice(0, 12).replace(/ /g, '-')}`);
    await np.waitForTimeout(2000);
    await snap(np, `naive-gs-result-${item.slice(0, 12).replace(/ /g, '-')}`);
    await np.goBack().catch(() => {});
    await np.waitForTimeout(2000);
  }

  // ===== STEP 4: CEO DETAIL =====
  console.log("\n=== CEO DETAIL ===");
  await np.goto(`${NAIVE}/company/chat`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await np.waitForTimeout(3000);
  await tryClick(np, 'text="Naive (CEO)"', "naive-ceo-click");
  await np.waitForTimeout(3000);
  await snap(np, "naive-ceo-profile");

  // CEO tabs
  for (const tab of ["Chat", "Inbox", "Compute", "Settings"]) {
    await tryClick(np, `text="${tab}"`, `naive-ceo-tab-${tab.toLowerCase()}`);
  }

  // Our CEO for comparison
  await op.goto(`${OUR_BASE}/c/${OUR_COMPANY}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
  await op.waitForTimeout(1500);
  await tryClick(op, 'text="Naive (CEO)"', "ours-ceo-click");
  await op.waitForTimeout(1500);
  await snap(op, "ours-ceo-profile");
  for (const tab of ["Chat", "Inbox", "Compute", "Settings"]) {
    await tryClick(op, `button:has-text("${tab}"), a:has-text("${tab}")`, `ours-ceo-tab-${tab.toLowerCase()}`);
  }

  // ===== STEP 5: EXPAND DEPTS + AGENT DETAIL =====
  console.log("\n=== AGENT DETAIL ===");
  await np.goto(`${NAIVE}/company/chat`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await np.waitForTimeout(3000);
  // Expand Engineering
  await tryClick(np, 'text="ENGINEERING"', "naive-expand-eng");
  await np.waitForTimeout(1000);
  // Click first agent in Engineering
  const engAgent = np.locator('a:below(:text("ENGINEERING"))').first();
  try {
    if (await engAgent.isVisible({ timeout: 2000 })) {
      const agentName = await engAgent.textContent();
      console.log(`  Found engineer agent: ${agentName?.trim()}`);
      await engAgent.click();
      await np.waitForTimeout(3000);
      await snap(np, "naive-eng-agent-profile");
      // Agent sub-tabs
      for (const tab of ["Chat", "Browser", "Phone", "Workspace", "Virtual Cards", "Inbox", "Compute", "Settings"]) {
        await tryClick(np, `text="${tab}"`, `naive-eng-${tab.toLowerCase().replace(/ /g, '-')}`);
      }
    }
  } catch {}

  // ===== STEP 6: UPGRADE PAGE =====
  console.log("\n=== UPGRADE ===");
  await comparePage("https://app.usenaive.ai/upgrade", `${OUR_BASE}/c/${OUR_COMPANY}/upgrade`, "upgrade");

  // Top-up modal
  await tryClick(np, 'text="Top Up Credits"', "naive-topup-btn");
  await tryClick(op, 'text="Top Up Credits"', "ours-topup-btn");

  // ===== STEP 7: APPS LANDING PAGE =====
  console.log("\n=== APPS ===");
  await np.goto(`${NAIVE}/company/chat`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  await np.waitForTimeout(3000);
  await tryClick(np, 'text="Landing Page"', "naive-apps-landing");
  await np.waitForTimeout(3000);
  await snap(np, "naive-apps-landing-detail");

  await ourB.close();

  console.log(`\nDone. ${shotN} screenshots in ${OUT}/`);
  console.log("\nIMPORTANT: User's Chrome left open — don't forget to restore normal Chrome after.");
}

run().catch((e) => { console.error(e); process.exit(1); });
