import { ArrowUp, Circle, Plus } from "lucide-react";
import { colors, fontsHref } from "@/design/tokens";
import { landing } from "@/copy/landing";

/**
 * Marketing landing page — C-01 port of `ui-import/landing.html`.
 *
 * Visual system comes from C-02: `bg-cream`, `text-ink`, `text-mist`,
 * `border-hairline`, `font-display`, `font-sans`, `animate-cloud-glide`
 * are all Tailwind utilities backed by `src/design/tokens.ts`. The
 * prototype's non-token CSS (bg-lines, bg-glow, dot-matrix, mask-cloud-*,
 * cursor-blink) ships in `src/design/marketing.css`.
 *
 * Copy lives in `src/copy/landing.ts` per the C-14 brand-swap contract.
 * No user-facing string is embedded directly in this file.
 *
 * Not yet wired into React Router — `CloudAccessGate` in `App.tsx`
 * intercepts `/` for auth/bootstrap, and unauthenticated marketing routes
 * need their own gating shell. That wiring is tracked for a later task so
 * this port can ship without an invasive App.tsx restructure.
 */

function PlaceholderLogo() {
  // TODO(C-14): replace the neutral dot-matrix placeholder with the real
  // Company.dev logo once the user provides the final mark. The dot grid
  // here is visually neutral but still satisfies the 26x18 header footprint.
  return (
    <svg
      width="26"
      height="18"
      viewBox="0 0 26 18"
      className="text-ink fill-current"
      aria-label={landing.brand.logoAlt}
      role="img"
    >
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="13" cy="5" r="1.5" />
      <circle cx="17" cy="5" r="1.5" />
      <circle cx="5" cy="9" r="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="13" cy="9" r="1.5" />
      <circle cx="17" cy="9" r="1.5" />
      <circle cx="21" cy="9" r="1.5" />
      <circle cx="1" cy="13" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="9" cy="13" r="1.5" />
      <circle cx="13" cy="13" r="1.5" />
      <circle cx="17" cy="13" r="1.5" />
      <circle cx="21" cy="13" r="1.5" />
      <circle cx="25" cy="13" r="1.5" />
      <circle cx="5" cy="17" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="13" cy="17" r="1.5" />
      <circle cx="17" cy="17" r="1.5" />
      <circle cx="21" cy="17" r="1.5" />
    </svg>
  );
}

function DevPreviewBanner() {
  return (
    <div
      role="status"
      className="w-full bg-ink text-cream text-[12px] tracking-wide px-6 py-1.5 flex items-center justify-center gap-2"
    >
      <span className="uppercase font-medium">{landing.devPreview.label}</span>
      <span className="opacity-70">- {landing.devPreview.detail}</span>
    </div>
  );
}

function Header() {
  return (
    <header className="fixed top-[28px] left-0 w-full z-50 flex items-center justify-between px-8 py-4 bg-cream/80 backdrop-blur-sm">
      <a href="#" className="flex items-center gap-2 cursor-pointer z-10 hover:opacity-80 transition-opacity">
        <PlaceholderLogo />
        <span className="text-xl tracking-tight mt-[2px] font-sans">
          {landing.brand.name}
        </span>
      </a>

      <nav className="hidden md:flex absolute inset-x-0 mx-auto w-fit items-center gap-7 text-[15px]">
        <a href="#" className="text-ink font-medium">{landing.nav.home}</a>
        <a href="#" className="text-mist hover:text-ink transition-colors">{landing.nav.templates}</a>
        <a href="#" className="text-mist hover:text-ink transition-colors">{landing.nav.enterprise}</a>
        <a href="#" className="text-mist hover:text-ink transition-colors">{landing.nav.pricing}</a>
        <a href="#" className="text-mist hover:text-ink transition-colors">{landing.nav.accelerator}</a>
        <a href="#" className="text-mist hover:text-ink transition-colors">{landing.nav.resources}</a>
      </nav>

      <div className="flex items-center gap-3 z-10">
        <a
          href="#"
          className="px-5 py-2 text-[14px] font-medium border border-hairline rounded-full hover:bg-black/5 transition-colors"
        >
          {landing.auth.logIn}
        </a>
        <a
          href="#"
          className="px-5 py-2 text-[14px] font-medium border border-black bg-black text-white rounded-full hover:bg-neutral-900 transition-colors"
        >
          {landing.auth.getStarted}
        </a>
      </div>
    </header>
  );
}

function ComposerModePill({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2.5 border border-[#2B2B2B] rounded-full pl-3 pr-4 py-1.5 hover:bg-[#111] transition-colors group"
    >
      <Circle
        aria-hidden="true"
        className="size-[14px] text-[#555] group-hover:text-white transition-colors"
        strokeWidth={1.5}
      />
      <span className="text-[14px] text-[#A1A1A1] group-hover:text-white transition-colors">
        {label}
      </span>
    </button>
  );
}

function Composer() {
  return (
    <div className="w-full max-w-[860px] bg-black rounded-[32px] overflow-hidden flex flex-col shadow-2xl relative">
      <div className="w-full px-10 pt-[38px] pb-12 text-left">
        <p className="text-[20px] sm:text-[22px] text-[#7A7A7A] leading-relaxed">
          {landing.composer.examplePrefix}{" "}
          <span className="text-white font-medium">
            {landing.composer.exampleEmphasis}
          </span>{" "}
          {landing.composer.exampleSuffix}
          <span className="text-white cursor-blink font-medium" aria-hidden="true">
            |
          </span>
        </p>
      </div>

      <div className="w-full px-10 pb-7 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3">
          <ComposerModePill label={landing.composer.modeBuild} />
          <div className="hidden sm:block">
            <ComposerModePill label={landing.composer.modeAutomate} />
          </div>
        </div>

        <div className="flex items-center gap-5 translate-y-1">
          <button
            type="button"
            aria-label={landing.composer.attachLabel}
            className="text-[#666] hover:text-white transition-colors"
          >
            <Plus className="size-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label={landing.composer.sendLabel}
            className="size-[36px] bg-[#222] rounded-full flex items-center justify-center text-[#999] hover:bg-[#333] hover:text-white transition-all"
          >
            <ArrowUp className="size-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="flex flex-col gap-0 w-full py-16 md:py-24 relative justify-center min-h-[92svh]">
      {/* Horizontal hairlines layer (z-1). */}
      <div className="absolute inset-0 z-[1] pointer-events-none bg-lines" aria-hidden="true" />

      {/* Ambient dotted-cloud graphic (z-2). Cloud-glide animation drifts it
          horizontally; masks clip it into two cloud blobs at the lower corners. */}
      <div className="absolute inset-0 z-[2] pointer-events-none opacity-40">
        <div className="absolute inset-0 overflow-hidden pointer-events-none animate-cloud-glide">
          <div className="absolute inset-0 w-full h-[120%] dot-matrix mask-cloud-left opacity-60 mix-blend-multiply" />
          <div className="absolute inset-x-0 bottom-[-10%] top-0 w-full h-[110%] dot-matrix mask-cloud-right opacity-60 mix-blend-multiply" />
        </div>
      </div>

      {/* Central glow that dims edges of the backdrop so the hero stack reads (z-6). */}
      <div className="absolute inset-0 z-[6] pointer-events-none bg-glow" aria-hidden="true" />

      <div className="relative z-20 flex flex-col items-center justify-center w-full px-6 -mt-10">
        <h1 className="font-display text-[42px] sm:text-[50px] md:text-[60px] tracking-tight leading-[1.1] mb-5 text-center px-4 max-w-4xl font-normal text-ink">
          {landing.hero.headline}
        </h1>

        <p className="text-[20px] md:text-[24px] text-mist mb-12 text-center max-w-2xl px-4 font-normal tracking-tight">
          {landing.hero.subheadline}
        </p>

        <Composer />
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <>
      {/* React 19 hoists these to <head>. */}
      <link rel="stylesheet" href={fontsHref} />
      <meta name="theme-color" content={colors.cream} />

      <div className="bg-cream text-ink font-sans antialiased selection:bg-black selection:text-white overflow-x-hidden min-h-screen flex flex-col">
        <DevPreviewBanner />
        <Header />
        <main
          id="main-content"
          className="w-full max-w-full flex-1 flex flex-col justify-center relative overflow-x-hidden pt-[72px]"
        >
          <Hero />
        </main>
      </div>
    </>
  );
}

export default Landing;
