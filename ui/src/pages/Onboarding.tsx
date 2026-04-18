import { useState, useCallback } from "react";
import { useNavigate } from "@/lib/router";
import { onboardingCopy as copy } from "@/copy/onboarding";
import { ArrowUp } from "lucide-react";
// design tokens consumed via Tailwind classes (bg-cream, text-ink, text-mist, etc.)

type Mode = "start" | "grow";

export function Onboarding() {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [mode, setMode] = useState<Mode>("start");

  const canSubmit = description.trim().length > 0 && companyName.trim().length > 0;

  const handleTemplateClick = useCallback((title: string) => {
    setDescription(title);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    // TODO: POST to company creation API, then redirect to /c/:companyId/
    // For now, redirect to home so the user sees something
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName.trim(),
          description: description.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/c/${data.id}/`);
        return;
      }
    } catch {
      // fallback
    }
    navigate("/home");
  }, [canSubmit, companyName, description, navigate]);

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <svg
            className="w-6 h-6 text-ink"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 6h4v2H8V6zm4-2h4v2h-4V4zm4 2h2v2h-2V6zm2 2h2v2h-2V8zm-2 2h2v2h-2v-2zm-6 2h6v2h-6v-2zm-4-2h4v2H6v-2zm-4-2h4v2H2V8zm0-2h4v2H2V6z" />
          </svg>
          <span className="font-display text-xl tracking-wider">
            Company.dev
          </span>
        </div>
        <button
          type="button"
          className="text-sm text-mist hover:text-ink flex items-center gap-1 transition-colors"
        >
          <ArrowUp className="size-3.5 rotate-45" />
          Sign out
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        <h1 className="font-display text-4xl md:text-5xl tracking-tight text-center mb-3">
          {copy.headline}
        </h1>
        <p className="text-mist text-center max-w-md mb-10">
          {copy.subtitle}
        </p>

        <div className="w-full max-w-2xl bg-white border border-hairline rounded-2xl p-6 shadow-sm space-y-5">
          {/* Textarea */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={copy.textareaPlaceholder}
            rows={3}
            className="w-full bg-transparent text-sm text-ink placeholder:text-mist/60 outline-none resize-none"
          />

          {/* Template suggestions */}
          <div className="grid grid-cols-3 gap-2">
            {copy.templates.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => handleTemplateClick(t.title)}
                className="text-left border border-hairline rounded-lg px-3 py-2.5 hover:bg-cream/60 transition-colors group"
              >
                <span className="text-[9px] font-semibold uppercase tracking-widest text-mist">
                  {t.category}
                </span>
                <p className="text-xs text-ink mt-0.5 group-hover:text-ink/80">
                  {t.title}
                </p>
              </button>
            ))}
          </div>

          {/* Add files */}
          <button
            type="button"
            className="text-xs text-mist hover:text-ink transition-colors flex items-center gap-1"
          >
            {copy.addFiles}
          </button>

          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("start")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition-colors ${
                mode === "start"
                  ? "border-ink bg-white text-ink"
                  : "border-hairline text-mist hover:text-ink"
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  mode === "start" ? "border-ink" : "border-mist/40"
                }`}
              >
                {mode === "start" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-ink" />
                )}
              </span>
              {copy.modeStart}
            </button>
            <button
              type="button"
              onClick={() => setMode("grow")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition-colors ${
                mode === "grow"
                  ? "border-ink bg-white text-ink"
                  : "border-hairline text-mist hover:text-ink"
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  mode === "grow" ? "border-ink" : "border-mist/40"
                }`}
              >
                {mode === "grow" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-ink" />
                )}
              </span>
              {copy.modeGrow}
            </button>
          </div>

          {/* Company name + submit */}
          <div className="flex items-center gap-3 border-t border-hairline pt-4">
            <span className="text-xs text-red-400">*</span>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={copy.companyNamePlaceholder}
              className="flex-1 text-sm text-ink placeholder:text-mist/50 outline-none bg-transparent"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                canSubmit
                  ? "bg-ink text-white hover:bg-ink/90"
                  : "bg-mist/20 text-mist/40 cursor-not-allowed"
              }`}
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-mist">
        {copy.footer}
      </footer>
    </div>
  );
}
