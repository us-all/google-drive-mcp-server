import { z } from "zod";
import { getDriveClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";

// ── create-folder ───────────────────────────────────────────────────────────

export const createFolderSchema = z.object({
  name: z.string().describe("Name of the folder to create"),
  parentId: z
    .string()
    .optional()
    .default("root")
    .describe("Parent folder ID. Default: 'root'"),
});

export async function createFolder(
  params: z.infer<typeof createFolderSchema>,
) {
  assertWriteAllowed();
  const drive = getDriveClient();

  const response = await drive.files.create({
    requestBody: {
      name: params.name,
      mimeType: FOLDER_MIME,
      parents: [params.parentId],
    },
    fields: "id,name,mimeType,createdTime,webViewLink,parents",
    supportsAllDrives: true,
  });

  return response.data;
}

// ── move-file ───────────────────────────────────────────────────────────────

export const moveFileSchema = z.object({
  fileId: z.string().describe("The ID of the file or folder to move"),
  newParentId: z
    .string()
    .describe("The ID of the destination folder"),
});

export async function moveFile(params: z.infer<typeof moveFileSchema>) {
  assertWriteAllowed();
  const drive = getDriveClient();

  // Get current parents
  const file = await drive.files.get({
    fileId: params.fileId,
    fields: "parents",
    supportsAllDrives: true,
  });

  const previousParents = (file.data.parents ?? []).join(",");

  const response = await drive.files.update({
    fileId: params.fileId,
    addParents: params.newParentId,
    removeParents: previousParents,
    fields: "id,name,mimeType,parents,webViewLink",
    supportsAllDrives: true,
  });

  return response.data;
}

// ── get-folder-tree ─────────────────────────────────────────────────────────

interface TreeNode {
  id: string;
  name: string;
  mimeType: string;
  children?: TreeNode[];
}

export const getFolderTreeSchema = z.object({
  folderId: z
    .string()
    .optional()
    .default("root")
    .describe("Root folder ID to build tree from. Default: 'root'"),
  depth: z.coerce
    .number()
    .optional()
    .default(2)
    .describe("Maximum depth of the tree (1-5). Default: 2"),
});

export async function getFolderTree(
  params: z.infer<typeof getFolderTreeSchema>,
) {
  const drive = getDriveClient();
  const maxDepth = Math.min(params.depth, 5);

  async function buildTree(
    parentId: string,
    currentDepth: number,
  ): Promise<TreeNode[]> {
    if (currentDepth > maxDepth) return [];

    const response = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      pageSize: 100,
      fields: "files(id,name,mimeType)",
      orderBy: "folder,name",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const items = response.data.files ?? [];
    const nodes: TreeNode[] = [];

    for (const item of items) {
      const node: TreeNode = {
        id: item.id!,
        name: item.name!,
        mimeType: item.mimeType!,
      };

      if (item.mimeType === FOLDER_MIME && currentDepth < maxDepth) {
        node.children = await buildTree(item.id!, currentDepth + 1);
      }

      nodes.push(node);
    }

    return nodes;
  }

  const tree = await buildTree(params.folderId, 1);
  return { folderId: params.folderId, depth: maxDepth, tree };
}
