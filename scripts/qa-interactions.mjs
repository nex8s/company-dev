import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3100";
const COMPANY = "fbdf5864-8f58-40fd-bc71-b7b53a8affa3";
const OUT = path.resolve("qa-screenshots/interactions");
fs.mkdirSync(OUT, { recursive: true });

let shotN = 0;
async function snap(page, label) {
  shotN++;
  const name = `${String(shotN).padStart(3,"0")}-${label}`;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`✓ ${name}`);
}

async function tryClick(page, selector, label) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.click({ timeout: 3000 });
      await page.waitForTimeout(1000);
      await snap(page, label);
      return true;
    }
  } catch { /* element not found or not clickable */ }
  console.log(`  ⚠ skip: ${label} (${selector} not found/visible)`);
  return false;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ===== LANDING PAGE =====
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 15000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  await snap(page, "landing-load");
  await tryClick(page, 'text="Log in"', "landing-login-btn");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await tryClick(page, 'text="Get started"', "landing-getstarted-btn");

  // ===== COMPANY SHELL =====
  await page.goto(`${BASE}/c/${COMPANY}/`, { waitUntil: "networkidle", timeout: 15000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  await snap(page, "shell-chat-default");

  // Sidebar: company switcher popover
  await tryClick(page, '[data-testid="company-switcher"], button:has-text("Company")', "sidebar-company-switcher");
  // Close it
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Sidebar: review pill popover
  await tryClick(page, 'text="review waiting"', "sidebar-review-pill");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Sidebar: user menu
  await tryClick(page, 'text="15.25 credits"', "sidebar-user-menu");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Sidebar: expand Engineering dept
  await tryClick(page, 'text="ENGINEERING"', "sidebar-expand-engineering");

  // Sidebar: expand Marketing dept
  await tryClick(page, 'text="MARKETING"', "sidebar-expand-marketing");

  // Sidebar: Getting Started - click first item
  await tryClick(page, 'text="Incorporate Company"', "sidebar-checklist-incorporate");

  // ===== TAB NAVIGATION =====
  // Overview tab
  await tryClick(page, 'a:has-text("Overview"), button:has-text("Overview")', "tab-overview");

  // Strategy tab
  await tryClick(page, 'a:has-text("Strategy"), button:has-text("Strategy")', "tab-strategy");

  // Payments tab
  await tryClick(page, 'a:has-text("Payments"), button:has-text("Payments")', "tab-payments");

  // Settings tab
  await tryClick(page, 'a:has-text("Settings"), button:has-text("Settings")', "tab-settings-general");

  // Settings sub-tabs
  await tryClick(page, 'text="Billing"', "settings-billing");
  await tryClick(page, 'text="Team"', "settings-team");
  await tryClick(page, 'text="Usage"', "settings-usage");
  await tryClick(page, 'text="Server"', "settings-server");
  await tryClick(page, 'text="Publishing"', "settings-publishing");

  // Back to Chat
  await tryClick(page, 'a:has-text("Chat"), button:has-text("Chat")', "tab-chat-back");

  // ===== SIDEBAR NAV =====
  // Tasks
  await tryClick(page, 'a:has-text("Tasks"), [href*="tasks"]', "nav-tasks");
  await page.waitForTimeout(1500);
  await snap(page, "tasks-page");
  // Click + New Task if visible
  await tryClick(page, 'text="New Task"', "tasks-new-task-btn");
  // Click All/Active/Backlog/Done tabs
  await tryClick(page, 'text="Active"', "tasks-tab-active");
  await tryClick(page, 'text="Backlog"', "tasks-tab-backlog");
  await tryClick(page, 'text="Done"', "tasks-tab-done");
  await tryClick(page, 'text="All"', "tasks-tab-all");

  // Drive
  await page.goto(`${BASE}/c/${COMPANY}/drive`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "drive-page");
  await tryClick(page, 'text="Marketing"', "drive-tab-marketing");
  await tryClick(page, 'text="Pending"', "drive-tab-pending");
  await tryClick(page, 'text="Upload"', "drive-upload-btn");

  // Store
  await page.goto(`${BASE}/c/${COMPANY}/store`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "store-page");
  await tryClick(page, 'text="Businesses"', "store-tab-businesses");
  await tryClick(page, 'text="Employees"', "store-tab-employees");
  await tryClick(page, 'text="All"', "store-tab-all");
  // Click first Get button
  await tryClick(page, 'button:has-text("Get")', "store-get-btn");

  // ===== TEAM > EMPLOYEE DETAIL =====
  // Click CEO in sidebar
  await page.goto(`${BASE}/c/${COMPANY}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await tryClick(page, 'text="Naive (CEO)"', "team-ceo-click");
  await page.waitForTimeout(1500);
  await snap(page, "team-ceo-profile");

  // CEO sub-tabs
  await tryClick(page, 'button:has-text("Chat"), a:has-text("Chat")', "ceo-tab-chat");
  await tryClick(page, 'button:has-text("Inbox"), a:has-text("Inbox")', "ceo-tab-inbox");
  await tryClick(page, 'button:has-text("Compute"), a:has-text("Compute")', "ceo-tab-compute");
  await tryClick(page, 'button:has-text("Settings"), a:has-text("Settings")', "ceo-tab-settings");

  // ===== APPS > LANDING PAGE =====
  await page.goto(`${BASE}/c/${COMPANY}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await tryClick(page, 'text="Landing Page"', "apps-landing-click");
  await page.waitForTimeout(1500);
  await snap(page, "apps-landing-detail");

  // ===== UPGRADE =====
  await page.goto(`${BASE}/c/${COMPANY}/upgrade`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "upgrade-page");
  await tryClick(page, 'button:has-text("Subscribe")', "upgrade-subscribe-btn");
  await page.waitForTimeout(1000);
  await snap(page, "upgrade-after-subscribe");

  // ===== OVERVIEW BUTTONS =====
  await page.goto(`${BASE}/c/${COMPANY}/overview`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await tryClick(page, 'text="Go to Connections"', "overview-goto-connections");
  await page.waitForTimeout(1000);
  await snap(page, "overview-connections-result");

  // ===== PAYMENTS > GO TO CONNECTIONS =====
  await page.goto(`${BASE}/c/${COMPANY}/payments`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await tryClick(page, 'text="Go to Connections"', "payments-goto-connections");
  await page.waitForTimeout(1000);
  await snap(page, "payments-connections-result");

  await browser.close();
  console.log(`\nDone. ${shotN} screenshots in ${OUT}/`);
}

run().catch((e) => { console.error(e); process.exit(1); });
