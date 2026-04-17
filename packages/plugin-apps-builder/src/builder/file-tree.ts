/**
 * File-tree serializer for the Code tab (B-03). Turns the flat list of
 * `app_files` rows for a given App into a directory tree the UI can render
 * directly. Paths in the DB are stored with their full `apps/<app_id>/`
 * prefix; the serializer strips that prefix so the returned tree is rooted
 * at the App itself (i.e. "package.json" instead of
 * "apps/<app_id>/package.json").
 */

export interface FileTreeLeaf {
  readonly kind: "file";
  readonly name: string;
  readonly path: string;
  readonly sizeBytes: number;
}

export interface FileTreeNode {
  readonly kind: "directory";
  readonly name: string;
  readonly path: string;
  readonly children: Array<FileTreeNode | FileTreeLeaf>;
}

export interface FileTreeEntryInput {
  readonly path: string;
  readonly sizeBytes: number;
}

/**
 * Build a directory tree from a flat list of DB paths.
 *
 * - `appId` is the UUID whose `apps/<appId>/` prefix gets stripped.
 * - Inputs with paths that don't match the prefix are skipped (defensive —
 *   shouldn't happen in practice because the scaffolder roots everything
 *   under that prefix).
 * - Directories are synthesized from the parent components of each file
 *   path and sorted case-insensitively so the tree is stable across runs.
 */
export function buildFileTree(appId: string, entries: FileTreeEntryInput[]): FileTreeNode {
  const prefix = `apps/${appId}/`;
  const root: FileTreeNode = { kind: "directory", name: "", path: "", children: [] };

  for (const entry of entries) {
    if (!entry.path.startsWith(prefix)) continue;
    const relative = entry.path.slice(prefix.length);
    if (!relative) continue;
    insertFile(root, relative, entry.sizeBytes);
  }

  sortTree(root);
  return root;
}

function insertFile(root: FileTreeNode, relativePath: string, sizeBytes: number): void {
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length === 0) return;

  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const segment = parts[i]!;
    const segmentPath = parts.slice(0, i + 1).join("/");
    let next = cursor.children.find(
      (c) => c.kind === "directory" && c.name === segment,
    ) as FileTreeNode | undefined;
    if (!next) {
      next = { kind: "directory", name: segment, path: segmentPath, children: [] };
      cursor.children.push(next);
    }
    cursor = next;
  }

  const fileName = parts[parts.length - 1]!;
  cursor.children.push({
    kind: "file",
    name: fileName,
    path: relativePath,
    sizeBytes,
  });
}

function sortTree(node: FileTreeNode): void {
  node.children.sort((a, b) => {
    // Directories first, then alphabetical (case-insensitive).
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
  for (const child of node.children) {
    if (child.kind === "directory") sortTree(child);
  }
}
