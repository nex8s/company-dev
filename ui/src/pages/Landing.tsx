import { colors, fontsHref } from "@/design/tokens";

/**
 * Landing page scaffold — C-02 wires the design-token surface into a real
 * page so the Tailwind config is exercised end-to-end and downstream tasks
 * (C-01 full port, C-14 brand swap) have a concrete target to evolve.
 *
 * The full marketing port (hero, composer, ambient cloud graphic, nav)
 * lands in C-01. Keep this file minimal — changes to it will be heavy
 * there, so don't stuff layout here.
 */
export function Landing() {
  return (
    <>
      {/* React 19 hoists these to <head>. Fonts are loaded from Google Fonts
          to match the prototype; swap to self-hosted in Phase 2 if needed. */}
      <link rel="stylesheet" href={fontsHref} />
      <meta name="theme-color" content={colors.cream} />
      <div className="min-h-screen bg-cream text-ink font-sans">
        <main className="flex min-h-screen items-center justify-center px-6">
          <h1 className="font-display text-[48px] sm:text-[64px] tracking-tight">
            Company.dev
          </h1>
        </main>
      </div>
    </>
  );
}

export default Landing;
