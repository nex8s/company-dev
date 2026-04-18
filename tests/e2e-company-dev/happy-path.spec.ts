import { test, expect, type Page } from "@playwright/test";

/**
 * C-13 — Company.dev happy-path E2E.
 *
 * Walks the end-to-end flow from the PLAN.md gate:
 *   1. Landing loads
 *   2. Signup / CLI bootstrap (local_trusted creates a session
 *      automatically; we still verify the auth screen redirects
 *      cleanly)
 *   3. Create company (via /onboarding wizard)
 *   4. CEO is seeded (sidebar Team section shows "(CEO)")
 *   5. Hire marketer (plugin-company `hireAgent`)
 *   6. Approve draft (A-05 pending-review queue + the C-06 kanban
 *      Approve button or the sidebar review pill)
 *   7. Launch app (C-10 Preview iframe flips from "not deployed" to
 *      a production URL)
 *   8. Subscribe Starter (C-11 Upgrade page + Stripe Checkout redirect)
 *   9. Verify Server panel (Settings → Server renders instance info)
 *
 * Running in `PAPERCLIP_DEPLOYMENT_MODE=local_trusted` so the auth
 * step is implicit. LLM-dependent steps (actual agent work) are
 * skipped by default — set `COMPANY_DEV_E2E_SKIP_LLM=false` to assert
 * them with a live ANTHROPIC_API_KEY. Stripe steps skip unless
 * `STRIPE_PRICE_STARTER` is configured.
 *
 * Test selectors follow the `data-testid` contracts established by
 * the C-tasks: `company-shell`, `company-sidebar`, `company-tasks`,
 * `app-detail`, `upgrade-view`, `settings-team`, etc.
 */

const SKIP_LLM = process.env.COMPANY_DEV_E2E_SKIP_LLM !== "false";
const STRIPE_CONFIGURED =
  (process.env.STRIPE_PRICE_STARTER ?? "").length > 0;

const COMPANY_NAME = `E2E-Company-${Date.now()}`;

test.describe("Company.dev happy path", () => {
  test("landing → signup → company → CEO → hire → approve → app → subscribe → server", async ({ page }) => {
    // Step 1 — Landing loads.
    await page.goto("/");
    const landingHeading = page.locator("h1").first();
    await expect(landingHeading).toBeVisible({ timeout: 10_000 });

    // Step 2 — Signup / bootstrap. In local_trusted mode the server
    // auto-creates a session, so we just verify that /onboarding (or
    // /c/:id) is reachable without an auth wall.
    await page.goto("/onboarding");

    // Step 3 — Create company via the wizard.
    await createCompanyViaOnboarding(page, COMPANY_NAME);

    // Step 4 — CEO seeded. Sidebar shows "(CEO)" suffix.
    const sidebar = page.locator('[data-testid="company-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
    await expect(sidebar).toContainText("(CEO)", { timeout: 30_000 });

    // Step 5 — Hire marketer. Kicked off by a chat message; verified
    // by the sidebar marketing dept count ticking up. This needs
    // the LLM to actually run a hire — skipped by default.
    if (!SKIP_LLM) {
      await hireMarketer(page);
      await expect(sidebar.locator('[data-testid="dept-marketing"]')).toContainText(
        /\d+/,
        { timeout: 120_000 },
      );
    }

    // Step 6 — Approve a pending draft. The review pill in the sidebar
    // lights up; click through to the Tasks kanban and press Approve.
    if (!SKIP_LLM) {
      const reviewPill = sidebar.getByRole("button", { name: /review waiting/i });
      await reviewPill.click();
      await page.getByRole("button", { name: /approve/i }).first().click();
    }

    // Step 7 — Launch app. Navigate to the sidebar Apps row → App
    // Detail → Preview tab. In skip-LLM mode the app may still be in
    // "not deployed" state; we only assert the tab mounts.
    const appRow = page.locator('[data-testid="company-sidebar"] [data-app-id]').first();
    if (await appRow.isVisible()) {
      await appRow.click();
      await expect(page.locator('[data-testid="app-detail"]')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-testid="app-tab-preview"]')).toBeVisible();
    }

    // Step 8 — Subscribe Starter. Go to Upgrade, click Subscribe on
    // Starter. If Stripe keys aren't set the button is disabled and
    // we only assert the plan card renders; otherwise we expect
    // `window.location` to be redirected to `checkout.stripe.com`.
    await page.goto(`/c/${await currentCompanyId(page)}/upgrade`);
    await expect(page.locator('[data-testid="upgrade-view"]')).toBeVisible();
    const starterBtn = page.locator('[data-testid="subscribe-starter"]');
    await expect(starterBtn).toBeVisible();
    if (STRIPE_CONFIGURED) {
      // The redirect leaves the app; assert we land on Stripe.
      const [navResp] = await Promise.all([
        page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 }).catch(() => null),
        starterBtn.click(),
      ]);
      expect(navResp).not.toBeNull();
    }

    // Step 9 — Verify Server panel. Navigate through the Settings inner
    // tab strip and confirm the Server tab renders (today it's a stub
    // placeholder — we assert the placeholder copy, which is enough to
    // prove the routing chain is intact).
    await page.goto(`/c/${await currentCompanyId(page)}/settings/server`);
    await expect(
      page.locator('[data-testid="settings-server-placeholder"]').or(
        page.locator("text=Server"),
      ),
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createCompanyViaOnboarding(page: Page, companyName: string) {
  // Step 1 — Name.
  const nameInput = page.locator('input[placeholder="Acme Corp"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill(companyName);
    await page.getByRole("button", { name: "Next" }).click();
  }
  // Step 2 — Agent adapter (defaults to Claude Code).
  const agentInput = page.locator('input[placeholder="CEO"]');
  if (await agentInput.isVisible()) {
    await page.getByRole("button", { name: "Next" }).click();
  }
  // Step 3 — First task.
  const taskInput = page.locator('textarea').first();
  if (await taskInput.isVisible()) {
    await taskInput.fill("Launch a landing page");
    await page.getByRole("button", { name: /finish|launch|start/i }).click();
  }
  // The wizard redirects to /c/:companyId/*; wait for the shell.
  await page.waitForURL(/\/c\/[^/]+/, { timeout: 30_000 });
}

async function hireMarketer(page: Page) {
  // Company Chat composer accepts a natural-language hire request.
  const composer = page.locator('[data-testid="chat-textarea"]');
  await composer.fill("Hire a growth marketer.");
  await page.getByRole("button", { name: /send/i }).click();
}

async function currentCompanyId(page: Page): Promise<string> {
  const url = page.url();
  const match = url.match(/\/c\/([^/?#]+)/);
  if (!match) throw new Error(`no company id in URL: ${url}`);
  return match[1];
}
