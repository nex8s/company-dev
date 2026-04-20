import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3100";
const COMPANY = "fbdf5864-8f58-40fd-bc71-b7b53a8affa3";
const OUT = path.resolve("qa-screenshots/deep");
fs.mkdirSync(OUT, { recursive: true });

let shotN = 0;
async function snap(page, label) {
  shotN++;
  const name = `${String(shotN).padStart(3,"0")}-${label}`;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`✓ ${name}`);
}

async function tryClick(page, selector, label, opts = {}) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.scrollIntoViewIfNeeded();
      await el.click({ timeout: 3000 });
      await page.waitForTimeout(opts.wait || 1000);
      await snap(page, label);
      return true;
    }
  } catch {}
  console.log(`  ⚠ skip: ${label}`);
  return false;
}

async function clickAllVisible(page, selector, labelPrefix, max = 10) {
  const els = page.locator(selector);
  const count = Math.min(await els.count(), max);
  for (let i = 0; i < count; i++) {
    try {
      const el = els.nth(i);
      if (await el.isVisible({ timeout: 1000 })) {
        const text = (await el.textContent())?.trim().slice(0, 30) || `item-${i}`;
        await el.scrollIntoViewIfNeeded();
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(800);
        await snap(page, `${labelPrefix}-${text.replace(/[^a-zA-Z0-9]/g, '_')}`);
      }
    } catch {}
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ============================================
  // SETTINGS > GENERAL — every button/toggle/link
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/settings/general`, { waitUntil: "networkidle", timeout: 15000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  await snap(page, "settings-general-full");

  // Upload logo button
  await tryClick(page, 'button:has-text("Upload"), button:has-text("Upload image")', "settings-upload-logo");
  // Agents lifecycle toggle
  await tryClick(page, '[role="switch"], button:has([class*="toggle"]), .cursor-pointer:near(:text("board approval"))', "settings-agents-toggle");
  // Incorporated toggle
  await tryClick(page, 'button:near(:text("incorporated")), [role="switch"]:nth-of-type(2)', "settings-incorporated-toggle");
  // Manage grid: Domains
  await tryClick(page, ':text("Domains")', "settings-manage-domains");
  await page.waitForTimeout(1000);
  await snap(page, "settings-domains-page");
  // Back to settings
  await page.goto(`${BASE}/c/${COMPANY}/settings/general`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1000);
  // Manage grid: Virtual Cards
  await tryClick(page, ':text("Virtual Cards"):not(:text("Virtual Cards tab"))', "settings-manage-vcards");
  await page.waitForTimeout(1000);
  await snap(page, "settings-vcards-page");
  await page.goto(`${BASE}/c/${COMPANY}/settings/general`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1000);
  // Manage grid: Custom Dashboards
  await tryClick(page, ':text("Custom Dashboards"), :text("Dashboards")', "settings-manage-dashboards");
  await page.waitForTimeout(1000);
  await snap(page, "settings-dashboards-page");
  await page.goto(`${BASE}/c/${COMPANY}/settings/general`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1000);
  // Manage grid: Connections
  await tryClick(page, ':text("Connections"):not(:text("Go to Connections"))', "settings-manage-connections");
  await page.waitForTimeout(1000);
  await snap(page, "settings-connections-page");

  // ============================================
  // SETTINGS > BILLING — every button
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/settings/billing`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "settings-billing-full");
  await tryClick(page, 'button:has-text("Upgrade Plan")', "billing-upgrade-plan");
  await page.goto(`${BASE}/c/${COMPANY}/settings/billing`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1000);
  await tryClick(page, 'button:has-text("Open Customer Portal")', "billing-customer-portal");
  await page.waitForTimeout(1000);
  await snap(page, "billing-portal-result");
  await page.goto(`${BASE}/c/${COMPANY}/settings/billing`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1000);
  await tryClick(page, 'button:has-text("Top Up Credits")', "billing-topup-btn");
  await page.waitForTimeout(1000);
  await snap(page, "billing-topup-modal");

  // ============================================
  // SETTINGS > TEAM — invite form, buttons
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/settings/team`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "settings-team-full");
  await tryClick(page, 'button:has-text("Send invite")', "team-send-invite");

  // ============================================
  // SETTINGS > USAGE — all elements
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/settings/usage`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "settings-usage-full");
  // Click filter dropdowns if any
  await tryClick(page, 'button:has-text("All types")', "usage-filter-types");
  await tryClick(page, 'button:has-text("Newest first")', "usage-filter-newest");

  // ============================================
  // SETTINGS > SERVER — buttons
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/settings/server`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "settings-server-full");
  await tryClick(page, 'button:has-text("Restart Server")', "server-restart-btn");

  // ============================================
  // SETTINGS > PUBLISHING — buttons
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/settings/publishing`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "settings-publishing-full");
  await tryClick(page, ':text("Publish Single Agent")', "publishing-single-agent");
  await page.goto(`${BASE}/c/${COMPANY}/settings/publishing`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await tryClick(page, ':text("Publish Entire Company")', "publishing-entire-company");

  // ============================================
  // OVERVIEW — every clickable element
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/overview`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "overview-full");
  // Chat button on company card
  await tryClick(page, 'button:has-text("Chat")', "overview-chat-btn");
  await page.goto(`${BASE}/c/${COMPANY}/overview`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1000);
  // Configure button
  await tryClick(page, 'button:has-text("Configure")', "overview-configure-btn");
  await page.goto(`${BASE}/c/${COMPANY}/overview`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1000);
  // View all Team
  await tryClick(page, 'a:has-text("View all"), button:has-text("View all")', "overview-view-all-team");
  await page.waitForTimeout(1000);
  await snap(page, "overview-view-all-result");
  // Go to Connections link
  await page.goto(`${BASE}/c/${COMPANY}/overview`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await tryClick(page, ':text("Go to Connections")', "overview-goto-connections");
  await page.waitForTimeout(1000);
  await snap(page, "overview-connections-dest");

  // ============================================
  // STRATEGY — buttons
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/strategy`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "strategy-full");
  await tryClick(page, 'button:has-text("Set goals in chat"), :text("Set goals")', "strategy-set-goals");
  await tryClick(page, ':text("View all")', "strategy-view-all-plans");

  // ============================================
  // TASKS — deeper: approve/reject if visible, card clicks
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/tasks`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await snap(page, "tasks-full");
  // Click a task card
  await tryClick(page, '[class*="kanban"], [class*="card"]:has-text("Landing Page")', "tasks-click-card");
  // Approve button
  await tryClick(page, 'button:has-text("Approve")', "tasks-approve-btn");
  // Reject button
  await tryClick(page, 'button:has-text("Reject")', "tasks-reject-btn");

  // ============================================
  // CEO DETAIL — deeper: Configure, Chat buttons, Profile buttons
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/team/${COMPANY}`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(500);
  // Try finding CEO via sidebar click
  await page.goto(`${BASE}/c/${COMPANY}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  await tryClick(page, ':text("Naive (CEO)")', "ceo-sidebar-click");
  await page.waitForTimeout(1500);
  // Configure button on profile
  await tryClick(page, 'button:has-text("Configure")', "ceo-configure-btn");
  await page.waitForTimeout(1000);
  await snap(page, "ceo-configure-result");
  // Chat button on profile
  await page.goBack().catch(()=>{});
  await page.waitForTimeout(1000);
  await tryClick(page, 'button:has-text("Chat")', "ceo-chat-btn");
  await page.waitForTimeout(1000);
  await snap(page, "ceo-chat-result");
  // View Details link on compute
  await tryClick(page, ':text("View Details")', "ceo-view-details");

  // ============================================
  // CEO > WORKSPACE tab
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await tryClick(page, ':text("Naive (CEO)")', "ceo-for-workspace");
  await page.waitForTimeout(1500);
  await tryClick(page, 'button:has-text("Workspace"), a:has-text("Workspace")', "ceo-workspace-tab");
  await page.waitForTimeout(1000);
  await snap(page, "ceo-workspace");
  // Edit button
  await tryClick(page, 'button:has-text("Edit")', "ceo-workspace-edit");
  // Skills sub-tab
  await tryClick(page, 'button:has-text("Skills")', "ceo-workspace-skills");

  // ============================================
  // STORE — deeper: category filter clicks, template card click
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/store`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  // Click each business category
  await tryClick(page, ':text("Agency & Services")', "store-cat-agency");
  await tryClick(page, ':text("Media & Content")', "store-cat-media");
  await tryClick(page, ':text("SaaS & Tech")', "store-cat-saas");
  await tryClick(page, ':text("All Businesses")', "store-cat-all");
  // Click employee dept filter
  await tryClick(page, ':text("Marketing & Growth")', "store-dept-marketing");
  await tryClick(page, ':text("All Employees")', "store-dept-all");
  // Click a template card body (not Get)
  await tryClick(page, ':text("Faceless YouTube Empire")', "store-template-click");
  await page.waitForTimeout(1000);
  await snap(page, "store-template-detail");

  // ============================================
  // UPGRADE — deeper: top-up modal inside, credit tiers
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/upgrade`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  // Scroll down for Pay-as-you-go
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await snap(page, "upgrade-scrolled-bottom");
  // Top Up Credits button
  await tryClick(page, 'button:has-text("Top Up Credits")', "upgrade-topup-btn");
  await page.waitForTimeout(1000);
  await snap(page, "upgrade-topup-modal");
  // Click different credit tiers if modal opened
  await tryClick(page, ':text("20 Credits")', "topup-20");
  await tryClick(page, ':text("100 Credits")', "topup-100");
  await tryClick(page, ':text("250 Credits")', "topup-250");
  // Purchase button
  await tryClick(page, 'button:has-text("Purchase")', "topup-purchase");
  // Cancel
  await tryClick(page, 'button:has-text("Cancel")', "topup-cancel");

  // ============================================
  // SIDEBAR — deeper: expand each dept, click each agent
  // ============================================
  await page.goto(`${BASE}/c/${COMPANY}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  // Try expanding each dept by clicking the chevron/header
  const depts = ["ENGINEERING", "MARKETING", "OPERATIONS", "SALES", "SUPPORT"];
  for (const dept of depts) {
    const btn = page.locator(`button:has-text("${dept}"), [role="button"]:has-text("${dept}"), div:has-text("${dept}")`).first();
    try {
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(800);
        await snap(page, `sidebar-expand-${dept.toLowerCase()}`);
        // Click the agent inside if visible
        const agentLinks = page.locator(`a:below(:text("${dept}"))`).first();
        if (await agentLinks.isVisible({ timeout: 1000 })) {
          await agentLinks.click({ timeout: 2000 });
          await page.waitForTimeout(1500);
          await snap(page, `sidebar-agent-in-${dept.toLowerCase()}`);
          // Go back
          await page.goto(`${BASE}/c/${COMPANY}/`, { waitUntil: "networkidle", timeout: 10000 }).catch(()=>{});
          await page.waitForTimeout(1000);
        }
      }
    } catch {}
  }

  // Subscribe → link in trial banner
  await tryClick(page, ':text("Subscribe →"), a:has-text("Subscribe")', "sidebar-subscribe-link");
  await page.waitForTimeout(1000);
  await snap(page, "sidebar-subscribe-dest");

  await browser.close();
  console.log(`\nDone. ${shotN} screenshots in ${OUT}/`);
}

run().catch((e) => { console.error(e); process.exit(1); });
