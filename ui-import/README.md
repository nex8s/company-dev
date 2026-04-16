# ui-import — reference artifacts (do not ship as-is)

Source HTML prototypes for the Company.dev frontend port. These are **reference only** — Agent C ports the layout, interactions, and aesthetic into Paperclip's React UI package (`ui/`). The raw HTML is not deployed.

| File | Purpose |
|---|---|
| `landing.html` | Marketing landing page (hero + composer + ambient cloud graphic). |
| `dashboard.html` | Full authenticated dashboard prototype (16+ views: Company Chat / Overview / Strategy / Payments / Settings · Tasks · Drive · Store · Upgrade · Top-up modal · Team CEO with Profile/Chat/Inbox/Compute/Settings · Landing Page Engineer with Profile/Chat/Browser/Phone/Workspace/Virtual Cards/Inbox/Compute/Settings · generic employee view populated from an `EMPLOYEES` dict · Landing Page app detail with Preview/Code/Deployments/Settings). |
| `dashboard.v1.html` | Earlier snapshot of the dashboard — keep for diff reference. |

## Porting rules

1. **Copy is placeholder.** Marketing copy, product name, and brand marks were derived from the reference site. Before public launch Agent C must swap all copy, replace the pixel logo, and remove any references to the reference brand. See `docs/company-dev/FEATURE_MAPPING.md` for the mapping from each view to a Paperclip primitive or a new feature.
2. **Visual system keeps.** Cream `#FBF9F6` background, DotGothic16 display font, Geist sans UI font, black pill primary CTA, hairline `#E5E5E5` borders, ambient dotted-cloud decoration — these constitute Company.dev's aesthetic and stay.
3. **Port target.** All views land in `ui/src/pages/` (or sub-routes of existing pages) using Paperclip's React + Tailwind + Vite setup. Drop the Tailwind CDN script, use the workspace Tailwind config.
4. **Client-side nav → React Router.** The prototype uses a hand-rolled view switcher keyed on `data-target`; port to `<Routes>` with the paths listed in FEATURE_MAPPING.md.
5. **Static data → live Paperclip queries.** Every KPI, employee card, task, and file listing in the prototype is hard-coded. Each has a Paperclip primitive that provides the real data (see FEATURE_MAPPING.md column "Paperclip source").
