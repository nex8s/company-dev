/**
 * Drive view copy — `ui/src/pages/Drive.tsx` (C-07).
 *
 * Files-by-department live aggregation across issue documents (B-02
 * + Paperclip's existing documents endpoint) and app files (B-03)
 * doesn't have a dedicated HTTP route yet — the page reads from a
 * typed mock that mirrors the expected wire shape; see the swap
 * marker in `useDriveData`.
 */

export const drive = {
  page: {
    title: "Drive",
    searchPlaceholder: "Search files…",
    sourceFilterAll: "All sources",
    sortLabel: "Newest",
    uploadCta: "Upload",
  },
  filter: {
    allFiles: "All Files",
    pending: "Pending",
  },
  departments: [
    "Executive",
    "Marketing",
    "Sales",
    "Engineering",
    "Recruiting",
  ],
  table: {
    name: "Name",
    source: "Source",
    folder: "Folder",
    modified: "Modified ↓",
    pendingBadge: "Pending Review",
  },
  empty: {
    body:
      "Upload files or let your agents create deliverables that will show up here.",
    cta: "Upload a file",
  },
  pendingEmpty: "No files pending review.",
  loading: "Loading files…",
  error: "Couldn't load Drive files.",
  stub: {
    badge: "stub · plugin-drive HTTP (TBD)",
  },
} as const;

export type DriveCopy = typeof drive;
