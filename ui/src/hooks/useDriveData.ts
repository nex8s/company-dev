import { useMemo } from "react";

/**
 * C-07 Drive data facade. No dedicated `plugin-drive` HTTP route exists
 * yet (Paperclip ships per-issue documents and per-app files but no
 * cross-issue aggregation). Today the hook returns a typed mock shaped
 * exactly like the future `GET /companies/:companyId/plugin-drive/files`
 * response — when that route lands, swap MOCK for `useQuery(...)`.
 */

export type DriveDepartment =
  | "Executive"
  | "Marketing"
  | "Sales"
  | "Engineering"
  | "Recruiting";

export type DriveFileStatus = "ready" | "pending_review";

export interface DriveFileRow {
  readonly id: string;
  readonly name: string;
  /** Display name of the agent or human that created the file. */
  readonly source: string;
  readonly department: DriveDepartment;
  readonly status: DriveFileStatus;
  readonly modifiedAt: string;
}

export interface DriveData {
  readonly files: readonly DriveFileRow[];
  readonly visibleFiles: readonly DriveFileRow[];
  readonly departmentCounts: Readonly<Record<DriveDepartment, number>>;
  readonly pendingCount: number;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

export type DriveFilter =
  | { kind: "all" }
  | { kind: "department"; department: DriveDepartment }
  | { kind: "pending" };

// TODO(plugin-drive HTTP): replace MOCK_FILES with useQuery against the
// new endpoint. The wire shape mirrors this array; the only delta will
// be `modifiedAt` becoming an ISO string parsed via Date.parse — already
// handled by the renderer.
const MOCK_FILES: readonly DriveFileRow[] = [
  {
    id: "file-content-cal",
    name: "30-Day Content Calendar — Company X",
    source: "Growth Marketer",
    department: "Marketing",
    status: "pending_review",
    modifiedAt: "2026-04-14T12:14:00Z",
  },
];

const ALL_DEPARTMENTS: readonly DriveDepartment[] = [
  "Executive",
  "Marketing",
  "Sales",
  "Engineering",
  "Recruiting",
];

export function useDriveData(_companyId: string, filter: DriveFilter): DriveData {
  const files = MOCK_FILES;

  const visibleFiles = useMemo(() => {
    if (filter.kind === "all") return files;
    if (filter.kind === "pending") {
      return files.filter((f) => f.status === "pending_review");
    }
    return files.filter((f) => f.department === filter.department);
  }, [files, filter]);

  const departmentCounts = useMemo(() => {
    const acc: Record<DriveDepartment, number> = {
      Executive: 0,
      Marketing: 0,
      Sales: 0,
      Engineering: 0,
      Recruiting: 0,
    };
    for (const f of files) acc[f.department] += 1;
    return acc;
  }, [files]);

  const pendingCount = useMemo(
    () => files.filter((f) => f.status === "pending_review").length,
    [files],
  );

  return {
    files,
    visibleFiles,
    departmentCounts,
    pendingCount,
    isLoading: false,
    error: null,
  };
}

export const DRIVE_DEPARTMENTS = ALL_DEPARTMENTS;
