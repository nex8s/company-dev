import { api } from "./client";

/**
 * Typed client for `@paperclipai/plugin-apps-builder` HTTP routes
 * (B-02 + B-03). Mounted under `/api/companies/:companyId/plugin-apps-builder/...`
 * — see `server/src/app.ts` and `packages/plugin-apps-builder/src/server/router.ts`.
 *
 * Wire shapes mirror the router's DTO transforms (`toAppDto`,
 * `toDeploymentDto`) and the `FileTreeNode` / `FileTreeLeaf` interfaces
 * exported from the plugin's `builder/file-tree.ts`. Duplicating them
 * here keeps the UI bundle free of the plugin's drizzle deps.
 */

export interface AppDto {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly channelId: string | null;
  readonly connections: Record<string, unknown>;
  readonly envVars: Record<string, string>;
  readonly productionDomain: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppPreviewDto {
  readonly productionDomain: string | null;
  readonly status: "deployed" | "not_deployed";
}

export interface FileTreeLeafDto {
  readonly kind: "file";
  readonly name: string;
  readonly path: string;
  readonly sizeBytes: number;
}

export interface FileTreeNodeDto {
  readonly kind: "directory";
  readonly name: string;
  readonly path: string;
  readonly children: ReadonlyArray<FileTreeNodeDto | FileTreeLeafDto>;
}

export interface FileMetadataDto {
  readonly path: string;
  readonly sizeBytes: number;
}

export interface BlobDto {
  readonly path: string;
  readonly content: string;
  readonly sizeBytes: number;
  readonly updatedAt: string;
}

export type DeploymentStatus =
  | "queued"
  | "building"
  | "deployed"
  | "failed";

export interface DeploymentDto {
  readonly id: string;
  readonly appId: string;
  readonly url: string | null;
  readonly status: DeploymentStatus;
  readonly triggeredByAgentId: string | null;
  readonly triggeredAt: string;
  readonly completedAt: string | null;
}

const base = (companyId: string, appId: string) =>
  `/companies/${companyId}/plugin-apps-builder/apps/${appId}`;

export const pluginAppsBuilderApi = {
  getApp: (companyId: string, appId: string) =>
    api.get<{ app: AppDto }>(base(companyId, appId)),

  getPreview: (companyId: string, appId: string) =>
    api.get<{ preview: AppPreviewDto }>(`${base(companyId, appId)}/preview`),

  listFiles: (companyId: string, appId: string) =>
    api.get<{
      tree: FileTreeNodeDto;
      count: number;
      files: readonly FileMetadataDto[];
    }>(`${base(companyId, appId)}/files`),

  getFileBlob: (companyId: string, appId: string, path: string) =>
    api.get<{ file: BlobDto }>(
      `${base(companyId, appId)}/files/blob?path=${encodeURIComponent(path)}`,
    ),

  listDeployments: (companyId: string, appId: string) =>
    api.get<{ deployments: readonly DeploymentDto[] }>(
      `${base(companyId, appId)}/deployments`,
    ),

  getEnv: (companyId: string, appId: string) =>
    api.get<{ envVars: Record<string, string> }>(
      `${base(companyId, appId)}/env`,
    ),

  patchEnv: (
    companyId: string,
    appId: string,
    envVars: Record<string, string>,
  ) =>
    api.patch<{ envVars: Record<string, string> }>(
      `${base(companyId, appId)}/env`,
      { envVars },
    ),

  deleteEnv: (companyId: string, appId: string, key: string) =>
    api.delete<{ envVars: Record<string, string> }>(
      `${base(companyId, appId)}/env/${encodeURIComponent(key)}`,
    ),
};
