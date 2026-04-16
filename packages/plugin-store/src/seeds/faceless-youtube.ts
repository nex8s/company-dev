import type { SeedTemplate } from "../types.js";

export const facelessYoutube: SeedTemplate = {
  slug: "faceless-youtube",
  kind: "business",
  title: "Faceless YouTube Empire",
  category: "Media & Content",
  summary:
    "Run a faceless YouTube channel end-to-end: pick winning niches, script voice-over videos, source stock footage, render, publish, and iterate on analytics without ever showing your face.",
  creator: "Company.dev",
  skills: [
    "niche-research",
    "script-writing",
    "voice-over",
    "stock-footage-sourcing",
    "video-rendering",
    "youtube-publishing",
    "analytics-review",
  ],
  employees: [
    {
      role: "Niche Researcher",
      model: "claude-sonnet-4-6",
      schedule: "weekly",
      responsibilities: [
        "Scan trending topics across a whitelist of niches",
        "Score ideas by watch-time potential and competition",
        "Produce a ranked brief for the scriptwriter",
      ],
    },
    {
      role: "Scriptwriter",
      model: "claude-opus-4-6",
      schedule: "per-video",
      responsibilities: [
        "Turn briefs into 8–12 minute voice-over scripts",
        "Write pattern-interrupt hooks for the first 15 seconds",
        "Tag scenes with B-roll cues",
      ],
    },
    {
      role: "Voice Director",
      model: "claude-haiku-4-5",
      schedule: "per-video",
      responsibilities: [
        "Pick a voice profile that matches the niche",
        "Drive the TTS render",
        "Flag any segments that need a human retake",
      ],
    },
    {
      role: "B-Roll Sourcer",
      model: "claude-haiku-4-5",
      schedule: "per-video",
      responsibilities: [
        "Pull licensed stock clips that match scene cues",
        "Avoid repeating footage within a 30-day window",
        "Deliver an edit-ready media bundle",
      ],
    },
    {
      role: "Publisher",
      model: "claude-sonnet-4-6",
      schedule: "daily",
      responsibilities: [
        "Render and upload with A/B tested thumbnails",
        "Schedule releases against the niche's peak viewing window",
        "Loop analytics back into the Niche Researcher's brief",
      ],
    },
  ],
};
