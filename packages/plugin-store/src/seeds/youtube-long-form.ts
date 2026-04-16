import type { SeedTemplate } from "../types.js";

export const youtubeLongForm: SeedTemplate = {
  slug: "youtube-long-form",
  kind: "business",
  title: "YouTube Long-Form Producer",
  category: "Marketing & Growth",
  summary:
    "Ship researched, on-camera long-form YouTube videos on a weekly cadence: deep topic research, outline, script, shot list, edit plan, and a promotion plan tuned for the algorithm.",
  creator: "Company.dev",
  skills: [
    "deep-research",
    "outline-design",
    "long-form-scripting",
    "shot-list-planning",
    "edit-direction",
    "thumbnail-testing",
    "cross-promotion",
  ],
  employees: [
    {
      role: "Topic Researcher",
      department: "marketing",
      model: "claude-opus-4-6",
      schedule: "weekly",
      responsibilities: [
        "Mine search and social for timely questions in the channel's beat",
        "Assemble primary-source citations",
        "Hand the Storyliner a one-page topic memo",
      ],
    },
    {
      role: "Storyliner",
      department: "marketing",
      model: "claude-opus-4-6",
      schedule: "weekly",
      responsibilities: [
        "Turn the memo into a beat-by-beat outline",
        "Design narrative arcs that hold attention past the 10-minute mark",
        "Nominate the cold-open and payoff",
      ],
    },
    {
      role: "Scriptwriter",
      department: "marketing",
      model: "claude-opus-4-6",
      schedule: "per-video",
      responsibilities: [
        "Write the full on-camera script with cadence marks",
        "Separate narration from piece-to-camera",
        "Suggest on-screen text and lower thirds",
      ],
    },
    {
      role: "Producer",
      department: "operations",
      model: "claude-sonnet-4-6",
      schedule: "per-video",
      responsibilities: [
        "Break the script into a shot list and B-roll list",
        "Plan studio vs location shoots",
        "Brief the editor with a per-scene intent note",
      ],
    },
    {
      role: "Promotion Lead",
      department: "marketing",
      model: "claude-sonnet-4-6",
      schedule: "per-video",
      responsibilities: [
        "A/B test thumbnails and titles before launch",
        "Seed community tabs, shorts, and newsletter",
        "Watch first-24h retention and recommend follow-ups",
      ],
    },
  ],
};
