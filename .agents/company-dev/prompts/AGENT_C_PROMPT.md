# Agent C — Frontend port, integration wiring, E2E

You are **Agent C** working on the `feat/frontend-port` branch of `~/company-dev/`.

## Read first (in order)

1. `docs/company-dev/PLAN.md` — your tasks are all the `C-NN` rows.
2. `docs/company-dev/ARCHITECTURE.md` — especially the Frontend section.
3. `docs/company-dev/FEATURE_MAPPING.md` — every view → its data source. This is your contract with Agent A and B.
4. `docs/company-dev/SELF_CHECK_PROTOCOL.md`.
5. `ui-import/README.md` — the porting rules for the HTML prototypes.

## Your scope

Port `ui-import/landing.html` and `ui-import/dashboard.html` into Paperclip's existing `ui/` React + Vite + Tailwind package. Wire every view to the live backend (Agents A and B provide the endpoints). Write the full E2E happy path.

**You do not write standalone HTML.** Everything is a React component under `ui/src/`.

## Branch workflow

Same as Agents A and B. Branch is `feat/frontend-port`.

## Hard rules

- **Port, don't copy-paste.** The prototypes use Tailwind CDN + hand-rolled JS routing. You port the visual and layout into the existing React + React Router + workspace Tailwind config.
- **No hard-coded data in production components.** Every list, KPI, and status chip reads from an API hook (`ui/src/hooks/*`) or `useQuery`.
- **Every data-bound component has a skeleton state AND an error state.** Not optional.
- **Copy lives in `ui/src/copy/*.ts`.** No literal strings embedded in JSX if the string is user-facing marketing/product copy. This is how Agent C-14 swaps branding cleanly.
- **Design tokens from the prototype become Tailwind theme extensions** (`ui/tailwind.config.ts`). No `#FBF9F6` literals in components — use `bg-cream`.
- **Popovers and modals use a shared primitive** (build one if Paperclip doesn't have it). No re-implementing close-on-outside-click logic per component.
- **Routes** — match the paths in ARCHITECTURE.md exactly. Agent A's Server panel needs `/c/:companyId/settings/server`; don't improvise.

## Copy + brand replacement (C-14)

The prototype was built by cloning a reference site. Before any public launch, all reference-brand copy and logo marks MUST be replaced with Company.dev's own. Your job on C-14:

1. grep the entire `ui/` tree for the reference product name and brand marks.
2. Replace each with Company.dev equivalents (product name: "Company.dev" or "Company", tagline: to-be-provided by user — stub with a placeholder clearly marked `// TODO(C-14): final tagline` until then).
3. Replace the pixel cloud logo SVG with Company.dev's own mark (user will provide; stub with a neutral placeholder mark).
4. The gate script checks `grep` returns zero hits outside `NOTICE.md` and historical docs.

Until C-14 runs, mark the UI as "internal dev preview" — add a dev-mode banner to the Landing page.

## E2E specifics (C-13)

Playwright, configured under `tests/e2e-company-dev/`. The happy path:

1. Navigate to `/signup`, register with a fresh email.
2. Create a new company "Test Co" with description "An AI-powered test business".
3. Verify the Naive CEO agent is seeded.
4. Ask CEO in chat: "hire a marketer". Verify a Growth Marketer agent is added to sidebar.
5. Ask the Marketer to produce a content calendar draft. Wait for pending review.
6. Approve the draft. Verify it moves from Needs Review → Completed.
7. Launch first App: type "build a landing page for a newsletter" in composer → App appears in sidebar → Preview tab shows deploying state → flips to active.
8. Go to Upgrade page → click Starter Subscribe → complete Stripe test checkout (use Stripe test card `4242 4242 4242 4242`).
9. Verify subscription state flips to Starter in sidebar user menu.
10. Go to Settings > Server. Verify instance details render (mock values OK in local mode).

## Your first move

1. `git pull origin master && git checkout feat/frontend-port && git rebase master`
2. Read all five docs.
3. Start C-02 (design tokens) — unblocks C-01 and C-03 and ensures the visual system is consistent across every later task.
4. Then C-01 (landing port).
5. Gate, commit, push, log, stop.

## Coordination points

- Every view you build references a specific A-NN or B-NN task. If that task isn't merged yet, build against a hand-written mock that matches the FEATURE_MAPPING contract. When the real endpoint lands, delete the mock in the same commit.
- Never ship a view against a "temporarily disabled" backend. If you can't reach the real data, show the error state and log it.
- The existing Chat page work in `~/company` (different repo — user's prior reskin) has useful patterns. Reference it; do not copy-paste without understanding.
