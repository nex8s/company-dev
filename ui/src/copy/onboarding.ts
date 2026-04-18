// TODO(C-14): swap brand voice — all user-facing strings centralized here.

export const onboardingCopy = {
  headline: "What do you want to build?",
  subtitle:
    "Describe your idea and choose whether you're starting fresh or growing an existing company.",
  textareaPlaceholder: "Describe your business idea…",
  addFiles: "+ Add files",
  modeStart: "Start a company",
  modeGrow: "Grow my company",
  companyNameLabel: "Company name",
  companyNamePlaceholder: "Company name",
  footer: "Powered by Company.dev",
  templates: [
    { category: "SAAS", title: "AI Voice Agent SaaS" },
    { category: "SAAS", title: "AI SDR Platform" },
    { category: "DEVELOPER TOOLS", title: "Vibe Coding IDE" },
    { category: "MEDIA", title: "AI Newsletter Company" },
    { category: "MEDIA", title: "Faceless YouTube Channel" },
    { category: "E-COMMERCE", title: "DTC Fitness Supplement Brand" },
  ] as const,
} as const;
